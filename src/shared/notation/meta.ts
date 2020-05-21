// Generated from data/notation/notation.slate by generateMetaDeclarations.ts.
/* eslint @typescript-eslint/class-name-casing: off */

import * as Fmt from '../format/format';
import * as Ctx from '../format/context';
import * as Meta from '../format/metaModel';

export class ObjectContents_Template extends Fmt.ObjectContents {
  notation?: Fmt.Expression;
  symbol?: Fmt.Expression;
  useSymbol?: Fmt.Expression;
  elements?: ObjectContents_TemplateElements;
  context?: ObjectContents_TemplateContext;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.notation = argumentList.getOptionalValue('notation', 0);
    this.symbol = argumentList.getOptionalValue('symbol', 1);
    this.useSymbol = argumentList.getOptionalValue('useSymbol', 2);
    let elementsRaw = argumentList.getOptionalValue('elements', 3);
    if (elementsRaw !== undefined) {
      if (elementsRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_TemplateElements;
        newItem.fromCompoundExpression(elementsRaw);
        this.elements = newItem;
      } else {
        throw new Error('elements: Compound expression expected');
      }
    }
    let contextRaw = argumentList.getOptionalValue('context', 4);
    if (contextRaw !== undefined) {
      if (contextRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_TemplateContext;
        newItem.fromCompoundExpression(contextRaw);
        this.context = newItem;
      } else {
        throw new Error('context: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean): void {
    argumentList.length = 0;
    if (this.notation !== undefined) {
      argumentList.add(this.notation, 'notation', true);
    }
    if (this.symbol !== undefined) {
      argumentList.add(this.symbol, 'symbol', true);
    }
    if (this.useSymbol !== undefined) {
      argumentList.add(this.useSymbol, 'useSymbol', true);
    }
    if (this.elements !== undefined) {
      let elementsExpr = new Fmt.CompoundExpression;
      this.elements.toCompoundExpression(elementsExpr, true);
      argumentList.add(elementsExpr, 'elements', true);
    }
    if (this.context !== undefined) {
      let contextExpr = new Fmt.CompoundExpression;
      this.context.toCompoundExpression(contextExpr, true);
      argumentList.add(contextExpr, 'context', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Template {
    let result = new ObjectContents_Template;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.notation) {
      this.notation.traverse(fn);
    }
    if (this.symbol) {
      this.symbol.traverse(fn);
    }
    if (this.useSymbol) {
      this.useSymbol.traverse(fn);
    }
    if (this.elements) {
      this.elements.traverse(fn);
    }
    if (this.context) {
      this.context.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Template, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.notation) {
      result.notation = this.notation.substitute(fn, replacedParameters);
      if (result.notation !== this.notation) {
        changed = true;
      }
    }
    if (this.symbol) {
      result.symbol = this.symbol.substitute(fn, replacedParameters);
      if (result.symbol !== this.symbol) {
        changed = true;
      }
    }
    if (this.useSymbol) {
      result.useSymbol = this.useSymbol.substitute(fn, replacedParameters);
      if (result.useSymbol !== this.useSymbol) {
        changed = true;
      }
    }
    if (this.elements) {
      result.elements = new ObjectContents_TemplateElements;
      if (this.elements.substituteExpression(fn, result.elements!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.context) {
      result.context = new ObjectContents_TemplateContext;
      if (this.context.substituteExpression(fn, result.context!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Template, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.notation || objectContents.notation) {
      if (!this.notation || !objectContents.notation || !this.notation.isEquivalentTo(objectContents.notation, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.symbol || objectContents.symbol) {
      if (!this.symbol || !objectContents.symbol || !this.symbol.isEquivalentTo(objectContents.symbol, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.useSymbol || objectContents.useSymbol) {
      if (!this.useSymbol || !objectContents.useSymbol || !this.useSymbol.isEquivalentTo(objectContents.useSymbol, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.elements || objectContents.elements) {
      if (!this.elements || !objectContents.elements || !this.elements.isEquivalentTo(objectContents.elements, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.context || objectContents.context) {
      if (!this.context || !objectContents.context || !this.context.isEquivalentTo(objectContents.context, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Template)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_Template;
  }
}

export class ObjectContents_TemplateElements extends Fmt.ObjectContents {
  operand?: Fmt.Expression;
  property?: Fmt.Expression;
  singular?: Fmt.Expression;
  plural?: Fmt.Expression;
  article?: Fmt.Expression;
  isFeature?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.operand = argumentList.getOptionalValue('operand', 0);
    this.property = argumentList.getOptionalValue('property', 1);
    this.singular = argumentList.getOptionalValue('singular', 2);
    this.plural = argumentList.getOptionalValue('plural', 3);
    this.article = argumentList.getOptionalValue('article', 4);
    this.isFeature = argumentList.getOptionalValue('isFeature', 5);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean): void {
    argumentList.length = 0;
    if (this.operand !== undefined) {
      argumentList.add(this.operand, 'operand', true);
    }
    if (this.property !== undefined) {
      argumentList.add(this.property, 'property', true);
    }
    if (this.singular !== undefined) {
      argumentList.add(this.singular, 'singular', true);
    }
    if (this.plural !== undefined) {
      argumentList.add(this.plural, 'plural', true);
    }
    if (this.article !== undefined) {
      argumentList.add(this.article, 'article', true);
    }
    if (this.isFeature !== undefined) {
      argumentList.add(this.isFeature, 'isFeature', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_TemplateElements {
    let result = new ObjectContents_TemplateElements;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.operand) {
      this.operand.traverse(fn);
    }
    if (this.property) {
      this.property.traverse(fn);
    }
    if (this.singular) {
      this.singular.traverse(fn);
    }
    if (this.plural) {
      this.plural.traverse(fn);
    }
    if (this.article) {
      this.article.traverse(fn);
    }
    if (this.isFeature) {
      this.isFeature.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_TemplateElements, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.operand) {
      result.operand = this.operand.substitute(fn, replacedParameters);
      if (result.operand !== this.operand) {
        changed = true;
      }
    }
    if (this.property) {
      result.property = this.property.substitute(fn, replacedParameters);
      if (result.property !== this.property) {
        changed = true;
      }
    }
    if (this.singular) {
      result.singular = this.singular.substitute(fn, replacedParameters);
      if (result.singular !== this.singular) {
        changed = true;
      }
    }
    if (this.plural) {
      result.plural = this.plural.substitute(fn, replacedParameters);
      if (result.plural !== this.plural) {
        changed = true;
      }
    }
    if (this.article) {
      result.article = this.article.substitute(fn, replacedParameters);
      if (result.article !== this.article) {
        changed = true;
      }
    }
    if (this.isFeature) {
      result.isFeature = this.isFeature.substitute(fn, replacedParameters);
      if (result.isFeature !== this.isFeature) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_TemplateElements, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.operand || objectContents.operand) {
      if (!this.operand || !objectContents.operand || !this.operand.isEquivalentTo(objectContents.operand, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.property || objectContents.property) {
      if (!this.property || !objectContents.property || !this.property.isEquivalentTo(objectContents.property, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.singular || objectContents.singular) {
      if (!this.singular || !objectContents.singular || !this.singular.isEquivalentTo(objectContents.singular, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.plural || objectContents.plural) {
      if (!this.plural || !objectContents.plural || !this.plural.isEquivalentTo(objectContents.plural, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.article || objectContents.article) {
      if (!this.article || !objectContents.article || !this.article.isEquivalentTo(objectContents.article, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.isFeature || objectContents.isFeature) {
      if (!this.isFeature || !objectContents.isFeature || !this.isFeature.isEquivalentTo(objectContents.isFeature, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_TemplateContext extends Fmt.ObjectContents {
  operator?: Fmt.Expression;
  predicate?: Fmt.Expression;
  definitionNotation?: Fmt.Expression;
  argument?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.operator = argumentList.getOptionalValue('operator', 0);
    this.predicate = argumentList.getOptionalValue('predicate', 1);
    this.definitionNotation = argumentList.getOptionalValue('definitionNotation', 2);
    this.argument = argumentList.getOptionalValue('argument', 3);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean): void {
    argumentList.length = 0;
    if (this.operator !== undefined) {
      argumentList.add(this.operator, 'operator', true);
    }
    if (this.predicate !== undefined) {
      argumentList.add(this.predicate, 'predicate', true);
    }
    if (this.definitionNotation !== undefined) {
      argumentList.add(this.definitionNotation, 'definitionNotation', true);
    }
    if (this.argument !== undefined) {
      argumentList.add(this.argument, 'argument', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_TemplateContext {
    let result = new ObjectContents_TemplateContext;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.operator) {
      this.operator.traverse(fn);
    }
    if (this.predicate) {
      this.predicate.traverse(fn);
    }
    if (this.definitionNotation) {
      this.definitionNotation.traverse(fn);
    }
    if (this.argument) {
      this.argument.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_TemplateContext, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.operator) {
      result.operator = this.operator.substitute(fn, replacedParameters);
      if (result.operator !== this.operator) {
        changed = true;
      }
    }
    if (this.predicate) {
      result.predicate = this.predicate.substitute(fn, replacedParameters);
      if (result.predicate !== this.predicate) {
        changed = true;
      }
    }
    if (this.definitionNotation) {
      result.definitionNotation = this.definitionNotation.substitute(fn, replacedParameters);
      if (result.definitionNotation !== this.definitionNotation) {
        changed = true;
      }
    }
    if (this.argument) {
      result.argument = this.argument.substitute(fn, replacedParameters);
      if (result.argument !== this.argument) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_TemplateContext, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.operator || objectContents.operator) {
      if (!this.operator || !objectContents.operator || !this.operator.isEquivalentTo(objectContents.operator, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.predicate || objectContents.predicate) {
      if (!this.predicate || !objectContents.predicate || !this.predicate.isEquivalentTo(objectContents.predicate, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.definitionNotation || objectContents.definitionNotation) {
      if (!this.definitionNotation || !objectContents.definitionNotation || !this.definitionNotation.isEquivalentTo(objectContents.definitionNotation, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.argument || objectContents.argument) {
      if (!this.argument || !objectContents.argument || !this.argument.isEquivalentTo(objectContents.argument, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Bool)) {
      return false;
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Int)) {
      return false;
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_String)) {
      return false;
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Expr)) {
      return false;
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_true)) {
      return false;
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_false)) {
      return false;
    }
    return true;
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
    argumentList.add(this.condition, undefined, false);
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_not)) {
      return false;
    }
    if (this.condition || expression.condition) {
      if (!this.condition || !expression.condition || !this.condition.isEquivalentTo(expression.condition, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
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
    argumentList.add(this.param, undefined, false);
    if (this.valueIfPresent !== undefined) {
      argumentList.add(this.valueIfPresent, 'valueIfPresent', true);
    }
    if (this.valueIfMissing !== undefined) {
      argumentList.add(this.valueIfMissing, 'valueIfMissing', true);
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_opt)) {
      return false;
    }
    if (this.param || expression.param) {
      if (!this.param || !expression.param || !this.param.isEquivalentTo(expression.param, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.valueIfPresent || expression.valueIfPresent) {
      if (!this.valueIfPresent || !expression.valueIfPresent || !this.valueIfPresent.isEquivalentTo(expression.valueIfPresent, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.valueIfMissing || expression.valueIfMissing) {
      if (!this.valueIfMissing || !expression.valueIfMissing || !this.valueIfMissing.isEquivalentTo(expression.valueIfMissing, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
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
      argumentList.add(itemsArg, undefined, true);
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_add)) {
      return false;
    }
    if (this.items || expression.items) {
      if (!this.items || !expression.items || this.items.length !== expression.items.length) {
        return false;
      }
      for (let i = 0; i < this.items.length; i++) {
        let leftItem = this.items[i];
        let rightItem = expression.items[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    return true;
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
    argumentList.add(this.param, undefined, false);
    let dimensionExpr = new Fmt.IntegerExpression;
    dimensionExpr.value = this.dimension;
    argumentList.add(dimensionExpr, undefined, false);
    argumentList.add(this.item, undefined, false);
    if (this.separator !== undefined) {
      argumentList.add(this.separator, 'separator', true);
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_for)) {
      return false;
    }
    if (this.param || expression.param) {
      if (!this.param || !expression.param || !this.param.isEquivalentTo(expression.param, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.dimension !== undefined || expression.dimension !== undefined) {
      if (this.dimension === undefined || expression.dimension === undefined || !this.dimension.eq(expression.dimension)) {
        return false;
      }
    }
    if (this.item || expression.item) {
      if (!this.item || !expression.item || !this.item.isEquivalentTo(expression.item, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.separator || expression.separator) {
      if (!this.separator || !expression.separator || !this.separator.isEquivalentTo(expression.separator, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_first)) {
      return false;
    }
    return true;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_last)) {
      return false;
    }
    return true;
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
      argumentList.add(itemsArg, undefined, true);
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_neg)) {
      return false;
    }
    if (this.items || expression.items) {
      if (!this.items || !expression.items || this.items.length !== expression.items.length) {
        return false;
      }
      for (let i = 0; i < this.items.length; i++) {
        let leftItem = this.items[i];
        let rightItem = expression.items[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

class DefinitionContentsContext extends Ctx.DerivedContext {
  constructor(public definition: Fmt.Definition, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

class ParameterTypeContext extends Ctx.DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

class ArgumentTypeContext extends Ctx.DerivedContext {
  constructor(public objectContentsClass: {new(): Fmt.ObjectContents}, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

const definitionTypes: Fmt.MetaDefinitionList = {'Template': MetaRefExpression_Template};
const expressionTypes: Fmt.MetaDefinitionList = {'Bool': MetaRefExpression_Bool, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'Expr': MetaRefExpression_Expr};
const functions: Fmt.MetaDefinitionList = {'true': MetaRefExpression_true, 'false': MetaRefExpression_false, 'not': MetaRefExpression_not, 'opt': MetaRefExpression_opt, 'add': MetaRefExpression_add, 'for': MetaRefExpression_for, 'first': MetaRefExpression_first, 'last': MetaRefExpression_last, 'neg': MetaRefExpression_neg, '': Fmt.GenericMetaRefExpression};

export class MetaModel extends Meta.MetaModel {
  constructor() {
    super('notation',
          new Fmt.StandardMetaDefinitionFactory(definitionTypes),
          new Fmt.StandardMetaDefinitionFactory(expressionTypes),
          new Fmt.StandardMetaDefinitionFactory(functions));
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Ctx.Context): Ctx.Context {
    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Ctx.Context): Ctx.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Ctx.Context): Ctx.Context {
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
      for (let currentContext = previousContext; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {
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

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Ctx.Context): Ctx.Context {
    let context = parentContext;
    let parent = context.parentObject;
    if (parent instanceof Fmt.Definition) {
      let type = parent.type.expression;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_Template) {
          if (argument.name === 'elements' || (argument.name === undefined && argumentIndex === 3)) {
            context = new ArgumentTypeContext(ObjectContents_TemplateElements, context);
          }
          if (argument.name === 'context' || (argument.name === undefined && argumentIndex === 4)) {
            context = new ArgumentTypeContext(ObjectContents_TemplateContext, context);
          }
        }
      }
    }
    if (parent instanceof Fmt.CompoundExpression) {
      for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {
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

export function getMetaModel(path?: Fmt.Path): MetaModel {
  if (path && path.name !== 'notation') {
    throw new Error('File of type "notation" expected');
  }
  return metaModel;
}
