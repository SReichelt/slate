import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtLibrary from 'slate-shared/logics/library';
import * as Logics from 'slate-shared/logics/logics';
import { FileAccessor } from 'slate-shared/data/fileAccessor';
import { LibraryDataProvider, LibraryDataProviderOptions } from 'slate-shared/data/libraryDataProvider';
import { languageId } from '../slate';
import { ParseDocumentEvent } from '../events';
import { RangeInfo, RangeHandler, deleteUrisFromDiagnosticCollection, areUrisEqual, isEqualOrParentUriOf } from '../utils';

export interface Library {
    libraryDataProvider: LibraryDataProvider;
    diagnosticCollection: vscode.DiagnosticCollection;
}

export interface LibraryDocument {
    document?: vscode.TextDocument;
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

    dispose(): void {
        this.documents.clear();
        for (const library of this.libraries.values()) {
            library.libraryDataProvider.close();
        }
        this.libraries.clear();
    }

    parseDocument(event: ParseDocumentEvent): LibraryDocument | undefined {
        const libraryDocument = this.tryParseDocument(event);
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
        const isSection = (event.file.metaModelPath.name === FmtLibrary.metaModel.name);
        const rangeHandler = new RangeHandler;
        if (isSection) {
            event.file = FmtReader.readString(event.document.getText(), event.document.fileName, FmtLibrary.getMetaModel, rangeHandler);
        }
        const [libraryUri, itemUri] = this.splitUri(event);
        if (!libraryUri || !itemUri) {
            return undefined;
        }
        const library = this.getLibrary(event, isSection, libraryUri);
        if (!library) {
            return undefined;
        }
        if (event.hasErrors) {
            library.diagnosticCollection.delete(event.document.uri);
            return undefined;
        }
        const path = library.libraryDataProvider.uriToPath(itemUri, true);
        if (!path) {
            library.diagnosticCollection.delete(event.document.uri);
            return undefined;
        }
        const documentLibraryDataProvider = library.libraryDataProvider.getProviderForSection(path.parentPath);
        if (!isSection) {
            try {
                const stream = new FmtReader.StringInputStream(event.document.getText());
                const errorHandler = new FmtReader.DefaultErrorHandler(event.document.fileName, false, true);
                event.file = FmtReader.readStream(stream, errorHandler, library.libraryDataProvider.logic.getMetaModel, rangeHandler);
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
            rangeList: rangeHandler.rangeList,
            rangeMap: rangeHandler.rangeMap
        };
    }

    private getLibrary(event: ParseDocumentEvent, isSection: boolean, libraryUri: string): Library | undefined {
        let library = this.libraries.get(libraryUri);
        if (!library) {
            const logicName = this.getLogicName(event, isSection);
            if (!logicName) {
                return undefined;
            }
            const logic = Logics.findLogic(logicName);
            if (!logic) {
                return undefined;
            }
            const options: LibraryDataProviderOptions = {
                logic: logic,
                fileAccessor: this.fileAccessor.createChildAccessor(libraryUri),
                watchForChanges: true,
                enablePrefetching: true,
                checkMarkdownCode: false,
                allowPlaceholders: true
            };
            library = {
                libraryDataProvider: new LibraryDataProvider(options),
                diagnosticCollection: vscode.languages.createDiagnosticCollection(languageId + '/' + logicName)
            };
            this.libraries.set(libraryUri, library);
        }
        return library;
    }

    private splitUri(event: ParseDocumentEvent): [string | undefined, string | undefined] {
        const documentUri = event.document.uri.toString();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(event.document.uri);
        if (!workspaceFolder) {
            return [undefined, undefined];
        }
        const libraryBaseUri = workspaceFolder.uri.toString() + '/data/libraries/';
        let slashPos: number;
        if (documentUri.startsWith(libraryBaseUri)) {
            slashPos = documentUri.indexOf('/', libraryBaseUri.length);
        } else {
            const testDataUriPart = '/__tests__/data/';
            const testDataPos = documentUri.indexOf(testDataUriPart);
            if (testDataPos >= 0) {
                slashPos = testDataPos + testDataUriPart.length - 1;
            } else {
                return [undefined, undefined];
            }
        }
        return slashPos >= 0 ? [documentUri.substring(0, slashPos), documentUri.substring(slashPos + 1)] : [documentUri, undefined];
    }

    private getLogicName(event: ParseDocumentEvent, isSection: boolean): string | undefined {
        if (!event.file) {
            return undefined;
        }
        if (isSection) {
            if (event.file.definitions.length) {
                const contents = event.file.definitions[0].contents;
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
        const invalidatedDocuments: vscode.TextDocument[] = [];
        for (const [document, libraryDocument] of this.documents) {
            for (const uri of uris) {
                if (isEqualOrParentUriOf(uri, document.uri)) {
                    invalidatedDocuments.push(document);
                    libraryDocument.document = undefined;
                }
            }
        }
        for (const document of invalidatedDocuments) {
            this.documents.delete(document);
        }
        for (const library of this.libraries.values()) {
            deleteUrisFromDiagnosticCollection(uris, library.diagnosticCollection);
        }
    }
}
