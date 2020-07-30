import * as FmtWriter from './write';

export import BN = require('bn.js');

export type ExpressionTraversalFn = (subExpression: Expression) => void;
export type ExpressionSubstitutionFn = (subExpression: Expression) => Expression;
export type ExpressionUnificationFn = (left: Expression, right: Expression, replacedParameters: ReplacedParameter[]) => boolean;

export class File {
  metaModelPath: Path;
  // TODO find a better way to initialize lists, especially since some of them are regularly overwritten
  definitions: DefinitionList = Object.create(DefinitionList.prototype);

  clone(): File {
    let result = new File;
    result.metaModelPath = this.metaModelPath;
    this.definitions.clone(result.definitions);
    return result;
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.definitions.traverse(fn);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeFile(this));
  }
}

export interface ReplacedParameter {
  original: Parameter;
  replacement: Parameter;
}

export interface Comparable<T> {
  isEquivalentTo(object: T, fn?: ExpressionUnificationFn, replacedParameters?: ReplacedParameter[]): boolean;
}

export abstract class PathItem implements Comparable<PathItem> {
  parentPath?: PathItem;

  clone(replacedParameters: ReplacedParameter[] = []): PathItem {
    return this.substituteExpression(undefined, replacedParameters);
  }

  abstract substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): PathItem;

  isEquivalentTo(pathItem: PathItem, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === pathItem && !replacedParameters.length) {
      return true;
    }
    let origReplacedParametersLength = replacedParameters.length;
    if (this.parentPath || pathItem.parentPath) {
      if (!(this.parentPath && pathItem.parentPath && this.parentPath.isEquivalentTo(pathItem.parentPath, fn, replacedParameters))) {
        return false;
      }
    }
    if (this.matches(pathItem, fn, replacedParameters)) {
      return true;
    }
    replacedParameters.length = origReplacedParametersLength;
    return false;
  }

  protected abstract matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean;
}

export class NamedPathItem extends PathItem {
  name: string;

  substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): NamedPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substituteExpression(fn, replacedParameters);
      if (newParentPath !== this.parentPath || !fn) {
        let result = new NamedPathItem;
        result.parentPath = newParentPath;
        result.name = this.name;
        return result;
      }
    } else if (!fn) {
      let result = new NamedPathItem;
      result.name = this.name;
      return result;
    }
    return this;
  }

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof NamedPathItem && this.name === pathItem.name;
  }
}

export class ParentPathItem extends PathItem {
  substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): ParentPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substituteExpression(fn, replacedParameters);
      if (newParentPath !== this.parentPath || !fn) {
        let result = new ParentPathItem;
        result.parentPath = newParentPath;
        return result;
      }
    } else if (!fn) {
      return new ParentPathItem;
    }
    return this;
  }

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof ParentPathItem;
  }
}

export class IdentityPathItem extends PathItem {
  substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): IdentityPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substituteExpression(fn, replacedParameters);
      if (newParentPath !== this.parentPath || !fn) {
        let result = new IdentityPathItem;
        result.parentPath = newParentPath;
        return result;
      }
    } else if (!fn) {
      return new IdentityPathItem;
    }
    return this;
  }

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof IdentityPathItem;
  }
}

export class Path extends NamedPathItem {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Path {
    let result = new Path;
    let changed = false;
    if (this.parentPath) {
      result.parentPath = this.parentPath.substituteExpression(fn, replacedParameters);
      if (result.parentPath !== this.parentPath) {
        changed = true;
      }
    }
    result.name = this.name;
    if (this.arguments.substituteExpression(fn, result.arguments, replacedParameters)) {
      changed = true;
    }
    if (changed || !fn) {
      return result;
    }
    return this;
  }

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof Path && this.name === pathItem.name && this.arguments.isEquivalentTo(pathItem.arguments, fn, replacedParameters);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writePath(this));
  }
}

export class Definition {
  name: string;
  type: Type;
  parameters: ParameterList = Object.create(ParameterList.prototype);
  innerDefinitions: DefinitionList = Object.create(DefinitionList.prototype);
  contents?: ObjectContents;
  documentation?: DocumentationComment;

