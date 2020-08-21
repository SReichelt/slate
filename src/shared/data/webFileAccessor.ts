import type { RequestInit } from 'node-fetch';
import { fetchAny, fetchVoid, fetchText } from '../utils/fetch';
import { FileAccessor, FileReference, WriteFileResult } from './fileAccessor';
import { StandardFileReference } from './fileAccessorImpl';
import CachedPromise from './cachedPromise';

export class WebFileAccessor implements FileAccessor {
  constructor(private baseURI?: string) {}

  openFile(uri: string): FileReference {
    if (this.baseURI) {
      if (uri.startsWith('/')) {
        uri = this.baseURI + uri;
      } else {
        uri = this.baseURI + '/' + uri;
      }
    }
    return new WebFileReference(uri);
  }
}

export class WebFileReference extends StandardFileReference {
  read(): CachedPromise<string> {
    let result = fetchText(this.uri);
    return new CachedPromise(result);
  }

  write(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    let options: RequestInit = {
      method: 'PUT',
      body: contents
    };
    let result = fetchAny(this.uri, options)
      .then((response) => {
        let writeFileResult = new WebWriteFileResult;
        writeFileResult.writtenDirectly = (response.status === 200);
        return writeFileResult;
      });
    return new CachedPromise(result);
  }

  view(openLocally: boolean): CachedPromise<void> {
    let options: RequestInit = {
      method: 'REPORT'
    };
    let result = fetchVoid(this.uri, options);
    return new CachedPromise(result);
  }
}

export class WebWriteFileResult implements WriteFileResult {
  writtenDirectly: boolean;
}
