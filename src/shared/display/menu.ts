import * as Display from './display';
import * as Dialog from './dialog';

export abstract class ExpressionMenuBase {
  abstract isSelected(): boolean;
}

export class ExpressionMenu extends ExpressionMenuBase {
  rows: ExpressionMenuRow[];

  isSelected(): boolean {
    return this.rows.some((row) => row.isSelected());
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
  items: ExpressionMenuItem[];

  isSelected(): boolean {
    return super.isSelected() || this.items.some((item) => item.selected);
  }
}

export class StandardExpressionMenuRow extends ExpressionMenuRow {
  title: string | Display.RenderedExpression;
  titleAction?: ExpressionMenuAction;
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
  onOpen: () => Dialog.ExpressionDialog;
}
