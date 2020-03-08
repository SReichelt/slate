import { FileContents, FileWatcher } from './fileAccessor';

export class StandardFileContents implements FileContents {
    constructor(public text: string) {}
}

export class StandardWatchableFileContents extends StandardFileContents {
    constructor(text: string, public watchers: StandardFileWatcher[]) {
      super(text);
    }

    addWatcher(onChange: (watcher: FileWatcher) => void): FileWatcher {
        return new StandardFileWatcher(this, onChange);
    }
}

export class StandardFileWatcher implements FileWatcher {
    constructor(public contents: StandardWatchableFileContents, private onChange: (watcher: FileWatcher) => void) {
        this.contents.watchers.push(this);
    }

    close(): void {
        let watchers = this.contents.watchers;
        for (let i = 0; i < watchers.length; i++) {
            if (watchers[i] === this) {
                watchers.splice(i, 1);
                break;
            }
        }
    }

    changed(): void {
        this.onChange(this);
    }
}
