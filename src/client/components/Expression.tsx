import * as React from 'react';
import * as ReactDOM from 'react-dom';
import ReactMarkdownEditor from 'react-simplemde-editor';
import * as EasyMDE from 'easymde';
import 'easymde/dist/easymde.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
const RemarkableReactRenderer = require('remarkable-react').default;
const Remarkable = require('remarkable').Remarkable;
const linkify = require('remarkable/linkify').linkify;
const unicodeit = require('unicodeit');

import './Expression.css';

import ExpressionToolTip, { ToolTipPosition } from './ExpressionToolTip';
import ExpressionMenu from './ExpressionMenu';
import InsertDialog from './InsertDialog';
import ExpressionDialog from './ExpressionDialog';
import Button from './Button';
import { PromiseHelper, renderPromise } from './PromiseHelper';

import config from '../utils/config';
import { eventHandled } from '../utils/event';
import { getDefinitionIcon, getButtonIcon, ButtonType, getSectionIcon } from '../utils/icons';
import { getLatexInputSuggestions, replaceLatexCode, replaceLatexCodeIfUnambigous } from '../utils/latexInput';

import * as Notation from '../../shared/notation/notation';
import * as Menu from '../../shared/notation/menu';
import * as Dialog from '../../shared/notation/dialog';
import { convertUnicode, UnicodeConverter, UnicodeConversionOptions, useItalicsForVariable } from '../../shared/notation/unicode';
import CachedPromise from '../../shared/data/cachedPromise';


export type OnExpressionChanged = (editorUpdateRequired: boolean) => void;
export type OnHoverChanged = (hoveredObjects: Object[]) => void;

export interface ExpressionInteractionHandler {
  registerExpressionChangeListener(listener: OnExpressionChanged): void;
  unregisterExpressionChangeListener(listener: OnExpressionChanged): void;
  expressionChanged(editorUpdateRequired?: boolean): void;
  registerHoverChangeListener(listener: OnHoverChanged): void;
  unregisterHoverChangeListener(listener: OnHoverChanged): void;
  hoverChanged(hover: Notation.SemanticLink[]): void;
  getURI(semanticLink: Notation.SemanticLink): string | undefined;
  linkClicked(semanticLink: Notation.SemanticLink): void;
  hasToolTip(semanticLink: Notation.SemanticLink): boolean;
  getToolTipContents(semanticLink: Notation.SemanticLink): React.ReactNode;
  enterBlocker(): void;
  leaveBlocker(): void;
  isBlocked(): boolean;
}

class ExpressionUnicodeConverter implements UnicodeConverter {
  result: React.ReactNode[] = [];
  childIndex: number = 0;

  outputText(text: string, style?: string | undefined): void {
    this.result.push(style ? <span className={style} key={this.childIndex++}>{text}</span> : text);
  }

  outputLineBreak(): void {
    this.result.push(<br key={this.childIndex++}/>);
  }

  outputExtraSpace(standalone: boolean): void {
    if (standalone) {
      this.result.push(<span key={this.childIndex++}>{'\u2008'}</span>);
    } else {
      this.result.push(<span key={this.childIndex++}>&nbsp;</span>);
    }
  }
}

export interface ExpressionProps {
  expression: Notation.RenderedExpression;
  addInnerParens?: boolean;
  shrinkMathSpaces?: boolean;
  parent?: Expression;
  interactionHandler?: ExpressionInteractionHandler;
  toolTipPosition?: ToolTipPosition;
}

export interface ExpressionState {
  hovered: boolean;
  showToolTip: boolean;
  clicking: boolean;
  inputError: boolean;
  inputFocused: boolean;
  unfolded?: boolean;
  openMenu?: Menu.ExpressionMenu;
  openDialog?: Dialog.DialogBase;
}

class Expression extends React.Component<ExpressionProps, ExpressionState> {
  private htmlNode: HTMLElement | null = null;
  private semanticLinks?: Notation.SemanticLink[];
  private hasMenu = false;
  private windowClickListener?: () => void;
  private interactionBlocked = false;
  private hoveredChildren: Expression[] = [];
  private permanentlyHighlighted = false;
  private highlightPermanentlyTimer: any;
  private autoOpenTimer: any;
  private shrinkMathSpaces = true;
  private toolTipPosition: ToolTipPosition;

  constructor(props: ExpressionProps) {
    super(props);

    this.state = {
      hovered: false,
      showToolTip: false,
      clicking: false,
      inputError: false,
      inputFocused: false
    };

    this.updateOptionalProps(props);
  }

