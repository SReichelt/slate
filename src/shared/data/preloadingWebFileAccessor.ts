import { FileAccessor, FileReference } from './fileAccessor';
import { WebFileAccessor, WebFileReference } from './webFileAccessor';
import CachedPromise from './cachedPromise';

export class PreloadingWebFileAccessor extends WebFileAccessor {
  constructor(baseURI: string, private preloadBaseURI: string) {
    super(baseURI);
    if (this.preloadBaseURI && !this.preloadBaseURI.endsWith('/')) {
      this.preloadBaseURI += '/';
    }
  }

  preloadFile(uri: string): CachedPromise<FileReference> {
    return CachedPromise.resolve(new WebFileReference(this.preloadBaseURI + uri));
  }

  createChildAccessor(uri: string): FileAccessor {
    return new PreloadingWebFileAccessor(this.baseURI + uri, this.preloadBaseURI + uri);
  }
}
