import * as fs from 'fs';
import * as path from 'path';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtLibrary from '../shared/logics/library';
import * as Logic from '../shared/logics/logic';
import * as Logics from '../shared/logics/logics';
import { getExpectedDiagnostics } from '../shared/logics/diagnostics';
import { PhysicalFileAccessor } from '../fs/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDefinition, LibraryDataProviderOptions } from '../shared/data/libraryDataProvider';
import CachedPromise from '../shared/data/cachedPromise';

let errorCount = 0;
let warningCount = 0;
let unexpectedError = false;

const logicCheckerOptions: Logic.LogicCheckerOptions = {
  supportPlaceholders: false,
  supportRechecking: false,
  warnAboutMissingProofs: false
};

function checkLibrary(fileName: string): CachedPromise<void> {
  let fileStr = fs.readFileSync(fileName, 'utf8');
  let file = FmtReader.readString(fileStr, fileName, FmtLibrary.getMetaModel);
  let contents = file.definitions[0].contents as FmtLibrary.ObjectContents_Library;
  let baseName = path.basename(fileName);
  let libraryName = baseName.substring(0, baseName.length - path.extname(baseName).length);
  let libraryDataProviderOptions: LibraryDataProviderOptions = {
    logic: Logics.findLogic(contents.logic)!,
    fileAccessor: new PhysicalFileAccessor(path.dirname(fileName)),
    watchForChanges: false,
    checkMarkdownCode: true,
    allowPlaceholders: false
  };
  let libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions, libraryName);
  return libraryDataProvider.fetchLocalSection().then((definition: LibraryDefinition) => checkSection(definition, libraryDataProvider));
}

function checkSection(definition: LibraryDefinition, libraryDataProvider: LibraryDataProvider): CachedPromise<void> {
  let promise = CachedPromise.resolve();
  let contents = definition.definition.contents as FmtLibrary.ObjectContents_Section;
  for (let item of contents.items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item) {
      let ref = item.ref as Fmt.DefinitionRefExpression;
      promise = promise.then(() =>
        libraryDataProvider.fetchItem(ref.path, true).then((itemDefinition: LibraryDefinition) =>
          checkItem(itemDefinition, libraryDataProvider)));
    } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
      let ref = item.ref as Fmt.DefinitionRefExpression;
      let subsectionDataProvider = libraryDataProvider.getProviderForSection(ref.path);
      promise = promise.then(() =>
        subsectionDataProvider.fetchLocalSection().then((subsectionDefinition: LibraryDefinition) =>
          checkSection(subsectionDefinition, subsectionDataProvider)));
    }
  }
  return promise;
}

function checkItem(libraryDefinition: LibraryDefinition, libraryDataProvider: LibraryDataProvider): CachedPromise<void> {
  let definition = libraryDefinition.definition;
  let checker = libraryDataProvider.logic.getChecker();
  return checker.checkDefinition(definition, libraryDataProvider, logicCheckerOptions).then((checkResult: Logic.LogicCheckResult) => {
    let expectedDiagnostics = getExpectedDiagnostics(definition);
    for (let {message, severity} of checkResult.diagnostics) {
      let expectedDiagnosticIndex = expectedDiagnostics.findIndex((diagnostic: Logic.LogicCheckDiagnostic) => (diagnostic.severity === severity && diagnostic.message === message));
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
      if (expectedDiagnosticIndex >= 0) {
        prefix += ' (expected)';
      }
      message = `${prefix}: ${message}`;
      if (libraryDefinition.fileReference) {
        message = `${libraryDefinition.fileReference.fileName}: ${message}`;
      }
      console.error(message);
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

let libraryFileName = process.argv[2];
checkLibrary(libraryFileName)
  .then(() => {
    console.error(`Found ${errorCount} error(s) and ${warningCount} warning(s).`);
    process.exit(unexpectedError ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
