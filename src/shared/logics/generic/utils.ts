import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as Ctx from '../../format/context';
import { getNextDefaultName } from '../../format/common';
import { LibraryDataAccessor, LibraryDefinition, LibraryItemInfo } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

export class GenericUtils {
  constructor(protected definition: Fmt.Definition, protected libraryDataAccessor: LibraryDataAccessor) {}

  getDefinition(path: Fmt.Path): CachedPromise<Fmt.Definition> {
    if (path.parentPath instanceof Fmt.Path) {
      throw new Error('Unexpected path to inner definition');
    }
    if (!path.parentPath && path.name === this.definition.name) {
      return CachedPromise.resolve(this.definition);
    } else {
      return this.libraryDataAccessor.fetchItem(path, false)
        .then((definition: LibraryDefinition) => definition.definition);
    }
  }

  getOuterDefinition(expression: Fmt.DefinitionRefExpression): CachedPromise<Fmt.Definition> {
    let path = FmtUtils.getOuterPath(expression.path);
    return this.getDefinition(path);
  }

  getItemInfo(expression: Fmt.DefinitionRefExpression): CachedPromise<LibraryItemInfo> {
    let path = FmtUtils.getOuterPath(expression.path);
    return this.libraryDataAccessor.getItemInfo(path);
  }

  splitPath(path: Fmt.Path, childPaths: Fmt.Path[]): void {
    let pathItem: Fmt.PathItem | undefined = path;
    while (pathItem instanceof Fmt.Path) {
      childPaths.unshift(pathItem);
      pathItem = pathItem.parentPath;
    }
  }

  analyzeDefinitionRefPath(childPaths: Fmt.Path[], outerDefinition: Fmt.Definition, definitions: Fmt.Definition[], argumentLists: Fmt.ArgumentList[]): void {
    let definition = outerDefinition;
    let isFirst = true;
    for (let childPath of childPaths) {
      if (isFirst) {
        isFirst = false;
      } else {
        definition = definition.innerDefinitions.getDefinition(childPath.name);
      }
      definitions.push(definition);
      argumentLists.push(childPath.arguments);
    }
  }

  analyzeDefinitionRef(expression: Fmt.DefinitionRefExpression, outerDefinition: Fmt.Definition, definitions: Fmt.Definition[], argumentLists: Fmt.ArgumentList[]): void {
    let childPaths: Fmt.Path[] = [];
    this.splitPath(expression.path, childPaths);
    this.analyzeDefinitionRefPath(childPaths, outerDefinition, definitions, argumentLists);
  }

  substituteVariable(expression: Fmt.Expression, variable: Fmt.Parameter, substitution: (indices?: Fmt.Expression[]) => Fmt.Expression): Fmt.Expression {
    return expression.substitute((subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.VariableRefExpression && subExpression.variable === variable) {
        return substitution(subExpression.indices);
      } else {
        return subExpression;
      }
    });
  }

  substituteTargetPath(expression: Fmt.Expression, targetPath: Fmt.PathItem | undefined): Fmt.Expression {
    if (targetPath) {
      return expression.substitute((subExpression: Fmt.Expression) => this.substituteImmediatePath(subExpression, targetPath));
    } else {
      return expression;
    }
  }

  substituteImmediatePath(expression: Fmt.Expression, targetPath: Fmt.PathItem | undefined): Fmt.Expression {
    if (targetPath && expression instanceof Fmt.DefinitionRefExpression) {
      let newPath = GenericUtils.adjustPath(expression.path, targetPath);
      let newExpression = new Fmt.DefinitionRefExpression;
      newExpression.path = this.libraryDataAccessor.simplifyPath(newPath);
      return newExpression;
    } else {
      return expression;
    }
  }

  private static adjustPath<PathItemType extends Fmt.PathItem>(path: PathItemType, targetPath: Fmt.PathItem | undefined): PathItemType {
    let newPath = Object.create(path);
    newPath.parentPath = path.parentPath ? GenericUtils.adjustPath(path.parentPath, targetPath) : targetPath;
    return newPath;
  }

  getUnusedDefaultName(defaultName: string, context: Ctx.Context): string {
    let newName = defaultName;
    let suffix = '';
    let variableNames = context.getVariables().map((param: Fmt.Parameter) => param.name);
    while (variableNames.indexOf(newName + suffix) >= 0) {
      newName = getNextDefaultName(newName);
      if (newName === defaultName) {
        suffix += '\'';
      }
    }
    return newName + suffix;
  }

  createParameter(type: Fmt.Expression, defaultName: string, context?: Ctx.Context): Fmt.Parameter {
    if (context) {
      defaultName = this.getUnusedDefaultName(defaultName, context);
    }
    let parameter = new Fmt.Parameter;
    parameter.name = defaultName;
    let parameterType = new Fmt.Type;
    parameterType.expression = type;
    parameterType.arrayDimensions = 0;
    parameter.type = parameterType;
    if (context) {
      parameter.previousParameter = context.getPreviousParameter();
    }
    return parameter;
  }

  referencesParameter(expression: Fmt.Expression, param: Fmt.Parameter): boolean {
    let result = false;
    expression.traverse((subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.VariableRefExpression && subExpression.variable === param) {
        result = true;
      }
    });
    return result;
  }

  findReferencedParameters(expression: Fmt.Expression): Set<Fmt.Parameter> {
    let result = new Set<Fmt.Parameter>();
    expression.traverse((subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.VariableRefExpression) {
        result.add(subExpression.variable);
      }
    });
    return result;
  }

  containsPlaceholders(): boolean {
    return FmtUtils.definitionContainsPlaceholders(this.definition);
  }
}
