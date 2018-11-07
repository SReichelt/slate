import { LibraryDataAccessor, LibraryItemInfo } from './libraryDataAccessor';
import { FileAccessor, FileContents } from './fileAccessor';
import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';
import * as FmtReader from '../format/read';
import * as FmtWriter from '../format/write';
import * as FmtLibrary from '../format/library';
import * as Logic from '../logics/logic';

export { LibraryDataAccessor, LibraryItemInfo };


interface PrefetchQueueItem {
  path: Fmt.Path;
  isSubsection: boolean;
  itemNumber?: number[];
}

export class LibraryDataProvider implements LibraryDataAccessor {
  private subsectionProviderCache = new Map<string, LibraryDataProvider>();
  private definitionCache = new Map<string, Fmt.Definition>();
  private prefetchQueue: PrefetchQueueItem[] = [];

  constructor(public logic: Logic.Logic, private fileAccessor: FileAccessor, private uri: string, private parent: LibraryDataProvider | undefined, private childName: string, private itemNumber?: number[]) {
    if (this.uri && !this.uri.endsWith('/')) {
      this.uri += '/';
    }
    if (!this.parent) {
      this.itemNumber = [];
    }
  }

  getProviderForSection(path?: Fmt.PathItem, itemNumber?: number[]): LibraryDataProvider {
    if (!path) {
      return this;
    }
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.getProviderForSubsection(path, itemNumber);
  }

  private getProviderForSubsection(path: Fmt.PathItem, itemNumber?: number[]): LibraryDataProvider {
    if (path instanceof Fmt.NamedPathItem) {
      let provider = this.subsectionProviderCache.get(path.name);
      if (provider) {
        if (!provider.itemNumber) {
          provider.itemNumber = itemNumber;
        }
      } else {
        provider = new LibraryDataProvider(this.logic, this.fileAccessor, this.uri + encodeURI(path.name) + '/', this, path.name, itemNumber);
        this.subsectionProviderCache.set(path.name, provider);
      }
      return provider;
    } else if (path instanceof Fmt.ParentPathItem) {
      if (!this.parent) {
        throw new Error('Parent of root is not defined');
      }
      return this.parent;
    } else {
      return this;
    }
  }

  private getPath(): Fmt.PathItem | undefined {
    if (this.parent) {
      let result = new Fmt.NamedPathItem;
      result.name = this.childName;
      result.parentPath = this.parent.getPath();
      return result;
    } else {
      return undefined;
    }
  }

  getAbsolutePath(path: Fmt.Path): Fmt.Path {
    let parentProvider = this.getProviderForSection(path.parentPath);
    let result = new Fmt.Path;
    result.name = path.name;
    result.arguments = path.arguments;
    result.parentPath = parentProvider.getPath();
    return result;
  }

  arePathsEqual(path1?: Fmt.PathItem, path2?: Fmt.PathItem): boolean {
    if (path1 === path2) {
      return true;
    }
    if (!path1 || !path2) {
      return false;
    }
    if (!this.arePathsEqual(path1.parentPath, path2.parentPath)) {
      return false;
    }
    if (path1 instanceof Fmt.NamedPathItem && path2 instanceof Fmt.NamedPathItem) {
      return path1.name === path2.name;
    }
    if (path1 instanceof Fmt.ParentPathItem && path2 instanceof Fmt.ParentPathItem) {
      return true;
    }
    if (path1 instanceof Fmt.IdentityPathItem && path2 instanceof Fmt.IdentityPathItem) {
      return true;
    }
    return false;
  }

  private fetchDefinition(name: string, getMetaModel: Fmt.MetaModelGetter): CachedPromise<Fmt.Definition> {
    let cachedDefinition = this.definitionCache.get(name);
    if (cachedDefinition) {
      return CachedPromise.resolve(cachedDefinition);
    } else {
      let uri = this.uri + encodeURI(name) + '.hlm';
      return this.fileAccessor.readFile(uri)
        .then((contents: FileContents) => {
          contents.onChange = () => {
            this.definitionCache.delete(name);
            contents.close();
          };
          let file = FmtReader.readString(contents.text, uri, getMetaModel);
          let definition = file.definitions[0];
          this.definitionCache.set(name, definition);
          return definition;
        });
    }
  }

