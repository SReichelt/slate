import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as HLMMacros from './macros/macros';
import { HLMExpressionType } from './hlm';
import { HLMUtils, HLMSubstitutionContext, HLMTypeSearchParameters } from './utils';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

const debugRecheck = true;

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, supportPlaceholders: boolean): CachedPromise<Logic.LogicCheckResult> {
    let utils = new HLMUtils(definition, libraryDataAccessor, supportPlaceholders);
    let definitionChecker = new HLMDefinitionChecker(definition, libraryDataAccessor, utils, supportPlaceholders, false);
    return definitionChecker.checkDefinition();
  }
}

interface HLMCheckerStructuralCaseRef {
  term: Fmt.Expression;
  construction: Fmt.Expression;
  _constructor: Fmt.Expression;
  parameters: Fmt.ParameterList | undefined;
}

type HLMCheckerRecheckFn = (originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression) => HLMCheckerContext;
type HLMCheckerCheckFormulaFn = (formula: Fmt.Expression) => HLMCheckerContext;
type HLMCheckerFillExpressionFn = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => void;

interface HLMCheckerContext {
  context: Ctx.Context;
  previousSetTerm?: Fmt.Expression;
  binderSourceParameters: Fmt.Parameter[];
  parentStructuralCases: HLMCheckerStructuralCaseRef[];
  inAutoArgument: boolean;
  editData?: HLMCheckerEditData;
  currentRecheckFn?: HLMCheckerRecheckFn;
  currentPlaceholderCollection?: HLMCheckerPlaceholderCollection;
  rechecking: boolean;
}

interface HLMCheckerCompatibilityStatus {
  directEquivalenceUnlikely: boolean;
  checkedForDirectEquivalence: boolean;
  obtainedFinalSets: boolean;
  followedEmbeddings: boolean;
  addedStructuralCases: boolean;
}

interface HLMCheckerEditData {
  restrictions: Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>;
  recheckFns?: Map<Fmt.Expression, HLMCheckerRecheckFn>;
  constraintCheckFns?: Map<Fmt.ParameterList, HLMCheckerCheckFormulaFn>;
}

interface HLMCheckerPlaceholderRestriction {
  exactValueSuggestion?: Fmt.Expression;
  exactValue?: Fmt.Expression;
  compatibleSets: Fmt.Expression[];
  declaredSets: Fmt.Expression[];
  context: HLMCheckerContext;
}

interface HLMCheckerPlaceholderRestrictionState {
  newRestrictions?: Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>;
  exactValueRequried: boolean;
  context: HLMCheckerContext;
}

type AutoFillFn = (placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn) => CachedPromise<void>;

interface HLMCheckerPlaceholderCollection {
  placeholders?: Fmt.PlaceholderExpression[];
  containsNonAutoPlaceholders: boolean;
  unfilledPlaceholderCount: number;
  parentCollection?: HLMCheckerPlaceholderCollection;
  childCollections?: HLMCheckerPlaceholderCollection[];
  autoFillFn?: AutoFillFn;
}

interface HLMCheckerFillExpressionArgs {
  originalExpression: Fmt.Expression;
  filledExpression: Fmt.Expression;
}

// TODO create pending checks on demand only, so that they can be omitted during rechecking if hasErrors is already true
type PendingCheck = () => CachedPromise<void>;

export class HLMDefinitionChecker {
  private rootContext: HLMCheckerContext;
  private result: Logic.LogicCheckResult = {
    diagnostics: [],
    hasErrors: false
  };
  private pendingChecks: PendingCheck[] = [];
  private pendingChecksPromise?: CachedPromise<Logic.LogicCheckResult>;

  constructor(private definition: Fmt.Definition, private libraryDataAccessor: LibraryDataAccessor, private utils: HLMUtils, private supportPlaceholders: boolean, private supportRechecking: boolean) {
    this.rootContext = {
      context: new Ctx.EmptyContext(FmtHLM.metaModel),
      binderSourceParameters: [],
      parentStructuralCases: [],
      inAutoArgument: false,
      rechecking: false
    };
  }

  checkDefinition(): CachedPromise<Logic.LogicCheckResult> {
    return this.check(() => this.checkRootDefinition());
  }

  checkExpression(expression: Fmt.Expression, expressionType: HLMExpressionType): CachedPromise<Logic.LogicCheckResult> {
    return this.check(() => {
      switch (expressionType) {
      case HLMExpressionType.SetTerm:
        this.checkSetTerm(expression, this.rootContext);
        break;
      case HLMExpressionType.ElementTerm:
        this.checkElementTerm(expression, this.rootContext);
        break;
      case HLMExpressionType.Formula:
        this.checkFormula(expression, this.rootContext);
        break;
      }
    });
  }

