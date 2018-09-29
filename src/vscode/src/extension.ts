'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Fmt from '../../shared/format/format';
import * as FmtDynamic from '../../shared/format/dynamic';
import * as FmtMeta from '../../shared/format/meta';
import * as FmtReader from '../../shared/format/read';
import * as FmtWriter from '../../shared/format/write';
import { getFileNameFromPathStr, getFileNameFromPath, readMetaModel, createDynamicMetaModel, getMetaModelWithFallback } from '../../shared/data/dynamic';

const languageId = 'hlm';
const HLM_MODE: vscode.DocumentFilter = { language: languageId, scheme: 'file' };

interface RangeInfo {
    object: Object;
    range: vscode.Range;
    nameRange?: vscode.Range;
    signatureRange?: vscode.Range;
}

interface ParsedDocument {
    uri: vscode.Uri;
    file?: Fmt.File;
    rangeList: RangeInfo[];
    rangeMap: Map<Object, RangeInfo>;
    metaModelDocument?: ParsedDocument;
    metaModel?: FmtDynamic.DynamicMetaModel;
}

type ParsedDocumentMap = Map<vscode.Uri, ParsedDocument>;

function convertLocation(location: FmtReader.Location): vscode.Position {
    return new vscode.Position(location.line, location.col);
}

function convertRange(range: FmtReader.Range): vscode.Range {
    let start = convertLocation(range.start);
    let end = convertLocation(range.end);
    return new vscode.Range(start, end);
}

function convertRangeInfo(object: Object, range: FmtReader.Range, nameRange?: FmtReader.Range, signatureRange?: FmtReader.Range): RangeInfo {
    return {
        object: object,
        range: convertRange(range),
        nameRange: nameRange ? convertRange(nameRange) : undefined,
        signatureRange: signatureRange ? convertRange(signatureRange) : undefined
    };
}

let lastReadFileName: string | undefined = undefined;
let lastReadFileContents: string | undefined = undefined;

function readRangeRaw(uri: vscode.Uri, range?: vscode.Range, sourceDocument?: vscode.TextDocument): string | undefined {
    try {
        let fileName = uri.fsPath;
        if (sourceDocument !== undefined && fileName === sourceDocument.uri.fsPath) {
            return sourceDocument.getText(range);
        } else {
            if (lastReadFileName !== fileName) {
                lastReadFileName = undefined;
                lastReadFileContents = fs.readFileSync(fileName, 'utf8');
                lastReadFileName = fileName;
            }
            let contents = lastReadFileContents!;
            if (range) {
                let position = 0;
                let line = 0;
                for (; line < range.start.line; line++) {
                    position = contents.indexOf('\n', position);
                    if (position < 0) {
                        break;
                    }
                    position++;
                }
                if (position >= 0) {
                    let start = position + range.start.character;
                    for (; line < range.end.line; line++) {
                        position = contents.indexOf('\n', position);
                        if (position < 0) {
                            break;
                        }
                        position++;
                    }
                    if (position >= 0) {
                        let end = position + range.end.character;
                        return contents.substring(start, end);
                    }
                }
            } else {
                return contents;
            }
        }
    } catch (error) {
    }
    return undefined;
}

function readRange(uri: vscode.Uri, range?: vscode.Range, singleLine: boolean = false, sourceDocument?: vscode.TextDocument): string | undefined {
    let raw = readRangeRaw(uri, range, sourceDocument);
    if (raw !== undefined) {
        if (singleLine) {
            let result = '';
            let carry = '';
            for (let c of raw) {
                if (c === '\r' || c === '\n' || c === '\t') {
                    c = ' ';
                }
                if (c === ' ' && (carry === ' ' || carry === '(' || carry === '[' || carry === '{')) {
                    continue;
                }
                if (!(carry === ' ' && (c === ')' || c === ']' || c === '}' || c === ','))) {
                    result += carry;
                }
                carry = c;
            }
            result += carry;
            return result;
        } else if (range) {
            let result = '';
            let spacesToSkip = 0;
            for (let c of raw) {
                if (c === '\n') {
                    spacesToSkip = range.start.character;
                } else if (spacesToSkip) {
                    if (c === ' ' || c === '\t') {
                        spacesToSkip--;
                        continue;
                    } else {
                        spacesToSkip = 0;
                    }
                }
                result += c;
            }
            return result;
        } else {
            return raw;
        }
    }
    return undefined;
}

