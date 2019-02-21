// Generated from data/display/display.slate by generateMetaDeclarations.ts.
// tslint:disable:class-name
// tslint:disable:variable-name

import * as Fmt from '../format/format';

export class ObjectContents_Template extends Fmt.ObjectContents {
  display?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.display = argumentList.getOptionalValue('display', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.display !== undefined) {
      argumentList.add(this.display, 'display');
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Template {
    let result = new ObjectContents_Template;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Template, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.display) {
      result.display = this.display.substitute(fn, replacedParameters);
      if (result.display !== this.display) {
        changed = true;
      }
    }
    return changed;
  }
}

export class MetaRefExpression_Template extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Template';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Template;
    }
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_Template;
  }
}

export class MetaRefExpression_Bool extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Bool';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Bool;
    }
  }
}

export class MetaRefExpression_Int extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Int';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Int;
    }
  }
}

export class MetaRefExpression_String extends Fmt.MetaRefExpression {
  getName(): string {
    return 'String';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_String;
    }
  }
}

export class MetaRefExpression_Expr extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Expr';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Expr;
    }
  }
}

export class MetaRefExpression_true extends Fmt.MetaRefExpression {
  getName(): string {
    return 'true';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_true;
    }
  }
}

export class MetaRefExpression_false extends Fmt.MetaRefExpression {
  getName(): string {
    return 'false';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_false;
    }
  }
}

export class MetaRefExpression_not extends Fmt.MetaRefExpression {
  condition: Fmt.Expression;

  getName(): string {
    return 'not';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.condition = argumentList.getValue('condition', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.condition);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_not;
    let changed = false;
    if (this.condition) {
      result.condition = this.condition.substitute(fn, replacedParameters);
      if (result.condition !== this.condition) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }
}

export class MetaRefExpression_opt extends Fmt.MetaRefExpression {
  param: Fmt.Expression;
  valueIfPresent?: Fmt.Expression;
  valueIfMissing?: Fmt.Expression;

