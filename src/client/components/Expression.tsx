import * as React from 'react';
import './Expression.css';
import * as Display from '../../shared/display/display';
import renderPromise from './PromiseHelper';
import * as ReactMarkdown from 'react-markdown';

const ToolTip = require('react-portal-tooltip').default;

export interface ExpressionInteractionHandler {
  getURI(semanticLink: Display.SemanticLink): string | undefined;
  linkClicked(semanticLink: Display.SemanticLink): void;
  hasPreview(semanticLink: Display.SemanticLink): boolean;
  getPreviewContents(semanticLink: Display.SemanticLink): any;
}

let previewContents: any = null;

interface ExpressionProps {
  expression: Display.RenderedExpression;
  parent?: Expression;
  interactionHandler?: ExpressionInteractionHandler;
  hover?: Display.SemanticLink;
}

interface ExpressionState {
  ownHover?: Display.SemanticLink;
  showPreview: boolean;
}

class Expression extends React.Component<ExpressionProps, ExpressionState> {
  private interactionHandler?: ExpressionInteractionHandler;
  private htmlNode: HTMLElement | null = null;
  private hover?: Display.SemanticLink;
  private permanentHighlightExpression?: Expression;
  private windowClickListener?: (this: Window, ev: MouseEvent) => any;

  constructor(props: ExpressionProps) {
    super(props);

    this.state = {
      showPreview: false
    };

    if (!props.parent) {
      this.windowClickListener = () => this.setPermanentHighlight(undefined);
    }

    this.updateInteraction(props, false);
  }

  componentDidMount(): void {
    if (this.windowClickListener) {
      window.addEventListener('click', this.windowClickListener);
    }
  }

  componentWillUnmount(): void {
    if (this.windowClickListener) {
      window.removeEventListener('click', this.windowClickListener);
    }
  }

  componentWillReceiveProps(props: ExpressionProps): void {
    this.updateInteraction(props, true);
    if (props.expression !== this.props.expression) {
      this.permanentHighlightExpression = undefined;
    }
  }

  private updateInteraction(props: ExpressionProps, mounted: boolean): void {
    if (props.interactionHandler) {
      this.interactionHandler = props.interactionHandler;
    } else if (props.parent) {
      this.interactionHandler = props.parent.interactionHandler;
    }
    if (props.parent) {
      this.setGlobalHover(props.hover, mounted);
    }
  }

  render(): any {
    return this.renderExpression(this.props.expression, 'expr');
  }