function findDefinition(definitions: Fmt.DefinitionList, path: Fmt.Path): Fmt.Definition | undefined {
    for (let definition of definitions) {
        if (definition.name === path.name) {
            return definition;
        }
    }
    return undefined;
}

function findDefinitionInFile(file: Fmt.File, path: Fmt.Path, ignorePathPath: boolean): Fmt.Definition | undefined {
    if (path.parentPath instanceof Fmt.Path) {
        let parentDefinition = findDefinitionInFile(file, path.parentPath, ignorePathPath);
        if (parentDefinition) {
            return findDefinition(parentDefinition.innerDefinitions, path);
        }
    } else if (path.parentPath && !ignorePathPath) {
        return undefined;
    }
    return findDefinition(file.definitions, path);
}

interface ReferencedDefinition {
    parsedDocument: ParsedDocument;
    definition: Fmt.Definition;
    arguments?: Fmt.ArgumentList;
}

function findReferencedDefinition(parsedDocument: ParsedDocument, object: Object, sourceDocument?: vscode.TextDocument): ReferencedDefinition | undefined {
    if (object instanceof FmtDynamic.DynamicMetaRefExpression && parsedDocument.metaModelDocument) {
        return {
            parsedDocument: parsedDocument.metaModelDocument,
            definition: object.metaDefinition,
            arguments: object.originalArguments
        };
    } else if (object instanceof Fmt.Path) {
        if (parsedDocument.metaModelDocument && parsedDocument.metaModelDocument.file && parsedDocument.metaModelDocument.file.definitions.length) {
            let metaModelDefinition = parsedDocument.metaModelDocument.file.definitions[0];
            if (parsedDocument.file && object === parsedDocument.file.metaModelPath) {
                return {
                    parsedDocument: parsedDocument.metaModelDocument,
                    definition: metaModelDefinition
                };
            } else {
                // TODO metamodel is context dependent
                if (metaModelDefinition.contents instanceof FmtMeta.ObjectContents_MetaModel) {
                    let lookup = metaModelDefinition.contents.lookup;
                    if (lookup instanceof FmtMeta.MetaRefExpression_self) {
                        // TODO metamodels can actually reference other metamodels via paths
                        if (parsedDocument.file) {
                            let definition = findDefinitionInFile(parsedDocument.file, object, false);
                            if (definition) {
                                return {
                                    parsedDocument: parsedDocument,
                                    definition: definition,
                                    arguments: object.arguments
                                };
                            }
                        }
                    } else if (lookup instanceof FmtMeta.MetaRefExpression_Any || (lookup instanceof Fmt.StringExpression && parsedDocument.metaModelDocument)) {
                        let fileName = lookup instanceof Fmt.StringExpression ? getFileNameFromPathStr(parsedDocument.metaModelDocument.uri.fsPath, lookup.value) : getFileNameFromPath(parsedDocument.uri.fsPath, object);
                        let uri = vscode.Uri.file(fileName);
                        let fileContents = readRange(uri, undefined, false, sourceDocument);
                        if (fileContents) {
                            let referencedDocument = parseFile(uri, fileContents, undefined, sourceDocument);
                            if (referencedDocument.file) {
                                let definition = findDefinitionInFile(referencedDocument.file, object, true);
                                if (definition) {
                                    return {
                                        parsedDocument: referencedDocument,
                                        definition: definition,
                                        arguments: object.arguments
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return undefined;
}

function findObjectContents(parsedDocument: ParsedDocument, object: Object, sourceDocument?: vscode.TextDocument): FmtDynamic.DynamicObjectContents | undefined {
    if (object instanceof Fmt.Definition && object.contents instanceof FmtDynamic.DynamicObjectContents) {
        return object.contents;
    } else if (object instanceof Fmt.CompoundExpression && parsedDocument.metaModel) {
        return parsedDocument.metaModel.objectContentsMap.get(object.arguments);
    }
    return undefined;
}

interface SignatureInfo {
    signatureCode?: string;
    parsedDocument: ParsedDocument;
    referencedDefinition?: ReferencedDefinition;
    parameters?: Fmt.Parameter[];
    arguments?: Fmt.Argument[];
}

function getSignatureInfo(parsedDocument: ParsedDocument, rangeInfo: RangeInfo, position: vscode.Position, sourceDocument?: vscode.TextDocument): SignatureInfo | undefined {
    let referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, sourceDocument);
    if (referencedDefinition) {
        if (rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
            return {
                referencedDefinition: referencedDefinition,
                parsedDocument: referencedDefinition.parsedDocument
            };
        }
        let definitionRangeInfo = referencedDefinition.parsedDocument.rangeMap.get(referencedDefinition.definition);
        if (definitionRangeInfo && definitionRangeInfo.signatureRange) {
            let signatureCode = readRange(referencedDefinition.parsedDocument.uri, definitionRangeInfo.signatureRange, true, sourceDocument);
            return {
                signatureCode: signatureCode,
                referencedDefinition: referencedDefinition,
                parsedDocument: referencedDefinition.parsedDocument,
                parameters: referencedDefinition.definition.parameters,
                arguments: referencedDefinition.arguments
            };
        }
    }
    let objectContents = findObjectContents(parsedDocument, rangeInfo.object, sourceDocument);
    if (objectContents) {
        if (rangeInfo.object instanceof Fmt.Definition) {
            if (rangeInfo.signatureRange && rangeInfo.signatureRange.contains(position)) {
                return undefined;
            }
            let innerDefinitionRangeInfo = parsedDocument.rangeMap.get(rangeInfo.object.innerDefinitions);
            if (innerDefinitionRangeInfo && innerDefinitionRangeInfo.range.contains(position)) {
                return undefined;
            }
        }
        let signatureCode = '';
        let allMembers: Fmt.Parameter[] = [];
        if (parsedDocument.metaModelDocument) {
            let metaContents = objectContents.metaDefinition.contents;
            while (metaContents instanceof FmtMeta.ObjectContents_DefinedType) {
                if (metaContents.members) {
                    allMembers.unshift(...metaContents.members);
                    let definitionRangeInfo = parsedDocument.metaModelDocument.rangeMap.get(metaContents.members);
                    if (definitionRangeInfo) {
                        if (signatureCode) {
                            signatureCode = ', ' + signatureCode;
                        }
                        signatureCode = '#' + readRange(parsedDocument.metaModelDocument.uri, definitionRangeInfo.range, true, sourceDocument) + signatureCode;
                    }
                }
                if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath && parsedDocument.metaModel) {
                    try {
                        let superTypeDefinition = parsedDocument.metaModel.definitions.getDefinition(metaContents.superType.path.name);
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
                parsedDocument: parsedDocument.metaModelDocument,
                parameters: allMembers,
                arguments: objectContents.originalArguments
            };
        }
    }
    return undefined;
}

class HLMDefinitionProvider implements vscode.DefinitionProvider, vscode.HoverProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
        let definitionLink = this.getDefinitionLink(document, position, token, false);
        if (definitionLink !== undefined) {
            return [definitionLink];
        }
        return undefined;
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        // TODO display comment
        let definitionLink = this.getDefinitionLink(document, position, token, true);
        if (definitionLink !== undefined && !token.isCancellationRequested) {
            let hoverCode: string | undefined = readRange(definitionLink.targetUri, definitionLink.targetRange, false, document);
            if (hoverCode) {
                let hoverText = new vscode.MarkdownString;
                hoverText.appendCodeblock(hoverCode);
                return new vscode.Hover(hoverText, definitionLink.originSelectionRange);
            }
        }
        return undefined;
    }

    private getDefinitionLink(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, preferSignature: boolean): vscode.DefinitionLink | undefined {
        let parsedDocument = this.parsedDocuments.get(document.uri);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    let signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, document);
                    if (signatureInfo) {
                        if (signatureInfo.referencedDefinition && rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
                            let targetRangeInfo = signatureInfo.parsedDocument.rangeMap.get(signatureInfo.referencedDefinition.definition);
                            if (targetRangeInfo) {
                                return {
                                    originSelectionRange: rangeInfo.nameRange,
                                    targetUri: signatureInfo.parsedDocument.uri,
                                    targetRange: (preferSignature && targetRangeInfo.signatureRange) || targetRangeInfo.range,
                                    targetSelectionRange: targetRangeInfo.nameRange
                                };
                            }
                        }
                        if (signatureInfo.parameters && signatureInfo.arguments) {
                            for (let arg of signatureInfo.arguments) {
                                if (arg.name) {
                                    let argRangeInfo = parsedDocument.rangeMap.get(arg);
                                    if (argRangeInfo && argRangeInfo.nameRange && argRangeInfo.nameRange.contains(position)) {
                                        for (let param of signatureInfo.parameters) {
                                            if (arg.name === param.name) {
                                                let targetRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
                                                if (targetRangeInfo) {
                                                    return {
                                                        originSelectionRange: argRangeInfo.nameRange,
                                                        targetUri: signatureInfo.parsedDocument.uri,
                                                        targetRange: targetRangeInfo.range,
                                                        targetSelectionRange: targetRangeInfo.nameRange
                                                    };
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (rangeInfo.object instanceof Fmt.VariableRefExpression && rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
                        let targetRangeInfo = parsedDocument.rangeMap.get(rangeInfo.object.variable);
                        if (targetRangeInfo) {
                            return {
                                originSelectionRange: rangeInfo.nameRange,
                                targetUri: document.uri,
                                targetRange: targetRangeInfo.range,
                                targetSelectionRange: targetRangeInfo.nameRange
                            };
                        }
                    }
                }
            }
        }
        return undefined;
    }
}

class HLMHighlightProvider implements vscode.DocumentHighlightProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        let parsedDocument = this.parsedDocuments.get(document.uri);
        if (parsedDocument) {
            let variable: Fmt.Parameter | undefined = undefined;
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
                    if (rangeInfo.object instanceof Fmt.Parameter) {
                        variable = rangeInfo.object;
                        break;
                    } else if (rangeInfo.object instanceof Fmt.VariableRefExpression) {
                        variable = rangeInfo.object.variable;
                        break;
                    }
                }
            }
            if (variable) {
                let highlights: vscode.DocumentHighlight[] = [];
                for (let rangeInfo of parsedDocument.rangeList) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    if (rangeInfo.nameRange) {
                        if (rangeInfo.object === variable) {
                            highlights.push(new vscode.DocumentHighlight(rangeInfo.nameRange, vscode.DocumentHighlightKind.Write));
                        } else if (rangeInfo.object instanceof Fmt.VariableRefExpression && rangeInfo.object.variable === variable) {
                            highlights.push(new vscode.DocumentHighlight(rangeInfo.nameRange, vscode.DocumentHighlightKind.Read));
                        }
                    }
                }
                return highlights;
            }
        }
        return undefined;
    }
}

class HLMSignatureHelpProvider implements vscode.SignatureHelpProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SignatureHelp> {
        let parsedDocument = this.parsedDocuments.get(document.uri);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    let signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, document);
                    if (signatureInfo && signatureInfo.signatureCode && signatureInfo.parameters) {
                        let signature = new vscode.SignatureInformation(signatureInfo.signatureCode);
                        for (let param of signatureInfo.parameters) {
                            let paramRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
                            let paramCode: string | undefined = undefined;
                            if (paramRangeInfo) {
                                paramCode = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.range, true, document);
                            }
                            signature.parameters.push(new vscode.ParameterInformation(paramCode || param.name));
                        }
                        let paramIndex = 0;
                        if (signatureInfo.arguments && signatureInfo.arguments.length) {
                            let argIndex = 0;
                            let paramIsList = false;
                            let prevArgRangeInfo: RangeInfo | undefined = undefined;
                            for (let arg of signatureInfo.arguments) {
                                let argRangeInfo = parsedDocument.rangeMap.get(arg);
                                if (argRangeInfo && position.isAfterOrEqual(argRangeInfo.range.start)) {
                                    paramIndex = 0;
                                    for (let param of signatureInfo.parameters) {
                                        paramIsList = param.list;
                                        if (arg.name ? arg.name === param.name : paramIsList ? argIndex >= paramIndex : argIndex === paramIndex) {
                                            break;
                                        }
                                        paramIndex++;
                                    }
                                } else {
                                    break;
                                }
                                prevArgRangeInfo = argRangeInfo;
                                argIndex++;
                            }
                            if (prevArgRangeInfo && position.isAfter(prevArgRangeInfo.range.end)) {
                                let afterRange = new vscode.Range(prevArgRangeInfo.range.end, position);
                                let afterText = document.getText(afterRange).trim();
                                if (afterText) {
                                    if (afterText === ',') {
                                        if (!paramIsList) {
                                            paramIndex++;
                                        }
                                    } else {
                                        return undefined;
                                    }
                                }
                            }
                        }
                        return {
                            signatures: [signature],
                            activeSignature: 0,
                            activeParameter: paramIndex
                        };
                    }
                }
            }
        }
        return undefined;
    }
}

