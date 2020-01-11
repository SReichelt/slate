import * as React from 'react';
import * as Display from '../../shared/display/display';
import * as Dialog from '../../shared/display/dialog';
import StandardDialog from './StandardDialog';
import Expression, { ExpressionInteractionHandler } from './Expression';
import EmbeddedLibraryTree from './EmbeddedLibraryTree';
import { ExpressionInteractionHandlerImpl } from './InteractionHandler';

interface ExpressionDialogProps {
  dialog: Dialog.ExpressionDialog;
  onOK: (result?: Dialog.DialogResultBase) => void;
  onCancel: () => void;
}

interface ExpressionDialogState {
  okEnabled: boolean;
}

class ExpressionDialog extends React.Component<ExpressionDialogProps, ExpressionDialogState> {
  private interactionHandler = new ExpressionInteractionHandlerImpl;

  constructor(props: ExpressionDialogProps) {
    super(props);

    this.state = {
      okEnabled: !props.dialog.onCheckOKEnabled || props.dialog.onCheckOKEnabled()
    };
  }

  render(): React.ReactNode {
    let rows = [];
    let index = 0;
    let separated = false;
    for (let itemIndex = 0; itemIndex < this.props.dialog.items.length; itemIndex++) {
      let item = this.props.dialog.items[itemIndex];
      let nextItem = itemIndex + 1 < this.props.dialog.items.length ? this.props.dialog.items[itemIndex + 1] : undefined;
      if (item instanceof Dialog.ExpressionDialogSeparatorItem) {
        if (index) {
          separated = true;
        }
      } else {
        rows.push(<ExpressionDialogItem item={item} separated={separated} separatedAbove={separated || !itemIndex} separatedBelow={!nextItem || nextItem instanceof Dialog.ExpressionDialogSeparatorItem} interactionHandler={this.interactionHandler} onItemChanged={this.onItemChanged} key={index++}/>);
        separated = false;
      }
    }
    return (
      <StandardDialog onOK={this.props.onOK} onCancel={this.props.onCancel} okEnabled={this.state.okEnabled}>
        <table className={'dialog-contents'}>
          <tbody>
            {rows}
          </tbody>
        </table>
      </StandardDialog>
    );
  }

  private onItemChanged = (): void => {
    if (this.props.dialog.onCheckOKEnabled) {
      let okEnabled = this.props.dialog.onCheckOKEnabled();
      if (this.state.okEnabled !== okEnabled) {
        this.setState({okEnabled: okEnabled});
      }
    }
  }
}

interface ExpressionDialogItemProps {
  item: Dialog.ExpressionDialogItem;
  separated: boolean;
  separatedAbove: boolean;
  separatedBelow: boolean;
  interactionHandler: ExpressionInteractionHandler;
  onItemChanged?: () => void;
}

class ExpressionDialogItem extends React.Component<ExpressionDialogItemProps> {
  componentDidMount(): void {
    this.props.item.registerChangeListener(this.onItemChanged);
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
    }
    this.props.item.unregisterChangeListener(this.onItemChanged);
  }

  componentDidUpdate(prevProps: ExpressionDialogItemProps): void {
    if (this.props.item !== prevProps.item) {
      prevProps.item.unregisterChangeListener(this.onItemChanged);
      this.props.item.registerChangeListener(this.onItemChanged);
    }
    if (this.props.interactionHandler !== prevProps.interactionHandler) {
      if (prevProps.interactionHandler) {
        prevProps.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
      }
    }
  }

  render(): React.ReactNode {
    let className = 'dialog-row';
    if (this.props.separated) {
      className += ' separated';
    }
    if (this.props.separatedAbove) {
      className += ' separated-above';
    }
    if (this.props.separatedBelow) {
      className += ' separated-below';
    }
    if (this.props.item instanceof Dialog.ExpressionDialogInfoItem) {
      return (
        <tr className={className}>
          <td className={'dialog-cell'} colSpan={2}>
            <Expression expression={this.props.item.info}/>
          </td>
        </tr>
      );
    } else if (this.props.item instanceof Dialog.ExpressionDialogParameterItem) {
      let title: any = this.props.item.title;
      if (title instanceof Display.RenderedExpression) {
        title = <Expression expression={title} key={'title'}/>;
      }
      title = [title, ':'];
      return (
        <tr className={className}>
          <th className={'dialog-cell'}>
            {title}
          </th>
          <td className={'dialog-cell'}>
            <Expression expression={this.props.item.onGetValue()} interactionHandler={this.props.interactionHandler}/>
          </td>
        </tr>
      );
    } else if (this.props.item instanceof Dialog.ExpressionDialogSelectionItem) {
      let contents: React.ReactNode = null;
      let selectionItem = this.props.item;
      if (selectionItem.items.length) {
        contents = (
          <fieldset className={'dialog-group'}>
            <div className={'dialog-radio-button-group'}>
              {selectionItem.items.map((item: any, index: number) => {
                if (selectionItem.items.length > 1) {
                  // If the dialog was opened from a nested placeholder, only onClick works, but onChange doesn't.
                  // In addition, the "checked" status fails to update unless we change the key of the selected item.
                  // I haven't figured out why.
                  let onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                    if (event.target.value === `item${index}` && selectionItem !== item) {
                      selectionItem.selectedItem = item;
                      selectionItem.changed();
                    }
                  };
                  let onClick = () => {
                    if (selectionItem !== item) {
                      selectionItem.selectedItem = item;
                      selectionItem.changed();
                    }
                  };
                  let selected = selectionItem.selectedItem === item;
                  return (
                    <div key={selected ? -index : index}>
                      <input type={'radio'} id={`radio${index}`} name={'dialog-radio'} value={`item${index}`} checked={selected} onChange={onChange} onClick={onClick}/>
                      <label htmlFor={`radio${index}`} onClick={onClick}>
                        <Expression expression={selectionItem.onRenderItem(item)} interactionHandler={this.props.interactionHandler}/>
                      </label>
                    </div>
                  );
                } else {
                  return (
                    <div key={index}>
                      <Expression expression={selectionItem.onRenderItem(item)} interactionHandler={this.props.interactionHandler}/>
                    </div>
                  );
                }
              })}
            </div>
          </fieldset>
        );
      }
      return (
        <tr className={className}>
          <td className={'dialog-cell'} colSpan={2}>
            {contents}
          </td>
        </tr>
      );
    } else if (this.props.item instanceof Dialog.ExpressionDialogTreeItem) {
      return (
        <tr className={className}>
          <td className={'dialog-cell'} colSpan={2}>
            <EmbeddedLibraryTree libraryDataProvider={this.props.item.libraryDataProvider} templates={this.props.item.templates} onFilter={this.props.item.onFilter} selectedItemPath={this.props.item.selectedItemPath} onItemClicked={this.props.item.onItemClicked}/>
          </td>
        </tr>
      );
    } else {
      return undefined;
    }
  }

  private onItemChanged = (): void => {
    this.forceUpdate();
    if (this.props.onItemChanged) {
      this.props.onItemChanged();
    }
  }

  private onExpressionChanged = (editorUpdateRequired: boolean): void => {
    if (editorUpdateRequired) {
      this.onItemChanged();
    }
  }
}

export default ExpressionDialog;
