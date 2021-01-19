import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtWriter from 'slate-shared/format/write';
import { getMetaModelWithFallback } from 'slate-env-node/format/dynamic';
import { replaceDocumentText } from '../../utils';

export class SlateDocumentFormatter implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        const unformatted = document.getText();
        try {
            const file: Fmt.File = FmtReader.readString(unformatted, document.fileName, (path: Fmt.Path) => getMetaModelWithFallback(document.fileName, path));
            if (token.isCancellationRequested) {
                return undefined;
            }
            const formatted = FmtWriter.writeString(file);
            const textEdit = replaceDocumentText(document, formatted);
            if (textEdit) {
                return [textEdit];
            }
        } catch (error) {
        }
        return undefined;
    }
}
