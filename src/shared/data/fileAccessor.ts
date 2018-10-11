import CachedPromise from './cachedPromise';

export interface FileAccessor {
    readFile(uri: string): CachedPromise<FileContents>;
}

export interface FileContents {
    text: string;
    onChange?: () => void;
    close(): void;
}
