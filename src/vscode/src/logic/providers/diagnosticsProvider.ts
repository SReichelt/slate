import * as vscode from 'vscode';
import * as Logic from 'slate-shared/logics/logic';
import { LibraryDocument, LibraryDocumentProvider } from '../data';

export class SlateDiagnosticsProvider {
    constructor(private libraryDocumentProvider: LibraryDocumentProvider) {}

    checkDocument(libraryDocument: LibraryDocument): void {
        if (libraryDocument.isSection) {
            return;
        }
        if (libraryDocument.document && libraryDocument.file.definitions.length) {
            const definition = libraryDocument.file.definitions[0];
            const checker = libraryDocument.documentLibraryDataProvider.logic.getChecker();
            const options: Logic.LogicCheckerOptions = {
                supportPlaceholders: true,
                supportRechecking: false,
                warnAboutMissingProofs: true
            };
            checker.checkDefinition(definition, libraryDocument.documentLibraryDataProvider, options).then((checkResult: Logic.LogicCheckResult) => {
                const diagnostics = checkResult.diagnostics.map((diagnostic: Logic.LogicCheckDiagnostic) =>
                    new vscode.Diagnostic(this.getRange(libraryDocument, diagnostic), diagnostic.message, this.getSeverity(diagnostic)));
                if (libraryDocument.document) {
                    libraryDocument.library.diagnosticCollection.set(libraryDocument.document.uri, diagnostics);
                }
            });
        }
    }

    private getRange(libraryDocument: LibraryDocument, diagnostic: Logic.LogicCheckDiagnostic): vscode.Range {
        const range = libraryDocument.rangeMap.get(diagnostic.object);
        if (range) {
            return range.range;
        } else {
            const dummyPosition = new vscode.Position(0, 0);
            return new vscode.Range(dummyPosition, dummyPosition);
        }
    }

    private getSeverity(diagnostic: Logic.LogicCheckDiagnostic): vscode.DiagnosticSeverity {
        switch (diagnostic.severity) {
        case Logic.DiagnosticSeverity.Error:
            return vscode.DiagnosticSeverity.Error;
        case Logic.DiagnosticSeverity.Warning:
            return vscode.DiagnosticSeverity.Warning;
        case Logic.DiagnosticSeverity.Information:
            return vscode.DiagnosticSeverity.Information;
        case Logic.DiagnosticSeverity.Hint:
            return vscode.DiagnosticSeverity.Hint;
        }
    }
}
