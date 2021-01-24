import * as vscode from 'vscode';
import * as Logic from 'slate-shared/logics/logic';
import { getExpectedDiagnostics } from 'slate-shared/logics/diagnostics';
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
                const expectedDiagnostics = getExpectedDiagnostics(definition);
                const diagnostics = checkResult.diagnostics.map((diagnostic: Logic.LogicCheckDiagnostic) =>
                    this.createDiagnostic(libraryDocument, diagnostic, expectedDiagnostics));
                if (libraryDocument.document) {
                    libraryDocument.library.diagnosticCollection.set(libraryDocument.document.uri, diagnostics);
                }
            });
        }
    }

    private createDiagnostic(libraryDocument: LibraryDocument, diagnostic: Logic.LogicCheckDiagnostic, expectedDiagnostics: Logic.LogicCheckDiagnostic[]): vscode.Diagnostic {
        let message = diagnostic.message;
        const expectedDiagnosticIndex = expectedDiagnostics.findIndex((expectedDiagnostic: Logic.LogicCheckDiagnostic) => (expectedDiagnostic.severity === diagnostic.severity && expectedDiagnostic.message === diagnostic.message));
        if (expectedDiagnosticIndex >= 0) {
            expectedDiagnostics.splice(expectedDiagnosticIndex, 1);
            message = `[Expected] ${message}`;
        }
        return new vscode.Diagnostic(this.getRange(libraryDocument, diagnostic), message, this.getSeverity(diagnostic));
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
