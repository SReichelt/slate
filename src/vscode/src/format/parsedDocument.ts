import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import * as FmtDynamic from 'slate-shared/format/dynamic';
import { RangeInfo } from '../utils';

export interface ParsedDocument {
    uri: vscode.Uri;
    file?: Fmt.File;
    hasSyntaxErrors: boolean;
    hasUnfilledPlaceholders: boolean;
    hasBrokenReferences: boolean;
    rangeList: RangeInfo[];
    rangeMap: Map<Object, RangeInfo>;
    pathAliases: Fmt.PathAlias[];
    metaModelDocument?: ParsedDocument;
    metaModelDocuments?: Map<FmtDynamic.DynamicMetaModel, ParsedDocument>;
    objectContentsMap?: Map<Fmt.CompoundExpression, FmtDynamic.DynamicObjectContents>;
    nestedArgumentListsMap?: Map<Fmt.ArgumentList, NestedArgumentListInfo>;
}

export interface NestedArgumentListInfo {
    targetDocument: ParsedDocument;
    parameterExpression: Fmt.ParameterExpression;
}

export type ParsedDocumentMap = Map<vscode.TextDocument, ParsedDocument>;
