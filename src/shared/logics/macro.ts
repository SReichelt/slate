import * as Fmt from '../format/format';
import * as Logic from './logic';
import { LibraryDataAccessor } from '../data/libraryDataAccessor';
import CachedPromise from '../data/cachedPromise';

export interface Macro<T extends MacroInstance<MacroInvocation>> {
  name: string;
  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<T>;
}

export interface MacroInstance<T extends MacroInvocation> {
  check(): CachedPromise<Logic.LogicCheckDiagnostic[]>;
  invoke(libraryDataAccessor: LibraryDataAccessor, args: Fmt.ArgumentList): CachedPromise<T>;
}

export interface MacroInvocation {
  check(): CachedPromise<Logic.LogicCheckDiagnostic[]>;
}
