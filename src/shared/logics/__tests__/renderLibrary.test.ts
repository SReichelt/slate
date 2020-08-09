import { PhysicalFileAccessor } from '../../../fs/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, formatItemNumber, defaultLibraryDataProviderConfig } from '../../data/libraryDataProvider';
import * as Fmt from '../../format/format';
import * as FmtReader from '../../format/read';
import * as FmtLibrary from '../library';
import * as FmtNotation from '../../notation/meta';
import * as Logic from '../logic';
import * as Logics from '../logics';
import { renderAsText, RenderAsTextOptions } from '../../notation/textOutput';
import CachedPromise from '../../data/cachedPromise';

async function checkSection(libraryDataProvider: LibraryDataProvider, templates: Fmt.File, sectionItemInfo: LibraryItemInfo) {
  let section = await libraryDataProvider.fetchLocalSection();
  let contents = section.definition.contents as FmtLibrary.ObjectContents_Section;
  let index = 0;
  for (let item of contents.items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
      let itemInfo: LibraryItemInfo = {
        itemNumber: [...sectionItemInfo.itemNumber, index + 1],
        type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
        title: item.title
      };
      if (item instanceof FmtLibrary.MetaRefExpression_item) {
        let ref = item.ref as Fmt.DefinitionRefExpression;
        let definition = await libraryDataProvider.fetchLocalItem(ref.path.name, true);
        let uri = libraryDataProvider.pathToURI(ref.path);
        await checkItem(libraryDataProvider, templates, itemInfo, definition, uri);
      } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
        let ref = item.ref as Fmt.DefinitionRefExpression;
        let childProvider = await libraryDataProvider.getProviderForSection(ref.path);
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
  let rendererOptions: Logic.LogicRendererOptions = {
    includeProofs: true
  };
  let renderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, templates, rendererOptions);
  let renderedDefinition = renderer.renderDefinition(CachedPromise.resolve(itemInfo), renderedDefinitionOptions);
  if (renderedDefinition) {
    let options: RenderAsTextOptions = {
      outputMarkdown: false,
      singleLine: false,
      allowEmptyLines: true,
      indent: ''
    };
    let renderedText = renderAsText(renderedDefinition, options);
    expect(renderedText).resolves.toMatchSnapshot(formatItemNumber(itemInfo.itemNumber) + ' ' + uri);
  }
}

test('render hlm library', async () => {
  jest.setTimeout(10000);
  let fileAccessor = new PhysicalFileAccessor();
  let templateFileReference = fileAccessor.openFile('data/notation/templates.slate', false);
  let templateFileContents = await templateFileReference.read();
  let templates = await FmtReader.readString(templateFileContents, templateFileReference.fileName, FmtNotation.getMetaModel);
  let libraryDataProvider = new LibraryDataProvider(Logics.hlm, fileAccessor, 'data/libraries/hlm', defaultLibraryDataProviderConfig, 'Library');
  await checkSection(libraryDataProvider, templates, {itemNumber: []});
});
