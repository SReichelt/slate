import * as Fmt from '../../../format/format';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class NumberMacro implements HLMMacro.HLMMacro {
  name = 'number';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<NumberMacroInstance> {
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let naturalNumbers = references.getValue('Natural numbers') as Fmt.DefinitionRefExpression;
    let naturalNumbersAbsolutePath = libraryDataAccessor.getAbsolutePath(naturalNumbers.path);
    return CachedPromise.resolve(new NumberMacroInstance(naturalNumbersAbsolutePath));
  }
}

export class NumberMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private naturalNumbersAbsolutePath: Fmt.Path) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(libraryDataAccessor: LibraryDataAccessor, args: Fmt.ArgumentList): CachedPromise<NumberMacroInvocation> {
    let naturalNumbersRelativePath = libraryDataAccessor.getRelativePath(this.naturalNumbersAbsolutePath);
    return CachedPromise.resolve(new NumberMacroInvocation(naturalNumbersRelativePath));
  }
}

export class NumberMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(private naturalNumbersRelativePath: Fmt.Path) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    let result = new Fmt.DefinitionRefExpression;
    result.path = this.naturalNumbersRelativePath;
    return CachedPromise.resolve(result);
  }
}
