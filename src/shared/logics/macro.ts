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
  invoke(utils: Utils, expression: Fmt.DefinitionRefExpression): T;
}

export interface MacroInvocation {
  expression: Fmt.DefinitionRefExpression;
  check(): CachedPromise<Logic.LogicCheckDiagnostic[]>;
  getArrayArgumentOperations?(subExpression: Fmt.ArrayExpression): ArrayArgumentOperations | undefined;
}

export interface ArrayArgumentOperations {
  insertItem(onCreateItem: () => Fmt.Expression | undefined): Fmt.DefinitionRefExpression | undefined;
}

export class DefaultArrayArgumentOperations implements ArrayArgumentOperations {
  constructor(private expression: Fmt.DefinitionRefExpression, private subExpression: Fmt.ArrayExpression) {}

  insertItem(onCreateItem: () => Fmt.Expression | undefined): Fmt.DefinitionRefExpression | undefined {
    // TODO display placeholder menu if applicable, instead of inserting placeholder
    let newItem = onCreateItem();
    if (newItem) {
      let newSubExpression = new Fmt.ArrayExpression;
      newSubExpression.items = this.subExpression.items.concat(newItem);
      return FmtUtils.substituteExpression(this.expression, this.subExpression, newSubExpression) as Fmt.DefinitionRefExpression;
    } else {
      return undefined;
    }
  }
}
