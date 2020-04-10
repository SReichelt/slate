'use strict';

import * as vscode from 'vscode';
import * as FmtReader from '../../../shared/format/read';
import * as FmtDisplay from '../../../shared/display/meta';
import { FileAccessor, FileContents } from '../../../shared/data/fileAccessor';
import { fileExtension } from '../../../fs/format/dynamic';
import { SLATE_MODE } from '../slate';
import { ParseDocumentEvent, HoverEvent } from '../events';
import { LibraryDocumentProvider } from './data';
import { SlateDiagnosticsProvider } from './providers/diagnosticsProvider';
import { SlateCodeLensProvider } from './providers/codeLensProvider';
import { SlateLogicHoverProvider } from './providers/logicHoverProvider';

export function activate(context: vscode.ExtensionContext, onDidParseDocument: vscode.Event<ParseDocumentEvent>, onShowHover: vscode.Event<HoverEvent>, fileAccessor: FileAccessor): void {
    let libraryDocumentProvider = new LibraryDocumentProvider(fileAccessor);
    let diagnosticsProvider = new SlateDiagnosticsProvider(libraryDocumentProvider);
    let changeCodeLensesEventEmitter = new vscode.EventEmitter<void>();
    context.subscriptions.push(changeCodeLensesEventEmitter);
    let codeLensProvider = new SlateCodeLensProvider(libraryDocumentProvider, changeCodeLensesEventEmitter.event);
    let hoverProvider = new SlateLogicHoverProvider(libraryDocumentProvider);

    context.subscriptions.push(
        onDidParseDocument((event: ParseDocumentEvent) => {
            try {
                let document = libraryDocumentProvider.parseDocument(event);
                if (document) {
                    diagnosticsProvider.checkDocument(document);
                    changeCodeLensesEventEmitter.fire();
                }
            } catch (error) {
            }
        }),
        vscode.languages.registerCodeLensProvider(SLATE_MODE, codeLensProvider),
        onShowHover((event: HoverEvent) => hoverProvider.provideHover(event))
    );
    if (vscode.workspace.onDidDeleteFiles && vscode.workspace.onDidRenameFiles) {
        context.subscriptions.push(
            vscode.workspace.onDidDeleteFiles((event) => libraryDocumentProvider.invalidateUris(event.files.slice())),
            vscode.workspace.onDidRenameFiles((event) => libraryDocumentProvider.invalidateUris(event.files.map((file) => file.oldUri)))
        );
    }

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
        let templatesUri = vscode.workspace.workspaceFolders[0].uri.toString() + '/data/display/templates' + fileExtension;
        fileAccessor.readFile(templatesUri)
            .then((contents: FileContents) => {
                let onChange = () => {
                    try {
                        let templates = FmtReader.readString(contents.text, templatesUri, FmtDisplay.getMetaModel);
                        codeLensProvider.templates = templates;
                        hoverProvider.templates = templates;
                    } catch (error) {
                    }
                    changeCodeLensesEventEmitter.fire();
                };
                if (contents.addWatcher) {
                    let watcher = contents.addWatcher(onChange);
                    context.subscriptions.push({ dispose() { watcher.close(); } });
                }
                onChange();
            });
    }
}

export function deactivate(): void {
}
