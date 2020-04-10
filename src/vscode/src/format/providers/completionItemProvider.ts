'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';  // TODO replace with vscode.workspace.fs / WorkspaceFileAccessor
import * as Fmt from '../../../../shared/format/format';
import * as FmtReader from '../../../../shared/format/read';
import { escapeIdentifier } from '../../../../shared/format/common';
import * as FmtDynamic from '../../../../shared/format/dynamic';
import * as FmtMeta from '../../../../shared/format/meta';
import { getFileNameFromPath, fileExtension, getFileNameFromPathStr } from '../../../../fs/format/dynamic';
import { ParsedDocument, ParsedDocumentMap } from '../parsedDocument';
import { findReferencedDefinition, SignatureInfo, getSignatureInfo, getArgumentTypeOfReferencedDefinitionParameter } from '../navigate';
import { readRange } from '../utils';
import { parseFile } from '../parse';

export class SlateCompletionItemProvider implements vscode.CompletionItemProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            let result: vscode.CompletionItem[] = [];
            let variableNames = new Set<string>();
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    let isEmptyExpression = rangeInfo.object instanceof FmtReader.EmptyExpression || (rangeInfo.object instanceof Fmt.ArrayExpression && !rangeInfo.object.items.length && position.isAfter(rangeInfo.range.start) && position.isBefore(rangeInfo.range.end));
                    let signatureInfo: SignatureInfo | undefined = undefined;
                    if (context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
                        if (!(rangeInfo.linkRange && rangeInfo.linkRange.contains(position))) {
                            signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, false, document);
                            if (signatureInfo && signatureInfo.parameters) {
                                let argNameRange: vscode.Range | undefined = undefined;
                                let filledParameters = new Set<Fmt.Parameter>();
                                if (signatureInfo.arguments) {
                                    let argIndex = 0;
                                    for (let arg of signatureInfo.arguments) {
                                        let argRangeInfo = parsedDocument.rangeMap.get(arg);
                                        if (argRangeInfo && !argRangeInfo.range.isEmpty) {
                                            if (argRangeInfo.range.contains(position)) {
                                                if (!arg.name && arg.value instanceof Fmt.VariableRefExpression) {
                                                    // Looks like a variable, but could turn into an argument name.
                                                    argNameRange = argRangeInfo.range;
                                                } else {
                                                    signatureInfo = undefined;
                                                }
                                                break;
                                            }
                                            if (arg.name || argRangeInfo.range.end.isBefore(position)) {
                                                let paramIndex = 0;
                                                for (let param of signatureInfo.parameters) {
                                                    let paramIsList = param.list;
                                                    if (arg.name ? arg.name === param.name : paramIsList ? argIndex >= paramIndex : argIndex === paramIndex) {
                                                        filledParameters.add(param);
                                                        break;
                                                    }
                                                    paramIndex++;
                                                }
                                            }
                                        }
                                        argIndex++;
                                    }
                                }
                                if (signatureInfo && signatureInfo.parameters) {
                                    for (let param of signatureInfo.parameters) {
                                        if (!filledParameters.has(param)) {
                                            let paramRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
                                            if (paramRangeInfo && paramRangeInfo.nameRange) {
                                                let paramCode = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.nameRange, false, document);
                                                if (paramCode) {
                                                    let assignment = paramCode + ' = ';
                                                    let insertText: vscode.SnippetString | undefined = undefined;
                                                    let type = signatureInfo.isMetaModel ? param.type.expression : getArgumentTypeOfReferencedDefinitionParameter(param);
                                                    if (type) {
                                                        if (param.type.arrayDimensions) {
                                                            insertText = new vscode.SnippetString(assignment + '[$0]');
                                                        } else if (type instanceof Fmt.DefinitionRefExpression) {
                                                            if (!type.path.parentPath && rangeInfo.context && rangeInfo.context.metaModel instanceof FmtDynamic.DynamicMetaModel) {
                                                                let metaModel = rangeInfo.context.metaModel;
                                                                try {
                                                                    let metaDefinition = metaModel.definitions.getDefinition(type.path.name);
                                                                    if (metaDefinition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && metaModel.hasObjectContents(metaDefinition)) {
                                                                        insertText = new vscode.SnippetString(assignment + '{$0}');
                                                                    }
                                                                } catch (error) {
                                                                }
                                                            }
                                                        } else if (type instanceof FmtMeta.MetaRefExpression_ParameterList || type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
                                                            insertText = new vscode.SnippetString(assignment + '#($0)');
                                                        } else if (type instanceof FmtMeta.MetaRefExpression_ArgumentList) {
                                                            insertText = new vscode.SnippetString(assignment + '{$0}');
                                                        } else if (type instanceof FmtMeta.MetaRefExpression_String) {
                                                            insertText = new vscode.SnippetString(assignment + '\'$0\'');
                                                        }
                                                    }
                                                    let paramDefinition = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.range, true, document);
                                                    let documentation: vscode.MarkdownString | undefined = undefined;
                                                    if (paramDefinition) {
                                                        documentation = new vscode.MarkdownString;
                                                        documentation.appendCodeblock(paramDefinition);
                                                    }
                                                    result.push({
                                                        label: assignment,
                                                        range: argNameRange,
                                                        insertText: insertText,
                                                        documentation: documentation,
                                                        kind: vscode.CompletionItemKind.Field
                                                    });
                                                }
                                            }
                                        }
                                    }
                                    if (rangeInfo.object instanceof Fmt.MetaRefExpression || rangeInfo.object instanceof Fmt.CompoundExpression) {
                                        isEmptyExpression = true;
                                    }
                                }
                            }
                        }
                        if (((isEmptyExpression && (!rangeInfo.metaDefinitions || rangeInfo.metaDefinitions.allowArbitraryReferences())) || rangeInfo.object instanceof Fmt.VariableRefExpression) && rangeInfo.context) {
                            let variables = rangeInfo.context.getVariables();
                            for (let variableIndex = variables.length - 1; variableIndex >= 0; variableIndex--) {
                                let param = variables[variableIndex];
                                if (variableNames.has(param.name)) {
                                    // Cannot reference shadowed variable.
                                    continue;
                                } else {
                                    variableNames.add(param.name);
                                }
                                let paramRangeInfo = parsedDocument.rangeMap.get(param);
                                if (paramRangeInfo && paramRangeInfo.nameRange) {
                                    let paramCode = readRange(parsedDocument.uri, paramRangeInfo.nameRange, false, document);
                                    if (paramCode) {
                                        let paramDefinition = readRange(parsedDocument.uri, paramRangeInfo.range, true, document);
                                        let documentation: vscode.MarkdownString | undefined = undefined;
                                        if (paramDefinition) {
                                            documentation = new vscode.MarkdownString;
                                            documentation.appendCodeblock(paramDefinition);
                                        }
                                        result.unshift({
                                            label: paramCode,
                                            range: rangeInfo.object instanceof Fmt.VariableRefExpression ? (rangeInfo.nameRange ?? rangeInfo.range) : undefined,
                                            documentation: documentation,
                                            kind: vscode.CompletionItemKind.Variable
                                        });
                                    }
                                }
                            }
                        }
                    }
                    if ((isEmptyExpression || (rangeInfo.object instanceof Fmt.MetaRefExpression && rangeInfo.nameRange && rangeInfo.nameRange.contains(position))) && rangeInfo.metaDefinitions instanceof FmtDynamic.DynamicMetaDefinitionFactory && parsedDocument.metaModelDocuments) {
                        let metaModelDocument = parsedDocument.metaModelDocuments.get(rangeInfo.metaDefinitions.metaModel);
                        if (metaModelDocument) {
                            let prefix = isEmptyExpression ? '%' : '';
                            let range: vscode.Range | undefined = undefined;
                            if (rangeInfo.object instanceof FmtDynamic.DynamicMetaRefExpression && rangeInfo.object.name && rangeInfo.nameRange && !isEmptyExpression) {
                                range = rangeInfo.nameRange;
                            }
                            for (let definition of rangeInfo.metaDefinitions.metaDefinitions.values()) {
                                let definitionRangeInfo = metaModelDocument.rangeMap.get(definition);
                                if (definitionRangeInfo) {
                                    let signature = definitionRangeInfo.signatureRange ? readRange(metaModelDocument.uri, definitionRangeInfo.signatureRange, true, document) : undefined;
                                    let documentation: vscode.MarkdownString | undefined = undefined;
                                    if (signature) {
                                        documentation = new vscode.MarkdownString;
                                        documentation.appendCodeblock(signature);
                                    }
                                    result.push({
                                        label: prefix + escapeIdentifier(definition.name),
                                        range: range,
                                        documentation: documentation,
                                        kind: vscode.CompletionItemKind.Keyword
                                    });
                                }
                            }
                        }
                    }
                    if ((isEmptyExpression && (!rangeInfo.metaDefinitions || rangeInfo.metaDefinitions.allowArbitraryReferences())) || (rangeInfo.object instanceof Fmt.Path && rangeInfo.nameRange && rangeInfo.nameRange.contains(position))) {
                        let prefix = rangeInfo.object instanceof Fmt.Path ? '' : '$';
                        let range: vscode.Range | undefined = undefined;
                        if (rangeInfo.object instanceof Fmt.Path && rangeInfo.object.name) {
                            range = rangeInfo.nameRange;
                        }
                        if (rangeInfo.object instanceof Fmt.Path && rangeInfo.object.parentPath instanceof Fmt.Path) {
                            let parentDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object.parentPath, rangeInfo.context, document);
                            if (parentDefinition) {
                                for (let definition of parentDefinition.definition.innerDefinitions) {
                                    let definitionRangeInfo = parentDefinition.parsedDocument.rangeMap.get(definition);
                                    let signature = definitionRangeInfo ? readRange(parentDefinition.parsedDocument.uri, definitionRangeInfo.signatureRange, true, document) : undefined;
                                    let documentation: vscode.MarkdownString | undefined = undefined;
                                    if (signature) {
                                        documentation = new vscode.MarkdownString;
                                        documentation.appendCodeblock(signature);
                                    }
                                    result.push({
                                        label: escapeIdentifier(definition.name),
                                        range: range,
                                        documentation: documentation,
                                        kind: vscode.CompletionItemKind.Reference
                                    });
                                }
                            }
                        } else {
                            if (rangeInfo.object instanceof Fmt.Path && rangeInfo.object.parentPath) {
                                let parentPathRange = parsedDocument.rangeMap.get(rangeInfo.object.parentPath);
                                if (parentPathRange && parentPathRange.range.isEqual(rangeInfo.range)) {
                                    prefix = '/';
                                }
                            }
                            let addParent = true;
                            if (parsedDocument.file && rangeInfo.object instanceof Fmt.Path && rangeInfo.object === parsedDocument.file.metaModelPath) {
                                let currentPath = getFileNameFromPath(parsedDocument.uri.fsPath, rangeInfo.object, true, false);
                                try {
                                    for (let fileName of fs.readdirSync(currentPath)) {
                                        let fullPath = path.join(currentPath, fileName);
                                        let stat = fs.statSync(fullPath);
                                        if (stat.isDirectory()) {
                                            result.push({
                                                label: prefix + escapeIdentifier(fileName),
                                                range: range,
                                                kind: vscode.CompletionItemKind.Folder
                                            });
                                        } else if (stat.isFile() && fileName.endsWith(fileExtension)) {
                                            result.push({
                                                label: prefix + escapeIdentifier(fileName.substring(0, fileName.length - fileExtension.length)),
                                                range: range,
                                                kind: vscode.CompletionItemKind.File
                                            });
                                        }
                                    }
                                } catch (error) {
                                }
                            }
                            if (rangeInfo.context && rangeInfo.context.metaModel instanceof FmtDynamic.DynamicMetaModel && rangeInfo.context.metaModel.definitions.length) {
                                let metaModelDefinition = rangeInfo.context.metaModel.definitions[0];
                                if (metaModelDefinition.contents instanceof FmtMeta.ObjectContents_MetaModel) {
                                    let lookup = metaModelDefinition.contents.lookup;
                                    let currentFile: string | undefined = undefined;
                                    let currentDirectory: string | undefined = undefined;
                                    let referencedDocument: ParsedDocument | undefined = undefined;
                                    if (lookup instanceof FmtMeta.MetaRefExpression_self) {
                                        if (rangeInfo.object instanceof Fmt.Path && rangeInfo.object.parentPath) {
                                            let fileName = getFileNameFromPath(parsedDocument.uri.fsPath, rangeInfo.object, true);
                                            if (fileName && fs.existsSync(fileName)) {
                                                currentFile = fileName;
                                            } else {
                                                currentDirectory = getFileNameFromPath(parsedDocument.uri.fsPath, rangeInfo.object, true, false);
                                            }
                                        } else {
                                            result.push({
                                                label: prefix + '.',
                                                range: range,
                                                kind: vscode.CompletionItemKind.Folder
                                            });
                                            referencedDocument = parsedDocument;
                                        }
                                    } else if (lookup instanceof FmtMeta.MetaRefExpression_Any) {
                                        if (rangeInfo.object instanceof Fmt.Path) {
                                            currentDirectory = getFileNameFromPath(parsedDocument.uri.fsPath, rangeInfo.object, true, false);
                                        } else {
                                            currentDirectory = path.dirname(parsedDocument.uri.fsPath);
                                        }
                                    } else if (lookup instanceof Fmt.StringExpression) {
                                        currentFile = getFileNameFromPathStr(rangeInfo.context.metaModel.fileName, lookup.value);
                                        addParent = false;
                                    }
                                    try {
                                        if (currentFile) {
                                            referencedDocument = parseFile(vscode.Uri.file(currentFile));
                                        }
                                        if (currentDirectory) {
                                            for (let fileName of fs.readdirSync(currentDirectory)) {
                                                let fullPath = path.join(currentDirectory, fileName);
                                                let stat = fs.statSync(fullPath);
                                                if (stat.isDirectory()) {
                                                    result.push({
                                                        label: prefix + escapeIdentifier(fileName),
                                                        range: range,
                                                        kind: vscode.CompletionItemKind.Folder
                                                    });
                                                } else if (stat.isFile() && fileName.endsWith(fileExtension)) {
                                                    if (lookup instanceof FmtMeta.MetaRefExpression_Any) {
                                                        try {
                                                            let fileDocument = parseFile(vscode.Uri.file(fullPath));
                                                            if (fileDocument && fileDocument.file && fileDocument.file.definitions.length) {
                                                                let definition = fileDocument.file.definitions[0];
                                                                if (definition.name + fileExtension === fileName) {
                                                                    let definitionRangeInfo = fileDocument.rangeMap.get(definition);
                                                                    let signature = definitionRangeInfo ? readRange(fileDocument.uri, definitionRangeInfo.signatureRange, true, document) : undefined;
                                                                    let documentation: vscode.MarkdownString | undefined = undefined;
                                                                    if (signature) {
                                                                        documentation = new vscode.MarkdownString;
                                                                        documentation.appendCodeblock(signature);
                                                                    }
                                                                    result.push({
                                                                        label: prefix + escapeIdentifier(definition.name),
                                                                        range: range,
                                                                        documentation: documentation,
                                                                        kind: vscode.CompletionItemKind.Reference
                                                                    });
                                                                }
                                                            }
                                                        } catch (error) {
                                                        }
                                                    } else {
                                                        result.push({
                                                            label: prefix + escapeIdentifier(fileName.substring(0, fileName.length - fileExtension.length)),
                                                            range: range,
                                                            kind: vscode.CompletionItemKind.File
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    } catch (error) {
                                    }
                                    if (referencedDocument && referencedDocument.file) {
                                        for (let definition of referencedDocument.file.definitions) {
                                            let definitionRangeInfo = referencedDocument.rangeMap.get(definition);
                                            let signature = definitionRangeInfo ? readRange(referencedDocument.uri, definitionRangeInfo.signatureRange, true, document) : undefined;
                                            let documentation: vscode.MarkdownString | undefined = undefined;
                                            if (signature) {
                                                documentation = new vscode.MarkdownString;
                                                documentation.appendCodeblock(signature);
                                            }
                                            result.push({
                                                label: prefix + escapeIdentifier(definition.name),
                                                range: range,
                                                documentation: documentation,
                                                kind: vscode.CompletionItemKind.Reference
                                            });
                                        }
                                    }
                                }
                            }
                            if (addParent) {
                                result.push({
                                    label: prefix + '..',
                                    range: range,
                                    kind: vscode.CompletionItemKind.Folder
                                });
                            }
                        }
                    }
                    if (signatureInfo || (rangeInfo.object instanceof Fmt.Expression && !(rangeInfo.object instanceof Fmt.VariableRefExpression))) {
                        break;
                    }
                }
            }
            let index = 0;
            for (let item of result) {
                let sortText = index.toString();
                while (sortText.length < 10) {
                    sortText = "0" + sortText;
                }
                item.sortText = sortText;
                index++;
            }
            return result;
        }
        return undefined;
    }
}
