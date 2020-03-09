'use strict';

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { areUrisEqual, replaceDocumentText } from './utils';
import { FileAccessor, FileContents, WriteFileResult } from '../../shared/data/fileAccessor';
import { StandardWatchableFileContents, StandardFileWatcher } from '../../shared/data/fileAccessorImpl';
import CachedPromise from '../../shared/data/cachedPromise';

export class WorkspaceFileAccessor implements FileAccessor {
    private watchers: StandardFileWatcher[] = [];
    private applyingEdit = false;

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
            resultPromise = this.applyEdit(workspaceEdit, false);
        } else {
            resultPromise = vscode.workspace.openTextDocument(vscodeUri)
                .then((document: vscode.TextDocument) => {
                    let textEdit = replaceDocumentText(document, text);
                    if (textEdit) {
                        let workspaceEdit = new vscode.WorkspaceEdit;
                        workspaceEdit.set(vscodeUri, [textEdit]);
                        return this.applyEdit(workspaceEdit, false);
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
                    let resultPromise = vscode.workspace.fs.readFile(vscodeUri)
                        .then((buffer: Uint8Array) => {
                            let textDecoder = new TextDecoder;
                            let text = textDecoder.decode(buffer);
                            let textEdit = replaceDocumentText(document, text);
                            if (textEdit) {
                                let workspaceEdit = new vscode.WorkspaceEdit;
                                workspaceEdit.set(vscodeUri, [textEdit]);
                                return this.applyEdit(workspaceEdit, true);
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
        if (this.applyingEdit) {
            return;
        }
        for (let watcher of this.watchers) {
            if (areUrisEqual((watcher.contents as WorkspaceFileContents).uri, document.uri)) {
                watcher.contents.text = document.getText();
                watcher.changed();
            }
        }
    }

    private applyEdit(workspaceEdit: vscode.WorkspaceEdit, notifyWatchers: boolean): Thenable<void> {
        let finished: () => void;
        if (notifyWatchers) {
            finished = () => {};
        } else {
            this.applyingEdit = true;
            finished = () => { this.applyingEdit = false; };
        }
        return vscode.workspace.applyEdit(workspaceEdit)
            .then(finished, finished);
    }
}

class WorkspaceFileContents extends StandardWatchableFileContents {
    constructor(public uri: vscode.Uri, text: string, watchers: StandardFileWatcher[]) {
        super(text, watchers);
    }
}
