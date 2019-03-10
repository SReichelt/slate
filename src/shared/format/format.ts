export import BN = require('bn.js');

export class File {
  metaModelPath: Path;
  definitions: DefinitionList = Object.create(DefinitionList.prototype);
}

export type ExpressionTraversalFn = (expression: Expression) => void;
export type ExpressionSubstitutionFn = ((expression: Expression) => Expression) | undefined;
export type ExpressionUnificationFn = ((left: Expression, right: Expression, replacedParameters: ReplacedParameter[]) => boolean) | undefined;

export interface ReplacedParameter {
  original: Parameter;
  replacement: Parameter;
}

export abstract class PathItem {
  parentPath?: PathItem;

  clone(replacedParameters: ReplacedParameter[] = []): PathItem {
    return this.substituteExpression(undefined, replacedParameters);
  }

  abstract substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): PathItem;

  isEquivalentTo(pathItem: PathItem, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
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

  protected abstract matches(pathItem: PathItem, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean;
}

export class NamedPathItem extends PathItem {
  name: string;

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): NamedPathItem {
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

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof NamedPathItem && this.name === pathItem.name;
  }
}

export class ParentPathItem extends PathItem {
  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): ParentPathItem {
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

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof ParentPathItem;
  }
}

export class IdentityPathItem extends PathItem {
  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): IdentityPathItem {
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

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof IdentityPathItem;
  }
}

export class Path extends NamedPathItem {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Path {
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

  protected matches(pathItem: PathItem, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return pathItem instanceof Path && this.name === pathItem.name && this.arguments.isEquivalentTo(pathItem.arguments);
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
}

export class Parameter {
  name: string;
  type: Type;
  defaultValue?: Expression;
  optional: boolean;
  list: boolean;
  dependencies?: Expression[];

  findReplacement(replacedParameters: ReplacedParameter[]): Parameter {
    let result: Parameter = this;
    for (let replacedParameter of replacedParameters) {
      if (result === replacedParameter.original) {
        result = replacedParameter.replacement;
      }
    }
    return result;
  }

  clone(replacedParameters: ReplacedParameter[] = []): Parameter {
    return this.substituteExpression(undefined, replacedParameters);
  }

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Parameter {
    let newType = this.type.expression.substitute(fn, replacedParameters);
    let newDefaultValue = this.defaultValue ? this.defaultValue.substitute(fn, replacedParameters) : undefined;
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
    if (newType !== this.type.expression || newDefaultValue !== this.defaultValue || newDependencies !== this.dependencies || !fn) {
      let result = new Parameter;
      replacedParameters.push({original: this, replacement: result});
      result.name = this.name;
      result.type = new Type;
      /* Need to re-evaluate type because it can depend on the parameter itself. */
      result.type.expression = this.type.expression.substitute(fn, replacedParameters);
      result.type.arrayDimensions = this.type.arrayDimensions;
      result.defaultValue = newDefaultValue;
      result.optional = this.optional;
      result.list = this.list;
      result.dependencies = newDependencies;
      return result;
    } else {
      return this;
    }
  }

  isEquivalentTo(parameter: Parameter, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === parameter && !replacedParameters.length) {
      return true;
    }
    /* Compare everything except names. */
    if (this.optional === parameter.optional && this.list === parameter.list) {
      let origReplacedParametersLength = replacedParameters.length;
      replacedParameters.push({original: this, replacement: parameter});
      if (this.type.isEquivalentTo(parameter.type, fn, replacedParameters)
          && Expression.areExpressionsEquivalent(this.defaultValue, parameter.defaultValue, fn, replacedParameters)
          && Expression.areExpressionListsEquivalent(this.dependencies, parameter.dependencies, fn, replacedParameters)) {
        return true;
      }
      replacedParameters.length = origReplacedParametersLength;
    }
    return false;
  }
}

export class ParameterList extends Array<Parameter> {
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

  substituteExpression(fn: ExpressionSubstitutionFn, result: ParameterList, replacedParameters: ReplacedParameter[] = []): boolean {
    let changed = false;
    for (let parameter of this) {
      let newParameter = parameter.substituteExpression(fn, replacedParameters);
      if (newParameter !== parameter) {
        changed = true;
      }
      result.push(newParameter);
    }
    return changed;
  }

