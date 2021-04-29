import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as FmtUtils from '../../format/utils';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as HLMMacros from './macros/macros';
import { HLMExpressionType } from './types';
import { HLMUtils, HLMSubstitutionContext, HLMTypeSearchParameters, HLMBaseContext, HLMProofStepContext, HLMFormulaCase, HLMFormulaDefinition, HLMEquivalenceListInfo, HLMSubstitutionSourceInfo, followSupersetsAndEmbeddings, findConstruction } from './utils';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import { InternalError } from '../../utils/exception';
import CachedPromise from '../../data/cachedPromise';

const debugRecheck = true;

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, options: Logic.LogicCheckerOptions): CachedPromise<Logic.LogicCheckResult> {
    const utils = new HLMUtils(definition, libraryDataAccessor, options.supportPlaceholders);
    return HLMChecker.checkDefinitionWithUtils(definition, utils, options);
  }

  static checkDefinitionWithUtils(definition: Fmt.Definition, utils: HLMUtils, options: Logic.LogicCheckerOptions): CachedPromise<Logic.LogicCheckResult> {
    return HLMCheckerState.checkDefinition(definition, utils, options);
  }
}

export interface HLMCheckResult extends Logic.LogicCheckResult {
  rechecker?: HLMRechecker;
  autoFiller?: HLMAutoFiller;
}

export interface HLMRecheckResult<T> extends HLMCheckResult {
  value?: T;
}

type HLMCheckerCheckSubstitutionFn = (originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression, options: Logic.LogicCheckerOptions) => CachedPromise<HLMCheckResult>;
type HLMCheckerCheckConstraintFn = (formula: Fmt.Expression, options: Logic.LogicCheckerOptions) => CachedPromise<HLMCheckResult>;
type HLMCheckerCheckProofStepFn = (step: Fmt.Parameter, options: Logic.LogicCheckerOptions) => CachedPromise<HLMCheckResult>;
type HLMCheckerFillExpressionFn = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => void;

interface HLMCheckerStructuralCaseRef {
  term: Fmt.Expression;
  construction: Fmt.Expression;
  _constructor: Fmt.Expression;
  parameters: Fmt.ParameterList | undefined;
}

export interface HLMCheckerExternalContext extends HLMBaseContext {
  context: Ctx.Context;
}

interface HLMCheckerContext extends HLMCheckerExternalContext {
  binderSourceParameters: Fmt.Parameter[];
  temporaryParameters: Fmt.Parameter[];
  parentStructuralCases: HLMCheckerStructuralCaseRef[];
  inAutoArgument: boolean;
  currentCheckSubstitutionFn?: HLMCheckerCheckSubstitutionFn;
  currentPlaceholderCollection?: HLMCheckerPlaceholderCollection;
}

export interface HLMCheckerExternalProofStepContext extends HLMCheckerExternalContext, HLMProofStepContext {}

interface HLMCheckerProofStepContext extends HLMCheckerContext, HLMCheckerExternalProofStepContext {}

interface HLMCheckerProofEditData {
  context: HLMCheckerProofStepContext;
  checkProofStepFn: HLMCheckerCheckProofStepFn;
}

interface HLMCheckerRecheckData {
  checkSubstitutionFns: Map<Fmt.Expression, HLMCheckerCheckSubstitutionFn>;
  checkConstraintFns: Map<Fmt.ParameterList, HLMCheckerCheckConstraintFn>;
  incompleteProofs: Map<Fmt.ParameterList, HLMCheckerProofEditData>;
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

interface HLMCheckerPlaceholderRestriction {
  exactValueSuggestion?: Fmt.Expression;
  exactValue?: Fmt.Expression;
  compatibleSets: Fmt.Expression[];
  declaredSets: Fmt.Expression[];
  context: HLMCheckerContext;
}

type HLMCheckerPlaceholderRestrictions = Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>;

interface HLMCheckerPlaceholderRestrictionState {
  newRestrictions?: HLMCheckerPlaceholderRestrictions;
  exactValueRequired: boolean;
  context: HLMCheckerContext;
}

type CheckFn = (recheckState: HLMCheckerState, substitutedExpression: Fmt.Expression, recheckContext: HLMCheckerContext) => void;
type AutoFillFn = (placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn) => CachedPromise<void>;

interface HLMCheckerPlaceholderCollection {
  placeholders?: Fmt.PlaceholderExpression[];
  containsNonAutoPlaceholders: boolean;
  parentCollection?: HLMCheckerPlaceholderCollection;
  childCollections?: HLMCheckerPlaceholderCollection[];
  autoFillFn?: AutoFillFn;
}

interface HLMCheckerFillExpressionArgs {
  originalExpression: Fmt.Expression;
  filledExpression: Fmt.Expression;
}

type PendingCheck = () => CachedPromise<void>;

class HLMCheckerState {
  private pendingChecks: PendingCheck[] = [];
  private pendingChecksPromise?: CachedPromise<HLMCheckResult>;
  private placeholderCollection?: HLMCheckerPlaceholderCollection;
  private restrictions?: HLMCheckerPlaceholderRestrictions;
  private recheckData?: HLMCheckerRecheckData;
  private result: HLMCheckResult = {
    diagnostics: [],
    hasErrors: false
  };

  private constructor(private utils: HLMUtils, private options: Logic.LogicCheckerOptions) {
    if (this.options.supportPlaceholders) {
      this.placeholderCollection = {containsNonAutoPlaceholders: false};
      this.restrictions = new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>();
    }
    if (this.options.supportRechecking) {
      this.recheckData = {
        checkSubstitutionFns: new Map<Fmt.Expression, HLMCheckerCheckSubstitutionFn>(),
        checkConstraintFns: new Map<Fmt.ParameterList, HLMCheckerCheckConstraintFn>(),
        incompleteProofs: new Map<Fmt.ParameterList, HLMCheckerProofEditData>()
      };
      this.result.rechecker = new HLMRechecker(this.utils, this.recheckData);
    }
  }

  static checkDefinition(definition: Fmt.Definition, utils: HLMUtils, options: Logic.LogicCheckerOptions): CachedPromise<HLMCheckResult> {
    const checkFn = (checkerState: HLMCheckerState) => {
      const rootContext: HLMCheckerContext = {
        context: new Ctx.EmptyContext(FmtHLM.metaModel),
        binderSourceParameters: [],
        temporaryParameters: [],
        parentStructuralCases: [],
        inAutoArgument: false,
        stepResults: new Map<Fmt.Parameter, Fmt.Expression>(),
        currentPlaceholderCollection: checkerState.placeholderCollection
      };
      checkerState.checkTopLevelDefinition(definition, rootContext);
    };
    return HLMCheckerState.check(utils, options, definition, checkFn);
  }

  private static check(utils: HLMUtils, options: Logic.LogicCheckerOptions, object: Object, checkFn: (checkerState: HLMCheckerState) => void): CachedPromise<HLMCheckResult> {
    const checkerState = new HLMCheckerState(utils, options);
    try {
      checkFn(checkerState);
    } catch (error) {
      checkerState.error(object, error.message);
    }
    return checkerState.getResultPromise();
  }

  private getResultPromise(): CachedPromise<HLMCheckResult> {
    for (;;) {
      const nextCheck = this.pendingChecks.shift();
      if (!nextCheck) {
        break;
      }
      const nextCheckResult = nextCheck();
      if (nextCheckResult.isResolved()) {
        continue;
      }
      this.pendingChecksPromise = nextCheckResult
        .then(() => this.getResultPromise());
      return this.pendingChecksPromise
        .catch((error) => {
          this.pendingChecksPromise = undefined;
          this.pendingChecks.length = 0;
          return CachedPromise.reject(error);
        });
    }
    this.pendingChecksPromise = undefined;
    if (this.placeholderCollection && this.restrictions && !this.result.hasErrors) {
      this.result.autoFiller = new HLMAutoFiller(this.utils, this.placeholderCollection, this.restrictions);
    }
    return CachedPromise.resolve(this.result);
  }

