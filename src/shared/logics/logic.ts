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
  Predicate,
  Theorem
}

export interface LogicDisplay {
  getDefinitionType(definition: Fmt.Definition): LogicDefinitionType;
  getDefinitionRenderer(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File, editing: boolean): LogicRenderer;
}

export type RenderFn = () => Display.RenderedExpression;

export interface LogicRenderer {
  renderDefinition(itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeProofs: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined;
  renderDefinitionSummary(): Display.RenderedExpression | undefined;
  getDefinitionParts(includeProofs: boolean): Map<Object, RenderFn>;
}