  getName(): string {
    return 'opt';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.param = argumentList.getValue('param', 0);
    this.valueIfPresent = argumentList.getOptionalValue('valueIfPresent', 1);
    this.valueIfMissing = argumentList.getOptionalValue('valueIfMissing', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.param);
    if (this.valueIfPresent !== undefined) {
      argumentList.add(this.valueIfPresent, 'valueIfPresent');
    }
    if (this.valueIfMissing !== undefined) {
      argumentList.add(this.valueIfMissing, 'valueIfMissing');
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_opt;
    let changed = false;
    if (this.param) {
      result.param = this.param.substitute(fn, replacedParameters);
      if (result.param !== this.param) {
        changed = true;
      }
    }
    if (this.valueIfPresent) {
      result.valueIfPresent = this.valueIfPresent.substitute(fn, replacedParameters);
      if (result.valueIfPresent !== this.valueIfPresent) {
        changed = true;
      }
    }
    if (this.valueIfMissing) {
      result.valueIfMissing = this.valueIfMissing.substitute(fn, replacedParameters);
      if (result.valueIfMissing !== this.valueIfMissing) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }
}

export class MetaRefExpression_add extends Fmt.MetaRefExpression {
  items: Fmt.Expression[];

  getName(): string {
    return 'add';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.items = [];
    let index = 0;
    for (;;) {
      let itemsRaw = argumentList.getOptionalValue(undefined, index);
      if (itemsRaw === undefined) {
        break;
      }
      this.items!.push(itemsRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    for (let itemsArg of this.items) {
      argumentList.add(itemsArg);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_add;
    let changed = false;
    if (this.items) {
      result.items = [];
      for (let item of this.items) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.items.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }
}

export class MetaRefExpression_for extends Fmt.MetaRefExpression {
  param: Fmt.Expression;
  dimension: Fmt.BN;
  item: Fmt.Expression;
  separator?: Fmt.Expression;

  getName(): string {
    return 'for';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.param = argumentList.getValue('param', 0);
    let dimensionRaw = argumentList.getValue('dimension', 1);
    if (dimensionRaw instanceof Fmt.IntegerExpression) {
      this.dimension = dimensionRaw.value;
    } else {
      throw new Error('dimension: Integer expected');
    }
    this.item = argumentList.getValue('item', 2);
    this.separator = argumentList.getOptionalValue('separator', 3);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.param);
    let dimensionExpr = new Fmt.IntegerExpression;
    dimensionExpr.value = this.dimension;
    argumentList.add(dimensionExpr);
    argumentList.add(this.item);
    if (this.separator !== undefined) {
      argumentList.add(this.separator, 'separator');
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_for;
    let changed = false;
    if (this.param) {
      result.param = this.param.substitute(fn, replacedParameters);
      if (result.param !== this.param) {
        changed = true;
      }
    }
    result.dimension = this.dimension;
    if (this.item) {
      result.item = this.item.substitute(fn, replacedParameters);
      if (result.item !== this.item) {
        changed = true;
      }
    }
    if (this.separator) {
      result.separator = this.separator.substitute(fn, replacedParameters);
      if (result.separator !== this.separator) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }
}

export class MetaRefExpression_first extends Fmt.MetaRefExpression {
  getName(): string {
    return 'first';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_first;
    }
  }
}

export class MetaRefExpression_last extends Fmt.MetaRefExpression {
  getName(): string {
    return 'last';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_last;
    }
  }
}

export class MetaRefExpression_neg extends Fmt.MetaRefExpression {
  items: Fmt.Expression[];

  getName(): string {
    return 'neg';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.items = [];
    let index = 0;
    for (;;) {
      let itemsRaw = argumentList.getOptionalValue(undefined, index);
      if (itemsRaw === undefined) {
        break;
      }
      this.items!.push(itemsRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    for (let itemsArg of this.items) {
      argumentList.add(itemsArg);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_neg;
    let changed = false;
    if (this.items) {
      result.items = [];
      for (let item of this.items) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.items.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }
}

class DefinitionContentsContext extends Fmt.DerivedContext {
  constructor(public definition: Fmt.Definition, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

class ParameterTypeContext extends Fmt.DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

class ArgumentTypeContext extends Fmt.DerivedContext {
  constructor(public objectContentsClass: {new(): Fmt.ObjectContents}, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

const definitionTypes: Fmt.MetaDefinitionList = {'Template': MetaRefExpression_Template};
const expressionTypes: Fmt.MetaDefinitionList = {'Bool': MetaRefExpression_Bool, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'Expr': MetaRefExpression_Expr};
const functions: Fmt.MetaDefinitionList = {'true': MetaRefExpression_true, 'false': MetaRefExpression_false, 'not': MetaRefExpression_not, 'opt': MetaRefExpression_opt, 'add': MetaRefExpression_add, 'for': MetaRefExpression_for, 'first': MetaRefExpression_first, 'last': MetaRefExpression_last, 'neg': MetaRefExpression_neg, '': Fmt.GenericMetaRefExpression};

export class MetaModel extends Fmt.MetaModel {
  constructor() {
    super('display',
          new Fmt.StandardMetaDefinitionFactory(definitionTypes),
          new Fmt.StandardMetaDefinitionFactory(expressionTypes),
          new Fmt.StandardMetaDefinitionFactory(functions));
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Fmt.Context): Fmt.Context {
    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Fmt.Context): Fmt.Context {
    let parent = previousContext.parentObject;
    if (parent instanceof Fmt.Definition) {
      let type = parent.type.expression;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_Template) {
          return previousContext;
        }
      }
    }
    if (parent instanceof Fmt.CompoundExpression) {
      for (let currentContext = previousContext; currentContext instanceof Fmt.DerivedContext; currentContext = currentContext.parentContext) {
        if (currentContext instanceof ArgumentTypeContext) {
          return previousContext;
        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    if (parent instanceof Fmt.MetaRefExpression) {
      return previousContext;
    }
    return super.getNextArgumentContext(argument, argumentIndex, previousContext);
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Fmt.Context): Fmt.Context {
    let context = parentContext;
    let parent = context.parentObject;
    if (parent instanceof Fmt.CompoundExpression) {
      for (let currentContext = context; currentContext instanceof Fmt.DerivedContext; currentContext = currentContext.parentContext) {
        if (currentContext instanceof ArgumentTypeContext) {
          break;
        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    return context;
  }
}

export const metaModel = new MetaModel;

export function getMetaModel(path: Fmt.Path) {
  if (path.name !== 'display') {
    throw new Error('File of type "display" expected');
  }
  return metaModel;
}
