import { FileAccessor, FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  readFile(uri: string): CachedPromise<FileContents> {
    let contents = fetch(uri)
      .then((response) => {
        if (response.ok) {
          return response.text();
        } else {
          throw new Error(`Received HTTP error ${response.status} (${response.statusText})`);
        }
      })
      .then((text) => new WebFileContents(text));
    return new CachedPromise(contents);
  }

  writeFile(uri: string, text: string): CachedPromise<boolean> {
    let options = {
      method: 'PUT',
      body: text
    };
    let result = fetch(uri, options)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Received HTTP error ${response.status} (${response.statusText})`);
        }
        return response.status === 200;
      });
    return new CachedPromise(result);
  }

  openFile(uri: string): CachedPromise<void> {
    let options = {
      method: 'REPORT'
    };
    let result = fetch(uri, options)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Received HTTP error ${response.status} (${response.statusText})`);
        }
      });
    return new CachedPromise(result);
  }
}

class WebFileContents implements FileContents {
  constructor(public text: string) {}
  close(): void {}
}
