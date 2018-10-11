import * as Display from './display';
import CachedPromise from '../data/cachedPromise';

export function renderAsText(expression: Display.RenderedExpression): CachedPromise<string> {
  return renderAsTextInternal(expression, false, false, undefined);
}

function renderAsTextInternal(expression: Display.RenderedExpression, optionalParenLeft: boolean, optionalParenRight: boolean, optionalParenMaxLevel: number | undefined): CachedPromise<string> {
  if (expression instanceof Display.EmptyExpression) {
    return CachedPromise.resolve('\u200b');
  } else if (expression instanceof Display.TextExpression) {
    return CachedPromise.resolve(expression.text);
  } else if (expression instanceof Display.RowExpression) {
    return renderList(expression.items.map(renderAsText), '');
  } else if (expression instanceof Display.ParagraphExpression) {
    return renderList(expression.paragraphs.map(renderAsText), '\n\n');
  } else if (expression instanceof Display.ListExpression) {
    let items = expression.items.map((item: Display.RenderedExpression, index: number) => {
      let prefix = expression.style.replace('1', index.toString());
      return renderAsText(item).then((text) => prefix + ' ' + text);
    });
    return renderList(items, '\n');
  } else if (expression instanceof Display.AlignedExpression) {
    let items = expression.items.map((item: Display.RenderedExpressionPair) => renderAsText(item.left).then((left) => renderAsText(item.right).then((right) => left + ' ' + right)));
    return renderList(items, '\n');
  } else if (expression instanceof Display.ParenExpression) {
    return expression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
      let body = renderAsText(expression.body);
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
        return body.then((text) => openParen + text + closeParen);
      }
    });
  } else if (expression instanceof Display.OuterParenExpression) {
    if (((expression.left && optionalParenLeft) || (expression.right && optionalParenRight))
        && (expression.minLevel === undefined || optionalParenMaxLevel === undefined || expression.minLevel <= optionalParenMaxLevel)) {
      return renderAsText(new Display.ParenExpression(expression.body, expression.optionalParenStyle));
    } else {
      return renderAsText(expression.body);
    }
  } else if (expression instanceof Display.InnerParenExpression) {
    return renderAsTextInternal(expression.body, expression.left, expression.right, expression.maxLevel);
  } else if (expression instanceof Display.SubSupExpression) {
    let items: Display.RenderedExpression[] = [expression.body];
    if (expression.sub) {
      items.push(new Display.TextExpression('_'));
      items.push(new Display.InnerParenExpression(expression.sub));
    }
    if (expression.sup) {
      items.push(new Display.TextExpression('^'));
      items.push(new Display.InnerParenExpression(expression.sup));
    }
    if (expression.preSub) {
      items.unshift(new Display.TextExpression('_'));
      items.unshift(new Display.InnerParenExpression(expression.preSub));
    }
    if (expression.preSup) {
      items.unshift(new Display.TextExpression('^'));
      items.unshift(new Display.InnerParenExpression(expression.preSup));
    }
    return renderAsText(new Display.RowExpression(items));
  } else if (expression instanceof Display.OverUnderExpression) {
    let items: Display.RenderedExpression[] = [new Display.InnerParenExpression(expression.body)];
    if (expression.under) {
      items.push(new Display.TextExpression('_'));
      items.push(new Display.InnerParenExpression(expression.under));
    }
    if (expression.over) {
      items.push(new Display.TextExpression('^'));
      items.push(new Display.InnerParenExpression(expression.over));
    }
    return renderAsText(new Display.RowExpression(items));
  } else if (expression instanceof Display.TableExpression) {
    let rows = expression.items.map((row: Display.RenderedExpression[]) => renderList(row.map(renderAsText), ' '));
    return renderList(rows, ', ');
  } else if (expression instanceof Display.FractionExpression) {
    let items: Display.RenderedExpression[] = [
      new Display.InnerParenExpression(expression.numerator),
      new Display.TextExpression('/'),
      new Display.InnerParenExpression(expression.denominator)
    ];
    let resultExpression: Display.RenderedExpression = new Display.RowExpression(items);
    if (optionalParenLeft || optionalParenRight) {
      resultExpression = new Display.ParenExpression(resultExpression, expression.optionalParenStyle);
    }
    return renderAsText(resultExpression);
  } else if (expression instanceof Display.RadicalExpression) {
    let items: Display.RenderedExpression[] = [
      new Display.TextExpression('√'),
      new Display.InnerParenExpression(expression.radicand)
    ];
    if (expression.degree) {
      items.unshift(new Display.InnerParenExpression(expression.degree));
    }
    let resultExpression: Display.RenderedExpression = new Display.RowExpression(items);
    if (optionalParenLeft || optionalParenRight) {
      resultExpression = new Display.ParenExpression(resultExpression, expression.optionalParenStyle);
    }
    return renderAsText(resultExpression);
  } else if (expression instanceof Display.MarkdownExpression) {
    return CachedPromise.resolve(expression.text);
  } else if (expression instanceof Display.IndirectExpression) {
    try {
      return renderAsTextInternal(expression.resolve(), optionalParenLeft, optionalParenRight, optionalParenMaxLevel);
    } catch (error) {
      return CachedPromise.resolve(`Error: ${error.message}`);
    }
  } else if (expression instanceof Display.PromiseExpression) {
    return expression.promise.then((innerExpression: Display.RenderedExpression) => renderAsTextInternal(innerExpression, optionalParenLeft, optionalParenRight, optionalParenMaxLevel));
  } else if (expression instanceof Display.DecoratedExpression) {
    return renderAsText(expression.body);
  } else {
    let error = expression instanceof Display.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
    return CachedPromise.resolve(`Error: ${error}`);
  }
}

function renderList(items: CachedPromise<string>[], separator: string): CachedPromise<string> {
  let text = CachedPromise.resolve('');
  for (let item of items) {
    text = text.then((resolvedText) => item.then((resolvedItem) => resolvedText ? resolvedText + separator + resolvedItem : resolvedItem));
  }
  return text;
}