  componentDidMount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerHoverChangeListener(this.onHoverChanged);
    }
  }

  componentWillUnmount(): void {
    this.cleanupDependentState(this.props);
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterHoverChangeListener(this.onHoverChanged);
    }
  }

  componentDidUpdate(prevProps: ExpressionProps): void {
    // Do not check for arbitrary changes to props.expression here. Some expressions are generated dynamically while rendering, and thus change every time.
    if (this.props.parent !== prevProps.parent
        || prevProps.expression.constructor !== this.props.expression.constructor
        || this.props.interactionHandler !== prevProps.interactionHandler) {
      this.cleanupDependentState(prevProps);
    }
    if (this.props.interactionHandler !== prevProps.interactionHandler) {
      if (prevProps.interactionHandler) {
        prevProps.interactionHandler.unregisterHoverChangeListener(this.onHoverChanged);
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.registerHoverChangeListener(this.onHoverChanged);
      }
    }
    this.updateOptionalProps(this.props);
  }

  private updateOptionalProps(props: ExpressionProps): void {
    this.shrinkMathSpaces = props.shrinkMathSpaces ?? props.parent?.shrinkMathSpaces ?? false;
    this.toolTipPosition = props.toolTipPosition ?? props.parent?.toolTipPosition ?? 'bottom';
  }

  private clearOpenMenu(): void {
    if (this.state.openMenu || this.state.openDialog) {
      this.setState({
        clicking: false,
        openMenu: undefined,
        openDialog: undefined
      });
    }
  }

  private clearHoverAndMenu(props: ExpressionProps): void {
    this.permanentlyHighlighted = false;
    if (this.highlightPermanentlyTimer) {
      clearTimeout(this.highlightPermanentlyTimer);
      this.highlightPermanentlyTimer = undefined;
    }
    this.clearOpenMenu();
    if (props.parent) {
      for (let expression of this.hoveredChildren) {
        props.parent.removeFromHoveredChildren(expression);
      }
    }
    this.hoveredChildren = [];
    this.updateHover();
  }

  private clearHoverAndMenuRecursively(): void {
    if (this.props.parent) {
      this.props.parent.clearHoverAndMenuRecursively();
    }
    this.clearHoverAndMenu(this.props);
  }

  private cleanupDependentState(props: ExpressionProps): void {
    if (this.autoOpenTimer) {
      clearTimeout(this.autoOpenTimer);
      this.autoOpenTimer = undefined;
    }
    this.clearHoverAndMenu(props);
    this.disableInteractionBlocker(props);
    this.disableWindowClickListener();
    this.semanticLinks = undefined;
  }

  private enableWindowClickListener(): void {
    if (!this.windowClickListener) {
      this.windowClickListener = () => this.clearPermanentHighlight();
      window.addEventListener('mousedown', this.windowClickListener);
    }
  }

  // Called externally as a hack to enable links in tooltips.
  disableWindowClickListener(): void {
    if (this.windowClickListener) {
      window.removeEventListener('mousedown', this.windowClickListener);
      this.windowClickListener = undefined;
    }
  }

  private enableInteractionBlocker(props: ExpressionProps): void {
    if (props.interactionHandler && !this.interactionBlocked) {
      props.interactionHandler.enterBlocker();
      this.interactionBlocked = true;
    }
  }

  private disableInteractionBlocker(props: ExpressionProps): void {
    if (props.interactionHandler && this.interactionBlocked) {
      this.interactionBlocked = false;
      props.interactionHandler.leaveBlocker();
    }
  }

  render(): React.ReactNode {
    try {
      return this.renderExpression(this.props.expression, 'expr', undefined, this.props.addInnerParens, this.props.addInnerParens);
    } catch (error) {
      console.error(error);
      return <span className={'expr error'}>Error: {error.message}</span>;
    }
  }

  private renderExpression(expression: Notation.RenderedExpression, className: string, semanticLinks: Notation.SemanticLink[] | undefined, optionalParenLeft: boolean = false, optionalParenRight: boolean = false, optionalParenMaxLevel?: number, optionalParenStyle?: string): React.ReactNode {
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
    this.semanticLinks = semanticLinks;
    if ((optionalParenLeft || optionalParenRight)
        && optionalParenMaxLevel === undefined
        && (expression instanceof Notation.SubSupExpression || expression instanceof Notation.OverUnderExpression || expression instanceof Notation.FractionExpression || expression instanceof Notation.RadicalExpression)) {
      return this.renderExpression(new Notation.ParenExpression(expression, optionalParenStyle), className, semanticLinks);
    }
    if (expression instanceof Notation.EmptyExpression) {
      if (semanticLinks) {
        return this.wrapRenderedExpression('\u200b', { semanticLinks, className });
      } else {
        return null;
      }
    } else if (expression instanceof Notation.TextExpression) {
      if (this.props.interactionHandler && expression.onTextChanged) {
        let text = expression.text;
        let latexInput = text.startsWith('\\');
        let setText = (newText: string) => {
          expression.text = newText;
          this.setState({inputError: false});
          this.forceUpdate();
          if (expression.onTextChanged) {
            if (expression.onTextChanged(newText)) {
              if (this.props.interactionHandler) {
                this.props.interactionHandler.expressionChanged();
              }
            } else {
              this.setState({inputError: true});
            }
          }
        };
        let performLatexReplacement = () => {
          let textAfterReplacement = replaceLatexCode(text);
          if (textAfterReplacement !== text) {
            setText(textAfterReplacement);
          }
        };
        let onFocus = () => {
          this.highlightPermanently();
          this.setState({ inputFocused: true });
        };
        let onBlur = () => {
          this.clearPermanentHighlight();
          this.setState({ inputFocused: false });
          performLatexReplacement();
        };
        let onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
          setText(replaceLatexCodeIfUnambigous(event.target.value));
          this.triggerHighlightPermanently();
        };
        let onKeyDown = (event: React.KeyboardEvent) => {
          if (event.key === 'Enter') {
            performLatexReplacement();
          }
        };
        let ref = undefined;
        if (expression.requestTextInput) {
          ref = (htmlNode: HTMLInputElement | null) => {
            if (htmlNode) {
              expression.requestTextInput = false;
              htmlNode.select();
              htmlNode.focus();
              this.triggerHighlightPermanently();
            }
          };
        }
        let inputClassName = 'expr-input';
        if (this.state.inputError) {
          inputClassName += ' input-error';
        }
        if (latexInput) {
          inputClassName += ' input-latex';
        } if (expression.hasStyleClass('var') && useItalicsForVariable(text)) {
          inputClassName += ' italic';
        }
        let size = expression.inputLength ?? text.length + 1;
        let style = {'width': `${size}ch`, 'minWidth': `${size}ex`};
        let menu: JSX.Element | undefined = undefined;
        if (latexInput && this.state.inputFocused) {
          let rows = getLatexInputSuggestions(text).map(suggestion => {
            let action = new Menu.ImmediateExpressionMenuAction(() => {
              setText(suggestion.unicodeCharacters);
            });
            let item = new Menu.ExpressionMenuItem(new Notation.TextExpression(suggestion.unicodeCharacters), action);
            let row = new Menu.StandardExpressionMenuRow(suggestion.latexCode);
            row.subMenu = item;
            return row;
          });
          if (rows.length > 0) {
            let expressionMenu = new Menu.ExpressionMenu(CachedPromise.resolve(rows));
            menu = <ExpressionMenu menu={expressionMenu} onItemClicked={this.onMenuItemClicked} />;
          }
        }
        let input = (
          <input
            key="input"
            type={'text'}
            className={inputClassName}
            value={text}
            style={style}
            onChange={onChange}
            onMouseDown={(event) => event.stopPropagation()}
            onMouseUp={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onTouchCancel={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            ref={ref}
            autoFocus={expression.requestTextInput}
          />
        );
        return (
          <span className={'menu-container'} onTouchStart={(event) => event.stopPropagation()} onTouchCancel={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
            {this.wrapRenderedExpression(input, { className, semanticLinks, isInputControl: true })}
            {menu}
          </span>
        );
      } else {
        let text = expression.text;
        if (text) {
          if (expression.hasStyleClass('integer')) {
            let resultArray = [];
            for (let endIndex = text.length; endIndex > 0; endIndex -= 3) {
              let startIndex = endIndex - 3;
              if (startIndex < 0) {
                startIndex = 0;
              }
              resultArray.unshift(text.substring(startIndex, endIndex));
              if (startIndex > 0) {
                resultArray.unshift(<span className={'thousands-separator'} key={startIndex}/>);
              }
            }
            return this.wrapRenderedExpression(resultArray, { semanticLinks, className });
          } else {
            let firstChar = text.charAt(0);
            let lastChar = text.charAt(text.length - 1);
            if (firstChar === ' ' || firstChar === '\xa0' || (firstChar >= '\u2000' && firstChar <= '\u200a')) {
              className += ' space-start';
            }
            if (expression.hasStyleClass('var') && useItalicsForVariable(text)) {
              className += ' italic';
              if (lastChar === 'f' || lastChar === 'C' || lastChar === 'E' || lastChar === 'F' || lastChar === 'H' || lastChar === 'I' || lastChar === 'J' || lastChar === 'K' || lastChar === 'M' || lastChar === 'N' || lastChar === 'S' || lastChar === 'T' || lastChar === 'U' || lastChar === 'V' || lastChar === 'W' || lastChar === 'X' || lastChar === 'Y' || lastChar === 'Z') {
                className += ' charcorner-tr';
                if (lastChar === 'T' || lastChar === 'Y') {
                  className += ' charcorner-large';
                }
              }
              if (firstChar === 'f' || firstChar === 'g' || firstChar === 'j' || firstChar === 'y') {
                className += ' charcorner-bl';
              }
            }
            return this.wrapRenderedExpression(this.convertText(text), { semanticLinks, className });
          }
        } else {
          return this.wrapRenderedExpression('\u200b', { semanticLinks, className });
        }
      }
    } else if (expression instanceof Notation.RowExpression) {
      if (expression.items.length === 1) {
        return this.renderExpression(expression.items[0], className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
      } else {
        className += ' row';
        let renderedExpressions = expression.items.map((item: Notation.RenderedExpression, index: number) =>
          <Expression expression={item} parent={this} interactionHandler={this.props.interactionHandler} key={index}/>);
        return this.wrapRenderedExpression(renderedExpressions, { semanticLinks, className });
      }
    } else if (expression instanceof Notation.ParagraphExpression) {
      className += ' paragraph';
      return expression.paragraphs.map((paragraph: Notation.RenderedExpression, index: number) => (
        <div className={className} key={index}>
          <Expression expression={paragraph} parent={this} interactionHandler={this.props.interactionHandler}/>
        </div>
      ));
    } else if (expression instanceof Notation.ListExpression) {
      className += ' list';
      if (expression.style instanceof Array) {
        className += ' custom';
        let rows = expression.items.map((item: Notation.RenderedExpression, index: number) => {
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
        return this.wrapRenderedExpression(<span className={className}>{rows}</span>, { semanticLinks, className });
      } else {
        let items = expression.items.map((item: Notation.RenderedExpression, index: number) => {
          return (
            <li className={'list-item'} key={index}>
              <Expression expression={item} parent={this} interactionHandler={this.props.interactionHandler}/>
            </li>
          );
        });
        let listElement = expression.style === '1.'
          ? <ol className={className}>{items}</ol>
          : <ul className={className}>{items}</ul>;
        return this.wrapRenderedExpression(listElement, { semanticLinks, className });
      }
    } else if (expression instanceof Notation.TableExpression) {
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
        let curRowIndex = rowIndex++;
        let renderCurRow = (additionalClassName: string = '') => (
          <span className={'table-row' + additionalClassName} key={curRowIndex}>
            {columns}
          </span>
        );
        if (row.length) {
          let renderRow = row[0].getLineHeight().then((lineHeight: number) =>
            renderCurRow(lineHeight ? '' : ' large'));
          rows.push(renderPromise(renderRow, curRowIndex.toString()));
        } else {
          rows.push(renderCurRow());
        }
      }
      return this.wrapRenderedExpression(rows, { semanticLinks, className, innerClassName: 'table' });
    } else if (expression instanceof Notation.ParenExpression) {
      let render = expression.body.getSurroundingParenStyle().then((surroundingParenStyle: string) => {
        if (surroundingParenStyle === expression.style) {
          return this.renderExpression(expression.body, className, semanticLinks);
        } else {
          return expression.body.getLineHeight().then((lineHeight: number) => {
            let parenResult: React.ReactNode = <Expression expression={expression.body} parent={this} interactionHandler={this.props.interactionHandler} key="body"/>;
            let handled = false;
            let openParen = '';
            let closeParen = '';
            let parenClassName = 'paren-text';
            switch (expression.style) {
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
                          <path d="M 1 -5 C -0.25 -4 -0.25 4 1 5 C 0 3 0 -3 1 -5 Z" fill="var(--foreground-color)"/>
                        </svg>
                      </span>
                      <span className={'paren-round-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-round-right'}>
                        <svg viewBox="0 -5.5 1 11" preserveAspectRatio="none">
                          <path d="M 0 -5 C 1.25 -4 1.25 4 0 5 C 1 3 1 -3 0 -5 Z" fill="var(--foreground-color)"/>
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
                          <path d="M 1 -5 Q 0.4 -5 0.4 -3.5 L 0.4 -2 Q 0.4 0 0 0 Q 0.4 0 0.4 2 L 0.4 3.5 Q 0.4 5 1 5 Q 0.55 5 0.55 3 L 0.55 1.5 Q 0.55 -0.2 0 0 Q 0.55 0.2 0.55 -1.5 L 0.55 -3 Q 0.55 -5 1 -5 Z" fill="var(--foreground-color)"/>
                        </svg>
                      </span>
                      <span className={'paren-curly-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-curly-right'}>
                        <svg viewBox="0 -5 1 10" preserveAspectRatio="none">
                          <path d="M 0 -5 Q 0.6 -5 0.6 -3.5 L 0.6 -2 Q 0.6 0 1 0 Q 0.6 0 0.6 2 L 0.6 3.5 Q 0.6 5 0 5 Q 0.45 5 0.45 3 L 0.45 1.5 Q 0.45 -0.2 1 0 Q 0.45 0.2 0.45 -1.5 L 0.45 -3 Q 0.45 -5 0 -5 Z" fill="var(--foreground-color)"/>
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
                if (closeParen) {
                  bodyClassName += ' paren-right-hairline';
                }
                parenResult = (
                  <span className={'paren-large paren-curly'}>
                    <span className={'paren-curly-row'}>
                      <span className={'paren-curly-left'}>
                        <svg viewBox="0 -5 1 10" preserveAspectRatio="none">
                          <path d="M 1 -5 Q 0.4 -5 0.4 -3.5 L 0.4 -2 Q 0.4 0 0 0 Q 0.4 0 0.4 2 L 0.4 3.5 Q 0.4 5 1 5 Q 0.55 5 0.55 3 L 0.55 1.5 Q 0.55 -0.2 0 0 Q 0.55 0.2 0.55 -1.5 L 0.55 -3 Q 0.55 -5 1 -5 Z" fill="var(--foreground-color)"/>
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
              openParen = '⟨';
              closeParen = '⟩';
              if (lineHeight) {
                parenClassName = 'paren-angle-text';
              } else {
                parenResult = (
                  <span className={'paren-large paren-angle'}>
                    <span className={'paren-angle-row'}>
                      <span className={'paren-angle-left'}>
                        <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                          <path d="M 0.9 0 L 0.1 0.5 L 0.9 1" y2="0" stroke="var(--foreground-color)" strokeWidth="0.1" strokeLinecap="square" fill="transparent"/>
                        </svg>
                      </span>
                      <span className={'paren-angle-body'}>
                        {parenResult}
                      </span>
                      <span className={'paren-angle-right'}>
                        <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                          <path d="M 0.1 0 L 0.9 0.5 L 0.1 1" y2="0" stroke="var(--foreground-color)" strokeWidth="0.1" strokeLinecap="square" fill="transparent"/>
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
      return this.wrapRenderedExpression(
        <PromiseHelper promise={render}/>,
        { semanticLinks, className, innerClassName: 'paren' }
      );
    } else if (expression instanceof Notation.OuterParenExpression) {
      if (((expression.left && optionalParenLeft) || (expression.right && optionalParenRight))
          && (expression.minLevel === undefined || optionalParenMaxLevel === undefined || expression.minLevel <= optionalParenMaxLevel)) {
        return this.renderExpression(new Notation.ParenExpression(expression.body, optionalParenStyle), className, semanticLinks);
      } else {
        return this.renderExpression(expression.body, className, semanticLinks);
      }
    } else if (expression instanceof Notation.InnerParenExpression) {
      return this.renderExpression(expression.body, className, semanticLinks, expression.left, expression.right, expression.maxLevel);
    } else if (expression instanceof Notation.SubSupExpression) {
      let renderWithLineHeight = (lineHeight?: number) => {
        let subSupResult: React.ReactNode[] = [<Expression expression={expression.body} parent={this} interactionHandler={this.props.interactionHandler} addInnerParens={true} key="body"/>];
        let sub: React.ReactNode = expression.sub ? <Expression expression={expression.sub} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler} key="sub"/> : null;
        let sup: React.ReactNode = expression.sup ? <Expression expression={expression.sup} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler} key="sup"/> : null;
        let preSub: React.ReactNode = expression.preSub ? <Expression expression={expression.preSub} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler} key="preSub"/> : null;
        let preSup: React.ReactNode = expression.preSup ? <Expression expression={expression.preSup} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler} key="preSup"/> : null;
        if (lineHeight && !(expression.sub && expression.sup) && !(expression.preSub && expression.preSup)) {
          if (expression.sub) {
            subSupResult.push(<sub key="sub">{renderPromise(expression.sub.getLineHeight().then((subLineHeight: number) => subLineHeight ? sub : <sub>{sub}</sub>), undefined, () => sub)}</sub>);
          }
          if (expression.sup) {
            subSupResult.push(<sup key="sup">{renderPromise(expression.sup.getLineHeight().then((supLineHeight: number) => supLineHeight ? sup : <sup>{sup}</sup>), undefined, () => sup)}</sup>);
          }
          if (expression.preSub) {
            subSupResult.unshift(<sub key="preSub">{renderPromise(expression.preSub.getLineHeight().then((preSubLineHeight: number) => preSubLineHeight ? preSub : <sub>{preSub}</sub>), undefined, () => preSub)}</sub>);
          }
          if (expression.preSup) {
            subSupResult.unshift(<sup key="preSup">{renderPromise(expression.preSup.getLineHeight().then((preSupLineHeight: number) => preSupLineHeight ? preSup : <sup>{preSup}</sup>), undefined, () => preSup)}</sup>);
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
                    {leftSup ?? empty}
                  </span>
                  <span className={'subsup-sub-row'} key="sub">
                    {leftSub ?? empty}
                  </span>
                </span>
              );
            }
            if (rightSup || rightSub) {
              subSupResult.push(
                <span className={'subsup'} key="right">
                  <span className={'subsup-sup-row'} key="sup">
                    {rightSup ?? empty}
                  </span>
                  <span className={'subsup-sub-row'} key="sub">
                    {rightSub ?? empty}
                  </span>
                </span>
              );
            }
          } else {
            return (
              <span className={'subsup subsup-full'}>
                <span className={'subsup-sup-row subsup-full-row'} key="sup">
                  {(leftSup || leftSub) ? (leftSup ?? empty) : null}
                  <span className={'subsup-empty'} key="middle"/>
                  {(rightSup || rightSub) ? (rightSup ?? empty) : null}
                </span>
                <span className={'subsup-body-row'} key="body">
                  {(leftSup || leftSub) ? empty : null}
                  <span className={'subsup-body'} key="middle">
                    {subSupResult}
                  </span>
                  {(rightSup || rightSub) ? empty : null}
                </span>
                <span className={'subsup-sub-row subsup-full-row'} key="sub">
                  {(leftSup || leftSub) ? (leftSub ?? empty) : null}
                  <span className={'subsup-empty'} key="middle"/>
                  {(rightSup || rightSub) ? (rightSub ?? empty) : null}
                </span>
              </span>
            );
          }
        }
        return subSupResult;
      };
      let render = expression.body.getLineHeight().then(renderWithLineHeight);
      return this.wrapRenderedExpression(
        renderPromise(render, undefined, renderWithLineHeight),
        { semanticLinks, className }
      );
    } else if (expression instanceof Notation.OverUnderExpression) {
      let innerClassName = 'overunder';
      let over: React.ReactNode = expression.over ? <Expression expression={expression.over} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
      let under: React.ReactNode = expression.under ? <Expression expression={expression.under} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null;
      let rows: React.ReactNode[] = [
        <span className={'overunder-body-row'} key="body">
          <span className={'overunder-body'}>
            <Expression expression={expression.body} parent={this} interactionHandler={this.props.interactionHandler}/>
          </span>
        </span>,
        <span className={'overunder-under-row'} key="under">
          <span className={'overunder-under'}>
            {under}
          </span>
        </span>
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
        innerClassName += ' noover';
      }
      if (!under) {
        innerClassName += ' nounder';
      }
      return this.wrapRenderedExpression(rows, { semanticLinks, className, innerClassName });
    } else if (expression instanceof Notation.FractionExpression) {
      let elements = [
        <span className={'fraction-numerator-row'} key="numerator">
          <span className={'fraction-numerator'}>
            <Expression expression={expression.numerator} parent={this} interactionHandler={this.props.interactionHandler}/>
          </span>
        </span>,
        <span className={'fraction-denominator-row'} key="denominator">
          <span className={'fraction-denominator'}>
            <Expression expression={expression.denominator} parent={this} interactionHandler={this.props.interactionHandler}/>
          </span>
        </span>
      ];
      return this.wrapRenderedExpression(elements, { semanticLinks, className, innerClassName: 'fraction' });
    } else if (expression instanceof Notation.RadicalExpression) {
      let radicalElement = (
        <span className={'radical-row'}>
          <span className={'radical-degree-col'}>
            <span className={'radical-degree-table'}>
              <span className={'radical-degree-top-row'}>
                <span className={'radical-degree'}>
                  {expression.degree ? <Expression expression={expression.degree} shrinkMathSpaces={true} parent={this} interactionHandler={this.props.interactionHandler}/> : null}
                </span>
              </span>
              <span className={'radical-degree-bottom-row'}>
                <span className={'radical-degree-bottom-cell'}>
                  <svg viewBox="0 0 1 1" preserveAspectRatio="xMaxYMax">
                    <line x1="0.1" y1="0.35" x2="0.4" y2="0.1" stroke="var(--foreground-color)" strokeWidth="0.08" strokeLinecap="square"/>
                    <line x1="0.45" y1="0.15" x2="1.05" y2="1" stroke="var(--foreground-color)" strokeWidth="0.2" strokeLinecap="square"/>
                  </svg>
                </span>
              </span>
            </span>
          </span>
          <span className={'radical-diagonal'}>
            <svg viewBox="0 0 1 1" preserveAspectRatio="none">
              <line x1="0" y1="0.965" x2="1.025" y2="0.05" stroke="var(--foreground-color)" strokeWidth="0.1" strokeLinecap="square"/>
            </svg>
          </span>
          <span className={'radical-radicand'}>
            <Expression expression={expression.radicand} parent={this} interactionHandler={this.props.interactionHandler}/>
          </span>
        </span>
      );
      return this.wrapRenderedExpression(radicalElement, { semanticLinks, className, innerClassName: 'radical' });
    } else if (expression instanceof Notation.MarkdownExpression) {
      let markdown: React.ReactNode;
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
        let onSearch = undefined;
        if (expression.searchURLs) {
          let searchURLs = expression.searchURLs;
          onSearch = () => this.openSearchDialog(searchURLs, expression.defaultSearchText);
        }
        if ('ontouchstart' in window) {
          // SimpleMDE currently doesn't work correctly on Android, so don't use it if we have a touch device.
          markdown = <textarea className={'expr-textarea'} value={expression.text} onChange={(event) => onChange(event.target.value)}/>;
          if (onSearch) {
            markdown = (
              <div>
                {markdown}
                <Button className={'standalone'} onClick={onSearch}>Search default references...</Button>
              </div>
            );
          }
        } else {
          let key = 'markdown-editor';
          let toolbar: (string | EasyMDE.ToolbarIcon)[] = ['bold', 'italic', '|', 'unordered-list', 'ordered-list', 'link', 'code', '|', 'preview'];
          if (!config.embedded) {
            toolbar.push('guide');
          }
          if (onSearch) {
            let searchButton: EasyMDE.ToolbarIcon = {
              name: 'search',
              action: onSearch,
              className: 'fa fa-search',
              title: 'Search Default References'
            };
            toolbar.push('|', searchButton);
            key = 'markdown-editor-with-search';
          }
          let previewElement = document.createElement('div');
          let options: EasyMDE.Options = {
            toolbar: toolbar as any,
            status: false,
            spellChecker: false,
            autoDownloadFontAwesome: false,
            previewRender: (markdownPlaintext: string) => {
              ReactDOM.render(this.renderMarkdown(markdownPlaintext, expression.onRenderCode), previewElement);
              return previewElement.innerHTML;
            }
          };
          markdown = <ReactMarkdownEditor value={expression.text} onChange={onChange} options={options} key={key}/>;
        }
      } else {
        markdown = this.renderMarkdown(expression.text, expression.onRenderCode);
      }
      return (
        <div className={className + ' markdown'}>
          {markdown}
          {this.renderDialog()}
        </div>
      );
    } else if (expression instanceof Notation.FoldableExpression) {
      className += ' foldable';
      let unfolded = this.state.unfolded ?? expression.initiallyUnfolded;
      let onClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button < 1) {
          this.setState({unfolded: !unfolded});
          eventHandled(event);
        }
      };
      let rows = [
        <div className={'paragraph foldable-heading'} onClick={onClick} key={'heading'}>
          <span className={'foldable-icon'}>{getSectionIcon(unfolded)}</span>
          <Expression expression={expression.heading} parent={this} interactionHandler={this.props.interactionHandler}/>
        </div>
      ];
      if (unfolded) {
        rows.push(
          <div className={'paragraph'} key={'contents'}>
            <Expression expression={expression.contents} parent={this} interactionHandler={this.props.interactionHandler}/>
          </div>
        );
      }
      return this.wrapRenderedExpression(rows, { semanticLinks, className });
    } else if (expression instanceof Notation.IndirectExpression) {
      return this.renderExpression(expression.resolve(), className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else if (expression instanceof Notation.PromiseExpression) {
      let render = expression.promise.then((innerExpression: Notation.RenderedExpression) => this.renderExpression(innerExpression, className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle));
      return <PromiseHelper promise={render}/>;
    } else if (expression instanceof Notation.AssociativeExpression) {
      return this.renderExpression(expression.body, className, semanticLinks);
    } else if (expression instanceof Notation.AbstractDecoratedExpression) {
      return this.renderExpression(expression.body, className, semanticLinks, optionalParenLeft, optionalParenRight, optionalParenMaxLevel, optionalParenStyle);
    } else if (expression instanceof Notation.PlaceholderExpression) {
      className += ' placeholder';
      let icon: React.ReactNode;
      if (expression instanceof Notation.InsertPlaceholderExpression) {
        let buttonType = (expression.mandatory ? ButtonType.InsertMandatory : ButtonType.Insert);
        let hasSemanticLinkMenu = (semanticLinks ?? []).some(semanticLink => !!semanticLink.onMenuOpened);
        let enabled = (expression.action !== undefined || hasSemanticLinkMenu || this.props.interactionHandler === undefined);
        icon = getButtonIcon(buttonType, enabled);
      } else {
        icon = getDefinitionIcon(expression.placeholderType);
      }
      return this.wrapRenderedExpression(
        <span className={'menu-placeholder'}>{icon}</span>,
        { semanticLinks, className, expression }
      );
    } else {
      className += ' error';
      let error = expression instanceof Notation.ErrorExpression ? expression.errorMessage : 'Unknown expression type';
      return this.wrapRenderedExpression(`Error: ${error}`, { semanticLinks, className });
    }
  }

  private wrapRenderedExpressionWithMenuStuff(
    content: React.ReactNode,
    expression: Notation.PlaceholderExpression | undefined,
    semanticLinks: Notation.SemanticLink[] | undefined,
    onMenuOpened: (() => Menu.ExpressionMenu) | undefined = undefined,
    hasMenu: boolean,
    hasVisibleMenu: boolean,
    className: string,
    innerClassName: string
  ): React.ReactNode {
    let menu: React.ReactNode = null;
    let dialog = this.renderDialog();
    if (dialog) {
      menu = dialog;
    } else if (this.state.openMenu) {
      menu = <ExpressionMenu menu={this.state.openMenu} onItemClicked={this.onMenuItemClicked} key="menu" interactionHandler={this.props.interactionHandler}/>;
    }
    let interactive = hasMenu;
    let onMouseDown = hasMenu ? (event: React.MouseEvent<HTMLElement>) => (event.button < 1 && this.menuClicked(onMenuOpened!, event)) : undefined;
    let onMouseUp = hasMenu ? (event: React.MouseEvent<HTMLElement>) => (event.button < 1 && eventHandled(event)) : undefined;
    let onClick = hasMenu ? (event: React.MouseEvent<HTMLElement>) => (event.button < 1 && eventHandled(event)) : undefined;
    if (expression instanceof Notation.InsertPlaceholderExpression && expression.action && !hasMenu) {
      onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
        if (event.button < 1) {
          this.setState({clicking: true});
          eventHandled(event);
        }
      };
      onMouseUp = (event: React.MouseEvent<HTMLElement>) => {
        if (event.button < 1) {
          this.setState({clicking: false});
          eventHandled(event);
        }
      };
      onClick = (event: React.MouseEvent<HTMLElement>) => (event.button < 1 && this.actionClicked(expression.action!, event));
      interactive = true;
      if (!semanticLinks) {
        this.semanticLinks = semanticLinks = [new Notation.SemanticLink(expression, false, false)];
      }
    }
    let onMouseEnter = interactive ? () => this.addToHoveredChildren() : undefined;
    let onMouseLeave = interactive ? () => { this.setState({clicking: false}); this.removeFromHoveredChildren(); } : undefined;
    let menuClassName = 'menu';
    if (this.state.hovered) {
      menuClassName += ' hover';
    }
    if (interactive) {
      menuClassName += ' interactive';
      if (hasMenu) {
        if (!hasVisibleMenu) {
          menuClassName += ' hidden';
        }
      } else {
        if (this.state.clicking) {
          menuClassName += ' pressed';
        }
      }
    }
    if (this.state.openMenu) {
      menuClassName += ' open';
    }
    let cells: React.ReactNode;
    let outerClassNameSuffix = '';
    if (innerClassName) {
      // Correct rendering of inline menus is a bit tricky.
      // If innerClassName is set, we are not allowed to nest any additional elements between the
      // one annotated with innerClassName and the current result; in particular we will break
      // CSS rules by doing so. Moreover, we must be careful not to break apart className and
      // innerClassName, as some conditions in Expression.css expect them to be on the same level.
      // On the other hand, some conditions related e.g. to alignment only work if className is
      // assigned to the outermost element. Therefore we do that whenever we can, and hope for the
      // best.
      content = <span className={`${className} ${innerClassName}`}>{content}</span>;
    } else {
      outerClassNameSuffix = ' ' + className;
    }
    if (expression !== undefined) {
      cells = <span className={'menu-placeholder-cell'}>{content}</span>;
    } else if (hasVisibleMenu) {
      cells = [
        <span className={'menu-cell'} key="content">{content}</span>,
        <span className={'menu-dropdown-cell'} key="dropdown">&nbsp;▼&nbsp;</span>
      ];
    } else {
      cells = <span className={'menu-cell'} key="content">{content}</span>;
    }
    return (
      <span className={'menu-container' + outerClassNameSuffix} onTouchStart={(event) => event.stopPropagation()} onTouchCancel={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
        <span className={menuClassName} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onClick={onClick} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          <span className={'menu-row'}>
            {cells}
          </span>
        </span>
        {menu}
      </span>
    );
  }

  private wrapRenderedExpression(
    content: React.ReactNode,
    { semanticLinks, className, innerClassName = '', isInputControl = false, expression }: {
      semanticLinks: Notation.SemanticLink[] | undefined,
      className: string,
      innerClassName?: string,
      isInputControl?: boolean,
      expression?: Notation.PlaceholderExpression
    }
  ): React.ReactNode {
    let result = content;
    let onMenuOpened: (() => Menu.ExpressionMenu) | undefined = undefined;
    let alwaysShowMenu = false;
    if (semanticLinks) {
      for (let semanticLink of semanticLinks) {
        if (semanticLink.onMenuOpened) {
          onMenuOpened = semanticLink.onMenuOpened;
          alwaysShowMenu = semanticLink.alwaysShowMenu || expression !== undefined;
          if (semanticLink.autoOpenMenu && !this.autoOpenTimer) {
            let autoOpenMenu = () => {
              if (onMenuOpened && !this.state.openMenu) {
                this.openMenu(onMenuOpened);
              }
            };
            this.autoOpenTimer = setTimeout(autoOpenMenu, 0);
          }
        }
      }
    }
    if (semanticLinks && semanticLinks.some((semanticLink) => semanticLink.isDefinition)) {
      className += ' definition';
    }
    let hasMenu = this.props.interactionHandler !== undefined && onMenuOpened !== undefined;
    this.hasMenu = hasMenu;
    let hasVisibleMenu = hasMenu && (alwaysShowMenu || this.isDirectlyHighlighted());
    if (hasMenu || expression !== undefined) {
      return this.wrapRenderedExpressionWithMenuStuff(result, expression, semanticLinks, onMenuOpened, hasMenu, hasVisibleMenu, className, innerClassName);
    } else {
      className += ' ' + innerClassName;
      if (this.state.hovered) {
        className += ' hover';
      }
      if (this.props.interactionHandler && semanticLinks && semanticLinks.length && (isInputControl || !this.isPartOfMenu())) {
        className += ' interactive';
        let uriLink: Notation.SemanticLink | undefined = undefined;
        let uri: string | undefined = undefined;
        for (let semanticLink of semanticLinks) {
          let linkUri = this.props.interactionHandler.getURI(semanticLink);
          if (linkUri) {
            uriLink = semanticLink;
            uri = linkUri;
            className += ' link';
          }
        }
        if (uri && !(config.development || config.embedded)) {
          // This causes nested anchors, which, strictly speaking, are illegal.
          // However, there does not seem to be any replacement that supports middle-click for "open in new window/tab".
          // So we do this anyway, but only in production mode, to prevent warnings from React.
          result = (
            <a className={className} href={uri} onMouseEnter={() => this.addToHoveredChildren()} onMouseLeave={() => this.removeFromHoveredChildren()} onTouchStart={(event) => this.highlightPermanently(event)} onTouchEnd={(event) => eventHandled(event)} onClick={(event) => (event.button < 1 && this.linkClicked(uriLink, event))} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
              {result}
            </a>
          );
        } else {
          result = (
            <span className={className} onMouseEnter={() => this.addToHoveredChildren()} onMouseLeave={() => this.removeFromHoveredChildren()} onTouchStart={(event) => this.highlightPermanently(event)} onTouchEnd={(event) => eventHandled(event)} onClick={(event) => (event.button < 1 && this.linkClicked(uriLink, event))} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
              {result}
            </span>
          );
        }
        if (uriLink && this.props.interactionHandler.hasToolTip(uriLink) && this.htmlNode) {
          let interactionHandler = this.props.interactionHandler;
          let getToolTipContents = () => {
            let toolTipContents = interactionHandler.getToolTipContents(uriLink!);
            if (uri) {
              toolTipContents = <a href={uri} onClick={(event) => (event.button < 1 && this.linkClicked(uriLink, event))}>{toolTipContents}</a>;
            }
            return toolTipContents;
          };
          let toolTip = <ExpressionToolTip active={this.state.showToolTip} position={this.toolTipPosition} parent={this.htmlNode} getContents={getToolTipContents} delay={250} key="tooltip"/>;
          result = [result, toolTip];
        }
      } else {
        result = (
          <span className={className}>
            {result}
          </span>
        );
      }
      let dialog = this.renderDialog();
      return dialog ? [result, dialog] : result;
    }
  }

  private renderDialog(): React.ReactNode {
    if (this.state.openDialog) {
      if (this.state.openDialog instanceof Dialog.InsertDialog) {
        return <InsertDialog dialog={this.state.openDialog} onOK={this.onDialogOK} onCancel={this.onDialogClosed}/>;
      } else if (this.state.openDialog instanceof Dialog.ExpressionDialog) {
        return <ExpressionDialog dialog={this.state.openDialog} onOK={this.onDialogOK} onCancel={this.onDialogClosed}/>;
      }
    }
    return null;
  }

  private convertText(text: string): React.ReactNode {
    let converter = new ExpressionUnicodeConverter;
    let options: UnicodeConversionOptions = {
      convertStandardCharacters: true,
      shrinkMathSpaces: this.shrinkMathSpaces
    };
    convertUnicode(text, converter, options);
    if (converter.result.length === 1) {
      return converter.result[0];
    } else {
      return converter.result;
    }
  }

  private renderMarkdown(text: string, renderCode?: (code: string) => Notation.RenderedExpression): React.ReactElement {
    let md = new Remarkable({
      linkTarget: '_blank',
      typographer: true
    });
    md.use(linkify);
    let options = undefined;
    if (renderCode) {
      options = {
        components: {
          code: (props: any) => {
            if (typeof props.content === 'string') {
              return <Expression expression={renderCode(props.content)} interactionHandler={this.props.interactionHandler}/>;
            }
            return <code>{props.content}</code>;
          }
        }
      };
    }
    md.renderer = new RemarkableReactRenderer(options);
    return md.render(text);
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
        let hover: Notation.SemanticLink[] = [];
        for (let expression of this.hoveredChildren) {
          if (expression.isDirectlyHovered() && expression.semanticLinks) {
            hover.push(...expression.semanticLinks);
          }
        }
        this.props.interactionHandler.hoverChanged(hover);
      }
      if (this.isDirectlyHovered()) {
        if (!this.props.interactionHandler.isBlocked()) {
          this.setState({showToolTip: true});
        }
      } else {
        this.setState((prevState: ExpressionState) => prevState.showToolTip ? {showToolTip: false} : null);
      }
    }
  }

  private isDirectlyHovered(): boolean {
    return (this.hoveredChildren.length === 1 && this.hoveredChildren[0] === this) || this.permanentlyHighlighted;
  }

  private onHoverChanged = (hover: Object[]): void => {
    let hovered = this.isHovered(hover);
    this.setState((prevState: ExpressionState) => prevState.hovered !== hovered ? {hovered: hovered} : null);
  };

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

  private triggerHighlightPermanently(): void {
    if (this.highlightPermanentlyTimer) {
      clearTimeout(this.highlightPermanentlyTimer);
    }
    this.highlightPermanentlyTimer = setTimeout(() => this.highlightPermanently(), 0);
  }

  private highlightPermanently(event?: React.SyntheticEvent<HTMLElement>): void {
    this.clearAllPermanentHighlights();
    if (!this.semanticLinks) {
      return;
    }
    if (event) {
      eventHandled(event);
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
    this.clearOpenMenu();
    this.disableWindowClickListener();
    this.disableInteractionBlocker(this.props);
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
    return false;
    // return (this.state.hovered && this.hoveredChildren.indexOf(this) >= 0) || this.permanentlyHighlighted || this.state.openMenu !== undefined;
  }

  private linkClicked(semanticLink: Notation.SemanticLink | undefined, event: React.SyntheticEvent<HTMLElement>): void {
    this.setState({clicking: false});
    eventHandled(event);
    if (this.props.interactionHandler && !this.props.interactionHandler.isBlocked() && semanticLink) {
      this.props.interactionHandler.linkClicked(semanticLink);
    }
  }

  private actionClicked(action: Menu.ExpressionMenuAction, event: React.SyntheticEvent<HTMLElement>): void {
    if (this.props.interactionHandler && this.props.interactionHandler.isBlocked()) {
      return;
    }
    this.setState({clicking: false});
    eventHandled(event);
    if (action instanceof Menu.ImmediateExpressionMenuAction) {
      let result = action.onExecute();
      if (!(result instanceof CachedPromise)) {
        result = CachedPromise.resolve();
      }
      result.then(() => {
        if (this.props.interactionHandler) {
          this.props.interactionHandler.expressionChanged();
        }
      });
    } else if (action instanceof Menu.DialogExpressionMenuAction) {
      this.enableInteractionBlocker(this.props);
      this.setState({
        openDialog: action.onOpen()
      });
    }
  }

  private menuClicked(onMenuOpened: () => Menu.ExpressionMenu, event: React.SyntheticEvent<HTMLElement>): void {
    if (this.state.openMenu) {
      this.closeMenu();
    } else {
      if (this.props.interactionHandler && this.props.interactionHandler.isBlocked()) {
        return;
      }
      this.openMenu(onMenuOpened);
    }
    eventHandled(event);
  }

  private openMenu(onMenuOpened: () => Menu.ExpressionMenu): void {
    this.enableInteractionBlocker(this.props);
    this.clearHoverAndMenuRecursively();
    this.setState({openMenu: onMenuOpened()});
    this.enableWindowClickListener();
  }

  private closeMenu(): void {
    this.disableInteractionBlocker(this.props);
    if (!this.permanentlyHighlighted) {
      this.disableWindowClickListener();
    }
    this.setState({openMenu: undefined});
    this.addToHoveredChildren();
  }

  private onMenuItemClicked = (action: Menu.ExpressionMenuAction) => {
    if (action instanceof Menu.ImmediateExpressionMenuAction) {
      let result = action.onExecute();
      if (!(result instanceof CachedPromise)) {
        result = CachedPromise.resolve();
      }
      result.then(() => {
        this.disableInteractionBlocker(this.props);
        this.clearPermanentHighlight();
        if (this.props.interactionHandler) {
          this.props.interactionHandler.expressionChanged();
        }
      });
    } else if (action instanceof Menu.DialogExpressionMenuAction) {
      this.disableWindowClickListener();
      this.setState({
        openMenu: undefined,
        openDialog: action.onOpen()
      });
    }
  };

  private onDialogOK = (result: Dialog.DialogResultBase) => {
    let dialog = this.state.openDialog;
    this.clearPermanentHighlight();
    if (dialog && dialog.onOK) {
      dialog.onOK(result);
    }
    if (this.props.interactionHandler) {
      this.props.interactionHandler.expressionChanged();
    }
  };

  private onDialogClosed = () => {
    this.disableInteractionBlocker(this.props);
    this.clearPermanentHighlight();
  };

  private openSearchDialog(searchURLs: Notation.MarkdownExpressionSearchURL[], defaultSearchText?: string): void {
    let searchText = defaultSearchText || '';
    let searchTextExpression = new Notation.TextExpression(searchText);
    searchTextExpression.onTextChanged = (newText: string) => {
      searchText = newText;
      return true;
    };
    searchTextExpression.requestTextInput = true;
    searchTextExpression.inputLength = 20;
    let items = [
      new Dialog.ExpressionDialogParameterItem('Search default references for', () => searchTextExpression),
      new Dialog.ExpressionDialogSeparatorItem
    ];
    for (let searchUrl of searchURLs) {
      items.push(new Dialog.ExpressionDialogLinkItem(searchUrl.title, () => (searchUrl.searchUrlPrefix + encodeURI(searchText))));
    }
    let dialog = new Dialog.ExpressionDialog(items);
    if (!config.embedded) {
      dialog.onOK = () => {
        for (let searchUrl of searchURLs) {
          window.open(searchUrl.searchUrlPrefix + encodeURI(searchText), '_blank');
        }
      };
    }
    dialog.onCheckOKEnabled = () => (searchText.length !== 0);
    dialog.onCheckUpdateNeeded = () => true;
    this.setState({openDialog: dialog});
  }
}

export default Expression;
