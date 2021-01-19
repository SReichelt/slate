import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import * as FmtLibrary from 'slate-shared/logics/library';
import * as Notation from 'slate-shared/notation/notation';
import { renderAsText, RenderAsTextOptions } from 'slate-shared/notation/textOutput';
import * as Logic from 'slate-shared/logics/logic';
import { LibraryDefinition } from 'slate-shared/data/libraryDataProvider';
import { LibraryDocumentProvider } from '../data';

class SlateCodeLens extends vscode.CodeLens {
    constructor(range: vscode.Range, public renderFn: Logic.RenderFn) {
        super(range);
    }
}

export class SlateCodeLensProvider implements vscode.CodeLensProvider {
    public templates?: Fmt.File;

    constructor(private libraryDocumentProvider: LibraryDocumentProvider, public onDidChangeCodeLenses: vscode.Event<void>) {}

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const libraryDocument = this.libraryDocumentProvider.getDocument(document);
        if (libraryDocument && this.templates) {
            const libraryDataProvider = libraryDocument.documentLibraryDataProvider;
            const templates = this.templates;
            const result: vscode.CodeLens[] = [];
            const rendererOptions: Logic.LogicRendererOptions = {
                includeProofs: true,
                maxListLength: 10
            };
            if (libraryDocument.isSection) {
                for (const range of libraryDocument.rangeList) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    if (range.object instanceof FmtLibrary.MetaRefExpression_item && range.object.ref instanceof Fmt.DefinitionRefExpression) {
                        const ref = range.object.ref;
                        result.push(new SlateCodeLens(range.range, () => {
                            const item = libraryDataProvider.fetchItem(ref.path, false);
                            const expression = item.then((definition: LibraryDefinition) => {
                                const renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, templates, rendererOptions);
                                try {
                                    return renderer.renderDefinitionSummary() || new Notation.EmptyExpression;
                                } catch (error) {
                                    return new Notation.ErrorExpression(error.message);
                                }
                            });
                            return new Notation.PromiseExpression(expression);
                        }));
                    }
                }
            } else {
                if (libraryDocument.file.definitions.length) {
                    const definition = libraryDocument.file.definitions[0];
                    const renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition, libraryDataProvider, templates, rendererOptions);
                    try {
                        const parts = renderer.getDefinitionParts();
                        for (const range of libraryDocument.rangeList) {
                            if (token.isCancellationRequested) {
                                break;
                            }
                            const part = parts.get(range.object);
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
            const renderAsTextOptions: RenderAsTextOptions = {
                outputMarkdown: false,
                singleLine: true,
                allowEmptyLines: false
            };
            return renderAsText(codeLens.renderFn(), renderAsTextOptions).then((text: string) => {
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
