import * as Fmt from '../format/format';
import * as Logic from '../logics/logic';
import * as Notation from './notation';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryItemNumber } from '../data/libraryDataProvider';
import CachedPromise from '../data/cachedPromise';

export interface DialogResultBase {
}

// TODO define proper constructors for these classes

export class DialogBase {
  onOK?: (result: DialogResultBase) => void;
}

export interface InsertDialogResult extends DialogResultBase {
  name: string;
  title: string | undefined;
  position?: number;
}

export class InsertDialog extends DialogBase {
  libraryDataProvider: LibraryDataProvider;
  section?: LibraryDefinition;
  sectionItemNumber?: LibraryItemNumber;
  definitionType: Logic.LogicDefinitionTypeDescription | undefined;
  onCheckNameInUse: (name: string) => boolean;
  templates?: Fmt.File;
}

export class ExpressionDialog extends DialogBase {
  styleClasses?: string[];
  items: ExpressionDialogItem[];
  onCheckOKEnabled?: () => boolean;
  onCheckUpdateNeeded?: () => boolean;
}

type ChangeListener = () => void;

export abstract class ExpressionDialogItem {
  visible: boolean = true;
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
  info: Notation.RenderedExpression;
}

export class ExpressionDialogLinkItem extends ExpressionDialogItem {
  title: string;
  getURL: () => string;
}

export class ExpressionDialogSeparatorItem extends ExpressionDialogItem {
}

export class ExpressionDialogParameterItem extends ExpressionDialogItem {
  title: string | Notation.RenderedExpression;
  info?: Notation.RenderedExpression;
  onGetValue: () => Notation.RenderedExpression;
}

export class ExpressionDialogListItem<T> extends ExpressionDialogItem {
  items: T[];
  onRenderItem: (item: T) => Notation.RenderedExpression;
}

export class ExpressionDialogSelectionItem<T> extends ExpressionDialogListItem<T> {
  selectedItem?: T;
}

export class ExpressionDialogTreeItem extends ExpressionDialogItem {
  libraryDataProvider: LibraryDataProvider;
  templates?: Fmt.File;
  onFilter?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => CachedPromise<boolean>;
  selectedItemPath?: Fmt.Path;
  onItemClicked?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise?: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => void;
}
