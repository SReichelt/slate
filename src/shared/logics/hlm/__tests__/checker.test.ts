import { PhysicalFileAccessor } from 'slate-env-node/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDataProviderOptions, LibraryDefinition } from '../../../data/libraryDataProvider';
import * as Fmt from '../../../format/format';
import * as FmtLibrary from '../../library';
import * as Logic from '../../logic';
import * as Logics from '../../logics';
import { getExpectedDiagnostics, adaptDiagnosticsForComparison } from '../../diagnostics';

async function checkSection(libraryDataProvider: LibraryDataProvider) {
  let section = await libraryDataProvider.fetchLocalSection();
  let contents = section.definition.contents as FmtLibrary.ObjectContents_Section;
  for (let item of contents.items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item) {
      let ref = item.ref as Fmt.DefinitionRefExpression;
      let libraryDefinition = await libraryDataProvider.fetchLocalItem(ref.path.name, true);
      await checkItem(libraryDataProvider, libraryDefinition);
    } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
      let ref = item.ref as Fmt.DefinitionRefExpression;
      let childProvider = await libraryDataProvider.getProviderForSection(ref.path);
      await checkSection(childProvider);
    }
  }
}

async function checkItem(libraryDataProvider: LibraryDataProvider, libraryDefinition: LibraryDefinition) {
  let definition = libraryDefinition.definition;
  let checker = libraryDataProvider.logic.getChecker();
  let options: Logic.LogicCheckerOptions = {
    supportPlaceholders: false,
    supportRechecking: false,
    warnAboutMissingProofs: true
  };
  let checkResult = await checker.checkDefinition(definition, libraryDataProvider, options);
  let expectedDiagnostics = getExpectedDiagnostics(definition);
  let actualDiagnostics = adaptDiagnosticsForComparison(checkResult.diagnostics, definition);
  expect(actualDiagnostics).toEqual(expectedDiagnostics);
}

test('run checker test suite', async () => {
  let libraryDataProviderOptions: LibraryDataProviderOptions = {
    logic: Logics.hlm,
    fileAccessor: new PhysicalFileAccessor('src/shared/logics/hlm/__tests__/data'),
    watchForChanges: false,
    enablePrefetching: true,
    checkMarkdownCode: false,
    allowPlaceholders: false
  };
  let libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions);
  await checkSection(libraryDataProvider);
  libraryDataProvider.close();
});
