'use strict';

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { areUrisEqual } from './utils';
import { FileAccessor, FileContents, WriteFileResult } from '../../shared/data/fileAccessor';
import { StandardWatchableFileContents, StandardFileWatcher } from '../../shared/data/fileAccessorImpl';
import CachedPromise from '../../shared/data/cachedPromise';

export class WorkspaceFileAccessor implements FileAccessor {
    private watchers: StandardFileWatcher[] = [];

    readFile(uri: string): CachedPromise<FileContents> {
        let vscodeUri = vscode.Uri.parse(uri);
        for (let document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, vscodeUri)) {
                let contents = new WorkspaceFileContents(vscodeUri, document.getText(), this.watchers);
                return CachedPromise.resolve(contents);
            }
        }
        let resultPromise = vscode.workspace.fs.readFile(vscodeUri)
            .then((buffer: Uint8Array) => {
                let textDecoder = new TextDecoder;
                let text = textDecoder.decode(buffer);
                return new WorkspaceFileContents(vscodeUri, text, this.watchers);
            });
        return new CachedPromise(resultPromise);
    }

    writeFile(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean, prePublish: boolean = false): CachedPromise<WriteFileResult> {
        let vscodeUri = vscode.Uri.parse(uri);
        let resultPromise: Thenable<void>;
        if (createNew) {
            let workspaceEdit = new vscode.WorkspaceEdit;
            workspaceEdit.createFile(vscodeUri);
            workspaceEdit.insert(vscodeUri, new vscode.Position(0, 0), text);
            resultPromise = vscode.workspace.applyEdit(workspaceEdit)
                .then(() => {});
        } else {
            resultPromise = vscode.workspace.openTextDocument(vscodeUri)
                .then((document: vscode.TextDocument) => {
                    let currentText = document.getText();
                    if (text !== currentText) {
                        let start = 0;
                        for (; start < text.length && start < currentText.length; start++) {
                            if (text.charAt(start) !== currentText.charAt(start)) {
                                break;
                            }
                        }
                        let oldEnd = currentText.length;
                        let newEnd = text.length;
                        for (; oldEnd > start && newEnd > start; oldEnd--, newEnd--) {
                            if (text.charAt(newEnd - 1) !== currentText.charAt(oldEnd - 1)) {
                                break;
                            }
                        }
                        let workspaceEdit = new vscode.WorkspaceEdit;
                        let range = new vscode.Range(
                            document.positionAt(start),
                            document.positionAt(oldEnd)
                        );
                        workspaceEdit.replace(vscodeUri, range, text.substring(start, newEnd));
                        return vscode.workspace.applyEdit(workspaceEdit)
                            .then(() => {});
                    }
                    return undefined;
                });
        }
        if (!prePublish) {
            resultPromise = resultPromise.then(() => {
                return vscode.workspace.openTextDocument(vscodeUri)
                    .then((document: vscode.TextDocument) => {
                        document.save();
                        return vscode.window.showTextDocument(document, {
                            viewColumn: vscode.ViewColumn.One,
                            preserveFocus: true
                        });
                    })
                    .then(() => {});
            });
        }
        return new CachedPromise(resultPromise.then(() => ({})));
    }

    prePublishFile(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
        return this.writeFile(uri, text, createNew, isPartOfGroup, true);
    }

    unPrePublishFile(uri: string): CachedPromise<void> {
        let vscodeUri = vscode.Uri.parse(uri);
        for (let document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, vscodeUri)) {
                if (document.isDirty) {
                    let currentText = document.getText();
                    let resultPromise = vscode.workspace.fs.readFile(vscodeUri)
                        .then((buffer: Uint8Array) => {
                            let textDecoder = new TextDecoder;
                            let text = textDecoder.decode(buffer);
                            if (text !== currentText) {
                                let workspaceEdit = new vscode.WorkspaceEdit;
                                let range = new vscode.Range(
                                    document.positionAt(0),
                                    document.positionAt(currentText.length)
                                );
                                workspaceEdit.replace(vscodeUri, range, text);
                                return vscode.workspace.applyEdit(workspaceEdit)
                                    .then(() => {});
                            }
                            return undefined;
                        });
                    return new CachedPromise(resultPromise);
                }
                break;
            }
        }
        return CachedPromise.resolve();
    }

    openFile(uri: string, openLocally: boolean): CachedPromise<void> {
        let vscodeUri = vscode.Uri.parse(uri);
        let resultPromise = vscode.window.showTextDocument(vscodeUri, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
            preview: true
        });
        return new CachedPromise(resultPromise.then(() => {}));
    }

    documentChanged(document: vscode.TextDocument): void {
        for (let watcher of this.watchers) {
            if (areUrisEqual((watcher.contents as WorkspaceFileContents).uri, document.uri)) {
                watcher.contents.text = document.getText();
                watcher.changed();
            }
        }
    }
}

class WorkspaceFileContents extends StandardWatchableFileContents {
    constructor(public uri: vscode.Uri, text: string, watchers: StandardFileWatcher[]) {
        super(text, watchers);
    }
}
