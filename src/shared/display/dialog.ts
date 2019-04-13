import * as Fmt from '../format/format';
import * as Display from './display';
import { LibraryDataProvider, LibraryItemInfo } from '../data/libraryDataProvider';
import CachedPromise from '../data/cachedPromise';

export class ExpressionDialog {
  items: ExpressionDialogItem[];
  onOK: () => void;
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
  onFilter?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => CachedPromise<boolean>;
  selectedItemPath?: Fmt.Path;
  onItemClicked?: (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, outerDefinitionPromise?: CachedPromise<Fmt.Definition>, itemInfo?: LibraryItemInfo) => void;
}