class HLMCompletionItemProvider implements vscode.CompletionItemProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        let parsedDocument = this.parsedDocuments.get(document.uri);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    if (context.triggerCharacter === '(' || context.triggerCharacter === '{' || context.triggerCharacter === ',') {
                        let signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, document);
                        if (signatureInfo && signatureInfo.parameters) {
                            let filledParameters = new Set<Fmt.Parameter>();
                            if (signatureInfo.arguments && signatureInfo.arguments.length) {
                                let argIndex = 0;
                                let paramIsList = false;
                                for (let arg of signatureInfo.arguments) {
                                    let paramIndex = 0;
                                    for (let param of signatureInfo.parameters) {
                                        paramIsList = param.list;
                                        if (arg.name ? arg.name === param.name : paramIsList ? argIndex >= paramIndex : argIndex === paramIndex) {
                                            filledParameters.add(param);
                                            break;
                                        }
                                        paramIndex++;
                                    }
                                    argIndex++;
                                }
                            }
                            let result: vscode.CompletionItem[] = [];
                            for (let param of signatureInfo.parameters) {
                                if (!filledParameters.has(param)) {
                                    let paramRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
                                    if (paramRangeInfo && paramRangeInfo.nameRange) {
                                        let paramName = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.nameRange, false, document);
                                        let code = paramName + ' = ';
                                        if (context.triggerCharacter === ',') {
                                            code = ' ' + code;
                                        }
                                        result.push({
                                            label: code,
                                            kind: vscode.CompletionItemKind.Field
                                        });
                                    }
                                }
                            }
                            return result;
                        }
                    }
                }
            }
        }
        return undefined;
    }
}

