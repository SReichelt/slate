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

  constructor(props: ExpressionProps) {
    super(props);

    this.state = {
      showPreview: false
    };

    this.updateInteraction(props);
  }

  componentWillReceiveProps(props: ExpressionProps) {
    this.updateInteraction(props);
  }

  private updateInteraction(props: ExpressionProps) {
    if (props.interactionHandler) {
      this.interactionHandler = props.interactionHandler;
    } else if (props.parent) {
      this.interactionHandler = props.parent.interactionHandler;
    }
    if (props.parent) {
      this.setGlobalHover(props.hover);
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
      if (text.length) {
        text = text.replace('  ', ' \xa0');
        if (text.startsWith(' ')) {
          text = '\xa0' + text.substring(1);
        }
        if (text.endsWith(' ')) {
          text = text.substring(0, text.length - 1) + '\xa0';
        }
        let lineBreakPos = text.indexOf('\n');
        if (lineBreakPos >= 0) {
          result = [];
          do {
            result.push(text.substring(0, lineBreakPos));
            result.push(<br/>);
            text = text.substring(lineBreakPos + 1);
          } while (lineBreakPos > 0);
          result.push(text);
        } else {
          result = text;
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
          let rightSub = null;
          let rightSup = null;
          let rightEmpty = null;
          if (subSupExpression.sub) {
            rightSub = (
              <span className={'subsup-right-sub'} key="sub">
                <Expression expression={subSupExpression.sub} parent={this} hover={this.hover}/>
              </span>
            );
            rightEmpty = <span className={'subsup-empty'} key="empty"/>;
          }
          if (subSupExpression.sup) {
            rightSup = (
              <span className={'subsup-right-sup'} key="sup">
                <Expression expression={subSupExpression.sup} parent={this} hover={this.hover}/>
              </span>
            );
            rightEmpty = <span className={'subsup-empty'} key="empty"/>;
          }
          let leftSub = null;
          let leftSup = null;
          let leftEmpty = null;
          if (subSupExpression.preSub) {
            leftSub = (
              <span className={'subsup-left-sub'} key="sub">
                <Expression expression={subSupExpression.preSub} parent={this} hover={this.hover}/>
              </span>
            );
            leftEmpty = <span className={'subsup-empty'} key="empty"/>;
          }
          if (subSupExpression.preSup) {
            leftSup = (
              <span className={'subsup-left-sup'} key="sup">
                <Expression expression={subSupExpression.preSup} parent={this} hover={this.hover}/>
              </span>
            );
            leftEmpty = <span className={'subsup-empty'} key="empty"/>;
          }
          if (lineHeight) {
            subSupResult = [subSupResult];
            if (leftSup || leftSub) {
              subSupResult.unshift(
                <span className={'subsup'} key="left">
                  <span className={'subsup-sup-row'} key="sup">
                    {leftSup ? leftSup : leftEmpty}
                  </span>
                  <span className={'subsup-sub-row'} key="sub">
                    {leftSub ? leftSub : leftEmpty}
                  </span>
                </span>
              );
            }
            if (rightSup || rightSub) {
              subSupResult.push(
                <span className={'subsup'} key="right">
                  <span className={'subsup-sup-row'} key="sup">
                    {rightSup ? rightSup : leftEmpty}
                  </span>
                  <span className={'subsup-sub-row'} key="sub">
                    {rightSub ? rightSub : leftEmpty}
                  </span>
                </span>
              );
            }
          } else {
            let rows = [(
              <span className={'subsup-body-row'} key="body">
                {leftEmpty}
                <span className={'subsup-body'} key="middle">
                  {subSupResult}
                </span>
                {rightEmpty}
              </span>
            )];
            if (leftSup || rightSup) {
              rows.unshift(
                <span className={'subsup-sup-row'} key="sup">
                  {leftSup}
                  <span className={'subsup-empty'} key="middle"/>
                  {rightSup}
                </span>
              );
            }
            if (leftSub || rightSub) {
              rows.push(
                <span className={'subsup-sub-row'} key="sub">
                  {leftSub}
                  <span className={'subsup-empty'} key="middle"/>
                  {rightSub}
                </span>
              );
            }
            subSupResult = (
              <span className={'subsup'}>
                {rows}
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
                    <line x1="0.5" y1="0.12" x2="1.1" y2="1" stroke="black" strokeWidth="0.2" strokeLinecap="square"/>
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
      let immediateResult = expression.promise.getImmediateResult();
      if (immediateResult) {
        return this.renderExpression(immediateResult, className, semanticLink, optionalParenLeft, optionalParenRight, optionalParenMaxLevel);
      } else {
        let render = expression.promise.then((innerExpression: Display.RenderedExpression) => this.renderExpression(innerExpression, className, semanticLink, optionalParenLeft, optionalParenRight, optionalParenMaxLevel));
        return renderPromise(render);
      }
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
          && ((this.state.ownHover === this.hover)
              || (this.hover.showAllReferences && semanticLink.linkedObject && this.hover.linkedObject === semanticLink.linkedObject))) {
        className += ' hover';
      }
      let uri = this.interactionHandler.getURI(semanticLink);
      if (uri) {
        result = (
          <a className={className} href={uri} onMouseEnter={() => this.setOwnHover(semanticLink)} onMouseLeave={() => this.setOwnHover(undefined)} onClick={(event) => this.linkClicked(semanticLink, event)} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
            {result}
          </a>
        );
      } else {
        result = (
          <span className={className} onMouseEnter={() => this.setOwnHover(semanticLink)} onMouseLeave={() => this.setOwnHover(undefined)} key="expr" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
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
      this.setGlobalHover(hover);
      this.forceUpdate();
    }
  }

  private setGlobalHover(hover: Display.SemanticLink | undefined): void {
    if (this.hover !== hover) {
      this.hover = hover;
      if (hover && (!this.state.ownHover || this.state.ownHover === this.hover)) {
        let update = () => {
          if (this.hover) {
            this.setState((prevState) => ({showPreview: prevState.ownHover === this.hover}));
          }
        };
        setTimeout(update, 250);
      } else {
        this.setState({showPreview: false});
      }
    }
  }

  private linkClicked(semanticLink: Display.SemanticLink | undefined, event: any): void {
    if (event.button < 1) {
      event.preventDefault();
      if (this.interactionHandler && semanticLink && this.hover && this.hover === this.state.ownHover) {
        this.interactionHandler.linkClicked(semanticLink);
      }
    }
  }
}

export default Expression;
