import * as fs from 'fs';
import * as path from 'path';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtLibrary from 'slate-shared/logics/library';
import * as Logic from 'slate-shared/logics/logic';
import * as Logics from 'slate-shared/logics/logics';
import { getExpectedDiagnostics } from 'slate-shared/logics/diagnostics';
import { PhysicalFileAccessor } from 'slate-env-node/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDefinition, LibraryDataProviderOptions } from 'slate-shared/data/libraryDataProvider';
import CachedPromise from 'slate-shared/data/cachedPromise';

let errorCount = 0;
let warningCount = 0;
let unexpectedError = false;

const logicCheckerOptions: Logic.LogicCheckerOptions = {
  supportPlaceholders: false,
  supportRechecking: false,
  warnAboutMissingProofs: false
};

function checkLibrary(fileName: string): CachedPromise<void> {
  const fileStr = fs.readFileSync(fileName, 'utf8');
  const file = FmtReader.readString(fileStr, fileName, FmtLibrary.getMetaModel);
  const contents = file.definitions[0].contents as FmtLibrary.ObjectContents_Library;
  const baseName = path.basename(fileName);
  const libraryName = baseName.substring(0, baseName.length - path.extname(baseName).length);
  const libraryDataProviderOptions: LibraryDataProviderOptions = {
    logic: Logics.findLogic(contents.logic)!,
    fileAccessor: new PhysicalFileAccessor(path.dirname(fileName)),
    enablePrefetching: true,
    watchForChanges: false,
    checkMarkdownCode: true,
    allowPlaceholders: false
  };
  const libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions, libraryName);
  return libraryDataProvider.fetchLocalSection()
    .then((definition: LibraryDefinition) => checkSection(definition, libraryDataProvider))
    .then(() => libraryDataProvider.close());
}

function checkSection(definition: LibraryDefinition, libraryDataProvider: LibraryDataProvider): CachedPromise<void> {
  let promise = CachedPromise.resolve();
  const contents = definition.definition.contents as FmtLibrary.ObjectContents_Section;
  for (const item of contents.items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item) {
      const ref = item.ref as Fmt.DefinitionRefExpression;
      promise = promise.then(() =>
        libraryDataProvider.fetchItem(ref.path, true).then((itemDefinition: LibraryDefinition) =>
          checkItem(itemDefinition, libraryDataProvider)));
    } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
      const ref = item.ref as Fmt.DefinitionRefExpression;
      const subsectionDataProvider = libraryDataProvider.getProviderForSection(ref.path);
      promise = promise.then(() =>
        subsectionDataProvider.fetchLocalSection().then((subsectionDefinition: LibraryDefinition) =>
          checkSection(subsectionDefinition, subsectionDataProvider)));
    }
  }
  return promise;
}

function checkItem(libraryDefinition: LibraryDefinition, libraryDataProvider: LibraryDataProvider): CachedPromise<void> {
  const definition = libraryDefinition.definition;
  const checker = libraryDataProvider.logic.getChecker();
  return checker.checkDefinition(definition, libraryDataProvider, logicCheckerOptions).then((checkResult: Logic.LogicCheckResult) => {
    const expectedDiagnostics = getExpectedDiagnostics(definition);
    for (const {message, severity} of checkResult.diagnostics) {
      const expectedDiagnosticIndex = expectedDiagnostics.findIndex((diagnostic: Logic.LogicCheckDiagnostic) => (diagnostic.severity === severity && diagnostic.message === message));
      if (expectedDiagnosticIndex >= 0) {
        expectedDiagnostics.splice(expectedDiagnosticIndex, 1);
      }
      let prefix = 'Unknown';
      switch (severity) {
      case Logic.DiagnosticSeverity.Error:
        prefix = 'Error';
        if (expectedDiagnosticIndex < 0) {
          unexpectedError = true;
        }
        errorCount++;
        break;
      case Logic.DiagnosticSeverity.Warning:
        prefix = 'Warning';
        warningCount++;
        break;
      case Logic.DiagnosticSeverity.Information:
        prefix = 'Information';
        break;
      case Logic.DiagnosticSeverity.Hint:
        prefix = 'Hint';
        break;
      }
      let fullMessage = `${prefix}: ${message}`;
      if (libraryDefinition.fileReference) {
        fullMessage = `${libraryDefinition.fileReference.fileName}: ${fullMessage}`;
      }
      if (expectedDiagnosticIndex >= 0) {
        fullMessage = `[Expected] ${fullMessage}`;
      }
      console.error(fullMessage);
    }
    for (let {message} of expectedDiagnostics) {
      message = `Warning: Expected diagnostic not found: ${message}`;
      warningCount++;
      if (libraryDefinition.fileReference) {
        message = `${libraryDefinition.fileReference.fileName}: ${message}`;
      }
      console.error(message);
    }
  });
}

if (process.argv.length !== 3) {
  console.error('usage: src/scripts/check.sh <libraryFile>');
  process.exit(2);
}

const libraryFileName = process.argv[2];
checkLibrary(libraryFileName)
  .then(() => {
    console.error(`Found ${errorCount} error(s) and ${warningCount} warning(s).`);
    process.exit(unexpectedError ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
