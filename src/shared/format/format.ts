import * as FmtWriter from './write';
import * as BN from 'bn.js';

export { BN };

export type ExpressionTraversalFn = (subExpression: Expression) => void;
export type ExpressionSubstitutionFn = (subExpression: Expression, indices?: Index[]) => Expression;
export type ExpressionUnificationFn = (left: Expression, right: Expression, replacedParameters: ReplacedParameter[]) => boolean;

export type ReportConversionFn = (raw: Expression, converted: ObjectContents) => void;

export interface Cloneable<T> {
  clone(replacedParameters?: ReplacedParameter[]): T;
}

export interface Traversable {
  traverse(fn: ExpressionTraversalFn): void;
}

export interface FileObject<T> extends Cloneable<T>, Traversable {}

export interface ReplacedParameter {
  original: Parameter;
  replacement: Parameter;
}

export interface Comparable<T> {
  isEquivalentTo(object: T, fn?: ExpressionUnificationFn, replacedParameters?: ReplacedParameter[]): boolean;
}

export interface ExpressionObject<T> extends FileObject<T>, Comparable<T> {
  clone(replacedParameters?: ReplacedParameter[]): T;
  substitute(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): T;
}

export class File implements FileObject<File> {
  constructor(public metaModelPath: Path, public definitions: DefinitionList = new DefinitionList) {}

  clone(replacedParameters?: ReplacedParameter[]): File {
    return new File(this.metaModelPath, this.definitions.clone(replacedParameters));
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.definitions.traverse(fn);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeFile(this));
  }
}

export abstract class PathItem implements ExpressionObject<PathItem> {
  constructor(public parentPath?: PathItem) {}

  clone(replacedParameters: ReplacedParameter[] = []): PathItem {
    return this.substitute(undefined, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.parentPath?.traverse(fn);
  }

  abstract substitute(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): PathItem;

  isEquivalentTo(pathItem: PathItem, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === pathItem && !replacedParameters.length) {
      return true;
    }
    let origReplacedParametersLength = replacedParameters.length;
    if (!areObjectsEquivalent(this.parentPath, pathItem.parentPath, fn, replacedParameters)) {
      return false;
    }
    if (this.matches(pathItem, fn, replacedParameters)) {
      return true;
    }
    replacedParameters.length = origReplacedParametersLength;
    return false;
  }

  protected abstract matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean;

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writePathItem(this, false, false));
  }
}

export class NamedPathItem extends PathItem {
  constructor(public name: string, parentPath?: PathItem) {
    super(parentPath);
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): NamedPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substitute(fn, replacedParameters);
      if (newParentPath !== this.parentPath || !fn) {
        return new NamedPathItem(this.name, newParentPath);
      }
    } else if (!fn) {
      return new NamedPathItem(this.name);
    }
    return this;
  }

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof NamedPathItem && this.name === pathItem.name;
  }
}

export class ParentPathItem extends PathItem {
  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): ParentPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substitute(fn, replacedParameters);
      if (newParentPath !== this.parentPath || !fn) {
        return new ParentPathItem(newParentPath);
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
  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): IdentityPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substitute(fn, replacedParameters);
      if (newParentPath !== this.parentPath || !fn) {
        return new IdentityPathItem(newParentPath);
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
  public arguments: ArgumentList;

  constructor(name: string, args: ArgumentList = new ArgumentList, parentPath?: PathItem) {
    super(name, parentPath);
    this.arguments = args;
  }

  traverse(fn: ExpressionTraversalFn): void {
    super.traverse(fn);
    this.arguments.traverse(fn);
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Path {
    let changed = !fn;
    let parentPath: PathItem | undefined = undefined;
    if (this.parentPath) {
      parentPath = this.parentPath.substitute(fn, replacedParameters);
      if (parentPath !== this.parentPath) {
        changed = true;
      }
    }
    let args = this.arguments.substitute(fn, replacedParameters);
    if (args !== this.arguments) {
      changed = true;
    }
    if (changed) {
      return new Path(this.name, args, parentPath);
    } else {
      return this;
    }
  }

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof Path && this.name === pathItem.name && this.arguments.isEquivalentTo(pathItem.arguments, fn, replacedParameters);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writePath(this));
  }
}

export class Definition implements FileObject<Definition> {
  innerDefinitions: DefinitionList = new DefinitionList;
  contents?: ObjectContents;
  documentation?: DocumentationComment;

