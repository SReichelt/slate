import * as Fmt from '../../../format/format';
import * as FmtUtils from '../../../format/utils';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import * as Macro from '../../macro';
import CachedPromise from '../../../data/cachedPromise';

export class MatrixMacro implements HLMMacro.HLMMacro {
  name = 'matrix';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): MatrixMacroInstance {
    const itemsParam = definition.parameters.getParameter('items');
    const contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    const variables: Fmt.ParameterList = contents.variables || new Fmt.ParameterList;
    const rows = variables.getParameter('rows');
    const columns = variables.getParameter('columns');
    const references: Fmt.ArgumentList = contents.references || new Fmt.ArgumentList;
    const matrices = references.getValue('Matrices');
    return new MatrixMacroInstance(definition, itemsParam, rows, columns, matrices);
  }
}

class MatrixMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private itemsParam: Fmt.Parameter, private rows: Fmt.Parameter, private columns: Fmt.Parameter, private matrices: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    const result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression, config: Macro.MacroInvocationConfig): MatrixMacroInvocation {
    const items = expression.path.arguments.getValue(this.itemsParam.name) as Fmt.ArrayExpression;
    let matricesRef = utils.substitutePath(this.matrices, expression.path, [this.definition]);
    const onSetRowCount = (newRowCount: number) => {
      if (items.items.length > newRowCount) {
        items.items.length = newRowCount;
      } else {
        while (items.items.length < newRowCount) {
          const newItem = MatrixRowOperations.createRow(config, this.itemsParam, items);
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
      const firstRow = items.items[0] as Fmt.ArrayExpression;
      columnCount = firstRow.items.length;
      for (const row of items.items) {
        const arrayExpression = row as Fmt.ArrayExpression;
        if (arrayExpression.items.length !== columnCount) {
          throw new Error('Matrix rows must have the same length');
        }
      }
    }
    const onSetColumnCount = (newColumnCount: number) => {
      for (const row of items.items) {
        const rowExpression = row as Fmt.ArrayExpression;
        if (rowExpression.items.length > newColumnCount) {
          rowExpression.items.length = newColumnCount;
        } else {
          while (rowExpression.items.length < newColumnCount) {
            const newItem = config.createArgumentExpression?.(this.itemsParam);
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
    const result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.matricesRef);
  }

  unfold(): CachedPromise<Fmt.Expression[]> {
    // TODO
    return CachedPromise.resolve([]);
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
    const newRow = MatrixRowOperations.createRow(this.config, this.itemsParam, this.items);
    if (newRow) {
      const newItems = new Fmt.ArrayExpression(this.items.items.concat(newRow));
      return FmtUtils.substituteExpression<Fmt.Expression>(this.expression, this.items, newItems) as Fmt.DefinitionRefExpression;
    } else {
      return undefined;
    }
  }

  static createRow(config: Macro.MacroInvocationConfig, itemsParam: Fmt.Parameter, items: Fmt.ArrayExpression): Fmt.ArrayExpression | undefined {
    const resultItems: Fmt.Expression[] = [];
    if (items.items.length) {
      const firstRow = items.items[0] as Fmt.ArrayExpression;
      for (let i = 0; i < firstRow.items.length; i++) {
        const newItem = config.createArgumentExpression?.(itemsParam);
        if (newItem) {
          resultItems.push(newItem);
        } else {
          return undefined;
        }
      }
    }
    return new Fmt.ArrayExpression(resultItems);
  }
}

class MatrixColumnOperations implements Macro.ArrayArgumentOperations {
  constructor(private config: Macro.MacroInvocationConfig, private itemsParam: Fmt.Parameter, private expression: Fmt.DefinitionRefExpression, private items: Fmt.ArrayExpression) {}

  insertItem(): Fmt.DefinitionRefExpression | undefined {
    const newRows: Fmt.Expression[] = [];
    for (const row of this.items.items) {
      const oldRow = row as Fmt.ArrayExpression;
      const newItem = this.config.createArgumentExpression?.(this.itemsParam);
      if (newItem) {
        const newRow = new Fmt.ArrayExpression(oldRow.items.concat(newItem));
        newRows.push(newRow);
      } else {
        return undefined;
      }
    }
    const newItems = new Fmt.ArrayExpression(newRows);
    return FmtUtils.substituteExpression<Fmt.Expression>(this.expression, this.items, newItems) as Fmt.DefinitionRefExpression;
  }
}
