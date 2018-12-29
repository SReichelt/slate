import * as React from 'react';
import './ExpressionMenu.css';
import * as Display from '../../shared/display/display';
import * as Menu from '../../shared/display/menu';
import Expression from './Expression';

interface ExpressionMenuProps {
  menu: Menu.ExpressionMenu;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
}

class ExpressionMenu extends React.Component<ExpressionMenuProps> {
  render(): any {
    let rows = [];
    let index = 0;
    let separated = false;
    for (let row of this.props.menu.rows) {
      if (row instanceof Menu.ExpressionMenuSeparator) {
        if (index) {
          separated = true;
        }
      } else {
        rows.push(<ExpressionMenuRow row={row} separated={separated} key={index++} onItemClicked={this.props.onItemClicked}/>);
        separated = false;
      }
    }
    return (
      <table className={'open-menu'} onMouseDown={(event) => event.stopPropagation()}>
        <tbody>
          {rows}
        </tbody>
      </table>
    );
  }
}

interface ExpressionMenuRowProps {
  row: Menu.ExpressionMenuRow;
  separated: boolean;
  onItemClicked: (action: Menu.ExpressionMenuAction) => void;
}

interface ExpressionMenuRowState {
  titleHovered: boolean;
  contentsHoveredOrOpen: boolean;
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
      contentsHoveredOrOpen: false
    };
  }

  render(): any {
    let cells: any = undefined;
    let row = this.props.row;
    if (row instanceof Menu.ExpressionMenuItem) {
      cells = <ExpressionMenuItem item={row} colSpan={2} onItemClicked={this.props.onItemClicked} hoveredExternally={false}/>;
    } else if (row instanceof Menu.ExpressionMenuItemList) {
      cells = row.items.map((item: Menu.ExpressionMenuItem, index: number) => <ExpressionMenuItem item={item} key={index} onItemClicked={this.props.onItemClicked} hoveredExternally={false}/>);
    } else if (row instanceof Menu.StandardExpressionMenuRow) {
      let contentCell = undefined;
      let onClick = undefined;
      let subMenuMainRow: Menu.ExpressionMenuRow | undefined = undefined;
      if (row.subMenu instanceof Menu.ExpressionMenu && row.subMenu.rows.length) {
        subMenuMainRow = row.subMenu.rows[0];
      } else if (row.subMenu instanceof Menu.ExpressionMenuRow) {
        subMenuMainRow = row.subMenu;
      }
      if (subMenuMainRow) {
        let itemHovered = this.state.titleHovered && !row.titleAction;
        if (subMenuMainRow instanceof Menu.ExpressionMenuItem) {
          contentCell = <ExpressionMenuItem item={subMenuMainRow} key={'content'} onItemClicked={this.props.onItemClicked} onEnter={() => this.setState({contentsHoveredOrOpen: true})} onLeave={() => this.setState({contentsHoveredOrOpen: false})} hoveredExternally={itemHovered}/>;
        } else if (subMenuMainRow instanceof Menu.ExpressionMenuTextInput) {
          contentCell = <ExpressionMenuTextInput item={subMenuMainRow} key={'content'} onItemClicked={this.props.onItemClicked} onEnter={() => this.setState({contentsHoveredOrOpen: true})} onLeave={() => this.setState({contentsHoveredOrOpen: false})} hoveredExternally={itemHovered} inputRefHolder={this.inputRefHolder}/>;
          onClick = () => {
            let input = this.inputRefHolder.inputRef;
            if (input) {
              input.focus();
            }
          };
        } else {
          contentCell = (
            <td className={'open-menu-content-cell'} key={'content'} onMouseEnter={() => this.setState({contentsHoveredOrOpen: true})} onMouseLeave={() => this.setState({contentsHoveredOrOpen: false})}>
              <table className={'open-menu-content-cell-table'}>
                <tbody>
                  <ExpressionMenuRow row={subMenuMainRow} separated={false} onItemClicked={this.props.onItemClicked}/>
                </tbody>
              </table>
            </td>
          );
        }
      }
      let title: any;
      if (row.title instanceof Display.RenderedExpression) {
        title = <Expression expression={row.title} key={'title'}/>;
      } else {
        title = row.title;
      }
      let titleCellClassName = 'open-menu-title-cell';
      let titleAction: Menu.ExpressionMenuAction | undefined = undefined;
      if (row.titleAction) {
        titleAction = row.titleAction;
      } else if (subMenuMainRow instanceof Menu.ExpressionMenuItem) {
        titleAction = subMenuMainRow.action;
      }
      if (titleAction) {
        titleCellClassName += ' clickable';
        onClick = () => this.props.onItemClicked(titleAction!);
        if (titleAction instanceof Menu.DialogExpressionMenuAction) {
          title = [title, '...'];
        }
      }
      if (this.state.titleHovered || this.state.contentsHoveredOrOpen) {
        titleCellClassName += ' hover';
      }
      if (row.selected) {
        titleCellClassName += ' selected';
      }
      cells = <th className={titleCellClassName} onMouseEnter={() => this.setState({titleHovered: true})} onMouseLeave={() => this.setState({titleHovered: false})} onClick={onClick} key={'title'}>{title}</th>;
      if (contentCell) {
        cells = [cells, contentCell];
      }
    } else if (row instanceof Menu.ExpressionMenuTextInput) {
      cells = <ExpressionMenuTextInput item={row} colSpan={2} onItemClicked={this.props.onItemClicked} hoveredExternally={false} inputRefHolder={this.inputRefHolder}/>;
    }
    let className = 'open-menu-row';
    if (this.props.separated) {
      className += ' separated';
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
  hoveredExternally: boolean;
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

  render(): any {
    let className = 'open-menu-item clickable';
    if (this.state.hovered || this.props.hoveredExternally) {
      className += ' hover';
    }
    if (this.props.item.selected) {
      className += ' selected';
    }
    let onMouseEnter = () => {
      this.setState({hovered: true});
      if (this.props.onEnter) {
        this.props.onEnter();
      }
    };
    let onMouseLeave = () => {
      this.setState({hovered: false});
      if (this.props.onLeave) {
        this.props.onLeave();
      }
    };
    let onClick = () => this.props.onItemClicked(this.props.item.action);
    return (
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <Expression expression={this.props.item.expression} tooltipPosition={'right'}/>
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
  hoveredExternally: boolean;
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

  componentWillReceiveProps(props: ExpressionMenuTextInputProps) {
    if (props.item !== this.props.item) {
      this.setState({text: props.item.text});
    }
  }

  render(): any {
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
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <form onSubmit={onSubmit}>
          <input type={'text'} value={this.state.text} size={4} onChange={onChange} onFocus={onFocus} onBlur={onBlur} ref={(element: HTMLInputElement) => (this.props.inputRefHolder.inputRef = element)}/>
        </form>
      </td>
    );
  }
}

export default ExpressionMenu;
