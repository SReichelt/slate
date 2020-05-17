import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as HLMMacro from './macro';
import * as HLMMacros from './macros/macros';
import { HLMExpressionType } from './hlm';
import { HLMUtils, HLMSubstitutionContext, HLMTypeSearchParameters } from './utils';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

const debugRecheck = true;

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, supportPlaceholders: boolean): CachedPromise<Logic.LogicCheckResult> {
    let utils = new HLMUtils(definition, libraryDataAccessor);
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
type HLMCheckerFillExpressionFn = (originalExpression: Fmt.Expression, filledExpression: Fmt.Expression, newParameterLists: Fmt.ParameterList[]) => void;

interface HLMCheckerContext {
  previousSetTerm?: Fmt.Expression;
  parentBindingParameters: Fmt.Parameter[];
  parentStructuralCases: HLMCheckerStructuralCaseRef[];
  inAutoArgument: boolean;
  editData?: HLMCheckerEditData;
  currentRecheckFn?: HLMCheckerRecheckFn;
  currentPlaceholderCollection?: HLMCheckerPlaceholderCollection;
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
  private rootContext: HLMCheckerContext = {
    parentBindingParameters: [],
    parentStructuralCases: [],
    inAutoArgument: false
  };
  private result: Logic.LogicCheckResult = {
    diagnostics: [],
    hasErrors: false
  };
  private pendingChecks: PendingCheck[] = [];
  private pendingChecksPromise?: CachedPromise<Logic.LogicCheckResult>;

  constructor(private definition: Fmt.Definition, private libraryDataAccessor: LibraryDataAccessor, private utils: HLMUtils, private supportPlaceholders: boolean, private supportRechecking: boolean) {}

  checkDefinition(): CachedPromise<Logic.LogicCheckResult> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.checkDefinition());
    } else {
      if (this.supportPlaceholders) {
        this.rootContext.editData = {
          restrictions: new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>(),
          recheckFns: this.supportRechecking ? new Map<Fmt.Expression, HLMCheckerRecheckFn>() : undefined
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
        this.checkRootDefinition();
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
      return this.getPendingChecksPromise().then((result: Logic.LogicCheckResult) => {
        if (result.hasErrors) {
          return {
            ...result,
            expression: substitutedExpression
          };
        } else {
          let resultExpression = substitutedExpression.substitute((subExpression: Fmt.Expression) => {
            if (subExpression instanceof Fmt.PlaceholderExpression && recheckContext) {
              let restriction = recheckContext.editData!.restrictions.get(subExpression);
              if (restriction && restriction.exactValue) {
                return restriction.exactValue;
              }
            }
            return subExpression;
          });
          return {
            ...result,
            expression: resultExpression
          };
        }
      });
    }
  }

  autoFill(onFillExpression: HLMCheckerFillExpressionFn): CachedPromise<void> {
    if (this.pendingChecksPromise) {
      return this.pendingChecksPromise
        .catch(() => {})
        .then(() => this.autoFill(onFillExpression));
    } else {
      if (this.rootContext.currentPlaceholderCollection) {
        let placeholderValues = new Map<Fmt.PlaceholderExpression, Fmt.Expression>();
        return this.getAutoPlaceholderValues(this.rootContext.currentPlaceholderCollection, placeholderValues).then(() => {
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
          return this.callAutoFillFns(this.rootContext.currentPlaceholderCollection!, placeholderValues, onFillExpression);
        });
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
          if (placeholderRestriction.exactValueSuggestion) {
            placeholderValues.set(placeholder, placeholderRestriction.exactValueSuggestion);
            placeholderCollection.unfilledPlaceholderCount--;
          } else if (placeholderRestriction.compatibleSets.length) {
            let compatibleSets = placeholderRestriction.compatibleSets;
            let context = placeholderRestriction.context;
            result = result.then(() =>
              this.checkSetCompatibility(placeholder, compatibleSets, context).then((superset: Fmt.Expression) => {
                placeholderValues.set(placeholder, superset);
                placeholderCollection.unfilledPlaceholderCount--;
              }));
          }
        }
      }
    }
    return result;
  }

  private callAutoFillFns(placeholderCollection: HLMCheckerPlaceholderCollection, placeholderValues: Map<Fmt.PlaceholderExpression, Fmt.Expression>, onFillExpression: HLMCheckerFillExpressionFn): CachedPromise<void> {
    let result = CachedPromise.resolve();
    if (placeholderCollection.childCollections) {
      for (let childCollection of placeholderCollection.childCollections) {
        result = result.then(() => this.callAutoFillFns(childCollection, placeholderValues, onFillExpression));
      }
    }
    if (placeholderCollection.autoFillFn && !placeholderCollection.unfilledPlaceholderCount) {
      result = result.then(() => placeholderCollection.autoFillFn!(placeholderValues, onFillExpression));
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
      this.checkMacroOperator(contents);
    } else {
      this.checkParameterList(this.definition.parameters, this.rootContext);
      if (contents instanceof FmtHLM.ObjectContents_Construction) {
        this.checkConstruction(contents);
      } else {
        for (let innerDefinition of this.definition.innerDefinitions) {
          this.error(innerDefinition, 'This type of object does not support inner definitions.');
        }
        // TODO check properties (currently: negation)
        if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          this.checkSetOperator(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          this.checkExplicitOperator(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          this.checkImplicitOperator(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          this.checkPredicate(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
          this.checkStandardTheorem(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          this.checkEquivalenceTheorem(contents);
        } else {
          this.error(this.definition.type, 'Invalid object type');
        }
      }
    }
  }

  private checkConstruction(contents: FmtHLM.ObjectContents_Construction): void {
    for (let innerDefinition of this.definition.innerDefinitions) {
      this.checkParameterList(innerDefinition.parameters, this.rootContext);
      let innerContents = innerDefinition.contents;
      if (innerContents instanceof FmtHLM.ObjectContents_Constructor) {
        this.checkConstructor(innerDefinition, innerContents);
      } else {
        this.error(innerDefinition, 'Invalid object type');
      }
    }
    if (contents.embedding) {
      this.checkEmbedding(contents.embedding);
    }
  }

  private checkConstructor(innerDefinition: Fmt.Definition, innerContents: FmtHLM.ObjectContents_Constructor): void {
    if (innerContents.equalityDefinition) {
      this.checkEqualityDefinition(innerDefinition, innerContents.equalityDefinition);
    } else if (innerDefinition.parameters.length) {
      this.error(innerDefinition, 'Constructor with parameters requires equality definition');
    }
    if (innerContents.rewrite) {
      this.checkRewriteDefinition(innerDefinition, innerContents.rewrite);
    }
  }

  private checkEqualityDefinition(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_EqualityDefinition): void {
    let constructorParameters = innerDefinition.parameters;
    let leftParameters = equalityDefinition.leftParameters;
    if (!leftParameters.isEquivalentTo(constructorParameters)) {
      this.error(leftParameters, 'Parameters of equality definition must match constructor parameters');
    }
    let rightParameters = equalityDefinition.rightParameters;
    let unificationFn = undefined;
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
    let checkItem = (formula: Fmt.Expression, context: HLMCheckerContext) => this.checkFormula(formula, context);
    this.checkEquivalenceList(innerDefinition, equalityDefinition.definition, equalityDefinition.equivalenceProofs, checkItem, undefined, this.rootContext);
    this.checkProof(equalityDefinition.reflexivityProof, this.rootContext);
    this.checkProof(equalityDefinition.symmetryProof, this.rootContext);
    this.checkProof(equalityDefinition.transitivityProof, this.rootContext);
  }

  private checkRewriteDefinition(innerDefinition: Fmt.Definition, rewriteDefinition: FmtHLM.ObjectContents_RewriteDefinition): void {
    this.checkElementTerm(rewriteDefinition.value, this.rootContext);
    let constructionPath = new Fmt.Path;
    constructionPath.name = this.definition.name;
    this.utils.getParameterArguments(constructionPath.arguments, this.definition.parameters);
    let constructorPath = new Fmt.Path;
    constructorPath.parentPath = constructionPath;
    constructorPath.name = innerDefinition.name;
    this.utils.getParameterArguments(constructorPath.arguments, innerDefinition.parameters);
    let constructorExpression = new Fmt.DefinitionRefExpression;
    constructorExpression.path = constructorPath;
    this.checkElementCompatibility(rewriteDefinition.value, [constructorExpression, rewriteDefinition.value], this.rootContext);
    // TODO check whether rewrite definition matches referenced theorem
  }

  private checkEmbedding(embedding: FmtHLM.ObjectContents_Embedding): void {
    // TODO make sure that embedding does not implicitly reference itself (e.g. in the well-definedness proof)
    let subset = this.checkElementParameter(embedding.parameter, this.rootContext);
    if (subset) {
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
    this.checkElementTerm(embedding.target, this.rootContext);
    let constructionPath = new Fmt.Path;
    constructionPath.name = this.definition.name;
    this.utils.getParameterArguments(constructionPath.arguments, this.definition.parameters);
    let constructionExpression = new Fmt.DefinitionRefExpression;
    constructionExpression.path = constructionPath;
    this.checkCompatibility(embedding.target, [constructionExpression], [embedding.target], this.rootContext);
    this.checkProof(embedding.wellDefinednessProof, this.rootContext);
  }

  private checkSetOperator(contents: FmtHLM.ObjectContents_SetOperator): void {
    let checkCompatibility = (terms: Fmt.Expression[], context: HLMCheckerContext) => this.checkSetCompatibility(contents.definition, terms, context);
    let checkItem = (term: Fmt.Expression, context: HLMCheckerContext) => this.checkSetTerm(term, context);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equalityProofs, checkItem, checkCompatibility, this.rootContext);
  }

  private checkExplicitOperator(contents: FmtHLM.ObjectContents_ExplicitOperator): void {
    let checkCompatibility = (terms: Fmt.Expression[], context: HLMCheckerContext) => this.checkElementCompatibility(contents.definition, terms, context);
    let checkItem = (term: Fmt.Expression, context: HLMCheckerContext) => this.checkElementTerm(term, context);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equalityProofs, checkItem, checkCompatibility, this.rootContext);
  }

  private checkImplicitOperator(contents: FmtHLM.ObjectContents_ImplicitOperator): void {
    this.checkElementParameter(contents.parameter, this.rootContext);
    let checkItem = (formula: Fmt.Expression, context: HLMCheckerContext) => this.checkFormula(formula, context);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equivalenceProofs, checkItem, undefined, this.rootContext);
    this.checkProof(contents.wellDefinednessProof, this.rootContext);
  }

  private checkPredicate(contents: FmtHLM.ObjectContents_Predicate): void {
    let checkItem = (formula: Fmt.Expression, context: HLMCheckerContext) => this.checkFormula(formula, context);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equivalenceProofs, checkItem, undefined, this.rootContext);
  }

  private checkStandardTheorem(contents: FmtHLM.ObjectContents_StandardTheorem): void {
    this.checkFormula(contents.claim, this.rootContext);
    this.checkProofs(contents.proofs, this.rootContext);
  }

  private checkEquivalenceTheorem(contents: FmtHLM.ObjectContents_EquivalenceTheorem): void {
    let checkItem = (formula: Fmt.Expression, context: HLMCheckerContext) => this.checkFormula(formula, context);
    this.checkEquivalenceList(this.definition, contents.conditions, contents.equivalenceProofs, checkItem, undefined, this.rootContext);
  }

  private checkMacroOperator(contents: FmtHLM.ObjectContents_MacroOperator): void {
    let checkMacro = HLMMacros.instantiateMacro(this.libraryDataAccessor, this.definition)
      .then((macroInstance: HLMMacro.HLMMacroInstance) => macroInstance.check())
      .then((diagnostics: Logic.LogicCheckDiagnostic[]) => {
        this.result.diagnostics.push(...diagnostics);
        if (diagnostics.some((diagnostic: Logic.LogicCheckDiagnostic) => diagnostic.severity === Logic.DiagnosticSeverity.Error)) {
          this.result.hasErrors = true;
        }
      })
      .catch((error) => this.error(this.definition, error.message));
    this.addPendingCheck(checkMacro);
  }

  private setCurrentRecheckFn(expression: Fmt.Expression, checkFn: (substitutedExpression: Fmt.Expression, recheckContext: HLMCheckerContext) => void, autoFillFn: AutoFillFn | undefined, context: HLMCheckerContext): HLMCheckerContext {
    if (context.editData) {
      let newContext: HLMCheckerContext = {
        ...context,
        currentRecheckFn: (originalExpression: Fmt.Expression, substitutedExpression: Fmt.Expression) => {
          let substituted = this.utils.substituteExpression(expression, originalExpression, substitutedExpression);
          let restrictions = originalExpression instanceof Fmt.PlaceholderExpression ? context.editData!.restrictions : new Map<Fmt.PlaceholderExpression, HLMCheckerPlaceholderRestriction>();
          let recheckContext: HLMCheckerContext = {
            ...context,
            editData: {
              restrictions: restrictions
            }
          };
          checkFn(substituted, recheckContext);
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
                this.checkSetCompatibility(substitutedExpression, sets, recheckContext);
              }
              lastSetsToCheckLength = setsToCheck.length;
              this.pendingChecks.push(checkRestrictions);
            }
            return CachedPromise.resolve();
          };
          this.pendingChecks.push(checkRestrictions);
          return recheckContext;
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

  private checkParameterList(parameterList: Fmt.ParameterList, context: HLMCheckerContext): void {
    let currentContext = context;
    for (let param of parameterList) {
      this.checkParameter(param, currentContext);
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        if (!(type.superset instanceof FmtHLM.MetaRefExpression_previous)) {
          currentContext = {...context, previousSetTerm: type.superset};
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        if (!(type._set instanceof FmtHLM.MetaRefExpression_previous)) {
          currentContext = {...context, previousSetTerm: type._set};
        }
      } else {
        currentContext = context;
      }
    }
  }

  private checkParameter(param: Fmt.Parameter, context: HLMCheckerContext): void {
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
    this.checkParameterType(param, param.type.expression, context);
  }

  private checkParameterType(param: Fmt.Parameter, type: Fmt.Expression, context: HLMCheckerContext): void {
    let recheckFn = (substitutedType: Fmt.Expression, recheckContext: HLMCheckerContext) => this.checkParameterType(param, substitutedType, recheckContext);
    context = this.setCurrentRecheckFn(type, recheckFn, undefined, context);
    if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      this.checkBoolConstant(type.auto);
    } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
      this.checkBoolConstant(type.auto);
      this.checkBoolConstant(type.embedSubsets);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      this.checkSetTerm(type.superset, context);
      this.checkBoolConstant(type.auto);
      this.checkBoolConstant(type.embedSubsets);
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      this.checkSetTerm(type._set, context);
      this.checkBoolConstant(type.auto);
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      this.checkFormula(type.formula, context);
    } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      this.checkSetTerm(type._set, context);
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      this.checkElementTerm(type.element, context);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      this.checkSetTerm(type._set, context);
      let innerContext: HLMCheckerContext = {
        ...context,
        parentBindingParameters: context.parentBindingParameters.concat(param)
      };
      if (!(type._set instanceof FmtHLM.MetaRefExpression_previous)) {
        innerContext.previousSetTerm = type._set;
      }
      this.checkParameterList(type.parameters, innerContext);
    } else {
      this.error(type, 'Invalid parameter type');
    }
  }

  private checkElementParameter(param: Fmt.Parameter, context: HLMCheckerContext): Fmt.Expression | undefined {
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Element) {
      this.checkParameter(param, context);
      return type._set;
    } else {
      this.error(type, 'Element parameter expected');
      return undefined;
    }
  }

  private checkArgumentLists(argumentLists: Fmt.ArgumentList[], parameterLists: Fmt.ParameterList[], targetPath: Fmt.PathItem | undefined, context: HLMCheckerContext): void {
    let substitutionContext: HLMSubstitutionContext = {
      targetPath: targetPath,
      parameterLists: [],
      argumentLists: []
    };
    for (let listIndex = 0; listIndex < argumentLists.length; listIndex++) {
      substitutionContext.parameterLists!.push(parameterLists[listIndex]);
      substitutionContext.argumentLists!.push(argumentLists[listIndex]);
      this.checkLastArgumentList(context, substitutionContext);
    }
  }

  private checkLastArgumentList(context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    let argumentList = substitutionContext.argumentLists![substitutionContext.argumentLists!.length - 1];
    let parameterList = substitutionContext.parameterLists![substitutionContext.parameterLists!.length - 1];
    for (let param of parameterList) {
      this.checkArgument(argumentList, param, context, substitutionContext);
    }
  }

  private checkArgument(argumentList: Fmt.ArgumentList, param: Fmt.Parameter, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    let rawArg = this.utils.getRawArgument([argumentList], param);
    this.checkRawArgument(argumentList, param, rawArg, param.type.arrayDimensions, context, substitutionContext);
  }

  private checkRawArgument(argumentList: Fmt.ArgumentList, param: Fmt.Parameter, rawArg: Fmt.Expression | undefined, remainingArrayDimensions: number, context: HLMCheckerContext, substitutionContext: HLMSubstitutionContext): void {
    if (remainingArrayDimensions && rawArg) {
      if (rawArg instanceof Fmt.ArrayExpression) {
        for (let item of rawArg.items) {
          this.checkRawArgument(argumentList, param, item, remainingArrayDimensions - 1, context, substitutionContext);
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
        this.checkProof(subsetArg.subsetProof, context);
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      if (rawArg) {
        let set = this.utils.substituteParameterSet(type._set, substitutionContext, true);
        let elementArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_ElementArg);
        this.checkElementTerm(elementArg.element, this.getAutoArgumentContext(type.auto, context));
        this.checkCompatibility(elementArg.element, [set], [elementArg.element], context);
        this.checkProof(elementArg.elementProof, context);
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
        let constraintArg = rawArg ? this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_ConstraintArg) : undefined;
        this.checkProof(constraintArg?.proof, context);
      } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        if (rawArg) {
          let bindingArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_BindingArg);
          let bindingParameterSet = this.checkElementParameter(bindingArg.parameter, this.getAutoFillContext(context));
          if (bindingParameterSet) {
            let expectedSet = this.utils.substituteParameterSet(type._set, substitutionContext, false);
            if (!this.checkSetTermEquivalence(bindingParameterSet, expectedSet, context)) {
              this.error(bindingArg.parameter, 'Parameter declaration does not match binding');
            }
            let innerSubstitutionContext: HLMSubstitutionContext = {
              ...substitutionContext,
              previousSetTerm: expectedSet,
              parameterLists: [...substitutionContext.parameterLists!, type.parameters],
              argumentLists: [...substitutionContext.argumentLists!, bindingArg.arguments],
              originalBindingParameters: substitutionContext.originalBindingParameters ? [...substitutionContext.originalBindingParameters, param] : [param],
              substitutedBindingParameters: substitutionContext.substitutedBindingParameters ? [...substitutionContext.substitutedBindingParameters, bindingArg.parameter] : [bindingArg.parameter]
            };
            this.checkLastArgumentList(context, innerSubstitutionContext);
          }
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
      this.checkElementParameter(term.parameter, context);
      this.checkFormula(term.formula, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      this.checkParameterList(term.parameters, context);
      this.checkElementTerm(term.term, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      let checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkSetTerm(value, caseContext);
      let checkCompatibility = (values: Fmt.Expression[]) => this.checkSetCompatibility(term, values, context);
      let replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (let newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
        }
        let newTerm = term.clone() as FmtHLM.MetaRefExpression_setStructuralCases;
        newTerm.cases = newCases;
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, replaceCases, context);
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
    if (term instanceof Fmt.VariableRefExpression && (term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Element || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Def || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Binding)) {
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
      let values: Fmt.Expression[] = [];
      for (let item of term.cases) {
        this.checkFormula(item.formula, context);
        this.checkElementTerm(item.value, context);
        this.checkProof(item.exclusivityProof, context);
        values.push(item.value);
      }
      this.checkProof(term.totalityProof, context);
      this.checkElementCompatibility(term, values, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      let checkCase = (value: Fmt.Expression, caseContext: HLMCheckerContext) => this.checkElementTerm(value, caseContext);
      let checkCompatibility = (values: Fmt.Expression[]) => this.checkElementCompatibility(term, values, context);
      let replaceCases = (newCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        for (let newCase of newCases) {
          newCase.value = new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm);
        }
        let newTerm = term.clone() as FmtHLM.MetaRefExpression_structuralCases;
        newTerm.cases = newCases;
        return {
          originalExpression: term,
          filledExpression: newTerm
        };
      };
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, replaceCases, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      this.checkElementTerm(term.term, context);
      this.checkSetTerm(term._set, context);
      this.checkCompatibility(term, [term._set], [term.term], context);
      this.checkProof(term.proof, context);
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
      if (formula.formulae) {
        for (let item of formula.formulae) {
          this.checkFormula(item, context);
        }
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      this.checkFormula(formula.left, context);
      this.checkFormula(formula.right, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall || formula instanceof FmtHLM.MetaRefExpression_exists || formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
      this.checkParameterList(formula.parameters, context);
      if (formula.formula) {
        this.checkFormula(formula.formula, context);
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
        let newFormula = formula.clone() as FmtHLM.MetaRefExpression_structural;
        newFormula.cases = newCases;
        return {
          originalExpression: formula,
          filledExpression: newFormula
        };
      };
      this.checkStructuralCases(formula.term, formula.construction, formula.cases, checkCase, undefined, replaceCases, context);
    } else if (formula instanceof Fmt.PlaceholderExpression) {
      this.checkPlaceholderExpression(formula, HLMExpressionType.Formula, context);
    } else {
      this.error(formula, 'Formula expected');
    }
  }

  private checkVariableRefExpression(expression: Fmt.VariableRefExpression, context: HLMCheckerContext): void {
    let bindingParameters: Fmt.Parameter[] = [];
    if (expression.variable.type.expression instanceof FmtHLM.MetaRefExpression_Binding) {
      if (context.parentBindingParameters.indexOf(expression.variable) < 0) {
        this.error(expression, 'Invalid reference to binding parameter');
      }
    } else {
      for (let bindingParameter = this.utils.getParentBinding(expression.variable); bindingParameter; bindingParameter = this.utils.getParentBinding(bindingParameter)) {
        bindingParameters.unshift(bindingParameter);
      }
    }
    if (expression.indices) {
      let indexIndex = 0;
      let currentSet: Fmt.Expression | undefined = undefined;
      for (let index of expression.indices) {
        if (indexIndex < bindingParameters.length) {
          this.checkElementTerm(index, context);
          let type = bindingParameters[indexIndex].type.expression as FmtHLM.MetaRefExpression_Binding;
          if (!(currentSet && type._set instanceof FmtHLM.MetaRefExpression_previous)) {
            currentSet = type._set;
            for (let substitutionIndex = 0; substitutionIndex < indexIndex; substitutionIndex++) {
              currentSet = this.utils.substituteVariable(currentSet, bindingParameters[substitutionIndex], () => expression.indices![substitutionIndex]);
            }
          }
          this.checkCompatibility(index, [currentSet], [index], context);
          indexIndex++;
        } else {
          this.error(index, `Superfluous index`);
        }
      }
      if (indexIndex < bindingParameters.length) {
        this.error(expression, `Too few indices`);
      }
    } else if (bindingParameters.length) {
      this.error(expression, `Indices required`);
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

  private checkStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCase: (value: Fmt.Expression, context: HLMCheckerContext) => void, checkCompatibility: ((values: Fmt.Expression[]) => void) | undefined, replaceCases: (newCases: FmtHLM.ObjectContents_StructuralCase[]) => HLMCheckerFillExpressionArgs, context: HLMCheckerContext): void {
    this.checkStructuralCaseTerm(term, construction, replaceCases, context);
    if (construction instanceof Fmt.DefinitionRefExpression) {
      let constructionPathWithoutArguments = new Fmt.Path;
      constructionPathWithoutArguments.name = construction.path.name;
      constructionPathWithoutArguments.parentPath = construction.path.parentPath;
      let index = 0;
      let checkConstructor = (innerDefinition: Fmt.Definition, substitutedParameters: Fmt.ParameterList) => {
        if (index < cases.length) {
          let structuralCase = cases[index];
          if (structuralCase._constructor instanceof Fmt.DefinitionRefExpression && structuralCase._constructor.path.parentPath instanceof Fmt.Path) {
            if (!structuralCase._constructor.path.parentPath.isEquivalentTo(constructionPathWithoutArguments)) {
              this.error(structuralCase._constructor, 'Constructor path must match construction path (without arguments)');
            }
            if (structuralCase._constructor.path.name === innerDefinition.name) {
              if (structuralCase.parameters) {
                if (!structuralCase.parameters.isEquivalentTo(substitutedParameters)) {
                  this.error(structuralCase.parameters, 'Case parameters must match constructor parameters');
                }
              } else if (substitutedParameters.length) {
                this.error(structuralCase, 'Parameter list required');
              }
            } else {
              this.error(structuralCase._constructor, `Expected reference to constructor "${innerDefinition.name}"`);
            }
          } else {
            this.error(structuralCase._constructor, 'Constructor reference expected');
          }
        } else {
          this.error(term, `Missing case for constructor "${innerDefinition.name}"`);
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

    let values: Fmt.Expression[] = [];
    for (let structuralCase of cases) {
      let caseContext: HLMCheckerContext = {
        ...context,
        parentStructuralCases: context.parentStructuralCases.concat({
          term: term,
          construction: construction,
          _constructor: structuralCase._constructor,
          parameters: structuralCase.parameters
        })
      };
      checkCase(structuralCase.value, caseContext);
      values.push(structuralCase.value);
      this.checkProof(structuralCase.wellDefinednessProof, context);
    }
    if (checkCompatibility) {
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
          let addCase = (innerDefinition: Fmt.Definition, substitutedParameters: Fmt.ParameterList) => {
            let newCase = new FmtHLM.ObjectContents_StructuralCase;
            let constructorPath = new Fmt.Path;
            constructorPath.name = innerDefinition.name;
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
            if ((innerDefinition.contents as FmtHLM.ObjectContents_Constructor).rewrite) {
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

  private forAllConstructors(construction: Fmt.DefinitionRefExpression, callbackFn: (innerDefinition: Fmt.Definition, substitutedParameters: Fmt.ParameterList) => void): CachedPromise<void> {
    let constructionPathWithoutArguments = new Fmt.Path;
    constructionPathWithoutArguments.name = construction.path.name;
    constructionPathWithoutArguments.parentPath = construction.path.parentPath;
    return this.utils.getOuterDefinition(construction)
      .then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          for (let innerDefinition of definition.innerDefinitions) {
            if (innerDefinition.contents instanceof FmtHLM.ObjectContents_Constructor) {
              let substitutedParameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
              let substitutionFn = (expression: Fmt.Expression) => {
                expression = this.utils.substituteImmediatePath(expression, construction.path.parentPath);
                expression = this.utils.substituteArguments(expression, definition.parameters, construction.path.arguments);
                return expression;
              };
              innerDefinition.parameters.substituteExpression(substitutionFn, substitutedParameters);
              callbackFn(innerDefinition, substitutedParameters);
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
        context.currentPlaceholderCollection.placeholders.push(expression);
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

  private checkEquivalenceList(object: Object, list: Fmt.Expression[], equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, checkItem: (expression: Fmt.Expression, context: HLMCheckerContext) => void, checkCompatibility: ((expressions: Fmt.Expression[], context: HLMCheckerContext) => void) | undefined, context: HLMCheckerContext): void {
    if (list.length) {
      for (let item of list) {
        let currentContext = context;
        if (checkCompatibility) {
          let recheckFn = (substitutedItem: Fmt.Expression, recheckContext: HLMCheckerContext) => {
            let substitutedList = list.map((originalItem: Fmt.Expression) => originalItem === item ? substitutedItem : originalItem);
            this.checkEquivalenceList(object, substitutedList, undefined, checkItem, checkCompatibility, recheckContext);
          };
          currentContext = this.setCurrentRecheckFn(item, recheckFn, undefined, currentContext);
        }
        checkItem(item, currentContext);
      }
      if (checkCompatibility) {
        checkCompatibility(list, context);
      }
      this.checkProofs(equivalenceProofs, context);
    } else {
      this.error(object, 'At least one item expected');
    }
  }

  private checkProof(proof: FmtHLM.ObjectContents_Proof | undefined, context: HLMCheckerContext): void {
    // TODO
  }

  private checkProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, context: HLMCheckerContext): void {
    // TODO
  }

  private checkBoolConstant(expression: Fmt.Expression | undefined): void {
    if (expression === undefined || expression instanceof FmtHLM.MetaRefExpression_false || expression instanceof FmtHLM.MetaRefExpression_true) {
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
        let checkForDirectEquivalence = !status.directEquivalenceUnlikely && !status.checkedForDirectEquivalence && (!context.editData || status.obtainedFinalSets);
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
    let unificationFn: Fmt.ExpressionUnificationFn = undefined;
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
    if (placeholder.placeholderType === undefined) {
      return undefined;
    }
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
