import * as fs from 'fs';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtWriter from 'slate-shared/format/write';
import { getMetaModelWithFallback } from 'slate-env-node/format/dynamic';
import * as Logics from 'slate-shared/logics/logics';
//import { refactorFile } from './refactor';

function tidy(fileName: string): void {
  const fileStr = fs.readFileSync(fileName, 'utf8');
  const getMetaModel = (path: Fmt.Path) => {
    const logic = Logics.findLogic(path.name);
    if (logic) {
      return logic.getMetaModel(path);
    }
    return getMetaModelWithFallback(fileName, path);
  };
  const file = FmtReader.readString(fileStr, fileName, getMetaModel);
  //refactorFile(file);
  const newFileStr = FmtWriter.writeString(file);
  if (newFileStr !== fileStr) {
    fs.writeFileSync(fileName, newFileStr, 'utf8');
    console.log(`Tidied ${fileName}.`);
  }
}

if (process.argv.length >= 3) {
  for (const fileName of process.argv.slice(2)) {
    tidy(fileName);
  }
} else {
  console.error('usage: src/scripts/tidy.sh <file1> [<file2>...]');
  process.exitCode = 2;
}
