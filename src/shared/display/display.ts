import * as Fmt from '../format/format';
import * as FmtDisplay from './meta';
import CachedPromise from '../data/cachedPromise';

export abstract class RenderedExpression {
  styleClasses?: string[];
  optionalParenStyle: string = '()';
  semanticLink?: SemanticLink;

  getLineHeight(): CachedPromise<number> {
    let lineHeight = 1;
    if (this.styleClasses && this.styleClasses.indexOf('largesym') >= 0) {
      lineHeight = 0;
    }
    return CachedPromise.resolve(lineHeight);
  }

  getSurroundingParenStyle(): CachedPromise<string> {
    return CachedPromise.resolve('');
  }
}

export class EmptyExpression extends RenderedExpression {
}

export abstract class IndirectExpression extends RenderedExpression {
  private resolvedExpression?: RenderedExpression;

  resolve(): RenderedExpression {
    if (this.resolvedExpression === undefined) {
      this.resolvedExpression = this.doResolve();
    }
    return this.resolvedExpression;
  }

  protected abstract doResolve(): RenderedExpression;

  getLineHeight(): CachedPromise<number> {
    let result = super.getLineHeight();
    if (result.getImmediateResult() === 0) {
      return result;
    }
    return this.resolve().getLineHeight();
  }

  getSurroundingParenStyle(): CachedPromise<string> {
    return this.resolve().getSurroundingParenStyle();
  }
}

export class PromiseExpression extends RenderedExpression {
  constructor(public promise: CachedPromise<RenderedExpression>) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    let result = super.getLineHeight();
    if (result.getImmediateResult() === 0) {
      return result;
    }
    return this.promise.then((expression) => expression.getLineHeight());
  }

  getSurroundingParenStyle(): CachedPromise<string> {
    return this.promise.then((expression) => expression.getSurroundingParenStyle());
  }
}

export class ErrorExpression extends RenderedExpression {
  constructor(public errorMessage: string) {
    super();
  }
}

export class TextExpression extends RenderedExpression {
  constructor(public text: string) {
    super();
  }
}

export class RowExpression extends RenderedExpression {
  constructor(public items: RenderedExpression[]) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    let result = super.getLineHeight();
    if (result.getImmediateResult() === 0) {
      return result;
    }
    for (let item of this.items) {
      let itemHeight = item.getLineHeight();
      if (itemHeight.getImmediateResult() === 0) {
        return itemHeight;
      }
    }
    for (let item of this.items) {
      result = result.then((value) => {
        if (value) {
          return item.getLineHeight().then((itemHeight) => {
            if (!itemHeight || itemHeight > value) {
              return itemHeight;
            } else {
              return value;
            }
          });
        } else {
          return value;
        }
      });
    }
    return result;
  }

  getSurroundingParenStyle(): CachedPromise<string> {
    if (this.items.length === 1) {
      return this.items[0].getSurroundingParenStyle();
    } else {
      return super.getSurroundingParenStyle();
    }
  }
}

export class ParagraphExpression extends RenderedExpression {
  constructor(public paragraphs: RenderedExpression[]) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    return CachedPromise.resolve(0);
  }
}

export class ListExpression extends RenderedExpression {
  constructor(public items: RenderedExpression[], public style: string) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    return CachedPromise.resolve(0);
  }
}

export interface RenderedExpressionPair {
  left: RenderedExpression;
  right: RenderedExpression;
}

export class AlignedExpression extends RenderedExpression {
  constructor(public items: RenderedExpressionPair[]) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    return CachedPromise.resolve(0);
  }
}

export class DecoratedExpression extends RenderedExpression {
  constructor(public body: RenderedExpression) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    let result = super.getLineHeight();
    if (result.getImmediateResult() === 0) {
      return result;
    }
    return this.body.getLineHeight();
  }
}

export class ParenExpression extends DecoratedExpression {
  constructor(body: RenderedExpression, public style: string) {
    super(body);
  }

