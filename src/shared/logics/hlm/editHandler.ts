import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import * as Logic from '../logic';
import { GenericEditHandler, PlaceholderExpression } from '../generic/editHandler';

export type ParameterRenderFn = (parameter: Fmt.Parameter) => Display.RenderedExpression;
export type ParameterInsertFn = (parameter: Fmt.Parameter) => void;

export class HLMEditHandler extends GenericEditHandler {
  getParameterPlaceholder(parameterRenderFn: ParameterRenderFn, parameterInsertFn: ParameterInsertFn): Display.RenderedExpression {
    let insertButton = new Display.InsertPlaceholderExpression;
    let semanticLink = new Display.SemanticLink(insertButton, false, false);
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];
      // TODO automatically modify names based on context
      let elementParameter = new Fmt.Parameter;
      elementParameter.name = 'x';
      let elementTypeExpression = new FmtHLM.MetaRefExpression_Element;
      elementTypeExpression._set = new PlaceholderExpression(Logic.LogicDefinitionType.SetOperator);
      let elementType = new Fmt.Type;
      elementType.expression = elementTypeExpression;
      elementType.arrayDimensions = 0;
      elementParameter.type = elementType;
      this.addParameterPlaceholderRow(elementParameter, parameterRenderFn, parameterInsertFn, menu.rows);
      let subsetParameter = new Fmt.Parameter;
      subsetParameter.name = 'S';
      let subsetTypeExpression = new FmtHLM.MetaRefExpression_Subset;
      subsetTypeExpression.superset = new PlaceholderExpression(Logic.LogicDefinitionType.SetOperator);
      let subsetType = new Fmt.Type;
      subsetType.expression = subsetTypeExpression;
      subsetType.arrayDimensions = 0;
      subsetParameter.type = subsetType;
      this.addParameterPlaceholderRow(subsetParameter, parameterRenderFn, parameterInsertFn, menu.rows);
      let setParameter = new Fmt.Parameter;
      setParameter.name = 'S';
      let setType = new Fmt.Type;
      setType.expression = new FmtHLM.MetaRefExpression_Set;
      setType.arrayDimensions = 0;
      setParameter.type = setType;
      this.addParameterPlaceholderRow(setParameter, parameterRenderFn, parameterInsertFn, menu.rows);
      return menu;
    };
    insertButton.semanticLinks = [semanticLink];
    return insertButton;
  }

  private addParameterPlaceholderRow(parameter: Fmt.Parameter, parameterRenderFn: ParameterRenderFn, parameterInsertFn: ParameterInsertFn, rows: Menu.ExpressionMenuRow[]) {
    let renderedParameter = parameterRenderFn(parameter);
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => parameterInsertFn(parameter);
    let item = new Menu.ExpressionMenuItem;
    item.expression = renderedParameter;
    item.action = action;
    rows.push(item);
  }
}