class HLMDocumentFormatter implements vscode.DocumentFormattingEditProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        let unformatted = document.getText();
        let parsedDocument = this.parsedDocuments.get(document.uri);
        try {
            let file: Fmt.File;
            if (parsedDocument && parsedDocument.file) {
                file = parsedDocument.file;
            } else {
                file = FmtReader.readString(unformatted, document.fileName, (path: Fmt.Path) => getMetaModelWithFallback(document.fileName, path));
                if (token.isCancellationRequested) {
                    return undefined;
                }
            }
            let formatted = FmtWriter.writeString(file);
            if (formatted !== unformatted) {
                let range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(unformatted.length)
                );
                return [new vscode.TextEdit(range, formatted)];
            }
        } catch (error) {
        }
        return undefined;
    }
}

function checkValue(metaModel: FmtDynamic.DynamicMetaModel, param: Fmt.Parameter, value: Fmt.Expression): void {
    if (param.type.expression instanceof FmtDynamic.DynamicMetaRefExpression) {
        let metaContents = param.type.expression.metaDefinition.contents;
        if (metaContents instanceof FmtMeta.ObjectContents_ParameterType && metaContents.argumentType) {
            let argumentType = new Fmt.Type;
            argumentType.expression = metaContents.argumentType;
            argumentType.arrayDimensions = param.type.arrayDimensions;
            metaModel.checkValue(argumentType, value);
        }
    }
}

