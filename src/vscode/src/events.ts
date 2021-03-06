import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';

export interface ParseDocumentEvent {
    document: vscode.TextDocument;
    file?: Fmt.File;
    hasErrors: boolean;
}

export interface ForgetDocumentEvent {
    document: vscode.TextDocument;
}

export interface HoverEvent {
    document: vscode.TextDocument;
    object: Object;
    targetMetaModelName: string;
    hoverTexts: Thenable<vscode.MarkdownString[]>;
}
