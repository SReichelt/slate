import * as React from 'react';
import clsx from 'clsx';
import scrollIntoView from 'scroll-into-view-if-needed';
const Loading = require('react-loading-animation');

import './ExpressionMenu.css';

import Expression, { ExpressionInteractionHandler } from './Expression';
import ExpressionToolTip from './ExpressionToolTip';
import UnicodeTextInput from './UnicodeTextInput';
import { renderPromise } from './PromiseHelper';

import { disableDefaultBehavior, limitDefaultBehaviorToElement } from '../utils/event';
import { getButtonIcon, ButtonType, getDefinitionIcon } from '../utils/icons';

import * as Notation from 'slate-shared/notation/notation';
import * as Menu from 'slate-shared/notation/menu';
import CachedPromise from 'slate-shared/data/cachedPromise';
import config from '../utils/config';


const clickDelay = 100;

// Explicitly determine the main font style from the document body, as it seems to be the only way to restore the initial size
// in a way that works in both the standalone and embedded cases.
function getMainFontStyle(): React.CSSProperties {
  const result: React.CSSProperties = {};
  const bodyStyle = window.getComputedStyle(document.body);
  if (bodyStyle.fontFamily) {
    result.fontFamily = bodyStyle.fontFamily;
  }
  if (bodyStyle.fontSize) {
    result.fontSize = bodyStyle.fontSize;
  }
  return result;
}

export interface ExpressionMenuProps {
  menu: Menu.ExpressionMenu;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  hoveredExternally?: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

export interface ExpressionMenuState {
  openSubMenu?: Menu.ExpressionMenuRow;
}

class ExpressionMenu extends React.Component<ExpressionMenuProps, ExpressionMenuState> {
  private scrolled = false;

  constructor(props: ExpressionMenuProps) {
    super(props);
    this.state = {};
  }

  render(): React.ReactNode {
    const contentPromise = this.props.menu.rows.then((menuRows: Menu.ExpressionMenuRow[]) => {
      const rows = [];
      let index = 0;
      let separated = false;
      for (const row of menuRows) {
        if (row instanceof Menu.ExpressionMenuSeparator) {
          if (index) {
            separated = true;
          }
        } else {
          if (separated) {
            rows.push(<tr className={'open-menu-row'} key={`separator-${index}`}><td className={'open-menu-separator'} colSpan={2}/></tr>);
          }
          const onEnter = (openSubMenu: boolean = false) => this.setState({openSubMenu: openSubMenu ? row : undefined});
          const hoveredExternally = this.props.hoveredExternally && index === 0;
          const subMenuOpen = (this.state.openSubMenu === row);
          let key: number | string = index;
          if (row instanceof Menu.StandardExpressionMenuRow && row.title instanceof Notation.TextExpression) {
            key = row.title.text;
          }
          rows.push(<ExpressionMenuRow row={row} onItemClicked={this.props.onItemClicked} onEnter={onEnter} hoveredExternally={hoveredExternally} subMenuOpen={subMenuOpen} interactionHandler={this.props.interactionHandler} key={key}/>);
          index++;
          separated = false;
        }
      }
      const className = clsx('open-menu', {
        'variable': this.props.menu.variable
      });
      const ref = (htmlNode: HTMLDivElement | null) => {
        if (htmlNode && !this.scrolled) {
          this.scrolled = true;
          scrollIntoView(htmlNode, {
            scrollMode: 'if-needed',
            block: 'end',
            inline: 'end'
          });
        }
      };
      return (
        <div
          className={className}
          style={getMainFontStyle()}
          onMouseDown={disableDefaultBehavior}
          onMouseUp={limitDefaultBehaviorToElement}
          onTouchStart={limitDefaultBehaviorToElement}
          onTouchCancel={limitDefaultBehaviorToElement}
          onTouchEnd={limitDefaultBehaviorToElement}
          ref={ref}
        >
          <table className={'open-menu-table'}>
            <tbody>
              {rows}
            </tbody>
          </table>
        </div>
      );
    });

    return renderPromise(contentPromise);
  }
}

export interface ExpressionMenuRowProps {
  row: Menu.ExpressionMenuRow;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  onEnter?: (openSubMenu?: boolean) => void;
  onLeave?: () => void;
  embedded?: boolean;
  hoveredExternally?: boolean;
  subMenuOpen?: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

export interface ExpressionMenuRowState {
  titleHovered: boolean;
  contentsHovered: boolean;
}

interface ExpressionMenuInputRefHolder {
  inputRef?: HTMLElement | null;
}

export class ExpressionMenuRow extends React.Component<ExpressionMenuRowProps, ExpressionMenuRowState> {
  private inputRefHolder: ExpressionMenuInputRefHolder = {};
  private ready = false;
  private titleNode: HTMLElement | null = null;

