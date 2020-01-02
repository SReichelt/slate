import { LibraryDataAccessor, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, formatItemNumber } from './libraryDataAccessor';
import { FileAccessor, FileContents, WriteFileResult } from './fileAccessor';
import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';
import * as Meta from '../format/metaModel';
import * as FmtReader from '../format/read';
import * as FmtWriter from '../format/write';
import * as FmtLibrary from '../logics/library';
import * as Logic from '../logics/logic';

export { LibraryDataAccessor, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, formatItemNumber };


const fileExtension = '.slate';

interface PrefetchQueueItem {
  path: Fmt.Path;
  isSubsection: boolean;
  itemNumber?: number[];
}

interface CanonicalPathInfo {
  parentPathCount: number;
  names: string[];
}

export class LibraryDataProvider implements LibraryDataAccessor {
  private path?: Fmt.NamedPathItem;
  private subsectionProviderCache = new Map<string, LibraryDataProvider>();
  private definitionCache = new Map<string, CachedPromise<LibraryDefinition>>();
  private editedItems = new Map<string, LibraryDefinition>();
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

  getAccessorForSection(path?: Fmt.PathItem): LibraryDataAccessor {
    return this.getProviderForSection(path);
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
    let parentPath = path.parentPath;
    let simplifiedParentPath = parentPath instanceof Fmt.Path ? this.simplifyPath(parentPath) : this.getSimplifiedParentPath(parentPath);
    if (simplifiedParentPath !== path.parentPath) {
      let newPath = path.clone() as Fmt.Path;
      newPath.parentPath = simplifiedParentPath;
      return newPath;
    }
    return path;
  }

  private getSimplifiedParentPath(parentPath: Fmt.PathItem | undefined): Fmt.PathItem | undefined {
    let canonicalPathInfo: CanonicalPathInfo = {
      parentPathCount: 0,
      names: []
    };
    let modified = LibraryDataProvider.getCanonicalPathInfo(parentPath, canonicalPathInfo);
    if (this.simplifyCanonicalPath(canonicalPathInfo, 0)) {
      modified = true;
    }
    if (modified) {
      let result: Fmt.PathItem | undefined = undefined;
      for (let i = 0; i < canonicalPathInfo.parentPathCount; i++) {
        let parentPathItem = new Fmt.ParentPathItem;
        parentPathItem.parentPath = result;
        result = parentPathItem;
      }
      for (let name of canonicalPathInfo.names) {
        let namedPathItem = new Fmt.NamedPathItem;
        namedPathItem.name = name;
        namedPathItem.parentPath = result;
        result = namedPathItem;
      }
      return result;
    }
    return parentPath;
  }

  private simplifyCanonicalPath(canonicalPathInfo: CanonicalPathInfo, depth: number): boolean {
    let modified = false;
    if (depth < canonicalPathInfo.parentPathCount && this.parent) {
      modified = this.parent.simplifyCanonicalPath(canonicalPathInfo, depth + 1);
      if (depth === canonicalPathInfo.parentPathCount - 1 && canonicalPathInfo.names.length && canonicalPathInfo.names[0] === this.childName) {
        canonicalPathInfo.parentPathCount--;
        canonicalPathInfo.names.shift();
        modified = true;
      }
    }
    return modified;
  }

