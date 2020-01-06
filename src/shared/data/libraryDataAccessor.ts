import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';

export interface LibraryDataAccessor {
  getAccessorForSection(path?: Fmt.PathItem): LibraryDataAccessor;
  fetchSubsection(path: Fmt.Path): CachedPromise<LibraryDefinition>;
  fetchItem(path: Fmt.Path): CachedPromise<LibraryDefinition>;
  getItemInfo(path: Fmt.Path): CachedPromise<LibraryItemInfo>;
  getAbsolutePath(path: Fmt.Path): Fmt.Path;
  getRelativePath(absolutePath: Fmt.Path): Fmt.Path;
  simplifyPath(path: Fmt.Path): Fmt.Path;
  arePathsEqual(left: Fmt.Path, right: Fmt.Path, unificationFn?: Fmt.ExpressionUnificationFn, replacedParameters?: Fmt.ReplacedParameter[]): boolean;
}

export interface LibraryDefinition {
  file: Fmt.File;
  definition: Fmt.Definition;
  state: LibraryDefinitionState;
}

export enum LibraryDefinitionState {
  Loaded,
  Editing,
  EditingNew,
  Submitting,
}

export type LibraryItemNumber = number[];

export function formatItemNumber(itemNumber: LibraryItemNumber): string {
  return itemNumber.join('.');
}

export interface LibraryItemInfo {
  itemNumber: LibraryItemNumber;
  type?: string;
  title?: string;
}
