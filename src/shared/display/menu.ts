import * as Display from './display';

export class ExpressionMenu {
  rows: ExpressionMenuRow[];
}

export abstract class ExpressionMenuRow {
}

export class ExpressionMenuItem extends ExpressionMenuRow {
  expression: Display.RenderedExpression;
  onClick: () => void;
}

export class ExpressionMenuItemList extends ExpressionMenuRow {
  items: ExpressionMenuItem[];
}

export class StandardExpressionMenuRow extends ExpressionMenuRow {
  title: string;
  onClick?: () => void;
  subMenu?: ExpressionMenu;
}

export class ExpressionMenuSeparator extends ExpressionMenuRow {
}
