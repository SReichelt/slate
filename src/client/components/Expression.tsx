import * as React from 'react';
import './Expression.css';
import * as Display from '../../shared/display/display';
import * as Menu from '../../shared/display/menu';
import * as Dialog from '../../shared/display/dialog';
import renderPromise from './PromiseHelper';
import ExpressionMenu from './ExpressionMenu';
import ExpressionDialog from './ExpressionDialog';
import { getDefinitionIcon, getButtonIcon, ButtonType } from '../utils/icons';
import { shrinkMathSpace } from '../../shared/format/common';
import ReactMarkdownEditor from 'react-simplemde-editor';
import Modal from 'react-responsive-modal';
import 'simplemde/dist/simplemde.min.css';

const ToolTip = require('react-portal-tooltip').default;
const ReactMarkdownRenderer = require('react-markdown-renderer').default;

export type OnExpressionChanged = (editorUpdateRequired: boolean) => void;
export type OnHoverChanged = (hoveredObjects: Object[]) => void;

export interface ExpressionInteractionHandler {
  registerExpressionChangeListener(listener: OnExpressionChanged): void;
  unregisterExpressionChangeListener(listener: OnExpressionChanged): void;
  expressionChanged(editorUpdateRequired?: boolean): void;
  registerHoverChangeListener(listener: OnHoverChanged): void;
  unregisterHoverChangeListener(listener: OnHoverChanged): void;
  hoverChanged(hover: Display.SemanticLink[]): void;
  getURI(semanticLink: Display.SemanticLink): string | undefined;
  linkClicked(semanticLink: Display.SemanticLink): void;
  hasPreview(semanticLink: Display.SemanticLink): boolean;
  getPreviewContents(semanticLink: Display.SemanticLink): React.ReactNode;
  enterBlocker(): void;
  leaveBlocker(): void;
  isBlocked(): boolean;
}

let previewContents: React.ReactNode = null;

interface ExpressionProps {
  expression: Display.RenderedExpression;
  addInnerParens?: boolean;
  shrinkMathSpaces?: boolean;
  parent?: Expression;
  interactionHandler?: ExpressionInteractionHandler;
  tooltipPosition?: string;
}

interface ExpressionState {
  hovered: boolean;
  showPreview: boolean;
  openMenu?: Menu.ExpressionMenu;
  openDialog?: Dialog.ExpressionDialog;
}

