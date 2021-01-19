import * as vscode from 'vscode';
import * as fs from 'fs';  // TODO replace with vscode.workspace.fs / WorkspaceFileAccessor
import { areUrisEqual } from '../utils';

let lastReadFileName: string | undefined = undefined;
let lastReadFileContents: string | undefined = undefined;

export function readRangeRaw(uri: vscode.Uri, range?: vscode.Range, sourceDocument?: vscode.TextDocument): string {
    if (sourceDocument && areUrisEqual(uri, sourceDocument.uri)) {
        return sourceDocument.getText(range);
    }
    for (const document of vscode.workspace.textDocuments) {
        if (areUrisEqual(uri, document.uri)) {
            return document.getText(range);
        }
    }
    const fileName = uri.fsPath;
    if (lastReadFileName !== fileName) {
        lastReadFileName = undefined;
        lastReadFileContents = fs.readFileSync(fileName, 'utf8');
        lastReadFileName = fileName;
    }
    const contents = lastReadFileContents!;
    if (range) {
        let position = 0;
        let line = 0;
        for (; line < range.start.line; line++) {
            position = contents.indexOf('\n', position);
            if (position < 0) {
                break;
            }
            position++;
        }
        if (position >= 0) {
            const start = position + range.start.character;
            for (; line < range.end.line; line++) {
                position = contents.indexOf('\n', position);
                if (position < 0) {
                    break;
                }
                position++;
            }
            if (position >= 0) {
                const end = position + range.end.character;
                return contents.substring(start, end);
            }
        }
        return '';
    } else {
        return contents;
    }
}

export function readRange(uri: vscode.Uri, range?: vscode.Range, singleLine: boolean = false, sourceDocument?: vscode.TextDocument): string | undefined {
    let raw: string;
    try {
        raw = readRangeRaw(uri, range, sourceDocument);
    } catch (error) {
        return undefined;
    }
    if (singleLine) {
        let result = '';
        let carry = '';
        for (let c of raw) {
            if (c === '\r' || c === '\n' || c === '\t') {
                c = ' ';
            }
            if (c === ' ' && (carry === ' ' || carry === '(' || carry === '[' || carry === '{')) {
                continue;
            }
            if (!(carry === ' ' && (c === ')' || c === ']' || c === '}' || c === ','))) {
                result += carry;
            }
            carry = c;
        }
        result += carry;
        return result;
    } else if (range) {
        let result = '';
        let spacesToSkip = 0;
        for (const c of raw) {
            if (c === '\n') {
                spacesToSkip = range.start.character;
            } else if (spacesToSkip) {
                if (c === ' ' || c === '\t') {
                    spacesToSkip--;
                    continue;
                } else {
                    spacesToSkip = 0;
                }
            }
            result += c;
        }
        return result;
    } else {
        return raw;
    }
}
