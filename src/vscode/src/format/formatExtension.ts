'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';  // TODO replace with vscode.workspace.fs / WorkspaceFileAccessor
import { WorkspaceFileAccessor } from '../workspaceFileAccessor';
import { languageId, SLATE_MODE } from '../slate';
import { ParseDocumentEvent, HoverEvent } from '../events';
import { deleteUrisFromDiagnosticCollection } from '../utils';
import { ParsedDocument, ParsedDocumentMap } from './parsedDocument';
import { parseFile, parsedFileCache, metaModelCache } from './parse';
import { checkReferencedDefinitions } from './checkReferencedDefinitions';
import { SlateDocumentSymbolProvider, SlateWorkspaceSymbolProvider } from './providers/symbolProvider';
import { SlateDefinitionProvider } from './providers/definitionProvider';
import { SlateHighlightProvider } from './providers/highlightProvider';
import { SlateSignatureHelpProvider } from './providers/signatureHelpProvider';
import { SlateCompletionItemProvider } from './providers/completionItemProvider';
import { SlateReferenceProvider } from './providers/referenceProvider';
import { SlateRenameProvider } from './providers/renameProvider';
import { SlateDocumentFormatter } from './providers/documentFormatter';

function emitParseEvent(document: vscode.TextDocument, parsedDocument: ParsedDocument, parseEventEmitter: vscode.EventEmitter<ParseDocumentEvent> | undefined): void {
    if (parseEventEmitter) {
        parseEventEmitter.fire({
            document: document,
            file: parsedDocument.file,
            hasErrors: parsedDocument.hasSyntaxErrors || parsedDocument.hasBrokenReferences
        });
    }
}

function parseDocument(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection, parsedDocuments: ParsedDocumentMap, parseEventEmitter?: vscode.EventEmitter<ParseDocumentEvent>): ParsedDocument | undefined {
    if (document.languageId === languageId) {
        let diagnostics: vscode.Diagnostic[] = [];
        let parsedDocument = parseFile(document.uri, true, document.getText(), diagnostics, document);
        diagnosticCollection.set(document.uri, diagnostics);
        if (parsedDocument) {
            parsedDocuments.set(document, parsedDocument);
            emitParseEvent(document, parsedDocument, parseEventEmitter);
        }
        return parsedDocument;
    } else {
        return undefined;
    }
}

type ReparseCondition = (document: vscode.TextDocument) => boolean;

let parseAllTimer: NodeJS.Timer | undefined = undefined;
let parseAllDelay = 0;
let reparseCompletely = false;
let reparseConditions: ReparseCondition[] | undefined = [];

function triggerParseAll(diagnosticCollection: vscode.DiagnosticCollection, parsedDocuments: ParsedDocumentMap, parseEventEmitter: vscode.EventEmitter<ParseDocumentEvent>, recheckOnly: boolean, condition?: ReparseCondition, delay: number = 500): void {
    if (!recheckOnly) {
        reparseCompletely = true;
    }
    if (condition) {
        if (reparseConditions) {
            reparseConditions.push(condition);
        }
    } else {
        reparseConditions = undefined;
        diagnosticCollection.clear();
    }
    if (parseAllTimer) {
        clearTimeout(parseAllTimer);
    }
    let parseAll = () => {
        for (let document of vscode.workspace.textDocuments) {
            if (document.languageId === languageId && (!reparseConditions || reparseConditions.some((reparseCondition: ReparseCondition) => reparseCondition(document)))) {
                let fileName = document.uri.fsPath;
                if (!fs.existsSync(fileName)) {
                    // Unfortunately, after rename operations, deleted documents are still returned by vscode.workspace.textDocuments.
                    // To avoid reporting errors for these documents, we need to skip them here.
                    continue;
                }
                if (!reparseCompletely) {
                    let parsedDocument = parsedFileCache.get(fileName);
                    if (parsedDocument && !parsedDocument.hasSyntaxErrors && !parsedDocument.hasUnfilledPlaceholders) {
                        let diagnostics: vscode.Diagnostic[] = [];
                        checkReferencedDefinitions(parsedDocument, diagnostics, document);
                        diagnosticCollection.set(document.uri, diagnostics);
                        emitParseEvent(document, parsedDocument, parseEventEmitter);
                        continue;
                    }
                }
                parsedFileCache.delete(fileName);
                parseDocument(document, diagnosticCollection, parsedDocuments, parseEventEmitter);
            }
        }
        parseAllTimer = undefined;
        parseAllDelay = 0;
        reparseCompletely = false;
        reparseConditions = [];
    };
    if (parseAllDelay < delay) {
        parseAllDelay = delay;
    }
    parseAllTimer = setTimeout(parseAll, parseAllDelay);
}

function invalidateUris(uris: vscode.Uri[], diagnosticCollection: vscode.DiagnosticCollection, parsedDocuments: ParsedDocumentMap, parseEventEmitter: vscode.EventEmitter<ParseDocumentEvent>): void {
    deleteUrisFromDiagnosticCollection(uris, diagnosticCollection);
    let recheckOnly = true;
    for (let uri of uris) {
        let fileName = uri.fsPath;
        if (metaModelCache.has(fileName)) {
            parsedFileCache.delete(fileName);
            metaModelCache.delete(fileName);
            recheckOnly = false;
        }
    }
    triggerParseAll(diagnosticCollection, parsedDocuments, parseEventEmitter, recheckOnly);
}

