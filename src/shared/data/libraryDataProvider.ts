import { LibraryDataAccessor, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, formatItemNumber, LibraryItemNumber } from './libraryDataAccessor';
import { FileAccessor, FileReference, WriteFileResult, FileWatcher } from './fileAccessor';
import { fileExtension, preloadExtension, indexFileName, defaultLibraryName } from './constants';
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
  private subsectionProviderCache = new Map<string, LibraryDataProvider>();
  private preloadedDefinitions = new Map<string, CachedPromise<LibraryDefinition>>();
  private fullyLoadedDefinitions = new Map<string, CachedPromise<LibraryDefinition>>();
  private editedDefinitions = new Map<string, LibraryDefinition>();
  private editedItemInfos = new Map<string, LibraryItemInfo>();
  private originalItemInfos = new Map<string, LibraryItemInfo>();
  private prefetchQueue: PrefetchQueueItem[] = [];
  private prefetchTimer: any;
  private sectionChangeCounter = 0;

  constructor(private options: LibraryDataProviderOptions, private childName: string = defaultLibraryName, private parent?: LibraryDataProvider, private itemNumber?: LibraryItemNumber) {
    this.logic = options.logic;
    this.fileAccessor = options.fileAccessor;
    if (parent) {
      let path = new Fmt.NamedPathItem;
      path.name = childName;
      path.parentPath = parent.path;
      this.path = path;
      this.uri = parent.uri + encodeURI(childName) + '/';
      this.externalURI = parent.externalURI + encodeURI(childName) + '/';
    } else {
      this.externalURI = options.externalURIPrefix ?? '';
      if (this.externalURI && !this.externalURI.endsWith('/')) {
        this.externalURI += '/';
      }
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
    let parentProvider = this.getProviderForSection(path.parentPath);
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
    let definition = file.definitions[0];
    if (definition.name !== expectedName) {
      throw new Error(`Expected name "${expectedName}" but found "${definition.name}" instead`);
    }
    return definition;
  }

  private createLibraryDefinition(fileReference: FileReference, definitionName: string, getMetaModel: Meta.MetaModelGetter, contents: string): LibraryDefinition {
    let stream = new FmtReader.StringInputStream(contents);
    let errorHandler = new FmtReader.DefaultErrorHandler(fileReference.fileName, this.options.checkMarkdownCode, this.options.allowPlaceholders);
    let file = FmtReader.readStream(stream, errorHandler, getMetaModel);
    return {
      file: file,
      definition: this.getMainDefinition(file, definitionName),
      state: LibraryDefinitionState.Loaded,
      fileReference: fileReference
    };
  }

  private preloadDefinitions(fileReference: FileReference, definitionName: string): CachedPromise<LibraryDefinition> {
    if (this.options.watchForChanges && fileReference.watch) {
      let watcher = fileReference.watch(() => {
        this.preloadedDefinitions.clear();
        this.sectionChangeCounter++;
        watcher.close();
      });
    }
    return fileReference.read()
      .then((contents: string) => {
        let stream = new FmtReader.StringInputStream(contents);
        let errorHandler = new FmtReader.DefaultErrorHandler(fileReference.fileName);
        let sectionReader = new FmtReader.Reader(stream, errorHandler, FmtLibrary.getMetaModel);
        let sectionFileName = sectionReader.readIdentifier();
        if (sectionFileName !== this.getLocalSectionFileName()) {
          throw new Error(`Unrecognized section file name "${sectionFileName}"`);
        }
        let sectionFile = sectionReader.readPartialFile();
        if (stream.peekChar()) {
          let itemReader = new FmtReader.Reader(stream, errorHandler, this.logic.getMetaModel);
          do {
            let itemFileName = itemReader.readIdentifier();
            let itemFile = itemReader.readPartialFile();
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
        let currentEditedDefinition = this.editedDefinitions.get(name);
        try {
          let newLibraryDefinition = this.createLibraryDefinition(watchedFile.fileReference, definitionName, getMetaModel, newContents);
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
          if (!currentEditedDefinition) {
            watchedFile.fileWatcher?.close();
          }
        }
        if (isSection) {
          this.sectionChangeCounter++;
        }
      });
    }
  }

  private fetchDefinition(name: string, isSection: boolean, definitionName: string, getMetaModel: Meta.MetaModelGetter, fullContentsRequired: boolean): CachedPromise<LibraryDefinition> {
    let editedDefinition = this.editedDefinitions.get(name);
    if (editedDefinition) {
      return CachedPromise.resolve(editedDefinition);
    }
    let result = this.fullyLoadedDefinitions.get(name);
    if (!fullContentsRequired && !result?.isResolved()) {
      let preloadedDefinition = this.preloadedDefinitions.get(name);
      if (preloadedDefinition) {
        return preloadedDefinition;
      }
    }
    if (!result) {
      let uri = this.getFileURI(name);
      if (this.fileAccessor.preloadFile && !fullContentsRequired) {
        if (isSection) {
          result = this.fileAccessor.preloadFile(uri + preloadExtension)
            .then((preloadFileReference: FileReference) => this.preloadDefinitions(preloadFileReference, definitionName))
            .catch(() => this.fetchDefinition(name, isSection, definitionName, getMetaModel, true));
          this.preloadedDefinitions.set(name, result);
        } else {
          result = this.fetchLocalSection(false)
            .then(() => {
              let preloadedDefinition = this.preloadedDefinitions.get(name);
              if (preloadedDefinition) {
                return preloadedDefinition;
              } else {
                return this.fetchDefinition(name, isSection, definitionName, getMetaModel, true);
              }
            });
        }
      } else {
        let fileReference = this.fileAccessor.openFile(uri, false);
        let watchedFile: WatchedFile = {fileReference: fileReference};
        this.watchFile(name, isSection, definitionName, getMetaModel, watchedFile);
        result = fileReference.read().then((contents: string) => {
          this.preloadedDefinitions.delete(name);
          let libraryDefinition = this.createLibraryDefinition(fileReference, definitionName, getMetaModel, contents);
          watchedFile.libraryDefinition = libraryDefinition;
          return libraryDefinition;
        });
        this.fullyLoadedDefinitions.set(name, result);
      }
    }
    return result;
  }

  private fetchSection(name: string, prefetchContents: boolean = true, fullContentsRequired: boolean = false): CachedPromise<LibraryDefinition> {
    let result = this.fetchDefinition(name, true, this.childName, FmtLibrary.getMetaModel, fullContentsRequired);
    if (prefetchContents) {
      result.then((libraryDefinition: LibraryDefinition) => {
        let contents = libraryDefinition.definition.contents;
        if (contents instanceof FmtLibrary.ObjectContents_Section) {
          let index = 0;
          for (let item of contents.items) {
            if (item instanceof FmtLibrary.MetaRefExpression_subsection || (item instanceof FmtLibrary.MetaRefExpression_item && !this.fileAccessor.preloadFile)) {
              let path = (item.ref as Fmt.DefinitionRefExpression).path;
              if (!path.parentPath && !this.preloadedDefinitions.has(path.name) && !this.fullyLoadedDefinitions.has(path.name)) {
                let itemNumber = this.itemNumber ? [...this.itemNumber, index + 1] : undefined;
                this.prefetchQueue.push({
                  path: path,
                  isSubsection: item instanceof FmtLibrary.MetaRefExpression_subsection,
                  itemNumber: itemNumber
                });
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
    return this.fetchSection(this.getLocalSectionFileName(), prefetchContents);
  }

  private getLocalSectionFileName(): string {
    return this.parent ? indexFileName : this.childName;
  }

  fetchSubsection(path: Fmt.Path, itemNumber?: LibraryItemNumber, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let provider = this.getProviderForSection(path, itemNumber);
    return provider.fetchLocalSection(prefetchContents);
  }

  insertLocalSubsection(name: string, title: string, position?: number): CachedPromise<LibraryDefinition> {
    let localSectionFileName = this.getLocalSectionFileName();
    return this.fetchSection(localSectionFileName, false, true).then((sectionDefinition: LibraryDefinition) => {
      let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      let newSubsectionRef = new Fmt.DefinitionRefExpression;
      newSubsectionRef.path = new Fmt.Path;
      newSubsectionRef.path.name = name;
      let newSubsection = new FmtLibrary.MetaRefExpression_subsection;
      newSubsection.ref = newSubsectionRef;
      newSubsection.title = title || '';
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
      let subsectionProvider = this.getProviderForSubsection(newSubsectionRef.path);
      let metaModelPath = sectionDefinition.file.metaModelPath.clone() as Fmt.Path;
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
    let file = new Fmt.File;
    file.metaModelPath = metaModelPath;
    let definition = new Fmt.Definition;
    definition.name = this.childName;
    definition.type = new FmtLibrary.MetaRefExpression_Section;
    let contents = new FmtLibrary.ObjectContents_Section;
    contents.logic = this.logic.name;
    contents.items = [];
    definition.contents = contents;
    file.definitions.push(definition);
    let name = this.getLocalSectionFileName();
    return this.createLocalDefinition(name, true, file, definition, FmtLibrary.getMetaModel);
  }

  fetchLocalItem(name: string, fullContentsRequired: boolean, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let resultPromise = this.fetchDefinition(name, false, name, this.logic.getMetaModel, fullContentsRequired);
    if (prefetchContents) {
      let result = resultPromise.getImmediateResult();
      if (result && result.state === LibraryDefinitionState.Preloaded) {
        let path = new Fmt.Path;
        path.name = name;
        this.prefetchQueue.push({
          path: path,
          isSubsection: false
        });
        this.triggerPrefetching();
      }
    }
    return resultPromise;
  }

  fetchItem(path: Fmt.Path, fullContentsRequired: boolean, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.fetchLocalItem(path.name, fullContentsRequired, prefetchContents);
  }

  isLocalItemUpToDate(name: string, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    let editedItem = this.editedDefinitions.get(name);
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
    let promise1Result = promise1.getImmediateResult();
    return promise1Result !== undefined && promise1Result === promise2.getImmediateResult();
  }

  isItemUpToDate(path: Fmt.Path, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.isLocalItemUpToDate(path.name, definitionPromise);
  }

  isSubsectionUpToDate(path: Fmt.Path, definitionPromise: CachedPromise<LibraryDefinition>): boolean {
    let provider = this.getProviderForSection(path);
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
    let localSectionFileName = this.getLocalSectionFileName();
    return itemNumberPromise
      .then(() => this.fetchSection(localSectionFileName, false, true))
      .then((sectionDefinition: LibraryDefinition) => {
        let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
        let newItemRef = new Fmt.DefinitionRefExpression;
        newItemRef.path = new Fmt.Path;
        newItemRef.path.name = name;
        let newItem = new FmtLibrary.MetaRefExpression_item;
        newItem.ref = newItemRef;
        newItem.title = title;
        newItem.type = type;
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
        let metaModelPath = new Fmt.Path;
        metaModelPath.name = this.logic.name;
        metaModelPath.parentPath = sectionDefinition.file.metaModelPath.parentPath;
        this.editedItemInfos.set(name, {
          itemNumber: [...this.itemNumber!, position + 1],
          type: type,
          title: title
        });
        return this.createLocalItem(name, definitionType, metaModelPath);
      });
  }

  private createLocalItem(name: string, definitionType: Logic.LogicDefinitionTypeDescription, metaModelPath: Fmt.Path): LibraryDefinition {
    let file = new Fmt.File;
    file.metaModelPath = metaModelPath;
    let definition = Logic.createDefinition(definitionType, name);
    let references = new Fmt.DocumentationItem;
    references.kind = 'references';
    references.text = defaultReferencesString;
    definition.documentation = new Fmt.DocumentationComment;
    definition.documentation.items = [references];
    file.definitions.push(definition);
    return this.createLocalDefinition(name, false, file, definition, this.logic.getMetaModel);
  }

  private createLocalDefinition(name: string, isSection: boolean, file: Fmt.File, definition: Fmt.Definition, getMetaModel: Meta.MetaModelGetter): LibraryDefinition {
    let uri = this.getFileURI(name);
    let fileReference = this.fileAccessor.openFile(uri, true);
    let libraryDefinition: LibraryDefinition = {
      file: file,
      definition: definition,
      state: LibraryDefinitionState.EditingNew,
      modified: false,
      fileReference: fileReference
    };
    this.editedDefinitions.set(name, libraryDefinition);
    let watchedFile: WatchedFile = {
      fileReference: fileReference,
      libraryDefinition: libraryDefinition
    };
    this.watchFile(name, isSection, definition.name, getMetaModel, watchedFile);
    this.prePublishLocalDefinition(libraryDefinition);
    return libraryDefinition;
  }

  editLocalItem(libraryDefinition: LibraryDefinition, itemInfo: LibraryItemInfo): LibraryDefinition {
    if (!libraryDefinition.fileReference) {
      throw new Error('Internal error: trying to edit definition without file reference');
    }
    let name = libraryDefinition.definition.name;
    let clonedFile = libraryDefinition.file.clone();
    let clonedLibraryDefinition: LibraryDefinition = {
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
    let name = editedLibraryDefinition.definition.name;
    this.localDefinitionModified(name, editedLibraryDefinition);
  }

  private localDefinitionModified(name: string, editedLibraryDefinition: LibraryDefinition): void {
    if (this.editedDefinitions.get(name) !== editedLibraryDefinition) {
      throw new Error('Internal error: trying to modify definition that is not being edited');
    }
    editedLibraryDefinition.modified = true;
    this.prePublishLocalDefinition(editedLibraryDefinition);
  }

  cancelEditing(editedLibraryDefinition: LibraryDefinition): void {
    let name = editedLibraryDefinition.definition.name;
    if (editedLibraryDefinition === this.editedDefinitions.get(name)) {
      this.editedDefinitions.delete(name);
    }
    let origInfo = this.originalItemInfos.get(name);
    let sectionDefinition = this.editedDefinitions.get(this.getLocalSectionFileName());
    if (sectionDefinition) {
      let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
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
      let editedInfo = this.editedItemInfos.get(name);
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
    if (!editedLibraryDefinition.fileReference) {
      return CachedPromise.reject(new Error('Internal error: trying to submit definition without file reference'));
    }
    let name = editedLibraryDefinition.definition.name;
    if (this.editedDefinitions.get(name) !== editedLibraryDefinition) {
      return CachedPromise.reject(new Error('Internal error: trying to submit definition that is not being edited'));
    }
    if (editedLibraryDefinition.definition.documentation) {
      for (let item of editedLibraryDefinition.definition.documentation.items) {
        if (item.text === defaultReferencesString) {
          return CachedPromise.reject(new Error('References must be adapted before submitting.'));
        }
      }
    }
    let prevState = editedLibraryDefinition.state;
    editedLibraryDefinition.state = LibraryDefinitionState.Submitting;
    let localSectionFileName = this.getLocalSectionFileName();
    let sectionDefinition = this.editedDefinitions.get(localSectionFileName);
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
    let prevState = sectionDefinition.state;
    sectionDefinition.state = LibraryDefinitionState.Submitting;
    if (this.parent && prevState === LibraryDefinitionState.EditingNew) {
      let parentSectionFileName = this.parent.getLocalSectionFileName();
      let parentSectionDefinition = this.parent.editedDefinitions.get(parentSectionFileName);
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
        let contents = FmtWriter.writeString(editedLibraryDefinition.file, true);
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
    if (editedLibraryDefinition.fileReference && editedLibraryDefinition.fileReference.unPrePublish) {
      editedLibraryDefinition.fileReference.unPrePublish()
        .catch(() => {});
    }
  }

  private submitLocalDefinition(name: string, editedLibraryDefinition: LibraryDefinition, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    if (!editedLibraryDefinition.fileReference) {
      return CachedPromise.reject(new Error('Internal error: trying to submit definition without file reference'));
    }
    try {
      let contents = FmtWriter.writeString(editedLibraryDefinition.file);
      return editedLibraryDefinition.fileReference.write!(contents, isPartOfGroup)
        .then((result: WriteFileResult) => {
          this.replaceLocalDefinition(name, editedLibraryDefinition);
          return result;
        });
    } catch (error) {
      return CachedPromise.reject(error);
    }
  }

  replaceLocalItem(newLibraryDefinition: LibraryDefinition): void {
    let name = newLibraryDefinition.definition.name;
    this.replaceLocalDefinition(name, newLibraryDefinition);
  }

  private replaceLocalDefinition(name: string, newLibraryDefinition: LibraryDefinition): void {
    newLibraryDefinition.state = LibraryDefinitionState.Loaded;
    let fullyLoadedDefinitionPromise = this.fullyLoadedDefinitions.get(name);
    if (fullyLoadedDefinitionPromise) {
      let fullyLoadedDefinition = fullyLoadedDefinitionPromise.getImmediateResult();
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

  viewLocalItem(name: string, openLocally: boolean): CachedPromise<void> {
    let uri = this.getFileURI(name);
    return this.fileAccessor.openFile(uri, false).view!(openLocally);
  }

  isSubsection(name: string): CachedPromise<boolean> {
    return this.fetchLocalSection(false).then((sectionDefinition: LibraryDefinition) => {
      let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      for (let item of sectionContents.items) {
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
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.getLocalItemInfo(path.name);
  }

  getLocalItemInfo(name: string): CachedPromise<LibraryItemInfo> {
    let editedInfo = this.editedItemInfos.get(name);
    if (editedInfo) {
      return CachedPromise.resolve(editedInfo);
    }
    return this.fetchLocalSection(false).then((sectionDefinition: LibraryDefinition) => {
      let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      let type: string | undefined = undefined;
      let title: string | undefined = undefined;
      let index = 0;
      for (let item of sectionContents.items) {
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
    let localSectionFileName = this.getLocalSectionFileName();
    return this.fetchSection(localSectionFileName, false, true).then((sectionDefinition: LibraryDefinition) => {
      let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      for (let item of sectionContents.items) {
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
      let editedInfo = this.editedItemInfos.get(name);
      if (editedInfo) {
        Object.assign(editedInfo, info);
      }
    });
  }

  private triggerPrefetching(): void {
    if (!this.prefetchTimer) {
      let prefetch = () => {
        for (let i = 0; i < 4; i++) {
          this.prefetch();
        }
        this.prefetchTimer = undefined;
      };
      this.prefetchTimer = setTimeout(prefetch, 0);
    }
  }

  private prefetch = (): boolean => {
    let prefetchQueueItem = this.prefetchQueue.shift();
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
    let parentProvider = this.getProviderForSection(path.parentPath);
    return parentProvider.externalURI + encodeURI(path.name);
  }

  uriToPath(uri: string, allowIndex: boolean = false): Fmt.Path | undefined {
    if (uri.startsWith(this.externalURI)) {
      uri = uri.substring(this.externalURI.length);
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
        let name = decodeURI(uri);
        if (name.endsWith(fileExtension)) {
          name = name.substring(0, name.length - fileExtension.length);
        }
        if (name === indexFileName && !allowIndex) {
          return undefined;
        }
        let result = new Fmt.Path;
        result.name = name;
        result.parentPath = path;
        return result;
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
