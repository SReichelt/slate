'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../shared/format/format';
import * as FmtReader from '../../shared/format/read';
import * as FmtWriter from '../../shared/format/write';

const languageId = 'hlm';
const HLM_MODE: vscode.DocumentFilter = { language: languageId, scheme: 'file' };

class HLMDocumentFormatter implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        try {
            let unformatted = document.getText();
            let file = FmtReader.readString(unformatted, document.fileName, new Fmt.DummyContextProvider);
            let formatted = FmtWriter.writeString(file);
            if (formatted !== unformatted) {
                let range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(unformatted.length)
                );
                return [new vscode.TextEdit(range, formatted)];
            }
        } catch (error) {
        }
        return [];
    }
}

export function activate(context: vscode.ExtensionContext): void {
    let collection = vscode.languages.createDiagnosticCollection(languageId);
    for (let document of vscode.workspace.textDocuments) {
        updateDiagnostics(document, collection);
    }
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => updateDiagnostics(document, collection)));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => updateDiagnostics(event.document, collection)));
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(HLM_MODE, new HLMDocumentFormatter));
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (document.languageId !== languageId) {
        return;
    }
    let diagnostics: vscode.Diagnostic[] = [];
    let stream = new FmtReader.StringInputStream(document.getText());
    let errorHandler = (msg: string, line: number, col: number) => {
        let position = new vscode.Position(line, col);
        diagnostics.push({
            message: msg,
            range: new vscode.Range(position, position),
            severity: vscode.DiagnosticSeverity.Error
        });
    };
    let reader = new FmtReader.Reader(stream, errorHandler, new Fmt.DummyContextProvider);
    try {
        reader.readFile();
    } catch (error) {
    }
    collection.set(document.uri, diagnostics);
}

export function deactivate(): void {
}
