import * as Fmt from '../../../format/format';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class SequenceMacro implements HLMMacro.HLMMacro {
  name = 'finite sequence';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<OperatorMacroInstance> {
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let finiteSequences = references.getValue('Finite sequences');
    let numberMacro = references.getValue('number');
    return CachedPromise.resolve(new OperatorMacroInstance(definition, finiteSequences, numberMacro));
  }
}

export class OperatorMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private finiteSequences: Fmt.Expression, private numberMacro: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, path: Fmt.Path): CachedPromise<OperatorMacroInvocation> {
    let finiteSequencesRef = utils.substitutePath(this.finiteSequences, path, [this.definition]);
    return CachedPromise.resolve(new OperatorMacroInvocation(finiteSequencesRef));
  }
}

export class OperatorMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(private finiteSequencesRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.finiteSequencesRef);
  }
}
