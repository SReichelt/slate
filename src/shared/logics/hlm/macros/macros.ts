import * as Fmt from '../../../format/format';
import * as HLMMacro from '../macro';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { NumberMacro } from './number';
import { TupleMacro } from './tuple';
import { NumberTupleMacro } from './numberTuple';
import { MatrixMacro } from './matrix';

export const macros: HLMMacro.HLMMacro[] = [
  new NumberMacro,
  new TupleMacro,
  new NumberTupleMacro,
  new MatrixMacro
];

export function instantiateMacro(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): HLMMacro.HLMMacroInstance {
  const macro = macros.find((value: HLMMacro.HLMMacro) => value.name === definition.name);
  if (macro) {
    return macro.instantiate(libraryDataAccessor, definition);
  } else {
    throw new Error(`Macro "${definition.name}" not found`);
  }
}
