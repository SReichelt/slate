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
        const parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            const result: vscode.DocumentSymbol[] = [];
            for (const rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                let symbol: vscode.DocumentSymbol | undefined = undefined;
                if (rangeInfo.object instanceof Fmt.Definition) {
                    const signature = rangeInfo.signatureRange ? readRange(document.uri, rangeInfo.signatureRange, true, document) : undefined;
                    symbol = new vscode.DocumentSymbol(rangeInfo.object.name, signature || '', vscode.SymbolKind.Object, rangeInfo.range, rangeInfo.signatureRange ?? rangeInfo.range);
                } else if (rangeInfo.object instanceof Fmt.Parameter && !rangeInfo.object.name.startsWith('_')) {
                    const signature = readRange(document.uri, rangeInfo.range, true, document);
                    symbol = new vscode.DocumentSymbol(rangeInfo.object.name, signature || '', vscode.SymbolKind.Variable, rangeInfo.range, rangeInfo.range);
                }
                if (symbol) {
                    let i = 0;
                    while (i < result.length) {
                        const prevSymbol = result[i];
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
            const result: vscode.SymbolInformation[] = [];
            for (const uri of uris) {
                if (token.isCancellationRequested) {
                    break;
                }
                try {
                    const contents = readRange(uri);
                    if (contents) {
                        const file = FmtReader.readString(contents, uri.fsPath, (path: Fmt.Path) => new Meta.DummyMetaModel(path.name));
                        const location = new vscode.Location(uri, undefined!);
                        for (const definition of file.definitions) {
                            if (matchesQuery(definition.name.toLowerCase(), query)) {
                                result.push(new vscode.SymbolInformation(definition.name, vscode.SymbolKind.Object, '', location));
                            }
                            for (const innerDefinition of definition.innerDefinitions) {
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
        const parsedDocument = parseFile(symbol.location.uri);
        if (parsedDocument && parsedDocument.file) {
            let definition: Fmt.Definition | undefined = undefined;
            try {
                if (symbol.containerName) {
                    const parentDefinition = parsedDocument.file.definitions.getDefinition(symbol.containerName);
                    definition = parentDefinition.innerDefinitions.getDefinition(symbol.name);
                } else {
                    definition = parsedDocument.file.definitions.getDefinition(symbol.name);
                }
            } catch (error) {
            }
            if (definition) {
                const rangeInfo = parsedDocument.rangeMap.get(definition);
                if (rangeInfo) {
                    return new vscode.SymbolInformation(symbol.name, symbol.kind, symbol.containerName, new vscode.Location(symbol.location.uri, rangeInfo.range));
                }
            }
        }
        return undefined;
    }
}
