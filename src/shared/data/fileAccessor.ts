import CachedPromise from './cachedPromise';

export interface FileAccessor {
    readFile(uri: string): CachedPromise<FileContents>;
    writeFile?(uri: string, text: string): CachedPromise<boolean>;
    openFile?(uri: string, openLocally: boolean): CachedPromise<void>;
}

export interface FileContents {
    text: string;
    onChange?: () => void;
    close(): void;
}
