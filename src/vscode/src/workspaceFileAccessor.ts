'use strict';

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { areUrisEqual, toCachedPromise } from './utils';
import { FileAccessor, FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WorkspaceFileAccessor implements FileAccessor {
    private registeredContents: WorkspaceFileContents[] = [];

    readFile(uri: string): CachedPromise<FileContents> {
        let vscodeUri = vscode.Uri.parse(uri);
        for (let document of vscode.workspace.textDocuments) {
            if (areUrisEqual(document.uri, vscodeUri)) {
                let contents = new WorkspaceFileContents(this.registeredContents, vscodeUri, document.getText());
                this.registeredContents.push(contents);
                return CachedPromise.resolve(contents);
            }
        }
        return toCachedPromise(vscode.workspace.fs.readFile(vscodeUri))
            .then((buffer: Uint8Array) => {
                let textDecoder = new TextDecoder;
                let text = textDecoder.decode(buffer);
                let contents = new WorkspaceFileContents(this.registeredContents, vscodeUri, text);
                this.registeredContents.push(contents);
                return contents;
            });
    }

    documentChanged(document: vscode.TextDocument): void {
        for (let contents of this.registeredContents) {
            if (areUrisEqual(contents.uri, document.uri) && contents.onChange) {
                contents.onChange();
            }
        }
    }
}

class WorkspaceFileContents implements FileContents {
    public onChange?: () => void;

    constructor(private registeredContents: WorkspaceFileContents[], public uri: vscode.Uri, public text: string) {}

    close(): void {
        for (let i = 0; i < this.registeredContents.length; i++) {
            if (this.registeredContents[i] === this) {
                this.registeredContents.splice(i, 1);
                break;
            }
        }
    }
}
