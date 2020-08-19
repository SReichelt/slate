import * as Notation from './notation';
import CachedPromise from '../data/cachedPromise';
import { shrinkMathSpaces } from '../format/common';

const escapeForMarkdown = require('markdown-escape');

export interface RenderAsTextOptions {
  outputMarkdown: boolean;
  singleLine: boolean;
  allowEmptyLines: boolean;
  indent: string;
}

export function renderAsText(expression: Notation.RenderedExpression, options: RenderAsTextOptions, optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number, optionalParenStyle?: string): CachedPromise<string> {
  let result = renderAsTextInternal(expression, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
  if (expression.styleClasses && expression.styleClasses.indexOf('script') >= 0) {
    result = result.then((text: string) => shrinkMathSpaces(text));
  }
  return result;
}

function renderAsTextInternal(expression: Notation.RenderedExpression, options: RenderAsTextOptions, optionalParenLeft: boolean, optionalParenRight: boolean, optionalParenMaxLevel?: number, optionalParenStyle?: string): CachedPromise<string> {
  if (!optionalParenStyle) {
    optionalParenStyle = expression.optionalParenStyle;
  }
  if ((optionalParenLeft || optionalParenRight)
      && optionalParenMaxLevel === undefined
      && (expression instanceof Notation.SubSupExpression || expression instanceof Notation.OverUnderExpression || expression instanceof Notation.FractionExpression || expression instanceof Notation.RadicalExpression)) {
    return renderAsText(new Notation.ParenExpression(expression, optionalParenStyle), options);
  }
  let singleLineOptions: RenderAsTextOptions = options.singleLine ? options : {
    ...options,
    singleLine: true,
    allowEmptyLines: false
  };
  if (expression instanceof Notation.EmptyExpression) {
    return CachedPromise.resolve('');
  } else if (expression instanceof Notation.TextExpression) {
    let text = expression.text;
    if (options.outputMarkdown) {
      text = escapeForMarkdown(text);
      if (expression.styleClasses && expression.styleClasses.indexOf('var') >= 0) {
        text = '_' + text + '_';
      }
    }
    return CachedPromise.resolve(text);
  } else if (expression instanceof Notation.RowExpression) {
    if (expression.items.length === 1) {
      return renderAsText(expression.items[0], singleLineOptions, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else {
      return renderList(expression.items.map((item) => renderAsText(item, singleLineOptions)), '');
    }
  } else if (expression instanceof Notation.ParagraphExpression) {
    let paragraphs = expression.paragraphs.map((item) => {
      let ownIndent = '';
      if (item.styleClasses && (item.styleClasses.indexOf('indented') >= 0 || item.styleClasses.indexOf('display-math') >= 0) && !options.singleLine) {
        ownIndent = options.outputMarkdown ? '\u2007' : '  ';
      }
      let innerOptions: RenderAsTextOptions = {
        ...options,
        indent: options.indent + ownIndent
      };
      return renderAsText(item, innerOptions)
        .then((result) => ownIndent + result);
    });
    return renderList(paragraphs, options.singleLine ? ' ' : (options.allowEmptyLines ? '\n\n' : '\n') + options.indent);
  } else if (expression instanceof Notation.ListExpression) {
    let items = expression.items.map((item: Notation.RenderedExpression, index: number) => {
      let prefix: string;
      if (expression.style instanceof Array) {
        prefix = expression.style[index];
      } else {
        prefix = expression.style.replace('1', (index + 1).toString());
      }
      prefix += ' ';
      let innerOptions: RenderAsTextOptions = {
        ...options,
        allowEmptyLines: false,
        indent: options.indent + ' '.repeat(prefix.length)
      };
      return renderAsText(item, innerOptions).then((text) => prefix + text);
    });
    return renderList(items, options.singleLine ? ', ' : (options.outputMarkdown && expression.style !== '1.' ? '\\\n' : '\n') + options.indent);
  } else if (expression instanceof Notation.TableExpression) {
    let isAligned = (expression.styleClasses && expression.styleClasses.indexOf('aligned') >= 0);
    let isDefinitionList = (expression.styleClasses && expression.styleClasses.indexOf('definitions') >= 0);
    let isConstruction = (expression.styleClasses && expression.styleClasses.indexOf('construction') >= 0);
    let separator = isConstruction ? ' | ' : isAligned ? '' : ' ';
    let secondarySeparator = isDefinitionList ? '  ' : undefined;
    let rows = expression.items.map((row: Notation.RenderedExpression[]) => renderList(row.map((cell) => renderAsText(cell, singleLineOptions)), separator, secondarySeparator));
    return renderList(rows, options.singleLine ? ', ' : (options.outputMarkdown ? '\\\n' : '\n') + options.indent);
  } else if (expression instanceof Notation.ParenExpression) {
    return expression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
      let body = renderAsText(expression.body, singleLineOptions);
      if (surroundingParenStyle === expression.style) {
        return body;
      } else {
        let openParen = '';
        let closeParen = '';
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
        if (options.outputMarkdown) {
          openParen = escapeForMarkdown(openParen);
          closeParen = escapeForMarkdown(closeParen);
        }
        return body.then((text) => openParen + text + closeParen);
      }
    });
  } else if (expression instanceof Notation.OuterParenExpression) {
    if (((expression.left && optionalParenLeft) || (expression.right && optionalParenRight))
        && (expression.minLevel === undefined || optionalParenMaxLevel === undefined || expression.minLevel <= optionalParenMaxLevel)) {
      return renderAsText(new Notation.ParenExpression(expression.body, optionalParenStyle), singleLineOptions);
    } else {
      return renderAsText(expression.body, singleLineOptions);
    }
  } else if (expression instanceof Notation.InnerParenExpression) {
    return renderAsText(expression.body, singleLineOptions, expression.left, expression.right, expression.maxLevel);
  } else if (expression instanceof Notation.MarkdownExpression) {
    return CachedPromise.resolve(expression.text);
  } else if (expression instanceof Notation.IndirectExpression) {
    try {
      return renderAsText(expression.resolve(), options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } catch (error) {
      return CachedPromise.resolve(`[Error: ${error.message}]`);
    }
  } else if (expression instanceof Notation.PromiseExpression) {
    return expression.promise.then((innerExpression: Notation.RenderedExpression) => renderAsText(innerExpression, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle));
  } else if (expression instanceof Notation.DecoratedExpression) {
    return renderAsText(expression.body, options);
  } else if (expression.fallback) {
    return renderAsText(expression.fallback, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
  } else if (expression instanceof Notation.PlaceholderExpression) {
    return CachedPromise.resolve('?');
  } else {
    let error = expression instanceof Notation.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
    return CachedPromise.resolve(`[Error: ${error}]`);
  }
}

function renderList(items: CachedPromise<string>[], separator: string, secondarySeparator?: string): CachedPromise<string> {
  let text = CachedPromise.resolve('');
  let index = 0;
  for (let item of items) {
    let currentSeparator = (secondarySeparator !== undefined && index > 1 ? secondarySeparator : separator);
    text = text.then((resolvedText) => item.then((resolvedItem) => resolvedText ? resolvedItem ? resolvedText + currentSeparator + resolvedItem : resolvedText : resolvedItem));
    index++;
  }
  return text;
}
