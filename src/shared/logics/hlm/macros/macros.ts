import * as Fmt from '../../../format/format';
import * as HLMMacro from '../macro';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { NumberMacro } from './number';
import { PredicateMacro } from './predicate';
import { OperatorMacro } from './operator';
import { MatrixMacro } from './matrix';
import CachedPromise from '../../../data/cachedPromise';

const numberMacro = new NumberMacro;
const predicateMacro = new PredicateMacro;
const operatorMacro = new OperatorMacro;
const matrixMacro = new MatrixMacro;

export const macros: HLMMacro.HLMMacro[] = [
  numberMacro,
  predicateMacro,
  operatorMacro,
  matrixMacro
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
