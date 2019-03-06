import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import { HLMTermType } from './hlm';
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
      // TODO hide certain parameters depending on parameter list

      let elementParameter = new Fmt.Parameter;
      elementParameter.name = 'x';
      let elementTypeExpression = new FmtHLM.MetaRefExpression_Element;
      elementTypeExpression._set = new PlaceholderExpression(HLMTermType.SetTerm);
      let elementType = new Fmt.Type;
      elementType.expression = elementTypeExpression;
      elementType.arrayDimensions = 0;
      elementParameter.type = elementType;
      this.addParameterPlaceholderRow(elementParameter, parameterRenderFn, parameterInsertFn, menu.rows);

      let subsetParameter = new Fmt.Parameter;
      subsetParameter.name = 'S';
      let subsetTypeExpression = new FmtHLM.MetaRefExpression_Subset;
      subsetTypeExpression.superset = new PlaceholderExpression(HLMTermType.SetTerm);
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

      let constraintParameter = new Fmt.Parameter;
      constraintParameter.name = '_1';
      let constraintTypeExpression = new FmtHLM.MetaRefExpression_Constraint;
      constraintTypeExpression.formula = new PlaceholderExpression(HLMTermType.Formula);
      let constraintType = new Fmt.Type;
      constraintType.expression = constraintTypeExpression;
      constraintType.arrayDimensions = 0;
      constraintParameter.type = constraintType;
      this.addParameterPlaceholderRow(constraintParameter, parameterRenderFn, parameterInsertFn, menu.rows);

      menu.rows.push(new Menu.ExpressionMenuSeparator);

      let advancedSubMenu = new Menu.ExpressionMenu;
      advancedSubMenu.rows = [];

      let propParameter = new Fmt.Parameter;
      propParameter.name = 'p';
      let propType = new Fmt.Type;
      propType.expression = new FmtHLM.MetaRefExpression_Prop;
      propType.arrayDimensions = 0;
      propParameter.type = propType;
      this.addParameterPlaceholderRow(propParameter, parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);

      advancedSubMenu.rows.push(new Menu.ExpressionMenuSeparator);

      let elementDefinitionParameter = new Fmt.Parameter;
      elementDefinitionParameter.name = 'x';
      let elementDefinitionTypeExpression = new FmtHLM.MetaRefExpression_Def;
      elementDefinitionTypeExpression.element = new PlaceholderExpression(HLMTermType.ElementTerm);
      let elementDefinitionType = new Fmt.Type;
      elementDefinitionType.expression = elementDefinitionTypeExpression;
      elementDefinitionType.arrayDimensions = 0;
      elementDefinitionParameter.type = elementDefinitionType;
      this.addParameterPlaceholderRow(elementDefinitionParameter, parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);

      let setDefinitionParameter = new Fmt.Parameter;
      setDefinitionParameter.name = 'S';
      let setDefinitionTypeExpression = new FmtHLM.MetaRefExpression_SetDef;
      setDefinitionTypeExpression._set = new PlaceholderExpression(HLMTermType.SetTerm);
      let setDefinitionType = new Fmt.Type;
      setDefinitionType.expression = setDefinitionTypeExpression;
      setDefinitionType.arrayDimensions = 0;
      setDefinitionParameter.type = setDefinitionType;
      this.addParameterPlaceholderRow(setDefinitionParameter, parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);

      advancedSubMenu.rows.push(new Menu.ExpressionMenuSeparator);

      let bindingParameter = new Fmt.Parameter;
      bindingParameter.name = 'i';
      let bindingTypeExpression = new FmtHLM.MetaRefExpression_Binding;
      bindingTypeExpression._set = new PlaceholderExpression(HLMTermType.SetTerm);
      bindingTypeExpression.parameters = Object.create(Fmt.ParameterList.prototype);
      let bindingType = new Fmt.Type;
      bindingType.expression = bindingTypeExpression;
      bindingType.arrayDimensions = 0;
      bindingParameter.type = bindingType;
      this.addParameterPlaceholderRow(bindingParameter, parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);

      let advanced = new Menu.StandardExpressionMenuRow;
      advanced.title = 'Advanced';
      advanced.subMenu = advancedSubMenu;
      advanced.previewSubMenu = false;
      menu.rows.push(advanced);

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
