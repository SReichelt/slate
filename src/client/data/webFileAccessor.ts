import { fetch, fetchText } from '../utils/fetch';
import { FileAccessor, FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  readFile(uri: string): CachedPromise<FileContents> {
    let contents = fetchText(uri)
      .then((text) => new WebFileContents(text));
    return new CachedPromise(contents);
  }

  writeFile(uri: string, text: string): CachedPromise<boolean> {
    let options: RequestInit = {
      method: 'PUT',
      body: text
    };
    let result = fetch(uri, options)
      .then((response) => response.status === 200);
    return new CachedPromise(result);
  }

  openFile(uri: string): CachedPromise<void> {
    let options: RequestInit = {
      method: 'REPORT'
    };
    let result = fetch(uri, options)
      .then(() => {});
    return new CachedPromise(result);
  }
}

class WebFileContents implements FileContents {
  constructor(public text: string) {}
  close(): void {}
}
