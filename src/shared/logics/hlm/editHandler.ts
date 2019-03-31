import * as Fmt from '../../format/format';
import * as Edit from '../../format/edit';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
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

export interface SetTermSelection {
  allowEnumeration: boolean;
  allowSubset: boolean;
  allowCases: boolean;
}

export const fullSetTermSelection: SetTermSelection = {
  allowEnumeration: true,
  allowSubset: true,
  allowCases: true
};

export interface ElementTermSelection {
  allowCases: boolean;
}

export const fullElementTermSelection: ElementTermSelection = {
  allowCases: true
};

export interface FormulaSelection {
  allowTruthValue: boolean;
  allowEquiv: boolean;
  allowCases: boolean;
}

export const fullFormulaSelection: FormulaSelection = {
  allowTruthValue: true,
  allowEquiv: true,
  allowCases: true
};

export class HLMEditHandler extends GenericEditHandler {
  addParameterMenu(semanticLink: Display.SemanticLink, parameterList: Fmt.ParameterList, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn, parameterSelection: ParameterSelection): void {
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      let elementType = new FmtHLM.MetaRefExpression_Element;
      elementType._set = new PlaceholderExpression(HLMTermType.SetTerm);
      menu.rows.push(this.getParameterPlaceholderItem(elementType, 'x', parameterList, onRenderParam, onInsertParam));

      let subsetType = new FmtHLM.MetaRefExpression_Subset;
      subsetType.superset = new PlaceholderExpression(HLMTermType.SetTerm);
      menu.rows.push(this.getParameterPlaceholderItem(subsetType, 'S', parameterList, onRenderParam, onInsertParam));

      menu.rows.push(this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Set, 'S', parameterList, onRenderParam, onInsertParam));

      if (parameterSelection.allowConstraint) {
        let constraintType = new FmtHLM.MetaRefExpression_Constraint;
        constraintType.formula = new PlaceholderExpression(HLMTermType.Formula);
        menu.rows.push(this.getParameterPlaceholderItem(constraintType, '_1', parameterList, onRenderParam, onInsertParam));
      }

      if (parameterSelection.allowProposition || parameterSelection.allowDefinition || parameterSelection.allowBinding) {
        let advancedSubMenu = new Menu.ExpressionMenu;
        advancedSubMenu.rows = [];

        if (parameterSelection.allowProposition) {
          advancedSubMenu.rows.push(
            this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Prop, 'p', parameterList, onRenderParam, onInsertParam),
            new Menu.ExpressionMenuSeparator
          );
        }

        if (parameterSelection.allowDefinition) {
          let elementDefinitionType = new FmtHLM.MetaRefExpression_Def;
          elementDefinitionType.element = new PlaceholderExpression(HLMTermType.ElementTerm);
          advancedSubMenu.rows.push(this.getParameterPlaceholderItem(elementDefinitionType, 'x', parameterList, onRenderParam, onInsertParam));

          let setDefinitionType = new FmtHLM.MetaRefExpression_SetDef;
          setDefinitionType._set = new PlaceholderExpression(HLMTermType.SetTerm);
          advancedSubMenu.rows.push(this.getParameterPlaceholderItem(setDefinitionType, 'S', parameterList, onRenderParam, onInsertParam));

          advancedSubMenu.rows.push(new Menu.ExpressionMenuSeparator);
        }

        if (parameterSelection.allowBinding) {
          let bindingType = new FmtHLM.MetaRefExpression_Binding;
          bindingType._set = new PlaceholderExpression(HLMTermType.SetTerm);
          bindingType.parameters = Object.create(Fmt.ParameterList.prototype);
          advancedSubMenu.rows.push(this.getParameterPlaceholderItem(bindingType, 'i', parameterList, onRenderParam, onInsertParam));
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

  protected addParameterToGroup(param: Fmt.Parameter, parameterList?: Fmt.ParameterList): Fmt.Parameter | undefined {
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

  addSetTermMenu(semanticLink: Display.SemanticLink, term: Fmt.Expression, onRenderTerm: RenderExpressionFn, termSelection: SetTermSelection): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
    if (expressionEditInfo) {
      this.addSetTermMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderTerm, termSelection);
    }
  }

