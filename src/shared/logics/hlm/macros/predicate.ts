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
    let utils = new HLMUtils(definition, libraryDataAccessor);
    let relationParameters = definition.parameters.filter((param: Fmt.Parameter) => param.type.expression instanceof FmtHLM.MetaRefExpression_Set);
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let relations = references.getValue(relationParameters.length === 1 ? 'Properties' : 'Relations') as Fmt.DefinitionRefExpression;
    let relationsAbsolutePath = libraryDataAccessor.getAbsolutePath(relations.path);
    return CachedPromise.resolve(new PredicateMacroInstance(definition, relationsAbsolutePath, utils));
  }
}

export class PredicateMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private relationsAbsolutePath: Fmt.Path, private utils: HLMUtils) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(libraryDataAccessor: LibraryDataAccessor, args: Fmt.ArgumentList): CachedPromise<PredicateMacroInvocation> {
    let relationsRef = new Fmt.DefinitionRefExpression;
    relationsRef.path = libraryDataAccessor.getRelativePath(this.relationsAbsolutePath);
    let substitutedRelationsRef = this.utils.substituteArguments(relationsRef, this.definition.parameters, args);
    return CachedPromise.resolve(new PredicateMacroInvocation(substitutedRelationsRef));
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