  constructor(props: ExpressionMenuRowProps) {
    super(props);

    this.state = {
      titleHovered: false,
      contentsHovered: false
    };
  }

  componentDidMount(): void {
    if (config.testing) {
      this.ready = true;
    } else {
      this.ready = false;
      setTimeout(() => (this.ready = true), clickDelay);
    }
  }

  componentDidUpdate(prevProps: ExpressionMenuRowProps): void {
    if (this.props.row !== prevProps.row && !config.testing) {
      this.ready = false;
      setTimeout(() => (this.ready = true), clickDelay);
    }
  }

  render(): React.ReactNode {
    let cellsPromise: CachedPromise<React.ReactNode> = CachedPromise.resolve(null);
    const row = this.props.row;
    if (row instanceof Menu.ExpressionMenuItem) {
      cellsPromise = CachedPromise.resolve(<ExpressionMenuItem item={row} colSpan={2} onItemClicked={this.props.onItemClicked} onEnter={this.props.onEnter} onLeave={this.props.onLeave} hoveredExternally={this.props.hoveredExternally} interactionHandler={this.props.interactionHandler}/>);
    } else if (row instanceof Menu.ExpressionMenuItemList) {
      cellsPromise = row.items.then((items: Menu.ExpressionMenuItem[]) => {
        if (items.length) {
          return items.map((item: Menu.ExpressionMenuItem, index: number) => <ExpressionMenuItem item={item} key={index} onItemClicked={this.props.onItemClicked} onEnter={this.props.onEnter} onLeave={this.props.onLeave} interactionHandler={this.props.interactionHandler}/>);
        } else {
          return null;
        }
      });
    } else if (row instanceof Menu.StandardExpressionMenuRow) {
      const standardRow = row;
      const subMenuRowsPromise = row.subMenu instanceof Menu.ExpressionMenu ? row.subMenu.rows : CachedPromise.resolve([]);
      cellsPromise = subMenuRowsPromise.then((subMenuRows: Menu.ExpressionMenuRow[]) => {
        let contentCell: React.ReactNode = null;
        let onClick = undefined;
        let titleAction = standardRow.titleAction;
        const itemHovered = this.props.hoveredExternally || (this.state.titleHovered && !standardRow.titleAction);
        let subMenuMainRow: Menu.ExpressionMenuRow | undefined = undefined;
        if (standardRow.previewSubMenu) {
          if (standardRow.subMenu instanceof Menu.ExpressionMenu && subMenuRows.length) {
            subMenuMainRow = subMenuRows[0];
            for (const subMenuRow of subMenuRows) {
              if (subMenuRow.isSelected()) {
                subMenuMainRow = subMenuRow;
                break;
              }
            }
          } else if (standardRow.subMenu instanceof Menu.ExpressionMenuRow) {
            subMenuMainRow = standardRow.subMenu;
          } else if (!titleAction) {
            return null;
          }
          if (subMenuMainRow) {
            const onEnter = () => {
              this.setState({contentsHovered: true});
              if (this.props.onEnter) {
                this.props.onEnter(false);
              }
            };
            const onLeave = () => {
              this.setState({contentsHovered: false});
              if (this.props.onLeave) {
                this.props.onLeave();
              }
            };
            if (subMenuMainRow instanceof Menu.ExpressionMenuItem) {
              contentCell = <ExpressionMenuItem item={subMenuMainRow} key="content" onItemClicked={this.props.onItemClicked} onEnter={onEnter} onLeave={onLeave} hoveredExternally={itemHovered} interactionHandler={this.props.interactionHandler}/>;
              if (!titleAction) {
                titleAction = subMenuMainRow.action;
              }
            } else if (subMenuMainRow instanceof Menu.ExpressionMenuTextInput) {
              contentCell = <ExpressionMenuTextInput item={subMenuMainRow} key="content" onItemClicked={this.props.onItemClicked} onEnter={onEnter} onLeave={onLeave} hoveredExternally={itemHovered} inputRefHolder={this.inputRefHolder}/>;
              onClick = (event: React.SyntheticEvent<HTMLElement>) => {
                const input = this.inputRefHolder.inputRef;
                if (input) {
                  input.focus();
                }
                event.stopPropagation();
              };
            } else {
              // TODO (low priority) support submenus in content cell
              contentCell = (
                <td className={'open-menu-content-cell'} key="content">
                  <table className={'open-menu-content-cell-table'}>
                    <tbody>
                      <ExpressionMenuRow row={subMenuMainRow} onItemClicked={this.props.onItemClicked} onEnter={onEnter} onLeave={onLeave} embedded={true} interactionHandler={this.props.interactionHandler}/>
                    </tbody>
                  </table>
                </td>
              );
            }
          }
        }
        let title: any = standardRow.title;
        let titleCellClassName = 'open-menu-title-cell';
        if (title instanceof Notation.RenderedExpression) {
          title = <Expression expression={title} key="title"/>;
          if (!standardRow.subMenu) {
            titleCellClassName = 'open-menu-item';
          }
        }
        if (titleAction) {
          titleCellClassName = clsx(titleCellClassName, 'clickable');
          onClick = (event: React.SyntheticEvent<HTMLElement>) => {
            if (this.ready) {
              this.props.onItemClicked(titleAction!);
            }
            disableDefaultBehavior(event);
          };
          if (titleAction instanceof Menu.DialogExpressionMenuAction) {
            title = [title, '...'];
          }
        }
        if (standardRow.iconType !== undefined) {
          let icon: React.ReactNode = null;
          if (typeof standardRow.iconType === 'string') {
            switch (standardRow.iconType) {
            case 'remove':
              icon = getButtonIcon(ButtonType.Remove);
              break;
            }
          } else {
            icon = getDefinitionIcon(standardRow.iconType);
          }
          if (icon) {
            title = [<span className={'open-menu-title-cell-icon'} key="icon">{icon}</span>, title];
          }
        }
        if (standardRow.examples && !this.props.embedded) {
          const exampleCells = standardRow.examples.map((example: Notation.RenderedExpression, index: number) => (
            <td className={'open-menu-example-cell'} key={index}>
              <Expression expression={example} interactionHandler={this.props.interactionHandler}/>
            </td>
          ));
          title = (
            <table className={'open-menu-example-table'} key="title">
              <tbody>
                <tr className={'open-menu-example-row'}>
                  <td className={'open-menu-main-cell'} key="title">{title}</td>
                  {exampleCells}
                </tr>
              </tbody>
            </table>
          );
        }
        if (standardRow.info && this.titleNode) {
          const info = standardRow.info;
          const getToolTipContents = () => <Expression expression={info}/>;
          title = [title, <ExpressionToolTip active={this.state.titleHovered} position="right" parent={this.titleNode} getContents={getToolTipContents} delay={100} key="tooltip"/>];
        }
        titleCellClassName = clsx(titleCellClassName, {
          'hover': this.state.titleHovered || this.state.contentsHovered || this.props.subMenuOpen,
          'selected': standardRow.isSelected()
        });
        let hasSubMenu = false;
        const onMouseEnter = () => {
          this.setState({titleHovered: true});
          if (this.props.onEnter) {
            this.props.onEnter(hasSubMenu);
          }
        };
        const onMouseLeave = () => {
          this.setState({titleHovered: false});
          if (this.props.onLeave) {
            this.props.onLeave();
          }
        };
        if (standardRow.subMenu instanceof Menu.ExpressionMenu && subMenuRows.length > 1) {
          hasSubMenu = true;
          // TODO if the menu was opened by touching and we have a title action, separate the arrow from the title
          title = (
            <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseUp={onClick} ref={(node) => (this.titleNode = node)} key="title">
              {title}
              <span key="arrow">&nbsp;&nbsp;&nbsp;&nbsp;<span className={'open-menu-arrow'}>&nbsp;▶&nbsp;</span></span>
            </div>
          );
          if (this.props.subMenuOpen) {
            const subMenu = (
              <ExpressionMenu menu={standardRow.subMenu} onItemClicked={this.props.onItemClicked} hoveredExternally={subMenuMainRow && itemHovered} interactionHandler={this.props.interactionHandler} key="sub-menu"/>
            );
            title = [title, subMenu];
          }
        } else {
          title = <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseUp={onClick} ref={(node) => (this.titleNode = node)} key="title">{title}</div>;
        }
        const colSpan = contentCell ? 1 : 2;
        let cells: React.ReactNode = <th colSpan={colSpan} className={titleCellClassName} key="title">{title}</th>;
        if (contentCell) {
          cells = [cells, contentCell];
        }
        if (standardRow.subMenu instanceof Menu.ExpressionMenuItemList) {
          return standardRow.subMenu.items.then((items: Menu.ExpressionMenuItem[]) => {
            if (items.length) {
              return cells;
            } else {
              return null;
            }
          });
        } else {
          return cells;
        }
      });
    } else if (row instanceof Menu.ExpressionMenuTextInput) {
      cellsPromise = CachedPromise.resolve(<ExpressionMenuTextInput item={row} colSpan={2} onItemClicked={this.props.onItemClicked} inputRefHolder={this.inputRefHolder}/>);
    }

    const className = 'open-menu-row';

    const resultPromise = cellsPromise.then((cells: React.ReactNode) => {
      if (cells) {
        return (
          <tr className={className}>
            {cells}
          </tr>
        );
      } else {
        return null;
      }
    });

    const getFallback = () => (
      <tr className={className}>
        <td className={'loading'}>
          <Loading width={'1em'} height={'1em'}/>
        </td>
      </tr>
    );

    return renderPromise(resultPromise, undefined, getFallback);
  }
}

export interface ExpressionMenuItemProps {
  item: Menu.ExpressionMenuItem;
  colSpan?: number;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  onEnter?: () => void;
  onLeave?: () => void;
  hoveredExternally?: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

export interface ExpressionMenuItemState {
  hovered: boolean;
}

export class ExpressionMenuItem extends React.Component<ExpressionMenuItemProps, ExpressionMenuItemState> {
  private ready = false;
  private htmlNode: HTMLElement | null = null;