  private check(checkFn: () => void): CachedPromise<Logic.LogicCheckResult> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.checkDefinition());
    } else {
      if (this.supportPlaceholders) {
        this.rootContext.editData = {
          restrictions: new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>(),
          recheckFns: this.supportRechecking ? new Map<Fmt.Expression, HLMCheckerRecheckFn>() : undefined,
          constraintCheckFns: this.supportRechecking ? new Map<Fmt.ParameterList, HLMCheckerCheckFormulaFn>() : undefined
        };
        this.rootContext.currentPlaceholderCollection = {
          containsNonAutoPlaceholders: false,
          unfilledPlaceholderCount: 0
        };
      }
      this.result = {
        diagnostics: [],
        hasErrors: false
      };
      try {
        checkFn();
      } catch (error) {
        this.error(this.definition, error.message);
      }
      return this.getPendingChecksPromise();
    }
  }

  recheckWithSubstitution(originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression): CachedPromise<Logic.LogicCheckResultWithExpression> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.recheckWithSubstitution(originalExpression, substitutedExpression));
    } else {
      if (debugRecheck) {
        console.log(`Checking ${substitutedExpression}...`);
      }
      this.result = {
        diagnostics: [],
        hasErrors: false
      };
      let recheckContext: HLMCheckerContext | undefined = undefined;
      if (this.rootContext.editData && this.rootContext.editData.recheckFns) {
        let recheckFn = this.rootContext.editData.recheckFns.get(originalExpression);
        if (recheckFn) {
          try {
            recheckContext = recheckFn(originalExpression, substitutedExpression);
          } catch (error) {
            this.error(substitutedExpression, error.message);
          }
        }
      }
      return this.getRecheckResult(substitutedExpression, recheckContext);
    }
  }

  checkConstraint(parameterList: Fmt.ParameterList, formula: Fmt.Expression): CachedPromise<Logic.LogicCheckResultWithExpression> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.checkConstraint(parameterList, formula));
    } else {
      if (debugRecheck) {
        console.log(`Checking ${formula}...`);
      }
      this.result = {
        diagnostics: [],
        hasErrors: false
      };
      let recheckContext: HLMCheckerContext | undefined = undefined;
      if (this.rootContext.editData && this.rootContext.editData.constraintCheckFns) {
        let checkConstraintFn = this.rootContext.editData.constraintCheckFns.get(parameterList);
        if (checkConstraintFn) {
          try {
            recheckContext = checkConstraintFn(formula);
          } catch (error) {
            this.error(formula, error.message);
          }
        }
      }
      return this.getRecheckResult(formula, recheckContext);
    }
  }

  private getRecheckResult(expression: Fmt.Expression, recheckContext: HLMCheckerContext | undefined): CachedPromise<Logic.LogicCheckResultWithExpression> {
    return this.getPendingChecksPromise().then((result: Logic.LogicCheckResult) => {
      let resultExpression = expression;
      if (!result.hasErrors) {
        let restrictions = recheckContext?.editData?.restrictions;
        if (restrictions) {
          resultExpression = resultExpression.substitute((subExpression: Fmt.Expression) => {
            if (subExpression instanceof Fmt.PlaceholderExpression) {
              let restriction = restrictions?.get(subExpression);
              if (restriction && restriction.exactValue) {
                return restriction.exactValue;
              }
            }
            return subExpression;
          });
          for (let [placeholder, restriction] of restrictions) {
            if (placeholder.onFill && restriction.exactValue) {
              placeholder.onFill(restriction.exactValue);
            }
          }
        };
      }
      return {
        ...result,
        expression: resultExpression
      };
    });
  }

  autoFill(onFillExpression: HLMCheckerFillExpressionFn): CachedPromise<void> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.autoFill(onFillExpression));
    } else {
      if (this.rootContext.currentPlaceholderCollection) {
        let placeholderValues = new Map<Fmt.PlaceholderExpression, Fmt.Expression>();
        return this.getAutoPlaceholderValues(this.rootContext.currentPlaceholderCollection, placeholderValues)
          .then(() => this.callAutoFillFns(this.rootContext.currentPlaceholderCollection!, placeholderValues, onFillExpression))
          .then(() => this.autoFillPlaceholders(placeholderValues, onFillExpression));
      }
      return CachedPromise.resolve();
    }
  }

  private getAutoPlaceholderValues(placeholderCollection: HLMCheckerPlaceholderCollection, placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>): CachedPromise<void> {
    let result = CachedPromise.resolve();
    if (placeholderCollection.childCollections) {
      for (let childCollection of placeholderCollection.childCollections) {
        result = result.then(() => this.getAutoPlaceholderValues(childCollection, placeholderValues));
      }
    }
    if (placeholderCollection.placeholders && !placeholderCollection.containsNonAutoPlaceholders && this.rootContext.editData) {
      for (let placeholder of placeholderCollection.placeholders) {
        let placeholderRestriction = this.rootContext.editData.restrictions.get(placeholder);
        if (placeholderRestriction) {
          result = result.then((): void | CachedPromise<void> => {
            if (placeholderRestriction) {
              if (placeholderRestriction.exactValueSuggestion) {
                placeholderValues.set(placeholder, placeholderRestriction.exactValueSuggestion);
                placeholderCollection.unfilledPlaceholderCount--;
              } else if (placeholderRestriction.compatibleSets.length) {
                let compatibleSets = placeholderRestriction.compatibleSets;
                let context = placeholderRestriction.context;
                return this.checkSetCompatibility(placeholder, compatibleSets, context).then((superset: Fmt.Expression) => {
                  if (!(superset instanceof Fmt.PlaceholderExpression)) {
                    placeholderValues.set(placeholder, superset);
                    placeholderCollection.unfilledPlaceholderCount--;
                  }
                });
              }
            }
          });
        }
      }
    }
    return result;
  }

  private autoFillPlaceholders(placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn): void {
    let substitutedPlaceholders: Fmt.PlaceholderExpression[] = [];
    let substitutePlaceholders = (expression: Fmt.Expression): Fmt.Expression => {
      if (expression instanceof Fmt.PlaceholderExpression) {
        if (substitutedPlaceholders.indexOf(expression) < 0) {
          substitutedPlaceholders.push(expression);
          let substitutedExpression = placeholderValues.get(expression);
          if (substitutedExpression) {
            return substitutedExpression.substitute(substitutePlaceholders);
          }
        }
      }
      return expression;
    };
    for (let [placeholder, value] of placeholderValues) {
      substitutedPlaceholders = [];
      let substitutedValue = value.substitute(substitutePlaceholders).clone();
      onFillExpression(placeholder, substitutedValue, []);
    }
  }

  private callAutoFillFns(placeholderCollection: HLMCheckerPlaceholderCollection, placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn): CachedPromise<void> {
    let result = CachedPromise.resolve();
    if (placeholderCollection.childCollections) {
      for (let childCollection of placeholderCollection.childCollections) {
        result = result.then(() => this.callAutoFillFns(childCollection, placeholderValues, onFillExpression));
      }
    }
    if (placeholderCollection.autoFillFn && !placeholderCollection.unfilledPlaceholderCount) {
      let onFillExpressionWithPlaceholders = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => {
        let onFillInnerPlaceholder = (originalPlaceholderExpression: Fmt.Expression, filledPlaceholderExpression: Fmt.Expression) => {
          filledExpression = this.utils.substituteExpression(filledExpression, originalPlaceholderExpression, filledPlaceholderExpression);
        };
        this.autoFillPlaceholders(placeholderValues, onFillInnerPlaceholder);
        onFillExpression(originalExpression, filledExpression, newParameterLists);
      };
      result = result.then(() => placeholderCollection.autoFillFn!(placeholderValues, onFillExpressionWithPlaceholders));
    }
    return result;
  }

  private getPendingChecksPromise(): CachedPromise<Logic.LogicCheckResult> {
    for (;;) {
      let nextCheck = this.pendingChecks.shift();
      if (!nextCheck) {
        break;
      }
      let nextCheckResult = nextCheck();
      if (nextCheckResult.isResolved()) {
        continue;
      }
      this.pendingChecksPromise = nextCheckResult
        .then(() => this.getPendingChecksPromise());
      return this.pendingChecksPromise
        .catch((error) => {
          this.pendingChecksPromise = undefined;
          this.pendingChecks.length = 0;
          return CachedPromise.reject(error);
        });
    }
    this.pendingChecksPromise = undefined;
    return CachedPromise.resolve({...this.result});
  }

  private checkRootDefinition(): void {
    let contents = this.definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      this.checkMacroOperator(contents, this.rootContext);
    } else {
      let innerContext = this.checkParameterList(this.definition.parameters, this.rootContext);
      if (contents instanceof FmtHLM.ObjectContents_Construction) {
        this.checkConstruction(contents, innerContext);
      } else {
        for (let innerDefinition of this.definition.innerDefinitions) {
          this.error(innerDefinition, 'This type of object does not support inner definitions.');
        }
        // TODO check properties (currently: negation)
        if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          this.checkSetOperator(contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          this.checkExplicitOperator(contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          this.checkImplicitOperator(contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          this.checkPredicate(contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
          this.checkStandardTheorem(contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          this.checkEquivalenceTheorem(contents, innerContext);
        } else {
          this.error(this.definition.type, 'Invalid object type');
        }
      }
    }
  }

  private checkConstruction(contents: FmtHLM.ObjectContents_Construction, context: HLMCheckerContext): void {
    for (let innerDefinition of this.definition.innerDefinitions) {
      let innerContext = this.checkParameterList(innerDefinition.parameters, context);
      let innerContents = innerDefinition.contents;
      if (innerContents instanceof FmtHLM.ObjectContents_Constructor) {
        this.checkConstructor(innerDefinition, innerContents, context, innerContext);
      } else {
        this.error(innerDefinition, 'Invalid object type');
      }
    }
    if (contents.embedding) {
      this.checkEmbedding(contents.embedding, context);
    }
  }

  private checkConstructor(innerDefinition: Fmt.Definition, innerContents: FmtHLM.ObjectContents_Constructor, context: HLMCheckerContext, innerContext: HLMCheckerContext): void {
    if (innerContents.equalityDefinition) {
      this.checkEqualityDefinition(innerDefinition, innerContents.equalityDefinition, context);
    } else if (innerDefinition.parameters.length) {
      this.error(innerDefinition, 'Constructor with parameters requires equality definition');
    }
    if (innerContents.rewrite) {
      this.checkRewriteDefinition(innerDefinition, innerContents.rewrite, innerContext);
    }
  }

  private checkEqualityDefinition(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_EqualityDefinition, context: HLMCheckerContext): void {
    let constructorParameters = innerDefinition.parameters;
    let leftParameters = equalityDefinition.leftParameters;
    if (!leftParameters.isEquivalentTo(constructorParameters)) {
      this.error(leftParameters, 'Parameters of equality definition must match constructor parameters');
    }
    let rightParameters = equalityDefinition.rightParameters;
    let unificationFn: Fmt.ExpressionUnificationFn | undefined = undefined;
    if (constructorParameters.length && rightParameters.length) {
      let constructorFirstType = constructorParameters[0].type.expression;
      let rightFirstType = rightParameters[0].type.expression;
      if (constructorFirstType instanceof FmtHLM.MetaRefExpression_Subset && rightFirstType instanceof FmtHLM.MetaRefExpression_Subset && rightFirstType.superset instanceof FmtHLM.MetaRefExpression_previous) {
        unificationFn = (actual: Fmt.Expression, expected: Fmt.Expression) => expected === constructorFirstType && actual === rightFirstType;
        for (let constructorParam of constructorParameters.slice(1)) {
          let constructorParamType = constructorParam.type.expression;
          if (!(constructorParamType instanceof FmtHLM.MetaRefExpression_Subset && constructorParamType.superset instanceof FmtHLM.MetaRefExpression_previous)) {
            unificationFn = undefined;
            break;
          }
        }
      }
      if (constructorFirstType instanceof FmtHLM.MetaRefExpression_Element && rightFirstType instanceof FmtHLM.MetaRefExpression_Element && rightFirstType._set instanceof FmtHLM.MetaRefExpression_previous) {
        unificationFn = (actual: Fmt.Expression, expected: Fmt.Expression) => expected === constructorFirstType && actual === rightFirstType;
        for (let constructorParam of constructorParameters.slice(1)) {
          let constructorParamType = constructorParam.type.expression;
          if (!(constructorParamType instanceof FmtHLM.MetaRefExpression_Element && constructorParamType._set instanceof FmtHLM.MetaRefExpression_previous)) {
            unificationFn = undefined;
            break;
          }
        }
      }
    }
    if (!rightParameters.isEquivalentTo(constructorParameters, unificationFn)) {
      this.error(rightParameters, 'Parameters of equality definition must match constructor parameters');
    }
    this.checkFormulaEquivalenceList(innerDefinition, equalityDefinition.definition, equalityDefinition.equivalenceProofs, context);
    if (equalityDefinition.definition.length) {
      this.checkEqualityDefinitionProofs(innerDefinition, equalityDefinition, context);
    }
  }

  private checkEqualityDefinitionProofs(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_EqualityDefinition, context: HLMCheckerContext): void {
    let isomorphic = (equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true);
    if (isomorphic) {
      this.checkIsomorphicProperty(equalityDefinition.leftParameters, equalityDefinition.rightParameters, equalityDefinition.definition[0], context);
    }
    if (!isomorphic || equalityDefinition.reflexivityProof) {
      let parameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      innerDefinition.parameters.clone(parameters);
      let goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters, parameters);
      this.checkProof(equalityDefinition.reflexivityProof, parameters, goal, context);
    }
    if (!isomorphic || equalityDefinition.symmetryProof) {
      let parameters1: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      innerDefinition.parameters.clone(parameters1);
      let parameters2: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      innerDefinition.parameters.clone(parameters2);
      let constraintType = new FmtHLM.MetaRefExpression_Constraint;
      constraintType.formula = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters2);
      let constraint = this.utils.createParameter(constraintType, '_1');
      let parameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      parameters.push(...parameters1, ...parameters2, constraint);
      let goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters2, parameters1);
      this.checkProof(equalityDefinition.symmetryProof, parameters, goal, context);
    }
    if (!isomorphic || equalityDefinition.transitivityProof) {
      let parameters1: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      innerDefinition.parameters.clone(parameters1);
      let parameters2: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      innerDefinition.parameters.clone(parameters2);
      let parameters3: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      innerDefinition.parameters.clone(parameters3);
      let constraint1Type = new FmtHLM.MetaRefExpression_Constraint;
      constraint1Type.formula = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters2);
      let constraint1 = this.utils.createParameter(constraint1Type, '_1');
      let constraint2Type = new FmtHLM.MetaRefExpression_Constraint;
      constraint2Type.formula = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters2, parameters3);
      let constraint2 = this.utils.createParameter(constraint2Type, '_2');
      let parameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      parameters.push(...parameters1, ...parameters2, ...parameters3, constraint1, constraint2);
      let goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters3);
      this.checkProof(equalityDefinition.transitivityProof, parameters, goal, context);
    }
  }

  private getSubstitutedEqualityDefinition(equalityDefinition: FmtHLM.ObjectContents_EqualityDefinition, leftParameters: Fmt.ParameterList, rightParameters: Fmt.ParameterList): Fmt.Expression {
    let formula = equalityDefinition.definition[0];
    formula = this.utils.substituteParameters(formula, equalityDefinition.leftParameters, leftParameters);
    return this.utils.substituteParameters(formula, equalityDefinition.rightParameters, rightParameters);
  }

  private checkRewriteDefinition(innerDefinition: Fmt.Definition, rewriteDefinition: FmtHLM.ObjectContents_RewriteDefinition, context: HLMCheckerContext): void {
    this.checkElementTerm(rewriteDefinition.value, context);
    let substitutionContext = new HLMSubstitutionContext;
    let constructionPath = new Fmt.Path;
    constructionPath.name = this.definition.name;
    this.utils.getParameterArguments(constructionPath.arguments, this.definition.parameters, substitutionContext);
    let constructorPath = new Fmt.Path;
    constructorPath.parentPath = constructionPath;
    constructorPath.name = innerDefinition.name;
    this.utils.getParameterArguments(constructorPath.arguments, innerDefinition.parameters, substitutionContext);
    let constructorExpression = new Fmt.DefinitionRefExpression;
    constructorExpression.path = constructorPath;
    this.checkElementCompatibility(rewriteDefinition.value, [constructorExpression, rewriteDefinition.value], context);
    // TODO check whether rewrite definition matches referenced theorem
  }

  private checkEmbedding(embedding: FmtHLM.ObjectContents_Embedding, context: HLMCheckerContext): void {
    // TODO make sure that embedding does not implicitly reference itself (e.g. in the well-definedness proof)
    let [subset, innerContext] = this.checkElementParameter(embedding.parameter, context);
    if (subset) {
      this.checkEmbeddability(subset);
    }
    this.checkElementTerm(embedding.target, innerContext);
    let substitutionContext = new HLMSubstitutionContext;
    let constructionPath = new Fmt.Path;
    constructionPath.name = this.definition.name;
    this.utils.getParameterArguments(constructionPath.arguments, this.definition.parameters, substitutionContext);
    let constructionExpression = new Fmt.DefinitionRefExpression;
    constructionExpression.path = constructionPath;
    this.checkCompatibility(embedding.target, [constructionExpression], [embedding.target], innerContext);
    this.checkEmbeddingWellDefinednessProof(embedding, context);
  }

  private checkEmbeddability(subset: Fmt.Expression): void {
    let typeSearchParameters: HLMTypeSearchParameters = {
      followDefinitions: true,
      followSupersets: true,
      followEmbeddings: true,
      unfoldFixedSubterms: false,
      extractStructuralCasesFromFixedSubterms: false
    };
    let checkSubset = this.utils.getFinalSuperset(subset, typeSearchParameters)
      .then((superset: Fmt.Expression) => {
        if (this.utils.isWildcardFinalSet(superset)) {
          this.error(subset!, 'The given set cannot be embedded');
        }
      })
      .catch((error) => this.conditionalError(subset!, error.message));
    this.addPendingCheck(checkSubset);
  }

  private checkEmbeddingWellDefinednessProof(embedding: FmtHLM.ObjectContents_Embedding, context: HLMCheckerContext): void {
    let leftParam = embedding.parameter.clone();
    let rightParamType = new FmtHLM.MetaRefExpression_Element;
    rightParamType._set = new FmtHLM.MetaRefExpression_previous;
    let rightParam = this.utils.createParameter(rightParamType, leftParam.name);
    let leftTerm = this.utils.substituteParameter(embedding.target, embedding.parameter, leftParam);
    let rightTerm = this.utils.substituteParameter(embedding.target, embedding.parameter, rightParam);
    let constraint = new FmtHLM.MetaRefExpression_equals;
    constraint.terms = [leftTerm, rightTerm];
    let constraintType = new FmtHLM.MetaRefExpression_Constraint;
    constraintType.formula = constraint;
    let constraintParam = this.utils.createParameter(constraintType, '_1');
    let parameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
    parameters.push(leftParam, rightParam, constraintParam);
    let leftVariableRef = new Fmt.VariableRefExpression;
    leftVariableRef.variable = leftParam;
    let rightVariableRef = new Fmt.VariableRefExpression;
    rightVariableRef.variable = rightParam;
    let goal = new FmtHLM.MetaRefExpression_equals;
    goal.terms = [leftVariableRef, rightVariableRef];
    this.checkProof(embedding.wellDefinednessProof, parameters, goal, context);
  }

  private checkSetOperator(contents: FmtHLM.ObjectContents_SetOperator, context: HLMCheckerContext): void {
    this.checkSetTermEquivalenceList(this.definition, contents.definition, contents.equalityProofs, context);
  }

  private checkExplicitOperator(contents: FmtHLM.ObjectContents_ExplicitOperator, context: HLMCheckerContext): void {
    this.checkElementTermEquivalenceList(this.definition, contents.definition, contents.equalityProofs, context);
  }

  private checkImplicitOperator(contents: FmtHLM.ObjectContents_ImplicitOperator, context: HLMCheckerContext): void {
    let [set, innerContext] = this.checkElementParameter(contents.parameter, context);
    this.checkFormulaEquivalenceList(this.definition, contents.definition, contents.equivalenceProofs, innerContext);
    if (contents.definition.length) {
      this.checkImplicitOperatorWellDefinednessProof(contents, context);
    }
  }

  private checkImplicitOperatorWellDefinednessProof(contents: FmtHLM.ObjectContents_ImplicitOperator, context: HLMCheckerContext): void {
    let param = contents.parameter.clone();
    let goal = new FmtHLM.MetaRefExpression_existsUnique;
    goal.parameters = Object.create(Fmt.ParameterList.prototype);
    goal.parameters.push(param);
    goal.formula = this.utils.substituteParameter(contents.definition[0], contents.parameter, param);
    this.checkProof(contents.wellDefinednessProof, undefined, goal, context);
  }

  private checkPredicate(contents: FmtHLM.ObjectContents_Predicate, context: HLMCheckerContext): void {
    this.checkFormulaEquivalenceList(this.definition, contents.definition, contents.equivalenceProofs, context);
  }

  private checkStandardTheorem(contents: FmtHLM.ObjectContents_StandardTheorem, context: HLMCheckerContext): void {
    this.checkFormula(contents.claim, context);
    this.checkProofs(contents.proofs, contents.claim, context);
  }

  private checkEquivalenceTheorem(contents: FmtHLM.ObjectContents_EquivalenceTheorem, context: HLMCheckerContext): void {
    this.checkFormulaEquivalenceList(this.definition, contents.conditions, contents.equivalenceProofs, context);
  }

  private checkMacroOperator(contents: FmtHLM.ObjectContents_MacroOperator, context: HLMCheckerContext): void {
    try {
      let macroInstance = HLMMacros.instantiateMacro(this.libraryDataAccessor, this.definition);
      let checkMacro = macroInstance.check()
        .then((diagnostics: Logic.LogicCheckDiagnostic[]) => {
          this.result.diagnostics.push(...diagnostics);
          if (diagnostics.some((diagnostic: Logic.LogicCheckDiagnostic) => diagnostic.severity === Logic.DiagnosticSeverity.Error)) {
            this.result.hasErrors = true;
          }
        })
        .catch((error) => this.error(this.definition, error.message));
      this.addPendingCheck(checkMacro);
    } catch (error) {
      this.error(this.definition, error.message);
    }
  }

  private setCurrentRecheckFn(expression: Fmt.Expression, checkFn: (substitutedExpression: Fmt.Expression, recheckContext: HLMCheckerContext) => void, autoFillFn: AutoFillFn | undefined, context: HLMCheckerContext): HLMCheckerContext {
    if (context.editData && !context.rechecking) {
      let newContext: HLMCheckerContext = {
        ...context,
        currentRecheckFn: (originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression) => {
          let substituted = this.utils.substituteExpression(expression, originalExpression, substitutedExpression);
          let fn = (recheckContext: HLMCheckerContext) => checkFn(substituted, recheckContext);
          return this.recheck(substitutedExpression, fn, context, originalExpression);
        },
        currentPlaceholderCollection: {
          containsNonAutoPlaceholders: false,
          unfilledPlaceholderCount: 0,
          parentCollection: context.currentPlaceholderCollection,
          autoFillFn: autoFillFn
        }
      };
      if (context.currentPlaceholderCollection) {
        if (context.currentPlaceholderCollection.childCollections) {
          context.currentPlaceholderCollection.childCollections.push(newContext.currentPlaceholderCollection!);
        } else {
          context.currentPlaceholderCollection.childCollections = [newContext.currentPlaceholderCollection!];
        }
      }
      return newContext;
    } else {
      return context;
    }
  }

  private recheck(object: Object, fn: (recheckContext: HLMCheckerContext) => void, context: HLMCheckerContext, originalExpression?: Fmt.Expression): HLMCheckerContext {
    let restrictions = originalExpression instanceof Fmt.PlaceholderExpression ? context.editData!.restrictions : new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>();
    let recheckContext: HLMCheckerContext = {
      ...context,
      editData: {
        restrictions: restrictions
      },
      currentPlaceholderCollection: undefined,
      rechecking: true
    };
    fn(recheckContext);
    let lastSetsToCheckLength = 0;
    let checkRestrictions = () => {
      let setsToCheck: Fmt.Expression[][] = [];
      for (let [placeholder, restriction] of restrictions) {
        if (!placeholder.isTemporary) {
          let sets = restriction.compatibleSets.concat(restriction.declaredSets);
          if (sets.length > 1) {
            setsToCheck.push(sets);
          }
        }
      }
      if (setsToCheck.length > lastSetsToCheckLength) {
        for (let sets of setsToCheck) {
          this.checkSetCompatibility(object, sets, recheckContext);
        }
        lastSetsToCheckLength = setsToCheck.length;
        this.pendingChecks.push(checkRestrictions);
      }
      return CachedPromise.resolve();
    };
    this.pendingChecks.push(checkRestrictions);
    return recheckContext;
  }

  private checkParameterList(parameterList: Fmt.ParameterList, context: HLMCheckerContext): HLMCheckerContext {
    let currentContext = context;
    for (let param of parameterList) {
      currentContext = this.checkParameter(param, currentContext);
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        if (!(type.superset instanceof FmtHLM.MetaRefExpression_previous)) {
          currentContext = {...currentContext, previousSetTerm: type.superset};
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        if (!(type._set instanceof FmtHLM.MetaRefExpression_previous)) {
          currentContext = {...currentContext, previousSetTerm: type._set};
        }
      } else {
        currentContext = {...currentContext, previousSetTerm: undefined};
      }
    }
    currentContext = {...currentContext, previousSetTerm: undefined};
    if (context.editData && context.editData.constraintCheckFns) {
      let constraintCheckFn = (formula: Fmt.Expression) => {
        let fn = (recheckContext: HLMCheckerContext) => this.checkFormula(formula, recheckContext);
        return this.recheck(formula, fn, context);
      };
      context.editData.constraintCheckFns.set(parameterList, constraintCheckFn);
    }
    return currentContext;
  }

  private getParameterListContext(parameterList: Fmt.ParameterList, context: HLMCheckerContext): HLMCheckerContext {
    for (let param of parameterList) {
      context = this.getParameterContext(param, context);
    }
    return context;
  }

  private checkParameter(param: Fmt.Parameter, context: HLMCheckerContext): HLMCheckerContext {
    if (param.optional) {
      this.error(param, 'HLM parameters cannot be declared optional');
    }
    if (param.list) {
      this.error(param, 'List parameters are not supported in HLM');
    }
    if (param.defaultValue) {
      this.error(param, 'Parameter default values are not supported in HLM');
    }
    if (param.dependencies) {
      this.error(param, 'Parameters with dependencies are not supported in HLM');
    }
    if (param.type.arrayDimensions) {
      this.error(param, 'Array parameters are not supported in HLM');
    }
    return this.checkParameterType(param, param.type.expression, context);
  }

  private checkParameterType(param: Fmt.Parameter, type: Fmt.Expression, context: HLMCheckerContext): HLMCheckerContext {
    let recheckFn = (substitutedType: Fmt.Expression, recheckContext: HLMCheckerContext) => this.checkParameterType(param, substitutedType, recheckContext);
    let typeContext = this.setCurrentRecheckFn(type, recheckFn, undefined, context);
    if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      this.checkBoolConstant(type.auto);
    } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
      this.checkBoolConstant(type.auto);
      this.checkBoolConstant(type.embedSubsets);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      this.checkSetTerm(type.superset, typeContext);
      this.checkBoolConstant(type.auto);
      this.checkBoolConstant(type.embedSubsets);
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      this.checkSetTerm(type._set, typeContext);
      this.checkBoolConstant(type.auto);
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      this.checkFormula(type.formula, typeContext);
    } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      this.checkSetTerm(type._set, typeContext);
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      this.checkElementTerm(type.element, typeContext);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      let sourceContext = this.checkParameterList(type.sourceParameters, context);
      let resultContext = this.checkParameterList(type.targetParameters, sourceContext);
      return {
        ...resultContext,
        binderSourceParameters: [...resultContext.binderSourceParameters, ...type.sourceParameters]
      };
    } else {
      this.error(type, 'Invalid parameter type');
    }
    return this.getParameterContext(param, context);
  }

  private getParameterContext(param: Fmt.Parameter, context: HLMCheckerContext): HLMCheckerContext {
    return {
      ...context,
      context: new Ctx.ParameterContext(param, context.context)
    };
  }

  private checkElementParameter(param: Fmt.Parameter, context: HLMCheckerContext): [Fmt.Expression | undefined, HLMCheckerContext] {
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Element) {
      let resultContext = this.checkParameter(param, context);
      return [type._set, resultContext];
    } else {
      this.error(type, 'Element parameter expected');
      return [undefined, context];
    }
  }

  private checkArgumentLists(argumentLists: Fmt.ArgumentList[], parameterLists: Fmt.ParameterList[], targetPath: Fmt.PathItem | undefined, context: HLMCheckerContext): void {
    let substitutionContext = new HLMSubstitutionContext;
    this.utils.addTargetPathSubstitution(targetPath, substitutionContext);
    for (let listIndex = 0; listIndex < argumentLists.length; listIndex++) {
      this.addAndCheckArgumentList(parameterLists[listIndex], argumentLists[listIndex], targetPath, context, substitutionContext);
    }
  }

  private addAndCheckArgumentList(parameterList: Fmt.ParameterList, argumentList: Fmt.ArgumentList, targetPath: Fmt.PathItem | undefined, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    this.utils.addArgumentListSubstitution(parameterList, argumentList, targetPath, substitutionContext);
    for (let param of parameterList) {
      this.checkArgument(param, argumentList, context, substitutionContext);
    }
  }

  private checkArgument(param: Fmt.Parameter, argumentList: Fmt.ArgumentList, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    let rawArg = this.utils.getRawArgument([argumentList], param);
    this.checkRawArgument(param, argumentList, rawArg, param.type.arrayDimensions, context, substitutionContext);
  }

  private checkRawArgument(param: Fmt.Parameter, argumentList: Fmt.ArgumentList, rawArg: Fmt.Expression | undefined, remainingArrayDimensions: number, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    if (remainingArrayDimensions && rawArg) {
      if (rawArg instanceof Fmt.ArrayExpression) {
        for (let item of rawArg.items) {
          this.checkRawArgument(param, argumentList, item, remainingArrayDimensions - 1, context, substitutionContext);
        }
      } else {
        this.error(rawArg, 'Array expression expected');
      }
    } else {
      try {
        this.checkArgumentValue(param, rawArg, context, substitutionContext);
      } catch (error) {
        this.error(rawArg ?? argumentList, error.message);
      }
    }
  }

  private checkArgumentValue(param: Fmt.Parameter, rawArg: Fmt.Expression | undefined, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    let missingArgument = false;
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      if (rawArg) {
        let superset = this.utils.substituteParameterSet(type.superset, substitutionContext, true);
        let subsetArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_SubsetArg);
        this.checkSetTerm(subsetArg._set, this.getAutoArgumentContext(type.auto, context));
        this.checkSetCompatibility(subsetArg._set, [subsetArg._set, superset], context);
        let subsetFormula = new FmtHLM.MetaRefExpression_sub;
        subsetFormula.subset = subsetArg._set;
        subsetFormula.superset = superset;
        this.checkProof(subsetArg.subsetProof, undefined, subsetFormula, context);
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      if (rawArg) {
        let set = this.utils.substituteParameterSet(type._set, substitutionContext, true);
        let elementArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_ElementArg);
        this.checkElementTerm(elementArg.element, this.getAutoArgumentContext(type.auto, context));
        this.checkCompatibility(elementArg.element, [set], [elementArg.element], context);
        let elementFormula = new FmtHLM.MetaRefExpression_in;
        elementFormula.element = elementArg.element;
        elementFormula._set = set;
        this.checkProof(elementArg.elementProof, undefined, elementFormula, context);
      } else {
        missingArgument = true;
      }
    } else {
      if (type instanceof FmtHLM.MetaRefExpression_Prop) {
        if (rawArg) {
          let propArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_PropArg);
          this.checkFormula(propArg.formula, this.getAutoArgumentContext(type.auto, context));
        } else {
          missingArgument = true;
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
        if (rawArg) {
          let setArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_SetArg);
          this.checkSetTerm(setArg._set, this.getAutoArgumentContext(type.auto, context));
        } else {
          missingArgument = true;
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
        let constraint = this.utils.applySubstitutionContext(type.formula, substitutionContext);
        let constraintArg = rawArg ? this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_ConstraintArg) : undefined;
        this.checkProof(constraintArg?.proof, undefined, constraint, context);
      } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        if (rawArg) {
          let binderArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_BinderArg);
          let expectedSourceParameters = this.utils.applySubstitutionContextToParameterList(type.sourceParameters, substitutionContext);
          if (!binderArg.sourceParameters.isEquivalentTo(expectedSourceParameters)) {
            // Retry with %previous.
            // TODO #65 remove
            let prevParam = undefined;
            for (let expectedParam of expectedSourceParameters) {
              if (prevParam && expectedParam.type.expression.isEquivalentTo(prevParam.type.expression)) {
                if (expectedParam.type.expression instanceof FmtHLM.MetaRefExpression_Subset) {
                  expectedParam.type.expression.superset = new FmtHLM.MetaRefExpression_previous;
                } else if (expectedParam.type.expression instanceof FmtHLM.MetaRefExpression_Element) {
                  expectedParam.type.expression._set = new FmtHLM.MetaRefExpression_previous;
                }
              }
              prevParam = expectedParam;
            }
            if (!binderArg.sourceParameters.isEquivalentTo(expectedSourceParameters)) {
              this.error(binderArg.sourceParameters, 'Parameter list must match binder');
            }
          }
          let innerSubstitutionContext = new HLMSubstitutionContext(substitutionContext);
          innerSubstitutionContext.previousSetTerm = undefined;
          this.utils.addParameterListSubstitution(type.sourceParameters, binderArg.sourceParameters, innerSubstitutionContext);
          this.addAndCheckArgumentList(type.targetParameters, binderArg.targetArguments, undefined, context, innerSubstitutionContext);
        } else {
          missingArgument = true;
        }
      }
      substitutionContext.previousSetTerm = undefined;
    }
    if (missingArgument) {
      throw Error(`Missing argument for parameter "${param.name}"`);
    }
  }

  private getAutoFillContext(context: HLMCheckerContext, condition: boolean = true): HLMCheckerContext {
    if (condition && !context.inAutoArgument) {
      return {
        ...context,
        inAutoArgument: true
      };
    } else {
      return context;
    }
  }

  private getAutoArgumentContext(auto: Fmt.Expression | undefined, context: HLMCheckerContext): HLMCheckerContext {
    return this.getAutoFillContext(context, auto instanceof FmtHLM.MetaRefExpression_true);
  }

  private handleExpression(expression: Fmt.Expression, context: HLMCheckerContext): void {
    if (context.editData && context.editData.recheckFns && context.currentRecheckFn) {
      context.editData.recheckFns.set(expression, context.currentRecheckFn);
    }
  }

  private checkSetTerm(term: Fmt.Expression, context: HLMCheckerContext): void {
    this.handleExpression(term, context);
    if (term instanceof Fmt.VariableRefExpression && (term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Set || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Subset || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_SetDef)) {
      this.checkVariableRefExpression(term, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(term)
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Construction || definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
            this.checkDefinitionRefExpression(term, [definition], context);
          } else {
            this.error(term, 'Referenced definition must be a construction or set operator');
          }
        })
        .catch((error) => this.error(term, error.message));
      this.addPendingCheck(checkDefinitionRef);
    } else if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
      if (term.terms) {
        this.checkElementTerms(term, term.terms, context);
      }
    } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
      let [set, innerContext] = this.checkElementParameter(term.parameter, context);
      this.checkFormula(term.formula, innerContext);
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      let innerContext = this.checkParameterList(term.parameters, context);
      this.checkElementTerm(term.term, innerContext);
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      let checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkSetTerm(value, caseContext);
      let checkCompatibility = (values: Fmt.Expression[]) => this.checkSetCompatibility(term, values, context);
      let replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (let newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
        }
        let newTerm = new FmtHLM.MetaRefExpression_setStructuralCases;
        newTerm.term = term.term;
        newTerm.construction = term.construction;
        newTerm.cases = newCases;
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      let getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext) => {
        let result = new FmtHLM.MetaRefExpression_sub;
        result.subset = leftValue;
        result.superset = rightValue;
        // TODO support well-definedness proofs in cases where the goal can be written as an isomorphism condition
        this.checkFormula(result, wellDefinednessContext);
        return result;
      };
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, replaceCases, getWellDefinednessProofGoal, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_setAssociative) {
      this.checkSetTerm(term.term, context);
      // TODO check whether combination of inner and outer operations is really declared as associative
    } else if (term instanceof FmtHLM.MetaRefExpression_previous && context.previousSetTerm) {
      // Nothing to check.
    } else if (term instanceof Fmt.PlaceholderExpression) {
      this.checkPlaceholderExpression(term, HLMExpressionType.SetTerm, context);
    } else {
      this.error(term, 'Set term expected');
    }
  }

  private checkSetTerms(object: Object, terms: Fmt.Expression[], context: HLMCheckerContext): void {
    for (let item of terms) {
      this.checkSetTerm(item, context);
    }
    this.checkSetCompatibility(object, terms, context);
  }

  private checkElementTerm(term: Fmt.Expression, context: HLMCheckerContext): void {
    this.handleExpression(term, context);
    if (term instanceof Fmt.VariableRefExpression && (term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Element || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Def)) {
      this.checkVariableRefExpression(term, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(term)
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Construction && term.path.parentPath instanceof Fmt.Path && !(term.path.parentPath.parentPath instanceof Fmt.Path)) {
            let innerDefinition = definition.innerDefinitions.getDefinition(term.path.name);
            this.checkDefinitionRefExpression(term, [definition, innerDefinition], context);
          } else if (definition.contents instanceof FmtHLM.ObjectContents_Operator) {
            this.checkDefinitionRefExpression(term, [definition], context);
          } else {
            this.error(term, 'Referenced definition must be a constructor or operator');
          }
        })
        .catch((error) => this.error(term, error.message));
      this.addPendingCheck(checkDefinitionRef);
    } else if (term instanceof FmtHLM.MetaRefExpression_cases) {
      let formulas: Fmt.Expression[] = [];
      let values: Fmt.Expression[] = [];
      for (let item of term.cases) {
        this.checkFormula(item.formula, context);
        this.checkElementTerm(item.value, context);
        let exclusivityConstraint = new FmtHLM.MetaRefExpression_or;
        exclusivityConstraint.formulas = formulas.slice();
        let exclusivityConstraintType = new FmtHLM.MetaRefExpression_Constraint;
        exclusivityConstraintType.formula = exclusivityConstraint;
        let exclusivityParameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
        exclusivityParameters.push(this.utils.createParameter(exclusivityConstraintType, '_1'));
        let exclusivityGoal = new FmtHLM.MetaRefExpression_not;
        exclusivityGoal.formula = item.formula;
        this.checkProof(item.exclusivityProof, exclusivityParameters, exclusivityGoal, context);
        formulas.push(item.formula);
        values.push(item.value);
      }
      let totalityGoal = new FmtHLM.MetaRefExpression_or;
      totalityGoal.formulas = formulas;
      this.checkProof(term.totalityProof, undefined, totalityGoal, context);
      this.checkElementCompatibility(term, values, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      let checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkElementTerm(value, caseContext);
      let checkCompatibility = (values: Fmt.Expression[]) => this.checkElementCompatibility(term, values, context);
      let replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (let newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
        }
        let newTerm = new FmtHLM.MetaRefExpression_structuralCases;
        newTerm.term = term.term;
        newTerm.construction = term.construction;
        newTerm.cases = newCases;
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      let getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext) => {
        let result = new FmtHLM.MetaRefExpression_equals;
        result.terms = [leftValue, rightValue];
        // TODO support well-definedness proofs in cases where the goal can be written as an isomorphism condition
        this.checkFormula(result, wellDefinednessContext);
        return result;
      };
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, replaceCases, getWellDefinednessProofGoal, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      this.checkElementTerm(term.term, context);
      this.checkSetTerm(term._set, context);
      this.checkCompatibility(term, [term._set], [term.term], context);
      let goal = new FmtHLM.MetaRefExpression_in;
      goal.element = term.term;
      goal._set = term._set;
      this.checkProof(term.proof, undefined, goal, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_associative) {
      this.checkElementTerm(term.term, context);
      // TODO check whether inner and outer operations are the same and are really declared as associative
    } else if (term instanceof Fmt.PlaceholderExpression) {
      this.checkPlaceholderExpression(term, HLMExpressionType.ElementTerm, context);
    } else {
      this.error(term, 'Element term expected');
    }
  }

  private checkElementTerms(object: Object, terms: Fmt.Expression[], context: HLMCheckerContext): void {
    for (let item of terms) {
      this.checkElementTerm(item, context);
    }
    this.checkElementCompatibility(object, terms, context);
  }

  private checkFormula(formula: Fmt.Expression, context: HLMCheckerContext): void {
    let recheckFn = (substitutedFormula: Fmt.Expression, recheckContext: HLMCheckerContext) => this.checkFormula(substitutedFormula, recheckContext);
    context = this.setCurrentRecheckFn(formula, recheckFn, undefined, context);
    this.handleExpression(formula, context);
    if (formula instanceof Fmt.VariableRefExpression && formula.variable.type.expression instanceof FmtHLM.MetaRefExpression_Prop) {
      this.checkVariableRefExpression(formula, context);
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(formula)
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
            this.checkDefinitionRefExpression(formula, [definition], context);
          } else {
            this.error(formula, 'Referenced definition must be a predicate');
          }
        })
        .catch((error) => this.error(formula, error.message));
      this.addPendingCheck(checkDefinitionRef);
    } else if (formula instanceof FmtHLM.MetaRefExpression_not) {
      this.checkFormula(formula.formula, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and || formula instanceof FmtHLM.MetaRefExpression_or) {
      if (formula.formulas) {
        let checkContext = context;
        for (let item of formula.formulas) {
          this.checkFormula(item, checkContext);
          let constraintType = new FmtHLM.MetaRefExpression_Constraint;
          if (formula instanceof FmtHLM.MetaRefExpression_or) {
            let negatedFormula = new FmtHLM.MetaRefExpression_not;
            negatedFormula.formula = item;
            constraintType.formula = negatedFormula;
          } else {
            constraintType.formula = item;
          }
          let constraintParam = this.utils.createParameter(constraintType, '_');
          checkContext = this.getParameterContext(constraintParam, checkContext);
        }
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      this.checkFormula(formula.left, context);
      this.checkFormula(formula.right, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall || formula instanceof FmtHLM.MetaRefExpression_exists || formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
      let innerContext = this.checkParameterList(formula.parameters, context);
      if (formula.formula) {
        this.checkFormula(formula.formula, innerContext);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      this.checkElementTerm(formula.element, context);
      this.checkSetTerm(formula._set, context);
      this.checkCompatibility(formula, [formula._set], [formula.element], context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      this.checkSetTerm(formula.subset, context);
      this.checkSetTerm(formula.superset, context);
      this.checkSetCompatibility(formula, [formula.subset, formula.superset], context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      this.checkSetTerms(formula, formula.terms, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
      this.checkElementTerms(formula, formula.terms, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      let checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkFormula(value, caseContext);
      let replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (let newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
        }
        let newFormula = new FmtHLM.MetaRefExpression_structural;
        newFormula.term = formula.term;
        newFormula.construction = formula.construction;
        newFormula.cases = newCases;
        return {
          originalExpression: formula,
          filledExpression: newFormula
        };
      };
      let getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => {
        let constraintType = new FmtHLM.MetaRefExpression_Constraint;
        constraintType.formula = leftValue;
        proofParameters.unshift(this.utils.createParameter(constraintType, '_1'));
        return rightValue;
      };
      this.checkStructuralCases(formula.term, formula.construction, formula.cases, checkCase, undefined, replaceCases, getWellDefinednessProofGoal, context);
    } else if (formula instanceof Fmt.PlaceholderExpression) {
      this.checkPlaceholderExpression(formula, HLMExpressionType.Formula, context);
    } else {
      this.error(formula, 'Formula expected');
    }
  }

  private checkVariableRefExpression(expression: Fmt.VariableRefExpression, context: HLMCheckerContext): void {
    if (context.binderSourceParameters.indexOf(expression.variable) >= 0) {
      this.error(expression, 'Invalid reference to binder');
    }
    if (expression.indices) {
      for (let index of expression.indices) {
        if (index.parameters && index.arguments) {
          this.checkArgumentLists([index.arguments], [index.parameters], undefined, context);
        } else if (index.parameters) {
          this.error(expression, `Too few indices`);
        } else {
          this.error(index.arguments ?? expression, `Superfluous index`);
        }
      }
    }
  }

  private checkDefinitionRefExpression(expression: Fmt.DefinitionRefExpression, definitions: Fmt.Definition[], context: HLMCheckerContext): void {
    this.checkPath(expression.path);
    let parameterLists: Fmt.ParameterList[] = [];
    let argumentLists: Fmt.ArgumentList[] = [];
    let path: Fmt.PathItem | undefined = expression.path;
    for (let index = definitions.length - 1; index >= 0; index--) {
      if (path instanceof Fmt.Path) {
        parameterLists.unshift(definitions[index].parameters);
        argumentLists.unshift(path.arguments);
        path = path.parentPath;
      } else {
        this.error(expression, 'Reference to inner definition expected');
        return;
      }
    }
    if (path instanceof Fmt.Path) {
      this.error(expression, 'Unexpected reference to inner definition');
    } else {
      this.checkArgumentLists(argumentLists, parameterLists, path, context);
    }
  }

  private checkPath(path: Fmt.Path): void {
    let simplifiedPath = this.libraryDataAccessor.simplifyPath(path);
    if (simplifiedPath !== path) {
      this.message(path, `Path can be simplified to ${simplifiedPath.toString()}`, Logic.DiagnosticSeverity.Hint);
    }
  }

  private checkStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCase: (value: Fmt.Expression, context: HLMCheckerContext) => void, checkCompatibility: ((values: Fmt.Expression[]) => void) | undefined, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, getWellDefinednessProofGoal: (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => Fmt.Expression, context: HLMCheckerContext): void {
    this.checkStructuralCaseTerm(term, construction, replaceCases, context);
    if (construction instanceof Fmt.DefinitionRefExpression) {
      let constructionPath = construction.path;
      let constructionPathWithoutArguments = new Fmt.Path;
      constructionPathWithoutArguments.name = constructionPath.name;
      constructionPathWithoutArguments.parentPath = constructionPath.parentPath;
      let index = 0;
      let checkConstructor = (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor,  substitutedParameters: Fmt.ParameterList) => {
        if (index < cases.length) {
          let structuralCase = cases[index];
          if (structuralCase._constructor instanceof Fmt.DefinitionRefExpression) {
            let constructorPath = structuralCase._constructor.path;
            if (!(constructorPath.parentPath instanceof Fmt.Path && constructorPath.parentPath.isEquivalentTo(constructionPathWithoutArguments))) {
              this.error(structuralCase._constructor, 'Constructor path must match construction path (without arguments)');
            }
            if (constructorPath.name === constructorDefinition.name) {
              if (structuralCase.parameters) {
                if (!structuralCase.parameters.isEquivalentTo(substitutedParameters)) {
                  this.error(structuralCase.parameters, 'Case parameters must match constructor parameters');
                }
              } else if (substitutedParameters.length) {
                this.error(structuralCase, 'Parameter list required');
              }
              let caseContext: HLMCheckerContext = {
                ...context,
                parentStructuralCases: context.parentStructuralCases.concat({
                  term: term,
                  construction: construction,
                  _constructor: structuralCase._constructor,
                  parameters: structuralCase.parameters
                })
              };
              if (structuralCase.parameters) {
                caseContext = this.getParameterListContext(structuralCase.parameters, caseContext);
              }
              let constraintParam = this.utils.createStructuralCaseConstraintParameter(term, constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents);
              caseContext = this.getParameterContext(constraintParam, caseContext);
              checkCase(structuralCase.value, caseContext);
              if ((constructorContents.equalityDefinition && !(constructorContents.equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true)) || structuralCase.wellDefinednessProof) {
                let clonedParameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
                let replacedParameters: Fmt.ReplacedParameter[] = [];
                let clonedValue = structuralCase.value;
                if (structuralCase.parameters) {
                  structuralCase.parameters.clone(clonedParameters, replacedParameters);
                  clonedValue = this.utils.substituteParameters(structuralCase.value, structuralCase.parameters, clonedParameters);
                }
                clonedParameters.push(constraintParam.clone(replacedParameters));
                let goalContext = this.getParameterListContext(clonedParameters, caseContext);
                this.checkProof(structuralCase.wellDefinednessProof, clonedParameters, getWellDefinednessProofGoal(structuralCase.value, clonedValue, goalContext, clonedParameters), caseContext);
              }
            } else {
              this.error(structuralCase._constructor, `Expected reference to constructor "${constructorDefinition.name}"`);
            }
          } else {
            this.error(structuralCase._constructor, 'Constructor reference expected');
          }
        } else {
          this.error(term, `Missing case for constructor "${constructorDefinition.name}"`);
        }
        index++;
      };
      let checkCases = this.forAllConstructors(construction, checkConstructor)
        .then(() => {
          if (index < cases.length) {
            this.error(term, 'Too many cases');
          }
        })
        .catch((error) => this.error(term, error.message));
      this.addPendingCheck(checkCases);
    } else if (!(construction instanceof Fmt.PlaceholderExpression)) {
      this.error(construction, 'Construction reference expected');
    }

    if (checkCompatibility) {
      let values = cases.map((structuralCase: FmtHLM.ObjectContents_StructuralCase) => structuralCase.value);
      checkCompatibility(values);
    }
  }

  private checkStructuralCaseTerm(term: Fmt.Expression, construction: Fmt.Expression, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, context: HLMCheckerContext): void {
    let recheckFn = (substitutedTerm: Fmt.Expression, recheckContext: HLMCheckerContext) => this.checkStructuralCaseTerm(substitutedTerm, construction, replaceCases, recheckContext);
    let autoFillFn = undefined;
    if (context.editData && construction instanceof Fmt.PlaceholderExpression) {
      autoFillFn = (placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn) => {
        let filledConstruction = placeholderValues.get(construction);
        if (filledConstruction instanceof Fmt.DefinitionRefExpression) {
          let constructionPathWithoutArguments = new Fmt.Path;
          constructionPathWithoutArguments.name = filledConstruction.path.name;
          constructionPathWithoutArguments.parentPath = filledConstruction.path.parentPath;
          let newCases: FmtHLM.ObjectContents_StructuralCase[] = [];
          let newParameterLists: Fmt.ParameterList[] = [];
          let addCase = (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => {
            let newCase = new FmtHLM.ObjectContents_StructuralCase;
            let constructorPath = new Fmt.Path;
            constructorPath.name = constructorDefinition.name;
            constructorPath.parentPath = constructionPathWithoutArguments;
            let constructorExpression = new Fmt.DefinitionRefExpression;
            constructorExpression.path = constructorPath;
            newCase._constructor = constructorExpression;
            if (substitutedParameters.length) {
              let clonedParameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
              substitutedParameters.clone(clonedParameters);
              newCase.parameters = clonedParameters;
              newParameterLists.push(clonedParameters);
            }
            if ((constructorDefinition.contents as FmtHLM.ObjectContents_Constructor).rewrite) {
              newCase.rewrite = new FmtHLM.MetaRefExpression_true;
            }
            newCases.push(newCase);
          };
          return this.forAllConstructors(filledConstruction, addCase)
            .then(() => {
              let substitution = replaceCases(newCases);
              onFillExpression(substitution.originalExpression, substitution.filledExpression, newParameterLists);
            });
        }
        return CachedPromise.resolve();
      };
    }
    context = this.setCurrentRecheckFn(term, recheckFn, autoFillFn, context);
    this.checkElementTerm(term, context);
    this.checkSetTerm(construction, this.getAutoFillContext(context));
    let typeSearchParameters: HLMTypeSearchParameters = {
      followDefinitions: true,
      followSupersets: true,
      followEmbeddings: false,
      unfoldFixedSubterms: false,
      extractStructuralCasesFromFixedSubterms: false
    };
    let checkConstructionRef = this.utils.getFinalSet(term, typeSearchParameters)
      .then((finalSet: Fmt.Expression) => {
        if (!((finalSet instanceof Fmt.DefinitionRefExpression || finalSet instanceof Fmt.PlaceholderExpression)
              && this.checkSetTermEquivalence(construction, finalSet, context))) {
          this.error(term, 'Term must be an element of the specified construction');
        }
      })
      .catch((error) => this.conditionalError(term, error.message));
    this.addPendingCheck(checkConstructionRef);
  }

  private forAllConstructors(construction: Fmt.DefinitionRefExpression, callbackFn: (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, contents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => void): CachedPromise<void> {
    let constructionPathWithoutArguments = new Fmt.Path;
    constructionPathWithoutArguments.name = construction.path.name;
    constructionPathWithoutArguments.parentPath = construction.path.parentPath;
    return this.utils.getOuterDefinition(construction)
      .then((constructionDefinition: Fmt.Definition) => {
        if (constructionDefinition.contents instanceof FmtHLM.ObjectContents_Construction) {
          for (let constructorDefinition of constructionDefinition.innerDefinitions) {
            if (constructorDefinition.contents instanceof FmtHLM.ObjectContents_Constructor) {
              let substitutionContext = new HLMSubstitutionContext;
              this.utils.addPathSubstitution(construction.path, [constructionDefinition], substitutionContext);
              let substitutedParameters = this.utils.applySubstitutionContextToParameterList(constructorDefinition.parameters, substitutionContext);
              callbackFn(constructionDefinition, constructionDefinition.contents, constructorDefinition, constructorDefinition.contents, substitutedParameters);
            }
          }
        } else {
          this.error(construction, 'Referenced definition must be a construction');
        }
      });
  }

  private checkPlaceholderExpression(expression: Fmt.PlaceholderExpression, expressionType: HLMExpressionType, context: HLMCheckerContext): void {
    if (!this.supportPlaceholders) {
      this.error(expression, 'Unexpected placeholder');
    }
    if (expression.placeholderType !== expressionType) {
      if (expression.placeholderType === undefined) {
        // Correct placeholders that were read from a file and thus don't know their type.
        expression.placeholderType = expressionType;
      } else {
        this.error(expression, 'Placeholder type mismatch');
      }
    }
    if (context.currentPlaceholderCollection && !expression.isTemporary) {
      if (context.currentPlaceholderCollection.placeholders) {
        context.currentPlaceholderCollection.placeholders = [...context.currentPlaceholderCollection.placeholders, expression];
      } else {
        context.currentPlaceholderCollection.placeholders = [expression];
      }
      for (let placeholderCollection: HLMCheckerPlaceholderCollection | undefined = context.currentPlaceholderCollection; placeholderCollection && !placeholderCollection.containsNonAutoPlaceholders; placeholderCollection = placeholderCollection.parentCollection) {
        if (!context.inAutoArgument) {
          placeholderCollection.containsNonAutoPlaceholders = true;
        }
        placeholderCollection.unfilledPlaceholderCount++;
      }
    }
  }

  private checkEquivalenceList(object: Object, list: Fmt.Expression[], equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, checkItem: (expression: Fmt.Expression, context: HLMCheckerContext) => void, checkCompatibility: ((expressions: Fmt.Expression[], context: HLMCheckerContext) => void) | undefined, getEquivalenceGoal: (from: Fmt.Expression, to: Fmt.Expression, equivalenceContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => Fmt.Expression, context: HLMCheckerContext): void {
    if (list.length) {
      for (let item of list) {
        let currentContext = context;
        if (checkCompatibility) {
          let recheckFn = (substitutedItem: Fmt.Expression, recheckContext: HLMCheckerContext) => {
            let substitutedList = list.map((originalItem: Fmt.Expression) => originalItem === item ? substitutedItem : originalItem);
            this.checkEquivalenceList(object, substitutedList, undefined, checkItem, checkCompatibility, getEquivalenceGoal, recheckContext);
          };
          currentContext = this.setCurrentRecheckFn(item, recheckFn, undefined, currentContext);
        }
        checkItem(item, currentContext);
      }
      if (checkCompatibility) {
        checkCompatibility(list, context);
      }
      this.checkEquivalenceProofs(equivalenceProofs, list, getEquivalenceGoal, context);
    } else {
      this.error(object, 'At least one item expected');
    }
  }

  private checkSetTermEquivalenceList(object: Object, list: Fmt.Expression[], equalityProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    let checkCompatibility = (terms: Fmt.Expression[], checkContext: HLMCheckerContext) => this.checkSetCompatibility(object, terms, checkContext);
    let checkItem = (term: Fmt.Expression, termContext: HLMCheckerContext) => this.checkSetTerm(term, termContext);
    let getEquivalenceGoal = (from: Fmt.Expression, to: Fmt.Expression) => {
      let goal = new FmtHLM.MetaRefExpression_sub;
      goal.subset = from;
      goal.superset = to;
      return goal;
    };
    this.checkEquivalenceList(object, list, equalityProofs, checkItem, checkCompatibility, getEquivalenceGoal, context);
  }

  private checkElementTermEquivalenceList(object: Object, list: Fmt.Expression[], equalityProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    let checkCompatibility = (terms: Fmt.Expression[], checkContext: HLMCheckerContext) => this.checkElementCompatibility(object, terms, checkContext);
    let checkItem = (term: Fmt.Expression, termContext: HLMCheckerContext) => this.checkElementTerm(term, termContext);
    let getEquivalenceGoal = (from: Fmt.Expression, to: Fmt.Expression) => {
      let goal = new FmtHLM.MetaRefExpression_equals;
      goal.terms = [from, to];
      return goal;
    };
    this.checkEquivalenceList(object, list, equalityProofs, checkItem, checkCompatibility, getEquivalenceGoal, context);
  }

  private checkFormulaEquivalenceList(object: Object, list: Fmt.Expression[], equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    let checkItem = (formula: Fmt.Expression, itemContext: HLMCheckerContext) => this.checkFormula(formula, itemContext);
    let getEquivalenceGoal = (from: Fmt.Expression, to: Fmt.Expression, equivalenceContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => {
      let constraintType = new FmtHLM.MetaRefExpression_Constraint;
      constraintType.formula = from;
      proofParameters.push(this.utils.createParameter(constraintType, '@'));
      return to;
    };
    this.checkEquivalenceList(object, list, equivalenceProofs, checkItem, undefined, getEquivalenceGoal, context);
  }

  private checkProof(proof: FmtHLM.ObjectContents_Proof | undefined, parameters: Fmt.ParameterList | undefined, goal: Fmt.Expression, context: HLMCheckerContext): void {
    let innerContext = context;
    if (proof) {
      if (proof.parameters) {
        if (!parameters || !proof.parameters.isEquivalentTo(parameters)) {
          this.error(proof.parameters, 'Invalid proof parameters');
        }
        innerContext = this.getParameterListContext(proof.parameters, context);
      } else if (parameters) {
        this.error(proof, 'Parameter list required');
      }
      if (proof.goal) {
        this.checkFormula(proof.goal, innerContext);
        this.checkUnfolding(goal, proof.goal, innerContext);
      }
      // TODO
    } else {
      if (parameters) {
        innerContext = this.getParameterListContext(parameters, context);
      }
      this.checkTrivialProvability(goal, innerContext);
    }
  }

  private checkProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, goal: Fmt.Expression, context: HLMCheckerContext): void {
    if (proofs) {
      for (let proof of proofs) {
        this.checkProof(proof, undefined, goal, context);
      }
    }
  }

  private checkEquivalenceProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, items: Fmt.Expression[], getEquivalenceGoal: (from: Fmt.Expression, to: Fmt.Expression, equivalenceContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => Fmt.Expression, context: HLMCheckerContext): void {
    if (proofs) {
      for (let proof of proofs) {
        if (proof._from === undefined || proof._to === undefined) {
          this.error(proof, 'from/to required');
        } else {
          let fromIndex = proof._from.toNumber() - 1;
          let toIndex = proof._to.toNumber() - 1;
          if (fromIndex < 0 || fromIndex >= items.length) {
            this.error(proof, 'invalid from index');
          } else if (toIndex < 0 || toIndex >= items.length) {
            this.error(proof, 'invalid to index');
          } else {
            let proofParameters: Fmt.ParameterList | undefined = Object.create(Fmt.ParameterList.prototype);
            let goal = getEquivalenceGoal(items[fromIndex], items[toIndex], context, proofParameters!);
            if (!proofParameters!.length) {
              proofParameters = undefined;
            }
            this.checkProof(proof, proofParameters, goal, context);
          }
        }
      }
    }
  }

  private checkUnfolding(source: Fmt.Expression, target: Fmt.Expression, context: HLMCheckerContext): void {
    // TODO
  }

  private checkTrivialProvability(goal: Fmt.Expression, context: HLMCheckerContext): void {
    // TODO
  }

  private checkBoolConstant(expression: Fmt.Expression | undefined): void {
    if (expression === undefined || expression instanceof FmtHLM.MetaRefExpression_false || expression instanceof FmtHLM.MetaRefExpression_true) {
      // Nothing further to check.
    } else {
      this.error(expression, 'Boolean value expected');
    }
  }

  private checkCompatibility(object: Object, setTerms: Fmt.Expression[], elementTerms: Fmt.Expression[], context: HLMCheckerContext): void {
    let declaredSetsPromise = CachedPromise.resolve(setTerms);
    for (let elementTerm of elementTerms) {
      declaredSetsPromise = declaredSetsPromise.then((declaredSets: Fmt.Expression[]) =>
        this.utils.getDeclaredSet(elementTerm).then((declaredSet: Fmt.Expression) => declaredSets.concat(declaredSet))
      );
    }
    let checkDeclaredSets = declaredSetsPromise
      .then((declaredSets: Fmt.Expression[]) => {
        this.checkSetCompatibilityInternal(object, declaredSets, context, {
          directEquivalenceUnlikely: false,
          checkedForDirectEquivalence: false,
          obtainedFinalSets: false,
          followedEmbeddings: false,
          addedStructuralCases: false
        });
      })
      .catch((error) => this.conditionalError(object, error.message));
    this.addPendingCheck(checkDeclaredSets);
  }

  private checkSetCompatibility(object: Object, setTerms: Fmt.Expression[], context: HLMCheckerContext): CachedPromise<Fmt.Expression> {
    return this.checkSetCompatibilityInternal(object, setTerms, context, {
      directEquivalenceUnlikely: true,
      checkedForDirectEquivalence: false,
      obtainedFinalSets: false,
      followedEmbeddings: false,
      addedStructuralCases: false
    });
  }

  private checkElementCompatibility(object: Object, elementTerms: Fmt.Expression[], context: HLMCheckerContext): void {
    if (elementTerms.length > 1) {
      this.checkCompatibility(object, [], elementTerms, context);
    }
  }

  private checkSetCompatibilityInternal(object: Object, setTerms: Fmt.Expression[], context: HLMCheckerContext, status: HLMCheckerCompatibilityStatus): CachedPromise<Fmt.Expression> {
    if (setTerms.length === 0) {
      return CachedPromise.resolve(this.utils.getWildcardFinalSet());
    } else if (setTerms.length === 1) {
      return CachedPromise.resolve(setTerms[0]);
    } else {
      if (status.obtainedFinalSets && status.followedEmbeddings && status.addedStructuralCases) {
        let firstTerm = setTerms[0];
        for (let index = 1; index < setTerms.length; index++) {
          let term = setTerms[index];
          if (status.checkedForDirectEquivalence || !this.checkSetTermEquivalence(firstTerm, term, context)) {
            this.error(object, 'Type mismatch');
            return CachedPromise.reject();
          }
        }
        return CachedPromise.resolve(firstTerm);
      } else {
        let checkForDirectEquivalence = !status.directEquivalenceUnlikely && !status.checkedForDirectEquivalence;
        let nextSetTermsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        let nextStatus: HLMCheckerCompatibilityStatus = {
          directEquivalenceUnlikely: false,
          checkedForDirectEquivalence: status.checkedForDirectEquivalence || checkForDirectEquivalence,
          obtainedFinalSets: true,
          followedEmbeddings: status.obtainedFinalSets,
          addedStructuralCases: status.followedEmbeddings || !context.parentStructuralCases.length
        };
        let typeSearchParameters: HLMTypeSearchParameters = {
          followDefinitions: true,
          followSupersets: true,
          followEmbeddings: nextStatus.followedEmbeddings,
          unfoldFixedSubterms: nextStatus.followedEmbeddings,
          extractStructuralCasesFromFixedSubterms: nextStatus.followedEmbeddings
        };
        if (nextStatus.addedStructuralCases && context.parentStructuralCases.length) {
          for (let index = 0; index < setTerms.length; index++) {
            let term = setTerms[index];
            for (let structuralCaseRef of context.parentStructuralCases) {
              term = this.utils.buildSingleStructuralCaseTerm(structuralCaseRef.term, structuralCaseRef.construction, structuralCaseRef._constructor, structuralCaseRef.parameters, term, HLMExpressionType.SetTerm);
            }
            setTerms[index] = term;
          }
        }
        let firstTerm = setTerms[0];
        for (let index = 1; index < setTerms.length; index++) {
          let term = setTerms[index];
          if (!checkForDirectEquivalence || !this.checkSetTermEquivalence(firstTerm, term, context)) {
            nextSetTermsPromise = nextSetTermsPromise.then((nextSetTerms: Fmt.Expression[]) =>
              this.utils.getFinalSuperset(term, typeSearchParameters).then((finalSuperset: Fmt.Expression) => {
                if (this.utils.isWildcardFinalSet(finalSuperset)) {
                  return nextSetTerms;
                } else {
                  if (finalSuperset !== term) {
                    nextStatus.checkedForDirectEquivalence = false;
                  }
                  return nextSetTerms.concat(finalSuperset);
                }
              })
            );
          }
        }
        nextSetTermsPromise = nextSetTermsPromise.then((nextSetTerms: Fmt.Expression[]) => {
          if (nextSetTerms.length) {
            return this.utils.getFinalSuperset(firstTerm, typeSearchParameters).then((finalSuperset: Fmt.Expression) => {
              if (this.utils.isWildcardFinalSet(finalSuperset)) {
                return nextSetTerms;
              } else {
                if (finalSuperset !== firstTerm) {
                  nextStatus.checkedForDirectEquivalence = false;
                }
                return [finalSuperset, ...nextSetTerms];
              }
            });
          } else {
            return [firstTerm];
          }
        });
        let nextSetCompatibilityPromise = nextSetTermsPromise
          .then((nextSetTerms: Fmt.Expression[]) => this.checkSetCompatibilityInternal(object, nextSetTerms, context, nextStatus));
        let checkNextSetTerms = nextSetCompatibilityPromise
          .then(() => {})
          .catch((error) => error && this.conditionalError(object, error.message));
        this.addPendingCheck(checkNextSetTerms);
        return nextSetCompatibilityPromise;
      }
    }
  }

  private checkSetTermEquivalence(left: Fmt.Expression, right: Fmt.Expression, context: HLMCheckerContext): boolean {
    let state: HLMCheckerPlaceholderRestrictionState = {
      exactValueRequried: left instanceof Fmt.DefinitionRefExpression && right instanceof Fmt.DefinitionRefExpression,
      context: context
    };
    let unificationFn: Fmt.ExpressionUnificationFn | undefined = undefined;
    let defaultUnificationFn = (leftExpression: Fmt.Expression, rightExpression: Fmt.Expression, replacedParameters: Fmt.ReplacedParameter[]): boolean => {
      // Make structural cases commute. I.e. when finding a nested structural case term on the right, also check other nesting possibilities.
      // Of course, this only works for inner cases that do not depend on parameters of outer cases.
      if (rightExpression instanceof FmtHLM.MetaRefExpression_setStructuralCases && rightExpression.cases.length === 1) {
        let structuralCase = rightExpression.cases[0];
        let innerExpression = structuralCase.value;
        if (innerExpression instanceof FmtHLM.MetaRefExpression_setStructuralCases && innerExpression.cases.length === 1) {
          let clonedExpression = rightExpression.clone() as FmtHLM.MetaRefExpression_setStructuralCases;
          let clonedCase = clonedExpression.cases[0];
          let currentInnerExpression = clonedCase.value;
          while (currentInnerExpression instanceof FmtHLM.MetaRefExpression_setStructuralCases && currentInnerExpression.cases.length === 1) {
            // Cut out the current inner expression.
            let nextInnerExpression = currentInnerExpression.cases[0].value;
            clonedCase.value = nextInnerExpression;
            // Attach it to the front.
            currentInnerExpression.cases[0].value = clonedExpression;
            clonedExpression = currentInnerExpression;
            // Check it.
            let innerUnificationFn = (innerLeftExpression: Fmt.Expression, innerRightExpression: Fmt.Expression, innerReplacedParameters: Fmt.ReplacedParameter[]): boolean => {
              // Avoid infinite recursion.
              if (unificationFn && innerLeftExpression !== leftExpression) {
                return unificationFn(innerLeftExpression, innerRightExpression, innerReplacedParameters);
              }
              return false;
            };
            if (leftExpression.isEquivalentTo(clonedExpression, innerUnificationFn, replacedParameters)) {
              return true;
            }
            currentInnerExpression = nextInnerExpression;
          }
        }
      }
      return false;
    };
    unificationFn = defaultUnificationFn;
    if (context.editData) {
      // Handle placeholders.
      unificationFn = (leftExpression: Fmt.Expression, rightExpression: Fmt.Expression, replacedParameters: Fmt.ReplacedParameter[]): boolean => {
        if (leftExpression instanceof FmtHLM.MetaRefExpression_enumeration && leftExpression.terms && leftExpression.terms.length === 1) {
          let leftElement = leftExpression.terms[0];
          if (leftElement instanceof Fmt.PlaceholderExpression) {
            if (!replacedParameters.length) {
              this.addDeclaredSetRestriction(state, leftElement, rightExpression);
            }
            return true;
          }
        }
        if (rightExpression instanceof FmtHLM.MetaRefExpression_enumeration && rightExpression.terms && rightExpression.terms.length === 1) {
          let rightElement = rightExpression.terms[0];
          if (rightElement instanceof Fmt.PlaceholderExpression) {
            if (!replacedParameters.length) {
              this.addDeclaredSetRestriction(state, rightElement, leftExpression);
            }
            return true;
          }
        }
        let recheck = false;
        let isRoot = leftExpression === left && rightExpression === right;
        while (leftExpression instanceof Fmt.PlaceholderExpression) {
          let newLeftExpression = this.addCompatibleTermRestriction(state, leftExpression, replacedParameters.length ? undefined : rightExpression);
          if (newLeftExpression) {
            leftExpression = newLeftExpression;
            recheck = true;
          } else {
            return true;
          }
        }
        while (rightExpression instanceof Fmt.PlaceholderExpression) {
          let newRightExpression = this.addCompatibleTermRestriction(state, rightExpression, replacedParameters.length ? undefined : leftExpression);
          if (newRightExpression) {
            rightExpression = newRightExpression;
            recheck = true;
          } else {
            return true;
          }
        }
        if (isRoot && leftExpression instanceof Fmt.DefinitionRefExpression && rightExpression instanceof Fmt.DefinitionRefExpression) {
          state.exactValueRequried = true;
        }
        if (recheck) {
          return leftExpression.isEquivalentTo(rightExpression, unificationFn, replacedParameters);
        } else {
          return defaultUnificationFn(leftExpression, rightExpression, replacedParameters);
        }
      };
    }

    if (left.isEquivalentTo(right, unificationFn)) {
      if (context.editData && state.newRestrictions) {
        context.editData.restrictions = state.newRestrictions;
      }
      return true;
    } else {
      return false;
    }
  }

  private addCompatibleTermRestriction(state: HLMCheckerPlaceholderRestrictionState, placeholder: Fmt.PlaceholderExpression, expression: Fmt.Expression | undefined): Fmt.Expression | undefined {
    let currentRestrictions = state.newRestrictions || state.context.editData!.restrictions;
    let restriction = currentRestrictions.get(placeholder);
    if (restriction && restriction.exactValue) {
      return restriction.exactValue;
    }
    if (!expression) {
      return undefined;
    }
    let addToCompatibleSets = placeholder.placeholderType === HLMExpressionType.SetTerm && !(restriction && HLMDefinitionChecker.containsEquivalentItem(restriction.compatibleSets, expression));
    let setExactValueSuggestion = !(expression instanceof Fmt.PlaceholderExpression);
    if (addToCompatibleSets || setExactValueSuggestion) {
      if (restriction) {
        restriction = {...restriction};
      } else {
        restriction = {
          compatibleSets: [],
          declaredSets: [],
          context: state.context
        };
      }
      let restrictionModified = false;
      if (addToCompatibleSets) {
        restriction.compatibleSets = [...restriction.compatibleSets, expression];
        restrictionModified = true;
      }
      if (setExactValueSuggestion) {
        if (state.exactValueRequried && !restriction.exactValue) {
          restriction.exactValueSuggestion = expression;
          restriction.exactValue = expression;
          restrictionModified = true;
        } else if (!restriction.exactValueSuggestion) {
          restriction.exactValueSuggestion = expression;
          restrictionModified = true;
        }
      }
      if (restrictionModified) {
        if (!state.newRestrictions) {
          state.newRestrictions = new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>(state.context.editData!.restrictions);
        }
        state.newRestrictions.set(placeholder, restriction);
      }
    }
    return undefined;
  }

  private addDeclaredSetRestriction(state: HLMCheckerPlaceholderRestrictionState, placeholder: Fmt.PlaceholderExpression, declaredSet: Fmt.Expression): void {
    if (placeholder.placeholderType === undefined) {
      return;
    }
    let currentRestrictions = state.newRestrictions || state.context.editData!.restrictions;
    let restriction = currentRestrictions.get(placeholder);
    if (restriction && HLMDefinitionChecker.containsEquivalentItem(restriction.declaredSets, declaredSet)) {
      return;
    }
    if (!state.newRestrictions) {
      state.newRestrictions = new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>(state.context.editData!.restrictions);
      restriction = state.newRestrictions.get(placeholder);
    }
    if (restriction) {
      restriction = {
        ...restriction,
        declaredSets: [...restriction.declaredSets, declaredSet]
      };
    } else {
      restriction = {
        compatibleSets: [],
        declaredSets: [declaredSet],
        context: state.context
      };
    }
    state.newRestrictions.set(placeholder, restriction);
  }

  private static containsEquivalentItem(list: Fmt.Expression[], expression: Fmt.Expression): boolean {
    return list.some((item: Fmt.Expression) => expression.isEquivalentTo(item));
  }

  private checkIsomorphicProperty(leftParameters: Fmt.ParameterList, rightParameters: Fmt.ParameterList, formula: Fmt.Expression, context: HLMCheckerContext): void {
    // TODO
  }

  private addPendingCheck(check: CachedPromise<void>): void {
    this.pendingChecks.push(() => check);
  }

  private message(object: Object, message: string, severity: Logic.DiagnosticSeverity): void {
    this.result.diagnostics.push({
      object: object,
      message: message,
      severity: severity
    });
  }

  private error(object: Object, message: string): void {
    this.message(object, message, Logic.DiagnosticSeverity.Error);
    this.result.hasErrors = true;
  }

  private conditionalError(object: Object, message: string): void {
    if (!this.result.hasErrors) {
      this.error(object, message);
    }
  }
}
