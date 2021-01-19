import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { areUrisEqual, replaceDocumentText } from './utils';
import { FileAccessor, FileReference, WriteFileResult, FileWatcher } from 'slate-shared/data/fileAccessor';
import { StandardFileAccessor, StandardFileReference, StandardFileWatcher } from 'slate-shared/data/fileAccessorImpl';
import CachedPromise from 'slate-shared/data/cachedPromise';

interface WorkspaceFileAccessorState {
    watchers: StandardFileWatcher[];
    applyingEdit: boolean;
}

export class WorkspaceFileAccessor extends StandardFileAccessor implements FileAccessor {
    constructor(baseURI: string = '', private state: WorkspaceFileAccessorState = {watchers: [], applyingEdit: false}) {
        super(baseURI);
    }

    openFile(uri: string, createNew: boolean): FileReference {
        return new WorkspaceFileReference(this.state, this.baseURI + uri, createNew);
    }

    createChildAccessor(uri: string): FileAccessor {
        return new WorkspaceFileAccessor(this.baseURI + uri, this.state);
    }

    documentChanged(document: vscode.TextDocument): void {
        if (this.state.applyingEdit) {
            return;
        }
        const uri = document.uri.toString();
        for (const watcher of this.state.watchers) {
            if (watcher.uri === uri) {
                watcher.changed(document.getText());
            }
        }
    }
}

export class WorkspaceFileReference extends StandardFileReference implements FileReference {
    private vscodeUri: vscode.Uri;

    constructor(private state: WorkspaceFileAccessorState, uri: string, private createNew: boolean) {
        super(uri);
        this.vscodeUri = vscode.Uri.parse(uri);
    }

    read(): CachedPromise<string> {
        for (const document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, this.vscodeUri)) {
                return CachedPromise.resolve(document.getText());
            }
        }
        const resultPromise = vscode.workspace.fs.readFile(this.vscodeUri)
            .then((buffer: Uint8Array) => {
                const textDecoder = new TextDecoder;
                return textDecoder.decode(buffer);
            });
        return new CachedPromise(resultPromise);
    }

    write(contents: string, isPartOfGroup: boolean, prePublish: boolean = false): CachedPromise<WriteFileResult> {
        let resultPromise: Thenable<void>;
        if (this.createNew) {
            const workspaceEdit = new vscode.WorkspaceEdit;
            workspaceEdit.createFile(this.vscodeUri);
            workspaceEdit.insert(this.vscodeUri, new vscode.Position(0, 0), contents);
            resultPromise = this.applyEdit(workspaceEdit, false);
            this.createNew = false;
        } else {
            resultPromise = vscode.workspace.openTextDocument(this.vscodeUri)
                .then((document: vscode.TextDocument) => {
                    const textEdit = replaceDocumentText(document, contents);
                    if (textEdit) {
                        const workspaceEdit = new vscode.WorkspaceEdit;
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
        for (const document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, this.vscodeUri)) {
                if (document.isDirty) {
                    const resultPromise = vscode.workspace.fs.readFile(this.vscodeUri)
                        .then((buffer: Uint8Array) => {
                            const textDecoder = new TextDecoder;
                            const text = textDecoder.decode(buffer);
                            const textEdit = replaceDocumentText(document, text);
                            if (textEdit) {
                                const workspaceEdit = new vscode.WorkspaceEdit;
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
        return new StandardFileWatcher(this.uri, this.state.watchers, onChange);
    }

    view(openLocally: boolean): CachedPromise<void> {
        const resultPromise = vscode.window.showTextDocument(this.vscodeUri, {
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
            this.state.applyingEdit = true;
            finished = () => { this.state.applyingEdit = false; };
        }
        return vscode.workspace.applyEdit(workspaceEdit)
            .then(finished, finished);
    }
}