  constructor(props: ExpressionMenuItemProps) {
    super(props);

    this.state = {
      hovered: false
    };
  }

  componentDidMount(): void {
    if (config.testing) {
      this.ready = true;
    } else {
      this.ready = false;
      setTimeout(() => (this.ready = true), clickDelay);
    }
  }

  componentDidUpdate(prevProps: ExpressionMenuItemProps): void {
    if (this.props.item !== prevProps.item && !config.testing) {
      this.ready = false;
      setTimeout(() => (this.ready = true), clickDelay);
    }
  }

  render(): React.ReactNode {
    const hovered = this.props.hoveredExternally || this.state.hovered;
    const className = clsx('open-menu-item', {
      'clickable': true,
      'hover': hovered,
      'selected': this.props.item.selected
    });
    const expression = this.props.item.expression;
    const onMouseEnter = () => {
      this.setState({hovered: true});
      if (this.props.onEnter) {
        this.props.onEnter();
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.hoverChanged(expression.semanticLinks || []);
      }
    };
    const onMouseLeave = () => {
      this.setState({hovered: false});
      if (this.props.onLeave) {
        this.props.onLeave();
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.hoverChanged([]);
      }
    };
    const onClick = (event: React.SyntheticEvent<HTMLElement>) => {
      if (this.ready) {
        this.props.onItemClicked(this.props.item.action);
      }
      disableDefaultBehavior(event);
    };
    let toolTip: React.ReactNode = null;
    if (this.props.interactionHandler && expression.semanticLinks && this.htmlNode) {
      const interactionHandler = this.props.interactionHandler;
      const semanticLinks = expression.semanticLinks;
      const getToolTipContents = () => {
        for (const semanticLink of semanticLinks) {
          const toolTipContents = interactionHandler.getToolTipContents(semanticLink);
          if (toolTipContents) {
            return toolTipContents;
          }
        }
        return null;
      };
      toolTip = <ExpressionToolTip active={hovered} position="right" parent={this.htmlNode} getContents={getToolTipContents} delay={100} key="tooltip"/>;
    }
    return (
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseDown={disableDefaultBehavior} onMouseUp={onClick} onTouchStart={disableDefaultBehavior} onTouchCancel={disableDefaultBehavior} onTouchEnd={onClick} ref={(node) => (this.htmlNode = node)}>
        <Expression expression={expression}/>
        {toolTip}
      </td>
    );
  }
}

export interface ExpressionMenuTextInputProps {
  item: Menu.ExpressionMenuTextInput;
  colSpan?: number;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  onEnter?: () => void;
  onLeave?: () => void;
  hoveredExternally?: boolean;
  inputRefHolder: ExpressionMenuInputRefHolder;
}

export interface ExpressionMenuTextInputState {
  hovered: boolean;
  editing: boolean;
  edited: boolean;
  text: string;
}

export class ExpressionMenuTextInput extends React.Component<ExpressionMenuTextInputProps, ExpressionMenuTextInputState> {
  constructor(props: ExpressionMenuTextInputProps) {
    super(props);

    this.state = {
      hovered: false,
      editing: false,
      edited: false,
      text: props.item.text
    };
  }

