import { LibraryDataAccessor, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, formatItemNumber, LibraryItemNumber } from './libraryDataAccessor';
import { FileAccessor, FileReference, WriteFileResult, FileWatcher } from './fileAccessor';
import { fileExtension, preloadExtension, indexFileName, defaultLibraryName } from './constants';
import { InternalError } from '../utils/exception';
import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';
import * as Meta from '../format/metaModel';
import * as FmtReader from '../format/read';
import * as FmtWriter from '../format/write';
import * as FmtLibrary from '../logics/library';
import * as Logic from '../logics/logic';

export { LibraryDataAccessor, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, LibraryItemNumber, formatItemNumber };

export interface DefaultReference {
  title: string;
  urlPrefix: string;
  searchUrlPrefix?: string;
}

export const defaultReferences: DefaultReference[] = [
  {
    title: 'Wikipedia',
    urlPrefix: 'https://en.wikipedia.org/wiki/',
    searchUrlPrefix: 'https://en.wikipedia.org/w/index.php?search='
  },
  {
    title: 'Wolfram MathWorld',
    urlPrefix: 'https://mathworld.wolfram.com/',
    searchUrlPrefix: 'https://mathworld.wolfram.com/search/?query='
  },
  {
    title: 'ProofWiki',
    urlPrefix: 'https://proofwiki.org/wiki/',
    searchUrlPrefix: 'https://www.google.com/search?q=site%3Aproofwiki.org+'
  },
  {
    title: 'nLab',
    urlPrefix: 'https://ncatlab.org/nlab/show/',
    searchUrlPrefix: 'https://www.google.com/search?q=site%3Ancatlab.org+'
  },
  {
    title: 'Metamath library',
    urlPrefix: 'http://metamath.tirix.org/',
    searchUrlPrefix: 'https://www.google.com/search?q=site%3Ametamath.tirix.org+'
  },
  {
    title: 'Coq standard library',
    urlPrefix: 'https://coq.inria.fr/library/',
    searchUrlPrefix: 'https://www.google.com/search?q=site%3Acoq.inria.fr%2Flibrary+'
  },
  {
    title: 'Lean mathlib',
    urlPrefix: 'https://leanprover-community.github.io/mathlib_docs/',
    searchUrlPrefix: 'https://www.google.com/search?q=site%3Aleanprover-community.github.io%2Fmathlib_docs+'
  },
  {
    title: 'OEIS',
    urlPrefix: 'http://oeis.org/'
    // Don't search OEIS by default as it is too specific.
  }
];

const defaultReferencesString = defaultReferences.map((ref) => `* ${ref.urlPrefix}...`).reduce((prev, cur) => `${prev}\n${cur}`);

export interface LibraryDataProviderOptions {
  logic: Logic.Logic;
  fileAccessor: FileAccessor;
  watchForChanges: boolean;
  enablePrefetching: boolean;
  checkMarkdownCode: boolean;
  allowPlaceholders: boolean;
  externalURIPrefix?: string;
}

interface WatchedFile {
  fileReference: FileReference;
  fileWatcher?: FileWatcher;
  libraryDefinition?: LibraryDefinition;
}

interface PrefetchQueueItem {
  path: Fmt.Path;
  isSubsection: boolean;
  itemNumber?: LibraryItemNumber;
}

interface CanonicalPathInfo {
  parentPathCount: number;
  names: string[];
}

export class LibraryDataProvider implements LibraryDataAccessor {
  public logic: Logic.Logic;
  private fileAccessor: FileAccessor;
  private path?: Fmt.NamedPathItem;
  private uri: string = '';
  private externalURI: string;
  private active: boolean = true;
  private subsectionProviderCache = new Map<string, LibraryDataProvider>();
  private preloadedDefinitions = new Map<string, CachedPromise<LibraryDefinition>>();
  private fullyLoadedDefinitions = new Map<string, CachedPromise<LibraryDefinition>>();
  private editedDefinitions = new Map<string, LibraryDefinition>();
  private editedItemInfos = new Map<string, LibraryItemInfo>();
  private originalItemInfos = new Map<string, LibraryItemInfo>();
  private fileWatchers = new Set<FileWatcher>();
  private prefetchQueue?: PrefetchQueueItem[];
  private prefetchTimer: any;
  private sectionChangeCounter = 0;

  constructor(public options: LibraryDataProviderOptions, private childName: string = defaultLibraryName, private parent?: LibraryDataProvider, private itemNumber?: LibraryItemNumber) {
    this.logic = options.logic;
    this.fileAccessor = options.fileAccessor;
    if (parent) {
      this.path = new Fmt.NamedPathItem(childName, parent.path);
      this.uri = parent.uri + encodeURI(childName) + '/';
      this.externalURI = parent.externalURI + encodeURI(childName) + '/';
    } else {
      this.externalURI = options.externalURIPrefix ?? '';
      if (this.externalURI && !this.externalURI.endsWith('/')) {
        this.externalURI += '/';
      }
      this.itemNumber = [];
    }
    if (options.enablePrefetching) {
      this.prefetchQueue = [];
    }
  }

