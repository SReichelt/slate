import * as Fmt from '../format/format';
import * as Logic from '../logics/logic';
import * as Notation from './notation';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryItemNumber } from '../data/libraryDataProvider';
import CachedPromise from '../data/cachedPromise';

export interface DialogResultBase {
}

export class DialogBase {
  constructor(public onOK?: (result: DialogResultBase) => void) {}
}

export interface InsertDialogResult extends DialogResultBase {
  name: string;
  title: string | undefined;
  position?: number;
}

export class InsertDialog extends DialogBase {
  section?: LibraryDefinition;
  sectionItemNumber?: LibraryItemNumber;

  constructor(public libraryDataProvider: LibraryDataProvider, public definitionType: Logic.LogicDefinitionTypeDescription | undefined, public onCheckNameInUse: (name: string) => boolean, public templates: Fmt.File | undefined, onOK?: (result: InsertDialogResult) => void) {
    super(onOK);
  }
}

export class ExpressionDialog extends DialogBase {
  styleClasses?: string[];
  onCheckOKEnabled?: () => boolean;
  onCheckUpdateNeeded?: () => boolean;

  constructor(public items: ExpressionDialogItem[], onOK?: () => void) {
    super(onOK);
  }
}

type ChangeListener = () => void;

export abstract class ExpressionDialogItem {
  visible: boolean = true;
  private listeners: ChangeListener[] = [];

  registerChangeListener(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  unregisterChangeListener(listener: ChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  changed(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export class ExpressionDialogExpressionItem extends ExpressionDialogItem {
  constructor(public onRenderExpression: () => Notation.RenderedExpression | undefined) {
    super();
  }
}

export class ExpressionDialogInfoItem extends ExpressionDialogExpressionItem {}

export class ExpressionDialogLinkItem extends ExpressionDialogItem {
  constructor(public title: string, public onGetURL: () => string) {
    super();
  }
}

export class ExpressionDialogSeparatorItem extends ExpressionDialogItem {
}

export class ExpressionDialogParameterItem extends ExpressionDialogItem {
  onGetInfo?: () => Notation.RenderedExpression | undefined;

  constructor(public title: string | Notation.RenderedExpression, public onGetValue: () => Notation.RenderedExpression) {
    super();
  }
}

export class ExpressionDialogListItem<T> extends ExpressionDialogItem {
  constructor(public items: T[], public onRenderItem: (item: T) => Notation.RenderedExpression) {
    super();
  }
}

export class ExpressionDialogSelectionItem<T> extends ExpressionDialogListItem<T> {
  selectedItem?: T;
}

export class ExpressionDialogTreeItem extends ExpressionDialogItem {
  onFilter?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => CachedPromise<boolean>;
  selectedItemPath?: Fmt.Path;
  onItemClicked?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise?: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => void;

  constructor(public libraryDataProvider: LibraryDataProvider, public templates: Fmt.File | undefined) {
    super();
  }
}
