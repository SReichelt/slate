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
  if (expression instanceof Notation.EmptyExpression) {
    return CachedPromise.resolve(renderer.concat([]));
  } else if (expression instanceof Notation.TextExpression) {
    let unicodeConverter = new HTMLUnicodeConverter(renderer);
    convertUnicode(expression.text, unicodeConverter, options);
    let result = unicodeConverter.result.length === 1 ? unicodeConverter.result[0] : renderer.concat(unicodeConverter.result);
    if (expression.hasStyleClass('var') && useItalicsForVariable(expression.text)) {
      result = renderer.renderElement('em', {}, result);
    }
    return CachedPromise.resolve(result);
  } else if (expression instanceof Notation.RowExpression) {
    if (expression.items.length === 1) {
      return renderAsHTML(expression.items[0], renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else {
      return renderList(expression.items.map((item) => renderAsHTML(item, renderer, options)), renderer);
    }
  } else if (expression instanceof Notation.ParagraphExpression) {
    let paragraphs = expression.paragraphs.map((item: Notation.RenderedExpression) => {
      let attrs: HTMLAttributes = {};
      if (item.hasStyleClass('indented') || item.hasStyleClass('display-math')) {
        attrs['class'] = 'indented';
      }
      return renderAsHTML(item, renderer, options).then((content: T) =>
        renderer.renderElement('p', attrs, content));
    });
    return renderList(paragraphs, renderer);
  } else if (expression instanceof Notation.ListExpression) {
    let items = expression.items.map((item: Notation.RenderedExpression) =>
      renderAsHTML(item, renderer, options).then((content: T) =>
        renderer.renderElement('li', {}, content)));
    return renderList(items, renderer).then((list: T) =>
      renderer.renderElement(expression.style === '1.' ? 'ol' : 'ul', {}, list));
  } else if (expression instanceof Notation.TableExpression) {
    let isAligned = ((expression.hasStyleClass('aligned') || expression.hasStyleClass('proof-grid')));
    let isDefinitionList = expression.hasStyleClass('definitions');
    let isConstruction = expression.hasStyleClass('construction');
    let separator = isConstruction ? ' | ' : isAligned ? '' : ' ';
    let secondarySeparator = isDefinitionList ? '  ' : undefined;
    let rows = expression.items.map((row: Notation.RenderedExpression[]) =>
      renderList(row.map((cell) => renderAsHTML(cell, renderer, options)), renderer, separator, secondarySeparator));
    return renderList(rows, renderer, ', ');
  } else if (expression instanceof Notation.ParenExpression) {
    return expression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
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
      return renderAsHTML(new Notation.ParenExpression(expression.body, optionalParenStyle), renderer, options);
    } else {
      return renderAsHTML(expression.body, renderer, options);
    }
  } else if (expression instanceof Notation.InnerParenExpression) {
    return renderAsHTML(expression.body, renderer, options, expression.left, expression.right, expression.maxLevel);
  } else if (expression instanceof Notation.MarkdownExpression) {
    return CachedPromise.resolve(renderer.renderMarkdown(expression.text));
  } else if (expression instanceof Notation.IndirectExpression) {
    try {
      return renderAsHTML(expression.resolve(), renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } catch (error) {
      return CachedPromise.resolve(renderer.renderText(`[Error: ${error.message}]`));
    }
  } else if (expression instanceof Notation.PromiseExpression) {
    return expression.promise.then((innerExpression: Notation.RenderedExpression) => renderAsHTML(innerExpression, renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle));
  } else if (expression instanceof Notation.DecoratedExpression) {
    return renderAsHTML(expression.body, renderer, options);
  } else if (expression.fallback) {
    return renderAsHTML(expression.fallback, renderer, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
  } else if (expression instanceof Notation.PlaceholderExpression) {
    return CachedPromise.resolve(renderer.renderText('?'));
  } else {
    let error = expression instanceof Notation.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
    return CachedPromise.resolve(renderer.renderText(`[Error: ${error}]`));
  }
}

function renderList<T>(items: CachedPromise<T>[], renderer: HTMLRenderer<T>, separator?: string, secondarySeparator?: string): CachedPromise<T> {
  let resultPromise: CachedPromise<T[]> = CachedPromise.resolve([]);
  let index = 0;
  for (let itemPromise of items) {
    let currentSeparator = (secondarySeparator !== undefined && index > 1 ? secondarySeparator : separator);
    resultPromise = resultPromise.then((currentResult: T[]) =>
      itemPromise.then((item: T) =>
        currentResult.length ? (currentSeparator ? currentResult.concat(renderer.renderText(currentSeparator), item) : currentResult.concat(item)) : [item]));
    index++;
  }
  return resultPromise.then((resultItems: T[]) => renderer.concat(resultItems));
}
