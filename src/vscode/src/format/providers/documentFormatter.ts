'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../../shared/format/format';
import * as FmtReader from '../../../../shared/format/read';
import * as FmtWriter from '../../../../shared/format/write';
import { getMetaModelWithFallback } from '../../../../fs/format/dynamic';
import { replaceDocumentText } from '../../utils';

export class SlateDocumentFormatter implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        let unformatted = document.getText();
        try {
            let file: Fmt.File = FmtReader.readString(unformatted, document.fileName, (path: Fmt.Path) => getMetaModelWithFallback(document.fileName, path));
            if (token.isCancellationRequested) {
                return undefined;
            }
            let formatted = FmtWriter.writeString(file);
            let textEdit = replaceDocumentText(document, formatted);
            if (textEdit) {
                return [textEdit];
            }
        } catch (error) {
        }
        return undefined;
    }
}
