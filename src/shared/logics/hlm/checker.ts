import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as FmtUtils from '../../format/utils';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as HLMMacros from './macros/macros';
import { HLMExpressionType } from './hlm';
import { HLMUtils, HLMSubstitutionContext, HLMTypeSearchParameters, HLMBaseContext, HLMProofStepContext, HLMFormulaCase, HLMFormulaDefinition, HLMEquivalenceListInfo } from './utils';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

const debugRecheck = true;

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, options: Logic.LogicCheckerOptions): CachedPromise<Logic.LogicCheckResult> {
    let utils = new HLMUtils(definition, libraryDataAccessor, options.supportPlaceholders);
    let definitionChecker = new HLMDefinitionChecker(definition, libraryDataAccessor, utils, options);
    return definitionChecker.checkDefinition();
  }
}

export interface HLMCheckerStructuralCaseRef {
  term: Fmt.Expression;
  construction: Fmt.Expression;
  _constructor: Fmt.Expression;
  parameters: Fmt.ParameterList | undefined;
}

type HLMCheckerRecheckFn = (originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression) => HLMCheckerContext;
type HLMCheckerCheckFormulaFn = (formula: Fmt.Expression) => HLMCheckerContext;
type HLMCheckerFillExpressionFn = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => void;

export interface HLMCheckerContext extends HLMBaseContext {
  context: Ctx.Context;
  binderSourceParameters: Fmt.Parameter[];
  temporaryParameters: Fmt.Parameter[];
  parentStructuralCases: HLMCheckerStructuralCaseRef[];
  inAutoArgument: boolean;
  editData?: HLMCheckerEditData;
  currentRecheckFn?: HLMCheckerRecheckFn;
  currentPlaceholderCollection?: HLMCheckerPlaceholderCollection;
  rechecking: boolean;
}

export interface HLMCheckerProofStepContext extends HLMCheckerContext, HLMProofStepContext {
}

export interface HLMCheckResult extends Logic.LogicCheckResult {
  incompleteProofs: Map<Fmt.ParameterList, HLMCheckerProofStepContext>;
}

export interface HLMCheckResultWithExpression extends HLMCheckResult {
  expression: Fmt.Expression;
}

interface HLMCheckerCompatibilityStatus {
  directEquivalenceUnlikely: boolean;
  checkedForDirectEquivalence: boolean;
  obtainedFinalSets: boolean;
  followedEmbeddings: boolean;
  addedStructuralCases: boolean;
}

const initialCompatibilityStatus: HLMCheckerCompatibilityStatus = {
  directEquivalenceUnlikely: false,
  checkedForDirectEquivalence: false,
  obtainedFinalSets: false,
  followedEmbeddings: false,
  addedStructuralCases: false
};
const initialCompatibilityStatusWithoutElements: HLMCheckerCompatibilityStatus = {
  directEquivalenceUnlikely: true,
  checkedForDirectEquivalence: false,
  obtainedFinalSets: false,
  followedEmbeddings: false,
  addedStructuralCases: false
};

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

export interface HLMCheckerConstraint {
  parameter?: Fmt.Parameter;
  constraint: Fmt.Expression;
  isImmediate: boolean;
}

// TODO create pending checks on demand only, so that they can be omitted during rechecking if hasErrors is already true
type PendingCheck = () => CachedPromise<void>;

export class HLMDefinitionChecker {
  private rootContext: HLMCheckerContext;
  private result: HLMCheckResult;
  private pendingChecks: PendingCheck[] = [];
  private pendingChecksPromise?: CachedPromise<HLMCheckResult>;

  constructor(private definition: Fmt.Definition, private libraryDataAccessor: LibraryDataAccessor, private utils: HLMUtils, private options: Logic.LogicCheckerOptions) {
    this.reset();
  }

  private reset(): void {
    this.rootContext = {
      context: new Ctx.EmptyContext(FmtHLM.metaModel),
      binderSourceParameters: [],
      temporaryParameters: [],
      parentStructuralCases: [],
      inAutoArgument: false,
      stepResults: new Map<Fmt.Parameter, Fmt.Expression>(),
      rechecking: false
    };
    if (this.options.supportPlaceholders) {
      this.rootContext.editData = {
        restrictions: new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>(),
        recheckFns: this.options.supportRechecking ? new Map<Fmt.Expression, HLMCheckerRecheckFn>() : undefined,
        constraintCheckFns: this.options.supportRechecking ? new Map<Fmt.ParameterList, HLMCheckerCheckFormulaFn>() : undefined
      };
      this.rootContext.currentPlaceholderCollection = {
        containsNonAutoPlaceholders: false,
        unfilledPlaceholderCount: 0
      };
    }
    this.resetResult();
  }

  private resetResult(): void {
    this.result = {
      diagnostics: [],
      incompleteProofs: new Map<Fmt.ParameterList, HLMCheckerProofStepContext>(),
      hasErrors: false
    };
  }

  checkDefinition(): CachedPromise<HLMCheckResult> {
    return this.check(() => this.checkRootDefinition());
  }

  checkExpression(expression: Fmt.Expression, expressionType: HLMExpressionType, context: Ctx.Context): CachedPromise<HLMCheckResult> {
    return this.check(() => {
      let checkContext: HLMCheckerContext = {
        ...this.rootContext,
        context: context
      };
      switch (expressionType) {
      case HLMExpressionType.SetTerm:
        this.checkSetTerm(expression, checkContext);
        break;
      case HLMExpressionType.ElementTerm:
        this.checkElementTerm(expression, checkContext);
        break;
      case HLMExpressionType.Formula:
        this.checkFormula(expression, checkContext);
        break;
      }
    });
  }

  checkSingleProofStep(step: Fmt.Parameter, context: HLMCheckerProofStepContext): CachedPromise<HLMCheckResult> {
    return this.check(() => {
      let checkContext: HLMCheckerProofStepContext = {
        ...context,
        editData: this.rootContext.editData,
        currentRecheckFn: undefined,
        currentPlaceholderCollection: this.rootContext.currentPlaceholderCollection,
        rechecking: false
      };
      this.checkProofStep(step, checkContext);
    });
  }