function checkArguments(metaModel: FmtDynamic.DynamicMetaModel, parameterList: Fmt.ParameterList, argumentList: Fmt.ArgumentList): void {
    let paramIndex = 0;
    for (let param of parameterList) {
        let paramName = param.list ? undefined : param.name;
        let value: Fmt.Expression | undefined;
        if (param.optional || param.defaultValue) {
            value = argumentList.getOptionalValue(paramName, paramIndex);
        } else {
            value = argumentList.getValue(paramName, paramIndex);
        }
        if (value) {
            checkValue(metaModel, param, value);
        }
        paramIndex++;
        if (param.list) {
            while (value) {
                value = argumentList.getOptionalValue(paramName, paramIndex);
                if (value) {
                    checkValue(metaModel, param, value);
                }
                paramIndex++;
            }
        }
    }
    let foundParams = new Set<Fmt.Parameter>();
    let argIndex = 0;
    for (let arg of argumentList) {
        let param = parameterList.getParameter(arg.name, argIndex);
        if (foundParams.has(param) && !param.list) {
            throw new Error(`Duplicate argument for "${param.name}"`);
        } else {
            foundParams.add(param);
        }
        argIndex++;
    }
}

function checkReferencedDefinitions(parsedDocument: ParsedDocument, diagnostics: vscode.Diagnostic[], sourceDocument?: vscode.TextDocument): void {
    if (parsedDocument.metaModel) {
        for (let rangeInfo of parsedDocument.rangeList) {
            if (rangeInfo.object instanceof Fmt.Path) {
                let referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, sourceDocument);
                if (referencedDefinition && referencedDefinition.arguments && referencedDefinition.arguments.length) {
                    try {
                        checkArguments(parsedDocument.metaModel, referencedDefinition.definition.parameters, referencedDefinition.arguments);
                    } catch (error) {
                        diagnostics.push({
                            message: error.message,
                            range: rangeInfo.range,
                            severity: vscode.DiagnosticSeverity.Error
                        });
                    }
                }
            }
        }
    }
}

