import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import * as Meta from 'slate-shared/format/metaModel';
import * as FmtDynamic from 'slate-shared/format/dynamic';
import * as FmtMeta from 'slate-shared/format/meta';
import * as FmtReader from 'slate-shared/format/read';
import { getFileNameFromPath } from 'slate-env-node/format/dynamic';
import { RangeHandler, convertRange } from '../utils';
import { ParsedDocument, NestedArgumentListInfo } from './parsedDocument';
import { readRange, readRangeRaw } from './utils';
import { checkReferencedDefinitions } from './checkReferencedDefinitions';

export interface ParsedMetaModel {
    metaModel: FmtDynamic.DynamicMetaModel;
    metaModelDocument: ParsedDocument;
    metaModelDocuments: Map<FmtDynamic.DynamicMetaModel, ParsedDocument>;
}

export const parsedFileCache = new Map<string, ParsedDocument>();
export const metaModelCache = new Map<string, ParsedMetaModel>();

class ErrorHandler implements FmtReader.ErrorHandler {
    constructor(private parsedDocument: ParsedDocument, private diagnostics?: vscode.Diagnostic[]) {}

    error(msg: string, range: FmtReader.Range): void {
        this.parsedDocument.hasSyntaxErrors = true;
        if (this.diagnostics) {
            this.diagnostics.push({
                message: msg,
                range: convertRange(range),
                severity: vscode.DiagnosticSeverity.Error
            });
        }
    }

    unfilledPlaceholder(range: FmtReader.Range): void {
        this.parsedDocument.hasUnfilledPlaceholders = true;
        if (this.diagnostics) {
            this.diagnostics.push({
                message: 'Unfilled placeholder',
                range: convertRange(range),
                severity: vscode.DiagnosticSeverity.Warning
            });
        }
    }

    checkMarkdownCode = true;
}

type ParseFilePreCheckFn = (parsedDocument: ParsedDocument, rangeInfo: FmtReader.ObjectRangeInfo) => boolean;

