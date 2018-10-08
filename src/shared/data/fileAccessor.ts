import CachedPromise from './cachedPromise';

export interface FileAccessor {
    readFile(uri: string, onChange?: () => void): CachedPromise<string>;
}
