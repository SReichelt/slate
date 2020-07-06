import * as Fmt from './format';
import * as Meta from './metaModel';
import * as Ctx from './context';
import * as FmtReader from './read';

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

export function getInnerDefinition(outerDefinition: Fmt.Definition, path: Fmt.Path): Fmt.Definition {
  if (path.parentPath instanceof Fmt.Path) {
    let parentDefinition = getInnerDefinition(outerDefinition, path.parentPath);
    return parentDefinition.innerDefinitions.getDefinition(path.name);
  } else {
    return outerDefinition;
  }
}

export function substituteExpression(expression: Fmt.Expression, originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression): Fmt.Expression {
  return expression.substitute((subExpression: Fmt.Expression) => {
    if (subExpression === originalExpression) {
      return substitutedExpression;
    } else {
      return subExpression;
    }
  });
}

export function substituteVariable(expression: Fmt.Expression, variable: Fmt.Parameter, substitution: (indices?: Fmt.Expression[]) => Fmt.Expression): Fmt.Expression {
  return expression.substitute((subExpression: Fmt.Expression) => {
    if (subExpression instanceof Fmt.VariableRefExpression && subExpression.variable === variable) {
      return substitution(subExpression.indices);
    } else {
      return subExpression;
    }
  });
}

export function readCode(code: string, metaModel: Meta.MetaModel): Fmt.Expression {
  let stream = new FmtReader.StringInputStream(code);
  let errorHandler = new FmtReader.DefaultErrorHandler;
  let reader = new FmtReader.Reader(stream, errorHandler, () => metaModel);
  let context = new Ctx.DummyContext(metaModel);
  return reader.readExpression(false, metaModel.functions, context);
}

export function definitionContainsPlaceholders(definition: Fmt.Definition): boolean {
  let result = false;
  definition.traverse((subExpression: Fmt.Expression) => {
    if (subExpression instanceof Fmt.PlaceholderExpression) {
      result = true;
    }
  });
  return result;
}
