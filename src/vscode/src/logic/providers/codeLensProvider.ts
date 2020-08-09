'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../../shared/format/format';
import * as FmtLibrary from '../../../../shared/logics/library';
import * as Notation from '../../../../shared/notation/notation';
import { renderAsText, RenderAsTextOptions } from '../../../../shared/notation/textOutput';
import * as Logic from '../../../../shared/logics/logic';
import { LibraryDefinition } from '../../../../shared/data/libraryDataProvider';
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
        let libraryDocument = this.libraryDocumentProvider.getDocument(document);
        if (libraryDocument && this.templates) {
            let libraryDataProvider = libraryDocument.documentLibraryDataProvider;
            let templates = this.templates;
            let result: vscode.CodeLens[] = [];
            let rendererOptions: Logic.LogicRendererOptions = {
                includeProofs: true,
                maxListLength: 10
            };
            if (libraryDocument.isSection) {
                for (let range of libraryDocument.rangeList) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    if (range.object instanceof FmtLibrary.MetaRefExpression_item && range.object.ref instanceof Fmt.DefinitionRefExpression) {
                        let ref = range.object.ref;
                        result.push(new SlateCodeLens(range.range, () => {
                            let item = libraryDataProvider.fetchItem(ref.path, false);
                            let expression = item.then((definition: LibraryDefinition) => {
                                let renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, templates, rendererOptions);
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
                    let definition = libraryDocument.file.definitions[0];
                    let renderer = libraryDataProvider.logic.getDisplay().getDefinitionRenderer(definition, libraryDataProvider, templates, rendererOptions);
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
            let renderAsTextOptions: RenderAsTextOptions = {
                outputMarkdown: false,
                singleLine: true,
                allowEmptyLines: false,
                indent: ''
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
