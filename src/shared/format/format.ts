export const BN = require('bn.js');
export type BigInt = any;  // BN

export class File {
  metaModelPath: Path;
  definitions: DefinitionList = Object.create(DefinitionList.prototype);
}

export type ExpressionSubstitutionFn = (expression: Expression) => Expression;

export interface ReplacedParameter {
  original: Parameter;
  replacement: Parameter;
}

export abstract class PathItem {
  parentPath?: PathItem;

  abstract substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[]): PathItem;
}

export class NamedPathItem extends PathItem {
  name: string;

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[]): NamedPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substituteExpression(fn, replacedParameters);
      if (newParentPath !== this.parentPath) {
        let result = new NamedPathItem;
        result.parentPath = newParentPath;
        result.name = this.name;
        return result;
      }
    }
    return this;
  }
}

export class ParentPathItem extends PathItem {
  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[]): ParentPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substituteExpression(fn, replacedParameters);
      if (newParentPath !== this.parentPath) {
        let result = new ParentPathItem;
        result.parentPath = newParentPath;
        return result;
      }
    }
    return this;
  }
}

export class IdentityPathItem extends PathItem {
  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[]): IdentityPathItem {
    if (this.parentPath) {
      let newParentPath = this.parentPath.substituteExpression(fn, replacedParameters);
      if (newParentPath !== this.parentPath) {
        let result = new IdentityPathItem;
        result.parentPath = newParentPath;
        return result;
      }
    }
    return this;
  }
}

export class Path extends NamedPathItem {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[]): Path {
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
    if (!changed) {
      result = this;
    }
    return result;
  }
}

export class Definition {
  name: string;
  type: Type;
  parameters: ParameterList = Object.create(ParameterList.prototype);
  innerDefinitions: DefinitionList = Object.create(DefinitionList.prototype);
  contents?: ObjectContents;
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

  findReplacement(replacedParameters: ReplacedParameter[]): Parameter {
    let result: Parameter = this;
    for (let replacedParameter of replacedParameters) {
      if (result === replacedParameter.original) {
        result = replacedParameter.replacement;
      }
    }
    return result;
  }

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Parameter {
    let newType = this.type.expression.substitute(fn, replacedParameters);
    let newDefaultValue = this.defaultValue ? this.defaultValue.substitute(fn, replacedParameters) : undefined;
    if (newType !== this.type.expression || newDefaultValue !== this.defaultValue) {
      let result = new Parameter;
      result.name = this.name;
      result.type = new Type;
      result.type.expression = newType;
      result.type.arrayDimensions = this.type.arrayDimensions;
      result.defaultValue = newDefaultValue;
      result.optional = this.optional;
      result.list = this.list;
      replacedParameters.push({original: this, replacement: result});
      return result;
    } else {
      return this;
    }
  }
}

export class ParameterList extends Array<Parameter> {
  getParameter(name: string): Parameter {
    for (let param of this) {
      if (param.name === name) {
        return param;
      }
    }
    throw new Error(`Parameter "${name}" not found`);
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
}

export class Argument {
  name?: string;
  value: Expression;

  substituteExpression(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[]): Argument {
    let newValue = this.value.substitute(fn, replacedParameters);
    if (newValue !== this.value) {
      let result = new Argument;
      result.name = this.name;
      result.value = newValue;
      return result;
    } else {
      return this;
    }
  }
}

export class ArgumentList extends Array<Argument> {
  getOptionalValue(name?: string, index?: number): Expression | undefined {
    let curIndex = 0;
    for (let arg of this) {
      if (arg.name) {
        if (arg.name === name) {
          return arg.value;
        }
      } else {
        if (curIndex === index) {
          return arg.value;
        }
      }
      curIndex++;
    }
    return undefined;
  }

  getValue(name: string, index?: number): Expression {
    let value = this.getOptionalValue(name, index);
    if (value === undefined) {
      throw new Error(`Missing argument for parameter "${name}"`);
    }
    return value;
  }

  add(value: Expression, name?: string): void {
    let arg = new Argument;
    arg.name = name;
    arg.value = value;
    this.push(arg);
  }

