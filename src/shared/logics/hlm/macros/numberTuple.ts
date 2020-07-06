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
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let variables: Fmt.ParameterList = contents.variables || Object.create(Fmt.ParameterList.prototype);
    let length = variables.getParameter('length');
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let tuples = references.getValue('Tuples');
    let tuple = references.getValue('tuple');
    return new NumberTupleMacroInstance(definition, length, tuples, tuple);
  }
}

class NumberTupleMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private length: Fmt.Parameter, private tuples: Fmt.Expression, private tuple: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression): NumberTupleMacroInvocation {
    let items = expression.path.arguments.getValue('items') as Fmt.ArrayExpression;
    let tuplesRef = utils.substitutePath(this.tuples, expression.path, [this.definition]);
    let length = new Fmt.IntegerExpression;
    length.value = new Fmt.BN(items.items.length);
    tuplesRef = utils.substituteVariable(tuplesRef, this.length, () => length);
    return new NumberTupleMacroInvocation(expression, tuplesRef);
  }
}

class NumberTupleMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(public expression: Fmt.DefinitionRefExpression, private tuplesRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.tuplesRef);
  }

  getArrayArgumentOperations(subExpression: Fmt.ArrayExpression): Macro.ArrayArgumentOperations {
    return new Macro.DefaultArrayArgumentOperations(this.expression, subExpression);
  }
}