function parseFile(uri: vscode.Uri, fileContents: string, diagnostics?: vscode.Diagnostic[], sourceDocument?: vscode.TextDocument): ParsedDocument {
    let stream = new FmtReader.StringInputStream(fileContents);
    let reportError = diagnostics ? (msg: string, range: FmtReader.Range) => {
        diagnostics.push({
            message: msg,
            range: convertRange(range),
            severity: vscode.DiagnosticSeverity.Error
        });
    } : () => {};
    let parsedDocument: ParsedDocument = {
        uri: uri,
        rangeList: [],
        rangeMap: new Map<Object, RangeInfo>()
    };
    let getDocumentMetaModel = (path: Fmt.Path) => {
        let metaModelFileName = getFileNameFromPath(uri.fsPath, path);
        let parsedMetaModelDocument: ParsedDocument = {
            uri: vscode.Uri.file(metaModelFileName),
            rangeList: [],
            rangeMap: new Map<Object, RangeInfo>()
        };
        let reportMetaModelRange = (object: Object, range: FmtReader.Range, nameRange?: FmtReader.Range, signatureRange?: FmtReader.Range) => {
            let rangeInfo = convertRangeInfo(object, range, nameRange, signatureRange);
            parsedMetaModelDocument.rangeList.push(rangeInfo);
            parsedMetaModelDocument.rangeMap.set(object, rangeInfo);
        };
        parsedMetaModelDocument.file = readMetaModel(metaModelFileName, reportMetaModelRange);
        parsedDocument.metaModelDocument = parsedMetaModelDocument;
        parsedDocument.metaModel = createDynamicMetaModel(parsedMetaModelDocument.file, metaModelFileName);
        return parsedDocument.metaModel;
    };
    let reportRange = (object: Object, range: FmtReader.Range, nameRange?: FmtReader.Range, signatureRange?: FmtReader.Range) => {
        let rangeInfo = convertRangeInfo(object, range, nameRange, signatureRange);
        parsedDocument.rangeList.push(rangeInfo);
        parsedDocument.rangeMap.set(object, rangeInfo);
    };
    let reader = new FmtReader.Reader(stream, reportError, getDocumentMetaModel, reportRange);
    try {
        parsedDocument.file = reader.readFile();
    } catch (error) {
        if (diagnostics && !diagnostics.length) {
            let dummyPosition = new vscode.Position(0, 0);
            diagnostics.push({
                message: error.message,
                range: new vscode.Range(dummyPosition, dummyPosition),
                severity: vscode.DiagnosticSeverity.Error
            });
        }
    }
    if (diagnostics) {
        checkReferencedDefinitions(parsedDocument, diagnostics, sourceDocument);
    }
    return parsedDocument;
}

function parseDocument(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection, parsedDocuments: ParsedDocumentMap): void {
    if (document.languageId === languageId) {
        let diagnostics: vscode.Diagnostic[] = [];
        let parsedDocument = parseFile(document.uri, document.getText(), diagnostics, document);
        diagnosticCollection.set(document.uri, diagnostics);
        parsedDocuments.set(document.uri, parsedDocument);
    }
}

export function activate(context: vscode.ExtensionContext): void {
    let diagnosticCollection = vscode.languages.createDiagnosticCollection(languageId);
    let parsedDocuments: ParsedDocumentMap = new Map<vscode.Uri, ParsedDocument>();
    for (let document of vscode.workspace.textDocuments) {
        parseDocument(document, diagnosticCollection, parsedDocuments);
    }
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => parseDocument(document, diagnosticCollection, parsedDocuments)));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => parseDocument(event.document, diagnosticCollection, parsedDocuments)));
    let definitionProvider = new HLMDefinitionProvider(parsedDocuments);
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(HLM_MODE, definitionProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(HLM_MODE, definitionProvider));
    context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(HLM_MODE, new HLMHighlightProvider(parsedDocuments)));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(HLM_MODE, new HLMSignatureHelpProvider(parsedDocuments), '(', '{', ','));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(HLM_MODE, new HLMCompletionItemProvider(parsedDocuments), '%', '$', '/', '(', '{', ','));
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(HLM_MODE, new HLMDocumentFormatter(parsedDocuments)));
}

export function deactivate(): void {
}
