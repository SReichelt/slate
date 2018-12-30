import * as Display from './display';

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
  parameter: Display.RenderedExpression;
  onGetValue: () => Display.RenderedExpression;
}
