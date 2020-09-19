import * as path from 'path';
import * as fs from 'fs';
import { fileExtension } from '../../shared/data/constants';
import * as Fmt from '../../shared/format/format';
import * as Meta from '../../shared/format/metaModel';
import * as FmtDynamic from '../../shared/format/dynamic';
import * as FmtMeta from '../../shared/format/meta';
import * as FmtReader from '../../shared/format/read';

export function getFileNameFromPathStr(sourceFileName: string, pathStr: string): string {
  pathStr = path.join(path.dirname(sourceFileName), pathStr);
  pathStr = path.normalize(pathStr);
  return pathStr;
}

export function getFileNameFromPath(sourceFileName: string, targetPath: Fmt.NamedPathItem, skipLastItem: boolean = false, addExtension: boolean = true): string {
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

export function getMetaModelWithFallback(sourceFileName: string, metaModelPath: Fmt.Path): Meta.MetaModel {
  try {
    return getMetaModel(sourceFileName, metaModelPath);
  } catch (error) {
    return new Meta.DummyMetaModel(metaModelPath.name);
  }
}
