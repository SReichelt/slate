'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as util from 'util';
import { FileAccessor, FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WorkspaceFileAccessor implements FileAccessor {
    private registeredContents: WorkspaceFileContents[] = [];

    readFile(uri: string): CachedPromise<FileContents> {
        for (let document of vscode.workspace.textDocuments) {
            if (document.uri.toString() === uri) {
                let contents = new WorkspaceFileContents(this.registeredContents, uri, document.getText());
                this.registeredContents.push(contents);
                return CachedPromise.resolve(contents);
            }
        }
        let vscodeUri = vscode.Uri.parse(uri);
        let contents = util.promisify(fs.readFile)(vscodeUri.fsPath, 'utf8')
            .then((text) => {
                let contents = new WorkspaceFileContents(this.registeredContents, uri, text);
                this.registeredContents.push(contents);
                return contents;
            });
        return new CachedPromise(contents);
    }

    fileChanged(uri: string): void {
        for (let contents of this.registeredContents) {
            if (contents.uri === uri && contents.onChange) {
                contents.onChange();
            }
        }
    }
}

class WorkspaceFileContents implements FileContents {
    public onChange?: () => void;

    constructor(private registeredContents: WorkspaceFileContents[], public uri: string, public text: string) {}

    close(): void {
        for (let i = 0; i < this.registeredContents.length; i++) {
            if (this.registeredContents[i] === this) {
                this.registeredContents.splice(i, 1);
                break;
            }
        }
    }
}
