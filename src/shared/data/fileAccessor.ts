import CachedPromise from './cachedPromise';

export interface FileAccessor {
  openFile(uri: string, createNew: boolean): FileReference;
}

export interface FileReference {
   // Can match uri, but can also be a physical file name.
  readonly fileName: string;

  read(): CachedPromise<string>;
  write?(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult>;
  prePublish?(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult>;
  unPrePublish?(): CachedPromise<void>;
  watch?(onChange: (newContents: string) => void): FileWatcher;
  view?(openLocally: boolean): CachedPromise<void>;
}

export interface WriteFileResult {
}

export interface FileWatcher {
  close(): void;
}
