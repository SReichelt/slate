import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';
import { FileReference } from './fileAccessor';
import * as Logic from '../logics/logic';

export interface LibraryDataAccessor {
  readonly logic: Logic.Logic;
  getAccessorForSection(path?: Fmt.PathItem): LibraryDataAccessor;
  fetchLocalSection(): CachedPromise<LibraryDefinition>;
  fetchSubsection(path: Fmt.Path): CachedPromise<LibraryDefinition>;
  fetchItem(path: Fmt.Path, fullContentsRequired: boolean): CachedPromise<LibraryDefinition>;
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
  modified?: boolean;
  fileReference?: FileReference;
}

export enum LibraryDefinitionState {
  Preloaded,
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
