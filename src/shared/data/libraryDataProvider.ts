import { LibraryDataAccessor, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, formatItemNumber } from './libraryDataAccessor';
import { FileAccessor, FileContents, WriteFileResult, FileWatcher } from './fileAccessor';
import CachedPromise from './cachedPromise';
import * as Fmt from '../format/format';
import * as Meta from '../format/metaModel';
import * as FmtReader from '../format/read';
import * as FmtWriter from '../format/write';
import * as FmtLibrary from '../logics/library';
import * as Logic from '../logics/logic';

export { LibraryDataAccessor, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, formatItemNumber };


const fileExtension = '.slate';
const indexFileName = '_index';

export const defaultReferences = [
  'https://en.wikipedia.org/wiki/',
  'https://mathworld.wolfram.com/',
  'https://proofwiki.org/wiki/',
  'https://ncatlab.org/nlab/show/',
  'https://coq.inria.fr/library/',
  'https://leanprover-community.github.io/mathlib_docs/',
  'http://oeis.org/'
];
const defaultReferencesString = defaultReferences.map((ref) => `* ${ref}...`).reduce((prev, cur) => `${prev}\n${cur}`);
export const defaultReferenceSearchURLs = [
  'https://en.wikipedia.org/w/index.php?search=',
  'https://mathworld.wolfram.com/search/?query=',
  'https://www.google.com/search?q=site%3Aproofwiki.org+',
  'https://www.google.com/search?q=site%3Ancatlab.org+',
  'https://www.google.com/search?q=site%3Acoq.inria.fr%2Flibrary+',
  'https://www.google.com/search?q=site%3Aleanprover-community.github.io%2Fmathlib_docs+'
];

