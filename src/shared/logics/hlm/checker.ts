import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import * as HLMMacro from './macro';
import * as HLMMacros from './macros/macros';
import { HLMUtils, HLMSubstitutionContext, HLMTypeSearchParameters } from './utils';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor): CachedPromise<Logic.LogicCheckResult> {
    let definitionChecker = new HLMDefinitionChecker(definition, libraryDataAccessor);
    return definitionChecker.checkDefinition();
  }
}

interface HLMCheckerStructuralCaseRef {
  term: Fmt.Expression;
  construction: Fmt.Expression;
  _constructor: Fmt.Expression;
  parameters: Fmt.ParameterList | undefined;
}

interface HLMCheckerContext {
  previousSetTerm?: Fmt.Expression;
  parentBindingParameters: Fmt.Parameter[];
  parentStructuralCases: HLMCheckerStructuralCaseRef[];
  inTypeCast: boolean;
}

interface HLMCheckerCompatibilityStatus {
  directEquivalenceUnlikely: boolean;
  checkedForDirectEquivalence: boolean;
  obtainedFinalSets: boolean;
  followedEmbeddings: boolean;
  addedStructuralCases: boolean;
}

// TODO definitions of individual categories are not fully checked

class HLMDefinitionChecker {
  private utils: HLMUtils;
  private readonly rootContext: HLMCheckerContext = {parentBindingParameters: [], parentStructuralCases: [], inTypeCast: false};
  private result: Logic.LogicCheckResult = {diagnostics: [], hasErrors: false};
  private pendingChecks: CachedPromise<void>[] = [];

  constructor(private definition: Fmt.Definition, private libraryDataAccessor: LibraryDataAccessor) {
    this.utils = new HLMUtils(definition, libraryDataAccessor);
  }

  checkDefinition(): CachedPromise<Logic.LogicCheckResult> {
    try {
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
    } catch (error) {
      this.result.diagnostics.push({object: this.definition, message: error.message, severity: Logic.DiagnosticSeverity.Error});
    }
    return this.getPendingChecksPromise();
  }

  private getPendingChecksPromise(): CachedPromise<Logic.LogicCheckResult> {
    let nextCheck = this.pendingChecks.shift();
    if (nextCheck) {
      return nextCheck.then(() => this.getPendingChecksPromise());
    } else {
      return CachedPromise.resolve(this.result);
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
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
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
    let subset = this.checkElementParameter(embedding.parameter, this.rootContext);
    if (subset) {
      let typeSearchParameters: HLMTypeSearchParameters = {
        followEmbeddings: true,
        resolveConstructionArguments: false,
        extractStructuralCasesFromConstructionArguments: false,
        inTypeCast: false
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
    if (embedding.target instanceof Fmt.DefinitionRefExpression && embedding.target.path.parentPath instanceof Fmt.Path) {
      if (embedding.target.path.parentPath.parentPath || embedding.target.path.parentPath.name !== this.definition.name) {
        this.error(embedding.target, 'Embedding must refer to constructor of parent construction');
      } else {
        if (embedding.target.path.parentPath.arguments.length) {
          this.error(embedding.target, 'Embedding target construction must be referenced without arguments');
        }
        let innerDefinition = this.definition.innerDefinitions.getDefinition(embedding.target.path.name);
        this.checkDefinitionRefExpression(embedding.target, [this.definition, innerDefinition], [false, true], this.rootContext);
      }
    } else {
      this.error(embedding.target, 'Constructor reference expected');
    }
  }

  private checkSetOperator(contents: FmtHLM.ObjectContents_SetOperator): void {
    let checkCompatibility = (terms: Fmt.Expression[]) => this.checkSetCompatibility(contents.definition, terms, this.rootContext);
    let checkItem = (term: Fmt.Expression) => this.checkSetTerm(term, this.rootContext);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equalityProofs, checkItem, checkCompatibility, this.rootContext);
  }

  private checkExplicitOperator(contents: FmtHLM.ObjectContents_ExplicitOperator): void {
    let checkCompatibility = (terms: Fmt.Expression[]) => this.checkElementCompatibility(contents.definition, terms, this.rootContext);
    let checkItem = (term: Fmt.Expression) => this.checkElementTerm(term, this.rootContext);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equalityProofs, checkItem, checkCompatibility, this.rootContext);
  }

  private checkImplicitOperator(contents: FmtHLM.ObjectContents_ImplicitOperator): void {
    this.checkElementParameter(contents.parameter, this.rootContext);
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equivalenceProofs, checkItem, undefined, this.rootContext);
    this.checkProof(contents.wellDefinednessProof, this.rootContext);
  }

