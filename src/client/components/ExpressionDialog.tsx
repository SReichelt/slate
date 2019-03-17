import * as React from 'react';
import './ExpressionDialog.css';
import * as Fmt from '../../shared/format/format';
import * as FmtLibrary from '../../shared/logics/library';
import * as Display from '../../shared/display/display';
import * as Dialog from '../../shared/display/dialog';
import { LibraryDataProvider, LibraryItemInfo } from '../../shared/data/libraryDataProvider';
import Button from './Button';
import Expression, { ExpressionInteractionHandler } from './Expression';
import EmbeddedLibraryTree from './EmbeddedLibraryTree';
import { ExpressionInteractionHandlerImpl } from './InteractionHandler';
import { getButtonIcon, ButtonType } from '../utils/icons';
import CachedPromise from '../../shared/data/cachedPromise';

interface ExpressionDialogProps {
  dialog: Dialog.ExpressionDialog;
  onOK: () => void;
  onCancel: () => void;
}

class ExpressionDialog extends React.Component<ExpressionDialogProps> {
  private interactionHandler = new ExpressionInteractionHandlerImpl;

  render(): React.ReactNode {
    return [
      (
        <ExpressionDialogContents dialog={this.props.dialog} interactionHandler={this.interactionHandler} key={'contents'}/>
      ),
      (
        <div className={'dialog-button-row'} key={'buttons'}>
          <Button toolTipText={'OK'} onClick={this.props.onOK} key={'OK'}>
            {getButtonIcon(ButtonType.OK)}
          </Button>
          <Button toolTipText={'Cancel'} onClick={this.props.onCancel} key={'Cancel'}>
            {getButtonIcon(ButtonType.Cancel)}
          </Button>
        </div>
      )
    ];
  }
}

interface ExpressionDialogContentsProps {
  dialog: Dialog.ExpressionDialog;
  interactionHandler: ExpressionInteractionHandler;
}

class ExpressionDialogContents extends React.Component<ExpressionDialogContentsProps> {
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
        rows.push(<ExpressionDialogItem item={item} separated={separated} separatedAbove={separated || !itemIndex} separatedBelow={!nextItem || nextItem instanceof Dialog.ExpressionDialogSeparatorItem} interactionHandler={this.props.interactionHandler} key={index++}/>);
        separated = false;
      }
    }
    return (
      <table className={'dialog-contents'}>
        <tbody>
          {rows}
        </tbody>
      </table>
    );
  }
}

interface ExpressionDialogItemProps {
  item: Dialog.ExpressionDialogItem;
  separated: boolean;
  separatedAbove: boolean;
  separatedBelow: boolean;
  interactionHandler: ExpressionInteractionHandler;
}

class ExpressionDialogItem extends React.Component<ExpressionDialogItemProps> {
  componentDidMount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerExpressionChangeHandler(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterExpressionChangeHandler(this.onExpressionChanged);
    }
  }

  componentWillReceiveProps(props: ExpressionDialogItemProps): void {
    if (props.interactionHandler !== this.props.interactionHandler) {
      if (this.props.interactionHandler) {
        this.props.interactionHandler.unregisterExpressionChangeHandler(this.onExpressionChanged);
      }
      if (props.interactionHandler) {
        props.interactionHandler.registerExpressionChangeHandler(this.onExpressionChanged);
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
            <Expression expression={this.props.item.onGetValue()} interactionHandler={this.props.interactionHandler} key={'value'}/>
          </td>
        </tr>
      );
    } else if (this.props.item instanceof Dialog.ExpressionDialogTreeItem) {
      let item = this.props.item;
      let onItemClicked = (libraryItem: FmtLibrary.MetaRefExpression_item, libraryDataProvider: LibraryDataProvider, path: Fmt.Path, definitionPromise: CachedPromise<Fmt.Definition>, itemInfo: LibraryItemInfo): void => {
        item.selectedItemPath = libraryDataProvider.getAbsolutePath(path);
        this.forceUpdate();
      };
      return (
        <tr className={className}>
          <td className={'dialog-cell'} colSpan={2}>
            <EmbeddedLibraryTree libraryDataProvider={this.props.item.libraryDataProvider} templates={this.props.item.templates} onFilter={this.props.item.onFilter} selectedItemPath={this.props.item.selectedItemPath} onItemClicked={onItemClicked}/>
          </td>
        </tr>
      );
    } else {
      return undefined;
    }
  }

  private onExpressionChanged = (editorUpdateRequired: boolean) => {
    if (editorUpdateRequired) {
      this.forceUpdate();
    }
  }
}

export default ExpressionDialog;
