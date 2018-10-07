import CachedPromise from './cachedPromise';

export interface FileAccessor {
    readFile(uri: string): CachedPromise<string>;
}
