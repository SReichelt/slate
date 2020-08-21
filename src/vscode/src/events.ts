import * as vscode from 'vscode';
import * as Fmt from '../../shared/format/format';

export interface ParseDocumentEvent {
    document: vscode.TextDocument;
    file?: Fmt.File;
    hasErrors: boolean;
}

export interface HoverEvent {
    document: vscode.TextDocument;
    object: Object;
    targetMetaModelName: string;
    hoverTexts: Thenable<vscode.MarkdownString[]>;
}
