import * as React from 'react';
import './ExpressionDialog.css';
import * as Dialog from '../../shared/display/dialog';
import Expression, { ExpressionInteractionHandler } from './Expression';
import { ExpressionInteractionHandlerImpl } from './InteractionHandler';

interface ExpressionDialogProps {
  dialog: Dialog.ExpressionDialog;
  onOK: () => void;
}

class ExpressionDialog extends React.Component<ExpressionDialogProps> {
  private interactionHandler = new ExpressionInteractionHandlerImpl;

  render(): any {
    return (
      <table>
        <tbody>
          {this.props.dialog.items.map((item, index) => <ExpressionDialogItem item={item} interactionHandler={this.interactionHandler} key={index}/>)}
        </tbody>
      </table>
    );
  }
}

interface ExpressionDialogItemProps {
  item: Dialog.ExpressionDialogItem;
  interactionHandler: ExpressionInteractionHandler;
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
            <Expression expression={this.props.item.value} interactionHandler={this.props.interactionHandler}/>
          </td>
        </tr>
      );
    } else {
      return undefined;
    }
  }
}

export default ExpressionDialog;
