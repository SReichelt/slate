import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { FileAccessor, FileContents, WriteFileResult } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class PhysicalFileAccessor implements FileAccessor {
  readFile(uri: string): CachedPromise<FileContents> {
    let contents = util.promisify(fs.readFile)(decodeURI(uri), 'utf8')
      .then((text) => new PhysicalFileContents(text));
    return new CachedPromise(contents);
  }

  writeFile(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    let fileName = decodeURI(uri);
    if (createNew) {
      this.makeDirectories(fileName);
    }
    let result = util.promisify(fs.writeFile)(fileName, text, 'utf8')
      .then(() => ({}));
    return new CachedPromise(result);
  }

  private makeDirectories(fileName: string): void {
    let dirName = path.dirname(fileName);
    if (dirName && !fs.existsSync(dirName)) {
      this.makeDirectories(dirName);
      fs.mkdirSync(dirName);
    }
  }
}

class PhysicalFileContents implements FileContents {
  constructor(public text: string) {}
  close(): void {}
}
