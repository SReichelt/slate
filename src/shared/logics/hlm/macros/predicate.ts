import * as Fmt from '../../../format/format';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class PredicateMacro implements HLMMacro.HLMMacro {
  name = 'predicate';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<PredicateMacroInstance> {
    let relationParameters = definition.parameters.filter((param: Fmt.Parameter) => param.type.expression instanceof FmtHLM.MetaRefExpression_Set);
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let relations = references.getValue(relationParameters.length === 1 ? 'Properties' : 'Relations');
    return CachedPromise.resolve(new PredicateMacroInstance(definition, relations));
  }
}

export class PredicateMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private relations: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, path: Fmt.Path): CachedPromise<PredicateMacroInvocation> {
    let relationsRef = utils.substitutePath(this.relations, path, [this.definition]);
    return CachedPromise.resolve(new PredicateMacroInvocation(relationsRef));
  }
}

export class PredicateMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(private relationsRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.relationsRef);
  }
}
