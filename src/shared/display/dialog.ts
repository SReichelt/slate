import * as Fmt from '../format/format';
import * as Display from './display';
import { LibraryDataProvider } from '../data/libraryDataProvider';
import CachedPromise from '../data/cachedPromise';

export class ExpressionDialog {
  items: ExpressionDialogItem[];
  onOK: () => void;
}

export abstract class ExpressionDialogItem {
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

export class ExpressionDialogTreeItem extends ExpressionDialogItem {
  libraryDataProvider: LibraryDataProvider;
  templates?: Fmt.File;
  onFilter?: (path: Fmt.Path, definition: Fmt.Definition) => CachedPromise<boolean>;
  selectedItemPath?: Fmt.Path;
}