function configureLanguage(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.setLanguageConfiguration(languageId, {
            onEnterRules: [
                {
                    beforeText: /^\s*\/\*\*([^\*]|\*(?!\/))*$/,
                    afterText: /^\s*\*\/$/,
                    action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: ' * ' }
                },
                {
                    beforeText: /^\s*\/\*\*([^\*]|\*(?!\/))*$/,
                    action: { indentAction: vscode.IndentAction.None, appendText: ' * ' }
                },
                {
                    beforeText: /^(\ \ )*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                    action: { indentAction: vscode.IndentAction.None, appendText: '* ' }
                },
                {
                    beforeText: /^(\ \ )*\ \*\/\s*$/,
                    action: { indentAction: vscode.IndentAction.None, removeText: 1 }
                }
            ]
        })
    );
}

export function activate(context: vscode.ExtensionContext, fileAccessor: WorkspaceFileAccessor, onInitialized: (parseEvent: vscode.Event<ParseDocumentEvent>, hoverEvent: vscode.Event<HoverEvent>) => void): void {
    configureLanguage(context);

    let diagnosticCollection = vscode.languages.createDiagnosticCollection(languageId);
    let parsedDocuments: ParsedDocumentMap = new Map<vscode.TextDocument, ParsedDocument>();
    let parseEventEmitter = new vscode.EventEmitter<ParseDocumentEvent>();
    let hoverEventEmitter = new vscode.EventEmitter<HoverEvent>();
    context.subscriptions.push(
        parseEventEmitter,
        hoverEventEmitter
    );
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => parseDocument(document, diagnosticCollection, parsedDocuments, parseEventEmitter)),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (parseAllTimer && reparseConditions === undefined) {
                // After certain events like file renaming, we want to avoid registering intermediate errors.
                return;
            }
            let changedDocument = event.document;
            if (changedDocument.languageId === languageId) {
                let fileName = changedDocument.uri.fsPath;
                parsedFileCache.delete(fileName);
                let recheckOnly = true;
                if (metaModelCache.has(fileName)) {
                    metaModelCache.delete(fileName);
                    recheckOnly = false;
                }
                let parsedDocument = parseDocument(changedDocument, diagnosticCollection, parsedDocuments, parseEventEmitter);
                if (parsedDocument && !parsedDocument.hasSyntaxErrors) {
                    fileAccessor.documentChanged(changedDocument);
                }
                // TODO only reparse affected documents (maintain a list of documents to reparse)
                triggerParseAll(diagnosticCollection, parsedDocuments, parseEventEmitter, recheckOnly, (document) => (document !== changedDocument));
            }
        })
    );
    if (vscode.workspace.onDidDeleteFiles !== undefined && vscode.workspace.onDidRenameFiles !== undefined) {
        context.subscriptions.push(
            vscode.workspace.onDidDeleteFiles((event) => invalidateUris(event.files.slice(), diagnosticCollection, parsedDocuments, parseEventEmitter)),
            vscode.workspace.onDidRenameFiles((event) => {
                let uris = event.files.map((file) => file.oldUri);
                invalidateUris(uris, diagnosticCollection, parsedDocuments, parseEventEmitter);
                triggerParseAll(diagnosticCollection, parsedDocuments, parseEventEmitter, true, undefined, 5000);
            })
        );
    }
    let definitionProvider = new SlateDefinitionProvider(parsedDocuments, hoverEventEmitter);
    let renameProvider = new SlateRenameProvider(parsedDocuments, () => triggerParseAll(diagnosticCollection, parsedDocuments, parseEventEmitter, true, undefined, 5000));
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(SLATE_MODE, new SlateDocumentSymbolProvider(parsedDocuments)),
        vscode.languages.registerWorkspaceSymbolProvider(new SlateWorkspaceSymbolProvider),
        vscode.languages.registerDefinitionProvider(SLATE_MODE, definitionProvider),
        vscode.languages.registerHoverProvider(SLATE_MODE, definitionProvider),
        vscode.languages.registerDocumentHighlightProvider(SLATE_MODE, new SlateHighlightProvider(parsedDocuments)),
        vscode.languages.registerSignatureHelpProvider(SLATE_MODE, new SlateSignatureHelpProvider(parsedDocuments), '(', '{', ','),
        vscode.languages.registerCompletionItemProvider(SLATE_MODE, new SlateCompletionItemProvider(parsedDocuments), '%', '$', '/', '.', '(', ' ', '\n', '@'),
        vscode.languages.registerReferenceProvider(SLATE_MODE, new SlateReferenceProvider(parsedDocuments)),
        vscode.languages.registerRenameProvider(SLATE_MODE, renameProvider),
        vscode.languages.registerDocumentFormattingEditProvider(SLATE_MODE, new SlateDocumentFormatter)
    );
    if (vscode.workspace.onWillRenameFiles !== undefined) {
        context.subscriptions.push(
            vscode.workspace.onWillRenameFiles((event) => {
                if (parseAllTimer) {
                    if (reparseConditions) {
                        clearTimeout(parseAllTimer);
                        reparseConditions = [];
                    } else {
                        // The file is probably being renamed as part of a symbol rename operation.
                        // In that case, we need to avoid updating the references twice, as that causes garbage.
                        // Unfortunately, there does not seem to be any official way to determine the cause of the rename operation.
                        return;
                    }
                }
                event.waitUntil(renameProvider.updateFileReferences(event.files));
            })
        );
    }
    onInitialized(parseEventEmitter.event, hoverEventEmitter.event);
    for (let document of vscode.workspace.textDocuments) {
        parseDocument(document, diagnosticCollection, parsedDocuments, parseEventEmitter);
    }
}

export function deactivate(): void {
    if (parseAllTimer) {
        clearTimeout(parseAllTimer);
        parseAllTimer = undefined;
    }
}