  clone(replacedParameters: ReplacedParameter[] = []): Definition {
    let result = new Definition;
    result.name = this.name;
    result.type = this.type.clone(replacedParameters);
    this.parameters.clone(result.parameters, replacedParameters);
    for (let innerDefinition of this.innerDefinitions) {
      result.innerDefinitions.push(innerDefinition.clone(replacedParameters));
    }
    if (this.contents) {
      result.contents = this.contents.clone(replacedParameters);
    }
    if (this.documentation) {
      result.documentation = this.documentation.clone(replacedParameters);
    }
    return result;
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.type.traverse(fn);
    this.parameters.traverse(fn);
    this.contents?.traverse(fn);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeDefinition(this));
  }
}

export class DefinitionList extends Array<Definition> {
  getDefinition(name: string): Definition {
    for (let definition of this) {
      if (definition.name === name) {
        return definition;
      }
    }
    throw new Error(`Definition "${name}" not found`);
  }

  clone(result: DefinitionList): void {
    for (let definition of this) {
      result.push(definition.clone());
    }
  }

  traverse(fn: ExpressionTraversalFn): void {
    for (let definition of this) {
      definition.traverse(fn);
    }
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeDefinitions(this));
  }
}

export class Parameter implements Comparable<Parameter> {
  name: string;
  type: Type;
  defaultValue?: Expression;
  optional: boolean;
  list: boolean;
  dependencies?: Expression[];

  findReplacement(replacedParameters: ReplacedParameter[]): Parameter {
    let result: Parameter = this;
    for (let index = replacedParameters.length - 1; index >= 0; index--) {
      let replacedParameter = replacedParameters[index];
      if (result === replacedParameter.original) {
        result = replacedParameter.replacement;
      }
    }
    return result;
  }

  shallowClone(): Parameter {
    let result = new Parameter;
    result.name = this.name;
    result.type = this.type;
    result.defaultValue = this.defaultValue;
    result.optional = this.optional;
    result.list = this.list;
    result.dependencies = this.dependencies;
    return result;
  }

  clone(replacedParameters: ReplacedParameter[] = [], previousParameter?: ReplacedParameter): Parameter {
    return this.substituteExpression(undefined, replacedParameters, previousParameter);
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.type.traverse(fn);
    this.defaultValue?.traverse(fn);
    if (this.dependencies) {
      for (let dependency of this.dependencies) {
        dependency.traverse(fn);
      }
    }
  }

  substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = [], previousParameter?: ReplacedParameter): Parameter {
    let newDefaultValue: Expression | undefined = undefined;
    if (this.defaultValue) {
      if (previousParameter && this.defaultValue === previousParameter.original.defaultValue) {
        newDefaultValue = previousParameter.replacement.defaultValue;
      } else {
        newDefaultValue = this.defaultValue.substitute(fn, replacedParameters);
      }
    }
    let newDependencies: Expression[] | undefined = undefined;
    if (this.dependencies) {
      newDependencies = [];
      let dependenciesChanged = false;
      for (let dependency of this.dependencies) {
        let newDependency = dependency.substitute(fn, replacedParameters);
        if (newDependency !== dependency) {
          dependenciesChanged = true;
        }
        newDependencies.push(newDependency);
      }
      if (fn && !dependenciesChanged) {
        newDependencies = this.dependencies;
      }
    }
    let changed = (newDefaultValue !== this.defaultValue || newDependencies !== this.dependencies || !fn);
    if (!changed) {
      if (previousParameter && this.type === previousParameter.original.type) {
        if (previousParameter.replacement.type !== this.type) {
          changed = true;
        }
      } else {
        let origReplacedParametersLength = replacedParameters.length;
        let newType = this.type.expression.substitute(fn, replacedParameters);
        replacedParameters.length = origReplacedParametersLength;
        if (newType !== this.type.expression) {
          changed = true;
        }
      }
    }
    if (changed) {
      let result = this.shallowClone();
      replacedParameters.push({original: this, replacement: result});
      if (previousParameter && this.type === previousParameter.original.type) {
        result.type = previousParameter.replacement.type;
      } else {
        result.type = new Type;
        // Need to re-evaluate type because it can depend on the parameter itself.
        result.type.expression = this.type.expression.substitute(fn, replacedParameters);
        result.type.arrayDimensions = this.type.arrayDimensions;
      }
      result.defaultValue = newDefaultValue;
      result.dependencies = newDependencies;
      return result;
    } else {
      return this;
    }
  }

  isEquivalentTo(parameter: Parameter, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === parameter && !replacedParameters.length) {
      return true;
    }
    // Compare everything except names.
    if (this.optional === parameter.optional && this.list === parameter.list) {
      let origReplacedParametersLength = replacedParameters.length;
      replacedParameters.push({original: this, replacement: parameter});
      if (this.type.isEquivalentTo(parameter.type, fn, replacedParameters)
          && areObjectsEquivalent(this.defaultValue, parameter.defaultValue, fn, replacedParameters)
          && areListsEquivalent(this.dependencies, parameter.dependencies, fn, replacedParameters)) {
        return true;
      }
      replacedParameters.length = origReplacedParametersLength;
    }
    return false;
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeParameter(this));
  }
}