  isEquivalentTo(parameters: ParameterList, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
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
}

export class Argument {
  name?: string;
  value: Expression;
  optional?: boolean;

  clone(replacedParameters: ReplacedParameter[] = []): Argument {
    return this.substituteExpression(undefined, replacedParameters);
  }

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Argument {
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

  isEquivalentTo(arg: Argument, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === arg && !replacedParameters.length) {
      return true;
    }
    return this.name === arg.name
           && this.value.isEquivalentTo(arg.value, fn, replacedParameters);
  }
}

export class ArgumentList extends Array<Argument> {
  getOptionalValue(name?: string, index?: number): Expression | undefined {
    let curIndex = 0;
    for (let arg of this) {
      if (arg.name !== undefined ? arg.name === name : curIndex === index) {
        return arg.value;
      }
      curIndex++;
    }
    return undefined;
  }

  getValue(name?: string, index?: number): Expression {
    let value = this.getOptionalValue(name, index);
    if (value === undefined) {
      if (name !== undefined) {
        throw new Error(`Missing argument for parameter "${name}"`);
      } else if (index !== undefined) {
        throw new Error(`Missing argument for parameter ${index + 1}`);
      } else {
        throw new Error('Argument name or index must be given');
      }
    }
    return value;
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

  substituteExpression(fn: ExpressionSubstitutionFn, result: ArgumentList, replacedParameters: ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(args: ArgumentList, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === args && !replacedParameters.length) {
      return true;
    }
    if (this.length !== args.length) {
      return false;
    }
    let origReplacedParametersLength = replacedParameters.length;
    for (let i = 0; i < this.length; i++) {
      if (!this[i].isEquivalentTo(args[i], fn, replacedParameters)) {
        replacedParameters.length = origReplacedParametersLength;
        return false;
      }
    }
    return true;
  }
}

export class Type {
  expression: ObjectRefExpression;
  arrayDimensions: number;

  clone(replacedParameters: ReplacedParameter[] = []): Type {
    return this.substituteExpression(undefined, replacedParameters);
  }

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Type {
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

  isEquivalentTo(type: Type, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
    if (this === type && !replacedParameters.length) {
      return true;
    }
    return this.arrayDimensions === type.arrayDimensions
           && this.expression.isEquivalentTo(type.expression, fn, replacedParameters);
  }
}

export abstract class ObjectContents {
  abstract fromArgumentList(argumentList: ArgumentList): void;
  abstract toArgumentList(argumentList: ArgumentList): void;

  fromCompoundExpression(expression: CompoundExpression): void {
    this.fromArgumentList(expression.arguments);
  }

  toCompoundExpression(expression: CompoundExpression): void {
    this.toArgumentList(expression.arguments);
  }

  abstract clone(replacedParameters?: ReplacedParameter[]): ObjectContents;
}

export class GenericObjectContents extends ObjectContents {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  fromArgumentList(argumentList: ArgumentList): void {
    this.arguments.length = 0;
    this.arguments.push(...argumentList);
  }

  toArgumentList(argumentList: ArgumentList): void {
    argumentList.length = 0;
    argumentList.push(...this.arguments);
  }

  clone(replacedParameters: ReplacedParameter[] = []): GenericObjectContents {
    let result = new GenericObjectContents;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: ExpressionSubstitutionFn, result: GenericObjectContents, replacedParameters?: ReplacedParameter[]): boolean {
    return this.arguments.substituteExpression(fn, result.arguments, replacedParameters);
  }
}

export abstract class Expression {
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

  abstract substitute(fn: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): Expression;

  protected getSubstitutionResult(fn: ExpressionSubstitutionFn, expression: Expression, changed: boolean): Expression {
    if (fn) {
      return fn(changed ? expression : this);
    } else {
      /* Special case used by clone(). Don't return 'this', even if unchanged. */
      return expression;
    }
  }

