import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import { ParsedDocumentMap } from '../parsedDocument';
import { DefinitionLink, getDefinitionLinks } from '../navigate';
import { readRange } from '../utils';
import { appendDocumentation } from '../documentation';
import { HoverEvent } from '../../events';
import CachedPromise from 'slate-shared/data/cachedPromise';

export class SlateDefinitionProvider implements vscode.DefinitionProvider, vscode.HoverProvider {
    constructor(private parsedDocuments: ParsedDocumentMap, private hoverEventEmitter: vscode.EventEmitter<HoverEvent>) {}

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
        const definitionLink = this.getDefinitionLink(document, position, token, false);
        if (definitionLink !== undefined) {
            return [definitionLink];
        }
        return undefined;
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const definitionLink = this.getDefinitionLink(document, position, token, true);
        if (definitionLink !== undefined && !token.isCancellationRequested) {
            const hoverTexts: vscode.MarkdownString[] = [];
            const hoverCode: string | undefined = readRange(definitionLink.targetUri, definitionLink.targetRange, false, document);
            if (hoverCode) {
                const hoverText = new vscode.MarkdownString;
                hoverText.appendCodeblock(hoverCode);
                hoverTexts.push(hoverText);
            }
            let intermediateHoverTexts: Thenable<vscode.MarkdownString[]> = CachedPromise.resolve(hoverTexts);
            const referencedDefinition = definitionLink.referencedDefinition;
            if (referencedDefinition && referencedDefinition.parsedDocument.file) {
                const hoverEvent: HoverEvent = {
                    document: document,
                    object: definitionLink.originObject,
                    targetMetaModelName: referencedDefinition.parsedDocument.file.metaModelPath.name,
                    hoverTexts: intermediateHoverTexts
                };
                this.hoverEventEmitter.fire(hoverEvent);
                intermediateHoverTexts = hoverEvent.hoverTexts;
            }
            const targetObject = definitionLink.targetObject;
            return intermediateHoverTexts.then((finalHoverTexts: vscode.MarkdownString[]) => {
                if (referencedDefinition && referencedDefinition.definition.documentation) {
                    const hoverText = new vscode.MarkdownString;
                    const includeAll = (targetObject === referencedDefinition.definition);
                    const specificParameter = targetObject instanceof Fmt.Parameter ? targetObject : undefined;
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
        const parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            for (const rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    const definitionLinks = getDefinitionLinks(parsedDocument, rangeInfo, position, preferSignature, document);
                    if (definitionLinks.length) {
                        return definitionLinks[0];
                    }
                }
            }
        }
        return undefined;
    }
}