export class ParameterList extends Array<Parameter> implements Comparable<ParameterList> {
  getParameter(name?: string, index?: number): Parameter {
    if (name !== undefined) {
      for (let param of this) {
        if (param.name === name) {
          return param;
        }
      }
      throw new Error(`Parameter "${name}" not found`);
    } else if (index !== undefined) {
      if (index < this.length) {
        return this[index];
      } else if (this.length && this[this.length - 1].list) {
        return this[this.length - 1];
      } else {
        throw new Error(`Parameter ${index + 1} not found`);
      }
    } else {
      throw new Error('Parameter name or index must be given');
    }
  }

  clone(result: ParameterList, replacedParameters: ReplacedParameter[] = []): void {
    this.substituteExpression(undefined, result, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    for (let parameter of this) {
      parameter.traverse(fn);
    }
  }

  substituteExpression(fn: ExpressionSubstitutionFn | undefined, result: ParameterList, replacedParameters: ReplacedParameter[] = []): boolean {
    let changed = false;
    let previousParameter: ReplacedParameter | undefined = undefined;
    for (let parameter of this) {
      let newParameter = parameter.substituteExpression(fn, replacedParameters, previousParameter);
      if (newParameter !== parameter) {
        changed = true;
      }
      result.push(newParameter);
      previousParameter = {
        original: parameter,
        replacement: newParameter
      };
    }
    return changed;
  }

  isEquivalentTo(parameters: ParameterList, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === parameters && !replacedParameters.length) {
      return true;
    }
    if (this.length !== parameters.length) {
      return false;
    }
    let origReplacedParametersLength = replacedParameters.length;
    for (let i = 0; i < this.length; i++) {
      if (!this[i].isEquivalentTo(parameters[i], fn, replacedParameters)) {
        replacedParameters.length = origReplacedParametersLength;
        return false;
      }
    }
    return true;
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeParameters(this));
  }
}

export class Argument implements Comparable<Argument> {
  name?: string;
  value: Expression;
  optional?: boolean;

  clone(replacedParameters: ReplacedParameter[] = []): Argument {
    return this.substituteExpression(undefined, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.value.traverse(fn);
  }

  substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Argument {
    let newValue = this.value.substitute(fn, replacedParameters);
    if (newValue !== this.value || !fn) {
      let result = new Argument;
      result.name = this.name;
      result.value = newValue;
      result.optional = this.optional;
      return result;
    } else {
      return this;
    }
  }

  isEquivalentTo(arg: Argument, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === arg && !replacedParameters.length) {
      return true;
    }
    return this.name === arg.name
           && this.value.isEquivalentTo(arg.value, fn, replacedParameters);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeArgument(this));
  }
}

export class ArgumentList extends Array<Argument> implements Comparable<ArgumentList> {
  get(name?: string, index?: number): Argument | undefined {
    let curIndex = 0;
    for (let arg of this) {
      if (arg.name !== undefined ? arg.name === name : curIndex === index) {
        return arg;
      }
      curIndex++;
    }
    return undefined;
  }

  getOptionalValue(name?: string, index?: number): Expression | undefined {
    let arg = this.get(name, index);
    return arg?.value;
  }

