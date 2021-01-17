import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import { ParsedDocumentMap } from '../parsedDocument';

export class SlateHighlightProvider implements vscode.DocumentHighlightProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        let parsedDocument = this.parsedDocuments.get(document);
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
                    } else if (rangeInfo.object instanceof Fmt.DocumentationItem) {
                        variable = rangeInfo.object.parameter;
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
                        } else if (rangeInfo.object instanceof Fmt.DocumentationItem && rangeInfo.object.parameter === variable) {
                            highlights.push(new vscode.DocumentHighlight(rangeInfo.nameRange, vscode.DocumentHighlightKind.Text));
                        }
                    }
                }
                return highlights;
            }
        }
        return undefined;
    }
}
