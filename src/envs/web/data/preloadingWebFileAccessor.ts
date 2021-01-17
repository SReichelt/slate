import { FileAccessor, FileReference } from 'slate-shared/data/fileAccessor';
import { WebFileAccessor, WebFileReference } from './webFileAccessor';
import FetchHelper from '../utils/fetchHelper';
import CachedPromise from 'slate-shared/data/cachedPromise';

export class PreloadingWebFileAccessor extends WebFileAccessor {
  constructor(fetchHelper: FetchHelper, baseURI: string, private preloadBaseURI: string) {
    super(fetchHelper, baseURI);
    if (this.preloadBaseURI && !this.preloadBaseURI.endsWith('/')) {
      this.preloadBaseURI += '/';
    }
  }

  preloadFile(uri: string): CachedPromise<FileReference> {
    return CachedPromise.resolve(new WebFileReference(this.fetchHelper, this.preloadBaseURI + uri));
  }

  createChildAccessor(uri: string): FileAccessor {
    return new PreloadingWebFileAccessor(this.fetchHelper, this.baseURI + uri, this.preloadBaseURI + uri);
  }
}
