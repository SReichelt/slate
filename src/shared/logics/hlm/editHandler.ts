import * as Fmt from '../../format/format';
import * as Edit from '../../format/edit';
import * as FmtHLM from './meta';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import { HLMTermType } from './hlm';
import { GenericEditHandler, PlaceholderExpression, RenderParameterFn, InsertParameterFn, RenderExpressionFn, InsertExpressionFn } from '../generic/editHandler';

export interface ParameterSelection {
  allowConstraint: boolean;
  allowProposition: boolean;
  allowDefinition: boolean;
  allowBinding: boolean;
}

export class HLMEditHandler extends GenericEditHandler {
  addParameterMenu(semanticLink: Display.SemanticLink, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn, parameterSelection: ParameterSelection): void {
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      // TODO automatically modify names based on context

      let elementType = new FmtHLM.MetaRefExpression_Element;
      elementType._set = new PlaceholderExpression(HLMTermType.SetTerm);
      menu.rows.push(this.getParameterPlaceholderItem(elementType, 'x', onRenderParam, onInsertParam));

      let subsetType = new FmtHLM.MetaRefExpression_Subset;
      subsetType.superset = new PlaceholderExpression(HLMTermType.SetTerm);
      menu.rows.push(this.getParameterPlaceholderItem(subsetType, 'S', onRenderParam, onInsertParam));

      menu.rows.push(this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Set, 'S', onRenderParam, onInsertParam));

      if (parameterSelection.allowConstraint) {
        let constraintType = new FmtHLM.MetaRefExpression_Constraint;
        constraintType.formula = new PlaceholderExpression(HLMTermType.Formula);
        menu.rows.push(this.getParameterPlaceholderItem(constraintType, '_1', onRenderParam, onInsertParam));
      }

      if (parameterSelection.allowProposition || parameterSelection.allowDefinition || parameterSelection.allowBinding) {
        let advancedSubMenu = new Menu.ExpressionMenu;
        advancedSubMenu.rows = [];

        if (parameterSelection.allowProposition) {
          advancedSubMenu.rows.push(
            this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Prop, 'p', onRenderParam, onInsertParam),
            new Menu.ExpressionMenuSeparator
          );
        }

        if (parameterSelection.allowDefinition) {
          let elementDefinitionType = new FmtHLM.MetaRefExpression_Def;
          elementDefinitionType.element = new PlaceholderExpression(HLMTermType.ElementTerm);
          advancedSubMenu.rows.push(this.getParameterPlaceholderItem(elementDefinitionType, 'x', onRenderParam, onInsertParam));

          let setDefinitionType = new FmtHLM.MetaRefExpression_SetDef;
          setDefinitionType._set = new PlaceholderExpression(HLMTermType.SetTerm);
          advancedSubMenu.rows.push(this.getParameterPlaceholderItem(setDefinitionType, 'S', onRenderParam, onInsertParam));

          advancedSubMenu.rows.push(new Menu.ExpressionMenuSeparator);
        }

        if (parameterSelection.allowBinding) {
          let bindingType = new FmtHLM.MetaRefExpression_Binding;
          bindingType._set = new PlaceholderExpression(HLMTermType.SetTerm);
          bindingType.parameters = Object.create(Fmt.ParameterList.prototype);
          advancedSubMenu.rows.push(this.getParameterPlaceholderItem(bindingType, 'i', onRenderParam, onInsertParam));
        }