  private checkPredicate(contents: FmtHLM.ObjectContents_Predicate): void {
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
    this.checkEquivalenceList(this.definition, contents.definition, contents.equivalenceProofs, checkItem, undefined, this.rootContext);
  }

  private checkStandardTheorem(contents: FmtHLM.ObjectContents_StandardTheorem): void {
    this.checkFormula(contents.claim, this.rootContext);
    this.checkProofs(contents.proofs, this.rootContext);
  }

  private checkEquivalenceTheorem(contents: FmtHLM.ObjectContents_EquivalenceTheorem): void {
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
    this.checkEquivalenceList(this.definition, contents.conditions, contents.equivalenceProofs, checkItem, undefined, this.rootContext);
  }

  private checkMacroOperator(contents: FmtHLM.ObjectContents_MacroOperator): void {
    let checkMacro = HLMMacros.instantiateMacro(this.libraryDataAccessor, this.definition)
      .then((macroInstance: HLMMacro.HLMMacroInstance) => macroInstance.check())
      .then((diagnostics: Logic.LogicCheckDiagnostic[]) => { this.result.diagnostics.push(...diagnostics); })
      .catch((error) => this.error(this.definition, error.message));
    this.addPendingCheck(checkMacro);
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
    this.checkParameterType(param, context);
  }

