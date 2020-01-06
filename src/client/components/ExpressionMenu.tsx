import * as React from 'react';
import './ExpressionMenu.css';
import * as Display from '../../shared/display/display';
import * as Menu from '../../shared/display/menu';
import Expression, { ExpressionInteractionHandler } from './Expression';
import { getButtonIcon, ButtonType, getDefinitionIcon } from '../utils/icons';

interface ExpressionMenuProps {
  menu: Menu.ExpressionMenu;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  hoveredExternally?: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

interface ExpressionMenuState {
  openSubMenu?: Menu.ExpressionMenuRow;
}

class ExpressionMenu extends React.Component<ExpressionMenuProps, ExpressionMenuState> {
  private scrolled = false;

  constructor(props: ExpressionMenuProps) {
    super(props);
    this.state = {};
  }

  render(): React.ReactNode {
    let rows = [];
    let index = 0;
    let separated = false;
    for (let row of this.props.menu.rows) {
      if (row instanceof Menu.ExpressionMenuSeparator) {
        if (index) {
          separated = true;
        }
      } else {
        let onEnter = (openSubMenu: boolean = false) => this.setState({openSubMenu: openSubMenu ? row : undefined});
        let hoveredExternally = this.props.hoveredExternally && index === 0;
        let subMenuOpen = (this.state.openSubMenu === row);
        rows.push(<ExpressionMenuRow row={row} separated={separated} key={index++} onItemClicked={this.props.onItemClicked} onEnter={onEnter} hoveredExternally={hoveredExternally} subMenuOpen={subMenuOpen} interactionHandler={this.props.interactionHandler}/>);
        separated = false;
      }
    }
    let className = 'open-menu';
    if (this.props.menu.variable) {
      className += ' variable';
    }
    let ref = (htmlNode: HTMLDivElement | null) => {
      if (htmlNode && !this.scrolled) {
        this.scrolled = true;
        htmlNode.scrollIntoView({
          block: 'end',
          inline: 'end'
        });
      }
    };
    return (
      <div className={className} ref={ref}>
        <table className={'open-menu-table'} onMouseDown={(event) => event.stopPropagation()}>
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    );
  }
}

interface ExpressionMenuRowProps {
  row: Menu.ExpressionMenuRow;
  separated: boolean;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  onEnter?: (openSubMenu?: boolean) => void;
  onLeave?: () => void;
  hoveredExternally?: boolean;
  subMenuOpen?: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

interface ExpressionMenuRowState {
  titleHovered: boolean;
  contentsHovered: boolean;
}

interface ExpressionMenuInputRefHolder {
  inputRef?: HTMLElement;
}

class ExpressionMenuRow extends React.Component<ExpressionMenuRowProps, ExpressionMenuRowState> {
  inputRefHolder: ExpressionMenuInputRefHolder = {};

  constructor(props: ExpressionMenuRowProps) {
    super(props);

    this.state = {
      titleHovered: false,
      contentsHovered: false
    };
  }