        let advanced = new Menu.StandardExpressionMenuRow;
        advanced.title = 'Advanced';
        advanced.subMenu = advancedSubMenu;
        advanced.previewSubMenu = false;
        menu.rows.push(
          new Menu.ExpressionMenuSeparator,
          advanced
        );
      }

      return menu;
    };
  }

  private getParameterPlaceholderItem(type: Fmt.Expression, defaultName: string, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn): Menu.ExpressionMenuItem {
    let parameter = this.createParameter(type, defaultName);

    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => onInsertParam(parameter);

    let item = new Menu.ExpressionMenuItem;
    item.expression = onRenderParam(parameter);
    item.action = action;
    return item;
  }

  private createParameter(type: Fmt.Expression, defaultName: string): Fmt.Parameter {
    let parameter = new Fmt.Parameter;
    parameter.name = defaultName;
    let parameterType = new Fmt.Type;
    parameterType.expression = type;
    parameterType.arrayDimensions = 0;
    parameter.type = parameterType;
    return parameter;
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

  addSetTermMenu(semanticLink: Display.SemanticLink, term: Fmt.Expression, onRenderTerm: RenderExpressionFn, allowSubset: boolean): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
    if (expressionEditInfo) {
      this.addSetTermMenuWithEditInfo(semanticLink, term, onRenderTerm, allowSubset, expressionEditInfo);
    }
  }

  private addSetTermMenuWithEditInfo(semanticLink: Display.SemanticLink, term: Fmt.Expression | undefined, onRenderTerm: RenderExpressionFn, allowSubset: boolean, expressionEditInfo: Edit.ExpressionEditInfo): void {
    // TODO select item if existing term is not a placeholder
    // TODO pre-fill terms according to existing term
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      if (expressionEditInfo.optional) {
        menu.rows.push(this.getRemoveRow(expressionEditInfo));
      }

      let isAllowed = (variable: Fmt.Parameter) => {
        let type = variable.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_SetDef;
      };
      let variableRow = this.getVariableRow(expressionEditInfo, isAllowed, onRenderTerm);
      if (variableRow) {
        menu.rows.push(variableRow);
      }

      menu.rows.push(this.getEnumerationRow(expressionEditInfo, onRenderTerm));

      if (allowSubset) {
        menu.rows.push(
          this.getSubsetRow(expressionEditInfo, onRenderTerm),
          this.getSetCasesRow(expressionEditInfo, onRenderTerm)
        );
      }

      return menu;
    };
  }

  addElementTermMenu(semanticLink: Display.SemanticLink, term: Fmt.Expression, onRenderTerm: RenderExpressionFn): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
    if (expressionEditInfo) {
      this.addElementTermMenuWithEditInfo(semanticLink, term, onRenderTerm, expressionEditInfo);
    }
  }

  private addElementTermMenuWithEditInfo(semanticLink: Display.SemanticLink, term: Fmt.Expression | undefined, onRenderTerm: RenderExpressionFn, expressionEditInfo: Edit.ExpressionEditInfo): void {
    // TODO select item if existing term is not a placeholder
    // TODO pre-fill terms according to existing term
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      if (expressionEditInfo.optional) {
        menu.rows.push(this.getRemoveRow(expressionEditInfo));
      }

      let isAllowed = (variable: Fmt.Parameter) => {
        let type = variable.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def;
      };
      let variableRow = this.getVariableRow(expressionEditInfo, isAllowed, onRenderTerm);
      if (variableRow) {
        menu.rows.push(variableRow);
      }

      menu.rows.push(this.getElementCasesRow(expressionEditInfo, onRenderTerm));

      return menu;
    };
  }

  addFormulaMenu(semanticLink: Display.SemanticLink, formula: Fmt.Expression, onRenderTerm: RenderExpressionFn): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(formula);
    if (expressionEditInfo) {
      this.addFormulaMenuWithEditInfo(semanticLink, formula, onRenderTerm, expressionEditInfo);
    }
  }

  private addFormulaMenuWithEditInfo(semanticLink: Display.SemanticLink, formula: Fmt.Expression | undefined, onRenderFormula: RenderExpressionFn, expressionEditInfo: Edit.ExpressionEditInfo): void {
    // TODO select item if existing term is not a placeholder
    // TODO pre-fill formulas according to existing term
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      if (expressionEditInfo.optional) {
        menu.rows.push(this.getRemoveRow(expressionEditInfo));
      }

      let isAllowed = (variable: Fmt.Parameter) => {
        let type = variable.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_Prop;
      };
      let variableRow = this.getVariableRow(expressionEditInfo, isAllowed, onRenderFormula);
      if (variableRow) {
        menu.rows.push(variableRow);
      }

      menu.rows.push(
        this.getConnectiveRow(expressionEditInfo, onRenderFormula),
        this.getQuantifierRow(expressionEditInfo, onRenderFormula),
        this.getRelationRow(expressionEditInfo, onRenderFormula),
        this.getFormulaCasesRow(expressionEditInfo, onRenderFormula)
      );

      return menu;
    };
  }

  private getRemoveRow(expressionEditInfo: Edit.ExpressionEditInfo): Menu.ExpressionMenuRow {
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => expressionEditInfo.onSetValue(undefined);
    let removeRow = new Menu.StandardExpressionMenuRow;
    removeRow.title = 'Remove';
    removeRow.titleAction = action;
    return removeRow;
  }

  private getVariableRow(expressionEditInfo: Edit.ExpressionEditInfo, isAllowed: (variable: Fmt.Parameter) => boolean, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow | undefined {
    // TODO highlight variables
    let variableItems: Menu.ExpressionMenuItem[] = [];
    for (let variable of expressionEditInfo.context.getVariables()) {
      if (isAllowed(variable)) {
        let variableRefExpression = new Fmt.VariableRefExpression;
        variableRefExpression.variable = variable;
        // TODO add placeholders for indices
        variableItems.push(this.getExpressionItem(variableRefExpression, expressionEditInfo, onRenderTerm));
      }
    }
    if (variableItems.length) {
      let variableList = new Menu.ExpressionMenuItemList;
      variableList.items = variableItems;
      let variableRow = new Menu.StandardExpressionMenuRow;
      variableRow.title = 'Variable';
      variableRow.subMenu = variableList;
      return variableRow;
    }
    return undefined;
  }

  private getEnumerationRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let enumerationExpression = new FmtHLM.MetaRefExpression_enumeration;

    let enumerationRow = new Menu.StandardExpressionMenuRow;
    enumerationRow.title = 'Enumeration';
    enumerationRow.subMenu = this.getExpressionItem(enumerationExpression, expressionEditInfo, onRenderTerm);
    return enumerationRow;
  }

  private getSubsetRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let subsetExpression = new FmtHLM.MetaRefExpression_subset;
    let elementType = new FmtHLM.MetaRefExpression_Element;
    elementType._set = new PlaceholderExpression(HLMTermType.SetTerm);
    subsetExpression.parameter = this.createParameter(elementType, 'x');
    subsetExpression.formula = new PlaceholderExpression(HLMTermType.Formula);

    let extendedSubsetExpression = new FmtHLM.MetaRefExpression_extendedSubset;
    extendedSubsetExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    extendedSubsetExpression.term = new PlaceholderExpression(HLMTermType.ElementTerm);

    let subsetMenu = new Menu.ExpressionMenu;
    subsetMenu.rows = [
      this.getExpressionItem(subsetExpression, expressionEditInfo, onRenderTerm),
      this.getExpressionItem(extendedSubsetExpression, expressionEditInfo, onRenderTerm)
    ];
    let subsetRow = new Menu.StandardExpressionMenuRow;
    subsetRow.title = 'Subset';
    subsetRow.subMenu = subsetMenu;
    return subsetRow;
  }

  private getSetCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let structuralExpression = new FmtHLM.MetaRefExpression_setStructuralCases;
    structuralExpression.term = new PlaceholderExpression(HLMTermType.ElementTerm);
    structuralExpression.construction = new PlaceholderExpression(HLMTermType.SetTerm);
    structuralExpression.cases = [];

    let casesMenu = new Menu.ExpressionMenu;
    casesMenu.rows = [
      // TODO add "induction on <parameter>" / "decompose <parameter>" as a special case
      this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderTerm)
    ];
    let casesRow = new Menu.StandardExpressionMenuRow;
    casesRow.title = 'Cases';
    casesRow.subMenu = casesMenu;
    return casesRow;
  }

  private getElementCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let structuralExpression = new FmtHLM.MetaRefExpression_structuralCases;
    structuralExpression.term = new PlaceholderExpression(HLMTermType.ElementTerm);
    structuralExpression.construction = new PlaceholderExpression(HLMTermType.SetTerm);
    structuralExpression.cases = [];

    let caseExpression = new FmtHLM.MetaRefExpression_cases;
    let positiveCase = new FmtHLM.ObjectContents_Case;
    positiveCase.formula = new PlaceholderExpression(HLMTermType.Formula);
    positiveCase.value = new PlaceholderExpression(HLMTermType.ElementTerm);
    let negativeCase = new FmtHLM.ObjectContents_Case;
    negativeCase.formula = new PlaceholderExpression(HLMTermType.Formula);
    negativeCase.value = new PlaceholderExpression(HLMTermType.ElementTerm);
    caseExpression.cases = [positiveCase, negativeCase];

    let casesMenu = new Menu.ExpressionMenu;
    casesMenu.rows = [
      // TODO add "induction on <parameter>" / "decompose <parameter>" as a special case
      this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderTerm),
      this.getExpressionItem(caseExpression, expressionEditInfo, onRenderTerm)
    ];
    let casesRow = new Menu.StandardExpressionMenuRow;
    casesRow.title = 'Cases';
    casesRow.subMenu = casesMenu;
    return casesRow;
  }

  private getConnectiveRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let andExpression = new FmtHLM.MetaRefExpression_and;
    andExpression.formulae = [new PlaceholderExpression(HLMTermType.Formula), new PlaceholderExpression(HLMTermType.Formula)];
    let orExpression = new FmtHLM.MetaRefExpression_or;
    orExpression.formulae = [new PlaceholderExpression(HLMTermType.Formula), new PlaceholderExpression(HLMTermType.Formula)];
    let equivExpression = new FmtHLM.MetaRefExpression_equiv;
    equivExpression.left = new PlaceholderExpression(HLMTermType.Formula);
    equivExpression.right = new PlaceholderExpression(HLMTermType.Formula);

    let mainList = new Menu.ExpressionMenuItemList;
    mainList.items = [
      this.getExpressionItem(andExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(orExpression, expressionEditInfo, onRenderFormula)
    ];
    mainList.extraSpace = true;
    let secondaryList = new Menu.ExpressionMenuItemList;
    secondaryList.items = [
      this.getExpressionItem(equivExpression, expressionEditInfo, onRenderFormula)
    ];
    secondaryList.extraSpace = true;
    let connectiveMenu = new Menu.ExpressionMenu;
    connectiveMenu.rows = [
      mainList,
      secondaryList
    ];
    let connectiveRow = new Menu.StandardExpressionMenuRow;
    connectiveRow.title = 'Connective';
    connectiveRow.subMenu = connectiveMenu;
    return connectiveRow;
  }

  private getQuantifierRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let forallExpression = new FmtHLM.MetaRefExpression_forall;
    forallExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    forallExpression.formula = new PlaceholderExpression(HLMTermType.Formula);
    let existsExpression = new FmtHLM.MetaRefExpression_exists;
    existsExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    existsExpression.formula = new PlaceholderExpression(HLMTermType.Formula);
    let existsUniqueExpression = new FmtHLM.MetaRefExpression_existsUnique;
    existsUniqueExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    existsUniqueExpression.formula = new PlaceholderExpression(HLMTermType.Formula);
    let negatedExistsExpression = new FmtHLM.MetaRefExpression_not;
    negatedExistsExpression.formula = existsExpression;

    let mainList = new Menu.ExpressionMenuItemList;
    mainList.items = [
      this.getExpressionItem(forallExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(existsExpression, expressionEditInfo, onRenderFormula)
    ];
    mainList.extraSpace = true;
    let secondaryList = new Menu.ExpressionMenuItemList;
    secondaryList.items = [
      this.getExpressionItem(existsUniqueExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedExistsExpression, expressionEditInfo, onRenderFormula)
    ];
    secondaryList.extraSpace = true;
    let quantifierMenu = new Menu.ExpressionMenu;
    quantifierMenu.rows = [
      mainList,
      secondaryList
    ];
    let quantifierRow = new Menu.StandardExpressionMenuRow;
    quantifierRow.title = 'Quantifier';
    quantifierRow.subMenu = quantifierMenu;
    return quantifierRow;
  }

  private getRelationRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let equalsExpression = new FmtHLM.MetaRefExpression_equals;
    equalsExpression.left = new PlaceholderExpression(HLMTermType.ElementTerm);
    equalsExpression.right = new PlaceholderExpression(HLMTermType.ElementTerm);
    let inExpression = new FmtHLM.MetaRefExpression_in;
    inExpression.element = new PlaceholderExpression(HLMTermType.ElementTerm);
    inExpression._set = new PlaceholderExpression(HLMTermType.SetTerm);
    let subExpression = new FmtHLM.MetaRefExpression_sub;
    subExpression.subset = new PlaceholderExpression(HLMTermType.SetTerm);
    subExpression.superset = new PlaceholderExpression(HLMTermType.SetTerm);
    let setEqualsExpression = new FmtHLM.MetaRefExpression_setEquals;
    setEqualsExpression.left = new PlaceholderExpression(HLMTermType.SetTerm);
    setEqualsExpression.right = new PlaceholderExpression(HLMTermType.SetTerm);
    let negatedEqualsExpression = new FmtHLM.MetaRefExpression_not;
    negatedEqualsExpression.formula = equalsExpression;
    let negatedInExpression = new FmtHLM.MetaRefExpression_not;
    negatedInExpression.formula = inExpression;
    let negatedSubExpression = new FmtHLM.MetaRefExpression_not;
    negatedSubExpression.formula = subExpression;
    let negatedSetEqualsExpression = new FmtHLM.MetaRefExpression_not;
    negatedSetEqualsExpression.formula = setEqualsExpression;

    let mainList = new Menu.ExpressionMenuItemList;
    mainList.items = [
      this.getExpressionItem(equalsExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(inExpression, expressionEditInfo, onRenderFormula)
    ];
    mainList.extraSpace = true;
    let secondaryList = new Menu.ExpressionMenuItemList;
    secondaryList.items = [
      this.getExpressionItem(subExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(setEqualsExpression, expressionEditInfo, onRenderFormula)
    ];
    secondaryList.extraSpace = true;
    let negatedMainList = new Menu.ExpressionMenuItemList;
    negatedMainList.items = [
      this.getExpressionItem(negatedEqualsExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedInExpression, expressionEditInfo, onRenderFormula)
    ];
    negatedMainList.extraSpace = true;
    let negatedSecondaryList = new Menu.ExpressionMenuItemList;
    negatedSecondaryList.items = [
      this.getExpressionItem(negatedSubExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedSetEqualsExpression, expressionEditInfo, onRenderFormula)
    ];
    negatedSecondaryList.extraSpace = true;
    let relationMenu = new Menu.ExpressionMenu;
    relationMenu.rows = [
      mainList,
      secondaryList,
      negatedMainList,
      negatedSecondaryList
    ];
    let relationRow = new Menu.StandardExpressionMenuRow;
    relationRow.title = 'Relation';
    relationRow.subMenu = relationMenu;
    return relationRow;
  }

  private getFormulaCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let structuralExpression = new FmtHLM.MetaRefExpression_structural;
    structuralExpression.term = new PlaceholderExpression(HLMTermType.ElementTerm);
    structuralExpression.construction = new PlaceholderExpression(HLMTermType.SetTerm);
    structuralExpression.cases = [];

    let casesMenu = new Menu.ExpressionMenu;
    casesMenu.rows = [
      // TODO add "induction on <parameter>" / "decompose <parameter>" as a special case
      this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderFormula)
    ];
    let casesRow = new Menu.StandardExpressionMenuRow;
    casesRow.title = 'Cases';
    casesRow.subMenu = casesMenu;
    return casesRow;
  }

  private getExpressionItem(expression: Fmt.Expression, expressionEditInfo: Edit.ExpressionEditInfo, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuItem {
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => expressionEditInfo.onSetValue(expression);

    let item = new Menu.ExpressionMenuItem;
    item.expression = onRenderExpression(expression);
    item.action = action;
    return item;
  }

  addElementTermInsertButton(items: Display.RenderedExpression[], parentExpression: Fmt.Expression, onInsertTerm: InsertExpressionFn, onRenderTerm: RenderExpressionFn): void {
    let insertButton = new Display.InsertPlaceholderExpression;
    let semanticLink = new Display.SemanticLink(insertButton, false, false);
    let parentExpressionEditInfo = this.editAnalysis.expressionEditInfo.get(parentExpression);
    if (parentExpressionEditInfo) {
      let expressionEditInfo: Edit.ExpressionEditInfo = {
        optional: false,
        onSetValue: (newValue) => onInsertTerm(newValue!),
        context: parentExpressionEditInfo.context
      };
      this.addElementTermMenuWithEditInfo(semanticLink, undefined, onRenderTerm, expressionEditInfo);
    }
    insertButton.semanticLinks = [semanticLink];
    if (items.length) {
      let lastItemWithButton = [
        items[items.length - 1],
        new Display.TextExpression(' '),
        insertButton
      ];
      items[items.length - 1] = new Display.RowExpression(lastItemWithButton);
    } else {
      items.push(insertButton);
    }
  }
}
