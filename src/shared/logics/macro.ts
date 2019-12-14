import * as Fmt from '../format/format';
import * as Logic from './logic';
import { LibraryDataAccessor } from '../data/libraryDataAccessor';
import { GenericUtils } from './generic/utils';
import CachedPromise from '../data/cachedPromise';

export interface Macro<T extends MacroInstance<MacroInvocation, GenericUtils>> {
  name: string;
  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): CachedPromise<T>;
}

export interface MacroInstance<T extends MacroInvocation, Utils extends GenericUtils> {
  check(): CachedPromise<Logic.LogicCheckDiagnostic[]>;
  invoke(utils: Utils, path: Fmt.Path): CachedPromise<T>;
}

export interface MacroInvocation {
  check(): CachedPromise<Logic.LogicCheckDiagnostic[]>;
}
