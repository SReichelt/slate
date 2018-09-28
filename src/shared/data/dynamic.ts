import * as path from 'path';
import * as fs from 'fs';
import * as Fmt from '../format/format';
import * as FmtDynamic from '../format/dynamic';
import * as FmtMeta from '../format/meta';
import * as FmtReader from '../format/read';

export function getFileNameFromPathStr(sourceFileName: string, pathStr: string): string {
  pathStr = path.join(path.dirname(sourceFileName), pathStr);
  pathStr = path.normalize(pathStr);
  return pathStr;
}

export function getFileNameFromPath(sourceFileName: string, targetPath: Fmt.Path): string {
  while (targetPath.parentPath instanceof Fmt.Path) {
    targetPath = targetPath.parentPath;
  }
  let pathStr = targetPath.name + '.hlm';
  for (let pathItem = targetPath.parentPath; pathItem; pathItem = pathItem.parentPath) {
    if (pathItem instanceof Fmt.NamedPathItem) {
      pathStr = path.join(pathItem.name, pathStr);
    } else if (pathItem instanceof Fmt.ParentPathItem) {
      pathStr = path.join('..', pathStr);
    }
  }
  return getFileNameFromPathStr(sourceFileName, pathStr);
}

export function readMetaModel(fileName: string, reportRange?: FmtReader.RangeHandler): Fmt.File {
  let fileContents = fs.readFileSync(fileName, 'utf8');
  return FmtReader.readString(fileContents, fileName, FmtMeta.getMetaModel, reportRange);
}

export function createDynamicMetaModel(file: Fmt.File, fileName: string): FmtDynamic.DynamicMetaModel {
  return new FmtDynamic.DynamicMetaModel(file, (otherPath: Fmt.Path) => getMetaModel(fileName, otherPath));
}

export function getMetaModel(sourceFileName: string, metaModelPath: Fmt.Path): FmtDynamic.DynamicMetaModel {
  let fileName = getFileNameFromPath(sourceFileName, metaModelPath);
  let file = readMetaModel(fileName);
  return createDynamicMetaModel(file, fileName);
}

export function getMetaModelWithFallback(sourceFileName: string, metaModelPath: Fmt.Path): Fmt.MetaModel {
  try {
    return getMetaModel(sourceFileName, metaModelPath);
  } catch (error) {
    return new Fmt.DummyMetaModel;
  }
}
