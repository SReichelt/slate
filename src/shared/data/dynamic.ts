import * as path from 'path';
import * as fs from 'fs';
import * as Fmt from '../format/format';
import * as FmtDynamic from '../format/dynamic';
import * as FmtMeta from '../format/meta';
import * as FmtReader from '../format/read';

export const fileExtension = '.hlm';

export function getFileNameFromPathStr(sourceFileName: string, pathStr: string): string {
  pathStr = path.join(path.dirname(sourceFileName), pathStr);
  pathStr = path.normalize(pathStr);
  return pathStr;
}

export function getFileNameFromPath(sourceFileName: string, targetPath: Fmt.Path, skipLastItem: boolean = false, directoryOnly: boolean = false): string {
  while (targetPath.parentPath instanceof Fmt.Path) {
    targetPath = targetPath.parentPath;
  }
  let lastItem = skipLastItem ? targetPath.parentPath : targetPath;
  if (lastItem instanceof Fmt.NamedPathItem) {
    let pathStr = directoryOnly ? '' : lastItem.name + fileExtension;
    for (let pathItem = lastItem.parentPath; pathItem; pathItem = pathItem.parentPath) {
      if (pathItem instanceof Fmt.NamedPathItem) {
        pathStr = path.join(pathItem.name, pathStr);
      } else if (pathItem instanceof Fmt.ParentPathItem) {
        pathStr = path.join('..', pathStr);
      }
    }
    return getFileNameFromPathStr(sourceFileName, pathStr);
  } else {
    return '';
  }
}

export function readMetaModel(fileName: string, reportRange?: FmtReader.RangeHandler): Fmt.File {
  let fileContents = fs.readFileSync(fileName, 'utf8');
  return FmtReader.readString(fileContents, fileName, FmtMeta.getMetaModel, reportRange);
}

export function getMetaModel(sourceFileName: string, metaModelPath: Fmt.Path): FmtDynamic.DynamicMetaModel {
  let fileName = getFileNameFromPath(sourceFileName, metaModelPath);
  let file = readMetaModel(fileName);
  return new FmtDynamic.DynamicMetaModel(file, fileName, (otherPath: Fmt.Path) => getMetaModel(fileName, otherPath));
}

export function getMetaModelWithFallback(sourceFileName: string, metaModelPath: Fmt.Path): Fmt.MetaModel {
  try {
    return getMetaModel(sourceFileName, metaModelPath);
  } catch (error) {
    return new Fmt.DummyMetaModel;
  }
}