  private check(checkFn: () => void): CachedPromise<HLMCheckResult> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.checkDefinition());
    } else {
      this.reset();
      try {
        checkFn();
      } catch (error) {
        this.error(this.definition, error.message);
      }
      return this.getPendingChecksPromise();
    }
  }

  recheckWithSubstitution(originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression): CachedPromise<HLMCheckResultWithExpression> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.recheckWithSubstitution(originalExpression, substitutedExpression));
    } else {
      if (debugRecheck) {
        console.log(`Checking ${substitutedExpression}...`);
      }
      this.resetResult();
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

  checkConstraint(parameterList: Fmt.ParameterList, formula: Fmt.Expression): CachedPromise<HLMCheckResultWithExpression> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.checkConstraint(parameterList, formula));
    } else {
      if (debugRecheck) {
        console.log(`Checking ${formula}...`);
      }
      this.resetResult();
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

  private getRecheckResult(expression: Fmt.Expression, recheckContext: HLMCheckerContext | undefined): CachedPromise<HLMCheckResultWithExpression> {
    return this.getPendingChecksPromise().then((result: HLMCheckResult) => {
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
                return this.checkSetCompatibilityInternal(placeholder, compatibleSets, false, context, initialCompatibilityStatusWithoutElements).then((superset: Fmt.Expression | undefined) => {
                  if (superset && !(superset instanceof Fmt.PlaceholderExpression)) {
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
          filledExpression = FmtUtils.substituteExpression(filledExpression, originalPlaceholderExpression, filledPlaceholderExpression);
        };
        this.autoFillPlaceholders(placeholderValues, onFillInnerPlaceholder);
        onFillExpression(originalExpression, filledExpression, newParameterLists);
      };
      result = result.then(() => placeholderCollection.autoFillFn!(placeholderValues, onFillExpressionWithPlaceholders));
    }
    return result;
  }

  private getPendingChecksPromise(): CachedPromise<HLMCheckResult> {
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
    if (contents.rewrite) {
      this.checkConstructionRewriteDefinition(contents.rewrite, context);
    }
  }

  private checkConstructor(innerDefinition: Fmt.Definition, innerContents: FmtHLM.ObjectContents_Constructor, context: HLMCheckerContext, innerContext: HLMCheckerContext): void {
    if (innerContents.equalityDefinition) {
      this.checkEqualityDefinition(innerDefinition, innerContents.equalityDefinition, context);
    } else if (innerDefinition.parameters.length) {
      this.error(innerDefinition, 'Constructor with parameters requires equality definition');
    }
    if (innerContents.rewrite) {
      this.checkConstructorRewriteDefinition(innerDefinition, innerContents.rewrite, innerContext);
    }
  }

  private checkEqualityDefinition(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_ConstructorEqualityDefinition, context: HLMCheckerContext): void {
    let constructorParameters = innerDefinition.parameters;
    if (!equalityDefinition.leftParameters.isEquivalentTo(constructorParameters)) {
      this.error(equalityDefinition.leftParameters, 'Parameters of equality definition must match constructor parameters');
    }
    if (!equalityDefinition.rightParameters.isEquivalentTo(constructorParameters)) {
      this.error(equalityDefinition.rightParameters, 'Parameters of equality definition must match constructor parameters');
    }
    this.checkFormulaEquivalenceList(innerDefinition, equalityDefinition.definition, equalityDefinition.equivalenceProofs, context);
    if (equalityDefinition.definition.length) {
      this.checkEqualityDefinitionProofs(innerDefinition, equalityDefinition, context);
    }
  }

  private checkEqualityDefinitionProofs(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_ConstructorEqualityDefinition, context: HLMCheckerContext): void {
    let isomorphic = (equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true);
    if (isomorphic) {
      this.checkIsomorphicProperty(equalityDefinition.leftParameters, equalityDefinition.rightParameters, equalityDefinition.definition[0], context);
    }
    if (!isomorphic || equalityDefinition.reflexivityProof) {
      let parameters = innerDefinition.parameters.clone();
      let goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters, parameters);
      this.checkProof(equalityDefinition, equalityDefinition.reflexivityProof, parameters, goal, context);
    }
    if (!isomorphic || equalityDefinition.symmetryProof) {
      let parameters1 = innerDefinition.parameters.clone();
      let parameters2 = innerDefinition.parameters.clone();
      let parameters = new Fmt.ParameterList(...parameters1, ...parameters2);
      this.utils.addProofConstraint(parameters, this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters2));
      let goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters2, parameters1);
      this.checkProof(equalityDefinition, equalityDefinition.symmetryProof, parameters, goal, context);
    }
    if (!isomorphic || equalityDefinition.transitivityProof) {
      let parameters1 = innerDefinition.parameters.clone();
      let parameters2 = innerDefinition.parameters.clone();
      let parameters3 = innerDefinition.parameters.clone();
      let parameters = new Fmt.ParameterList(...parameters1, ...parameters2, ...parameters3);
      this.utils.addProofConstraint(parameters, this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters2));
      this.utils.addProofConstraint(parameters, this.getSubstitutedEqualityDefinition(equalityDefinition, parameters2, parameters3));
      let goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters3);
      this.checkProof(equalityDefinition, equalityDefinition.transitivityProof, parameters, goal, context);
    }
  }

  private getSubstitutedEqualityDefinition(equalityDefinition: FmtHLM.ObjectContents_ConstructorEqualityDefinition, leftParameters: Fmt.ParameterList, rightParameters: Fmt.ParameterList): Fmt.Expression {
    let formula = equalityDefinition.definition[0];
    formula = this.utils.substituteParameters(formula, equalityDefinition.leftParameters, leftParameters);
    return this.utils.substituteParameters(formula, equalityDefinition.rightParameters, rightParameters);
  }

  private checkConstructorRewriteDefinition(innerDefinition: Fmt.Definition, rewriteDefinition: FmtHLM.ObjectContents_ConstructorRewriteDefinition, context: HLMCheckerContext): void {
    this.checkElementTerm(rewriteDefinition.value, context);
    let substitutionContext = new HLMSubstitutionContext;
    let constructionArgs = this.utils.getParameterArguments(this.definition.parameters, substitutionContext);
    let constructionPath = new Fmt.Path(this.definition.name, constructionArgs);
    let constructorArgs = this.utils.getParameterArguments(innerDefinition.parameters, substitutionContext);
    let constructorPath = new Fmt.Path(innerDefinition.name, constructorArgs, constructionPath);
    let constructorExpression = new Fmt.DefinitionRefExpression(constructorPath);
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
    let constructionArgs = this.utils.getParameterArguments(this.definition.parameters, substitutionContext);
    let constructionPath = new Fmt.Path(this.definition.name, constructionArgs);
    let constructionExpression = new Fmt.DefinitionRefExpression(constructionPath);
    this.checkCompatibility(embedding.target, [embedding.target], [constructionExpression], innerContext);
    this.checkEmbeddingWellDefinednessProof(embedding, context);
  }

  private checkEmbeddability(subset: Fmt.Expression): void {
    let typeSearchParameters: HLMTypeSearchParameters = {
      unfoldVariableDefinitions: true,
      followDefinitions: true,
      followSupersets: true,
      followEmbeddings: true,
      followAllAlternatives: false,
      allowStructuralCaseResults: true,
      unfoldArguments: false,
      substituteStructuralCases: false,
      extractStructuralCases: false
    };
    let checkSubset = this.utils.getFinalSuperset(subset, typeSearchParameters).then((superset: Fmt.Expression) => {
      if (this.utils.isWildcardFinalSet(superset)) {
        this.error(subset!, 'The given set cannot be embedded');
      }
    });
    this.addPendingCheck(subset, checkSubset);
  }

  private checkEmbeddingWellDefinednessProof(embedding: FmtHLM.ObjectContents_Embedding, context: HLMCheckerContext): void {
    // TODO check "full" property of embedding
    let leftParam = embedding.parameter.clone();
    let rightParam = leftParam.shallowClone();
    let leftTerm = this.utils.substituteParameter(embedding.target, embedding.parameter, leftParam);
    let rightTerm = this.utils.substituteParameter(embedding.target, embedding.parameter, rightParam);
    let parameters = new Fmt.ParameterList;
    parameters.push(leftParam, rightParam);
    let constraint = new FmtHLM.MetaRefExpression_equals(leftTerm, rightTerm);
    this.utils.addProofConstraint(parameters, constraint);
    let leftVariableRef = new Fmt.VariableRefExpression(leftParam);
    let rightVariableRef = new Fmt.VariableRefExpression(rightParam);
    let goal = new FmtHLM.MetaRefExpression_equals(leftVariableRef, rightVariableRef);
    this.checkProof(embedding, embedding.wellDefinednessProof, parameters, goal, context);
  }

  private checkConstructionRewriteDefinition(rewriteDefinition: FmtHLM.ObjectContents_ConstructionRewriteDefinition, context: HLMCheckerContext): void {
    let substitutionContext = new HLMSubstitutionContext;
    let constructionArgs = this.utils.getParameterArguments(this.definition.parameters, substitutionContext);
    let constructionPath = new Fmt.Path(this.definition.name, constructionArgs);
    let constructionExpression = new Fmt.DefinitionRefExpression(constructionPath);
    let [set, innerContext] = this.checkElementParameter(rewriteDefinition.parameter, context);
    if (set && !this.utils.areExpressionsSyntacticallyEquivalent(set, constructionExpression)) {
      this.error(set, 'Rewrite parameter must match construction');
    }
    this.checkElementTerm(rewriteDefinition.value, context);
    this.checkCompatibility(rewriteDefinition.value, [rewriteDefinition.value], [constructionExpression], context);
    // TODO check whether rewrite definition matches referenced theorem
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
    let parameters = new Fmt.ParameterList(param);
    let formula = this.utils.substituteParameter(contents.definition[0], contents.parameter, param);
    let goal = new FmtHLM.MetaRefExpression_existsUnique(parameters, formula);
    this.checkProof(contents, contents.wellDefinednessProof, undefined, goal, context);
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
      let checkMacro = macroInstance.check().then((diagnostics: Logic.LogicCheckDiagnostic[]) => {
        this.result.diagnostics.push(...diagnostics);
        if (diagnostics.some((diagnostic: Logic.LogicCheckDiagnostic) => diagnostic.severity === Logic.DiagnosticSeverity.Error)) {
          this.result.hasErrors = true;
        }
      });
      this.addPendingCheck(this.definition, checkMacro);
    } catch (error) {
      this.error(this.definition, error.message);
    }
  }

  private setCurrentRecheckFn(expression: Fmt.Expression, checkFn: (substitutedExpression: Fmt.Expression, recheckContext: HLMCheckerContext) => void, autoFillFn: AutoFillFn | undefined, context: HLMCheckerContext): HLMCheckerContext {
    if (context.editData && !context.rechecking) {
      let newContext: HLMCheckerContext = {
        ...context,
        currentRecheckFn: (originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression) => {
          let substituted = FmtUtils.substituteExpression(expression, originalExpression, substitutedExpression);
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
      stepResults: new Map<Fmt.Parameter, Fmt.Expression>(context.stepResults),
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
      for (let [placeholder, restriction] of recheckContext.editData!.restrictions) {
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

  private checkParameterList<ContextType extends HLMCheckerContext>(parameterList: Fmt.ParameterList, context: ContextType): ContextType {
    let currentContext = context;
    for (let param of parameterList) {
      currentContext = this.checkParameter(param, currentContext);
    }
    if (context.editData && context.editData.constraintCheckFns) {
      let constraintCheckFn = (formula: Fmt.Expression) => {
        let fn = (recheckContext: HLMCheckerContext) => this.checkFormula(formula, recheckContext);
        return this.recheck(formula, fn, context);
      };
      context.editData.constraintCheckFns.set(parameterList, constraintCheckFn);
    }
    return currentContext;
  }

  getParameterListContext<ContextType extends HLMCheckerContext>(parameterList: Fmt.ParameterList, context: ContextType): ContextType {
    for (let param of parameterList) {
      context = this.getParameterContext(param, context);
    }
    return context;
  }

  private checkParameter<ContextType extends HLMCheckerContext>(param: Fmt.Parameter, context: ContextType): ContextType {
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
    return this.checkParameterType(param, param.type, context);
  }

  private checkParameterType<ContextType extends HLMCheckerContext>(param: Fmt.Parameter, type: Fmt.Expression, context: ContextType): ContextType {
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
    return {
      ...context,
      context: new Ctx.ParameterContext(param, context.context)
    };
  }

  getParameterContext<ContextType extends HLMCheckerContext>(param: Fmt.Parameter, context: ContextType): ContextType {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      let sourceContext = this.getParameterListContext(type.sourceParameters, context);
      let resultContext = this.getParameterListContext(type.targetParameters, sourceContext);
      return {
        ...resultContext,
        binderSourceParameters: [...resultContext.binderSourceParameters, ...type.sourceParameters]
      };
    } else {
      return {
        ...context,
        context: new Ctx.ParameterContext(param, context.context)
      };
    }
  }

  private checkElementParameter<ContextType extends HLMCheckerContext>(param: Fmt.Parameter, context: ContextType): [Fmt.Expression | undefined, ContextType] {
    let type = param.type;
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
    let rawArg = argumentList.getOptionalValue(param.name);
    this.checkRawArgument(param, argumentList, rawArg, param.type, context, substitutionContext);
  }

  private checkRawArgument(param: Fmt.Parameter, argumentList: Fmt.ArgumentList, rawArg: Fmt.Expression | undefined, type: Fmt.Expression, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    if (type instanceof Fmt.IndexedExpression && rawArg) {
      if (rawArg instanceof Fmt.ArrayExpression) {
        for (let item of rawArg.items) {
          this.checkRawArgument(param, argumentList, item, type.body, context, substitutionContext);
        }
      } else {
        this.error(rawArg, 'Array expression expected');
      }
    } else {
      this.checkArgumentValue(rawArg ?? argumentList, param, rawArg, context, substitutionContext);
    }
  }

  private checkArgumentValue(object: Object, param: Fmt.Parameter, rawArg: Fmt.Expression | undefined, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    let missingArgument = false;
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Set) {
      if (rawArg) {
        let setArg = FmtHLM.ObjectContents_SetArg.createFromExpression(rawArg);
        this.checkSetTerm(setArg._set, this.getAutoArgumentContext(type.auto, context));
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      if (rawArg) {
        let superset = this.utils.applySubstitutionContext(type.superset, substitutionContext);
        let subsetArg = FmtHLM.ObjectContents_SubsetArg.createFromExpression(rawArg);
        this.checkSetTerm(subsetArg._set, this.getAutoArgumentContext(type.auto, context));
        let checkSubset = this.checkSubset(subsetArg._set, superset, context).then((isTrivialSubset: boolean) => {
          if (!isTrivialSubset || subsetArg.subsetProof) {
            let subsetFormula = new FmtHLM.MetaRefExpression_sub(subsetArg._set, superset);
            this.checkProof(object, subsetArg.subsetProof, undefined, subsetFormula, context);
          }
        });
        this.addPendingCheck(subsetArg._set, checkSubset);
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      if (rawArg) {
        let set = this.utils.applySubstitutionContext(type._set, substitutionContext);
        let elementArg = FmtHLM.ObjectContents_ElementArg.createFromExpression(rawArg);
        this.checkElementTerm(elementArg.element, this.getAutoArgumentContext(type.auto, context));
        let checkElement = this.checkElement(elementArg.element, set, context).then((isTrivialElement: boolean) => {
          if (!isTrivialElement || elementArg.elementProof) {
            let elementFormula = new FmtHLM.MetaRefExpression_in(elementArg.element, set);
            this.checkProof(object, elementArg.elementProof, undefined, elementFormula, context);
          }
        });
        this.addPendingCheck(elementArg.element, checkElement);
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      if (rawArg) {
        let propArg = FmtHLM.ObjectContents_PropArg.createFromExpression(rawArg);
        this.checkFormula(propArg.formula, this.getAutoArgumentContext(type.auto, context));
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      let constraint = this.utils.applySubstitutionContext(type.formula, substitutionContext);
      let constraintArg = rawArg ? FmtHLM.ObjectContents_ConstraintArg.createFromExpression(rawArg) : undefined;
      this.checkProof(object, constraintArg?.proof, undefined, constraint, context);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      if (rawArg) {
        let binderArg = FmtHLM.ObjectContents_BinderArg.createFromExpression(rawArg);
        let expectedSourceParameters = this.utils.applySubstitutionContextToParameterList(type.sourceParameters, substitutionContext);
        if (!binderArg.sourceParameters.isEquivalentTo(expectedSourceParameters)) {
          this.error(binderArg.sourceParameters, 'Parameter list must match binder');
        }
        let innerSubstitutionContext = new HLMSubstitutionContext(substitutionContext);
        this.utils.addParameterListSubstitution(type.sourceParameters, binderArg.sourceParameters, innerSubstitutionContext);
        this.addAndCheckArgumentList(type.targetParameters, binderArg.targetArguments, undefined, context, innerSubstitutionContext);
      } else {
        missingArgument = true;
      }
    }
    if (missingArgument) {
      this.error(object, `Missing argument for parameter "${param.name}"`);
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
    if (term instanceof Fmt.VariableRefExpression || term instanceof Fmt.IndexedExpression) {
      let checkType = (type: Fmt.Expression) => (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_SetDef);
      this.checkVariableRefExpression(term, checkType, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(term).then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction || definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
          this.checkDefinitionRefExpression(term, [definition], context);
        } else {
          this.error(term, 'Referenced definition must be a construction or set operator');
        }
      });
      this.addPendingCheck(term, checkDefinitionRef);
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
        let newTerm = new FmtHLM.MetaRefExpression_setStructuralCases(term.term, term.construction, newCases);
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      let getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext) => {
        let result = new FmtHLM.MetaRefExpression_sub(leftValue, rightValue);
        // TODO support well-definedness proofs in cases where the goal can be written as an isomorphism condition
        this.checkFormula(result, wellDefinednessContext);
        return result;
      };
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, replaceCases, getWellDefinednessProofGoal, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_setAssociative) {
      this.checkSetTerm(term.term, context);
      // TODO check whether combination of inner and outer operations is really declared as associative
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
    if (term instanceof Fmt.VariableRefExpression || term instanceof Fmt.IndexedExpression) {
      let checkType = (type: Fmt.Expression) => (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def);
      this.checkVariableRefExpression(term, checkType, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(term).then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction && term.path.parentPath instanceof Fmt.Path && !(term.path.parentPath.parentPath instanceof Fmt.Path)) {
          let innerDefinition = definition.innerDefinitions.getDefinition(term.path.name);
          this.checkDefinitionRefExpression(term, [definition, innerDefinition], context);
        } else if (definition.contents instanceof FmtHLM.ObjectContents_Operator) {
          this.checkDefinitionRefExpression(term, [definition], context);
        } else {
          this.error(term, 'Referenced definition must be a constructor or operator');
        }
      });
      this.addPendingCheck(term, checkDefinitionRef);
    } else if (term instanceof FmtHLM.MetaRefExpression_cases) {
      let formulas: Fmt.Expression[] = [];
      let values: Fmt.Expression[] = [];
      for (let item of term.cases) {
        this.checkFormula(item.formula, context);
        this.checkElementTerm(item.value, context);
        let exclusivityParameters = new Fmt.ParameterList;
        let exclusivityConstraint = this.utils.createDisjunction(formulas);
        this.utils.addProofConstraint(exclusivityParameters, exclusivityConstraint);
        let exclusivityGoalPromise = this.utils.negateFormula(item.formula, true);
        let checkProof = exclusivityGoalPromise.then((exclusivityGoal: Fmt.Expression) =>
          this.checkProof(term, item.exclusivityProof, exclusivityParameters, exclusivityGoal, context));
        this.addPendingCheck(term, checkProof);
        formulas.push(item.formula);
        values.push(item.value);
      }
      let totalityGoal = this.utils.createDisjunction(formulas);
      this.checkProof(term, term.totalityProof, undefined, totalityGoal, context);
      this.checkElementCompatibility(term, values, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      let checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkElementTerm(value, caseContext);
      let checkCompatibility = (values: Fmt.Expression[]) => this.checkElementCompatibility(term, values, context);
      let replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (let newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
        }
        let newTerm = new FmtHLM.MetaRefExpression_structuralCases(term.term, term.construction, newCases);
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      let getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext) => {
        let result = new FmtHLM.MetaRefExpression_equals(leftValue, rightValue);
        // TODO support well-definedness proofs in cases where the goal can be written as an isomorphism condition
        this.checkFormula(result, wellDefinednessContext);
        return result;
      };
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, replaceCases, getWellDefinednessProofGoal, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      this.checkElementTerm(term.term, context);
      this.checkSetTerm(term._set, context);
      let checkElement = this.checkElement(term.term, term._set, context).then((isTrivialElement: boolean) => {
        if (!isTrivialElement || term.proof) {
          let elementFormula = new FmtHLM.MetaRefExpression_in(term.term, term._set);
          this.checkProof(term, term.proof, undefined, elementFormula, context);
        }
      });
      this.addPendingCheck(term, checkElement);
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
    if (formula instanceof Fmt.VariableRefExpression || formula instanceof Fmt.IndexedExpression) {
      let checkType = (type: Fmt.Expression) => (type instanceof FmtHLM.MetaRefExpression_Prop);
      this.checkVariableRefExpression(formula, checkType, context);
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(formula).then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
          this.checkDefinitionRefExpression(formula, [definition], context);
        } else {
          this.error(formula, 'Referenced definition must be a predicate');
        }
      });
      this.addPendingCheck(formula, checkDefinitionRef);
    } else if (formula instanceof FmtHLM.MetaRefExpression_not) {
      this.checkFormula(formula.formula, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and || formula instanceof FmtHLM.MetaRefExpression_or || formula instanceof FmtHLM.MetaRefExpression_equiv) {
      if (formula.formulas) {
        let checkContext = context;
        for (let item of formula.formulas) {
          this.checkFormula(item, checkContext);
          if (formula instanceof FmtHLM.MetaRefExpression_and || formula instanceof FmtHLM.MetaRefExpression_or) {
            let constraintFormula = formula instanceof FmtHLM.MetaRefExpression_or ? this.utils.negateFormula(item, false).getImmediateResult()! : item;
            let constraintParam = this.utils.createConstraintParameter(constraintFormula, '_');
            checkContext = {
              ...checkContext,
              temporaryParameters: checkContext.temporaryParameters.concat(constraintParam)
            };
            checkContext = this.getParameterContext(constraintParam, checkContext);
          }
        }
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall || formula instanceof FmtHLM.MetaRefExpression_exists || formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
      if (formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
        for (let param of formula.parameters) {
          if (!(param.type instanceof FmtHLM.MetaRefExpression_Element || param.type instanceof FmtHLM.MetaRefExpression_Constraint)) {
            this.error(param.type, 'Element or constraint parameter expected');
          }
        }
      }
      let innerContext = this.checkParameterList(formula.parameters, context);
      if (formula.formula) {
        this.checkFormula(formula.formula, innerContext);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      this.checkElementTerm(formula.element, context);
      this.checkSetTerm(formula._set, context);
      this.checkCompatibility(formula, [formula.element], [formula._set], context);
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
        let newFormula = new FmtHLM.MetaRefExpression_structural(formula.term, formula.construction, newCases);
        return {
          originalExpression: formula,
          filledExpression: newFormula
        };
      };
      let getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => {
        this.utils.addProofConstraint(proofParameters, leftValue);
        return rightValue;
      };
      this.checkStructuralCases(formula.term, formula.construction, formula.cases, checkCase, undefined, replaceCases, getWellDefinednessProofGoal, context);
    } else if (formula instanceof Fmt.PlaceholderExpression) {
      this.checkPlaceholderExpression(formula, HLMExpressionType.Formula, context);
    } else {
      this.error(formula, 'Formula expected');
    }
  }

  private checkVariableRefExpression(expression: Fmt.Expression, checkType: (type: Fmt.Expression) => boolean, context: HLMCheckerContext): void {
    while (expression instanceof Fmt.IndexedExpression) {
      if (expression.parameters && expression.arguments) {
        this.checkArgumentLists([expression.arguments], [expression.parameters], undefined, context);
      } else if (expression.parameters) {
        this.error(expression, `Too few indices`);
      } else {
        this.error(expression, `Superfluous index`);
      }
      expression = expression.body;
    }
    if (expression instanceof Fmt.VariableRefExpression) {
      if (context.binderSourceParameters.indexOf(expression.variable) >= 0) {
        this.error(expression, 'Invalid reference to binder');
      }
      if (!checkType(expression.variable.type)) {
        this.error(expression, 'Referenced variable has incorrect type');
      }
    } else {
      this.error(expression, 'Variable reference expected');
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

  private checkStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCase: (value: Fmt.Expression, caseContext: HLMCheckerContext) => void, checkCompatibility: ((values: Fmt.Expression[]) => void) | undefined, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, getWellDefinednessProofGoal: (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => Fmt.Expression, context: HLMCheckerContext): void {
    let checkCaseInternal = (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter, caseContext: HLMCheckerContext) => {
      caseContext = this.getParameterContext(constraintParam, caseContext);
      checkCase(structuralCase.value, caseContext);
      if ((getWellDefinednessProofGoal && constructorContents.equalityDefinition && !(constructorContents.equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true)) || structuralCase.wellDefinednessProof) {
        let clonedParameters: Fmt.ParameterList;
        let replacedParameters: Fmt.ReplacedParameter[] = [];
        let clonedValue = structuralCase.value;
        if (structuralCase.parameters) {
          clonedParameters = structuralCase.parameters.clone(replacedParameters);
          clonedValue = this.utils.substituteParameters(structuralCase.value, structuralCase.parameters, clonedParameters);
        } else {
          clonedParameters = new Fmt.ParameterList;
        }
        clonedParameters.push(constraintParam.clone(replacedParameters));
        let goalContext = this.getParameterListContext(clonedParameters, caseContext);
        let goal = getWellDefinednessProofGoal ? getWellDefinednessProofGoal(structuralCase.value, clonedValue, goalContext, clonedParameters) : new FmtHLM.MetaRefExpression_and;
        this.checkProof(structuralCase.value, structuralCase.wellDefinednessProof, clonedParameters, goal, caseContext);
      }
    };
    this.checkStructuralCasesInternal(term, construction, cases, checkCaseInternal, undefined, replaceCases, context);

    if (checkCompatibility) {
      let values = cases.map((structuralCase: FmtHLM.ObjectContents_StructuralCase) => structuralCase.value);
      checkCompatibility(values);
    }
  }

  private checkStructuralCasesInternal(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCaseInternal: (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter, caseContext: HLMCheckerContext) => void, prepareCaseInternal: ((structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter) => void) | undefined, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, context: HLMCheckerContext): void {
    this.checkStructuralCaseTerm(term, construction, prepareCaseInternal, replaceCases, context);
    if (construction instanceof Fmt.DefinitionRefExpression) {
      let constructionPath = construction.path;
      let constructionPathWithoutArguments = new Fmt.Path(constructionPath.name, undefined, constructionPath.parentPath);
      let index = 0;
      let checkConstructor = (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => {
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
              let structuralCaseTerm = this.utils.getResolvedStructuralCaseTerm(constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents);
              let constraintParam = this.utils.getStructuralCaseConstraintParameter(term, structuralCaseTerm);
              checkCaseInternal(structuralCase, constructorContents, structuralCaseTerm, constraintParam, caseContext);
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
      let checkCases = this.forAllConstructors(construction, checkConstructor).then(() => {
        if (index < cases.length) {
          this.error(term, 'Too many cases');
        }
      });
      this.addPendingCheck(term, checkCases);
    } else if (!(construction instanceof Fmt.PlaceholderExpression)) {
      this.error(construction, 'Construction reference expected');
    }
  }

  private checkStructuralCaseTerm(term: Fmt.Expression, construction: Fmt.Expression, prepareCaseInternal: ((structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter) => void) | undefined, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, context: HLMCheckerContext): void {
    let recheckFn = (substitutedTerm: Fmt.Expression, recheckContext: HLMCheckerContext) => this.checkStructuralCaseTerm(substitutedTerm, construction, prepareCaseInternal, replaceCases, recheckContext);
    let autoFillFn = undefined;
    if (context.editData && construction instanceof Fmt.PlaceholderExpression) {
      autoFillFn = (placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn) => {
        let filledConstruction = placeholderValues.get(construction);
        if (filledConstruction instanceof Fmt.DefinitionRefExpression) {
          let constructionPath = filledConstruction.path;
          let constructionPathWithoutArguments = new Fmt.Path(constructionPath.name, undefined, constructionPath.parentPath);
          let newCases: FmtHLM.ObjectContents_StructuralCase[] = [];
          let newParameterLists: Fmt.ParameterList[] = [];
          let addCase = (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => {
            let constructorPath = new Fmt.Path(constructorDefinition.name, undefined, constructionPathWithoutArguments);
            let constructorExpression = new Fmt.DefinitionRefExpression(constructorPath);
            let clonedParameters: Fmt.ParameterList | undefined = undefined;
            if (substitutedParameters.length) {
              clonedParameters = substitutedParameters.clone();
              newParameterLists.push(clonedParameters);
            }
            let rewrite = constructorContents.rewrite ? new FmtHLM.MetaRefExpression_true : undefined;
            let structuralCase = new FmtHLM.ObjectContents_StructuralCase(constructorExpression, clonedParameters, new Fmt.PlaceholderExpression(undefined), rewrite);
            if (prepareCaseInternal) {
              let structuralCaseTerm = this.utils.getResolvedStructuralCaseTerm(constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents);
              let constraintParam = this.utils.getStructuralCaseConstraintParameter(term, structuralCaseTerm);
              prepareCaseInternal(structuralCase, constructorContents, structuralCaseTerm, constraintParam);
            }
            newCases.push(structuralCase);
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
      unfoldVariableDefinitions: true,
      followDefinitions: true,
      followSupersets: true,
      followEmbeddings: false,
      followAllAlternatives: false,
      allowStructuralCaseResults: true,
      unfoldArguments: false,
      substituteStructuralCases: true,
      extractStructuralCases: false
    };
    let checkConstructionRef = this.utils.getFinalSet(term, typeSearchParameters).then((finalSet: Fmt.Expression) => {
      if (!((finalSet instanceof Fmt.DefinitionRefExpression || finalSet instanceof Fmt.PlaceholderExpression)
            && this.checkSetTermEquivalence(construction, finalSet, context))) {
        this.error(term, 'Term must be an element of the specified construction');
      }
    });
    this.addPendingCheck(term, checkConstructionRef);
  }

  private forAllConstructors(construction: Fmt.DefinitionRefExpression, callbackFn: (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, contents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => void): CachedPromise<void> {
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
    if (!this.options.supportPlaceholders) {
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

  private checkEquivalenceList(object: Object, list: HLMEquivalenceListInfo, equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, checkItem: (expression: Fmt.Expression, context: HLMCheckerContext) => void, checkCompatibility: ((expressions: Fmt.Expression[], context: HLMCheckerContext) => void) | undefined, context: HLMCheckerContext): void {
    if (list.items.length) {
      for (let item of list.items) {
        if (item instanceof Fmt.DefinitionRefExpression && !item.path.parentPath && item.path.name === this.definition.name) {
          this.error(item, 'Invalid circular reference');
        }
        let currentContext = context;
        if (checkCompatibility) {
          let recheckFn = (substitutedItem: Fmt.Expression, recheckContext: HLMCheckerContext) => {
            let substitutedList: HLMEquivalenceListInfo = {
              ...list,
              items: list.items.map((originalItem: Fmt.Expression) => originalItem === item ? substitutedItem : originalItem)
            };
            this.checkEquivalenceList(object, substitutedList, undefined, checkItem, checkCompatibility, recheckContext);
          };
          currentContext = this.setCurrentRecheckFn(item, recheckFn, undefined, currentContext);
        }
        checkItem(item, currentContext);
      }
      if (checkCompatibility) {
        checkCompatibility(list.items, context);
      }
      this.checkEquivalenceProofs(equivalenceProofs, list, context);
    } else {
      this.error(object, 'At least one item expected');
    }
  }

  private checkSetTermEquivalenceList(object: Object, items: Fmt.Expression[], equalityProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    let list = this.utils.getSetTermEquivalenceListInfo(items);
    let checkCompatibility = (terms: Fmt.Expression[], checkContext: HLMCheckerContext) => this.checkSetCompatibility(object, terms, checkContext);
    let checkItem = (term: Fmt.Expression, termContext: HLMCheckerContext) => this.checkSetTerm(term, termContext);
    this.checkEquivalenceList(object, list, equalityProofs, checkItem, checkCompatibility, context);
  }

  private checkElementTermEquivalenceList(object: Object, items: Fmt.Expression[], equalityProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    let list = this.utils.getElementTermEquivalenceListInfo(items);
    let checkCompatibility = (terms: Fmt.Expression[], checkContext: HLMCheckerContext) => this.checkElementCompatibility(object, terms, checkContext);
    let checkItem = (term: Fmt.Expression, termContext: HLMCheckerContext) => this.checkElementTerm(term, termContext);
    this.checkEquivalenceList(object, list, equalityProofs, checkItem, checkCompatibility, context);
  }

  private checkFormulaEquivalenceList(object: Object, items: Fmt.Expression[], equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    let list = this.utils.getFormulaEquivalenceListInfo(items);
    let checkItem = (formula: Fmt.Expression, itemContext: HLMCheckerContext) => this.checkFormula(formula, itemContext);
    this.checkEquivalenceList(object, list, equivalenceProofs, checkItem, undefined, context);
  }

  private checkProof(object: Object, proof: FmtHLM.ObjectContents_Proof | undefined, parameters: Fmt.ParameterList | undefined, goal: Fmt.Expression, context: HLMCheckerContext): void {
    this.checkMultiGoalProof(object, proof, parameters, [goal], context);
  }

  private checkMultiGoalProof(object: Object, proof: FmtHLM.ObjectContents_Proof | undefined, parameters: Fmt.ParameterList | undefined, goals: Fmt.Expression[], context: HLMCheckerContext): void {
    if (parameters) {
      if (proof) {
        if (!proof.parameters) {
          this.error(proof, 'Parameter list required');
          return;
        } else if (!proof.parameters.isEquivalentTo(parameters)) {
          this.error(proof.parameters, 'Invalid proof parameters');
          return;
        }
        context = this.getParameterListContext(proof.parameters, context);
        goals = goals.map((goal: Fmt.Expression) => this.utils.substituteParameters(goal, parameters, proof.parameters!));
      } else {
        context = this.getParameterListContext(parameters, context);
      }
    } else if (proof?.parameters) {
      this.error(proof.parameters, 'Superfluous proof parameters');
      return;
    }
    let checkProof = this.stripConstraintsFromFormulas(goals, true, true, !proof, !proof, context).then((newGoals: Fmt.Expression[]) => {
      if (proof) {
        // Report errors as locally as possible, but not on temporarily converted objects inside expressions.
        if (!(object instanceof Fmt.Expression)) {
          object = proof;
        }
        this.checkProofValidity(object, proof, newGoals, context);
      } else if (this.options.warnAboutMissingProofs
                 && !newGoals.some((goal: Fmt.Expression) => this.utils.isTrueFormula(goal))) {
        this.message(object, parameters || !newGoals.length ? 'Proof required' : `Proof of ${newGoals.join(' or ')} required`, Logic.DiagnosticSeverity.Warning);
      }
    });
    this.addPendingCheck(object, checkProof);
  }

  private checkProofValidity(object: Object, proof: FmtHLM.ObjectContents_Proof, goals: Fmt.Expression[], context: HLMCheckerContext): void {
    if (proof.goal) {
      this.checkFormula(proof.goal, context);
      this.checkUnfolding(proof.goal, goals, proof.goal, true);
    }
    let originalGoal = goals.length ? goals[0] : undefined;
    let stepContext: HLMCheckerProofStepContext | undefined = {
      ...context,
      originalGoal: originalGoal,
      goal: proof.goal ?? originalGoal,
      previousResult: undefined
    };
    this.utils.updateInitialProofStepContext(proof, stepContext, true);
    stepContext = this.checkProofSteps(proof.steps, stepContext);
    if (stepContext) {
      if (stepContext.goal) {
        let check = this.isTriviallyProvable(stepContext.goal, stepContext).then((result: boolean) => {
          if (!result) {
            this.result.incompleteProofs.set(proof.steps, stepContext!);
            this.message(object, `Proof of ${stepContext!.goal} is incomplete`, Logic.DiagnosticSeverity.Warning);
          }
        });
        this.addPendingCheck(object, check);
      } else {
        this.result.incompleteProofs.set(proof.steps, stepContext);
        this.message(object, `Proof is incomplete`, Logic.DiagnosticSeverity.Warning);
      }
    }
  }

  private checkProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, goal: Fmt.Expression, context: HLMCheckerContext): void {
    if (proofs) {
      for (let proof of proofs) {
        this.checkProof(proof, proof, undefined, goal, context);
      }
    }
  }

  private checkEquivalenceProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, list: HLMEquivalenceListInfo, context: HLMCheckerContext): void {
    if (proofs) {
      for (let proof of proofs) {
        let fromIndex = this.utils.externalToInternalIndex(proof._from);
        let toIndex = this.utils.externalToInternalIndex(proof._to);
        if (fromIndex === undefined || toIndex === undefined) {
          this.error(proof, 'From/to required');
        } else if (fromIndex < 0 || fromIndex >= list.items.length) {
          this.error(proof, 'Invalid from index');
        } else if (toIndex < 0 || toIndex >= list.items.length) {
          this.error(proof, 'Invalid to index');
        } else {
          let proofParameters: Fmt.ParameterList | undefined = new Fmt.ParameterList;
          let goal = list.getEquivalenceGoal(list.items[fromIndex], list.items[toIndex], proofParameters!);
          if (!proofParameters!.length) {
            proofParameters = undefined;
          }
          this.checkProof(proof, proof, proofParameters, goal, context);
        }
      }
    }
  }

  private checkProofSteps(steps: Fmt.ParameterList, context: HLMCheckerProofStepContext | undefined): HLMCheckerProofStepContext | undefined {
    for (let step of steps) {
      if (context) {
        let stepResult = this.checkProofStep(step, context);
        if (stepResult?.previousResult
            && !(step.type instanceof FmtHLM.MetaRefExpression_Consider && !step.type.result)) {
          context.stepResults.set(step, stepResult.previousResult);
        }
        context = stepResult;
      } else {
        this.error(step, 'Superfluous proof step');
      }
    }
    return context;
  }

  private checkProofStep(step: Fmt.Parameter, context: HLMCheckerProofStepContext): HLMCheckerProofStepContext | undefined {
    let type = step.type;
    if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
      return {
        ...this.checkParameter(step, context),
        previousResult: this.utils.getProofStepResult(step, context)
      };
    } else if (type instanceof FmtHLM.MetaRefExpression_Consider) {
      let checkType = () => true;
      this.checkVariableRefExpression(type.variable, checkType, context);
      if (type.result) {
        let [variableRefExpression, indexContext] = this.utils.extractVariableRefExpression(type.variable);
        if (variableRefExpression) {
          let constraint = this.utils.getParameterConstraint(variableRefExpression.variable, context, variableRefExpression, indexContext);
          if (constraint) {
            this.checkUnfolding(type.result, [constraint], type.result, false);
          } else {
            this.error(type.result, 'Invalid result');
          }
        }
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      this.checkFormula(type.statement, context);
      this.checkProof(step, type.proof, undefined, type.statement, context);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef) {
      if (context.goal) {
        if (context.previousResult) {
          let useDef = type;
          let previousResultDefinitionsPromise = this.utils.getFormulaDefinitions(context.previousResult, this.utils.externalToInternalIndex(useDef.side));
          if (previousResultDefinitionsPromise) {
            let checkDefinition = previousResultDefinitionsPromise.then((previousResultDefinitions: HLMFormulaDefinition[]) => {
              if (previousResultDefinitions.length) {
                let sources = previousResultDefinitions.map((previousResultDefinition: HLMFormulaDefinition) => previousResultDefinition.formula);
                this.checkDeclaredResult(step, useDef.result, sources, context);
              } else {
                this.error(step, `${context.previousResult} does not have any definition`);
              }
            });
            this.addPendingCheck(step, checkDefinition);
          } else {
            this.error(step, `${context.previousResult} does not have any definition`);
          }
        } else {
          this.error(step, 'Previous result not set');
        }
      } else {
        this.error(step, 'Goal not set');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseCases) {
      if (context.goal) {
        if (context.previousResult) {
          let goal = context.goal;
          let previousResultCasesPromise = this.utils.getFormulaCases(context.previousResult, this.utils.externalToInternalIndex(type.side), false);
          if (previousResultCasesPromise) {
            let caseProofs = type.caseProofs;
            let checkCases = previousResultCasesPromise.then((previousResultCases: HLMFormulaCase[]) => {
              let index = 0;
              for (let previousResultCase of previousResultCases) {
                if (index < caseProofs.length) {
                  let caseProof = caseProofs[index];
                  let parameters = this.utils.getUseCasesProofParameters(previousResultCase);
                  this.checkProof(caseProof, caseProof, parameters, goal, context);
                } else {
                  this.message(step, 'Missing case proof', Logic.DiagnosticSeverity.Warning);
                }
                index++;
              }
              if (index < caseProofs.length) {
                this.error(caseProofs[index], 'Superfluous case proof');
              }
            });
            this.addPendingCheck(step, checkCases);
          } else {
            this.error(step, 'Invalid cases');
          }
        } else {
          this.error(step, 'Previous result not set');
        }
      } else {
        this.error(step, 'Goal not set');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
      if (context.previousResult instanceof FmtHLM.MetaRefExpression_forall) {
        this.checkArgumentLists([type.arguments], [context.previousResult.parameters], undefined, context);
      } else {
        this.error(step, 'Previous result is not a universally quantified expression');
        return undefined;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
      if (context.previousResult instanceof FmtHLM.MetaRefExpression_exists || context.previousResult instanceof FmtHLM.MetaRefExpression_existsUnique) {
        if (type.parameters.isEquivalentTo(context.previousResult.parameters)) {
          context = this.getParameterListContext(type.parameters, context);
        } else {
          this.error(type.parameters, 'Proof step parameters must match existential quantifier');
        }
      } else {
        this.error(step, 'Previous result is not an existentially quantified expression');
        return undefined;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Substitute) {
      if (context.previousResult) {
        let sourceContext: HLMCheckerProofStepContext = {
          ...context,
          goal: undefined,
          previousResult: undefined
        };
        let sourceResultContext = this.checkProofStep(type.source, sourceContext);
        if (sourceResultContext && (sourceResultContext.previousResult instanceof FmtHLM.MetaRefExpression_setEquals || sourceResultContext.previousResult instanceof FmtHLM.MetaRefExpression_equals)) {
          let terms = sourceResultContext.previousResult.terms;
          let sourceIndex = this.utils.externalToInternalIndex(type.sourceSide);
          if (sourceIndex !== undefined && sourceIndex >= 0 && sourceIndex < terms.length) {
            let sourceTerm = terms[sourceIndex];
            let targetTerms = terms.slice();
            targetTerms.splice(sourceIndex, 1);
            if (type.result) {
              this.checkFormula(type.result, context);
            }
            let implicationResult = this.utils.getImplicationResult(type.result, context);
            if (!this.utils.substitutesTo(context.previousResult, implicationResult, sourceTerm, targetTerms)) {
              this.error(step, `Substitution from ${context.previousResult} to ${implicationResult} is invalid`);
            }
          } else {
            this.error(step, 'Source side is invalid');
          }
        } else {
          this.error(type.source, 'Source proof step does not result in an equality');
        }
      } else {
        this.error(step, 'Previous result not set');
        return undefined;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Unfold) {
      if (context.previousResult) {
        this.checkDeclaredResult(step, type.result, [context.previousResult], context);
      } else {
        this.error(step, 'Previous result not set');
        return undefined;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseTheorem) {
      let useTheorem = type;
      if (useTheorem.theorem instanceof Fmt.DefinitionRefExpression) {
        let theorem = useTheorem.theorem;
        let checkDefinitionRef = this.utils.getOuterDefinition(theorem).then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem || definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
            this.checkDefinitionRefExpression(theorem, [definition], context);
            if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
              if (useTheorem.input) {
                let inputContext: HLMCheckerProofStepContext = {
                  ...context,
                  goal: undefined,
                  previousResult: undefined
                };
                let inputResultContext = this.checkProofStep(useTheorem.input, inputContext);
                if (inputResultContext?.previousResult) {
                  let previousResult = inputResultContext.previousResult;
                  let conditions = definition.contents.conditions.map((condition: Fmt.Expression) => this.utils.substitutePath(condition, theorem.path, [definition]));
                  let checkInput = this.stripConstraintsFromFormulas(conditions, true, true, false, true, context).then((strippedConditions: Fmt.Expression[]) =>
                    this.checkImplication(step, previousResult, strippedConditions));
                  this.checkDeclaredResult(step, useTheorem.result, conditions, context);
                  return checkInput;
                } else {
                  this.error(step, 'Invalid input proof step');
                }
              } else {
                this.error(step, 'Theorem input required');
              }
            } else {
              let claim = this.utils.substitutePath(definition.contents.claim, theorem.path, [definition]);
              this.checkDeclaredResult(step, useTheorem.result, [claim], context);
            }
          } else {
            // TODO also support definitions (and render as "by definition")
            this.error(step, 'Referenced definition must be a theorem');
          }
          return CachedPromise.resolve();
        });
        this.addPendingCheck(step, checkDefinitionRef);
      } else {
        this.error(step, 'Definition reference required');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveDef) {
      if (context.goal) {
        let proveDef = type;
        let goalDefinitionsPromise = this.utils.getFormulaDefinitions(context.goal, this.utils.externalToInternalIndex(proveDef.side));
        if (goalDefinitionsPromise) {
          let checkDefinition = goalDefinitionsPromise.then((goalDefinitions: HLMFormulaDefinition[]) => {
            let goals = goalDefinitions.map((goalDefinition: HLMFormulaDefinition) => goalDefinition.formula);
            this.checkMultiGoalProof(step, proveDef.proof, undefined, goals, context);
          });
          this.addPendingCheck(step, checkDefinition);
        } else {
          this.error(step, `${context.goal} cannot be proved by definition`);
        }
      } else {
        this.error(step, 'Goal not set');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveByContradiction) {
      if (context.goal) {
        let proveByContradiction = type;
        let goalToNegate = context.goal;
        let newGoal: Fmt.Expression = new FmtHLM.MetaRefExpression_or;
        if (goalToNegate instanceof FmtHLM.MetaRefExpression_or && goalToNegate.formulas && proveByContradiction.proof._to !== undefined) {
          let index = this.utils.externalToInternalIndex(proveByContradiction.proof._to);
          if (index !== undefined && index >= 0 && index < goalToNegate.formulas.length) {
            [goalToNegate, newGoal] = this.utils.getProveByContradictionVariant(goalToNegate.formulas, index);
          }
        }
        let check = this.utils.negateFormula(goalToNegate, true).then((negatedGoal: Fmt.Expression) => {
          let parameters = new Fmt.ParameterList;
          this.utils.addProofConstraint(parameters, negatedGoal);
          this.checkProof(step, proveByContradiction.proof, parameters, newGoal, context);
        });
        this.addPendingCheck(step, check);
      } else {
        this.error(step, 'Goal not set');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveForAll) {
      if (context.goal instanceof FmtHLM.MetaRefExpression_forall) {
        this.checkProof(step, type.proof, context.goal.parameters, context.goal.formula, context);
      } else {
        this.error(step, 'Goal is not a universally quantified expression');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveExists) {
      if (context.goal instanceof FmtHLM.MetaRefExpression_exists) {
        this.checkArgumentLists([type.arguments], [context.goal.parameters], undefined, context);
        if (context.goal.formula) {
          let substitutedFormula = this.utils.substituteArguments(context.goal.formula, context.goal.parameters, type.arguments);
          this.checkProof(step, type.proof, undefined, substitutedFormula, context);
        }
      } else {
        this.error(step, 'Goal is not an existentially quantified expression');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveEquivalence) {
      let list = this.utils.getEquivalenceListInfo(context.goal);
      if (list) {
        this.checkEquivalenceProofs(type.proofs, list, context);
      } else {
        this.error(step, 'Goal is not an equivalence');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveCases) {
      if (context.goal) {
        let goalCasesPromise = this.utils.getFormulaCases(context.goal, this.utils.externalToInternalIndex(type.side), true);
        if (goalCasesPromise) {
          let caseProofs = type.caseProofs;
          let checkCases = goalCasesPromise.then((goalCases: HLMFormulaCase[]) => {
            let index = 0;
            for (let goalCase of goalCases) {
              if (index < caseProofs.length) {
                let caseProof = caseProofs[index];
                this.checkProof(caseProof, caseProof, goalCase.parameters, goalCase.formula, context);
              } else {
                this.message(step, 'Missing case proof', Logic.DiagnosticSeverity.Warning);
              }
              index++;
            }
            if (index < caseProofs.length) {
              this.error(caseProofs[index], 'Superfluous case proof');
            }
          });
          this.addPendingCheck(step, checkCases);
        } else {
          this.error(step, 'Invalid cases');
        }
      } else {
        this.error(step, 'Goal not set');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveByInduction) {
      if (context.goal) {
        let proveByInduction = type;
        let goal = context.goal;
        let checkCase = (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter, caseContext: HLMCheckerContext) => {
          let subProof = FmtHLM.ObjectContents_Proof.createFromExpression(structuralCase.value);
          let parameters: Fmt.ParameterList | undefined = undefined;
          let caseGoal = goal;
          if (subProof.parameters) {
            parameters = new Fmt.ParameterList(constraintParam);
          } else {
            caseGoal = this.utils.getInductionProofGoal(goal, proveByInduction.term, structuralCaseTerm);
          }
          this.checkProof(structuralCase.value, subProof, parameters, caseGoal, caseContext);
          if (structuralCase.wellDefinednessProof) {
            this.error(structuralCase.wellDefinednessProof, 'Superfluous well-definedness proof');
          }
        };
        let prepareCase = (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter) => {
          let subProof = new FmtHLM.ObjectContents_Proof(undefined, undefined, new Fmt.ParameterList(constraintParam), undefined, new Fmt.ParameterList);
          structuralCase.value = subProof.toExpression(true);
        };
        let replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
          let newProveByInduction = new FmtHLM.MetaRefExpression_ProveByInduction(proveByInduction.term, proveByInduction.construction, newCases);
          return {
            originalExpression: proveByInduction,
            filledExpression: newProveByInduction
          };
        };
        this.checkStructuralCasesInternal(proveByInduction.term, proveByInduction.construction, proveByInduction.cases, checkCase, prepareCase, replaceCases, context);
      } else {
        this.error(step, 'Goal not set');
      }
      return undefined;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveBySubstitution) {
      if (context.goal) {
        let sourceContext: HLMCheckerProofStepContext = {
          ...context,
          goal: undefined,
          previousResult: undefined
        };
        let sourceResultContext = this.checkProofStep(type.source, sourceContext);
        if (sourceResultContext && (sourceResultContext.previousResult instanceof FmtHLM.MetaRefExpression_setEquals || sourceResultContext.previousResult instanceof FmtHLM.MetaRefExpression_equals)) {
          let terms = sourceResultContext.previousResult.terms;
          let sourceIndex = this.utils.externalToInternalIndex(type.sourceSide);
          if (sourceIndex !== undefined && sourceIndex >= 0 && sourceIndex < terms.length) {
            let sourceTerm = terms[sourceIndex];
            let targetTerms = terms.slice();
            targetTerms.splice(sourceIndex, 1);
            if (this.utils.substitutesTo(context.goal, type.goal, sourceTerm, targetTerms)) {
              this.checkProof(step, type.proof, undefined, type.goal, context);
            } else {
              this.error(step, `Substitution from ${context.goal} to ${type.goal} is invalid`);
            }
          } else {
            this.error(step, 'Source side is invalid');
          }
        } else {
          this.error(type.source, 'Source proof step does not result in an equality');
        }
      } else {
        this.error(step, 'Goal not set');
      }
      return undefined;
    } else {
      this.error(step, 'Invalid proof step');
      return undefined;
    }
    try {
      return {
        ...this.getParameterContext(step, context),
        previousResult: this.utils.getProofStepResult(step, context)
      };
    } catch (error) {
      this.error(step, error.message);
      return undefined;
    }
  }

  getAvailableConstraints(context: HLMCheckerContext, split: boolean): HLMCheckerConstraint[] {
    let constraints: HLMCheckerConstraint[] = [];
    for (let variableInfo of context.context.getVariables()) {
      if (!variableInfo.indexParameterLists && context.binderSourceParameters.indexOf(variableInfo.parameter) < 0) {
        let constraint = this.utils.getParameterConstraint(variableInfo.parameter, context);
        if (constraint) {
          let parameter = context.temporaryParameters.indexOf(variableInfo.parameter) < 0 ? variableInfo.parameter : undefined;
          this.addConstraint(parameter, constraint, true, constraints, split);
        }
      }
    }
    return constraints;
  }

  private addConstraint(parameter: Fmt.Parameter | undefined, constraint: Fmt.Expression, isImmediate: boolean, constraints: HLMCheckerConstraint[], split: boolean): void {
    if (split) {
      if (constraint instanceof FmtHLM.MetaRefExpression_and) {
        if (constraint.formulas) {
          for (let item of constraint.formulas) {
            this.addConstraint(parameter, item, false, constraints, split);
          }
        }
        return;
      } else if (constraint instanceof FmtHLM.MetaRefExpression_exists) {
        // Should be followed by UseExists.
        return;
      }
    }
    constraints.push({
      parameter: parameter,
      constraint: constraint,
      isImmediate: isImmediate
    });
  }

  isTriviallyProvable(goal: Fmt.Expression, context: HLMCheckerContext): CachedPromise<boolean> {
    // TODO %in(a, %extendedSubset(#(...), x)) should be trivially provable if a and x can be unified appropriately such that all constraints on parameters are also trivially provable
    // TODO somewhere (maybe here), the "full" property of embeddings should be taken into account
    let constraints = this.getAvailableConstraints(context, false);
    let conjunction = this.utils.createConjunction(constraints.map((constraint: HLMCheckerConstraint) => constraint.constraint));
    return this.utils.triviallyImplies(conjunction, goal, true);
  }

  isTriviallyDisprovable(goal: Fmt.Expression, context: HLMCheckerContext): CachedPromise<boolean> {
    return this.utils.negateFormula(goal, true).then((negatedGoal: Fmt.Expression) =>
      this.isTriviallyProvable(negatedGoal, context));
  }

  stripConstraintsFromFormulas(formulas: Fmt.Expression[], stripExactPositive: boolean, stripPositive: boolean, stripNegative: boolean, allowTrivialResult: boolean, context: HLMCheckerContext): CachedPromise<Fmt.Expression[]> {
    let resultPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (let formula of formulas) {
      resultPromise = resultPromise.then((currentResult: Fmt.Expression[]) =>
        this.stripConstraintsFromFormula(formula, stripExactPositive, stripPositive, stripNegative, allowTrivialResult, context).then((strippedFormula: Fmt.Expression) =>
          currentResult.concat(strippedFormula)));
    }
    return resultPromise;
  }

  private stripConstraintsFromFormula(formula: Fmt.Expression, stripExactPositive: boolean, stripPositive: boolean, stripNegative: boolean, allowTrivialResult: boolean, context: HLMCheckerContext, negate: boolean = false): CachedPromise<Fmt.Expression> {
    let intermediatePromise = CachedPromise.resolve(formula);
    if (allowTrivialResult) {
      if (negate) {
        if (stripNegative) {
          intermediatePromise = this.isTriviallyDisprovable(formula, context).then((result: boolean) =>
            (result ? new FmtHLM.MetaRefExpression_or : formula));
        }
      } else {
        if (stripPositive) {
          intermediatePromise = this.isTriviallyProvable(formula, context).then((result: boolean) =>
            (result ? new FmtHLM.MetaRefExpression_and : formula));
        } else if (stripExactPositive) {
          for (let constraint of this.getAvailableConstraints(context, true)) {
            if (formula.isEquivalentTo(constraint.constraint)) {
              intermediatePromise = CachedPromise.resolve(new FmtHLM.MetaRefExpression_and);
            }
          }
        }
      }
    }
    return intermediatePromise.then((intermediateFormula: Fmt.Expression) => {
      if (intermediateFormula instanceof FmtHLM.MetaRefExpression_and && intermediateFormula.formulas) {
        let resultItemsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        for (let item of intermediateFormula.formulas) {
          resultItemsPromise = resultItemsPromise.then((currentResultItems: Fmt.Expression[]) =>
            this.stripConstraintsFromFormula(item, stripExactPositive, stripPositive, stripNegative, true, context, negate).then((strippedItem: Fmt.Expression) =>
              (this.utils.isTrueFormula(strippedItem) ? currentResultItems : currentResultItems.concat(strippedItem))));
        }
        return resultItemsPromise.then((resultItems: Fmt.Expression[]) => this.utils.createConjunction(resultItems));
      } else if (intermediateFormula instanceof FmtHLM.MetaRefExpression_or && intermediateFormula.formulas) {
        let resultItemsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        for (let item of intermediateFormula.formulas) {
          resultItemsPromise = resultItemsPromise.then((currentResultItems: Fmt.Expression[]) =>
            this.stripConstraintsFromFormula(item, stripExactPositive, stripPositive, stripNegative, true, context, !negate).then((strippedItem: Fmt.Expression) =>
              (this.utils.isFalseFormula(strippedItem) ? currentResultItems : currentResultItems.concat(strippedItem))));
        }
        return resultItemsPromise.then((resultItems: Fmt.Expression[]) => this.utils.createDisjunction(resultItems));
      }
      return intermediateFormula;
    });
  }

  private checkUnfolding(object: Object, sources: Fmt.Expression[], target: Fmt.Expression, sourceIsResult: boolean): void {
    if (target instanceof (sourceIsResult ? FmtHLM.MetaRefExpression_or : FmtHLM.MetaRefExpression_and)) {
      if (target.formulas) {
        for (let innerTarget of target.formulas) {
          this.checkUnfolding(object, sources, innerTarget, sourceIsResult);
        }
      }
    } else {
      let resultPromise = CachedPromise.resolve(false);
      for (let source of sources) {
        resultPromise = resultPromise.or(() => this.getUnfoldResult(source, target, sourceIsResult));
      }
      let check = resultPromise.then((result: boolean) => {
        if (!result) {
          let message: string;
          if (sources.length === 1) {
            message = `${sources[0]} does not unfold to ${target}`;
          } else if (sources.length) {
            message = `Neither ${sources.join(' nor ')} unfolds to ${target}`;
          } else {
            message = 'No source found';
          }
          this.error(object, message);
        }
      });
      this.addPendingCheck(object, check);
    }
  }

  private getUnfoldResult(source: Fmt.Expression, target: Fmt.Expression, sourceIsResult: boolean): CachedPromise<boolean> {
    if (source instanceof (sourceIsResult ? FmtHLM.MetaRefExpression_or : FmtHLM.MetaRefExpression_and)) {
      let resultPromise = CachedPromise.resolve(false);
      if (source.formulas) {
        for (let innerSource of source.formulas) {
          resultPromise = resultPromise.or(() => this.getUnfoldResult(innerSource, target, sourceIsResult));
        }
      }
      return resultPromise;
    } else {
      return this.utils.unfoldsTo(source, target);
    }
  }

  private checkImplication(object: Object, source: Fmt.Expression, targets: Fmt.Expression[]): void {
    let resultPromise = CachedPromise.resolve(false);
    for (let target of targets) {
      resultPromise = resultPromise.or(() => this.utils.triviallyImplies(source, target, true));
    }
    let check = resultPromise.then((result: boolean) => {
      if (!result) {
        this.error(object, `${source} does not trivially imply ${targets.join(' or ')}`);
      }
    });
    this.addPendingCheck(object, check);
  }

  private checkDeclaredResult(object: Object, result: Fmt.Expression | undefined, sources: Fmt.Expression[], context: HLMCheckerProofStepContext): void {
    if (result) {
      this.checkFormula(result, context);
    }
    let check = this.stripConstraintsFromFormulas(sources, false, false, true, true, context).then((strippedSources: Fmt.Expression[]) =>
      this.checkUnfolding(result ?? object, strippedSources, this.utils.getImplicationResult(result, context), false));
    this.addPendingCheck(object, check);
  }

  private checkBoolConstant(expression: Fmt.Expression | undefined): void {
    if (expression === undefined || expression instanceof FmtHLM.MetaRefExpression_false || expression instanceof FmtHLM.MetaRefExpression_true) {
      // Nothing further to check.
    } else {
      this.error(expression, 'Boolean value expected');
    }
  }

  private checkCompatibility(object: Object, elementTerms: Fmt.Expression[], setTerms: Fmt.Expression[], context: HLMCheckerContext): void {
    let declaredSetsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (let elementTerm of elementTerms) {
      declaredSetsPromise = declaredSetsPromise.then((declaredSets: Fmt.Expression[]) =>
        this.utils.getDeclaredSet(elementTerm).then((declaredSet: Fmt.Expression) => declaredSets.concat(declaredSet))
      );
    }
    let checkDeclaredSets = declaredSetsPromise.then((declaredSets: Fmt.Expression[]) => {
      declaredSets = declaredSets.concat(setTerms);
      return this.checkSetCompatibilityInternal(object, declaredSets, false, context, initialCompatibilityStatus).then((result: Fmt.Expression | undefined) => {
        if (!result) {
          this.error(object, `Type mismatch: ${declaredSets.join(' and ')} are incompatible`);
        }
      });
    });
    this.addPendingCheck(object, checkDeclaredSets);
  }

  private checkSetCompatibility(object: Object, setTerms: Fmt.Expression[], context: HLMCheckerContext): void {
    let check = this.checkSetCompatibilityInternal(object, setTerms, false, context, initialCompatibilityStatusWithoutElements).then((result: Fmt.Expression | undefined) => {
      if (!result) {
        this.error(object, `Type mismatch: ${setTerms.join(' and ')} are incompatible`);
      }
    });
    this.addPendingCheck(object, check);
  }

  private checkElementCompatibility(object: Object, elementTerms: Fmt.Expression[], context: HLMCheckerContext): void {
    if (elementTerms.length > 1) {
      this.checkCompatibility(object, elementTerms, [], context);
    }
  }

  private checkSubset(subset: Fmt.Expression, superset: Fmt.Expression, context: HLMCheckerContext): CachedPromise<boolean> {
    // I think setting checkSubset to true on the first try improves the way placeholders are filled,
    // but I'm not sure.
    return this.checkSetCompatibilityInternal(subset, [subset, superset], true, context, initialCompatibilityStatusWithoutElements)
      .then((subsetResult: Fmt.Expression | undefined) => {
        if (subsetResult) {
          return true;
        } else {
          return this.checkSetCompatibilityInternal(subset, [subset, superset], false, context, initialCompatibilityStatusWithoutElements)
            .then((result: Fmt.Expression | undefined) => {
              if (!result) {
                this.error(subset, `Type mismatch: subset of ${superset} expected`);
                return true;
              }
              return false;
            });
        }
      });
  }

  private checkElement(element: Fmt.Expression, set: Fmt.Expression, context: HLMCheckerContext): CachedPromise<boolean> {
    // I think setting checkSubset to true on the first try improves the way placeholders are filled,
    // but I'm not sure.
    return this.utils.getDeclaredSet(element).then((declaredSet: Fmt.Expression) =>
      this.checkSetCompatibilityInternal(element, [declaredSet, set], true, context, initialCompatibilityStatus)
        .then((elementResult: Fmt.Expression | undefined) => {
          if (elementResult) {
            return true;
          } else {
            return this.checkSetCompatibilityInternal(element, [declaredSet, set], false, context, initialCompatibilityStatusWithoutElements)
              .then((result: Fmt.Expression | undefined) => {
                if (!result) {
                  this.error(element, `Type mismatch: element of ${set} expected`);
                  return true;
                }
                return false;
              });
          }
        }));
  }

  private checkSetCompatibilityInternal(object: Object, setTerms: Fmt.Expression[], checkSubset: boolean, context: HLMCheckerContext, status: HLMCheckerCompatibilityStatus): CachedPromise<Fmt.Expression | undefined> {
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
            return CachedPromise.resolve(undefined);
          }
        }
        return CachedPromise.resolve(firstTerm);
      } else {
        let checkForDirectEquivalence = !status.directEquivalenceUnlikely && !status.checkedForDirectEquivalence && !this.options.supportPlaceholders;
        let nextSetTermsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        let nextStatus: HLMCheckerCompatibilityStatus = {
          directEquivalenceUnlikely: false,
          checkedForDirectEquivalence: status.checkedForDirectEquivalence || checkForDirectEquivalence,
          obtainedFinalSets: true,
          followedEmbeddings: status.obtainedFinalSets,
          addedStructuralCases: status.followedEmbeddings || !context.parentStructuralCases.length
        };
        let typeSearchParameters: HLMTypeSearchParameters = {
          unfoldVariableDefinitions: true,
          followDefinitions: true,
          followSupersets: true,
          followEmbeddings: nextStatus.followedEmbeddings && !checkSubset,
          followAllAlternatives: false,
          allowStructuralCaseResults: true,
          unfoldArguments: nextStatus.followedEmbeddings,
          substituteStructuralCases: true,
          extractStructuralCases: nextStatus.followedEmbeddings
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
        if (checkSubset) {
          typeSearchParameters = {
            ...typeSearchParameters,
            followSupersets: false,
            followEmbeddings: nextStatus.followedEmbeddings
          };
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
        return nextSetTermsPromise.then((nextSetTerms: Fmt.Expression[]) =>
          this.checkSetCompatibilityInternal(object, nextSetTerms, checkSubset, context, nextStatus));
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
        // TODO the order of handling left and right currently matters a lot, in fact the tutorial breaks if it is reversed -- this indicates some deeper problem
        if (rightExpression instanceof FmtHLM.MetaRefExpression_enumeration && rightExpression.terms && rightExpression.terms.length === 1) {
          let rightElement = rightExpression.terms[0];
          if (rightElement instanceof Fmt.PlaceholderExpression) {
            if (!replacedParameters.length) {
              this.addDeclaredSetRestriction(state, rightElement, leftExpression);
            }
            return true;
          }
        }
        if (leftExpression instanceof FmtHLM.MetaRefExpression_enumeration && leftExpression.terms && leftExpression.terms.length === 1) {
          let leftElement = leftExpression.terms[0];
          if (leftElement instanceof Fmt.PlaceholderExpression) {
            if (!replacedParameters.length) {
              this.addDeclaredSetRestriction(state, leftElement, rightExpression);
            }
            return true;
          }
        }
        let recheck = false;
        let isRoot = leftExpression === left && rightExpression === right;
        while (rightExpression instanceof Fmt.PlaceholderExpression) {
          let newRightExpression = this.addCompatibleTermRestriction(state, rightExpression, replacedParameters.length ? undefined : leftExpression);
          if (newRightExpression) {
            rightExpression = newRightExpression;
            recheck = true;
          } else {
            return true;
          }
        }
        while (leftExpression instanceof Fmt.PlaceholderExpression) {
          let newLeftExpression = this.addCompatibleTermRestriction(state, leftExpression, replacedParameters.length ? undefined : rightExpression);
          if (newLeftExpression) {
            leftExpression = newLeftExpression;
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

  private addPendingCheck(object: Object, check: CachedPromise<void>): void {
    check = check.catch((error) => this.conditionalError(object, error.message));
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
