import * as request from 'request';
import { FileAccessor, FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  constructor(private baseURI: string) {}

  readFile(uri: string): CachedPromise<FileContents> {
    if (uri.startsWith('/')) {
      uri = this.baseURI + uri;
    } else {
      uri = this.baseURI + '/' + uri;
    }
    let promise = new Promise<string>((resolve, reject) => {
      request.get(uri, (error, response, body) => {
        if (error) {
          reject(error);
        } else if (response.statusCode !== 200) {
          reject(new Error(`The server returned status code ${response.statusCode}`));
        } else {
          resolve(body);
        }
      });
    });
    let contents = promise.then((text) => new WebFileContents(text));
    return new CachedPromise(contents);
  }
}

class WebFileContents implements FileContents {
  constructor(public text: string) {}
  close(): void {}
}
