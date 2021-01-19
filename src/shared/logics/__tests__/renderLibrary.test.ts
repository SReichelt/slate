import { PhysicalFileAccessor } from 'slate-env-node/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDataProviderOptions, LibraryDefinition, LibraryItemInfo, formatItemNumber } from '../../data/libraryDataProvider';
import * as Fmt from '../../format/format';
import * as FmtReader from '../../format/read';
import * as FmtLibrary from '../library';
import * as FmtNotation from '../../notation/meta';
import * as Logic from '../logic';
import * as Logics from '../logics';
import { renderAsText, RenderAsTextOptions } from '../../notation/textOutput';
import CachedPromise from '../../data/cachedPromise';
import { fileExtension } from '../../data/constants';

async function checkSection(libraryDataProvider: LibraryDataProvider, templates: Fmt.File, sectionItemInfo: LibraryItemInfo) {
  const section = await libraryDataProvider.fetchLocalSection();
  const contents = section.definition.contents as FmtLibrary.ObjectContents_Section;
  let index = 0;
  for (const item of contents.items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
      const ref = item.ref as Fmt.DefinitionRefExpression;
      const itemInfo: LibraryItemInfo = {
        itemNumber: [...sectionItemInfo.itemNumber, index + 1],
        type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
        title: item.title
      };
      if (item instanceof FmtLibrary.MetaRefExpression_item) {
        const definition = await libraryDataProvider.fetchLocalItem(ref.path.name, true);
        const uri = libraryDataProvider.pathToURI(ref.path);
        await checkItem(libraryDataProvider, templates, itemInfo, definition, uri);
      } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
        const childProvider = await libraryDataProvider.getProviderForSection(ref.path);
        await checkSection(childProvider, templates, itemInfo);
      }
    }
    index++;
  }
}

const renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
  includeLabel: true,
  includeExtras: true,
  includeRemarks: true
};

async function checkItem(libraryDataProvider: LibraryDataProvider, templates: Fmt.File, itemInfo: LibraryItemInfo, definition: LibraryDefinition, uri: string) {
  const rendererOptions: Logic.LogicRendererOptions = {
    includeProofs: true
  };
  const renderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, templates, rendererOptions);
  const renderedDefinition = renderer.renderDefinition(CachedPromise.resolve(itemInfo), renderedDefinitionOptions);
  if (renderedDefinition) {
    const options: RenderAsTextOptions = {
      outputMarkdown: false,
      singleLine: false,
      allowEmptyLines: true
    };
    const renderedText = renderAsText(renderedDefinition, options);
    expect(renderedText).resolves.toMatchSnapshot(formatItemNumber(itemInfo.itemNumber) + ' ' + uri);
  }
}

test('render hlm library', async () => {
  jest.setTimeout(10000);
  const fileAccessor = new PhysicalFileAccessor;
  const libraryDataProviderOptions: LibraryDataProviderOptions = {
    logic: Logics.hlm,
    fileAccessor: fileAccessor.createChildAccessor('data/libraries/hlm'),
    watchForChanges: false,
    enablePrefetching: true,
    checkMarkdownCode: false,
    allowPlaceholders: false
  };
  const libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions);
  const templateFileReference = fileAccessor.openFile('data/notation/templates' + fileExtension, false);
  const templateFileContents = await templateFileReference.read();
  const templates = FmtReader.readString(templateFileContents, templateFileReference.fileName, FmtNotation.getMetaModel);
  await checkSection(libraryDataProvider, templates, {itemNumber: []});
  libraryDataProvider.close();
});
