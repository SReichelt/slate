import * as Fmt from '../../../format/format';
import * as FmtUtils from '../../../format/utils';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import * as Macro from '../../macro';
import CachedPromise from '../../../data/cachedPromise';
import { HLMExpressionType } from '../hlm';

export class MatrixMacro implements HLMMacro.HLMMacro {
  name = 'matrix';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): MatrixMacroInstance {
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let variables: Fmt.ParameterList = contents.variables || Object.create(Fmt.ParameterList.prototype);
    let rows = variables.getParameter('rows');
    let columns = variables.getParameter('columns');
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let matrices = references.getValue('Matrices');
    return new MatrixMacroInstance(definition, rows, columns, matrices);
  }
}

class MatrixMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private rows: Fmt.Parameter, private columns: Fmt.Parameter, private matrices: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression): MatrixMacroInvocation {
    let items = expression.path.arguments.getValue('items') as Fmt.ArrayExpression;
    let matricesRef = utils.substitutePath(this.matrices, expression.path, [this.definition]);
    let rows = new Fmt.IntegerExpression;
    rows.value = new Fmt.BN(items.items.length);
    matricesRef = utils.substituteVariable(matricesRef, this.rows, () => rows);
    let columnCount = 0;
    if (items.items.length) {
      let firstRow = items.items[0] as Fmt.ArrayExpression;
      columnCount = firstRow.items.length;
      for (let row of items.items) {
        let arrayExpression = row as Fmt.ArrayExpression;
        if (arrayExpression.items.length !== columnCount) {
          throw new Error('Matrix rows must have the same length');
        }
      }
    }
    let columns = new Fmt.IntegerExpression;
    columns.value = new Fmt.BN(columnCount);
    matricesRef = utils.substituteVariable(matricesRef, this.columns, () => columns);
    return new MatrixMacroInvocation(expression, matricesRef, items);
  }
}

class MatrixMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(public expression: Fmt.DefinitionRefExpression, private matricesRef: Fmt.Expression, private items: Fmt.ArrayExpression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.matricesRef);
  }

  getArrayArgumentOperations(subExpression: Fmt.ArrayExpression): Macro.ArrayArgumentOperations | undefined {
    if (subExpression === this.items) {
      return new MatrixRowOperations(this.expression, this.items);
    } else if (this.items.items.length && subExpression === this.items.items[0]) {
      return new MatrixColumnOperations(this.expression, this.items);
    } else {
      return undefined;
    }
  }
}

class MatrixRowOperations implements Macro.ArrayArgumentOperations {
  constructor(private expression: Fmt.DefinitionRefExpression, private items: Fmt.ArrayExpression) {}

  insertItem(onCreateItem: () => Fmt.Expression | undefined): Fmt.DefinitionRefExpression {
    let newRowItems: Fmt.Expression[] = [];
    if (this.items.items.length) {
      let firstRow = this.items.items[0] as Fmt.ArrayExpression;
      for (let i = 0; i < firstRow.items.length; i++) {
        let newItem = onCreateItem();
        if (newItem) {
          newRowItems.push(newItem);
        }
      }
    }
    let newRow = new Fmt.ArrayExpression;
    newRow.items = newRowItems;
    let newItems = new Fmt.ArrayExpression;
    newItems.items = this.items.items.concat(newRow);
    return FmtUtils.substituteExpression(this.expression, this.items, newItems) as Fmt.DefinitionRefExpression;
  }
}

class MatrixColumnOperations implements Macro.ArrayArgumentOperations {
  constructor(private expression: Fmt.DefinitionRefExpression, private items: Fmt.ArrayExpression) {}

  insertItem(onCreateItem: () => Fmt.Expression | undefined): Fmt.DefinitionRefExpression {
    let newItems = new Fmt.ArrayExpression;
    newItems.items = this.items.items.map((row: Fmt.Expression) => {
      let oldRow = row as Fmt.ArrayExpression;
      let newItem = onCreateItem();
      if (newItem) {
        let newRow = new Fmt.ArrayExpression;
        newRow.items = oldRow.items.concat(newItem);
        return newRow;
      } else {
        return oldRow;
      }
    });
    return FmtUtils.substituteExpression(this.expression, this.items, newItems) as Fmt.DefinitionRefExpression;
  }
}