  getValue(name?: string, index?: number): Expression {
    let arg = this.get(name, index);
    if (!arg) {
      if (name !== undefined) {
        throw new Error(`Missing argument for parameter "${name}"`);
      } else if (index !== undefined) {
        throw new Error(`Missing argument for parameter ${index + 1}`);
      } else {
        throw new Error('Argument name or index must be given');
      }
    }
    return arg.value;
  }

  add(value: Expression, name?: string, optional?: boolean): void {
    let arg = new Argument;
    arg.name = name;
    arg.value = value;
    arg.optional = optional;
    this.push(arg);
  }

  setValue(value: Expression | undefined, name?: string, index?: number, insertAfter: string[] = []) {
    let curIndex = 0;
    let removeIndex: number | undefined = undefined;
    let insertIndex = 0;
    for (let arg of this) {
      if (removeIndex !== undefined) {
        if (arg.name === undefined) {
          if (name !== undefined) {
            throw new Error(`Argument for "${name}" cannot be removed because argument ${curIndex + 1} is unnamed`);
          } else if (index !== undefined) {
            throw new Error(`Argument "${index + 1}" cannot be removed because argument ${curIndex + 1} is unnamed`);
          }
        }
      } else if (arg.name !== undefined ? arg.name === name : curIndex === index) {
        if (value !== undefined) {
          arg.value = value;
          return;
        } else {
          removeIndex = curIndex;
        }
      }
      curIndex++;
      if (arg.name === undefined || insertAfter.indexOf(arg.name) >= 0) {
        insertIndex = curIndex;
      }
    }
    if (removeIndex !== undefined) {
      this.splice(removeIndex, 1);
    } else if (value !== undefined) {
      if (name === undefined) {
        throw new Error('Argument name required');
      }
      let arg = new Argument;
      arg.name = name;
      arg.value = value;
      this.splice(insertIndex, 0, arg);
    }
  }

  clone(result: ArgumentList, replacedParameters: ReplacedParameter[] = []): void {
    this.substituteExpression(undefined, result, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    for (let argument of this) {
      argument.traverse(fn);
    }
  }

  substituteExpression(fn: ExpressionSubstitutionFn | undefined, result: ArgumentList, replacedParameters: ReplacedParameter[] = []): boolean {
    let changed = false;
    for (let argument of this) {
      let newArgument = argument.substituteExpression(fn, replacedParameters);
      if (newArgument !== argument) {
        changed = true;
      }
      result.push(newArgument);
    }
    return changed;
  }

  isEquivalentTo(args: ArgumentList, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === args && !replacedParameters.length) {
      return true;
    }
    if (this.length !== args.length) {
      return false;
    }
    let origReplacedParametersLength = replacedParameters.length;
    for (let i = 0; i < this.length; i++) {
      let arg = this[i];
      let argMatches = arg.isEquivalentTo(args[i], fn, replacedParameters);
      if (!argMatches && arg.name !== undefined) {
        let found = false;
        for (let otherArg of args) {
          if (otherArg.name === arg.name) {
            if (found) {
              argMatches = false;
              break;
            }
            found = true;
            argMatches = arg.isEquivalentTo(otherArg, fn, replacedParameters);
          }
        }
      }
      if (!argMatches) {
        replacedParameters.length = origReplacedParametersLength;
        return false;
      }
    }
    return true;
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeArguments(this));
  }
}

export class Type implements Comparable<Type> {
  expression: Expression;
  arrayDimensions: number;

  clone(replacedParameters: ReplacedParameter[] = []): Type {
    return this.substituteExpression(undefined, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.expression.traverse(fn);
  }

  substituteExpression(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Type {
    let newExpression = this.expression.substitute(fn, replacedParameters);
    if (newExpression !== this.expression || !fn) {
      let result = new Type;
      result.expression = newExpression;
      result.arrayDimensions = this.arrayDimensions;
      return result;
    } else {
      return this;
    }
  }

  isEquivalentTo(type: Type, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === type && !replacedParameters.length) {
      return true;
    }
    return this.arrayDimensions === type.arrayDimensions
           && this.expression.isEquivalentTo(type.expression, fn, replacedParameters);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeType(this));
  }
}

export abstract class ObjectContents {
  abstract fromArgumentList(argumentList: ArgumentList): void;
  abstract toArgumentList(argumentList: ArgumentList, outputAllNames: boolean): void;

