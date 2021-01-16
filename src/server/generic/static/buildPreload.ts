import * as path from 'path';
import { FileAccessor } from '../../../shared/data/fileAccessor';
import { fileExtension } from '../../../shared/data/constants';
import { PhysicalFileAccessor } from '../../../envs/node/data/physicalFileAccessor';
import { LibraryPreloadGenerator } from '../preload/preload';
import CachedPromise from '../../../shared/data/cachedPromise';

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

function outputPreload(libraryFileName: string, outputDirName: string): CachedPromise<void> {
  let inputFileAccessor = new PhysicalFileAccessor(path.dirname(libraryFileName));
  let outputFileAccessor = new PhysicalFileAccessor(outputDirName);
  let preloadWriter = new LibraryPreloadWriter(inputFileAccessor, outputFileAccessor);
  return preloadWriter.preloadLibrary(path.basename(libraryFileName, fileExtension));
}

if (process.argv.length !== 4) {
  console.error('usage: node buildPreload.js <libraryFile> <outputDir>');
  process.exit(2);
}

outputPreload(process.argv[2], process.argv[3])
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
