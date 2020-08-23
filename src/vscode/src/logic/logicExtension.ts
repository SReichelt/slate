import * as vscode from 'vscode';
import * as FmtReader from '../../../shared/format/read';
import * as FmtNotation from '../../../shared/notation/meta';
import { FileAccessor } from '../../../shared/data/fileAccessor';
import { fileExtension } from '../../../shared/data/constants';
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
        vscode.workspace.onDidCloseTextDocument((document) => libraryDocumentProvider.invalidateUris([document.uri])),
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
        let templatesUri = vscode.workspace.workspaceFolders[0].uri.toString() + '/data/notation/templates' + fileExtension;
        let templateFileReference = fileAccessor.openFile(templatesUri, false);
        let onChange = (newContents: string) => {
            try {
                let templates = FmtReader.readString(newContents, templatesUri, FmtNotation.getMetaModel);
                codeLensProvider.templates = templates;
                hoverProvider.templates = templates;
            } catch (error) {
            }
            changeCodeLensesEventEmitter.fire();
        };
        if (templateFileReference.watch) {
            let watcher = templateFileReference.watch(onChange);
            context.subscriptions.push({ dispose() { watcher.close(); } });
        }
        templateFileReference.read().then(onChange);
    }
}

export function deactivate(): void {
}
