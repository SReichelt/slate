import * as Display from './display';

export interface ExpressionMenu {
  items: ExpressionMenuItem[];
}

export interface ExpressionMenuItem {
  title: string;
  onClick?: () => void;
  selections: ExpressionMenuSelection[];
  inline: boolean;
}

export interface ExpressionMenuSelection {
  expression: Display.RenderedExpression;
  onClick: () => void;
}
