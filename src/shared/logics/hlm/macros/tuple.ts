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
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let variables: Fmt.ParameterList = contents.variables || Object.create(Fmt.ParameterList.prototype);
    let length = variables.getParameter('length');
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let tuples = references.getValue('Tuples');
    return new TupleMacroInstance(definition, length, tuples);
  }
}

class TupleMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private length: Fmt.Parameter, private tuples: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression): TupleMacroInvocation {
    let items = expression.path.arguments.getValue('items') as Fmt.ArrayExpression;
    let tuplesRef = utils.substitutePath(this.tuples, expression.path, [this.definition]);
    let length = new Fmt.IntegerExpression;
    length.value = new Fmt.BN(items.items.length);
    tuplesRef = utils.substituteVariable(tuplesRef, this.length, () => length);
    return new TupleMacroInvocation(expression, tuplesRef);
  }
}

class TupleMacroInvocation implements HLMMacro.HLMMacroInvocation {
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
