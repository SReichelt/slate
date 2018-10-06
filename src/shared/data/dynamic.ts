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

export function getFileNameFromPath(sourceFileName: string, targetPath: Fmt.Path, skipLastItem: boolean = false, addExtension: boolean = true): string {
  while (targetPath.parentPath instanceof Fmt.Path) {
    targetPath = targetPath.parentPath;
  }
  let pathStr = '';
  for (let pathItem = skipLastItem ? targetPath.parentPath : targetPath; pathItem; pathItem = pathItem.parentPath) {
    if (pathItem instanceof Fmt.NamedPathItem) {
      let name = pathItem.name;
      if (addExtension) {
        name += fileExtension;
      }
      pathStr = path.join(name, pathStr);
    } else if (addExtension) {
      return '';
    } else if (pathItem instanceof Fmt.ParentPathItem) {
      pathStr = path.join('..', pathStr);
    }
    addExtension = false;
  }
  if (addExtension) {
      return '';
  }
  return getFileNameFromPathStr(sourceFileName, pathStr);
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
