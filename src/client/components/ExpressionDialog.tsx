import * as React from 'react';
import clsx from 'clsx';

import StandardDialog from './StandardDialog';
import Expression, { ExpressionInteractionHandler } from './Expression';
import ExpressionToolTip from './ExpressionToolTip';
import LibraryTree from './LibraryTree';
import { ExpressionInteractionHandlerImpl } from './InteractionHandler';

import * as Notation from 'slate-shared/notation/notation';
import * as Dialog from 'slate-shared/notation/dialog';


export interface ExpressionDialogProps {
  dialog: Dialog.ExpressionDialog;
  onOK: (result?: Dialog.DialogResultBase) => void;
  onCancel: () => void;
}

export interface ExpressionDialogState {
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

  componentDidMount(): void {
    this.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
  }

  componentWillUnmount(): void {
    this.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
  }

  render(): React.ReactNode {
    let className = clsx('dialog-contents', this.props.dialog.styleClasses);
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
      <StandardDialog onOK={this.props.onOK} onCancel={this.props.onCancel} okVisible={this.props.dialog.onOK !== undefined} okEnabled={this.state.okEnabled}>
        <table className={className}>
          <tbody>
            {rows}
          </tbody>
        </table>
      </StandardDialog>
    );
  }

  private onItemChanged = (): void => {
    this.checkOKEnabled();
    if (this.props.dialog.onCheckUpdateNeeded?.()) {
      this.forceUpdate();
    }
  };

  private onExpressionChanged = (editorUpdateRequired: boolean): void => {
    if (editorUpdateRequired) {
      this.checkOKEnabled();
      this.forceUpdate();
    }
  };

  private checkOKEnabled(): void {
    if (this.props.dialog.onCheckOKEnabled) {
      let okEnabled = this.props.dialog.onCheckOKEnabled();
      if (this.state.okEnabled !== okEnabled) {
        this.setState({okEnabled: okEnabled});
      }
    }
  }
}

export interface ExpressionDialogItemProps {
  item: Dialog.ExpressionDialogItem;
  separated: boolean;
  separatedAbove: boolean;
  separatedBelow: boolean;
  interactionHandler: ExpressionInteractionHandler;
  onItemChanged?: () => void;
}

export interface ExpressionDialogItemState {
  titleHovered: boolean;
}

export class ExpressionDialogItem extends React.Component<ExpressionDialogItemProps, ExpressionDialogItemState> {
  private titleNode: HTMLElement | null = null;

  constructor(props: ExpressionDialogItemProps) {
    super(props);

    this.state = {
      titleHovered: false
    };
  }

  componentDidMount(): void {
    this.props.item.registerChangeListener(this.onItemChanged);
  }

  componentWillUnmount(): void {
    this.props.item.unregisterChangeListener(this.onItemChanged);
  }

  componentDidUpdate(prevProps: ExpressionDialogItemProps): void {
    if (this.props.item !== prevProps.item) {
      prevProps.item.unregisterChangeListener(this.onItemChanged);
      this.props.item.registerChangeListener(this.onItemChanged);
    }
  }

  render(): React.ReactNode {
    let className = clsx('dialog-row', {
      'separated': this.props.separated,
      'separated-above': this.props.separatedAbove,
      'separated-below': this.props.separatedBelow
    });
    let cellClassName = 'dialog-cell';
    let contents: React.ReactNode = null;
    if (this.props.item.visible) {
      if (this.props.item instanceof Dialog.ExpressionDialogExpressionItem) {
        let expression = this.props.item.onRenderExpression();
        if (expression) {
          let groupClassName: string | undefined = undefined;
          if (this.props.item instanceof Dialog.ExpressionDialogInfoItem) {
            cellClassName = clsx(cellClassName, 'dialog-info-cell');
          } else {
            groupClassName = 'dialog-group';
          }
          contents = (
            <div className={groupClassName}>
              <Expression expression={expression} interactionHandler={this.props.interactionHandler}/>
            </div>
          );
        }
      } else if (this.props.item instanceof Dialog.ExpressionDialogLinkItem) {
        contents = <a href={this.props.item.onGetURL()} target={'_blank'}>{this.props.item.title}</a>;
      } else if (this.props.item instanceof Dialog.ExpressionDialogParameterItem) {
        let title: any = this.props.item.title;
        if (title instanceof Notation.RenderedExpression) {
          title = <Expression expression={title} key="title"/>;
        }
        title = [title, ':'];
        if (this.props.item.onGetInfo && this.titleNode) {
          let onGetInfo = this.props.item.onGetInfo;
          let getToolTipContents = () => {
            let info = onGetInfo();
            if (info) {
              return <Expression expression={info}/>;
            } else {
              return null;
            }
          };
          title = [title, <ExpressionToolTip active={this.state.titleHovered} position="top" parent={this.titleNode} getContents={getToolTipContents} delay={100} key="tooltip"/>];
        }
        return (
          <tr className={className}>
            <th className={clsx(cellClassName, 'dialog-param-title-cell')} onMouseEnter={() => this.setState({titleHovered: true})} onMouseLeave={() => this.setState({titleHovered: false})} ref={(node) => (this.titleNode = node)} key="title">
              {title}
            </th>
            <td className={cellClassName} key="value">
              <Expression expression={this.props.item.onGetValue()} interactionHandler={this.props.interactionHandler}/>
            </td>
          </tr>
        );
      } else if (this.props.item instanceof Dialog.ExpressionDialogListItem) {
        let listItem = this.props.item;
        if (listItem.items.length) {
          if (listItem instanceof Dialog.ExpressionDialogSelectionItem) {
            let selectionItem = listItem;
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
                            <Expression expression={selectionItem.onRenderItem(item)}/>
                          </label>
                        </div>
                      );
                    } else {
                      return (
                        <div key={index}>
                          <Expression expression={selectionItem.onRenderItem(item)}/>
                        </div>
                      );
                    }
                  })}
                </div>
              </fieldset>
            );
          } else {
            contents = (
              <div className={'dialog-group'}>
                {listItem.items.map((item: any, index: number) => (
                  <div key={index}>
                    <Expression expression={listItem.onRenderItem(item)}/>
                  </div>
                ))}
              </div>
            );
          }
        }
      } else if (this.props.item instanceof Dialog.ExpressionDialogTreeItem) {
        contents = (
          <div className={'dialog-group'}>
            <LibraryTree libraryDataProvider={this.props.item.libraryDataProvider} templates={this.props.item.templates} onFilter={this.props.item.onFilter} selectedItemPath={this.props.item.selectedItemPath} onItemClicked={this.props.item.onItemClicked} autoFocusSearchInput={true}/>
          </div>
        );
      }
    }
    return (
      <tr className={className}>
        <td className={cellClassName} colSpan={2}>
          {contents}
        </td>
      </tr>
    );
  }

  private onItemChanged = (): void => {
    this.forceUpdate();
    this.props.onItemChanged?.();
  };
}

export default ExpressionDialog;