  render(): React.ReactNode {
    let cells: React.ReactNode = null;
    let row = this.props.row;
    if (row instanceof Menu.ExpressionMenuItem) {
      cells = <ExpressionMenuItem item={row} colSpan={2} onItemClicked={this.props.onItemClicked} onEnter={this.props.onEnter} onLeave={this.props.onLeave} hoveredExternally={this.props.hoveredExternally} interactionHandler={this.props.interactionHandler}/>;
    } else if (row instanceof Menu.ExpressionMenuItemList) {
      cells = row.items.map((item: Menu.ExpressionMenuItem, index: number) => <ExpressionMenuItem item={item} key={index} onItemClicked={this.props.onItemClicked} onEnter={this.props.onEnter} onLeave={this.props.onLeave} interactionHandler={this.props.interactionHandler}/>);
    } else if (row instanceof Menu.StandardExpressionMenuRow) {
      let contentCell: React.ReactNode = null;
      let onClick = undefined;
      let titleAction = row.titleAction;
      let itemHovered = this.props.hoveredExternally || (this.state.titleHovered && !row.titleAction);
      let subMenuMainRow: Menu.ExpressionMenuRow | undefined = undefined;
      if (row.previewSubMenu) {
        if (row.subMenu instanceof Menu.ExpressionMenu && row.subMenu.rows.length) {
          subMenuMainRow = row.subMenu.rows[0];
          for (let subMenuRow of row.subMenu.rows) {
            if (subMenuRow.isSelected()) {
              subMenuMainRow = subMenuRow;
              break;
            }
          }
        } else if (row.subMenu instanceof Menu.ExpressionMenuRow) {
          subMenuMainRow = row.subMenu;
        }
        if (subMenuMainRow) {
          let onEnter = () => {
            this.setState({contentsHovered: true});
            if (this.props.onEnter) {
              this.props.onEnter(false);
            }
          };
          let onLeave = () => {
            this.setState({contentsHovered: false});
            if (this.props.onLeave) {
              this.props.onLeave();
            }
          };
          if (subMenuMainRow instanceof Menu.ExpressionMenuItem) {
            contentCell = <ExpressionMenuItem item={subMenuMainRow} key={'content'} onItemClicked={this.props.onItemClicked} onEnter={onEnter} onLeave={onLeave} hoveredExternally={itemHovered} interactionHandler={this.props.interactionHandler}/>;
            if (!titleAction) {
              titleAction = subMenuMainRow.action;
            }
          } else if (subMenuMainRow instanceof Menu.ExpressionMenuTextInput) {
            contentCell = <ExpressionMenuTextInput item={subMenuMainRow} key={'content'} onItemClicked={this.props.onItemClicked} onEnter={onEnter} onLeave={onLeave} hoveredExternally={itemHovered} inputRefHolder={this.inputRefHolder}/>;
            onClick = (event: React.MouseEvent) => {
              let input = this.inputRefHolder.inputRef;
              if (input) {
                input.focus();
              }
              event.stopPropagation();
            };
          } else {
            // TODO (low priority) support submenus in content cell
            contentCell = (
              <td className={'open-menu-content-cell'} key={'content'}>
                <table className={'open-menu-content-cell-table'}>
                  <tbody>
                    <ExpressionMenuRow row={subMenuMainRow} separated={false} onItemClicked={this.props.onItemClicked} onEnter={onEnter} onLeave={onLeave} subMenuOpen={false} interactionHandler={this.props.interactionHandler}/>
                  </tbody>
                </table>
              </td>
            );
          }
        }
      }
      let title: any = row.title;
      if (title instanceof Display.RenderedExpression) {
        title = <Expression expression={title} key={'title'}/>;
      }
      let titleCellClassName = 'open-menu-title-cell';
      if (titleAction) {
        titleCellClassName += ' clickable';
        onClick = (event: React.MouseEvent) => {
          this.props.onItemClicked(titleAction!);
          event.stopPropagation();
        };
        if (titleAction instanceof Menu.DialogExpressionMenuAction) {
          title = [title, '...'];
        }
      }
      if (row.iconType !== undefined) {
        let icon: React.ReactNode = null;
        if (typeof row.iconType === 'string') {
          switch (row.iconType) {
          case 'remove':
            icon = getButtonIcon(ButtonType.Remove);
            break;
          }
        } else {
          icon = getDefinitionIcon(row.iconType);
        }
        if (icon) {
          title = [
            <span className={'open-menu-title-cell-icon'} key={'icon'}>{icon}</span>,
            title
          ];
        }
      }
      if (this.state.titleHovered || this.state.contentsHovered || this.props.subMenuOpen) {
        titleCellClassName += ' hover';
      }
      if (row.isSelected()) {
        titleCellClassName += ' selected';
      }
      let hasSubMenu = false;
      let onMouseEnter = () => {
        this.setState({titleHovered: true});
        if (this.props.onEnter) {
          this.props.onEnter(hasSubMenu);
        }
      };
      let onMouseLeave = () => {
        this.setState({titleHovered: false});
        if (this.props.onLeave) {
          this.props.onLeave();
        }
      };
      if (row.subMenu instanceof Menu.ExpressionMenu && row.subMenu.rows.length > 1) {
        hasSubMenu = true;
        title = (
          <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseUp={onClick} key={'title'}>
            {title}
            <span key={'arrow'}>&nbsp;&nbsp;&nbsp;&nbsp;<span className={'open-menu-arrow'}>&nbsp;▶&nbsp;</span></span>
          </div>
        );
        if (this.props.subMenuOpen) {
          let subMenu = (
            <ExpressionMenu menu={row.subMenu} onItemClicked={this.props.onItemClicked} hoveredExternally={subMenuMainRow && itemHovered} interactionHandler={this.props.interactionHandler} key={'subMenu'}/>
          );
          title = [title, subMenu];
        }
      } else {
        title = <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseUp={onClick}>{title}</div>;
      }
      let colSpan = contentCell ? 1 : 2;
      cells = <th colSpan={colSpan} className={titleCellClassName} key={'title'}>{title}</th>;
      if (contentCell) {
        cells = [cells, contentCell];
      }
    } else if (row instanceof Menu.ExpressionMenuTextInput) {
      cells = <ExpressionMenuTextInput item={row} colSpan={2} onItemClicked={this.props.onItemClicked} inputRefHolder={this.inputRefHolder}/>;
    }
    let className = 'open-menu-row';
    if (this.props.separated) {
      className += ' separated';
    }
    if (row.extraSpace) {
      className += ' extra-space';
    }
    return (
      <tr className={className}>
        {cells}
      </tr>
    );
  }
}

interface ExpressionMenuItemProps {
  item: Menu.ExpressionMenuItem;
  colSpan?: number;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  onEnter?: () => void;
  onLeave?: () => void;
  hoveredExternally?: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

interface ExpressionMenuItemState {
  hovered: boolean;
}

class ExpressionMenuItem extends React.Component<ExpressionMenuItemProps, ExpressionMenuItemState> {
  constructor(props: ExpressionMenuItemProps) {
    super(props);

    this.state = {
      hovered: false
    };
  }

