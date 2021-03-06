import FetchHelper, { RequestInit, Response } from '../utils/fetchHelper';
import { FileAccessor, FileReference, WriteFileResult } from 'slate-shared/data/fileAccessor';
import { StandardFileAccessor, StandardFileReference } from 'slate-shared/data/fileAccessorImpl';
import CachedPromise from 'slate-shared/data/cachedPromise';

export class WebFileAccessor extends StandardFileAccessor implements FileAccessor {
  constructor(protected fetchHelper: FetchHelper, baseURI: string = '') {
    super(baseURI);
  }

  openFile(uri: string): FileReference {
    return new WebFileReference(this.fetchHelper, this.baseURI + uri);
  }

  createChildAccessor(uri: string): FileAccessor {
    return new WebFileAccessor(this.fetchHelper, this.baseURI + uri);
  }
}

export class WebFileReference extends StandardFileReference {
  constructor(private fetchHelper: FetchHelper, uri: string) {
    super(uri);
  }

  read(): CachedPromise<string> {
    const result = this.fetchHelper.fetchText(this.uri);
    return new CachedPromise(result);
  }

  write(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    const options: RequestInit = {
      method: 'PUT',
      body: contents
    };
    const result = this.fetchHelper.fetchAny(this.uri, options)
      .then((response: Response) => {
        const writeFileResult = new WebWriteFileResult;
        writeFileResult.writtenDirectly = (response.status === 200);
        return writeFileResult;
      });
    return new CachedPromise(result);
  }

  view(openLocally: boolean): CachedPromise<void> {
    const options: RequestInit = {
      method: 'REPORT'
    };
    const result = this.fetchHelper.fetchVoid(this.uri, options);
    return new CachedPromise(result);
  }
}

export class WebWriteFileResult implements WriteFileResult {
  writtenDirectly: boolean;
}