  private fetchSection(name: string, prefetchContents: boolean = true): CachedPromise<Fmt.Definition> {
    let result = this.fetchDefinition(name, FmtLibrary.getMetaModel);
    if (prefetchContents) {
      result = result.then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtLibrary.ObjectContents_Section) {
          let items = definition.contents.items as Fmt.ArrayExpression;
          let index = 0;
          for (let item of items.items) {
            if (item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof FmtLibrary.MetaRefExpression_item) {
              let itemNumber = this.itemNumber ? [...this.itemNumber, index + 1] : undefined;
              let prefetchQueueItem: PrefetchQueueItem = {
                path: (item.ref as Fmt.DefinitionRefExpression).path,
                isSubsection: item instanceof FmtLibrary.MetaRefExpression_subsection,
                itemNumber: itemNumber
              };
              this.prefetchQueue.push(prefetchQueueItem);
            }
            index++;
          }
          this.triggerPrefetching();
        }
        return definition;
      });
    }
    return result;
  }

  fetchLocalSection(prefetchContents: boolean = true): CachedPromise<Fmt.Definition> {
    return this.fetchSection(this.parent ? '_index' : this.childName, prefetchContents);
  }

  fetchSubsection(path: Fmt.Path, itemNumber?: number[], prefetchContents: boolean = true): CachedPromise<Fmt.Definition> {
    let provider = this.getProviderForSection(path, itemNumber);
    return provider.fetchLocalSection(prefetchContents);
  }

  fetchLocalItem(name: string, prefetchContents: boolean = true): CachedPromise<Fmt.Definition> {
    return this.fetchDefinition(name, this.logic.getMetaModel);
  }

  fetchItem(path: Fmt.Path, prefetchContents: boolean = true): CachedPromise<Fmt.Definition> {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.fetchLocalItem(path.name, prefetchContents);
  }

  private submitLocalDefinition(name: string, definition: Fmt.Definition): CachedPromise<void> {
    let uri = this.uri + encodeURI(name) + '.hlm';
    let file = new Fmt.File;
    file.metaModelPath = this.getLogicMetaModelPath();
    file.definitions = new Fmt.DefinitionList;
    file.definitions.push(definition);
    let contents = FmtWriter.writeString(file);
    let result = this.fileAccessor.writeFile!(uri, contents);
    result.then(() => this.definitionCache.set(name, definition));
    return result;
  }

  submitLocalItem(name: string, definition: Fmt.Definition): CachedPromise<void> {
    return this.submitLocalDefinition(name, definition);
  }

  getLocalItemInfo(name: string): CachedPromise<LibraryItemInfo> {
    return this.fetchLocalSection()
      .then((definition: Fmt.Definition) => {
        let contents = definition.contents as FmtLibrary.ObjectContents_Section;
        let items = contents.items as Fmt.ArrayExpression;
        let type: string | undefined = undefined;
        let title: Fmt.Expression | undefined = undefined;
        let index = 0;
        for (let item of items.items) {
          if (item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof FmtLibrary.MetaRefExpression_item) {
            if ((item.ref as Fmt.DefinitionRefExpression).path.name === name) {
              if (item instanceof FmtLibrary.MetaRefExpression_item) {
                type = item.type;
              }
              title = item.title;
              break;
            }
          }
          index++;
        }
        if (this.itemNumber) {
          return {
            itemNumber: [...this.itemNumber, index + 1],
            type: type,
            title: title
          };
        } else {
          return this.parent!.getLocalItemInfo(this.childName)
            .then((ownItemInfo: LibraryItemInfo) => {
              this.itemNumber = ownItemInfo.itemNumber;
              return {
                itemNumber: [...this.itemNumber, index + 1],
                type: type,
                title: title
              };
            });
        }
      });
  }

  private triggerPrefetching(): void {
    let prefetch = () => {
      for (let i = 0; i < 4; i++) {
        this.prefetch();
      }
    };
    setTimeout(prefetch, 0);
  }

  private prefetch = (): boolean => {
    if (this.prefetchQueue.length) {
      let prefetchQueueItem = this.prefetchQueue.shift()!;
      if (prefetchQueueItem.isSubsection) {
        this.fetchSubsection(prefetchQueueItem.path, prefetchQueueItem.itemNumber, false)
          .then(this.prefetch)
          .catch(this.prefetch);
      } else {
        this.fetchItem(prefetchQueueItem.path, false)
          .then(this.prefetch)
          .catch(this.prefetch);
      }
      return true;
    } else {
      return false;
    }
  }

  pathToURI(path: Fmt.Path): string {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.uri + encodeURI(path.name);
  }

  uriToPath(uri: string): Fmt.Path | undefined {
    if (uri.startsWith(this.uri)) {
      uri = uri.substring(this.uri.length);
      let path: Fmt.PathItem | undefined = undefined;
      let slashPos = uri.indexOf('/');
      while (slashPos >= 0) {
        if (slashPos > 0) {
          let item = new Fmt.NamedPathItem;
          item.name = decodeURI(uri.substring(0, slashPos));
          item.parentPath = path;
          path = item;
        }
        uri = uri.substring(slashPos + 1);
        slashPos = uri.indexOf('/');
      }
      if (uri) {
        let result = new Fmt.Path;
        result.name = decodeURI(uri);
        result.parentPath = path;
        return result;
      }
    }
    return undefined;
  }

  private getLogicMetaModelPath(prefix?: Fmt.PathItem): Fmt.Path {
    if (this.parent) {
      let parentPrefix = new Fmt.ParentPathItem;
      parentPrefix.parentPath = prefix;
      return this.parent.getLogicMetaModelPath(parentPrefix);
    } else {
      let path = new Fmt.Path;
      path.name = this.logic.name;
      let parentPath = new Fmt.NamedPathItem;
      parentPath.name = 'logics';
      parentPath.parentPath = new Fmt.ParentPathItem;
      parentPath.parentPath.parentPath = new Fmt.ParentPathItem;
      parentPath.parentPath.parentPath.parentPath = prefix;
      path.parentPath = parentPath;
      return path;
    }
  }
}