  getLineHeight(): CachedPromise<number> {
    let result = super.getLineHeight();
    if (result.getImmediateResult() === 0) {
      return result;
    }
    return this.body.getLineHeight().then((value) => value ? value + 1 : 0);
  }

  getSurroundingParenStyle(): CachedPromise<string> {
    return CachedPromise.resolve(this.style);
  }
}

export abstract class OptionalParenExpression extends DecoratedExpression {
  left: boolean = true;
  right: boolean = true;
}

export class OuterParenExpression extends OptionalParenExpression {
  minLevel?: number;
}

export class InnerParenExpression extends OptionalParenExpression {
  maxLevel?: number;

  getLineHeight(): CachedPromise<number> {
    let result = super.getLineHeight();
    if (result.getImmediateResult() === 0) {
      return result;
    }
    return this.body.getLineHeight().then((origHeight) => {
      if (origHeight) {
        return this.calculateLineHeight(this.body, origHeight);
      } else {
        return 0;
      }
    });
  }

  private calculateLineHeight(body: RenderedExpression, origHeight: number): number | CachedPromise<number> {
    if (body instanceof OuterParenExpression) {
      if (((body.left && this.left) || (body.right && this.right))
          && (body.minLevel === undefined || this.maxLevel === undefined || body.minLevel <= this.maxLevel)) {
        return origHeight + 1;
      }
    } else if (body instanceof IndirectExpression) {
      return this.calculateLineHeight(body.resolve(), origHeight);
    } else if (body instanceof PromiseExpression) {
      return body.promise.then((resolvedBody) => this.calculateLineHeight(resolvedBody, origHeight));
    }
    return origHeight;
  }
}

export class SubSupExpression extends DecoratedExpression {
  sub?: RenderedExpression;
  sup?: RenderedExpression;
  preSub?: RenderedExpression;
  preSup?: RenderedExpression;
}

export class OverUnderExpression extends DecoratedExpression {
  over?: RenderedExpression;
  under?: RenderedExpression;
}

export class TableExpression extends RenderedExpression {
  constructor(public items: RenderedExpression[][]) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    return CachedPromise.resolve(0);
  }
}

export class FractionExpression extends RenderedExpression {
  constructor(public numerator: RenderedExpression, public denominator: RenderedExpression) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    return CachedPromise.resolve(0);
  }
}

export class RadicalExpression extends RenderedExpression {
  constructor(public radicand: RenderedExpression, public degree?: RenderedExpression) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    return CachedPromise.resolve(0);
  }
}

export class MarkdownExpression extends RenderedExpression {
  constructor(public text: string) {
    super();
  }

  getLineHeight(): CachedPromise<number> {
    return CachedPromise.resolve(0);
  }
}

export interface RenderedTemplateArguments {
  [name: string]: any;  // depending on parameter: constant or RenderedExpression or RenderedExpression[] or RenderedExpression[][] or ...
}

export class RenderedTemplateConfig {
  public args: RenderedTemplateArguments = {};
  public negationCount: number = 0;
  public forceInnerNegations: number = 0;
  public negationFallbackFn?: (expression: RenderedExpression) => RenderedExpression;
}

export abstract class ExpressionWithArgs extends IndirectExpression {
  constructor(protected config: RenderedTemplateConfig) {
    super();
  }

  protected toRenderedExpression(expression: any): RenderedExpression {
    if (expression instanceof RenderedExpression) {
      return expression;
    } else if (expression instanceof Array) {
      return new RowExpression(this.toRenderedExpressionList(expression));
    } else if (expression === undefined) {
      return new EmptyExpression();
    } else {
      return new TextExpression(expression.toString());
    }
  }

  protected toRenderedExpressionList(expressions: any[]): RenderedExpression[] {
    return expressions.map(this.toRenderedExpression, this);
  }

  protected toRenderedExpressionListList(expressions: any[][]): RenderedExpression[][] {
    return expressions.map(this.toRenderedExpressionList, this);
  }

  protected getOptionalArg(name: string): any {
    return this.config.args[name];
  }

