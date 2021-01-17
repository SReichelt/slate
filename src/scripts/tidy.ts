import * as fs from 'fs';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtWriter from 'slate-shared/format/write';
import { getMetaModelWithFallback } from 'slate-env-node/format/dynamic';
import * as Logics from 'slate-shared/logics/logics';
//import { refactorFile } from './refactor';

function tidy(fileName: string): void {
  let fileStr = fs.readFileSync(fileName, 'utf8');
  let getMetaModel = (path: Fmt.Path) => {
    let logic = Logics.findLogic(path.name);
    if (logic) {
      return logic.getMetaModel(path);
    }
    return getMetaModelWithFallback(fileName, path);
  };
  let file = FmtReader.readString(fileStr, fileName, getMetaModel);
  //refactorFile(file);
  let newFileStr = FmtWriter.writeString(file);
  if (newFileStr !== fileStr) {
    fs.writeFileSync(fileName, newFileStr, 'utf8');
    console.log(`Tidied ${fileName}.`);
  }
}

if (process.argv.length < 3) {
  console.error('usage: src/scripts/tidy.sh <file1> [<file2>...]');
  process.exit(2);
}

for (let fileName of process.argv.slice(2)) {
  tidy(fileName);
}