  private checkParameterType(param: Fmt.Parameter, context: HLMCheckerContext): void {
    let type = param.type.expression;
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
      let innerContext: HLMCheckerContext = {...context, parentBindingParameters: context.parentBindingParameters.concat(param)};
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
        this.error(rawArg ? rawArg : argumentList, error.message);
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
        this.checkSetTerm(subsetArg._set, context);
        this.checkSetCompatibility(subsetArg._set, [subsetArg._set, superset], context);
        this.checkProof(subsetArg.subsetProof, context);
      } else {
        missingArgument = true;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      if (rawArg) {
        let set = this.utils.substituteParameterSet(type._set, substitutionContext, true);
        let elementArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_ElementArg);
        this.checkElementTerm(elementArg.element, context);
        this.checkCompatibility(elementArg.element, [set], [elementArg.element], context);
        this.checkProof(elementArg.elementProof, context);
      } else {
        missingArgument = true;
      }
    } else {
      if (type instanceof FmtHLM.MetaRefExpression_Prop) {
        if (rawArg) {
          let propArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_PropArg);
          this.checkFormula(propArg.formula, context);
        } else {
          missingArgument = true;
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
        if (rawArg) {
          let setArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_SetArg);
          this.checkSetTerm(setArg._set, context);
        } else {
          missingArgument = true;
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
        let constraintArg = rawArg ? this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_ConstraintArg) : undefined;
        this.checkProof(constraintArg ? constraintArg.proof : undefined, context);
      } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        if (rawArg) {
          let bindingArg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_BindingArg);
          let bindingParameterSet = this.checkElementParameter(bindingArg.parameter, context);
          if (bindingParameterSet) {
            let expectedSet = this.utils.substituteParameterSet(type._set, substitutionContext, false);
            if (!bindingParameterSet.isEquivalentTo(expectedSet)) {
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

  private checkSetTerm(term: Fmt.Expression, context: HLMCheckerContext): void {
    if (term instanceof Fmt.VariableRefExpression && (term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Set || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Subset || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_SetDef)) {
      this.checkVariableRefExpression(term, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(term)
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Construction || definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
            this.checkDefinitionRefExpression(term, [definition], [true], context);
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
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_setAssociative) {
      this.checkSetTerm(term.term, context);
      // TODO check whether inner and outer operations are the same and are really declared as associative
    } else if (term instanceof FmtHLM.MetaRefExpression_previous && context.previousSetTerm) {
      // Nothing to check.
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
    if (term instanceof Fmt.VariableRefExpression && (term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Element || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Def || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Binding)) {
      this.checkVariableRefExpression(term, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(term)
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Construction && term.path.parentPath instanceof Fmt.Path && !(term.path.parentPath.parentPath instanceof Fmt.Path)) {
            let innerDefinition = definition.innerDefinitions.getDefinition(term.path.name);
            this.checkDefinitionRefExpression(term, [definition, innerDefinition], [true, true], context);
          } else if (definition.contents instanceof FmtHLM.ObjectContents_Operator) {
            this.checkDefinitionRefExpression(term, [definition], [true], context);
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
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, checkCompatibility, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      this.checkElementTerm(term.term, context);
      this.checkSetTerm(term._set, context);
      let typeCastContext: HLMCheckerContext = {
        ...context,
        inTypeCast: true
      };
      this.checkCompatibility(term, [term._set], [term.term], typeCastContext);
      this.checkProof(term.proof, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_associative) {
      this.checkElementTerm(term.term, context);
      // TODO check whether inner and outer operations are the same and are really declared as associative
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
    if (formula instanceof Fmt.VariableRefExpression && formula.variable.type.expression instanceof FmtHLM.MetaRefExpression_Prop) {
      this.checkVariableRefExpression(formula, context);
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      let checkDefinitionRef = this.utils.getOuterDefinition(formula)
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
            this.checkDefinitionRefExpression(formula, [definition], [true], context);
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
      this.checkStructuralCases(formula.term, formula.construction, formula.cases, checkCase, undefined, context);
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

  private checkDefinitionRefExpression(expression: Fmt.DefinitionRefExpression, definitions: Fmt.Definition[], argumentsExpected: boolean[], context: HLMCheckerContext): void {
    let parameterLists: Fmt.ParameterList[] = [];
    let argumentLists: Fmt.ArgumentList[] = [];
    let path: Fmt.PathItem | undefined = expression.path;
    for (let index = definitions.length - 1; index >= 0; index--) {
      if (path instanceof Fmt.Path) {
        if (argumentsExpected[index]) {
          parameterLists.unshift(definitions[index].parameters);
          argumentLists.unshift(path.arguments);
        } else if (path.arguments.length) {
          this.error(path.arguments, 'Unexpected argument list');
        }
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

  private checkStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCase: (value: Fmt.Expression, context: HLMCheckerContext) => void, checkCompatibility: ((values: Fmt.Expression[]) => void) | undefined, context: HLMCheckerContext): void {
    this.checkElementTerm(term, context);
    if (construction instanceof Fmt.DefinitionRefExpression) {
      let typeSearchParameters: HLMTypeSearchParameters = {
        followEmbeddings: false,
        resolveConstructionArguments: false,
        extractStructuralCasesFromConstructionArguments: false,
        inTypeCast: false
      };
      let checkConstructionRef = this.utils.getFinalSet(term, typeSearchParameters)
        .then((finalSet: Fmt.Expression) => {
          if (!finalSet.isEquivalentTo(construction)) {
            this.error(term, 'Term must be an element of the specified construction');
          }
        })
        .catch((error) => this.conditionalError(term, error.message));
      this.addPendingCheck(checkConstructionRef);
      let constructionPathWithoutArguments = new Fmt.Path;
      constructionPathWithoutArguments.name = construction.path.name;
      constructionPathWithoutArguments.parentPath = construction.path.parentPath;
      let checkCases = this.utils.getOuterDefinition(construction)
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
            this.checkDefinitionRefExpression(construction, [definition], [true], context);
            let index = 0;
            for (let innerDefinition of definition.innerDefinitions) {
              if (innerDefinition.contents instanceof FmtHLM.ObjectContents_Constructor) {
                if (index < cases.length) {
                  let structuralCase = cases[index];
                  if (structuralCase._constructor instanceof Fmt.DefinitionRefExpression && structuralCase._constructor.path.parentPath instanceof Fmt.Path) {
                    if (!structuralCase._constructor.path.parentPath.isEquivalentTo(constructionPathWithoutArguments)) {
                      this.error(structuralCase._constructor, 'Constructor path must match construction path (without arguments)');
                    }
                    if (structuralCase._constructor.path.name === innerDefinition.name) {
                      if (structuralCase.parameters) {
                        let expectedParameters: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
                        let substitutionFn = (expression: Fmt.Expression) => {
                          expression = this.utils.substituteImmediatePath(expression, construction.path.parentPath);
                          expression = this.utils.substituteArguments(expression, definition.parameters, construction.path.arguments);
                          return expression;
                        };
                        innerDefinition.parameters.substituteExpression(substitutionFn, expectedParameters);
                        if (!structuralCase.parameters.isEquivalentTo(expectedParameters)) {
                          this.error(structuralCase.parameters, 'Case parameters must match constructor parameters');
                        }
                      } else if (innerDefinition.parameters.length) {
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
                  break;
                }
                index++;
              }
            }
            if (index < cases.length) {
              this.error(term, 'Too many cases');
            }
          } else {
            this.error(term, 'Referenced definition must be a construction');
          }
        })
        .catch((error) => this.error(term, error.message));
      this.addPendingCheck(checkCases);
    } else {
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

  private checkEquivalenceList(object: Object, list: Fmt.Expression[], equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, checkItem: (expression: Fmt.Expression) => void, checkCompatibility: ((expressions: Fmt.Expression[]) => void) | undefined, context: HLMCheckerContext): void {
    if (list.length) {
      for (let item of list) {
        checkItem(item);
      }
      if (checkCompatibility) {
        checkCompatibility(list);
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
      .then((declaredSets: Fmt.Expression[]) => this.checkSetCompatibilityInternal(object, declaredSets, context, {
        directEquivalenceUnlikely: false,
        checkedForDirectEquivalence: false,
        obtainedFinalSets: false,
        followedEmbeddings: false,
        addedStructuralCases: false
      }))
      .catch((error) => this.conditionalError(object, error.message));
    this.addPendingCheck(checkDeclaredSets);
  }

  private checkSetCompatibility(object: Object, setTerms: Fmt.Expression[], context: HLMCheckerContext): void {
    this.checkSetCompatibilityInternal(object, setTerms, context, {
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

  private checkSetCompatibilityInternal(object: Object, setTerms: Fmt.Expression[], context: HLMCheckerContext, status: HLMCheckerCompatibilityStatus): void {
    if (setTerms.length > 1) {
      if (status.obtainedFinalSets && status.followedEmbeddings && status.addedStructuralCases) {
        let firstTerm = setTerms[0];
        for (let index = 1; index < setTerms.length; index++) {
          let term = setTerms[index];
          if (status.checkedForDirectEquivalence || !firstTerm.isEquivalentTo(term)) {
            this.error(object, 'Type mismatch');
            return;
          }
        }
      } else {
        let nextSetTermsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        let nextStatus: HLMCheckerCompatibilityStatus = {
          directEquivalenceUnlikely: false,
          checkedForDirectEquivalence: !status.directEquivalenceUnlikely,
          obtainedFinalSets: true,
          followedEmbeddings: status.obtainedFinalSets,
          addedStructuralCases: status.followedEmbeddings || !context.parentStructuralCases.length
        };
        let typeSearchParameters: HLMTypeSearchParameters = {
          followEmbeddings: nextStatus.followedEmbeddings,
          resolveConstructionArguments: nextStatus.followedEmbeddings,
          extractStructuralCasesFromConstructionArguments: nextStatus.followedEmbeddings,
          inTypeCast: context.inTypeCast
        };
        if (nextStatus.addedStructuralCases && context.parentStructuralCases.length) {
          for (let index = 0; index < setTerms.length; index++) {
            let term = setTerms[index];
            for (let structuralCaseRef of context.parentStructuralCases) {
              term = this.utils.buildSingleStructuralCaseSetTerm(structuralCaseRef.term, structuralCaseRef.construction, structuralCaseRef._constructor, structuralCaseRef.parameters, term);
            }
            setTerms[index] = term;
          }
        }
        let firstTerm = setTerms[0];
        for (let index = 1; index < setTerms.length; index++) {
          let term = setTerms[index];
          if (status.directEquivalenceUnlikely || status.checkedForDirectEquivalence || !firstTerm.isEquivalentTo(term)) {
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
            return nextSetTerms;
          }
        });
        let checkNextSetTerms = nextSetTermsPromise
          .then((nextSetTerms: Fmt.Expression[]) => this.checkSetCompatibilityInternal(object, nextSetTerms, context, nextStatus))
          .catch((error) => this.conditionalError(object, error.message));
        this.addPendingCheck(checkNextSetTerms);
      }
    }
  }

  private addPendingCheck(check: CachedPromise<void>): void {
    this.pendingChecks.push(check);
  }

  private error(object: Object, message: string): void {
    this.result.diagnostics.push({
      object: object,
      message: message,
      severity: Logic.DiagnosticSeverity.Error
    });
    this.result.hasErrors = true;
  }

  private conditionalError(object: Object, message: string): void {
    if (!this.result.hasErrors) {
      this.error(object, message);
    }
  }
}