  private checkTopLevelDefinition(definition: Fmt.Definition, context: HLMCheckerContext): void {
    const contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      this.checkMacroOperator(definition, contents, context);
    } else {
      const innerContext = this.checkParameterList(definition.parameters, context);
      if (contents instanceof FmtHLM.ObjectContents_Construction) {
        this.checkConstruction(definition, contents, innerContext);
      } else {
        for (const innerDefinition of definition.innerDefinitions) {
          this.error(innerDefinition, 'This type of object does not support inner definitions.');
        }
        // TODO check properties (currently: negation)
        if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          this.checkSetOperator(definition, contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          this.checkExplicitOperator(definition, contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          this.checkImplicitOperator(definition, contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          this.checkPredicate(definition, contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
          this.checkStandardTheorem(definition, contents, innerContext);
        } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          this.checkEquivalenceTheorem(definition, contents, innerContext);
        } else {
          this.error(definition.type, 'Invalid object type');
        }
      }
    }
  }

  private checkConstruction(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_Construction, context: HLMCheckerContext): void {
    for (const innerDefinition of definition.innerDefinitions) {
      const innerContext = this.checkParameterList(innerDefinition.parameters, context);
      const innerContents = innerDefinition.contents;
      if (innerContents instanceof FmtHLM.ObjectContents_Constructor) {
        this.checkConstructor(definition, innerDefinition, innerContents, context, innerContext);
      } else {
        this.error(innerDefinition, 'Invalid object type');
      }
    }
    if (contents.embedding) {
      this.checkEmbedding(definition, contents.embedding, context);
    }
    if (contents.rewrite) {
      this.checkConstructionRewriteDefinition(definition, contents.rewrite, context);
    }
  }

  private checkConstructor(definition: Fmt.Definition, innerDefinition: Fmt.Definition, innerContents: FmtHLM.ObjectContents_Constructor, context: HLMCheckerContext, innerContext: HLMCheckerContext): void {
    if (innerContents.equalityDefinition) {
      this.checkEqualityDefinition(innerDefinition, innerContents.equalityDefinition, context);
    } else if (innerDefinition.parameters.length) {
      this.error(innerDefinition, 'Constructor with parameters requires equality definition');
    }
    if (innerContents.rewrite) {
      this.checkConstructorRewriteDefinition(definition, innerDefinition, innerContents.rewrite, innerContext);
    }
  }

  private checkEqualityDefinition(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_ConstructorEqualityDefinition, context: HLMCheckerContext): void {
    const constructorParameters = innerDefinition.parameters;
    if (!this.checkEquivalenceWithPlaceholders(equalityDefinition.leftParameters, constructorParameters, context)) {
      this.error(equalityDefinition.leftParameters, 'Parameters of equality definition must match constructor parameters');
    }
    if (!this.checkEquivalenceWithPlaceholders(equalityDefinition.rightParameters, constructorParameters, context)) {
      this.error(equalityDefinition.rightParameters, 'Parameters of equality definition must match constructor parameters');
    }
    this.checkFormulaEquivalenceList(innerDefinition, equalityDefinition.definition, equalityDefinition.equivalenceProofs, context);
    if (equalityDefinition.definition.length) {
      this.checkEqualityDefinitionProofs(innerDefinition, equalityDefinition, context);
    }
  }

  private checkEqualityDefinitionProofs(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_ConstructorEqualityDefinition, context: HLMCheckerContext): void {
    const isomorphic = (equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true);
    if (isomorphic) {
      this.checkIsomorphicProperty(equalityDefinition.leftParameters, equalityDefinition.rightParameters, equalityDefinition.definition[0], context);
    }
    if (!isomorphic || equalityDefinition.reflexivityProof) {
      const parameters = innerDefinition.parameters.clone();
      const goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters, parameters);
      this.checkProof(equalityDefinition, equalityDefinition.reflexivityProof, parameters, goal, context);
    }
    if (!isomorphic || equalityDefinition.symmetryProof) {
      const parameters1 = innerDefinition.parameters.clone();
      const parameters2 = innerDefinition.parameters.clone();
      const parameters = new Fmt.ParameterList(...parameters1, ...parameters2);
      this.utils.addProofConstraint(parameters, this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters2));
      const goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters2, parameters1);
      this.checkProof(equalityDefinition, equalityDefinition.symmetryProof, parameters, goal, context);
    }
    if (!isomorphic || equalityDefinition.transitivityProof) {
      const parameters1 = innerDefinition.parameters.clone();
      const parameters2 = innerDefinition.parameters.clone();
      const parameters3 = innerDefinition.parameters.clone();
      const parameters = new Fmt.ParameterList(...parameters1, ...parameters2, ...parameters3);
      this.utils.addProofConstraint(parameters, this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters2));
      this.utils.addProofConstraint(parameters, this.getSubstitutedEqualityDefinition(equalityDefinition, parameters2, parameters3));
      const goal = this.getSubstitutedEqualityDefinition(equalityDefinition, parameters1, parameters3);
      this.checkProof(equalityDefinition, equalityDefinition.transitivityProof, parameters, goal, context);
    }
  }

  private getSubstitutedEqualityDefinition(equalityDefinition: FmtHLM.ObjectContents_ConstructorEqualityDefinition, leftParameters: Fmt.ParameterList, rightParameters: Fmt.ParameterList): Fmt.Expression {
    let formula = equalityDefinition.definition[0];
    formula = this.utils.substituteParameters(formula, equalityDefinition.leftParameters, leftParameters);
    return this.utils.substituteParameters(formula, equalityDefinition.rightParameters, rightParameters);
  }

  private checkConstructorRewriteDefinition(definition: Fmt.Definition, innerDefinition: Fmt.Definition, rewriteDefinition: FmtHLM.ObjectContents_ConstructorRewriteDefinition, context: HLMCheckerContext): void {
    this.checkElementTerm(rewriteDefinition.value, context);
    const substitutionContext = new HLMSubstitutionContext;
    const constructionArgs = this.utils.getParameterArguments(definition.parameters, substitutionContext);
    const constructionPath = new Fmt.Path(definition.name, constructionArgs);
    const constructorArgs = this.utils.getParameterArguments(innerDefinition.parameters, substitutionContext);
    const constructorPath = new Fmt.Path(innerDefinition.name, constructorArgs, constructionPath);
    const constructorExpression = new Fmt.DefinitionRefExpression(constructorPath);
    this.checkElementCompatibility(rewriteDefinition.value, [constructorExpression, rewriteDefinition.value], context);
    // TODO check whether rewrite definition matches referenced theorem
  }

  private checkEmbedding(definition: Fmt.Definition, embedding: FmtHLM.ObjectContents_Embedding, context: HLMCheckerContext): void {
    // TODO make sure that embedding does not implicitly reference itself (e.g. in the well-definedness proof)
    const [subset, innerContext] = this.checkElementParameter(embedding.parameter, context);
    if (subset) {
      this.checkEmbeddability(subset);
    }
    this.checkElementTerm(embedding.target, innerContext);
    const substitutionContext = new HLMSubstitutionContext;
    const constructionArgs = this.utils.getParameterArguments(definition.parameters, substitutionContext);
    const constructionPath = new Fmt.Path(definition.name, constructionArgs);
    const constructionExpression = new Fmt.DefinitionRefExpression(constructionPath);
    this.checkCompatibility(embedding.target, [embedding.target], [constructionExpression], innerContext);
    this.checkEmbeddingWellDefinednessProof(embedding, context);
  }

  private checkEmbeddability(subset: Fmt.Expression): void {
    const checkSubset = this.utils.getFinalSuperset(subset, followSupersetsAndEmbeddings).then((superset: Fmt.Expression) => {
      if (this.utils.isWildcardFinalSet(superset)) {
        this.error(subset!, 'The given set cannot be embedded');
      }
    });
    this.addPendingCheck(subset, checkSubset);
  }

  private checkEmbeddingWellDefinednessProof(embedding: FmtHLM.ObjectContents_Embedding, context: HLMCheckerContext): void {
    // TODO check "full" property of embedding
    const leftParam = embedding.parameter.clone();
    const rightParam = leftParam.shallowClone();
    const leftTerm = this.utils.substituteParameter(embedding.target, embedding.parameter, leftParam);
    const rightTerm = this.utils.substituteParameter(embedding.target, embedding.parameter, rightParam);
    const parameters = new Fmt.ParameterList;
    parameters.push(leftParam, rightParam);
    const constraint = new FmtHLM.MetaRefExpression_equals(leftTerm, rightTerm);
    this.utils.addProofConstraint(parameters, constraint);
    const leftVariableRef = new Fmt.VariableRefExpression(leftParam);
    const rightVariableRef = new Fmt.VariableRefExpression(rightParam);
    const goal = new FmtHLM.MetaRefExpression_equals(leftVariableRef, rightVariableRef);
    this.checkProof(embedding, embedding.wellDefinednessProof, parameters, goal, context);
  }

  private checkConstructionRewriteDefinition(definition: Fmt.Definition, rewriteDefinition: FmtHLM.ObjectContents_ConstructionRewriteDefinition, context: HLMCheckerContext): void {
    const substitutionContext = new HLMSubstitutionContext;
    const constructionArgs = this.utils.getParameterArguments(definition.parameters, substitutionContext);
    const constructionPath = new Fmt.Path(definition.name, constructionArgs);
    const constructionExpression = new Fmt.DefinitionRefExpression(constructionPath);
    const [set, innerContext] = this.checkElementParameter(rewriteDefinition.parameter, context);
    if (set && !this.utils.areExpressionsSyntacticallyEquivalent(set, constructionExpression)) {
      this.error(set, 'Rewrite parameter must match construction');
    }
    this.checkElementTerm(rewriteDefinition.value, context);
    this.checkCompatibility(rewriteDefinition.value, [rewriteDefinition.value], [constructionExpression], context);
    // TODO check whether rewrite definition matches referenced theorem
  }

  private checkSetOperator(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_SetOperator, context: HLMCheckerContext): void {
    this.checkSetTermEquivalenceList(definition, contents.definition, contents.equalityProofs, context);
  }

  private checkExplicitOperator(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_ExplicitOperator, context: HLMCheckerContext): void {
    this.checkElementTermEquivalenceList(definition, contents.definition, contents.equalityProofs, context);
  }

  private checkImplicitOperator(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_ImplicitOperator, context: HLMCheckerContext): void {
    const [set, innerContext] = this.checkElementParameter(contents.parameter, context);
    this.checkFormulaEquivalenceList(definition, contents.definition, contents.equivalenceProofs, innerContext);
    if (contents.definition.length) {
      this.checkImplicitOperatorWellDefinednessProof(contents, context);
    }
  }

  private checkImplicitOperatorWellDefinednessProof(contents: FmtHLM.ObjectContents_ImplicitOperator, context: HLMCheckerContext): void {
    const param = contents.parameter.clone();
    const parameters = new Fmt.ParameterList(param);
    const formula = this.utils.substituteParameter(contents.definition[0], contents.parameter, param);
    const goal = new FmtHLM.MetaRefExpression_existsUnique(parameters, formula);
    this.checkProof(contents, contents.wellDefinednessProof, undefined, goal, context);
  }

  private checkPredicate(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_Predicate, context: HLMCheckerContext): void {
    this.checkFormulaEquivalenceList(definition, contents.definition, contents.equivalenceProofs, context);
  }

  private checkStandardTheorem(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_StandardTheorem, context: HLMCheckerContext): void {
    this.checkFormula(contents.claim, context);
    this.checkProofs(contents.proofs, contents.claim, context);
  }

  private checkEquivalenceTheorem(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_EquivalenceTheorem, context: HLMCheckerContext): void {
    this.checkFormulaEquivalenceList(definition, contents.conditions, contents.equivalenceProofs, context);
  }

  private checkMacroOperator(definition: Fmt.Definition, contents: FmtHLM.ObjectContents_MacroOperator, context: HLMCheckerContext): void {
    try {
      const macroInstance = HLMMacros.instantiateMacro(this.utils.libraryDataAccessor, definition);
      const checkMacro = macroInstance.check().then((diagnostics: Logic.LogicCheckDiagnostic[]) => {
        this.result.diagnostics.push(...diagnostics);
        if (diagnostics.some((diagnostic: Logic.LogicCheckDiagnostic) => diagnostic.severity === Logic.DiagnosticSeverity.Error)) {
          this.result.hasErrors = true;
        }
      });
      this.addPendingCheck(definition, checkMacro);
    } catch (error) {
      this.error(definition, error.message);
    }
  }

  private setCurrentRecheckFn(expression: Fmt.Expression, checkFn: CheckFn, autoFillFn: AutoFillFn | undefined, context: HLMCheckerContext): HLMCheckerContext {
    if (this.recheckData || context.currentPlaceholderCollection) {
      const newContext: HLMCheckerContext = {...context};
      if (this.recheckData) {
        newContext.currentCheckSubstitutionFn = (originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression, options: Logic.LogicCheckerOptions) => {
          const substituted = FmtUtils.substituteExpression(expression, originalExpression, substitutedExpression);
          const fn = (recheckState: HLMCheckerState, recheckContext: HLMCheckerContext) => {
            checkFn(recheckState, substituted, recheckContext);
            if (this.restrictions && originalExpression instanceof Fmt.PlaceholderExpression) {
              recheckState.checkAdditionalRestrictions(substitutedExpression, this.restrictions, recheckContext);
            }
          };
          return this.recheck(substitutedExpression, fn, options, context);
        };
      }
      if (context.currentPlaceholderCollection) {
        newContext.currentPlaceholderCollection = {
          containsNonAutoPlaceholders: false,
          parentCollection: context.currentPlaceholderCollection,
          autoFillFn: autoFillFn
        };
        if (context.currentPlaceholderCollection.childCollections) {
          context.currentPlaceholderCollection.childCollections.push(newContext.currentPlaceholderCollection);
        } else {
          context.currentPlaceholderCollection.childCollections = [newContext.currentPlaceholderCollection];
        }
      }
      return newContext;
    } else {
      return context;
    }
  }

  private recheck(object: Object, fn: (recheckState: HLMCheckerState, recheckContext: HLMCheckerContext) => void, options: Logic.LogicCheckerOptions, context: HLMCheckerContext): CachedPromise<HLMCheckResult> {
    return HLMCheckerState.check(this.utils, options, object, (checkerState: HLMCheckerState) => {
      const recheckContext: HLMCheckerContext = {
        ...context,
        stepResults: new Map<Fmt.Parameter, Fmt.Expression>(context.stepResults),
        currentCheckSubstitutionFn: undefined,
        currentPlaceholderCollection: checkerState.placeholderCollection
      };
      return fn(checkerState, recheckContext);
    });
  }

  private checkAdditionalRestrictions(object: Object, restrictions: HLMCheckerPlaceholderRestrictions, context: HLMCheckerContext): void {
    let lastSetsToCheckLength = 0;
    const checkRestrictions = () => {
      const setsToCheck: Fmt.Expression[][] = [];
      for (const [placeholder, restriction] of restrictions) {
        if (placeholder.specialRole !== Fmt.SpecialPlaceholderRole.Temporary) {
          const sets = restriction.compatibleSets.concat(restriction.declaredSets);
          if (sets.length > 1) {
            setsToCheck.push(sets);
          }
        }
      }
      if (setsToCheck.length > lastSetsToCheckLength) {
        for (const sets of setsToCheck) {
          this.checkSetCompatibility(object, sets, context);
        }
        lastSetsToCheckLength = setsToCheck.length;
        this.pendingChecks.push(checkRestrictions);
      }
      return CachedPromise.resolve();
    };
    this.pendingChecks.push(checkRestrictions);
  }

  private checkParameterList<ContextType extends HLMCheckerContext>(parameterList: Fmt.ParameterList, context: ContextType): ContextType {
    let currentContext = context;
    for (const param of parameterList) {
      currentContext = this.checkParameter(param, currentContext);
    }
    if (this.recheckData) {
      const constraintCheckFn = (formula: Fmt.Expression, options: Logic.LogicCheckerOptions) => {
        const fn = (recheckState: HLMCheckerState, recheckContext: HLMCheckerContext) => recheckState.checkFormula(formula, recheckContext);
        return this.recheck(formula, fn, options, context);
      };
      this.recheckData.checkConstraintFns.set(parameterList, constraintCheckFn);
    }
    return currentContext;
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
    const recheckFn = (recheckState: HLMCheckerState, substitutedType: Fmt.Expression, recheckContext: HLMCheckerContext) => recheckState.checkParameterType(param, substitutedType, recheckContext);
    const typeContext = this.setCurrentRecheckFn(type, recheckFn, undefined, context);
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
      const sourceContext = this.checkParameterList(type.sourceParameters, context);
      const resultContext = this.checkParameterList(type.targetParameters, sourceContext);
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

  private checkElementParameter<ContextType extends HLMCheckerContext>(param: Fmt.Parameter, context: ContextType): [Fmt.Expression | undefined, ContextType] {
    const type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Element) {
      const resultContext = this.checkParameter(param, context);
      return [type._set, resultContext];
    } else {
      this.error(type, 'Element parameter expected');
      return [undefined, context];
    }
  }

  private checkArgumentLists(argumentLists: Fmt.ArgumentList[], parameterLists: Fmt.ParameterList[], targetPath: Fmt.PathItem | undefined, context: HLMCheckerContext): void {
    const substitutionContext = new HLMSubstitutionContext;
    this.utils.addTargetPathSubstitution(targetPath, substitutionContext);
    for (let listIndex = 0; listIndex < argumentLists.length; listIndex++) {
      this.addAndCheckArgumentList(parameterLists[listIndex], argumentLists[listIndex], targetPath, context, substitutionContext);
    }
  }

  private addAndCheckArgumentList(parameterList: Fmt.ParameterList, argumentList: Fmt.ArgumentList, targetPath: Fmt.PathItem | undefined, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    this.utils.addArgumentListSubstitution(parameterList, argumentList, targetPath, substitutionContext);
    for (const param of parameterList) {
      this.checkArgument(param, argumentList, context, substitutionContext);
    }
  }

  private checkArgument(param: Fmt.Parameter, argumentList: Fmt.ArgumentList, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    const rawArg = argumentList.getOptionalValue(param.name);
    this.checkRawArgument(param, argumentList, rawArg, param.type, context, substitutionContext);
  }

  private checkRawArgument(param: Fmt.Parameter, argumentList: Fmt.ArgumentList, rawArg: Fmt.Expression | undefined, type: Fmt.Expression, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    if (type instanceof Fmt.IndexedExpression && rawArg) {
      if (rawArg instanceof Fmt.ArrayExpression) {
        for (const item of rawArg.items) {
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
    const type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Set) {
      if (rawArg) {
        const setArg = FmtHLM.ObjectContents_SetArg.createFromExpression(rawArg);
        this.checkSetTerm(setArg._set, this.getAutoArgumentContext(type.auto, context));
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      if (rawArg) {
        const superset = this.utils.applySubstitutionContext(type.superset, substitutionContext);
        const subsetArg = FmtHLM.ObjectContents_SubsetArg.createFromExpression(rawArg);
        this.checkSetTerm(subsetArg._set, this.getAutoArgumentContext(type.auto, context));
        const checkSubset = this.checkSubset(subsetArg._set, superset, context).then((isTrivialSubset: boolean) => {
          if (!isTrivialSubset || subsetArg.subsetProof) {
            const subsetFormula = new FmtHLM.MetaRefExpression_sub(subsetArg._set, superset);
            this.checkProof(object, subsetArg.subsetProof, undefined, subsetFormula, context);
          }
        });
        this.addPendingCheck(subsetArg._set, checkSubset);
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      if (rawArg) {
        const set = this.utils.applySubstitutionContext(type._set, substitutionContext);
        const elementArg = FmtHLM.ObjectContents_ElementArg.createFromExpression(rawArg);
        this.checkElementTerm(elementArg.element, this.getAutoArgumentContext(type.auto, context));
        const checkElement = this.checkElement(elementArg.element, set, context).then((isTrivialElement: boolean) => {
          if (!isTrivialElement || elementArg.elementProof) {
            const elementFormula = new FmtHLM.MetaRefExpression_in(elementArg.element, set);
            this.checkProof(object, elementArg.elementProof, undefined, elementFormula, context);
          }
        });
        this.addPendingCheck(elementArg.element, checkElement);
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      if (rawArg) {
        const propArg = FmtHLM.ObjectContents_PropArg.createFromExpression(rawArg);
        this.checkFormula(propArg.formula, this.getAutoArgumentContext(type.auto, context));
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      const constraint = this.utils.applySubstitutionContext(type.formula, substitutionContext);
      const constraintArg = rawArg ? FmtHLM.ObjectContents_ConstraintArg.createFromExpression(rawArg) : undefined;
      this.checkProof(object, constraintArg?.proof, undefined, constraint, context);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      if (rawArg) {
        const binderArg = FmtHLM.ObjectContents_BinderArg.createFromExpression(rawArg);
        const expectedSourceParameters = this.utils.applySubstitutionContextToParameterList(type.sourceParameters, substitutionContext);
        if (!this.checkEquivalenceWithPlaceholders(binderArg.sourceParameters, expectedSourceParameters, context)) {
          this.error(binderArg.sourceParameters, 'Parameter list must match binder');
        }
        const innerSubstitutionContext = new HLMSubstitutionContext(substitutionContext);
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
    if (this.recheckData && context.currentCheckSubstitutionFn) {
      this.recheckData.checkSubstitutionFns.set(expression, context.currentCheckSubstitutionFn);
    }
  }

  private checkSetTerm(term: Fmt.Expression, context: HLMCheckerContext): void {
    this.handleExpression(term, context);
    if (term instanceof Fmt.VariableRefExpression || term instanceof Fmt.IndexedExpression) {
      const checkType = (type: Fmt.Expression) => (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_SetDef);
      this.checkVariableRefExpression(term, checkType, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      const checkDefinitionRef = this.utils.getOuterDefinition(term).then((definition: Fmt.Definition) => {
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
      const [set, innerContext] = this.checkElementParameter(term.parameter, context);
      this.checkFormula(term.formula, innerContext);
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      const innerContext = this.checkParameterList(term.parameters, context);
      this.checkElementTerm(term.term, innerContext);
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      const checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkSetTerm(value, caseContext);
      const checkCompatibility = (values: Fmt.Expression[]) => this.checkSetCompatibility(term, values, context);
      const replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (const newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
        }
        const newTerm = new FmtHLM.MetaRefExpression_setStructuralCases(term.term, term.construction, newCases);
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      const getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext) => {
        const result = new FmtHLM.MetaRefExpression_sub(leftValue, rightValue);
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
    for (const item of terms) {
      this.checkSetTerm(item, context);
    }
    this.checkSetCompatibility(object, terms, context);
  }

  private checkElementTerm(term: Fmt.Expression, context: HLMCheckerContext): void {
    this.handleExpression(term, context);
    if (term instanceof Fmt.VariableRefExpression || term instanceof Fmt.IndexedExpression) {
      const checkType = (type: Fmt.Expression) => (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def);
      this.checkVariableRefExpression(term, checkType, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      const checkDefinitionRef = this.utils.getOuterDefinition(term).then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction && term.path.parentPath instanceof Fmt.Path && !(term.path.parentPath.parentPath instanceof Fmt.Path)) {
          const innerDefinition = definition.innerDefinitions.getDefinition(term.path.name);
          this.checkDefinitionRefExpression(term, [definition, innerDefinition], context);
        } else if (definition.contents instanceof FmtHLM.ObjectContents_Operator) {
          this.checkDefinitionRefExpression(term, [definition], context);
        } else {
          this.error(term, 'Referenced definition must be a constructor or operator');
        }
      });
      this.addPendingCheck(term, checkDefinitionRef);
    } else if (term instanceof FmtHLM.MetaRefExpression_cases) {
      const formulas: Fmt.Expression[] = [];
      const values: Fmt.Expression[] = [];
      for (const item of term.cases) {
        this.checkFormula(item.formula, context);
        this.checkElementTerm(item.value, context);
        const exclusivityParameters = new Fmt.ParameterList;
        const exclusivityConstraint = this.utils.createDisjunction(formulas);
        this.utils.addProofConstraint(exclusivityParameters, exclusivityConstraint);
        const exclusivityGoalPromise = this.utils.negateFormula(item.formula, true);
        const checkProof = exclusivityGoalPromise.then((exclusivityGoal: Fmt.Expression) =>
          this.checkProof(term, item.exclusivityProof, exclusivityParameters, exclusivityGoal, context));
        this.addPendingCheck(term, checkProof);
        formulas.push(item.formula);
        values.push(item.value);
      }
      const totalityGoal = this.utils.createDisjunction(formulas);
      this.checkProof(term, term.totalityProof, undefined, totalityGoal, context);
      this.checkElementCompatibility(term, values, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      const checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkElementTerm(value, caseContext);
      const checkCompatibility = (values: Fmt.Expression[]) => this.checkElementCompatibility(term, values, context);
      const replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (const newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
        }
        const newTerm = new FmtHLM.MetaRefExpression_structuralCases(term.term, term.construction, newCases);
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      const getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext) => {
        const result = new FmtHLM.MetaRefExpression_equals(leftValue, rightValue);
        // TODO support well-definedness proofs in cases where the goal can be written as an isomorphism condition
        this.checkFormula(result, wellDefinednessContext);
        return result;
      };
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, replaceCases, getWellDefinednessProofGoal, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      this.checkElementTerm(term.term, context);
      this.checkSetTerm(term._set, context);
      const checkElement = this.checkElement(term.term, term._set, context).then((isTrivialElement: boolean) => {
        if (!isTrivialElement || term.proof) {
          const elementFormula = new FmtHLM.MetaRefExpression_in(term.term, term._set);
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
    for (const item of terms) {
      this.checkElementTerm(item, context);
    }
    this.checkElementCompatibility(object, terms, context);
  }

  private checkFormula(formula: Fmt.Expression, context: HLMCheckerContext): void {
    const recheckFn = (recheckState: HLMCheckerState, substitutedFormula: Fmt.Expression, recheckContext: HLMCheckerContext) => recheckState.checkFormula(substitutedFormula, recheckContext);
    context = this.setCurrentRecheckFn(formula, recheckFn, undefined, context);
    this.handleExpression(formula, context);
    if (formula instanceof Fmt.VariableRefExpression || formula instanceof Fmt.IndexedExpression) {
      const checkType = (type: Fmt.Expression) => (type instanceof FmtHLM.MetaRefExpression_Prop);
      this.checkVariableRefExpression(formula, checkType, context);
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      const checkDefinitionRef = this.utils.getOuterDefinition(formula).then((definition: Fmt.Definition) => {
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
        for (const item of formula.formulas) {
          this.checkFormula(item, checkContext);
          if (formula instanceof FmtHLM.MetaRefExpression_and || formula instanceof FmtHLM.MetaRefExpression_or) {
            const constraintFormula = formula instanceof FmtHLM.MetaRefExpression_or ? this.utils.negateFormula(item, false).getImmediateResult()! : item;
            const constraintParam = this.utils.createConstraintParameter(constraintFormula, '_');
            checkContext = {
              ...checkContext,
              temporaryParameters: checkContext.temporaryParameters.concat(constraintParam)
            };
            checkContext = getParameterContext(constraintParam, checkContext);
          }
        }
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall || formula instanceof FmtHLM.MetaRefExpression_exists || formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
      if (formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
        for (const param of formula.parameters) {
          if (!(param.type instanceof FmtHLM.MetaRefExpression_Element || param.type instanceof FmtHLM.MetaRefExpression_Constraint)) {
            this.error(param.type, 'Element or constraint parameter expected');
          }
        }
      }
      const innerContext = this.checkParameterList(formula.parameters, context);
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
      const checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkFormula(value, caseContext);
      const replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (const newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.Formula);
        }
        const newFormula = new FmtHLM.MetaRefExpression_structural(formula.term, formula.construction, newCases);
        return {
          originalExpression: formula,
          filledExpression: newFormula
        };
      };
      const getWellDefinednessProofGoal = (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => {
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
    const parameterLists: Fmt.ParameterList[] = [];
    const argumentLists: Fmt.ArgumentList[] = [];
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
    const simplifiedPath = this.utils.libraryDataAccessor.simplifyPath(path);
    if (simplifiedPath !== path) {
      this.message(path, `Path can be simplified to ${simplifiedPath.toString()}`, Logic.DiagnosticSeverity.Hint);
    }
  }

  private checkStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCase: (value: Fmt.Expression, caseContext: HLMCheckerContext) => void, checkCompatibility: ((values: Fmt.Expression[]) => void) | undefined, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, getWellDefinednessProofGoal: (leftValue: Fmt.Expression, rightValue: Fmt.Expression, wellDefinednessContext: HLMCheckerContext, proofParameters: Fmt.ParameterList) => Fmt.Expression, context: HLMCheckerContext): void {
    const checkCaseInternal = (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter, caseContext: HLMCheckerContext) => {
      caseContext = getParameterContext(constraintParam, caseContext);
      checkCase(structuralCase.value, caseContext);
      if ((constructorContents.equalityDefinition && !(constructorContents.equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true)) || structuralCase.wellDefinednessProof) {
        let clonedParameters: Fmt.ParameterList;
        const replacedParameters: Fmt.ReplacedParameter[] = [];
        let clonedValue = structuralCase.value;
        if (structuralCase.parameters) {
          clonedParameters = structuralCase.parameters.clone(replacedParameters);
          clonedValue = this.utils.substituteParameters(structuralCase.value, structuralCase.parameters, clonedParameters);
        } else {
          clonedParameters = new Fmt.ParameterList;
        }
        clonedParameters.push(constraintParam.clone(replacedParameters));
        const goalContext = getParameterListContext(clonedParameters, caseContext);
        const goal = getWellDefinednessProofGoal(structuralCase.value, clonedValue, goalContext, clonedParameters);
        this.checkProof(structuralCase.value, structuralCase.wellDefinednessProof, clonedParameters, goal, caseContext);
      }
    };
    this.checkStructuralCasesInternal(term, construction, cases, checkCaseInternal, undefined, replaceCases, context);

    if (checkCompatibility) {
      const values = cases.map((structuralCase: FmtHLM.ObjectContents_StructuralCase) => structuralCase.value);
      checkCompatibility(values);
    }
  }

  private checkStructuralCasesInternal(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCaseInternal: (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter, caseContext: HLMCheckerContext) => void, prepareCaseInternal: ((structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter) => void) | undefined, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, context: HLMCheckerContext): void {
    this.checkStructuralCaseTerm(term, construction, prepareCaseInternal, replaceCases, context);
    if (construction instanceof Fmt.DefinitionRefExpression) {
      const constructionPath = construction.path;
      const constructionPathWithoutArguments = new Fmt.Path(constructionPath.name, undefined, constructionPath.parentPath);
      let index = 0;
      const checkConstructor = (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => {
        if (index < cases.length) {
          const structuralCase = cases[index];
          if (structuralCase._constructor instanceof Fmt.DefinitionRefExpression) {
            const constructorPath = structuralCase._constructor.path;
            if (!(constructorPath.parentPath instanceof Fmt.Path && constructorPath.parentPath.isEquivalentTo(constructionPathWithoutArguments))) {
              this.error(structuralCase._constructor, 'Constructor path must match construction path (without arguments)');
            }
            if (constructorPath.name === constructorDefinition.name) {
              if (structuralCase.parameters) {
                if (!this.checkEquivalenceWithPlaceholders(structuralCase.parameters, substitutedParameters, context)) {
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
                caseContext = getParameterListContext(structuralCase.parameters, caseContext);
              }
              const structuralCaseTerm = this.utils.getResolvedStructuralCaseTerm(constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents);
              const constraintParam = this.utils.getStructuralCaseConstraintParameter(term, structuralCaseTerm);
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
      const checkCases = this.forAllConstructors(construction, checkConstructor).then(() => {
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
    const recheckFn = (recheckState: HLMCheckerState, substitutedTerm: Fmt.Expression, recheckContext: HLMCheckerContext) => recheckState.checkStructuralCaseTerm(substitutedTerm, construction, prepareCaseInternal, replaceCases, recheckContext);
    let autoFillFn = undefined;
    if (context.currentPlaceholderCollection && construction instanceof Fmt.PlaceholderExpression) {
      autoFillFn = (placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn) => {
        const filledConstruction = placeholderValues.get(construction);
        if (filledConstruction instanceof Fmt.DefinitionRefExpression) {
          const constructionPath = filledConstruction.path;
          const constructionPathWithoutArguments = new Fmt.Path(constructionPath.name, undefined, constructionPath.parentPath);
          const newCases: FmtHLM.ObjectContents_StructuralCase[] = [];
          const newParameterLists: Fmt.ParameterList[] = [];
          const addCase = (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => {
            if (constructionContents.rewrite && construction.specialRole === Fmt.SpecialPlaceholderRole.Preview) {
              return;
            }
            const constructorPath = new Fmt.Path(constructorDefinition.name, undefined, constructionPathWithoutArguments);
            const constructorExpression = new Fmt.DefinitionRefExpression(constructorPath);
            let clonedParameters: Fmt.ParameterList | undefined = undefined;
            if (substitutedParameters.length) {
              clonedParameters = substitutedParameters.clone();
              newParameterLists.push(clonedParameters);
            }
            const rewrite = constructorContents.rewrite ? new FmtHLM.MetaRefExpression_true : undefined;
            const structuralCase = new FmtHLM.ObjectContents_StructuralCase(constructorExpression, clonedParameters, new Fmt.PlaceholderExpression(undefined), rewrite);
            if (prepareCaseInternal) {
              const structuralCaseTerm = this.utils.getResolvedStructuralCaseTerm(constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents);
              const constraintParam = this.utils.getStructuralCaseConstraintParameter(term, structuralCaseTerm);
              prepareCaseInternal(structuralCase, constructorContents, structuralCaseTerm, constraintParam);
            }
            newCases.push(structuralCase);
          };
          return this.forAllConstructors(filledConstruction, addCase)
            .then(() => {
              const substitution = replaceCases(newCases);
              onFillExpression(substitution.originalExpression, substitution.filledExpression, newParameterLists);
            });
        }
        return CachedPromise.resolve();
      };
    }
    context = this.setCurrentRecheckFn(term, recheckFn, autoFillFn, context);
    this.checkElementTerm(term, context);
    this.checkSetTerm(construction, this.getAutoFillContext(context));
    const checkConstructionRef = this.utils.getFinalSet(term, findConstruction).then((finalSet: Fmt.Expression) => {
      if (!((finalSet instanceof Fmt.DefinitionRefExpression || finalSet instanceof Fmt.PlaceholderExpression)
            && this.checkEquivalenceOfTemporarySetTerms(construction, finalSet, context))) {
        this.error(term, 'Term must be an element of the specified construction');
      }
    });
    this.addPendingCheck(term, checkConstructionRef);
  }

  private forAllConstructors(construction: Fmt.DefinitionRefExpression, callbackFn: (constructionDefinition: Fmt.Definition, constructionContents: FmtHLM.ObjectContents_Construction, constructorDefinition: Fmt.Definition, contents: FmtHLM.ObjectContents_Constructor, substitutedParameters: Fmt.ParameterList) => void): CachedPromise<void> {
    return this.utils.getOuterDefinition(construction)
      .then((constructionDefinition: Fmt.Definition) => {
        if (constructionDefinition.contents instanceof FmtHLM.ObjectContents_Construction) {
          for (const constructorDefinition of constructionDefinition.innerDefinitions) {
            if (constructorDefinition.contents instanceof FmtHLM.ObjectContents_Constructor) {
              const substitutionContext = new HLMSubstitutionContext;
              this.utils.addPathSubstitution(construction.path, [constructionDefinition], substitutionContext);
              const substitutedParameters = this.utils.applySubstitutionContextToParameterList(constructorDefinition.parameters, substitutionContext);
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
    this.addPlaceholderToCurrentCollection(expression, context);
  }

  private addPlaceholderToCurrentCollection(placeholder: Fmt.PlaceholderExpression, context: HLMCheckerContext): void {
    if (context.currentPlaceholderCollection && placeholder.specialRole !== Fmt.SpecialPlaceholderRole.Temporary) {
      if (context.currentPlaceholderCollection.placeholders) {
        context.currentPlaceholderCollection.placeholders = [...context.currentPlaceholderCollection.placeholders, placeholder];
      } else {
        context.currentPlaceholderCollection.placeholders = [placeholder];
      }
      for (let placeholderCollection: HLMCheckerPlaceholderCollection | undefined = context.currentPlaceholderCollection; placeholderCollection && !placeholderCollection.containsNonAutoPlaceholders; placeholderCollection = placeholderCollection.parentCollection) {
        if (!context.inAutoArgument) {
          placeholderCollection.containsNonAutoPlaceholders = true;
        }
      }
    }
  }

  private checkEquivalenceList(object: Object, list: HLMEquivalenceListInfo, equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, checkItem: (checkerState: HLMCheckerState, expression: Fmt.Expression, context: HLMCheckerContext) => void, checkCompatibility: ((checkerState: HLMCheckerState, expressions: Fmt.Expression[], context: HLMCheckerContext) => void) | undefined, context: HLMCheckerContext): void {
    if (list.items.length) {
      for (const item of list.items) {
        if (item instanceof Fmt.DefinitionRefExpression && !item.path.parentPath && item.path.name === this.utils.definition.name) {
          this.error(item, 'Invalid circular reference');
        }
        let currentContext = context;
        if (checkCompatibility) {
          const recheckFn = (recheckState: HLMCheckerState, substitutedItem: Fmt.Expression, recheckContext: HLMCheckerContext) => {
            const substitutedList: HLMEquivalenceListInfo = {
              ...list,
              items: list.items.map((originalItem: Fmt.Expression) => originalItem === item ? substitutedItem : originalItem)
            };
            recheckState.checkEquivalenceList(object, substitutedList, undefined, checkItem, checkCompatibility, recheckContext);
          };
          currentContext = this.setCurrentRecheckFn(item, recheckFn, undefined, currentContext);
        }
        checkItem(this, item, currentContext);
      }
      if (checkCompatibility) {
        checkCompatibility(this, list.items, context);
      }
      this.checkEquivalenceProofs(equivalenceProofs, list, context);
    } else {
      this.error(object, 'At least one item expected');
    }
  }

  private checkSetTermEquivalenceList(object: Object, items: Fmt.Expression[], equalityProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    const list = this.utils.getSetTermEquivalenceListInfo(items);
    const checkCompatibility = (checkerState: HLMCheckerState, terms: Fmt.Expression[], checkContext: HLMCheckerContext) => checkerState.checkSetCompatibility(object, terms, checkContext);
    const checkItem = (checkerState: HLMCheckerState, term: Fmt.Expression, termContext: HLMCheckerContext) => checkerState.checkSetTerm(term, termContext);
    this.checkEquivalenceList(object, list, equalityProofs, checkItem, checkCompatibility, context);
  }

  private checkElementTermEquivalenceList(object: Object, items: Fmt.Expression[], equalityProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    const list = this.utils.getElementTermEquivalenceListInfo(items);
    const checkCompatibility = (checkerState: HLMCheckerState, terms: Fmt.Expression[], checkContext: HLMCheckerContext) => checkerState.checkElementCompatibility(object, terms, checkContext);
    const checkItem = (checkerState: HLMCheckerState, term: Fmt.Expression, termContext: HLMCheckerContext) => checkerState.checkElementTerm(term, termContext);
    this.checkEquivalenceList(object, list, equalityProofs, checkItem, checkCompatibility, context);
  }

  private checkFormulaEquivalenceList(object: Object, items: Fmt.Expression[], equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    const list = this.utils.getFormulaEquivalenceListInfo(items);
    const checkItem = (checkerState: HLMCheckerState, formula: Fmt.Expression, itemContext: HLMCheckerContext) => checkerState.checkFormula(formula, itemContext);
    this.checkEquivalenceList(object, list, equivalenceProofs, checkItem, undefined, context);
  }

  private checkProof(object: Object, proof: FmtHLM.ObjectContents_Proof | undefined, parameters: Fmt.ParameterList | undefined, goal: Fmt.Expression, context: HLMCheckerContext): void {
    this.checkMultiGoalProof(object, proof, parameters, [goal], context);
  }

  private checkMultiGoalProof(object: Object, proof: FmtHLM.ObjectContents_Proof | undefined, parameters: Fmt.ParameterList | undefined, goals: Fmt.Expression[], context: HLMCheckerContext): void {
    if (!proof && !this.options.warnAboutMissingProofs) {
      return;
    }
    if (parameters) {
      if (proof) {
        if (!proof.parameters) {
          this.error(proof, 'Parameter list required');
          return;
        } else if (!this.checkEquivalenceWithPlaceholders(proof.parameters, parameters, context)) {
          this.error(proof.parameters, 'Invalid proof parameters');
          return;
        }
        context = getParameterListContext(proof.parameters, context);
        goals = goals.map((goal: Fmt.Expression) => this.utils.substituteParameters(goal, parameters, proof.parameters!));
      } else {
        context = getParameterListContext(parameters, context);
      }
    } else if (proof?.parameters) {
      this.error(proof.parameters, 'Superfluous proof parameters');
      return;
    }
    const checkProof = this.getContextUtils(context).stripConstraintsFromFormulas(goals, true, true, !proof, !proof).then((newGoals: Fmt.Expression[]) => {
      if (proof) {
        // Report errors as locally as possible, but not on temporarily converted objects inside expressions.
        if (!(object instanceof Fmt.Expression)) {
          object = proof;
        }
        this.checkProofValidity(object, proof, newGoals, context);
      } else if (!newGoals.some((goal: Fmt.Expression) => this.utils.isTrueFormula(goal))) {
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
    const originalGoal = goals.length ? goals[0] : undefined;
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
        const check = this.getContextUtils(stepContext).isTriviallyProvable(stepContext.goal).then((result: boolean) => {
          if (!result) {
            this.setIncompleteProof(proof, stepContext!);
            this.message(object, `Proof of ${stepContext!.goal} is incomplete`, Logic.DiagnosticSeverity.Warning);
          }
        });
        this.addPendingCheck(object, check);
      } else {
        this.setIncompleteProof(proof, stepContext);
        this.message(object, `Proof is incomplete`, Logic.DiagnosticSeverity.Warning);
      }
    }
  }

  private checkProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, goal: Fmt.Expression, context: HLMCheckerContext): void {
    if (proofs) {
      for (const proof of proofs) {
        this.checkProof(proof, proof, undefined, goal, context);
      }
    }
  }

  private checkEquivalenceProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, list: HLMEquivalenceListInfo, context: HLMCheckerContext): void {
    if (proofs) {
      for (const proof of proofs) {
        const fromIndex = this.utils.externalToInternalIndex(proof._from);
        const toIndex = this.utils.externalToInternalIndex(proof._to);
        if (fromIndex === undefined || toIndex === undefined) {
          this.error(proof, 'From/to required');
        } else if (fromIndex < 0 || fromIndex >= list.items.length) {
          this.error(proof, 'Invalid from index');
        } else if (toIndex < 0 || toIndex >= list.items.length) {
          this.error(proof, 'Invalid to index');
        } else {
          let proofParameters: Fmt.ParameterList | undefined = new Fmt.ParameterList;
          const goal = list.getEquivalenceGoal(list.items[fromIndex], list.items[toIndex], proofParameters!);
          if (!proofParameters!.length) {
            proofParameters = undefined;
          }
          this.checkProof(proof, proof, proofParameters, goal, context);
        }
      }
    }
  }

  private setIncompleteProof(proof: FmtHLM.ObjectContents_Proof, context: HLMCheckerProofStepContext): void {
    if (this.recheckData) {
      const checkProofStepFn = (step: Fmt.Parameter, options: Logic.LogicCheckerOptions) => {
        const fn = (recheckState: HLMCheckerState, recheckContext: HLMCheckerContext) => recheckState.checkProofStep(step, recheckContext);
        return this.recheck(step, fn, options, context);
      };
      // Use proof.steps as the key because proof objects are created temporarily via ObjectContents.fromExpression.
      this.recheckData.incompleteProofs.set(proof.steps, {
        context: context,
        checkProofStepFn: checkProofStepFn
      });
    }
  }

  private checkProofSteps(steps: Fmt.ParameterList, context: HLMCheckerProofStepContext | undefined): HLMCheckerProofStepContext | undefined {
    for (const step of steps) {
      if (context) {
        const stepResult = this.checkProofStep(step, context);
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
    const type = step.type;
    if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
      return {
        ...this.checkParameter(step, context),
        previousResult: undefined
      };
    } else {
      const result = this.checkProofStepType(type, context);
      if (result !== null) {
        try {
          return {
            ...getParameterContext(step, context),
            previousResult: result
          };
        } catch (error) {
          this.error(step, error.message);
          return undefined;
        }
      } else {
        return undefined;
      }
    }
  }

  private checkProofStepType(type: Fmt.Expression, context: HLMCheckerProofStepContext): Fmt.Expression | null | undefined {
    const recheckFn = (recheckState: HLMCheckerState, substitutedType: Fmt.Expression, recheckContext: HLMCheckerContext) => recheckState.checkProofStepType(substitutedType, recheckContext);
    const typeContext = this.setCurrentRecheckFn(type, recheckFn, undefined, context);
    if (type instanceof Fmt.VariableRefExpression || type instanceof Fmt.IndexedExpression) {
      const checkType = () => true;
      this.checkVariableRefExpression(type, checkType, typeContext);
    } else if (type instanceof FmtHLM.MetaRefExpression_Consider) {
      const checkType = () => true;
      this.checkVariableRefExpression(type.variable, checkType, typeContext);
      if (type.result) {
        const [variableRefExpression, indexContext] = this.utils.extractVariableRefExpression(type.variable);
        if (variableRefExpression) {
          const constraint = this.utils.getParameterConstraint(variableRefExpression.variable, typeContext, variableRefExpression, indexContext);
          if (constraint) {
            this.checkUnfolding(type.result, [constraint], type.result, false);
          } else {
            this.error(type.result, 'Invalid result');
          }
        }
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      this.checkFormula(type.statement, typeContext);
      this.checkProof(type, type.proof, undefined, type.statement, typeContext);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef) {
      if (context.goal) {
        if (context.previousResult) {
          const useDef = type;
          const previousResultDefinitionsPromise = this.utils.getFormulaDefinitions(context.previousResult, this.utils.externalToInternalIndex(useDef.side));
          if (previousResultDefinitionsPromise) {
            const checkDefinition = previousResultDefinitionsPromise.then((previousResultDefinitions: HLMFormulaDefinition[]) => {
              if (previousResultDefinitions.length) {
                const sources = previousResultDefinitions.map((previousResultDefinition: HLMFormulaDefinition) => previousResultDefinition.formula);
                this.checkDeclaredResult(type, useDef.result, sources, context);
              } else {
                this.error(type, `${context.previousResult} does not have any definition`);
              }
            });
            this.addPendingCheck(type, checkDefinition);
          } else {
            this.error(type, `${context.previousResult} does not have any definition`);
          }
        } else {
          this.error(type, 'Previous result not set');
        }
      } else {
        this.error(type, 'Goal not set');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseCases) {
      if (context.goal) {
        if (context.previousResult) {
          const goal = context.goal;
          const previousResultCasesPromise = this.utils.getFormulaCases(context.previousResult, this.utils.externalToInternalIndex(type.side), false);
          if (previousResultCasesPromise) {
            const caseProofs = type.caseProofs;
            const checkCases = previousResultCasesPromise.then((previousResultCases: HLMFormulaCase[] | undefined) => {
              if (previousResultCases) {
                let index = 0;
                for (const previousResultCase of previousResultCases) {
                  if (index < caseProofs.length) {
                    const caseProof = caseProofs[index];
                    const parameters = this.utils.getUseCasesProofParameters(previousResultCase);
                    this.checkProof(caseProof, caseProof, parameters, goal, typeContext);
                  } else {
                    this.message(type, 'Missing case proof', Logic.DiagnosticSeverity.Warning);
                  }
                  index++;
                }
                if (index < caseProofs.length) {
                  this.error(caseProofs[index], 'Superfluous case proof');
                }
              } else {
                this.error(type, 'Invalid cases');
              }
            });
            this.addPendingCheck(type, checkCases);
          } else {
            this.error(type, 'Invalid cases');
          }
        } else {
          this.error(type, 'Previous result not set');
        }
      } else {
        this.error(type, 'Goal not set');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
      if (context.previousResult instanceof FmtHLM.MetaRefExpression_forall) {
        this.checkArgumentLists([type.arguments], [context.previousResult.parameters], undefined, typeContext);
      } else {
        this.error(type, 'Previous result is not a universally quantified expression');
        return undefined;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
      if (context.previousResult instanceof FmtHLM.MetaRefExpression_exists || context.previousResult instanceof FmtHLM.MetaRefExpression_existsUnique) {
        if (this.checkEquivalenceWithPlaceholders(type.parameters, context.previousResult.parameters, typeContext)) {
          context = getParameterListContext(type.parameters, context);
        } else {
          this.error(type.parameters, 'Proof step parameters must match existential quantifier');
        }
      } else {
        this.error(type, 'Previous result is not an existentially quantified expression');
        return undefined;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Substitute) {
      if (context.previousResult) {
        if (type.result) {
          this.checkFormula(type.result, typeContext);
        }
        const implicationResult = this.utils.getImplicationResult(type.result, context);
        this.checkSubstitution(type, type.source, type.sourceSide, context.previousResult, implicationResult, context);
      } else {
        this.error(type, 'Previous result not set');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Unfold) {
      if (context.previousResult) {
        this.checkDeclaredResult(type, type.result, [context.previousResult], context);
      } else {
        this.error(type, 'Previous result not set');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseTheorem) {
      const useTheorem = type;
      if (useTheorem.theorem instanceof Fmt.DefinitionRefExpression) {
        const theorem = useTheorem.theorem;
        const checkDefinitionRef = this.utils.getOuterDefinition(theorem).then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem || definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
            this.checkDefinitionRefExpression(theorem, [definition], typeContext);
            if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
              const conditions = definition.contents.conditions.map((condition: Fmt.Expression) => this.utils.substitutePath(condition, theorem.path, [definition]));
              this.checkDeclaredResult(type, useTheorem.result, conditions, context);
              if (useTheorem.input) {
                if (!(useTheorem.input instanceof Fmt.PlaceholderExpression)) {
                  const inputContext: HLMCheckerProofStepContext = {
                    ...context,
                    originalGoal: undefined,
                    goal: undefined,
                    previousResult: undefined
                  };
                  const inputResult = this.checkProofStepType(useTheorem.input, inputContext);
                  if (inputResult) {
                    return this.getContextUtils(inputContext).stripConstraintsFromFormulas(conditions, true, true, false, true).then((strippedConditions: Fmt.Expression[]) =>
                      this.checkImplication(type, inputResult, strippedConditions));
                  } else {
                    this.error(type, 'Invalid input proof step');
                  }
                }
              } else {
                this.error(type, 'Theorem input required');
              }
            } else {
              const claim = this.utils.substitutePath(definition.contents.claim, theorem.path, [definition]);
              this.checkDeclaredResult(type, useTheorem.result, [claim], context);
            }
          } else {
            this.error(type, 'Referenced definition must be a theorem');
          }
          return CachedPromise.resolve();
        });
        this.addPendingCheck(type, checkDefinitionRef);
      } else {
        this.error(type, 'Definition reference required');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseImplicitOperator) {
      const useImplicitOperator = type;
      if (useImplicitOperator.operator instanceof Fmt.DefinitionRefExpression) {
        const operator = useImplicitOperator.operator;
        const checkDefinitionRef = this.utils.getOuterDefinition(operator).then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
            this.checkDefinitionRefExpression(operator, [definition], typeContext);
            const conditions = this.utils.getImplicitOperatorDefinitionResults(operator, definition, definition.contents);
            this.checkDeclaredResult(type, useImplicitOperator.result, conditions, context);
          } else {
            this.error(type, 'Referenced definition must be an implicitly defined operator');
          }
          return CachedPromise.resolve();
        });
        this.addPendingCheck(type, checkDefinitionRef);
      } else {
        this.error(type, 'Definition reference required');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveDef) {
      if (context.goal) {
        const proveDef = type;
        const goalDefinitionsPromise = this.utils.getFormulaDefinitions(context.goal, this.utils.externalToInternalIndex(proveDef.side));
        if (goalDefinitionsPromise) {
          const checkDefinition = goalDefinitionsPromise.then((goalDefinitions: HLMFormulaDefinition[]) => {
            if (goalDefinitions.length) {
              const goals = goalDefinitions.map((goalDefinition: HLMFormulaDefinition) => goalDefinition.formula);
              this.checkMultiGoalProof(type, proveDef.proof, undefined, goals, typeContext);
            } else {
              this.error(type, `${context.goal} cannot be proved by definition`);
            }
          });
          this.addPendingCheck(type, checkDefinition);
        } else {
          this.error(type, `${context.goal} cannot be proved by definition`);
        }
      } else {
        this.error(type, 'Goal not set');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveByContradiction) {
      if (context.goal) {
        const proveByContradiction = type;
        let goalToNegate = context.goal;
        let newGoal: Fmt.Expression = new FmtHLM.MetaRefExpression_or;
        if (goalToNegate instanceof FmtHLM.MetaRefExpression_or && goalToNegate.formulas && proveByContradiction.proof._to !== undefined) {
          const index = this.utils.externalToInternalIndex(proveByContradiction.proof._to);
          if (index !== undefined && index >= 0 && index < goalToNegate.formulas.length) {
            [goalToNegate, newGoal] = this.utils.getProveByContradictionVariant(goalToNegate.formulas, index);
          }
        }
        const check = this.utils.negateFormula(goalToNegate, true).then((negatedGoal: Fmt.Expression) => {
          const parameters = new Fmt.ParameterList;
          this.utils.addProofConstraint(parameters, negatedGoal);
          this.checkProof(type, proveByContradiction.proof, parameters, newGoal, typeContext);
        });
        this.addPendingCheck(type, check);
      } else {
        this.error(type, 'Goal not set');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveForAll) {
      if (context.goal instanceof FmtHLM.MetaRefExpression_forall) {
        this.checkProof(type, type.proof, context.goal.parameters, context.goal.formula, typeContext);
      } else {
        this.error(type, 'Goal is not a universally quantified expression');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveExists) {
      if (context.goal instanceof FmtHLM.MetaRefExpression_exists) {
        this.checkArgumentLists([type.arguments], [context.goal.parameters], undefined, typeContext);
        if (context.goal.formula) {
          const substitutedFormula = this.utils.substituteArguments(context.goal.formula, context.goal.parameters, type.arguments);
          this.checkProof(type, type.proof, undefined, substitutedFormula, typeContext);
        }
      } else {
        this.error(type, 'Goal is not an existentially quantified expression');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveEquivalence) {
      const list = this.utils.getEquivalenceListInfo(context.goal);
      if (list) {
        this.checkEquivalenceProofs(type.proofs, list, context);
      } else {
        this.error(type, 'Goal is not an equivalence');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveCases) {
      if (context.goal) {
        const goalCasesPromise = this.utils.getFormulaCases(context.goal, this.utils.externalToInternalIndex(type.side), true);
        if (goalCasesPromise) {
          const caseProofs = type.caseProofs;
          const checkCases = goalCasesPromise.then((goalCases: HLMFormulaCase[] | undefined) => {
            if (goalCases) {
              let index = 0;
              for (const goalCase of goalCases) {
                if (index < caseProofs.length) {
                  const caseProof = caseProofs[index];
                  this.checkProof(caseProof, caseProof, goalCase.parameters, goalCase.formula, typeContext);
                } else {
                  this.message(type, 'Missing case proof', Logic.DiagnosticSeverity.Warning);
                }
                index++;
              }
              if (index < caseProofs.length) {
                this.error(caseProofs[index], 'Superfluous case proof');
              }
            } else {
              this.error(type, 'Invalid cases');
            }
          });
          this.addPendingCheck(type, checkCases);
        } else {
          this.error(type, 'Invalid cases');
        }
      } else {
        this.error(type, 'Goal not set');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveByInduction) {
      if (context.goal) {
        const proveByInduction = type;
        const goal = context.goal;
        const checkCase = (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter, caseContext: HLMCheckerContext) => {
          const subProof = FmtHLM.ObjectContents_Proof.createFromExpression(structuralCase.value);
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
        const prepareCase = (structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorContents: FmtHLM.ObjectContents_Constructor, structuralCaseTerm: Fmt.Expression, constraintParam: Fmt.Parameter) => {
          const subProof = new FmtHLM.ObjectContents_Proof(undefined, undefined, new Fmt.ParameterList(constraintParam), undefined, new Fmt.ParameterList);
          structuralCase.value = subProof.toExpression(true);
        };
        const replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
          const newProveByInduction = new FmtHLM.MetaRefExpression_ProveByInduction(proveByInduction.term, proveByInduction.construction, newCases);
          return {
            originalExpression: proveByInduction,
            filledExpression: newProveByInduction
          };
        };
        this.checkStructuralCasesInternal(proveByInduction.term, proveByInduction.construction, proveByInduction.cases, checkCase, prepareCase, replaceCases, typeContext);
      } else {
        this.error(type, 'Goal not set');
      }
      return null;
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveBySubstitution) {
      if (context.goal) {
        if (this.checkSubstitution(type, type.source, type.sourceSide, context.goal, type.goal, context)) {
          this.checkProof(type, type.proof, undefined, type.goal, typeContext);
        }
      } else {
        this.error(type, 'Goal not set');
      }
      return null;
    } else {
      this.error(type, 'Invalid proof step');
      return undefined;
    }
    return this.utils.getProofStepTypeResult(type, context);
  }

  private checkUnfolding(object: Object, sources: Fmt.Expression[], target: Fmt.Expression, sourceIsResult: boolean): void {
    if (target instanceof (sourceIsResult ? FmtHLM.MetaRefExpression_or : FmtHLM.MetaRefExpression_and)) {
      if (target.formulas) {
        for (const innerTarget of target.formulas) {
          this.checkUnfolding(object, sources, innerTarget, sourceIsResult);
        }
      }
    } else {
      let resultPromise = CachedPromise.resolve(false);
      for (const source of sources) {
        resultPromise = resultPromise.or(() => this.getUnfoldResult(source, target, sourceIsResult));
      }
      const check = resultPromise.then((result: boolean) => {
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
        for (const innerSource of source.formulas) {
          resultPromise = resultPromise.or(() => this.getUnfoldResult(innerSource, target, sourceIsResult));
        }
      }
      return resultPromise;
    } else {
      return this.utils.formulaUnfoldsTo(source, target);
    }
  }

  private checkImplication(object: Object, source: Fmt.Expression, targets: Fmt.Expression[]): void {
    let resultPromise = CachedPromise.resolve(false);
    for (const target of targets) {
      resultPromise = resultPromise.or(() => this.utils.triviallyImplies(source, target, true));
    }
    const check = resultPromise.then((result: boolean) => {
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
    if (!(result instanceof Fmt.PlaceholderExpression)) {
      const check = this.getContextUtils(context).stripConstraintsFromFormulas(sources, false, false, true, true).then((strippedSources: Fmt.Expression[]) =>
        this.checkUnfolding(result ?? object, strippedSources, this.utils.getImplicationResult(result, context), false));
      this.addPendingCheck(object, check);
    }
  }

  private checkSubstitutionSource(source: Fmt.Expression, sourceSide: BigInt, context: HLMCheckerProofStepContext): HLMSubstitutionSourceInfo | undefined {
    const equivalence = this.checkProofStepType(source, context);
    const sourceIndex = this.utils.externalToInternalIndex(sourceSide);
    if (equivalence && sourceIndex !== undefined) {
      return this.utils.getSubstitutionSourceInfo(equivalence, sourceIndex);
    } else {
      return undefined;
    }
  }

  private checkSubstitution(object: Object, source: Fmt.Expression, sourceSide: BigInt, input: Fmt.Expression, output: Fmt.Expression, context: HLMCheckerProofStepContext): boolean {
    const sourceContext: HLMCheckerProofStepContext = {
      ...context,
      originalGoal: undefined,
      goal: undefined,
      previousResult: undefined
    };
    const sourceInfo = this.checkSubstitutionSource(source, sourceSide, sourceContext);
    if (sourceInfo) {
      // TODO check restrictions on rewriting (see equality.md)
      if (this.utils.substitutesTo(input, output, sourceInfo)) {
        return true;
      } else {
        this.error(object, `Invalid substitution from ${input} to ${output}`);
      }
    } else {
      this.error(source, 'Invalid substitution source');
    }
    return false;
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
    for (const elementTerm of elementTerms) {
      declaredSetsPromise = declaredSetsPromise.then((declaredSets: Fmt.Expression[]) =>
        this.utils.getDeclaredSet(elementTerm).then((declaredSet: Fmt.Expression) => declaredSets.concat(declaredSet))
      );
    }
    const checkDeclaredSets = declaredSetsPromise.then((declaredSets: Fmt.Expression[]) => {
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
    const check = this.checkSetCompatibilityInternal(object, setTerms, false, context, initialCompatibilityStatusWithoutElements).then((result: Fmt.Expression | undefined) => {
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

  // In addition to checking for term compatibility, returns whether the term is trivially a subset of the given set.
  private checkSubset(subset: Fmt.Expression, superset: Fmt.Expression, context: HLMCheckerContext): CachedPromise<boolean> {
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

  // In addition to checking for term compatibility, returns whether the term is trivially an element of the given set.
  private checkElement(element: Fmt.Expression, set: Fmt.Expression, context: HLMCheckerContext): CachedPromise<boolean> {
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
        const firstTerm = setTerms[0];
        for (let index = 1; index < setTerms.length; index++) {
          const term = setTerms[index];
          if (status.checkedForDirectEquivalence || !this.checkEquivalenceOfTemporarySetTerms(firstTerm, term, context)) {
            return CachedPromise.resolve(undefined);
          }
        }
        return CachedPromise.resolve(firstTerm);
      } else {
        const checkForDirectEquivalence = !status.directEquivalenceUnlikely && !status.checkedForDirectEquivalence && !this.options.supportPlaceholders;
        let nextSetTermsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        const nextStatus: HLMCheckerCompatibilityStatus = {
          directEquivalenceUnlikely: false,
          checkedForDirectEquivalence: status.checkedForDirectEquivalence || checkForDirectEquivalence,
          obtainedFinalSets: true,
          followedEmbeddings: status.obtainedFinalSets,
          addedStructuralCases: status.followedEmbeddings || !context.parentStructuralCases.length
        };
        let typeSearchParameters: HLMTypeSearchParameters = {
          unfoldVariableDefinitions: true,
          followDefinitions: true,
          followSupersets: !checkSubset,
          followEmbeddings: nextStatus.followedEmbeddings,
          followAllAlternatives: false,
          unfoldMacros: false,
          allowStructuralCaseResults: true,
          unfoldArguments: nextStatus.followedEmbeddings,
          substituteStructuralCases: true,
          allowConstructorResultsFromStructuralDefinitionSubstitution: true,
          extractStructuralCases: nextStatus.followedEmbeddings
        };
        if (nextStatus.addedStructuralCases && context.parentStructuralCases.length) {
          for (let index = 0; index < setTerms.length; index++) {
            let term = setTerms[index];
            for (const structuralCaseRef of context.parentStructuralCases) {
              term = this.utils.buildSingleStructuralCaseTerm(structuralCaseRef.term, structuralCaseRef.construction, structuralCaseRef._constructor, structuralCaseRef.parameters, term, HLMExpressionType.SetTerm);
            }
            setTerms[index] = term;
          }
        }
        const firstTerm = setTerms[0];
        for (let index = 1; index < setTerms.length; index++) {
          const term = setTerms[index];
          if (!checkForDirectEquivalence || !this.checkEquivalenceOfTemporarySetTerms(firstTerm, term, context)) {
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
        if (checkSubset) {
          typeSearchParameters = {
            ...typeSearchParameters,
            followSupersets: nextStatus.followedEmbeddings,
            followEmbeddings: false
          };
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

  private checkEquivalenceWithPlaceholders<T extends Fmt.Comparable<T>>(left: T, right: T, context: HLMCheckerContext): boolean {
    const state: HLMCheckerPlaceholderRestrictionState = {
      exactValueRequired: true,
      context: context
    };
    let unificationFn: Fmt.ExpressionUnificationFn | undefined = undefined;
    if (this.restrictions) {
      unificationFn = (leftExpression: Fmt.Expression, rightExpression: Fmt.Expression, replacedParameters: Fmt.ReplacedParameter[]): boolean => {
        let recheck = false;
        while (leftExpression instanceof Fmt.PlaceholderExpression) {
          this.addPlaceholderToCurrentCollection(leftExpression, context);
          const replacedRightExpression = rightExpression.substitute(undefined, Fmt.reverseReplacedParameters(replacedParameters));
          const newLeftExpression = this.addCompatibleTermRestriction(state, leftExpression, replacedRightExpression);
          if (newLeftExpression) {
            leftExpression = newLeftExpression;
            recheck = true;
          } else {
            return true;
          }
        }
        while (rightExpression instanceof Fmt.PlaceholderExpression) {
          this.addPlaceholderToCurrentCollection(rightExpression, context);
          const replacedLeftExpression = leftExpression.substitute(undefined, replacedParameters);
          const newRightExpression = this.addCompatibleTermRestriction(state, rightExpression, replacedLeftExpression);
          if (newRightExpression) {
            rightExpression = newRightExpression;
            recheck = true;
          } else {
            return true;
          }
        }
        if (recheck) {
          return leftExpression.isEquivalentTo(rightExpression, unificationFn, replacedParameters);
        } else {
          return false;
        }
      };
    }

    if (left.isEquivalentTo(right, unificationFn)) {
      if (state.newRestrictions) {
        this.restrictions = state.newRestrictions;
      }
      return true;
    } else {
      return false;
    }
  }

  private checkEquivalenceOfTemporarySetTerms(left: Fmt.Expression, right: Fmt.Expression, context: HLMCheckerContext): boolean {
    const state: HLMCheckerPlaceholderRestrictionState = {
      exactValueRequired: left instanceof Fmt.DefinitionRefExpression && right instanceof Fmt.DefinitionRefExpression,
      context: context
    };
    let unificationFn: Fmt.ExpressionUnificationFn | undefined = undefined;
    const defaultUnificationFn = (leftExpression: Fmt.Expression, rightExpression: Fmt.Expression, replacedParameters: Fmt.ReplacedParameter[]): boolean => {
      // Make structural cases commute. I.e. when finding a nested structural case term on the right, also check other nesting possibilities.
      // Of course, this only works for inner cases that do not depend on parameters of outer cases.
      if (rightExpression instanceof FmtHLM.MetaRefExpression_setStructuralCases && rightExpression.cases.length === 1) {
        const structuralCase = rightExpression.cases[0];
        const innerExpression = structuralCase.value;
        if (innerExpression instanceof FmtHLM.MetaRefExpression_setStructuralCases && innerExpression.cases.length === 1) {
          let clonedExpression = rightExpression.clone() as FmtHLM.MetaRefExpression_setStructuralCases;
          const clonedCase = clonedExpression.cases[0];
          let currentInnerExpression = clonedCase.value;
          while (currentInnerExpression instanceof FmtHLM.MetaRefExpression_setStructuralCases && currentInnerExpression.cases.length === 1) {
            // Cut out the current inner expression.
            const nextInnerExpression = currentInnerExpression.cases[0].value;
            clonedCase.value = nextInnerExpression;
            // Attach it to the front.
            currentInnerExpression.cases[0].value = clonedExpression;
            clonedExpression = currentInnerExpression;
            // Check it.
            const innerUnificationFn = (innerLeftExpression: Fmt.Expression, innerRightExpression: Fmt.Expression, innerReplacedParameters: Fmt.ReplacedParameter[]): boolean => {
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
    if (this.restrictions) {
      // Handle placeholders.
      unificationFn = (leftExpression: Fmt.Expression, rightExpression: Fmt.Expression, replacedParameters: Fmt.ReplacedParameter[]): boolean => {
        // TODO the order of handling left and right currently matters a lot, in fact the tutorial breaks if it is reversed -- this indicates some deeper problem
        if (rightExpression instanceof FmtHLM.MetaRefExpression_enumeration && rightExpression.terms && rightExpression.terms.length === 1) {
          const rightElement = rightExpression.terms[0];
          if (rightElement instanceof Fmt.PlaceholderExpression) {
            if (!replacedParameters.length) {
              this.addDeclaredSetRestriction(state, rightElement, leftExpression);
            }
            return true;
          }
        }
        if (leftExpression instanceof FmtHLM.MetaRefExpression_enumeration && leftExpression.terms && leftExpression.terms.length === 1) {
          const leftElement = leftExpression.terms[0];
          if (leftElement instanceof Fmt.PlaceholderExpression) {
            if (!replacedParameters.length) {
              this.addDeclaredSetRestriction(state, leftElement, rightExpression);
            }
            return true;
          }
        }
        let recheck = false;
        const isRoot = leftExpression === left && rightExpression === right;
        while (rightExpression instanceof Fmt.PlaceholderExpression) {
          // Note: If replacedParameters is nonempty, those parameters are temporary if the original expression is a temporary object.
          // We currently give up in that case, but we could also check whether leftExpression actually references one of the parameters.
          const newRightExpression = this.addCompatibleTermRestriction(state, rightExpression, replacedParameters.length ? undefined : leftExpression);
          if (newRightExpression) {
            rightExpression = newRightExpression;
            recheck = true;
          } else {
            return true;
          }
        }
        while (leftExpression instanceof Fmt.PlaceholderExpression) {
          // Note: If replacedParameters is nonempty, those parameters are temporary if the original expression is a temporary object.
          // We currently give up in that case, but we could also check whether rightExpression actually references one of the parameters.
          const newLeftExpression = this.addCompatibleTermRestriction(state, leftExpression, replacedParameters.length ? undefined : rightExpression);
          if (newLeftExpression) {
            leftExpression = newLeftExpression;
            recheck = true;
          } else {
            return true;
          }
        }
        if (isRoot && leftExpression instanceof Fmt.DefinitionRefExpression && rightExpression instanceof Fmt.DefinitionRefExpression) {
          state.exactValueRequired = true;
        }
        if (recheck) {
          return leftExpression.isEquivalentTo(rightExpression, unificationFn, replacedParameters);
        } else {
          return defaultUnificationFn(leftExpression, rightExpression, replacedParameters);
        }
      };
    }

    if (left.isEquivalentTo(right, unificationFn)) {
      if (state.newRestrictions) {
        this.restrictions = state.newRestrictions;
      }
      return true;
    } else {
      return false;
    }
  }

  private addCompatibleTermRestriction(state: HLMCheckerPlaceholderRestrictionState, placeholder: Fmt.PlaceholderExpression, expression: Fmt.Expression | undefined): Fmt.Expression | undefined {
    const currentRestrictions = state.newRestrictions ?? this.restrictions!;
    let restriction = currentRestrictions.get(placeholder);
    if (restriction && restriction.exactValue) {
      return restriction.exactValue;
    }
    if (!expression) {
      return undefined;
    }
    const addToCompatibleSets = placeholder.placeholderType === HLMExpressionType.SetTerm && !(restriction && HLMCheckerState.containsEquivalentItem(restriction.compatibleSets, expression));
    const setExactValueSuggestion = !(expression instanceof Fmt.PlaceholderExpression);
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
        if (state.exactValueRequired && !restriction.exactValue) {
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
          state.newRestrictions = new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>(this.restrictions!);
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
    const currentRestrictions = state.newRestrictions ?? this.restrictions!;
    let restriction = currentRestrictions.get(placeholder);
    if (restriction && HLMCheckerState.containsEquivalentItem(restriction.declaredSets, declaredSet)) {
      return;
    }
    if (!state.newRestrictions) {
      state.newRestrictions = new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>(this.restrictions!);
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

  private getContextUtils(context: HLMCheckerContext): HLMCheckerContextUtils {
    return new HLMCheckerContextUtils(this.utils, context);
  }

  private addPendingCheck(object: Object, check: CachedPromise<void>): void {
    // TODO create pending checks on demand only, so that they can be omitted during rechecking if hasErrors is already true
    // (requires changing addPendingCheck to take a PendingCheck instead of just a promise)
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

function getParameterListContext<ContextType extends HLMCheckerContext>(parameterList: Fmt.ParameterList, context: ContextType): ContextType {
  for (const param of parameterList) {
    context = getParameterContext(param, context);
  }
  return context;
}

function getParameterContext<ContextType extends HLMCheckerContext>(param: Fmt.Parameter, context: ContextType): ContextType {
  const type = param.type;
  if (type instanceof FmtHLM.MetaRefExpression_Binder) {
    const sourceContext = getParameterListContext(type.sourceParameters, context);
    const resultContext = getParameterListContext(type.targetParameters, sourceContext);
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

export interface HLMCheckerConstraint {
  parameter?: Fmt.Parameter;
  constraint: Fmt.Expression;
  isImmediate: boolean;
}

export class HLMCheckerContextUtils {
  constructor(private utils: HLMUtils, private context: HLMCheckerContext) {}

  getParameterListContextUtils(parameterList: Fmt.ParameterList): HLMCheckerContextUtils {
    const resultContext = getParameterListContext(parameterList, this.context);
    return new HLMCheckerContextUtils(this.utils, resultContext);
  }

  getAvailableConstraints(split: boolean): HLMCheckerConstraint[] {
    const constraints: HLMCheckerConstraint[] = [];
    for (const variableInfo of this.context.context.getVariables()) {
      if (!variableInfo.indexParameterLists && this.context.binderSourceParameters.indexOf(variableInfo.parameter) < 0) {
        const constraint = this.utils.getParameterConstraint(variableInfo.parameter, this.context);
        if (constraint) {
          const parameter = this.context.temporaryParameters.indexOf(variableInfo.parameter) < 0 ? variableInfo.parameter : undefined;
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
          for (const item of constraint.formulas) {
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

  isTriviallyProvable(goal: Fmt.Expression): CachedPromise<boolean> {
    // TODO %in(a, %extendedSubset(#(...), x)) should be trivially provable if a and x can be unified appropriately such that all constraints on parameters are also trivially provable
    // TODO somewhere (maybe here), the "full" property of embeddings should be taken into account
    const constraints = this.getAvailableConstraints(false);
    const conjunction = this.utils.createConjunction(constraints.map((constraint: HLMCheckerConstraint) => constraint.constraint));
    return this.utils.triviallyImplies(conjunction, goal, true);
  }

  isTriviallyDisprovable(goal: Fmt.Expression): CachedPromise<boolean> {
    return this.utils.negateFormula(goal, true).then((negatedGoal: Fmt.Expression) =>
      this.isTriviallyProvable(negatedGoal));
  }

  stripConstraintsFromFormulas(formulas: Fmt.Expression[], stripExactPositive: boolean, stripPositive: boolean, stripNegative: boolean, allowTrivialResult: boolean): CachedPromise<Fmt.Expression[]> {
    let resultPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (const formula of formulas) {
      resultPromise = resultPromise.then((currentResult: Fmt.Expression[]) =>
        this.stripConstraintsFromFormula(formula, stripExactPositive, stripPositive, stripNegative, allowTrivialResult).then((strippedFormula: Fmt.Expression) =>
          currentResult.concat(strippedFormula)));
    }
    return resultPromise;
  }

  private stripConstraintsFromFormula(formula: Fmt.Expression, stripExactPositive: boolean, stripPositive: boolean, stripNegative: boolean, allowTrivialResult: boolean, negate: boolean = false): CachedPromise<Fmt.Expression> {
    let intermediatePromise = CachedPromise.resolve(formula);
    if (allowTrivialResult) {
      if (negate) {
        if (stripNegative) {
          intermediatePromise = this.isTriviallyDisprovable(formula).then((result: boolean) =>
            (result ? new FmtHLM.MetaRefExpression_or : formula));
        }
      } else {
        if (stripPositive) {
          intermediatePromise = this.isTriviallyProvable(formula).then((result: boolean) =>
            (result ? new FmtHLM.MetaRefExpression_and : formula));
        } else if (stripExactPositive) {
          for (const constraint of this.getAvailableConstraints(true)) {
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
        for (const item of intermediateFormula.formulas) {
          resultItemsPromise = resultItemsPromise.then((currentResultItems: Fmt.Expression[]) =>
            this.stripConstraintsFromFormula(item, stripExactPositive, stripPositive, stripNegative, true, negate).then((strippedItem: Fmt.Expression) =>
              (this.utils.isTrueFormula(strippedItem) ? currentResultItems : currentResultItems.concat(strippedItem))));
        }
        return resultItemsPromise.then((resultItems: Fmt.Expression[]) => this.utils.createConjunction(resultItems));
      } else if (intermediateFormula instanceof FmtHLM.MetaRefExpression_or && intermediateFormula.formulas) {
        let resultItemsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        for (const item of intermediateFormula.formulas) {
          resultItemsPromise = resultItemsPromise.then((currentResultItems: Fmt.Expression[]) =>
            this.stripConstraintsFromFormula(item, stripExactPositive, stripPositive, stripNegative, true, !negate).then((strippedItem: Fmt.Expression) =>
              (this.utils.isFalseFormula(strippedItem) ? currentResultItems : currentResultItems.concat(strippedItem))));
        }
        return resultItemsPromise.then((resultItems: Fmt.Expression[]) => this.utils.createDisjunction(resultItems));
      }
      return intermediateFormula;
    });
  }

  containsStructuralCaseFor(term: Fmt.Expression): boolean {
    return this.context.parentStructuralCases.some((structuralCaseRef: HLMCheckerStructuralCaseRef) => term.isEquivalentTo(structuralCaseRef.term));
  }
}

export class HLMRechecker {
  constructor(private utils: HLMUtils, private recheckData: HLMCheckerRecheckData) {}

  getSubstitutionChecker(originalExpression: Fmt.Expression, options: Logic.LogicCheckerOptions): HLMRecheckerInstance<Fmt.Expression> {
    const checkSubstitutionFn = this.recheckData.checkSubstitutionFns.get(originalExpression);
    if (checkSubstitutionFn) {
      return new HLMRecheckerInstance((substitutedExpression: Fmt.Expression) => checkSubstitutionFn(originalExpression, substitutedExpression, options));
    } else {
      throw new InternalError('Original expression not found');
    }
  }

  getConstraintChecker(parameterList: Fmt.ParameterList, options: Logic.LogicCheckerOptions): HLMRecheckerInstance<Fmt.Expression> {
    const checkConstraintFn = this.recheckData.checkConstraintFns.get(parameterList);
    if (checkConstraintFn) {
      return new HLMRecheckerInstance((formula: Fmt.Expression) => checkConstraintFn(formula, options));
    } else {
      throw new InternalError('Parameter list not found');
    }
  }

  getProofStepChecker(proof: FmtHLM.ObjectContents_Proof, options: Logic.LogicCheckerOptions): HLMProofStepChecker {
    const incompleteProof = this.recheckData.incompleteProofs.get(proof.steps);
    if (incompleteProof) {
      const contextUtils = new HLMCheckerContextUtils(this.utils, incompleteProof.context);
      return new HLMProofStepChecker(incompleteProof.context, contextUtils, (step: Fmt.Parameter) => incompleteProof.checkProofStepFn(step, options));
    } else {
      throw new InternalError('Proof not found');
    }
  }

  hasIncompleteProofs(): boolean {
    return this.recheckData.incompleteProofs.size !== 0;
  }
}

export class HLMRecheckerInstance<T extends Fmt.ExpressionObject<T>> {
  constructor(private checkFn: (item: T) => CachedPromise<HLMRecheckResult<T>>) {}

  recheck(item: T): CachedPromise<HLMRecheckResult<T>> {
    if (debugRecheck) {
      console.log(`Checking ${item}...`);
    }
    const resultPromise = this.checkFn(item);
    return getRecheckResult(resultPromise, item);
  }
}

export class HLMProofStepChecker extends HLMRecheckerInstance<Fmt.Parameter> {
  constructor(public context: HLMCheckerExternalProofStepContext, public contextUtils: HLMCheckerContextUtils, checkFn: (step: Fmt.Parameter) => CachedPromise<HLMRecheckResult<Fmt.Parameter>>) {
    super(checkFn);
  }
}

function getRecheckResult<T extends Fmt.ExpressionObject<T>>(resultPromise: CachedPromise<HLMCheckResult>, originalValue: T): CachedPromise<HLMRecheckResult<T>> {
  return resultPromise.then((result: HLMCheckResult) => {
    if (result.autoFiller) {
      let resultValue = originalValue;
      const onFillExpression = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression) => {
        resultValue = FmtUtils.substituteExpression(resultValue, originalExpression, filledExpression);
        if (originalExpression instanceof Fmt.PlaceholderExpression && originalExpression.onFill) {
          originalExpression.onFill(filledExpression);
        }
      };
      return result.autoFiller.autoFill(onFillExpression, true).then((): HLMRecheckResult<T> => ({
        ...result,
        value: resultValue
      }));
    } else {
      return result;
    }
  });
}

export class HLMAutoFiller {
  constructor(private utils: HLMUtils, private placeholderCollection: HLMCheckerPlaceholderCollection, private restrictions: HLMCheckerPlaceholderRestrictions) {}

  autoFill(onFillExpression: HLMCheckerFillExpressionFn, fillAllExactValues: boolean = false): CachedPromise<void> {
    const autoFilledPlaceholderValues = new Map<Fmt.PlaceholderExpression, Fmt.Expression>();
    const allPlaceholderValues = new Map<Fmt.PlaceholderExpression, Fmt.Expression>();
    return this.getAutoPlaceholderValues(this.placeholderCollection, fillAllExactValues, autoFilledPlaceholderValues, allPlaceholderValues)
      .then(() => this.callAutoFillFns(this.placeholderCollection, allPlaceholderValues, onFillExpression))
      .then(() => this.autoFillPlaceholders(autoFilledPlaceholderValues, onFillExpression));
  }

  private getAutoPlaceholderValues(placeholderCollection: HLMCheckerPlaceholderCollection, fillAllExactValues: boolean, autoFilledPlaceholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, allPlaceholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>): CachedPromise<boolean> {
    let childResult = CachedPromise.resolve(true);
    if (placeholderCollection.childCollections) {
      for (const childCollection of placeholderCollection.childCollections) {
        childResult = childResult.then((allFilled: boolean) =>
          this.getAutoPlaceholderValues(childCollection, fillAllExactValues, autoFilledPlaceholderValues, allPlaceholderValues).then((filled: boolean) =>
            (allFilled && filled)));
      }
    }
    return childResult.then((allChildrenFilled: boolean) =>
      this.getOwnAutoPlaceholderValues(placeholderCollection, allPlaceholderValues, true).then((ownValuesFilled: boolean) => {
        if ((allChildrenFilled && ownValuesFilled) || fillAllExactValues) {
          return this.getOwnAutoPlaceholderValues(placeholderCollection, autoFilledPlaceholderValues, !placeholderCollection.containsNonAutoPlaceholders);
        } else {
          return false;
        }
      }));
  }

  private getOwnAutoPlaceholderValues(placeholderCollection: HLMCheckerPlaceholderCollection, placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, includeSuggestions: boolean): CachedPromise<boolean> {
    let result = CachedPromise.resolve(true);
    if (placeholderCollection.placeholders) {
      for (const placeholder of placeholderCollection.placeholders) {
        const placeholderRestriction = this.restrictions.get(placeholder);
        result = result.then((allFilled: boolean) => {
          if (placeholderRestriction) {
            if (placeholderRestriction.exactValue) {
              placeholderValues.set(placeholder, placeholderRestriction.exactValue);
              return allFilled;
            } else if (includeSuggestions) {
              if (placeholderRestriction.exactValueSuggestion) {
                placeholderValues.set(placeholder, placeholderRestriction.exactValueSuggestion);
                return allFilled;
              } else if (placeholderRestriction.compatibleSets.length) {
                return this.utils.getCommonSuperset(placeholderRestriction.compatibleSets).then((superset: Fmt.Expression | undefined) => {
                  if (superset && !(superset instanceof Fmt.PlaceholderExpression)) {
                    placeholderValues.set(placeholder, superset);
                    return allFilled;
                  } else {
                    return false;
                  }
                });
              }
            }
          }
          return false;
        });
      }
    }
    return result;
  }

  private autoFillPlaceholders(placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn): void {
    let substitutedPlaceholders: Fmt.PlaceholderExpression[] = [];
    const substitutePlaceholders = (expression: Fmt.Expression): Fmt.Expression => {
      if (expression instanceof Fmt.PlaceholderExpression) {
        if (substitutedPlaceholders.indexOf(expression) < 0) {
          substitutedPlaceholders.push(expression);
          const substitutedExpression = placeholderValues.get(expression);
          if (substitutedExpression) {
            return substitutedExpression.substitute(substitutePlaceholders);
          }
        }
      }
      return expression;
    };
    for (const [placeholder, value] of placeholderValues) {
      substitutedPlaceholders = [];
      const substitutedValue = value.substitute(substitutePlaceholders).clone();
      onFillExpression(placeholder, substitutedValue, []);
    }
  }

  private callAutoFillFns(placeholderCollection: HLMCheckerPlaceholderCollection, placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn): CachedPromise<void> {
    let result = CachedPromise.resolve();
    if (placeholderCollection.childCollections) {
      for (const childCollection of placeholderCollection.childCollections) {
        result = result.then(() => this.callAutoFillFns(childCollection, placeholderValues, onFillExpression));
      }
    }
    if (placeholderCollection.autoFillFn) {
      result = result.then(() => {
        const onFillExpressionWithPlaceholders = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => {
          const onFillInnerPlaceholder = (originalPlaceholderExpression: Fmt.Expression, filledPlaceholderExpression: Fmt.Expression) => {
            filledExpression = FmtUtils.substituteExpression(filledExpression, originalPlaceholderExpression, filledPlaceholderExpression);
          };
          this.autoFillPlaceholders(placeholderValues, onFillInnerPlaceholder);
          onFillExpression(originalExpression, filledExpression, newParameterLists);
        };
        return placeholderCollection.autoFillFn!(placeholderValues, onFillExpressionWithPlaceholders);
      });
    }
    return result;
  }
}
