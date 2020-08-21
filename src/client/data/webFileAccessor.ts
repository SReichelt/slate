import { fetchAny, fetchVoid, fetchText } from '../utils/fetch';
import { FileAccessor, FileReference, WriteFileResult } from '../../shared/data/fileAccessor';
import { StandardFileReference } from '../../shared/data/fileAccessorImpl';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  openFile(uri: string): FileReference {
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
