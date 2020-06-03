import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Edit from '../../format/edit';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as Notation from '../../notation/notation';
import * as Menu from '../../notation/menu';
import * as Dialog from '../../notation/dialog';
import { GenericEditHandler, RenderTypeFn, RenderParameterFn, InsertParameterFn, RenderExpressionFn, InsertExpressionFn, RenderExpressionsFn } from '../generic/editHandler';
import { LibraryDataProvider, LibraryItemInfo } from '../../data/libraryDataProvider';
import { MRUList } from '../../data/mostRecentlyUsedList';
import { HLMExpressionType } from './hlm';
import { HLMEditAnalysis } from './edit';
import { HLMUtils } from './utils';
import { HLMRenderUtils } from './renderUtils';
import { HLMDefinitionChecker } from './checker';
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

function addNegations(expressions: Fmt.Expression[]): Fmt.Expression[] {
  let negatedExpressions = expressions.map((expression: Fmt.Expression) => {
    let negatedExpression = new FmtHLM.MetaRefExpression_not;
    negatedExpression.formula = expression;
    return negatedExpression;
  });
  return expressions.concat(negatedExpressions);
};

export class HLMEditHandler extends GenericEditHandler {
  protected checker: HLMDefinitionChecker;

  constructor(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, protected utils: HLMUtils, protected renderUtils: HLMRenderUtils, templates: Fmt.File, mruList: MRUList) {
    super(definition, libraryDataProvider, new HLMEditAnalysis, utils, templates, mruList);
    this.checker = new HLMDefinitionChecker(definition, libraryDataProvider, utils, true, true);
    this.update();
  }

