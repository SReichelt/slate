import * as React from 'react';
import './Expression.css';
import * as Display from '../../shared/display/display';
import renderPromise from './PromiseHelper';
import * as ReactMarkdown from 'react-markdown';

const ToolTip = require('react-portal-tooltip').default;

export type OnHoverChanged = (hoveredObjects: Object[]) => void;

export interface ExpressionInteractionHandler {
  registerHoverChangeHandler(handler: OnHoverChanged): void;
  unregisterHoverChangeHandler(handler: OnHoverChanged): void;
  hoverChanged(hover: Display.SemanticLink[]): void;
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
  tooltipPosition?: string;
}

interface ExpressionState {
  hovered: boolean;
  showPreview: boolean;
}

class Expression extends React.Component<ExpressionProps, ExpressionState> {
  private htmlNode: HTMLElement | null = null;
  private semanticLinks?: Display.SemanticLink[];
  private windowTouchListener?: (this: Window, ev: TouchEvent) => any;
  private hoveredChildren: Expression[] = [];
  private permanentlyHighlighted = false;
  private tooltipPosition: string;

  constructor(props: ExpressionProps) {
    super(props);

    this.state = {
      hovered: false,
      showPreview: false
    };

    this.updateOptionalProps(props);
  }

  componentDidMount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerHoverChangeHandler(this.onHoverChanged);
    }
  }

  componentWillUnmount(): void {
    this.clearHover();
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterHoverChangeHandler(this.onHoverChanged);
    }
  }

  componentWillReceiveProps(props: ExpressionProps): void {
    if (props.parent !== this.props.parent) {
      this.clearHover();
    }
    if (props.interactionHandler !== this.props.interactionHandler) {
      if (this.props.interactionHandler) {
        this.props.interactionHandler.unregisterHoverChangeHandler(this.onHoverChanged);
      }
      if (props.interactionHandler) {
        props.interactionHandler.registerHoverChangeHandler(this.onHoverChanged);
      }
    }
    this.updateOptionalProps(props);
  }

  private updateOptionalProps(props: ExpressionProps): void {
    this.tooltipPosition = props.tooltipPosition ? props.tooltipPosition : props.parent ? props.parent.tooltipPosition : 'bottom';
  }

  private clearHover(): void {
    this.permanentlyHighlighted = false;
    if (this.windowTouchListener) {
      window.removeEventListener('touchStart', this.windowTouchListener);
      this.windowTouchListener = undefined;
    }
    if (this.props.parent) {
      for (let expression of this.hoveredChildren) {
        this.props.parent.removeFromHoveredChildren(expression);
      }
    }
    this.hoveredChildren = [];
  }

  render(): any {
    return this.renderExpression(this.props.expression, 'expr');
  }

  private renderExpression(expression: Display.RenderedExpression, className: string, semanticLinks?: Display.SemanticLink[], optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number): any {
    if (expression.styleClasses) {
      for (let styleClass of expression.styleClasses) {
        className += ' ' + styleClass;
      }
    }
    if (expression.semanticLinks) {
      if (semanticLinks) {
        semanticLinks = semanticLinks.concat(expression.semanticLinks);
      } else {
        semanticLinks = expression.semanticLinks;
      }
    }
    let result: any = null;
    if (expression instanceof Display.EmptyExpression) {
      result = '\u200b';
    } else if (expression instanceof Display.TextExpression) {
      let text = expression.text;
      if (text) {
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
        return this.renderExpression(expression.items[0], className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel);
      } else {
        className += ' row';
        result = expression.items.map((item: Display.RenderedExpression, index: number) =>
          <Expression expression={item} parent={this} interactionHandler={this.props.interactionHandler} key={index}/>);
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
            <Expression expression={paragraph} parent={this} interactionHandler={this.props.interactionHandler}/>
          </div>
        );
      });
      return result;
    } else if (expression instanceof Display.ListExpression) {
      className += ' list';
      let items = expression.items.map((item: Display.RenderedExpression, index: number) => (
        <li className={'list-item'} key={index}>
          <Expression expression={item} parent={this} interactionHandler={this.props.interactionHandler}/>
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
            <Expression expression={item.left} parent={this} interactionHandler={this.props.interactionHandler}/>
          </span>
          <span className={'aligned-right'} key={'right'}>
            <Expression expression={item.right} parent={this} interactionHandler={this.props.interactionHandler}/>
          </span>
        </span>
      ));
    } else if (expression instanceof Display.TableExpression) {
      className += ' table';
      result = expression.items.map((row: Display.RenderedExpression[], rowIndex: number) => (
        <span className={'table-row'} key={rowIndex}>
          {row.map((cell: Display.RenderedExpression, colIndex: number) => (
            <span className={'table-cell'} key={colIndex}>
              <Expression expression={cell} parent={this} interactionHandler={this.props.interactionHandler}/>
            </span>
          ))}
        </span>
      ));
    } else if (expression instanceof Display.ParenExpression) {
      className += ' paren';
      let parenExpression = expression;
      let render = parenExpression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
        if (surroundingParenStyle === parenExpression.style) {
          return this.renderExpression(parenExpression.body, className, semanticLinks);
        } else {
          return parenExpression.body.getLineHeight().then((lineHeight: number) => {
            let parenResult: any = <Expression expression={parenExpression.body} parent={this} interactionHandler={this.props.interactionHandler} key="body"/>;
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
        return this.renderExpression(new Display.ParenExpression(expression.body, expression.optionalParenStyle), className, semanticLinks);
      } else {
        return this.renderExpression(expression.body, className, semanticLinks);
      }
    } else if (expression instanceof Display.InnerParenExpression) {
      return this.renderExpression(expression.body, className, semanticLinks, expression.left, expression.right, expression.maxLevel);
    } else if (expression instanceof Display.SubSupExpression) {
      let subSupExpression = expression;
      let render = expression.body.getLineHeight().then((lineHeight: number) => {
        let subSupResult: any = [<Expression expression={subSupExpression.body} parent={this} interactionHandler={this.props.interactionHandler} key="body"/>];
        if (lineHeight && !(expression.sub && expression.sup) && !(expression.preSub && expression.preSup)) {
          if (subSupExpression.sub) {
            subSupResult.push(<sub key="sub"><Expression expression={subSupExpression.sub} parent={this} interactionHandler={this.props.interactionHandler}/></sub>);
          }
          if (subSupExpression.sup) {
            subSupResult.push(<sup key="sup"><Expression expression={subSupExpression.sup} parent={this} interactionHandler={this.props.interactionHandler}/></sup>);
          }
          if (subSupExpression.preSub) {
            subSupResult.unshift(<sub key="preSub"><Expression expression={subSupExpression.preSub} parent={this} interactionHandler={this.props.interactionHandler}/></sub>);
          }
          if (subSupExpression.preSup) {
            subSupResult.unshift(<sup key="preSup"><Expression expression={subSupExpression.preSup} parent={this} interactionHandler={this.props.interactionHandler}/></sup>);
          }
        } else {
          let empty = <span className={'subsup-empty'} key="empty"/>;
          let rightSub = null;
          let rightSup = null;
          if (subSupExpression.sub) {
            rightSub = (
              <span className={'subsup-right-sub'} key="sub">
                <Expression expression={subSupExpression.sub} parent={this} interactionHandler={this.props.interactionHandler}/>
              </span>
            );
          }
          if (subSupExpression.sup) {
            rightSup = (
              <span className={'subsup-right-sup'} key="sup">
                <Expression expression={subSupExpression.sup} parent={this} interactionHandler={this.props.interactionHandler}/>
              </span>
            );
          }
          let leftSub = null;
          let leftSup = null;
          if (subSupExpression.preSub) {
            leftSub = (
              <span className={'subsup-left-sub'} key="sub">
                <Expression expression={subSupExpression.preSub} parent={this} interactionHandler={this.props.interactionHandler}/>
              </span>
            );
          }
          if (subSupExpression.preSup) {
            leftSup = (
              <span className={'subsup-left-sup'} key="sup">
                <Expression expression={subSupExpression.preSup} parent={this} interactionHandler={this.props.interactionHandler}/>
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
      let over: any = expression.over ? <Expression expression={expression.over} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
      let under: any = expression.under ? <Expression expression={expression.under} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
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
              <Expression expression={expression.body} parent={this} interactionHandler={this.props.interactionHandler}/>
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
    } else if (expression instanceof Display.FractionExpression) {
      className += ' fraction';
      result = [
        (
          <span className={'fraction-numerator-row'} key="numerator">
            <span className={'fraction-numerator'}>
              <Expression expression={expression.numerator} parent={this} interactionHandler={this.props.interactionHandler}/>
            </span>
          </span>
        ),
        (
          <span className={'fraction-denominator-row'} key="denominator">
            <span className={'fraction-denominator'}>
              <Expression expression={expression.denominator} parent={this} interactionHandler={this.props.interactionHandler}/>
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
                  <Expression expression={expression.degree ? expression.degree : new Display.TextExpression('  ')} parent={this} interactionHandler={this.props.interactionHandler}/>
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
            <Expression expression={expression.radicand} parent={this} interactionHandler={this.props.interactionHandler}/>
          </span>
        </span>
      );
    } else if (expression instanceof Display.MarkdownExpression) {
      return <ReactMarkdown source={expression.text}/>;
    } else if (expression instanceof Display.IndirectExpression) {
      try {
        return this.renderExpression(expression.resolve(), className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel);
      } catch (error) {
        console.log(error);
        className += ' error';
        result = `Error: ${error.message}`;
      }
    } else if (expression instanceof Display.PromiseExpression) {
      let render = expression.promise.then((innerExpression: Display.RenderedExpression) => this.renderExpression(innerExpression, className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel));
      return renderPromise(render);
    } else if (expression instanceof Display.DecoratedExpression) {
      return this.renderExpression(expression.body, className, semanticLinks);
    } else {
      className += ' error';
      let error = expression instanceof Display.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
      result = `Error: ${error}`;
    }
    this.semanticLinks = semanticLinks;
    if (this.props.interactionHandler && semanticLinks && semanticLinks.length) {
      className += ' interactive';
      if (semanticLinks.some((semanticLink) => semanticLink.isDefinition)) {
        className += ' definition';
      }
      if (this.state.hovered) {
        className += ' hover';
      }
      let uriLink: Display.SemanticLink | undefined = undefined;
      let uri: string | undefined = undefined;
      for (let semanticLink of semanticLinks) {
        let linkUri = this.props.interactionHandler.getURI(semanticLink);
        if (linkUri) {
          uriLink = semanticLink;
          uri = linkUri;
          className += ' link';
        }
      }
      if (uri && process.env.NODE_ENV !== 'development') {
        /* This causes nested anchors, which, strictly speaking, are illegal.
           However, there does not seem to be any replacement that supports middle-click for "open in new window/tab".
           So we do this anyway, but only in production mode, to prevent warnings from React. */
        result = (
          <a className={className} href={uri} onMouseEnter={() => this.addToHoveredChildren()} onMouseLeave={() => this.removeFromHoveredChildren()} onTouchStart={(event) => this.highlightPermanently(event)} onTouchEnd={(event) => this.stopPropagation(event)} onClick={(event) => this.linkClicked(uriLink, event)} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
            {result}
          </a>
        );
      } else {
        result = (
          <span className={className} onMouseEnter={() => this.addToHoveredChildren()} onMouseLeave={() => this.removeFromHoveredChildren()} onTouchStart={(event) => this.highlightPermanently(event)} onTouchEnd={(event) => this.stopPropagation(event)} onClick={(event) => this.linkClicked(uriLink, event)} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
            {result}
          </span>
        );
      }
      if (uriLink && this.props.interactionHandler.hasPreview(uriLink) && this.htmlNode) {
        let showPreview = false;
        if (this.state.showPreview) {
          previewContents = this.props.interactionHandler.getPreviewContents(uriLink);
          if (previewContents) {
            showPreview = true;
          }
          if (uri) {
            previewContents = <a href={uri} onClick={(event) => this.linkClicked(uriLink, event)}>{previewContents}</a>;
          }
        }
        let previewStyle = {
          style: {'background': '#fff8c0'},
          arrowStyle: {'color': '#fff8c0'}
        };
        let preview = (
          <ToolTip active={showPreview} position={this.tooltipPosition} arrow="center" parent={this.htmlNode} style={previewStyle} key="preview">
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
    let result: any[] = [];
    let childIndex = 0;
    let flush = () => {
      if (curText) {
        let addSpace = false;
        if (curText.endsWith(' ')) {
          curText = curText.substring(0, curText.length - 1);
          addSpace = true;
        }
        result.push(curStyle ? <span className={curStyle} key={childIndex++}>{curText}</span> : curText);
        if (addSpace) {
          result.push(<span key={childIndex++}>&nbsp;</span>);
        }
        curText = '';
      }
      curStyle = undefined;
    };
    let setStyle = (style: string | undefined) => {
      if (curStyle !== style) {
        flush();
        curStyle = style;
      }
    };
    let iterator = text[Symbol.iterator]();
    for (let next = iterator.next(); !next.done; next = iterator.next()) {
      let c = next.value;
      if (c === '\r') {
        // ignore
      } else if (c === '\n') {
        flush();
        result.push(<br key={childIndex++}/>);
      } else if (c === ' ') {
        if (curText) {
          if (curText.endsWith(' ')) {
            flush();
          }
          curText += c;
        } else {
          result.push(<span key={childIndex++}>&nbsp;</span>);
        }
      } else {
        let cp = c.codePointAt(0)!;
        if (cp >= 0x1d5a0 && cp < 0x1d5d4) {
          setStyle('sans');
          curText += String.fromCodePoint(cp < 0x1d5ba ? cp - 0x1d5a0 + 0x41 :
                                                         cp - 0x1d5ba + 0x61);
        } else if ((cp >= 0x1d49c && cp < 0x1d504) || cp === 0x212c || cp === 0x2130 || cp === 0x2131 || cp === 0x210b || cp === 0x2110 || cp === 0x2112 || cp === 0x2133 || cp === 0x211b || cp === 0x212f || cp === 0x210a || cp === 0x2134) {
          setStyle('calligraphic');
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
          setStyle('fraktur');
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
          setStyle('double-struck');
          curText += String.fromCodePoint(cp < 0x1d552 ? cp - 0x1d538 + 0x41 :
                                                         cp - 0x1d552 + 0x61);
        } else {
          if (curStyle) {
            flush();
          }
          curText += c;
        }
      }
    }
    flush();
    if (result.length === 1) {
      return result[0];
    } else {
      return result;
    }
  }

  private addToHoveredChildren(expression: Expression = this): void {
    if (this.hoveredChildren.indexOf(expression) < 0) {
      this.hoveredChildren.push(expression);
    }
    if (this.props.parent) {
      this.props.parent.addToHoveredChildren(expression);
    }
    this.updateHover();
  }

  private removeFromHoveredChildren(expression: Expression = this): void {
    if (expression.permanentlyHighlighted) {
      return;
    }
    let index = this.hoveredChildren.indexOf(expression);
    if (index >= 0) {
      this.hoveredChildren.splice(index, 1);
    }
    if (this.props.parent) {
      this.props.parent.removeFromHoveredChildren(expression);
    }
    this.updateHover();
  }

  private updateHover(): void {
    if (this.props.interactionHandler) {
      if (!this.props.parent) {
        let hover: Display.SemanticLink[] = [];
        for (let expression of this.hoveredChildren) {
          if (expression.isDirectlyHovered() && expression.semanticLinks) {
            hover.push(...expression.semanticLinks);
          }
        }
        this.props.interactionHandler.hoverChanged(hover);
      }
      if (this.isDirectlyHovered()) {
        let update = () => {
          if (this.isDirectlyHovered()) {
            this.setState({showPreview: true});
          }
        };
        setTimeout(update, 250);
      } else {
        this.setState({showPreview: false});
      }
    }
  }

  private isDirectlyHovered(): boolean {
    return (this.hoveredChildren.length === 1 && this.hoveredChildren[0] === this) || this.permanentlyHighlighted;
  }

  private onHoverChanged = (hover: Object[]): void => {
    this.setState({hovered: this.isHovered(hover)});
  }

  private isHovered(hover: Object[]): boolean {
    if (hover.length && this.semanticLinks) {
      for (let semanticLink of this.semanticLinks) {
        if (hover.indexOf(semanticLink.linkedObject) >= 0) {
          return true;
        }
      }
    }
    return false;
  }

  private highlightPermanently(event: React.SyntheticEvent<HTMLElement>): void {
    if (!this.semanticLinks) {
      return;
    }
    this.stopPropagation(event);
    this.permanentlyHighlighted = true;
    this.addToHoveredChildren();
    if (!this.windowTouchListener) {
      this.windowTouchListener = () => {
        this.permanentlyHighlighted = false;
        this.removeFromHoveredChildren();
        if (this.windowTouchListener) {
          window.removeEventListener('touchStart', this.windowTouchListener);
          this.windowTouchListener = undefined;
        }
      };
      window.addEventListener('touchStart', this.windowTouchListener);
    }
  }

  private linkClicked(semanticLink: Display.SemanticLink | undefined, event: React.MouseEvent<HTMLElement>): void {
    if (event.button < 1) {
      this.stopPropagation(event);
      if (this.props.interactionHandler && semanticLink) {
        this.props.interactionHandler.linkClicked(semanticLink);
      }
    }
  }

  private stopPropagation(event: React.SyntheticEvent<HTMLElement>): void {
    event.stopPropagation();
    event.preventDefault();
  }
}

export default Expression;
