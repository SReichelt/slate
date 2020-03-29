import * as Fmt from '../format/format';
import * as FmtLibrary from '../logics/library';
import { LibraryDataAccessor, LibraryDefinition } from './libraryDataAccessor';
import CachedPromise from './cachedPromise';

export class MRUList {
  private entries: Fmt.Path[] = [];

  add(path: Fmt.Path): void {
    while (path.parentPath instanceof Fmt.Path) {
      path = path.parentPath;
    }
    let newPath = new Fmt.Path;
    newPath.name = path.name;
    newPath.parentPath = path.parentPath;
    let index = 0;
    for (let entry of this.entries) {
      if (newPath.isEquivalentTo(entry)) {
        if (index) {
          this.entries.splice(index, 1);
          break;
        } else {
          return;
        }
      }
      index++;
    }
    this.entries.unshift(newPath);
  }

  iterator(libraryDataAccessor: LibraryDataAccessor): MRUListIterator {
    return new MRUListIterator(this.entries, libraryDataAccessor);
  }
}

export class MRUListIterator {
  private entriesIndex = 0;
  private sectionContentsPromise: CachedPromise<Fmt.Expression[]>;
  private sectionContentsIndex = 0;

  constructor(private entries: Fmt.Path[], private libraryDataAccessor: LibraryDataAccessor) {
    this.sectionContentsPromise = libraryDataAccessor.fetchLocalSection()
      .then((libraryDefinition: LibraryDefinition) => (libraryDefinition.definition.contents as FmtLibrary.ObjectContents_Section).items)
      .catch(() => []);
  }

  next(): CachedPromise<Fmt.Path | undefined> {
    if (this.entriesIndex < this.entries.length) {
      let entry = this.entries[this.entriesIndex++];
      return CachedPromise.resolve(entry);
    } else {
      return this.sectionContentsPromise.then((contents: Fmt.Expression[]) => {
        while (this.sectionContentsIndex < contents.length) {
          let item = contents[this.sectionContentsIndex++];
          if (item instanceof FmtLibrary.MetaRefExpression_item && item.ref instanceof Fmt.DefinitionRefExpression) {
            let path = this.libraryDataAccessor.getAbsolutePath(item.ref.path);
            if (!this.entries.some((entry: Fmt.Path) => path.isEquivalentTo(entry))) {
              return path;
            }
          }
        }
        return undefined;
      });
    }
  }
}