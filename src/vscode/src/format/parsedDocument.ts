'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../shared/format/format';
import * as FmtDynamic from '../../../shared/format/dynamic';
import { RangeInfo } from '../utils';

export interface ParsedDocument {
    uri: vscode.Uri;
    file?: Fmt.File;
    hasSyntaxErrors: boolean;
    hasBrokenReferences: boolean;
    rangeList: RangeInfo[];
    rangeMap: Map<Object, RangeInfo>;
    metaModelDocument?: ParsedDocument;
    metaModelDocuments?: Map<FmtDynamic.DynamicMetaModel, ParsedDocument>;
}

export type ParsedDocumentMap = Map<vscode.TextDocument, ParsedDocument>;
