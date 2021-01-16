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
import { GenericEditHandler, RenderTypeFn, RenderParameterFn, InsertParameterFn, RenderExpressionFn, InsertExpressionFn, SetExpressionFn, RenderExpressionsFn, RenderArgumentsFn, GetExpressionsFn } from '../generic/editHandler';
import { LibraryDataProvider, LibraryItemInfo, LibraryDefinition } from '../../data/libraryDataProvider';
import { MRUList } from '../../data/mostRecentlyUsedList';
import { HLMExpressionType } from './hlm';
import { HLMEditAnalysis } from './edit';
import { HLMUtils, HLMFormulaDefinition, HLMFormulaCase, HLMFormulaCases, unfoldAll, HLMSubstitutionContext, HLMEquivalenceListInfo, HLMSubstitutionResult, HLMProofStepContext } from './utils';
import { HLMRenderUtils } from './renderUtils';
import { HLMChecker, HLMCheckResult, HLMRecheckResult, HLMRechecker, HLMRecheckerInstance, HLMCheckerConstraint, HLMCheckerContextUtils, HLMProofStepChecker } from './checker';
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

interface ProofStepMenuItemInfo {
  hasPreviousResultBasedCases: boolean;
  hasGoalBasedCases: boolean;
}

// TODO if checker specifies an exact value for a given placeholder, display only that value when opening its menu

export class HLMEditHandler extends GenericEditHandler {
  private static readonly checkerOptions: Logic.LogicCheckerOptions = {
    supportPlaceholders: true,
    supportRechecking: true,
    warnAboutMissingProofs: false
  };
  private static readonly recheckOptions: Logic.LogicCheckerOptions = {
    supportPlaceholders: true,
    supportRechecking: false,
    warnAboutMissingProofs: false
  };

  private static readonly unfoldContinuationLimit = 8;

  private checkFn: () => CachedPromise<HLMCheckResult>;
  private checkResultPromise?: CachedPromise<HLMCheckResult>;

  static lastInsertedProof?: FmtHLM.ObjectContents_Proof;

  constructor(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, protected utils: HLMUtils, private renderUtils: HLMRenderUtils, templates: Fmt.File, mruList: MRUList, analyzeFn?: (editAnalysis: HLMEditAnalysis) => void, checkFn?: () => CachedPromise<HLMCheckResult>) {
    super(definition, libraryDataProvider, HLMEditHandler.getCreateEditAnalysisFn(definition, libraryDataProvider, analyzeFn), utils, templates, mruList);
    this.checkFn = checkFn ?? (() => HLMChecker.checkDefinitionWithUtils(definition, utils, HLMEditHandler.checkerOptions));
    this.update();
  }

