import * as Fmt from '../format/format';
import * as Display from '../display/display';
import { LibraryDataAccessor, LibraryItemInfo } from '../data/libraryDataAccessor';
import CachedPromise from '../data/cachedPromise';

export interface Logic {
  getMetaModel: Fmt.MetaModelGetter;
  getDisplay(): LogicDisplay;
}

export enum LogicDefinitionType {
  Unknown,
  Construction,
  Constructor,
  SetOperator,
  Operator,
  Predicate,
  Theorem
}

export interface LogicDisplay {
  getDefinitionType(definition: Fmt.Definition): LogicDefinitionType;
  getRenderer(libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File): LogicRenderer;
}

export interface LogicRenderer {
  renderDefinition(definition: Fmt.Definition, itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeProofs: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined;
  renderDefinitionSummary(definition: Fmt.Definition): Display.RenderedExpression | undefined;
}
