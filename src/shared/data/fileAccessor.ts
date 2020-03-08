import CachedPromise from './cachedPromise';

export interface FileAccessor {
  readFile(uri: string): CachedPromise<FileContents>;
  writeFile?(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean): CachedPromise<WriteFileResult>;
  prePublishFile?(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean): CachedPromise<WriteFileResult>;
  unPrePublishFile?(uri: string): CachedPromise<void>;
  openFile?(uri: string, openLocally: boolean): CachedPromise<void>;
}

export interface FileContents {
  text: string;
  addWatcher?(onChange: (watcher: FileWatcher) => void): FileWatcher;
}

export interface FileWatcher {
  close(): void;
}

export interface WriteFileResult {
}
