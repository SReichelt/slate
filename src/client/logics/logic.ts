import * as Fmt from '../../shared/format/format';
import * as Display from '../../shared/display/display';
import { LibraryDataAccessor, LibraryItemInfo } from '../../shared/data/libraryDataAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export interface Logic {
  getMetaModel: Fmt.MetaModelGetter;
  getDisplay(): LogicDisplay;
}

export interface LogicDisplay {
  getDefinitionIcon(definition: Fmt.Definition, itemInfo: LibraryItemInfo): any;
  getRenderer(libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File): LogicRenderer;
}

export interface LogicRenderer {
  renderDefinition(definition: Fmt.Definition, itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeProofs: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined;
  renderDefinitionSummary(definition: Fmt.Definition): Display.RenderedExpression | undefined;
}
