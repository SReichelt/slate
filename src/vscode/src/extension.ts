'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Fmt from '../../shared/format/format';
import * as FmtDynamic from '../../shared/format/dynamic';
import * as FmtMeta from '../../shared/format/meta';
import * as FmtReader from '../../shared/format/read';
import * as FmtWriter from '../../shared/format/write';
import { getMetaModelFileName, readMetaModel, createDynamicMetaModel, getMetaModelWithFallback } from '../../shared/data/dynamic';

const languageId = 'hlm';
const HLM_MODE: vscode.DocumentFilter = { language: languageId, scheme: 'file' };

interface RangeInfo {
    object: Object;
    range: vscode.Range;
    nameRange?: vscode.Range;
    signatureRange?: vscode.Range;
}

interface ParsedDocument {
    rangeList: RangeInfo[];
    rangeMap: Map<Object, RangeInfo>;
    metaModelPath?: Fmt.Path;
    metaModelFileName?: string;
    metaModelFile?: Fmt.File;
    metaModel?: FmtDynamic.DynamicMetaModel;
    metaModelDefinitions: Map<Fmt.Definition, RangeInfo>;
    metaModelParameters: Map<Fmt.Parameter, RangeInfo>;
    metaModelParameterLists: Map<Fmt.ParameterList, RangeInfo>;
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

function readRangeRaw(uri: vscode.Uri, range: vscode.Range, sourceDocument?: vscode.TextDocument): string | undefined {
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
        }
    } catch (error) {
    }
    return undefined;
}

