import * as Notation from './notation';
import CachedPromise from '../data/cachedPromise';
import { shrinkMathSpaces, useItalicsForVariable } from './unicode';

const escapeForMarkdown = require('markdown-escape');

export interface RenderAsTextOptions {
  outputMarkdown: boolean;
  singleLine: boolean;
  allowEmptyLines: boolean;
  indent?: string;
  shrinkMathSpaces?: boolean;
}

export function renderAsText(expression: Notation.RenderedExpression, options: RenderAsTextOptions, optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number, optionalParenStyle?: string): CachedPromise<string> {
  if (!optionalParenStyle) {
    optionalParenStyle = expression.optionalParenStyle;
  }
  const indent = options.indent ?? '';
  if (expression.hasStyleClass('script')) {
    options = {
      ...options,
      shrinkMathSpaces: true
    };
  }
  const singleLineOptions: RenderAsTextOptions = options.singleLine ? options : {
    ...options,
    singleLine: true,
    allowEmptyLines: false
  };
  if (expression instanceof Notation.EmptyExpression) {
    return CachedPromise.resolve('');
  } else if (expression instanceof Notation.TextExpression) {
    let text = expression.text;
    if (options.shrinkMathSpaces) {
      text = shrinkMathSpaces(text);
    }
    if (options.outputMarkdown) {
      text = escapeForMarkdown(text);
      if (expression.hasStyleClass('var') && useItalicsForVariable(expression.text)) {
        text = '_' + text + '_';
      }
    }
    return CachedPromise.resolve(text);
  } else if (expression instanceof Notation.RowExpression) {
    if (expression.items.length === 1) {
      return renderAsText(expression.items[0], singleLineOptions, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else {
      return renderList(expression.items.map((item) => renderAsText(item, singleLineOptions)));
    }
  } else if (expression instanceof Notation.ParagraphExpression) {
    const paragraphs = expression.paragraphs.map((item: Notation.RenderedExpression) => {
      let ownIndent = '';
      if ((item.hasStyleClass('indented') || item.hasStyleClass('display-math')) && !options.singleLine) {
        ownIndent = options.outputMarkdown ? '\u2007' : '  ';
      }
      const innerOptions: RenderAsTextOptions = {
        ...options,
        indent: indent + ownIndent
      };
      return renderAsText(item, innerOptions)
        .then((result) => ownIndent + result);
    });
    return renderList(paragraphs, options.singleLine ? ' ' : (options.allowEmptyLines ? '\n\n' : '\n') + indent);
  } else if (expression instanceof Notation.ListExpression) {
    const items = expression.items.map((item: Notation.RenderedExpression, index: number) => {
      let prefix: string;
      if (expression.style instanceof Array) {
        prefix = expression.style[index];
      } else {
        prefix = expression.style.replace('1', (index + 1).toString());
      }
      prefix += ' ';
      const innerOptions: RenderAsTextOptions = {
        ...options,
        allowEmptyLines: false,
        indent: indent + ' '.repeat(prefix.length)
      };
      return renderAsText(item, innerOptions).then((text) => prefix + text);
    });
    return renderList(items, options.singleLine ? ', ' : (options.outputMarkdown && expression.style !== '1.' ? '\\\n' : '\n') + indent);
  } else if (expression instanceof Notation.TableExpression) {
    const isAligned = (expression.hasStyleClass('aligned') || expression.hasStyleClass('proof-grid'));
    const isDefinitionList = expression.hasStyleClass('definitions');
    const isConstruction = expression.hasStyleClass('construction');
    const separator = isConstruction ? ' | ' : isAligned ? '' : ' ';
    const secondarySeparator = isDefinitionList ? '  ' : undefined;
    const rows = expression.items.map((row: Notation.RenderedExpression[]) =>
      renderList(row.map((cell) => renderAsText(cell, singleLineOptions)), separator, secondarySeparator));
    return renderList(rows, options.singleLine ? ', ' : (options.outputMarkdown ? '\\\n' : '\n') + indent);
  } else if (expression instanceof Notation.ParenExpression) {
    return expression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
      const body = renderAsText(expression.body, singleLineOptions);
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
  } else if (expression instanceof Notation.AssociativeExpression) {
    return renderAsText(expression.body, options);
  } else if (expression.fallback) {
    return renderAsText(expression.fallback, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
  } else if (expression instanceof Notation.AbstractDecoratedExpression) {
    return renderAsText(expression.body, options, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
  } else if (expression instanceof Notation.PlaceholderExpression) {
    return CachedPromise.resolve('?');
  } else {
    const error = expression instanceof Notation.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
    return CachedPromise.resolve(`[Error: ${error}]`);
  }
}

function renderList(items: CachedPromise<string>[], separator: string = '', secondarySeparator?: string): CachedPromise<string> {
  let resultPromise = CachedPromise.resolve('');
  let index = 0;
  for (const itemPromise of items) {
    const currentSeparator = (secondarySeparator !== undefined && index > 1 ? secondarySeparator : separator);
    resultPromise = resultPromise.then((currentResult: string) =>
      itemPromise.then((item: string) =>
        currentResult ? (item ? currentResult + currentSeparator + item : currentResult) : item));
    index++;
  }
  return resultPromise;
}
