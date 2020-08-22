import { FileWatcher } from './fileAccessor';

export class StandardFileAccessor {
  constructor(protected baseURI: string = '') {
    if (this.baseURI && !this.baseURI.endsWith('/')) {
      this.baseURI += '/';
    }
  }
}

export class StandardFileReference {
  fileName: string;

  constructor(public uri: string) {
    this.fileName = uri;
  }
}

export class StandardFileWatcher implements FileWatcher {
  constructor(public uri: string, private watchers: StandardFileWatcher[], private onChange: (newContents: string) => void) {
    this.watchers.push(this);
  }

  close(): void {
    let watchers = this.watchers;
    for (let i = 0; i < watchers.length; i++) {
      if (watchers[i] === this) {
        watchers.splice(i, 1);
        break;
      }
    }
  }

  changed(newContents: string): void {
    this.onChange(newContents);
  }
}
