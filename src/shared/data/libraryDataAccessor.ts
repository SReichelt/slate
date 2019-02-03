import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';

export interface LibraryDataAccessor {
  fetchSubsection(path: Fmt.Path): CachedPromise<Fmt.Definition>;
  fetchItem(path: Fmt.Path): CachedPromise<Fmt.Definition>;
  getItemInfo(path: Fmt.Path): CachedPromise<LibraryItemInfo>;
}

export interface LibraryItemInfo {
  itemNumber: number[];
  type?: string;
  title?: string;
}
