import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import { HLMTermType } from './hlm';
import { GenericEditHandler, PlaceholderExpression } from '../generic/editHandler';

export type ParameterRenderFn = (parameter: Fmt.Parameter) => Display.RenderedExpression;
export type ParameterInsertFn = (parameter: Fmt.Parameter) => void;

export interface ParameterSelection {
  allowConstraint: boolean;
  allowProposition: boolean;
  allowDefinition: boolean;
  allowBinding: boolean;
}

export class HLMEditHandler extends GenericEditHandler {
  addParameterMenu(expression: Display.RenderedExpression, parameterRenderFn: ParameterRenderFn, parameterInsertFn: ParameterInsertFn, parameterSelection: ParameterSelection): void {
    let semanticLink = new Display.SemanticLink(expression, false, false);

    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      // TODO automatically modify names based on context

      let elementType = new FmtHLM.MetaRefExpression_Element;
      elementType._set = new PlaceholderExpression(HLMTermType.SetTerm);
      this.addParameterPlaceholderRow(elementType, 'x', parameterRenderFn, parameterInsertFn, menu.rows);

      let subsetType = new FmtHLM.MetaRefExpression_Subset;
      subsetType.superset = new PlaceholderExpression(HLMTermType.SetTerm);
      this.addParameterPlaceholderRow(subsetType, 'S', parameterRenderFn, parameterInsertFn, menu.rows);

      this.addParameterPlaceholderRow(new FmtHLM.MetaRefExpression_Set, 'S', parameterRenderFn, parameterInsertFn, menu.rows);

      if (parameterSelection.allowConstraint) {
        let constraintType = new FmtHLM.MetaRefExpression_Constraint;
        constraintType.formula = new PlaceholderExpression(HLMTermType.Formula);
        this.addParameterPlaceholderRow(constraintType, '_1', parameterRenderFn, parameterInsertFn, menu.rows);
      }

      if (parameterSelection.allowProposition || parameterSelection.allowDefinition || parameterSelection.allowBinding) {
        menu.rows.push(new Menu.ExpressionMenuSeparator);

        let advancedSubMenu = new Menu.ExpressionMenu;
        advancedSubMenu.rows = [];

        if (parameterSelection.allowProposition) {
          this.addParameterPlaceholderRow(new FmtHLM.MetaRefExpression_Prop, 'p', parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);

          advancedSubMenu.rows.push(new Menu.ExpressionMenuSeparator);
        }

        if (parameterSelection.allowDefinition) {
          let elementDefinitionType = new FmtHLM.MetaRefExpression_Def;
          elementDefinitionType.element = new PlaceholderExpression(HLMTermType.ElementTerm);
          this.addParameterPlaceholderRow(elementDefinitionType, 'x', parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);

          let setDefinitionType = new FmtHLM.MetaRefExpression_SetDef;
          setDefinitionType._set = new PlaceholderExpression(HLMTermType.SetTerm);
          this.addParameterPlaceholderRow(setDefinitionType, 'S', parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);

          advancedSubMenu.rows.push(new Menu.ExpressionMenuSeparator);
        }

        if (parameterSelection.allowBinding) {
          let bindingType = new FmtHLM.MetaRefExpression_Binding;
          bindingType._set = new PlaceholderExpression(HLMTermType.SetTerm);
          bindingType.parameters = Object.create(Fmt.ParameterList.prototype);
          this.addParameterPlaceholderRow(bindingType, 'i', parameterRenderFn, parameterInsertFn, advancedSubMenu.rows);
        }

        let advanced = new Menu.StandardExpressionMenuRow;
        advanced.title = 'Advanced';
        advanced.subMenu = advancedSubMenu;
        advanced.previewSubMenu = false;
        menu.rows.push(advanced);
      }

      return menu;
    };

    expression.semanticLinks = [semanticLink];
  }

  private addParameterPlaceholderRow(type: Fmt.Expression, defaultName: string, parameterRenderFn: ParameterRenderFn, parameterInsertFn: ParameterInsertFn, rows: Menu.ExpressionMenuRow[]) {
    let parameter = new Fmt.Parameter;
    parameter.name = defaultName;
    let parameterType = new Fmt.Type;
    parameterType.expression = type;
    parameterType.arrayDimensions = 0;
    parameter.type = parameterType;

    let renderedParameter = parameterRenderFn(parameter);

    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => parameterInsertFn(parameter);

    let item = new Menu.ExpressionMenuItem;
    item.expression = renderedParameter;
    item.action = action;
    rows.push(item);
  }

  protected addParameterToGroup(param: Fmt.Parameter, parameterList?: Fmt.Parameter[]): Fmt.Parameter | undefined {
    // TODO also support creation of bindings with multiple parameters
    let paramClone = super.addParameterToGroup(param, parameterList);
    if (paramClone) {
      let type = paramClone.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        type.superset = new FmtHLM.MetaRefExpression_previous;
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        type._set = new FmtHLM.MetaRefExpression_previous;
      }
    }
    return paramClone;
  }
}
