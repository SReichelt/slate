import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';
import * as Logic from '../logics/logic';

export interface LibraryDataAccessor {
  logic: Logic.Logic;
  fetchSubsection(path: Fmt.Path): CachedPromise<Fmt.Definition>;
  fetchItem(path: Fmt.Path): CachedPromise<Fmt.Definition>;
  getItemInfo(path: Fmt.Path): CachedPromise<LibraryItemInfo>;
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
