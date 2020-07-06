import * as Fmt from '../../../format/format';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class NumberMacro implements HLMMacro.HLMMacro {
  name = 'number';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): NumberMacroInstance {
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let naturalNumbers = references.getValue('Natural numbers');
    return new NumberMacroInstance(definition, naturalNumbers);
  }
}

class NumberMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private naturalNumbers: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression): NumberMacroInvocation {
    let naturalNumbersRef = utils.substitutePath(this.naturalNumbers, expression.path, [this.definition]);
    return new NumberMacroInvocation(expression, naturalNumbersRef);
  }
}

class NumberMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(public expression: Fmt.DefinitionRefExpression, private naturalNumbersRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.naturalNumbersRef);
  }
}