  update(onAutoFilled?: () => void): CachedPromise<void> {
    return super.update().then(() => {
      let autoFilled = false;
      for (let innerDefinition of this.definition.innerDefinitions) {
        let contents = innerDefinition.contents;
        if (contents instanceof FmtHLM.ObjectContents_Constructor) {
          if (!contents.equalityDefinition
              || !contents.equalityDefinition.leftParameters.isEquivalentTo(innerDefinition.parameters)
              || !contents.equalityDefinition.rightParameters.isEquivalentTo(innerDefinition.parameters)) {
            if (contents.equalityDefinition) {
              autoFilled = true;
            }
            contents.equalityDefinition = this.createEqualityDefinition(innerDefinition.parameters);
            if (contents.equalityDefinition) {
              autoFilled = true;
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
                this.adaptNewParameterLists(newParameterLists, expressionEditInfo);
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

  private adaptNewParameterLists(newParameterLists: Fmt.ParameterList[], expressionEditInfo: Edit.ExpressionEditInfo): void {
    for (let parameters of newParameterLists) {
      let context = expressionEditInfo.context;
      for (let param of parameters) {
        param.name = this.utils.getUnusedDefaultName(param.name, context);
        context = context.metaModel.getNextParameterContext(param, context);
      }
    }
  }

  isTemporaryExpression(expression: Fmt.Expression): boolean {
    return this.editAnalysis.expressionEditInfo.get(expression) === undefined;
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

  addParameterMenu(semanticLink: Notation.SemanticLink, parameterList: Fmt.ParameterList, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn, parameterSelection: ParameterSelection): void {
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

      rows.push(
        new Menu.ExpressionMenuSeparator,
        this.getSetTermDefinitionRow(expressionEditInfo, onRenderTerm)
      );

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  private getSetTermDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
      let type = definition.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_SetOperator || type instanceof FmtHLM.MetaRefExpression_Construction) {
        return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, true, HLMExpressionType.SetTerm);
      } else {
        return undefined;
      }
    };
    let onRenderTermWithSemanticLink = (term: Fmt.Expression) => {
      let renderedExpression = onRenderTerm(term);
      if (!renderedExpression.semanticLinks) {
        renderedExpression.semanticLinks = [new Notation.SemanticLink(term)];
      }
      return renderedExpression;
    };
    return this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.SetOperator, Logic.LogicDefinitionType.Construction], onGetExpressions, onRenderTermWithSemanticLink);
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

      rows.push(
        new Menu.ExpressionMenuSeparator,
        this.getElementTermDefinitionRow(expressionEditInfo, onRenderTerm, termSelection.allowConstructors)
      );

      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
  }

  private getElementTermDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn, allowConstructors: boolean): Menu.ExpressionMenuRow {
    let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, fromMRUList: boolean) => {
      let type = definition.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_ExplicitOperator
          || type instanceof FmtHLM.MetaRefExpression_ImplicitOperator
          || (type instanceof FmtHLM.MetaRefExpression_MacroOperator && !fromMRUList)
          || (allowConstructors && type instanceof FmtHLM.MetaRefExpression_Constructor && !(fromMRUList && definition.contents instanceof FmtHLM.ObjectContents_Constructor && definition.contents.rewrite))) {
        return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, true, HLMExpressionType.ElementTerm);
      } else {
        return undefined;
      }
    };
    let onRenderTermWithSemanticLink = (term: Fmt.Expression) => {
      let renderedExpression = onRenderTerm(term);
      if (!renderedExpression.semanticLinks) {
        renderedExpression.semanticLinks = [new Notation.SemanticLink(term)];
      }
      return renderedExpression;
    };
    return this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Operator, Logic.LogicDefinitionType.Constructor], onGetExpressions, onRenderTermWithSemanticLink);
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

  private getFormulaDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, preFillExpressionType: HLMExpressionType = HLMExpressionType.Formula, requirePreFilling: boolean = false): Menu.ExpressionMenuRow {
    let onGetExpressions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => {
      let type = definition.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
        return this.getDefinitionRefExpressions(expressionEditInfo, path, outerDefinition, definition, false, preFillExpressionType, requirePreFilling)
          .then(addNegations);
      } else {
        return undefined;
      }
    };
    let onRenderFormulaWithSemanticLink = (formula: Fmt.Expression) => {
      let renderedExpression = onRenderFormula(formula);
      if (!renderedExpression.semanticLinks) {
        while (formula instanceof FmtHLM.MetaRefExpression_not) {
          formula = formula.formula;
        }
        renderedExpression.semanticLinks = [new Notation.SemanticLink(formula)];
      }
      return renderedExpression;
    };
    return this.getDefinitionRow(expressionEditInfo, [Logic.LogicDefinitionType.Predicate], onGetExpressions, onRenderFormulaWithSemanticLink);
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
    let subsetExpression = new FmtHLM.MetaRefExpression_subset;
    subsetExpression.parameter = this.utils.createElementParameter('x', expressionEditInfo.context);
    subsetExpression.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);

    let extendedSubsetExpression = new FmtHLM.MetaRefExpression_extendedSubset;
    extendedSubsetExpression.parameters = Object.create(Fmt.ParameterList.prototype);
    extendedSubsetExpression.term = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);

    let subsetRow = new Menu.StandardExpressionMenuRow('Subset');
    subsetRow.subMenu = new Menu.ExpressionMenu(CachedPromise.resolve([
      this.getExpressionItem(subsetExpression, expressionEditInfo, onRenderTerm),
      this.getExpressionItem(extendedSubsetExpression, expressionEditInfo, onRenderTerm)
    ]));
    return subsetRow;
  }

  private getSetCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) => {
      let structuralExpression = new FmtHLM.MetaRefExpression_setStructuralCases;
      structuralExpression.term = term;
      structuralExpression.construction = construction;
      structuralExpression.cases = cases;
      return structuralExpression;
    };

    let casesRow = new Menu.StandardExpressionMenuRow('Cases');
    casesRow.subMenu = new Menu.ExpressionMenu(this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderTerm, HLMExpressionType.SetTerm));
    return casesRow;
  }

  private getElementCasesRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderTerm: RenderExpressionFn): Menu.ExpressionMenuRow {
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) => {
      let structuralExpression = new FmtHLM.MetaRefExpression_structuralCases;
      structuralExpression.term = term;
      structuralExpression.construction = construction;
      structuralExpression.cases = cases;
      return structuralExpression;
    };

    let menuItems = this.getStructuralCaseItems(createStructuralExpression, expressionEditInfo, onRenderTerm, HLMExpressionType.ElementTerm)
      .then((items: Menu.ExpressionMenuItem[]) => {
        let caseExpression = new FmtHLM.MetaRefExpression_cases;
        let positiveCase = new FmtHLM.ObjectContents_Case;
        positiveCase.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
        positiveCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
        let negativeCase = new FmtHLM.ObjectContents_Case;
        negativeCase.formula = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
        negativeCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
        caseExpression.cases = [positiveCase, negativeCase];
        return items.concat(this.getExpressionItem(caseExpression, expressionEditInfo, onRenderTerm));
      });

    let casesRow = new Menu.StandardExpressionMenuRow('Cases');
    casesRow.subMenu = new Menu.ExpressionMenu(menuItems);
    return casesRow;
  }

  private getConnectiveRow(expressionEditInfo: Edit.ExpressionEditInfo, onRenderFormula: RenderExpressionFn, formulaSelection: FormulaSelection): Menu.ExpressionMenuRow {
    let leftPlaceholder = expressionEditInfo.expression || new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let rightPlaceholder = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
    let andExpression = new FmtHLM.MetaRefExpression_and;
    andExpression.formulas = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_and && expressionEditInfo.expression.formulas ? [...expressionEditInfo.expression.formulas, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];
    let orExpression = new FmtHLM.MetaRefExpression_or;
    orExpression.formulas = expressionEditInfo.expression instanceof FmtHLM.MetaRefExpression_or && expressionEditInfo.expression.formulas ? [...expressionEditInfo.expression.formulas, rightPlaceholder] : [leftPlaceholder, rightPlaceholder];

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
      let equivExpression = new FmtHLM.MetaRefExpression_equiv;
      equivExpression.left = leftPlaceholder;
      equivExpression.right = rightPlaceholder;
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
    let createStructuralExpression = (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) => {
      let structuralExpression = new FmtHLM.MetaRefExpression_structural;
      structuralExpression.term = term;
      structuralExpression.construction = construction;
      structuralExpression.cases = cases;
      return structuralExpression;
    };

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

  private getDefinitionRefExpressions(expressionEditInfo: Edit.ExpressionEditInfo, path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, checkType: boolean, preFillExpressionType: HLMExpressionType, requirePreFilling: boolean = false): CachedPromise<Fmt.Expression[]> {
    let checkResultPath = (prevResultPromise: CachedPromise<Fmt.Expression | undefined> | undefined, resultPath: Fmt.Path) => {
      if (!prevResultPromise) {
        prevResultPromise = CachedPromise.resolve(undefined);
      }
      return prevResultPromise.then((prevResult: Fmt.Expression | undefined) => {
        if (prevResult) {
          return prevResult;
        }
        let expression = new Fmt.DefinitionRefExpression;
        expression.path = resultPath;
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
    let resultExpressionPromises = this.createPathsWithArguments(expressionEditInfo, path, outerDefinition, definition, checkResultPath, preFillExpression, preFillExpressionType, requirePreFilling);
    let result: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (let resultExpressionPromise of resultExpressionPromises) {
      result = result.then((currentResult: Fmt.Expression[]) =>
        resultExpressionPromise.then((resultExpression: Fmt.Expression | undefined) =>
          resultExpression ? currentResult.concat(resultExpression) : currentResult));
    }
    return result;
  }

  private createPathsWithArguments<T>(expressionEditInfo: Edit.ExpressionEditInfo, path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, checkResultPath: (prevResult: T | undefined, resultPath: Fmt.Path) => T, preFillExpression?: Fmt.Expression, preFillExpressionType?: HLMExpressionType, requirePreFilling: boolean = false): T[] {
    let notationAlternatives = this.renderUtils.getNotationAlternatives(definition);
    let result: T[] = [];
    for (let notationAlternative of notationAlternatives) {
      let parentPaths: (Fmt.PathItem | undefined)[] = [];
      if (path.parentPath instanceof Fmt.Path) {
        let checkParentPath = (prevResult: Fmt.Path | undefined, parentPath: Fmt.Path) => prevResult || parentPath;
        parentPaths = this.createPathsWithArguments(expressionEditInfo, path.parentPath, outerDefinition, outerDefinition, checkParentPath);
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
        let type = param.type.expression;
        let newResultPath: Fmt.Path | undefined = undefined;
        switch (preFillExpressionType) {
        case HLMExpressionType.Formula:
          if (type instanceof FmtHLM.MetaRefExpression_Prop) {
            newResultPath = resultPath.clone() as Fmt.Path;
            let resultArg = this.findResultPathArgument(newResultPath, param);
            if (resultArg instanceof Fmt.CompoundExpression) {
              let newArg = new FmtHLM.ObjectContents_PropArg;
              newArg.formula = preFillExpression;
              newArg.toCompoundExpression(resultArg, false);
            }
          }
          break;
        case HLMExpressionType.SetTerm:
          if (type instanceof FmtHLM.MetaRefExpression_Set) {
            newResultPath = resultPath.clone() as Fmt.Path;
            let resultArg = this.findResultPathArgument(newResultPath, param);
            if (resultArg instanceof Fmt.CompoundExpression) {
              let newArg = new FmtHLM.ObjectContents_SetArg;
              newArg._set = preFillExpression;
              newArg.toCompoundExpression(resultArg, false);
            }
          } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
            newResultPath = resultPath.clone() as Fmt.Path;
            let resultArg = this.findResultPathArgument(newResultPath, param);
            if (resultArg instanceof Fmt.CompoundExpression) {
              let newArg = new FmtHLM.ObjectContents_SubsetArg;
              newArg._set = preFillExpression;
              newArg.toCompoundExpression(resultArg, false);
            }
          }
          break;
        case HLMExpressionType.ElementTerm:
          if (type instanceof FmtHLM.MetaRefExpression_Element) {
            newResultPath = resultPath.clone() as Fmt.Path;
            let resultArg = this.findResultPathArgument(newResultPath, param);
            if (resultArg instanceof Fmt.CompoundExpression) {
              let newArg = new FmtHLM.ObjectContents_ElementArg;
              newArg.element = preFillExpression;
              newArg.toCompoundExpression(resultArg, false);
            }
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

  private findResultPathArgument(resultPath: Fmt.Path, param: Fmt.Parameter): Fmt.Expression | undefined {
    let parentBinding = this.utils.getParentBinding(param);
    if (parentBinding) {
      let rawBindingArg = this.findResultPathArgument(resultPath, parentBinding);
      if (rawBindingArg) {
        let bindingArg = this.utils.convertArgument(rawBindingArg, FmtHLM.ObjectContents_BindingArg);
        return this.utils.getRawArgument([bindingArg.arguments], param);
      } else {
        return undefined;
      }
    } else {
      return this.utils.getRawArgument([resultPath.arguments], param);
    }
  }

  private getStructuralCaseItems(createStructuralExpression: (term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[]) => Fmt.Expression, expressionEditInfo: Edit.ExpressionEditInfo, onRenderExpression: RenderExpressionFn, expressionType: HLMExpressionType): CachedPromise<Menu.ExpressionMenuItem[]> {
    let structuralChecker = new HLMDefinitionChecker(this.definition, this.libraryDataProvider, this.utils, true, true);

    let result = CachedPromise.resolve<Menu.ExpressionMenuItem[]>([]);
    let variables = expressionEditInfo.context.getVariables();
    for (let variable of variables) {
      let type = variable.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def) {
        result = result.then((menuItems: Menu.ExpressionMenuItem[]) =>
          this.getVariableRefExpressions(expressionEditInfo, variable, false).then((variableRefExpressions: Fmt.Expression[]) => {
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
                        this.adaptNewParameterLists(newParameterLists, expressionEditInfo);
                        inductionExpression = this.utils.substituteExpression(inductionExpression, originalExpression, filledExpression);
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

  getEmbeddingInsertButton(definitionContents: FmtHLM.ObjectContents_Construction, onRenderEmbedding: RenderExpressionFn): Notation.RenderedExpression {
    let insertButton = new Notation.InsertPlaceholderExpression;
    let semanticLink = new Notation.SemanticLink(insertButton, false, false);
    semanticLink.onMenuOpened = () => {
      return new Menu.ExpressionMenu(CachedPromise.resolve([this.getEmbeddingRow(definitionContents, onRenderEmbedding)]));
    };
    insertButton.semanticLinks = [semanticLink];
    return insertButton;
  }

  private getEmbeddingRow(definitionContents: FmtHLM.ObjectContents_Construction, onRenderEmbedding: RenderExpressionFn): Menu.ExpressionMenuRow {
    let context = this.editAnalysis.definitionContentsContext.get(this.definition);
    let parameter = this.utils.createElementParameter('x', context);
    let parameterType = parameter.type.expression as FmtHLM.MetaRefExpression_Element;
    let item = new Menu.ExpressionMenuItem(onRenderEmbedding(parameterType._set));
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      let embedding = new FmtHLM.ObjectContents_Embedding;
      embedding.parameter = parameter;
      embedding.target = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
      definitionContents.embedding = embedding;
      GenericEditHandler.lastInsertedParameter = embedding.parameter;
    });
    let row = new Menu.StandardExpressionMenuRow('Embedding');
    row.subMenu = item;
    return row;
  }

  getElementTermInsertButton(parentExpression: Fmt.Expression, onInsertTerm: InsertExpressionFn, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): Notation.RenderedExpression {
    let insertButton = new Notation.InsertPlaceholderExpression;
    let semanticLink = new Notation.SemanticLink(insertButton, false, false);
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

  addElementTermInsertButton(items: Notation.RenderedExpression[], parentExpression: Fmt.Expression, onInsertTerm: InsertExpressionFn, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let insertButton = this.getElementTermInsertButton(parentExpression, onInsertTerm, onRenderTerm, termSelection);
    if (items.length) {
      let lastItemWithButton = [
        items[items.length - 1],
        new Notation.TextExpression(' '),
        insertButton
      ];
      items[items.length - 1] = new Notation.RowExpression(lastItemWithButton);
    } else {
      items.push(insertButton);
    }
  }

  addEnumerationInsertButton(items: Notation.RenderedExpression[], term: FmtHLM.MetaRefExpression_enumeration, onRenderTerm: RenderExpressionFn, termSelection: ElementTermSelection): void {
    let onInsertTerm = (expression: Fmt.Expression) => {
      if (term.terms) {
        term.terms.push(expression);
      } else {
        term.terms = [expression];
      }
    };
    this.addElementTermInsertButton(items, term, onInsertTerm, onRenderTerm, termSelection);
  }

  getPropertyInsertButton(objectParams: Fmt.Parameter[], onInsertParam: InsertParameterFn, onRenderFormulas: RenderExpressionsFn): Notation.RenderedExpression | undefined {
    if (!objectParams.length) {
      return undefined;
    }
    let firstObjectParam = objectParams[0];
    let objectExpressionType = this.utils.getParameterExpressionType(firstObjectParam);
    let context = this.editAnalysis.parameterContext.get(firstObjectParam);
    if (!objectExpressionType || !context) {
      return undefined;
    }
    objectParams = objectParams.slice();
    let insertButton = new Notation.InsertPlaceholderExpression;
    insertButton.styleClasses = ['mini-placeholder'];
    let semanticLink = new Notation.SemanticLink(insertButton, false, false);
    semanticLink.onMenuOpened = () => {
      let firstObjectExpression = new Fmt.VariableRefExpression;
      firstObjectExpression.variable = firstObjectParam;
      let getPropertyFormulas = (formula: Fmt.Expression) => objectParams.map((objectParam: Fmt.Parameter) => {
        let objectExpression = new Fmt.VariableRefExpression;
        objectExpression.variable = objectParam;
        return this.utils.substituteExpression(formula, firstObjectExpression, objectExpression);
      });
      let onInsertProperty = (formula: Fmt.Expression | undefined) => {
        if (formula) {
          for (let propertyFormula of getPropertyFormulas(formula)) {
            let newParamType = new FmtHLM.MetaRefExpression_Constraint;
            newParamType.formula = propertyFormula;
            let newParam = this.utils.createParameter(newParamType, '_1', context);
            onInsertParam(newParam);
            context = new Ctx.ParameterContext(newParam, context!);
          }
        }
      };
      let expressionEditInfo: Edit.ExpressionEditInfo = {
        expression: firstObjectExpression,
        optional: true,
        onSetValue: onInsertProperty,
        context: context!
      };
      let onRenderProperty = (formula: Fmt.Expression) => onRenderFormulas(getPropertyFormulas(formula));
      return new Menu.ExpressionMenu(CachedPromise.resolve([
        this.getFormulaDefinitionRow(expressionEditInfo, onRenderProperty, objectExpressionType, true)
      ]));
    };
    insertButton.semanticLinks = [semanticLink];
    return insertButton;
  }

  addPropertyInsertButton(singular: Notation.RenderedExpression[], plural: Notation.RenderedExpression[], objectParams: Fmt.Parameter[], onInsertParam: InsertParameterFn, onRenderFormulas: RenderExpressionsFn): void {
    let insertButton = this.getPropertyInsertButton(objectParams, onInsertParam, onRenderFormulas);
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
      this.definition.type.expression = new FmtHLM.MetaRefExpression_ExplicitOperator;
      let explicitOperatorContents = new FmtHLM.ObjectContents_ExplicitOperator;
      explicitOperatorContents.definition = [new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm)];
      explicitOperatorContents.properties = originalContents.properties;
      explicitOperatorContents.notation = originalContents.notation;
      explicitOperatorContents.definitionNotation = originalContents.definitionNotation;
      this.definition.contents = explicitOperatorContents;
    });
    let row = new Menu.StandardExpressionMenuRow('Explicit');
    row.subMenu = item;
    row.selected = this.definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator;
    item.selected = row.selected;
    return row;
  }

  private getImplicitDefinitionRow(onRenderImplicitIntro: RenderParameterFn): Menu.ExpressionMenuRow {
    let context = this.editAnalysis.definitionContentsContext.get(this.definition);
    let parameter = this.utils.createElementParameter('x', context);
    let item = new Menu.ExpressionMenuItem(onRenderImplicitIntro(parameter));
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      let originalContents = this.definition.contents as FmtHLM.ObjectContents_Definition;
      this.definition.type.expression = new FmtHLM.MetaRefExpression_ImplicitOperator;
      let implicitOperatorContents = new FmtHLM.ObjectContents_ImplicitOperator;
      implicitOperatorContents.parameter = parameter;
      implicitOperatorContents.definition = [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)];
      implicitOperatorContents.properties = originalContents.properties;
      implicitOperatorContents.notation = originalContents.notation;
      implicitOperatorContents.definitionNotation = originalContents.definitionNotation;
      this.definition.contents = implicitOperatorContents;
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
      this.definition.type.expression = new FmtHLM.MetaRefExpression_StandardTheorem;
      let standardTheoremContents = new FmtHLM.ObjectContents_StandardTheorem;
      standardTheoremContents.claim = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
      this.definition.contents = standardTheoremContents;
    });
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem;
    return item;
  }

  private getEquivalenceTheoremRow(onRenderEquivalenceIntro: Logic.RenderFn): Menu.ExpressionMenuRow {
    let item = new Menu.ExpressionMenuItem(onRenderEquivalenceIntro());
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      this.definition.type.expression = new FmtHLM.MetaRefExpression_EquivalenceTheorem;
      let equivalenceTheoremContents = new FmtHLM.ObjectContents_EquivalenceTheorem;
      equivalenceTheoremContents.conditions = [new Fmt.PlaceholderExpression(HLMExpressionType.Formula), new Fmt.PlaceholderExpression(HLMExpressionType.Formula)];
      this.definition.contents = equivalenceTheoremContents;
    });
    item.selected = this.definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem;
    return item;
  }

  private createEqualityDefinition(parameters: Fmt.ParameterList): FmtHLM.ObjectContents_EqualityDefinition {
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

  getCaseInsertButton(term: FmtHLM.MetaRefExpression_cases): Notation.RenderedExpression {
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