  private static getCanonicalPathInfo(pathItem: Fmt.PathItem | undefined, result: CanonicalPathInfo): boolean {
    if (!pathItem) {
      return false;
    }
    let modified = LibraryDataProvider.getCanonicalPathInfo(pathItem.parentPath, result);
    if (pathItem instanceof Fmt.IdentityPathItem) {
      return true;
    } else if (pathItem instanceof Fmt.ParentPathItem) {
      if (result.names.length) {
        result.names.pop();
        return true;
      } else {
        result.parentPathCount++;
      }
    } else if (pathItem instanceof Fmt.NamedPathItem) {
      result.names.push(pathItem.name);
    }
    return modified;
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

  private fetchDefinition(name: string, definitionName: string, getMetaModel: Meta.MetaModelGetter): CachedPromise<LibraryDefinition> {
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
          if (file.definitions.length !== 1) {
            throw new Error('File is expected to contain exactly one definition');
          }
          let definition = file.definitions[0];
          if (definition.name !== definitionName) {
            throw new Error(`Expected name "${definitionName}" but found "${definition.name}" instead`);
          }
          return {
            file: file,
            definition: definition,
            state: LibraryDefinitionState.Loaded
          };
        });
      this.definitionCache.set(name, result);
    }
    return result;
  }

  private fetchSection(name: string, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let result = this.fetchDefinition(name, this.childName, FmtLibrary.getMetaModel);
    if (prefetchContents) {
      result.then((libraryDefinition: LibraryDefinition) => {
        let contents = libraryDefinition.definition.contents;
        if (contents instanceof FmtLibrary.ObjectContents_Section) {
          let index = 0;
          for (let item of contents.items) {
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

  fetchLocalSection(prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    return this.fetchSection(this.parent ? '_index' : this.childName, prefetchContents);
  }

  fetchSubsection(path: Fmt.Path, itemNumber?: number[], prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let provider = this.getProviderForSection(path, itemNumber);
    return provider.fetchLocalSection(prefetchContents);
  }

  fetchLocalItem(name: string, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let editedItem = this.editedItems.get(name);
    if (editedItem) {
      return CachedPromise.resolve(editedItem);
    }
    return this.fetchDefinition(name, name, this.logic.getMetaModel);
  }

  fetchItem(path: Fmt.Path, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.fetchLocalItem(path.name, prefetchContents);
  }

  isLocalItemUpToDate(name: string, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    let editedItem = this.editedItems.get(name);
    if (editedItem) {
      return definitionPromise.getImmediateResult() === editedItem;
    }
    let cachedPromise = this.definitionCache.get(name);
    if (!cachedPromise) {
      return false;
    }
    if (definitionPromise === cachedPromise) {
      return true;
    }
    let cachedResult = cachedPromise.getImmediateResult();
    if (!cachedResult) {
      return false;
    }
    return definitionPromise.getImmediateResult() === cachedResult;
  }

  isItemUpToDate(path: Fmt.Path, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.isLocalItemUpToDate(path.name, definitionPromise);
  }

  editLocalItem(libraryDefinition: LibraryDefinition): LibraryDefinition {
    let clonedFile = libraryDefinition.file.clone();
    let clonedLibraryDefinition: LibraryDefinition = {
      file: clonedFile,
      definition: clonedFile.definitions[0],
      state: LibraryDefinitionState.Editing
    };
    this.editedItems.set(libraryDefinition.definition.name, clonedLibraryDefinition);
    return clonedLibraryDefinition;
  }

  cancelEditing(editedLibraryDefinition: LibraryDefinition): void {
    let name = editedLibraryDefinition.definition.name;
    if (editedLibraryDefinition === this.editedItems.get(name)) {
      this.editedItems.delete(name);
    }
  }

  submitLocalItem(editedLibraryDefinition: LibraryDefinition): CachedPromise<WriteFileResult> {
    let name = editedLibraryDefinition.definition.name;
    if (editedLibraryDefinition !== this.editedItems.get(name)) {
      throw new Error('Trying to submit definition that is not being edited');
    }
    try {
      editedLibraryDefinition.state = LibraryDefinitionState.Submitting;
      let uri = this.uri + encodeURI(name) + fileExtension;
      let contents = FmtWriter.writeString(editedLibraryDefinition.file);
      return this.fileAccessor.writeFile!(uri, contents).then((result: WriteFileResult) => {
        editedLibraryDefinition.state = LibraryDefinitionState.Loaded;
        this.definitionCache.set(name, CachedPromise.resolve(editedLibraryDefinition));
        this.editedItems.delete(name);
        return result;
      });
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
      .then((libraryDefinition: LibraryDefinition) => {
        let contents = libraryDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
        let type: string | undefined = undefined;
        let title: string | undefined = undefined;
        let index = 0;
        for (let item of contents.items) {
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
    let prefetchQueueItem = this.prefetchQueue.shift();
    if (prefetchQueueItem) {
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
