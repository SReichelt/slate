import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { areUrisEqual, replaceDocumentText } from './utils';
import { FileAccessor, FileReference, WriteFileResult, FileWatcher } from '../../shared/data/fileAccessor';
import { StandardFileReference, StandardFileWatcher } from '../../shared/data/fileAccessorImpl';
import CachedPromise from '../../shared/data/cachedPromise';

export class WorkspaceFileAccessor implements FileAccessor {
    watchers: StandardFileWatcher[] = [];
    applyingEdit = false;

    openFile(uri: string, createNew: boolean): FileReference {
        return new WorkspaceFileReference(this, uri, createNew);
    }

    documentChanged(document: vscode.TextDocument): void {
        if (this.applyingEdit) {
            return;
        }
        let uri = document.uri.toString();
        for (let watcher of this.watchers) {
            if (watcher.uri === uri) {
                watcher.changed(document.getText());
            }
        }
    }
}

export class WorkspaceFileReference extends StandardFileReference implements FileReference {
    private vscodeUri: vscode.Uri;

    constructor(private fileAccessor: WorkspaceFileAccessor, uri: string, private createNew: boolean) {
        super(uri);
        this.vscodeUri = vscode.Uri.parse(uri);
    }

    read(): CachedPromise<string> {
        for (let document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, this.vscodeUri)) {
                return CachedPromise.resolve(document.getText());
            }
        }
        let resultPromise = vscode.workspace.fs.readFile(this.vscodeUri)
            .then((buffer: Uint8Array) => {
                let textDecoder = new TextDecoder;
                return textDecoder.decode(buffer);
            });
        return new CachedPromise(resultPromise);
    }

    write(contents: string, isPartOfGroup: boolean, prePublish: boolean = false): CachedPromise<WriteFileResult> {
        let resultPromise: Thenable<void>;
        if (this.createNew) {
            let workspaceEdit = new vscode.WorkspaceEdit;
            workspaceEdit.createFile(this.vscodeUri);
            workspaceEdit.insert(this.vscodeUri, new vscode.Position(0, 0), contents);
            resultPromise = this.applyEdit(workspaceEdit, false);
            this.createNew = false;
        } else {
            resultPromise = vscode.workspace.openTextDocument(this.vscodeUri)
                .then((document: vscode.TextDocument) => {
                    let textEdit = replaceDocumentText(document, contents);
                    if (textEdit) {
                        let workspaceEdit = new vscode.WorkspaceEdit;
                        workspaceEdit.set(this.vscodeUri, [textEdit]);
                        return this.applyEdit(workspaceEdit, false);
                    }
                    return undefined;
                });
        }
        if (!prePublish) {
            resultPromise = resultPromise.then(() => {
                return vscode.workspace.openTextDocument(this.vscodeUri)
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

    prePublish(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
        return this.write(contents, isPartOfGroup, true);
    }

    unPrePublish(): CachedPromise<void> {
        for (let document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, this.vscodeUri)) {
                if (document.isDirty) {
                    let resultPromise = vscode.workspace.fs.readFile(this.vscodeUri)
                        .then((buffer: Uint8Array) => {
                            let textDecoder = new TextDecoder;
                            let text = textDecoder.decode(buffer);
                            let textEdit = replaceDocumentText(document, text);
                            if (textEdit) {
                                let workspaceEdit = new vscode.WorkspaceEdit;
                                workspaceEdit.set(this.vscodeUri, [textEdit]);
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

    watch(onChange: (newContents: string) => void): FileWatcher {
        return new StandardFileWatcher(this.uri, this.fileAccessor.watchers, onChange);
    }

    view(openLocally: boolean): CachedPromise<void> {
        let resultPromise = vscode.window.showTextDocument(this.vscodeUri, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
            preview: true
        });
        return new CachedPromise(resultPromise.then(() => {}));
    }

    private applyEdit(workspaceEdit: vscode.WorkspaceEdit, notifyWatchers: boolean): Thenable<void> {
        let finished: () => void;
        if (notifyWatchers) {
            finished = () => {};
        } else {
            this.fileAccessor.applyingEdit = true;
            finished = () => { this.fileAccessor.applyingEdit = false; };
        }
        return vscode.workspace.applyEdit(workspaceEdit)
            .then(finished, finished);
    }
}
