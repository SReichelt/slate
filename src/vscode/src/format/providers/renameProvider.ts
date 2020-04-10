'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as Fmt from '../../../../shared/format/format';
import * as FmtDynamic from '../../../../shared/format/dynamic';
import * as FmtMeta from '../../../../shared/format/meta';
import * as FmtReader from '../../../../shared/format/read';
import { escapeIdentifier } from '../../../../shared/format/common';
import { fileExtension } from '../../../../fs/format/dynamic';
import { ParsedDocument, ParsedDocumentMap } from '../parsedDocument';
import { parseFile } from '../parse';
import { isDefinitionReferenceToUri, getNameDefinitionLocation, findReferencedDefinition } from '../navigate';
import { RenamedUri, changeParentUri } from '../../utils';
import { findReferences } from './referenceProvider';

function getNewUri(renamedUris: ReadonlyArray<RenamedUri>, oldUri: vscode.Uri): vscode.Uri | undefined {
    for (let renamedUri of renamedUris) {
        let newUri = changeParentUri(renamedUri, oldUri);
        if (newUri !== undefined) {
            return newUri;
        }
    }
    return undefined;
}

function getChangedPathSegments(oldUri: vscode.Uri, newUri: vscode.Uri): [string[], string[]] {
    let oldSegments = oldUri.fsPath.split(path.sep);
    let newSegments = newUri.fsPath.split(path.sep);
    if (oldSegments.length && newSegments.length) {
        oldSegments.pop();
        newSegments.pop();
        while (oldSegments.length && newSegments.length && oldSegments[0] === newSegments[0]) {
            oldSegments.shift();
            newSegments.shift();
        }
    }
    return [oldSegments, newSegments];
}

function getChangedName(oldUri: vscode.Uri, newUri: vscode.Uri): [string, string] | undefined {
    let oldName = path.basename(oldUri.fsPath);
    let newName = path.basename(newUri.fsPath);
    if (newName !== oldName && oldName.endsWith(fileExtension) && newName.endsWith(fileExtension)) {
        oldName = oldName.substring(0, oldName.length - fileExtension.length);
        newName = newName.substring(0, newName.length - fileExtension.length);
        return [oldName, newName];
    }
    return undefined;
}

function addPathItemsAtStart(pathItem: Fmt.PathItem, names: string[]): boolean {
    if (!names.length) {
        return true;
    }
    if (pathItem.parentPath) {
        if (addPathItemsAtStart(pathItem.parentPath, names)) {
            return true;
        } else {
            pathItem.parentPath = undefined;
        }
    }
    let nameToAdd = names.pop();
    if (nameToAdd === undefined) {
        return true;
    }
    if (pathItem instanceof Fmt.ParentPathItem) {
        return false;
    }
    let newItem = new Fmt.NamedPathItem;
    newItem.name = nameToAdd;
    pathItem.parentPath = newItem;
    return addPathItemsAtStart(newItem, names);
}

function removePathItemsAtStart(pathItem: Fmt.PathItem, names: string[]): boolean {
    if (!names.length) {
        return true;
    }
    if (pathItem.parentPath) {
        if (removePathItemsAtStart(pathItem.parentPath, names)) {
            return true;
        } else {
            pathItem.parentPath = undefined;
        }
    }
    let nameToRemove = names.shift();
    if (nameToRemove === undefined) {
        return true;
    }
    if (pathItem instanceof Fmt.NamedPathItem && pathItem.name === nameToRemove) {
        return false;
    }
    let newItem = new Fmt.ParentPathItem;
    pathItem.parentPath = newItem;
    return removePathItemsAtStart(newItem, names);
}

function changePathOrigin(changedPath: Fmt.Path, oldOriginUri: vscode.Uri, newOriginUri: vscode.Uri): void {
    let [oldSegments, newSegments] = getChangedPathSegments(oldOriginUri, newOriginUri);
    addPathItemsAtStart(changedPath, oldSegments);
    removePathItemsAtStart(changedPath, newSegments);
}

function changePathTarget(changedPath: Fmt.Path, originUri: vscode.Uri, oldTargetUri: vscode.Uri, newTargetUri: vscode.Uri): void {
    changePathOrigin(changedPath, originUri, oldTargetUri);
    changePathOrigin(changedPath, newTargetUri, originUri);
    let changedName = getChangedName(oldTargetUri, newTargetUri);
    if (changedName) {
        let [oldTargetName, newTargetName] = changedName;
        while (changedPath.parentPath instanceof Fmt.Path) {
            changedPath = changedPath.parentPath;
        }
        if (changedPath.name === oldTargetName) {
            changedPath.name = newTargetName;
        }
    }
}

export class SlateRenameProvider implements vscode.RenameProvider {
    constructor(private parsedDocuments: ParsedDocumentMap, private onRenaming?: () => void) {}

    provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.WorkspaceEdit> {
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            let nameDefinitionLocation = getNameDefinitionLocation(parsedDocument, position, token, document);
            if (nameDefinitionLocation) {
                return findReferences(nameDefinitionLocation, true, token, document).then((locations: vscode.Location[]) => {
                    let result = new vscode.WorkspaceEdit;
                    let escapedName = escapeIdentifier(newName);
                    for (let location of locations) {
                        result.replace(location.uri, location.range, escapedName);
                    }
                    if (nameDefinitionLocation && nameDefinitionLocation.referencedDefinition) {
                        let fsPath = nameDefinitionLocation.targetUri.fsPath;
                        if (path.basename(fsPath) === nameDefinitionLocation.name + fileExtension) {
                            fsPath = path.join(path.dirname(fsPath), newName + fileExtension);
                            result.renameFile(nameDefinitionLocation.targetUri, vscode.Uri.file(fsPath));
                        }
                    }
                    if (result.size && this.onRenaming) {
                        this.onRenaming();
                    }
                    return result;
                });
            }
        }
        return undefined;
    }

    prepareRename(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Range | { range: vscode.Range, placeholder: string }> {
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            let nameDefinitionLocation = getNameDefinitionLocation(parsedDocument, position, token, document);
            if (nameDefinitionLocation) {
                return {
                    range: nameDefinitionLocation.originNameRange,
                    placeholder: nameDefinitionLocation.name
                };
            }
        }
        return undefined;
    }

    updateFileReferences(renamedUris: ReadonlyArray<RenamedUri>): Thenable<vscode.WorkspaceEdit> {
        return vscode.workspace.findFiles(`**/*${fileExtension}`).then((originUris: vscode.Uri[]) => {
            let result = new vscode.WorkspaceEdit;
            let checkUri = (uri: vscode.Uri) => (getNewUri(renamedUris, uri) !== undefined);
            let preCheck = (parsedDocument: ParsedDocument, rangeInfo: FmtReader.ObjectRangeInfo) =>
                isDefinitionReferenceToUri(parsedDocument, rangeInfo.object, rangeInfo.context, checkUri);
            for (let oldOriginUri of originUris) {
                let newOriginUri = getNewUri(renamedUris, oldOriginUri);
                let parsedDocument = parseFile(oldOriginUri, undefined, undefined, undefined, newOriginUri ? undefined : preCheck);
                if (parsedDocument) {
                    let mainDefinition = parsedDocument.file && parsedDocument.file.definitions.length ? parsedDocument.file.definitions[0] : undefined;
                    for (let rangeInfo of parsedDocument.rangeList) {
                        if (mainDefinition && rangeInfo.object === mainDefinition && rangeInfo.nameRange && newOriginUri) {
                            let context = rangeInfo.context;
                            if (context && context.metaModel instanceof FmtDynamic.DynamicMetaModel && context.metaModel.definitions.length) {
                                let metaModelDefinition = context.metaModel.definitions[0];
                                if (metaModelDefinition.contents instanceof FmtMeta.ObjectContents_MetaModel) {
                                    if (metaModelDefinition.contents.lookup instanceof FmtMeta.MetaRefExpression_Any) {
                                        let changedName = getChangedName(oldOriginUri, newOriginUri);
                                        if (changedName) {
                                            let [oldOriginName, newOriginName] = changedName;
                                            if (mainDefinition.name === oldOriginName) {
                                                result.replace(oldOriginUri, rangeInfo.nameRange, escapeIdentifier(newOriginName));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (rangeInfo.object instanceof Fmt.Path && !(rangeInfo.object.parentPath instanceof Fmt.Path) && rangeInfo.linkRange) {
                            let referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, rangeInfo.context, undefined, newOriginUri ? undefined : checkUri);
                            if (referencedDefinition) {
                                let oldTargetUri = referencedDefinition.parsedDocument.uri;
                                let newTargetUri = getNewUri(renamedUris, oldTargetUri);
                                let oldPath = new Fmt.Path;
                                oldPath.name = rangeInfo.object.name;
                                oldPath.parentPath = rangeInfo.object.parentPath?.clone();
                                let newPath = oldPath.clone() as Fmt.Path;
                                if (newTargetUri) {
                                    changePathTarget(newPath, oldOriginUri, oldTargetUri, newTargetUri);
                                }
                                if (newOriginUri) {
                                    changePathOrigin(newPath, oldOriginUri, newOriginUri);
                                }
                                if (!newPath.isEquivalentTo(oldPath)) {
                                    result.replace(oldOriginUri, rangeInfo.linkRange, newPath.toString());
                                }
                            }
                        }
                    }
                }
            }
            if (result.size && this.onRenaming) {
                this.onRenaming();
            }
            return result;
        });
    }
}
