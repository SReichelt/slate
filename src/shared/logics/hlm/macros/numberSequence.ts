import * as Fmt from '../../../format/format';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class NumberSequenceMacro implements HLMMacro.HLMMacro {
  name = 'finite sequence of numbers';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<NumberSequenceMacroInstance> {
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let variables: Fmt.ParameterList = contents.variables || Object.create(Fmt.ParameterList.prototype);
    let length = variables.getParameter('length');
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let fixedLengthSequences = references.getValue('Fixed-length sequences');
    let finiteSequence = references.getValue('finite sequence');
    return CachedPromise.resolve(new NumberSequenceMacroInstance(definition, length, fixedLengthSequences, finiteSequence));
  }
}

export class NumberSequenceMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private length: Fmt.Parameter, private fixedLengthSequences: Fmt.Expression, private finiteSequence: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, path: Fmt.Path): CachedPromise<NumberSequenceMacroInvocation> {
    let items = path.arguments.getValue('items') as Fmt.ArrayExpression;
    let fixedLengthSequencesRef = utils.substitutePath(this.fixedLengthSequences, path, [this.definition]);
    let length = new Fmt.IntegerExpression;
    length.value = new Fmt.BN(items.items.length);
    fixedLengthSequencesRef = utils.substituteVariable(fixedLengthSequencesRef, this.length, () => length);
    return CachedPromise.resolve(new NumberSequenceMacroInvocation(fixedLengthSequencesRef));
  }
}

export class NumberSequenceMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(private fixedLengthSequencesRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.fixedLengthSequencesRef);
  }
}