export interface LibraryDataProviderConfig {
  canPreload: boolean;
  watchForChanges: boolean;
  checkMarkdownCode: boolean;
}
export const defaultLibraryDataProviderConfig: LibraryDataProviderConfig = {
  canPreload: false,
  watchForChanges: false,
  checkMarkdownCode: false
};

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
  private preloadedDefinitions = new Map<string, CachedPromise<LibraryDefinition>>();
  private fullyLoadedDefinitions = new Map<string, CachedPromise<LibraryDefinition>>();
  private editedDefinitions = new Map<string, LibraryDefinition>();
  private editedItemInfos = new Map<string, LibraryItemInfo>();
  private originalItemInfos = new Map<string, LibraryItemInfo>();
  private prefetchQueue: PrefetchQueueItem[] = [];

  constructor(public logic: Logic.Logic, private fileAccessor: FileAccessor, private uri: string, private config: LibraryDataProviderConfig, private childName: string, private parent?: LibraryDataProvider, private itemNumber?: number[]) {
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
        provider = new LibraryDataProvider(this.logic, this.fileAccessor, this.uri + encodeURI(path.name) + '/', this.config, path.name, this, itemNumber);
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

  private preloadDefinitions(uri: string, definitionName: string): CachedPromise<LibraryDefinition> {
    return this.fileAccessor.readFile(uri)
      .then((contents: FileContents) => {
        if (this.config.watchForChanges && contents.addWatcher) {
          contents.addWatcher((watcher: FileWatcher) => {
            this.preloadedDefinitions.clear();
            watcher.close();
          });
        }
        let stream = new FmtReader.StringInputStream(contents.text);
        let errorHandler = new FmtReader.DefaultErrorHandler(uri);
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

  private fetchDefinition(name: string, definitionName: string, getMetaModel: Meta.MetaModelGetter, fullContentsRequired: boolean): CachedPromise<LibraryDefinition> {
    let editedDefinition = this.editedDefinitions.get(name);
    if (editedDefinition) {
      return CachedPromise.resolve(editedDefinition);
    }
    let result = this.fullyLoadedDefinitions.get(name);
    if (!result) {
      if (!fullContentsRequired) {
        let preloadedDefinition = this.preloadedDefinitions.get(name);
        if (preloadedDefinition) {
          return preloadedDefinition;
        }
      }
      let uri = this.uri + encodeURI(name) + fileExtension;
      if (this.config.canPreload && !fullContentsRequired) {
        if (name === this.getLocalSectionFileName()) {
          result = this.preloadDefinitions(uri + '.preload', definitionName)
            .catch((error) => {
              console.log(error);
              return this.fetchDefinition(name, definitionName, getMetaModel, true);
            });
          this.preloadedDefinitions.set(name, result);
        } else {
          result = this.fetchLocalSection(false)
            .then(() => {
              let preloadedDefinition = this.preloadedDefinitions.get(name);
              if (preloadedDefinition) {
                return preloadedDefinition;
              } else {
                return this.fetchDefinition(name, definitionName, getMetaModel, true);
              }
            });
        }
      } else {
        result = this.fileAccessor.readFile(uri)
          .then((contents: FileContents) => {
            this.preloadedDefinitions.delete(name);
            let libraryDefinition: LibraryDefinition | undefined = undefined;
            if (this.config.watchForChanges && contents.addWatcher) {
              contents.addWatcher((watcher: FileWatcher) => {
                if (libraryDefinition) {
                  try {
                    libraryDefinition.file = FmtReader.readString(contents.text, uri, getMetaModel, undefined, this.config.checkMarkdownCode);
                    libraryDefinition.definition = this.getMainDefinition(libraryDefinition.file, definitionName);
                    let currentEditedDefinition = this.editedDefinitions.get(name);
                    if (currentEditedDefinition) {
                      currentEditedDefinition.file = libraryDefinition.file.clone();
                      currentEditedDefinition.definition = this.getMainDefinition(currentEditedDefinition.file, definitionName);
                    }
                  } catch (error) {
                    this.fullyLoadedDefinitions.delete(name);
                    watcher.close();
                  }
                }
              });
            }
            let file = FmtReader.readString(contents.text, uri, getMetaModel, undefined, this.config.checkMarkdownCode);
            libraryDefinition = {
              file: file,
              definition: this.getMainDefinition(file, definitionName),
              state: LibraryDefinitionState.Loaded
            };
            return libraryDefinition;
          });
        this.fullyLoadedDefinitions.set(name, result);
      }
    }
    return result;
  }

  private fetchSection(name: string, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let result = this.fetchDefinition(name, this.childName, FmtLibrary.getMetaModel, false);
    if (prefetchContents) {
      result.then((libraryDefinition: LibraryDefinition) => {
        let contents = libraryDefinition.definition.contents;
        if (contents instanceof FmtLibrary.ObjectContents_Section) {
          let index = 0;
          for (let item of contents.items) {
            if (item instanceof FmtLibrary.MetaRefExpression_subsection || (item instanceof FmtLibrary.MetaRefExpression_item && !this.config.canPreload)) {
              let path = (item.ref as Fmt.DefinitionRefExpression).path;
              if (!path.parentPath && !this.preloadedDefinitions.get(path.name) && !this.fullyLoadedDefinitions.get(path.name)) {
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

  fetchSubsection(path: Fmt.Path, itemNumber?: number[], prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let provider = this.getProviderForSection(path, itemNumber);
    return provider.fetchLocalSection(prefetchContents);
  }

  insertLocalSubsection(name: string, title: string, insertBefore?: string): CachedPromise<LibraryDefinition> {
    let localSectionFileName = this.getLocalSectionFileName();
    return this.fetchSection(localSectionFileName, false).then((sectionDefinition: LibraryDefinition) => {
      let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
      let newSubsectionRef = new Fmt.DefinitionRefExpression;
      newSubsectionRef.path = new Fmt.Path;
      newSubsectionRef.path.name = name;
      let newSubsection = new FmtLibrary.MetaRefExpression_subsection;
      newSubsection.ref = newSubsectionRef;
      newSubsection.title = title || '';
      let insertIndex = undefined;
      if (insertBefore) {
        sectionContents.items.map((item: Fmt.Expression, index: number) => {
          if ((item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) && item.ref instanceof Fmt.DefinitionRefExpression && item.ref.path.name === name) {
            insertIndex = index;
          }
        });
      }
      if (insertIndex === undefined) {
        sectionContents.items.push(newSubsection);
      } else {
        sectionContents.items.splice(insertIndex, 0, newSubsection);
      }
      if (sectionDefinition.state === LibraryDefinitionState.Preloaded || sectionDefinition.state === LibraryDefinitionState.Loaded) {
        sectionDefinition.state = LibraryDefinitionState.Editing;
      }
      this.editedDefinitions.set(localSectionFileName, sectionDefinition);
      this.localDefinitionModified(localSectionFileName, sectionDefinition);
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
    definition.type = new Fmt.Type;
    definition.type.expression = new FmtLibrary.MetaRefExpression_Section;
    definition.type.arrayDimensions = 0;
    let contents = new FmtLibrary.ObjectContents_Section;
    contents.logic = this.logic.name;
    contents.items = [];
    definition.contents = contents;
    file.definitions.push(definition);
    let name = this.getLocalSectionFileName();
    return this.createLocalDefinition(name, file, definition);
  }

  fetchLocalItem(name: string, fullContentsRequired: boolean, prefetchContents: boolean = true): CachedPromise<LibraryDefinition> {
    let resultPromise = this.fetchDefinition(name, name, this.logic.getMetaModel, fullContentsRequired);
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

  insertLocalItem(name: string, definitionType: Logic.LogicDefinitionTypeDescription, title: string | undefined, type: string | undefined, insertBefore?: string): CachedPromise<LibraryDefinition> {
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
      .then(() => this.fetchSection(localSectionFileName, false))
      .then((sectionDefinition: LibraryDefinition) => {
        let sectionContents = sectionDefinition.definition.contents as FmtLibrary.ObjectContents_Section;
        let newItemRef = new Fmt.DefinitionRefExpression;
        newItemRef.path = new Fmt.Path;
        newItemRef.path.name = name;
        let newItem = new FmtLibrary.MetaRefExpression_item;
        newItem.ref = newItemRef;
        newItem.title = title;
        newItem.type = type;
        let insertIndex = undefined;
        if (insertBefore) {
          sectionContents.items.map((item: Fmt.Expression, index: number) => {
            if ((item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) && item.ref instanceof Fmt.DefinitionRefExpression && item.ref.path.name === name) {
              insertIndex = index;
            }
          });
        }
        if (insertIndex === undefined) {
          insertIndex = sectionContents.items.length;
          sectionContents.items.push(newItem);
        } else {
          sectionContents.items.splice(insertIndex, 0, newItem);
        }
        if (sectionDefinition.state === LibraryDefinitionState.Preloaded || sectionDefinition.state === LibraryDefinitionState.Loaded) {
          sectionDefinition.state = LibraryDefinitionState.Editing;
        }
        this.editedDefinitions.set(localSectionFileName, sectionDefinition);
        this.localDefinitionModified(localSectionFileName, sectionDefinition);
        let metaModelPath = new Fmt.Path;
        metaModelPath.name = this.logic.name;
        metaModelPath.parentPath = sectionDefinition.file.metaModelPath.parentPath;
        this.editedItemInfos.set(name, {
          itemNumber: [...this.itemNumber!, insertIndex + 1],
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
    return this.createLocalDefinition(name, file, definition);
  }

  private createLocalDefinition(name: string, file: Fmt.File, definition: Fmt.Definition): LibraryDefinition {
    let libraryDefinition: LibraryDefinition = {
      file: file,
      definition: definition,
      state: LibraryDefinitionState.EditingNew,
      modified: false
    };
    this.editedDefinitions.set(name, libraryDefinition);
    this.prePublishLocalDefinition(name, libraryDefinition, true);
    return libraryDefinition;
  }

  editLocalItem(libraryDefinition: LibraryDefinition, itemInfo: LibraryItemInfo): LibraryDefinition {
    let name = libraryDefinition.definition.name;
    let clonedFile = libraryDefinition.file.clone();
    let clonedLibraryDefinition: LibraryDefinition = {
      file: clonedFile,
      definition: this.getMainDefinition(clonedFile, name),
      state: LibraryDefinitionState.Editing,
      modified: false
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
      throw new Error('Trying to modify definition that is not being edited');
    }
    editedLibraryDefinition.modified = true;
    this.prePublishLocalDefinition(name, editedLibraryDefinition, false);
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
    if (this.fileAccessor.unPrePublishFile) {
      let uri = this.uri + encodeURI(name) + fileExtension;
      this.fileAccessor.unPrePublishFile(uri)
        .catch(() => {});
    }
  }

  submitLocalItem(editedLibraryDefinition: LibraryDefinition): CachedPromise<WriteFileResult> {
    let name = editedLibraryDefinition.definition.name;
    if (this.editedDefinitions.get(name) !== editedLibraryDefinition) {
      throw new Error('Trying to submit definition that is not being edited');
    }
    if (editedLibraryDefinition.definition.documentation) {
      for (let item of editedLibraryDefinition.definition.documentation.items) {
        if (item.text === defaultReferencesString) {
          throw new Error('References must be adapted before submitting.');
        }
      }
    }
    let prevState = editedLibraryDefinition.state;
    let createNew = prevState === LibraryDefinitionState.EditingNew;
    editedLibraryDefinition.state = LibraryDefinitionState.Submitting;
    let localSectionFileName = this.getLocalSectionFileName();
    let sectionDefinition = this.editedDefinitions.get(localSectionFileName);
    if (sectionDefinition) {
      return this.submitLocalSection(localSectionFileName, sectionDefinition)
        .then(() => this.submitLocalDefinition(name, editedLibraryDefinition, createNew, false))
        .catch((error) => {
          editedLibraryDefinition.state = prevState;
          return CachedPromise.reject(error);
        });
    }
    return this.submitLocalDefinition(name, editedLibraryDefinition, createNew, false)
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
          .then(() => this.submitLocalDefinition(localSectionFileName, sectionDefinition, true, true))
          .catch((error) => {
            sectionDefinition.state = prevState;
            return CachedPromise.reject(error);
          });
      }
    }
    return this.submitLocalDefinition(localSectionFileName, sectionDefinition, false, true)
      .catch((error) => {
        sectionDefinition.state = prevState;
        return CachedPromise.reject(error);
      });
  }

  private prePublishLocalDefinition(name: string, editedLibraryDefinition: LibraryDefinition, createNew: boolean): void {
    if (this.fileAccessor.prePublishFile) {
      try {
        let uri = this.uri + encodeURI(name) + fileExtension;
        let contents = FmtWriter.writeString(editedLibraryDefinition.file, true);
        if (createNew) {
          this.fileAccessor.writeFile!(uri, contents, true, false)
            .then(() => {
              if (editedLibraryDefinition.state === LibraryDefinitionState.EditingNew) {
                editedLibraryDefinition.state = LibraryDefinitionState.Editing;
              }
            })
            .catch(() => {});
        } else {
          this.fileAccessor.prePublishFile(uri, contents, false, false)
            .catch(() => {});
        }
      } catch (error) {
      }
    }
  }

  private submitLocalDefinition(name: string, editedLibraryDefinition: LibraryDefinition, createNew: boolean, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    try {
      let uri = this.uri + encodeURI(name) + fileExtension;
      let contents = FmtWriter.writeString(editedLibraryDefinition.file);
      return this.fileAccessor.writeFile!(uri, contents, createNew, isPartOfGroup)
        .then((result: WriteFileResult) => {
          editedLibraryDefinition.state = LibraryDefinitionState.Loaded;
          let fullyLoadedDefinitionPromise = this.fullyLoadedDefinitions.get(name);
          if (fullyLoadedDefinitionPromise) {
            let fullyLoadedDefinition = fullyLoadedDefinitionPromise.getImmediateResult();
            if (fullyLoadedDefinition) {
              fullyLoadedDefinition.file = editedLibraryDefinition.file;
              fullyLoadedDefinition.definition = editedLibraryDefinition.definition;
            } else {
              this.fullyLoadedDefinitions.delete(name);
            }
          }
          this.preloadedDefinitions.delete(name);
          this.editedDefinitions.delete(name);
          this.editedItemInfos.delete(name);
          this.originalItemInfos.delete(name);
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
    return this.fetchSection(localSectionFileName, false).then((sectionDefinition: LibraryDefinition) => {
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
    let prefetch = () => {
      for (let i = 0; i < 4; i++) {
        this.prefetch();
      }
    };
    setImmediate(prefetch);
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
        let name = decodeURI(uri);
        if (name.endsWith(fileExtension)) {
          name = name.substring(0, name.length - fileExtension.length);
        }
        if (name === indexFileName) {
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
