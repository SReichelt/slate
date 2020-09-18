import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Edit from '../../format/edit';
import * as FmtUtils from '../../format/utils';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as HLMMacro from './macro';
import * as Notation from '../../notation/notation';
import * as Menu from '../../notation/menu';
import * as Dialog from '../../notation/dialog';
import { GenericEditHandler, RenderTypeFn, RenderParameterFn, InsertParameterFn, RenderExpressionFn, InsertExpressionFn, RenderExpressionsFn, GetExpressionsFn } from '../generic/editHandler';
import { LibraryDataProvider, LibraryItemInfo } from '../../data/libraryDataProvider';
import { MRUList } from '../../data/mostRecentlyUsedList';
import { HLMExpressionType } from './hlm';
import { HLMEditAnalysis } from './edit';
import { HLMUtils } from './utils';
import { HLMRenderUtils } from './renderUtils';
import { HLMDefinitionChecker } from './checker';
import CachedPromise from '../../data/cachedPromise';

export type InsertProofFn = (proof: FmtHLM.ObjectContents_Proof) => void;

export interface ParameterSelection {
  allowSets: boolean;
  allowConstraint: boolean;
  allowProposition: boolean;
  allowDefinition: boolean;
  allowBinder: boolean;
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

function addNegations(expressions: Fmt.Expression[]): Fmt.Expression[] {
  let negatedExpressions = expressions.map((expression: Fmt.Expression) =>
    new FmtHLM.MetaRefExpression_not(expression));
  return expressions.concat(negatedExpressions);
};

export class HLMEditHandler extends GenericEditHandler {
  protected checker: HLMDefinitionChecker;

  constructor(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, protected utils: HLMUtils, protected renderUtils: HLMRenderUtils, templates: Fmt.File, mruList: MRUList) {
    super(definition, libraryDataProvider, new HLMEditAnalysis, utils, templates, mruList);
    let options: Logic.LogicCheckerOptions = {
      supportPlaceholders: true,
      supportRechecking: true,
      warnAboutMissingProofs: false
    };
    this.checker = new HLMDefinitionChecker(definition, libraryDataProvider, utils, options);
    this.update();
  }

  update(onAutoFilled?: () => void): CachedPromise<void> {
    return super.update().then(() => {
      let autoFilled = false;
      if (onAutoFilled) {
        for (let innerDefinition of this.definition.innerDefinitions) {
          let contents = innerDefinition.contents;
          if (contents instanceof FmtHLM.ObjectContents_Constructor) {
            if (innerDefinition.parameters.length) {
              if (!contents.equalityDefinition
                  || !contents.equalityDefinition.leftParameters.isEquivalentTo(innerDefinition.parameters)
                  || !contents.equalityDefinition.rightParameters.isEquivalentTo(innerDefinition.parameters)) {
                contents.equalityDefinition = this.createEqualityDefinition(innerDefinition.parameters);
                autoFilled = true;
              }
            } else {
              if (contents.equalityDefinition) {
                contents.equalityDefinition = undefined;
                autoFilled = true;
              }
            }
          }
        }
      }
      return this.checker.checkDefinition()
        .then((result: Logic.LogicCheckResult): void | CachedPromise<void> => {
          if (onAutoFilled && !result.hasErrors) {
            let onFillExpression = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => {
              let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(originalExpression);
              if (expressionEditInfo) {
                this.adaptNewParameterLists(newParameterLists);
                expressionEditInfo.onSetValue(filledExpression);
                autoFilled = true;
              }
            };
            return this.checker.autoFill(onFillExpression).then(() => {
              if (autoFilled) {
                onAutoFilled();
              }
            });
          }
        })
        .catch(() => {});
    });
  }

  private adaptNewParameterLists(newParameterLists: Fmt.ParameterList[]): void {
    let usedNames = this.getUsedParameterNames();
    for (let parameterList of newParameterLists) {
      this.utils.adaptParameterNames(parameterList, usedNames);
    }
  }

  addTypeMenu(semanticLink: Notation.SemanticLink, onRenderType: RenderTypeFn, info: LibraryItemInfo): void {
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
      let menu = new Menu.ExpressionMenu(CachedPromise.resolve(rows));
      return menu;
    };
    semanticLink.alwaysShowMenu = true;
  }

