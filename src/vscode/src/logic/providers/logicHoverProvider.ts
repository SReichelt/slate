import * as vscode from 'vscode';
import * as Fmt from '../../../../shared/format/format';
import { renderAsText, RenderAsTextOptions } from '../../../../shared/notation/textOutput';
import * as Logic from '../../../../shared/logics/logic';
import { LibraryDefinition } from '../../../../shared/data/libraryDataProvider';
import { HoverEvent } from '../../events';
import { LibraryDocumentProvider } from '../data';
import CachedPromise from '../../../../shared/data/cachedPromise';

export class SlateLogicHoverProvider {
    private static readonly renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
        includeLabel: false,
        includeExtras: true,
        includeRemarks: false
    };

    public templates?: Fmt.File;

    constructor(private libraryDocumentProvider: LibraryDocumentProvider) {}

    provideHover(event: HoverEvent): void {
        let libraryDocument = this.libraryDocumentProvider.getDocument(event.document);
        if (libraryDocument && this.templates && event.object instanceof Fmt.Path && event.targetMetaModelName === libraryDocument.documentLibraryDataProvider.logic.name) {
            let targetDataProvider = libraryDocument.documentLibraryDataProvider.getProviderForSection(event.object.parentPath);
            let definitionPromise = targetDataProvider.fetchLocalItem(event.object.name, false);
            let templates = this.templates;
            let textPromise = definitionPromise.then((definition: LibraryDefinition) => {
                let rendererOptions: Logic.LogicRendererOptions = {
                    includeProofs: false,
                    maxListLength: 20
                };
                let renderer = targetDataProvider.logic.getDisplay().getDefinitionRenderer(definition.definition, targetDataProvider, templates, rendererOptions);
                let renderedDefinition = renderer.renderDefinition(undefined, SlateLogicHoverProvider.renderedDefinitionOptions);
                if (!renderedDefinition) {
                    return CachedPromise.resolve('');
                }
                let renderAsTextOptions: RenderAsTextOptions = {
                    outputMarkdown: true,
                    singleLine: false,
                    allowEmptyLines: true
                };
                return renderAsText(renderedDefinition, renderAsTextOptions);
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
