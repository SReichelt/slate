import * as Display from './display';
import * as Dialog from './dialog';
import CachedPromise from '../data/cachedPromise';

export abstract class ExpressionMenuBase {
  abstract isSelected(): boolean;
}

export class ExpressionMenu extends ExpressionMenuBase {
  rows: CachedPromise<ExpressionMenuRow[]>;
  variable: boolean = false;

  isSelected(): boolean {
    let rows = this.rows.getImmediateResult();
    if (rows && rows.some((row) => row.selected)) {
      return true;
    }
    return false;
  }
}

export abstract class ExpressionMenuRow extends ExpressionMenuBase {
  extraSpace: boolean = false;
  selected: boolean = false;

  isSelected(): boolean {
    return this.selected;
  }
}

export abstract class ExpressionMenuCell extends ExpressionMenuRow {
}

export class ExpressionMenuItem extends ExpressionMenuCell {
  expression: Display.RenderedExpression;
  action: ExpressionMenuAction;
}

export class ExpressionMenuItemList extends ExpressionMenuRow {
  items: CachedPromise<ExpressionMenuItem[]>;
  variable: boolean = false;

  isSelected(): boolean {
    if (super.isSelected()) {
      return true;
    }
    let items = this.items.getImmediateResult();
    if (items && items.some((item) => item.selected)) {
      return true;
    }
    return false;
  }
}

export class StandardExpressionMenuRow extends ExpressionMenuRow {
  title: string | Display.RenderedExpression;
  titleAction?: ExpressionMenuAction;
  iconType?: any;
  subMenu?: ExpressionMenuBase;
  previewSubMenu: boolean = true;

  isSelected(): boolean {
    return super.isSelected() || (this.subMenu !== undefined && this.subMenu.isSelected());
  }
}

export class ExpressionMenuSeparator extends ExpressionMenuRow {
}

export class ExpressionMenuTextInput extends ExpressionMenuCell {
  text: string;
  action: ExpressionMenuAction;
}

export abstract class ExpressionMenuAction {
}

export class ImmediateExpressionMenuAction extends ExpressionMenuAction {
  onExecute: () => void;
}

export class DialogExpressionMenuAction extends ExpressionMenuAction {
  onOpen: () => Dialog.DialogBase;
}
