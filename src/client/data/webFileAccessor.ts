import { FileAccessor } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  readFile(uri: string): CachedPromise<string> {
    return new CachedPromise(fetch(uri).then((response) => response.text()));
  }
}
