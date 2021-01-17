import * as Fmt from '../format/format';
import * as FmtUtils from '../format/utils';
import * as Logic from './logic';
import { LibraryDataAccessor } from '../data/libraryDataAccessor';
import { GenericUtils } from './generic/utils';
import CachedPromise from '../data/cachedPromise';

export interface Macro<T extends MacroInstance<MacroInvocation, GenericUtils>> {
  name: string;
  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): T;
}

export interface MacroInstance<T extends MacroInvocation, Utils extends GenericUtils> {
  check(): CachedPromise<Logic.LogicCheckDiagnostic[]>;
  invoke(utils: Utils, expression: Fmt.DefinitionRefExpression, config: MacroInvocationConfig): T;
}

export interface MacroInvocationConfig {
  getNumberExpression(value: number, onSetValue?: (newValue: number) => void): Fmt.Expression;
  createArgumentExpression?(param: Fmt.Parameter): Fmt.Expression | undefined;
}

export class DefaultMacroInvocationConfig implements MacroInvocationConfig {
  getNumberExpression(value: number): Fmt.Expression {
    return new Fmt.IntegerExpression(BigInt(value));
  }
}

export interface MacroInvocation {
  expression: Fmt.DefinitionRefExpression;
  check(): CachedPromise<Logic.LogicCheckDiagnostic[]>;
  getArrayArgumentOperations?(subExpression: Fmt.ArrayExpression): ArrayArgumentOperations | undefined;
}

export interface ArrayArgumentOperations {
  insertItem(): Fmt.DefinitionRefExpression | undefined;
}

export class DefaultArrayArgumentOperations implements ArrayArgumentOperations {
  constructor(private config: MacroInvocationConfig, private param: Fmt.Parameter, private expression: Fmt.DefinitionRefExpression, private subExpression: Fmt.ArrayExpression) {}

  insertItem(): Fmt.DefinitionRefExpression | undefined {
    // TODO (low priority) display placeholder menu if applicable, instead of inserting placeholder
    let newItem = this.config.createArgumentExpression?.(this.param);
    if (newItem) {
      let newSubExpression = new Fmt.ArrayExpression(this.subExpression.items.concat(newItem));
      return FmtUtils.substituteExpression<Fmt.Expression>(this.expression, this.subExpression, newSubExpression) as Fmt.DefinitionRefExpression;
    } else {
      return undefined;
    }
  }
}
