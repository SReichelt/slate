import { LibraryDataAccessor, LibraryItemInfo } from './libraryDataAccessor';
import { FileAccessor, FileContents, WriteFileResult } from './fileAccessor';
import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';
import * as Meta from '../format/metaModel';
import * as FmtReader from '../format/read';
import * as FmtWriter from '../format/write';
import * as FmtLibrary from '../logics/library';
import * as Logic from '../logics/logic';

export { LibraryDataAccessor, LibraryItemInfo };


const fileExtension = '.slate';

interface PrefetchQueueItem {
  path: Fmt.Path;
  isSubsection: boolean;
  itemNumber?: number[];
}

export class LibraryDataProvider implements LibraryDataAccessor {
  private path?: Fmt.NamedPathItem;
  private subsectionProviderCache = new Map<string, LibraryDataProvider>();
  private definitionCache = new Map<string, CachedPromise<Fmt.Definition>>();
  private prefetchQueue: PrefetchQueueItem[] = [];

  constructor(public logic: Logic.Logic, private fileAccessor: FileAccessor, private uri: string, private parent: LibraryDataProvider | undefined, private childName: string, private itemNumber?: number[]) {
    if (this.uri && !this.uri.endsWith('/')) {
      this.uri += '/';
    }
    if (this.parent) {
      let path = new Fmt.NamedPathItem;
      path.name = this.childName;
      path.parentPath = this.parent.path;
      this.path = path;
    } else {
      this.itemNumber = [];
    }
  }

