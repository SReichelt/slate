import * as vscode from 'vscode';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtNotation from 'slate-shared/notation/meta';
import { FileAccessor } from 'slate-shared/data/fileAccessor';
import { fileExtension } from 'slate-shared/data/constants';
import { SLATE_MODE } from '../slate';
import { ParseDocumentEvent, ForgetDocumentEvent, HoverEvent } from '../events';
import { LibraryDocumentProvider } from './data';
import { SlateDiagnosticsProvider } from './providers/diagnosticsProvider';
import { SlateCodeLensProvider } from './providers/codeLensProvider';
import { SlateLogicHoverProvider } from './providers/logicHoverProvider';

export function activate(context: vscode.ExtensionContext, onDidParseDocument: vscode.Event<ParseDocumentEvent>, onDidForgetDocument: vscode.Event<ForgetDocumentEvent>, onShowHover: vscode.Event<HoverEvent>, fileAccessor: FileAccessor): void {
    const libraryDocumentProvider = new LibraryDocumentProvider(fileAccessor);
    const diagnosticsProvider = new SlateDiagnosticsProvider(libraryDocumentProvider);
    const changeCodeLensesEventEmitter = new vscode.EventEmitter<void>();
    context.subscriptions.push(changeCodeLensesEventEmitter);
    const codeLensProvider = new SlateCodeLensProvider(libraryDocumentProvider, changeCodeLensesEventEmitter.event);
    const hoverProvider = new SlateLogicHoverProvider(libraryDocumentProvider);

    context.subscriptions.push(
        libraryDocumentProvider,
        onDidParseDocument((event: ParseDocumentEvent) => {
            try {
                const document = libraryDocumentProvider.parseDocument(event);
                if (document) {
                    diagnosticsProvider.checkDocument(document);
                    changeCodeLensesEventEmitter.fire();
                }
            } catch (error) {
            }
        }),
        onDidForgetDocument((event: ForgetDocumentEvent) => libraryDocumentProvider.invalidateUris([event.document.uri])),
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
        const templatesUri = vscode.workspace.workspaceFolders[0].uri.toString() + '/data/notation/templates' + fileExtension;
        const templateFileReference = fileAccessor.openFile(templatesUri, false);
        const onChange = (newContents: string) => {
            try {
                const templates = FmtReader.readString(newContents, templatesUri, FmtNotation.getMetaModel);
                codeLensProvider.templates = templates;
                hoverProvider.templates = templates;
            } catch (error) {
            }
            changeCodeLensesEventEmitter.fire();
        };
        if (templateFileReference.watch) {
            const watcher = templateFileReference.watch(onChange);
            context.subscriptions.push({ dispose() { watcher.close(); } });
        }
        templateFileReference.read().then(onChange);
    }
}

export function deactivate(): void {
}
