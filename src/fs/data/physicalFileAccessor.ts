import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { FileAccessor, FileReference, WriteFileResult, FileWatcher } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

export class PhysicalFileAccessor implements FileAccessor {
  constructor(private basePath?: string) {}

  openFile(uri: string, createNew: boolean): FileReference {
    let fileName = decodeURI(uri);
    if (this.basePath) {
      fileName = path.join(this.basePath, fileName);
    }
    if (createNew) {
      this.makeDirectories(fileName);
    }
    return new PhysicalFileReference(fileName);
  }

  private makeDirectories(fileName: string): void {
    let dirName = path.dirname(fileName);
    if (dirName && !fs.existsSync(dirName)) {
      this.makeDirectories(dirName);
      fs.mkdirSync(dirName);
    }
  }
}

class PhysicalFileReference implements FileReference {
  constructor(public fileName: string) {}

  read(): CachedPromise<string> {
    let contents = util.promisify(fs.readFile)(this.fileName, 'utf8');
    return new CachedPromise(contents);
  }

  write(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    let result = util.promisify(fs.writeFile)(this.fileName, contents, 'utf8')
      .then(() => ({}));
    return new CachedPromise(result);
  }

  watch(onChange: (newContents: string) => void): FileWatcher {
    let listener = () => fs.readFile(this.fileName, 'utf8', (error, data) => {
      if (!error) {
        onChange(data);
      }
    });
    fs.watchFile(this.fileName, listener);
    return new PhysicalFileWatcher(this.fileName, listener);
  }
}

class PhysicalFileWatcher implements FileWatcher {
  constructor(private fileName: string, private listener: (() => void) | undefined) {}

  close(): void {
    if (this.listener) {
      fs.unwatchFile(this.fileName, this.listener);
      this.listener = undefined;
    }
  }
}
