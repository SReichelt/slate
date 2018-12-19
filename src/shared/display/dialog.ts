import * as Display from './display';

export class ExpressionDialog {
  items: ExpressionDialogItem[];
  onOK: () => void;
}

export abstract class ExpressionDialogItem {
}

export class ExpressionDialogParameterItem extends ExpressionDialogItem {
  parameter: Display.RenderedExpression;
  value: Display.RenderedExpression;
}
