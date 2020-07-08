import * as Fmt from '../../../format/format';
import * as FmtUtils from '../../../format/utils';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as Macro from '../../macro';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';
import { HLMExpressionType } from '../hlm';

export class TupleMacro implements HLMMacro.HLMMacro {
  name = 'tuple';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): TupleMacroInstance {
    let itemsParam = definition.parameters.getParameter('items');
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let variables: Fmt.ParameterList = contents.variables || Object.create(Fmt.ParameterList.prototype);
    let length = variables.getParameter('length');
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let tuples = references.getValue('Tuples');
    return new TupleMacroInstance(definition, itemsParam, length, tuples);
  }
}

class TupleMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private itemsParam: Fmt.Parameter, private length: Fmt.Parameter, private tuples: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression, config: Macro.MacroInvocationConfig): TupleMacroInvocation {
    let items = expression.path.arguments.getValue(this.itemsParam.name) as Fmt.ArrayExpression;
    let tuplesRef = utils.substitutePath(this.tuples, expression.path, [this.definition]);
    let onSetLength = (newLength: number) => {
      if (items.items.length > newLength) {
        items.items.length = newLength;
      } else {
        while (items.items.length < newLength) {
          let newItem = config.createArgumentExpression?.(this.itemsParam);
          if (newItem) {
            items.items.push(newItem);
          } else {
            break;
          }
        }
      }
    };
    tuplesRef = utils.substituteVariable(tuplesRef, this.length, () => config.getNumberExpression(items.items.length, onSetLength));
    return new TupleMacroInvocation(expression, config, this.itemsParam, items, tuplesRef);
  }
}

class TupleMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(public expression: Fmt.DefinitionRefExpression, private config: Macro.MacroInvocationConfig, private itemsParam: Fmt.Parameter, private items: Fmt.ArrayExpression, private tuplesRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.tuplesRef);
  }

  getArrayArgumentOperations(subExpression: Fmt.ArrayExpression): Macro.ArrayArgumentOperations | undefined {
    if (subExpression === this.items) {
      return new Macro.DefaultArrayArgumentOperations(this.config, this.itemsParam, this.expression, subExpression);
    } else {
      return undefined;
    }
  }
}
