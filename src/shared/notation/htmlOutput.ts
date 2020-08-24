import * as Notation from './notation';
import CachedPromise from '../data/cachedPromise';
import { convertUnicode, UnicodeConverter, UnicodeConversionOptions, useItalicsForVariable } from './unicode';

export interface HTMLAttributes {
  [name: string]: any;
}

export interface HTMLRenderer<T> {
  renderText(text: string): T;
  renderElement(tagName: string, attrs?: HTMLAttributes, content?: T): T;
  concat(items: T[]): T;
  renderMarkdown(markdown: string): T;
}

class HTMLUnicodeConverter<T> implements UnicodeConverter {
  result: T[] = [];

  constructor(private renderer: HTMLRenderer<T>) {}

  outputText(text: string, style?: string | undefined): void {
    let content = this.renderer.renderText(text);
    this.result.push(style ? this.renderer.renderElement('span', {'class': style}, content) : content);
  }

  outputLineBreak(): void {
    this.result.push(this.renderer.renderElement('br'));
  }

  outputExtraSpace(standalone: boolean): void {
    this.result.push(this.renderer.renderText(standalone ? '\u2008' : '\u00a0'));
  }
}

export function renderAsHTML<T>(expression: Notation.RenderedExpression, renderer: HTMLRenderer<T>, options: UnicodeConversionOptions, optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number, optionalParenStyle?: string): CachedPromise<T> {
  if (!optionalParenStyle) {
    optionalParenStyle = expression.optionalParenStyle;
  }
  if ((optionalParenLeft || optionalParenRight)
      && optionalParenMaxLevel === undefined
      && (expression instanceof Notation.SubSupExpression || expression instanceof Notation.OverUnderExpression || expression instanceof Notation.FractionExpression || expression instanceof Notation.RadicalExpression)) {
    return renderAsHTML(new Notation.ParenExpression(expression, optionalParenStyle), renderer, options);
  }
  let resultPromise: CachedPromise<T>;
  if (expression instanceof Notation.EmptyExpression) {
    return CachedPromise.resolve(renderer.concat([]));
  } else if (expression instanceof Notation.TextExpression) {
    let unicodeConverter = new HTMLUnicodeConverter(renderer);
    convertUnicode(expression.text, unicodeConverter, options);
    let result = unicodeConverter.result.length === 1 ? unicodeConverter.result[0] : renderer.concat(unicodeConverter.result);
    if (expression.hasStyleClass('var') && useItalicsForVariable(expression.text)) {
      result = renderer.renderElement('em', {}, result);
    }
    resultPromise = CachedPromise.resolve(result);
  } else if (expression instanceof Notation.RowExpression) {
    if (expression.items.length === 1) {
      resultPromise = renderAsHTML(expression.items[0], renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else {
      resultPromise = renderList(expression.items.map((item) => renderAsHTML(item, renderer, options)), renderer);
    }
  } else if (expression instanceof Notation.ParagraphExpression) {
    let paragraphs = expression.paragraphs.map((item: Notation.RenderedExpression) =>
      renderAsHTML(item, renderer, options).then((content: T) =>
        renderer.renderElement('div', {'class': 'paragraph'}, content)));
    resultPromise = renderList(paragraphs, renderer);
    if (expression.styleClasses) {
      resultPromise = resultPromise.then((result: T) =>
        renderer.renderElement('div', {'class': getClassName('expr', expression)}, result));
    }
    return resultPromise;
  } else if (expression instanceof Notation.ListExpression) {
    let items = expression.items.map((item: Notation.RenderedExpression) =>
      renderAsHTML(item, renderer, options).then((content: T) =>
        renderer.renderElement('li', {}, content)));
    return renderList(items, renderer).then((list: T) =>
      renderer.renderElement(expression.style === '1.' ? 'ol' : 'ul', {'class': getClassName('list', expression)}, list));
  } else if (expression instanceof Notation.TableExpression) {
    let makeCell = (cell: T) => renderer.renderElement('span', {'class': 'table-cell'}, cell);
    let makeTextCell = (text: string) => makeCell(renderer.renderText(text));
    let makeRow = (row: T) => renderer.renderElement('span', {'class': 'table-row'}, row);
    let makeTable = (table: T) => renderer.renderElement('span', {'class': getClassName('table', expression)}, table);
    let isAligned = (expression.hasStyleClass('aligned') || expression.hasStyleClass('proof-grid'));
    let isDefinitionList = expression.hasStyleClass('definitions');
    let isConstruction = expression.hasStyleClass('construction');
    let separator = isConstruction ? makeTextCell('\u00a0|\u00a0') : isAligned ? undefined : makeTextCell('\u00a0');
    let secondarySeparator = isDefinitionList ? makeTextCell('\u00a0\u00a0') : undefined;
    let rows = expression.items.map((row: Notation.RenderedExpression[]) => {
      let cells = row.map((cell: Notation.RenderedExpression) =>
        renderAsHTML(cell, renderer, options).then(makeCell));
      return renderList(cells, renderer, separator, secondarySeparator).then(makeRow);
    });
    return renderList(rows, renderer).then(makeTable);
  } else if (expression instanceof Notation.ParenExpression) {
    resultPromise = expression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
      let body = renderAsHTML(expression.body, renderer, options);
      if (surroundingParenStyle === expression.style) {
        return body;
      } else {
        let openParen: string | undefined = undefined;
        let closeParen: string | undefined = undefined;
        switch (expression.style) {
        case '()':
          openParen = '(';
          closeParen = ')';
          break;
        case '||':
          openParen = closeParen = '|';
          break;
        case '[]':
          openParen = '[';
          closeParen = ']';
          break;
        case '{}':
          openParen = '{';
          closeParen = '}';
          break;
        case '{':
          openParen = '{';
          break;
        case '<>':
          openParen = '〈';
          closeParen = '〉';
          break;
        }
        return body.then((content) => {
          let result = [content];
          if (openParen) {
            result.unshift(renderer.renderText(openParen));
          }
          if (closeParen) {
            result.push(renderer.renderText(closeParen));
          }
          return renderer.concat(result);
        });
      }
    });
  } else if (expression instanceof Notation.OuterParenExpression) {
    if (((expression.left && optionalParenLeft) || (expression.right && optionalParenRight))
        && (expression.minLevel === undefined || optionalParenMaxLevel === undefined || expression.minLevel <= optionalParenMaxLevel)) {
      resultPromise = renderAsHTML(new Notation.ParenExpression(expression.body, optionalParenStyle), renderer, options);
    } else {
      resultPromise = renderAsHTML(expression.body, renderer, options);
    }
  } else if (expression instanceof Notation.InnerParenExpression) {
    resultPromise = renderAsHTML(expression.body, renderer, options, expression.left, expression.right, expression.maxLevel);
  } else if (expression instanceof Notation.SubSupExpression) {
    let items = [renderAsHTML(expression.body, renderer, options)];
    let innerOptions: UnicodeConversionOptions = {
      ...options,
      shrinkMathSpaces: true
    };
    if (expression.sub) {
      items.push(renderAsHTML(expression.sub, renderer, innerOptions).then((sub: T) =>
        renderer.renderElement('sub', {}, sub)));
    }
    if (expression.sup) {
      items.push(renderAsHTML(expression.sup, renderer, innerOptions).then((sup: T) =>
        renderer.renderElement('sup', {}, sup)));
    }
    if (expression.preSub) {
      items.unshift(renderAsHTML(expression.preSub, renderer, innerOptions).then((preSub: T) =>
        renderer.renderElement('sub', {}, preSub)));
    }
    if (expression.preSup) {
      items.unshift(renderAsHTML(expression.preSup, renderer, innerOptions).then((preSup: T) =>
        renderer.renderElement('sup', {}, preSup)));
    }
    resultPromise = renderList(items, renderer);
  } else if (expression instanceof Notation.OverUnderExpression) {
    let items = [renderAsHTML(expression.body, renderer, options)];
    let innerOptions: UnicodeConversionOptions = {
      ...options,
      shrinkMathSpaces: true
    };
    if (expression.under) {
      items.push(renderAsHTML(expression.under, renderer, innerOptions).then((under: T) =>
        renderer.renderElement('sub', {}, under)));
    }
    if (expression.over) {
      items.push(renderAsHTML(expression.over, renderer, innerOptions).then((over: T) =>
        renderer.renderElement('sup', {}, over)));
    }
    resultPromise = renderList(items, renderer);
  } else if (expression instanceof Notation.MarkdownExpression) {
    let result = renderer.renderMarkdown(expression.text);
    return CachedPromise.resolve(renderer.renderElement('div', {'class': getClassName('markdown', expression)}, result));
  } else if (expression instanceof Notation.IndirectExpression) {
    try {
      resultPromise = renderAsHTML(expression.resolve(), renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } catch (error) {
      resultPromise = CachedPromise.resolve(renderer.renderText(`[Error: ${error.message}]`));
    }
  } else if (expression instanceof Notation.PromiseExpression) {
    resultPromise = expression.promise.then((innerExpression: Notation.RenderedExpression) => renderAsHTML(innerExpression, renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle));
  } else if (expression instanceof Notation.DecoratedExpression) {
    resultPromise = renderAsHTML(expression.body, renderer, options);
  } else if (expression.fallback) {
    resultPromise = renderAsHTML(expression.fallback, renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
  } else if (expression instanceof Notation.PlaceholderExpression) {
    return CachedPromise.resolve(renderer.renderText('?'));
  } else {
    let error = expression instanceof Notation.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
    return CachedPromise.resolve(renderer.renderText(`[Error: ${error}]`));
  }
  if (expression.styleClasses) {
    resultPromise = resultPromise.then((result: T) =>
      renderer.renderElement('span', {'class': getClassName('expr', expression)}, result));
  }
  return resultPromise;
}

function getClassName(className: string, expression: Notation.RenderedExpression): string {
  if (expression.styleClasses) {
    for (let styleClass of expression.styleClasses) {
      className += ' ' + styleClass;
    }
  }
  return className;
}

function renderList<T>(items: CachedPromise<T>[], renderer: HTMLRenderer<T>, separator?: T, secondarySeparator?: T): CachedPromise<T> {
  let resultPromise: CachedPromise<T[]> = CachedPromise.resolve([]);
  let index = 0;
  for (let itemPromise of items) {
    let currentSeparator = (secondarySeparator !== undefined && index > 1 ? secondarySeparator : separator);
    resultPromise = resultPromise.then((currentResult: T[]) =>
      itemPromise.then((item: T) =>
        currentResult.length ? (currentSeparator ? currentResult.concat(currentSeparator, item) : currentResult.concat(item)) : [item]));
    index++;
  }
  return resultPromise.then((resultItems: T[]) => renderer.concat(resultItems));
}
