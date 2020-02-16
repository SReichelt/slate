import * as Fmt from '../../../format/format';
import * as HLMMacro from '../macro';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { NumberMacro } from './number';
import { PredicateMacro } from './predicate';
import { OperatorMacro } from './operator';
import { TupleMacro } from './tuple';
import { NumberTupleMacro } from './numberTuple';
import { MatrixMacro } from './matrix';
import CachedPromise from '../../../data/cachedPromise';

export const macros: HLMMacro.HLMMacro[] = [
  new NumberMacro,
  new PredicateMacro,
  new OperatorMacro,
  new TupleMacro,
  new NumberTupleMacro,
  new MatrixMacro
];

export function instantiateMacro(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<HLMMacro.HLMMacroInstance> {
  let macro = macros.find((value: HLMMacro.HLMMacro) => value.name === definition.name);
  if (macro) {
    try {
      return macro.instantiate(libraryDataAccessor, definition);
    } catch (error) {
      return CachedPromise.reject(error);
    }
  } else {
    return CachedPromise.reject(new Error(`Macro "${definition.name}" not found`));
  }
}