  isEquivalentTo(expression: Expression, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
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

  protected abstract matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean;

  static areExpressionsEquivalent(left: Expression | undefined, right: Expression | undefined, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
    if (!left && !right) {
      return true;
    }
    if (left && right) {
      return left.isEquivalentTo(right, fn, replacedParameters);
    }
    return false;
  }

  static areExpressionListsEquivalent(left: Expression[] | undefined, right: Expression[] | undefined, fn: ExpressionUnificationFn = undefined, replacedParameters: ReplacedParameter[] = []): boolean {
    if (!left && !right) {
      return true;
    }
    if (left && right && left.length === right.length) {
      let origReplacedParametersLength = replacedParameters.length;
      for (let i = 0; i < left.length; i++) {
        if (!left[i].isEquivalentTo(right[i], fn, replacedParameters)) {
          replacedParameters.length = origReplacedParametersLength;
          return false;
        }
      }
      return true;
    }
    return false;
  }
}

export class IntegerExpression extends Expression {
  value: BN;

  substitute(fn: ExpressionSubstitutionFn, replacedParameters?: ReplacedParameter[]): Expression {
    if (fn) {
      return fn(this);
    } else {
      let result = new IntegerExpression;
      result.value = this.value;
      return result;
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof IntegerExpression
           && this.value.eq(expression.value);
  }
}

export class StringExpression extends Expression {
  value: string;

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    if (fn) {
      return fn(this);
    } else {
      let result = new StringExpression;
      result.value = this.value;
      return result;
    }
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof StringExpression
           && this.value === expression.value;
  }
}

export class VariableRefExpression extends Expression {
  variable: Parameter;
  indices?: Expression[];

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new VariableRefExpression;
    let changed = false;
    result.variable = this.variable.findReplacement(replacedParameters);
    if (result.variable !== this.variable) {
      changed = true;
    }
    if (this.indices) {
      result.indices = [];
      for (let index of this.indices) {
        let newIndex = index.substitute(fn, replacedParameters);
        if (newIndex !== index) {
          changed = true;
        }
        result.indices.push(newIndex);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof VariableRefExpression
           && this.variable.findReplacement(replacedParameters) === expression.variable
           && Expression.areExpressionListsEquivalent(this.indices, expression.indices, fn, replacedParameters);
  }
}

export abstract class ObjectRefExpression extends Expression {
}

export abstract class MetaRefExpression extends ObjectRefExpression {
  abstract getName(): string;
  abstract fromArgumentList(argumentList: ArgumentList): void;
  abstract toArgumentList(argumentList: ArgumentList): void;

  getMetaInnerDefinitionTypes(): MetaDefinitionFactory | undefined { return undefined; }
  createDefinitionContents(): ObjectContents | undefined { return undefined; }
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

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new GenericMetaRefExpression;
    result.name = this.name;
    let changed = this.arguments.substituteExpression(fn, result.arguments, replacedParameters);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof GenericMetaRefExpression
           && this.name === expression.name
           && this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters);
  }
}

export class DefinitionRefExpression extends ObjectRefExpression {
  path: Path;

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new DefinitionRefExpression;
    result.path = this.path.substituteExpression(fn, replacedParameters);
    let changed = (result.path !== this.path);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof DefinitionRefExpression
           && this.path.isEquivalentTo(expression.path, fn, replacedParameters);
  }
}

export class ParameterExpression extends Expression {
  parameters: ParameterList = Object.create(ParameterList.prototype);

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new ParameterExpression;
    let changed = this.parameters.substituteExpression(fn, result.parameters, replacedParameters);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof ParameterExpression
           && this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters);
  }
}

export class CompoundExpression extends Expression {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new CompoundExpression;
    let changed = this.arguments.substituteExpression(fn, result.arguments, replacedParameters);
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof CompoundExpression
           && this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters);
  }
}

export class ArrayExpression extends Expression {
  items: Expression[];

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
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

  protected matches(expression: Expression, fn: ExpressionUnificationFn, replacedParameters: ReplacedParameter[]): boolean {
    return expression instanceof ArrayExpression
           && Expression.areExpressionListsEquivalent(this.items, expression.items, fn, replacedParameters);
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
