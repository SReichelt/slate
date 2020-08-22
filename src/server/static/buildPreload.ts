import * as path from 'path';
import { FileAccessor } from '../../shared/data/fileAccessor';
import { PhysicalFileAccessor } from '../../fs/data/physicalFileAccessor';
import { LibraryPreloadGenerator } from '../preload/preload';
import CachedPromise from '../../shared/data/cachedPromise';

class LibraryPreloadWriter extends LibraryPreloadGenerator {
  constructor(private inputFileAccessor: FileAccessor, private outputFileAccessor: FileAccessor) {
    super();
  }

  protected getFileContents(uri: string): CachedPromise<string> {
    let fileReference = this.inputFileAccessor.openFile(uri, false);
    return fileReference.read();
  }

  protected outputFile(preloadURI: string, contents: string): void {
    let fileReference = this.outputFileAccessor.openFile(preloadURI, true);
    fileReference.write!(contents, false);
  }
}

if (process.argv.length !== 4) {
  console.error('usage: node buildPreload.js <libraryFile> <outputDir>');
  process.exit(2);
}

let libraryFileName = process.argv[2];
let outputDirName = process.argv[3];
let physicalInputFileAccessor = new PhysicalFileAccessor(path.dirname(libraryFileName));
let physicalOutputFileAccessor = new PhysicalFileAccessor(outputDirName);
let preloadWriter = new LibraryPreloadWriter(physicalInputFileAccessor, physicalOutputFileAccessor);
preloadWriter.preloadLibrary(path.basename(libraryFileName, '.slate'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
