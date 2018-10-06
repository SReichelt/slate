'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as Fmt from '../../shared/format/format';
import { escapeIdentifier } from '../../shared/format/common';
import * as FmtDynamic from '../../shared/format/dynamic';
import * as FmtMeta from '../../shared/format/meta';
import * as FmtReader from '../../shared/format/read';
import * as FmtWriter from '../../shared/format/write';
import { fileExtension, getFileNameFromPathStr, getFileNameFromPath, readMetaModel, getMetaModelWithFallback } from '../../shared/data/dynamic';

const languageId = 'hlm';
const HLM_MODE: vscode.DocumentFilter = { language: languageId, scheme: 'file' };

interface RangeInfo {
    object: Object;
    context?: Fmt.Context;
    metaDefinitions?: Fmt.MetaDefinitionFactory;
    range: vscode.Range;
    nameRange?: vscode.Range;
    linkRange?: vscode.Range;
    signatureRange?: vscode.Range;
}

interface ParsedDocument {
    uri: vscode.Uri;
    file?: Fmt.File;
    rangeList: RangeInfo[];
    rangeMap: Map<Object, RangeInfo>;
    metaModelDocument?: ParsedDocument;
    metaModelDocuments?: Map<FmtDynamic.DynamicMetaModel, ParsedDocument>;
}

type ParsedDocumentMap = Map<vscode.TextDocument, ParsedDocument>;

interface ParsedMetaModel {
    metaModel: FmtDynamic.DynamicMetaModel;
    metaModelDocument: ParsedDocument;
    metaModelDocuments: Map<FmtDynamic.DynamicMetaModel, ParsedDocument>;
}

function convertLocation(location: FmtReader.Location): vscode.Position {
    return new vscode.Position(location.line, location.col);
}

function convertRange(range: FmtReader.Range): vscode.Range {
    let start = convertLocation(range.start);
    let end = convertLocation(range.end);
    return new vscode.Range(start, end);
}

function convertRangeInfo(info: FmtReader.ObjectRangeInfo): RangeInfo {
    return {
        object: info.object,
        context: info.context,
        metaDefinitions: info.metaDefinitions,
        range: convertRange(info.range),
        nameRange: info.nameRange ? convertRange(info.nameRange) : undefined,
        linkRange: info.linkRange ? convertRange(info.linkRange) : undefined,
        signatureRange: info.signatureRange ? convertRange(info.signatureRange) : undefined
    };
}

function areUrisEqual(uri1: vscode.Uri, uri2: vscode.Uri): boolean {
    return uri1.toString() === uri2.toString();
}

function matchesQuery(name: string, query: string): boolean {
    let pos = 0;
    for (let c of query) {
        pos = name.indexOf(c, pos);
        if (pos < 0) {
            return false;
        }
    }
    return true;
}

let lastReadFileName: string | undefined = undefined;
let lastReadFileContents: string | undefined = undefined;

