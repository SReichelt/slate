import * as Fmt from '../format/format';
import * as Display from '../display/display';
import { LibraryDataAccessor, LibraryItemInfo } from '../data/libraryDataAccessor';
import CachedPromise from '../data/cachedPromise';

export interface Logic {
  name: string;
  getMetaModel: Fmt.MetaModelGetter;
  getDisplay(): LogicDisplay;
}

export enum LogicDefinitionType {
  Unknown,
  Construction,
  Constructor,
  SetOperator,
  Operator,
  SymbolOperator,
  Predicate,
  Theorem
}

export interface LogicDisplay {
  getDefinitionType(definition: Fmt.Definition): LogicDefinitionType;
  getDefinitionRenderer(definition: Fmt.Definition, includeProofs: boolean, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File, editing: boolean): LogicRenderer;
}

export type RenderFn = () => Display.RenderedExpression;
export type ObjectRenderFns = Map<Object, RenderFn>;

export interface LogicRenderer {
  renderDefinition(itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined;
  renderDefinitionSummary(): Display.RenderedExpression | undefined;
  getDefinitionParts(): ObjectRenderFns;
}
