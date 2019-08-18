import * as fs from 'fs';
import * as path from 'path';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtLibrary from '../shared/logics/library';
import * as Logic from '../shared/logics/logic';
import * as Logics from '../shared/logics/logics';
import { PhysicalFileAccessor } from '../fs/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDataAccessor } from '../shared/data/libraryDataProvider';
import CachedPromise from '../shared/data/cachedPromise';

let fileAccessor = new PhysicalFileAccessor;

function checkLibrary(fileName: string): CachedPromise<void> {
  let fileStr = fs.readFileSync(fileName, 'utf8');
  let file = FmtReader.readString(fileStr, fileName, FmtLibrary.getMetaModel);
  let contents = file.definitions[0].contents as FmtLibrary.ObjectContents_Library;
  let logic = Logics.findLogic(contents.logic)!;
  let baseName = path.basename(fileName);
  let libraryName = baseName.substring(0, baseName.length - path.extname(baseName).length);
  let libraryDataProvider = new LibraryDataProvider(logic, fileAccessor, path.dirname(fileName), undefined, libraryName);
  let checker = logic.getChecker();
  return libraryDataProvider.fetchLocalSection().then((definition: Fmt.Definition) => checkSection(definition, libraryDataProvider, checker));
}

function checkSection(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, checker: Logic.LogicChecker): CachedPromise<void> {
  let promise = CachedPromise.resolve();
  let contents = definition.contents as FmtLibrary.ObjectContents_Section;
  if (contents.items instanceof Fmt.ArrayExpression) {
    for (let item of contents.items.items) {
      if (item instanceof FmtLibrary.MetaRefExpression_item) {
        let ref = item.ref as Fmt.DefinitionRefExpression;
        promise = promise
          .then(() => libraryDataProvider.fetchItem(ref.path))
          .then((itemDefinition: Fmt.Definition) => checkItem(itemDefinition, libraryDataProvider, ref.path, checker));
      } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
        let ref = item.ref as Fmt.DefinitionRefExpression;
        let subsectionDataProvider = libraryDataProvider.getProviderForSection(ref.path);
        promise = promise
          .then(() => subsectionDataProvider.fetchLocalSection())
          .then((subsectionDefinition: Fmt.Definition) => checkSection(subsectionDefinition, subsectionDataProvider, checker));
      }
    }
  }
  return promise;
}

function checkItem(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, itemPath: Fmt.Path, checker: Logic.LogicChecker): CachedPromise<void> {
  return checker.checkDefinition(definition, libraryDataProvider).then((checkResult: Logic.LogicCheckResult) => {
    for (let diagnostic of checkResult.diagnostics) {
      let severity = 'Unknown';
      switch (diagnostic.severity) {
      case Logic.DiagnosticSeverity.Error:
        severity = 'Error';
        break;
      case Logic.DiagnosticSeverity.Warning:
        severity = 'Warning';
        break;
      }
      console.error(`${libraryDataProvider.pathToURI(itemPath)}: ${severity}: ${diagnostic.message}`);
    }
  });
}

if (process.argv.length !== 3) {
  console.error('usage: src/scripts/check.sh <libraryFile>');
  process.exit(1);
}

let libraryFileName = process.argv[2];
checkLibrary(libraryFileName);
