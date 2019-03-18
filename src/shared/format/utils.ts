import * as Fmt from './format';

export function getOuterPath(path: Fmt.Path): Fmt.Path {
  while (path.parentPath instanceof Fmt.Path) {
    path = path.parentPath;
  }
  return path;
}

export function arePathsEqual(path1?: Fmt.PathItem, path2?: Fmt.PathItem): boolean {
  if (path1 === path2) {
    return true;
  }
  if (!path1 || !path2) {
    return false;
  }
  if (!arePathsEqual(path1.parentPath, path2.parentPath)) {
    return false;
  }
  if (path1 instanceof Fmt.NamedPathItem && path2 instanceof Fmt.NamedPathItem) {
    return path1.name === path2.name;
  }
  if (path1 instanceof Fmt.ParentPathItem && path2 instanceof Fmt.ParentPathItem) {
    return true;
  }
  if (path1 instanceof Fmt.IdentityPathItem && path2 instanceof Fmt.IdentityPathItem) {
    return true;
  }
  return false;
}
