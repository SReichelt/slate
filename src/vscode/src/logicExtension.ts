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
import { convertRange } from './utils';
import CachedPromise from '../../shared/data/cachedPromise';

const languageId = 'slate';
const SLATE_MODE: vscode.DocumentFilter = { language: languageId, scheme: 'file' };

class SlateCodeLens extends vscode.CodeLens {
    constructor(range: vscode.Range, public renderFn: Logic.RenderFn) {
        super(range);
    }
}

class SlateCodeLensProvider implements vscode.CodeLensProvider {
    public templates?: Fmt.File;

    constructor(private documentLibraryDataProviders: Map<vscode.TextDocument, LibraryDataProvider>, public onDidChangeCodeLenses: vscode.Event<void>) {}

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        let documentLibraryDataProvider = this.documentLibraryDataProviders.get(document);
        if (documentLibraryDataProvider && this.templates) {
            let libraryDataProvider = documentLibraryDataProvider;
            let templates = this.templates;
            try {
                let result: vscode.CodeLens[] = [];
                if (document.uri.toString().endsWith('_index' + fileExtension)) {
                    let reportRange = (info: FmtReader.ObjectRangeInfo) => {
                        if (token.isCancellationRequested) {
                            return;
                        }
                        if (info.object instanceof FmtLibrary.MetaRefExpression_item && info.object.ref instanceof Fmt.DefinitionRefExpression) {
                            let ref = info.object.ref;
                            result.push(new SlateCodeLens(convertRange(info.range), () => {
                                let item = libraryDataProvider.fetchItem(ref.path);
                                let expression = item.then((definition) => {
                                    let renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition, false, libraryDataProvider, templates, false);
                                    return renderer.renderDefinitionSummary() || new Display.EmptyExpression;
                                });
                                return new Display.PromiseExpression(expression);
                            }));
                        }
                    };
                    FmtReader.readString(document.getText(), document.fileName, FmtLibrary.getMetaModel, reportRange);
                } else {
                    let ranges: FmtReader.ObjectRangeInfo[] = [];
                    let reportRange = (info: FmtReader.ObjectRangeInfo) => ranges.push(info);
                    let file = FmtReader.readString(document.getText(), document.fileName, documentLibraryDataProvider.logic.getMetaModel, reportRange);
                    if (file.definitions.length) {
                        let definition = file.definitions[0];
                        let renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition, true, libraryDataProvider, templates, false);
                        let parts = renderer.getDefinitionParts();
                        for (let info of ranges) {
                            if (token.isCancellationRequested) {
                                break;
                            }
                            let part = parts.get(info.object);
                            if (part) {
                                result.push(new SlateCodeLens(convertRange(info.range), part));
                            }
                        }
                    }
                }
                return result;
            } catch (error) {
            }
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

    constructor(private documentLibraryDataProviders: Map<vscode.TextDocument, LibraryDataProvider>) {}

    provideHover(event: HoverEvent): void {
        let documentLibraryDataProvider = this.documentLibraryDataProviders.get(event.document);
        if (documentLibraryDataProvider && this.templates && event.object instanceof Fmt.Path && event.targetMetaModelName === documentLibraryDataProvider.logic.name) {
            let targetDataProvider = documentLibraryDataProvider.getProviderForSection(event.object.parentPath);
            let definitionPromise = targetDataProvider.fetchLocalItem(event.object.name);
            let templates = this.templates;
            let textPromise = definitionPromise.then((definition: Fmt.Definition) => {
                let renderer = targetDataProvider.logic.getDisplay().getDefinitionRenderer(definition, false, targetDataProvider, templates, false);
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

export class ParseDocumentEvent {
    document: vscode.TextDocument;
    metaModelName: string;
}

export class HoverEvent {
    document: vscode.TextDocument;
    object: Object;
    targetMetaModelName: string;
    hoverTexts: Thenable<vscode.MarkdownString[]>;
}

export function activate(context: vscode.ExtensionContext, onDidParseDocument: vscode.Event<ParseDocumentEvent>, onShowHover: vscode.Event<HoverEvent>): void {
    let fileAccessor = new WorkspaceFileAccessor;
    let rootLibraryDataProviders = new Map<string, LibraryDataProvider>();
    let documentLibraryDataProviders = new Map<vscode.TextDocument, LibraryDataProvider>();
    let changeCodeLensesEventEmitter = new vscode.EventEmitter<void>();
    context.subscriptions.push(changeCodeLensesEventEmitter);
    let codeLensProvider = new SlateCodeLensProvider(documentLibraryDataProviders, changeCodeLensesEventEmitter.event);
    let hoverProvider = new SlateLogicHoverProvider(documentLibraryDataProviders);
    context.subscriptions.push(
        onDidParseDocument((event: ParseDocumentEvent) => {
            try {
                let workspaceFolder = vscode.workspace.getWorkspaceFolder(event.document.uri);
                if (!workspaceFolder) {
                    return;
                }
                let libraryBaseUri = workspaceFolder.uri.toString() + '/data/libraries/';
                let documentUri = event.document.uri.toString();
                if (!documentUri.startsWith(libraryBaseUri)) {
                    return;
                }
                let relativeUri = documentUri.substring(libraryBaseUri.length);
                let slashPos = relativeUri.indexOf('/');
                let libraryName = slashPos >= 0 ? relativeUri.substring(0, slashPos) : relativeUri;
                let logicName: string | undefined = undefined;
                if (event.metaModelName === 'library') {
                    let file = FmtReader.readString(event.document.getText(), event.document.fileName, FmtLibrary.getMetaModel);
                    if (file.definitions.length) {
                        let contents = file.definitions[0].contents;
                        if (contents instanceof FmtLibrary.ObjectContents_Section) {
                            logicName = contents.logic;
                        }
                    }
                } else {
                    logicName = event.metaModelName;
                }
                if (!logicName) {
                    return;
                }
                let rootLibraryDataProvider = rootLibraryDataProviders.get(libraryName);
                if (!rootLibraryDataProvider) {
                    let logic = Logics.logics.find((value: Logic.Logic) => value.name === logicName);
                    if (!logic) {
                        return;
                    }
                    let libraryUri = libraryBaseUri + libraryName;
                    rootLibraryDataProvider = new LibraryDataProvider(logic, fileAccessor, libraryUri, undefined, 'Library');
                    rootLibraryDataProviders.set(libraryName, rootLibraryDataProvider);
                }
                let path = rootLibraryDataProvider.uriToPath(documentUri);
                if (path) {
                    let documentLibraryDataProvider = rootLibraryDataProvider.getProviderForSection(path.parentPath);
                    documentLibraryDataProviders.set(event.document, documentLibraryDataProvider);
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
