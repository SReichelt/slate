import * as Fmt from '../format/format';
import * as Ctx from '../format/context';
import * as Meta from '../format/metaModel';
import * as Display from '../display/display';
import { LibraryDataProvider, LibraryDataAccessor, LibraryItemInfo } from '../data/libraryDataProvider';
import CachedPromise from '../data/cachedPromise';

export interface Logic {
  readonly name: string;
  readonly getMetaModel: Meta.MetaModelGetter;
  readonly topLevelDefinitionTypes: LogicDefinitionTypeDescription[];
  getRootContext(): Ctx.Context;
  getChecker(): LogicChecker;
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

export interface LogicDefinitionTypeDescription {
  readonly definitionType: LogicDefinitionType;
  readonly name: string;
  createTypeExpression(): Fmt.Expression;
  createObjectContents(): Fmt.ObjectContents;
}

export function createDefinition(definitionType: LogicDefinitionTypeDescription, name: string): Fmt.Definition {
  let definition = new Fmt.Definition;
  definition.name = name;
  definition.type = new Fmt.Type;
  definition.type.expression = definitionType.createTypeExpression();
  definition.type.arrayDimensions = 0;
  definition.contents = definitionType.createObjectContents();
  return definition;
}

export interface LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor): CachedPromise<LogicCheckResult>;
}

export interface LogicCheckResult {
  diagnostics: LogicCheckDiagnostic[];
  hasErrors: boolean;
}

export interface LogicCheckResultWithExpression extends LogicCheckResult {
  expression: Fmt.Expression;
}

export interface LogicCheckDiagnostic {
  object: Object;
  severity: DiagnosticSeverity;
  message: string;
}

export enum DiagnosticSeverity {
  Error,
  Warning,
  Information,
  Hint
}

export interface LogicRendererOptions {
  includeProofs: boolean;
  maxListLength?: number;
}

export interface LogicDisplay {
  getDefinitionType(definition: Fmt.Definition): LogicDefinitionType;
  getDefinitionRenderer(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File, options: LogicRendererOptions): LogicRenderer;
  getDefinitionEditor(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, templates: Fmt.File, options: LogicRendererOptions, editing: boolean): LogicRenderer;
}

export interface RenderedDefinitionOptions {
  includeLabel: boolean;
  includeExtras: boolean;
  includeRemarks: boolean;
}

export interface FullRenderedDefinitionOptions extends LogicRendererOptions, RenderedDefinitionOptions {}

export type RenderFn = () => Display.RenderedExpression;
export type ObjectRenderFns = Map<Object, RenderFn>;

export interface LogicRenderer {
  renderDefinition(itemInfo: CachedPromise<LibraryItemInfo> | undefined, options: RenderedDefinitionOptions): Display.RenderedExpression | undefined;
  renderDefinitionSummary(innerDefinition?: Fmt.Definition): Display.RenderedExpression | undefined;
  getDefinitionParts(): ObjectRenderFns;
  updateEditorState(onAutoFilled?: () => void): CachedPromise<void>;
}
