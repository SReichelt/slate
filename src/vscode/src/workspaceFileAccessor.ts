'use strict';

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { areUrisEqual } from './utils';
import { FileAccessor, FileContents, FileWatcher } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WorkspaceFileAccessor implements FileAccessor {
    private watchers: WorkspaceFileWatcher[] = [];

    readFile(uri: string): CachedPromise<FileContents> {
        let vscodeUri = vscode.Uri.parse(uri);
        for (let document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, vscodeUri)) {
                let contents = new WorkspaceFileContents(this.watchers, vscodeUri, document.getText());
                return CachedPromise.resolve(contents);
            }
        }
        return new CachedPromise(vscode.workspace.fs.readFile(vscodeUri))
            .then((buffer: Uint8Array) => {
                let textDecoder = new TextDecoder;
                let text = textDecoder.decode(buffer);
                return new WorkspaceFileContents(this.watchers, vscodeUri, text);
            });
    }

    documentChanged(document: vscode.TextDocument): void {
        for (let watcher of this.watchers) {
            if (areUrisEqual(watcher.contents.uri, document.uri)) {
                watcher.contents.text = document.getText();
                watcher.changed();
            }
        }
    }
}

class WorkspaceFileContents implements FileContents {
    constructor(public watchers: WorkspaceFileWatcher[], public uri: vscode.Uri, public text: string) {}

    addWatcher(onChange: (watcher: FileWatcher) => void): FileWatcher {
        return new WorkspaceFileWatcher(this, onChange);
    }
}

class WorkspaceFileWatcher implements FileWatcher {
    constructor(public contents: WorkspaceFileContents, private onChange: (watcher: FileWatcher) => void) {
        this.contents.watchers.push(this);
    }

    close(): void {
        let watchers = this.contents.watchers;
        for (let i = 0; i < watchers.length; i++) {
            if (watchers[i] === this) {
                watchers.splice(i, 1);
                break;
            }
        }
    }

    changed(): void {
        this.onChange(this);
    }
}
