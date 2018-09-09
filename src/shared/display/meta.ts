// Generated from data/display/display.hlm by generateMetaDeclarations.ts.
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
    if (!changed) {
      result = this;
    }
    return fn(result);
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
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}

export class MetaRefExpression_for extends Fmt.MetaRefExpression {
  param: Fmt.Expression;
  dimension: Fmt.BigInt;
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
    if (!changed) {
      result = this;
    }
    return fn(result);
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
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}

const definitionTypes: Fmt.MetaDefinitionList = {'Template': MetaRefExpression_Template};
const expressionTypes: Fmt.MetaDefinitionList = {'Bool': MetaRefExpression_Bool, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'Expr': MetaRefExpression_Expr};
const functions: Fmt.MetaDefinitionList = {'true': MetaRefExpression_true, 'false': MetaRefExpression_false, 'opt': MetaRefExpression_opt, 'add': MetaRefExpression_add, 'for': MetaRefExpression_for, 'neg': MetaRefExpression_neg};

export const metaModel = new Fmt.MetaModel(
  new Fmt.StandardMetaDefinitionFactory(definitionTypes),
  new Fmt.StandardMetaDefinitionFactory(expressionTypes),
  new Fmt.StandardMetaDefinitionFactory(functions)
);

export function getMetaModel(path: Fmt.Path) {
  if (path.name !== 'display') {
    throw new Error('File of type "display" expected');
  }
  return metaModel;
}
