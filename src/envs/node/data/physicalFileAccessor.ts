import * as fs from 'fs';
import * as path from 'path';
import { FileAccessor, FileReference, WriteFileResult, FileWatcher } from 'slate-shared/data/fileAccessor';
import CachedPromise from 'slate-shared/data/cachedPromise';

export class PhysicalFileAccessor implements FileAccessor {
  constructor(private basePath?: string) {}

  openFile(uri: string, createNew: boolean): FileReference {
    const fileName = this.getFileName(uri);
    if (createNew) {
      this.makeDirectories(fileName);
    }
    return new PhysicalFileReference(fileName);
  }

  createChildAccessor(uri: string): FileAccessor {
    const fileName = this.getFileName(uri);
    return new PhysicalFileAccessor(fileName);
  }

  private getFileName(uri: string): string {
    let fileName = decodeURI(uri);
    if (this.basePath) {
      fileName = path.join(this.basePath, fileName);
    }
    return fileName;
  }

  private makeDirectories(fileName: string): void {
    const dirName = path.dirname(fileName);
    if (dirName && !fs.existsSync(dirName)) {
      this.makeDirectories(dirName);
      fs.mkdirSync(dirName);
    }
  }
}

class PhysicalFileReference implements FileReference {
  private writingFile = false;

  constructor(public fileName: string) {}

  read(): CachedPromise<string> {
    const contents = fs.promises.readFile(this.fileName, 'utf8');
    return new CachedPromise(contents);
  }

  write(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    this.writingFile = true;
    const result = fs.promises.writeFile(this.fileName, contents, 'utf8')
      .then(() => {
        this.writingFile = false;
        return {};
      })
      .catch((error) => {
        this.writingFile = false;
        throw error;
      });
    return new CachedPromise(result);
  }

  watch(onChange: (newContents: string) => void): FileWatcher {
    const listener = () => {
      if (!this.writingFile) {
        fs.readFile(this.fileName, 'utf8', (error, data) => {
          if (!error) {
            onChange(data);
          }
        });
      }
    };
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
