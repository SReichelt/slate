import { PhysicalFileAccessor } from '../../../fs/data/physicalFileAccessor';
import { LibraryDataProvider } from '../../data/libraryDataProvider';
import { LibraryItemInfo, formatItemNumber } from '../../data/libraryDataAccessor';
import * as Fmt from '../../format/format';
import * as FmtReader from '../../format/read';
import * as FmtLibrary from '../library';
import * as FmtDisplay from '../../display/meta';
import * as Logics from '../logics';
import { renderAsText } from '../../display/textOutput';
import CachedPromise from '../../data/cachedPromise';

async function checkSection(libraryDataProvider: LibraryDataProvider, templates: Fmt.File, sectionItemInfo: LibraryItemInfo) {
  let section = await libraryDataProvider.fetchLocalSection();
  let contents = section.contents as FmtLibrary.ObjectContents_Section;
  if (contents.items instanceof Fmt.ArrayExpression) {
    let index = 0;
    for (let item of contents.items.items) {
      if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
        let itemInfo: LibraryItemInfo = {
          itemNumber: [...sectionItemInfo.itemNumber, index + 1],
          type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
          title: item.title
        };
        if (item instanceof FmtLibrary.MetaRefExpression_item) {
          let ref = item.ref as Fmt.DefinitionRefExpression;
          let definition = await libraryDataProvider.fetchLocalItem(ref.path.name);
          let renderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition, true, libraryDataProvider, templates, false);
          let renderedDefinition = renderer.renderDefinition(CachedPromise.resolve(itemInfo), true, true, true);
          if (renderedDefinition) {
            let renderedText = renderAsText(renderedDefinition, false, false);
            expect(renderedText).resolves.toMatchSnapshot(formatItemNumber(itemInfo.itemNumber) + ' ' + libraryDataProvider.pathToURI(ref.path));
          }
        } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
          let ref = item.ref as Fmt.DefinitionRefExpression;
          let childProvider = await libraryDataProvider.getProviderForSection(ref.path);
          await checkSection(childProvider, templates, itemInfo);
        }
      }
      index++;
    }
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
