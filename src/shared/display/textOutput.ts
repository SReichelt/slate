import * as Display from './display';
import CachedPromise from '../data/cachedPromise';
import { shrinkMathSpaces } from '../format/common';

const escapeForMarkdown = require('markdown-escape');

class ScriptExpression extends Display.InnerParenExpression {}

export function renderAsText(expression: Display.RenderedExpression, outputMarkdown: boolean, singleLine: boolean, optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number, optionalParenStyle?: string): CachedPromise<string> {
  if (!optionalParenStyle) {
    optionalParenStyle = expression.optionalParenStyle;
  }
  if ((optionalParenLeft || optionalParenRight)
      && optionalParenMaxLevel === undefined
      && (expression instanceof Display.SubSupExpression || expression instanceof Display.OverUnderExpression || expression instanceof Display.FractionExpression)) {
    return renderAsText(new Display.ParenExpression(expression, optionalParenStyle), outputMarkdown, singleLine);
  }
  if (expression instanceof Display.EmptyExpression) {
    return CachedPromise.resolve('');
  } else if (expression instanceof Display.TextExpression) {
    let text = expression.text;
    if (outputMarkdown) {
      text = escapeForMarkdown(text);
      if (expression.styleClasses && expression.styleClasses.indexOf('var') >= 0) {
        text = '_' + text + '_';
      }
    }
    return CachedPromise.resolve(text);
  } else if (expression instanceof Display.RowExpression) {
    if (expression.items.length === 1) {
      return renderAsText(expression.items[0], outputMarkdown, true, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else {
      return renderList(expression.items.map((item) => renderAsText(item, outputMarkdown, true)), '');
    }
  } else if (expression instanceof Display.ParagraphExpression) {
    return renderList(expression.paragraphs.map((item) => renderAsText(item, outputMarkdown, singleLine)), singleLine ? ' ' : '\n\n');
  } else if (expression instanceof Display.ListExpression) {
    let items = expression.items.map((item: Display.RenderedExpression, index: number) => {
      let prefix: string;
      if (expression.style instanceof Array) {
        prefix = expression.style[index];
      } else {
        prefix = expression.style.replace('1', (index + 1).toString());
      }
      return renderAsText(item, outputMarkdown, singleLine).then((text) => prefix + ' ' + text);
    });
    return renderList(items, singleLine ? ', ' : outputMarkdown && expression.style !== '1.' ? '\\\n' : '\n');
  } else if (expression instanceof Display.TableExpression) {
    let isConstruction = (expression.styleClasses && expression.styleClasses.indexOf('construction') >= 0);
    let isAligned = (expression.styleClasses && expression.styleClasses.indexOf('aligned') >= 0);
    let separator = isConstruction ? ' | ' : isAligned ? '' : ' ';
    let rows = expression.items.map((row: Display.RenderedExpression[]) => renderList(row.map((cell) => renderAsText(cell, outputMarkdown, true)), separator));
    return renderList(rows, singleLine ? ', ' : outputMarkdown ? '\\\n' : '\n');
  } else if (expression instanceof Display.ParenExpression) {
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
  } else if (expression instanceof Display.OuterParenExpression) {
    if (((expression.left && optionalParenLeft) || (expression.right && optionalParenRight))
        && (expression.minLevel === undefined || optionalParenMaxLevel === undefined || expression.minLevel <= optionalParenMaxLevel)) {
      return renderAsText(new Display.ParenExpression(expression.body, optionalParenStyle), outputMarkdown, true);
    } else {
      return renderAsText(expression.body, outputMarkdown, true);
    }
  } else if (expression instanceof Display.InnerParenExpression) {
    let result = renderAsText(expression.body, outputMarkdown, true, expression.left, expression.right, expression.maxLevel);
    if (expression instanceof ScriptExpression) {
      result = result.then((text: string) => shrinkMathSpaces(text));
    }
    return result;
  } else if (expression instanceof Display.SubSupExpression) {
    let items: Display.RenderedExpression[] = [new Display.InnerParenExpression(expression.body)];
    if (expression.sub) {
      items.push(new Display.TextExpression('_'));
      items.push(new ScriptExpression(expression.sub));
    }
    if (expression.sup) {
      items.push(new Display.TextExpression('^'));
      items.push(new ScriptExpression(expression.sup));
    }
    if (expression.preSub) {
      items.unshift(new Display.TextExpression('_'));
      items.unshift(new ScriptExpression(expression.preSub));
    }
    if (expression.preSup) {
      items.unshift(new Display.TextExpression('^'));
      items.unshift(new ScriptExpression(expression.preSup));
    }
    return renderAsText(new Display.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Display.OverUnderExpression) {
    let items: Display.RenderedExpression[] = [new Display.InnerParenExpression(expression.body)];
    if (expression.under) {
      items.push(new Display.TextExpression('_'));
      items.push(new ScriptExpression(expression.under));
    }
    if (expression.over) {
      items.push(new Display.TextExpression('^'));
      items.push(new ScriptExpression(expression.over));
    }
    return renderAsText(new Display.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Display.FractionExpression) {
    let items: Display.RenderedExpression[] = [
      new Display.InnerParenExpression(expression.numerator),
      new Display.TextExpression('/'),
      new Display.InnerParenExpression(expression.denominator)
    ];
    return renderAsText(new Display.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Display.RadicalExpression) {
    let items: Display.RenderedExpression[] = [
      new Display.TextExpression('√'),
      new Display.InnerParenExpression(expression.radicand)
    ];
    if (expression.degree) {
      items.unshift(new ScriptExpression(expression.degree));
    }
    return renderAsText(new Display.RowExpression(items), outputMarkdown, true);
  } else if (expression instanceof Display.MarkdownExpression) {
    return CachedPromise.resolve(expression.text);
  } else if (expression instanceof Display.IndirectExpression) {
    try {
      return renderAsText(expression.resolve(), outputMarkdown, singleLine, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } catch (error) {
      return CachedPromise.resolve(`[Error: ${error.message}]`);
    }
  } else if (expression instanceof Display.PromiseExpression) {
    return expression.promise.then((innerExpression: Display.RenderedExpression) => renderAsText(innerExpression, outputMarkdown, singleLine, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle));
  } else if (expression instanceof Display.DecoratedExpression) {
    return renderAsText(expression.body, outputMarkdown, singleLine);
  } else if (expression instanceof Display.PlaceholderExpression) {
    return CachedPromise.resolve('?');
  } else {
    let error = expression instanceof Display.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
    return CachedPromise.resolve(`[Error: ${error}]`);
  }
}

function renderList(items: CachedPromise<string>[], separator: string): CachedPromise<string> {
  let text = CachedPromise.resolve('');
  for (let item of items) {
    text = text.then((resolvedText) => item.then((resolvedItem) => resolvedItem ? resolvedText ? resolvedText + separator + resolvedItem : resolvedItem : resolvedText));
  }
  return text;
}
