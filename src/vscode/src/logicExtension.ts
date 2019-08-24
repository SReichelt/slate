'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../shared/format/format';
import * as FmtReader from '../../shared/format/read';
import * as FmtLibrary from '../../shared/logics/library';
import * as FmtDisplay from '../../shared/display/meta';
import * as Display from '../../shared/display/display';
import { renderAsText } from '../../shared/display/textOutput';
import * as Logic from '../../shared/logics/logic';
import * as Logics from '../../shared/logics/logics';
import { FileContents } from '../../shared/data/fileAccessor';
import { WorkspaceFileAccessor } from './workspaceFileAccessor';
import { LibraryDataProvider } from '../../shared/data/libraryDataProvider';
import { fileExtension } from '../../fs/format/dynamic';
import { RangeInfo, convertRangeInfo } from './utils';
import CachedPromise from '../../shared/data/cachedPromise';

const languageId = 'slate';
const SLATE_MODE: vscode.DocumentFilter = { language: languageId, scheme: 'file' };

export class ParseDocumentEvent {
    document: vscode.TextDocument;
    file?: Fmt.File;
}

export class HoverEvent {
    document: vscode.TextDocument;
    object: Object;
    targetMetaModelName: string;
    hoverTexts: Thenable<vscode.MarkdownString[]>;
}

interface Library {
    libraryDataProvider: LibraryDataProvider;
    diagnosticCollection: vscode.DiagnosticCollection;
}

interface LibraryDocument {
    document: vscode.TextDocument;
    library: Library;
    documentLibraryDataProvider: LibraryDataProvider;
    file: Fmt.File;
    isSection: boolean;
    rangeList: RangeInfo[];
    rangeMap: Map<Object, RangeInfo>;
}

class LibraryDocumentProvider {
    private libraries = new Map<string, Library>();
    private documents = new Map<vscode.TextDocument, LibraryDocument>();

    constructor(private fileAccessor: WorkspaceFileAccessor) {}

    parseDocument(event: ParseDocumentEvent): LibraryDocument | undefined {
        let libraryDocument = this.tryParseDocument(event);
        if (libraryDocument) {
            this.documents.set(event.document, libraryDocument);
        } else {
            this.documents.delete(event.document);
        }
        return libraryDocument;
    }

    private tryParseDocument(event: ParseDocumentEvent): LibraryDocument | undefined {
        if (!event.file) {
            return undefined;
        }
        let isSection = (event.file.metaModelPath.name === 'library');
        let rangeList: RangeInfo[] = [];
        let rangeMap = new Map<Object, RangeInfo>();
        let reportRange = (info: FmtReader.ObjectRangeInfo) => {
            let rangeInfo = convertRangeInfo(info);
            rangeList.push(rangeInfo);
            rangeMap.set(info.object, rangeInfo);
        };
        if (isSection) {
            event.file = FmtReader.readString(event.document.getText(), event.document.fileName, FmtLibrary.getMetaModel, reportRange);
        }
        let library = this.getLibrary(event, isSection);
        if (!library) {
            return undefined;
        }
        let path = library.libraryDataProvider.uriToPath(event.document.uri.toString());
        if (!path) {
            return undefined;
        }
        let documentLibraryDataProvider = library.libraryDataProvider.getProviderForSection(path.parentPath);
        if (!isSection) {
            try {
                event.file = FmtReader.readString(event.document.getText(), event.document.fileName, library.libraryDataProvider.logic.getMetaModel, reportRange);
            } catch (error) {
                library.diagnosticCollection.set(event.document.uri, []);
                return undefined;
            }
        }
        return {
            document: event.document,
            library: library,
            documentLibraryDataProvider: documentLibraryDataProvider,
            file: event.file,
            isSection: isSection,
            rangeList: rangeList,
            rangeMap: rangeMap
        };
    }

    private getLibrary(event: ParseDocumentEvent, isSection: boolean): Library | undefined {
        let libraryBaseUri = this.getLibraryBaseUri(event);
        let libraryName = this.getLibraryName(event, libraryBaseUri);
        if (!libraryName) {
            return undefined;
        }
        let library = this.libraries.get(libraryName);
        if (!library) {
            let logicName = this.getLogicName(event, isSection);
            if (!logicName) {
                return undefined;
            }
            let logic = Logics.findLogic(logicName);
            if (!logic) {
                return undefined;
            }
            let libraryUri = libraryBaseUri + libraryName;
            library = {
                libraryDataProvider: new LibraryDataProvider(logic, this.fileAccessor, libraryUri, undefined, 'Library'),
                diagnosticCollection: vscode.languages.createDiagnosticCollection(languageId + '/' + libraryName)
            };
            this.libraries.set(libraryName, library);
        }
        return library;
    }

