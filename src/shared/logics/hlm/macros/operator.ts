import * as Fmt from '../../../format/format';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class OperatorMacro implements HLMMacro.HLMMacro {
  name = 'operator';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<OperatorMacroInstance> {
    let utils = new HLMUtils(definition, libraryDataAccessor);
    let functionParameters = definition.parameters.filter((param: Fmt.Parameter) => param.type.expression instanceof FmtHLM.MetaRefExpression_Set);
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let functions = references.getValue(functionParameters.length > 2 ? 'Operations' : 'Functions') as Fmt.DefinitionRefExpression;
    let functionsAbsolutePath = libraryDataAccessor.getAbsolutePath(functions.path);
    return CachedPromise.resolve(new OperatorMacroInstance(definition, functionsAbsolutePath, utils));
  }
}

export class OperatorMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private functionsAbsolutePath: Fmt.Path, private utils: HLMUtils) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(libraryDataAccessor: LibraryDataAccessor, args: Fmt.ArgumentList): CachedPromise<OperatorMacroInvocation> {
    let functionsRef = new Fmt.DefinitionRefExpression;
    functionsRef.path = libraryDataAccessor.getRelativePath(this.functionsAbsolutePath);
    let substitutedFunctionsRef = this.utils.substituteArguments(functionsRef, this.definition.parameters, args);
    return CachedPromise.resolve(new OperatorMacroInvocation(substitutedFunctionsRef));
  }
}

export class OperatorMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(private functionsRef: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.functionsRef);
  }
}
