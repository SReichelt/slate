import * as path from 'path';
import * as fs from 'fs';
import * as Fmt from '../format/format';
import * as FmtDynamic from '../format/dynamic';
import * as FmtMeta from '../format/meta';
import * as FmtReader from '../format/read';

export function getMetaModel(sourceFileName: string, metaModelPath: Fmt.Path): Fmt.MetaModel {
  let pathStr = metaModelPath.name + '.hlm';
  for (let pathItem = metaModelPath.parentPath; pathItem; pathItem = pathItem.parentPath) {
    if (pathItem instanceof Fmt.NamedPathItem) {
      pathStr = path.join(pathItem.name, pathStr);
    } else if (pathItem instanceof Fmt.ParentPathItem) {
      pathStr = path.join('..', pathStr);
    }
  }
  pathStr = path.join(path.dirname(sourceFileName), pathStr);
  pathStr = path.normalize(pathStr);
  let fileContents = fs.readFileSync(pathStr, 'utf8');
  let file = FmtReader.readString(fileContents, pathStr, FmtMeta.getMetaModel);
  return new FmtDynamic.DynamicMetaModel(file, (otherPath: Fmt.Path) => getMetaModel(pathStr, otherPath));
}

export function getMetaModelWithFallback(sourceFileName: string, metaModelPath: Fmt.Path): Fmt.MetaModel {
  try {
    return getMetaModel(sourceFileName, metaModelPath);
  } catch (error) {
    return new Fmt.DummyMetaModel;
  }
}
