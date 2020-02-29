import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Edit from '../../format/edit';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import * as Dialog from '../../display/dialog';
import { GenericEditHandler, RenderTypeFn, RenderParameterFn, InsertParameterFn, RenderExpressionFn, InsertExpressionFn } from '../generic/editHandler';
import { LibraryDataProvider, LibraryItemInfo } from '../../data/libraryDataProvider';
import { HLMExpressionType } from './hlm';
import { HLMEditAnalysis } from './edit';
import { HLMUtils } from './utils';
import { HLMDefinitionChecker } from './checker';
import { findBestMatch, reorderArguments } from '../generic/displayMatching';
import CachedPromise from '../../data/cachedPromise';

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
  allowConstructors: boolean;
}

export const fullElementTermSelection: ElementTermSelection = {
  allowCases: true,
  allowConstructors: true
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
  protected utils: HLMUtils;
  protected checker: HLMDefinitionChecker;

  constructor(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, templates: Fmt.File) {
    let utils = new HLMUtils(definition, libraryDataProvider);
    super(definition, libraryDataProvider, new HLMEditAnalysis, utils, templates);
    this.utils = utils;
    this.checker = new HLMDefinitionChecker(definition, libraryDataProvider, this.utils, true);
    this.update();
  }

  update(onAutoFilled?: () => void): CachedPromise<void> {
    return super.update().then(() =>
      this.checker.checkDefinition()
        .then((result: Logic.LogicCheckResult): void | CachedPromise<void> => {
          if (onAutoFilled && !result.hasErrors) {
            let autoFilled = false;
            let onFillExpression = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => {
              let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(originalExpression);
              if (expressionEditInfo) {
                for (let parameters of newParameterLists) {
                  let context = expressionEditInfo.context;
                  for (let param of parameters) {
                    param.name = this.utils.getUnusedDefaultName(param.name, context);
                    context = context.metaModel.getNextParameterContext(param, context);
                  }
                }
                expressionEditInfo.onSetValue(filledExpression);
                autoFilled = true;
              }
            };
            return this.checker.autoFill(onFillExpression)
              .then((): void | CachedPromise<void> => {
                if (autoFilled) {
                  onAutoFilled();
                }
              });
          }
        })
        .catch(() => {}));
  }

  isTemporaryExpression(expression: Fmt.Expression): boolean {
    return this.editAnalysis.expressionEditInfo.get(expression) === undefined;
  }

  addTypeMenu(semanticLink: Display.SemanticLink, onRenderType: RenderTypeFn, info: LibraryItemInfo): void {
    semanticLink.onMenuOpened = () => {
      let rows = [this.getTypeRow(undefined, onRenderType, info)];
      let contents = this.definition.contents;
      if (contents instanceof FmtHLM.ObjectContents_StandardTheorem || contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
        rows.push(
          this.getTypeRow('lemma', onRenderType, info),
          this.getTypeRow('theorem', onRenderType, info),
          this.getTypeRow('corollary', onRenderType, info),
          this.getTypeRow('example', onRenderType, info)
        );
      } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
        rows.push(
          this.getTypeRow('conjecture', onRenderType, info),
          this.getTypeRow('axiom', onRenderType, info)
        );
      }
      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve(rows);
      return menu;
    };
    semanticLink.alwaysShowMenu = true;
  }

  addParameterMenu(semanticLink: Display.SemanticLink, parameterList: Fmt.ParameterList, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn, parameterSelection: ParameterSelection): void {
    semanticLink.onMenuOpened = () => {
      let rows: Menu.ExpressionMenuRow[] = [];

      let elementType = new FmtHLM.MetaRefExpression_Element;
      elementType._set = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
      rows.push(this.getParameterPlaceholderItem(elementType, 'x', parameterList, onRenderParam, onInsertParam));

      let subsetType = new FmtHLM.MetaRefExpression_Subset;
      subsetType.superset = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
      rows.push(this.getParameterPlaceholderItem(subsetType, 'S', parameterList, onRenderParam, onInsertParam));

      rows.push(this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Set, 'S', parameterList, onRenderParam, onInsertParam));

      if (parameterSelection.allowConstraint) {
        let constraintType = new FmtHLM.MetaRefExpression_Constraint;
        constraintType.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
        rows.push(this.getParameterPlaceholderItem(constraintType, '_1', parameterList, onRenderParam, onInsertParam));
      }

      if (parameterSelection.allowProposition || parameterSelection.allowDefinition || parameterSelection.allowBinding) {
        let advancedSubMenuRows: Menu.ExpressionMenuRow[] = [];

        if (parameterSelection.allowProposition) {
          advancedSubMenuRows.push(
            this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Prop, 'p', parameterList, onRenderParam, onInsertParam),
            new Menu.ExpressionMenuSeparator
          );
        }

        if (parameterSelection.allowDefinition) {
          let elementDefinitionType = new FmtHLM.MetaRefExpression_Def;
          elementDefinitionType.element = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
          advancedSubMenuRows.push(this.getParameterPlaceholderItem(elementDefinitionType, 'x', parameterList, onRenderParam, onInsertParam));

          let setDefinitionType = new FmtHLM.MetaRefExpression_SetDef;
          setDefinitionType._set = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
          advancedSubMenuRows.push(this.getParameterPlaceholderItem(setDefinitionType, 'S', parameterList, onRenderParam, onInsertParam));

          advancedSubMenuRows.push(new Menu.ExpressionMenuSeparator);
        }

        if (parameterSelection.allowBinding) {
          let bindingType = new FmtHLM.MetaRefExpression_Binding;
          bindingType._set = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
          bindingType.parameters = Object.create(Fmt.ParameterList.prototype);
          advancedSubMenuRows.push(this.getParameterPlaceholderItem(bindingType, 'i', parameterList, onRenderParam, onInsertParam));
        }

        let advancedSubMenu = new Menu.ExpressionMenu;
        advancedSubMenu.rows = CachedPromise.resolve(advancedSubMenuRows);

        let advanced = new Menu.StandardExpressionMenuRow;
        advanced.title = 'Advanced';
        advanced.subMenu = advancedSubMenu;
        advanced.previewSubMenu = false;
        rows.push(
          new Menu.ExpressionMenuSeparator,
          advanced
        );
      }

      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve(rows);
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
      let rows: Menu.ExpressionMenuRow[] = [];

      if (expressionEditInfo.optional) {
        rows.push(this.getRemoveRow(expressionEditInfo));
      }

      {
        let onGetExpressions = (variable: Fmt.Parameter) => {
          let type = variable.type.expression;
          if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_SetDef) {
            return this.getVariableRefExpressions(expressionEditInfo, variable, true);
          }
          return CachedPromise.resolve([]);
        };
        rows.push(this.getVariableRow(expressionEditInfo, onGetExpressions, onRenderTerm));
      }

      if (termSelection.allowEnumeration) {
        rows.push(this.getEnumerationRow(expressionEditInfo, onRenderTerm));
      }

      if (termSelection.allowSubset) {
        rows.push(this.getSubsetRow(expressionEditInfo, onRenderTerm));
      }

      if (termSelection.allowCases) {
        rows.push(this.getSetCasesRow(expressionEditInfo, onRenderTerm));
      }

      {
        let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
          let type = definition.type.expression;
          if (type instanceof FmtHLM.MetaRefExpression_SetOperator || type instanceof FmtHLM.MetaRefExpression_Construction) {
            return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, true);
          } else {
            return undefined;
          }
        };
        rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.SetOperator, Logic.LogicDefinitionType.Construction], onGetExpressions, onRenderTerm));
      }

      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve(rows);
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
      let rows: Menu.ExpressionMenuRow[] = [];

      if (expressionEditInfo.optional) {
        rows.push(this.getRemoveRow(expressionEditInfo));
      }

      {
        let onGetExpressions = (variable: Fmt.Parameter) => {
          let type = variable.type.expression;
          if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def) {
            return this.getVariableRefExpressions(expressionEditInfo, variable, true);
          }
          return CachedPromise.resolve([]);
        };
        rows.push(this.getVariableRow(expressionEditInfo, onGetExpressions, onRenderTerm));
      }

      if (termSelection.allowCases) {
        rows.push(this.getElementCasesRow(expressionEditInfo, onRenderTerm));
      }

      {
        let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
          let type = definition.type.expression;
          if (type instanceof FmtHLM.MetaRefExpression_ExplicitOperator || type instanceof FmtHLM.MetaRefExpression_ImplicitOperator || type instanceof FmtHLM.MetaRefExpression_MacroOperator || (termSelection.allowConstructors && type instanceof FmtHLM.MetaRefExpression_Constructor)) {
            return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, true);
          } else {
            return undefined;
          }
        };
        rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Operator, Logic.LogicDefinitionType.Constructor], onGetExpressions, onRenderTerm));
      }

      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve(rows);
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
      let rows: Menu.ExpressionMenuRow[] = [];

      if (expressionEditInfo.optional) {
        rows.push(this.getRemoveRow(expressionEditInfo));
      }

      let addNegations = (expressions: Fmt.Expression[]) => {
        let negatedExpressions = expressions.map((expression: Fmt.Expression) => {
          let negatedExpression = new FmtHLM.MetaRefExpression_not;
          negatedExpression.formula = expression;
          return negatedExpression;
        });
        return expressions.concat(negatedExpressions);
      };

      {
        let onGetExpressions = (variable: Fmt.Parameter) => {
          let type = variable.type.expression;
          if (type instanceof FmtHLM.MetaRefExpression_Prop) {
            return this.getVariableRefExpressions(expressionEditInfo, variable, false)
              .then(addNegations);
          }
          return CachedPromise.resolve([]);
        };
        rows.push(this.getVariableRow(expressionEditInfo, onGetExpressions, onRenderFormula));
      }

      rows.push(
        this.getConnectiveRow(expressionEditInfo, onRenderFormula, formulaSelection),
        this.getQuantifierRow(expressionEditInfo, onRenderFormula),
        this.getRelationRow(expressionEditInfo, onRenderFormula),
      );

      if (formulaSelection.allowCases) {
        rows.push(this.getFormulaCasesRow(expressionEditInfo, onRenderFormula));
      }

      {
        let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
          let type = definition.type.expression;
          if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
            return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, false)
              .then(addNegations);
          } else {
            return undefined;
          }
        };
        rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Predicate], onGetExpressions, onRenderFormula));
      }

      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve(rows);
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
    subsetExpression.parameter = this.utils.createElementParameter('x', expressionEditInfo.context);
    subsetExpression.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);

    let extendedSubsetExpression = new FmtHLM.MetaRefExpression_extendedSubset;
    extendedSubsetExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    extendedSubsetExpression.term = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);

    let subsetMenu = new Menu.ExpressionMenu;
    subsetMenu.rows = CachedPromise.resolve([
      this.getExpressionItem(subsetExpression, expressionEditInfo, onRenderTerm),
      this.getExpressionItem(extendedSubsetExpression, expressionEditInfo, onRenderTerm)
    ]);
    let subsetRow = new Menu.StandardExpressionMenuRow;
    subsetRow.title = 'Subset';
    subsetRow.subMenu = subsetMenu;
    return subsetRow;
  }

  private getSetCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let structuralExpression = new FmtHLM.MetaRefExpression_setStructuralCases;
    structuralExpression.term = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
    structuralExpression.construction = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    structuralExpression.cases = [];

    let casesMenu = new Menu.ExpressionMenu;
    casesMenu.rows = CachedPromise.resolve([
      // TODO add "induction on <parameter>" / "decompose <parameter>" as a special case
      this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderTerm)
    ]);
    let casesRow = new Menu.StandardExpressionMenuRow;
    casesRow.title = 'Cases';
    casesRow.subMenu = casesMenu;
    return casesRow;
  }

  private getElementCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let structuralExpression = new FmtHLM.MetaRefExpression_structuralCases;
    structuralExpression.term = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
    structuralExpression.construction = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    structuralExpression.cases = [];

    let caseExpression = new FmtHLM.MetaRefExpression_cases;
    let positiveCase = new FmtHLM.ObjectContents_Case;
    positiveCase.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    positiveCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
    let negativeCase = new FmtHLM.ObjectContents_Case;
    negativeCase.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    negativeCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
    caseExpression.cases = [positiveCase, negativeCase];

    let casesMenu = new Menu.ExpressionMenu;
    casesMenu.rows = CachedPromise.resolve([
      // TODO add "induction on <parameter>" / "decompose <parameter>" as a special case
      this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderTerm),
      this.getExpressionItem(caseExpression, expressionEditInfo, onRenderTerm)
    ]);
    let casesRow = new Menu.StandardExpressionMenuRow;
    casesRow.title = 'Cases';
    casesRow.subMenu = casesMenu;
    return casesRow;
  }

  private getConnectiveRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): Menu.ExpressionMenuRow {
    let leftPlaceholder = expressionEditInfo.expression || new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let rightPlaceholder = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let andExpression = new FmtHLM.MetaRefExpression_and;
    andExpression.formulae = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_and && expressionEditInfo.expression.formulae ? [...expressionEditInfo.expression.formulae, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];
    let orExpression = new FmtHLM.MetaRefExpression_or;
    orExpression.formulae = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_or && expressionEditInfo.expression.formulae ? [...expressionEditInfo.expression.formulae, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];

    let mainList = new Menu.ExpressionMenuItemList;
    mainList.items = CachedPromise.resolve([
      this.getExpressionItem(andExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(orExpression, expressionEditInfo, onRenderFormula)
    ]);
    mainList.extraSpace = true;
    let connectiveMenuRows = [mainList];
    if (formulaSelection.allowTruthValue) {
      let trueExpression = new FmtHLM.MetaRefExpression_and;
      let falseExpression = new FmtHLM.MetaRefExpression_or;
      let truthValueList = new Menu.ExpressionMenuItemList;
      truthValueList.items = CachedPromise.resolve([
        this.getExpressionItem(trueExpression, expressionEditInfo, onRenderFormula),
        this.getExpressionItem(falseExpression, expressionEditInfo, onRenderFormula)
      ]);
      truthValueList.extraSpace = true;
      connectiveMenuRows.push(truthValueList);
    }
    if (formulaSelection.allowEquiv) {
      let equivExpression = new FmtHLM.MetaRefExpression_equiv;
      equivExpression.left = leftPlaceholder;
      equivExpression.right = rightPlaceholder;
      let equivList = new Menu.ExpressionMenuItemList;
      equivList.items = CachedPromise.resolve([
        this.getExpressionItem(equivExpression, expressionEditInfo, onRenderFormula)
      ]);
      equivList.extraSpace = true;
      connectiveMenuRows.push(equivList);
    }
    let connectiveMenu = new Menu.ExpressionMenu;
    connectiveMenu.rows = CachedPromise.resolve(connectiveMenuRows);
    let connectiveRow = new Menu.StandardExpressionMenuRow;
    connectiveRow.title = 'Connective';
    connectiveRow.subMenu = connectiveMenu;
    return connectiveRow;
  }

  private getQuantifierRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let forallExpression = new FmtHLM.MetaRefExpression_forall;
    forallExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    forallExpression.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let existsExpression = new FmtHLM.MetaRefExpression_exists;
    existsExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    existsExpression.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let existsUniqueExpression = new FmtHLM.MetaRefExpression_existsUnique;
    existsUniqueExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    existsUniqueExpression.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let negatedExistsExpression = new FmtHLM.MetaRefExpression_not;
    negatedExistsExpression.formula = existsExpression;

    let mainList = new Menu.ExpressionMenuItemList;
    mainList.items = CachedPromise.resolve([
      this.getExpressionItem(forallExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(existsExpression, expressionEditInfo, onRenderFormula)
    ]);
    mainList.extraSpace = true;
    let secondaryList = new Menu.ExpressionMenuItemList;
    secondaryList.items = CachedPromise.resolve([
      this.getExpressionItem(existsUniqueExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedExistsExpression, expressionEditInfo, onRenderFormula)
    ]);
    secondaryList.extraSpace = true;
    let quantifierMenu = new Menu.ExpressionMenu;
    quantifierMenu.rows = CachedPromise.resolve([
      mainList,
      secondaryList
    ]);
    let quantifierRow = new Menu.StandardExpressionMenuRow;
    quantifierRow.title = 'Quantifier';
    quantifierRow.subMenu = quantifierMenu;
    return quantifierRow;
  }

  private getRelationRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let equalsExpression = new FmtHLM.MetaRefExpression_equals;
    equalsExpression.terms = [new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm), new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm)];
    let inExpression = new FmtHLM.MetaRefExpression_in;
    inExpression.element = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
    inExpression._set = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    let subExpression = new FmtHLM.MetaRefExpression_sub;
    subExpression.subset = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    subExpression.superset = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    let setEqualsExpression = new FmtHLM.MetaRefExpression_setEquals;
    setEqualsExpression.terms = [new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm), new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm)];
    let negatedEqualsExpression = new FmtHLM.MetaRefExpression_not;
    negatedEqualsExpression.formula = equalsExpression;
    let negatedInExpression = new FmtHLM.MetaRefExpression_not;
    negatedInExpression.formula = inExpression;
    let negatedSubExpression = new FmtHLM.MetaRefExpression_not;
    negatedSubExpression.formula = subExpression;
    let negatedSetEqualsExpression = new FmtHLM.MetaRefExpression_not;
    negatedSetEqualsExpression.formula = setEqualsExpression;

    let mainList = new Menu.ExpressionMenuItemList;
    mainList.items = CachedPromise.resolve([
      this.getExpressionItem(equalsExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(inExpression, expressionEditInfo, onRenderFormula)
    ]);
    mainList.extraSpace = true;
    let secondaryList = new Menu.ExpressionMenuItemList;
    secondaryList.items = CachedPromise.resolve([
      this.getExpressionItem(subExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(setEqualsExpression, expressionEditInfo, onRenderFormula)
    ]);
    secondaryList.extraSpace = true;
    let negatedMainList = new Menu.ExpressionMenuItemList;
    negatedMainList.items = CachedPromise.resolve([
      this.getExpressionItem(negatedEqualsExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedInExpression, expressionEditInfo, onRenderFormula)
    ]);
    negatedMainList.extraSpace = true;
    let negatedSecondaryList = new Menu.ExpressionMenuItemList;
    negatedSecondaryList.items = CachedPromise.resolve([
      this.getExpressionItem(negatedSubExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedSetEqualsExpression, expressionEditInfo, onRenderFormula)
    ]);
    negatedSecondaryList.extraSpace = true;
    let relationMenu = new Menu.ExpressionMenu;
    relationMenu.rows = CachedPromise.resolve([
      mainList,
      secondaryList,
      negatedMainList,
      negatedSecondaryList
    ]);
    let relationRow = new Menu.StandardExpressionMenuRow;
    relationRow.title = 'Relation';
    relationRow.subMenu = relationMenu;
    return relationRow;
  }

  private getFormulaCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let structuralExpression = new FmtHLM.MetaRefExpression_structural;
    structuralExpression.term = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
    structuralExpression.construction = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    structuralExpression.cases = [];

    let casesMenu = new Menu.ExpressionMenu;
    casesMenu.rows = CachedPromise.resolve([
      // TODO add "induction on <parameter>" / "decompose <parameter>" as a special case
      this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderFormula)
    ]);
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

  private getVariableRefExpressions(expressionEditInfo: Edit.ExpressionEditInfo, variable: Fmt.Parameter, checkType: boolean): CachedPromise<Fmt.Expression[]> {
    let expression = new Fmt.VariableRefExpression;
    expression.variable = variable;
    for (let bindingParameter = this.utils.getParentBinding(variable); bindingParameter; bindingParameter = this.utils.getParentBinding(bindingParameter)) {
      let placeholder = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
      if (expression.indices) {
        expression.indices.unshift(placeholder);
      } else {
        expression.indices = [placeholder];
      }
    }
    if (checkType && expressionEditInfo.expression) {
      return this.checker.recheckWithSubstitution(expressionEditInfo.expression, expression)
        .then((checkResult: Logic.LogicCheckResultWithExpression) => {
          if (checkResult.hasErrors) {
            return [];
          } else {
            return [checkResult.expression];
          }
        })
        .catch(() => []);
    } else {
      return CachedPromise.resolve([expression]);
    }
  }

  protected getSelectedDefinition(expressionEditInfo: Edit.ExpressionEditInfo): Fmt.DefinitionRefExpression | undefined {
    let expression = expressionEditInfo.expression;
    while (expression instanceof FmtHLM.MetaRefExpression_not) {
      expression = expression.formula;
    }
    if (expression instanceof Fmt.DefinitionRefExpression) {
      return expression;
    }
    return undefined;
  }

  private getDefinitionRefExpressions(expressionEditInfo: Edit.ExpressionEditInfo, path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, checkType: boolean): CachedPromise<Fmt.Expression[]> {
    let resultPaths = this.createPathsWithArguments(expressionEditInfo, path, outerDefinition, definition);
    let result: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (let resultPath of resultPaths) {
      let expression = new Fmt.DefinitionRefExpression;
      expression.path = resultPath;
      result = result.then((currentResult: Fmt.Expression[]) => {
        if (checkType && expressionEditInfo.expression) {
          return this.checker.recheckWithSubstitution(expressionEditInfo.expression, expression)
            .then((checkResult: Logic.LogicCheckResultWithExpression) => {
              if (checkResult.hasErrors) {
                return currentResult;
              } else {
                return currentResult.concat(checkResult.expression);
              }
            })
            .catch(() => currentResult);
        } else {
          return currentResult.concat(expression);
        }
      });
    }
    return result;
  }

  private createPathsWithArguments(expressionEditInfo: Edit.ExpressionEditInfo, path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition): Fmt.Path[] {
    let displayItems: Fmt.Expression[] | undefined = undefined;
    let displayExpressions: (Fmt.Expression | undefined)[] = [undefined];
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
      let display = definition.contents.display;
      if (display && display.length > 1) {
        displayItems = display;
        displayExpressions = display;
      }
    }
    let result: Fmt.Path[] = [];
    for (let displayExpression of displayExpressions) {
      let parentPaths: (Fmt.PathItem | undefined)[] = [];
      if (path.parentPath instanceof Fmt.Path) {
        parentPaths = this.createPathsWithArguments(expressionEditInfo, path.parentPath, outerDefinition, outerDefinition);
      } else {
        parentPaths = [path.parentPath];
      }
      for (let parentPath of parentPaths) {
        let resultPath = new Fmt.Path;
        resultPath.name = path.name;
        let createPlaceholder = (placeholderType: HLMExpressionType) => new Fmt.PlaceholderExpression(placeholderType);
        let createElementParameter = (defaultName: string) => this.utils.createElementParameter(defaultName, expressionEditInfo.context);
        this.utils.fillPlaceholderArguments(definition.parameters, resultPath.arguments, createPlaceholder, createElementParameter);
        resultPath.parentPath = parentPath;
        if (displayExpression) {
          reorderArguments(resultPath.arguments, displayExpression);
          if (displayItems && result.length) {
            // Ignore items that cannot be distinguished by argument order.
            let argumentLists: Fmt.ArgumentList[] = [resultPath.arguments];
            if (parentPath instanceof Fmt.Path) {
              argumentLists.unshift(parentPath.arguments);
            }
            if (findBestMatch(displayItems, argumentLists) !== displayExpression) {
              continue;
            }
          }
        }
        result.push(resultPath);
      }
    }
    return result;
  }

  getConstructorInsertButton(definitions: Fmt.DefinitionList): Display.RenderedExpression {
    let action = new Menu.DialogExpressionMenuAction;
    action.onOpen = () => {
      let dialog = new Dialog.InsertDialog;
      let definitionType: Logic.LogicDefinitionTypeDescription = {
        definitionType: Logic.LogicDefinitionType.Constructor,
        name: 'Constructor',
        createTypeExpression: () => new FmtHLM.MetaRefExpression_Constructor,
        createObjectContents: () => new FmtHLM.ObjectContents_Constructor
      };
      dialog.definitionType = definitionType;
      dialog.onCheckNameInUse = (name: string) => definitions.some((definition: Fmt.Definition) => (definition.name === name));
      dialog.onOK = (result: Dialog.DialogResultBase) => {
        let insertResult = result as Dialog.InsertDialogResult;
        definitions.push(Logic.createDefinition(definitionType, insertResult.name));
      };
      return dialog;
    };
    return this.getActionInsertButton(action);
  }

  getEmbeddingInsertButton(definitionContents: FmtHLM.ObjectContents_Construction, onRenderEmbedding: RenderExpressionFn): Display.RenderedExpression {
    let insertButton = new Display.InsertPlaceholderExpression;
    let semanticLink = new Display.SemanticLink(insertButton, false, false);
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve([this.getEmbeddingRow(definitionContents, onRenderEmbedding)]);
      return menu;
    };
    insertButton.semanticLinks = [semanticLink];
    return insertButton;
  }

  private getEmbeddingRow(definitionContents: FmtHLM.ObjectContents_Construction, onRenderEmbedding: RenderExpressionFn): Menu.ExpressionMenuRow {
    let context = this.editAnalysis.definitionContentsContext.get(this.definition);
    let parameter = this.utils.createElementParameter('x', context);
    let parameterType = parameter.type.expression as FmtHLM.MetaRefExpression_Element;
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => {
      let embedding = new FmtHLM.ObjectContents_Embedding;
      embedding.parameter = parameter;
      embedding.target = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
      definitionContents.embedding = embedding;
      GenericEditHandler.lastInsertedParameter = embedding.parameter;
    };
    let item = new Menu.ExpressionMenuItem;
    item.expression = onRenderEmbedding(parameterType._set);
    item.action = action;
    let row = new Menu.StandardExpressionMenuRow;
    row.title = 'Embedding';
    row.subMenu = item;
    return row;
  }

  getElementTermInsertButton(parentExpression: Fmt.Expression, onInsertTerm: InsertExpressionFn, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): Display.RenderedExpression {
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
    return insertButton;
  }

  addElementTermInsertButton(items: Display.RenderedExpression[], parentExpression: Fmt.Expression, onInsertTerm: InsertExpressionFn, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let insertButton = this.getElementTermInsertButton(parentExpression, onInsertTerm, onRenderTerm, termSelection);
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

  addEnumerationInsertButton(items: Display.RenderedExpression[], term: FmtHLM.MetaRefExpression_enumeration, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let onInsertTerm = (expression: Fmt.Expression) => {
      if (term.terms) {
        term.terms.push(expression);
      } else {
        term.terms = [expression];
      }
    };
    this.addElementTermInsertButton(items, term, onInsertTerm, onRenderTerm, termSelection);
  }

  addImplicitDefinitionMenu(semanticLink: Display.SemanticLink, onRenderExplicitIntro: Logic.RenderFn, onRenderImplicitIntro: RenderParameterFn): void {
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve([
        this.getExplicitDefinitionRow(onRenderExplicitIntro),
        this.getImplicitDefinitionRow(onRenderImplicitIntro)
      ]);
      return menu;
    };
    semanticLink.alwaysShowMenu = true;
  }

  private getExplicitDefinitionRow(onRenderExplicitIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => {
      let originalContents = this.definition.contents as FmtHLM.ObjectContents_Definition;
      this.definition.type.expression = new FmtHLM.MetaRefExpression_ExplicitOperator;
      let explicitOperatorContents = new FmtHLM.ObjectContents_ExplicitOperator;
      explicitOperatorContents.definition = [new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm)];
      explicitOperatorContents.properties = originalContents.properties;
      explicitOperatorContents.display = originalContents.display;
      explicitOperatorContents.definitionDisplay = originalContents.definitionDisplay;
      this.definition.contents = explicitOperatorContents;
    };
    let item = new Menu.ExpressionMenuItem;
    item.expression = onRenderExplicitIntro();
    item.action = action;
    let row = new Menu.StandardExpressionMenuRow;
    row.title = 'Explicit';
    row.subMenu = item;
    row.selected = this.definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator;
    item.selected = row.selected;
    return row;
  }

  private getImplicitDefinitionRow(onRenderImplicitIntro: RenderParameterFn): Menu.ExpressionMenuRow {
    let context = this.editAnalysis.definitionContentsContext.get(this.definition);
    let parameter = this.utils.createElementParameter('x', context);
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => {
      let originalContents = this.definition.contents as FmtHLM.ObjectContents_Definition;
      this.definition.type.expression = new FmtHLM.MetaRefExpression_ImplicitOperator;
      let implicitOperatorContents = new FmtHLM.ObjectContents_ImplicitOperator;
      implicitOperatorContents.parameter = parameter;
      implicitOperatorContents.definition = [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)];
      implicitOperatorContents.properties = originalContents.properties;
      implicitOperatorContents.display = originalContents.display;
      implicitOperatorContents.definitionDisplay = originalContents.definitionDisplay;
      this.definition.contents = implicitOperatorContents;
      GenericEditHandler.lastInsertedParameter = parameter;
    };
    let item = new Menu.ExpressionMenuItem;
    item.expression = onRenderImplicitIntro(parameter);
    item.action = action;
    let row = new Menu.StandardExpressionMenuRow;
    row.title = 'Implicit';
    row.subMenu = item;
    row.selected = this.definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator;
    item.selected = row.selected;
    return row;
  }

  addTheoremTypeMenu(semanticLink: Display.SemanticLink, onRenderStandardIntro: Logic.RenderFn, onRenderEquivalenceIntro: Logic.RenderFn): void {
    semanticLink.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = CachedPromise.resolve([
        this.getStandardTheoremRow(onRenderStandardIntro),
        this.getEquivalenceTheoremRow(onRenderEquivalenceIntro)
      ]);
      return menu;
    };
    semanticLink.alwaysShowMenu = true;
  }

  private getStandardTheoremRow(onRenderStandardIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => {
      this.definition.type.expression = new FmtHLM.MetaRefExpression_StandardTheorem;
      let standardTheoremContents = new FmtHLM.ObjectContents_StandardTheorem;
      standardTheoremContents.claim = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
      this.definition.contents = standardTheoremContents;
    };
    let item = new Menu.ExpressionMenuItem;
    item.expression = onRenderStandardIntro();
    item.action = action;
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem;
    return item;
  }

  private getEquivalenceTheoremRow(onRenderEquivalenceIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let action = new Menu.ImmediateExpressionMenuAction;
    action.onExecute = () => {
      this.definition.type.expression = new FmtHLM.MetaRefExpression_EquivalenceTheorem;
      let equivalenceTheoremContents = new FmtHLM.ObjectContents_EquivalenceTheorem;
      equivalenceTheoremContents.conditions = [new Fmt.PlaceholderExpression(HLMExpressionType.Formula), new Fmt.PlaceholderExpression(HLMExpressionType.Formula)];
      this.definition.contents = equivalenceTheoremContents;
    };
    let item = new Menu.ExpressionMenuItem;
    item.expression = onRenderEquivalenceIntro();
    item.action = action;
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem;
    return item;
  }

  createEqualityDefinition(parameters: Fmt.ParameterList): FmtHLM.ObjectContents_EqualityDefinition {
    let result = new FmtHLM.ObjectContents_EqualityDefinition;
    let leftParameters = new Fmt.ParameterList;
    parameters.clone(leftParameters);
    result.leftParameters = leftParameters;
    let rightParameters = new Fmt.ParameterList;
    parameters.clone(rightParameters);
    this.addApostrophes(rightParameters);
    result.rightParameters = rightParameters;
    result.definition = [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)];
    return result;
  }

  private addApostrophes(parameters: Fmt.ParameterList): void {
    for (let param of parameters) {
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        this.addApostrophes(type.parameters);
      } else {
        param.name += '\'';
      }
    }
  }

  getCaseInsertButton(term: FmtHLM.MetaRefExpression_cases): Display.RenderedExpression {
    let onInsert = () => {
      let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
      if (expressionEditInfo) {
        let newCase = new FmtHLM.ObjectContents_Case;
        newCase.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
        newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
        let newTerm = term.clone() as FmtHLM.MetaRefExpression_cases;
        newTerm.cases.push(newCase);
        expressionEditInfo.onSetValue(newTerm);
      }
    };
    return this.getImmediateInsertButton(onInsert);
  }
}