  substituteExpression(fn: ExpressionSubstitutionFn, result: ArgumentList, replacedParameters: ReplacedParameter[]): boolean {
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
}

export class Type {
  expression: ObjectRefExpression;
  arrayDimensions: number;
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
}

export abstract class Expression {
  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    return fn(this);
  }
}

export class IntegerExpression extends Expression {
  value: BigInt;
}

export class StringExpression extends Expression {
  value: string;
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
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}

export abstract class ObjectRefExpression extends Expression {
}

export abstract class MetaRefExpression extends ObjectRefExpression {
  abstract getName(): string;
  abstract fromArgumentList(argumentList: ArgumentList): void;
  abstract toArgumentList(argumentList: ArgumentList): void;
}

export class GenericMetaRefExpression extends MetaRefExpression {
  static readonly metaContents = GenericObjectContents;

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
}

export interface MetaDefinitionList {
  [name: string]: any;
}

export interface MetaDefinitions {
  metaModelName: string;
  definitionTypes: MetaDefinitionList;
  expressionTypes: MetaDefinitionList;
  functions: MetaDefinitionList;
}

export class DefinitionRefExpression extends ObjectRefExpression {
  path: Path;

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new DefinitionRefExpression;
    result.path = this.path.substituteExpression(fn, replacedParameters);
    if (result.path === this.path) {
      result = this;
    }
    return fn(result);
  }
}

export class ParameterExpression extends Expression {
  parameters: ParameterList = Object.create(ParameterList.prototype);

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new ParameterExpression;
    let changed = this.parameters.substituteExpression(fn, result.parameters, replacedParameters);
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}

export class CompoundExpression extends Expression {
  arguments: ArgumentList = Object.create(ArgumentList.prototype);

  substitute(fn: ExpressionSubstitutionFn, replacedParameters: ReplacedParameter[] = []): Expression {
    let result = new CompoundExpression;
    let changed = this.arguments.substituteExpression(fn, result.arguments, replacedParameters);
    if (!changed) {
      result = this;
    }
    return fn(result);
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
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}


export abstract class Context {
  constructor(public metaDefinitions?: MetaDefinitions) {}

  abstract getVariables(): Parameter[];
  abstract getVariable(name: string): Parameter;
}

export class EmptyContext extends Context {
  getVariables(): Parameter[] {
    return [];
  }

  getVariable(name: string): Parameter {
    throw new Error(`Variable "${name}" not found`);
  }
}

export class DerivedContext extends Context {
  constructor(public parentContext: Context) {
    super(parentContext.metaDefinitions);
  }

  getVariables(): Parameter[] {
    return this.parentContext.getVariables();
  }

  getVariable(name: string): Parameter {
    return this.parentContext.getVariable(name);
  }
}

export class ParameterContext extends DerivedContext {
  constructor(public parameter: Parameter, parentContext: Context) {
    super(parentContext);
  }

  getVariables(): Parameter[] {
    return this.parentContext.getVariables().concat(this.parameter);
  }

  getVariable(name: string): Parameter {
    if (this.parameter.name === name) {
      return this.parameter;
    }
    return this.parentContext.getVariable(name);
  }
}

export class ParameterListContext extends Context {
  constructor(public parameters: ParameterList, public parentContext: Context) {
    super(parentContext.metaDefinitions);
  }

  getVariables(): Parameter[] {
    return this.parentContext.getVariables().concat(this.parameters);
  }

  getVariable(name: string): Parameter {
    for (let i = this.parameters.length - 1; i >= 0; --i) {
      let param = this.parameters[i];
      if (param.name === name) {
        return param;
      }
    }
    return this.parentContext.getVariable(name);
  }
}

export class DummyContext extends Context {
  getVariables(): Parameter[] {
    return [];
  }

  getVariable(name: string): Parameter {
    let param = new Parameter;
    param.name = name;
    return param;
  }
}

export class ContextProvider {
  constructor(public metaDefinitions?: MetaDefinitions) {}

  getRootContext(): Context {
    return new EmptyContext(this.metaDefinitions);
  }

  getDefinitionTypeContext(definition: Definition, parentContext: Context): Context {
    return parentContext;
  }

  getDefinitionContentsContext(definition: Definition, parentContext: Context): Context {
    return new ParameterListContext(definition.parameters, parentContext);
  }

  getParameterTypeContext(parameter: Parameter, parentContext: Context, parent: Object): Context {
    return parentContext;
  }

  getNextParameterContext(parameter: Parameter, previousContext: Context, parent: Object): Context {
    return previousContext;
  }

  getNextArgumentContext(argument: Argument, previousContext: Context, parent: Object): Context {
    return previousContext;
  }

  getArgumentValueContext(argument: Argument, parentContext: Context, parent: Object): Context {
    return parentContext;
  }
}

export class DummyContextProvider extends ContextProvider {
  getRootContext(): Context {
    return new DummyContext;
  }
}
