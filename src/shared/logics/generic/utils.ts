import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import { getNextDefaultName } from '../../format/common';
import { LibraryDataAccessor, LibraryDefinition, LibraryItemInfo } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

export class SubstitutionContext {
  replacedParameters: Fmt.ReplacedParameter[];
  substitutionFns: Fmt.ExpressionSubstitutionFn[];

  constructor(parentContext?: SubstitutionContext) {
    this.replacedParameters = parentContext ? parentContext.replacedParameters.slice() : [];
    this.substitutionFns = parentContext ? parentContext.substitutionFns.slice() : [];
  }
}

export class GenericUtils {
  constructor(protected definition: Fmt.Definition, protected libraryDataAccessor: LibraryDataAccessor, protected supportPlaceholders: boolean) {}

  getDefinition(path: Fmt.Path): CachedPromise<Fmt.Definition> {
    if (path.parentPath instanceof Fmt.Path) {
      throw new Error('Unexpected path to inner definition');
    }
    if (!path.parentPath && path.name === this.definition.name) {
      return CachedPromise.resolve(this.definition);
    } else {
      return this.libraryDataAccessor.fetchItem(path, false, false)
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

  applySubstitutionContext(expression: Fmt.Expression, context: SubstitutionContext | undefined): Fmt.Expression {
    if (context && (context.replacedParameters.length || context.substitutionFns.length)) {
      return expression.substitute(Fmt.composeSubstitutionFns(context.substitutionFns), context.replacedParameters.slice());
    } else {
      return expression;
    }
  }

  applySubstitutionContexts(expression: Fmt.Expression, contexts: SubstitutionContext[]): Fmt.Expression {
    for (let context of contexts) {
      expression = this.applySubstitutionContext(expression, context);
    }
    return expression;
  }

  applySubstitutionContextToParameter(parameter: Fmt.Parameter, context: SubstitutionContext | undefined): Fmt.Parameter {
    if (context && (context.replacedParameters.length || context.substitutionFns.length)) {
      return parameter.substituteExpression(Fmt.composeSubstitutionFns(context.substitutionFns), context.replacedParameters.slice());
    } else {
      return parameter;
    }
  }

  applySubstitutionContextToParameterList(parameters: Fmt.ParameterList, context: SubstitutionContext | undefined): Fmt.ParameterList {
    if (context && (context.replacedParameters.length || context.substitutionFns.length)) {
      return parameters.substituteExpression(Fmt.composeSubstitutionFns(context.substitutionFns), context.replacedParameters.slice());
    } else {
      return parameters;
    }
  }

  addTargetPathSubstitution(targetPath: Fmt.PathItem | undefined, context: SubstitutionContext): void {
    if (targetPath) {
      context.substitutionFns.push((subExpression: Fmt.Expression) => {
        if (subExpression instanceof Fmt.DefinitionRefExpression) {
          let newPath = GenericUtils.adjustPath(subExpression.path, targetPath);
          newPath = this.libraryDataAccessor.simplifyPath(newPath);
          let newExpression = new Fmt.DefinitionRefExpression(newPath);
          return newExpression;
        } else {
          return subExpression;
        }
      });
    }
  }

  private static adjustPath<PathItemType extends Fmt.PathItem>(path: PathItemType, targetPath: Fmt.PathItem | undefined): PathItemType {
    let newPath: PathItemType = Object.create(path);
    newPath.parentPath = path.parentPath ? GenericUtils.adjustPath(path.parentPath, targetPath) : targetPath;
    return newPath;
  }

  getUnusedDefaultName(defaultName: string, usedNames: Set<string>): string {
    if (defaultName === '_') {
      return defaultName;
    }
    let newName = defaultName;
    let newResultName = defaultName;
    let suffix = '';
    while (usedNames.has(newResultName)) {
      newName = getNextDefaultName(newName);
      if (newName === defaultName) {
        suffix += '\'';
      }
      newResultName = newName + suffix;
    }
    usedNames.add(newResultName);
    return newResultName;
  }

  createParameter(type: Fmt.Expression, defaultName: string, usedNames?: Set<string>): Fmt.Parameter {
    let name = usedNames ? this.getUnusedDefaultName(defaultName, usedNames) : defaultName;
    return new Fmt.Parameter(name, type);
  }

  containsSubExpression(expression: Fmt.Expression, fn: (subExpression: Fmt.Expression) => boolean): boolean {
    let result = false;
    expression.traverse((subExpression: Fmt.Expression) => {
      if (!result && fn(subExpression)) {
        result = true;
      }
    });
    return result;
  }

  referencesSelf(expression: Fmt.Expression): boolean {
    return this.containsSubExpression(expression, (subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.DefinitionRefExpression) {
        let path = subExpression.path;
        while (path.parentPath instanceof Fmt.Path) {
          path = path.parentPath;
        }
        if (!path.parentPath && path.name === this.definition.name) {
          return true;
        }
      }
      return false;
    });
  }

  referencesParameter(expression: Fmt.Expression, param: Fmt.Parameter): boolean {
    return this.containsSubExpression(expression, (subExpression: Fmt.Expression) =>
      (subExpression instanceof Fmt.VariableRefExpression && subExpression.variable === param));
  }

  findReferencedParameters(expression: Fmt.Expression): Fmt.Parameter[] {
    let result: Fmt.Parameter[] = [];
    expression.traverse((subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.VariableRefExpression) {
        result.push(subExpression.variable);
      }
    });
    return result;
  }

  reorderArguments(argumentList: Fmt.ArgumentList, expression: Fmt.Expression): void {
    let refs = this.findReferencedParameters(expression);
    let lastArgIndex = argumentList.length;
    for (let refIndex = refs.length - 1; refIndex >= 0; refIndex--) {
      let ref = refs[refIndex];
      for (let argIndex = 0; argIndex < argumentList.length; argIndex++) {
        if (ref.name === argumentList[argIndex].name) {
          if (argIndex > lastArgIndex) {
            argumentList.splice(lastArgIndex, 0, ...argumentList.splice(argIndex, 1));
          } else {
            lastArgIndex = argIndex;
          }
          break;
        }
      }
    }
  }

  containsPlaceholders(): boolean {
    return FmtUtils.definitionContainsPlaceholders(this.definition);
  }
}
