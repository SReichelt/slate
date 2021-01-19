import * as Fmt from '../../../format/format';
import * as FmtUtils from '../../../format/utils';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as Macro from '../../macro';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class NumberTupleMacro implements HLMMacro.HLMMacro {
  name = 'tuple of numbers';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): NumberTupleMacroInstance {
    const itemsParam = definition.parameters.getParameter('items');
    const contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    const variables: Fmt.ParameterList = contents.variables || new Fmt.ParameterList;
    const length = variables.getParameter('length');
    const references: Fmt.ArgumentList = contents.references || new Fmt.ArgumentList;
    const tuples = references.getValue('Tuples');
    const tuple = references.getValue('tuple');
    return new NumberTupleMacroInstance(definition, itemsParam, length, tuples, tuple);
  }
}

class NumberTupleMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private itemsParam: Fmt.Parameter, private length: Fmt.Parameter, private tuples: Fmt.Expression, private tuple: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    const result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression, config: Macro.MacroInvocationConfig): NumberTupleMacroInvocation {
    const items = expression.path.arguments.getValue(this.itemsParam.name) as Fmt.ArrayExpression;
    let tuplesRef = utils.substitutePath(this.tuples, expression.path, [this.definition]);
    const onSetLength = (newLength: number) => {
      if (items.items.length > newLength) {
        items.items.length = newLength;
      } else {
        while (items.items.length < newLength) {
          const newItem = config.createArgumentExpression?.(this.itemsParam);
          if (newItem) {
            items.items.push(newItem);
          } else {
            break;
          }
        }
      }
    };
    tuplesRef = FmtUtils.substituteVariable(tuplesRef, this.length, config.getNumberExpression(items.items.length, onSetLength));
    return new NumberTupleMacroInvocation(expression, config, this.itemsParam, items, tuplesRef);
  }
}

class NumberTupleMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(public expression: Fmt.DefinitionRefExpression, private config: Macro.MacroInvocationConfig, private itemsParam: Fmt.Parameter, private items: Fmt.ArrayExpression, private tuplesRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    const result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.tuplesRef);
  }

  unfold(): CachedPromise<Fmt.Expression[]> {
    // TODO
    return CachedPromise.resolve([]);
  }

  getArrayArgumentOperations(subExpression: Fmt.ArrayExpression): Macro.ArrayArgumentOperations | undefined {
    if (subExpression === this.items) {
      return new Macro.DefaultArrayArgumentOperations(this.config, this.itemsParam, this.expression, subExpression);
    } else {
      return undefined;
    }
  }
}
