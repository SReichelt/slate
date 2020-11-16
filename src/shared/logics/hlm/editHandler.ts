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
import { GenericEditHandler, RenderTypeFn, RenderParameterFn, InsertParameterFn, RenderExpressionFn, InsertExpressionFn, SetExpressionFn, RenderExpressionsFn, GetExpressionsFn } from '../generic/editHandler';
import { LibraryDataProvider, LibraryItemInfo } from '../../data/libraryDataProvider';
import { MRUList } from '../../data/mostRecentlyUsedList';
import { HLMExpressionType } from './hlm';
import { HLMEditAnalysis } from './edit';
import { HLMUtils, HLMFormulaDefinition, HLMFormulaCase, HLMFormulaCases, unfoldAll, HLMSubstitutionContext, HLMEquivalenceListInfo } from './utils';
import { HLMRenderUtils } from './renderUtils';
import { HLMDefinitionChecker, HLMCheckResult, HLMCheckerProofStepContext, HLMCheckerStructuralCaseRef } from './checker';
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

interface ProofStepInfo {
  step: Fmt.Parameter;
  linkedObject?: Object;
  preventCloning?: boolean;
}

interface ProveByCasesInfo {
  hasPreviousResultBasedCases: boolean;
  hasGoalBasedCases: boolean;
}

const unfoldContinuationLimit = 8;

function addNegations(expressions: Fmt.Expression[]): Fmt.Expression[] {
  let negatedExpressions = expressions.map((expression: Fmt.Expression) =>
    new FmtHLM.MetaRefExpression_not(expression));
  return expressions.concat(negatedExpressions);
};

// TODO if checker specifies an exact value for a given placeholder, display only that value when opening its menu

export class HLMEditHandler extends GenericEditHandler {
  protected checker: HLMDefinitionChecker;
  private checkResultPromise?: CachedPromise<HLMCheckResult>;

