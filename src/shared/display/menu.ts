import * as Display from './display';

export class ExpressionMenu {
  rows: ExpressionMenuRow[];
}

export abstract class ExpressionMenuRow {
}

export class ExpressionMenuItem extends ExpressionMenuRow {
  expression: Display.RenderedExpression;
  action: ExpressionMenuAction;
}

export class ExpressionMenuItemList extends ExpressionMenuRow {
  items: ExpressionMenuItem[];
}

export class StandardExpressionMenuRow extends ExpressionMenuRow {
  title: string;
  titleAction?: ExpressionMenuAction;
  subMenu?: ExpressionMenu;
}

export class ExpressionMenuSeparator extends ExpressionMenuRow {
}

export abstract class ExpressionMenuAction {
}

export class ImmediateExpressionMenuAction extends ExpressionMenuAction {
  onExecute: () => void;
}