export function parseFile(uri: vscode.Uri, needExtendedInfo: boolean = false, fileContents?: string, diagnostics?: vscode.Diagnostic[], sourceDocument?: vscode.TextDocument, preCheck?: ParseFilePreCheckFn): ParsedDocument | undefined {
    if (!diagnostics) {
        const cachedDocument = parsedFileCache.get(uri.fsPath);
        if (cachedDocument) {
            if (!needExtendedInfo || (cachedDocument.objectContentsMap && cachedDocument.nestedArgumentListsMap)) {
                return cachedDocument;
            }
        }
    }

    if (!fileContents) {
        fileContents = readRange(uri, undefined, false, sourceDocument) || '';
    }

    const rangeHandler = new RangeHandler;

    const parsedDocument: ParsedDocument = {
        uri: uri,
        hasSyntaxErrors: false,
        hasUnfilledPlaceholders: false,
        hasBrokenReferences: false,
        rangeList: rangeHandler.rangeList,
        rangeMap: rangeHandler.rangeMap,
        pathAliases: rangeHandler.pathAliases,
        metaModelDocuments: new Map<FmtDynamic.DynamicMetaModel, ParsedDocument>(),
        objectContentsMap: needExtendedInfo ? new Map<Fmt.CompoundExpression, FmtDynamic.DynamicObjectContents>() : undefined,
        nestedArgumentListsMap: needExtendedInfo ? new Map<Fmt.ArgumentList, NestedArgumentListInfo>() : undefined
    };

    const errorHandler = new ErrorHandler(parsedDocument, diagnostics);

    const getReferencedMetaModel = (sourceFileName: string, path: Fmt.Path): Meta.MetaModel => {
        const onObjectContentsCreated = parsedDocument.objectContentsMap ? (expression: Fmt.CompoundExpression, objectContents: FmtDynamic.DynamicObjectContents) => parsedDocument.objectContentsMap?.set(expression, objectContents) : undefined;
        const metaModelFileName = getFileNameFromPath(sourceFileName, path);
        const parsedMetaModel = metaModelCache.get(metaModelFileName);
        if (parsedMetaModel) {
            if (!parsedDocument.metaModelDocument) {
                parsedDocument.metaModelDocument = parsedMetaModel.metaModelDocument;
            }
            for (const [referencedMetaModel, referencedMetaModelDocument] of parsedMetaModel.metaModelDocuments) {
                parsedDocument.metaModelDocuments!.set(referencedMetaModel, referencedMetaModelDocument);
            }
            parsedMetaModel.metaModel.onObjectContentsCreated = onObjectContentsCreated;
            return parsedMetaModel.metaModel;
        }
        const metaModelRangeHandler = new RangeHandler;
        const parsedMetaModelDocument: ParsedDocument = {
            uri: vscode.Uri.file(metaModelFileName),
            hasSyntaxErrors: false,
            hasUnfilledPlaceholders: false,
            hasBrokenReferences: false,
            rangeList: metaModelRangeHandler.rangeList,
            rangeMap: metaModelRangeHandler.rangeMap,
            pathAliases: rangeHandler.pathAliases
        };
        const metaModelFileContents = readRangeRaw(parsedMetaModelDocument.uri);
        parsedMetaModelDocument.file = FmtReader.readString(metaModelFileContents, metaModelFileName, FmtMeta.getMetaModel, metaModelRangeHandler);
        if (!parsedDocument.metaModelDocument) {
            parsedDocument.metaModelDocument = parsedMetaModelDocument;
        }
        const metaModel = new FmtDynamic.DynamicMetaModel(parsedMetaModelDocument.file, metaModelFileName, (otherPath: Fmt.Path) => getReferencedMetaModel(metaModelFileName, otherPath));
        parsedDocument.metaModelDocuments!.set(metaModel, parsedMetaModelDocument);
        metaModelCache.set(metaModelFileName, {
            metaModel: metaModel,
            metaModelDocument: parsedMetaModelDocument,
            metaModelDocuments: parsedDocument.metaModelDocuments!
        });
        metaModel.onObjectContentsCreated = onObjectContentsCreated;
        return metaModel;
    };

    const getDocumentMetaModel = (path: Fmt.Path) => getReferencedMetaModel(uri.fsPath, path);

    if (preCheck) {
        let preCheckCompleted = false;
        const stream = new FmtReader.StringInputStream(fileContents);
        const preCheckRangeHandler: FmtReader.RangeHandler = {
            reportRange(info: FmtReader.ObjectRangeInfo): void {
                if (!preCheckCompleted && preCheck(parsedDocument, info)) {
                    preCheckCompleted = true;
                }
            }
        };
        const reader = new FmtReader.Reader(stream, errorHandler, getDocumentMetaModel, preCheckRangeHandler);
        try {
            reader.readFile();
        } catch (error) {
        }
        if (!preCheckCompleted) {
            return undefined;
        }
    }

    {
        const stream = new FmtReader.StringInputStream(fileContents);
        const reader = new FmtReader.Reader(stream, errorHandler, getDocumentMetaModel, rangeHandler);
        try {
            parsedDocument.file = reader.readFile();
            if (diagnostics || needExtendedInfo) {
                checkReferencedDefinitions(parsedDocument, diagnostics, sourceDocument);
            }
        } catch (error) {
            parsedDocument.hasSyntaxErrors = true;
            if (diagnostics && !diagnostics.length) {
                const dummyPosition = new vscode.Position(0, 0);
                diagnostics.push({
                    message: error.message,
                    range: new vscode.Range(dummyPosition, dummyPosition),
                    severity: vscode.DiagnosticSeverity.Error
                });
            }
        }
    }

    parsedFileCache.set(uri.fsPath, parsedDocument);

    return parsedDocument;
}
