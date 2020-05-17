import * as Notation from './notation';
import * as Dialog from './dialog';
import CachedPromise from '../data/cachedPromise';

export abstract class ExpressionMenuBase {
  abstract isSelected(): boolean;
}

export class ExpressionMenu extends ExpressionMenuBase {
  variable: boolean = false;

  constructor(public rows: CachedPromise<ExpressionMenuRow[]>) {
    super();
  }

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
  action: ExpressionMenuAction;

  constructor(public expression: Notation.RenderedExpression) {
    super();
  }
}

export class ExpressionMenuItemList extends ExpressionMenuRow {
  variable: boolean = false;

  constructor(public items: CachedPromise<ExpressionMenuItem[]>) {
    super();
  }

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
  titleAction?: ExpressionMenuAction;
  iconType?: any;
  subMenu?: ExpressionMenuBase;
  previewSubMenu: boolean = true;

  constructor(public title: string | Notation.RenderedExpression) {
    super();
  }

  isSelected(): boolean {
    return super.isSelected() || (this.subMenu !== undefined && this.subMenu.isSelected());
  }
}

export class ExpressionMenuSeparator extends ExpressionMenuRow {
}

export class ExpressionMenuTextInput extends ExpressionMenuCell {
  text: string;
  expectedTextLength: number;
  action: ExpressionMenuAction;
}

export abstract class ExpressionMenuAction {
}

export class ImmediateExpressionMenuAction extends ExpressionMenuAction {
  constructor(public onExecute: () => void | CachedPromise<void>) {
    super();
  }
}

export class DialogExpressionMenuAction extends ExpressionMenuAction {
  constructor(public onOpen: () => Dialog.DialogBase) {
    super();
  }
}
