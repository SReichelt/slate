import { FileAccessor, FileWatcher } from '../../../shared/data/fileAccessor';
import { fileExtension, preloadExtension, indexFileName, defaultLibraryName } from '../../../shared/data/constants';
import * as Fmt from '../../../shared/format/format';
import * as Meta from '../../../shared/format/metaModel';
import * as FmtReader from '../../../shared/format/read';
import * as FmtWriter from '../../../shared/format/write';
import * as FmtLibrary from '../../../shared/logics/library';
import CachedPromise from '../../../shared/data/cachedPromise';

export abstract class LibraryPreloadGenerator {
  private readFile(uri: string, preloadURI: string, getMetaModel: Meta.MetaModelGetter): CachedPromise<Fmt.File> {
    return this.getFileContents(uri, preloadURI).then((contents: string) => {
      return FmtReader.readString(contents, uri, getMetaModel);
    });
  }

  protected abstract getFileContents(uri: string, preloadURI: string): CachedPromise<string>;

  private writeFile(name: string, file: Fmt.File): string {
    let stream = new FmtWriter.StringOutputStream;
    let writer = new FmtWriter.Writer(stream, false, false, '', '', '');
    writer.writeIdentifier(name, file, true);
    writer.write(' ');
    writer.writeFile(file);
    return stream.str;
  }

  private minifyContents(args: Fmt.ArgumentList): void {
    for (let argIndex = args.length - 1; argIndex >= 0; argIndex--) {
      let arg = args[argIndex];
      let name = arg.name;
      if (name && (name === 'proof' || name === 'proofs' || name.endsWith('Proof') || name.endsWith('Proofs'))) {
        args.splice(argIndex, 1);
      } else if (arg.value instanceof Fmt.CompoundExpression) {
        this.minifyContents(arg.value.arguments);
      }
    }
  }

  private getItemContents(baseURI: string, preloadURI: string, name: string): CachedPromise<string> {
    let uri = baseURI + encodeURI(name) + fileExtension;
    return this.readFile(uri, preloadURI, Meta.getDummyMetaModel)
      .then((file: Fmt.File) => {
        for (let definition of file.definitions) {
          if (definition.contents instanceof Fmt.GenericObjectContents) {
            this.minifyContents(definition.contents.arguments);
          }
        }
        return '\n' + this.writeFile(name, file);
      });
  }

  preloadLibrary(name: string = defaultLibraryName): CachedPromise<void> {
    return this.preloadSection('', name);
  }

  private preloadSection(baseURI: string, name: string): CachedPromise<void> {
    let indexURI = baseURI + encodeURI(name) + fileExtension;
    let preloadURI = indexURI + preloadExtension;
    return this.readFile(indexURI, preloadURI, FmtLibrary.getMetaModel)
      .then((file: Fmt.File) => {
        let promises: CachedPromise<string>[] = [];
        for (let definition of file.definitions) {
          if (definition.contents instanceof FmtLibrary.ObjectContents_Section) {
            for (let item of definition.contents.items) {
              if (item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof FmtLibrary.MetaRefExpression_item) {
                let itemPath = (item.ref as Fmt.DefinitionRefExpression).path;
                if (!itemPath.parentPath) {
                  if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
                    let promise = this.preloadSection(baseURI + encodeURI(itemPath.name) + '/', indexFileName)
                      .catch((error) => console.error(error))
                      .then(() => '');
                    promises.push(promise);
                  } else {
                    promises.push(this.getItemContents(baseURI, preloadURI, itemPath.name));
                  }
                }
              }
            }
          }
        }
        return CachedPromise.all(promises)
          .then((allFileContents: string[]) => {
            let contents = this.writeFile(name, file);
            for (let fileContents of allFileContents) {
              contents += fileContents;
            }
            return contents;
          });
      })
      .then((contents: string) => this.outputFile(preloadURI, contents));
  }

  protected abstract outputFile(preloadURI: string, contents: string): void;
}

export class LibraryPreloader extends LibraryPreloadGenerator {
  private preloadedSections = new Map<string, string>();
  private watchers = new Set<FileWatcher>();

  constructor(private fileAccessor: FileAccessor) {
    super();
  }

  protected getFileContents(uri: string, preloadURI: string): CachedPromise<string> {
    let fileReference = this.fileAccessor.openFile(uri, false);
    if (fileReference.watch) {
      let watcher = fileReference.watch(() => {
        this.preloadedSections.delete(preloadURI);
        watcher.close();
        this.watchers.delete(watcher);
      });
      this.watchers.add(watcher);
    }
    return fileReference.read();
  }

  protected outputFile(preloadURI: string, contents: string): void {
    this.preloadedSections.set(preloadURI, contents);
  }

  getPreloadedSection(preloadURI: string): string | undefined {
    return this.preloadedSections.get(preloadURI);
  }

  clear(): void {
    this.preloadedSections.clear();
    for (let watcher of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
