'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../../shared/format/format';
import { ParsedDocumentMap } from '../parsedDocument';
import { DefinitionLink, getDefinitionLinks } from '../navigate';
import { readRange } from '../utils';
import { appendDocumentation } from '../documentation';
import { HoverEvent } from '../../events';
import CachedPromise from '../../../../shared/data/cachedPromise';

export class SlateDefinitionProvider implements vscode.DefinitionProvider, vscode.HoverProvider {
    constructor(private parsedDocuments: ParsedDocumentMap, private hoverEventEmitter: vscode.EventEmitter<HoverEvent>) {}

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
        let definitionLink = this.getDefinitionLink(document, position, token, false);
        if (definitionLink !== undefined) {
            return [definitionLink];
        }
        return undefined;
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        let definitionLink = this.getDefinitionLink(document, position, token, true);
        if (definitionLink !== undefined && !token.isCancellationRequested) {
            let hoverTexts: vscode.MarkdownString[] = [];
            let hoverCode: string | undefined = readRange(definitionLink.targetUri, definitionLink.targetRange, false, document);
            if (hoverCode) {
                let hoverText = new vscode.MarkdownString;
                hoverText.appendCodeblock(hoverCode);
                hoverTexts.push(hoverText);
            }
            let intermediateHoverTexts: Thenable<vscode.MarkdownString[]> = CachedPromise.resolve(hoverTexts);
            let referencedDefinition = definitionLink.referencedDefinition;
            if (referencedDefinition && referencedDefinition.parsedDocument.file) {
                let hoverEvent: HoverEvent = {
                    document: document,
                    object: definitionLink.originObject,
                    targetMetaModelName: referencedDefinition.parsedDocument.file.metaModelPath.name,
                    hoverTexts: intermediateHoverTexts
                };
                this.hoverEventEmitter.fire(hoverEvent);
                intermediateHoverTexts = hoverEvent.hoverTexts;
            }
            let targetObject = definitionLink.targetObject;
            return intermediateHoverTexts.then((finalHoverTexts: vscode.MarkdownString[]) => {
                if (referencedDefinition && referencedDefinition.definition.documentation) {
                    let hoverText = new vscode.MarkdownString;
                    let includeAll = (targetObject === referencedDefinition.definition);
                    let specificParameter = targetObject instanceof Fmt.Parameter ? targetObject : undefined;
                    appendDocumentation(referencedDefinition.definition.documentation, includeAll, specificParameter, hoverText);
                    finalHoverTexts.push(hoverText);
                }
                if (finalHoverTexts.length) {
                    return new vscode.Hover(finalHoverTexts, definitionLink!.originSelectionRange);
                } else {
                    return undefined;
                }
            });
        }
        return undefined;
    }

    private getDefinitionLink(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, preferSignature: boolean): DefinitionLink | undefined {
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