  private addSetTermMenuWithEditInfo(semanticLink: Display.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, termSelection: SetTermSelection): void {
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      if (expressionEditInfo.optional) {
        menu.rows.push(this.getRemoveRow(expressionEditInfo));
      }

      let isVariableAllowed = (variable: Fmt.Parameter) => {
        let type = variable.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_SetDef;
      };
      let variableRow = this.getVariableRow(expressionEditInfo, isVariableAllowed, onRenderTerm);
      if (variableRow) {
        menu.rows.push(variableRow);
      }

      if (termSelection.allowEnumeration) {
        menu.rows.push(this.getEnumerationRow(expressionEditInfo, onRenderTerm));
      }

      if (termSelection.allowSubset) {
        menu.rows.push(this.getSubsetRow(expressionEditInfo, onRenderTerm));
      }

      if (termSelection.allowCases) {
        menu.rows.push(this.getSetCasesRow(expressionEditInfo, onRenderTerm));
      }

      let isDefinitionAllowed = (definition: Fmt.Definition) => {
        let type = definition.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_SetOperator || type instanceof FmtHLM.MetaRefExpression_Construction;
      };
      menu.rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.SetOperator, Logic.LogicDefinitionType.Construction], isDefinitionAllowed, onRenderTerm));

      return menu;
    };
  }

  addElementTermMenu(semanticLink: Display.SemanticLink, term: Fmt.Expression, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
    if (expressionEditInfo) {
      this.addElementTermMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderTerm, termSelection);
    }
  }

  private addElementTermMenuWithEditInfo(semanticLink: Display.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      if (expressionEditInfo.optional) {
        menu.rows.push(this.getRemoveRow(expressionEditInfo));
      }

      let isVariableAllowed = (variable: Fmt.Parameter) => {
        let type = variable.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def;
      };
      let variableRow = this.getVariableRow(expressionEditInfo, isVariableAllowed, onRenderTerm);
      if (variableRow) {
        menu.rows.push(variableRow);
      }

      if (termSelection.allowCases) {
        menu.rows.push(this.getElementCasesRow(expressionEditInfo, onRenderTerm));
      }

      let isDefinitionAllowed = (definition: Fmt.Definition) => {
        let type = definition.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_ExplicitOperator || type instanceof FmtHLM.MetaRefExpression_ImplicitOperator || type instanceof FmtHLM.MetaRefExpression_Constructor;
      };
      menu.rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Operator, Logic.LogicDefinitionType.Constructor], isDefinitionAllowed, onRenderTerm));

      return menu;
    };
  }

  addFormulaMenu(semanticLink: Display.SemanticLink, formula: Fmt.Expression, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(formula);
    if (expressionEditInfo) {
      this.addFormulaMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderFormula, formulaSelection);
    }
  }

  private addFormulaMenuWithEditInfo(semanticLink: Display.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): void {
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];

      if (expressionEditInfo.optional) {
        menu.rows.push(this.getRemoveRow(expressionEditInfo));
      }

      let isVariableAllowed = (variable: Fmt.Parameter) => {
        let type = variable.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_Prop;
      };
      let variableRow = this.getVariableRow(expressionEditInfo, isVariableAllowed, onRenderFormula);
      if (variableRow) {
        menu.rows.push(variableRow);
      }

      menu.rows.push(
        this.getConnectiveRow(expressionEditInfo, onRenderFormula, formulaSelection),
        this.getQuantifierRow(expressionEditInfo, onRenderFormula),
        this.getRelationRow(expressionEditInfo, onRenderFormula),
      );

      if (formulaSelection.allowCases) {
        menu.rows.push(this.getFormulaCasesRow(expressionEditInfo, onRenderFormula));
      }

      let isDefinitionAllowed = (definition: Fmt.Definition) => {
        let type = definition.type.expression;
        return type instanceof FmtHLM.MetaRefExpression_Predicate;
      };
      menu.rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Predicate], isDefinitionAllowed, onRenderFormula));

      return menu;
    };
  }

  private getRemoveRow(expressionEditInfo: Edit.ExpressionEditInfo): Menu.ExpressionMenuRow {
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => expressionEditInfo.onSetValue(undefined);
    let removeRow = new Menu.StandardExpressionMenuRow;
    removeRow.title = 'Remove';
    removeRow.titleAction = action;
    removeRow.iconType = 'remove';
    return removeRow;
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

  private getConnectiveRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): Menu.ExpressionMenuRow {
    let leftPlaceholder = expressionEditInfo.expression || new PlaceholderExpression(HLMTermType.Formula);
    let rightPlaceholder = new PlaceholderExpression(HLMTermType.Formula);
    let andExpression = new FmtHLM.MetaRefExpression_and;
    andExpression.formulae = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_and && expressionEditInfo.expression.formulae ? [...expressionEditInfo.expression.formulae, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];
    let orExpression = new FmtHLM.MetaRefExpression_or;
    orExpression.formulae = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_or && expressionEditInfo.expression.formulae ? [...expressionEditInfo.expression.formulae, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];

    let mainList = new Menu.ExpressionMenuItemList;
    mainList.items = [
      this.getExpressionItem(andExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(orExpression, expressionEditInfo, onRenderFormula)
    ];
    mainList.extraSpace = true;
    let connectiveMenu = new Menu.ExpressionMenu;
    connectiveMenu.rows = [mainList];
    if (formulaSelection.allowTruthValue) {
      let trueExpression = new FmtHLM.MetaRefExpression_and;
      let falseExpression = new FmtHLM.MetaRefExpression_or;
      let truthValueList = new Menu.ExpressionMenuItemList;
      truthValueList.items = [
        this.getExpressionItem(trueExpression, expressionEditInfo, onRenderFormula),
        this.getExpressionItem(falseExpression, expressionEditInfo, onRenderFormula)
      ];
      truthValueList.extraSpace = true;
      connectiveMenu.rows.push(truthValueList);
    }
    if (formulaSelection.allowEquiv) {
      let equivExpression = new FmtHLM.MetaRefExpression_equiv;
      equivExpression.left = leftPlaceholder;
      equivExpression.right = rightPlaceholder;
      let equivList = new Menu.ExpressionMenuItemList;
      equivList.items = [
        this.getExpressionItem(equivExpression, expressionEditInfo, onRenderFormula)
      ];
      equivList.extraSpace = true;
      connectiveMenu.rows.push(equivList);
    }
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

  protected getExpressionItem(expression: Fmt.Expression, expressionEditInfo: Edit.ExpressionEditInfo, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuItem {
    let item = super.getExpressionItem(expression, expressionEditInfo, onRenderExpression);

    if (item.selected) {
      let origExpression = expressionEditInfo.expression;
      if (origExpression) {
        let newExpression = expression;
        while (origExpression instanceof FmtHLM.MetaRefExpression_not && newExpression instanceof FmtHLM.MetaRefExpression_not) {
          origExpression = origExpression.formula;
          newExpression = newExpression.formula;
        }
        if (Object.getPrototypeOf(newExpression) !== Object.getPrototypeOf(origExpression)) {
          item.selected = false;
        } else if ((newExpression instanceof FmtHLM.MetaRefExpression_and && origExpression instanceof FmtHLM.MetaRefExpression_and)
                   || (newExpression instanceof FmtHLM.MetaRefExpression_or && origExpression instanceof FmtHLM.MetaRefExpression_or)) {
          let origEmpty = !origExpression.formulae || !origExpression.formulae.length;
          let newEmpty = !newExpression.formulae || !newExpression.formulae.length;
          item.selected = (newEmpty === origEmpty);
        }
      }
    }

    return item;
  }

  addElementTermInsertButton(items: Display.RenderedExpression[], parentExpression: Fmt.Expression, onInsertTerm: InsertExpressionFn, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let insertButton = new Display.InsertPlaceholderExpression;
    let semanticLink = new Display.SemanticLink(insertButton, false, false);
    let parentExpressionEditInfo = this.editAnalysis.expressionEditInfo.get(parentExpression);
    if (parentExpressionEditInfo) {
      let expressionEditInfo: Edit.ExpressionEditInfo = {
        optional: false,
        onSetValue: (newValue) => onInsertTerm(newValue!),
        context: parentExpressionEditInfo.context
      };
      this.addElementTermMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderTerm, termSelection);
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
