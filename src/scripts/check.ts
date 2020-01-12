import * as fs from 'fs';
import * as path from 'path';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtLibrary from '../shared/logics/library';
import * as Logic from '../shared/logics/logic';
import * as Logics from '../shared/logics/logics';
import { PhysicalFileAccessor } from '../fs/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDefinition } from '../shared/data/libraryDataProvider';
import CachedPromise from '../shared/data/cachedPromise';

let fileAccessor = new PhysicalFileAccessor;

function checkLibrary(fileName: string): CachedPromise<boolean> {
  let fileStr = fs.readFileSync(fileName, 'utf8');
  let file = FmtReader.readString(fileStr, fileName, FmtLibrary.getMetaModel);
  let contents = file.definitions[0].contents as FmtLibrary.ObjectContents_Library;
  let logic = Logics.findLogic(contents.logic)!;
  let baseName = path.basename(fileName);
  let libraryName = baseName.substring(0, baseName.length - path.extname(baseName).length);
  let libraryDataProvider = new LibraryDataProvider(logic, fileAccessor, path.dirname(fileName), undefined, false, libraryName);
  return libraryDataProvider.fetchLocalSection().then((definition: LibraryDefinition) => checkSection(definition, libraryDataProvider));
}

function checkSection(definition: LibraryDefinition, libraryDataProvider: LibraryDataProvider): CachedPromise<boolean> {
  let promise = CachedPromise.resolve(true);
  let contents = definition.definition.contents as FmtLibrary.ObjectContents_Section;
  for (let item of contents.items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item) {
      let ref = item.ref as Fmt.DefinitionRefExpression;
      promise = promise.then((currentResult: boolean) =>
        libraryDataProvider.fetchItem(ref.path, true)
          .then((itemDefinition: LibraryDefinition) => checkItem(itemDefinition, libraryDataProvider, ref.path))
          .then((itemResult: boolean) => currentResult && itemResult));
    } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
      let ref = item.ref as Fmt.DefinitionRefExpression;
      let subsectionDataProvider = libraryDataProvider.getProviderForSection(ref.path);
      promise = promise.then((currentResult: boolean) =>
        subsectionDataProvider.fetchLocalSection()
          .then((subsectionDefinition: LibraryDefinition) => checkSection(subsectionDefinition, subsectionDataProvider))
          .then((itemResult: boolean) => currentResult && itemResult));
    }
  }
  return promise;
}

function checkItem(definition: LibraryDefinition, libraryDataProvider: LibraryDataProvider, itemPath: Fmt.Path): CachedPromise<boolean> {
  let checker = libraryDataProvider.logic.getChecker();
  return checker.checkDefinition(definition.definition, libraryDataProvider).then((checkResult: Logic.LogicCheckResult) => {
    let result = true;
    for (let diagnostic of checkResult.diagnostics) {
      let severity = 'Unknown';
      switch (diagnostic.severity) {
      case Logic.DiagnosticSeverity.Error:
        severity = 'Error';
        result = false;
        break;
      case Logic.DiagnosticSeverity.Warning:
        severity = 'Warning';
        break;
      case Logic.DiagnosticSeverity.Information:
        severity = 'Information';
        break;
      case Logic.DiagnosticSeverity.Hint:
        severity = 'Hint';
        break;
      }
      console.error(`${libraryDataProvider.pathToURI(itemPath)}: ${severity}: ${diagnostic.message}`);
    }
    return result;
  });
}

if (process.argv.length !== 3) {
  console.error('usage: src/scripts/check.sh <libraryFile>');
  process.exit(2);
}

let libraryFileName = process.argv[2];
checkLibrary(libraryFileName)
  .then((result: boolean) => process.exit(result ? 0 : 1))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
