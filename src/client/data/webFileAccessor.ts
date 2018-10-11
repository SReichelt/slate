import { FileAccessor, FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class WebFileAccessor implements FileAccessor {
  readFile(uri: string): CachedPromise<FileContents> {
    let contents = fetch(uri)
      .then((response) => response.text())
      .then((text) => new WebFileContents(text));
    return new CachedPromise(contents);
  }
}

class WebFileContents implements FileContents {
  constructor(public text: string) {}
  close(): void {}
}
