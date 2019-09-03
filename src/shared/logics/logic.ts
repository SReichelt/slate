import * as Fmt from '../format/format';
import * as Ctx from '../format/context';
import * as Meta from '../format/metaModel';
import * as Display from '../display/display';
import { LibraryDataProvider, LibraryDataAccessor, LibraryItemInfo } from '../data/libraryDataProvider';
import CachedPromise from '../data/cachedPromise';

export interface Logic {
  name: string;
  getMetaModel: Meta.MetaModelGetter;
  getRootContext(): Ctx.Context;
  getChecker(): LogicChecker;
  getDisplay(): LogicDisplay;
}

export interface LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor): CachedPromise<LogicCheckResult>;
}

export interface LogicCheckResult {
  diagnostics: LogicCheckDiagnostic[];
  hasErrors: boolean;
}

export interface LogicCheckDiagnostic {
  object: Object;
  severity: DiagnosticSeverity;
  message: string;
}

export enum DiagnosticSeverity {
  Error,
  Warning
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
  getDefinitionRenderer(definition: Fmt.Definition, includeProofs: boolean, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File): LogicRenderer;
  getDefinitionEditor(definition: Fmt.Definition, includeProofs: boolean, libraryDataProvider: LibraryDataProvider, templates: Fmt.File, editing: boolean): LogicRenderer;
}

export type RenderFn = () => Display.RenderedExpression;
export type ObjectRenderFns = Map<Object, RenderFn>;

export interface LogicRenderer {
  renderDefinition(itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined;
  renderDefinitionSummary(innerDefinition?: Fmt.Definition): Display.RenderedExpression | undefined;
  getDefinitionParts(): ObjectRenderFns;
}
