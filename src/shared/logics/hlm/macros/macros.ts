import * as Fmt from '../../../format/format';
import * as HLMMacro from '../macro';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { NumberMacro } from './number';
import CachedPromise from '../../../data/cachedPromise';

const numberMacro = new NumberMacro;

export const macros: HLMMacro.HLMMacro[] = [
  numberMacro
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
