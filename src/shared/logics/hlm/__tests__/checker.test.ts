import { PhysicalFileAccessor } from 'slate-env-node/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDataProviderOptions, LibraryDefinition } from '../../../data/libraryDataProvider';
import * as Fmt from '../../../format/format';
import * as FmtLibrary from '../../library';
import * as Logic from '../../logic';
import * as Logics from '../../logics';
import { getExpectedDiagnostics, adaptDiagnosticsForComparison } from '../../diagnostics';

async function checkSection(libraryDataProvider: LibraryDataProvider) {
  const section = await libraryDataProvider.fetchLocalSection();
  const contents = section.definition.contents as FmtLibrary.ObjectContents_Section;
  for (const item of contents.items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item) {
      const ref = item.ref as Fmt.DefinitionRefExpression;
      const libraryDefinition = await libraryDataProvider.fetchLocalItem(ref.path.name, true);
      await checkItem(libraryDataProvider, libraryDefinition);
    } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
      const ref = item.ref as Fmt.DefinitionRefExpression;
      const childProvider = await libraryDataProvider.getProviderForSection(ref.path);
      await checkSection(childProvider);
    }
  }
}

async function checkItem(libraryDataProvider: LibraryDataProvider, libraryDefinition: LibraryDefinition) {
  const definition = libraryDefinition.definition;
  const checker = libraryDataProvider.logic.getChecker();
  const options: Logic.LogicCheckerOptions = {
    supportPlaceholders: false,
    supportRechecking: false,
    warnAboutMissingProofs: true
  };
  const checkResult = await checker.checkDefinition(definition, libraryDataProvider, options);
  const expectedDiagnostics = getExpectedDiagnostics(definition);
  const actualDiagnostics = adaptDiagnosticsForComparison(checkResult.diagnostics, definition);
  expect(actualDiagnostics).toEqual(expectedDiagnostics);
}

test('run checker test suite', async () => {
  const libraryDataProviderOptions: LibraryDataProviderOptions = {
    logic: Logics.hlm,
    fileAccessor: new PhysicalFileAccessor('src/shared/logics/hlm/__tests__/data'),
    watchForChanges: false,
    enablePrefetching: true,
    checkMarkdownCode: false,
    allowPlaceholders: false
  };
  const libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions);
  await checkSection(libraryDataProvider);
  libraryDataProvider.close();
});