  render(): React.ReactNode {
    let className = 'open-menu-item clickable';
    if (this.state.hovered || this.props.hoveredExternally) {
      className += ' hover';
    }
    if (this.props.item.selected) {
      className += ' selected';
    }
    let expression = this.props.item.expression;
    let onMouseEnter = () => {
      this.setState({hovered: true});
      if (this.props.onEnter) {
        this.props.onEnter();
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.hoverChanged(expression.semanticLinks || []);
      }
    };
    let onMouseLeave = () => {
      this.setState({hovered: false});
      if (this.props.onLeave) {
        this.props.onLeave();
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.hoverChanged([]);
      }
    };
    let onClick = (event: React.MouseEvent) => {
      this.props.onItemClicked(this.props.item.action);
      event.stopPropagation();
    };
    return (
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseUp={onClick}>
        <Expression expression={expression} tooltipPosition={'right'}/>
      </td>
    );
  }
}

interface ExpressionMenuTextInputProps {
  item: Menu.ExpressionMenuTextInput;
  colSpan?: number;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
  onEnter?: () => void;
  onLeave?: () => void;
  hoveredExternally?: boolean;
  inputRefHolder: ExpressionMenuInputRefHolder;
}

interface ExpressionMenuTextInputState {
  hovered: boolean;
  editing: boolean;
  text: string;
}

class ExpressionMenuTextInput extends React.Component<ExpressionMenuTextInputProps, ExpressionMenuTextInputState> {
  constructor(props: ExpressionMenuTextInputProps) {
    super(props);

    this.state = {
      hovered: false,
      editing: false,
      text: props.item.text
    };
  }

  componentDidUpdate(prevProps: ExpressionMenuTextInputProps) {
    if (this.props.item !== prevProps.item) {
      this.setState({text: this.props.item.text});
    }
  }

  render(): React.ReactNode {
    let className = 'open-menu-item';
    if (this.state.hovered || this.state.editing || this.props.hoveredExternally) {
      className += ' hover';
    }
    if (this.props.item.selected) {
      className += ' selected';
    }
    let onChange = (event: React.ChangeEvent<HTMLInputElement>) => this.setState({text: event.target.value});
    let onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      this.props.item.text = this.state.text;
      this.props.onItemClicked(this.props.item.action);
      event.preventDefault();
    };
    let onMouseEnter = () => {
      this.setState({hovered: true});
      if (this.props.onEnter) {
        this.props.onEnter();
      }
    };
    let onMouseLeave = () => {
      this.setState({hovered: false});
      if (this.props.onLeave && !this.state.editing) {
        this.props.onLeave();
      }
    };
    let onFocus = () => {
      this.setState({editing: true});
      if (this.props.onEnter) {
        this.props.onEnter();
      }
    };
    let onBlur = () => {
      this.setState({editing: false});
      if (this.props.onLeave && !this.state.hovered) {
        this.props.onLeave();
      }
    };
    let onClick = () => {
      let input = this.props.inputRefHolder.inputRef;
      if (input) {
        input.focus();
      }
    };
    return (
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseUp={onClick}>
        <form onSubmit={onSubmit}>
          <input type={'text'} value={this.state.text} size={4} onChange={onChange} onFocus={onFocus} onBlur={onBlur} ref={(element: HTMLInputElement) => (this.props.inputRefHolder.inputRef = element)}/>
        </form>
      </td>
    );
  }
}

export default ExpressionMenu;
