'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { languageId } from '../slate';
import * as Embedding from '../../../shared/data/embedding';
import { FileAccessor, FileContents, FileWatcher } from '../../../shared/data/fileAccessor';

let workspaceFolder: vscode.WorkspaceFolder | undefined = undefined;
let panel: vscode.WebviewPanel | undefined = undefined;

function getBaseURI(workspaceFolder: vscode.WorkspaceFolder): string {
    return workspaceFolder.uri.toString() + '/data/';
}

function onMessageReceived(webview: vscode.Webview, requestMessage: Embedding.RequestMessage, fileAccessor: FileAccessor): any {
    let postResponseMessage = (command: Embedding.ResponseCommand, text?: string): any => {
        if (requestMessage.index !== undefined && panel && panel.webview === webview) {
            let responseMessage: Embedding.ResponseMessage = {
                command: command,
                index: requestMessage.index,
                uri: requestMessage.uri,
                text: text
            };
            return webview.postMessage(responseMessage);
        }
        return undefined;
    };
    let postResponse = (text?: string) => postResponseMessage('RESPONSE', text);
    let postError = (message?: string) => postResponseMessage('ERROR', message);
    let baseURI = getBaseURI(workspaceFolder!);
    let fileURI = baseURI + (requestMessage.uri ?? '');
    switch (requestMessage.command) {
    case 'GET':
        return fileAccessor.readFile(fileURI)
            .then((contents: FileContents) => {
                if (contents.addWatcher) {
                    contents.addWatcher((watcher: FileWatcher) => {
                        if (panel && panel.webview === webview) {
                            let updateMessage: Embedding.ResponseMessage = {
                                command: 'UPDATE',
                                uri: requestMessage.uri,
                                text: contents.text
                            };
                            webview.postMessage(updateMessage);
                        } else {
                            watcher.close();
                        }
                    });
                }
                return postResponse(contents.text);
            })
            .catch((error) => postError(error.message));
    case 'CREATE':
    case 'PUT':
        if (fileAccessor.writeFile && requestMessage.text) {
            let createNew = (requestMessage.command === 'CREATE');
            return fileAccessor.writeFile(fileURI, requestMessage.text, createNew, false)
                .then(() => postResponse())
                .catch((error) => postError(error.message));
        } else {
            return postError('No write access');
        }
    case 'EDIT':
        if (fileAccessor.prePublishFile && requestMessage.text) {
            return fileAccessor.prePublishFile(fileURI, requestMessage.text, false, false)
                .then(() => postResponse())
                .catch((error) => postError(error.message));
        } else {
            return postError('No write access');
        }
    case 'REVERT':
        if (fileAccessor.unPrePublishFile) {
            return fileAccessor.unPrePublishFile(fileURI)
                .then(() => postResponse())
                .catch((error) => postError(error.message));
        } else {
            return postError('Cannot revert edits');
        }
    case 'SELECT':
        if (requestMessage.command === 'SELECT' && fileAccessor.openFile) {
            return fileAccessor.openFile(fileURI, true)
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
        let documentWorkspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (documentWorkspaceFolder && documentWorkspaceFolder === workspaceFolder) {
            let baseURI = getBaseURI(documentWorkspaceFolder);
            let uri = editor.document.uri.toString();
            if (uri.startsWith(baseURI)) {
                return uri.substring(baseURI.length);
            }
        }
    }
    return undefined;
}

function onActiveEditorChanged(editor: vscode.TextEditor | undefined): any {
    if (panel) {
        let message: Embedding.ResponseMessage = {
            command: 'SELECT',
            uri: getEditorUri(editor)
        };
        return panel.webview.postMessage(message);
    }
}

function showGraphicalEditor(context: vscode.ExtensionContext, fileAccessor: FileAccessor): void {
    if (panel) {
        panel.reveal(vscode.ViewColumn.Two);
    } else {
        let initiallyActiveEditor = vscode.window.activeTextEditor;
        if (initiallyActiveEditor) {
            workspaceFolder = vscode.workspace.getWorkspaceFolder(initiallyActiveEditor.document.uri);
        }
        if (!workspaceFolder) {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
                workspaceFolder = vscode.workspace.workspaceFolders[0];
            } else {
                return;
            }
        }

        let webViewPath = path.join(context.extensionPath, 'webview');
        let webViewURI = vscode.Uri.file(webViewPath + '/');
        let indexTemplateFileName = path.join(webViewPath, 'public', 'embedded.ejs');
        if (!fs.existsSync(indexTemplateFileName)) {
            return;
        }

        panel = vscode.window.createWebviewPanel(
            'slate',
            'Slate',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [webViewURI]
            }
        );
        panel.onDidDispose(() => (panel = undefined), context.subscriptions);

        let webview = panel.webview;
        let reportInitiallyActiveEditor = true;
        let onDidReceiveMessage = (requestMessage: Embedding.RequestMessage) => {
            if (reportInitiallyActiveEditor) {
                onActiveEditorChanged(initiallyActiveEditor);
                reportInitiallyActiveEditor = false;
            }
            return onMessageReceived(webview, requestMessage, fileAccessor);
        };
        webview.onDidReceiveMessage(onDidReceiveMessage, undefined, context.subscriptions);

        let baseURL = webview.asWebviewUri(webViewURI);

        let indexTemplatePromise = ejs.renderFile(indexTemplateFileName, {
            'baseURL': baseURL.toString(),
            'cspSource': webview.cspSource
        });
        indexTemplatePromise.then((indexTemplate: string) => {
            if (panel) {
                webview.html = indexTemplate;
            }
        });
    }
}

export function activate(context: vscode.ExtensionContext, fileAccessor: FileAccessor): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('slate.showGraphicalEditor', () => showGraphicalEditor(context, fileAccessor))
    );

    showGraphicalEditor(context, fileAccessor);

    vscode.window.onDidChangeActiveTextEditor(onActiveEditorChanged, undefined, context.subscriptions);
}

export function deactivate(): void {
    if (panel) {
        panel.dispose();
    }
}