  protected getArg(name: string): any {
    let arg = this.getOptionalArg(name);
    if (arg === undefined) {
      throw new Error(`Missing argument for "${name}"`);
    }
    return arg;
  }

  protected getOptionalExpressionArg(name: string): RenderedExpression | undefined {
    let arg = this.getOptionalArg(name);
    if (arg === undefined) {
      return undefined;
    }
    return this.toRenderedExpression(arg);
  }

  protected getExpressionArg(name: string): RenderedExpression {
    let arg = this.getArg(name);
    return this.toRenderedExpression(arg);
  }

  protected getExpressionListArg(name: string): RenderedExpression[] {
    let arg = this.getArg(name);
    return this.toRenderedExpressionList(arg);
  }

  protected getExpressionListListArg(name: string): RenderedExpression[][] {
    let arg = this.getArg(name);
    return this.toRenderedExpressionListList(arg);
  }
}

type LoopBindingFn = ((param: string, dimension: number) => number | undefined) | undefined;

export class UserDefinedExpression extends ExpressionWithArgs {
  private negationsSatisfied?: number;
  private forcedInnerNegations: number = 0;

  constructor(private display: Fmt.Expression, config: RenderedTemplateConfig, private allTemplates: Fmt.File) {
    super(config);
  }

  protected doResolve(): RenderedExpression {
    let result: any[] = [];
    this.negationsSatisfied = undefined;
    this.forcedInnerNegations = 0;
    this.translateExpression(this.display, undefined, result);
    let row = this.toRenderedExpressionList(result);
    let expression: RenderedExpression;
    if (row.length === 1) {
      expression = row[0];
      if (this.styleClasses) {
        if (expression.styleClasses) {
          expression.styleClasses = this.styleClasses.concat(expression.styleClasses);
        } else {
          expression.styleClasses = this.styleClasses;
        }
      }
      expression.optionalParenStyle = this.optionalParenStyle;
      if (this.semanticLink) {
        expression.semanticLink = this.semanticLink;
      }
    } else {
      expression = new RowExpression(row);
      expression.styleClasses = this.styleClasses;
      expression.optionalParenStyle = this.optionalParenStyle;
      expression.semanticLink = this.semanticLink;
    }
    if (this.negationsSatisfied === undefined) {
      this.negationsSatisfied = 0;
    }
    while (this.negationsSatisfied < this.config.negationCount) {
      if (this.config.negationFallbackFn) {
        expression = this.config.negationFallbackFn(expression);
        this.negationsSatisfied++;
      } else {
        throw new Error('Unsatisfied negation');
      }
    }
    return expression;
  }

