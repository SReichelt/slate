import * as fs from 'fs';
import * as util from 'util';
import { FileAccessor, FileContents, WriteFileResult } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class PhysicalFileAccessor implements FileAccessor {
  readFile(uri: string): CachedPromise<FileContents> {
    let contents = util.promisify(fs.readFile)(decodeURI(uri), 'utf8')
      .then((text) => new PhysicalFileContents(text));
    return new CachedPromise(contents);
  }

  writeFile(uri: string, text: string): CachedPromise<WriteFileResult> {
    let result = util.promisify(fs.writeFile)(decodeURI(uri), text, 'utf8')
      .then(() => ({}));
    return new CachedPromise(result);
  }
}

class PhysicalFileContents implements FileContents {
  constructor(public text: string) {}
  close(): void {}
}
