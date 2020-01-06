import { fetchAny, fetchVoid, fetchText } from '../utils/fetch';
import { FileAccessor, FileContents, WriteFileResult } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  readFile(uri: string): CachedPromise<FileContents> {
    let contents = fetchText(uri)
      .then((text) => new WebFileContents(text));
    return new CachedPromise(contents);
  }

  writeFile(uri: string, text: string, createNew: boolean): CachedPromise<WriteFileResult> {
    let options: RequestInit = {
      method: 'PUT',
      body: text
    };
    let result = fetchAny(uri, options)
      .then((response) => {
        let writeFileResult = new WebWriteFileResult;
        writeFileResult.writtenDirectly = (response.status === 200);
        return writeFileResult;
      });
    return new CachedPromise(result);
  }

  openFile(uri: string, openLocally: boolean): CachedPromise<void> {
    let options: RequestInit = {
      method: 'REPORT'
    };
    let result = fetchVoid(uri, options);
    return new CachedPromise(result);
  }
}

class WebFileContents implements FileContents {
  constructor(public text: string) {}
  close(): void {}
}

export class WebWriteFileResult implements WriteFileResult {
  writtenDirectly: boolean;
}
