import * as vscode from 'vscode';
import * as fs from 'fs';  // TODO replace with vscode.workspace.fs / WorkspaceFileAccessor
import * as Fmt from 'slate-shared/format/format';
import * as Ctx from 'slate-shared/format/context';
import * as FmtDynamic from 'slate-shared/format/dynamic';
import * as FmtMeta from 'slate-shared/format/meta';
import { getFileNameFromPath, getFileNameFromPathStr } from 'slate-env-node/format/dynamic';
import { RangeInfo, areUrisEqual } from '../utils';
import { ParsedDocument } from './parsedDocument';
import { readRange } from './utils';
import { parseFile } from './parse';

function findDefinition(definitions: Fmt.DefinitionList, path: Fmt.Path): Fmt.Definition | undefined {
    for (const definition of definitions) {
        if (definition.name === path.name) {
            return definition;
        }
    }
    return undefined;
}

function findDefinitionInFile(file: Fmt.File, path: Fmt.Path, ignorePathPath: boolean): Fmt.Definition | undefined {
    if (path.parentPath instanceof Fmt.Path) {
        const parentDefinition = findDefinitionInFile(file, path.parentPath, ignorePathPath);
        if (parentDefinition) {
            return findDefinition(parentDefinition.innerDefinitions, path);
        }
    } else if (path.parentPath && !ignorePathPath) {
        return undefined;
    }
    return findDefinition(file.definitions, path);
}

export interface ReferencedDefinition {
    parsedDocument: ParsedDocument;
    isMetaModel: boolean;
    definition: Fmt.Definition;
    arguments?: Fmt.ArgumentList;
}

function findReferencedDefinitionInternal(parsedDocument: ParsedDocument, object: Object, context: Ctx.Context | undefined, sourceDocument: vscode.TextDocument | undefined, checkUri: (uri: vscode.Uri) => boolean, reportAllInUri: boolean): ReferencedDefinition | null | undefined {
    if (object instanceof FmtDynamic.DynamicMetaRefExpression && parsedDocument.metaModelDocuments) {
        const metaModelDocument = parsedDocument.metaModelDocuments.get(object.metaModel);
        if (metaModelDocument && checkUri(metaModelDocument.uri)) {
            return {
                parsedDocument: metaModelDocument,
                isMetaModel: true,
                definition: object.metaDefinition,
                arguments: object.originalArguments
            };
        }
    } else if (object instanceof Fmt.Path) {
        if (parsedDocument.metaModelDocument && parsedDocument.metaModelDocument.file && parsedDocument.metaModelDocument.file.definitions.length && checkUri(parsedDocument.metaModelDocument.uri)) {
            if (reportAllInUri) {
                return null;
            }
            const metaModelDefinition = parsedDocument.metaModelDocument.file.definitions[0];
            if (parsedDocument.file && object === parsedDocument.file.metaModelPath) {
                return {
                    parsedDocument: parsedDocument.metaModelDocument,
                    isMetaModel: true,
                    definition: metaModelDefinition
                };
            }
        }
        if (context && context.metaModel instanceof FmtDynamic.DynamicMetaModel && context.metaModel.definitions.length) {
            const metaModelDefinition = context.metaModel.definitions[0];
            if (metaModelDefinition.contents instanceof FmtMeta.ObjectContents_MetaModel) {
                const lookup = metaModelDefinition.contents.lookup;
                let fileName: string;
                let checkForDirectory = false;
                if (lookup instanceof FmtMeta.MetaRefExpression_self) {
                    fileName = getFileNameFromPath(parsedDocument.uri.fsPath, object, true);
                    if (!fileName) {
                        if (checkUri(parsedDocument.uri)) {
                            if (reportAllInUri) {
                                return null;
                            }
                            if (parsedDocument.file) {
                                const definition = findDefinitionInFile(parsedDocument.file, object, false);
                                if (definition) {
                                    return {
                                        parsedDocument: parsedDocument,
                                        isMetaModel: false,
                                        definition: definition,
                                        arguments: object.arguments
                                    };
                                }
                            }
                        }
                        return undefined;
                    }
                } else if (lookup instanceof FmtMeta.MetaRefExpression_Any) {
                    fileName = getFileNameFromPath(parsedDocument.uri.fsPath, object);
                    checkForDirectory = true;
                } else if (lookup instanceof Fmt.StringExpression) {
                    fileName = getFileNameFromPathStr(context.metaModel.fileName, lookup.value);
                } else {
                    return null;
                }
                const uri = vscode.Uri.file(fileName);
                if (checkUri(uri)) {
                    if (reportAllInUri) {
                        return null;
                    }
                    if (checkForDirectory && !fs.existsSync(fileName)) {
                        const dirName = getFileNameFromPath(parsedDocument.uri.fsPath, object, false, false);
                        if (fs.existsSync(dirName)) {
                            const dirStat = fs.statSync(dirName);
                            if (dirStat.isDirectory()) {
                                return null;
                            }
                        }
                        return undefined;
                    }
                    const referencedDocument = parseFile(uri, false, undefined, undefined, sourceDocument);
                    if (referencedDocument && referencedDocument.file) {
                        const definition = findDefinitionInFile(referencedDocument.file, object, true);
                        if (definition) {
                            return {
                                parsedDocument: referencedDocument,
                                isMetaModel: false,
                                definition: definition,
                                arguments: object.arguments
                            };
                        }
                    }
                }
            }
        }
    }
    return undefined;
}

