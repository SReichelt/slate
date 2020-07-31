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
    let itemsParam = definition.parameters.getParameter('items');
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let variables: Fmt.ParameterList = contents.variables || Object.create(Fmt.ParameterList.prototype);
    let rows = variables.getParameter('rows');
    let columns = variables.getParameter('columns');
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let matrices = references.getValue('Matrices');
    return new MatrixMacroInstance(definition, itemsParam, rows, columns, matrices);
  }
}

class MatrixMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private itemsParam: Fmt.Parameter, private rows: Fmt.Parameter, private columns: Fmt.Parameter, private matrices: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression, config: Macro.MacroInvocationConfig): MatrixMacroInvocation {
    let items = expression.path.arguments.getValue(this.itemsParam.name) as Fmt.ArrayExpression;
    let matricesRef = utils.substitutePath(this.matrices, expression.path, [this.definition]);
    let onSetRowCount = (newRowCount: number) => {
      if (items.items.length > newRowCount) {
        items.items.length = newRowCount;
      } else {
        while (items.items.length < newRowCount) {
          let newItem = MatrixRowOperations.createRow(config, this.itemsParam, items);
          if (newItem) {
            items.items.push(newItem);
          } else {
            break;
          }
        }
      }
    };
    matricesRef = FmtUtils.substituteVariable(matricesRef, this.rows, config.getNumberExpression(items.items.length, onSetRowCount));
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
    let onSetColumnCount = (newColumnCount: number) => {
      for (let row of items.items) {
        let rowExpression = row as Fmt.ArrayExpression;
        if (rowExpression.items.length > newColumnCount) {
          rowExpression.items.length = newColumnCount;
        } else {
          while (rowExpression.items.length < newColumnCount) {
            let newItem = config.createArgumentExpression?.(this.itemsParam);
            if (newItem) {
              rowExpression.items.push(newItem);
            } else {
              break;
            }
          }
        }
      }
    };
    matricesRef = FmtUtils.substituteVariable(matricesRef, this.columns, config.getNumberExpression(columnCount, onSetColumnCount));
    return new MatrixMacroInvocation(expression, config, this.itemsParam, matricesRef, items);
  }
}

class MatrixMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(public expression: Fmt.DefinitionRefExpression, private config: Macro.MacroInvocationConfig, private itemsParam: Fmt.Parameter, private matricesRef: Fmt.Expression, private items: Fmt.ArrayExpression) {}

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
      return new MatrixRowOperations(this.config, this.itemsParam, this.expression, this.items);
    } else if (this.items.items.length && subExpression === this.items.items[0]) {
      return new MatrixColumnOperations(this.config, this.itemsParam, this.expression, this.items);
    } else {
      return undefined;
    }
  }
}

class MatrixRowOperations implements Macro.ArrayArgumentOperations {
  constructor(private config: Macro.MacroInvocationConfig, private itemsParam: Fmt.Parameter, private expression: Fmt.DefinitionRefExpression, private items: Fmt.ArrayExpression) {}

  insertItem(): Fmt.DefinitionRefExpression | undefined {
    let newRow = MatrixRowOperations.createRow(this.config, this.itemsParam, this.items);
    if (newRow) {
      let newItems = new Fmt.ArrayExpression;
      newItems.items = this.items.items.concat(newRow);
      return FmtUtils.substituteExpression(this.expression, this.items, newItems) as Fmt.DefinitionRefExpression;
    } else {
      return undefined;
    }
  }

  static createRow(config: Macro.MacroInvocationConfig, itemsParam: Fmt.Parameter, items: Fmt.ArrayExpression): Fmt.ArrayExpression | undefined {
    let resultItems: Fmt.Expression[] = [];
    if (items.items.length) {
      let firstRow = items.items[0] as Fmt.ArrayExpression;
      for (let i = 0; i < firstRow.items.length; i++) {
        let newItem = config.createArgumentExpression?.(itemsParam);
        if (newItem) {
          resultItems.push(newItem);
        } else {
          return undefined;
        }
      }
    }
    let result = new Fmt.ArrayExpression;
    result.items = resultItems;
    return result;
  }
}

class MatrixColumnOperations implements Macro.ArrayArgumentOperations {
  constructor(private config: Macro.MacroInvocationConfig, private itemsParam: Fmt.Parameter, private expression: Fmt.DefinitionRefExpression, private items: Fmt.ArrayExpression) {}

  insertItem(): Fmt.DefinitionRefExpression | undefined {
    let newItems = new Fmt.ArrayExpression;
    newItems.items = [];
    for (let row of this.items.items) {
      let oldRow = row as Fmt.ArrayExpression;
      let newItem = this.config.createArgumentExpression?.(this.itemsParam);
      if (newItem) {
        let newRow = new Fmt.ArrayExpression;
        newRow.items = oldRow.items.concat(newItem);
        newItems.items.push(newRow);
      } else {
        return undefined;
      }
    }
    return FmtUtils.substituteExpression(this.expression, this.items, newItems) as Fmt.DefinitionRefExpression;
  }
}