  static lastInsertedProof?: FmtHLM.ObjectContents_Proof;

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
    this.checkResultPromise = undefined;
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
      this.checkResultPromise = this.checker.checkDefinition();
      return this.checkResultPromise
        .then((checkResult: HLMCheckResult): void | CachedPromise<void> => {
          if (onAutoFilled && !checkResult.hasErrors) {
            let onFillExpression = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => {
              let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(originalExpression);
              if (expressionEditInfo) {
                this.adaptNewParameterLists(newParameterLists, filledExpression);
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

  private adaptNewParameterLists(newParameterLists: Fmt.ParameterList[], scope: Fmt.Traversable): void {
    let usedNames = this.getUsedParameterNames();
    for (let parameterList of newParameterLists) {
      this.utils.adaptParameterNames(parameterList, usedNames, scope);
    }
  }

  createConditionalElement(onRenderElement: (checkResult: HLMCheckResult) => Notation.RenderedExpression | CachedPromise<Notation.RenderedExpression>): Notation.RenderedExpression {
    if (this.checkResultPromise) {
      let resultPromise = this.checkResultPromise.then(onRenderElement);
      return new Notation.PromiseExpression(resultPromise);
    } else {
      // Should not happen.
      return new Notation.ErrorExpression('Check result unavailable');
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
            return this.getVariableRefExpressions(variableInfo, expressionEditInfo);
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
            return this.getVariableRefExpressions(variableInfo, expressionEditInfo);
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
            return this.getVariableRefExpressions(variableInfo)
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

  private getVariableRefExpressions(variableInfo: Ctx.VariableInfo, expressionEditInfo?: Edit.ExpressionEditInfo): CachedPromise<Fmt.Expression[]> {
    let expression: Fmt.Expression = new Fmt.VariableRefExpression(variableInfo.parameter);
    if (variableInfo.indexParameterLists) {
      for (let indexParameterList of variableInfo.indexParameterLists) {
        let index: Fmt.Index = {
          parameters: indexParameterList,
          arguments: new Fmt.ArgumentList
        };
        this.utils.fillPlaceholderArguments(indexParameterList, index.arguments!);
        expression = new Fmt.IndexedExpression(expression, index);
      }
    }
    if (expressionEditInfo?.expression) {
      return this.checker.recheckWithSubstitution(expressionEditInfo.expression, expression)
        .then((resultExpression: Fmt.Expression | undefined) => (resultExpression ? [resultExpression] : []))
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
            .then((resultExpression: Fmt.Expression | undefined) => (resultExpression ? this.cloneAndAdaptParameterNames(resultExpression) : undefined))
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
        let substitutionContext = new HLMSubstitutionContext;
        if (parentPath instanceof Fmt.Path) {
          this.utils.addPathSubstitution(parentPath, [outerDefinition], substitutionContext);
        } else {
          this.utils.addTargetPathSubstitution(parentPath, substitutionContext);
        }
        let resultPath = new Fmt.Path(path.name);
        this.utils.fillPlaceholderArguments(definition.parameters, resultPath.arguments, substitutionContext);
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
    let createAndCheckStructuralExpression = (variableRefExpression: Fmt.Expression) => {
      let placeholder = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
      placeholder.specialRole = Fmt.SpecialPlaceholderRole.Preview;
      return this.checker.recheckWithSubstitution(expressionEditInfo.expression!, createStructuralExpression(variableRefExpression, placeholder, []))
        .then((resultExpression: Fmt.Expression | undefined) => {
          placeholder.specialRole = undefined;
          if (resultExpression) {
            return this.cloneAndAdaptParameterNames(resultExpression);
          } else {
            return undefined;
          }
        })
        .catch(() => undefined);
    };
    let createItem = (structuralExpression: Fmt.Expression, variableRefExpression: Fmt.Expression) =>
      this.getInductionItem(structuralExpression, variableRefExpression, (structuralExpression as any).cases, expressionEditInfo, onRenderExpression);
    let result = this.getInductionItems(expressionEditInfo.context, createAndCheckStructuralExpression, createItem);

    result = result.then((menuItems: Menu.ExpressionMenuItem[]) => {
      let placeholder = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
      let structuralExpression = createStructuralExpression(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm), placeholder, []);
      return menuItems.concat(this.getExpressionItem(structuralExpression, expressionEditInfo, onRenderExpression));
    });

    return result;
  }

  private getInductionItems<T, E extends Fmt.Expression>(context: Ctx.Context, createAndCheckStructuralExpression: (variableRefExpression: Fmt.Expression) => CachedPromise<E | undefined>, createItem: (structuralExpression: E, variableRefExpression: Fmt.Expression) => T): CachedPromise<T[]> {
    let resultPromise = CachedPromise.resolve<T[]>([]);
    let variables = context.getVariables();
    for (let variableInfo of variables) {
      let type = variableInfo.parameter.type;
      if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def) {
        resultPromise = resultPromise.then((currentResult: T[]) =>
          this.getVariableRefExpressions(variableInfo).then((variableRefExpressions: Fmt.Expression[]) => {
            let innerResultPromise = CachedPromise.resolve(currentResult);
            for (let variableRefExpression of variableRefExpressions) {
              innerResultPromise = innerResultPromise.then((innerResult: T[]) =>
                createAndCheckStructuralExpression(variableRefExpression).then((structuralExpression: E | undefined) => {
                  if (structuralExpression && (structuralExpression as any).cases.length) {
                    return innerResult.concat(createItem(structuralExpression!, variableRefExpression));
                  } else {
                    return innerResult;
                  }
                }));
            }
            return innerResultPromise;
          }));
      }
    }
    return resultPromise;
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
    let action = new Menu.ImmediateExpressionMenuAction(() => {
      let fullExpression = full ? new FmtHLM.MetaRefExpression_true : undefined;
      let embedding = new FmtHLM.ObjectContents_Embedding(parameter, new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm), fullExpression);
      definitionContents.embedding = embedding;
      GenericEditHandler.lastInsertedParameter = embedding.parameter;
    });
    let item = new Menu.ExpressionMenuItem(onRenderEmbedding(parameterType._set, full), action);
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
          .then((resultExpression: Fmt.Expression | undefined) => (resultExpression !== undefined));
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
    let action = new Menu.ImmediateExpressionMenuAction(() => {
      let originalContents = this.definition.contents as FmtHLM.ObjectContents_Definition;
      this.definition.type = new FmtHLM.MetaRefExpression_ExplicitOperator;
      this.definition.contents = new FmtHLM.ObjectContents_ExplicitOperator(originalContents.properties, originalContents.notation, originalContents.abbreviations, originalContents.definitionNotation, [new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm)]);
    });
    let item = new Menu.ExpressionMenuItem(onRenderExplicitIntro(), action);
    let row = new Menu.StandardExpressionMenuRow('Explicit');
    row.subMenu = item;
    row.selected = this.definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator;
    item.selected = row.selected;
    return row;
  }

  private getImplicitDefinitionRow(onRenderImplicitIntro: RenderParameterFn): Menu.ExpressionMenuRow {
    let parameter = this.utils.createElementParameter('x', this.getUsedParameterNames());
    let action = new Menu.ImmediateExpressionMenuAction(() => {
      let originalContents = this.definition.contents as FmtHLM.ObjectContents_Definition;
      this.definition.type = new FmtHLM.MetaRefExpression_ImplicitOperator;
      this.definition.contents = new FmtHLM.ObjectContents_ImplicitOperator(originalContents.properties, originalContents.notation, originalContents.abbreviations, originalContents.definitionNotation, parameter, [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)]);
      GenericEditHandler.lastInsertedParameter = parameter;
    });
    let item = new Menu.ExpressionMenuItem(onRenderImplicitIntro(parameter), action);
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
    let action = new Menu.ImmediateExpressionMenuAction(() => {
      this.definition.type = new FmtHLM.MetaRefExpression_StandardTheorem;
      this.definition.contents = new FmtHLM.ObjectContents_StandardTheorem(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
    });
    let item = new Menu.ExpressionMenuItem(onRenderStandardIntro(), action);
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem;
    return item;
  }

  private getEquivalenceTheoremRow(onRenderEquivalenceIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let action = new Menu.ImmediateExpressionMenuAction(() => {
      this.definition.type = new FmtHLM.MetaRefExpression_EquivalenceTheorem;
      this.definition.contents = new FmtHLM.ObjectContents_EquivalenceTheorem([new Fmt.PlaceholderExpression(HLMExpressionType.Formula), new Fmt.PlaceholderExpression(HLMExpressionType.Formula)]);
    });
    let item = new Menu.ExpressionMenuItem(onRenderEquivalenceIntro(), action);
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem;
    return item;
  }

  private createEqualityDefinition(parameters: Fmt.ParameterList): FmtHLM.ObjectContents_ConstructorEqualityDefinition {
    let leftParameters = parameters.clone();
    let rightParameters = parameters.clone();
    this.addApostrophes(rightParameters);
    return new FmtHLM.ObjectContents_ConstructorEqualityDefinition(leftParameters, rightParameters, [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)]);
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
      HLMEditHandler.lastInsertedProof = proof;
    };
    return this.getImmediateInsertButton(onInsert);
  }

  getConditionalProofStepInsertButton(proof: FmtHLM.ObjectContents_Proof, onApply: () => void, onRenderTrivialProof: Logic.RenderFn, onRenderProofStep: RenderParameterFn, onRenderFormula: RenderExpressionFn): Notation.RenderedExpression {
    return this.createConditionalElement((checkResult: HLMCheckResult) => {
      let context = checkResult.incompleteProofs.get(proof.steps);
      if (context) {
        return this.getProofStepInsertButton(proof, context, onApply, onRenderProofStep, onRenderFormula);
      } else {
        return onRenderTrivialProof();
      }
    });
  }

  getProofStepInsertButton(proof: FmtHLM.ObjectContents_Proof, context: HLMCheckerProofStepContext, onApply: () => void, onRenderProofStep: RenderParameterFn, onRenderFormula: RenderExpressionFn): Notation.RenderedExpression {
    let autoOpen = (proof === HLMEditHandler.lastInsertedProof);
    return this.getMenuInsertButton(() => {
      let rows: Menu.ExpressionMenuRow[] = [];

      let previousStep = proof.steps.length ? proof.steps[proof.steps.length - 1] : undefined;

      let onInsertProofStep = (step: Fmt.Parameter) => {
        proof.steps.push(step);
        onApply();
        GenericEditHandler.lastInsertedParameter = step;
        HLMEditHandler.lastInsertedProof = undefined;
      };
      let onSetGoal = (goal: Fmt.Expression | undefined) => {
        proof.goal = goal;
        onApply();
      };

      let proveByCasesInfo: ProveByCasesInfo = {
        hasPreviousResultBasedCases: false,
        hasGoalBasedCases: false
      };
      let proveByCasesRow = this.getProveByCasesRow(proof, context, onInsertProofStep, onRenderProofStep, proveByCasesInfo);

      if (context.previousResult) {
        if (proveByCasesRow && proveByCasesInfo.hasPreviousResultBasedCases) {
          rows.push(proveByCasesRow);
          proveByCasesRow = undefined;
        }
        if (context.previousResult instanceof FmtHLM.MetaRefExpression_forall) {
          rows.push(this.getUseForAllRow(context.previousResult, context, onInsertProofStep, onRenderProofStep));
        }
        let useDefinitionRow = this.getUseDefinitionRow(context.previousResult, context, onInsertProofStep, onRenderProofStep);
        if (useDefinitionRow) {
          rows.push(useDefinitionRow);
        }
        rows.push(
          this.getUnfoldRow(context.previousResult, previousStep, context, onInsertProofStep, onRenderProofStep),
          this.getSubstituteRow(),
          new Menu.ExpressionMenuSeparator
        );
      }

      if (!(previousStep?.type instanceof FmtHLM.MetaRefExpression_Consider)) {
        if (context.goal) {
          let mustSplit = ((context.goal instanceof FmtHLM.MetaRefExpression_setEquals || context.goal instanceof FmtHLM.MetaRefExpression_equals) && context.goal.terms.length > 2);
          if (!mustSplit) {
            if (context.goal instanceof FmtHLM.MetaRefExpression_not) {
              rows.push(this.getProveByContradictionRow(context.goal, context, onInsertProofStep, onRenderProofStep));
            } else if (context.goal instanceof FmtHLM.MetaRefExpression_forall) {
              rows.push(this.getProveForAllRow(context.goal, context, onInsertProofStep, onRenderProofStep));
            } else if (context.goal instanceof FmtHLM.MetaRefExpression_exists) {
              rows.push(this.getProveExistsRow(context.goal, context, onInsertProofStep, onRenderProofStep));
            }
          }
          let splitRow = this.getSplitRow(context.goal, context, onInsertProofStep, onRenderProofStep);
          if (splitRow) {
            rows.push(splitRow);
          }
          if (mustSplit) {
            proveByCasesRow = undefined;
          } else {
            if (proveByCasesRow && proveByCasesInfo.hasGoalBasedCases) {
              rows.push(proveByCasesRow);
              proveByCasesRow = undefined;
            }
            let proveByDefinitionRow = this.getProveByDefinitionRow(context.goal, context, onInsertProofStep, onRenderProofStep);
            if (proveByDefinitionRow) {
              rows.push(proveByDefinitionRow);
            }
            rows.push(this.getUnfoldGoalRow(context.goal, context, onSetGoal, onRenderFormula));
            if (!(context.goal instanceof FmtHLM.MetaRefExpression_not
                  || context.goal instanceof FmtHLM.MetaRefExpression_forall
                  || this.utils.isFalseFormula(context.goal)
                  || this.utils.isTrueFormula(context.goal))) {
              rows.push(this.getProveByContradictionRow(context.goal, context, onInsertProofStep, onRenderProofStep));
            }
          }
          rows.push(new Menu.ExpressionMenuSeparator);
        }

        rows.push(
          this.getConsiderRow(proof, context, onInsertProofStep, onRenderProofStep),
          this.getStateFormulaRow(context, onInsertProofStep, onRenderProofStep)
        );
        if (proveByCasesRow) {
          rows.push(proveByCasesRow);
          proveByCasesRow = undefined;
        }
        rows.push(
          this.getProveBySubstitutionRow(),
          this.getDefineVariableRow(context, onInsertProofStep, onRenderProofStep),
          new Menu.ExpressionMenuSeparator
        );
      }

      rows.push(this.getUseTheoremRow());

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    }, true, autoOpen);
  }

  private getProveByCasesRow(proof: FmtHLM.ObjectContents_Proof, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn, proveByCasesInfo: ProveByCasesInfo): Menu.ExpressionMenuRow | undefined {
    let stepsPromises: CachedPromise<ProofStepInfo[]>[] = [];
    if (context.previousResult) {
      let useCasesStepsPromise = this.createUseCasesSteps(context.previousResult, context);
      if (useCasesStepsPromise) {
        proveByCasesInfo.hasPreviousResultBasedCases = true;
        stepsPromises.push(useCasesStepsPromise);
      }
    }
    if (context.goal && !(context.goal instanceof FmtHLM.MetaRefExpression_and)) {
      let proveCasesStepsPromise = this.createProveCasesSteps(context.goal, context);
      if (proveCasesStepsPromise) {
        proveByCasesInfo.hasGoalBasedCases = true;
        stepsPromises.push(proveCasesStepsPromise);
      }
    }
    stepsPromises.push(this.createProveByInductionSteps(proof, context));
    let stepsPromise = CachedPromise.all(stepsPromises).then((steps: ProofStepInfo[][]) => ([] as ProofStepInfo[]).concat(...steps));
    let proveByCasesRow = new Menu.StandardExpressionMenuRow('Prove by cases');
    proveByCasesRow.subMenu = this.getProofStepSubMenu(stepsPromise, context, onInsertProofStep, onRenderProofStep);
    return proveByCasesRow;
  }

  private createProveByInductionSteps(proof: FmtHLM.ObjectContents_Proof, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo[]> {
    let createAndCheckStructuralExpression = (variableRefExpression: Fmt.Expression) => {
      if (context.parentStructuralCases.some((structuralCaseRef: HLMCheckerStructuralCaseRef) => variableRefExpression.isEquivalentTo(structuralCaseRef.term))) {
        return CachedPromise.resolve(undefined);
      }
      let placeholder = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
      placeholder.specialRole = Fmt.SpecialPlaceholderRole.Preview;
      let structuralExpression = new FmtHLM.MetaRefExpression_ProveByInduction(variableRefExpression, placeholder, []);
      let step = this.utils.createParameter(structuralExpression, '_');
      return this.checker.checkSingleProofStep(step, context)
        .then((resultStep: Fmt.Parameter | undefined) => {
          placeholder.specialRole = undefined;
          return resultStep?.type;
        })
        .catch(() => undefined);
    };
    let createItem = (structuralExpression: FmtHLM.MetaRefExpression_ProveByInduction, variableRefExpression: Fmt.Expression): ProofStepInfo => {
      if (structuralExpression.cases.length > 1
          && variableRefExpression instanceof Fmt.VariableRefExpression
          && this.definition.parameters.indexOf(variableRefExpression.variable) >= 0
          && this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem
          && this.definition.contents.proofs
          && this.definition.contents.proofs.indexOf(proof) >= 0
          && context.goal
          && this.utils.containsSubExpression(context.goal, (subExpression: Fmt.Expression) => subExpression.isEquivalentTo(variableRefExpression))) {
        for (let structuralCase of structuralExpression.cases) {
          let subProof = FmtHLM.ObjectContents_Proof.createFromExpression(structuralCase.value);
          subProof.parameters = undefined;
          if (structuralCase.parameters) {
            for (let param of structuralCase.parameters) {
              if (param.type.isEquivalentTo(variableRefExpression.variable.type)) {
                let args = this.utils.getParameterArguments(this.definition.parameters);
                let paramRef = new Fmt.VariableRefExpression(param);
                args.setValue(variableRefExpression.variable.name, undefined, paramRef);
                let theorem = new Fmt.DefinitionRefExpression(new Fmt.Path(this.definition.name, args));
                let theoremResult = FmtUtils.substituteVariable(this.definition.contents.claim, variableRefExpression.variable, paramRef);
                subProof.steps.push(this.utils.createParameter(new FmtHLM.MetaRefExpression_UseTheorem(theorem, undefined, theoremResult), '_'));
              }
            }
          }
          structuralCase.value = subProof.toExpression(false);
        }
      }
      let step = this.utils.createParameter(structuralExpression, '_');
      return {
        step: step,
        linkedObject: structuralExpression.construction
      };
    };
    return this.getInductionItems(context.context, createAndCheckStructuralExpression, createItem);
  }

  private createUseCasesSteps(previousResult: Fmt.Expression, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo[]> | undefined {
    let casesPromise = this.utils.getAllFormulaCases(previousResult, false);
    if (casesPromise) {
      return casesPromise.then((cases: HLMFormulaCases[]) => {
        let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
        for (let caseList of cases) {
          resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) =>
            this.createUseCasesStep(caseList.cases, caseList.side, context).then((step: ProofStepInfo) =>
              currentSteps.concat(step)));
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private createUseCasesStep(cases: HLMFormulaCase[], side: number | undefined, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo> {
    let caseProofsPromise: CachedPromise<FmtHLM.ObjectContents_Proof[]> = CachedPromise.resolve([]);
    for (let formulaCase of cases) {
      let caseParameters = this.utils.getUseCasesProofParameters(formulaCase);
      caseProofsPromise = caseProofsPromise.then((currentCaseProofs: FmtHLM.ObjectContents_Proof[]) =>
        this.createSubProof(caseParameters, context.goal, false, context).then((caseProof: FmtHLM.ObjectContents_Proof) =>
          currentCaseProofs.concat(caseProof)));
    }
    return caseProofsPromise.then((caseProofs: FmtHLM.ObjectContents_Proof[]) => {
      let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseCases(this.utils.internalToExternalIndex(side), caseProofs), '_');
      return {step: step};
    });
  }

  private createProveCasesSteps(goal: Fmt.Expression, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo[]> | undefined {
    let casesPromise = this.utils.getAllFormulaCases(goal, true);
    if (casesPromise) {
      return casesPromise.then((cases: HLMFormulaCases[]) => {
        let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
        for (let caseList of cases) {
          resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) =>
            this.createProveCasesStep(caseList.cases, caseList.side, context).then((step: ProofStepInfo) =>
              currentSteps.concat(step)));
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private createProveCasesStep(cases: HLMFormulaCase[], side: number | undefined, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo> {
    let caseProofsPromise: CachedPromise<FmtHLM.ObjectContents_Proof[]> = CachedPromise.resolve([]);
    for (let formulaCase of cases) {
      caseProofsPromise = caseProofsPromise.then((currentCaseProofs: FmtHLM.ObjectContents_Proof[]) =>
        this.createSubProof(formulaCase.parameters, formulaCase.formula, false, context).then((caseProof: FmtHLM.ObjectContents_Proof) =>
          currentCaseProofs.concat(caseProof)));
    }
    return caseProofsPromise.then((caseProofs: FmtHLM.ObjectContents_Proof[]) => {
      let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveCases(this.utils.internalToExternalIndex(side), caseProofs), '_');
      return {step: step};
    });
  }

  private getUseForAllRow(previousResult: FmtHLM.MetaRefExpression_forall, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let useForAllRow = new Menu.StandardExpressionMenuRow('Specialize');
    let step = this.createUseForAllStep(previousResult, context);
    useForAllRow.subMenu = this.getProofStepMenuItem(step, context, onInsertProofStep, onRenderProofStep);
    return useForAllRow;
  }

  private createUseForAllStep(previousResult: FmtHLM.MetaRefExpression_forall, context: HLMCheckerProofStepContext): ProofStepInfo {
    let args = new Fmt.ArgumentList;
    this.utils.fillPlaceholderArguments(previousResult.parameters, args);
    let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseForAll(args), '_');
    return {step: step};
  }

  private getUseDefinitionRow(previousResult: Fmt.Expression, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow | undefined {
    let stepsPromise = this.createUseDefinitionSteps(previousResult, context);
    if (stepsPromise) {
      let useDefinitionRow = new Menu.StandardExpressionMenuRow('Use definition');
      useDefinitionRow.subMenu = this.getProofStepSubMenu(stepsPromise, context, onInsertProofStep, onRenderProofStep);
      return useDefinitionRow;
    } else {
      return undefined;
    }
  }

  private createUseDefinitionSteps(previousResult: Fmt.Expression, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo[]> | undefined {
    let definitionsPromise = this.utils.getAllFormulaDefinitions(previousResult);
    if (definitionsPromise) {
      return definitionsPromise.then((definitions: HLMFormulaDefinition[]) => {
        let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
        for (let definition of definitions) {
          resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) =>
            this.simplifyResult(definition.formula, context).then((simplifiedResult: Fmt.Expression) => {
              let declaredResult = context.goal?.isEquivalentTo(simplifiedResult) ? undefined : simplifiedResult;
              let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseDef(this.utils.internalToExternalIndex(definition.side), declaredResult), '_');
              return currentSteps.concat({
                step: step,
                linkedObject: definition.definitionRef
              });
            }));
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private getSubstituteRow(): Menu.ExpressionMenuRow {
    let substituteRow = new Menu.StandardExpressionMenuRow('Substitute');
    // TODO
    substituteRow.titleAction = this.getNotImplementedAction();
    return substituteRow;
  }

  private getUnfoldRow(previousResult: Fmt.Expression, previousStep: Fmt.Parameter | undefined, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    // TODO (low priority) check whether unfoldsTo returns false, and don't merge steps if it does
    let unfoldRow = new Menu.StandardExpressionMenuRow('Unfold');
    let unfoldedFormulasPromise = this.getUnfoldedFormulas(previousResult, previousResult);
    let rowsPromise = unfoldedFormulasPromise.then((unfoldedFormulas: Fmt.Expression[] | undefined) =>
      (unfoldedFormulas ? unfoldedFormulas.map((unfoldedFormula: Fmt.Expression) => this.getUnfoldMenuItem(unfoldedFormula, previousStep, context, onInsertProofStep, onRenderProofStep)) : []));
    unfoldRow.subMenu = new Menu.ExpressionMenu(rowsPromise);
    return unfoldRow;
  }

  private getUnfoldMenuItem(unfoldedFormula: Fmt.Expression, previousStep: Fmt.Parameter | undefined, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuItem {
    let clonedFormula = context.goal?.isEquivalentTo(unfoldedFormula) ? undefined : this.cloneAndAdaptParameterNames(unfoldedFormula);
    let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_Unfold(clonedFormula), '_');
    let action = new Menu.ImmediateExpressionMenuAction(() => {
      if (previousStep?.type instanceof FmtHLM.MetaRefExpression_Unfold) {
        previousStep.type.result = clonedFormula;
      } else {
        onInsertProofStep(step);
      }
    });
    let renderedFormula = onRenderProofStep(step);
    return new Menu.ExpressionMenuItem(renderedFormula, action);
  }

  private getProveByContradictionRow(goal: Fmt.Expression, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let proveByContradictionRow = new Menu.StandardExpressionMenuRow('Prove by contradiction');
    let stepsPromise: CachedPromise<ProofStepInfo[]> = this.createProveByContradictionStep(goal, undefined, undefined, context).then((step: ProofStepInfo) => [step]);
    if (goal instanceof FmtHLM.MetaRefExpression_or && goal.formulas) {
      for (let index = 0; index < goal.formulas.length; index++) {
        let [goalToNegate, newGoal] = this.utils.getProveByContradictionVariant(goal.formulas, index);
        stepsPromise = stepsPromise.then((currentSteps: ProofStepInfo[]) =>
          this.createProveByContradictionStep(goalToNegate, newGoal, index, context).then((step: ProofStepInfo) =>
            currentSteps.concat(step)));
      }
    }
    proveByContradictionRow.subMenu = this.getProofStepSubMenu(stepsPromise, context, onInsertProofStep, onRenderProofStep);
    return proveByContradictionRow;
  }

  private createProveByContradictionStep(goalToNegate: Fmt.Expression, newGoal: Fmt.Expression | undefined, index: number | undefined, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo> {
    return this.utils.negateFormula(goalToNegate, true).then((negatedGoal: Fmt.Expression) => {
      let parameters = new Fmt.ParameterList;
      this.utils.addProofConstraint(parameters, negatedGoal);
      return this.createSubProof(parameters, newGoal, false, context, undefined, index).then((subProof: FmtHLM.ObjectContents_Proof) => {
        let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveByContradiction(subProof), '_');
        return {step: step};
      });
    });
  }

  private getProveForAllRow(goal: FmtHLM.MetaRefExpression_forall, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let proveForAllRow = new Menu.StandardExpressionMenuRow('Prove universality');
    let stepPromise = this.createProveForAllStep(goal, context);
    proveForAllRow.subMenu = this.getProofStepPromiseMenuItem(stepPromise, context, onInsertProofStep, onRenderProofStep);
    return proveForAllRow;
  }

  private createProveForAllStep(goal: FmtHLM.MetaRefExpression_forall, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo> {
    return this.createSubProof(goal.parameters, goal.formula, true, context).then((subProof: FmtHLM.ObjectContents_Proof) => {
      let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveForAll(subProof), '_');
      return {step: step};
    });
  }

  private getProveExistsRow(goal: FmtHLM.MetaRefExpression_exists, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let proveExistsRow = new Menu.StandardExpressionMenuRow('Prove existence');
    let step = this.createProveExistsStep(goal, context);
    proveExistsRow.subMenu = this.getProofStepMenuItem(step, context, onInsertProofStep, onRenderProofStep);
    return proveExistsRow;
  }

  private createProveExistsStep(goal: FmtHLM.MetaRefExpression_exists, context: HLMCheckerProofStepContext): ProofStepInfo {
    let args = new Fmt.ArgumentList;
    this.utils.fillPlaceholderArguments(goal.parameters, args);
    let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveExists(args), '_');
    return {step: step};
  }

  private getSplitRow(goal: Fmt.Expression, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow | undefined {
    let stepsPromise: CachedPromise<ProofStepInfo[]> | undefined = undefined;
    if (goal instanceof FmtHLM.MetaRefExpression_and) {
      stepsPromise = this.utils.getFormulaCases(goal, undefined, true)
        ?.then((cases: HLMFormulaCase[]) => this.createProveCasesStep(cases, undefined, context))
        ?.then((step: ProofStepInfo) => [step]);
    } else {
      stepsPromise = this.createProveEquivalenceSteps(goal, context);
    }
    if (stepsPromise) {
      let splitRow = new Menu.StandardExpressionMenuRow('Split');
      splitRow.subMenu = this.getProofStepSubMenu(stepsPromise, context, onInsertProofStep, onRenderProofStep);
      return splitRow;
    } else {
      return undefined;
    }
  }

  private createProveEquivalenceSteps(goal: Fmt.Expression, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo[]> | undefined {
    let list = this.utils.getEquivalenceListInfo(goal);
    if (list) {
      let proofCount = list.wrapAround ? list.items.length : list.items.length - 1;
      if (proofCount > 1) {
        let firstStepPromise = this.createProveEquivalenceStep(list, proofCount, undefined, context);
        if (list.wrapAround) {
          return firstStepPromise.then((firstStep: ProofStepInfo) => [firstStep]);
        } else {
          return firstStepPromise.then((firstStep: ProofStepInfo) =>
            this.createProveEquivalenceStep(list!, proofCount, list!.items.length - 1, context).then((secondStep: ProofStepInfo) =>[
              firstStep,
              secondStep
            ]));
        }
      }
    }
    return undefined;
  }

  private createProveEquivalenceStep(list: HLMEquivalenceListInfo, proofCount: number, fixedToIndex: number | undefined, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo> {
    let subProofsPromise: CachedPromise<FmtHLM.ObjectContents_Proof[]> = CachedPromise.resolve([]);
    for (let fromIndex = 0; fromIndex < proofCount; fromIndex++) {
      let toIndex = fixedToIndex ?? fromIndex + 1;
      if (toIndex >= list.items.length) {
        toIndex = 0;
      }
      let from = list.items[fromIndex];
      let to = list.items[toIndex];
      let subParameters: Fmt.ParameterList | undefined = new Fmt.ParameterList;
      let subGoal: Fmt.Expression | undefined = list.getEquivalenceGoal(from, to, subParameters);
      if (!subParameters.length) {
        subParameters = undefined;
        subGoal = undefined;
      }
      subProofsPromise = subProofsPromise.then((currentSubProofs: FmtHLM.ObjectContents_Proof[]) =>
        this.createSubProof(subParameters, subGoal, false, context, fromIndex, toIndex).then((subProof: FmtHLM.ObjectContents_Proof) =>
          currentSubProofs.concat(subProof)));
    }
    return subProofsPromise.then((subProofs: FmtHLM.ObjectContents_Proof[]) => ({
      step: this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveEquivalence(subProofs), '_')
    }));
  }

  private getProveByDefinitionRow(goal: Fmt.Expression, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow | undefined {
    let stepsPromise = this.createProveByDefinitionSteps(goal, context);
    if (stepsPromise) {
      let proveByDefinitionRow = new Menu.StandardExpressionMenuRow('Prove by definition');
      proveByDefinitionRow.subMenu = this.getProofStepSubMenu(stepsPromise, context, onInsertProofStep, onRenderProofStep);
      return proveByDefinitionRow;
    } else {
      return undefined;
    }
  }

  private createProveByDefinitionSteps(goal: Fmt.Expression, context: HLMCheckerProofStepContext): CachedPromise<ProofStepInfo[]> | undefined {
    let definitionsPromise = this.utils.getAllFormulaDefinitions(goal);
    if (definitionsPromise) {
      return definitionsPromise.then((definitions: HLMFormulaDefinition[]) => {
        let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
        for (let definition of definitions) {
          resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) => {
            // Clone formula now and prevent cloning of the entire step.
            // This makes sure that (only in this editing session), the parameter list of the (optional) inner
            // ProveForAll step is tied to the outer parameter list, so variable name changes are propagated.
            let formula = definition.formula.clone();
            let subProofPromise = this.createSubProof(undefined, formula, false, context);
            if (formula instanceof FmtHLM.MetaRefExpression_forall) {
              subProofPromise = subProofPromise.then((subProof: FmtHLM.ObjectContents_Proof) => {
                if (subProof.goal instanceof FmtHLM.MetaRefExpression_forall && !subProof.steps.length) {
                  return this.createProveForAllStep(subProof.goal, context).then((proveForAllStep: ProofStepInfo) => {
                    subProof.steps.push(proveForAllStep.step);
                    return subProof;
                  });
                } else {
                  return subProof;
                }
              });
            }
            return subProofPromise.then((subProof: FmtHLM.ObjectContents_Proof) => {
              let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveDef(this.utils.internalToExternalIndex(definition.side), subProof), '_');
              return currentSteps.concat({
                step: step,
                linkedObject: definition.definitionRef,
                preventCloning: true
              });
            });
          });
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private createByDefinitionStep(goal: Fmt.Expression, context: HLMCheckerProofStepContext): CachedPromise<Fmt.Parameter | undefined> | undefined {
    let definitionsPromise = this.utils.getAllFormulaDefinitions(goal);
    if (definitionsPromise) {
      return definitionsPromise.then((definitions: HLMFormulaDefinition[]) => {
        let resultPromise: CachedPromise<Fmt.Parameter | undefined> = CachedPromise.resolve(undefined);
        for (let definition of definitions) {
          resultPromise = resultPromise.or(() =>
            this.checker.stripConstraintsFromFormulas([definition.formula], true, true, false, true, context).then((strippedGoals: Fmt.Expression[]) => {
              for (let strippedGoal of strippedGoals) {
                if (this.utils.isTrueFormula(strippedGoal)) {
                  return this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveDef(this.utils.internalToExternalIndex(definition.side)), '_');
                }
              }
              return undefined;
            }));
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private getUnfoldGoalRow(goal: Fmt.Expression, context: HLMCheckerProofStepContext, onSetGoal: SetExpressionFn, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let unfoldGoalRow = new Menu.StandardExpressionMenuRow('Unfold goal');
    let unfoldedFormulasPromise = this.getUnfoldedFormulas(goal, context.originalGoal!);
    let rowsPromise = unfoldedFormulasPromise.then((unfoldedFormulas: Fmt.Expression[] | undefined) =>
      (unfoldedFormulas ? unfoldedFormulas.map((unfoldedFormula: Fmt.Expression) => this.getUnfoldGoalMenuItem(unfoldedFormula, onSetGoal, onRenderFormula)) : []));
    unfoldGoalRow.subMenu = new Menu.ExpressionMenu(rowsPromise);
    return unfoldGoalRow;
  }

  private getUnfoldGoalMenuItem(unfoldedFormula: Fmt.Expression, onSetGoal: SetExpressionFn, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuItem {
    let action = new Menu.ImmediateExpressionMenuAction(() => onSetGoal(unfoldedFormula.clone()));
    let renderedFormula = onRenderFormula(unfoldedFormula);
    return new Menu.ExpressionMenuItem(renderedFormula, action);
  }

  private getUnfoldedFormulas(formula: Fmt.Expression, originalSource: Fmt.Expression): CachedPromise<Fmt.Expression[] | undefined> {
    // TODO display unfolded definition as tooltip
    return this.addUnfoldedFormulas([formula], originalSource);
  }

  private addUnfoldedFormulas(newFormulas: Fmt.Expression[], originalSource: Fmt.Expression, currentResultFormulas?: Fmt.Expression[]): CachedPromise<Fmt.Expression[] | undefined> {
    let resultPromise: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(currentResultFormulas);
    for (let formula of newFormulas) {
      resultPromise = resultPromise.then((currentResult: Fmt.Expression[] | undefined) =>
        this.utils.getNextFormulas(formula, unfoldAll).then((nextFormulas: Fmt.Expression[] | undefined) => {
          if (nextFormulas) {
            let nextResultPromise: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(currentResult);
            for (let nextFormula of nextFormulas) {
              nextResultPromise = nextResultPromise.then((currentNextResult: Fmt.Expression[] | undefined) =>
                this.utils.simplifyFormula(nextFormula).then((simplifiedFormula: Fmt.Expression) => {
                  if (currentNextResult?.some((item: Fmt.Expression) => simplifiedFormula.isEquivalentTo(item))) {
                    return currentNextResult;
                  } else {
                    let adaptedFormula = this.cloneAndAdaptParameterNames(simplifiedFormula);
                    return this.utils.unfoldsTo(originalSource, adaptedFormula).then((unfoldResult: boolean) => {
                      if (unfoldResult) {
                        // TODO if adaptedFormula is trivially provable (during "unfold goal") or proves the goal (during "unfold"), sort it to the front and don't unfold it further (see currentResultFormulas.length below)
                        return currentNextResult ? currentNextResult.concat(adaptedFormula) : [adaptedFormula];
                      } else {
                        // TODO fix cases where this happens
                        console.warn(`Omitting ${adaptedFormula} because unfoldsTo returned false`);
                        return currentNextResult;
                      }
                    });
                  }
                }));
            }
            return nextResultPromise;
          } else {
            return currentResult;
          }
        }));
    }
    return resultPromise.then((result: Fmt.Expression[] | undefined) => {
      if (result && (!currentResultFormulas || result.length > currentResultFormulas.length) && result.length < unfoldContinuationLimit) {
        let nextNewFormulas = currentResultFormulas ? result.slice(currentResultFormulas.length) : result;
        return this.addUnfoldedFormulas(nextNewFormulas, originalSource, result);
      } else {
        return result;
      }
    });
  }

  private getConsiderRow(proof: FmtHLM.ObjectContents_Proof, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let considerRow = new Menu.StandardExpressionMenuRow('Consider');
    let steps: ProofStepInfo[] = [];
    for (let constraint of this.checker.getAvailableConstraints(context, true)) {
      if (proof.steps.length && context.previousResult?.isEquivalentTo(constraint.constraint)) {
        continue;
      }
      if (constraint.parameter) {
        let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_Consider(new Fmt.VariableRefExpression(constraint.parameter), constraint.isImmediate ? undefined : constraint.constraint), '_');
        steps.unshift({
          step: step,
          linkedObject: this.utils.isValueParamType(constraint.parameter.type) ? constraint.parameter : constraint.constraint
        });
      } else {
        let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_State(constraint.constraint), '_');
        steps.unshift({
          step: step,
          linkedObject: constraint.constraint
        });
      }
    }
    let onInsertConstraintStep = (step: Fmt.Parameter) => {
      if (step.type instanceof FmtHLM.MetaRefExpression_Consider && step.type.variable instanceof Fmt.VariableRefExpression) {
        let variable = step.type.variable.variable;
        if (variable.name === '_') {
          variable.name = this.utils.getUnusedDefaultName('_1', this.getUsedParameterNames());
        }
      }
      onInsertProofStep(step);
    };
    considerRow.subMenu = this.getProofStepSubMenu(CachedPromise.resolve(steps), context, onInsertConstraintStep, onRenderProofStep);
    return considerRow;
  }

  private getStateFormulaRow(context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let stateFormulaRow = new Menu.StandardExpressionMenuRow('State formula');
    let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_State(new Fmt.PlaceholderExpression(HLMExpressionType.Formula)), '_');
    stateFormulaRow.subMenu = this.getProofStepMenuItem({step: step}, context, onInsertProofStep, onRenderProofStep);
    return stateFormulaRow;
  }

  private getProveBySubstitutionRow(): Menu.ExpressionMenuRow {
    let proveBySubstitutionRow = new Menu.StandardExpressionMenuRow('Substitute in goal');
    // TODO
    proveBySubstitutionRow.titleAction = this.getNotImplementedAction();
    return proveBySubstitutionRow;
  }

  private getDefineVariableRow(context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let defineVariableRow = new Menu.StandardExpressionMenuRow('Define variable');
    let elementDefinitionType = new FmtHLM.MetaRefExpression_Def(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
    let setDefinitionType = new FmtHLM.MetaRefExpression_SetDef(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
    let steps: ProofStepInfo[] = [
      {step: this.utils.createParameter(elementDefinitionType, 'x', this.getUsedParameterNames())},
      {step: this.utils.createParameter(setDefinitionType, 'S', this.getUsedParameterNames())}
    ];
    defineVariableRow.subMenu = this.getProofStepSubMenu(CachedPromise.resolve(steps), context, onInsertProofStep, onRenderProofStep);
    return defineVariableRow;
  }

  private getUseTheoremRow(): Menu.ExpressionMenuRow {
    let useTheoremRow = new Menu.StandardExpressionMenuRow('Use theorem');
    useTheoremRow.iconType = Logic.LogicDefinitionType.Theorem;
    // TODO
    useTheoremRow.titleAction = this.getNotImplementedAction();
    return useTheoremRow;
  }

  private simplifyGoal(goal: Fmt.Expression | undefined, context: HLMCheckerProofStepContext): CachedPromise<Fmt.Expression | undefined> {
    if (goal) {
      return this.utils.simplifyFormula(goal).then((simplifiedGoal: Fmt.Expression) =>
        this.checker.stripConstraintsFromFormulas([simplifiedGoal], true, true, false, false, context).then((strippedGoals: Fmt.Expression[]) =>
          (strippedGoals.length ? strippedGoals[0] : simplifiedGoal)));
    } else {
      return CachedPromise.resolve(undefined);
    }
  }

  private simplifyResult(result: Fmt.Expression, context: HLMCheckerProofStepContext): CachedPromise<Fmt.Expression> {
    return this.utils.simplifyFormula(result).then((simplifiedResult: Fmt.Expression) =>
      this.checker.stripConstraintsFromFormulas([simplifiedResult], true, false, true, false, context).then((strippedResults: Fmt.Expression[]) => {
        let strippedResult = strippedResults.length ? strippedResults[0] : simplifiedResult;
        // TODO if result is a conjunction and a single term closes the goal, use only that term
        return strippedResult;
      }));
  }

  private createSubProof(parameters: Fmt.ParameterList | undefined, goal: Fmt.Expression | undefined, mayOmitGoal: boolean, context: HLMCheckerProofStepContext, fromIndex?: number, toIndex?: number): CachedPromise<FmtHLM.ObjectContents_Proof> {
    let subContext = parameters ? this.checker.getParameterListContext(parameters, context) : context;
    return this.simplifyGoal(goal, subContext).then((simplifiedGoal: Fmt.Expression | undefined) => {
      let from = this.utils.internalToExternalIndex(fromIndex);
      let to = this.utils.internalToExternalIndex(toIndex);
      let finalGoal = simplifiedGoal;
      if (goal && mayOmitGoal && simplifiedGoal?.isEquivalentTo(goal)) {
        finalGoal = undefined;
      }
      let result = new FmtHLM.ObjectContents_Proof(from, to, parameters, finalGoal, new Fmt.ParameterList);
      if (simplifiedGoal) {
        let byDefinitionStepPromise = this.createByDefinitionStep(simplifiedGoal, subContext);
        if (byDefinitionStepPromise) {
          return byDefinitionStepPromise.then((byDefinitionStep: Fmt.Parameter | undefined) => {
            if (byDefinitionStep) {
              return this.checker.isTriviallyProvable(simplifiedGoal, subContext).then((triviallyProvable: boolean) => {
                if (!triviallyProvable) {
                  result.steps.push(byDefinitionStep);
                }
                return result;
              });
            }
            return result;
          });
        }
      }
      return result;
    });
  }

  private getNotImplementedAction(): Menu.ExpressionMenuAction {
    return new Menu.DialogExpressionMenuAction(() => {
      let infoItem = new Dialog.ExpressionDialogInfoItem;
      infoItem.info = new Notation.TextExpression('Not implemented yet');
      let dialog = new Dialog.ExpressionDialog;
      dialog.items = [infoItem];
      return dialog;
    });
  }

  private getProofStepSubMenu(stepsPromise: CachedPromise<ProofStepInfo[]>, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenu {
    let rowsPromise = stepsPromise.then((steps: ProofStepInfo[]) =>
      steps.map((step: ProofStepInfo) => this.getProofStepMenuItem(step, context, onInsertProofStep, onRenderProofStep)));
    return new Menu.ExpressionMenu(rowsPromise);
  }

  private getProofStepPromiseMenuItem(stepPromise: CachedPromise<ProofStepInfo>, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenu {
    let rowsPromise = stepPromise.then((step: ProofStepInfo) =>
      [this.getProofStepMenuItem(step, context, onInsertProofStep, onRenderProofStep)]);
    return new Menu.ExpressionMenu(rowsPromise);
  }

  private getProofStepMenuItem(step: ProofStepInfo, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuItem {
    let clonedStep = step.preventCloning ? step.step : this.cloneAndAdaptParameterNames(step.step);
    let action = new Menu.ImmediateExpressionMenuAction(() => this.insertProofStep(clonedStep, context, onInsertProofStep));
    let renderedStep = onRenderProofStep(clonedStep);
    if (step.linkedObject) {
      let semanticLink = new Notation.SemanticLink(step.linkedObject);
      if (renderedStep.semanticLinks) {
        renderedStep.semanticLinks.push(semanticLink);
      } else {
        renderedStep.semanticLinks = [semanticLink];
      }
    }
    return new Menu.ExpressionMenuItem(renderedStep, action);
  }

  private insertProofStep(step: Fmt.Parameter, context: HLMCheckerProofStepContext, onInsertProofStep: InsertParameterFn): void {
    onInsertProofStep(step);
    let result = this.utils.getProofStepResult(step, context);
    if (result instanceof FmtHLM.MetaRefExpression_exists) {
      let useExistsStep = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseExists(result.parameters), '_');
      context = {
        ...context,
        previousResult: result
      };
      this.insertProofStep(useExistsStep, context, onInsertProofStep);
    }
  }
}