  getRootProvider(): LibraryDataProvider {
    if (this.parent) {
      return this.parent.getRootProvider();
    } else {
      return this;
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

  getAbsolutePath(path: Fmt.Path): Fmt.Path {
    let result = new Fmt.Path;
    result.name = path.name;
    result.arguments = path.arguments;
    if (path.parentPath instanceof Fmt.Path) {
      result.parentPath = this.getAbsolutePath(path.parentPath);
    } else {
      let parentProvider = this.getProviderForSection(path.parentPath);
      result.parentPath = parentProvider.path;
    }
    return result;
  }

  getRelativePath(absolutePath: Fmt.Path): Fmt.Path {
    if (this.parent) {
      let result = this.parent.getRelativePath(absolutePath);
      let pathItem: Fmt.PathItem = result;
      let prevPathItem: Fmt.PathItem | undefined = undefined;
      for (; pathItem.parentPath; pathItem = pathItem.parentPath!) {
        if (!(pathItem.parentPath instanceof Fmt.Path)) {
          prevPathItem = pathItem;
        }
      }
      if (prevPathItem && pathItem instanceof Fmt.NamedPathItem && pathItem.name === this.childName) {
        prevPathItem.parentPath = undefined;
      } else {
        pathItem.parentPath = new Fmt.ParentPathItem;
      }
      return result;
    } else {
      return absolutePath.clone() as Fmt.Path;
    }
  }

  getRelativePathWithProvider(libraryDataProvider: LibraryDataProvider, path: Fmt.Path): Fmt.Path {
    if (libraryDataProvider === this) {
      return path;
    } else {
      return this.getRelativePath(libraryDataProvider.getAbsolutePath(path));
    }
  }

  simplifyPath(path: Fmt.Path): Fmt.Path {
    let hasParentPathItem = false;
    let hasNamedPathItem = false;
    for (let pathItem = path.parentPath; pathItem; pathItem = pathItem.parentPath) {
      if (pathItem instanceof Fmt.ParentPathItem) {
        hasParentPathItem = true;
      } else if (pathItem instanceof Fmt.NamedPathItem && !(pathItem instanceof Fmt.Path)) {
        hasNamedPathItem = true;
      }
    }
    if (hasParentPathItem && hasNamedPathItem) {
      return this.getRelativePath(this.getAbsolutePath(path));
    } else {
      return path;
    }
  }

  arePathsEqual(left: Fmt.Path, right: Fmt.Path, unificationFn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (left.name !== right.name) {
      return false;
    }
    if (left.parentPath instanceof Fmt.Path || right.parentPath instanceof Fmt.Path) {
      if (!(left.parentPath instanceof Fmt.Path && right.parentPath instanceof Fmt.Path && this.arePathsEqual(left.parentPath, right.parentPath, unificationFn))) {
        return false;
      }
    } else {
      if (this.getProviderForSection(left.parentPath) !== this.getProviderForSection(right.parentPath)) {
        return false;
      }
    }
    return left.arguments.isEquivalentTo(right.arguments, unificationFn, replacedParameters);
  }

  private fetchDefinition(name: string, getMetaModel: Meta.MetaModelGetter): CachedPromise<Fmt.Definition> {
    let result = this.definitionCache.get(name);
    if (!result) {
      let uri = this.uri + encodeURI(name) + fileExtension;
      result = this.fileAccessor.readFile(uri)
        .then((contents: FileContents) => {
          contents.onChange = () => {
            this.definitionCache.delete(name);
            contents.close();
          };
          let file = FmtReader.readString(contents.text, uri, getMetaModel);
          return file.definitions[0];
        });
      this.definitionCache.set(name, result);
    }
    return result;
  }

  private fetchSection(name: string, prefetchContents: boolean = true): CachedPromise<Fmt.Definition> {
    let result = this.fetchDefinition(name, FmtLibrary.getMetaModel);
    if (prefetchContents) {
      result.then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtLibrary.ObjectContents_Section) {
          let items = definition.contents.items as Fmt.ArrayExpression;
          let index = 0;
          for (let item of items.items) {
            if (item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof FmtLibrary.MetaRefExpression_item) {
              let path = (item.ref as Fmt.DefinitionRefExpression).path;
              if (!path.parentPath && !this.definitionCache.get(path.name)) {
                let itemNumber = this.itemNumber ? [...this.itemNumber, index + 1] : undefined;
                let prefetchQueueItem: PrefetchQueueItem = {
                  path: path,
                  isSubsection: item instanceof FmtLibrary.MetaRefExpression_subsection,
                  itemNumber: itemNumber
                };
                this.prefetchQueue.push(prefetchQueueItem);
              }
            }
            index++;
          }
          if (this.prefetchQueue.length) {
            this.triggerPrefetching();
          }
        }
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

  isLocalItemUpToDate(name: string, definitionPromise: CachedPromise<Fmt.Definition>): boolean {
    return definitionPromise === this.definitionCache.get(name);
  }

  isItemUpToDate(path: Fmt.Path, definitionPromise: CachedPromise<Fmt.Definition>): boolean {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.isLocalItemUpToDate(path.name, definitionPromise);
  }

  submitLocalItem(name: string, definition: Fmt.Definition): CachedPromise<WriteFileResult> {
    try {
      this.definitionCache.set(name, CachedPromise.resolve(definition));
      let uri = this.uri + encodeURI(name) + fileExtension;
      let file = new Fmt.File;
      file.metaModelPath = this.getLogicMetaModelPath();
      file.definitions = new Fmt.DefinitionList;
      file.definitions.push(definition);
      let contents = FmtWriter.writeString(file);
      return this.fileAccessor.writeFile!(uri, contents);
    } catch (error) {
      return CachedPromise.reject(error);
    }
  }

  openLocalItem(name: string, openLocally: boolean): CachedPromise<void> {
    let uri = this.uri + encodeURI(name) + fileExtension;
    return this.fileAccessor.openFile!(uri, openLocally);
  }

  getItemInfo(path: Fmt.Path): CachedPromise<LibraryItemInfo> {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.getLocalItemInfo(path.name);
  }

  getLocalItemInfo(name: string): CachedPromise<LibraryItemInfo> {
    return this.fetchLocalSection(false)
      .then((definition: Fmt.Definition) => {
        let contents = definition.contents as FmtLibrary.ObjectContents_Section;
        let items = contents.items as Fmt.ArrayExpression;
        let type: string | undefined = undefined;
        let title: string | undefined = undefined;
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
