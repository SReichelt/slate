// Generated from data/logics/library.slate by generateMetaDeclarations.ts.

import * as Fmt from '../format/format';
import * as Ctx from '../format/context';
import * as Meta from '../format/metaModel';

export class ObjectContents_Section extends Fmt.ObjectContents {
  logic: string;
  items: Fmt.Expression[];

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let logicRaw = argumentList.getValue('logic', 0);
    if (logicRaw instanceof Fmt.StringExpression) {
      this.logic = logicRaw.value;
    } else {
      throw new Error('logic: String expected');
    }
    let itemsRaw = argumentList.getValue('items', 1);
    if (itemsRaw instanceof Fmt.ArrayExpression) {
      this.items = itemsRaw.items;
    } else {
      throw new Error('items: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let logicExpr = new Fmt.StringExpression(this.logic);
    argumentList.add(logicExpr, outputAllNames ? 'logic' : undefined, false);
    let itemsExpr = new Fmt.ArrayExpression;
    itemsExpr.items = [];
    for (let item of this.items) {
      itemsExpr.items.push(item);
    }
    argumentList.add(itemsExpr, outputAllNames ? 'items' : undefined, false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Section {
    let result = new ObjectContents_Section;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.items) {
      for (let item of this.items) {
        item.traverse(fn);
      }
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Section, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    result.logic = this.logic;
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
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Section, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.logic !== objectContents.logic) {
      return false;
    }
    if (this.items || objectContents.items) {
      if (!this.items || !objectContents.items || this.items.length !== objectContents.items.length) {
        return false;
      }
      for (let i = 0; i < this.items.length; i++) {
        let leftItem = this.items[i];
        let rightItem = objectContents.items[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_Section extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Section';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Section;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Section)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_Section;
  }
}

export class ObjectContents_Library extends ObjectContents_Section {
  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Library {
    let result = new ObjectContents_Library;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Library, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Library, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_Library extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Library';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Library;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Library)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_Library;
  }
}

export class MetaRefExpression_item extends Fmt.MetaRefExpression {
  ref: Fmt.Expression;
  type?: string;
  title?: string;

  getName(): string {
    return 'item';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.ref = argumentList.getValue('ref', 0);
    let typeRaw = argumentList.getOptionalValue('type', 1);
    if (typeRaw !== undefined) {
      if (typeRaw instanceof Fmt.StringExpression) {
        this.type = typeRaw.value;
      } else {
        throw new Error('type: String expected');
      }
    }
    let titleRaw = argumentList.getOptionalValue('title', 2);
    if (titleRaw !== undefined) {
      if (titleRaw instanceof Fmt.StringExpression) {
        this.title = titleRaw.value;
      } else {
        throw new Error('title: String expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.ref, undefined, false);
    if (this.type !== undefined) {
      let typeExpr = new Fmt.StringExpression(this.type);
      argumentList.add(typeExpr, 'type', true);
    }
    if (this.title !== undefined) {
      let titleExpr = new Fmt.StringExpression(this.title);
      argumentList.add(titleExpr, 'title', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_item;
    let changed = false;
    if (this.ref) {
      result.ref = this.ref.substitute(fn, replacedParameters);
      if (result.ref !== this.ref) {
        changed = true;
      }
    }
    result.type = this.type;
    result.title = this.title;
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_item)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.ref, expression.ref, fn, replacedParameters)) {
      return false;
    }
    if (this.type !== expression.type) {
      return false;
    }
    if (this.title !== expression.title) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_subsection extends Fmt.MetaRefExpression {
  ref: Fmt.Expression;
  title: string;

  getName(): string {
    return 'subsection';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.ref = argumentList.getValue('ref', 0);
    let titleRaw = argumentList.getValue('title', 1);
    if (titleRaw instanceof Fmt.StringExpression) {
      this.title = titleRaw.value;
    } else {
      throw new Error('title: String expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.ref, undefined, false);
    let titleExpr = new Fmt.StringExpression(this.title);
    argumentList.add(titleExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_subsection;
    let changed = false;
    if (this.ref) {
      result.ref = this.ref.substitute(fn, replacedParameters);
      if (result.ref !== this.ref) {
        changed = true;
      }
    }
    result.title = this.title;
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_subsection)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.ref, expression.ref, fn, replacedParameters)) {
      return false;
    }
    if (this.title !== expression.title) {
      return false;
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

const definitionTypes: Fmt.MetaDefinitionList = {'Library': MetaRefExpression_Library, 'Section': MetaRefExpression_Section};
const expressionTypes: Fmt.MetaDefinitionList = {};
const functions: Fmt.MetaDefinitionList = {'item': MetaRefExpression_item, 'subsection': MetaRefExpression_subsection, '': Fmt.GenericMetaRefExpression};

export class MetaModel extends Meta.MetaModel {
  constructor() {
    super('library',
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
      let type = parent.type;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_Library
            || type instanceof MetaRefExpression_Section) {
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
  if (path && path.name !== 'library') {
    throw new Error('File of type "library" expected');
  }
  return metaModel;
}
