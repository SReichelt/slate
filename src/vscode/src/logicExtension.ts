'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../shared/format/format';
import * as FmtReader from '../../shared/format/read';
import * as FmtLibrary from '../../shared/format/library';
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

const languageId = 'hlm';
const HLM_MODE: vscode.DocumentFilter = { language: languageId, scheme: 'file' };

class HLMCodeLens extends vscode.CodeLens {
    constructor(range: vscode.Range, public renderFn: Logic.RenderFn) {
        super(range);
    }
}

class HLMCodeLensProvider implements vscode.CodeLensProvider {
    private templates?: Fmt.File;

    constructor(private documentLibraryDataProviders: Map<vscode.TextDocument, LibraryDataProvider>, public onDidChangeCodeLenses: vscode.Event<void>) {}

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        let documentLibraryDataProvider = this.documentLibraryDataProviders.get(document);
        if (documentLibraryDataProvider && this.templates) {
            try {
                let renderer = documentLibraryDataProvider.logic.getDisplay().getRenderer(documentLibraryDataProvider, this.templates);
                let result: vscode.CodeLens[] = [];
                if (document.uri.toString().endsWith('_index' + fileExtension)) {
                    let reportRange = (info: FmtReader.ObjectRangeInfo) => {
                        if (info.object instanceof FmtLibrary.MetaRefExpression_item && info.object.ref instanceof Fmt.DefinitionRefExpression) {
                            let ref = info.object.ref;
                            result.push(new HLMCodeLens(convertRange(info.range), () => {
                                let item = documentLibraryDataProvider!.fetchItem(ref.path);
                                let expression = item.then((definition) => renderer.renderDefinitionSummary(definition) || new Display.EmptyExpression);
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
                        let parts = renderer.getDefinitionParts(definition, true);
                        for (let info of ranges) {
                            let part = parts.get(info.object);
                            if (part) {
                                result.push(new HLMCodeLens(convertRange(info.range), part));
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
        if (codeLens instanceof HLMCodeLens) {
            return renderAsText(codeLens.renderFn()).then((text: string) => {
                return new vscode.CodeLens(codeLens.range, {
                    title: text,
                    command: ''
                });
            });
        } else {
            return undefined;
        }
    }

    updateTemplates(fileContents: string, uri: string): void {
        try {
            this.templates = FmtReader.readString(fileContents, uri, FmtDisplay.getMetaModel);
        } catch (error) {
        }
    }
}

export class ParseDocumentEvent {
    document: vscode.TextDocument;
    metaModelName: string;
}

export function activate(context: vscode.ExtensionContext, onDidParseDocument: vscode.Event<ParseDocumentEvent>): void {
    let fileAccessor = new WorkspaceFileAccessor;
    let rootLibraryDataProviders = new Map<string, LibraryDataProvider>();
    let documentLibraryDataProviders = new Map<vscode.TextDocument, LibraryDataProvider>();
    let changeCodeLensesEventEmitter = new vscode.EventEmitter<void>();
    context.subscriptions.push(changeCodeLensesEventEmitter);
    let codeLensProvider = new HLMCodeLensProvider(documentLibraryDataProviders, changeCodeLensesEventEmitter.event);
    context.subscriptions.push(
        onDidParseDocument((event) => {
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
                    let logic = Logics.logics.get(logicName);
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
        vscode.workspace.onDidChangeTextDocument((event) => fileAccessor.fileChanged(event.document.uri.toString())),
        vscode.languages.registerCodeLensProvider(HLM_MODE, codeLensProvider)
    );
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
        let templatesUri = vscode.workspace.workspaceFolders[0].uri.toString() + '/data/display/templates' + fileExtension;
        fileAccessor.readFile(templatesUri)
            .then((contents: FileContents) => {
                context.subscriptions.push({ dispose() { contents.close(); } });
                contents.onChange = () => {
                    codeLensProvider.updateTemplates(contents.text, templatesUri);
                    changeCodeLensesEventEmitter.fire();
                };
                contents.onChange();
            });
    }
}

export function deactivate(): void {
}