export function findReferencedDefinition(parsedDocument: ParsedDocument, object: Object, context?: Ctx.Context, sourceDocument?: vscode.TextDocument, checkUri: (uri: vscode.Uri) => boolean = () => true): ReferencedDefinition | null | undefined {
    return findReferencedDefinitionInternal(parsedDocument, object, context, sourceDocument, checkUri, false);
}

export function isDefinitionReferenceToUri(parsedDocument: ParsedDocument, object: Object, context: Ctx.Context | undefined, checkUri: (uri: vscode.Uri) => boolean, sourceDocument?: vscode.TextDocument): boolean {
    return findReferencedDefinitionInternal(parsedDocument, object, context, sourceDocument, checkUri, true) !== undefined;
}

function findObjectContents(parsedDocument: ParsedDocument, object: Object, sourceDocument?: vscode.TextDocument): FmtDynamic.DynamicObjectContents | undefined {
    if (object instanceof Fmt.Definition && object.contents instanceof FmtDynamic.DynamicObjectContents) {
        return object.contents;
    } else if (object instanceof Fmt.CompoundExpression) {
        const objectContents = parsedDocument.objectContentsMap?.get(object);
        if (objectContents) {
            return objectContents;
        }
    }
    return undefined;
}

export interface SignatureInfo {
    signatureCode?: string;
    parsedDocument: ParsedDocument;
    isMetaModel: boolean;
    referencedDefinition?: ReferencedDefinition;
    parameters?: Fmt.Parameter[];
    arguments?: Fmt.Argument[];
}

