import * as path from 'path';
import { FileAccessor } from 'slate-shared/data/fileAccessor';
import { fileExtension } from 'slate-shared/data/constants';
import { PhysicalFileAccessor } from 'slate-env-node/data/physicalFileAccessor';
import { LibraryPreloadGenerator } from '../preload/preload';
import CachedPromise from 'slate-shared/data/cachedPromise';

class LibraryPreloadWriter extends LibraryPreloadGenerator {
  constructor(private inputFileAccessor: FileAccessor, private outputFileAccessor: FileAccessor) {
    super();
  }

  protected getFileContents(uri: string): CachedPromise<string> {
    const fileReference = this.inputFileAccessor.openFile(uri, false);
    return fileReference.read();
  }

  protected outputFile(preloadURI: string, contents: string): void {
    const fileReference = this.outputFileAccessor.openFile(preloadURI, true);
    fileReference.write!(contents, false);
  }
}

function outputPreload(libraryFileName: string, outputDirName: string): CachedPromise<void> {
  const inputFileAccessor = new PhysicalFileAccessor(path.dirname(libraryFileName));
  const outputFileAccessor = new PhysicalFileAccessor(outputDirName);
  const preloadWriter = new LibraryPreloadWriter(inputFileAccessor, outputFileAccessor);
  return preloadWriter.preloadLibrary(path.basename(libraryFileName, fileExtension));
}

if (process.argv.length === 4) {
  outputPreload(process.argv[2], process.argv[3])
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
} else {
  console.error('usage: node buildPreload.js <libraryFile> <outputDir>');
  process.exitCode = 2;
}
