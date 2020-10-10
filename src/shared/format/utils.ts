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

export function substituteEquivalentExpressions(expression: Fmt.Expression, originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression): Fmt.Expression {
  return expression.substitute((subExpression: Fmt.Expression) => {
    if (originalExpression.isEquivalentTo(subExpression)) {
      return substitutedExpression;
    } else {
      return subExpression;
    }
  });
}

export function substituteVariable(expression: Fmt.Expression, variable: Fmt.Parameter, substitution: Fmt.Expression): Fmt.Expression {
  return expression.substitute((subExpression: Fmt.Expression) => {
    if (subExpression instanceof Fmt.VariableRefExpression && subExpression.variable === variable) {
      return substitution;
    } else {
      return subExpression;
    }
  });
}

export function renameParameter(parameter: Fmt.Parameter, newName: string, parameterList: Fmt.ParameterList | undefined, scope: Fmt.Traversable | undefined): void {
  let oldName = parameter.name;
  parameter.name = newName;
  let paramIndex = parameterList?.indexOf(parameter);
  scope?.traverse((expression: Fmt.Expression) => {
    if (expression instanceof Fmt.IndexedExpression && expression.parameters && expression.arguments) {
      let arg: Fmt.Argument | undefined = undefined;
      if (parameterList) {
        if (expression.parameters === parameterList) {
          arg = expression.arguments.get(oldName, paramIndex);
        }
      } else {
        let localParamIndex = expression.parameters.indexOf(parameter);
        if (localParamIndex >= 0) {
          arg = expression.arguments.get(oldName, localParamIndex);
        }
      }
      if (arg && arg.name === oldName) {
        arg.name = newName;
      }
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