function readRangeRaw(uri: vscode.Uri, range?: vscode.Range, sourceDocument?: vscode.TextDocument): string | undefined {
    if (sourceDocument && areUrisEqual(uri, sourceDocument.uri)) {
        return sourceDocument.getText(range);
    }
    for (let document of vscode.workspace.textDocuments) {
        if (areUrisEqual(uri, document.uri)) {
            return document.getText(range);
        }
    }
    try {
        let fileName = uri.fsPath;
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

function findReferencedDefinition(parsedDocument: ParsedDocument, object: Object, context?: Fmt.Context, sourceDocument?: vscode.TextDocument, restrictToUri?: vscode.Uri): ReferencedDefinition | null | undefined {
    if (object instanceof FmtDynamic.DynamicMetaRefExpression && parsedDocument.metaModelDocuments) {
        let metaModelDocument = parsedDocument.metaModelDocuments.get(object.metaModel);
        if (metaModelDocument && (!restrictToUri || areUrisEqual(restrictToUri, metaModelDocument.uri))) {
            return {
                parsedDocument: metaModelDocument,
                definition: object.metaDefinition,
                arguments: object.originalArguments
            };
        }
    } else if (object instanceof Fmt.Path) {
        if (parsedDocument.metaModelDocument && parsedDocument.metaModelDocument.file && parsedDocument.metaModelDocument.file.definitions.length && (!restrictToUri || areUrisEqual(restrictToUri, parsedDocument.metaModelDocument.uri))) {
            let metaModelDefinition = parsedDocument.metaModelDocument.file.definitions[0];
            if (parsedDocument.file && object === parsedDocument.file.metaModelPath) {
                return {
                    parsedDocument: parsedDocument.metaModelDocument,
                    definition: metaModelDefinition
                };
            }
        }
        if (context && context.metaModel instanceof FmtDynamic.DynamicMetaModel && context.metaModel.definitions.length) {
            let metaModelDefinition = context.metaModel.definitions[0];
            if (metaModelDefinition.contents instanceof FmtMeta.ObjectContents_MetaModel) {
                let lookup = metaModelDefinition.contents.lookup;
                let fileName: string;
                if (lookup instanceof FmtMeta.MetaRefExpression_self) {
                    fileName = getFileNameFromPath(parsedDocument.uri.fsPath, object, true);
                    if (!fileName) {
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
                        return undefined;
                    }
                } else if (lookup instanceof FmtMeta.MetaRefExpression_Any) {
                    fileName = getFileNameFromPath(parsedDocument.uri.fsPath, object);
                    if (!fileName || !fs.existsSync(fileName)) {
                        let dirName = getFileNameFromPath(parsedDocument.uri.fsPath, object, true, false);
                        if (fs.existsSync(dirName)) {
                            let dirStat = fs.statSync(dirName);
                            if (dirStat.isDirectory()) {
                                return null;
                            }
                        }
                        return undefined;
                    }
                } else if (lookup instanceof Fmt.StringExpression) {
                    fileName = getFileNameFromPathStr(context.metaModel.fileName, lookup.value);
                } else {
                    return null;
                }
                let uri = vscode.Uri.file(fileName);
                if (!restrictToUri || areUrisEqual(restrictToUri, uri)) {
                    let referencedDocument = parseFile(uri, undefined, undefined, sourceDocument);
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
    return undefined;
}

function findObjectContents(parsedDocument: ParsedDocument, object: Object, sourceDocument?: vscode.TextDocument): FmtDynamic.DynamicObjectContents | undefined {
    if (object instanceof Fmt.Definition && object.contents instanceof FmtDynamic.DynamicObjectContents) {
        return object.contents;
    } else if (object instanceof Fmt.CompoundExpression && parsedDocument.metaModelDocuments) {
        for (let metaModel of parsedDocument.metaModelDocuments.keys()) {
            let objectContents = metaModel.objectContentsMap.get(object.arguments);
            if (objectContents) {
                return objectContents;
            }
        }
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

function getSignatureInfo(parsedDocument: ParsedDocument, rangeInfo: RangeInfo, position: vscode.Position | undefined, readSignatureCode: boolean, sourceDocument?: vscode.TextDocument, restrictToUri?: vscode.Uri): SignatureInfo | undefined {
    let referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, rangeInfo.context, sourceDocument, restrictToUri);
    if (referencedDefinition) {
        if (position && rangeInfo.linkRange && rangeInfo.linkRange.contains(position)) {
            return {
                referencedDefinition: referencedDefinition,
                parsedDocument: referencedDefinition.parsedDocument
            };
        }
        let definitionRangeInfo = referencedDefinition.parsedDocument.rangeMap.get(referencedDefinition.definition);
        if (definitionRangeInfo && definitionRangeInfo.signatureRange) {
            let signatureCode = readSignatureCode ? readRange(referencedDefinition.parsedDocument.uri, definitionRangeInfo.signatureRange, true, sourceDocument) : undefined;
            return {
                signatureCode: signatureCode,
                referencedDefinition: referencedDefinition,
                parsedDocument: referencedDefinition.parsedDocument,
                parameters: referencedDefinition.definition.parameters,
                arguments: referencedDefinition.arguments
            };
        }
    }
    if (parsedDocument.metaModelDocuments) {
        let objectContents = findObjectContents(parsedDocument, rangeInfo.object, sourceDocument);
        if (objectContents) {
            let metaModelDocument = parsedDocument.metaModelDocuments.get(objectContents.metaModel);
            if (metaModelDocument && (!restrictToUri || areUrisEqual(restrictToUri, metaModelDocument.uri))) {
                if (rangeInfo.object instanceof Fmt.Definition) {
                    if (position && rangeInfo.signatureRange && rangeInfo.signatureRange.contains(position)) {
                        return undefined;
                    }
                    let innerDefinitionRangeInfo = parsedDocument.rangeMap.get(rangeInfo.object.innerDefinitions);
                    if (position && innerDefinitionRangeInfo && innerDefinitionRangeInfo.range.contains(position)) {
                        return undefined;
                    }
                }
                let signatureCode = readSignatureCode ? '' : undefined;
                let allMembers: Fmt.Parameter[] = [];
                let metaContents = objectContents.metaDefinition.contents;
                while (metaContents instanceof FmtMeta.ObjectContents_DefinedType) {
                    if (metaContents.members) {
                        allMembers.unshift(...metaContents.members);
                        if (readSignatureCode) {
                            let definitionRangeInfo = metaModelDocument.rangeMap.get(metaContents.members);
                            if (definitionRangeInfo) {
                                if (signatureCode) {
                                    signatureCode = ', ' + signatureCode;
                                }
                                signatureCode = '#' + readRange(metaModelDocument.uri, definitionRangeInfo.range, true, sourceDocument) + signatureCode;
                            }
                        }
                    }
                    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
                        try {
                            let superTypeDefinition = objectContents.metaModel.definitions.getDefinition(metaContents.superType.path.name);
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
                    parameters: allMembers,
                    arguments: objectContents.originalArguments
                };
            }
        }
    }
    return undefined;
}

interface DefinitionLink extends vscode.DefinitionLink {
    originNameRange: vscode.Range;
    name: string;
}

function getDefinitionLinks(parsedDocument: ParsedDocument, rangeInfo: RangeInfo, position: vscode.Position | undefined, preferSignature: boolean, sourceDocument?: vscode.TextDocument, restrictToUri?: vscode.Uri): DefinitionLink[] {
    let result: DefinitionLink[] = [];
    let signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, false, sourceDocument, restrictToUri);
    if (signatureInfo) {
        if (signatureInfo.referencedDefinition && rangeInfo.nameRange && rangeInfo.linkRange && (!position || rangeInfo.linkRange.contains(position))) {
            let targetRangeInfo = signatureInfo.parsedDocument.rangeMap.get(signatureInfo.referencedDefinition.definition);
            if (targetRangeInfo) {
                result.push({
                    originNameRange: rangeInfo.nameRange,
                    originSelectionRange: rangeInfo.linkRange,
                    targetUri: signatureInfo.parsedDocument.uri,
                    targetRange: (preferSignature && targetRangeInfo.signatureRange) || targetRangeInfo.range,
                    targetSelectionRange: targetRangeInfo.nameRange,
                    name: signatureInfo.referencedDefinition.definition.name
                });
                if (position) {
                    return result;
                }
            }
        }
        if (signatureInfo.parameters && signatureInfo.arguments) {
            for (let arg of signatureInfo.arguments) {
                if (arg.name) {
                    let argRangeInfo = parsedDocument.rangeMap.get(arg);
                    if (argRangeInfo && argRangeInfo.nameRange && (!position || argRangeInfo.nameRange.contains(position))) {
                        for (let param of signatureInfo.parameters) {
                            if (arg.name === param.name) {
                                let targetRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
                                if (targetRangeInfo) {
                                    result.push({
                                        originNameRange: argRangeInfo.nameRange,
                                        originSelectionRange: argRangeInfo.nameRange,
                                        targetUri: signatureInfo.parsedDocument.uri,
                                        targetRange: targetRangeInfo.range,
                                        targetSelectionRange: targetRangeInfo.nameRange,
                                        name: arg.name
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
    if (rangeInfo.object instanceof Fmt.VariableRefExpression && rangeInfo.nameRange && (!position || rangeInfo.nameRange.contains(position)) && (!restrictToUri || areUrisEqual(restrictToUri, parsedDocument.uri))) {
        let targetRangeInfo = parsedDocument.rangeMap.get(rangeInfo.object.variable);
        if (targetRangeInfo) {
            result.push({
                originNameRange: rangeInfo.nameRange,
                originSelectionRange: rangeInfo.nameRange,
                targetUri: parsedDocument.uri,
                targetRange: targetRangeInfo.range,
                targetSelectionRange: targetRangeInfo.nameRange,
                name: rangeInfo.object.variable.name
            });
            if (position) {
                return result;
            }
        }
    }
    return result;
}

class HLMDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            let result: vscode.DocumentSymbol[] = [];
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                let symbol: vscode.DocumentSymbol | undefined = undefined;
                if (rangeInfo.object instanceof Fmt.Definition) {
                    let signature = rangeInfo.signatureRange ? readRange(document.uri, rangeInfo.signatureRange, true, document) : undefined;
                    symbol = new vscode.DocumentSymbol(rangeInfo.object.name, signature || '', vscode.SymbolKind.Object, rangeInfo.range, rangeInfo.signatureRange || rangeInfo.range);
                } else if (rangeInfo.object instanceof Fmt.Parameter && !rangeInfo.object.name.startsWith('_')) {
                    let signature = readRange(document.uri, rangeInfo.range, true, document);
                    symbol = new vscode.DocumentSymbol(rangeInfo.object.name, signature || '', vscode.SymbolKind.Variable, rangeInfo.range, rangeInfo.range);
                }
                if (symbol) {
                    let i = 0;
                    while (i < result.length) {
                        let prevSymbol = result[i];
                        if (rangeInfo.range.contains(prevSymbol.range)) {
                            result.splice(i, 1);
                            symbol.children.push(prevSymbol);
                        } else {
                            i++;
                        }
                    }
                    result.push(symbol);
                }
            }
            return result;
        }
        return undefined;
    }
}

class HLMWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[]> {
        if (!query) {
            return undefined;
        }
        query = query.toLowerCase();
        return vscode.workspace.findFiles('**/*' + fileExtension, undefined, undefined, token).then((uris: vscode.Uri[]) => {
            let result: vscode.SymbolInformation[] = [];
            for (let uri of uris) {
                if (token.isCancellationRequested) {
                    break;
                }
                try {
                    let contents = readRange(uri);
                    if (contents) {
                        let file = FmtReader.readString(contents, uri.fsPath, () => new Fmt.DummyMetaModel);
                        let location = new vscode.Location(uri, undefined!);
                        for (let definition of file.definitions) {
                            if (matchesQuery(definition.name.toLowerCase(), query)) {
                                result.push(new vscode.SymbolInformation(definition.name, vscode.SymbolKind.Object, '', location));
                            }
                            for (let innerDefinition of definition.innerDefinitions) {
                                if (matchesQuery(innerDefinition.name.toLowerCase(), query)) {
                                    result.push(new vscode.SymbolInformation(innerDefinition.name, vscode.SymbolKind.Object, definition.name, location));
                                }
                            }
                        }
                    }
                } catch (error) {
                }
            }
            return result;
        });
    }

    resolveWorkspaceSymbol(symbol: vscode.SymbolInformation, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation> {
        let parsedDocument = parseFile(symbol.location.uri);
        if (parsedDocument.file) {
            let definition: Fmt.Definition | undefined = undefined;
            try {
                if (symbol.containerName) {
                    let parentDefinition = parsedDocument.file.definitions.getDefinition(symbol.containerName);
                    definition = parentDefinition.innerDefinitions.getDefinition(symbol.name);
                } else {
                    definition = parsedDocument.file.definitions.getDefinition(symbol.name);
                }
            } catch (error) {
            }
            if (definition) {
                let rangeInfo = parsedDocument.rangeMap.get(definition);
                if (rangeInfo) {
                    return new vscode.SymbolInformation(symbol.name, symbol.kind, symbol.containerName, new vscode.Location(symbol.location.uri, rangeInfo.range));
                }
            }
        }
        return undefined;
    }
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
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    let definitionLinks = getDefinitionLinks(parsedDocument, rangeInfo, position, preferSignature, document);
                    if (definitionLinks.length) {
                        return definitionLinks[0];
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
        let parsedDocument = this.parsedDocuments.get(document);
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
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    let signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, true, document);
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
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            let result: vscode.CompletionItem[] = [];
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
                            if (signatureInfo) {
                                if (signatureInfo.parameters) {
                                    let filledParameters = new Set<Fmt.Parameter>();
                                    if (signatureInfo.arguments) {
                                        let argIndex = 0;
                                        for (let arg of signatureInfo.arguments) {
                                            let argRangeInfo = parsedDocument.rangeMap.get(arg);
                                            if (argRangeInfo && !argRangeInfo.range.isEmpty) {
                                                if (argRangeInfo.range.contains(position)) {
                                                    signatureInfo = undefined;
                                                    break;
                                                }
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
                                                        let paramDefinition = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.range, true, document);
                                                        let documentation: vscode.MarkdownString | undefined = undefined;
                                                        if (paramDefinition) {
                                                            documentation = new vscode.MarkdownString;
                                                            documentation.appendCodeblock(paramDefinition);
                                                        }
                                                        result.push({
                                                            label: paramCode + ' = ',
                                                            documentation: documentation,
                                                            kind: vscode.CompletionItemKind.Field
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                        if (rangeInfo.object instanceof Fmt.MetaRefExpression) {
                                            isEmptyExpression = true;
                                        }
                                    }
                                }
                            }
                        }
                        if (((isEmptyExpression && (!rangeInfo.metaDefinitions || rangeInfo.metaDefinitions.allowArbitraryReferences())) || rangeInfo.object instanceof Fmt.VariableRefExpression) && rangeInfo.context) {
                            for (let param of rangeInfo.context.getVariables()) {
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
                                        result.push({
                                            label: paramCode,
                                            range: rangeInfo.object instanceof Fmt.VariableRefExpression ? rangeInfo.nameRange || rangeInfo.range : undefined,
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
                                                            if (fileDocument.file && fileDocument.file.definitions.length) {
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
                    if (rangeInfo.object instanceof Fmt.Expression || signatureInfo) {
                        break;
                    }
                }
            }
            return result;
        }
        return undefined;
    }
}

class HLMReferenceProvider implements vscode.ReferenceProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> {
        let result: vscode.Location[] = [];
        let targetLocation = new vscode.Location(document.uri, position);
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    let definitionLinks = getDefinitionLinks(parsedDocument, rangeInfo, position, false, document);
                    if (definitionLinks.length) {
                        let definitionLink = definitionLinks[0];
                        if (definitionLink.targetSelectionRange) {
                            targetLocation = new vscode.Location(definitionLink.targetUri, definitionLink.targetSelectionRange);
                            if (context.includeDeclaration) {
                                result.push(targetLocation);
                            }
                            break;
                        }
                    }
                }
            }
        }
        return vscode.workspace.findFiles('**/*' + fileExtension, undefined, undefined, token).then((uris: vscode.Uri[]) => {
            metaModelCache = new Map<string, ParsedMetaModel>();
            try {
                for (let uri of uris) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    let parsedDocument = parseFile(uri, undefined, undefined, document);
                    for (let rangeInfo of parsedDocument.rangeList) {
                        if (token.isCancellationRequested) {
                            break;
                        }
                        for (let definitionLink of getDefinitionLinks(parsedDocument, rangeInfo, undefined, false, document, targetLocation.uri)) {
                            if (areUrisEqual(definitionLink.targetUri, targetLocation.uri) && definitionLink.targetSelectionRange && definitionLink.targetSelectionRange.intersection(targetLocation.range)) {
                                result.push(new vscode.Location(uri, definitionLink.originSelectionRange || rangeInfo.linkRange || rangeInfo.nameRange || rangeInfo.range));
                            }
                        }
                    }
                }
            } finally {
                metaModelCache = undefined;
            }
            return result;
        });
    }
}

class HLMRenameProvider implements vscode.RenameProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.WorkspaceEdit> {
        let nameDefinitionLocation = this.getNameDefinitionLocation(document, position, token);
        if (nameDefinitionLocation) {
            return vscode.workspace.findFiles('**/*' + fileExtension, undefined, undefined, token).then((uris: vscode.Uri[]) => {
                let result = new vscode.WorkspaceEdit;
                if (nameDefinitionLocation) {
                    let escapedName = escapeIdentifier(newName);
                    result.replace(nameDefinitionLocation.targetUri, nameDefinitionLocation.targetSelectionRange!, escapedName);
                    metaModelCache = new Map<string, ParsedMetaModel>();
                    try {
                        for (let uri of uris) {
                            if (token.isCancellationRequested) {
                                break;
                            }
                            let parsedDocument = parseFile(uri, undefined, undefined, document);
                            for (let rangeInfo of parsedDocument.rangeList) {
                                if (token.isCancellationRequested) {
                                    break;
                                }
                                for (let definitionLink of getDefinitionLinks(parsedDocument, rangeInfo, undefined, false, document, nameDefinitionLocation.targetUri)) {
                                    if (areUrisEqual(definitionLink.targetUri, nameDefinitionLocation.targetUri) && definitionLink.targetSelectionRange && definitionLink.targetSelectionRange.isEqual(nameDefinitionLocation.targetSelectionRange!)) {
                                        result.replace(uri, definitionLink.originNameRange, escapedName);
                                    }
                                }
                            }
                        }
                    } finally {
                        metaModelCache = undefined;
                    }
                    let fsPath = nameDefinitionLocation.targetUri.fsPath;
                    if (path.basename(fsPath) === nameDefinitionLocation.name + fileExtension) {
                        fsPath = path.join(path.dirname(fsPath), newName + fileExtension);
                        result.renameFile(nameDefinitionLocation.targetUri, vscode.Uri.file(fsPath));
                    }
                }
                return result;
            });
        }
        return undefined;
    }

    prepareRename(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Range | { range: vscode.Range, placeholder: string }> {
        let nameDefinitionLocation = this.getNameDefinitionLocation(document, position, token);
        if (nameDefinitionLocation) {
            return {
                range: nameDefinitionLocation.originNameRange,
                placeholder: nameDefinitionLocation.name
            };
        }
        return undefined;
    }

    private getNameDefinitionLocation(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): DefinitionLink | undefined {
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    if ((rangeInfo.object instanceof Fmt.Definition || rangeInfo.object instanceof Fmt.Parameter) && rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
                        return {
                            originNameRange: rangeInfo.nameRange,
                            originSelectionRange: rangeInfo.nameRange,
                            targetUri: document.uri,
                            targetRange: rangeInfo.range,
                            targetSelectionRange: rangeInfo.nameRange,
                            name: rangeInfo.object.name
                        };
                    }
                    let definitionLinks = getDefinitionLinks(parsedDocument, rangeInfo, position, false, document);
                    if (definitionLinks.length) {
                        return definitionLinks[0];
                    }
                }
            }
        }
        return undefined;
    }
}

class HLMDocumentFormatter implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        let unformatted = document.getText();
        try {
            let file: Fmt.File = FmtReader.readString(unformatted, document.fileName, (path: Fmt.Path) => getMetaModelWithFallback(document.fileName, path));
            if (token.isCancellationRequested) {
                return undefined;
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
        if (param.optional || param.defaultValue || (param.type.expression instanceof FmtDynamic.DynamicMetaRefExpression && param.type.expression.metaDefinition.contents instanceof FmtMeta.ObjectContents_ParameterType && param.type.expression.metaDefinition.contents.optional instanceof FmtMeta.MetaRefExpression_true)) {
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
    for (let rangeInfo of parsedDocument.rangeList) {
        if (rangeInfo.object instanceof Fmt.Path && rangeInfo.context && rangeInfo.context.metaModel instanceof FmtDynamic.DynamicMetaModel) {
            try {
                let referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, rangeInfo.context, sourceDocument);
                if (referencedDefinition === undefined) {
                    throw new Error(`Definition "${rangeInfo.object.name}" not found`);
                }
                if (referencedDefinition && referencedDefinition.arguments && referencedDefinition.arguments.length) {
                    checkArguments(rangeInfo.context.metaModel, referencedDefinition.definition.parameters, referencedDefinition.arguments);
                }
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

let parsedFileCache = new Map<string, ParsedDocument>();
let metaModelCache: Map<string, ParsedMetaModel> | undefined = undefined;

function parseFile(uri: vscode.Uri, fileContents?: string, diagnostics?: vscode.Diagnostic[], sourceDocument?: vscode.TextDocument): ParsedDocument {
    let cachedDocument = parsedFileCache.get(uri.fsPath);
    if (cachedDocument) {
        return cachedDocument;
    }
    if (!fileContents) {
        fileContents = readRange(uri, undefined, false, sourceDocument) || '';
    }
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
        rangeMap: new Map<Object, RangeInfo>(),
        metaModelDocuments: new Map<FmtDynamic.DynamicMetaModel, ParsedDocument>()
    };
    let getReferencedMetaModel = (sourceFileName: string, path: Fmt.Path): Fmt.MetaModel => {
        let metaModelFileName = getFileNameFromPath(sourceFileName, path);
        if (metaModelCache) {
            let parsedMetaModel = metaModelCache.get(metaModelFileName);
            if (parsedMetaModel) {
                if (!parsedDocument.metaModelDocument) {
                    parsedDocument.metaModelDocument = parsedMetaModel.metaModelDocument;
                }
                for (let [metaModel, metaModelDocument] of parsedMetaModel.metaModelDocuments) {
                    parsedDocument.metaModelDocuments!.set(metaModel, metaModelDocument);
                }
                return parsedMetaModel.metaModel;
            }
        }
        let parsedMetaModelDocument: ParsedDocument = {
            uri: vscode.Uri.file(metaModelFileName),
            rangeList: [],
            rangeMap: new Map<Object, RangeInfo>()
        };
        let metaModelFileContents = readRange(parsedMetaModelDocument.uri)!;
        let reportMetaModelRange = (info: FmtReader.ObjectRangeInfo) => {
            let rangeInfo = convertRangeInfo(info);
            parsedMetaModelDocument.rangeList.push(rangeInfo);
            parsedMetaModelDocument.rangeMap.set(info.object, rangeInfo);
        };
        parsedMetaModelDocument.file = FmtReader.readString(metaModelFileContents, metaModelFileName, FmtMeta.getMetaModel, reportMetaModelRange);
        if (!parsedDocument.metaModelDocument) {
            parsedDocument.metaModelDocument = parsedMetaModelDocument;
        }
        let metaModel = new FmtDynamic.DynamicMetaModel(parsedMetaModelDocument.file, metaModelFileName, (otherPath: Fmt.Path) => getReferencedMetaModel(metaModelFileName, otherPath));
        parsedDocument.metaModelDocuments!.set(metaModel, parsedMetaModelDocument);
        if (metaModelCache) {
            metaModelCache.set(metaModelFileName, {
                metaModel: metaModel,
                metaModelDocument: parsedMetaModelDocument,
                metaModelDocuments: parsedDocument.metaModelDocuments!
            });
        }
        return metaModel;
    };
    let getDocumentMetaModel = (path: Fmt.Path) => getReferencedMetaModel(uri.fsPath, path);
    let reportRange = (info: FmtReader.ObjectRangeInfo) => {
        let rangeInfo = convertRangeInfo(info);
        parsedDocument.rangeList.push(rangeInfo);
        parsedDocument.rangeMap.set(info.object, rangeInfo);
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
    parsedFileCache.set(uri.fsPath, parsedDocument);
    return parsedDocument;
}

function parseDocument(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection, parsedDocuments: ParsedDocumentMap): void {
    if (document.languageId === languageId) {
        let diagnostics: vscode.Diagnostic[] = [];
        let parsedDocument = parseFile(document.uri, document.getText(), diagnostics, document);
        diagnosticCollection.set(document.uri, diagnostics);
        parsedDocuments.set(document, parsedDocument);
    }
}

let parseAllTimer: NodeJS.Timer | undefined = undefined;

export function activate(context: vscode.ExtensionContext): void {
    let diagnosticCollection = vscode.languages.createDiagnosticCollection(languageId);
    let parsedDocuments: ParsedDocumentMap = new Map<vscode.TextDocument, ParsedDocument>();
    for (let document of vscode.workspace.textDocuments) {
        parseDocument(document, diagnosticCollection, parsedDocuments);
    }
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => parseDocument(document, diagnosticCollection, parsedDocuments)),
        vscode.workspace.onDidChangeTextDocument((event) => {
            parsedFileCache.delete(event.document.uri.fsPath);
            parseDocument(event.document, diagnosticCollection, parsedDocuments);
            if (parseAllTimer) {
                clearTimeout(parseAllTimer);
                parseAllTimer = undefined;
            }
            parseAllTimer = setTimeout(() => {
                // TODO only reparse affected documents (maintain a list of documents to reparse)
                parsedFileCache.clear();
                metaModelCache = new Map<string, ParsedMetaModel>();
                try {
                    for (let document of vscode.workspace.textDocuments) {
                        if (document !== event.document) {
                            parseDocument(document, diagnosticCollection, parsedDocuments);
                        }
                    }
                } finally {
                    metaModelCache = undefined;
                }
            }, 500);
        })
    );
    let definitionProvider = new HLMDefinitionProvider(parsedDocuments);
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(HLM_MODE, new HLMDocumentSymbolProvider(parsedDocuments)),
        vscode.languages.registerWorkspaceSymbolProvider(new HLMWorkspaceSymbolProvider),
        vscode.languages.registerDefinitionProvider(HLM_MODE, definitionProvider),
        vscode.languages.registerHoverProvider(HLM_MODE, definitionProvider),
        vscode.languages.registerDocumentHighlightProvider(HLM_MODE, new HLMHighlightProvider(parsedDocuments)),
        vscode.languages.registerSignatureHelpProvider(HLM_MODE, new HLMSignatureHelpProvider(parsedDocuments), '(', '{', ','),
        vscode.languages.registerCompletionItemProvider(HLM_MODE, new HLMCompletionItemProvider(parsedDocuments), '%', '$', '/', '.'),
        vscode.languages.registerReferenceProvider(HLM_MODE, new HLMReferenceProvider(parsedDocuments)),
        vscode.languages.registerRenameProvider(HLM_MODE, new HLMRenameProvider(parsedDocuments)),
        vscode.languages.registerDocumentFormattingEditProvider(HLM_MODE, new HLMDocumentFormatter)
    );
    // TODO code lense provider
}

export function deactivate(): void {
    if (parseAllTimer) {
        clearTimeout(parseAllTimer);
        parseAllTimer = undefined;
    }
}
