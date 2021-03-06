import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import * as Ctx from 'slate-shared/format/context';
import * as FmtReader from 'slate-shared/format/read';

export interface RangeInfo {
    object: Object;
    context?: Ctx.Context;
    metaDefinitions?: Fmt.MetaDefinitionFactory;
    range: vscode.Range;
    nameRange?: vscode.Range;
    linkRange?: vscode.Range;
    signatureRange?: vscode.Range;
    pathAlias?: Fmt.PathAlias;
}

export function convertLocation(location: FmtReader.Location): vscode.Position {
    return new vscode.Position(location.line, location.col);
}

export function convertRange(range: FmtReader.Range): vscode.Range {
    const start = convertLocation(range.start);
    const end = convertLocation(range.end);
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
        signatureRange: info.signatureRange ? convertRange(info.signatureRange) : undefined,
        pathAlias: info.pathAlias
    };
}

export class RangeHandler implements FmtReader.RangeHandler {
    rangeList: RangeInfo[] = [];
    rangeMap: Map<Object, RangeInfo> = new Map<Object, RangeInfo>();
    pathAliases: Fmt.PathAlias[] = [];

    reportRange(info: FmtReader.ObjectRangeInfo): void {
        const rangeInfo = convertRangeInfo(info);
        this.rangeList.push(rangeInfo);
        this.rangeMap.set(info.object, rangeInfo);
        if (info.object instanceof Fmt.PathAlias) {
            this.pathAliases.push(info.object);
        }
    }

    reportConversion(raw: Fmt.Expression, converted: Fmt.ObjectContents): void {
        if (raw instanceof Fmt.CompoundExpression) {
            const rangeInfo = this.rangeMap.get(raw);
            if (rangeInfo) {
                this.rangeMap.set(converted, rangeInfo);
            }
        }
    }
}

export function areUrisEqual(uri1: vscode.Uri, uri2: vscode.Uri): boolean {
    return uri1.toString() === uri2.toString();
}

export interface RenamedUri {
    oldUri: vscode.Uri;
    newUri: vscode.Uri;
}

export function changeParentUri(renamedParentUri: RenamedUri, childUri: vscode.Uri): vscode.Uri | undefined {
    const oldParentUriStr = renamedParentUri.oldUri.toString();
    const childUriStr = childUri.toString();
    if (childUriStr.startsWith(oldParentUriStr)) {
        if (childUriStr.length === oldParentUriStr.length) {
            return renamedParentUri.newUri;
        }
        if (childUriStr.charAt(oldParentUriStr.length) === '/') {
            if (renamedParentUri.newUri === renamedParentUri.oldUri) {
                return childUri;
            } else {
                return vscode.Uri.parse(renamedParentUri.newUri.toString() + childUriStr.substring(oldParentUriStr.length));
            }
        }
    }
    return undefined;
}

export function isEqualOrParentUriOf(parentUri: vscode.Uri, childUri: vscode.Uri): boolean {
    return changeParentUri({oldUri: parentUri, newUri: parentUri}, childUri) !== undefined;
}

export function deleteUrisFromDiagnosticCollection(uris: vscode.Uri[], diagnosticCollection: vscode.DiagnosticCollection): void {
    const invalidatedDiagnosticUris: vscode.Uri[] = [];
    diagnosticCollection.forEach((diagnosticUri: vscode.Uri) => {
        for (const uri of uris) {
            if (isEqualOrParentUriOf(uri, diagnosticUri)) {
                invalidatedDiagnosticUris.push(diagnosticUri);
                break;
            }
        }
    });
    for (const uri of invalidatedDiagnosticUris) {
        diagnosticCollection.delete(uri);
    }
}

export function matchesQuery(name: string, query: string): boolean {
    let pos = 0;
    for (const c of query) {
        pos = name.indexOf(c, pos);
        if (pos < 0) {
            return false;
        }
    }
    return true;
}

export function replaceDocumentText(document: vscode.TextDocument, newText: string): vscode.TextEdit | undefined {
    const oldText = document.getText();
    if (newText === oldText) {
        return undefined;
    }
    let start = 0;
    for (; start < newText.length && start < oldText.length; start++) {
        if (newText.charAt(start) !== oldText.charAt(start)) {
            break;
        }
    }
    let oldEnd = oldText.length;
    let newEnd = newText.length;
    for (; oldEnd > start && newEnd > start; oldEnd--, newEnd--) {
        if (newText.charAt(newEnd - 1) !== oldText.charAt(oldEnd - 1)) {
            break;
        }
    }
    const range = new vscode.Range(
        document.positionAt(start),
        document.positionAt(oldEnd)
    );
    return new vscode.TextEdit(range, newText.substring(start, newEnd));
}
