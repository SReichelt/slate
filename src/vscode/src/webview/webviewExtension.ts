import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { languageId } from '../slate';
import * as Embedding from 'slate-env-web-api/embedding';
import { FileAccessor, FileReference } from 'slate-shared/data/fileAccessor';

let currentWorkspaceFolder: vscode.WorkspaceFolder | undefined = undefined;
let panel: vscode.WebviewPanel | undefined = undefined;
let startCheckTimer: NodeJS.Timeout | undefined = undefined;

function getBaseURI(workspaceFolder: vscode.WorkspaceFolder): string {
    let result = workspaceFolder.uri.toString();
    if (!result.endsWith('/')) {
        result += '/';
    }
    return result;
}

function onMessageReceived(webview: vscode.Webview, requestMessage: Embedding.RequestMessage, fileAccessor: FileAccessor): any {
    const postResponseMessage = (command: Embedding.ResponseCommand, text?: string): any => {
        if (requestMessage.index !== undefined && panel && panel.webview === webview) {
            const responseMessage: Embedding.ResponseMessage = {
                command: command,
                index: requestMessage.index,
                uri: requestMessage.uri,
                text: text
            };
            return webview.postMessage(responseMessage);
        }
        return undefined;
    };
    const postResponse = (text?: string) => postResponseMessage('RESPONSE', text);
    const postError = (message?: string) => postResponseMessage('ERROR', message);
    let fileReference: FileReference | undefined = undefined;
    if (requestMessage.uri) {
        const baseURI = getBaseURI(currentWorkspaceFolder!);
        fileReference = fileAccessor.openFile(baseURI + requestMessage.uri, requestMessage.command === 'CREATE');
        if (fileReference.watch) {
            const watcher = fileReference.watch((newContents: string) => {
                if (panel && panel.webview === webview) {
                    const updateMessage: Embedding.ResponseMessage = {
                        command: 'UPDATE',
                        uri: requestMessage.uri,
                        text: newContents
                    };
                    webview.postMessage(updateMessage);
                } else {
                    watcher.close();
                }
            });
        }
    }
    switch (requestMessage.command) {
    case 'GET':
        return fileReference?.read()
            .then((contents: string) => postResponse(contents))
            .catch((error) => postError(error.message));
    case 'CREATE':
    case 'PUT':
        if (fileReference?.write && requestMessage.text) {
            return fileReference.write(requestMessage.text, false)
                .then(() => postResponse())
                .catch((error) => postError(error.message));
        } else {
            return postError('No write access');
        }
    case 'EDIT':
        if (fileReference?.prePublish && requestMessage.text) {
            return fileReference.prePublish(requestMessage.text, false)
                .then(() => postResponse())
                .catch((error) => postError(error.message));
        } else {
            return postError('No write access');
        }
    case 'REVERT':
        if (fileReference?.unPrePublish) {
            return fileReference.unPrePublish()
                .then(() => postResponse())
                .catch((error) => postError(error.message));
        } else {
            return postError('Cannot revert edits');
        }
    case 'SELECT':
        if (fileReference?.view) {
            return fileReference.view(true)
                .then(() => postResponse())
                .catch((error) => postError(error.message));
        } else {
            return postResponse();
        }
    case 'TITLE':
        if (panel && requestMessage.text) {
            panel.title = requestMessage.text;
        }
        return postResponse();
    default:
        return postError('Unsupported command');
    }
}

function getEditorUri(editor: vscode.TextEditor | undefined): string | undefined {
    if (editor && editor.document.languageId === languageId) {
        const documentWorkspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (documentWorkspaceFolder && documentWorkspaceFolder === currentWorkspaceFolder) {
            const baseURI = getBaseURI(documentWorkspaceFolder);
            const uri = editor.document.uri.toString();
            if (uri.startsWith(baseURI)) {
                return uri.substring(baseURI.length);
            }
        }
    }
    return undefined;
}

function selectEditorUri(editor: vscode.TextEditor | undefined): Thenable<boolean> | undefined {
    if (panel) {
        const message: Embedding.ResponseMessage = {
            command: 'SELECT',
            uri: getEditorUri(editor)
        };
        return panel.webview.postMessage(message);
    }
    return undefined;
}

function showGUI(context: vscode.ExtensionContext, fileAccessor: FileAccessor): void {
    if (panel) {
        panel.reveal(vscode.ViewColumn.Two);
    } else {
        const initiallyActiveEditor = vscode.window.activeTextEditor;
        if (initiallyActiveEditor) {
            currentWorkspaceFolder = vscode.workspace.getWorkspaceFolder(initiallyActiveEditor.document.uri);
        }
        if (!currentWorkspaceFolder) {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
                currentWorkspaceFolder = vscode.workspace.workspaceFolders[0];
            } else {
                return;
            }
        }

        const webViewPath = path.join(context.extensionPath, 'webview');
        const webViewURI = vscode.Uri.file(webViewPath + '/');
        const indexTemplateFileName = path.join(webViewPath, 'index.ejs');
        if (!fs.existsSync(indexTemplateFileName)) {
            return;
        }

        panel = vscode.window.createWebviewPanel(
            'slate',
            'Slate',
            {
                viewColumn: vscode.ViewColumn.Two,
                preserveFocus: true
            },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [webViewURI]
            }
        );

        const onDidDispose = () => {
            panel = undefined;
            if (startCheckTimer) {
                clearTimeout(startCheckTimer);
                startCheckTimer = undefined;
            }
        };
        panel.onDidDispose(onDidDispose, context.subscriptions);

        const webview = panel.webview;
        let initialMessageReceived = false;
        const onDidReceiveMessage = (requestMessage: Embedding.RequestMessage) => {
            if (!initialMessageReceived) {
                if (startCheckTimer) {
                    clearTimeout(startCheckTimer);
                    startCheckTimer = undefined;
                }
                selectEditorUri(initiallyActiveEditor);
                initialMessageReceived = true;
            }
            return onMessageReceived(webview, requestMessage, fileAccessor);
        };
        webview.onDidReceiveMessage(onDidReceiveMessage, undefined, context.subscriptions);

        // Work around https://github.com/microsoft/vscode/issues/89038.
        const checkSuccessfulStart = () => {
            if (panel && !initialMessageReceived) {
                panel.dispose();
                panel = undefined;
                showGUI(context, fileAccessor);
            }
        };

        const baseURL = webview.asWebviewUri(webViewURI);

        const indexTemplatePromise = ejs.renderFile(indexTemplateFileName, {
            'isStatic': false,
            'isEmbedded': true,
            'title': 'Slate',
            'baseURL': baseURL.toString(),
            'cspSource': webview.cspSource
        }, { rmWhitespace: true });
        indexTemplatePromise.then((indexTemplate: string) => {
            if (panel) {
                webview.html = indexTemplate;
                startCheckTimer = setTimeout(checkSuccessfulStart, 5000);
            }
        });
    }
}

export function activate(context: vscode.ExtensionContext, fileAccessor: FileAccessor): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('slate.showGUI', () => showGUI(context, fileAccessor))
    );

    showGUI(context, fileAccessor);

    const onActiveEditorChanged = (editor: vscode.TextEditor | undefined): any => {
        if (editor && editor.document.languageId === languageId) {
            return selectEditorUri(editor);
        }
    };
    vscode.window.onDidChangeActiveTextEditor(onActiveEditorChanged, undefined, context.subscriptions);
}

export function deactivate(): void {
    if (panel) {
        panel.dispose();
    }
}
