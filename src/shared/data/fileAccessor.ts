import CachedPromise from './cachedPromise';

export interface FileAccessor {
  readFile(uri: string): CachedPromise<FileContents>;
  writeFile?(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean): CachedPromise<WriteFileResult>;
  openFile?(uri: string, openLocally: boolean): CachedPromise<void>;
}

export interface FileContents {
  text: string;
  onChange?: () => void;
  close(): void;
}

export interface WriteFileResult {
}