  fromCompoundExpression(expression: CompoundExpression): void {
    this.fromArgumentList(expression.arguments);
  }

  toCompoundExpression(expression: CompoundExpression, outputAllNames: boolean): void {
    this.toArgumentList(expression.arguments, outputAllNames);
  }

  abstract clone(replacedParameters?: ReplacedParameter[]): ObjectContents;

  abstract traverse(fn: ExpressionTraversalFn): void;

  toString(): string {
    let argumentList: ArgumentList = Object.create(ArgumentList.prototype);
    this.toArgumentList(argumentList, false);
    return writeToString((writer: FmtWriter.Writer) => writer.writeArguments(argumentList));
  }
}

export class GenericObjectContents extends ObjectContents {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  fromArgumentList(argumentList: ArgumentList): void {
    this.arguments.length = 0;
    this.arguments.push(...argumentList);
  }

  toArgumentList(argumentList: ArgumentList, outputAllNames: boolean): void {
    argumentList.length = 0;
    argumentList.push(...this.arguments);
  }

  clone(replacedParameters: ReplacedParameter[] = []): GenericObjectContents {
    let result = new GenericObjectContents;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.arguments.traverse(fn);
  }

  substituteExpression(fn: ExpressionSubstitutionFn | undefined, result: GenericObjectContents, replacedParameters?: ReplacedParameter[]): boolean {
    return this.arguments.substituteExpression(fn, result.arguments, replacedParameters);
  }
}

export abstract class Expression implements Comparable<Expression> {
  clone(replacedParameters: ReplacedParameter[] = []): Expression {
    return this.substitute(undefined, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    let substitutionFn = (expression: Expression) => {
      fn(expression);
      return expression;
    };
    this.substitute(substitutionFn);
  }

  abstract substitute(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): Expression;

  protected getSubstitutionResult(fn: ExpressionSubstitutionFn | undefined, expression: Expression, changed: boolean): Expression {
    if (fn) {
      return fn(changed ? expression : this);
    } else {
      // Special case used by clone(). Don't return 'this', even if unchanged.
      return expression;
    }
  }

  isEquivalentTo(expression: Expression, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === expression && !replacedParameters.length) {
      return true;
    }
    let origReplacedParametersLength = replacedParameters.length;
    if (this.matches(expression, fn, replacedParameters)) {
      return true;
    }
    if (fn && fn(this, expression, replacedParameters)) {
      return true;
    }
    replacedParameters.length = origReplacedParametersLength;
    return false;
  }

  protected abstract matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean;

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeExpression(this));
  }
}

export class IntegerExpression extends Expression {
  value: BN;

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): Expression {
    if (fn) {
      return fn(this);
    } else {
      let result = new IntegerExpression;
      result.value = this.value;
      return result;
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof IntegerExpression
           && this.value.eq(expression.value);
  }
}

export class StringExpression extends Expression {
  value: string;

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    if (fn) {
      return fn(this);
    } else {
      let result = new StringExpression;
      result.value = this.value;
      return result;
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof StringExpression
           && this.value === expression.value;
  }
}

export interface Index {
  parameters?: ParameterList;
  arguments?: ArgumentList;
}

export class VariableRefExpression extends Expression {
  variable: Parameter;
  indices?: Index[];

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new VariableRefExpression;
    let changed = false;
    result.variable = this.variable.findReplacement(replacedParameters);
    if (result.variable !== this.variable) {
      changed = true;
    }
    if (this.indices) {
      result.indices = [];
      for (let index of this.indices) {
        if (index.arguments) {
          let newIndex: Index = {
            parameters: index.parameters,
            arguments: Object.create(ArgumentList.prototype)
          };
          if (index.arguments.substituteExpression(fn, newIndex.arguments!, replacedParameters)) {
            changed = true;
          }
          result.indices.push(newIndex);
        } else {
          result.indices.push(index);
        }
      }
    }
    let newIndices = result.replaceIndexParameters(replacedParameters);
    if (newIndices) {
      result.indices = newIndices;
      changed = true;
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    if (expression instanceof VariableRefExpression
        && this.variable.findReplacement(replacedParameters) === expression.variable) {
      let newIndices = this.replaceIndexParameters(replacedParameters);
      let compareFn = (leftItem: Index, rightItem: Index) => areObjectsEquivalent(leftItem.arguments, rightItem.arguments, fn, replacedParameters);
      return compareLists(newIndices ?? this.indices, expression.indices, compareFn, replacedParameters);
    } else {
      return false;
    }
  }

