import * as Display from './display';

export abstract class ExpressionMenuBase {
}

export class ExpressionMenu extends ExpressionMenuBase {
  rows: ExpressionMenuRow[];
}

export abstract class ExpressionMenuRow extends ExpressionMenuBase {
  selected: boolean = false;
}

export abstract class ExpressionMenuCell extends ExpressionMenuRow {
}

export class ExpressionMenuItem extends ExpressionMenuCell {
  expression: Display.RenderedExpression;
  action: ExpressionMenuAction;
}

export class ExpressionMenuItemList extends ExpressionMenuRow {
  items: ExpressionMenuItem[];
}

export class StandardExpressionMenuRow extends ExpressionMenuRow {
  title: string;
  titleAction?: ExpressionMenuAction;
  subMenu?: ExpressionMenuBase;
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
