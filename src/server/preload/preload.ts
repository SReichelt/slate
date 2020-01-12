import { FileAccessor, FileContents } from '../../shared/data/fileAccessor';
import * as Fmt from '../../shared/format/format';
import * as Meta from '../../shared/format/metaModel';
import * as FmtReader from '../../shared/format/read';
import * as FmtWriter from '../../shared/format/write';
import * as FmtLibrary from '../../shared/logics/library';
import CachedPromise from '../../shared/data/cachedPromise';

export class LibraryPreloader {
  private preloadedSections = new Map<string, string>();

  constructor(private fileAccessor: FileAccessor) {}

  private readFile(indexURI: string, uri: string, getMetaModel: Meta.MetaModelGetter): CachedPromise<Fmt.File> {
    return this.fileAccessor.readFile(uri).then((contents: FileContents) => {
      contents.onChange = () => {
        this.preloadedSections.delete(indexURI);
        contents.close();
      };
      return FmtReader.readString(contents.text, uri, getMetaModel);
    });
  }

  private writeFile(name: string, file: Fmt.File): string {
    let stream = new FmtWriter.StringOutputStream;
    let writer = new FmtWriter.Writer(stream, '', '', '');
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

  private getItemContents(indexURI: string, baseURI: string, name: string): CachedPromise<string> {
    let uri = baseURI + encodeURI(name) + '.slate';
    return this.readFile(indexURI, uri, Meta.getDummyMetaModel)
      .then((file: Fmt.File) => {
        for (let definition of file.definitions) {
          if (definition.contents instanceof Fmt.GenericObjectContents) {
            this.minifyContents(definition.contents.arguments);
          }
        }
        return '\n' + this.writeFile(name, file);
      });
  }

  preloadSection(baseURI: string, name: string): CachedPromise<void> {
    let indexURI = baseURI + encodeURI(name) + '.slate';
    return this.readFile(indexURI, indexURI, FmtLibrary.getMetaModel)
      .then((file: Fmt.File) => {
        let promises: CachedPromise<string>[] = [];
        for (let definition of file.definitions) {
          if (definition.contents instanceof FmtLibrary.ObjectContents_Section) {
            for (let item of definition.contents.items) {
              if (item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof FmtLibrary.MetaRefExpression_item) {
                let itemPath = (item.ref as Fmt.DefinitionRefExpression).path;
                if (!itemPath.parentPath) {
                  if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
                    let promise = this.preloadSection(baseURI + encodeURI(itemPath.name) + '/', '_index')
                      .catch((error) => console.error(error))
                      .then(() => '');
                    promises.push(promise);
                  } else {
                    promises.push(this.getItemContents(indexURI, baseURI, itemPath.name));
                  }
                }
              }
            }
          }
        }
        let result = CachedPromise.resolve(this.writeFile(name, file));
        for (let promise of promises) {
          result = result
            .then((contents: string) => promise.then((newContents: string) => (contents + newContents)))
            .catch((error) => promise.then(() => CachedPromise.reject(error)));
        }
        return result;
      })
      .then((contents: string) => {
        this.preloadedSections.set(indexURI, contents);
      });
  }

  getPreloadedSection(indexUri: string): string | undefined {
    return this.preloadedSections.get(indexUri);
  }

  clear() {
    this.preloadedSections.clear();
  }
}
