import * as vscode from 'vscode';
import * as path from 'path';
import * as Fmt from 'slate-shared/format/format';
import * as FmtDynamic from 'slate-shared/format/dynamic';
import * as FmtMeta from 'slate-shared/format/meta';
import * as FmtReader from 'slate-shared/format/read';
import { escapeIdentifier } from 'slate-shared/format/common';
import { fileExtension } from 'slate-shared/data/constants';
import { ParsedDocument, ParsedDocumentMap } from '../parsedDocument';
import { parseFile } from '../parse';
import { isDefinitionReferenceToUri, getNameDefinitionLocation, findReferencedDefinition } from '../navigate';
import { RenamedUri, changeParentUri, RangeInfo } from '../../utils';
import { findReferences } from './referenceProvider';

function getNewUri(renamedUris: ReadonlyArray<RenamedUri>, oldUri: vscode.Uri): vscode.Uri | undefined {
    for (const renamedUri of renamedUris) {
        const newUri = changeParentUri(renamedUri, oldUri);
        if (newUri !== undefined) {
            return newUri;
        }
    }
    return undefined;
}

function getChangedPathSegments(oldUri: vscode.Uri, newUri: vscode.Uri): [string[], string[]] {
    const oldSegments = oldUri.fsPath.split(path.sep);
    const newSegments = newUri.fsPath.split(path.sep);
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
    const nameToAdd = names.pop();
    if (nameToAdd === undefined) {
        return true;
    }
    if (pathItem instanceof Fmt.ParentPathItem) {
        return false;
    }
    const newItem = new Fmt.NamedPathItem(nameToAdd);
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
    const nameToRemove = names.shift();
    if (nameToRemove === undefined) {
        return true;
    }
    if (pathItem instanceof Fmt.NamedPathItem && pathItem.name === nameToRemove) {
        return false;
    }
    const newItem = new Fmt.ParentPathItem;
    pathItem.parentPath = newItem;
    return removePathItemsAtStart(newItem, names);
}

function changePathOrigin(changedPath: Fmt.Path, oldOriginUri: vscode.Uri, newOriginUri: vscode.Uri): void {
    const [oldSegments, newSegments] = getChangedPathSegments(oldOriginUri, newOriginUri);
    addPathItemsAtStart(changedPath, oldSegments);
    removePathItemsAtStart(changedPath, newSegments);
}

function changePathTarget(changedPath: Fmt.Path, originUri: vscode.Uri, oldTargetUri: vscode.Uri, newTargetUri: vscode.Uri): void {
    changePathOrigin(changedPath, originUri, oldTargetUri);
    changePathOrigin(changedPath, newTargetUri, originUri);
    const changedName = getChangedName(oldTargetUri, newTargetUri);
    if (changedName) {
        const [oldTargetName, newTargetName] = changedName;
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
        const parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            const nameDefinitionLocation = getNameDefinitionLocation(parsedDocument, position, document);
            if (nameDefinitionLocation) {
                return findReferences(nameDefinitionLocation, true, true, token, document).then((locations: vscode.Location[]) => {
                    const result = new vscode.WorkspaceEdit;
                    const escapedName = escapeIdentifier(newName);
                    for (const location of locations) {
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
        const parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            const nameDefinitionLocation = getNameDefinitionLocation(parsedDocument, position, document);
            if (nameDefinitionLocation) {
                return {
                    range: nameDefinitionLocation.originNameRange,
                    placeholder: nameDefinitionLocation.name
                };
            }
        }
        throw new Error('Cannot rename this object');
    }

    updateFileReferences(renamedUris: ReadonlyArray<RenamedUri>): Thenable<vscode.WorkspaceEdit> {
        return vscode.workspace.findFiles(`**/*${fileExtension}`).then((originUris: vscode.Uri[]) => {
            const result = new vscode.WorkspaceEdit;
            if (originUris.some((oldOriginUri: vscode.Uri) => (getNewUri(renamedUris, oldOriginUri) !== undefined))) {
                const checkUri = (uri: vscode.Uri) => (getNewUri(renamedUris, uri) !== undefined);
                const preCheck = (parsedDocument: ParsedDocument, rangeInfo: FmtReader.ObjectRangeInfo) =>
                    isDefinitionReferenceToUri(parsedDocument, rangeInfo.object, rangeInfo.context, checkUri);
                for (const oldOriginUri of originUris) {
                    const newOriginUri = getNewUri(renamedUris, oldOriginUri);
                    const parsedDocument = parseFile(oldOriginUri, true, undefined, undefined, undefined, newOriginUri ? undefined : preCheck);
                    if (parsedDocument) {
                        const mainDefinition = parsedDocument.file && parsedDocument.file.definitions.length ? parsedDocument.file.definitions[0] : undefined;
                        for (const rangeInfo of parsedDocument.rangeList) {
                            if (mainDefinition && rangeInfo.object === mainDefinition && rangeInfo.nameRange && newOriginUri && this.containsRelativePaths(rangeInfo)) {
                                const changedName = getChangedName(oldOriginUri, newOriginUri);
                                if (changedName) {
                                    const [oldOriginName, newOriginName] = changedName;
                                    if (mainDefinition.name === oldOriginName) {
                                        result.replace(oldOriginUri, rangeInfo.nameRange, escapeIdentifier(newOriginName));
                                    }
                                }
                            }
                            if (rangeInfo.object instanceof Fmt.Path && !(rangeInfo.object.parentPath instanceof Fmt.Path) && rangeInfo.linkRange && this.containsRelativePaths(rangeInfo)) {
                                const referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, rangeInfo.context, undefined, newOriginUri ? undefined : checkUri);
                                if (referencedDefinition) {
                                    const oldTargetUri = referencedDefinition.parsedDocument.uri;
                                    const newTargetUri = getNewUri(renamedUris, oldTargetUri);
                                    const oldPath = new Fmt.Path(rangeInfo.object.name, undefined, rangeInfo.object.parentPath?.clone());
                                    const newPath = oldPath.clone() as Fmt.Path;
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
            }
            return result;
        });
    }

    private containsRelativePaths(rangeInfo: RangeInfo): boolean {
        const context = rangeInfo.context;
        if (!context) {
            // Must be the metamodel reference at the top of the file.
            return true;
        } else if (context.metaModel instanceof FmtDynamic.DynamicMetaModel && context.metaModel.definitions.length) {
            const metaModelDefinition = context.metaModel.definitions[0];
            if (metaModelDefinition.contents instanceof FmtMeta.ObjectContents_MetaModel) {
                if (metaModelDefinition.contents.lookup instanceof FmtMeta.MetaRefExpression_Any) {
                    return true;
                }
            }
        }
        return false;
    }
}