export function getSignatureInfo(parsedDocument: ParsedDocument, rangeInfo: RangeInfo, position: vscode.Position | undefined, readSignatureCode: boolean, sourceDocument?: vscode.TextDocument, restrictToUri?: vscode.Uri): SignatureInfo | undefined {
    const checkUri = restrictToUri ? (uri: vscode.Uri) => areUrisEqual(restrictToUri, uri) : () => true;
    const referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, rangeInfo.context, sourceDocument, checkUri);
    if (referencedDefinition) {
        if (position && rangeInfo.linkRange?.end.isAfterOrEqual(position)) {
            return {
                parsedDocument: referencedDefinition.parsedDocument,
                isMetaModel: referencedDefinition.isMetaModel,
                referencedDefinition: referencedDefinition
            };
        }
        const definitionRangeInfo = referencedDefinition.parsedDocument.rangeMap.get(referencedDefinition.definition);
        if (definitionRangeInfo && definitionRangeInfo.signatureRange) {
            const signatureCode = readSignatureCode ? readRange(referencedDefinition.parsedDocument.uri, definitionRangeInfo.signatureRange, true, sourceDocument) : undefined;
            return {
                signatureCode: signatureCode,
                parsedDocument: referencedDefinition.parsedDocument,
                isMetaModel: referencedDefinition.isMetaModel,
                referencedDefinition: referencedDefinition,
                parameters: referencedDefinition.definition.parameters,
                arguments: referencedDefinition.arguments
            };
        }
    }
    if (rangeInfo.object instanceof Fmt.CompoundExpression) {
        const expression = rangeInfo.object;
        const nestedArgumentListInfo = parsedDocument.nestedArgumentListsMap?.get(expression.arguments);
        if (nestedArgumentListInfo) {
            const parameterExpressionRangeInfo = nestedArgumentListInfo.targetDocument.rangeMap.get(nestedArgumentListInfo.parameterExpression);
            if (parameterExpressionRangeInfo) {
                const signatureCode = readSignatureCode ? readRange(nestedArgumentListInfo.targetDocument.uri, parameterExpressionRangeInfo.range, true, sourceDocument) : undefined;
                return {
                    signatureCode: signatureCode,
                    parsedDocument: nestedArgumentListInfo.targetDocument,
                    isMetaModel: false,
                    parameters: nestedArgumentListInfo.parameterExpression.parameters,
                    arguments: expression.arguments
                };
            }
        }
    } else if (rangeInfo.object instanceof Fmt.IndexedExpression) {
        const expression = rangeInfo.object;
        if (expression.parameters && expression.arguments) {
            if (position) {
                const bodyRangeInfo = parsedDocument.rangeMap.get(expression.body);
                if (bodyRangeInfo?.range.contains(position)) {
                    return undefined;
                }
            }
            const parametersRangeInfo = parsedDocument.rangeMap.get(expression.parameters);
            if (parametersRangeInfo) {
                const signatureCode = readSignatureCode ? readRange(parsedDocument.uri, parametersRangeInfo.range, true, sourceDocument) : undefined;
                return {
                    signatureCode: signatureCode,
                    parsedDocument: parsedDocument,
                    isMetaModel: false,
                    parameters: expression.parameters,
                    arguments: expression.arguments
                };
            }
        }
    }
    if (parsedDocument.metaModelDocuments) {
        const objectContents = findObjectContents(parsedDocument, rangeInfo.object, sourceDocument);
        if (objectContents) {
            const metaModelDocument = parsedDocument.metaModelDocuments.get(objectContents.metaModel);
            if (metaModelDocument && (!restrictToUri || areUrisEqual(restrictToUri, metaModelDocument.uri))) {
                if (rangeInfo.object instanceof Fmt.Definition) {
                    if (position && rangeInfo.signatureRange && rangeInfo.signatureRange.contains(position)) {
                        return undefined;
                    }
                    if (rangeInfo.object.innerDefinitions.length) {
                        const innerDefinitionRangeInfo = parsedDocument.rangeMap.get(rangeInfo.object.innerDefinitions);
                        if (position && innerDefinitionRangeInfo && innerDefinitionRangeInfo.range.contains(position)) {
                            return undefined;
                        }
                    }
                }
                let signatureCode = readSignatureCode ? '' : undefined;
                const allMembers: Fmt.Parameter[] = [];
                let metaContents = objectContents.metaDefinition.contents;
                while (metaContents instanceof FmtMeta.ObjectContents_DefinedType) {
                    if (metaContents.members) {
                        allMembers.unshift(...metaContents.members);
                        if (readSignatureCode) {
                            const definitionRangeInfo = metaModelDocument.rangeMap.get(metaContents.members);
                            if (definitionRangeInfo) {
                                const text = readRange(metaModelDocument.uri, definitionRangeInfo.range, true, sourceDocument);
                                if (text) {
                                    if (signatureCode) {
                                        signatureCode = ', ' + signatureCode;
                                    }
                                    signatureCode = '#' + text + signatureCode;
                                }
                            }
                        }
                    }
                    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
                        try {
                            const superTypeDefinition = objectContents.metaModel.definitions.getDefinition(metaContents.superType.path.name);
                            metaContents = superTypeDefinition.contents;
                        } catch (error) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                return {
                    signatureCode: signatureCode,
                    parsedDocument: metaModelDocument,
                    isMetaModel: true,
                    parameters: allMembers,
                    arguments: objectContents.originalArguments
                };
            }
        }
    }
    return undefined;
}

export interface DefinitionLink extends vscode.DefinitionLink {
    originNameRange: vscode.Range;
    originObject: Object;
    targetObject: Object;
    name: string;
    referencedDefinition?: ReferencedDefinition;
}

