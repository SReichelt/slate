import { PhysicalFileAccessor } from '../../../fs/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, formatItemNumber } from '../../data/libraryDataProvider';
import * as Fmt from '../../format/format';
import * as FmtReader from '../../format/read';
import * as FmtLibrary from '../library';
import * as FmtDisplay from '../../display/meta';
import * as Logic from '../logic';
import * as Logics from '../logics';
import { renderAsText } from '../../display/textOutput';
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
        let definition = await libraryDataProvider.fetchLocalItem(ref.path.name);
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

async function checkItem(libraryDataProvider: LibraryDataProvider, templates: Fmt.File, itemInfo: LibraryItemInfo, definition: LibraryDefinition, uri: string) {
  let rendererOptions: Logic.LogicRendererOptions = {
    includeProofs: true
  };
  let renderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, templates, rendererOptions);
  let renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
    includeLabel: true,
    includeExtras: true,
    includeRemarks: true
  };
  let renderedDefinition = renderer.renderDefinition(CachedPromise.resolve(itemInfo), renderedDefinitionOptions);
  if (renderedDefinition) {
    let renderedText = renderAsText(renderedDefinition, false, false);
    expect(renderedText).resolves.toMatchSnapshot(formatItemNumber(itemInfo.itemNumber) + ' ' + uri);
  }
}

test('render hlm library', async () => {
  let fileAccessor = new PhysicalFileAccessor();
  let templateFileName = 'data/display/templates.slate';
  let templateFile = await fileAccessor.readFile(templateFileName);
  let templates = await FmtReader.readString(templateFile.text, templateFileName, FmtDisplay.getMetaModel);
  let libraryDataProvider = new LibraryDataProvider(Logics.hlm, fileAccessor, 'data/libraries/hlm', undefined, 'Library');
  await checkSection(libraryDataProvider, templates, {itemNumber: []});
});