  private replaceIndexParameters(replacedParameters: ReplacedParameter[]): Index[] | undefined {
    let newIndices: Index[] | undefined = undefined;
    if (this.indices && replacedParameters.length) {
      for (let indexIndex = 0; indexIndex < this.indices.length; indexIndex++) {
        let index = this.indices[indexIndex];
        let newIndex: Index | undefined = undefined;
        for (let replacedParameter of replacedParameters) {
          if (index.parameters) {
            let paramIndex = index.parameters.indexOf(replacedParameter.original);
            if (paramIndex >= 0) {
              if (!newIndex) {
                newIndex = {
                  parameters: Object.create(ParameterList.prototype)
                };
                newIndex.parameters!.push(...index.parameters);
                if (index.arguments) {
                  newIndex.arguments = Object.create(ArgumentList.prototype);
                  newIndex.arguments!.push(...index.arguments);
                }
                if (!newIndices) {
                  newIndices = this.indices!.slice();
                }
                newIndices[indexIndex] = newIndex;
              }
              newIndex.parameters![paramIndex] = replacedParameter.replacement;
              if (newIndex.arguments) {
                for (let argIndex = 0; argIndex < newIndex.arguments.length; argIndex++) {
                  let arg = newIndex.arguments[argIndex];
                  if (arg.name === replacedParameter.original.name) {
                    let newArg = arg.clone();
                    newArg.name = replacedParameter.replacement.name;
                    newIndex.arguments[argIndex] = newArg;
                  }
                }
              }
            }
          }
        }
      }
    }
    return newIndices;
  }
}

export abstract class MetaRefExpression extends Expression {
  abstract getName(): string;
  abstract fromArgumentList(argumentList: ArgumentList): void;
  abstract toArgumentList(argumentList: ArgumentList): void;

  getMetaInnerDefinitionTypes(): MetaDefinitionFactory | undefined { return undefined; }
  createDefinitionContents(): ObjectContents | undefined { return undefined; }
  canOmit(): boolean { return false; }
}

export class GenericMetaRefExpression extends MetaRefExpression {
  name: string;
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  getName(): string {
    return this.name;
  }

  fromArgumentList(argumentList: ArgumentList): void {
    this.arguments.length = 0;
    this.arguments.push(...argumentList);
  }

  toArgumentList(argumentList: ArgumentList): void {
    argumentList.length = 0;
    argumentList.push(...this.arguments);
  }

  getMetaInnerDefinitionTypes(): MetaDefinitionFactory | undefined {
    return new GenericMetaDefinitionFactory;
  }

  createDefinitionContents(): ObjectContents | undefined {
    return new GenericObjectContents;
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new GenericMetaRefExpression;
    result.name = this.name;
    let changed = this.arguments.substituteExpression(fn, result.arguments, replacedParameters);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof GenericMetaRefExpression
           && this.name === expression.name
           && this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters);
  }
}

export class DefinitionRefExpression extends Expression {
  path: Path;

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new DefinitionRefExpression;
    result.path = this.path.substituteExpression(fn, replacedParameters);
    let changed = (result.path !== this.path);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof DefinitionRefExpression
           && this.path.isEquivalentTo(expression.path, fn, replacedParameters);
  }
}

export class ParameterExpression extends Expression {
  parameters: ParameterList = Object.create(ParameterList.prototype);

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new ParameterExpression;
    let changed = this.parameters.substituteExpression(fn, result.parameters, replacedParameters);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof ParameterExpression
           && this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters);
  }
}

export class CompoundExpression extends Expression {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new CompoundExpression;
    let changed = this.arguments.substituteExpression(fn, result.arguments, replacedParameters);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof CompoundExpression
           && this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters);
  }
}