  private static getCreateEditAnalysisFn(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, analyzeFn?: (editAnalysis: HLMEditAnalysis) => void): () => Edit.EditAnalysis {
    return () => {
      let editAnalysis = new HLMEditAnalysis;
      if (analyzeFn) {
        analyzeFn(editAnalysis);
      } else {
        editAnalysis.analyzeDefinition(definition, libraryDataProvider.logic.getRootContext());
      }
      return editAnalysis;
    };
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
      this.checkResultPromise = this.checkFn();
      return this.checkResultPromise
        .then((checkResult: HLMCheckResult): void | CachedPromise<void> => {
          if (checkResult.autoFiller && onAutoFilled) {
            let onFillExpression = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => {
              let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(originalExpression);
              if (expressionEditInfo) {
                this.adaptNewParameterLists(newParameterLists, filledExpression);
                expressionEditInfo.onSetValue(filledExpression);
                autoFilled = true;
              }
            };
            return checkResult.autoFiller.autoFill(onFillExpression).then(() => {
              if (autoFilled) {
                onAutoFilled();
              }
            });
          }
        })
        .catch(() => {});
    });
  }

  private getRechecker(): CachedPromise<HLMRechecker> {
    return this.checkResultPromise!.then((checkResult: HLMCheckResult) => checkResult.rechecker!);
  }

  private getSubstitutionChecker(expressionEditInfo: Edit.ExpressionEditInfo): CachedPromise<HLMRecheckerInstance<Fmt.Expression>> {
    return this.getRechecker().then((rechecker: HLMRechecker) => rechecker.getSubstitutionChecker(expressionEditInfo.expression!, HLMEditHandler.recheckOptions));
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
      if (contents instanceof FmtHLM.ObjectContents_Theorem) {
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
      let substitutionCheckerPromise = this.getSubstitutionChecker(expressionEditInfo);

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
            return this.getVariableRefExpressions(variableInfo, substitutionCheckerPromise);
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
        rows.push(this.getSetCasesRow(expressionEditInfo, onRenderTerm, substitutionCheckerPromise));
      }

      rows.push(new Menu.ExpressionMenuSeparator);

      {
        let onGetExpressions = (getPath: () => Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
          let type = definition.type;
          if (type instanceof FmtHLM.MetaRefExpression_SetOperator || type instanceof FmtHLM.MetaRefExpression_Construction) {
            return this.getDefinitionRefExpressions(expressionEditInfo, getPath(), outerDefinition, definition, HLMExpressionType.SetTerm, substitutionCheckerPromise);
          } else {
            return undefined;
          }
        };
        rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.SetOperator, Logic.LogicDefinitionType.Construction], onGetExpressions, onRenderTerm));
      }

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  addElementTermMenu(semanticLink: Notation.SemanticLink, term: Fmt.Expression, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(term);
    if (expressionEditInfo) {
      this.addElementTermMenuWithEditInfo(semanticLink, expressionEditInfo, onRenderTerm, termSelection);
    }
  }

  private addElementTermMenuWithEditInfo(semanticLink: Notation.SemanticLink, expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    semanticLink.onMenuOpened = () => {
      let substitutionCheckerPromise = this.getSubstitutionChecker(expressionEditInfo);

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
            return this.getVariableRefExpressions(variableInfo, substitutionCheckerPromise);
          }
          return CachedPromise.resolve([]);
        };
        rows.push(this.getVariableRow(expressionEditInfo, onGetExpressions, onRenderTerm));
      }

      if (termSelection.allowCases) {
        rows.push(this.getElementCasesRow(expressionEditInfo, onRenderTerm, substitutionCheckerPromise));
      }

      rows.push(new Menu.ExpressionMenuSeparator);

      {
        let onGetExpressions = (getPath: () => Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, fromMRUList: boolean) => {
          let type = definition.type;
          if (type instanceof FmtHLM.MetaRefExpression_ExplicitOperator
              || type instanceof FmtHLM.MetaRefExpression_ImplicitOperator
              || type instanceof FmtHLM.MetaRefExpression_MacroOperator
              || (termSelection.allowConstructors && type instanceof FmtHLM.MetaRefExpression_Constructor && !(fromMRUList && definition.contents instanceof FmtHLM.ObjectContents_Constructor && definition.contents.rewrite))) {
            return this.getDefinitionRefExpressions(expressionEditInfo, getPath(), outerDefinition, definition, HLMExpressionType.ElementTerm, substitutionCheckerPromise);
          } else {
            return undefined;
          }
        };
        rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Operator, Logic.LogicDefinitionType.Constructor], onGetExpressions, onRenderTerm));
      }

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
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
              .then(HLMEditHandler.addNegations);
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
        let substitutionCheckerPromise = this.getSubstitutionChecker(expressionEditInfo);
        rows.push(this.getFormulaCasesRow(expressionEditInfo, onRenderFormula, substitutionCheckerPromise));
      }

      rows.push(new Menu.ExpressionMenuSeparator);

      {
        let onGetExpressions = (getPath: () => Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
          let type = definition.type;
          if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
            return this.getDefinitionRefExpressions(expressionEditInfo, getPath(), outerDefinition, definition, HLMExpressionType.Formula)
              .then(HLMEditHandler.addNegations);
          } else {
            return undefined;
          }
        };
        rows.push(this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Predicate], onGetExpressions, onRenderFormula));
      }

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  private static addNegations(expressions: Fmt.Expression[]): Fmt.Expression[] {
    let negatedExpressions = expressions.map((expression: Fmt.Expression) =>
      new FmtHLM.MetaRefExpression_not(expression));
    return expressions.concat(negatedExpressions);
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

  private getSetCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, substitutionCheckerPromise: CachedPromise<HLMRecheckerInstance<Fmt.Expression>>): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) =>
      new FmtHLM.MetaRefExpression_setStructuralCases(term, construction, cases);

    let casesRow = new Menu.StandardExpressionMenuRow('Cases');
    casesRow.subMenu = new Menu.ExpressionMenu(this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderTerm, substitutionCheckerPromise));
    return casesRow;
  }

  private getElementCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, substitutionCheckerPromise: CachedPromise<HLMRecheckerInstance<Fmt.Expression>>): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) =>
      new FmtHLM.MetaRefExpression_structuralCases(term, construction, cases);

    let menuItems = this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderTerm, substitutionCheckerPromise)
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

  private getFormulaCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, substitutionCheckerPromise: CachedPromise<HLMRecheckerInstance<Fmt.Expression>>): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) =>
      new FmtHLM.MetaRefExpression_structural(term, construction, cases);

    let casesRow = new Menu.StandardExpressionMenuRow('Cases');
    casesRow.subMenu = new Menu.ExpressionMenu(this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderFormula, substitutionCheckerPromise));
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

  private getVariableRefExpressions(variableInfo: Ctx.VariableInfo, substitutionCheckerPromise?: CachedPromise<HLMRecheckerInstance<Fmt.Expression>>): CachedPromise<Fmt.Expression[]> {
    let expression: Fmt.Expression = new Fmt.VariableRefExpression(variableInfo.parameter);
    if (variableInfo.indexParameterLists) {
      for (let indexParameterList of variableInfo.indexParameterLists) {
        let index: Fmt.Index = {
          parameters: indexParameterList,
          arguments: this.utils.getPlaceholderArguments(indexParameterList)
        };
        expression = new Fmt.IndexedExpression(expression, index);
      }
    }
    if (substitutionCheckerPromise) {
      return substitutionCheckerPromise
        .then((substitutionChecker: HLMRecheckerInstance<Fmt.Expression>) => substitutionChecker.recheck(expression))
        .then((recheckResult: HLMRecheckResult<Fmt.Expression>) => (recheckResult.value ? [recheckResult.value] : []))
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

  private getDefinitionRefExpressions(expressionEditInfo: Edit.ExpressionEditInfo, path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, expressionType: HLMExpressionType, substitutionCheckerPromise?: CachedPromise<HLMRecheckerInstance<Fmt.Expression>>): CachedPromise<Fmt.Expression[]> {
    let checkResultPath = (prevResultPromise: CachedPromise<Fmt.Expression | undefined> | undefined, resultPath: Fmt.Path) => {
      if (!prevResultPromise) {
        prevResultPromise = CachedPromise.resolve(undefined);
      }
      return prevResultPromise.then((prevResult: Fmt.Expression | undefined) => {
        if (prevResult) {
          return prevResult;
        }
        let expression = new Fmt.DefinitionRefExpression(resultPath);
        if (substitutionCheckerPromise) {
          return substitutionCheckerPromise
            .then((substitutionChecker: HLMRecheckerInstance<Fmt.Expression>) => substitutionChecker.recheck(expression))
            .then((recheckResult: HLMRecheckResult<Fmt.Expression>) => (recheckResult.value ? this.cloneAndAdaptParameterNames(recheckResult.value) : undefined))
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
        let args = this.utils.getPlaceholderArguments(definition.parameters, substitutionContext);
        if (notationAlternative) {
          this.utils.reorderArguments(args, notationAlternative);
        }
        let resultPath = new Fmt.Path(path.name, args, parentPath);
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

  private getStructuralCaseItems(createStructuralExpression: (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) => Fmt.Expression, expressionEditInfo: Edit.ExpressionEditInfo, onRenderExpression: RenderExpressionFn, substitutionCheckerPromise: CachedPromise<HLMRecheckerInstance<Fmt.Expression>>): CachedPromise<Menu.ExpressionMenuItem[]> {
    let createAndCheckStructuralExpression = (variableRefExpression: Fmt.Expression) => {
      let placeholder = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
      placeholder.specialRole = Fmt.SpecialPlaceholderRole.Preview;
      return substitutionCheckerPromise
        .then((substitutionChecker: HLMRecheckerInstance<Fmt.Expression>) => substitutionChecker.recheck(createStructuralExpression(variableRefExpression, placeholder, [])))
        .then((recheckResult: HLMRecheckResult<Fmt.Expression>) => {
          placeholder.specialRole = undefined;
          if (recheckResult.value) {
            return this.cloneAndAdaptParameterNames(recheckResult.value);
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
      let definitionType: Logic.LogicDefinitionTypeDescription = {
        definitionType: Logic.LogicDefinitionType.Constructor,
        name: 'Constructor',
        createTypeExpression: () => new FmtHLM.MetaRefExpression_Constructor,
        createObjectContents: () => new FmtHLM.ObjectContents_Constructor
      };
      let onCheckNameInUse = (name: string) => definitions.some((definition: Fmt.Definition) => (definition.name === name));
      let onOK = (result: Dialog.InsertDialogResult) => definitions.push(Logic.createDefinition(definitionType, result.name));
      return new Dialog.InsertDialog(this.libraryDataProvider, definitionType, onCheckNameInUse, undefined, onOK);
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
    const expressionEditInfo = this.editAnalysis.expressionEditInfo.get(macroInvocation.expression);
    if (arrayArgumentOperations && expressionEditInfo) {
      const substitutedExpression = arrayArgumentOperations.insertItem();
      if (substitutedExpression) {
        let onInsertItem = () => expressionEditInfo.onSetValue(substitutedExpression);
        let enabledPromise = this.getSubstitutionChecker(expressionEditInfo)
          .then((substitutionChecker: HLMRecheckerInstance<Fmt.Expression>) => substitutionChecker.recheck(substitutedExpression))
          .then((recheckResult: HLMRecheckResult<Fmt.Expression>) => !recheckResult.hasErrors);
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
      let constraintCheckerPromise = this.getRechecker().then((rechecker: HLMRechecker) => rechecker.getConstraintChecker(parameterList, HLMEditHandler.recheckOptions));
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
          return constraintCheckerPromise
            .then((constraintChecker: HLMRecheckerInstance<Fmt.Expression>) => constraintChecker.recheck(expression))
            .then((recheckResult: HLMRecheckResult<Fmt.Expression>) => recheckResult.value);
        });
      };
      let onGetExpressions = (getPath: () => Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
        let type = definition.type;
        if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
          return this.getValidDefinitionRefExpressions(getPath(), outerDefinition, definition, context!, checkResultPath, firstObjectExpression, objectExpressionType, true)
            .then(HLMEditHandler.addNegations);
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

  getConditionalProofStepInsertButton(proof: FmtHLM.ObjectContents_Proof, onApply: () => void, onRenderTrivialProof: Logic.RenderFn, onRenderProofStep: RenderParameterFn, onRenderFormula: RenderExpressionFn, onRenderArgumentList: RenderArgumentsFn<HLMEditHandler>): Notation.RenderedExpression {
    return this.createConditionalElement((checkResult: HLMCheckResult) => {
      let checker = checkResult.rechecker?.getProofStepChecker(proof, HLMEditHandler.checkerOptions);
      if (checker) {
        return this.getProofStepInsertButton(proof, checker, onApply, onRenderProofStep, onRenderFormula, onRenderArgumentList);
      } else {
        return onRenderTrivialProof();
      }
    });
  }

  getProofStepInsertButton(proof: FmtHLM.ObjectContents_Proof, checker: HLMProofStepChecker, onApply: () => void, onRenderProofStep: RenderParameterFn, onRenderFormula: RenderExpressionFn, onRenderArgumentList: RenderArgumentsFn<HLMEditHandler>): Notation.RenderedExpression {
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

      let proveByCasesInfo: ProofStepMenuItemInfo = {
        hasPreviousResultBasedCases: false,
        hasGoalBasedCases: false
      };
      let proveByCasesRow = this.getProveByCasesRow(proof, checker, onInsertProofStep, onRenderProofStep, proveByCasesInfo);

      let useDefinitionInfo: ProofStepMenuItemInfo = {
        hasPreviousResultBasedCases: false,
        hasGoalBasedCases: false
      };
      let useDefinitionRow = this.getUseDefinitionRow(checker, onInsertProofStep, onRenderProofStep, useDefinitionInfo);

      const previousResult = checker.context.previousResult;
      if (previousResult) {
        if (proveByCasesRow && proveByCasesInfo.hasPreviousResultBasedCases) {
          rows.push(proveByCasesRow);
          proveByCasesRow = undefined;
        }
        if (previousResult instanceof FmtHLM.MetaRefExpression_forall) {
          rows.push(this.getUseForAllRow(previousResult, checker, onInsertProofStep, onRenderProofStep));
        }
        if (useDefinitionRow && useDefinitionInfo.hasPreviousResultBasedCases) {
          rows.push(useDefinitionRow);
          useDefinitionRow = undefined;
        }
        rows.push(
          this.getUnfoldRow(previousResult, previousStep, checker, onInsertProofStep, onRenderProofStep),
          this.getSubstituteRow(previousResult, checker, onInsertProofStep, onRenderProofStep),
          new Menu.ExpressionMenuSeparator
        );
      }

      if (!(previousStep?.type instanceof FmtHLM.MetaRefExpression_Consider)) {
        const goal = checker.context.goal;
        if (goal) {
          let mustSplit = ((goal instanceof FmtHLM.MetaRefExpression_setEquals || goal instanceof FmtHLM.MetaRefExpression_equals) && goal.terms.length > 2);
          if (!mustSplit) {
            if (goal instanceof FmtHLM.MetaRefExpression_not) {
              rows.push(this.getProveByContradictionRow(goal, checker, onInsertProofStep, onRenderProofStep));
            } else if (goal instanceof FmtHLM.MetaRefExpression_forall) {
              rows.push(this.getProveForAllRow(goal, checker, onInsertProofStep, onRenderProofStep));
            } else if (goal instanceof FmtHLM.MetaRefExpression_exists) {
              rows.push(this.getProveExistsRow(goal, checker, onInsertProofStep, onRenderProofStep));
            }
          }
          let splitRow = this.getSplitRow(goal, checker, onInsertProofStep, onRenderProofStep);
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
            let proveByDefinitionRow = this.getProveByDefinitionRow(goal, checker, onInsertProofStep, onRenderProofStep);
            if (proveByDefinitionRow) {
              rows.push(proveByDefinitionRow);
            }
            rows.push(this.getUnfoldGoalRow(goal, checker, onSetGoal, onRenderFormula));
            if (!(goal instanceof FmtHLM.MetaRefExpression_not
                  || goal instanceof FmtHLM.MetaRefExpression_forall
                  || this.utils.isFalseFormula(goal)
                  || this.utils.isTrueFormula(goal))) {
              rows.push(this.getProveByContradictionRow(goal, checker, onInsertProofStep, onRenderProofStep));
            }
          }
          rows.push(
            this.getProveBySubstitutionRow(goal, checker, onInsertProofStep, onRenderProofStep),
            new Menu.ExpressionMenuSeparator
          );
        }

        rows.push(
          this.getConsiderRow(proof, checker, onInsertProofStep, onRenderProofStep),
          this.getStateFormulaRow(checker, onInsertProofStep, onRenderProofStep)
        );
        if (proveByCasesRow) {
          rows.push(proveByCasesRow);
        }
        if (useDefinitionRow) {
          rows.push(useDefinitionRow);
        }
        rows.push(
          this.getDefineVariableRow(checker, onInsertProofStep, onRenderProofStep),
          new Menu.ExpressionMenuSeparator
        );
      }

      rows.push(this.getUseTheoremRow(checker, onInsertProofStep, onRenderFormula, onRenderArgumentList));

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    }, true, autoOpen);
  }

  private getProveByCasesRow(proof: FmtHLM.ObjectContents_Proof, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn, proveByCasesInfo: ProofStepMenuItemInfo): Menu.ExpressionMenuRow | undefined {
    // TODO merge induction-based cases with proof by induction where appropriate
    let stepsPromises: CachedPromise<ProofStepInfo[]>[] = [];
    if (checker.context.previousResult) {
      let useCasesStepsPromise = this.createUseCasesSteps(checker.context.previousResult, checker);
      if (useCasesStepsPromise) {
        proveByCasesInfo.hasPreviousResultBasedCases = true;
        stepsPromises.push(useCasesStepsPromise);
      }
    }
    if (checker.context.goal && !(checker.context.goal instanceof FmtHLM.MetaRefExpression_and)) {
      let proveCasesStepsPromise = this.createProveCasesSteps(checker.context.goal, checker);
      if (proveCasesStepsPromise) {
        proveByCasesInfo.hasGoalBasedCases = true;
        stepsPromises.push(proveCasesStepsPromise);
      }
    }
    stepsPromises.push(this.createProveByInductionSteps(proof, checker));
    let stepsPromise = CachedPromise.all(stepsPromises).then((steps: ProofStepInfo[][]) => ([] as ProofStepInfo[]).concat(...steps));
    let proveByCasesRow = new Menu.StandardExpressionMenuRow('Prove by cases');
    proveByCasesRow.subMenu = this.getProofStepSubMenu(stepsPromise, checker.context, onInsertProofStep, onRenderProofStep);
    return proveByCasesRow;
  }

  private createProveByInductionSteps(proof: FmtHLM.ObjectContents_Proof, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo[]> {
    let createAndCheckStructuralExpression = (variableRefExpression: Fmt.Expression) => {
      if (checker.contextUtils.containsStructuralCaseFor(variableRefExpression)) {
        return CachedPromise.resolve(undefined);
      }
      let placeholder = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
      placeholder.specialRole = Fmt.SpecialPlaceholderRole.Preview;
      let structuralExpression = new FmtHLM.MetaRefExpression_ProveByInduction(variableRefExpression, placeholder, []);
      let step = this.utils.createParameter(structuralExpression, '_');
      return checker.recheck(step).then((checkResult: HLMRecheckResult<Fmt.Parameter>) => {
        placeholder.specialRole = undefined;
        return checkResult.value?.type;
      });
    };
    let createItem = (structuralExpression: FmtHLM.MetaRefExpression_ProveByInduction, variableRefExpression: Fmt.Expression): ProofStepInfo => {
      if (structuralExpression.cases.length > 1
          && variableRefExpression instanceof Fmt.VariableRefExpression
          && this.definition.parameters.indexOf(variableRefExpression.variable) >= 0
          && this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem
          && this.definition.contents.proofs
          // TODO allow nested induction
          && this.definition.contents.proofs.indexOf(proof) >= 0
          && checker.context.goal
          && FmtUtils.containsSubExpression(checker.context.goal, (subExpression: Fmt.Expression) => subExpression.isEquivalentTo(variableRefExpression))) {
        for (let structuralCase of structuralExpression.cases) {
          let subProof = FmtHLM.ObjectContents_Proof.createFromExpression(structuralCase.value);
          if (!this.utils.referencesParameter(this.definition.parameters, variableRefExpression.variable)) {
            subProof.parameters = undefined;
          }
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
    return this.getInductionItems(checker.context.context, createAndCheckStructuralExpression, createItem);
  }

  private createUseCasesSteps(previousResult: Fmt.Expression, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo[]> | undefined {
    let casesPromise = this.utils.getAllFormulaCases(previousResult, false);
    if (casesPromise) {
      return casesPromise.then((cases: HLMFormulaCases[]) => {
        let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
        for (let caseList of cases) {
          resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) =>
            this.createUseCasesStep(caseList.cases, caseList.side, checker).then((step: ProofStepInfo) =>
              currentSteps.concat(step)));
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private createUseCasesStep(cases: HLMFormulaCase[], side: number | undefined, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo> {
    let caseProofsPromise: CachedPromise<FmtHLM.ObjectContents_Proof[]> = CachedPromise.resolve([]);
    for (let formulaCase of cases) {
      let caseParameters = this.utils.getUseCasesProofParameters(formulaCase);
      caseProofsPromise = caseProofsPromise.then((currentCaseProofs: FmtHLM.ObjectContents_Proof[]) =>
        this.createSubProof(caseParameters, checker.context.goal, false, checker.contextUtils).then((caseProof: FmtHLM.ObjectContents_Proof) =>
          currentCaseProofs.concat(caseProof)));
    }
    return caseProofsPromise.then((caseProofs: FmtHLM.ObjectContents_Proof[]) => {
      let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseCases(this.utils.internalToExternalIndex(side), caseProofs), '_');
      return {step: step};
    });
  }

  private createProveCasesSteps(goal: Fmt.Expression, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo[]> | undefined {
    let casesPromise = this.utils.getAllFormulaCases(goal, true);
    if (casesPromise) {
      return casesPromise.then((cases: HLMFormulaCases[]) => {
        let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
        for (let caseList of cases) {
          resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) =>
            this.createProveCasesStep(caseList.cases, caseList.side, checker).then((step: ProofStepInfo) =>
              currentSteps.concat(step)));
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private createProveCasesStep(cases: HLMFormulaCase[], side: number | undefined, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo> {
    let caseProofsPromise: CachedPromise<FmtHLM.ObjectContents_Proof[]> = CachedPromise.resolve([]);
    for (let formulaCase of cases) {
      caseProofsPromise = caseProofsPromise.then((currentCaseProofs: FmtHLM.ObjectContents_Proof[]) =>
        this.createSubProof(formulaCase.parameters, formulaCase.formula, false, checker.contextUtils).then((caseProof: FmtHLM.ObjectContents_Proof) =>
          currentCaseProofs.concat(caseProof)));
    }
    return caseProofsPromise.then((caseProofs: FmtHLM.ObjectContents_Proof[]) => {
      let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveCases(this.utils.internalToExternalIndex(side), caseProofs), '_');
      return {step: step};
    });
  }

  private getUseForAllRow(previousResult: FmtHLM.MetaRefExpression_forall, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let useForAllRow = new Menu.StandardExpressionMenuRow('Specialize');
    let step = this.createUseForAllStep(previousResult);
    useForAllRow.subMenu = this.getProofStepMenuItem(step, checker.context, onInsertProofStep, onRenderProofStep);
    return useForAllRow;
  }

  private createUseForAllStep(previousResult: FmtHLM.MetaRefExpression_forall): ProofStepInfo {
    let args = this.utils.getPlaceholderArguments(previousResult.parameters);
    let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseForAll(args), '_');
    return {step: step};
  }

  private getUseDefinitionRow(checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn, useDefinitionInfo: ProofStepMenuItemInfo): Menu.ExpressionMenuRow | undefined {
    let stepsPromises: CachedPromise<ProofStepInfo[]>[] = [];
    if (checker.context.previousResult) {
      let stepsPromise = this.createUseDefinitionSteps(checker.context.previousResult, checker);
      if (stepsPromise) {
        stepsPromises.push(stepsPromise);
        useDefinitionInfo.hasPreviousResultBasedCases = true;
      }
    }
    let implicitOperatorSource = checker.context.previousResult ?? checker.context.goal;
    if (implicitOperatorSource) {
      stepsPromises.push(this.createUseImplicitOperatorSteps(implicitOperatorSource, checker));
    }
    if (stepsPromises.length) {
      let stepsPromise = CachedPromise.all(stepsPromises).then((steps: ProofStepInfo[][]) => ([] as ProofStepInfo[]).concat(...steps));
      let useDefinitionRow = new Menu.StandardExpressionMenuRow('Use definition');
      useDefinitionRow.subMenu = this.getProofStepSubMenu(stepsPromise, checker.context, onInsertProofStep, onRenderProofStep);
      return useDefinitionRow;
    } else {
      return undefined;
    }
  }

  private createUseDefinitionSteps(previousResult: Fmt.Expression, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo[]> | undefined {
    let definitionsPromise = this.utils.getAllFormulaDefinitions(previousResult);
    if (definitionsPromise) {
      return definitionsPromise.then((definitions: HLMFormulaDefinition[]) => {
        let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
        for (let definition of definitions) {
          resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) =>
            this.simplifyResult(definition.formula, checker.contextUtils).then((simplifiedResult: Fmt.Expression) => {
              let declaredResult = checker.context.goal?.isEquivalentTo(simplifiedResult) ? undefined : simplifiedResult;
              if (declaredResult && this.utils.isTrivialTautology(declaredResult, false).getImmediateResult()) {
                return currentSteps;
              } else {
                let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseDef(this.utils.internalToExternalIndex(definition.side), declaredResult), '_');
                return currentSteps.concat({
                  step: step,
                  linkedObject: definition.definitionRef
                });
              }
            }));
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private createUseImplicitOperatorSteps(source: Fmt.Expression, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo[]> {
    let referencedDefinitions: Fmt.DefinitionRefExpression[] = [];
    source.traverse((subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.DefinitionRefExpression
          && !(subExpression.path.parentPath instanceof Fmt.Path)
          && !referencedDefinitions.some((existing: Fmt.DefinitionRefExpression) => subExpression.isEquivalentTo(existing))) {
        referencedDefinitions.push(subExpression);
      }
    });
    let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
    for (let referencedDefinition of referencedDefinitions) {
      resultPromise = resultPromise.then((currentSteps: ProofStepInfo[]) =>
        this.utils.getDefinition(referencedDefinition.path).then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
            let innerResultPromise = CachedPromise.resolve(currentSteps);
            for (let result of this.utils.getImplicitOperatorDefinitionResults(referencedDefinition, definition, definition.contents)) {
              innerResultPromise = innerResultPromise.then((currentInnerSteps: ProofStepInfo[]) =>
                this.simplifyResult(result, checker.contextUtils).then((simplifiedResult: Fmt.Expression) => {
                  let declaredResult = checker.context.goal?.isEquivalentTo(simplifiedResult) ? undefined : simplifiedResult;
                  let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseImplicitOperator(referencedDefinition, declaredResult), '_');
                  return currentInnerSteps.concat({
                    step: step,
                    linkedObject: referencedDefinition
                  });
                }));
            }
            return innerResultPromise;
          } else {
            return currentSteps;
          }
        }));
    }
    return resultPromise;
  }

  private getSubstituteRow(previousResult: Fmt.Expression, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let substituteRow = new Menu.StandardExpressionMenuRow('Substitute');
    let onCreateProofStep = (source: Fmt.Expression, substitution: HLMSubstitutionResult) => {
      if (this.utils.isTrivialTautology(substitution.result, false).getImmediateResult()) {
        return undefined;
      } else {
        return CachedPromise.resolve(this.utils.createParameter(new FmtHLM.MetaRefExpression_Substitute(source, this.utils.internalToExternalIndex(substitution.sourceIndex)!, substitution.result), '_'));
      }
    };
    // TODO substitution dialog
    substituteRow.titleAction = this.getNotImplementedAction();
    let stepsPromise = this.createContextSubstitutionSteps(previousResult, checker.contextUtils, onCreateProofStep);
    substituteRow.subMenu = this.getProofStepSubMenu(stepsPromise, checker.context, onInsertProofStep, onRenderProofStep);
    return substituteRow;
  }

  private getUnfoldRow(previousResult: Fmt.Expression, previousStep: Fmt.Parameter | undefined, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    // TODO (low priority) check whether unfoldsTo returns false, and don't merge steps if it does
    let unfoldRow = new Menu.StandardExpressionMenuRow('Unfold');
    let unfoldedFormulasPromise = this.getUnfoldedFormulas(previousResult, previousResult);
    let rowsPromise = unfoldedFormulasPromise.then((unfoldedFormulas: Fmt.Expression[] | undefined) =>
      (unfoldedFormulas ? unfoldedFormulas.map((unfoldedFormula: Fmt.Expression) => this.getUnfoldMenuItem(unfoldedFormula, previousStep, checker.context, onInsertProofStep, onRenderProofStep)) : []));
    unfoldRow.subMenu = new Menu.ExpressionMenu(rowsPromise);
    return unfoldRow;
  }

  private getUnfoldMenuItem(unfoldedFormula: Fmt.Expression, previousStep: Fmt.Parameter | undefined, context: HLMProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuItem {
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

  private getProveByContradictionRow(goal: Fmt.Expression, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let proveByContradictionRow = new Menu.StandardExpressionMenuRow('Prove by contradiction');
    let stepsPromise: CachedPromise<ProofStepInfo[]> = this.createProveByContradictionStep(goal, undefined, undefined, checker.contextUtils).then((step: ProofStepInfo) => [step]);
    if (goal instanceof FmtHLM.MetaRefExpression_or && goal.formulas) {
      for (let index = 0; index < goal.formulas.length; index++) {
        let [goalToNegate, newGoal] = this.utils.getProveByContradictionVariant(goal.formulas, index);
        stepsPromise = stepsPromise.then((currentSteps: ProofStepInfo[]) =>
          this.createProveByContradictionStep(goalToNegate, newGoal, index, checker.contextUtils).then((step: ProofStepInfo) =>
            currentSteps.concat(step)));
      }
    }
    proveByContradictionRow.subMenu = this.getProofStepSubMenu(stepsPromise, checker.context, onInsertProofStep, onRenderProofStep);
    return proveByContradictionRow;
  }

  private createProveByContradictionStep(goalToNegate: Fmt.Expression, newGoal: Fmt.Expression | undefined, index: number | undefined, contextUtils: HLMCheckerContextUtils): CachedPromise<ProofStepInfo> {
    return this.utils.negateFormula(goalToNegate, true).then((negatedGoal: Fmt.Expression) => {
      let parameters = new Fmt.ParameterList;
      this.utils.addProofConstraint(parameters, negatedGoal);
      return this.createSubProof(parameters, newGoal, false, contextUtils, undefined, index).then((subProof: FmtHLM.ObjectContents_Proof) => {
        let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveByContradiction(subProof), '_');
        return {step: step};
      });
    });
  }

  private getProveForAllRow(goal: FmtHLM.MetaRefExpression_forall, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let proveForAllRow = new Menu.StandardExpressionMenuRow('Prove universality');
    let stepPromise = this.createProveForAllStep(goal, checker.contextUtils);
    proveForAllRow.subMenu = this.getProofStepPromiseMenuItem(stepPromise, checker.context, onInsertProofStep, onRenderProofStep);
    return proveForAllRow;
  }

  private createProveForAllStep(goal: FmtHLM.MetaRefExpression_forall, contextUtils: HLMCheckerContextUtils): CachedPromise<ProofStepInfo> {
    return this.createSubProof(goal.parameters, goal.formula, true, contextUtils).then((subProof: FmtHLM.ObjectContents_Proof) => {
      let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveForAll(subProof), '_');
      return {step: step};
    });
  }

  private getProveExistsRow(goal: FmtHLM.MetaRefExpression_exists, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let proveExistsRow = new Menu.StandardExpressionMenuRow('Prove existence');
    let step = this.createProveExistsStep(goal);
    proveExistsRow.subMenu = this.getProofStepMenuItem(step, checker.context, onInsertProofStep, onRenderProofStep);
    return proveExistsRow;
  }

  private createProveExistsStep(goal: FmtHLM.MetaRefExpression_exists): ProofStepInfo {
    let args = this.utils.getPlaceholderArguments(goal.parameters);
    let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveExists(args), '_');
    return {step: step};
  }

  private getSplitRow(goal: Fmt.Expression, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow | undefined {
    let stepsPromise: CachedPromise<ProofStepInfo[]> | undefined = undefined;
    if (goal instanceof FmtHLM.MetaRefExpression_and) {
      stepsPromise = this.utils.getFormulaCases(goal, undefined, true)
        ?.then((cases: HLMFormulaCase[]) => this.createProveCasesStep(cases, undefined, checker))
        ?.then((step: ProofStepInfo) => [step]);
    } else {
      stepsPromise = this.createProveEquivalenceSteps(goal, checker.contextUtils);
    }
    if (stepsPromise) {
      let splitRow = new Menu.StandardExpressionMenuRow('Split');
      splitRow.subMenu = this.getProofStepSubMenu(stepsPromise, checker.context, onInsertProofStep, onRenderProofStep);
      return splitRow;
    } else {
      return undefined;
    }
  }

  private createProveEquivalenceSteps(goal: Fmt.Expression, contextUtils: HLMCheckerContextUtils): CachedPromise<ProofStepInfo[]> | undefined {
    let list = this.utils.getEquivalenceListInfo(goal);
    if (list) {
      let proofCount = list.wrapAround ? list.items.length : list.items.length - 1;
      if (proofCount > 1) {
        let firstStepPromise = this.createProveEquivalenceStep(list, proofCount, undefined, contextUtils);
        if (list.wrapAround) {
          return firstStepPromise.then((firstStep: ProofStepInfo) => [firstStep]);
        } else {
          return firstStepPromise.then((firstStep: ProofStepInfo) =>
            this.createProveEquivalenceStep(list!, proofCount, 0, contextUtils).then((secondStep: ProofStepInfo) =>[
              firstStep,
              secondStep
            ]));
        }
      }
    }
    return undefined;
  }

  private createProveEquivalenceStep(list: HLMEquivalenceListInfo, proofCount: number, fixedFromIndex: number | undefined, contextUtils: HLMCheckerContextUtils): CachedPromise<ProofStepInfo> {
    let subProofsPromise: CachedPromise<FmtHLM.ObjectContents_Proof[]> = CachedPromise.resolve([]);
    for (let baseIndex = 0; baseIndex < proofCount; baseIndex++) {
      let fromIndex = fixedFromIndex ?? baseIndex;
      let toIndex = baseIndex + 1;
      if (toIndex >= list.items.length) {
        toIndex = 0;
      }
      let from = list.items[fromIndex];
      let to = list.items[toIndex];
      let subParameters: Fmt.ParameterList | undefined = new Fmt.ParameterList;
      let subGoal: Fmt.Expression | undefined = list.getEquivalenceGoal(from, to, subParameters);
      if (!subParameters.length) {
        subParameters = undefined;
      }
      if (list.wrapAround && !subParameters) {
        subGoal = undefined;
      }
      subProofsPromise = subProofsPromise.then((currentSubProofs: FmtHLM.ObjectContents_Proof[]) =>
        this.createSubProof(subParameters, subGoal, false, contextUtils, fromIndex, toIndex).then((subProof: FmtHLM.ObjectContents_Proof) =>
          currentSubProofs.concat(subProof)));
    }
    return subProofsPromise.then((subProofs: FmtHLM.ObjectContents_Proof[]) => ({
      step: this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveEquivalence(subProofs), '_')
    }));
  }

  private getProveByDefinitionRow(goal: Fmt.Expression, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow | undefined {
    let stepsPromise = this.createProveByDefinitionSteps(goal, checker);
    if (stepsPromise) {
      let proveByDefinitionRow = new Menu.StandardExpressionMenuRow('Prove by definition');
      proveByDefinitionRow.subMenu = this.getProofStepSubMenu(stepsPromise, checker.context, onInsertProofStep, onRenderProofStep);
      return proveByDefinitionRow;
    } else {
      return undefined;
    }
  }

  private createProveByDefinitionSteps(goal: Fmt.Expression, checker: HLMProofStepChecker): CachedPromise<ProofStepInfo[]> | undefined {
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
            let subProofPromise = this.createSubProof(undefined, formula, false, checker.contextUtils);
            if (formula instanceof FmtHLM.MetaRefExpression_forall) {
              subProofPromise = subProofPromise.then((subProof: FmtHLM.ObjectContents_Proof) => {
                if (subProof.goal instanceof FmtHLM.MetaRefExpression_forall && !subProof.steps.length) {
                  return this.createProveForAllStep(subProof.goal, checker.contextUtils).then((proveForAllStep: ProofStepInfo) => {
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

  private createByDefinitionStep(goal: Fmt.Expression, contextUtils: HLMCheckerContextUtils): CachedPromise<Fmt.Parameter | undefined> | undefined {
    let definitionsPromise = this.utils.getAllFormulaDefinitions(goal);
    if (definitionsPromise) {
      return definitionsPromise.then((definitions: HLMFormulaDefinition[]) => {
        let resultPromise: CachedPromise<Fmt.Parameter | undefined> = CachedPromise.resolve(undefined);
        for (let definition of definitions) {
          resultPromise = resultPromise.or(() =>
            contextUtils.stripConstraintsFromFormulas([definition.formula], true, true, false, true).then((strippedGoals: Fmt.Expression[]) => {
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

  private getUnfoldGoalRow(goal: Fmt.Expression, checker: HLMProofStepChecker, onSetGoal: SetExpressionFn, onRenderFormula: RenderExpressionFn): Menu.ExpressionMenuRow {
    let unfoldGoalRow = new Menu.StandardExpressionMenuRow('Unfold goal');
    let unfoldedFormulasPromise = this.getUnfoldedFormulas(goal, checker.context.originalGoal!);
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
                    return this.utils.formulaUnfoldsTo(originalSource, adaptedFormula).then((unfoldResult: boolean) => {
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
      if (result && (!currentResultFormulas || result.length > currentResultFormulas.length) && result.length < HLMEditHandler.unfoldContinuationLimit) {
        let nextNewFormulas = currentResultFormulas ? result.slice(currentResultFormulas.length) : result;
        return this.addUnfoldedFormulas(nextNewFormulas, originalSource, result);
      } else {
        return result;
      }
    });
  }

  private getConsiderRow(proof: FmtHLM.ObjectContents_Proof, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let considerRow = new Menu.StandardExpressionMenuRow('Consider');
    let steps: ProofStepInfo[] = [];
    for (let constraint of checker.contextUtils.getAvailableConstraints(true)) {
      if (proof.steps.length && checker.context.previousResult?.isEquivalentTo(constraint.constraint)) {
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
    considerRow.subMenu = this.getProofStepSubMenu(CachedPromise.resolve(steps), checker.context, onInsertProofStep, onRenderProofStep);
    return considerRow;
  }

  private getStateFormulaRow(checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let stateFormulaRow = new Menu.StandardExpressionMenuRow('State formula');
    let step = this.utils.createParameter(new FmtHLM.MetaRefExpression_State(new Fmt.PlaceholderExpression(HLMExpressionType.Formula)), '_');
    stateFormulaRow.subMenu = this.getProofStepMenuItem({step: step}, checker.context, onInsertProofStep, onRenderProofStep);
    return stateFormulaRow;
  }

  private getProveBySubstitutionRow(goal: Fmt.Expression, checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let proveBySubstitutionRow = new Menu.StandardExpressionMenuRow('Substitute in goal');
    let onCreateProofStep = (source: Fmt.Expression, substitution: HLMSubstitutionResult) => {
      if (this.utils.isTrivialContradiction(substitution.result, false).getImmediateResult()) {
        return undefined;
      } else {
        let subProofPromise = this.createSubProof(undefined, substitution.result, true, checker.contextUtils);
        return subProofPromise.then((subProof: FmtHLM.ObjectContents_Proof) =>
          this.utils.createParameter(new FmtHLM.MetaRefExpression_ProveBySubstitution(source, this.utils.internalToExternalIndex(substitution.sourceIndex)!, substitution.result, subProof), '_'));
      }
    };
    // TODO substitution dialog
    proveBySubstitutionRow.titleAction = this.getNotImplementedAction();
    let stepsPromise = this.createContextSubstitutionSteps(goal, checker.contextUtils, onCreateProofStep);
    proveBySubstitutionRow.subMenu = this.getProofStepSubMenu(stepsPromise, checker.context, onInsertProofStep, onRenderProofStep);
    return proveBySubstitutionRow;
  }

  private createContextSubstitutionSteps(expression: Fmt.Expression, contextUtils: HLMCheckerContextUtils, onCreateProofStep: (source: Fmt.Expression, substitution: HLMSubstitutionResult) => CachedPromise<Fmt.Parameter> | undefined): CachedPromise<ProofStepInfo[]> {
    let resultPromise: CachedPromise<ProofStepInfo[]> = CachedPromise.resolve([]);
    for (let constraint of contextUtils.getAvailableConstraints(true)) {
      if (constraint.constraint !== expression) {
        let substitutions = this.utils.getAllSubstitutions(expression, constraint.constraint, false);
        if (substitutions) {
          for (let substitution of substitutions) {
            let stepPromise = this.createSubstitutionStep(constraint, substitution, onCreateProofStep);
            if (stepPromise) {
              resultPromise = resultPromise.then((currentResult: ProofStepInfo[]) =>
                stepPromise!.then((step: ProofStepInfo) => currentResult.concat(step)));
            }
          }
        }
      }
    }
    return resultPromise;
  }

  private createSubstitutionStep(constraint: HLMCheckerConstraint, substitution: HLMSubstitutionResult, onCreateProofStep: (source: Fmt.Expression, substitution: HLMSubstitutionResult) => CachedPromise<Fmt.Parameter> | undefined): CachedPromise<ProofStepInfo> | undefined {
    let source: Fmt.Expression;
    if (constraint.parameter) {
      source = new Fmt.VariableRefExpression(constraint.parameter);
    } else {
      source = new FmtHLM.MetaRefExpression_State(constraint.constraint);
    }
    let stepPromise = onCreateProofStep(source, substitution);
    if (stepPromise) {
      return stepPromise.then((step: Fmt.Parameter) => ({
        step: step,
        linkedObject: constraint.parameter && this.utils.isValueParamType(constraint.parameter.type) ? constraint.parameter : constraint.constraint
      }));
    } else {
      return undefined;
    }
  }

  private getDefineVariableRow(checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuRow {
    let defineVariableRow = new Menu.StandardExpressionMenuRow('Define variable');
    let elementDefinitionType = new FmtHLM.MetaRefExpression_Def(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
    let setDefinitionType = new FmtHLM.MetaRefExpression_SetDef(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
    let steps: ProofStepInfo[] = [
      {step: this.utils.createParameter(elementDefinitionType, 'x', this.getUsedParameterNames())},
      {step: this.utils.createParameter(setDefinitionType, 'S', this.getUsedParameterNames())}
    ];
    defineVariableRow.subMenu = this.getProofStepSubMenu(CachedPromise.resolve(steps), checker.context, onInsertProofStep, onRenderProofStep);
    return defineVariableRow;
  }

  private getUseTheoremRow(checker: HLMProofStepChecker, onInsertProofStep: InsertParameterFn, onRenderFormula: RenderExpressionFn, onRenderArgumentList: RenderArgumentsFn<HLMEditHandler>): Menu.ExpressionMenuRow {
    let useTheoremRow = new Menu.StandardExpressionMenuRow('Use theorem');
    useTheoremRow.titleAction = new Menu.DialogExpressionMenuAction(() => {
      let treeItem = new Dialog.ExpressionDialogTreeItem(this.libraryDataProvider.getRootProvider(), this.templates);
      treeItem.onFilter = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) =>
        CachedPromise.resolve(libraryDefinition.definition.contents instanceof FmtHLM.ObjectContents_Theorem);
      let currentPath: Fmt.Path | undefined = undefined;
      let currentDefinition: Fmt.Definition | undefined = undefined;
      let currentStepType: FmtHLM.MetaRefExpression_UseTheorem | undefined = undefined;
      let currentStep: Fmt.Parameter | undefined = undefined;
      let argumentsItem = new Dialog.ExpressionDialogExpressionItem(() => {
        const theoremPath = currentPath;
        const definition = currentDefinition;
        const step = currentStep;
        if (theoremPath && definition && step) {
          let analyzeFn = (editAnalysis: HLMEditAnalysis) => editAnalysis.analyzePath(theoremPath, checker.context.context);
          let checkFn = () => checker.recheck(step);
          let argumentsHandler = new HLMEditHandler(this.definition, this.libraryDataProvider, this.utils, this.renderUtils, this.templates, this.mruList, analyzeFn, checkFn);
          return onRenderArgumentList(definition.parameters, theoremPath.arguments, argumentsHandler);
        } else {
          return undefined;
        }
      });
      let resultSelectionItem = new Dialog.ExpressionDialogSelectionItem<Fmt.Expression>([], onRenderFormula);
      treeItem.onItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise?: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => {
        let absolutePath = libraryDataProvider.getAbsolutePath(path);
        treeItem.selectedItemPath = absolutePath;
        treeItem.changed();
        if (!libraryDefinitionPromise) {
          libraryDefinitionPromise = libraryDataProvider.fetchItem(FmtUtils.getOuterPath(path), false);
        }
        libraryDefinitionPromise.then((libraryDefinition: LibraryDefinition) => {
          let definition = libraryDefinition.definition;
          const theoremPath = this.libraryDataProvider.getRelativePath(absolutePath);
          theoremPath.arguments = this.utils.getPlaceholderArguments(definition.parameters);
          currentPath = theoremPath;
          currentDefinition = definition;
          let theoremExpression = new Fmt.DefinitionRefExpression(theoremPath);
          let input = definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem ? new Fmt.PlaceholderExpression(HLMExpressionType.Formula) : undefined;
          currentStepType = new FmtHLM.MetaRefExpression_UseTheorem(theoremExpression, input, new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
          currentStep = this.utils.createParameter(new FmtHLM.MetaRefExpression_UseTheorem(theoremExpression, input, new Fmt.PlaceholderExpression(HLMExpressionType.Formula)), '_');
          argumentsItem.changed();
          // TODO also select input
          let originalResults: Fmt.Expression[] = [];
          if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
            originalResults = [definition.contents.claim];
          } else if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
            originalResults = definition.contents.conditions;
          }
          const results = originalResults.map((originalResult: Fmt.Expression) => this.utils.substitutePath(originalResult, theoremPath, [definition]));
          resultSelectionItem.items = results;
          resultSelectionItem.selectedItem = results.length ? results[0] : undefined;
          resultSelectionItem.changed();
        });
      };
      let dummyPath = new Fmt.Path('');
      treeItem.selectedItemPath = this.libraryDataProvider.getAbsolutePath(dummyPath);
      let items = [
        treeItem,
        argumentsItem,
        resultSelectionItem
      ];
      let onOK = () => {
        if (currentStepType && currentStep) {
          // TODO set input
          let result = resultSelectionItem.selectedItem;
          let goal = checker.context.goal;
          if (goal && result?.isEquivalentTo(goal)) {
            result = undefined;
          }
          currentStepType.result = result;
          this.insertProofStep(currentStep, checker.context, onInsertProofStep);
        }
      };
      let dialog = new Dialog.ExpressionDialog(items, onOK);
      dialog.onCheckOKEnabled = () => (currentStep !== undefined && resultSelectionItem.selectedItem !== undefined);
      return dialog;
    });
    useTheoremRow.iconType = Logic.LogicDefinitionType.Theorem;
    return useTheoremRow;
  }

  private simplifyGoal(goal: Fmt.Expression | undefined, contextUtils: HLMCheckerContextUtils): CachedPromise<Fmt.Expression | undefined> {
    if (goal) {
      return this.utils.simplifyFormula(goal).then((simplifiedGoal: Fmt.Expression) =>
        contextUtils.stripConstraintsFromFormulas([simplifiedGoal], true, true, false, false).then((strippedGoals: Fmt.Expression[]) =>
          (strippedGoals.length ? strippedGoals[0] : simplifiedGoal)));
    } else {
      return CachedPromise.resolve(undefined);
    }
  }

  private simplifyResult(result: Fmt.Expression, contextUtils: HLMCheckerContextUtils): CachedPromise<Fmt.Expression> {
    return this.utils.simplifyFormula(result).then((simplifiedResult: Fmt.Expression) =>
      contextUtils.stripConstraintsFromFormulas([simplifiedResult], true, false, true, false).then((strippedResults: Fmt.Expression[]) => {
        let strippedResult = strippedResults.length ? strippedResults[0] : simplifiedResult;
        // TODO if result is a conjunction and a single term closes the goal, use only that term
        return strippedResult;
      }));
  }

  private createSubProof(parameters: Fmt.ParameterList | undefined, goal: Fmt.Expression | undefined, mayOmitGoal: boolean, contextUtils: HLMCheckerContextUtils, fromIndex?: number, toIndex?: number): CachedPromise<FmtHLM.ObjectContents_Proof> {
    if (parameters && !parameters.length) {
      parameters = undefined;
    }
    if (parameters) {
      contextUtils = contextUtils.getParameterListContextUtils(parameters);
    }
    return this.simplifyGoal(goal, contextUtils).then((simplifiedGoal: Fmt.Expression | undefined) => {
      let from = this.utils.internalToExternalIndex(fromIndex);
      let to = this.utils.internalToExternalIndex(toIndex);
      let finalGoal = simplifiedGoal;
      if (goal && mayOmitGoal && simplifiedGoal?.isEquivalentTo(goal)) {
        finalGoal = undefined;
      }
      let result = new FmtHLM.ObjectContents_Proof(from, to, parameters, finalGoal, new Fmt.ParameterList);
      if (simplifiedGoal) {
        let byDefinitionStepPromise = this.createByDefinitionStep(simplifiedGoal, contextUtils);
        if (byDefinitionStepPromise) {
          return byDefinitionStepPromise.then((byDefinitionStep: Fmt.Parameter | undefined) => {
            if (byDefinitionStep) {
              return contextUtils.isTriviallyProvable(simplifiedGoal).then((triviallyProvable: boolean) => {
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
      let infoItem = new Dialog.ExpressionDialogInfoItem(() => new Notation.TextExpression('Not implemented yet'));
      return new Dialog.ExpressionDialog([infoItem]);
    });
  }

  private getProofStepSubMenu(stepsPromise: CachedPromise<ProofStepInfo[]>, context: HLMProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenu {
    let rowsPromise = stepsPromise.then((steps: ProofStepInfo[]) =>
      steps.map((step: ProofStepInfo) => this.getProofStepMenuItem(step, context, onInsertProofStep, onRenderProofStep)));
    return new Menu.ExpressionMenu(rowsPromise);
  }

  private getProofStepPromiseMenuItem(stepPromise: CachedPromise<ProofStepInfo>, context: HLMProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenu {
    let rowsPromise = stepPromise.then((step: ProofStepInfo) =>
      [this.getProofStepMenuItem(step, context, onInsertProofStep, onRenderProofStep)]);
    return new Menu.ExpressionMenu(rowsPromise);
  }

  private getProofStepMenuItem(step: ProofStepInfo, context: HLMProofStepContext, onInsertProofStep: InsertParameterFn, onRenderProofStep: RenderParameterFn): Menu.ExpressionMenuItem {
    let clonedStep = step.preventCloning ? step.step : this.cloneAndAdaptParameterNames(step.step);
    this.adaptNamesOfReferencedSteps(clonedStep);
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

  private adaptNamesOfReferencedSteps(step: Fmt.Parameter): void {
    step.traverse((subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.VariableRefExpression) {
        if (subExpression.variable.name === '_') {
          subExpression.variable.name = this.utils.getUnusedDefaultName('_1', this.getUsedParameterNames());
        }
      }
    });
  }

  private insertProofStep(step: Fmt.Parameter, context: HLMProofStepContext, onInsertProofStep: InsertParameterFn): void {
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