  close(): void {
    this.active = false;
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = undefined;
    }
    this.prefetchQueue = undefined;
    for (const watcher of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();
    this.originalItemInfos.clear();
    this.editedItemInfos.clear();
    this.editedDefinitions.clear();
    this.fullyLoadedDefinitions.clear();
    this.preloadedDefinitions.clear();
    for (const subsectionProvider of this.subsectionProviderCache.values()) {
      subsectionProvider.close();
    }
    this.subsectionProviderCache.clear();
  }

  getRootProvider(): LibraryDataProvider {
    if (this.parent) {
      return this.parent.getRootProvider();
    } else {
      return this;
    }
  }

  getSectionChangeCounter(): number {
    return this.sectionChangeCounter;
  }

  getParentAccessor(): LibraryDataAccessor | undefined {
    return this.parent;
  }

  getAccessorForSection(path?: Fmt.PathItem): LibraryDataAccessor {
    return this.getProviderForSection(path);
  }

  getProviderForSection(path?: Fmt.PathItem, itemNumber?: LibraryItemNumber): LibraryDataProvider {
    if (!path) {
      return this;
    }
    const parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.getProviderForSubsection(path, itemNumber);
  }

  private getProviderForSubsection(path: Fmt.PathItem, itemNumber?: LibraryItemNumber): LibraryDataProvider {
    if (path instanceof Fmt.NamedPathItem) {
      let provider = this.subsectionProviderCache.get(path.name);
      if (provider) {
        if (!provider.itemNumber) {
          provider.itemNumber = itemNumber;
        }
      } else {
        provider = new LibraryDataProvider(this.options, path.name, this, itemNumber);
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
    let parentPath: Fmt.PathItem | undefined;
    if (path.parentPath instanceof Fmt.Path) {
      parentPath = this.getAbsolutePath(path.parentPath);
    } else {
      const parentProvider = this.getProviderForSection(path.parentPath);
      parentPath = parentProvider.path;
    }
    return new Fmt.Path(path.name, path.arguments, parentPath);
  }

  getRelativePath(absolutePath: Fmt.Path): Fmt.Path {
    if (this.parent) {
      const result = this.parent.getRelativePath(absolutePath);
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
    const parentPath = path.parentPath;
    const simplifiedParentPath = parentPath instanceof Fmt.Path ? this.simplifyPath(parentPath) : this.getSimplifiedParentPath(parentPath);
    if (simplifiedParentPath !== path.parentPath) {
      const newPath = path.clone() as Fmt.Path;
      newPath.parentPath = simplifiedParentPath;
      return newPath;
    }
    return path;
  }

  private getSimplifiedParentPath(parentPath: Fmt.PathItem | undefined): Fmt.PathItem | undefined {
    const canonicalPathInfo: CanonicalPathInfo = {
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
        result = new Fmt.ParentPathItem(result);
      }
      for (const name of canonicalPathInfo.names) {
        result = new Fmt.NamedPathItem(name, result);
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
    const modified = LibraryDataProvider.getCanonicalPathInfo(pathItem.parentPath, result);
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

  arePathsEqual(left: Fmt.Path, right: Fmt.Path, unificationFn: Fmt.ExpressionUnificationFn | undefined = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  private getFileURI(name: string): string {
    return this.uri + encodeURI(name) + fileExtension;
  }

  private getMainDefinition(file: Fmt.File, expectedName: string): Fmt.Definition {
    if (file.definitions.length !== 1) {
      throw new Error('File is expected to contain exactly one definition');
    }
    const definition = file.definitions[0];
    if (definition.name !== expectedName) {
      throw new Error(`Expected name "${expectedName}" but found "${definition.name}" instead`);
    }
    return definition;
  }

  private createLibraryDefinition(fileReference: FileReference, definitionName: string, getMetaModel: Meta.MetaModelGetter, contents: string): LibraryDefinition {
    const stream = new FmtReader.StringInputStream(contents);
    const errorHandler = new FmtReader.DefaultErrorHandler(fileReference.fileName, this.options.checkMarkdownCode, this.options.allowPlaceholders);
    const file = FmtReader.readStream(stream, errorHandler, getMetaModel);
    return {
      file: file,
      definition: this.getMainDefinition(file, definitionName),
      state: LibraryDefinitionState.Loaded,
      fileReference: fileReference
    };
  }

  private preloadDefinitions(fileReference: FileReference, definitionName: string): CachedPromise<LibraryDefinition> {
    if (this.options.watchForChanges && fileReference.watch && this.active) {
      const watcher = fileReference.watch(() => {
        this.preloadedDefinitions.clear();
        this.sectionChangeCounter++;
        watcher.close();
        this.fileWatchers.delete(watcher);
      });
      this.fileWatchers.add(watcher);
    }
    return fileReference.read()
      .then((contents: string) => {
        const stream = new FmtReader.StringInputStream(contents);
        const errorHandler = new FmtReader.DefaultErrorHandler(fileReference.fileName);
        const sectionReader = new FmtReader.Reader(stream, errorHandler, FmtLibrary.getMetaModel);
        const sectionFileName = sectionReader.readIdentifier();
        if (sectionFileName !== this.getLocalSectionFileName()) {
          throw new Error(`Unrecognized section file name "${sectionFileName}"`);
        }
        const sectionFile = sectionReader.readPartialFile();
        if (this.active && stream.peekChar()) {
          const itemReader = new FmtReader.Reader(stream, errorHandler, this.logic.getMetaModel);
          do {
            const itemFileName = itemReader.readIdentifier();
            const itemFile = itemReader.readPartialFile();
            if (!this.fullyLoadedDefinitions.has(itemFileName)) {
              this.preloadedDefinitions.set(itemFileName, CachedPromise.resolve({
                file: itemFile,
                definition: this.getMainDefinition(itemFile, itemFileName),
                state: LibraryDefinitionState.Preloaded
              }));
            }
          } while (stream.peekChar());
        }
        return {
          file: sectionFile,
          definition: this.getMainDefinition(sectionFile, definitionName),
          state: LibraryDefinitionState.Preloaded
        };
      });
  }

  private watchFile(name: string, isSection: boolean, definitionName: string, getMetaModel: Meta.MetaModelGetter, watchedFile: WatchedFile): void {
    if (this.options.watchForChanges && watchedFile.fileReference.watch) {
      watchedFile.fileWatcher = watchedFile.fileReference.watch((newContents: string) => {
        if (this.active) {
          const currentEditedDefinition = this.editedDefinitions.get(name);
          try {
            const newLibraryDefinition = this.createLibraryDefinition(watchedFile.fileReference, definitionName, getMetaModel, newContents);
            if (watchedFile.libraryDefinition) {
              watchedFile.libraryDefinition.file = newLibraryDefinition.file;
              watchedFile.libraryDefinition.definition = newLibraryDefinition.definition;
              if (currentEditedDefinition) {
                currentEditedDefinition.file = watchedFile.libraryDefinition.file.clone();
                currentEditedDefinition.definition = this.getMainDefinition(currentEditedDefinition.file, definitionName);
              }
            } else {
              this.fullyLoadedDefinitions.set(name, CachedPromise.resolve(newLibraryDefinition));
              watchedFile.libraryDefinition = newLibraryDefinition;
            }
          } catch (error) {
            this.fullyLoadedDefinitions.delete(name);
            if (!currentEditedDefinition && watchedFile.fileWatcher) {
              watchedFile.fileWatcher.close();
              this.fileWatchers.delete(watchedFile.fileWatcher);
              watchedFile.fileWatcher = undefined;
            }
          }
          if (isSection) {
            this.sectionChangeCounter++;
          }
        }
      });
      this.fileWatchers.add(watchedFile.fileWatcher);
    }
  }

  private fetchDefinition(name: string, isSection: boolean, definitionName: string, getMetaModel: Meta.MetaModelGetter, fullContentsRequired: boolean): CachedPromise<LibraryDefinition> {
    const editedDefinition = this.editedDefinitions.get(name);
    if (editedDefinition) {
      return CachedPromise.resolve(editedDefinition);
    }
    let result = this.fullyLoadedDefinitions.get(name);
    if (!fullContentsRequired && !result?.isResolved()) {
      const preloadedDefinition = this.preloadedDefinitions.get(name);
      if (preloadedDefinition) {
        return preloadedDefinition;
      }
    }
    if (!result) {
      const uri = this.getFileURI(name);
      if (this.fileAccessor.preloadFile && !fullContentsRequired) {
        if (isSection) {
          result = this.fileAccessor.preloadFile(uri + preloadExtension)
            .then((preloadFileReference: FileReference) => this.preloadDefinitions(preloadFileReference, definitionName))
            .catch(() => this.fetchDefinition(name, isSection, definitionName, getMetaModel, true));
          if (this.active) {
            this.preloadedDefinitions.set(name, result);
          }
        } else {
          result = this.fetchLocalSection(false)
            .then(() => {
              const preloadedDefinition = this.preloadedDefinitions.get(name);
              if (preloadedDefinition) {
                return preloadedDefinition;
              } else {
                return this.fetchDefinition(name, isSection, definitionName, getMetaModel, true);
              }
            });
        }
      } else {
        const fileReference = this.fileAccessor.openFile(uri, false);
        const watchedFile: WatchedFile = {fileReference: fileReference};
        this.watchFile(name, isSection, definitionName, getMetaModel, watchedFile);
        result = fileReference.read().then((contents: string) => {
          this.preloadedDefinitions.delete(name);
          const libraryDefinition = this.createLibraryDefinition(fileReference, definitionName, getMetaModel, contents);
          watchedFile.libraryDefinition = libraryDefinition;
          return libraryDefinition;
        });
        if (this.active) {
          this.fullyLoadedDefinitions.set(name, result);
        }
      }
    }
    return result;
  }

  private fetchSection(name: string, prefetchContents: boolean = true, fullContentsRequired: boolean = false): CachedPromise<LibraryDefinition> {
    const result = this.fetchDefinition(name, true, this.childName, FmtLibrary.getMetaModel, fullContentsRequired);
    if (prefetchContents) {
      result.then((libraryDefinition: LibraryDefinition) => {
        if (this.active) {
          const contents = libraryDefinition.definition.contents;
          if (contents instanceof FmtLibrary.ObjectContents_Section) {
            let index = 0;
            for (const item of contents.items) {
              if (item instanceof FmtLibrary.MetaRefExpression_subsection || (item instanceof FmtLibrary.MetaRefExpression_item && !this.fileAccessor.preloadFile)) {
                const path = (item.ref as Fmt.DefinitionRefExpression).path;
                if (!path.parentPath && !this.preloadedDefinitions.has(path.name) && !this.fullyLoadedDefinitions.has(path.name)) {
                  const itemNumber = this.itemNumber ? [...this.itemNumber, index + 1] : undefined;
                  this.prefetchQueue?.push({
                    path: path,
                    isSubsection: item instanceof FmtLibrary.MetaRefExpression_subsection,
                    itemNumber: itemNumber
                  });
                }
              }
              index++;
            }
            if (this.prefetchQueue?.length) {
              this.triggerPrefetching();
            }
          }
        }
      });
    }
    return result;
  }

  fetchLocalSection(prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    return this.fetchSection(this.getLocalSectionFileName(), prefetchContents);
  }

  private getLocalSectionFileName(): string {
    return this.parent ? indexFileName : this.childName;
  }

  fetchSubsection(path: Fmt.Path, itemNumber?: LibraryItemNumber, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    const provider = this.getProviderForSection(path, itemNumber);
    return provider.fetchLocalSection(prefetchContents);
  }

  insertLocalSubsection(name: string, title: string, position?: number): CachedPromise<LibraryDefinition> {
    const localSectionFileName = this.getLocalSectionFileName();
    return this.fetchSection(localSectionFileName, false, true).then((sectionDefinition: LibraryDefinition) => {
      const sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      const newSubsectionRef = new Fmt.DefinitionRefExpression(new Fmt.Path(name));
      const newSubsection = new FmtLibrary.MetaRefExpression_subsection(newSubsectionRef, title);
      if (position === undefined) {
        sectionContents.items.push(newSubsection);
      } else {
        sectionContents.items.splice(position, 0, newSubsection);
      }
      if (sectionDefinition.state === LibraryDefinitionState.Preloaded || sectionDefinition.state === LibraryDefinitionState.Loaded) {
        sectionDefinition.state = LibraryDefinitionState.Editing;
      }
      this.editedDefinitions.set(localSectionFileName, sectionDefinition);
      this.localDefinitionModified(localSectionFileName, sectionDefinition);
      this.sectionChangeCounter++;
      const subsectionProvider = this.getProviderForSubsection(newSubsectionRef.path);
      const metaModelPath = sectionDefinition.file.metaModelPath.clone() as Fmt.Path;
      for (let pathItem: Fmt.PathItem | undefined = metaModelPath; pathItem; pathItem = pathItem.parentPath) {
        if (!pathItem.parentPath) {
          pathItem.parentPath = new Fmt.ParentPathItem;
          break;
        }
      }
      return subsectionProvider.createLocalSection(metaModelPath);
    });
  }

  private createLocalSection(metaModelPath: Fmt.Path): LibraryDefinition {
    const file = new Fmt.File(metaModelPath);
    const definition = new Fmt.Definition(this.childName, new FmtLibrary.MetaRefExpression_Section, new Fmt.ParameterList);
    definition.contents = new FmtLibrary.ObjectContents_Section(this.logic.name, []);
    file.definitions.push(definition);
    const name = this.getLocalSectionFileName();
    return this.createLocalDefinition(name, true, file, definition, FmtLibrary.getMetaModel);
  }

  fetchLocalItem(name: string, fullContentsRequired: boolean, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    const resultPromise = this.fetchDefinition(name, false, name, this.logic.getMetaModel, fullContentsRequired);
    if (prefetchContents) {
      const result = resultPromise.getImmediateResult();
      if (result && result.state === LibraryDefinitionState.Preloaded && this.active) {
        const path = new Fmt.Path(name);
        this.prefetchQueue?.push({
          path: path,
          isSubsection: false
        });
        this.triggerPrefetching();
      }
    }
    return resultPromise;
  }

  fetchItem(path: Fmt.Path, fullContentsRequired: boolean, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    const parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.fetchLocalItem(path.name, fullContentsRequired, prefetchContents);
  }

  isLocalItemUpToDate(name: string, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    const editedItem = this.editedDefinitions.get(name);
    if (editedItem) {
      return definitionPromise.getImmediateResult() === editedItem;
    }
    return this.definitionPromisesMatch(definitionPromise, this.preloadedDefinitions.get(name))
           || this.definitionPromisesMatch(definitionPromise, this.fullyLoadedDefinitions.get(name));
  }

  private definitionPromisesMatch(promise1: CachedPromise<LibraryDefinition> | undefined, promise2: CachedPromise<LibraryDefinition> | undefined): boolean {
    if (promise1 === promise2) {
      return true;
    }
    if (!promise1 || !promise2) {
      return false;
    }
    const promise1Result = promise1.getImmediateResult();
    return promise1Result !== undefined && promise1Result === promise2.getImmediateResult();
  }

  isItemUpToDate(path: Fmt.Path, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    const parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.isLocalItemUpToDate(path.name, definitionPromise);
  }

  isSubsectionUpToDate(path: Fmt.Path, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    const provider = this.getProviderForSection(path);
    return provider.isLocalItemUpToDate(provider.getLocalSectionFileName(), definitionPromise);
  }

  insertLocalItem(name: string, definitionType: Logic.LogicDefinitionTypeDescription, title: string | undefined, type: string | undefined, position?: number): CachedPromise<LibraryDefinition> {
    let itemNumberPromise: CachedPromise<void>;
    if (this.itemNumber) {
      itemNumberPromise = CachedPromise.resolve();
    } else {
      itemNumberPromise = this.parent!.getLocalItemInfo(this.childName)
        .then((ownItemInfo: LibraryItemInfo) => {
          this.itemNumber = ownItemInfo.itemNumber;
        });
    }
    const localSectionFileName = this.getLocalSectionFileName();
    return itemNumberPromise
      .then(() => this.fetchSection(localSectionFileName, false, true))
      .then((sectionDefinition: LibraryDefinition) => {
        const sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
        const newItemRef = new Fmt.DefinitionRefExpression(new Fmt.Path(name));
        const newItem = new FmtLibrary.MetaRefExpression_item(newItemRef, type, title);
        if (position === undefined) {
          position = sectionContents.items.length;
          sectionContents.items.push(newItem);
        } else {
          sectionContents.items.splice(position, 0, newItem);
        }
        if (sectionDefinition.state === LibraryDefinitionState.Preloaded || sectionDefinition.state === LibraryDefinitionState.Loaded) {
          sectionDefinition.state = LibraryDefinitionState.Editing;
        }
        this.editedDefinitions.set(localSectionFileName, sectionDefinition);
        this.localDefinitionModified(localSectionFileName, sectionDefinition);
        this.sectionChangeCounter++;
        const metaModelPath = new Fmt.Path(this.logic.name, undefined, sectionDefinition.file.metaModelPath.parentPath);
        this.editedItemInfos.set(name, {
          itemNumber: [...this.itemNumber!, position + 1],
          type: type,
          title: title
        });
        return this.createLocalItem(name, definitionType, metaModelPath);
      });
  }

  private createLocalItem(name: string, definitionType: Logic.LogicDefinitionTypeDescription, metaModelPath: Fmt.Path): LibraryDefinition {
    const file = new Fmt.File(metaModelPath);
    const definition = Logic.createDefinition(definitionType, name);
    const references = new Fmt.DocumentationItem('references', undefined, defaultReferencesString);
    definition.documentation = new Fmt.DocumentationComment([references]);
    file.definitions.push(definition);
    return this.createLocalDefinition(name, false, file, definition, this.logic.getMetaModel);
  }

  private createLocalDefinition(name: string, isSection: boolean, file: Fmt.File, definition: Fmt.Definition, getMetaModel: Meta.MetaModelGetter): LibraryDefinition {
    const uri = this.getFileURI(name);
    const fileReference = this.fileAccessor.openFile(uri, true);
    const libraryDefinition: LibraryDefinition = {
      file: file,
      definition: definition,
      state: LibraryDefinitionState.EditingNew,
      modified: false,
      fileReference: fileReference
    };
    this.editedDefinitions.set(name, libraryDefinition);
    const watchedFile: WatchedFile = {
      fileReference: fileReference,
      libraryDefinition: libraryDefinition
    };
    this.watchFile(name, isSection, definition.name, getMetaModel, watchedFile);
    this.prePublishLocalDefinition(libraryDefinition);
    return libraryDefinition;
  }

  editLocalItem(libraryDefinition: LibraryDefinition, itemInfo: LibraryItemInfo): LibraryDefinition {
    if (!libraryDefinition.fileReference) {
      throw new InternalError('Trying to edit definition without file reference');
    }
    const name = libraryDefinition.definition.name;
    const clonedFile = libraryDefinition.file.clone();
    const clonedLibraryDefinition: LibraryDefinition = {
      file: clonedFile,
      definition: this.getMainDefinition(clonedFile, name),
      state: LibraryDefinitionState.Editing,
      modified: false,
      fileReference: libraryDefinition.fileReference
    };
    this.editedDefinitions.set(name, clonedLibraryDefinition);
    this.editedItemInfos.set(name, itemInfo);
    this.originalItemInfos.set(name, {...itemInfo});
    return clonedLibraryDefinition;
  }

  localItemModified(editedLibraryDefinition: LibraryDefinition): void {
    const name = editedLibraryDefinition.definition.name;
    this.localDefinitionModified(name, editedLibraryDefinition);
  }

  private localDefinitionModified(name: string, editedLibraryDefinition: LibraryDefinition): void {
    if (this.editedDefinitions.get(name) !== editedLibraryDefinition) {
      throw new InternalError('Trying to modify definition that is not being edited');
    }
    editedLibraryDefinition.modified = true;
    this.prePublishLocalDefinition(editedLibraryDefinition);
  }

  cancelEditing(editedLibraryDefinition: LibraryDefinition): void {
    const name = editedLibraryDefinition.definition.name;
    if (editedLibraryDefinition === this.editedDefinitions.get(name)) {
      this.editedDefinitions.delete(name);
    }
    const origInfo = this.originalItemInfos.get(name);
    const sectionDefinition = this.editedDefinitions.get(this.getLocalSectionFileName());
    if (sectionDefinition) {
      const sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      let indexToRemove = undefined;
      sectionContents.items.map((item: Fmt.Expression, index: number) => {
        if ((item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) && item.ref instanceof Fmt.DefinitionRefExpression && item.ref.path.name === name) {
          if (editedLibraryDefinition.state === LibraryDefinitionState.EditingNew) {
            indexToRemove = index;
          } else {
            if (origInfo) {
              if (item instanceof FmtLibrary.MetaRefExpression_item) {
                item.type = origInfo.type;
              }
              item.title = origInfo.title;
            }
          }
        }
      });
      if (indexToRemove !== undefined) {
        sectionContents.items.splice(indexToRemove, 1);
      }
    }
    if (origInfo) {
      const editedInfo = this.editedItemInfos.get(name);
      if (editedInfo) {
        Object.assign(editedInfo, origInfo);
      }
    }
    this.editedItemInfos.delete(name);
    this.originalItemInfos.delete(name);
    this.sectionChangeCounter++;
    this.unPrePublishLocalDefinition(editedLibraryDefinition);
  }

  submitLocalItem(editedLibraryDefinition: LibraryDefinition): CachedPromise<WriteFileResult> {
    const name = editedLibraryDefinition.definition.name;
    if (this.editedDefinitions.get(name) !== editedLibraryDefinition) {
      return CachedPromise.reject(new InternalError('Trying to submit definition that is not being edited'));
    }
    const prevState = editedLibraryDefinition.state;
    editedLibraryDefinition.state = LibraryDefinitionState.Submitting;
    const localSectionFileName = this.getLocalSectionFileName();
    const sectionDefinition = this.editedDefinitions.get(localSectionFileName);
    if (sectionDefinition) {
      return this.submitLocalSection(localSectionFileName, sectionDefinition)
        .then(() => this.submitLocalDefinition(name, editedLibraryDefinition, false))
        .catch((error) => {
          editedLibraryDefinition.state = prevState;
          return CachedPromise.reject(error);
        });
    }
    return this.submitLocalDefinition(name, editedLibraryDefinition, false)
      .catch((error) => {
        editedLibraryDefinition.state = prevState;
        return CachedPromise.reject(error);
      });
  }

  private submitLocalSection(localSectionFileName: string, sectionDefinition: LibraryDefinition): CachedPromise<WriteFileResult> {
    const prevState = sectionDefinition.state;
    sectionDefinition.state = LibraryDefinitionState.Submitting;
    if (this.parent && prevState === LibraryDefinitionState.EditingNew) {
      const parentSectionFileName = this.parent.getLocalSectionFileName();
      const parentSectionDefinition = this.parent.editedDefinitions.get(parentSectionFileName);
      if (parentSectionDefinition) {
        return this.parent.submitLocalSection(parentSectionFileName, parentSectionDefinition)
          .then(() => this.submitLocalDefinition(localSectionFileName, sectionDefinition, true))
          .catch((error) => {
            sectionDefinition.state = prevState;
            return CachedPromise.reject(error);
          });
      }
    }
    return this.submitLocalDefinition(localSectionFileName, sectionDefinition, true)
      .catch((error) => {
        sectionDefinition.state = prevState;
        return CachedPromise.reject(error);
      });
  }

  private prePublishLocalDefinition(editedLibraryDefinition: LibraryDefinition): void {
    if (editedLibraryDefinition.fileReference && editedLibraryDefinition.fileReference.prePublish) {
      try {
        const contents = FmtWriter.writeString(editedLibraryDefinition.file, true);
        editedLibraryDefinition.fileReference.prePublish(contents, false)
          .then(() => {
            if (editedLibraryDefinition.state === LibraryDefinitionState.EditingNew) {
              editedLibraryDefinition.state = LibraryDefinitionState.Editing;
            }
          })
          .catch(() => {});
      } catch (error) {
      }
    }
  }

  private unPrePublishLocalDefinition(editedLibraryDefinition: LibraryDefinition): void {
    if (editedLibraryDefinition.fileReference?.unPrePublish) {
      editedLibraryDefinition.fileReference.unPrePublish()
        .catch(() => {});
    }
  }

  private submitLocalDefinition(name: string, editedLibraryDefinition: LibraryDefinition, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    if (!editedLibraryDefinition.fileReference?.write) {
      return CachedPromise.reject(new InternalError('Trying to submit definition without file reference'));
    }
    try {
      const contents = FmtWriter.writeString(editedLibraryDefinition.file);
      return editedLibraryDefinition.fileReference.write(contents, isPartOfGroup)
        .then((result: WriteFileResult) => {
          this.replaceLocalDefinition(name, editedLibraryDefinition);
          return result;
        });
    } catch (error) {
      return CachedPromise.reject(error);
    }
  }

  submitLocalTutorialItem(newLibraryDefinition: LibraryDefinition, notify: boolean): void {
    const name = newLibraryDefinition.definition.name;
    this.replaceLocalDefinition(name, newLibraryDefinition);
    if (notify && newLibraryDefinition.fileReference?.write) {
      let contents = FmtWriter.writeString(newLibraryDefinition.file);
      contents = '/* Tutorial mode */\n\n' + contents;
      newLibraryDefinition.fileReference.write(contents, false)
        .catch(() => {});
    }
  }

  private replaceLocalDefinition(name: string, newLibraryDefinition: LibraryDefinition): void {
    newLibraryDefinition.state = LibraryDefinitionState.Loaded;
    const fullyLoadedDefinitionPromise = this.fullyLoadedDefinitions.get(name);
    if (fullyLoadedDefinitionPromise) {
      const fullyLoadedDefinition = fullyLoadedDefinitionPromise.getImmediateResult();
      if (fullyLoadedDefinition) {
        fullyLoadedDefinition.file = newLibraryDefinition.file;
        fullyLoadedDefinition.definition = newLibraryDefinition.definition;
      } else {
        this.fullyLoadedDefinitions.set(name, CachedPromise.resolve(newLibraryDefinition));
      }
    } else {
      this.fullyLoadedDefinitions.set(name, CachedPromise.resolve(newLibraryDefinition));
    }
    this.preloadedDefinitions.delete(name);
    this.editedDefinitions.delete(name);
    this.editedItemInfos.delete(name);
    this.originalItemInfos.delete(name);
  }

  checkDefaultReferences(editedLibraryDefinition: LibraryDefinition): boolean {
    if (editedLibraryDefinition.definition.documentation) {
      for (const item of editedLibraryDefinition.definition.documentation.items) {
        if (item.text === defaultReferencesString) {
          return false;
        }
      }
    }
    return true;
  }

  viewLocalItem(name: string, openLocally: boolean): CachedPromise<void> {
    const uri = this.getFileURI(name);
    return this.fileAccessor.openFile(uri, false).view!(openLocally);
  }

  isSubsection(name: string): CachedPromise<boolean> {
    return this.fetchLocalSection(false).then((sectionDefinition: LibraryDefinition) => {
      const sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      for (const item of sectionContents.items) {
        if (item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof FmtLibrary.MetaRefExpression_item) {
          if ((item.ref as Fmt.DefinitionRefExpression).path.name === name) {
            return item instanceof FmtLibrary.MetaRefExpression_subsection;
          }
        }
      }
      return false;
    });
  }

  getItemInfo(path: Fmt.Path): CachedPromise<LibraryItemInfo> {
    const parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.getLocalItemInfo(path.name);
  }

  getLocalItemInfo(name: string): CachedPromise<LibraryItemInfo> {
    const editedInfo = this.editedItemInfos.get(name);
    if (editedInfo) {
      return CachedPromise.resolve(editedInfo);
    }
    return this.fetchLocalSection(false).then((sectionDefinition: LibraryDefinition) => {
      const sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      let type: string | undefined = undefined;
      let title: string | undefined = undefined;
      let index = 0;
      for (const item of sectionContents.items) {
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

  setLocalItemInfo(name: string, info: LibraryItemInfo): CachedPromise<void> {
    const localSectionFileName = this.getLocalSectionFileName();
    return this.fetchSection(localSectionFileName, false, true).then((sectionDefinition: LibraryDefinition) => {
      const sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      for (const item of sectionContents.items) {
        if (item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof FmtLibrary.MetaRefExpression_item) {
          if ((item.ref as Fmt.DefinitionRefExpression).path.name === name) {
            if (item instanceof FmtLibrary.MetaRefExpression_item) {
              item.type = info.type;
            }
            item.title = info.title;
            break;
          }
        }
      }
      if (sectionDefinition.state === LibraryDefinitionState.Loaded) {
        sectionDefinition.state = LibraryDefinitionState.Editing;
      }
      this.editedDefinitions.set(localSectionFileName, sectionDefinition);
      const editedInfo = this.editedItemInfos.get(name);
      if (editedInfo) {
        Object.assign(editedInfo, info);
      }
    });
  }

  private triggerPrefetching(): void {
    if (!this.prefetchTimer) {
      const prefetch = () => {
        this.prefetchTimer = undefined;
        for (let i = 0; i < 4; i++) {
          this.prefetch();
        }
      };
      this.prefetchTimer = setTimeout(prefetch, 0);
    }
  }

  private prefetch = (): boolean => {
    const prefetchQueueItem = this.prefetchQueue?.shift();
    if (prefetchQueueItem) {
      if (prefetchQueueItem.isSubsection) {
        this.fetchSubsection(prefetchQueueItem.path, prefetchQueueItem.itemNumber, false)
          .then(this.prefetch)
          .catch(this.prefetch);
      } else {
        this.fetchItem(prefetchQueueItem.path, true)
          .then(this.prefetch)
          .catch(this.prefetch);
      }
      return true;
    } else {
      return false;
    }
  };

  pathToURI(path: Fmt.Path): string {
    const parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.externalURI + encodeURI(path.name);
  }

  uriToPath(uri: string, allowIndex: boolean = false): Fmt.Path | undefined {
    if (uri.startsWith(this.externalURI)) {
      uri = uri.substring(this.externalURI.length);
      let path: Fmt.PathItem | undefined = undefined;
      let slashPos = uri.indexOf('/');
      while (slashPos >= 0) {
        if (slashPos > 0) {
          const name = decodeURI(uri.substring(0, slashPos));
          path = new Fmt.NamedPathItem(name, path);
        }
        uri = uri.substring(slashPos + 1);
        slashPos = uri.indexOf('/');
      }
      if (uri) {
        let name = decodeURI(uri);
        if (name.endsWith(fileExtension)) {
          name = name.substring(0, name.length - fileExtension.length);
        }
        if (name === indexFileName && !allowIndex) {
          return undefined;
        }
        return new Fmt.Path(name, undefined, path);
      }
    }
    return undefined;
  }

  getSectionURI(): string {
    if (this.externalURI.endsWith('/')) {
      return this.externalURI.substring(0, this.externalURI.length - 1);
    } else {
      return this.externalURI;
    }
  }

  private getLogicMetaModelPath(prefix?: Fmt.PathItem): Fmt.Path {
    if (this.parent) {
      const parentPrefix = new Fmt.ParentPathItem(prefix);
      return this.parent.getLogicMetaModelPath(parentPrefix);
    } else {
      const parentParentParentPath = new Fmt.ParentPathItem(prefix);
      const parentParentPath = new Fmt.ParentPathItem(parentParentParentPath);
      const parentPath = new Fmt.NamedPathItem('logics', parentParentPath);
      return new Fmt.Path(this.logic.name, undefined, parentPath);
    }
  }
}