  constructor(public name: string, public type: Expression, public parameters: ParameterList) {}

  clone(replacedParameters: ReplacedParameter[] = []): Definition {
    let type = this.type.clone(replacedParameters);
    let parameters = this.parameters.clone(replacedParameters);
    let result = new Definition(this.name, type, parameters);
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
    this.innerDefinitions.traverse(fn);
    this.contents?.traverse(fn);
    this.documentation?.traverse(fn);
  }

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeDefinition(this));
  }
}

export class DefinitionList extends Array<Definition> implements FileObject<DefinitionList> {
  getDefinition(name: string): Definition {
    for (let definition of this) {
      if (definition.name === name) {
        return definition;
      }
    }
    throw new Error(`Definition "${name}" not found`);
  }

  clone(replacedParameters?: ReplacedParameter[]): DefinitionList {
    let result = new DefinitionList;
    for (let definition of this) {
      result.push(definition.clone(replacedParameters));
    }
    return result;
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

export class Parameter implements ExpressionObject<Parameter> {
  defaultValue?: Expression;
  optional: boolean = false;
  list: boolean = false;
  dependencies?: Expression[];

  constructor(public name: string, public type: Expression) {}

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
    let result = new Parameter(this.name, this.type);
    result.defaultValue = this.defaultValue;
    result.optional = this.optional;
    result.list = this.list;
    result.dependencies = this.dependencies;
    return result;
  }

  clone(replacedParameters: ReplacedParameter[] = [], previousParameter?: ReplacedParameter): Parameter {
    return this.substitute(undefined, replacedParameters, previousParameter);
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

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = [], previousParameter?: ReplacedParameter): Parameter {
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
        let newType = this.type.substitute(fn, replacedParameters);
        replacedParameters.length = origReplacedParametersLength;
        if (newType !== this.type) {
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
        // Need to re-evaluate type because it can depend on the parameter itself.
        result.type = this.type.substitute(fn, replacedParameters);
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

export class ParameterList extends Array<Parameter> implements ExpressionObject<ParameterList> {
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

  clone(replacedParameters: ReplacedParameter[] = []): ParameterList {
    return this.substitute(undefined, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    for (let parameter of this) {
      parameter.traverse(fn);
    }
  }

  substitute(fn: ExpressionSubstitutionFn | undefined, replacedParameters: ReplacedParameter[] = []): ParameterList {
    if (fn && !this.length) {
      return this;
    }
    let result = new ParameterList;
    let changed = !fn;
    let previousParameter: ReplacedParameter | undefined = undefined;
    for (let parameter of this) {
      let newParameter = parameter.substitute(fn, replacedParameters, previousParameter);
      if (newParameter !== parameter) {
        changed = true;
      }
      result.push(newParameter);
      previousParameter = {
        original: parameter,
        replacement: newParameter
      };
    }
    return changed ? result : this;
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

export class Argument implements ExpressionObject<Argument> {
  constructor(public name: string | undefined, public value: Expression, public optional: boolean = false) {}

  clone(replacedParameters: ReplacedParameter[] = []): Argument {
    return this.substitute(undefined, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.value.traverse(fn);
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Argument {
    let newValue = this.value.substitute(fn, replacedParameters);
    if (newValue !== this.value || !fn) {
      return new Argument(this.name, newValue, this.optional);
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

export class ArgumentList extends Array<Argument> implements ExpressionObject<ArgumentList> {
  get(name: string | undefined, index?: number): Argument | undefined {
    let curIndex = 0;
    for (let arg of this) {
      if (arg.name !== undefined ? arg.name === name : curIndex === index) {
        return arg;
      }
      curIndex++;
    }
    return undefined;
  }

  getOptionalValue(name: string | undefined, index?: number): Expression | undefined {
    let arg = this.get(name, index);
    return arg?.value;
  }

  getValue(name: string | undefined, index?: number): Expression {
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

  setValue(name: string | undefined, index: number | undefined, value: Expression | undefined, insertAfter: string[] = []) {
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
      let arg = new Argument(name, value);
      this.splice(insertIndex, 0, arg);
    }
  }

  clone(replacedParameters: ReplacedParameter[] = []): ArgumentList {
    return this.substitute(undefined, replacedParameters);
  }

  traverse(fn: ExpressionTraversalFn): void {
    for (let argument of this) {
      argument.traverse(fn);
    }
  }

  substitute(fn: ExpressionSubstitutionFn | undefined, replacedParameters: ReplacedParameter[] = []): ArgumentList {
    if (fn && !this.length) {
      return this;
    }
    let result = new ArgumentList;
    let changed = !fn;
    for (let argument of this) {
      let newArgument = argument.substitute(fn, replacedParameters);
      if (newArgument !== argument) {
        changed = true;
      }
      result.push(newArgument);
    }
    return changed ? result : this;
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

export abstract class ObjectContents implements FileObject<ObjectContents> {
  abstract fromArgumentList(argumentList: ArgumentList, reportFn?: ReportConversionFn): void;
  abstract toArgumentList(outputAllNames: boolean, reportFn?: ReportConversionFn): ArgumentList;

  fromExpression(expression: Expression, reportFn?: ReportConversionFn): void {
    if (expression instanceof CompoundExpression) {
      this.fromArgumentList(expression.arguments, reportFn);
    } else {
      let argumentList = new ArgumentList(new Argument(undefined, expression));
      this.fromArgumentList(argumentList, reportFn);
    }
  }

  toExpression(outputAllNames: boolean, reportFn?: ReportConversionFn): Expression {
    let argumentList = this.toArgumentList(outputAllNames, reportFn);
    return new CompoundExpression(argumentList);
  }

  abstract clone(replacedParameters?: ReplacedParameter[]): ObjectContents;

  abstract traverse(fn: ExpressionTraversalFn): void;

  toString(): string {
    let argumentList = this.toArgumentList(false);
    return writeToString((writer: FmtWriter.Writer) => writer.writeArguments(argumentList));
  }
}

export class GenericObjectContents extends ObjectContents {
  arguments: ArgumentList = new ArgumentList;

  fromArgumentList(argumentList: ArgumentList, reportFn?: ReportConversionFn): void {
    this.arguments.length = 0;
    this.arguments.push(...argumentList);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: ReportConversionFn): ArgumentList {
    return this.arguments;
  }

  clone(replacedParameters: ReplacedParameter[] = []): GenericObjectContents {
    let result = new GenericObjectContents;
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: ExpressionTraversalFn): void {
    this.arguments.traverse(fn);
  }

  substitute(fn: ExpressionSubstitutionFn | undefined, result: GenericObjectContents, replacedParameters?: ReplacedParameter[]): boolean {
    result.arguments = this.arguments.substitute(fn, replacedParameters);
    return result.arguments !== this.arguments;
  }
}

export abstract class Expression implements ExpressionObject<Expression> {
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
  constructor(public value: BN) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): Expression {
    if (fn) {
      return fn(this);
    } else {
      return new IntegerExpression(this.value);
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof IntegerExpression
           && this.value.eq(expression.value);
  }
}

export class StringExpression extends Expression {
  constructor(public value: string) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    if (fn) {
      return fn(this);
    } else {
      return new StringExpression(this.value);
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof StringExpression
           && this.value === expression.value;
  }
}

export class VariableRefExpression extends Expression {
  constructor(public variable: Parameter) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let variable = this.variable.findReplacement(replacedParameters);
    if (fn && variable === this.variable) {
      return fn(this);
    }
    let result = new VariableRefExpression(variable);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof VariableRefExpression
           && this.variable.findReplacement(replacedParameters) === expression.variable;
  }
}

export abstract class MetaRefExpression extends Expression {
  abstract getName(): string;
  abstract fromArgumentList(argumentList: ArgumentList, reportFn?: ReportConversionFn): void;
  abstract toArgumentList(reportFn?: ReportConversionFn): ArgumentList;

  getMetaInnerDefinitionTypes(): MetaDefinitionFactory | undefined { return undefined; }
  createDefinitionContents(): ObjectContents | undefined { return undefined; }
  canOmit(): boolean { return false; }
}

export class GenericMetaRefExpression extends MetaRefExpression {
  arguments: ArgumentList;

  constructor(public name: string, args: ArgumentList) {
    super();
    this.arguments = args;
  }

  getName(): string {
    return this.name;
  }

  fromArgumentList(argumentList: ArgumentList, reportFn?: ReportConversionFn): void {
    this.arguments.length = 0;
    this.arguments.push(...argumentList);
  }

  toArgumentList(reportFn?: ReportConversionFn): ArgumentList {
    return this.arguments;
  }

  getMetaInnerDefinitionTypes(): MetaDefinitionFactory | undefined {
    return new GenericMetaDefinitionFactory;
  }

  createDefinitionContents(): ObjectContents | undefined {
    return new GenericObjectContents;
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let args = this.arguments.substitute(fn, replacedParameters);
    if (fn && args === this.arguments) {
      return fn(this);
    }
    let result = new GenericMetaRefExpression(this.name, args);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof GenericMetaRefExpression
           && this.name === expression.name
           && this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters);
  }
}

export class DefinitionRefExpression extends Expression {
  constructor(public path: Path) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let path = this.path.substitute(fn, replacedParameters);
    if (fn && path === this.path) {
      return fn(this);
    }
    let result = new DefinitionRefExpression(path);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof DefinitionRefExpression
           && this.path.isEquivalentTo(expression.path, fn, replacedParameters);
  }
}

export class ParameterExpression extends Expression {
  constructor(public parameters: ParameterList) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let parameters = this.parameters.substitute(fn, replacedParameters);
    if (fn && parameters === this.parameters) {
      return fn(this);
    }
    let result = new ParameterExpression(parameters);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof ParameterExpression
           && this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters);
  }
}

export class CompoundExpression extends Expression {
  arguments: ArgumentList;

  constructor(args: ArgumentList) {
    super();
    this.arguments = args;
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let args = this.arguments.substitute(fn, replacedParameters);
    if (fn && args === this.arguments) {
      return fn(this);
    }
    let result = new CompoundExpression(args);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof CompoundExpression
           && this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters);
  }
}

export class ArrayExpression extends Expression {
  constructor(public items: Expression[]) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let items: Expression[] = [];
    let changed = false;
    for (let item of this.items) {
      let newItem = item.substitute(fn, replacedParameters);
      if (newItem !== item) {
        changed = true;
      }
      items.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    let result = new ArrayExpression(items);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof ArrayExpression
           && areListsEquivalent(this.items, expression.items, fn, replacedParameters);
  }
}

export interface Index {
  parameters?: ParameterList;
  arguments?: ArgumentList;
}

export class IndexedExpression extends Expression implements Index {
  parameters?: ParameterList;
  arguments?: ArgumentList;

  constructor(public body: Expression, index?: Index) {
    super();
    if (index) {
      this.parameters = index.parameters;
      this.arguments = index.arguments;
    } else {
      this.arguments = new ArgumentList;
    }
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let changed = false;
    let resultIndex: Index = {};
    if (this.arguments) {
      resultIndex.arguments = this.arguments.substitute(fn, replacedParameters);
      if (resultIndex.arguments !== this.arguments) {
        changed = true;
      } else if (replacedParameters) {
        resultIndex.arguments = this.arguments.clone(replacedParameters);
      }
    }
    if (this.assignParameters(resultIndex, replacedParameters)) {
      changed = true;
    }
    let bodyFn = fn ? (subExpression: Expression, indices?: Index[]) => fn(subExpression, indices ? [resultIndex, ...indices] : [resultIndex]) : undefined;
    let body = this.body.substitute(bodyFn, replacedParameters);
    if (body !== this.body) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    let result = new IndexedExpression(body, resultIndex);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    if (expression instanceof IndexedExpression) {
      let origReplacedParametersLength = replacedParameters.length;
      let testExpression: IndexedExpression = this;
      if (this.isAffectedByReplacedParameters(replacedParameters)) {
        testExpression = new IndexedExpression(this.body, {});
        if (this.arguments) {
          testExpression.arguments = new ArgumentList(...this.arguments);
        }
        this.assignParameters(testExpression, replacedParameters);
      }
      if (!testExpression.body.isEquivalentTo(expression.body, fn, replacedParameters)) {
        replacedParameters.length = origReplacedParametersLength;
        return false;
      }
      return areObjectsEquivalent(testExpression.arguments, expression.arguments, fn, replacedParameters);
    } else {
      return false;
    }
  }

  private assignParameters(result: Index, replacedParameters: ReplacedParameter[]): boolean {
    if (this.parameters) {
      for (let replacedParameter of replacedParameters) {
        let paramIndex = this.parameters.indexOf(replacedParameter.original);
        if (paramIndex >= 0) {
          if (!result.parameters) {
            result.parameters = new ParameterList(...this.parameters);
          }
          result.parameters[paramIndex] = replacedParameter.replacement;
          if (result.arguments) {
            for (let argIndex = 0; argIndex < result.arguments.length; argIndex++) {
              let arg = result.arguments[argIndex];
              if (arg.name === replacedParameter.original.name) {
                let newArg = arg.clone(replacedParameters);
                newArg.name = replacedParameter.replacement.name;
                result.arguments[argIndex] = newArg;
              }
            }
          }
        }
      }
      if (result.parameters) {
        return true;
      } else {
        result.parameters = this.parameters;
      }
    }
    return false;
  }

  private isAffectedByReplacedParameters(replacedParameters: ReplacedParameter[]): boolean {
    if (this.parameters) {
      for (let replacedParameter of replacedParameters) {
        if (this.parameters.indexOf(replacedParameter.original) >= 0) {
          return true;
        }
      }
    }
    return false;
  }
}

export enum SpecialPlaceholderRole {
  Temporary,
  Preview
}

export class PlaceholderExpression extends Expression {
  public specialRole?: SpecialPlaceholderRole;
  public onFill?: (expression: Expression) => void;

  constructor(public placeholderType: any) {
    super();
  }

  substitute(fn?: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): Expression {
    if (fn) {
      return fn(this);
    } else {
      // Don't clone placeholder expression because the clone would not compare equal to the original.
      return this;
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn | undefined, replacedParameters: ReplacedParameter[]): boolean {
    // Don't identify different placeholders.
    return this === expression;
  }
}

export class DocumentationComment implements FileObject<DocumentationComment> {
  constructor(public items: DocumentationItem[]) {}

  clone(replacedParameters: ReplacedParameter[] = []): DocumentationComment {
    let items = this.items.map((item: DocumentationItem) => item.clone(replacedParameters));
    return new DocumentationComment(items);
  }

  traverse(fn: ExpressionTraversalFn): void {}

  toString(): string {
    return writeToString((writer: FmtWriter.Writer) => writer.writeDocumentationComment(this));
  }
}

export class DocumentationItem implements FileObject<DocumentationItem> {
  constructor(public kind: string | undefined, public parameter: Parameter | undefined, public text: string) {}

  clone(replacedParameters: ReplacedParameter[] = []): DocumentationItem {
    return new DocumentationItem(this.kind, this.parameter?.findReplacement(replacedParameters), this.text);
  }

  traverse(fn: ExpressionTraversalFn): void {}
}

export class PathAlias {
  constructor(public name: string, public path: PathItem) {}
}

export interface MetaDefinitionList {
  [name: string]: Function | null;
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
    return Object.create(metaDefinitionClass.prototype);
  }

  allowArbitraryReferences(): boolean {
    return this.metaDefinitionList[''] !== undefined;
  }
}

export class GenericMetaDefinitionFactory implements MetaDefinitionFactory {
  createMetaRefExpression(name: string): MetaRefExpression {
    return new GenericMetaRefExpression(name, new ArgumentList);
  }

  allowArbitraryReferences(): boolean {
    return true;
  }
}

export function areObjectsEquivalent<T extends Comparable<T>>(left: T | undefined, right: T | undefined, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
  if (!left && !right) {
    return true;
  }
  if (left && right) {
    return left.isEquivalentTo(right, fn, replacedParameters);
  }
  return false;
}

export function areListsEquivalent<T extends Comparable<T>>(left: T[] | undefined, right: T[] | undefined, fn?: ExpressionUnificationFn, replacedParameters: ReplacedParameter[] = []): boolean {
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
    return (subExpression: Expression, indices?: Index[]) => {
      for (let fn of fns) {
        subExpression = fn(subExpression, indices);
      }
      return subExpression;
    };
  }
}

export function reverseReplacedParameters(replacedParameters: ReplacedParameter[]): ReplacedParameter[] {
  return replacedParameters.map((replacedParameter: ReplacedParameter) => ({
    original: replacedParameter.replacement,
    replacement: replacedParameter.original
  }));
}

function writeToString(doWrite: (writer: FmtWriter.Writer) => void): string {
  let stream = new FmtWriter.StringOutputStream;
  let writer = new FmtWriter.Writer(stream, true, true, '', '');
  doWrite(writer);
  return stream.str;
}