  private renderExpression(expression: Display.RenderedExpression, className: string, semanticLink?: Display.SemanticLink, optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number): any {
    if (expression.styleClasses) {
      for (let styleClass of expression.styleClasses) {
        className += ' ' + styleClass;
      }
    }
    if (!semanticLink) {
      semanticLink = expression.semanticLink;
    }
    let result: any = null;
    if (expression instanceof Display.EmptyExpression) {
      result = '\u200b';
    } else if (expression instanceof Display.TextExpression) {
      let text = expression.text;
      if (text) {
        text = text.replace('  ', ' \xa0');
        if (text.startsWith(' ')) {
          text = '\xa0' + text.substring(1);
        }
        if (text.endsWith(' ')) {
          text = text.substring(0, text.length - 1) + '\xa0';
        }
        let firstChar = text.charAt(0);
        let lastChar = text.charAt(text.length - 1);
        if (firstChar === ' ' || firstChar === '\xa0' || (firstChar >= '\u2000' && firstChar <= '\u200a')) {
          className += ' space-start';
        }
        if (lastChar === 'f' || lastChar === 'C' || lastChar === 'E' || lastChar === 'F' || lastChar === 'H' || lastChar === 'I' || lastChar === 'J' || lastChar === 'K' || lastChar === 'M' || lastChar === 'N' || lastChar === 'S' || lastChar === 'T' || lastChar === 'U' || lastChar === 'V' || lastChar === 'W' || lastChar === 'X' || lastChar === 'Y' || lastChar === 'Z') {
          className += ' charcorner-tr';
          if (lastChar === 'T' || lastChar === 'Y') {
            className += ' charcorner-large';
          }
        }
        if (firstChar === 'f' || firstChar === 'g' || firstChar === 'j' || firstChar === 'y') {
          className += ' charcorner-bl';
        }
        result = this.convertText(text);
      } else {
        result = '\u200b';
      }
    } else if (expression instanceof Display.RowExpression) {
      if (expression.items.length === 1) {
        return this.renderExpression(expression.items[0], className, semanticLink, optionalParenLeft, optionalParenRight, optionalParenMaxLevel);
      } else {
        className += ' row';
        result = expression.items.map((item: Display.RenderedExpression, index: number) =>
          <Expression expression={item} parent={this} hover={this.hover} key={index}/>);
      }
    } else if (expression instanceof Display.ParagraphExpression) {
      className += ' paragraph';
      result = expression.paragraphs.map((paragraph: Display.RenderedExpression, index: number) => {
        let paragraphClassName = className;
        if (paragraph.styleClasses) {
          for (let styleClass of paragraph.styleClasses) {
            paragraphClassName += ' ' + styleClass;
          }
        }
        return (
          <div className={paragraphClassName} key={index}>
            <Expression expression={paragraph} parent={this} hover={this.hover}/>
          </div>
        );
      });
      return result;
    } else if (expression instanceof Display.ListExpression) {
      className += ' list';
      let items = expression.items.map((item: Display.RenderedExpression, index: number) => (
        <li className={'list-item'} key={index}>
          <Expression expression={item} parent={this} hover={this.hover}/>
        </li>
      ));
      switch (expression.style) {
      case '1.':
        result = (
          <ol className={className}>
            {items}
          </ol>
        );
        break;
      default:
        result = (
          <ul className={className}>
            {items}
          </ul>
        );
        break;
      }
      return result;
    } else if (expression instanceof Display.AlignedExpression) {
      className += ' aligned';
      result = expression.items.map((item: Display.RenderedExpressionPair, index: number) => (
        <span className={'aligned-row'} key={index}>
          <span className={'aligned-left'} key={'left'}>
            <Expression expression={item.left} parent={this} hover={this.hover}/>
          </span>
          <span className={'aligned-right'} key={'right'}>
            <Expression expression={item.right} parent={this} hover={this.hover}/>
          </span>
        </span>
      ));
    } else if (expression instanceof Display.ParenExpression) {
      className += ' paren';
      let parenExpression = expression;
      let render = parenExpression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
        if (surroundingParenStyle === parenExpression.style) {
          return this.renderExpression(parenExpression.body, className, semanticLink);
        } else {
          return parenExpression.body.getLineHeight().then((lineHeight: number) => {
            let parenResult: any = <Expression expression={parenExpression.body} parent={this} hover={this.hover} key="body"/>;
            let handled = false;
            let openParen = '';
            let closeParen = '';
            let parenClassName = 'paren-text';
            switch (parenExpression.style) {
            case '()':
              openParen = '(';
              closeParen = ')';
              if (lineHeight) {
                parenClassName = 'paren-round-text';
              } else {
                parenResult = (
                  <span className={'paren-round'}>
                    {parenResult}
                  </span>
                );
                handled = true;
              }
              break;
            case '||':
              openParen = closeParen = '∣';
              if (lineHeight) {
                parenClassName = 'paren-flat-text';
              } else {
                parenResult = (
                  <span className={'paren-flat'}>
                    {parenResult}
                  </span>
                );
                handled = true;
              }
              break;
            case '[]':
              openParen = '[';
              closeParen = ']';
              if (lineHeight) {
                parenClassName = 'paren-square-text';
              } else {
                parenResult = (
                  <span className={'paren-square'}>
                    <span className={'paren-square-row'}>
                      <span className={'paren-square-left'}/>
                      <span className={'paren-square-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-square-right'}/>
                    </span>
                  </span>
                );
                handled = true;
              }
              break;
            case '{}':
              openParen = '{';
              closeParen = '}';
              if (lineHeight) {
                parenClassName = 'paren-curly-text';
              } else {
                parenResult = (
                  <span className={'paren-curly'}>
                    <span className={'paren-curly-row'}>
                      <span className={'paren-curly-left'}>
                        <svg viewBox="0 0 1 10" preserveAspectRatio="none">
                          <path d="M 0.9 0.1 Q 0.5 0.1 0.5 1 L 0.5 4 Q 0.5 5 0.1 5 Q 0.5 5 0.5 6 L 0.5 9 Q 0.5 9.9 0.9 9.9" y2="0" stroke="black" strokeWidth="0.2" strokeLinecap="square" fill="transparent"/>
                        </svg>
                      </span>
                      <span className={'paren-curly-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-curly-right'}>
                        <svg viewBox="0 0 1 10" preserveAspectRatio="none">
                          <path d="M 0.1 0.1 Q 0.5 0.1 0.5 1 L 0.5 4 Q 0.5 5 0.9 5 Q 0.5 5 0.5 6 L 0.5 9 Q 0.5 9.9 0.1 9.9" y2="0" stroke="black" strokeWidth="0.2" strokeLinecap="square" fill="transparent"/>
                        </svg>
                      </span>
                    </span>
                  </span>
                );
                handled = true;
              }
              break;
            case '{':
              openParen = '{';
              if (optionalParenRight) {
                closeParen = '∣';
              }
              if (lineHeight) {
                parenClassName = 'paren-curly-text';
              } else {
                let bodyClassName = 'paren-curly-body';
                if (optionalParenRight) {
                  bodyClassName += ' paren-right-hairline';
                }
                parenResult = (
                  <span className={'paren-curly'}>
                    <span className={'paren-curly-row'}>
                      <span className={'paren-curly-left'}>
                        <svg viewBox="0 0 1 10" preserveAspectRatio="none">
                          <path d="M 0.9 0.1 Q 0.5 0.1 0.5 1 L 0.5 4 Q 0.5 5 0.1 5 Q 0.5 5 0.5 6 L 0.5 9 Q 0.5 9.9 0.9 9.9" y2="0" stroke="black" strokeWidth="0.2" strokeLinecap="square" fill="transparent"/>
                        </svg>
                      </span>
                      <span className={bodyClassName}>
                        {parenResult}
                      </span>
                    </span>
                  </span>
                );
                handled = true;
              }
              break;
            case '<>':
              openParen = '〈';
              closeParen = '〉';
              if (lineHeight) {
                parenClassName = 'paren-angle-text';
              } else {
                parenResult = (
                  <span className={'paren-angle'}>
                    <span className={'paren-angle-row'}>
                      <span className={'paren-angle-left'}>
                        <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                          <path d="M 0.9 0 L 0.1 0.5 L 0.9 1" y2="0" stroke="black" strokeWidth="0.1" strokeLinecap="square" fill="transparent"/>
                        </svg>
                      </span>
                      <span className={'paren-angle-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-angle-right'}>
                        <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                          <path d="M 0.1 0 L 0.9 0.5 L 0.1 1" y2="0" stroke="black" strokeWidth="0.1" strokeLinecap="square" fill="transparent"/>
                        </svg>
                      </span>
                    </span>
                  </span>
                );
                handled = true;
              }
              break;
            }
            if (!handled) {
              let heightClassName = 'height';
              for (let i = 1; i <= lineHeight; i++) {
                heightClassName += ' height-' + i;
              }
              parenResult = [
                <span className={parenClassName} key="open"><span className={heightClassName}>{openParen}</span></span>,
                parenResult,
                <span className={parenClassName} key="close"><span className={heightClassName}>{closeParen}</span></span>
              ];
            }
            return parenResult;
          });
        }
      });
      result = renderPromise(render);
    } else if (expression instanceof Display.OuterParenExpression) {
      if (((expression.left && optionalParenLeft) || (expression.right && optionalParenRight))
          && (expression.minLevel === undefined || optionalParenMaxLevel === undefined || expression.minLevel <= optionalParenMaxLevel)) {
        return this.renderExpression(new Display.ParenExpression(expression.body, expression.optionalParenStyle), className, semanticLink);
      } else {
        return this.renderExpression(expression.body, className, semanticLink);
      }
    } else if (expression instanceof Display.InnerParenExpression) {
      return this.renderExpression(expression.body, className, semanticLink, expression.left, expression.right, expression.maxLevel);
    } else if (expression instanceof Display.SubSupExpression) {
      let subSupExpression = expression;
      let render = expression.body.getLineHeight().then((lineHeight: number) => {
        let subSupResult: any = [<Expression expression={subSupExpression.body} parent={this} hover={this.hover} key="body"/>];
        if (lineHeight && !(expression.sub && expression.sup) && !(expression.preSub && expression.preSup)) {
          if (subSupExpression.sub) {
            subSupResult.push(<sub key="sub"><Expression expression={subSupExpression.sub} parent={this} hover={this.hover}/></sub>);
          }
          if (subSupExpression.sup) {
            subSupResult.push(<sup key="sup"><Expression expression={subSupExpression.sup} parent={this} hover={this.hover}/></sup>);
          }
          if (subSupExpression.preSub) {
            subSupResult.unshift(<sub key="preSub"><Expression expression={subSupExpression.preSub} parent={this} hover={this.hover}/></sub>);
          }
          if (subSupExpression.preSup) {
            subSupResult.unshift(<sup key="preSup"><Expression expression={subSupExpression.preSup} parent={this} hover={this.hover}/></sup>);
          }
        } else {
          let empty = <span className={'subsup-empty'} key="empty"/>;
          let rightSub = null;
          let rightSup = null;
          if (subSupExpression.sub) {
            rightSub = (
              <span className={'subsup-right-sub'} key="sub">
                <Expression expression={subSupExpression.sub} parent={this} hover={this.hover}/>
              </span>
            );
          }
          if (subSupExpression.sup) {
            rightSup = (
              <span className={'subsup-right-sup'} key="sup">
                <Expression expression={subSupExpression.sup} parent={this} hover={this.hover}/>
              </span>
            );
          }
          let leftSub = null;
          let leftSup = null;
          if (subSupExpression.preSub) {
            leftSub = (
              <span className={'subsup-left-sub'} key="sub">
                <Expression expression={subSupExpression.preSub} parent={this} hover={this.hover}/>
              </span>
            );
          }
          if (subSupExpression.preSup) {
            leftSup = (
              <span className={'subsup-left-sup'} key="sup">
                <Expression expression={subSupExpression.preSup} parent={this} hover={this.hover}/>
              </span>
            );
          }
          if (lineHeight) {
            subSupResult = [subSupResult];
            if (leftSup || leftSub) {
              subSupResult.unshift(
                <span className={'subsup'} key="left">
                  <span className={'subsup-sup-row'} key="sup">
                    {leftSup ? leftSup : empty}
                  </span>
                  <span className={'subsup-sub-row'} key="sub">
                    {leftSub ? leftSub : empty}
                  </span>
                </span>
              );
            }
            if (rightSup || rightSub) {
              subSupResult.push(
                <span className={'subsup'} key="right">
                  <span className={'subsup-sup-row'} key="sup">
                    {rightSup ? rightSup : empty}
                  </span>
                  <span className={'subsup-sub-row'} key="sub">
                    {rightSub ? rightSub : empty}
                  </span>
                </span>
              );
            }
          } else {
            subSupResult = (
              <span className={'subsup subsup-full'}>
                <span className={'subsup-sup-row subsup-full-row'} key="sup">
                  {leftSup || leftSub ? leftSup || empty : null}
                  <span className={'subsup-empty'} key="middle"/>
                  {rightSup || rightSub ? rightSup || empty : null}
                </span>
                <span className={'subsup-body-row'} key="body">
                  {leftSup || leftSub ? empty : null}
                  <span className={'subsup-body'} key="middle">
                    {subSupResult}
                  </span>
                  {rightSup || rightSub ? empty : null}
                </span>
                <span className={'subsup-sub-row subsup-full-row'} key="sub">
                  {leftSup || leftSub ? leftSub || empty : null}
                  <span className={'subsup-empty'} key="middle"/>
                  {rightSup || rightSub ? rightSub || empty : null}
                </span>
              </span>
            );
          }
        }
        return subSupResult;
      });
      result = renderPromise(render);
    } else if (expression instanceof Display.OverUnderExpression) {
      className += ' overunder';
      let over: any = expression.over ? <Expression expression={expression.over} parent={this} hover={this.hover}/> : null;
      let under: any = expression.under ? <Expression expression={expression.under} parent={this} hover={this.hover}/> : null;
      result = [
        (
          <span className={'overunder-over-row'} key="over">
            <span className={'overunder-over'}>
              {over}
            </span>
          </span>
        ),
        (
          <span className={'overunder-body-row'} key="body">
            <span className={'overunder-body'}>
              <Expression expression={expression.body} parent={this} hover={this.hover}/>
            </span>
          </span>
        ),
        (
          <span className={'overunder-under-row'} key="under">
            <span className={'overunder-under'}>
              {under}
            </span>
          </span>
        )
      ];
    } else if (expression instanceof Display.TableExpression) {
      className += ' table';
      result = expression.items.map((row: Display.RenderedExpression[], rowIndex: number) => (
        <span className={'table-row'} key={rowIndex}>
          {row.map((cell: Display.RenderedExpression, colIndex: number) => (
            <span className={'table-cell'} key={colIndex}>
              <Expression expression={cell} parent={this} hover={this.hover}/>
            </span>
          ))}
        </span>
      ));
    } else if (expression instanceof Display.FractionExpression) {
      className += ' fraction';
      result = [
        (
          <span className={'fraction-numerator-row'} key="numerator">
            <span className={'fraction-numerator'}>
              <Expression expression={expression.numerator} parent={this} hover={this.hover}/>
            </span>
          </span>
        ),
        (
          <span className={'fraction-denominator-row'} key="denominator">
            <span className={'fraction-denominator'}>
              <Expression expression={expression.denominator} parent={this} hover={this.hover}/>
            </span>
          </span>
        )
      ];
    } else if (expression instanceof Display.RadicalExpression) {
      className += ' radical';
      result = (
        <span className={'radical-row'}>
          <span className={'radical-degree-col'}>
            <span className={'radical-degree-table'}>
              <span className={'radical-degree-top-row'}>
                <span className={'radical-degree'}>
                  <Expression expression={expression.degree ? expression.degree : new Display.TextExpression('  ')} parent={this} hover={this.hover}/>
                </span>
              </span>
              <span className={'radical-degree-bottom-row'}>
                <span className={'radical-degree-bottom-cell'}>
                  <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                    <line x1="0" y1="0.35" x2="0.4" y2="0.1" stroke="black" strokeWidth="0.05" strokeLinecap="square"/>
                    <line x1="0.5" y1="0.12" x2="1" y2="1" stroke="black" strokeWidth="0.2" strokeLinecap="square"/>
                  </svg>
                </span>
              </span>
            </span>
          </span>
          <span className={'radical-diagonal'}>
            <svg viewBox="0 0 1 1" preserveAspectRatio="none">
              <line x1="0" y1="1" x2="0.95" y2="0" stroke="black" strokeWidth="0.1" strokeLinecap="square"/>
            </svg>
          </span>
          <span className={'radical-radicand'}>
            <Expression expression={expression.radicand} parent={this} hover={this.hover}/>
          </span>
        </span>
      );
    } else if (expression instanceof Display.MarkdownExpression) {
      return <ReactMarkdown source={expression.text}/>;
    } else if (expression instanceof Display.IndirectExpression) {
      try {
        return this.renderExpression(expression.resolve(), className, semanticLink, optionalParenLeft, optionalParenRight, optionalParenMaxLevel);
      } catch (error) {
        console.log(error);
        className += ' error';
        result = `Error: ${error.message}`;
      }
    } else if (expression instanceof Display.PromiseExpression) {
      let render = expression.promise.then((innerExpression: Display.RenderedExpression) => this.renderExpression(innerExpression, className, semanticLink, optionalParenLeft, optionalParenRight, optionalParenMaxLevel));
      return renderPromise(render);
    } else if (expression instanceof Display.DecoratedExpression) {
      return this.renderExpression(expression.body, className, semanticLink);
    } else {
      className += ' error';
      let error = expression instanceof Display.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
      result = `Error: ${error}`;
    }
    if (this.interactionHandler && semanticLink) {
      className += ' interactive';
      if (semanticLink.isDefinition) {
        className += ' definition';
      }
      if (this.hover
          && (this.state.ownHover === this.hover
              || (this.hover.showAllReferences && semanticLink.linkedObject && this.hover.linkedObject === semanticLink.linkedObject))
              || this.getPermanentHighlightExpression() === this) {
        className += ' hover';
      }
      let uri = this.interactionHandler.getURI(semanticLink);
      if (uri) {
        className += ' link';
      }
      if (uri && process.env.NODE_ENV !== 'development') {
        /* This causes nested anchors, which, strictly speaking, are illegal.
           However, there does not seem to be any replacement that supports middle-click for "open in new window/tab".
           So we do this anyway, but only in production mode, to prevent warnings from React. */
        result = (
          <a className={className} href={uri} onMouseEnter={() => this.setOwnHover(semanticLink)} onMouseLeave={() => this.setOwnHover(undefined)} onTouchStart={(event) => this.setPermanentHighlight(semanticLink, event)} onTouchEnd={(event) => this.stopPropagation(event)} onClick={(event) => this.linkClicked(semanticLink, event)} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
            {result}
          </a>
        );
      } else {
        result = (
          <span className={className} onMouseEnter={() => this.setOwnHover(semanticLink)} onMouseLeave={() => this.setOwnHover(undefined)} onTouchStart={(event) => this.setPermanentHighlight(semanticLink, event)} onTouchEnd={(event) => this.stopPropagation(event)} onClick={(event) => this.linkClicked(semanticLink, event)} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
            {result}
          </span>
        );
      }
      if (this.interactionHandler.hasPreview(semanticLink) && this.htmlNode) {
        let showPreview = false;
        if (this.state.showPreview) {
          previewContents = this.interactionHandler.getPreviewContents(semanticLink);
          if (previewContents) {
            showPreview = true;
          }
          if (uri) {
            previewContents = <a href={uri} onClick={(event) => this.linkClicked(semanticLink, event)}>{previewContents}</a>;
          }
        }
        let previewStyle = {
          style: {'background': '#fff8c0'},
          arrowStyle: {'color': '#fff8c0'}
        };
        let preview = (
          <ToolTip active={showPreview} position="bottom" arrow="center" parent={this.htmlNode} style={previewStyle} key="preview">
            <div className={'preview'}>{previewContents}</div>
          </ToolTip>
        );
        result = [result, preview];
      }
    } else {
      result = (
        <span className={className}>
          {result}
        </span>
      );
    }
    return result;
  }

  private convertText(text: string): any {
    let curText = '';
    let curStyle: string | undefined = undefined;
    let result = [];
    let iterator = text[Symbol.iterator]();
    for (let next = iterator.next(); !next.done; next = iterator.next()) {
      let c = next.value;
      if (c === '\r') {
        // ignore
      } else if (c === '\n') {
        result.push(curStyle ? <span className={curStyle}>{curText}</span> : curText);
        result.push(<br/>);
        curText = '';
        curStyle = undefined;
      } else {
        let cp = c.codePointAt(0)!;
        if (cp >= 0x1d5a0 && cp < 0x1d5d4) {
          if (curStyle !== 'sans') {
            if (curText) {
              result.push(curStyle ? <span className={curStyle}>{curText}</span> : curText);
              curText = '';
            }
            curStyle = 'sans';
          }
          curText += String.fromCodePoint(cp < 0x1d5ba ? cp - 0x1d5a0 + 0x41 :
                                                         cp - 0x1d5ba + 0x61);
        } else if ((cp >= 0x1d49c && cp < 0x1d504) || cp === 0x212c || cp === 0x2130 || cp === 0x2131 || cp === 0x210b || cp === 0x2110 || cp === 0x2112 || cp === 0x2133 || cp === 0x211b || cp === 0x212f || cp === 0x210a || cp === 0x2134) {
          if (curStyle !== 'calligraphic') {
            if (curText) {
              result.push(curStyle ? <span className={curStyle}>{curText}</span> : curText);
              curText = '';
            }
            curStyle = 'calligraphic';
          }
          switch (cp) {
            case 0x212c:
              curText += 'B';
              break;
            case 0x2130:
              curText += 'E';
              break;
            case 0x2131:
              curText += 'F';
              break;
            case 0x210b:
              curText += 'H';
              break;
            case 0x2110:
              curText += 'I';
              break;
            case 0x2112:
              curText += 'L';
              break;
            case 0x2133:
              curText += 'M';
              break;
            case 0x211b:
              curText += 'R';
              break;
            case 0x212f:
              curText += 'e';
              break;
            case 0x210a:
              curText += 'g';
              break;
            case 0x2134:
              curText += 'o';
              break;
            default:
              curText += String.fromCodePoint(cp < 0x1d4b6 ? cp - 0x1d49c + 0x41 :
                                              cp < 0x1d4d0 ? cp - 0x1d4b6 + 0x61 :
                                              cp < 0x1d4ea ? cp - 0x1d4d0 + 0x41 :
                                                             cp - 0x1d4ea + 0x61);
          }
        } else if ((cp >= 0x1d504 && cp < 0x1d5a0) || cp === 0x212d || cp === 0x210c || cp === 0x2111 || cp === 0x211c || cp === 0x2128) {
          if (curStyle !== 'fraktur') {
            if (curText) {
              result.push(curStyle ? <span className={curStyle}>{curText}</span> : curText);
              curText = '';
            }
            curStyle = 'fraktur';
          }
          switch (cp) {
            case 0x212d:
              curText += 'C';
              break;
            case 0x210c:
              curText += 'H';
              break;
            case 0x2111:
              curText += 'I';
              break;
            case 0x211c:
              curText += 'R';
              break;
            case 0x2128:
              curText += 'Z';
              break;
            default:
              curText += String.fromCodePoint(cp < 0x1d51e ? cp - 0x1d504 + 0x41 :
                                              cp < 0x1d56c ? cp - 0x1d51e + 0x61 :
                                              cp < 0x1d586 ? cp - 0x1d56c + 0x41 :
                                                             cp - 0x1d586 + 0x61);
          }
        } else if (cp >= 0x1d538 && cp < 0x1d56c) {
          if (curStyle !== 'double-struck') {
            if (curText) {
              result.push(curStyle ? <span className={curStyle}>{curText}</span> : curText);
              curText = '';
            }
            curStyle = 'double-struck';
          }
          curText += String.fromCodePoint(cp < 0x1d552 ? cp - 0x1d538 + 0x41 :
                                                         cp - 0x1d552 + 0x61);
        } else {
          if (curStyle) {
            result.push(<span className={curStyle}>{curText}</span>);
            curText = '';
            curStyle = undefined;
          }
          curText += c;
        }
      }
    }
    if (curText) {
      result.push(curStyle ? <span className={curStyle}>{curText}</span> : curText);
    }
    if (result.length === 1) {
      return result[0];
    } else {
      return result;
    }
  }

  private setOwnHover(hover: Display.SemanticLink | undefined): void {
    this.setState({ownHover: hover});
    this.updateGlobalHover(hover);
  }

  private updateGlobalHover(hover: Display.SemanticLink | undefined): void {
    if (this.props.parent) {
      if (!hover) {
        hover = this.props.parent.state.ownHover;
      }
      this.props.parent.updateGlobalHover(hover);
    } else {
      this.setGlobalHover(hover, true);
      this.forceUpdate();
    }
  }

  private setGlobalHover(hover: Display.SemanticLink | undefined, mounted: boolean): void {
    if (this.hover !== hover) {
      this.hover = hover;
      if (mounted) {
        this.setState((prevState) => {
          if (hover && (prevState.ownHover === this.hover || this.getPermanentHighlightExpression() === this)) {
            let update = () => {
              if (this.hover) {
                this.setState((laterPrevState) => ({showPreview: laterPrevState.ownHover === this.hover || this.getPermanentHighlightExpression() === this}));
              }
            };
            setTimeout(update, 250);
            return {showPreview: prevState.showPreview};
          } else {
            return {showPreview: false};
          }
        });
      }
    }
  }

  private setPermanentHighlight(semanticLink: Display.SemanticLink | undefined, event?: React.SyntheticEvent<HTMLElement>): void {
    this.stopPropagation(event);
    this.updatePermanentHighlightExpression(semanticLink ? this : undefined);
    this.updateGlobalHover(semanticLink);
  }

  private updatePermanentHighlightExpression(permanentHighlightExpression: Expression | undefined): void {
    if (this.props.parent) {
      this.props.parent.updatePermanentHighlightExpression(permanentHighlightExpression);
    } else {
      this.permanentHighlightExpression = permanentHighlightExpression;
      this.forceUpdate();
    }
  }

  private getPermanentHighlightExpression(): Expression | undefined {
    if (this.props.parent) {
      return this.props.parent.getPermanentHighlightExpression();
    } else {
      return this.permanentHighlightExpression;
    }
  }

  private linkClicked(semanticLink: Display.SemanticLink | undefined, event: React.MouseEvent<HTMLElement>): void {
    if (event.button < 1) {
      this.stopPropagation(event);
      if (this.interactionHandler && semanticLink) {
        this.interactionHandler.linkClicked(semanticLink);
      }
    }
  }

  private stopPropagation(event?: React.SyntheticEvent<HTMLElement>): void {
    if (event !== undefined) {
      event.stopPropagation();
      event.preventDefault();
    }
  }
}

export default Expression;
