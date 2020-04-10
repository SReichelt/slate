'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../../shared/format/format';
import { renderAsText } from '../../../../shared/display/textOutput';
import * as Logic from '../../../../shared/logics/logic';
import { LibraryDefinition } from '../../../../shared/data/libraryDataProvider';
import { HoverEvent } from '../../events';
import { LibraryDocumentProvider } from '../data';
import CachedPromise from '../../../../shared/data/cachedPromise';

export class SlateLogicHoverProvider {
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
                let renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
                    includeLabel: false,
                    includeExtras: true,
                    includeRemarks: false
                };
                let renderedDefinition = renderer.renderDefinition(undefined, renderedDefinitionOptions);
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