  private translateExpression(expression: Fmt.Expression, getLoopBinding: LoopBindingFn, result: any[]): void {
    if (expression instanceof Fmt.StringExpression) {
      result.push(expression.value);
    } else if (expression instanceof Fmt.IntegerExpression) {
      result.push(expression.value.toNumber());
    } else if (expression instanceof Fmt.VariableRefExpression) {
      let parameter = expression.variable;
      let param = parameter.name;
      let arg = this.getOptionalArg(param);
      if (arg === undefined && parameter.defaultValue) {
        this.translateExpression(parameter.defaultValue, undefined, result);
        return;
      }
      if (getLoopBinding) {
        let dimension = 0;
        while (arg instanceof Array) {
          let index = getLoopBinding(param, dimension);
          if (index === undefined) {
            break;
          }
          arg = arg[index];
          dimension++;
        }
      }
      result.push(arg);
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      let referencedTemplate = this.allTemplates.definitions.getDefinition(expression.path.name);
      let config = new RenderedTemplateConfig;
      for (let argument of expression.path.arguments) {
        if (argument.name) {
          let arg: any[] = [];
          this.translateExpression(argument.value, getLoopBinding, arg);
          if (arg.length === 1) {
            config.args[argument.name] = arg[0];
          } else {
            throw new Error(`Error evaluating argument "${argument.name}"`);
          }
        } else {
          throw new Error('Arguments must be named');
        }
      }
      if (expression === this.display && this.negationsSatisfied === undefined) {
        config.negationCount = this.config.negationCount;
        config.negationFallbackFn = this.config.negationFallbackFn;
        this.negationsSatisfied = this.config.negationCount;
      }
      result.push(new TemplateInstanceExpression(referencedTemplate, config, this.allTemplates));
    } else if (expression instanceof Fmt.MetaRefExpression) {
      if (expression instanceof FmtDisplay.MetaRefExpression_true) {
        result.push(true);
      } else if (expression instanceof FmtDisplay.MetaRefExpression_false) {
        result.push(false);
      } else if (expression instanceof FmtDisplay.MetaRefExpression_opt) {
        let paramExpr = expression.param as Fmt.VariableRefExpression;
        let param = paramExpr.variable.name;
        let arg = this.getOptionalArg(param);
        if (arg === undefined) {
          if (expression.valueIfMissing) {
            this.translateExpression(expression.valueIfMissing, undefined, result);
          }
        } else {
          if (expression.valueIfPresent) {
            this.translateExpression(expression.valueIfPresent, undefined, result);
          } else {
            this.translateExpression(arg, undefined, result);
          }
        }
      } else if (expression instanceof FmtDisplay.MetaRefExpression_add) {
        let value = 0;
        for (let argument of expression.items) {
          let arg: any[] = [];
          this.translateExpression(argument, undefined, arg);
          for (let item of arg) {
            value += item;
          }
        }
        result.push(value);
      } else if (expression instanceof FmtDisplay.MetaRefExpression_for) {
        let part: any[] = getLoopBinding ? result : [];
        let paramExpr = expression.param as Fmt.VariableRefExpression;
        let param = paramExpr.variable.name;
        let arg = this.getOptionalArg(param);
        let dimensionValue = expression.dimension.toNumber();
        let dimension = 0;
        while (arg instanceof Array && dimension < dimensionValue) {
          arg = arg.length ? arg[0] : undefined;
          dimension++;
        }
        if (arg instanceof Array) {
          for (let index = 0; index < arg.length; index++) {
            if (index && expression.separator) {
              if (expression.separator instanceof Fmt.ArrayExpression) {
                this.translateExpressionList(expression.separator.items, getLoopBinding, part);
              } else {
                this.translateExpression(expression.separator, getLoopBinding, part);
              }
            }
            let getNewLoopBinding = function(testParameter: string, testDimension: number): number | undefined {
              if (testParameter === param && testDimension === dimension) {
                return index;
              } else if (getLoopBinding) {
                return getLoopBinding(testParameter, testDimension);
              } else {
                return undefined;
              }
            };
            if (expression.item instanceof Fmt.ArrayExpression) {
              this.translateExpressionList(expression.item.items, getNewLoopBinding, part);
            } else {
              this.translateExpression(expression.item, getNewLoopBinding, part);
            }
          }
        } else {
          throw new Error('Invalid use of "for"');
        }
        if (!getLoopBinding) {
          result.push(part);
        }
      } else if (expression instanceof FmtDisplay.MetaRefExpression_neg) {
        let index = 0;
        if (this.forcedInnerNegations < this.config.forceInnerNegations) {
          this.forcedInnerNegations++;
        } else {
          index = this.config.negationCount;
          if (index >= expression.items.length) {
            index = expression.items.length - 1;
          }
          if (this.negationsSatisfied === undefined || this.negationsSatisfied === index) {
            this.negationsSatisfied = index;
          } else {
            throw new Error('Inconsistent negations');
          }
        }
        this.translateExpression(expression.items[index], undefined, result);
      } else {
        throw new Error('Undefined meta reference');
      }
    } else if (expression instanceof Fmt.ArrayExpression) {
      let part: any[] = [];
      this.translateExpressionList(expression.items, getLoopBinding, part);
      result.push(part);
    } else {
      throw new Error('Unsupported expression');
    }
  }

