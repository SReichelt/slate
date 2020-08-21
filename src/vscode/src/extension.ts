import * as vscode from 'vscode';
import { WorkspaceFileAccessor } from './workspaceFileAccessor';
import { ParseDocumentEvent, HoverEvent } from './events';
import * as FormatExtension from './format/formatExtension';
import * as LogicExtension from './logic/logicExtension';
import * as WebviewExtension from './webview/webviewExtension';

export function activate(context: vscode.ExtensionContext): void {
    let fileAccessor = new WorkspaceFileAccessor;
    FormatExtension.activate(context, fileAccessor, (parseEvent: vscode.Event<ParseDocumentEvent>, hoverEvent: vscode.Event<HoverEvent>) =>
        LogicExtension.activate(context, parseEvent, hoverEvent, fileAccessor));
    WebviewExtension.activate(context, fileAccessor);
}

export function deactivate(): void {
    WebviewExtension.deactivate();
    LogicExtension.deactivate();
    FormatExtension.deactivate();
}
