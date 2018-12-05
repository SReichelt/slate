import * as React from 'react';
import './ExpressionMenu.css';
import * as Menu from '../../shared/display/menu';
import Expression from './Expression';

interface ExpressionMenuProps {
  menu: Menu.ExpressionMenu;
}

class ExpressionMenu extends React.Component<ExpressionMenuProps> {
  render(): any {
    return (
      <table className={'open-menu'}>
        <tbody>
          {this.props.menu.rows.map((row: Menu.ExpressionMenuRow, index: number) => <ExpressionMenuRow row={row} key={index}/>)}
        </tbody>
      </table>
    );
  }
}

interface ExpressionMenuRowProps {
  row: Menu.ExpressionMenuRow;
}

class ExpressionMenuRow extends React.Component<ExpressionMenuRowProps> {
  render(): any {
    let cells: any = undefined;
    let row = this.props.row;
    if (row instanceof Menu.ExpressionMenuItem) {
      cells = <ExpressionMenuItem item={row} colSpan={2}/>;
    } else if (row instanceof Menu.ExpressionMenuItemList) {
      cells = row.items.map((item: Menu.ExpressionMenuItem, index: number) => <ExpressionMenuItem item={item} key={index}/>);
    } else if (row instanceof Menu.StandardExpressionMenuRow) {
      let contentCell = undefined;
      if (row.subMenu && row.subMenu.rows.length) {
        let subMenuMainRow = row.subMenu.rows[0];
        if (subMenuMainRow instanceof Menu.ExpressionMenuItem) {
          contentCell = <ExpressionMenuItem item={subMenuMainRow} key="content"/>;
        } else {
          contentCell = (
            <td className={'open-menu-content-cell'} key="content">
              <table className={'open-menu-content-cell-table'}>
                <tbody>
                  <ExpressionMenuRow row={subMenuMainRow}/>
                </tbody>
              </table>
            </td>
          );
        }
      }
      let titleCellClassName = 'open-menu-title-cell';
      if (row.onClick) {
        titleCellClassName += ' clickable';
      }
      cells = <th className={titleCellClassName} onMouseUp={row.onClick} key="title">{row.title}</th>;
      if (contentCell) {
        cells = [cells, contentCell];
      }
    }
    return (
      <tr className={'open-menu-row'}>
        {cells}
      </tr>
    );
  }
}

interface ExpressionMenuItemProps {
  item: Menu.ExpressionMenuItem;
  colSpan?: number;
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
      <td colSpan={this.props.colSpan} className={className} onMouseEnter={() => this.setState({hovered: true})} onMouseLeave={() => this.setState({hovered: false})} onMouseUp={this.props.item.onClick}>
        <Expression expression={this.props.item.expression} tooltipPosition={'right'}/>
      </td>
    );
  }
}

export default ExpressionMenu;
