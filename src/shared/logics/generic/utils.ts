import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import { LibraryDataAccessor, LibraryItemInfo } from '../../data/libraryDataAccessor';
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
      return this.libraryDataAccessor.fetchItem(path);
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

  substitutePath(expression: Fmt.Expression, targetPath: Fmt.PathItem | undefined, simplifyPaths: boolean): Fmt.Expression {
    if (targetPath) {
      return expression.substitute((subExpression: Fmt.Expression) => this.substituteImmediatePath(subExpression, targetPath, simplifyPaths));
    } else {
      return expression;
    }
  }

  substituteImmediatePath(expression: Fmt.Expression, targetPath: Fmt.PathItem | undefined, simplifyPath: boolean): Fmt.Expression {
    if (targetPath && expression instanceof Fmt.DefinitionRefExpression) {
      let newExpression = new Fmt.DefinitionRefExpression;
      newExpression.path = GenericUtils.adjustPath(expression.path, targetPath);
      if (simplifyPath) {
        newExpression.path = this.libraryDataAccessor.simplifyPath(newExpression.path);
      }
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

  areExpressionsEqual(left: Fmt.Expression, right: Fmt.Expression): boolean {
    let unificationFn = (leftSubExpression: Fmt.Expression, rightSubExpression: Fmt.Expression, replacedParameters: Fmt.ReplacedParameter[]): boolean => {
      if (leftSubExpression instanceof Fmt.DefinitionRefExpression && rightSubExpression instanceof Fmt.DefinitionRefExpression) {
        return this.libraryDataAccessor.arePathsEqual(leftSubExpression.path, rightSubExpression.path, unificationFn, replacedParameters);
      }
      return false;
    };
    return Fmt.Expression.areExpressionsEquivalent(left, right, unificationFn);
  }
}
