import * as Notation from './notation';
import CachedPromise from '../data/cachedPromise';
import { shrinkMathSpaces } from '../format/common';

const escapeForMarkdown = require('markdown-escape');

class ScriptExpression extends Notation.InnerParenExpression {}

export function renderAsText(expression: Notation.RenderedExpression, outputMarkdown: boolean, singleLine: boolean, indent: string = '', optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number, optionalParenStyle?: string): CachedPromise<string> {
  if (!optionalParenStyle) {
    optionalParenStyle = expression.optionalParenStyle;
  }
  if ((optionalParenLeft || optionalParenRight)
      && optionalParenMaxLevel === undefined
      && (expression instanceof Notation.SubSupExpression || expression instanceof Notation.OverUnderExpression || expression instanceof Notation.FractionExpression)) {
    return renderAsText(new Notation.ParenExpression(expression, optionalParenStyle), outputMarkdown, singleLine, indent);
  }
  if (expression instanceof Notation.EmptyExpression) {
    return CachedPromise.resolve('');
  } else if (expression instanceof Notation.TextExpression) {
    let text = expression.text;
    if (outputMarkdown) {
      text = escapeForMarkdown(text);
      if (expression.styleClasses && expression.styleClasses.indexOf('var') >= 0) {
        text = '_' + text + '_';
      }
    }
    return CachedPromise.resolve(text);
  } else if (expression instanceof Notation.RowExpression) {
    if (expression.items.length === 1) {
      return renderAsText(expression.items[0], outputMarkdown, true, undefined, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else {
      return renderList(expression.items.map((item) => renderAsText(item, outputMarkdown, true)), '');
    }
  } else if (expression instanceof Notation.ParagraphExpression) {
    let paragraphs = expression.paragraphs.map((item) => {
      let ownIndent = '';
      if (item.styleClasses && item.styleClasses.indexOf('display-math') >= 0 && !singleLine) {
        ownIndent = outputMarkdown ? '\u2007' : '  ';
      }
      return renderAsText(item, outputMarkdown, singleLine, indent + ownIndent)
        .then((result) => ownIndent + result);
    });
    return renderList(paragraphs, singleLine ? ' ' : '\n\n' + indent);
  } else if (expression instanceof Notation.ListExpression) {
    let items = expression.items.map((item: Notation.RenderedExpression, index: number) => {
      let prefix: string;
      if (expression.style instanceof Array) {
        prefix = expression.style[index];
      } else {
        prefix = expression.style.replace('1', (index + 1).toString());
      }
      return renderAsText(item, outputMarkdown, singleLine, indent).then((text) => prefix + ' ' + text);
    });
    return renderList(items, singleLine ? ', ' : (outputMarkdown && expression.style !== '1.' ? '\\\n' : '\n') + indent);
  } else if (expression instanceof Notation.TableExpression) {
    let isAligned = (expression.styleClasses && expression.styleClasses.indexOf('aligned') >= 0);
    let isDefinitionList = (expression.styleClasses && expression.styleClasses.indexOf('definitions') >= 0);
    let isConstruction = (expression.styleClasses && expression.styleClasses.indexOf('construction') >= 0);
    let separator = isConstruction ? ' | ' : isAligned ? '' : ' ';
    let secondarySeparator = isDefinitionList ? '  ' : undefined;
    let rows = expression.items.map((row: Notation.RenderedExpression[]) => renderList(row.map((cell) => renderAsText(cell, outputMarkdown, true)), separator, secondarySeparator));
    return renderList(rows, singleLine ? ', ' : (outputMarkdown ? '\\\n' : '\n') + indent);
  } else if (expression instanceof Notation.ParenExpression) {
    return expression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
      let body = renderAsText(expression.body, outputMarkdown, true);
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
        if (outputMarkdown) {
          openParen = escapeForMarkdown(openParen);
          closeParen = escapeForMarkdown(closeParen);
        }
        return body.then((text) => openParen + text + closeParen);
      }
    });
  } else if (expression instanceof Notation.OuterParenExpression) {
    if (((expression.left && optionalParenLeft) || (expression.right && optionalParenRight))
        && (expression.minLevel === undefined || optionalParenMaxLevel === undefined || expression.minLevel <= optionalParenMaxLevel)) {
      return renderAsText(new Notation.ParenExpression(expression.body, optionalParenStyle), outputMarkdown, true);
    } else {
      return renderAsText(expression.body, outputMarkdown, true);
    }
  } else if (expression instanceof Notation.InnerParenExpression) {
    let result = renderAsText(expression.body, outputMarkdown, true, undefined, expression.left, expression.right, expression.maxLevel);
    if (expression instanceof ScriptExpression) {
      result = result.then((text: string) => shrinkMathSpaces(text));
    }
    return result;
  } else if (expression instanceof Notation.SubSupExpression) {
    let items: Notation.RenderedExpression[] = [new Notation.InnerParenExpression(expression.body)];
    if (expression.sub) {
      items.push(new Notation.TextExpression('_'));
      items.push(new ScriptExpression(expression.sub));
    }
    if (expression.sup) {
      items.push(new Notation.TextExpression('^'));
      items.push(new ScriptExpression(expression.sup));
    }
    if (expression.preSub) {
      items.unshift(new Notation.TextExpression('_'));
      items.unshift(new ScriptExpression(expression.preSub));
    }
    if (expression.preSup) {
      items.unshift(new Notation.TextExpression('^'));
      items.unshift(new ScriptExpression(expression.preSup));
    }
    return renderAsText(new Notation.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Notation.OverUnderExpression) {
    let items: Notation.RenderedExpression[] = [new Notation.InnerParenExpression(expression.body)];
    if (expression.under) {
      items.push(new Notation.TextExpression('_'));
      items.push(new ScriptExpression(expression.under));
    }
    if (expression.over) {
      items.push(new Notation.TextExpression('^'));
      items.push(new ScriptExpression(expression.over));
    }
    return renderAsText(new Notation.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Notation.FractionExpression) {
    let items: Notation.RenderedExpression[] = [
      new Notation.InnerParenExpression(expression.numerator),
      new Notation.TextExpression('/'),
      new Notation.InnerParenExpression(expression.denominator)
    ];
    return renderAsText(new Notation.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Notation.RadicalExpression) {
    let items: Notation.RenderedExpression[] = [
      new Notation.TextExpression('√'),
      new Notation.InnerParenExpression(expression.radicand)
    ];
    if (expression.degree) {
      items.unshift(new ScriptExpression(expression.degree));
    }
    return renderAsText(new Notation.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Notation.MarkdownExpression) {
    return CachedPromise.resolve(expression.text);
  } else if (expression instanceof Notation.IndirectExpression) {
    try {
      return renderAsText(expression.resolve(), outputMarkdown, singleLine, indent, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } catch (error) {
      return CachedPromise.resolve(`[Error: ${error.message}]`);
    }
  } else if (expression instanceof Notation.PromiseExpression) {
    return expression.promise.then((innerExpression: Notation.RenderedExpression) => renderAsText(innerExpression, outputMarkdown, singleLine, indent, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle));
  } else if (expression instanceof Notation.DecoratedExpression) {
    return renderAsText(expression.body, outputMarkdown, singleLine, indent);
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
