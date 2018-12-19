import * as React from 'react';
import './ExpressionDialog.css';
import * as Dialog from '../../shared/display/dialog';
import Expression from './Expression';

interface ExpressionDialogProps {
  dialog: Dialog.ExpressionDialog;
  onOK: () => void;
}

class ExpressionDialog extends React.Component<ExpressionDialogProps> {
  render(): any {
    return (
      <table>
        <tbody>
          {this.props.dialog.items.map((item, index) => <ExpressionDialogItem item={item} key={index}/>)}
        </tbody>
      </table>
    );
  }
}

interface ExpressionDialogItemProps {
  item: Dialog.ExpressionDialogItem;
}

class ExpressionDialogItem extends React.Component<ExpressionDialogItemProps> {
  render(): any {
    if (this.props.item instanceof Dialog.ExpressionDialogParameterItem) {
      return (
        <tr>
          <td>
            <Expression expression={this.props.item.parameter}/>
          </td>
          <td>
            <Expression expression={this.props.item.value}/>
          </td>
        </tr>
      );
    } else {
      return undefined;
    }
  }
}

export default ExpressionDialog;
