import * as Fmt from '../format/format';
import * as Logic from '../logics/logic';
import * as Display from './display';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo } from '../data/libraryDataProvider';
import CachedPromise from '../data/cachedPromise';

export interface DialogResultBase {
}

export class DialogBase {
  onOK?: (result: DialogResultBase) => void;
}

export interface InsertDialogResult extends DialogResultBase {
  name: string;
  title: string | undefined;
  type: string | undefined;
}

export class InsertDialog extends DialogBase {
  definitionType: Logic.LogicDefinitionTypeDescription | undefined;
  onCheckNameInUse: (name: string) => boolean;
}

export class ExpressionDialog extends DialogBase {
  items: ExpressionDialogItem[];
  onCheckOKEnabled?: () => boolean;
}

type ChangeListener = () => void;

export abstract class ExpressionDialogItem {
  private listeners: ChangeListener[] = [];

  registerChangeListener(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  unregisterChangeListener(listener: ChangeListener): void {
    let index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  changed(): void {
    for (let listener of this.listeners) {
      listener();
    }
  }
}

export class ExpressionDialogInfoItem extends ExpressionDialogItem {
  info: Display.RenderedExpression;
}

export class ExpressionDialogSeparatorItem extends ExpressionDialogItem {
}

export class ExpressionDialogParameterItem extends ExpressionDialogItem {
  title: string | Display.RenderedExpression;
  onGetValue: () => Display.RenderedExpression;
}

export class ExpressionDialogSelectionItem<T> extends ExpressionDialogItem {
  items: T[];
  onRenderItem: (item: T) => Display.RenderedExpression;
  selectedItem?: T;
}

export class ExpressionDialogTreeItem extends ExpressionDialogItem {
  libraryDataProvider: LibraryDataProvider;
  templates?: Fmt.File;
  onFilter?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => CachedPromise<boolean>;
  selectedItemPath?: Fmt.Path;
  onItemClicked?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise?: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => void;
}