    private getLibraryBaseUri(event: ParseDocumentEvent): string | undefined {
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(event.document.uri);
        if (!workspaceFolder) {
            return undefined;
        }
        return workspaceFolder.uri.toString() + '/data/libraries/';
    }

    private getLibraryName(event: ParseDocumentEvent, libraryBaseUri: string | undefined): string | undefined {
        let documentUri = event.document.uri.toString();
        if (!libraryBaseUri || !documentUri.startsWith(libraryBaseUri)) {
            return undefined;
        }
        let relativeUri = documentUri.substring(libraryBaseUri.length);
        let slashPos = relativeUri.indexOf('/');
        return slashPos >= 0 ? relativeUri.substring(0, slashPos) : relativeUri;
    }

    private getLogicName(event: ParseDocumentEvent, isSection: boolean): string | undefined {
        if (!event.file) {
            return undefined;
        }
        if (isSection) {
            if (event.file.definitions.length) {
                let contents = event.file.definitions[0].contents;
                if (contents instanceof FmtLibrary.ObjectContents_Section) {
                    return contents.logic;
                }
            }
            return undefined;
        } else {
            return event.file.metaModelPath.name;
        }
    }

    getDocument(document: vscode.TextDocument): LibraryDocument | undefined {
        return this.documents.get(document);
    }
}

class SlateDiagnosticsProvider {
    constructor(private libraryDocumentProvider: LibraryDocumentProvider) {}

    checkDocument(libraryDocument: LibraryDocument): void {
        if (libraryDocument.isSection) {
            return;
        }
        if (libraryDocument.file.definitions.length) {
            let definition = libraryDocument.file.definitions[0];
            let checker = libraryDocument.documentLibraryDataProvider.logic.getChecker();
            checker.checkDefinition(definition, libraryDocument.documentLibraryDataProvider).then((checkResult: Logic.LogicCheckResult) => {
                let diagnostics = checkResult.diagnostics.map((diagnostic: Logic.LogicCheckDiagnostic) =>
                    new vscode.Diagnostic(this.getRange(libraryDocument, diagnostic), diagnostic.message, this.getSeverity(diagnostic)));
                libraryDocument.library.diagnosticCollection.set(libraryDocument.document.uri, diagnostics);
            });
        }
    }

    private getRange(libraryDocument: LibraryDocument, diagnostic: Logic.LogicCheckDiagnostic): vscode.Range {
        let range = libraryDocument.rangeMap.get(diagnostic.object);
        if (range) {
            return range.range;
        } else {
            let dummyPosition = new vscode.Position(0, 0);
            return new vscode.Range(dummyPosition, dummyPosition);
        }
    }

    private getSeverity(diagnostic: Logic.LogicCheckDiagnostic): vscode.DiagnosticSeverity {
        switch (diagnostic.severity) {
        case Logic.DiagnosticSeverity.Error:
            return vscode.DiagnosticSeverity.Error;
        case Logic.DiagnosticSeverity.Warning:
            return vscode.DiagnosticSeverity.Warning;
        }
    }
}

class SlateCodeLens extends vscode.CodeLens {
    constructor(range: vscode.Range, public renderFn: Logic.RenderFn) {
        super(range);
    }
}

class SlateCodeLensProvider implements vscode.CodeLensProvider {
    public templates?: Fmt.File;

