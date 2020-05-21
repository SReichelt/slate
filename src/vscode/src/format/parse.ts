'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../shared/format/format';
import * as Meta from '../../../shared/format/metaModel';
import * as FmtDynamic from '../../../shared/format/dynamic';
import * as FmtMeta from '../../../shared/format/meta';
import * as FmtReader from '../../../shared/format/read';
import { getFileNameFromPath } from '../../../fs/format/dynamic';
import { RangeInfo, convertRange, convertRangeInfo } from '../utils';
import { ParsedDocument, NestedArgumentListInfo } from './parsedDocument';
import { readRange, readRangeRaw } from './utils';
import { checkReferencedDefinitions } from './checkReferencedDefinitions';

export interface ParsedMetaModel {
    metaModel: FmtDynamic.DynamicMetaModel;
    metaModelDocument: ParsedDocument;
    metaModelDocuments: Map<FmtDynamic.DynamicMetaModel, ParsedDocument>;
}

export let parsedFileCache = new Map<string, ParsedDocument>();
export let metaModelCache = new Map<string, ParsedMetaModel>();

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
        let cachedDocument = parsedFileCache.get(uri.fsPath);
        if (cachedDocument) {
            if (!needExtendedInfo || (cachedDocument.objectContentsMap && cachedDocument.nestedArgumentListsMap)) {
                return cachedDocument;
            }
        }
    }

    if (!fileContents) {
        fileContents = readRange(uri, undefined, false, sourceDocument) || '';
    }

    let parsedDocument: ParsedDocument = {
        uri: uri,
        hasSyntaxErrors: false,
        hasUnfilledPlaceholders: false,
        hasBrokenReferences: false,
        rangeList: [],
        rangeMap: new Map<Object, RangeInfo>(),
        metaModelDocuments: new Map<FmtDynamic.DynamicMetaModel, ParsedDocument>(),
        objectContentsMap: needExtendedInfo ? new Map<Fmt.CompoundExpression, FmtDynamic.DynamicObjectContents>() : undefined,
        nestedArgumentListsMap: needExtendedInfo ? new Map<Fmt.ArgumentList, NestedArgumentListInfo>() : undefined
    };

    let errorHandler = new ErrorHandler(parsedDocument, diagnostics);

    let getReferencedMetaModel = (sourceFileName: string, path: Fmt.Path): Meta.MetaModel => {
        let onObjectContentsCreated = parsedDocument.objectContentsMap ? (expression: Fmt.CompoundExpression, objectContents: FmtDynamic.DynamicObjectContents) => parsedDocument.objectContentsMap?.set(expression, objectContents) : undefined;
        let metaModelFileName = getFileNameFromPath(sourceFileName, path);
        let parsedMetaModel = metaModelCache.get(metaModelFileName);
        if (parsedMetaModel) {
            if (!parsedDocument.metaModelDocument) {
                parsedDocument.metaModelDocument = parsedMetaModel.metaModelDocument;
            }
            for (let [referencedMetaModel, referencedMetaModelDocument] of parsedMetaModel.metaModelDocuments) {
                parsedDocument.metaModelDocuments!.set(referencedMetaModel, referencedMetaModelDocument);
            }
            parsedMetaModel.metaModel.onObjectContentsCreated = onObjectContentsCreated;
            return parsedMetaModel.metaModel;
        }
        let parsedMetaModelDocument: ParsedDocument = {
            uri: vscode.Uri.file(metaModelFileName),
            hasSyntaxErrors: false,
            hasUnfilledPlaceholders: false,
            hasBrokenReferences: false,
            rangeList: [],
            rangeMap: new Map<Object, RangeInfo>()
        };
        let metaModelFileContents = readRangeRaw(parsedMetaModelDocument.uri);
        let reportMetaModelRange = (info: FmtReader.ObjectRangeInfo) => {
            let rangeInfo = convertRangeInfo(info);
            parsedMetaModelDocument.rangeList.push(rangeInfo);
            parsedMetaModelDocument.rangeMap.set(info.object, rangeInfo);
        };
        parsedMetaModelDocument.file = FmtReader.readString(metaModelFileContents, metaModelFileName, FmtMeta.getMetaModel, reportMetaModelRange);
        if (!parsedDocument.metaModelDocument) {
            parsedDocument.metaModelDocument = parsedMetaModelDocument;
        }
        let metaModel = new FmtDynamic.DynamicMetaModel(parsedMetaModelDocument.file, metaModelFileName, (otherPath: Fmt.Path) => getReferencedMetaModel(metaModelFileName, otherPath));
        parsedDocument.metaModelDocuments!.set(metaModel, parsedMetaModelDocument);
        metaModelCache.set(metaModelFileName, {
            metaModel: metaModel,
            metaModelDocument: parsedMetaModelDocument,
            metaModelDocuments: parsedDocument.metaModelDocuments!
        });
        metaModel.onObjectContentsCreated = onObjectContentsCreated;
        return metaModel;
    };

    let getDocumentMetaModel = (path: Fmt.Path) => getReferencedMetaModel(uri.fsPath, path);

    if (preCheck) {
        let preCheckCompleted = false;
        let stream = new FmtReader.StringInputStream(fileContents);
        let reportRange = (info: FmtReader.ObjectRangeInfo) => {
            if (!preCheckCompleted && preCheck(parsedDocument, info)) {
                preCheckCompleted = true;
            }
        };
        let reader = new FmtReader.Reader(stream, errorHandler, getDocumentMetaModel, reportRange);
        try {
            reader.readFile();
        } catch (error) {
        }
        if (!preCheckCompleted) {
            return undefined;
        }
    }

    {
        let stream = new FmtReader.StringInputStream(fileContents);
        let reportRange = (info: FmtReader.ObjectRangeInfo) => {
            let rangeInfo = convertRangeInfo(info);
            parsedDocument.rangeList.push(rangeInfo);
            parsedDocument.rangeMap.set(info.object, rangeInfo);
        };
        let reader = new FmtReader.Reader(stream, errorHandler, getDocumentMetaModel, reportRange);
        try {
            parsedDocument.file = reader.readFile();
            if (diagnostics || needExtendedInfo) {
                checkReferencedDefinitions(parsedDocument, diagnostics, sourceDocument);
            }
        } catch (error) {
            parsedDocument.hasSyntaxErrors = true;
            if (diagnostics && !diagnostics.length) {
                let dummyPosition = new vscode.Position(0, 0);
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