  private translateExpressionList(expressions: Fmt.Expression[], getLoopBinding: LoopBindingFn, result: RenderedExpression[]): void {
    for (let expression of expressions) {
      this.translateExpression(expression, getLoopBinding, result);
    }
  }
}

export class TemplateInstanceExpression extends ExpressionWithArgs {
  constructor(private template: Fmt.Definition, config: RenderedTemplateConfig, private allTemplates: Fmt.File) {
    super(config);
  }

  protected doResolve(): RenderedExpression {
    let expression: RenderedExpression | undefined = undefined;
    switch (this.template.name) {
    case 'Style':
      expression = new DecoratedExpression(this.getExpressionArg('body'));
      expression.styleClasses = [this.getArg('styleClass')];
      break;
    case 'Parens':
      expression = new ParenExpression(this.getExpressionArg('body'), this.getArg('style'));
      break;
    case 'OuterParens':
      {
        let parenExpression = new OuterParenExpression(this.getExpressionArg('body'));
        parenExpression.minLevel = this.getOptionalArg('minLevel');
        if (this.getOptionalArg('left') === false) {
          parenExpression.left = false;
        }
        if (this.getOptionalArg('right') === false) {
          parenExpression.right = false;
        }
        expression = parenExpression;
      }
      break;
    case 'InnerParens':
      {
        let parenExpression = new InnerParenExpression(this.getExpressionArg('body'));
        parenExpression.maxLevel = this.getOptionalArg('maxLevel');
        if (this.getOptionalArg('left') === false) {
          parenExpression.left = false;
        }
        if (this.getOptionalArg('right') === false) {
          parenExpression.right = false;
        }
        expression = parenExpression;
      }
      break;
    case 'SubSup':
      {
        let subSupExpression = new SubSupExpression(this.getExpressionArg('body'));
        subSupExpression.sub = this.getOptionalExpressionArg('sub');
        subSupExpression.sup = this.getOptionalExpressionArg('sup');
        subSupExpression.preSub = this.getOptionalExpressionArg('preSub');
        subSupExpression.preSup = this.getOptionalExpressionArg('preSup');
        expression = subSupExpression;
      }
      break;
    case 'OverUnder':
      {
        let overUnderExpression = new OverUnderExpression(this.getExpressionArg('body'));
        overUnderExpression.over = this.getOptionalExpressionArg('over');
        overUnderExpression.under = this.getOptionalExpressionArg('under');
        expression = overUnderExpression;
      }
      break;
    case 'Table':
      expression = new TableExpression(this.getExpressionListListArg('items'));
      break;
    case 'Aligned':
      {
        let items = this.getExpressionListListArg('items');
        let rows = items.map((row: RenderedExpression[]) => ({
          left: new RowExpression(row.splice(0, row.length - 1)),
          right: row[row.length - 1]
        }));
        expression = new AlignedExpression(rows);
      }
      break;
    case 'Fraction':
      expression = new FractionExpression(this.getExpressionArg('numerator'), this.getExpressionArg('denominator'));
      break;
    case 'Radical':
      expression = new RadicalExpression(this.getExpressionArg('radicand'), this.getOptionalExpressionArg('degree'));
      break;
    default:
      if (this.template.contents instanceof FmtDisplay.ObjectContents_Template) {
        let display = this.template.contents.display;
        if (display) {
          expression = new UserDefinedExpression(display, this.config, this.allTemplates);
        }
      }
    }
    if (!expression) {
      expression = new EmptyExpression;
    }
    if (expression.styleClasses && this.styleClasses) {
      expression.styleClasses = expression.styleClasses.concat(this.styleClasses);
    } else if (this.styleClasses) {
      expression.styleClasses = this.styleClasses;
    }
    expression.optionalParenStyle = this.optionalParenStyle;
    expression.semanticLink = this.semanticLink;
    return expression;
  }
}


export class SemanticLink {
  constructor(public linkedObject?: Object, public showAllReferences: boolean = false, public isDefinition: boolean = false) {}
}
