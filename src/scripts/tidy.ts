import * as fs from 'fs';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtWriter from '../shared/format/write';
import { getMetaModelWithFallback } from '../fs/format/dynamic';
import * as Logics from '../shared/logics/logics';

function tidy(fileName: string): void {
  let fileStr: string = fs.readFileSync(fileName, 'utf8');
  let getMetaModel = (path: Fmt.Path) => {
    for (let logic of Logics.logics) {
      if (path.name === logic.name) {
        return logic.getMetaModel(path);
      }
    }
    return getMetaModelWithFallback(fileName, path);
  };
  let file: Fmt.File = FmtReader.readString(fileStr, fileName, getMetaModel);
  fileStr = FmtWriter.writeString(file);
  fs.writeFileSync(fileName, fileStr, 'utf8');
}

if (process.argv.length < 3) {
  console.error('usage: src/scripts/tidy.sh <file1> [<file2>...]');
  process.exit(1);
}

for (let fileName of process.argv.slice(2)) {
  tidy(fileName);
}