function readRange(uri: vscode.Uri, range: vscode.Range, sourceDocument?: vscode.TextDocument): string | undefined {
    let raw = readRangeRaw(uri, range, sourceDocument);
    if (raw !== undefined) {
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
        return null;
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        // TODO display simplified definition and comment
        let definitionLink = this.getDefinitionLink(document, position, token, true);
        if (definitionLink !== undefined && !token.isCancellationRequested) {
            let hoverCode: string | undefined = readRange(definitionLink.targetUri, definitionLink.targetRange, document);
            if (hoverCode) {
                let hoverText = new vscode.MarkdownString;
                hoverText.appendCodeblock(hoverCode);
                return new vscode.Hover(hoverText, definitionLink.originSelectionRange);
            }
        }
        return null;
    }

    private getDefinitionLink(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, preferSignature: boolean): vscode.DefinitionLink | undefined {
        let parsedDocument = this.parsedDocuments.get(document.uri);
        if (parsedDocument) {
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                // TODO definition ref expressions and their arguments
                if (rangeInfo.range.contains(position)) {
                    if (rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
                        if (rangeInfo.object === parsedDocument.metaModelPath && parsedDocument.metaModelFileName && parsedDocument.metaModelFile && parsedDocument.metaModelFile.definitions.length) {
                            let metaModelDefinition = parsedDocument.metaModelFile.definitions[0];
                            let targetRangeInfo = parsedDocument.metaModelDefinitions.get(metaModelDefinition);
                            if (targetRangeInfo) {
                                return {
                                    originSelectionRange: rangeInfo.nameRange,
                                    targetUri: vscode.Uri.file(parsedDocument.metaModelFileName),
                                    targetRange: (preferSignature && targetRangeInfo.signatureRange) || targetRangeInfo.range,
                                    targetSelectionRange: targetRangeInfo.nameRange
                                };
                            }
                        } else if (rangeInfo.object instanceof FmtDynamic.DynamicMetaRefExpression && parsedDocument.metaModelFileName) {
                            let targetRangeInfo = parsedDocument.metaModelDefinitions.get(rangeInfo.object.metaDefinition);
                            if (targetRangeInfo) {
                                return {
                                    originSelectionRange: rangeInfo.nameRange,
                                    targetUri: vscode.Uri.file(parsedDocument.metaModelFileName),
                                    targetRange: (preferSignature && targetRangeInfo.signatureRange) || targetRangeInfo.range,
                                    targetSelectionRange: targetRangeInfo.nameRange
                                };
                            }
                        } else if (rangeInfo.object instanceof Fmt.VariableRefExpression) {
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
                    if (rangeInfo.object instanceof FmtDynamic.DynamicMetaRefExpression && rangeInfo.object.originalArguments && parsedDocument.metaModelFileName) {
                        let definitionLink = this.getParameterDefinitionLink(position, parsedDocument, rangeInfo.object.metaDefinition.parameters, rangeInfo.object.arguments);
                        if (definitionLink) {
                            return definitionLink;
                        }
                    } else if (rangeInfo.object instanceof Fmt.Definition && rangeInfo.object.contents instanceof FmtDynamic.DynamicObjectContents) {
                        let definitionLink = this.getParameterDefinitionLinkForObjectContents(position, parsedDocument, rangeInfo.object.contents);
                        if (definitionLink) {
                            return definitionLink;
                        }
                    } else if (rangeInfo.object instanceof Fmt.CompoundExpression && parsedDocument.metaModel) {
                        let objectContents = parsedDocument.metaModel.objectContentsMap.get(rangeInfo.object.arguments);
                        if (objectContents) {
                            let definitionLink = this.getParameterDefinitionLinkForObjectContents(position, parsedDocument, objectContents);
                            if (definitionLink) {
                                return definitionLink;
                            }
                        }
                    }
                }
            }
        }
        return undefined;
    }

    private getParameterDefinitionLink(position: vscode.Position, parsedDocument: ParsedDocument, objectParameters: Fmt.Parameter[], objectArguments?: Fmt.Argument[]): vscode.DefinitionLink | undefined {
        if (parsedDocument.metaModelFileName && objectArguments) {
            for (let arg of objectArguments) {
                if (arg.name) {
                    let argRangeInfo = parsedDocument.rangeMap.get(arg);
                    if (argRangeInfo && argRangeInfo.nameRange && argRangeInfo.nameRange.contains(position)) {
                        for (let param of objectParameters) {
                            if (arg.name === param.name) {
                                let targetRangeInfo = parsedDocument.metaModelParameters.get(param);
                                if (targetRangeInfo) {
                                    return {
                                        originSelectionRange: argRangeInfo.nameRange,
                                        targetUri: vscode.Uri.file(parsedDocument.metaModelFileName),
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
        return undefined;
    }

    private getParameterDefinitionLinkForObjectContents(position: vscode.Position, parsedDocument: ParsedDocument, objectContents: FmtDynamic.DynamicObjectContents): vscode.DefinitionLink | undefined {
        let allMembers: Fmt.Parameter[] = [];
        if (parsedDocument.metaModelFileName) {
            let metaContents = objectContents.metaDefinition.contents;
            while (metaContents instanceof FmtMeta.ObjectContents_DefinedType) {
                if (metaContents.members) {
                    allMembers.unshift(...metaContents.members);
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
        }
        return this.getParameterDefinitionLink(position, parsedDocument, allMembers, objectContents.originalArguments);
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
        return null;
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
                    if (rangeInfo.object instanceof FmtDynamic.DynamicMetaRefExpression && rangeInfo.object.originalArguments && parsedDocument.metaModelFileName) {
                        if (rangeInfo.nameRange && rangeInfo.nameRange.contains(position)) {
                            continue;
                        }
                        let definitionRangeInfo = parsedDocument.metaModelDefinitions.get(rangeInfo.object.metaDefinition);
                        if (definitionRangeInfo && definitionRangeInfo.signatureRange) {
                            let signatureCode = readRange(vscode.Uri.file(parsedDocument.metaModelFileName), definitionRangeInfo.signatureRange, document);
                            if (signatureCode) {
                                let signatureHelp = this.createSignatureHelp(document, position, parsedDocument, signatureCode, rangeInfo.object.metaDefinition.parameters, rangeInfo.object.originalArguments);
                                if (signatureHelp) {
                                    return signatureHelp;
                                }
                            }
                        }
                    } else if (rangeInfo.object instanceof Fmt.Definition && rangeInfo.object.contents instanceof FmtDynamic.DynamicObjectContents) {
                        if (rangeInfo.signatureRange && rangeInfo.signatureRange.contains(position)) {
                            continue;
                        }
                        let innerDefinitionRangeInfo = parsedDocument.rangeMap.get(rangeInfo.object.innerDefinitions);
                        if (innerDefinitionRangeInfo && innerDefinitionRangeInfo.range.contains(position)) {
                            continue;
                        }
                        let signatureHelp = this.createSignatureHelpForObjectContents(document, position, parsedDocument, rangeInfo.object.contents);
                        if (signatureHelp) {
                            return signatureHelp;
                        }
                    } else if (rangeInfo.object instanceof Fmt.CompoundExpression && parsedDocument.metaModel) {
                        let objectContents = parsedDocument.metaModel.objectContentsMap.get(rangeInfo.object.arguments);
                        if (objectContents) {
                            let signatureHelp = this.createSignatureHelpForObjectContents(document, position, parsedDocument, objectContents);
                            if (signatureHelp) {
                                return signatureHelp;
                            }
                        }
                    }
                }
            }
        }
        return undefined;
    }

    private createSignatureHelp(document: vscode.TextDocument, position: vscode.Position, parsedDocument: ParsedDocument, signatureCode: string, objectParameters: Fmt.Parameter[], objectArguments?: Fmt.Argument[]): vscode.SignatureHelp | undefined {
        let signature = new vscode.SignatureInformation(signatureCode);
        let paramIndex = 0;
        if (parsedDocument.metaModelFileName) {
            for (let param of objectParameters) {
                let paramRangeInfo = parsedDocument.metaModelParameters.get(param);
                let paramCode: string | undefined = undefined;
                if (paramRangeInfo) {
                    paramCode = readRange(vscode.Uri.file(parsedDocument.metaModelFileName), paramRangeInfo.range, document);
                }
                signature.parameters.push(new vscode.ParameterInformation(paramCode || param.name));
            }
            if (objectArguments && objectArguments.length) {
                let argIndex = 0;
                let paramIsList = false;
                let prevArgRangeInfo: RangeInfo | undefined = undefined;
                for (let arg of objectArguments) {
                    let argRangeInfo = parsedDocument.rangeMap.get(arg);
                    if (argRangeInfo && position.isAfterOrEqual(argRangeInfo.range.start)) {
                        paramIndex = 0;
                        for (let param of objectParameters) {
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
        }
        return {
            signatures: [signature],
            activeSignature: 0,
            activeParameter: paramIndex
        };
    }

    private createSignatureHelpForObjectContents(document: vscode.TextDocument, position: vscode.Position, parsedDocument: ParsedDocument, objectContents: FmtDynamic.DynamicObjectContents): vscode.SignatureHelp | undefined {
        let signatureCode = '';
        let allMembers: Fmt.Parameter[] = [];
        if (parsedDocument.metaModelFileName) {
            let metaContents = objectContents.metaDefinition.contents;
            while (metaContents instanceof FmtMeta.ObjectContents_DefinedType) {
                if (metaContents.members) {
                    allMembers.unshift(...metaContents.members);
                    let definitionRangeInfo = parsedDocument.metaModelParameterLists.get(metaContents.members);
                    if (definitionRangeInfo) {
                        if (signatureCode) {
                            signatureCode = ', ' + signatureCode;
                        }
                        signatureCode = readRange(vscode.Uri.file(parsedDocument.metaModelFileName), definitionRangeInfo.range, document) + signatureCode;
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
        }
        return this.createSignatureHelp(document, position, parsedDocument, signatureCode, allMembers, objectContents.originalArguments);
    }
}

class HLMDocumentFormatter implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        try {
            let unformatted = document.getText();
            let file = FmtReader.readString(unformatted, document.fileName, (path: Fmt.Path) => getMetaModelWithFallback(document.fileName, path));
            if (token.isCancellationRequested) {
                return null;
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
        return null;
    }
}

function parseDocument(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection, parsedDocuments: ParsedDocumentMap): void {
    if (document.languageId !== languageId) {
        return;
    }
    let diagnostics: vscode.Diagnostic[] = [];
    let stream = new FmtReader.StringInputStream(document.getText());
    let reportError = (msg: string, range: FmtReader.Range) => {
        diagnostics.push({
            message: msg,
            range: convertRange(range),
            severity: vscode.DiagnosticSeverity.Error
        });
    };
    let parsedDocument: ParsedDocument = {
        rangeList: [],
        rangeMap: new Map<Object, RangeInfo>(),
        metaModelDefinitions: new Map<Fmt.Definition, RangeInfo>(),
        metaModelParameters: new Map<Fmt.Parameter, RangeInfo>(),
        metaModelParameterLists: new Map<Fmt.ParameterList, RangeInfo>()
    };
    let reportMetaModelRange = (object: Object, range: FmtReader.Range, nameRange?: FmtReader.Range, signatureRange?: FmtReader.Range) => {
        if (object instanceof Fmt.Definition) {
            parsedDocument.metaModelDefinitions.set(object, convertRangeInfo(object, range, nameRange, signatureRange));
        } else if (object instanceof Fmt.Parameter) {
            parsedDocument.metaModelParameters.set(object, convertRangeInfo(object, range, nameRange, signatureRange));
        } else if (object instanceof Fmt.ParameterList) {
            parsedDocument.metaModelParameterLists.set(object, convertRangeInfo(object, range, nameRange, signatureRange));
        }
    };
    let getDocumentMetaModel = (path: Fmt.Path) => {
        parsedDocument.metaModelPath = path;
        parsedDocument.metaModelFileName = getMetaModelFileName(document.fileName, path);
        parsedDocument.metaModelFile = readMetaModel(parsedDocument.metaModelFileName, reportMetaModelRange);
        parsedDocument.metaModel = createDynamicMetaModel(parsedDocument.metaModelFile, parsedDocument.metaModelFileName);
        return parsedDocument.metaModel;
    };
    let reportRange = (object: Object, range: FmtReader.Range, nameRange?: FmtReader.Range, signatureRange?: FmtReader.Range) => {
        let rangeInfo = convertRangeInfo(object, range, nameRange, signatureRange);
        parsedDocument.rangeList.push(rangeInfo);
        parsedDocument.rangeMap.set(object, rangeInfo);
    };
    let reader = new FmtReader.Reader(stream, reportError, getDocumentMetaModel, reportRange);
    try {
        reader.readFile();
    } catch (error) {
        if (!diagnostics.length) {
            let dummyPosition = new vscode.Position(0, 0);
            diagnostics.push({
                message: error.message,
                range: new vscode.Range(dummyPosition, dummyPosition),
                severity: vscode.DiagnosticSeverity.Error
            });
        }
    }
    diagnosticCollection.set(document.uri, diagnostics);
    parsedDocuments.set(document.uri, parsedDocument);
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
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(HLM_MODE, new HLMDocumentFormatter));
}

export function deactivate(): void {
}