  componentDidUpdate(prevProps: ExpressionMenuTextInputProps): void {
    if (this.props.item !== prevProps.item) {
      this.setState({
        edited: false,
        text: this.props.item.text
      });
    }
  }

  componentWillUnmount(): void {
    if (this.state.edited) {
      this.props.item.text = this.state.text;
      this.props.onItemClicked(this.props.item.action);
    }
  }

  render(): React.ReactNode {
    const className = clsx('open-menu-item', {
      'hover': this.state.hovered || this.state.editing || this.props.hoveredExternally,
      'selected': this.props.item.selected
    });
    const onChangeValue = (newValue: string) => {
      this.setState({
        edited: true,
        text: newValue
      });
    };
    const onKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' || event.key === 'NumpadEnter') {
        this.props.item.text = this.state.text;
        this.props.onItemClicked(this.props.item.action);
        disableDefaultBehavior(event);
      }
    };
    const onMouseEnter = () => {
      this.setState({hovered: true});
      if (this.props.onEnter) {
        this.props.onEnter();
      }
    };
    const onMouseLeave = () => {
      this.setState({hovered: false});
      if (this.props.onLeave && !this.state.editing) {
        this.props.onLeave();
      }
    };
    const onFocus = () => {
      this.setState({
        editing: true,
        edited: false
      });
      if (this.props.onEnter) {
        this.props.onEnter();
      }
    };
    const onBlur = () => {
      this.setState({
        editing: false,
        edited: false
      });
      if (this.props.onLeave && !this.state.hovered) {
        this.props.onLeave();
      }
    };
    const onClick = () => {
      const input = this.props.inputRefHolder.inputRef;
      if (input) {
        input.focus();
      }
    };
    return (
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseUp={onClick}>
        <UnicodeTextInput value={this.state.text} size={this.props.item.expectedTextLength} onChangeValue={onChangeValue} onKeyPress={onKeyPress} onFocus={onFocus} onBlur={onBlur} supportLatexInput={this.props.item.supportLatexInput} inputRef={(element: HTMLElement | null) => (this.props.inputRefHolder.inputRef = element)}/>
      </td>
    );
  }
}

export default ExpressionMenu;
