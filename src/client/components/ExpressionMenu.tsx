import * as React from 'react';
import './ExpressionMenu.css';
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
      <table className={'open-menu'}>
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

class ExpressionMenuRow extends React.Component<ExpressionMenuRowProps> {
  render(): any {
    let cells: any = undefined;
    let row = this.props.row;
    if (row instanceof Menu.ExpressionMenuItem) {
      cells = <ExpressionMenuItem item={row} colSpan={2} onItemClicked={this.props.onItemClicked}/>;
    } else if (row instanceof Menu.ExpressionMenuItemList) {
      cells = row.items.map((item: Menu.ExpressionMenuItem, index: number) => <ExpressionMenuItem item={item} key={index} onItemClicked={this.props.onItemClicked}/>);
    } else if (row instanceof Menu.StandardExpressionMenuRow) {
      let contentCell = undefined;
      let subMenuMainRow: Menu.ExpressionMenuRow | undefined = undefined;
      if (row.subMenu instanceof Menu.ExpressionMenu && row.subMenu.rows.length) {
        subMenuMainRow = row.subMenu.rows[0];
      } else if (row.subMenu instanceof Menu.ExpressionMenuRow) {
        subMenuMainRow = row.subMenu;
      }
      if (subMenuMainRow) {
        if (subMenuMainRow instanceof Menu.ExpressionMenuItem) {
          contentCell = <ExpressionMenuItem item={subMenuMainRow} key={'content'} onItemClicked={this.props.onItemClicked}/>;
        } else {
          contentCell = (
            <td className={'open-menu-content-cell'} key={'content'}>
              <table className={'open-menu-content-cell-table'}>
                <tbody>
                  <ExpressionMenuRow row={subMenuMainRow} separated={false} onItemClicked={this.props.onItemClicked}/>
                </tbody>
              </table>
            </td>
          );
        }
      }
      let titleCellClassName = 'open-menu-title-cell';
      let onMouseUp = undefined;
      if (row.titleAction) {
        titleCellClassName += ' clickable';
        let action = row.titleAction;
        onMouseUp = () => this.props.onItemClicked(action);
      }
      cells = <th className={titleCellClassName} onMouseUp={onMouseUp} key={'title'}>{row.title}</th>;
      if (contentCell) {
        cells = [cells, contentCell];
      }
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
    if (this.state.hovered) {
      className += ' hover';
    }
    return (
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={() => this.setState({hovered: true})} onMouseLeave={() => this.setState({hovered: false})} onMouseUp={() => this.props.onItemClicked(this.props.item.action)}>
        <Expression expression={this.props.item.expression} tooltipPosition={'right'}/>
      </td>
    );
  }
}

export default ExpressionMenu;
