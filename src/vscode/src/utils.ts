'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../shared/format/format';
import * as FmtReader from '../../shared/format/read';

export interface RangeInfo {
    object: Object;
    context?: Fmt.Context;
    metaDefinitions?: Fmt.MetaDefinitionFactory;
    range: vscode.Range;
    nameRange?: vscode.Range;
    linkRange?: vscode.Range;
    signatureRange?: vscode.Range;
}

export function convertLocation(location: FmtReader.Location): vscode.Position {
    return new vscode.Position(location.line, location.col);
}

export function convertRange(range: FmtReader.Range): vscode.Range {
    let start = convertLocation(range.start);
    let end = convertLocation(range.end);
    return new vscode.Range(start, end);
}

export function convertRangeInfo(info: FmtReader.ObjectRangeInfo): RangeInfo {
    return {
        object: info.object,
        context: info.context,
        metaDefinitions: info.metaDefinitions,
        range: convertRange(info.range),
        nameRange: info.nameRange ? convertRange(info.nameRange) : undefined,
        linkRange: info.linkRange ? convertRange(info.linkRange) : undefined,
        signatureRange: info.signatureRange ? convertRange(info.signatureRange) : undefined
    };
}

export function areUrisEqual(uri1: vscode.Uri, uri2: vscode.Uri): boolean {
    return uri1.toString() === uri2.toString();
}

export function matchesQuery(name: string, query: string): boolean {
    let pos = 0;
    for (let c of query) {
        pos = name.indexOf(c, pos);
        if (pos < 0) {
            return false;
        }
    }
    return true;
}