class Expression extends React.Component<ExpressionProps, ExpressionState> {
  private htmlNode: HTMLElement | null = null;
  private semanticLinks?: Display.SemanticLink[];
  private hasMenu = false;
  private windowClickListener?: () => void;
  private interactionBlocked = false;
  private hoveredChildren: Expression[] = [];
  private permanentlyHighlighted = false;
  private shrinkMathSpaces = true;
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
      this.props.interactionHandler.registerHoverChangeListener(this.onHoverChanged);
    }
  }

  componentWillUnmount(): void {
    this.cleanupDependentState();
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterHoverChangeListener(this.onHoverChanged);
    }
  }

  componentWillReceiveProps(props: ExpressionProps): void {
    if (props.parent !== this.props.parent || props.expression !== this.props.expression || props.interactionHandler !== this.props.interactionHandler) {
      this.cleanupDependentState();
    }
    if (props.interactionHandler !== this.props.interactionHandler) {
      if (this.props.interactionHandler) {
        this.props.interactionHandler.unregisterHoverChangeListener(this.onHoverChanged);
      }
      if (props.interactionHandler) {
        props.interactionHandler.registerHoverChangeListener(this.onHoverChanged);
      }
    }
    this.updateOptionalProps(props);
  }

  private updateOptionalProps(props: ExpressionProps): void {
    this.shrinkMathSpaces = props.shrinkMathSpaces ? props.shrinkMathSpaces : props.parent ? props.parent.shrinkMathSpaces : false;
    this.tooltipPosition = props.tooltipPosition ? props.tooltipPosition : props.parent ? props.parent.tooltipPosition : 'bottom';
  }

  private clearHoverAndMenu(): void {
    this.permanentlyHighlighted = false;
    this.setState({
      openMenu: undefined,
      openDialog: undefined
    });
    if (this.props.parent) {
      for (let expression of this.hoveredChildren) {
        this.props.parent.removeFromHoveredChildren(expression);
      }
    }
    this.hoveredChildren = [];
    this.updateHover();
  }

  private clearHoverAndMenuRecursively(): void {
    if (this.props.parent) {
      this.props.parent.clearHoverAndMenuRecursively();
    }
    this.clearHoverAndMenu();
  }

  private cleanupDependentState(): void {
    this.clearHoverAndMenu();
    this.disableInteractionBlocker();
    this.disableWindowClickListener();
  }

  private enableWindowClickListener(): void {
    if (!this.windowClickListener) {
      this.windowClickListener = () => this.clearPermanentHighlight();
      window.addEventListener('mousedown', this.windowClickListener);
    }
  }

  private disableWindowClickListener(): void {
    if (this.windowClickListener) {
      window.removeEventListener('mousedown', this.windowClickListener);
      this.windowClickListener = undefined;
    }
  }

  private enableInteractionBlocker(): void {
    if (this.props.interactionHandler && !this.interactionBlocked) {
      this.props.interactionHandler.enterBlocker();
      this.interactionBlocked = true;
    }
  }

  private disableInteractionBlocker(): void {
    if (this.props.interactionHandler && this.interactionBlocked) {
      this.interactionBlocked = false;
      this.props.interactionHandler.leaveBlocker();
    }
  }

  render(): React.ReactNode {
    return this.renderExpression(this.props.expression, 'expr', undefined, this.props.addInnerParens, this.props.addInnerParens);
  }

  private renderExpression(expression: Display.RenderedExpression, className: string, semanticLinks: Display.SemanticLink[] | undefined, optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number, optionalParenStyle?: string): React.ReactNode {
    if (expression.styleClasses) {
      for (let styleClass of expression.styleClasses) {
        className += ' ' + styleClass;
      }
    }
    if (!optionalParenStyle) {
      optionalParenStyle = expression.optionalParenStyle;
    }
    if (expression.semanticLinks) {
      if (semanticLinks) {
        semanticLinks = semanticLinks.concat(expression.semanticLinks);
      } else {
        semanticLinks = expression.semanticLinks;
      }
    }
    if ((optionalParenLeft || optionalParenRight)
        && optionalParenMaxLevel === undefined
        && (expression instanceof Display.SubSupExpression || expression instanceof Display.OverUnderExpression || expression instanceof Display.FractionExpression)) {
      return this.renderExpression(new Display.ParenExpression(expression, optionalParenStyle), className, semanticLinks);
    }
    let onMenuOpened: (() => Menu.ExpressionMenu) | undefined = undefined;
    let alwaysShowMenu = false;
    if (semanticLinks) {
      for (let semanticLink of semanticLinks) {
        if (semanticLink.onMenuOpened) {
          onMenuOpened = semanticLink.onMenuOpened;
          alwaysShowMenu = semanticLink.alwaysShowMenu || expression instanceof Display.PlaceholderExpression;
        }
      }
    }
    let result: React.ReactNode = null;
    let isInputControl = false;
    if (expression instanceof Display.EmptyExpression) {
      result = '\u200b';
    } else if (expression instanceof Display.TextExpression) {
      if (this.props.interactionHandler && expression.onTextChanged) {
        let onChange = (newText: string) => {
          expression.text = newText;
          this.forceUpdate();
          if (expression.onTextChanged) {
            expression.onTextChanged(newText);
          }
          if (this.props.interactionHandler) {
            this.props.interactionHandler.expressionChanged();
          }
          setTimeout(() => this.highlightPermanently(), 0);
        };
        let ref = undefined;
        if (expression.requestTextInput) {
          ref = (htmlNode: HTMLInputElement | null) => {
            if (htmlNode) {
              expression.requestTextInput = false;
              htmlNode.select();
              htmlNode.focus();
              setTimeout(() => this.highlightPermanently(), 0);
            }
          };
        }
        let size = expression.text.length;
        if (size < 1) {
          size = 1;
        }
        let style = {'width': `${size}em`};
        result = <input value={expression.text} style={style} onChange={(event) => onChange(event.target.value)} onMouseDown={(event) => event.stopPropagation()} onFocus={() => this.highlightPermanently()} onBlur={() => this.clearPermanentHighlight()} ref={ref}/>;
        isInputControl = true;
      } else {
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
      }
    } else if (expression instanceof Display.RowExpression) {
      if (expression.items.length === 1) {
        return this.renderExpression(expression.items[0], className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
      } else {
        className += ' row';
        result = expression.items.map((item: Display.RenderedExpression, index: number) =>
          <Expression expression={item} parent={this} interactionHandler={this.props.interactionHandler} key={index}/>);
      }
    } else if (expression instanceof Display.ParagraphExpression) {
      className += ' paragraph';
      return expression.paragraphs.map((paragraph: Display.RenderedExpression, index: number) => (
        <div className={className} key={index}>
          <Expression expression={paragraph} parent={this} interactionHandler={this.props.interactionHandler}/>
        </div>
      ));
    } else if (expression instanceof Display.ListExpression) {
      className += ' list';
      if (expression.style instanceof Array) {
        className += ' custom';
        let rows = expression.items.map((item: Display.RenderedExpression, index: number) => {
          let itemClassName = 'list-item';
          if (index) {
            itemClassName += ' space-above';
          }
          return (
            <span className={itemClassName} key={index}>
              <span className={'list-item-header'}>
                {expression.style[index]}
              </span>
              <span className={'list-item-contents'}>
                <Expression expression={item} parent={this} interactionHandler={this.props.interactionHandler}/>
              </span>
            </span>
          );
        });
        result = (
          <span className={className}>
            {rows}
          </span>
        );
      } else {
        let items = expression.items.map((item: Display.RenderedExpression, index: number) => {
          return (
            <li className={'list-item'} key={index}>
              <Expression expression={item} parent={this} interactionHandler={this.props.interactionHandler}/>
            </li>
          );
        });
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
      }
      return result;
    } else if (expression instanceof Display.TableExpression) {
      className += ' table';
      let colCount = 0;
      for (let row of expression.items) {
        if (colCount < row.length) {
          colCount = row.length;
        }
      }
      let rows: React.ReactNode[] = [];
      let rowIndex = 0;
      for (let row of expression.items) {
        let colIndex = 0;
        let columns: React.ReactNode[] = [];
        for (let cell of row) {
          columns.push(
            <span className={'table-cell'} key={colIndex++}>
              <Expression expression={cell} parent={this} interactionHandler={this.props.interactionHandler}/>
            </span>
          );
        }
        while (colIndex < colCount) {
          columns.push(
            <span className={'table-cell'} key={colIndex++}/>
          );
        }
        rows.push(
          <span className={'table-row'} key={rowIndex++}>
            {columns}
          </span>
        );
      }
      result = rows;
    } else if (expression instanceof Display.ParenExpression) {
      className += ' paren';
      let parenExpression = expression;
      let render = parenExpression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
        if (surroundingParenStyle === parenExpression.style) {
          return this.renderExpression(parenExpression.body, className, semanticLinks);
        } else {
          return parenExpression.body.getLineHeight().then((lineHeight: number) => {
            let parenResult: React.ReactNode = <Expression expression={parenExpression.body} parent={this} interactionHandler={this.props.interactionHandler} key="body"/>;
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
                  <span className={'paren-large paren-round'}>
                    <span className={'paren-round-row'}>
                      <span className={'paren-round-left'}>
                        <svg viewBox="0 -5.5 1 11" preserveAspectRatio="none">
                          <path d="M 1 -5 C -0.25 -4 -0.25 4 1 5 C 0 3 0 -3 1 -5 Z" fill="black"/>
                        </svg>
                      </span>
                      <span className={'paren-round-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-round-right'}>
                        <svg viewBox="0 -5.5 1 11" preserveAspectRatio="none">
                          <path d="M 0 -5 C 1.25 -4 1.25 4 0 5 C 1 3 1 -3 0 -5 Z" fill="black"/>
                        </svg>
                      </span>
                    </span>
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
                  <span className={'paren-large paren-flat'}>
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
                  <span className={'paren-large paren-square'}>
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
                  <span className={'paren-large paren-curly'}>
                    <span className={'paren-curly-row'}>
                      <span className={'paren-curly-left'}>
                        <svg viewBox="0 -5 1 10" preserveAspectRatio="none">
                          <path d="M 1 -5 Q 0.4 -5 0.4 -3.5 L 0.4 -2 Q 0.4 0 0 0 Q 0.4 0 0.4 2 L 0.4 3.5 Q 0.4 5 1 5 Q 0.55 5 0.55 3 L 0.55 1.5 Q 0.55 -0.2 0 0 Q 0.55 0.2 0.55 -1.5 L 0.55 -3 Q 0.55 -5 1 -5 Z" fill="black"/>
                        </svg>
                      </span>
                      <span className={'paren-curly-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-curly-right'}>
                        <svg viewBox="0 -5 1 10" preserveAspectRatio="none">
                          <path d="M 0 -5 Q 0.6 -5 0.6 -3.5 L 0.6 -2 Q 0.6 0 1 0 Q 0.6 0 0.6 2 L 0.6 3.5 Q 0.6 5 0 5 Q 0.45 5 0.45 3 L 0.45 1.5 Q 0.45 -0.2 1 0 Q 0.45 0.2 0.45 -1.5 L 0.45 -3 Q 0.45 -5 0 -5 Z" fill="black"/>
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
              if (optionalParenRight && optionalParenMaxLevel !== undefined && optionalParenMaxLevel >= 0) {
                closeParen = '∣';
              }
              if (lineHeight) {
                parenClassName = 'paren-curly-text';
              } else {
                let bodyClassName = 'paren-curly-body';
                if (closeParen) {
                  bodyClassName += ' paren-right-hairline';
                }
                parenResult = (
                  <span className={'paren-large paren-curly'}>
                    <span className={'paren-curly-row'}>
                      <span className={'paren-curly-left'}>
                        <svg viewBox="0 -5 1 10" preserveAspectRatio="none">
                          <path d="M 1 -5 Q 0.4 -5 0.4 -3.5 L 0.4 -2 Q 0.4 0 0 0 Q 0.4 0 0.4 2 L 0.4 3.5 Q 0.4 5 1 5 Q 0.55 5 0.55 3 L 0.55 1.5 Q 0.55 -0.2 0 0 Q 0.55 0.2 0.55 -1.5 L 0.55 -3 Q 0.55 -5 1 -5 Z" fill="black"/>
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
                  <span className={'paren-large paren-angle'}>
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
        return this.renderExpression(new Display.ParenExpression(expression.body, optionalParenStyle), className, semanticLinks);
      } else {
        return this.renderExpression(expression.body, className, semanticLinks);
      }
    } else if (expression instanceof Display.InnerParenExpression) {
      return this.renderExpression(expression.body, className, semanticLinks, expression.left, expression.right, expression.maxLevel);
    } else if (expression instanceof Display.SubSupExpression) {
      let subSupExpression = expression;
      let render = expression.body.getLineHeight().then((lineHeight: number) => {
        let subSupResult: React.ReactNode[] = [<Expression expression={subSupExpression.body} parent={this} interactionHandler={this.props.interactionHandler} addInnerParens={true} key="body"/>];
        let sub: React.ReactNode = subSupExpression.sub ? <Expression expression={subSupExpression.sub} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
        let sup: React.ReactNode = subSupExpression.sup ? <Expression expression={subSupExpression.sup} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
        let preSub: React.ReactNode = subSupExpression.preSub ? <Expression expression={subSupExpression.preSub} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
        let preSup: React.ReactNode = subSupExpression.preSup ? <Expression expression={subSupExpression.preSup} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
        if (lineHeight && !(expression.sub && expression.sup) && !(expression.preSub && expression.preSup)) {
          if (sub) {
            subSupResult.push(<sub key="sub">{sub}</sub>);
          }
          if (sup) {
            subSupResult.push(<sup key="sup">{sup}</sup>);
          }
          if (preSub) {
            subSupResult.unshift(<sub key="preSub">{preSub}</sub>);
          }
          if (preSup) {
            subSupResult.unshift(<sup key="preSup">{preSup}</sup>);
          }
        } else {
          let empty = <span className={'subsup-empty'} key="empty"/>;
          let rightSub = null;
          let rightSup = null;
          if (sub) {
            rightSub = <span className={'subsup-right-sub'} key="sub">{sub}</span>;
          }
          if (sup) {
            rightSup = <span className={'subsup-right-sup'} key="sup">{sup}</span>;
          }
          let leftSub = null;
          let leftSup = null;
          if (preSub) {
            leftSub = <span className={'subsup-left-sub'} key="sub">{preSub}</span>;
          }
          if (preSup) {
            leftSup = <span className={'subsup-left-sup'} key="sup">{preSup}</span>;
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
            return (
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
      let bodyWithParens = new Display.InnerParenExpression(expression.body);
      let over: React.ReactNode = expression.over ? <Expression expression={expression.over} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
      let under: React.ReactNode = expression.under ? <Expression expression={expression.under} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
      let rows: React.ReactNode[] = [
        (
          <span className={'overunder-body-row'} key="body">
            <span className={'overunder-body'}>
              <Expression expression={bodyWithParens} parent={this} interactionHandler={this.props.interactionHandler}/>
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
      if (over) {
        rows.unshift(
          <span className={'overunder-over-row'} key="over">
            <span className={'overunder-over'}>
              {over}
            </span>
          </span>
        );
      } else {
        className += ' noover';
      }
      result = rows;
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
                  <Expression expression={expression.degree ? expression.degree : new Display.TextExpression('  ')} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/>
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
      if (this.props.interactionHandler && expression.onTextChanged) {
        let onChange = (newText: string) => {
          expression.text = newText;
          this.forceUpdate();
          if (expression.onTextChanged) {
            expression.onTextChanged(newText);
          }
          if (this.props.interactionHandler) {
            this.props.interactionHandler.expressionChanged(false);
          }
        };
        if ('ontouchstart' in window) {
          // SimpleMDE currently doesn't work correctly on Android, so don't use it if we have a touch device.
          return <textarea value={expression.text} onChange={(event) => onChange(event.target.value)}/>;
        } else {
          let options: SimpleMDE.Options = {
            toolbar: ['bold', 'italic', '|', 'unordered-list', 'ordered-list', 'link', 'code', '|', 'preview', 'guide'],
            status: false
          };
          return <ReactMarkdownEditor value={expression.text} onChange={onChange} options={options}/>;
        }
      } else {
        let options = {
          linkify: true,
          linkTarget: '_blank'
        };
        return <ReactMarkdownRenderer markdown={expression.text} options={options}/>;
      }
    } else if (expression instanceof Display.IndirectExpression) {
      try {
        return this.renderExpression(expression.resolve(), className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
      } catch (error) {
        console.log(error);
        className += ' error';
        result = `Error: ${error.message}`;
      }
    } else if (expression instanceof Display.PromiseExpression) {
      let render = expression.promise.then((innerExpression: Display.RenderedExpression) => this.renderExpression(innerExpression, className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle));
      return renderPromise(render);
    } else if (expression instanceof Display.DecoratedExpression) {
      return this.renderExpression(expression.body, className, semanticLinks);
    } else if (expression instanceof Display.PlaceholderExpression) {
      className += ' placeholder';
      if (expression instanceof Display.InsertPlaceholderExpression) {
        result = getButtonIcon(ButtonType.Insert);
      } else {
        result = getDefinitionIcon(expression.placeholderType);
      }
      result = <span className={'menu-placeholder'}>{result}</span>;
    } else {
      className += ' error';
      let error = expression instanceof Display.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
      result = `Error: ${error}`;
    }
    this.semanticLinks = semanticLinks;
    if (semanticLinks && semanticLinks.some((semanticLink) => semanticLink.isDefinition)) {
      className += ' definition';
    }
    let hasMenu = this.props.interactionHandler !== undefined && onMenuOpened !== undefined;
    this.hasMenu = hasMenu;
    let hasVisibleMenu = hasMenu && (alwaysShowMenu || this.isDirectlyHighlighted());
    if (hasMenu || expression instanceof Display.PlaceholderExpression) {
      let menuClassName = 'menu';
      if (this.state.hovered) {
        menuClassName += ' hover';
      }
      if (hasMenu) {
        menuClassName += ' interactive';
        if (!hasVisibleMenu) {
          menuClassName += ' hidden';
        }
      }
      if (this.state.openMenu) {
        menuClassName += ' open';
      }
      let menu: React.ReactNode = undefined;
      if (this.state.openDialog) {
        let modalClassNames = {
          modal: 'dialog',
          overlay: 'dialog-overlay'
        };
        menu = (
          <Modal open={true} onClose={this.onDialogClosed} showCloseIcon={false} classNames={modalClassNames} key={'dialog'}>
            <ExpressionDialog dialog={this.state.openDialog} onOK={this.onDialogOK} onCancel={this.onDialogClosed}/>
          </Modal>
        );
      } else if (this.state.openMenu) {
        menu = <ExpressionMenu menu={this.state.openMenu} onItemClicked={this.onMenuItemClicked} key={'menu'} interactionHandler={this.props.interactionHandler}/>;
      }
      let onMouseEnter = hasMenu ? () => this.addToHoveredChildren() : undefined;
      let onMouseLeave = hasMenu ? () => this.removeFromHoveredChildren() : undefined;
      let onMouseDown = hasMenu ? (event: React.MouseEvent<HTMLElement>) => this.menuClicked(onMenuOpened!, event) : undefined;
      let onMouseUp = hasMenu ? (event: React.MouseEvent<HTMLElement>) => this.stopPropagation(event) : undefined;
      let onClick = hasMenu ? (event: React.MouseEvent<HTMLElement>) => this.stopPropagation(event) : undefined;
      let cells: React.ReactNode;
      if (expression instanceof Display.PlaceholderExpression) {
        cells = <span className={'menu-placeholder-cell'}>{result}</span>;
      } else if (hasVisibleMenu) {
        cells = [
          <span className={'menu-cell'} key={'content'}>{result}</span>,
          <span className={'menu-dropdown-cell'} key={'dropdown'}>&nbsp;▼&nbsp;</span>
        ];
      } else {
        cells = <span className={'menu-cell'} key={'content'}>{result}</span>;
      }
      result = (
        <span className={className + ' menu-container'}>
          <span className={menuClassName} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onClick={onClick} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
            <span className={'menu-row'}>
              {cells}
            </span>
          </span>
          {menu}
        </span>
      );
    } else {
      if (this.state.hovered) {
        className += ' hover';
      }
      if (this.props.interactionHandler && semanticLinks && semanticLinks.length && (isInputControl || !this.isPartOfMenu())) {
        className += ' interactive';
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
    }
    return result;
  }

  private convertText(text: string): React.ReactNode {
    let curText = '';
    let curStyle: string | undefined = undefined;
    let result: React.ReactNode[] = [];
    let childIndex = 0;
    let flush = () => {
      if (curText) {
        result.push(curStyle ? <span className={curStyle} key={childIndex++}>{curText}</span> : curText);
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
      switch (c) {
        case '\r':
          break;
        case '\n':
          flush();
          result.push(<br key={childIndex++}/>);
          break;
        case ' ':
          if (curText) {
            if (curText.endsWith(' ')) {
              curText = curText.substring(0, curText.length - 1);
              flush();
              result.push(<span key={childIndex++}>&nbsp;</span>);
            }
            curText += c;
          } else {
            result.push(<span key={childIndex++}>{'\u2008'}</span>);
          }
          break;
        case '\'':
          flush();
          result.push(<span className={'prime'} key={childIndex++}><span className={'replacement'}> ′</span>{c}</span>);
          break;
        default:
          let cp = c.codePointAt(0)!;
          if (cp >= 0x1d400 && cp < 0x1d434) {
            setStyle('bold');
            curText += this.convertLatinMathToRegular(cp - 0x1d400);
          } else if ((cp >= 0x1d6a8 && cp < 0x1d6e2) || (cp >= 0x1d7ca && cp < 0x1d7cc)) {
            setStyle('bold');
            curText += this.convertGreekMathToRegular(cp - 0x1d6a8);
          } else if (cp >= 0x1d7ce && cp < 0x1d7d8) {
            setStyle('bold');
            curText += this.convertDigitMathToRegular(cp - 0x1d7ce);
          } else if ((cp >= 0x1d434 && cp < 0x1d468) || cp === 0x210e) {
            setStyle('italic');
            switch (cp) {
              case 0x210e:
                curText += 'h';
                break;
              default:
                curText += this.convertLatinMathToRegular(cp - 0x1d434);
            }
          } else if (cp >= 0x1d6e2 && cp < 0x1d71c) {
            setStyle('italic');
            curText += this.convertGreekMathToRegular(cp - 0x1d6e2);
          } else if (cp >= 0x1d468 && cp < 0x1d49c) {
            setStyle('bold italic');
            curText += this.convertLatinMathToRegular(cp - 0x1d468);
          } else if (cp >= 0x1d71c && cp < 0x1d756) {
            setStyle('bold italic');
            curText += this.convertGreekMathToRegular(cp - 0x1d71c);
          } else if (cp >= 0x1d5a0 && cp < 0x1d5d4) {
            setStyle('sans');
            curText += this.convertLatinMathToRegular(cp - 0x1d5a0);
          } else if (cp >= 0x1d7e2 && cp < 0x1d7ec) {
            setStyle('sans');
            curText += this.convertDigitMathToRegular(cp - 0x1d7e2);
          } else if (cp >= 0x1d5d4 && cp < 0x1d608) {
            setStyle('sans bold');
            curText += this.convertLatinMathToRegular(cp - 0x1d5d4);
          } else if (cp >= 0x1d756 && cp < 0x1d790) {
            setStyle('sans bold');
            curText += this.convertGreekMathToRegular(cp - 0x1d756);
          } else if (cp >= 0x1d7ec && cp < 0x1d7f6) {
            setStyle('sans bold');
            curText += this.convertDigitMathToRegular(cp - 0x1d7ec);
          } else if (cp >= 0x1d608 && cp < 0x1d63c) {
            setStyle('sans italic');
            curText += this.convertLatinMathToRegular(cp - 0x1d608);
          } else if (cp >= 0x1d63c && cp < 0x1d670) {
            setStyle('sans bold italic');
            curText += this.convertLatinMathToRegular(cp - 0x1d63c);
          } else if (cp >= 0x1d790 && cp < 0x1d7ca) {
            setStyle('sans bold italic');
            curText += this.convertGreekMathToRegular(cp - 0x1d790);
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
                curText += this.convertLatinMathToRegular(cp < 0x1d4d0 ? cp - 0x1d49c : cp - 0x1d4d0);
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
                curText += this.convertLatinMathToRegular(cp < 0x1d56c ? cp - 0x1d504 : cp - 0x1d56c);
            }
          } else if ((cp >= 0x1d538 && cp < 0x1d56c) || cp === 0x2102 || cp === 0x210d || cp === 0x2115 || cp === 0x2119 || cp === 0x211a || cp === 0x211d || cp === 0x2124) {
            setStyle('double-struck');
            switch (cp) {
              case 0x2102:
                curText += 'C';
                break;
              case 0x210d:
                curText += 'H';
                break;
              case 0x2115:
                curText += 'N';
                break;
              case 0x2119:
                curText += 'P';
                break;
              case 0x211a:
                curText += 'Q';
                break;
              case 0x211d:
                curText += 'R';
                break;
              case 0x2124:
                curText += 'Z';
                break;
              default:
                curText += this.convertLatinMathToRegular(cp - 0x1d538);
            }
          } else if (cp >= 0x1d7d8 && cp < 0x1d7e2) {
            setStyle('double-struck');
            curText += this.convertDigitMathToRegular(cp - 0x1d7d8);
          } else if (cp >= 0x1d670 && cp < 0x1d6a4) {
            setStyle('monospace');
            curText += this.convertLatinMathToRegular(cp - 0x1d670);
          } else if (cp >= 0x1d7f6 && cp < 0x1d800) {
            setStyle('monospace');
            curText += this.convertDigitMathToRegular(cp - 0x1d7f6);
          } else {
            if (curStyle) {
              flush();
            }
            if (this.shrinkMathSpaces) {
              c = shrinkMathSpace(c);
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

  private convertLatinMathToRegular(cpOffset: number): string {
    return String.fromCodePoint(cpOffset < 0x1a ? cpOffset + 0x41 :
                                                  cpOffset - 0x1a + 0x61);
  }

  private convertGreekMathToRegular(cpOffset: number): string {
    return String.fromCodePoint(cpOffset === 0x11  ? 0x3f4 :
                                cpOffset < 0x19    ? cpOffset + 0x391 :
                                cpOffset === 0x19  ? 0x2207 :
                                cpOffset < 0x33    ? cpOffset - 0x1a + 0x3b1 :
                                cpOffset === 0x33  ? 0x2202 :
                                cpOffset === 0x34  ? 0x3f5 :
                                cpOffset === 0x35  ? 0x3f0 :
                                cpOffset === 0x36  ? 0x3d5 :
                                cpOffset === 0x37  ? 0x3f1 :
                                cpOffset === 0x38  ? 0x3d6 :
                                cpOffset === 0x122 ? 0x3dc :
                                cpOffset === 0x123 ? 0x3dd :
                                0);
  }

  private convertDigitMathToRegular(cpOffset: number): string {
    return String.fromCodePoint(cpOffset + 0x30);
  }

  private addToHoveredChildren(expression: Expression = this): void {
    if (!this.props.interactionHandler || this.props.interactionHandler.isBlocked()) {
      return;
    }
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
      if (this.isDirectlyHovered() && !this.props.interactionHandler.isBlocked()) {
        let update = () => {
          if (this.isDirectlyHovered()) {
            this.setState({showPreview: true});
          }
        };
        setTimeout(update, 250);
      } else {
        this.setState((prevState: ExpressionState) => prevState.showPreview ? {showPreview: false} : null);
      }
    }
  }

  private isDirectlyHovered(): boolean {
    return (this.hoveredChildren.length === 1 && this.hoveredChildren[0] === this) || this.permanentlyHighlighted;
  }

  private onHoverChanged = (hover: Object[]): void => {
    let hovered = this.isHovered(hover);
    this.setState((prevState: ExpressionState) => prevState.hovered !== hovered ? {hovered: hovered} : null);
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

  private highlightPermanently(event?: React.SyntheticEvent<HTMLElement>): void {
    this.clearAllPermanentHighlights();
    if (!this.semanticLinks) {
      return;
    }
    if (event) {
      this.stopPropagation(event);
    }
    this.permanentlyHighlighted = true;
    this.addToHoveredChildren();
    this.enableWindowClickListener();
  }

  private clearPermanentHighlight(): void {
    if (this.permanentlyHighlighted) {
      this.permanentlyHighlighted = false;
      this.removeFromHoveredChildren();
    }
    this.setState({
      openMenu: undefined,
      openDialog: undefined
    });
    this.disableWindowClickListener();
    this.disableInteractionBlocker();
  }

  private clearAllPermanentHighlights(): void {
    if (this.props.parent) {
      this.props.parent.clearAllPermanentHighlights();
    } else {
      for (let expression of this.hoveredChildren) {
        expression.clearPermanentHighlight();
      }
    }
  }

  private isPartOfMenu(): boolean {
    if (this.props.parent) {
      return this.props.parent.hasMenu || this.props.parent.isPartOfMenu();
    } else {
      return false;
    }
  }

  private isDirectlyHighlighted(): boolean {
    return (this.state.hovered && this.hoveredChildren.indexOf(this) >= 0) || this.permanentlyHighlighted || this.state.openMenu !== undefined;
  }

  private linkClicked(semanticLink: Display.SemanticLink | undefined, event: React.MouseEvent<HTMLElement>): void {
    if (event.button < 1) {
      this.stopPropagation(event);
      if (this.props.interactionHandler && !this.props.interactionHandler.isBlocked() && semanticLink) {
        this.props.interactionHandler.linkClicked(semanticLink);
      }
    }
  }

  private menuClicked(onMenuOpened: () => Menu.ExpressionMenu, event: React.MouseEvent<HTMLElement>): void {
    if (event.button < 1) {
      if (this.state.openMenu) {
        this.disableInteractionBlocker();
        if (!this.permanentlyHighlighted) {
          this.disableWindowClickListener();
        }
        this.setState({openMenu: undefined});
        this.addToHoveredChildren();
      } else {
        if (this.props.interactionHandler && this.props.interactionHandler.isBlocked()) {
          return;
        }
        this.enableInteractionBlocker();
        this.clearHoverAndMenuRecursively();
        this.setState({openMenu: onMenuOpened()});
        this.enableWindowClickListener();
      }
      this.stopPropagation(event);
    }
  }

  private onMenuItemClicked = (action: Menu.ExpressionMenuAction) => {
    if (action instanceof Menu.ImmediateExpressionMenuAction) {
      action.onExecute();
      this.disableInteractionBlocker();
      this.clearPermanentHighlight();
      if (this.props.interactionHandler) {
        this.props.interactionHandler.expressionChanged();
      }
    } else if (action instanceof Menu.DialogExpressionMenuAction) {
      this.disableWindowClickListener();
      this.setState({
        openMenu: undefined,
        openDialog: action.onOpen()
      });
    }
  }

  private onDialogOK = () => {
    this.clearPermanentHighlight();
    if (this.state.openDialog) {
      this.state.openDialog.onOK();
    }
    if (this.props.interactionHandler) {
      this.props.interactionHandler.expressionChanged();
    }
  }

  private onDialogClosed = () => {
    this.disableInteractionBlocker();
    this.clearPermanentHighlight();
  }

  private stopPropagation(event: React.SyntheticEvent<HTMLElement>): void {
    event.stopPropagation();
    event.preventDefault();
  }
}

export default Expression;
