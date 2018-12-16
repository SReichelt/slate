import * as Display from './display';

export class ExpressionMenu {
  rows: ExpressionMenuRow[];
}

export abstract class ExpressionMenuRow {
  selected: boolean = false;
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
  subMenu?: ExpressionMenu | ExpressionMenuRow;
}

export class ExpressionMenuSeparator extends ExpressionMenuRow {
}

export class ExpressionMenuTextInput extends ExpressionMenuRow {
  text: string;
  action: ExpressionMenuAction;
}

export abstract class ExpressionMenuAction {
}

export class ImmediateExpressionMenuAction extends ExpressionMenuAction {
  onExecute: () => void;
}
