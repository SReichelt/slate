import * as vscode from 'vscode';
import * as Fmt from 'slate-shared/format/format';
import * as Meta from 'slate-shared/format/metaModel';
import * as FmtReader from 'slate-shared/format/read';
import { fileExtension } from 'slate-shared/data/constants';
import { ParsedDocumentMap } from '../parsedDocument';
import { parseFile } from '../parse';
import { readRange } from '../utils';
import { matchesQuery } from '../../utils';

export class SlateDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        let parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            let result: vscode.DocumentSymbol[] = [];
            for (let rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                let symbol: vscode.DocumentSymbol | undefined = undefined;
                if (rangeInfo.object instanceof Fmt.Definition) {
                    let signature = rangeInfo.signatureRange ? readRange(document.uri, rangeInfo.signatureRange, true, document) : undefined;
                    symbol = new vscode.DocumentSymbol(rangeInfo.object.name, signature || '', vscode.SymbolKind.Object, rangeInfo.range, rangeInfo.signatureRange ?? rangeInfo.range);
                } else if (rangeInfo.object instanceof Fmt.Parameter && !rangeInfo.object.name.startsWith('_')) {
                    let signature = readRange(document.uri, rangeInfo.range, true, document);
                    symbol = new vscode.DocumentSymbol(rangeInfo.object.name, signature || '', vscode.SymbolKind.Variable, rangeInfo.range, rangeInfo.range);
                }
                if (symbol) {
                    let i = 0;
                    while (i < result.length) {
                        let prevSymbol = result[i];
                        if (rangeInfo.range.contains(prevSymbol.range)) {
                            result.splice(i, 1);
                            symbol.children.push(prevSymbol);
                        } else {
                            i++;
                        }
                    }
                    result.push(symbol);
                }
            }
            return result;
        }
        return undefined;
    }
}

export class SlateWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[]> {
        if (!query) {
            return undefined;
        }
        query = query.toLowerCase();
        return vscode.workspace.findFiles(`**/*${fileExtension}`, undefined, undefined, token).then((uris: vscode.Uri[]) => {
            let result: vscode.SymbolInformation[] = [];
            for (let uri of uris) {
                if (token.isCancellationRequested) {
                    break;
                }
                try {
                    let contents = readRange(uri);
                    if (contents) {
                        let file = FmtReader.readString(contents, uri.fsPath, (path: Fmt.Path) => new Meta.DummyMetaModel(path.name));
                        let location = new vscode.Location(uri, undefined!);
                        for (let definition of file.definitions) {
                            if (matchesQuery(definition.name.toLowerCase(), query)) {
                                result.push(new vscode.SymbolInformation(definition.name, vscode.SymbolKind.Object, '', location));
                            }
                            for (let innerDefinition of definition.innerDefinitions) {
                                if (matchesQuery(innerDefinition.name.toLowerCase(), query)) {
                                    result.push(new vscode.SymbolInformation(innerDefinition.name, vscode.SymbolKind.Object, definition.name, location));
                                }
                            }
                        }
                    }
                } catch (error) {
                }
            }
            return result;
        });
    }

    resolveWorkspaceSymbol(symbol: vscode.SymbolInformation, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation> {
        let parsedDocument = parseFile(symbol.location.uri);
        if (parsedDocument && parsedDocument.file) {
            let definition: Fmt.Definition | undefined = undefined;
            try {
                if (symbol.containerName) {
                    let parentDefinition = parsedDocument.file.definitions.getDefinition(symbol.containerName);
                    definition = parentDefinition.innerDefinitions.getDefinition(symbol.name);
                } else {
                    definition = parsedDocument.file.definitions.getDefinition(symbol.name);
                }
            } catch (error) {
            }
            if (definition) {
                let rangeInfo = parsedDocument.rangeMap.get(definition);
                if (rangeInfo) {
                    return new vscode.SymbolInformation(symbol.name, symbol.kind, symbol.containerName, new vscode.Location(symbol.location.uri, rangeInfo.range));
                }
            }
        }
        return undefined;
    }
}