  addParameterMenu(semanticLink: Notation.SemanticLink, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn, parameterSelection: ParameterSelection, inForEach: boolean): void {
    semanticLink.onMenuOpened = () => {
      let rows: Menu.ExpressionMenuRow[] = [];

      let elementType = new FmtHLM.MetaRefExpression_Element(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
      rows.push(this.getParameterPlaceholderItem(elementType, inForEach ? 'i' : 'x', onRenderParam, onInsertParam));

      if (parameterSelection.allowSets) {
        let subsetType = new FmtHLM.MetaRefExpression_Subset(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
        rows.push(this.getParameterPlaceholderItem(subsetType, 'S', onRenderParam, onInsertParam));

        rows.push(this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Set, 'S', onRenderParam, onInsertParam));
      }

      if (parameterSelection.allowConstraint) {
        let constraintType = new FmtHLM.MetaRefExpression_Constraint(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
        rows.push(this.getParameterPlaceholderItem(constraintType, '_1', onRenderParam, onInsertParam));
      }

      if (parameterSelection.allowProposition || parameterSelection.allowDefinition || parameterSelection.allowBinder) {
        let advancedSubMenuRows: Menu.ExpressionMenuRow[] = [];

        if (parameterSelection.allowProposition) {
          advancedSubMenuRows.push(
            this.getParameterPlaceholderItem(new FmtHLM.MetaRefExpression_Prop, 'p', onRenderParam, onInsertParam),
            new Menu.ExpressionMenuSeparator
          );
        }

        if (parameterSelection.allowDefinition) {
          let elementDefinitionType = new FmtHLM.MetaRefExpression_Def(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
          advancedSubMenuRows.push(this.getParameterPlaceholderItem(elementDefinitionType, 'x', onRenderParam, onInsertParam));

          let setDefinitionType = new FmtHLM.MetaRefExpression_SetDef(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
          advancedSubMenuRows.push(this.getParameterPlaceholderItem(setDefinitionType, 'S', onRenderParam, onInsertParam));

          advancedSubMenuRows.push(new Menu.ExpressionMenuSeparator);
        }

        if (parameterSelection.allowBinder) {
          let binderType = new FmtHLM.MetaRefExpression_Binder(new Fmt.ParameterList, new Fmt.ParameterList);
          advancedSubMenuRows.push(this.getParameterPlaceholderItem(binderType, '_1', onRenderParam, onInsertParam));
        }

        let advanced = new Menu.StandardExpressionMenuRow('Advanced');
        advanced.subMenu = new Menu.ExpressionMenu(CachedPromise.resolve(advancedSubMenuRows));
        advanced.previewSubMenu = false;
        rows.push(
          new Menu.ExpressionMenuSeparator,
          advanced
        );
      }

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  getParameterInsertButton(onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn, parameterSelection: ParameterSelection, inForEach: boolean): Notation.RenderedExpression {
    return this.getSemanticLinkInsertButton((semanticLink: Notation.SemanticLink) =>
      this.addParameterMenu(semanticLink, onRenderParam, onInsertParam, parameterSelection, inForEach));
  }

  addSetTermMenu(semanticLink: Notation.SemanticLink, term: Fmt.Expression, onRenderTerm: RenderExpressionFn, termSelection: SetTermSelection): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
    if (expressionEditInfo) {
      this.addSetTermMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderTerm, termSelection);
    }
  }

  private addSetTermMenuWithEditInfo(semanticLink: Notation.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, termSelection: SetTermSelection): void {
    semanticLink.onMenuOpened = () => {
      let rows: Menu.ExpressionMenuRow[] = [];

      if (expressionEditInfo.optional) {
        rows.push(
          this.getRemoveRow(expressionEditInfo),
          new Menu.ExpressionMenuSeparator
        );
      }

      {
        let onGetExpressions = (variableInfo: Ctx.VariableInfo) => {
          let type = variableInfo.parameter.type;
          if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_SetDef) {
            return this.getVariableRefExpressions(expressionEditInfo, variableInfo, true);
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

      rows.push(
        new Menu.ExpressionMenuSeparator,
        this.getSetTermDefinitionRow(expressionEditInfo, onRenderTerm)
      );

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  private getSetTermDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
      let type = definition.type;
      if (type instanceof FmtHLM.MetaRefExpression_SetOperator || type instanceof FmtHLM.MetaRefExpression_Construction) {
        return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, true, HLMExpressionType.SetTerm);
      } else {
        return undefined;
      }
    };
    return this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.SetOperator, Logic.LogicDefinitionType.Construction], onGetExpressions, onRenderTerm);
  }

  addElementTermMenu(semanticLink: Notation.SemanticLink, term: Fmt.Expression, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
    if (expressionEditInfo) {
      this.addElementTermMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderTerm, termSelection);
    }
  }

  private addElementTermMenuWithEditInfo(semanticLink: Notation.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    semanticLink.onMenuOpened = () => {
      let rows: Menu.ExpressionMenuRow[] = [];

      if (expressionEditInfo.optional) {
        rows.push(
          this.getRemoveRow(expressionEditInfo),
          new Menu.ExpressionMenuSeparator
        );
      }

      {
        let onGetExpressions = (variableInfo: Ctx.VariableInfo) => {
          let type = variableInfo.parameter.type;
          if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def) {
            return this.getVariableRefExpressions(expressionEditInfo, variableInfo, true);
          }
          return CachedPromise.resolve([]);
        };
        rows.push(this.getVariableRow(expressionEditInfo, onGetExpressions, onRenderTerm));
      }

      if (termSelection.allowCases) {
        rows.push(this.getElementCasesRow(expressionEditInfo, onRenderTerm));
      }

      rows.push(
        new Menu.ExpressionMenuSeparator,
        this.getElementTermDefinitionRow(expressionEditInfo, onRenderTerm, termSelection.allowConstructors)
      );

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  private getElementTermDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, allowConstructors: boolean): Menu.ExpressionMenuRow {
    let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, fromMRUList: boolean) => {
      let type = definition.type;
      if (type instanceof FmtHLM.MetaRefExpression_ExplicitOperator
          || type instanceof FmtHLM.MetaRefExpression_ImplicitOperator
          || type instanceof FmtHLM.MetaRefExpression_MacroOperator
          || (allowConstructors && type instanceof FmtHLM.MetaRefExpression_Constructor && !(fromMRUList && definition.contents instanceof FmtHLM.ObjectContents_Constructor && definition.contents.rewrite))) {
        return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, true, HLMExpressionType.ElementTerm);
      } else {
        return undefined;
      }
    };
    return this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Operator, Logic.LogicDefinitionType.Constructor], onGetExpressions, onRenderTerm);
  }

  addFormulaMenu(semanticLink: Notation.SemanticLink, formula: Fmt.Expression, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(formula);
    if (expressionEditInfo) {
      this.addFormulaMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderFormula, formulaSelection);
    }
  }

  private addFormulaMenuWithEditInfo(semanticLink: Notation.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): void {
    semanticLink.onMenuOpened = () => {
      let rows: Menu.ExpressionMenuRow[] = [];

      if (expressionEditInfo.optional) {
        rows.push(
          this.getRemoveRow(expressionEditInfo),
          new Menu.ExpressionMenuSeparator
        );
      }

      {
        let onGetExpressions = (variableInfo: Ctx.VariableInfo) => {
          let type = variableInfo.parameter.type;
          if (type instanceof FmtHLM.MetaRefExpression_Prop) {
            return this.getVariableRefExpressions(expressionEditInfo, variableInfo, false)
              .then(addNegations);
          }
          return CachedPromise.resolve([]);
        };
        rows.push(this.getVariableRow(expressionEditInfo, onGetExpressions, onRenderFormula));
      }

      rows.push(
        this.getConnectiveRow(expressionEditInfo, onRenderFormula, formulaSelection),
        this.getQuantifierRow(expressionEditInfo, onRenderFormula),
        this.getRelationRow(expressionEditInfo, onRenderFormula)
      );

      if (formulaSelection.allowCases) {
        rows.push(this.getFormulaCasesRow(expressionEditInfo, onRenderFormula));
      }

      rows.push(
        new Menu.ExpressionMenuSeparator,
        this.getFormulaDefinitionRow(expressionEditInfo, onRenderFormula)
      );

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  private getFormulaDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
      let type = definition.type;
      if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
        return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, false, HLMExpressionType.Formula)
          .then(addNegations);
      } else {
        return undefined;
      }
    };
    return this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Predicate], onGetExpressions, onRenderFormula);
  }

  private getRemoveRow(expressionEditInfo: Edit.ExpressionEditInfo): Menu.ExpressionMenuRow {
    let removeRow = new Menu.StandardExpressionMenuRow('Remove');
    removeRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => expressionEditInfo.onSetValue(undefined));
    removeRow.iconType = 'remove';
    return removeRow;
  }

  private getEnumerationRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let enumerationExpression = new FmtHLM.MetaRefExpression_enumeration;

    let enumerationRow = new Menu.StandardExpressionMenuRow('Enumeration');
    enumerationRow.subMenu = this.getExpressionItem(enumerationExpression, expressionEditInfo, onRenderTerm);
    return enumerationRow;
  }

  private getSubsetRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let subsetParameter = this.utils.createElementParameter('x', this.getUsedParameterNames());
    let subsetExpression = new FmtHLM.MetaRefExpression_subset(subsetParameter, new Fmt.PlaceholderExpression(HLMExpressionType.Formula));

    let extendedSubsetExpression = new FmtHLM.MetaRefExpression_extendedSubset(new Fmt.ParameterList, new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));

    let subsetRow = new Menu.StandardExpressionMenuRow('Subset');
    subsetRow.subMenu = new Menu.ExpressionMenu(CachedPromise.resolve([
      this.getExpressionItem(subsetExpression, expressionEditInfo, onRenderTerm),
      this.getExpressionItem(extendedSubsetExpression, expressionEditInfo, onRenderTerm)
    ]));
    return subsetRow;
  }

  private getSetCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) =>
      new FmtHLM.MetaRefExpression_setStructuralCases(term, construction, cases);

    let casesRow = new Menu.StandardExpressionMenuRow('Cases');
    casesRow.subMenu = new Menu.ExpressionMenu(this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderTerm, HLMExpressionType.SetTerm));
    return casesRow;
  }

  private getElementCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) =>
      new FmtHLM.MetaRefExpression_structuralCases(term, construction, cases);

    let menuItems = this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderTerm, HLMExpressionType.ElementTerm)
      .then((items: Menu.ExpressionMenuItem[]) => {
        let positiveCase = new FmtHLM.ObjectContents_Case(new Fmt.PlaceholderExpression(HLMExpressionType.Formula), new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
        let negativeCase = new FmtHLM.ObjectContents_Case(new Fmt.PlaceholderExpression(HLMExpressionType.Formula), new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
        let caseExpression = new FmtHLM.MetaRefExpression_cases([positiveCase, negativeCase]);
        return items.concat(this.getExpressionItem(caseExpression, expressionEditInfo, onRenderTerm));
      });

    let casesRow = new Menu.StandardExpressionMenuRow('Cases');
    casesRow.subMenu = new Menu.ExpressionMenu(menuItems);
    return casesRow;
  }

  private getConnectiveRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): Menu.ExpressionMenuRow {
    let leftPlaceholder = expressionEditInfo.expression || new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let rightPlaceholder = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let andFormulas = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_and && expressionEditInfo.expression.formulas ? [...expressionEditInfo.expression.formulas, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];
    let andExpression = new FmtHLM.MetaRefExpression_and(...andFormulas);
    let orFormulas = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_or && expressionEditInfo.expression.formulas ? [...expressionEditInfo.expression.formulas, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];
    let orExpression = new FmtHLM.MetaRefExpression_or(...orFormulas);

    let mainList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
      this.getExpressionItem(andExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(orExpression, expressionEditInfo, onRenderFormula)
    ]));
    let connectiveMenuRows = [mainList];
    if (formulaSelection.allowTruthValue) {
      let trueExpression = new FmtHLM.MetaRefExpression_and;
      let falseExpression = new FmtHLM.MetaRefExpression_or;
      let truthValueList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
        this.getExpressionItem(trueExpression, expressionEditInfo, onRenderFormula),
        this.getExpressionItem(falseExpression, expressionEditInfo, onRenderFormula)
      ]));
      connectiveMenuRows.push(truthValueList);
    }
    if (formulaSelection.allowEquiv) {
      let equivExpression = new FmtHLM.MetaRefExpression_equiv(leftPlaceholder, rightPlaceholder);
      let equivList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
        this.getExpressionItem(equivExpression, expressionEditInfo, onRenderFormula)
      ]));
      connectiveMenuRows.push(equivList);
    }
    let connectiveRow = new Menu.StandardExpressionMenuRow('Connective');
    connectiveRow.subMenu = new Menu.ExpressionMenu(CachedPromise.resolve(connectiveMenuRows));
    return connectiveRow;
  }

  private getQuantifierRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let forallExpression = new FmtHLM.MetaRefExpression_forall(new Fmt.ParameterList, new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
    let existsExpression = new FmtHLM.MetaRefExpression_exists(new Fmt.ParameterList, new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
    let existsUniqueExpression = new FmtHLM.MetaRefExpression_existsUnique(new Fmt.ParameterList, new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
    let negatedExistsExpression = new FmtHLM.MetaRefExpression_not(existsExpression);

    let mainList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
      this.getExpressionItem(forallExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(existsExpression, expressionEditInfo, onRenderFormula)
    ]));
    let secondaryList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
      this.getExpressionItem(existsUniqueExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedExistsExpression, expressionEditInfo, onRenderFormula)
    ]));
    let quantifierRow = new Menu.StandardExpressionMenuRow('Quantifier');
    quantifierRow.subMenu = new Menu.ExpressionMenu(CachedPromise.resolve([
      mainList,
      secondaryList
    ]));
    return quantifierRow;
  }

  private getRelationRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let equalsExpression = new FmtHLM.MetaRefExpression_equals(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm), new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
    let inExpression = new FmtHLM.MetaRefExpression_in(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm), new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
    let subExpression = new FmtHLM.MetaRefExpression_sub(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm), new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
    let setEqualsExpression = new FmtHLM.MetaRefExpression_setEquals(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm), new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
    let negatedEqualsExpression = new FmtHLM.MetaRefExpression_not(equalsExpression);
    let negatedInExpression = new FmtHLM.MetaRefExpression_not(inExpression);
    let negatedSubExpression = new FmtHLM.MetaRefExpression_not(subExpression);
    let negatedSetEqualsExpression = new FmtHLM.MetaRefExpression_not(setEqualsExpression);

    let mainList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
      this.getExpressionItem(equalsExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(inExpression, expressionEditInfo, onRenderFormula)
    ]));
    let secondaryList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
      this.getExpressionItem(subExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(setEqualsExpression, expressionEditInfo, onRenderFormula)
    ]));
    let negatedMainList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
      this.getExpressionItem(negatedEqualsExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedInExpression, expressionEditInfo, onRenderFormula)
    ]));
    let negatedSecondaryList = new Menu.ExpressionMenuItemList(CachedPromise.resolve([
      this.getExpressionItem(negatedSubExpression, expressionEditInfo, onRenderFormula),
      this.getExpressionItem(negatedSetEqualsExpression, expressionEditInfo, onRenderFormula)
    ]));
    let relationRow = new Menu.StandardExpressionMenuRow('Relation');
    relationRow.subMenu = new Menu.ExpressionMenu(CachedPromise.resolve([
      mainList,
      secondaryList,
      negatedMainList,
      negatedSecondaryList
    ]));
    return relationRow;
  }

  private getFormulaCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) =>
      new FmtHLM.MetaRefExpression_structural(term, construction, cases);

    let casesRow = new Menu.StandardExpressionMenuRow('Cases');
    casesRow.subMenu = new Menu.ExpressionMenu(this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderFormula, HLMExpressionType.Formula));
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
          let origEmpty = !origExpression.formulas || !origExpression.formulas.length;
          let newEmpty = !newExpression.formulas || !newExpression.formulas.length;
          item.selected = (newEmpty === origEmpty);
        }
      }
    }

    return item;
  }

  private getVariableRefExpressions(expressionEditInfo: Edit.ExpressionEditInfo, variableInfo: Ctx.VariableInfo, checkType: boolean): CachedPromise<Fmt.Expression[]> {
    let expression: Fmt.Expression = new Fmt.VariableRefExpression(variableInfo.parameter);
    if (variableInfo.indexParameterLists) {
      for (let indexParameterList of variableInfo.indexParameterLists) {
        let index: Fmt.Index = {
          parameters: indexParameterList,
          arguments: new Fmt.ArgumentList
        };
        this.utils.fillDefaultPlaceholderArguments(indexParameterList, index.arguments!, undefined);
        expression = new Fmt.IndexedExpression(expression, index);
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

  protected addToMRU(expression: Fmt.Expression): void {
    while (expression instanceof FmtHLM.MetaRefExpression_not) {
      expression = expression.formula;
    }
    super.addToMRU(expression);
  }

  private getDefinitionRefExpressions(expressionEditInfo: Edit.ExpressionEditInfo, path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, checkType: boolean, expressionType: HLMExpressionType): CachedPromise<Fmt.Expression[]> {
    let checkResultPath = (prevResultPromise: CachedPromise<Fmt.Expression | undefined> | undefined, resultPath: Fmt.Path) => {
      if (!prevResultPromise) {
        prevResultPromise = CachedPromise.resolve(undefined);
      }
      return prevResultPromise.then((prevResult: Fmt.Expression | undefined) => {
        if (prevResult) {
          return prevResult;
        }
        let expression = new Fmt.DefinitionRefExpression(resultPath);
        if (checkType && expressionEditInfo.expression) {
          return this.checker.recheckWithSubstitution(expressionEditInfo.expression, expression)
            .then((checkResult: Logic.LogicCheckResultWithExpression) => checkResult.hasErrors ? undefined : checkResult.expression)
            .catch(() => undefined);
        } else {
          return expression;
        }
      });
    };
    let preFillExpression = expressionEditInfo.expression instanceof Fmt.PlaceholderExpression ? undefined : expressionEditInfo.expression;
    return this.getValidDefinitionRefExpressions(path, outerDefinition, definition, expressionEditInfo.context, checkResultPath, preFillExpression, expressionType);
  }

  private getValidDefinitionRefExpressions(path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, context: Ctx.Context | undefined, checkResultPath: (prevResult: CachedPromise<Fmt.Expression | undefined> | undefined, resultPath: Fmt.Path) => CachedPromise<Fmt.Expression | undefined>, preFillExpression?: Fmt.Expression, preFillExpressionType?: HLMExpressionType, requirePreFilling: boolean = false): CachedPromise<Fmt.Expression[]> {
    let resultExpressionPromises = this.createPathsWithArguments(path, outerDefinition, definition, context, checkResultPath, preFillExpression, preFillExpressionType, requirePreFilling);
    let result: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (let resultExpressionPromise of resultExpressionPromises) {
      result = result.then((currentResult: Fmt.Expression[]) =>
        resultExpressionPromise.then((resultExpression: Fmt.Expression | undefined) =>
          resultExpression ? currentResult.concat(resultExpression) : currentResult));
    }
    return result;
  }

  private createPathsWithArguments<T>(path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, context: Ctx.Context | undefined, checkResultPath: (prevResult: T | undefined, resultPath: Fmt.Path) => T, preFillExpression?: Fmt.Expression, preFillExpressionType?: HLMExpressionType, requirePreFilling: boolean = false): T[] {
    let notationAlternatives = this.renderUtils.getNotationAlternatives(definition);
    let result: T[] = [];
    for (let notationAlternative of notationAlternatives) {
      let parentPaths: (Fmt.PathItem | undefined)[] = [];
      if (path.parentPath instanceof Fmt.Path) {
        let checkParentPath = (prevResult: Fmt.Path | undefined, parentPath: Fmt.Path) => prevResult || parentPath;
        parentPaths = this.createPathsWithArguments(path.parentPath, outerDefinition, outerDefinition, context, checkParentPath);
      } else {
        parentPaths = [path.parentPath];
      }
      for (let parentPath of parentPaths) {
        let resultPath = new Fmt.Path(path.name);
        this.utils.fillDefaultPlaceholderArguments(definition.parameters, resultPath.arguments, parentPath);
        resultPath.parentPath = parentPath;
        if (notationAlternative) {
          this.utils.reorderArguments(resultPath.arguments, notationAlternative);
        }
        let pathWithArgumentsResult = this.getPathWithArgumentsResult(resultPath, checkResultPath, definition, preFillExpression, preFillExpressionType, requirePreFilling);
        if (pathWithArgumentsResult) {
          result.push(pathWithArgumentsResult);
        }
      }
    }
    return result;
  }

  private getPathWithArgumentsResult<T>(resultPath: Fmt.Path, checkResultPath: (prevResult: T | undefined, resultPath: Fmt.Path) => T, definition: Fmt.Definition, preFillExpression?: Fmt.Expression, preFillExpressionType?: HLMExpressionType, requirePreFilling: boolean = false): T | undefined {
    let currentResultItem: T | undefined = undefined;
    if (preFillExpression) {
      let visibleParameters: Fmt.Parameter[] = definition.parameters;
      if (definition.contents instanceof FmtHLM.ObjectContents_Definition && definition.contents.notation) {
        visibleParameters = this.utils.findReferencedParameters(definition.contents.notation);
      }
      for (let param of visibleParameters) {
        let type = param.type;
        let newResultPath: Fmt.Path | undefined = undefined;
        switch (preFillExpressionType) {
        case HLMExpressionType.Formula:
          if (type instanceof FmtHLM.MetaRefExpression_Prop) {
            newResultPath = this.setResultPathArgument(resultPath, definition.parameters, param, preFillExpression);
          }
          break;
        case HLMExpressionType.SetTerm:
          if (type instanceof FmtHLM.MetaRefExpression_Set) {
            newResultPath = this.setResultPathArgument(resultPath, definition.parameters, param, preFillExpression);
          } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
            newResultPath = this.setResultPathArgument(resultPath, definition.parameters, param, preFillExpression);
          }
          break;
        case HLMExpressionType.ElementTerm:
          if (type instanceof FmtHLM.MetaRefExpression_Element) {
            newResultPath = this.setResultPathArgument(resultPath, definition.parameters, param, preFillExpression);
          }
          break;
        }
        if (newResultPath) {
          currentResultItem = checkResultPath(currentResultItem, newResultPath);
        }
      }
    }
    if (requirePreFilling) {
      return currentResultItem;
    } else {
      return checkResultPath(currentResultItem, resultPath);
    }
  }

  private setResultPathArgument(resultPath: Fmt.Path, parameterList: Fmt.ParameterList, param: Fmt.Parameter, value: Fmt.Expression): Fmt.Path | undefined {
    if (parameterList.indexOf(param) >= 0) {
      let newResultPath = resultPath.clone() as Fmt.Path;
      for (let arg of newResultPath.arguments) {
        if (arg.name === param.name) {
          arg.value = value;
          return newResultPath;
        }
      }
    }
    return undefined;
  }

  protected getDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, definitionTypes: Logic.LogicDefinitionType[], onGetExpressions: GetExpressionsFn, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuRow {
    let onRenderExpressionWithSemanticLink = (expression: Fmt.Expression) => {
      let renderedExpression = onRenderExpression(expression);
      if (!renderedExpression.semanticLinks) {
        while (expression instanceof FmtHLM.MetaRefExpression_not) {
          expression = expression.formula;
        }
        renderedExpression.semanticLinks = [new Notation.SemanticLink(expression)];
      }
      return renderedExpression;
    };
    return super.getDefinitionRow(expressionEditInfo, definitionTypes, onGetExpressions, onRenderExpressionWithSemanticLink);
  }

  private getStructuralCaseItems(createStructuralExpression: (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) => Fmt.Expression, expressionEditInfo: Edit.ExpressionEditInfo, onRenderExpression: RenderExpressionFn, expressionType: HLMExpressionType): CachedPromise<Menu.ExpressionMenuItem[]> {
    let options: Logic.LogicCheckerOptions = {
      supportPlaceholders: true,
      supportRechecking: false,
      warnAboutMissingProofs: false
    };
    let structuralChecker = new HLMDefinitionChecker(this.definition, this.libraryDataProvider, this.utils, options);

    let result = CachedPromise.resolve<Menu.ExpressionMenuItem[]>([]);
    let variables = expressionEditInfo.context.getVariables();
    for (let variableInfo of variables) {
      let type = variableInfo.parameter.type;
      if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def) {
        result = result.then((menuItems: Menu.ExpressionMenuItem[]) =>
          this.getVariableRefExpressions(expressionEditInfo, variableInfo, false).then((variableRefExpressions: Fmt.Expression[]) => {
            let currentMenuItems = CachedPromise.resolve(menuItems);
            for (let variableRefExpression of variableRefExpressions) {
              currentMenuItems = currentMenuItems.then((items: Menu.ExpressionMenuItem[]) => {
                let inductionExpression = createStructuralExpression(
                  variableRefExpression,
                  new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm),
                  []
                );
                return structuralChecker.checkExpression(inductionExpression, expressionType)
                  .then((checkResult: Logic.LogicCheckResultWithExpression) => {
                    if (checkResult.hasErrors) {
                      return items;
                    } else {
                      let onFillExpression = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => {
                        this.adaptNewParameterLists(newParameterLists);
                        inductionExpression = FmtUtils.substituteExpression(inductionExpression, originalExpression, filledExpression);
                      };
                      return structuralChecker.autoFill(onFillExpression).then(() =>
                        items.concat(this.getInductionItem(inductionExpression, variableRefExpression, (inductionExpression as any).cases, expressionEditInfo, onRenderExpression)));
                    }
                  })
                  .catch(() => items);
              });
            }
            return currentMenuItems;
          }));
      }
    }

    result = result.then((menuItems: Menu.ExpressionMenuItem[]) => {
      let structuralExpression = createStructuralExpression(
        new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm),
        new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm),
        []
      );
      return menuItems.concat(this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderExpression));
    });

    return result;
  }

  private getInductionItem(expression: Fmt.Expression, variableRefExpression: Fmt.Expression, cases: FmtHLM.ObjectContents_Case[], expressionEditInfo: Edit.ExpressionEditInfo, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuItem {
    let onRenderInductionExpression = () => {
      let label = new Notation.TextExpression(cases.length === 1 ? 'Decompose ' : 'Induction on ');
      label.styleClasses = ['info-text'];
      let variable = onRenderExpression(variableRefExpression);
      return new Notation.RowExpression([label, variable]);
    };
    return this.getExpressionItem(expression, expressionEditInfo, onRenderInductionExpression);
  }

  getConstructorInsertButton(definitions: Fmt.DefinitionList): Notation.RenderedExpression {
    let action = new Menu.DialogExpressionMenuAction(() => {
      let dialog = new Dialog.InsertDialog;
      dialog.libraryDataProvider = this.libraryDataProvider;
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
    });
    return this.getActionInsertButton(action);
  }

  getEmbeddingInsertButton(definitionContents: FmtHLM.ObjectContents_Construction, onRenderEmbedding: (expression: Fmt.Expression, full: boolean) => Notation.RenderedExpression): Notation.RenderedExpression {
    return this.getMenuInsertButton(() => {
      return new Menu.ExpressionMenu(CachedPromise.resolve([
        this.getEmbeddingRow(definitionContents, false, onRenderEmbedding),
        this.getEmbeddingRow(definitionContents, true, onRenderEmbedding)
      ]));
    });
  }

  private getEmbeddingRow(definitionContents: FmtHLM.ObjectContents_Construction, full: boolean, onRenderEmbedding: (expression: Fmt.Expression, full: boolean) => Notation.RenderedExpression): Menu.ExpressionMenuRow {
    let parameter = this.utils.createElementParameter('x', this.getUsedParameterNames());
    let parameterType = parameter.type as FmtHLM.MetaRefExpression_Element;
    let item = new Menu.ExpressionMenuItem(onRenderEmbedding(parameterType._set, full));
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      let fullExpression = full ? new FmtHLM.MetaRefExpression_true : undefined;
      let embedding = new FmtHLM.ObjectContents_Embedding(parameter, new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm), fullExpression);
      definitionContents.embedding = embedding;
      GenericEditHandler.lastInsertedParameter = embedding.parameter;
    });
    let row = new Menu.StandardExpressionMenuRow(full ? 'Equivalence' : 'Embedding');
    row.subMenu = item;
    return row;
  }

  getElementTermInsertButton(parentExpression: Fmt.Expression, onInsertTerm: InsertExpressionFn, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): Notation.RenderedExpression {
    let onAddMenu = (semanticLink: Notation.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo) =>
      this.addElementTermMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderTerm, termSelection);
    return this.getExpressionInsertButton(parentExpression, onInsertTerm, onAddMenu);
  }

  private getExpressionInsertButton(parentExpression: Fmt.Expression, onInsertExpression: InsertExpressionFn, onAddMenu: (semanticLink: Notation.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo) => void): Notation.RenderedExpression {
    return this.getSemanticLinkInsertButton((semanticLink: Notation.SemanticLink) => {
      let parentExpressionEditInfo = this.editAnalysis.expressionEditInfo.get(parentExpression);
      if (parentExpressionEditInfo) {
        let expressionEditInfo: Edit.ExpressionEditInfo = {
          optional: false,
          onSetValue: (newValue) => onInsertExpression(newValue!),
          context: parentExpressionEditInfo.context
        };
        onAddMenu(semanticLink, expressionEditInfo);
      }
    });
  }

  addEnumerationInsertButton(renderedItems: Notation.RenderedExpression[], term: FmtHLM.MetaRefExpression_enumeration, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let onInsertTerm = (expression: Fmt.Expression) => {
      if (term.terms) {
        term.terms.push(expression);
      } else {
        term.terms = [expression];
      }
    };
    let insertButton = this.getElementTermInsertButton(term, onInsertTerm, onRenderTerm, termSelection);
    this.addItemInsertButton(renderedItems, insertButton);
  }

  private addItemInsertButton(renderedItems: Notation.RenderedExpression[], insertButton: Notation.RenderedExpression): void {
    if (renderedItems.length) {
      let lastItemWithButton = [
        renderedItems[renderedItems.length - 1],
        new Notation.TextExpression(' '),
        insertButton
      ];
      renderedItems[renderedItems.length - 1] = new Notation.RowExpression(lastItemWithButton);
    } else {
      renderedItems.push(insertButton);
    }
  }

  addArrayArgumentInsertButton(renderedItems: Notation.ExpressionValue[], param: Fmt.Parameter, innerType: Fmt.Expression, macroInvocation: HLMMacro.HLMMacroInvocation, subExpression: Fmt.ArrayExpression): void {
    let arrayArgumentOperations = macroInvocation.getArrayArgumentOperations?.(subExpression);
    let originalExpression = macroInvocation.expression;
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(originalExpression);
    if (arrayArgumentOperations && expressionEditInfo) {
      let substitutedExpression = arrayArgumentOperations.insertItem();
      if (substitutedExpression) {
        let onInsertItem = () => expressionEditInfo!.onSetValue(substitutedExpression);
        let enabledPromise = this.checker.recheckWithSubstitution(originalExpression, substitutedExpression)
          .then((checkResult: Logic.LogicCheckResultWithExpression) => !checkResult.hasErrors);
        this.addListItemInsertButton(renderedItems, innerType, onInsertItem, enabledPromise);
      }
    }
  }

  getPropertyInsertButton(parameterList: Fmt.ParameterList, objectParams: Fmt.Parameter[], onInsertParam: InsertParameterFn, onRenderFormulas: RenderExpressionsFn): Notation.RenderedExpression | undefined {
    if (!objectParams.length) {
      return undefined;
    }
    let firstObjectParam = objectParams[0];
    let objectExpressionType = this.utils.getParameterExpressionType(firstObjectParam);
    let context = this.editAnalysis.newParameterContext.get(parameterList);
    if (!objectExpressionType || !context) {
      return undefined;
    }
    objectParams = objectParams.slice();
    let insertButton = new Notation.InsertPlaceholderExpression;
    insertButton.styleClasses = ['mini-placeholder'];
    let semanticLink = new Notation.SemanticLink(insertButton, false, false);
    semanticLink.onMenuOpened = () => {
      let firstObjectExpression = new Fmt.VariableRefExpression(firstObjectParam);
      let getPropertyFormulas = (formula: Fmt.Expression) => objectParams.map((objectParam: Fmt.Parameter) => {
        let objectExpression = new Fmt.VariableRefExpression(objectParam);
        return FmtUtils.substituteExpression(formula, firstObjectExpression, objectExpression);
      });
      let onInsertProperty = (formula: Fmt.Expression | undefined) => {
        if (formula) {
          for (let propertyFormula of getPropertyFormulas(formula)) {
            let newParamType = new FmtHLM.MetaRefExpression_Constraint(propertyFormula);
            let newParam = this.utils.createParameter(newParamType, '_1', this.getUsedParameterNames());
            onInsertParam(newParam);
            context = new Ctx.ParameterContext(newParam, context!);
          }
        }
      };
      let expressionEditInfo: Edit.ExpressionEditInfo = {
        optional: true,
        onSetValue: onInsertProperty,
        context: context!
      };
      let checkResultPath = (prevResultPromise: CachedPromise<Fmt.Expression | undefined> | undefined, resultPath: Fmt.Path) => {
        if (!prevResultPromise) {
          prevResultPromise = CachedPromise.resolve(undefined);
        }
        return prevResultPromise.then((prevResult: Fmt.Expression | undefined) => {
          if (prevResult) {
            return prevResult;
          }
          let expression = new Fmt.DefinitionRefExpression(resultPath);
          return this.checker.checkConstraint(parameterList, expression)
            .then((checkResult: Logic.LogicCheckResultWithExpression) => checkResult.hasErrors ? undefined : checkResult.expression)
            .catch(() => undefined);
        });
      };
      let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
        let type = definition.type;
        if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
          return this.getValidDefinitionRefExpressions(path, outerDefinition, definition, context!, checkResultPath, firstObjectExpression, objectExpressionType, true)
            .then(addNegations);
        } else {
          return undefined;
        }
      };
      let onRenderProperty = (formula: Fmt.Expression) => onRenderFormulas(getPropertyFormulas(formula));
      return new Menu.ExpressionMenu(CachedPromise.resolve([
        this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Predicate], onGetExpressions, onRenderProperty)
      ]));
    };
    insertButton.semanticLinks = [semanticLink];
    return insertButton;
  }

  addPropertyInsertButton(parameterList: Fmt.ParameterList, singular: Notation.RenderedExpression[], plural: Notation.RenderedExpression[], objectParams: Fmt.Parameter[], onInsertParam: InsertParameterFn, onRenderFormulas: RenderExpressionsFn): void {
    let insertButton = this.getPropertyInsertButton(parameterList, objectParams, onInsertParam, onRenderFormulas);
    if (insertButton) {
      let space = new Notation.TextExpression(' ');
      singular.unshift(insertButton, space);
      plural.unshift(insertButton, space);
    }
  }

  addImplicitDefinitionMenu(semanticLink: Notation.SemanticLink, onRenderExplicitIntro: Logic.RenderFn, onRenderImplicitIntro: RenderParameterFn): void {
    semanticLink.onMenuOpened = () => {
      return new Menu.ExpressionMenu(CachedPromise.resolve([
        this.getExplicitDefinitionRow(onRenderExplicitIntro),
        this.getImplicitDefinitionRow(onRenderImplicitIntro)
      ]));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private getExplicitDefinitionRow(onRenderExplicitIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let item = new Menu.ExpressionMenuItem(onRenderExplicitIntro());
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      let originalContents = this.definition.contents as FmtHLM.ObjectContents_Definition;
      this.definition.type = new FmtHLM.MetaRefExpression_ExplicitOperator;
      this.definition.contents = new FmtHLM.ObjectContents_ExplicitOperator(originalContents.properties, originalContents.notation, originalContents.abbreviations, originalContents.definitionNotation, [new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm)]);
    });
    let row = new Menu.StandardExpressionMenuRow('Explicit');
    row.subMenu = item;
    row.selected = this.definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator;
    item.selected = row.selected;
    return row;
  }

  private getImplicitDefinitionRow(onRenderImplicitIntro: RenderParameterFn): Menu.ExpressionMenuRow {
    let parameter = this.utils.createElementParameter('x', this.getUsedParameterNames());
    let item = new Menu.ExpressionMenuItem(onRenderImplicitIntro(parameter));
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      let originalContents = this.definition.contents as FmtHLM.ObjectContents_Definition;
      this.definition.type = new FmtHLM.MetaRefExpression_ImplicitOperator;
      this.definition.contents = new FmtHLM.ObjectContents_ImplicitOperator(originalContents.properties, originalContents.notation, originalContents.abbreviations, originalContents.definitionNotation, parameter, [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)]);
      GenericEditHandler.lastInsertedParameter = parameter;
    });
    let row = new Menu.StandardExpressionMenuRow('Implicit');
    row.subMenu = item;
    row.selected = this.definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator;
    item.selected = row.selected;
    return row;
  }

  addTheoremTypeMenu(semanticLink: Notation.SemanticLink, onRenderStandardIntro: Logic.RenderFn, onRenderEquivalenceIntro: Logic.RenderFn): void {
    semanticLink.onMenuOpened = () => {
      return new Menu.ExpressionMenu(CachedPromise.resolve([
        this.getStandardTheoremRow(onRenderStandardIntro),
        this.getEquivalenceTheoremRow(onRenderEquivalenceIntro)
      ]));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private getStandardTheoremRow(onRenderStandardIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let item = new Menu.ExpressionMenuItem(onRenderStandardIntro());
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      this.definition.type = new FmtHLM.MetaRefExpression_StandardTheorem;
      this.definition.contents = new FmtHLM.ObjectContents_StandardTheorem(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
    });
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem;
    return item;
  }

  private getEquivalenceTheoremRow(onRenderEquivalenceIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let item = new Menu.ExpressionMenuItem(onRenderEquivalenceIntro());
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      this.definition.type = new FmtHLM.MetaRefExpression_EquivalenceTheorem;
      this.definition.contents = new FmtHLM.ObjectContents_EquivalenceTheorem([new Fmt.PlaceholderExpression(HLMExpressionType.Formula), new Fmt.PlaceholderExpression(HLMExpressionType.Formula)]);
    });
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem;
    return item;
  }

  private createEqualityDefinition(parameters: Fmt.ParameterList): FmtHLM.ObjectContents_EqualityDefinition {
    let leftParameters = parameters.clone();
    let rightParameters = parameters.clone();
    this.addApostrophes(rightParameters);
    return new FmtHLM.ObjectContents_EqualityDefinition(leftParameters, rightParameters, [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)]);
  }

  private addApostrophes(parameters: Fmt.ParameterList): void {
    for (let param of parameters) {
      let type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        this.addApostrophes(type.targetParameters);
      } else {
        param.name += '\'';
      }
    }
  }

  getCaseInsertButton(term: FmtHLM.MetaRefExpression_cases): Notation.RenderedExpression {
    let onInsert = () => {
      let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
      if (expressionEditInfo) {
        let newCase = new FmtHLM.ObjectContents_Case(new Fmt.PlaceholderExpression(HLMExpressionType.Formula), new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
        let newTerm = term.clone() as FmtHLM.MetaRefExpression_cases;
        newTerm.cases.push(newCase);
        expressionEditInfo.onSetValue(newTerm);
      }
    };
    return this.getImmediateInsertButton(onInsert);
  }

  getProofInsertButton(onInsertProof: InsertProofFn): Notation.RenderedExpression {
    let onInsert = () => {
      let proof = new FmtHLM.ObjectContents_Proof(undefined, undefined, undefined, undefined, new Fmt.ParameterList);
      onInsertProof(proof);
    };
    return this.getImmediateInsertButton(onInsert);
  }

  getProofStepInsertButton(proof: FmtHLM.ObjectContents_Proof): Notation.RenderedExpression {
    return this.getMenuInsertButton(() => {
      let rows: Menu.ExpressionMenuRow[] = [];

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    });
  }
}