    constructor(private libraryDocumentProvider: LibraryDocumentProvider, public onDidChangeCodeLenses: vscode.Event<void>) {}

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        let libraryDocument = this.libraryDocumentProvider.getDocument(document);
        if (libraryDocument && this.templates) {
            let libraryDataProvider = libraryDocument.documentLibraryDataProvider;
            let templates = this.templates;
            let result: vscode.CodeLens[] = [];
            if (libraryDocument.isSection) {
                for (let range of libraryDocument.rangeList) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    if (range.object instanceof FmtLibrary.MetaRefExpression_item && range.object.ref instanceof Fmt.DefinitionRefExpression) {
                        let ref = range.object.ref;
                        result.push(new SlateCodeLens(range.range, () => {
                            let item = libraryDataProvider.fetchItem(ref.path);
                            let expression = item.then((definition) => {
                                let renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition, false, libraryDataProvider, templates);
                                try {
                                    return renderer.renderDefinitionSummary() || new Display.EmptyExpression;
                                } catch (error) {
                                    return new Display.ErrorExpression(error.message);
                                }
                            });
                            return new Display.PromiseExpression(expression);
                        }));
                    }
                }
            } else {
                if (libraryDocument.file.definitions.length) {
                    let definition = libraryDocument.file.definitions[0];
                    let renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition, true, libraryDataProvider, templates);
                    try {
                        let parts = renderer.getDefinitionParts();
                        for (let range of libraryDocument.rangeList) {
                            if (token.isCancellationRequested) {
                                break;
                            }
                            let part = parts.get(range.object);
                            if (part) {
                                result.push(new SlateCodeLens(range.range, part));
                            }
                        }
                    } catch (error) {
                    }
                }
            }
            return result;
        }
        return undefined;
    }

	resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        if (codeLens instanceof SlateCodeLens) {
            return renderAsText(codeLens.renderFn(), false, true).then((text: string) => {
                return new vscode.CodeLens(codeLens.range, {
                    title: text,
                    command: ''
                });
            });
        } else {
            return undefined;
        }
    }
}

class SlateLogicHoverProvider {
    public templates?: Fmt.File;

    constructor(private libraryDocumentProvider: LibraryDocumentProvider) {}

    provideHover(event: HoverEvent): void {
        let libraryDocument = this.libraryDocumentProvider.getDocument(event.document);
        if (libraryDocument && this.templates && event.object instanceof Fmt.Path && event.targetMetaModelName === libraryDocument.documentLibraryDataProvider.logic.name) {
            let targetDataProvider = libraryDocument.documentLibraryDataProvider.getProviderForSection(event.object.parentPath);
            let definitionPromise = targetDataProvider.fetchLocalItem(event.object.name);
            let templates = this.templates;
            let textPromise = definitionPromise.then((definition: Fmt.Definition) => {
                let renderer = targetDataProvider.logic.getDisplay().getDefinitionRenderer(definition, false, targetDataProvider, templates);
                let renderedDefinition = renderer.renderDefinition(undefined, false, true, false);
                return renderedDefinition ? renderAsText(renderedDefinition, true, false) : CachedPromise.resolve('');
            });
            event.hoverTexts = event.hoverTexts.then((hoverTexts: vscode.MarkdownString[]) => textPromise.then((text: string) => {
                if (text) {
                    return hoverTexts.concat(new vscode.MarkdownString(text));
                } else {
                    return hoverTexts;
                }
            }).catch(() => hoverTexts));
        }
    }
}

export function activate(context: vscode.ExtensionContext, onDidParseDocument: vscode.Event<ParseDocumentEvent>, onShowHover: vscode.Event<HoverEvent>): void {
    let fileAccessor = new WorkspaceFileAccessor;
    let libraryDocumentProvider = new LibraryDocumentProvider(fileAccessor);
    let diagnosticsProvider = new SlateDiagnosticsProvider(libraryDocumentProvider);
    let changeCodeLensesEventEmitter = new vscode.EventEmitter<void>();
    context.subscriptions.push(changeCodeLensesEventEmitter);
    let codeLensProvider = new SlateCodeLensProvider(libraryDocumentProvider, changeCodeLensesEventEmitter.event);
    let hoverProvider = new SlateLogicHoverProvider(libraryDocumentProvider);

    context.subscriptions.push(
        onDidParseDocument((event: ParseDocumentEvent) => {
            try {
                let document = libraryDocumentProvider.parseDocument(event);
                if (document) {
                    diagnosticsProvider.checkDocument(document);
                    changeCodeLensesEventEmitter.fire();
                }
            } catch (error) {
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => fileAccessor.documentChanged(event.document)),
        vscode.languages.registerCodeLensProvider(SLATE_MODE, codeLensProvider),
        onShowHover((event: HoverEvent) => hoverProvider.provideHover(event))
    );

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
        let templatesUri = vscode.workspace.workspaceFolders[0].uri.toString() + '/data/display/templates' + fileExtension;
        fileAccessor.readFile(templatesUri)
            .then((contents: FileContents) => {
                context.subscriptions.push({ dispose() { contents.close(); } });
                contents.onChange = () => {
                    try {
                        let templates = FmtReader.readString(contents.text, templatesUri, FmtDisplay.getMetaModel);
                        codeLensProvider.templates = templates;
                        hoverProvider.templates = templates;
                    } catch (error) {
                    }
                    changeCodeLensesEventEmitter.fire();
                };
                contents.onChange();
            });
    }
}

export function deactivate(): void {
}
