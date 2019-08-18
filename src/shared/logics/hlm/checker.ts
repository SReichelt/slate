import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import { HLMUtils } from './utils';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor): CachedPromise<Logic.LogicCheckResult> {
    let definitionChecker = new HLMDefinitionChecker(definition, libraryDataAccessor);
    return definitionChecker.checkDefinition();
  }
}

interface HLMCheckerContext {
  previousSetTerm?: Fmt.Expression;
}

class HLMDefinitionChecker {
  private utils: HLMUtils;
  private readonly rootContext: HLMCheckerContext = {};
  private result: Logic.LogicCheckResult = {diagnostics: []};
  private promise = CachedPromise.resolve();

  constructor(private definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor) {
    this.utils = new HLMUtils(definition, libraryDataAccessor);
  }

  checkDefinition(): CachedPromise<Logic.LogicCheckResult> {
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
    return this.promise.then(() => this.result);
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
      this.checkRewriteDefinition(innerContents.rewrite);
    }
  }

  private checkEqualityDefinition(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_EqualityDefinition): void {
    let leftParameters = equalityDefinition.leftParameters;
    if (!leftParameters.isEquivalentTo(innerDefinition.parameters)) {
      this.error(leftParameters, 'Parameters of equality definition must match constructor parameters');
    }
    let rightParameters = equalityDefinition.rightParameters;
    let unificationFn = undefined;
    if (leftParameters.length && rightParameters.length) {
      let leftFirstType = leftParameters[0].type.expression;
      let rightFirstType = rightParameters[0].type.expression;
      if (leftFirstType instanceof FmtHLM.MetaRefExpression_Subset && rightFirstType instanceof FmtHLM.MetaRefExpression_Subset && rightFirstType.superset instanceof FmtHLM.MetaRefExpression_previous) {
        unificationFn = (actual: Fmt.Expression, expected: Fmt.Expression) => expected === leftFirstType && actual === rightFirstType;
        for (let leftParam of leftParameters.slice(1)) {
          let leftParamType = leftParam.type.expression;
          if (!(leftParamType instanceof FmtHLM.MetaRefExpression_Subset && leftParamType.superset instanceof FmtHLM.MetaRefExpression_previous)) {
            unificationFn = undefined;
            break;
          }
        }
      }
      if (leftFirstType instanceof FmtHLM.MetaRefExpression_Element && rightFirstType instanceof FmtHLM.MetaRefExpression_Element && rightFirstType._set instanceof FmtHLM.MetaRefExpression_previous) {
        unificationFn = (actual: Fmt.Expression, expected: Fmt.Expression) => expected === leftFirstType && actual === rightFirstType;
        for (let leftParam of leftParameters.slice(1)) {
          let leftParamType = leftParam.type.expression;
          if (!(leftParamType instanceof FmtHLM.MetaRefExpression_Element && leftParamType._set instanceof FmtHLM.MetaRefExpression_previous)) {
            unificationFn = undefined;
            break;
          }
        }
      }
    }
    if (!rightParameters.isEquivalentTo(leftParameters, unificationFn)) {
      this.error(rightParameters, 'Parameters of equality definition must match constructor parameters');
    }
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
    this.checkEquivalenceList(equalityDefinition.definition, equalityDefinition.equivalenceProofs, checkItem, this.rootContext);
    this.checkProof(equalityDefinition.reflexivityProof, this.rootContext);
    this.checkProof(equalityDefinition.symmetryProof, this.rootContext);
    this.checkProof(equalityDefinition.transitivityProof, this.rootContext);
  }

  private checkRewriteDefinition(rewrite: FmtHLM.ObjectContents_RewriteDefinition): void {
    this.checkElementTerm(rewrite.value, this.rootContext);
    // TODO check whether rewrite definition matches referenced theorem
  }

  private checkEmbedding(embedding: FmtHLM.ObjectContents_Embedding): void {
    this.checkParameter(embedding.parameter, this.rootContext);
    if (embedding.target instanceof Fmt.DefinitionRefExpression && embedding.target.path.parentPath instanceof Fmt.Path) {
      if (embedding.target.path.parentPath.parentPath || embedding.target.path.parentPath.name !== this.definition.name) {
        this.error(embedding.target, 'Embedding must refer to constructor of parent construction');
      } else {
        let innerDefinition = this.definition.innerDefinitions.getDefinition(embedding.target.path.name);
        this.checkDefinitionRefExpression(embedding.target, [this.definition, innerDefinition], [false, true], this.rootContext);
      }
    } else {
      this.error(embedding.target, 'Constructor reference expected');
    }
  }

  private checkSetOperator(contents: FmtHLM.ObjectContents_SetOperator): void {
    let checkItem = (term: Fmt.Expression) => this.checkSetTerm(term, this.rootContext);
    this.checkEquivalenceList(contents.definition, contents.equalityProofs, checkItem, this.rootContext);
  }

  private checkExplicitOperator(contents: FmtHLM.ObjectContents_ExplicitOperator): void {
    let checkItem = (term: Fmt.Expression) => this.checkElementTerm(term, this.rootContext);
    this.checkEquivalenceList(contents.definition, contents.equalityProofs, checkItem, this.rootContext);
  }

  private checkImplicitOperator(contents: FmtHLM.ObjectContents_ImplicitOperator): void {
    this.checkParameter(contents.parameter, this.rootContext);
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
    this.checkEquivalenceList(contents.definition, contents.equivalenceProofs, checkItem, this.rootContext);
    this.checkProof(contents.wellDefinednessProof, this.rootContext);
  }

  private checkPredicate(contents: FmtHLM.ObjectContents_Predicate): void {
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
    this.checkEquivalenceList(contents.definition, contents.equivalenceProofs, checkItem, this.rootContext);
  }

  private checkStandardTheorem(contents: FmtHLM.ObjectContents_StandardTheorem): void {
    this.checkFormula(contents.claim, this.rootContext);
    this.checkProofs(contents.proofs, this.rootContext);
  }

  private checkEquivalenceTheorem(contents: FmtHLM.ObjectContents_EquivalenceTheorem): void {
    let checkItem = (formula: Fmt.Expression) => this.checkFormula(formula, this.rootContext);
    this.checkEquivalenceList(contents.conditions, contents.equivalenceProofs, checkItem, this.rootContext);
  }

  private checkMacroOperator(contents: FmtHLM.ObjectContents_MacroOperator): void {
    // TODO
  }

  private checkParameterList(parameterList: Fmt.ParameterList, context: HLMCheckerContext): void {
    let currentContext = context;
    for (let param of parameterList) {
      this.checkParameter(param, currentContext);
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        if (!(type.superset instanceof FmtHLM.MetaRefExpression_previous)) {
          currentContext = {previousSetTerm: type.superset, ...context};
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        if (!(type._set instanceof FmtHLM.MetaRefExpression_previous)) {
          currentContext = {previousSetTerm: type._set, ...context};
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
    this.checkParameterType(param.type.expression, context);
  }

  private checkParameterType(type: Fmt.Expression, context: HLMCheckerContext): void {
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
      let innerContext = context;
      if (!(type._set instanceof FmtHLM.MetaRefExpression_previous)) {
        innerContext = {previousSetTerm: type._set, ...context};
      }
      this.checkParameterList(type.parameters, innerContext);
    } else {
      this.error(type, 'Invalid parameter type');
    }
  }

  private checkArgumentList(argumentList: Fmt.ArgumentList, parameterList: Fmt.ParameterList, context: HLMCheckerContext): void {
    for (let param of parameterList) {
      this.checkArgument(argumentList, param, context);
    }
  }

  private checkArgument(argumentList: Fmt.ArgumentList, param: Fmt.Parameter, context: HLMCheckerContext): void {
    let type = param.type.expression;
    try {
      if (type instanceof FmtHLM.MetaRefExpression_Prop) {
        let propArg = this.utils.getArgument([argumentList], param, FmtHLM.ObjectContents_PropArg);
        if (propArg) {
          this.checkFormula(propArg.formula, context);
        } else {
          this.error(argumentList, `Missing argument for parameter ${param.name}`);
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
        let setArg = this.utils.getArgument([argumentList], param, FmtHLM.ObjectContents_SetArg);
        if (setArg) {
          this.checkSetTerm(setArg._set, context);
        } else {
          this.error(argumentList, `Missing argument for parameter ${param.name}`);
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        let subsetArg = this.utils.getArgument([argumentList], param, FmtHLM.ObjectContents_SubsetArg);
        if (subsetArg) {
          this.checkSetTerm(subsetArg._set, context);
          this.checkProof(subsetArg.subsetProof, context);
        } else {
          this.error(argumentList, `Missing argument for parameter ${param.name}`);
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        let elementArg = this.utils.getArgument([argumentList], param, FmtHLM.ObjectContents_ElementArg);
        if (elementArg) {
          this.checkElementTerm(elementArg.element, context);
          this.checkProof(elementArg.elementProof, context);
        } else {
          this.error(argumentList, `Missing argument for parameter ${param.name}`);
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
        let constraintArg = this.utils.getArgument([argumentList], param, FmtHLM.ObjectContents_ConstraintArg);
        this.checkProof(constraintArg ? constraintArg.proof : undefined, context);
      } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        let bindingArg = this.utils.getArgument([argumentList], param, FmtHLM.ObjectContents_BindingArg);
        if (bindingArg) {
          // TODO check whether parameter is declared correctly
          this.checkParameter(bindingArg.parameter, context);
          this.checkArgumentList(bindingArg.arguments, type.parameters, context);
        } else {
          this.error(argumentList, `Missing argument for parameter ${param.name}`);
        }
      }
    } catch (error) {
      this.error(this.utils.getRawArgument([argumentList], param)!, error.message);
    }
  }

  private checkSetTerm(term: Fmt.Expression, context: HLMCheckerContext): void {
    if (term instanceof Fmt.VariableRefExpression && (term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Set || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Subset || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_SetDef)) {
      this.checkVariableRefExpression(term, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      this.promise = this.promise
        .then(() => this.utils.getOuterDefinition(term))
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Construction || definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
            this.checkDefinitionRefExpression(term, [definition], [true], context);
          } else {
            this.error(term, 'Referenced definition must be a construction or set operator');
          }
        })
        .catch((error) => this.error(term, error.message));
    } else if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
      if (term.terms) {
        for (let item of term.terms) {
          this.checkElementTerm(item, context);
        }
      }
    } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
      this.checkParameter(term.parameter, context);
      this.checkFormula(term.formula, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      this.checkParameterList(term.parameters, context);
      this.checkElementTerm(term.term, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      let checkCase = (value: Fmt.Expression) => this.checkSetTerm(value, context);
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, context);
    } else if (term instanceof FmtHLM.MetaRefExpression_previous && context.previousSetTerm) {
      // Nothing to check.
    } else {
      this.error(term, 'Set term expected');
    }
  }

  private checkElementTerm(term: Fmt.Expression, context: HLMCheckerContext): void {
    // TODO restrict access to binding?
    if (term instanceof Fmt.VariableRefExpression && (term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Element || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Def || term.variable.type.expression instanceof FmtHLM.MetaRefExpression_Binding)) {
      this.checkVariableRefExpression(term, context);
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      this.promise = this.promise
        .then(() => this.utils.getOuterDefinition(term))
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
    } else if (term instanceof FmtHLM.MetaRefExpression_cases) {
      // TODO check that cases form a partition
      for (let item of term.cases) {
        this.checkFormula(item.formula, context);
        this.checkElementTerm(item.value, context);
      }
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      let checkCase = (value: Fmt.Expression) => this.checkElementTerm(value, context);
      this.checkStructuralCases(term.term, term.construction, term.cases, checkCase, context);
    } else {
      this.error(term, 'Element term expected');
    }
  }

  private checkFormula(formula: Fmt.Expression, context: HLMCheckerContext): void {
    if (formula instanceof Fmt.VariableRefExpression && formula.variable.type.expression instanceof FmtHLM.MetaRefExpression_Prop) {
      this.checkVariableRefExpression(formula, context);
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      this.promise = this.promise
        .then(() => this.utils.getOuterDefinition(formula))
        .then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
            this.checkDefinitionRefExpression(formula, [definition], [true], context);
          } else {
            this.error(formula, 'Referenced definition must be a predicate');
          }
        })
        .catch((error) => this.error(formula, error.message));
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
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      this.checkSetTerm(formula.subset, context);
      this.checkSetTerm(formula.superset, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      this.checkSetTerm(formula.left, context);
      this.checkSetTerm(formula.right, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
      this.checkElementTerm(formula.left, context);
      this.checkElementTerm(formula.right, context);
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      let checkCase = (value: Fmt.Expression) => this.checkFormula(value, context);
      this.checkStructuralCases(formula.term, formula.construction, formula.cases, checkCase, context);
    } else {
      this.error(formula, 'Formula expected');
    }
  }

  private checkVariableRefExpression(expression: Fmt.VariableRefExpression, context: HLMCheckerContext): void {
    // TODO check whether number of indices is correct
    if (expression.indices) {
      for (let index of expression.indices) {
        this.checkElementTerm(index, context);
      }
    }
  }

  private checkDefinitionRefExpression(expression: Fmt.DefinitionRefExpression, definitions: Fmt.Definition[], argumentsExpected: boolean[], context: HLMCheckerContext): void {
    let argumentLists: Fmt.ArgumentList[] = [];
    let path: Fmt.Path | undefined = expression.path;
    for (let _ of definitions) {
      if (path) {
        argumentLists.unshift(path.arguments);
        if (path.parentPath instanceof Fmt.Path) {
          path = path.parentPath;
        } else {
          path = undefined;
        }
      } else {
        this.error(expression, 'Reference to inner definition expected');
      }
    }
    if (path && path.parentPath instanceof Fmt.Path) {
      this.error(expression, 'Unexpected reference to inner definition');
    } else {
      for (let index = 0; index < definitions.length; index++) {
        if (argumentsExpected[index]) {
          this.checkArgumentList(argumentLists[index], definitions[index].parameters, context);
        } else if (argumentLists[index].length) {
          this.error(argumentLists[index], 'Unexpected argument list');
        }
      }
    }
  }

  private checkStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], checkCase: (value: Fmt.Expression) => void, context: HLMCheckerContext): void {
    // TODO check constructors, parameters, etc.
    this.checkElementTerm(term, context);
    this.checkSetTerm(construction, context);
    for (let structuralCase of cases) {
      if (structuralCase.parameters) {
        this.checkParameterList(structuralCase.parameters, context);
      }
      checkCase(structuralCase.value);
    }
  }

  private checkEquivalenceList(expression: Fmt.Expression, equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, checkItem: (expression: Fmt.Expression) => void, context: HLMCheckerContext): void {
    if (expression instanceof Fmt.ArrayExpression) {
      if (expression.items.length) {
        for (let item of expression.items) {
          checkItem(item);
        }
        this.checkProofs(equivalenceProofs, context);
      } else {
        this.error(expression, 'At least one item expected');
      }
    } else {
      this.error(expression, 'Array expression expected');
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

  private error(object: Object, message: string): void {
    this.result.diagnostics.push({
      object: object,
      message: message,
      severity: Logic.DiagnosticSeverity.Error
    });
  }
}