export class ArrayExpression extends Expression {
  items: Expression[];

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new ArrayExpression;
    result.items = [];
    let changed = false;
    for (let item of this.items) {
      let newItem = item.substitute(fn, replacedParameters);
      if (newItem !== item) {
        changed = true;
      }
      result.items.push(newItem);
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof ArrayExpression
           && areListsEquivalent(this.items, expression.items, fn, replacedParameters);
  }
}

export class PlaceholderExpression extends Expression {
  public isTemporary: boolean = false;
  public onFill?: (expression: Expression) => void;

  constructor(public placeholderType: any) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): Expression {
    if (fn) {
      return fn(this);
    } else {
      return new PlaceholderExpression(this.placeholderType);
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    // Don't identify different placeholders.
    return false;
  }
}

export class DocumentationComment {
  items: DocumentationItem[];

  clone(replacedParameters: ReplacedParameter[] = []): DocumentationComment {
    let result = new DocumentationComment;
    result.items = [];
    for (let item of this.items) {
      result.items.push(item.clone(replacedParameters));
    }
    return result;
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeDocumentationComment(this));
  }
}

export class DocumentationItem {
  kind?: string;
  parameter?: Parameter;
  text: string;

  clone(replacedParameters: ReplacedParameter[] = []): DocumentationItem {
    let result = new DocumentationItem;
    result.kind = this.kind;
    if (this.parameter) {
      result.parameter = this.parameter.findReplacement(replacedParameters);
    }
    result.text = this.text;
    return result;
  }
}

export interface MetaDefinitionList {
  [name: string]: {new(): MetaRefExpression};
}

export interface MetaDefinitionFactory {
  createMetaRefExpression(name: string): MetaRefExpression;
  allowArbitraryReferences(): boolean;
}

export class StandardMetaDefinitionFactory implements MetaDefinitionFactory {
  constructor(private metaDefinitionList: MetaDefinitionList) {}

  createMetaRefExpression(name: string): MetaRefExpression {
    let metaDefinitionClass = this.metaDefinitionList[name];
    if (!metaDefinitionClass) {
      throw new Error(`Meta object "${name}" not found`);
    }
    return new metaDefinitionClass;
  }

  allowArbitraryReferences(): boolean {
    return this.metaDefinitionList[''] !== undefined;
  }
}

export class GenericMetaDefinitionFactory implements MetaDefinitionFactory {
  createMetaRefExpression(name: string): MetaRefExpression {
    let result = new GenericMetaRefExpression;
    result.name = name;
    return result;
  }

  allowArbitraryReferences(): boolean {
    return true;
  }
}

function areObjectsEquivalent<T extends Comparable<T>>(left: T | undefined, right: T | undefined, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
  if (!left && !right) {
    return true;
  }
  if (left && right) {
    return left.isEquivalentTo(right, fn, replacedParameters);
  }
  return false;
}

function areListsEquivalent<T extends Comparable<T>>(left: T[] | undefined, right: T[] | undefined, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
  let compareFn = (leftItem: T, rightItem: T) => leftItem.isEquivalentTo(rightItem, fn, replacedParameters);
  return compareLists(left, right, compareFn, replacedParameters);
}

function compareLists<T>(left: T[] | undefined, right: T[] | undefined, compareFn: (leftItem: T, rightItem: T) => boolean, replacedParameters: ReplacedParameter[] = []): boolean {
  if (!left && !right) {
    return true;
  }
  if (left && right && left.length === right.length) {
    let origReplacedParametersLength = replacedParameters.length;
    for (let i = 0; i < left.length; i++) {
      if (!compareFn(left[i], right[i])) {
        replacedParameters.length = origReplacedParametersLength;
        return false;
      }
    }
    return true;
  }
  return false;
}

export function composeSubstitutionFns(fns: ExpressionSubstitutionFn[]): ExpressionSubstitutionFn {
  if (fns.length === 1) {
    return fns[0];
  } else {
    return (subExpression: Expression) => {
      for (let fn of fns) {
        subExpression = fn(subExpression);
      }
      return subExpression;
    };
  }
}

function writeToString(doWrite: (writer: FmtWriter.Writer) => void): string {
  let stream = new FmtWriter.StringOutputStream;
  let writer = new FmtWriter.Writer(stream, true, true, '', '');
  doWrite(writer);
  return stream.str;
}
