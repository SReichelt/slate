import * as request from 'request';
import { FileAccessor, FileReference } from '../../shared/data/fileAccessor';
import { StandardFileReference } from '../../shared/data/fileAccessorImpl';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  constructor(private baseURI: string) {}

  openFile(uri: string): FileReference {
    if (uri.startsWith('/')) {
      uri = this.baseURI + uri;
    } else {
      uri = this.baseURI + '/' + uri;
    }
    return new WebFileReference(uri);
  }
}

export class WebFileReference extends StandardFileReference implements FileReference {
  read(): CachedPromise<string> {
    let promise = new Promise<string>((resolve, reject) => {
      request.get(this.uri, (error, response, body) => {
        if (error) {
          reject(error);
        } else if (response.statusCode !== 200) {
          reject(new Error(`The server returned status code ${response.statusCode}`));
        } else {
          resolve(body);
        }
      });
    });
    return new CachedPromise(promise);
  }
}