export function getDefinitionLinks(parsedDocument: ParsedDocument, rangeInfo: RangeInfo, position: vscode.Position | undefined, preferSignature: boolean, sourceDocument?: vscode.TextDocument, restrictToUri?: vscode.Uri): DefinitionLink[] {
    const result: DefinitionLink[] = [];
    const signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, false, sourceDocument, restrictToUri);
    if (signatureInfo) {
        if (signatureInfo.referencedDefinition && rangeInfo.nameRange && rangeInfo.linkRange && (!position || rangeInfo.linkRange.contains(position))) {
            const targetRangeInfo = signatureInfo.parsedDocument.rangeMap.get(signatureInfo.referencedDefinition.definition);
            if (targetRangeInfo) {
                let originNameRange: vscode.Range | undefined = rangeInfo.nameRange;
                if (rangeInfo.pathAlias && !position) {
                    const aliasPathRange = parsedDocument.rangeMap.get(rangeInfo.pathAlias.path);
                    originNameRange = aliasPathRange?.nameRange;
                }
                if (originNameRange) {
                    result.push({
                        originNameRange: originNameRange,
                        originObject: rangeInfo.object,
                        originSelectionRange: rangeInfo.linkRange,
                        targetUri: signatureInfo.parsedDocument.uri,
                        targetObject: signatureInfo.referencedDefinition.definition,
                        targetRange: (preferSignature && targetRangeInfo.signatureRange) || targetRangeInfo.range,
                        targetSelectionRange: targetRangeInfo.nameRange,
                        name: signatureInfo.referencedDefinition.definition.name,
                        referencedDefinition: signatureInfo.referencedDefinition
                    });
                }
            }
            if (position) {
                return result;
            }
        }
        if (signatureInfo.parameters && signatureInfo.arguments) {
            for (const arg of signatureInfo.arguments) {
                if (arg.name) {
                    const argRangeInfo = parsedDocument.rangeMap.get(arg);
                    if (argRangeInfo && argRangeInfo.nameRange && (!position || argRangeInfo.nameRange.contains(position))) {
                        for (const param of signatureInfo.parameters) {
                            if (arg.name === param.name) {
                                const targetRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
                                if (targetRangeInfo) {
                                    result.push({
                                        originNameRange: argRangeInfo.nameRange,
                                        originObject: rangeInfo.object,
                                        originSelectionRange: argRangeInfo.nameRange,
                                        targetUri: signatureInfo.parsedDocument.uri,
                                        targetObject: param,
                                        targetRange: targetRangeInfo.range,
                                        targetSelectionRange: targetRangeInfo.nameRange,
                                        name: arg.name,
                                        referencedDefinition: signatureInfo.referencedDefinition
                                    });
                                    if (position) {
                                        return result;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (rangeInfo.nameRange && (!position || rangeInfo.nameRange.contains(position)) && (!restrictToUri || areUrisEqual(restrictToUri, parsedDocument.uri))) {
        let variable: Fmt.Parameter | undefined = undefined;
        if (rangeInfo.object instanceof Fmt.VariableRefExpression) {
            variable = rangeInfo.object.variable;
        } else if (rangeInfo.object instanceof Fmt.DocumentationItem) {
            variable = rangeInfo.object.parameter;
        }
        if (variable) {
            const targetRangeInfo = parsedDocument.rangeMap.get(variable);
            if (targetRangeInfo) {
                result.push({
                    originNameRange: rangeInfo.nameRange,
                    originObject: rangeInfo.object,
                    originSelectionRange: rangeInfo.nameRange,
                    targetUri: parsedDocument.uri,
                    targetObject: variable,
                    targetRange: targetRangeInfo.range,
                    targetSelectionRange: targetRangeInfo.nameRange,
                    name: variable.name
                });
            }
            if (position) {
                return result;
            }
        }
    }
    return result;
}

export function getNameDefinitionLocation(parsedDocument: ParsedDocument, position: vscode.Position, sourceDocument?: vscode.TextDocument): DefinitionLink | undefined {
    for (const rangeInfo of parsedDocument.rangeList) {
        if (rangeInfo.range.contains(position)) {
            if ((rangeInfo.object instanceof Fmt.Definition || rangeInfo.object instanceof Fmt.Parameter) && rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
                let referencedDefinition: ReferencedDefinition | undefined = undefined;
                if (rangeInfo.object instanceof Fmt.Definition) {
                    referencedDefinition = {
                        definition: rangeInfo.object,
                        isMetaModel: false,
                        parsedDocument: parsedDocument
                    };
                }
                return {
                    originNameRange: rangeInfo.nameRange,
                    originObject: rangeInfo.object,
                    originSelectionRange: rangeInfo.nameRange,
                    targetUri: parsedDocument.uri,
                    targetObject: rangeInfo.object,
                    targetRange: rangeInfo.range,
                    targetSelectionRange: rangeInfo.nameRange,
                    name: rangeInfo.object.name,
                    referencedDefinition: referencedDefinition
                };
            }
            const definitionLinks = getDefinitionLinks(parsedDocument, rangeInfo, position, false, sourceDocument);
            if (definitionLinks.length) {
                return definitionLinks[0];
            }
        }
    }
    return undefined;
}

export function getArgumentType(param: Fmt.Parameter): Fmt.Expression | undefined {
    if (param.type instanceof FmtDynamic.DynamicMetaRefExpression) {
        const metaContents = param.type.metaDefinition.contents;
        if (metaContents instanceof FmtMeta.ObjectContents_ParameterType) {
            return metaContents.argumentType;
        }
    }
    return undefined;
}
