'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../shared/format/format';
import * as FmtReader from '../../../shared/format/read';
import * as FmtLibrary from '../../../shared/logics/library';
import * as Logics from '../../../shared/logics/logics';
import { FileAccessor } from '../../../shared/data/fileAccessor';
import { LibraryDataProvider, LibraryDataProviderConfig } from '../../../shared/data/libraryDataProvider';
import { languageId } from '../slate';
import { ParseDocumentEvent } from '../events';
import { RangeInfo, convertRangeInfo, deleteUrisFromDiagnosticCollection } from '../utils';

export interface Library {
    libraryDataProvider: LibraryDataProvider;
    diagnosticCollection: vscode.DiagnosticCollection;
}

export interface LibraryDocument {
    document: vscode.TextDocument;
    library: Library;
    documentLibraryDataProvider: LibraryDataProvider;
    file: Fmt.File;
    isSection: boolean;
    rangeList: RangeInfo[];
    rangeMap: Map<Object, RangeInfo>;
}

export class LibraryDocumentProvider {
    private libraries = new Map<string, Library>();
    private documents = new Map<vscode.TextDocument, LibraryDocument>();

    constructor(private fileAccessor: FileAccessor) {}

    parseDocument(event: ParseDocumentEvent): LibraryDocument | undefined {
        let libraryDocument = this.tryParseDocument(event);
        if (libraryDocument) {
            this.documents.set(event.document, libraryDocument);
        } else {
            this.documents.delete(event.document);
        }
        return libraryDocument;
    }

    private tryParseDocument(event: ParseDocumentEvent): LibraryDocument | undefined {
        if (!event.file) {
            return undefined;
        }
        let isSection = (event.file.metaModelPath.name === 'library');
        let rangeList: RangeInfo[] = [];
        let rangeMap = new Map<Object, RangeInfo>();
        let reportRange = (info: FmtReader.ObjectRangeInfo) => {
            let rangeInfo = convertRangeInfo(info);
            rangeList.push(rangeInfo);
            rangeMap.set(info.object, rangeInfo);
        };
        if (isSection) {
            event.file = FmtReader.readString(event.document.getText(), event.document.fileName, FmtLibrary.getMetaModel, reportRange);
        }
        let library = this.getLibrary(event, isSection);
        if (!library) {
            return undefined;
        }
        if (event.hasErrors) {
            library.diagnosticCollection.delete(event.document.uri);
            return undefined;
        }
        let path = library.libraryDataProvider.uriToPath(event.document.uri.toString(), true);
        if (!path) {
            library.diagnosticCollection.delete(event.document.uri);
            return undefined;
        }
        let documentLibraryDataProvider = library.libraryDataProvider.getProviderForSection(path.parentPath);
        if (!isSection) {
            try {
                let stream = new FmtReader.StringInputStream(event.document.getText());
                let errorHandler = new FmtReader.DefaultErrorHandler(event.document.fileName, false, true);
                event.file = FmtReader.readStream(stream, errorHandler, library.libraryDataProvider.logic.getMetaModel, reportRange);
            } catch (error) {
                library.diagnosticCollection.delete(event.document.uri);
                return undefined;
            }
        }
        return {
            document: event.document,
            library: library,
            documentLibraryDataProvider: documentLibraryDataProvider,
            file: event.file,
            isSection: isSection,
            rangeList: rangeList,
            rangeMap: rangeMap
        };
    }

    private getLibrary(event: ParseDocumentEvent, isSection: boolean): Library | undefined {
        let libraryUri = this.getLibraryUri(event);
        if (!libraryUri) {
            return undefined;
        }
        let library = this.libraries.get(libraryUri);
        if (!library) {
            let logicName = this.getLogicName(event, isSection);
            if (!logicName) {
                return undefined;
            }
            let logic = Logics.findLogic(logicName);
            if (!logic) {
                return undefined;
            }
            let config: LibraryDataProviderConfig = {
                canPreload: false,
                watchForChanges: true,
                retryMissingFiles: true,
                checkMarkdownCode: false,
                allowPlaceholders: true
            };
            library = {
                libraryDataProvider: new LibraryDataProvider(logic, this.fileAccessor, libraryUri, config, 'Library'),
                diagnosticCollection: vscode.languages.createDiagnosticCollection(languageId + '/' + logicName)
            };
            this.libraries.set(libraryUri, library);
        }
        return library;
    }

    private getLibraryUri(event: ParseDocumentEvent): string | undefined {
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(event.document.uri);
        if (!workspaceFolder) {
            return undefined;
        }
        let documentUri = event.document.uri.toString();
        let libraryBaseUri = workspaceFolder.uri.toString() + '/data/libraries/';
        if (documentUri.startsWith(libraryBaseUri)) {
            let slashPos = documentUri.indexOf('/', libraryBaseUri.length);
            return slashPos >= 0 ? documentUri.substring(0, slashPos) : documentUri;
        }
        let testDataUriPart = '/__tests__/data/';
        let testDataPos = documentUri.indexOf(testDataUriPart);
        if (testDataPos >= 0) {
            return documentUri.substring(0, testDataPos + testDataUriPart.length);
        }
        return undefined;
    }

    private getLogicName(event: ParseDocumentEvent, isSection: boolean): string | undefined {
        if (!event.file) {
            return undefined;
        }
        if (isSection) {
            if (event.file.definitions.length) {
                let contents = event.file.definitions[0].contents;
                if (contents instanceof FmtLibrary.ObjectContents_Section) {
                    return contents.logic;
                }
            }
            return undefined;
        } else {
            return event.file.metaModelPath.name;
        }
    }

    getDocument(document: vscode.TextDocument): LibraryDocument | undefined {
        return this.documents.get(document);
    }

    invalidateUris(uris: vscode.Uri[]): void {
        for (let library of this.libraries.values()) {
            deleteUrisFromDiagnosticCollection(uris, library.diagnosticCollection);
        }
    }
}
