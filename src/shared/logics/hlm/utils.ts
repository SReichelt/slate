import { GenericUtils, SubstitutionContext } from '../generic/utils';
import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as FmtHLM from './meta';
import { HLMExpressionType } from './hlm';
import * as Macro from '../macro';
import * as HLMMacro from './macro';
import * as HLMMacros from './macros/macros';
import { LibraryDefinition } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

export class HLMSubstitutionContext extends SubstitutionContext {}

export interface HLMProofStepContext {
  goal?: Fmt.Expression;
  previousResult?: Fmt.Expression;
  stepResults: Map<Fmt.Parameter, Fmt.Expression>;
}

export interface HLMUnfoldParameters {
  followDefinitions: boolean;
  unfoldArguments: boolean;
  substituteStructuralCases: boolean;
  extractStructuralCases: boolean;
  requiredUnfoldLocation?: Fmt.Expression;
}

export interface HLMTypeSearchParameters extends HLMUnfoldParameters {
  followSupersets?: boolean;
  followEmbeddings?: boolean;
  followAllAlternatives?: boolean;
}

const eliminateVariablesOnly: HLMTypeSearchParameters = {
  followDefinitions: false,
  followSupersets: true,
  followEmbeddings: false,
  followAllAlternatives: false,
  unfoldArguments: false,
  substituteStructuralCases: false,
  extractStructuralCases: false
};

export interface HLMFormulaDefinition {
  formula: Fmt.Expression;
  definitionRef?: Fmt.DefinitionRefExpression;
}

export interface HLMFormulaCase {
  parameters?: Fmt.ParameterList;
  formula: Fmt.Expression;
}

type CreatePlaceholderFn = (placeholderType: HLMExpressionType) => Fmt.PlaceholderExpression;
type CreateParameterListFn = (source: Fmt.ParameterList) => Fmt.ParameterList;

class HLMMacroInvocationConfig extends Macro.DefaultMacroInvocationConfig {
  constructor(protected utils: HLMUtils, protected parentPath: Fmt.PathItem | undefined) {
    super();
  }

  createArgumentExpression?(param: Fmt.Parameter): Fmt.Expression | undefined {
    let createPlaceholder = (placeholderType: HLMExpressionType) => new Fmt.PlaceholderExpression(placeholderType);
    let createParameterList = (source: Fmt.ParameterList) => this.utils.createParameterList(source, this.parentPath);
    return this.utils.createArgumentItemValue(param, createPlaceholder, createParameterList);
  }
}

class HLMMacroInvocationConfigWithPlaceholders extends HLMMacroInvocationConfig {
  getNumberExpression(value: number, onSetValue?: (newValue: number) => void): Fmt.Expression {
    if (value || !onSetValue) {
      return super.getNumberExpression(value);
    } else {
      let result = new Fmt.PlaceholderExpression(undefined);
      result.isTemporary = true;
      result.onFill = (expression: Fmt.Expression) => {
        if (expression instanceof Fmt.IntegerExpression) {
          onSetValue(expression.value.toNumber());
        }
      };
      return result;
    }
  }
}

interface ClonedExpressionInfo {
  clonedExpression: Fmt.Expression;
  expressionType: HLMExpressionType;
  args: Fmt.ArgumentList;
}

export class HLMUtils extends GenericUtils {
  getRawArgument(argumentLists: Fmt.ArgumentList[], param: Fmt.Parameter): Fmt.Expression | undefined {
    for (let argumentList of argumentLists) {
      let rawArg = argumentList.getOptionalValue(param.name);
      if (rawArg) {
        return rawArg;
      }
    }
    return undefined;
  }

  convertArgument<ContentClass extends Fmt.ObjectContents>(rawArg: Fmt.Expression, contentClass: {new(): ContentClass}): ContentClass {
    let contents = new contentClass;
    contents.fromExpression(rawArg);
    return contents;
  }

  getArgument<ContentClass extends Fmt.ObjectContents>(argumentLists: Fmt.ArgumentList[], param: Fmt.Parameter, contentClass: {new(): ContentClass}): ContentClass | undefined {
    let rawArg = this.getRawArgument(argumentLists, param);
    if (rawArg) {
      return this.convertArgument(rawArg, contentClass);
    } else {
      return undefined;
    }
  }

  isValueParamType(type: Fmt.Expression): boolean {
    return (type instanceof FmtHLM.MetaRefExpression_Prop || type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_Element);
  }

  getParameterExpressionType(param: Fmt.Parameter): HLMExpressionType | undefined {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      return HLMExpressionType.Formula;
    } else if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_SetDef) {
      return HLMExpressionType.SetTerm;
    } else if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Def) {
      return HLMExpressionType.ElementTerm;
    } else {
      return undefined;
    }
  }

  getArgValue(argumentList: Fmt.ArgumentList, param: Fmt.Parameter): Fmt.Expression | undefined {
    let arg = this.getRawArgument([argumentList], param);
    if (arg) {
      return this.extractArgValue(arg);
    } else {
      return undefined;
    }
  }

  extractArgValue(arg: Fmt.Expression): Fmt.Expression | undefined {
    if (arg instanceof Fmt.CompoundExpression) {
      if (arg.arguments.length && (arg.arguments[0].name === undefined || arg.arguments.length === 1)) {
        return arg.arguments[0].value;
      } else {
        return undefined;
      }
    } else {
      return arg;
    }
  }

  getParameterArgument(param: Fmt.Parameter, context: HLMSubstitutionContext, targetParam?: Fmt.Parameter, addIndices?: (expression: Fmt.Expression) => Fmt.Expression): Fmt.Argument | undefined {
    let type = param.type;
    if (this.isValueParamType(type) || type instanceof FmtHLM.MetaRefExpression_Binder) {
      let arg = new Fmt.Argument;
      arg.name = param.name;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        let targetType = targetParam ? targetParam.type as FmtHLM.MetaRefExpression_Binder : undefined;
        let binderArg = new FmtHLM.ObjectContents_BinderArg;
        binderArg.sourceParameters = targetType ? targetType.sourceParameters : this.applySubstitutionContextToParameterList(type.sourceParameters, context);
        let newContext = new HLMSubstitutionContext(context);
        this.addParameterListSubstitution(type.sourceParameters, binderArg.sourceParameters, newContext);
        let targetInnerParameters = targetType?.targetParameters;
        let addNewIndices = (expression: Fmt.Expression) => {
          let index: Fmt.Index = {
            parameters: binderArg.sourceParameters,
            arguments: new Fmt.ArgumentList
          };
          this.getParameterArguments(index.arguments!, binderArg.sourceParameters, context, undefined, addIndices);
          return new Fmt.IndexedExpression(addIndices ? addIndices(expression) : expression, index);
        };
        binderArg.targetArguments = new Fmt.ArgumentList;
        this.getParameterArguments(binderArg.targetArguments, type.targetParameters, newContext, targetInnerParameters, addNewIndices);
        arg.value = binderArg.toExpression(false);
      } else {
        let variableRefExpression = new Fmt.VariableRefExpression(param);
        let expression = addIndices ? addIndices(variableRefExpression) : variableRefExpression;
        if (type instanceof FmtHLM.MetaRefExpression_Prop) {
          let propArg = new FmtHLM.ObjectContents_PropArg;
          propArg.formula = expression;
          arg.value = propArg.toExpression(false);
        } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
          let setArg = new FmtHLM.ObjectContents_SetArg;
          setArg._set = expression;
          arg.value = setArg.toExpression(false);
        } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
          let subsetArg = new FmtHLM.ObjectContents_SubsetArg;
          subsetArg._set = expression;
          arg.value = subsetArg.toExpression(false);
        } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
          let elementArg = new FmtHLM.ObjectContents_ElementArg;
          elementArg.element = expression;
          arg.value = elementArg.toExpression(false);
        } else {
          return undefined;
        }
      }
      return arg;
    }
    // No need to adjust context according to parameter; it is only used for binders.
    return undefined;
  }

  // TODO return argument list instead
  getParameterArguments(args: Fmt.ArgumentList, parameters: Fmt.Parameter[], context: HLMSubstitutionContext, targetParameters?: Fmt.Parameter[], addIndices?: (expression: Fmt.Expression) => Fmt.Expression): void {
    for (let paramIndex = 0; paramIndex < parameters.length; paramIndex++) {
      let param = parameters[paramIndex];
      let targetParam = targetParameters ? targetParameters[paramIndex] : undefined;
      let arg = this.getParameterArgument(param, context, targetParam, addIndices);
      if (arg) {
        args.push(arg);
      }
    }
  }

  isTrueeFormula(formula: Fmt.Expression): boolean {
    return (formula instanceof FmtHLM.MetaRefExpression_and && !formula.formulas);
  }

  isFalseFormula(formula: Fmt.Expression): boolean {
    return (formula instanceof FmtHLM.MetaRefExpression_or && !formula.formulas);
  }

  getStructuralCaseTerm(constructionPath: Fmt.Path, structuralCase: FmtHLM.ObjectContents_StructuralCase): CachedPromise<Fmt.Expression> {
    let constructionDefinitionPromise = this.libraryDataAccessor.fetchItem(constructionPath, false);
    let resultPromise = constructionDefinitionPromise.then((libraryDefinition: LibraryDefinition) => {
      let constructionDefinition = libraryDefinition.definition;
      let constructorExpr = structuralCase._constructor as Fmt.DefinitionRefExpression;
      let constructorPath = constructorExpr.path;
      let constructorDefinition = constructionDefinition.innerDefinitions.getDefinition(constructorExpr.path.name);
      let constructorContents = constructorDefinition.contents as FmtHLM.ObjectContents_Constructor;
      return this.getResolvedStructuralCaseTerm(constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents);
    });
    return resultPromise;
  }

  getResolvedStructuralCaseTerm(constructionPath: Fmt.Path, constructionDefinition: Fmt.Definition, structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorPath: Fmt.Path, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor): Fmt.Expression {
    let result: Fmt.Expression;
    if (structuralCase.rewrite instanceof FmtHLM.MetaRefExpression_true && constructorContents.rewrite) {
      result = constructorContents.rewrite.value;
      result = this.substitutePath(result, constructionPath, [constructionDefinition]);
    } else {
      let resultPath = new Fmt.Path(constructorPath.name, undefined, constructionPath);
      let context = new SubstitutionContext;
      this.addTargetPathSubstitution(constructionPath.parentPath, context);
      this.getParameterArguments(resultPath.arguments, constructorDefinition.parameters, context, structuralCase.parameters);
      result = new Fmt.DefinitionRefExpression(resultPath);
    }
    if (constructorDefinition.parameters.length) {
      result = this.substituteParameters(result, constructorDefinition.parameters, structuralCase.parameters!);
    }
    return result;
  }

  getStructuralCaseConstraintParameter(term: Fmt.Expression, structuralCaseTerm: Fmt.Expression): Fmt.Parameter {
    let structuralCaseEquality = new FmtHLM.MetaRefExpression_equals;
    structuralCaseEquality.terms = [term, structuralCaseTerm];
    return this.createConstraintParameter(structuralCaseEquality, '_');
  }

  getStructuralCaseParametersWithConstraint(term: Fmt.Expression, structuralCase: FmtHLM.ObjectContents_StructuralCase, structuralCaseTerm: Fmt.Expression): Fmt.ParameterList {
    let result = new Fmt.ParameterList;
    if (structuralCase.parameters) {
      result.push(...structuralCase.parameters);
    }
    result.push(this.getStructuralCaseConstraintParameter(term, structuralCaseTerm));
    return result;
  }

  getInductionProofGoal(originalGoal: Fmt.Expression, term: Fmt.Expression, structuralCaseTerm: Fmt.Expression): Fmt.Expression {
    return FmtUtils.substituteEquivalentExpressions(originalGoal, term, structuralCaseTerm);
  }

  addParameterListSubstitution(originalParameters: Fmt.Parameter[], substitutedParameters: Fmt.Parameter[], context: SubstitutionContext): void {
    for (let paramIndex = 0; paramIndex < originalParameters.length && paramIndex < substitutedParameters.length; paramIndex++) {
      this.addParameterSubstitution(originalParameters[paramIndex], substitutedParameters[paramIndex], context);
    }
  }

  substituteParameters(expression: Fmt.Expression, originalParameters: Fmt.Parameter[], substitutedParameters: Fmt.Parameter[]): Fmt.Expression {
    let context = new SubstitutionContext;
    this.addParameterListSubstitution(originalParameters, substitutedParameters, context);
    return this.applySubstitutionContext(expression, context);
  }

  addParameterSubstitution(originalParam: Fmt.Parameter, substitutedParam: Fmt.Parameter, context: SubstitutionContext): void {
    context.replacedParameters.push({
      original: originalParam,
      replacement: substitutedParam
    });
    let originalType = originalParam.type;
    let substitutedType = substitutedParam.type;
    if (originalType instanceof FmtHLM.MetaRefExpression_Binder && substitutedType instanceof FmtHLM.MetaRefExpression_Binder) {
      this.addParameterListSubstitution(originalType.sourceParameters, substitutedType.sourceParameters, context);
      this.addParameterListSubstitution(originalType.targetParameters, substitutedType.targetParameters, context);
    }
  }

  substituteParameter(expression: Fmt.Expression, originalParam: Fmt.Parameter, substitutedParam: Fmt.Parameter): Fmt.Expression {
    let context = new SubstitutionContext;
    this.addParameterSubstitution(originalParam, substitutedParam, context);
    return this.applySubstitutionContext(expression, context);
  }

  addArgumentListSubstitution(parameters: Fmt.Parameter[], args: Fmt.ArgumentList, targetPath: Fmt.PathItem | undefined, context: SubstitutionContext): void {
    let previousParameters: Fmt.Parameter[] = [];
    for (let param of parameters) {
      let type = param.type;
      if (this.isValueParamType(type)) {
        let argValue = this.getArgValue(args, param);
        if (argValue) {
          this.addVariableSubstitution(param, argValue, context);
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        let argValue = this.getArgument([args], param, FmtHLM.ObjectContents_BinderArg);
        if (argValue) {
          this.addParameterListSubstitution(type.sourceParameters, argValue.sourceParameters, context);
          this.addArgumentListSubstitution(type.targetParameters, argValue.targetArguments, targetPath, context);
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
        let value = type instanceof FmtHLM.MetaRefExpression_SetDef ? type._set : type.element;
        let valueContext = new SubstitutionContext;
        this.addTargetPathSubstitution(targetPath, valueContext);
        this.addArgumentListSubstitution(previousParameters, args, targetPath, valueContext);
        value = this.applySubstitutionContext(value, valueContext);
        this.addVariableSubstitution(param, value, context);
      } else {
        while (type instanceof Fmt.IndexedExpression) {
          type = type.body;
        }
        if (type instanceof FmtHLM.MetaRefExpression_Bool || type instanceof FmtHLM.MetaRefExpression_Nat) {
          let argValue = this.getRawArgument([args], param);
          if (argValue) {
            this.addVariableSubstitution(param, argValue, context);
          }
        }
      }
      previousParameters.push(param);
    }
  }

  addArgumentListsSubstitution(parameterLists: Fmt.ParameterList[], argumentLists: Fmt.ArgumentList[], targetPath: Fmt.PathItem | undefined, context: SubstitutionContext): void {
    if (parameterLists.length !== argumentLists.length) {
      throw new Error('Number of parameter and argument lists do not match');
    }
    for (let index = 0; index < parameterLists.length; index++) {
      this.addArgumentListSubstitution(parameterLists[index], argumentLists[index], targetPath, context);
    }
  }

  substituteArguments(expression: Fmt.Expression, parameters: Fmt.ParameterList, args: Fmt.ArgumentList, targetPath?: Fmt.PathItem): Fmt.Expression {
    let context = new SubstitutionContext;
    this.addArgumentListSubstitution(parameters, args, targetPath, context);
    return this.applySubstitutionContext(expression, context);
  }

  extractVariableRefExpression(expression: Fmt.Expression): [Fmt.VariableRefExpression | undefined, SubstitutionContext | undefined] {
    let context: SubstitutionContext | undefined = undefined;
    while (expression instanceof Fmt.IndexedExpression) {
      if (expression.parameters && expression.arguments) {
        if (!context) {
          context = new SubstitutionContext;
        }
        this.addArgumentListSubstitution(expression.parameters, expression.arguments, undefined, context);
      }
      expression = expression.body;
    }
    if (expression instanceof Fmt.VariableRefExpression) {
      return [expression, context];
    } else {
      return [undefined, undefined];
    }
  }

  addVariableSubstitution(variable: Fmt.Parameter, value: Fmt.Expression, context: SubstitutionContext): void {
    context.substitutionFns.push((subExpression: Fmt.Expression, indices?: Fmt.Index[]) => {
      if (!indices) {
        let [variableRefExpression, indexContext] = this.extractVariableRefExpression(subExpression);
        if (variableRefExpression && variableRefExpression.variable === variable) {
          return this.applySubstitutionContext(value, indexContext);
        }
      }
      return subExpression;
    });
  }

  substitutePath(expression: Fmt.Expression, path: Fmt.Path, definitions: Fmt.Definition[]): Fmt.Expression {
    let context = new SubstitutionContext;
    this.addPathSubstitution(path, definitions, context);
    return this.applySubstitutionContext(expression, context);
  }

  addPathSubstitution(path: Fmt.Path, definitions: Fmt.Definition[], context: SubstitutionContext): void {
    let parentPath = path.parentPath;
    while (parentPath instanceof Fmt.Path) {
      parentPath = parentPath.parentPath;
    }
    this.addTargetPathSubstitution(parentPath, context);
    let parameterLists: Fmt.ParameterList[] = [];
    for (let definition of definitions) {
      parameterLists.push(definition.parameters);
    }
    let argumentLists: Fmt.ArgumentList[] = [];
    for (let pathItem: Fmt.PathItem | undefined = path; pathItem instanceof Fmt.Path; pathItem = pathItem.parentPath) {
      argumentLists.unshift(pathItem.arguments);
    }
    this.addArgumentListsSubstitution(parameterLists, argumentLists, parentPath, context);
  }

  parameterListContainsParameter(parameters: Fmt.Parameter[], param: Fmt.Parameter): boolean {
    for (let currentParam of parameters) {
      if (currentParam === param) {
        return true;
      }
      let type = currentParam.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        if (this.parameterListContainsParameter(type.sourceParameters, param) || this.parameterListContainsParameter(type.targetParameters, param)) {
          return true;
        }
      }
    }
    return false;
  }

  private referencesCaseParameter(structuralCase: FmtHLM.ObjectContents_StructuralCase): boolean {
    let referencesCaseParameter = false;
    if (structuralCase.parameters) {
      let parameters = structuralCase.parameters;
      structuralCase.value.traverse((subExpression: Fmt.Expression) => {
        if (subExpression instanceof Fmt.VariableRefExpression && this.parameterListContainsParameter(parameters, subExpression.variable)) {
          referencesCaseParameter = true;
        }
      });
    }
    return referencesCaseParameter;
  }

  addAllParametersToSet(parameters: Fmt.Parameter[], result: Set<Fmt.Parameter>): void {
    for (let param of parameters) {
      result.add(param);
      let type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        this.addAllParametersToSet(type.sourceParameters, result);
        this.addAllParametersToSet(type.targetParameters, result);
      }
    }
  }

  getMacroInvocation(expression: Fmt.DefinitionRefExpression, definition: Fmt.Definition): HLMMacro.HLMMacroInvocation {
    let parentPath = expression.path.parentPath;
    let libraryDataAccessor = this.libraryDataAccessor.getAccessorForSection(parentPath);
    let macroInstance = HLMMacros.instantiateMacro(libraryDataAccessor, definition);
    let config = this.supportPlaceholders ? new HLMMacroInvocationConfigWithPlaceholders(this, parentPath) : new HLMMacroInvocationConfig(this, parentPath);
    return macroInstance.invoke(this, expression, config);
  }

  updateInitialProofStepContext(proof: FmtHLM.ObjectContents_Proof, context: HLMProofStepContext): void {
    if (proof.goal) {
      context.goal = proof.goal;
    } else if (proof.parameters && proof.parameters.length) {
      let lastParam = proof.parameters[proof.parameters.length - 1];
      context.previousResult = this.getParameterConstraint(lastParam, context);
    }
  }

  getProofStepResult(step: Fmt.Parameter, context: HLMProofStepContext): Fmt.Expression | undefined {
    let type = step.type;
    if (type instanceof FmtHLM.MetaRefExpression_Consider) {
      if (type.result) {
        return type.result;
      } else {
        let [variableRefExpression, indexContext] = this.extractVariableRefExpression(type.variable);
        if (variableRefExpression) {
          return this.getParameterConstraint(variableRefExpression.variable, context, variableRefExpression, indexContext);
        } else {
          throw new Error('Variable reference expected');
        }
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      return type.statement;
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
               || type instanceof FmtHLM.MetaRefExpression_Unfold
               || type instanceof FmtHLM.MetaRefExpression_UseTheorem
               || type instanceof FmtHLM.MetaRefExpression_Substitute) {
      return type.result;
    } else if (type instanceof FmtHLM.MetaRefExpression_UseExists
               || type instanceof FmtHLM.MetaRefExpression_UseForAll) {
      if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
        if (context.previousResult instanceof FmtHLM.MetaRefExpression_exists || context.previousResult instanceof FmtHLM.MetaRefExpression_existsUnique) {
          return context.previousResult.formula ? this.substituteParameters(context.previousResult.formula, context.previousResult.parameters, type.parameters) : undefined;
        } else {
          throw new Error('Previous result is not an existentially quantified expression');
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
        if (context.previousResult instanceof FmtHLM.MetaRefExpression_forall) {
          return this.substituteArguments(context.previousResult.formula, context.previousResult.parameters, type.arguments);
        } else {
          throw new Error('Previous result is not a universally quantified expression');
        }
      } else {
        throw new Error('Unknown proof step');
      }
    } else {
      return this.getParameterConstraint(step, context);
    }
  }

  getParameterConstraint(param: Fmt.Parameter, context: HLMProofStepContext, variableRefExpression?: Fmt.VariableRefExpression, indexContext?: SubstitutionContext): Fmt.Expression | undefined {
    let getVariableRefExpression = () => {
      if (variableRefExpression) {
        return variableRefExpression;
      } else {
        return new Fmt.VariableRefExpression(param);
      }
    };
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      let result = new FmtHLM.MetaRefExpression_sub;
      result.subset = getVariableRefExpression();
      result.superset = this.applySubstitutionContext(type.superset, indexContext);
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      let result = new FmtHLM.MetaRefExpression_setEquals;
      let left = getVariableRefExpression();
      let right = this.applySubstitutionContext(type._set, indexContext);
      result.terms = [left, right];
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      let result = new FmtHLM.MetaRefExpression_in;
      result.element = getVariableRefExpression();
      result._set = this.applySubstitutionContext(type._set, indexContext);
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      let result = new FmtHLM.MetaRefExpression_equals;
      let left = getVariableRefExpression();
      let right = this.applySubstitutionContext(type.element, indexContext);
      result.terms = [left, right];
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      return type.formula;
    } else {
      return context.stepResults.get(param);
    }
  }

  getNextFormulas(formula: Fmt.Expression, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    let [variableRefExpression, indexContext] = this.extractVariableRefExpression(formula);
    if (variableRefExpression) {
      let type = variableRefExpression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_Prop) {
        return this.unfoldIndices(formula, HLMExpressionType.Formula, unfoldParameters);
      } else {
        return CachedPromise.reject(new Error('Formula variable expected'));
      }
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      if (!(unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases)) {
        return CachedPromise.resolve(undefined);
      }
      return this.getOuterDefinition(formula).then((definition: Fmt.Definition): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
          return this.unfoldDefinitionArguments(formula, [definition], HLMExpressionType.Formula, unfoldParameters);
        }
        return undefined;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      return this.unfoldStructuralCases(formula, HLMExpressionType.Formula, unfoldParameters)
        .then((currentResult: Fmt.Expression | undefined) => (currentResult ? [currentResult] : undefined));
    } else if (formula instanceof FmtHLM.MetaRefExpression_not) {
      return this.getNextFormulas(formula.formula, unfoldParameters).then((nextFormulas: Fmt.Expression[] | undefined) =>
        nextFormulas?.map((nextFormula: Fmt.Expression) => {
          let resultFormula = new FmtHLM.MetaRefExpression_not;
          resultFormula.formula = nextFormula;
          return resultFormula;
        }));
    } else if ((formula instanceof FmtHLM.MetaRefExpression_and || formula instanceof FmtHLM.MetaRefExpression_or || formula instanceof FmtHLM.MetaRefExpression_equiv) && formula.formulas) {
      let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
      formula.formulas.forEach((innerFormula: Fmt.Expression, index: number) => {
        result = this.concatExpressions(result, () =>
          this.getNextFormulas(innerFormula, unfoldParameters).then((nextInnerFormulas: Fmt.Expression[] | undefined) =>
            nextInnerFormulas?.map((nextInnerFormula: Fmt.Expression) => {
              let resultFormula = formula instanceof FmtHLM.MetaRefExpression_or ? new FmtHLM.MetaRefExpression_or : formula instanceof FmtHLM.MetaRefExpression_and ? new FmtHLM.MetaRefExpression_and : new FmtHLM.MetaRefExpression_equiv;
              resultFormula.formulas = formula.formulas!.map((originalInnerFormula: Fmt.Expression, currentIndex: number) => {
                if (currentIndex === index) {
                  return nextInnerFormula;
                } else {
                  return originalInnerFormula;
                }
              });
              return resultFormula;
            })));
      });
      return result;
    } else if ((formula instanceof FmtHLM.MetaRefExpression_forall || formula instanceof FmtHLM.MetaRefExpression_exists || formula instanceof FmtHLM.MetaRefExpression_existsUnique) && formula.formula) {
      return this.getNextFormulas(formula.formula, unfoldParameters).then((nextFormulas: Fmt.Expression[] | undefined) =>
        nextFormulas?.map((nextFormula: Fmt.Expression) => {
          let resultFormula = formula instanceof FmtHLM.MetaRefExpression_existsUnique ? new FmtHLM.MetaRefExpression_existsUnique : formula instanceof FmtHLM.MetaRefExpression_exists ? new FmtHLM.MetaRefExpression_exists : new FmtHLM.MetaRefExpression_forall;
          resultFormula.formula = nextFormula;
          return resultFormula;
        }));
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      let elementResult = this.getNextElementTerms(formula.element, unfoldParameters).then((nextElements: Fmt.Expression[] | undefined) =>
        nextElements?.map((nextElement: Fmt.Expression) => {
          let resultFormula = new FmtHLM.MetaRefExpression_in;
          resultFormula.element = nextElement;
          resultFormula._set = formula._set;
          return resultFormula;
        }));
      return this.concatExpressions(elementResult, () => this.getNextSetTerms(formula._set, unfoldParameters).then((nextSets: Fmt.Expression[] | undefined) =>
        nextSets?.map((nextSet: Fmt.Expression) => {
          let resultFormula = new FmtHLM.MetaRefExpression_in;
          resultFormula.element = formula.element;
          resultFormula._set = nextSet;
          return resultFormula;
        })));
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      let subsetResult = this.getNextSetTerms(formula.subset, unfoldParameters).then((nextSubsets: Fmt.Expression[] | undefined) =>
        nextSubsets?.map((nextSubset: Fmt.Expression) => {
          let resultFormula = new FmtHLM.MetaRefExpression_sub;
          resultFormula.subset = nextSubset;
          resultFormula.superset = formula.superset;
          return resultFormula;
        }));
      return this.concatExpressions(subsetResult, () => this.getNextSetTerms(formula.superset, unfoldParameters).then((nextSupersets: Fmt.Expression[] | undefined) =>
        nextSupersets?.map((nextSuperset: Fmt.Expression) => {
          let resultFormula = new FmtHLM.MetaRefExpression_sub;
          resultFormula.subset = formula.subset;
          resultFormula.superset = nextSuperset;
          return resultFormula;
        })));
    } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
      formula.terms.forEach((innerTerm: Fmt.Expression, index: number) => {
        result = this.concatExpressions(result, () =>
          this.getNextSetTerms(innerTerm, unfoldParameters).then((nextInnerTerms: Fmt.Expression[] | undefined) =>
            nextInnerTerms?.map((nextInnerTerm: Fmt.Expression) => {
              let resultFormula = new FmtHLM.MetaRefExpression_setEquals;
              resultFormula.terms = formula.terms!.map((originalInnerTerm: Fmt.Expression, currentIndex: number) => {
                if (currentIndex === index) {
                  return nextInnerTerm;
                } else {
                  return originalInnerTerm;
                }
              });
              return resultFormula;
            })));
      });
      return result;
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
      let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
      formula.terms.forEach((innerTerm: Fmt.Expression, index: number) => {
        result = this.concatExpressions(result, () =>
          this.getNextElementTerms(innerTerm, unfoldParameters).then((nextInnerTerms: Fmt.Expression[] | undefined) =>
            nextInnerTerms?.map((nextInnerTerm: Fmt.Expression) => {
              let resultFormula = new FmtHLM.MetaRefExpression_equals;
              resultFormula.terms = formula.terms!.map((originalInnerTerm: Fmt.Expression, currentIndex: number) => {
                if (currentIndex === index) {
                  return nextInnerTerm;
                } else {
                  return originalInnerTerm;
                }
              });
              return resultFormula;
            })));
      });
      return result;
    } else {
      return CachedPromise.resolve(undefined);
    }
  }

  getNextSetTerms(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression[] | undefined> {
    let [variableRefExpression, indexContext] = this.extractVariableRefExpression(term);
    if (variableRefExpression) {
      let type = variableRefExpression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_Set) {
        return this.unfoldIndices(term, HLMExpressionType.SetTerm, typeSearchParameters);
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        if (typeSearchParameters.followSupersets) {
          return CachedPromise.resolve([this.applySubstitutionContext(type.superset, indexContext)]);
        }
        return CachedPromise.resolve(undefined);
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
        if (typeSearchParameters.requiredUnfoldLocation && typeSearchParameters.requiredUnfoldLocation !== term) {
          return CachedPromise.resolve(undefined);
        }
        return CachedPromise.resolve([this.applySubstitutionContext(type._set, indexContext)]);
      } else {
        return CachedPromise.reject(new Error('Set variable expected'));
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      if (!(typeSearchParameters.followDefinitions || typeSearchParameters.unfoldArguments || typeSearchParameters.extractStructuralCases)) {
        return CachedPromise.resolve(undefined);
      }
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          if (typeSearchParameters.followEmbeddings && definition.contents.embedding) {
            let type = definition.contents.embedding.parameter.type;
            if (type instanceof FmtHLM.MetaRefExpression_Element) {
              return this.followSetTermWithPath(type._set, term.path, definition).then((superset: Fmt.Expression) => [superset]);
            } else {
              return CachedPromise.reject(new Error('Element parameter expected'));
            }
          } else {
            return this.unfoldDefinitionArguments(term, [definition], HLMExpressionType.SetTerm, typeSearchParameters);
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
          if (typeSearchParameters.followSupersets && !typeSearchParameters.followAllAlternatives) {
            let definitionList = definition.contents.definition;
            if (definitionList.length) {
              let item = definitionList[0];
              return this.followSetTermWithPath(item, term.path, definition).then((superset: Fmt.Expression) => [superset]);
            }
          } else {
            let result: Fmt.Expression[] | undefined = undefined;
            if (typeSearchParameters.followDefinitions && !(typeSearchParameters.requiredUnfoldLocation && typeSearchParameters.requiredUnfoldLocation !== term)) {
              result = definition.contents.definition.map((item: Fmt.Expression) => this.substitutePath(item, term.path, [definition]));
            }
            return this.unfoldDefinitionArguments(term, [definition], HLMExpressionType.SetTerm, typeSearchParameters).then((argumentResult: Fmt.Expression[] | undefined) =>
              (result && argumentResult ? result.concat(argumentResult) : result ?? argumentResult));
          }
        }
        return undefined;
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      let resultPromise = this.unfoldStructuralCases(term, HLMExpressionType.SetTerm, typeSearchParameters);
      if (typeSearchParameters.followSupersets) {
        for (let structuralCase of term.cases) {
          resultPromise = resultPromise.or(() => {
            if (typeSearchParameters.followSupersets) {
              // When following supersets, if we can get a result from any structural case, we use that.
              if (!this.referencesCaseParameter(structuralCase)) {
                return CachedPromise.resolve(structuralCase.value);
              }
              if (term.term instanceof Fmt.PlaceholderExpression && structuralCase.parameters) {
                let args = new Fmt.ArgumentList;
                let createPlaceholder = (placeholderType: HLMExpressionType) => {
                  let result = new Fmt.PlaceholderExpression(placeholderType);
                  result.isTemporary = true;
                  return result;
                };
                let createParameterList = (source: Fmt.ParameterList) => this.createParameterList(source, undefined);
                this.fillPlaceholderArguments(structuralCase.parameters, args, createPlaceholder, createParameterList);
                return this.substituteArguments(structuralCase.value, structuralCase.parameters, args);
              }
              return this.getNextPrimaryElementTerm(term.term, typeSearchParameters).then((nextTerm: Fmt.Expression | undefined) => {
                if (nextTerm) {
                  return this.buildSingleStructuralCaseTerm(nextTerm, term.construction, structuralCase._constructor, structuralCase.parameters, structuralCase.value, HLMExpressionType.SetTerm);
                } else {
                  return this.getNextPrimarySetTerm(structuralCase.value, typeSearchParameters).then((superset: Fmt.Expression | undefined) => {
                    if (superset || term.cases.length > 1 || structuralCase.rewrite) {
                      return this.buildSingleStructuralCaseTerm(term.term, term.construction, structuralCase._constructor, structuralCase.parameters, superset ?? structuralCase.value, HLMExpressionType.SetTerm);
                    } else {
                      return undefined;
                    }
                  });
                }
              });
            } else {
              return undefined;
            }
          });
        }
      }
      return resultPromise.then((currentResult: Fmt.Expression | undefined) => (currentResult ? [currentResult] : undefined));
    } else {
      if (typeSearchParameters.requiredUnfoldLocation && typeSearchParameters.requiredUnfoldLocation !== term) {
        return CachedPromise.resolve(undefined);
      }
      if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
        if (typeSearchParameters.followSupersets && term.terms && term.terms.length) {
          for (let element of term.terms) {
            if (!(element instanceof Fmt.PlaceholderExpression)) {
              return this.getDeclaredSet(element).then((declaredSet: Fmt.Expression) => [declaredSet]);
            }
          }
        }
        return CachedPromise.resolve(undefined);
      } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
        if (typeSearchParameters.followSupersets) {
          let type = term.parameter.type;
          if (type instanceof FmtHLM.MetaRefExpression_Element) {
            return CachedPromise.resolve([type._set]);
          } else {
            return CachedPromise.reject(new Error('Element parameter expected'));
          }
        }
        return CachedPromise.resolve(undefined);
      } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
        if (typeSearchParameters.followSupersets) {
          return this.getDeclaredSet(term.term).then((declaredSet: Fmt.Expression) => [declaredSet]);
        }
        return CachedPromise.resolve(undefined);
      } else if (term instanceof FmtHLM.MetaRefExpression_setAssociative) {
        return CachedPromise.resolve([term.term]);
      } else if (term instanceof Fmt.PlaceholderExpression) {
        return CachedPromise.resolve(undefined);
      } else {
        return CachedPromise.reject(new Error('Set term expected'));
      }
    }
  }

  private getNextPrimarySetTerm(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression | undefined> {
    return this.getNextSetTerms(term, typeSearchParameters).then((resultTerms: Fmt.Expression[] | undefined) => (resultTerms?.length ? resultTerms[0] : undefined));
  }

  getNextElementTerms(term: Fmt.Expression, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    let [variableRefExpression, indexContext] = this.extractVariableRefExpression(term);
    if (variableRefExpression) {
      let type = variableRefExpression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_Element) {
        return this.unfoldIndices(term, HLMExpressionType.ElementTerm, unfoldParameters);
      } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
        if (unfoldParameters.requiredUnfoldLocation && unfoldParameters.requiredUnfoldLocation !== term) {
          return CachedPromise.resolve(undefined);
        }
        return CachedPromise.resolve([this.applySubstitutionContext(type.element, indexContext)]);
      } else {
        return CachedPromise.reject(new Error('Element variable expected'));
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      if (!(unfoldParameters.followDefinitions || unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases)) {
        return CachedPromise.resolve(undefined);
      }
      if (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === term) {
        // TODO if any argument refers to a macro, ask that macro to unfold the whole term
      }
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          let innerDefinition = definition.innerDefinitions.getDefinition(term.path.name);
          return this.unfoldDefinitionArguments(term, [definition, innerDefinition], HLMExpressionType.ElementTerm, unfoldParameters);
        } else if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          let result: Fmt.Expression[] | undefined = undefined;
          if (unfoldParameters.followDefinitions && !(unfoldParameters.requiredUnfoldLocation && unfoldParameters.requiredUnfoldLocation !== term)) {
            result = definition.contents.definition.map((item: Fmt.Expression) => this.substitutePath(item, term.path, [definition]));
          }
          return this.unfoldDefinitionArguments(term, [definition], HLMExpressionType.ElementTerm, unfoldParameters).then((argumentResult: Fmt.Expression[] | undefined) =>
            (result && argumentResult ? result.concat(argumentResult) : result ?? argumentResult));
        } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          return this.unfoldDefinitionArguments(term, [definition], HLMExpressionType.ElementTerm, unfoldParameters);
        } else if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
          let macroInvocation = this.getMacroInvocation(term, definition);
          return macroInvocation.unfold();
        }
        return undefined;
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      return this.unfoldStructuralCases(term, HLMExpressionType.ElementTerm, unfoldParameters)
        .then((currentResult: Fmt.Expression | undefined) => (currentResult ? [currentResult] : undefined));
    } else {
      if (unfoldParameters.requiredUnfoldLocation && unfoldParameters.requiredUnfoldLocation !== term) {
        return CachedPromise.resolve(undefined);
      }
      if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
        return CachedPromise.resolve([term.term]);
      } else if (term instanceof FmtHLM.MetaRefExpression_associative) {
        return CachedPromise.resolve([term.term]);
      } else if (term instanceof Fmt.PlaceholderExpression) {
        return CachedPromise.resolve(undefined);
      } else {
        return CachedPromise.reject(new Error('Element term expected'));
      }
    }
  }

  private getNextPrimaryElementTerm(term: Fmt.Expression, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression | undefined> {
    return this.getNextElementTerms(term, unfoldParameters).then((resultTerms: Fmt.Expression[] | undefined) => (resultTerms?.length ? resultTerms[0] : undefined));
  }

  private unfoldIndices(expression: Fmt.Expression, expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    if (unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases) {
      for (let innerExpression: Fmt.Expression = expression, innerExpressionIndex = 0; innerExpression instanceof Fmt.IndexedExpression; innerExpression = innerExpression.body, innerExpressionIndex++) {
        if (innerExpression.parameters && innerExpression.arguments) {
          let curParameters = innerExpression.parameters;
          let curArguments = innerExpression.arguments;
          let curInnerExpressionIndex = innerExpressionIndex;
          result = this.concatExpressions(result, () => {
            let cloneExpression = (): ClonedExpressionInfo => {
              let clonedExpression = expression.clone();
              let clonedInnerExpression = clonedExpression as Fmt.IndexedExpression;
              for (let i = 0; i < curInnerExpressionIndex; i++) {
                clonedInnerExpression = clonedInnerExpression.body as Fmt.IndexedExpression;
              }
              return {
                clonedExpression: clonedExpression,
                expressionType: expressionType,
                args: clonedInnerExpression.arguments!
              };
            };
            return this.unfoldArguments(curParameters, curArguments, unfoldParameters, cloneExpression);
          });
        }
      }
    }
    return result;
  }

  private unfoldDefinitionArguments(expression: Fmt.DefinitionRefExpression, definitions: Fmt.Definition[], expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters, startDefinitionIndex: number = 0): CachedPromise<Fmt.Expression[] | undefined> {
    let cloneExpression = (): ClonedExpressionInfo => {
      let clonedExpression = expression.clone() as Fmt.DefinitionRefExpression;
      let clonedPath = clonedExpression.path;
      for (let definitionIndex = startDefinitionIndex + 1; definitionIndex < definitions.length; definitionIndex++) {
        clonedPath = clonedPath.parentPath as Fmt.Path;
      }
      return {
        clonedExpression: clonedExpression,
        expressionType: expressionType,
        args: clonedPath.arguments
      };
    };
    let path = expression.path;
    for (let definitionIndex = startDefinitionIndex + 1; definitionIndex < definitions.length; definitionIndex++) {
      path = path.parentPath as Fmt.Path;
    }
    let result = this.unfoldArguments(definitions[startDefinitionIndex].parameters, path.arguments, unfoldParameters, cloneExpression);
    if (startDefinitionIndex < definitions.length - 1) {
      result = this.concatExpressions(result, () => this.unfoldDefinitionArguments(expression, definitions, expressionType, unfoldParameters, startDefinitionIndex + 1));
    }
    return result;
  }

  private unfoldArguments(parameters: Fmt.ParameterList, args: Fmt.ArgumentList, unfoldParameters: HLMUnfoldParameters, cloneExpression: () => ClonedExpressionInfo): CachedPromise<Fmt.Expression[] | undefined> {
    let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    if (unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases) {
      for (let param of parameters) {
        let type = param.type;
        // TODO also unfold arguments inside binders
        if (type instanceof FmtHLM.MetaRefExpression_Prop) {
          result = this.concatExpressions(result, () => {
            let argValue = this.getArgValue(args, param);
            if (argValue) {
              if (unfoldParameters.extractStructuralCases && argValue instanceof FmtHLM.MetaRefExpression_structural && argValue.cases.length === 1) {
                let structuralCase = argValue.cases[0];
                let clonedExpressionInfo = cloneExpression();
                this.replacePropArgValue(clonedExpressionInfo.args, param, structuralCase.value);
                return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, clonedExpressionInfo.clonedExpression, clonedExpressionInfo.expressionType)];
              } else {
                return this.getNextFormulas(argValue, unfoldParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                  if (newArgValues) {
                    return newArgValues.map((newArgValue: Fmt.Expression) => {
                      let clonedExpressionInfo = cloneExpression();
                      this.replacePropArgValue(clonedExpressionInfo.args, param, newArgValue);
                      return clonedExpressionInfo.clonedExpression;
                    });
                  } else {
                    return undefined;
                  }
                });
              }
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) {
          let embedSubsets = type.embedSubsets instanceof FmtHLM.MetaRefExpression_true;
          result = this.concatExpressions(result, () => {
            let argValue = this.getArgValue(args, param);
            if (argValue) {
              if (unfoldParameters.extractStructuralCases && argValue instanceof FmtHLM.MetaRefExpression_setStructuralCases && argValue.cases.length === 1) {
                let structuralCase = argValue.cases[0];
                let clonedExpressionInfo = cloneExpression();
                this.replaceSetArgValue(clonedExpressionInfo.args, param, structuralCase.value);
                return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, clonedExpressionInfo.clonedExpression, clonedExpressionInfo.expressionType)];
              } else {
                let innerSearchParameters: HLMTypeSearchParameters = {
                  ...unfoldParameters,
                  followSupersets: embedSubsets,
                  followEmbeddings: embedSubsets
                };
                return this.getNextSetTerms(argValue, innerSearchParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                  if (newArgValues) {
                    return newArgValues.map((newArgValue: Fmt.Expression) => {
                      let clonedExpressionInfo = cloneExpression();
                      this.replaceSetArgValue(clonedExpressionInfo.args, param, newArgValue);
                      return clonedExpressionInfo.clonedExpression;
                    });
                  } else {
                    return undefined;
                  }
                });
              }
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
          result = this.concatExpressions(result, () => {
            let argValue = this.getArgValue(args, param);
            if (argValue) {
              if (unfoldParameters.extractStructuralCases && argValue instanceof FmtHLM.MetaRefExpression_structuralCases && argValue.cases.length === 1) {
                let structuralCase = argValue.cases[0];
                let clonedExpressionInfo = cloneExpression();
                this.replaceElementArgValue(clonedExpressionInfo.args, param, structuralCase.value);
                return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, clonedExpressionInfo.clonedExpression, clonedExpressionInfo.expressionType)];
              } else {
                return this.getNextElementTerms(argValue, unfoldParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                  if (newArgValues) {
                    return newArgValues.map((newArgValue: Fmt.Expression) => {
                      let clonedExpressionInfo = cloneExpression();
                      this.replaceElementArgValue(clonedExpressionInfo.args, param, newArgValue);
                      return clonedExpressionInfo.clonedExpression;
                    });
                  } else {
                    return undefined;
                  }
                });
              }
            } else {
              return undefined;
            }
          });
        }
      }
    }
    return result;
  }

  private replacePropArgValue(args: Fmt.ArgumentList, param: Fmt.Parameter, newValue: Fmt.Expression): void {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      let newArg = new FmtHLM.ObjectContents_PropArg;
      newArg.formula = newValue;
      this.replaceArgValue(args, param, newArg);
    }
  }

  private replaceSetArgValue(args: Fmt.ArgumentList, param: Fmt.Parameter, newValue: Fmt.Expression): void {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Set) {
      let newArg = new FmtHLM.ObjectContents_SetArg;
      newArg._set = newValue;
      this.replaceArgValue(args, param, newArg);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      let newArg = new FmtHLM.ObjectContents_SubsetArg;
      newArg._set = newValue;
      this.replaceArgValue(args, param, newArg);
    }
  }

  private replaceElementArgValue(args: Fmt.ArgumentList, param: Fmt.Parameter, newValue: Fmt.Expression): void {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Element) {
      let newArg = new FmtHLM.ObjectContents_ElementArg;
      newArg.element = newValue;
      this.replaceArgValue(args, param, newArg);
    }
  }

  private replaceArgValue(args: Fmt.ArgumentList, param: Fmt.Parameter, newArg: Fmt.ObjectContents): void {
    for (let arg of args) {
      if (arg.name === param.name) {
        arg.value = newArg.toExpression(false);
      }
    }
  }

  private unfoldStructuralCases(expression: FmtHLM.MetaRefExpression_structural | FmtHLM.MetaRefExpression_setStructuralCases | FmtHLM.MetaRefExpression_structuralCases, expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression | undefined> {
    if (unfoldParameters.extractStructuralCases) {
      if (expression.cases.length === 1) {
        let structuralCase = expression.cases[0];
        let currentStructuralCase = structuralCase;
        let innerTerm = currentStructuralCase.value;
        while ((innerTerm instanceof FmtHLM.MetaRefExpression_structural || innerTerm instanceof FmtHLM.MetaRefExpression_setStructuralCases || innerTerm instanceof FmtHLM.MetaRefExpression_structuralCases)
                && innerTerm.cases.length === 1) {
          let innerStructuralCase = innerTerm.cases[0];
          if ((!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === innerTerm)
              && expression.term.isEquivalentTo(innerTerm.term)) {
            let newInnerValue = innerStructuralCase.parameters && structuralCase.parameters ? this.substituteParameters(innerStructuralCase.value, innerStructuralCase.parameters, structuralCase.parameters) : innerStructuralCase.value;
            return CachedPromise.resolve(FmtUtils.substituteExpression(expression, innerTerm, newInnerValue));
          }
          currentStructuralCase = innerStructuralCase;
          innerTerm = innerStructuralCase.value;
        }
      }

      if ((!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === expression.term)
          && expression.term instanceof FmtHLM.MetaRefExpression_structuralCases
          && expression.term.cases.length === 1) {
        let innerStructuralCase = expression.term.cases[0];
        let innerResultTerm = this.buildStructuralCaseTerm(innerStructuralCase.value, expression.construction, expression.cases, expressionType);
        return CachedPromise.resolve(this.buildSingleStructuralCaseTerm(expression.term.term, expression.term.construction, innerStructuralCase._constructor, innerStructuralCase.parameters, innerResultTerm, expressionType));
      }
    }

    if (unfoldParameters.substituteStructuralCases
        && (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === expression)
        && expression.term instanceof Fmt.DefinitionRefExpression
        && expression.term.path.parentPath instanceof Fmt.Path
        && expression.construction instanceof Fmt.DefinitionRefExpression
        && expression.term.path.parentPath.isEquivalentTo(expression.construction.path)) {
      for (let structuralCase of expression.cases) {
        if (structuralCase._constructor instanceof Fmt.DefinitionRefExpression
            && structuralCase._constructor.path.parentPath instanceof Fmt.Path
            && expression.term.path.name === structuralCase._constructor.path.name) {
          let constructorPath = expression.term.path;
          return this.getOuterDefinition(structuralCase._constructor).then((definition: Fmt.Definition) => {
            let innerDefinition = definition.innerDefinitions.getDefinition(constructorPath.name);
            let substituted = structuralCase.parameters ? this.substituteParameters(structuralCase.value, structuralCase.parameters, innerDefinition.parameters) : structuralCase.value;
            return this.substituteArguments(substituted, innerDefinition.parameters, constructorPath.arguments);
          });
        }
      }
    }

    if (unfoldParameters.requiredUnfoldLocation === expression) {
      unfoldParameters = {
        ...unfoldParameters,
        requiredUnfoldLocation: undefined
      };
    }
    return this.getNextPrimaryElementTerm(expression.term, unfoldParameters).then((nextTerm: Fmt.Expression | undefined) => {
      if (nextTerm) {
        return this.buildStructuralCaseTerm(nextTerm, expression.construction, expression.cases, expressionType);
      } else {
        return undefined;
      }
    });
  }

  private concatExpressions(expressionsPromise: CachedPromise<Fmt.Expression[] | undefined>, fn: () => Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined>): CachedPromise<Fmt.Expression[] | undefined> {
    return expressionsPromise.then((expressions: Fmt.Expression[] | undefined) => {
      if (expressions) {
        return CachedPromise.resolve()
          .then(fn)
          .then((newExpressions: Fmt.Expression[] | undefined) => (newExpressions ? expressions.concat(newExpressions) : expressions));
      } else {
        return fn();
      }
    });
  }

  getFinalSuperset(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression> {
    return this.getFinalSupersetInternal(term, typeSearchParameters, []);
  }

  private getFinalSupersetInternal(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters, visitedDefinitions: Fmt.DefinitionRefExpression[]): CachedPromise<Fmt.Expression> {
    if (term instanceof Fmt.DefinitionRefExpression) {
      for (let visitedDefinition of visitedDefinitions) {
        if (term.isEquivalentTo(visitedDefinition)) {
          return CachedPromise.reject(new Error('Invalid circular reference'));
        }
      }
      visitedDefinitions.push(term);
    }
    return this.getNextPrimarySetTerm(term, typeSearchParameters).then((next: Fmt.Expression | undefined) => {
      if (next) {
        return this.getFinalSupersetInternal(next, typeSearchParameters, visitedDefinitions);
      } else {
        return term;
      }
    });
  }

  getDeclaredSet(term: Fmt.Expression): CachedPromise<Fmt.Expression> {
    return this.getDeclaredSetInternal(term, []);
  }

  private getDeclaredSetInternal(term: Fmt.Expression, visitedDefinitions: Fmt.DefinitionRefExpression[]): CachedPromise<Fmt.Expression> {
    for (;;) {
      let [variableRefExpression, indexContext] = this.extractVariableRefExpression(term);
      if (variableRefExpression) {
        let type = variableRefExpression.variable.type;
        if (type instanceof FmtHLM.MetaRefExpression_Element) {
          return CachedPromise.resolve(this.applySubstitutionContext(type._set, indexContext));
        } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
          term = this.applySubstitutionContext(type.element, indexContext);
        } else {
          return CachedPromise.reject(new Error('Element variable expected'));
        }
      } else if (term instanceof Fmt.DefinitionRefExpression) {
        if (term.path.parentPath instanceof Fmt.Path) {
          let constructionTerm = new Fmt.DefinitionRefExpression(term.path.parentPath);
          return CachedPromise.resolve(constructionTerm);
        } else {
          for (let visitedDefinition of visitedDefinitions) {
            if (term.isEquivalentTo(visitedDefinition)) {
              return CachedPromise.reject(new Error('Invalid circular reference'));
            }
          }
          visitedDefinitions.push(term);
          let definitionRefExpression = term;
          return this.getOuterDefinition(term).then((definition: Fmt.Definition) => {
            if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
              if (definition.contents.definition.length) {
                let item = definition.contents.definition[0];
                return this.getFinalSetWithPath(item, definitionRefExpression.path, definition);
              } else {
                return this.getWildcardFinalSet();
              }
            } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
              let type = definition.contents.parameter.type;
              if (type instanceof FmtHLM.MetaRefExpression_Element) {
                return this.followSetTermWithPath(type._set, definitionRefExpression.path, definition);
              } else {
                return CachedPromise.reject(new Error('Element parameter expected'));
              }
            } else if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
              let macroInvocation = this.getMacroInvocation(definitionRefExpression, definition);
              return macroInvocation.getDeclaredSet();
            } else {
              return CachedPromise.reject(new Error('Referenced definition must be a constructor or operator'));
            }
          });
        }
      } else if (term instanceof FmtHLM.MetaRefExpression_cases) {
        if (term.cases.length) {
          term = term.cases[0].value;
        } else {
          return CachedPromise.resolve(this.getWildcardFinalSet());
        }
      } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
        if (term.cases.length) {
          let structuralCase = term.cases[0];
          if (this.referencesCaseParameter(structuralCase)) {
            let structuralCasesTerm = term;
            return this.getDeclaredSet(structuralCase.value).then((declaredSet: Fmt.Expression) => {
              return this.buildSingleStructuralCaseTerm(structuralCasesTerm.term, structuralCasesTerm.construction, structuralCase._constructor, structuralCase.parameters, declaredSet, HLMExpressionType.SetTerm);
            });
          } else {
            term = structuralCase.value;
          }
        } else {
          return CachedPromise.resolve(this.getWildcardFinalSet());
        }
      } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
        return CachedPromise.resolve(term._set);
      } else if (term instanceof FmtHLM.MetaRefExpression_associative) {
        term = term.term;
      } else if (term instanceof Fmt.PlaceholderExpression) {
        let result = new FmtHLM.MetaRefExpression_enumeration;
        result.terms = [term];
        return CachedPromise.resolve(result);
      } else {
        return CachedPromise.reject(new Error('Element term expected'));
      }
    }
  }

  getFinalSet(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression> {
    return this.getFinalSetInternal(term, typeSearchParameters, []);
  }

  private getFinalSetInternal(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters, visitedDefinitions: Fmt.DefinitionRefExpression[]): CachedPromise<Fmt.Expression> {
    return this.getDeclaredSetInternal(term, visitedDefinitions).then((set: Fmt.Expression) => this.getFinalSupersetInternal(set, typeSearchParameters, visitedDefinitions));
  }

  private getTargetUtils(path: Fmt.Path, definition: Fmt.Definition): HLMUtils {
    let libraryDataAccessor = this.libraryDataAccessor.getAccessorForSection(path.parentPath);
    return new HLMUtils(definition, libraryDataAccessor, this.supportPlaceholders);
  }

  private followSetTermWithPath(term: Fmt.Expression, path: Fmt.Path, definition: Fmt.Definition): CachedPromise<Fmt.Expression> {
    let targetUtils = this.getTargetUtils(path, definition);
    return targetUtils.getFinalSuperset(term, eliminateVariablesOnly)
      .then((finalSet: Fmt.Expression) => this.substitutePath(finalSet, path, [definition]));
  }

  private getFinalSetWithPath(term: Fmt.Expression, path: Fmt.Path, definition: Fmt.Definition): CachedPromise<Fmt.Expression> {
    let targetUtils = this.getTargetUtils(path, definition);
    return targetUtils.getFinalSet(term, eliminateVariablesOnly)
      .then((finalSet: Fmt.Expression) => this.substitutePath(finalSet, path, [definition]));
  }

  getWildcardFinalSet(): Fmt.Expression {
    return new FmtHLM.MetaRefExpression_enumeration;
  }

  isWildcardFinalSet(term: Fmt.Expression): boolean {
    return term instanceof FmtHLM.MetaRefExpression_enumeration && !term.terms;
  }

  buildStructuralCaseTerm(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], expressionType: HLMExpressionType): Fmt.Expression {
    let result = expressionType === HLMExpressionType.SetTerm ? new FmtHLM.MetaRefExpression_setStructuralCases : expressionType === HLMExpressionType.ElementTerm ? new FmtHLM.MetaRefExpression_structuralCases : new FmtHLM.MetaRefExpression_structural;
    result.term = term;
    result.construction = construction;
    result.cases = cases;
    return result;
  }

  buildSingleStructuralCaseTerm(term: Fmt.Expression, construction: Fmt.Expression, constructor: Fmt.Expression, parameters: Fmt.ParameterList | undefined, value: Fmt.Expression, expressionType: HLMExpressionType): Fmt.Expression {
    let structuralCase = new FmtHLM.ObjectContents_StructuralCase;
    structuralCase._constructor = constructor;
    structuralCase.parameters = parameters;
    structuralCase.value = value;
    return this.buildStructuralCaseTerm(term, construction, [structuralCase], expressionType);
  }

  unfoldsTo(source: Fmt.Expression, target: Fmt.Expression): CachedPromise<boolean> {
    // This code to determine requiredUnfoldLocation relies on the order in which findDifferenceFn is called by Fmt.Expression.isEquivalentTo.
    // Since findDifferenceFn will only be called for pairs of subexpressions that are different, and inner expressions are traversed first,
    // requiredUnfoldLocation will be set to one of the outermost differences.
    let requiredUnfoldLocation: Fmt.Expression | undefined = undefined;
    let findDifferenceFn = (subExpression: Fmt.Expression) => {
      requiredUnfoldLocation = subExpression;
      return true;
    };
    source.isEquivalentTo(target, findDifferenceFn);

    if (!requiredUnfoldLocation) {
      return CachedPromise.resolve(true);
    } else if (!this.canUnfoldAt(requiredUnfoldLocation, source)) {
      return CachedPromise.resolve(false);
    }

    let unfoldParameters: HLMUnfoldParameters = {
      followDefinitions: true,
      unfoldArguments: true,
      substituteStructuralCases: true,
      extractStructuralCases: true,
      requiredUnfoldLocation: requiredUnfoldLocation
    };
    return this.getNextFormulas(source, unfoldParameters).then((formulas: Fmt.Expression[] | undefined) => {
      let result = CachedPromise.resolve(false);
      if (formulas) {
        for (let formula of formulas) {
          result = result.or(() => this.unfoldsTo(formula, target));
        }
      }
      return result;
    });
  }

  private canUnfoldAt(expression: Fmt.Expression, source: Fmt.Expression): boolean {
    if (expression instanceof Fmt.VariableRefExpression) {
      let type = expression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
        return true;
      }
    }
    if (expression !== source && expression instanceof Fmt.DefinitionRefExpression) {
      return true;
    }
    if (expression instanceof FmtHLM.MetaRefExpression_structural || expression instanceof FmtHLM.MetaRefExpression_setStructuralCases || expression instanceof FmtHLM.MetaRefExpression_structuralCases) {
      return true;
    }
    return false;
  }

  substitutesTo(input: Fmt.Expression, output: Fmt.Expression, source: Fmt.Expression, targets: Fmt.Expression[]): boolean {
    let unificationFn = (left: Fmt.Expression, right: Fmt.Expression) => {
      if (this.areExpressionsSyntacticallyEquivalent(left, source)) {
        for (let target of targets) {
          if (this.areExpressionsSyntacticallyEquivalent(right, target)) {
            return true;
          }
        }
      }
      return false;
    };
    return input.isEquivalentTo(output, unificationFn);
  }

  negateFormula(formula: Fmt.Expression, followDefinitions: boolean): CachedPromise<Fmt.Expression> {
    if (formula instanceof FmtHLM.MetaRefExpression_not) {
      return CachedPromise.resolve(formula.formula);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and) {
      return this.negateFormulas(formula.formulas, followDefinitions).then((negatedFormulas: Fmt.Expression[] | undefined) => {
        let result = new FmtHLM.MetaRefExpression_or;
        result.formulas = negatedFormulas;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      return this.negateFormulas(formula.formulas, followDefinitions).then((negatedFormulas: Fmt.Expression[] | undefined) => {
        let result = new FmtHLM.MetaRefExpression_and;
        result.formulas = negatedFormulas;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      return this.negateFormula(formula.formula, followDefinitions).then((negatedFormula: Fmt.Expression) => {
        let result = new FmtHLM.MetaRefExpression_exists;
        result.parameters = formula.parameters;
        result.formula = negatedFormula;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_exists && formula.formula) {
      return this.negateFormula(formula.formula, followDefinitions).then((negatedFormula: Fmt.Expression) => {
        let result = new FmtHLM.MetaRefExpression_forall;
        result.parameters = formula.parameters;
        result.formula = negatedFormula;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      let resultCases: CachedPromise<FmtHLM.ObjectContents_StructuralCase[]> = CachedPromise.resolve([]);
      for (let structuralCase of formula.cases) {
        resultCases = resultCases.then((negatedCases: FmtHLM.ObjectContents_StructuralCase[]) =>
          this.negateFormula(structuralCase.value, followDefinitions).then((negatedFormula: Fmt.Expression) => {
            let resultCase = new FmtHLM.ObjectContents_StructuralCase;
            resultCase._constructor = structuralCase._constructor;
            resultCase.parameters = structuralCase.parameters;
            resultCase.value = negatedFormula;
            resultCase.rewrite = structuralCase.rewrite;
            return negatedCases.concat(resultCase);
          })
        );
      }
      return resultCases.then((cases: FmtHLM.ObjectContents_StructuralCase[]) => {
        let result = new FmtHLM.MetaRefExpression_structural;
        result.term = formula.term;
        result.construction = formula.construction;
        result.cases = cases;
        return CachedPromise.resolve(result);
      });
    } else if (formula instanceof Fmt.DefinitionRefExpression && !(formula.path.parentPath instanceof Fmt.Path) && followDefinitions) {
      return this.getDefinition(formula.path).then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate && definition.contents.properties) {
          let negationArg = definition.contents.properties.getOptionalValue('negation');
          if (negationArg) {
            return this.substitutePath(negationArg, formula.path, [definition]);
          }
        }
        let result = new FmtHLM.MetaRefExpression_not;
        result.formula = formula;
        return result;
      });
    } else {
      let result = new FmtHLM.MetaRefExpression_not;
      result.formula = formula;
      return CachedPromise.resolve(result);
    }
  }

  negateFormulas(formulas: Fmt.Expression[] | undefined, followDefinitions: boolean): CachedPromise<Fmt.Expression[] | undefined> {
    if (formulas) {
      let result: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
      for (let formula of formulas) {
        result = result.then((negatedFormulas: Fmt.Expression[]) =>
          this.negateFormula(formula, followDefinitions).then((negatedFormula: Fmt.Expression) =>
            negatedFormulas.concat(negatedFormula)
          )
        );
      }
      return result;
    } else {
      return CachedPromise.resolve(undefined);
    }
  }

  isTrivialTautology(formula: Fmt.Expression, followDefinitions: boolean): CachedPromise<boolean> {
    if (formula instanceof FmtHLM.MetaRefExpression_and) {
      let resultPromise = CachedPromise.resolve(true);
      if (formula.formulas) {
        for (let item of formula.formulas) {
          resultPromise = resultPromise.and(() => this.isTrivialTautology(item, followDefinitions));
        }
      }
      return resultPromise;
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      let resultPromise = CachedPromise.resolve(false);
      if (formula.formulas) {
        let formulas = formula.formulas;
        for (let item of formulas) {
          resultPromise = resultPromise.or(() => this.isTrivialTautology(item, followDefinitions));
          if (item !== formulas[0]) {
            resultPromise = resultPromise.or(() => {
              return this.negateFormula(item, followDefinitions).then((negatedItem: Fmt.Expression) => {
                for (let previousItem of formulas) {
                  if (previousItem === item) {
                    break;
                  }
                  if (this.areExpressionsSyntacticallyEquivalent(negatedItem, previousItem)) {
                    return true;
                  }
                  if (previousItem instanceof FmtHLM.MetaRefExpression_not && this.areExpressionsSyntacticallyEquivalent(item, formula)) {
                    return true;
                  }
                }
                return false;
              });
            });
          }
        }
      }
      return resultPromise;
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      for (let index = 0; index + 1 < formula.formulas.length; index++) {
        if (!this.areExpressionsSyntacticallyEquivalent(formula.formulas[index], formula.formulas[formula.formulas.length - 1])) {
          return CachedPromise.resolve(false);
        }
      }
      return CachedPromise.resolve(true);
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      return this.isTrivialTautology(formula.formula, followDefinitions);
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      if (formula._set instanceof FmtHLM.MetaRefExpression_enumeration && formula._set.terms) {
        for (let term of formula._set.terms) {
          if (this.areExpressionsSyntacticallyEquivalent(formula.element, term)) {
            return CachedPromise.resolve(true);
          }
        }
      }
      if (followDefinitions) {
        return this.getDeclaredSet(formula.element).then((declaredSet: Fmt.Expression) => this.isDeclaredSubsetOf(declaredSet, formula._set));
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      if (followDefinitions) {
        return this.isDeclaredSubsetOf(formula.subset, formula.superset);
      } else if (this.areExpressionsSyntacticallyEquivalent(formula.subset, formula.superset)) {
        return CachedPromise.resolve(true);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals || formula instanceof FmtHLM.MetaRefExpression_equals) {
      for (let index = 0; index + 1 < formula.terms.length; index++) {
        if (!this.areExpressionsSyntacticallyEquivalent(formula.terms[index], formula.terms[formula.terms.length - 1])) {
          return CachedPromise.resolve(false);
        }
      }
      return CachedPromise.resolve(true);
    }
    return CachedPromise.resolve(false);
  }

  isTrivialContradiction(formula: Fmt.Expression, followDefinitions: boolean): CachedPromise<boolean> {
    return this.negateFormula(formula, followDefinitions).then((negatedFormula: Fmt.Expression) => this.isTrivialTautology(negatedFormula, followDefinitions));
  }

  private isDeclaredSubsetOf(subset: Fmt.Expression, superset: Fmt.Expression): CachedPromise<boolean> {
    return this.isExplicitlyDeclaredSubsetOf(subset, superset)
      .or(() => {
        let supersetSearchParameters: HLMTypeSearchParameters = {
          followDefinitions: true,
          followSupersets: false,
          followEmbeddings: true,
          followAllAlternatives: true,
          unfoldArguments: false,
          substituteStructuralCases: false,
          extractStructuralCases: false
        };
        return this.getNextSetTerms(superset, supersetSearchParameters).then((nextSupersets: Fmt.Expression[] | undefined) => {
          let result = CachedPromise.resolve(false);
          if (nextSupersets) {
            for (let nextSuperset of nextSupersets) {
              result = result.or(() => this.isDeclaredSubsetOf(subset, nextSuperset));
            }
          }
          return result;
        });
      });
  }

  private isExplicitlyDeclaredSubsetOf(subset: Fmt.Expression, superset: Fmt.Expression): CachedPromise<boolean> {
    if (this.areExpressionsSyntacticallyEquivalent(subset, superset)) {
      return CachedPromise.resolve(true);
    } else {
      let subsetSearchParameters: HLMTypeSearchParameters = {
        followDefinitions: true,
        followSupersets: true,
        followEmbeddings: false,
        followAllAlternatives: true,
        unfoldArguments: false,
        substituteStructuralCases: false,
        extractStructuralCases: false
      };
      return this.getNextSetTerms(subset, subsetSearchParameters).then((nextSubsets: Fmt.Expression[] | undefined) => {
        let result = CachedPromise.resolve(false);
        if (nextSubsets) {
          for (let nextSubset of nextSubsets) {
            result = result.or(() => this.isExplicitlyDeclaredSubsetOf(nextSubset, superset));
          }
        }
        return result;
      });
    }
  };

  triviallyImplies(sourceFormula: Fmt.Expression, targetFormula: Fmt.Expression, followDefinitions: boolean): CachedPromise<boolean> {
    if (this.areExpressionsSyntacticallyEquivalent(sourceFormula, targetFormula)) {
      return CachedPromise.resolve(true);
    }
    if (sourceFormula instanceof FmtHLM.MetaRefExpression_or) {
      let innerResultPromise = CachedPromise.resolve(true);
      if (sourceFormula.formulas) {
        for (let item of sourceFormula.formulas) {
          innerResultPromise = innerResultPromise.and(() => this.triviallyImplies(item, targetFormula, followDefinitions));
        }
      }
      return innerResultPromise;
    }
    if (targetFormula instanceof FmtHLM.MetaRefExpression_and) {
      let innerResultPromise = CachedPromise.resolve(true);
      if (targetFormula.formulas) {
        for (let item of targetFormula.formulas) {
          innerResultPromise = innerResultPromise.and(() => this.triviallyImplies(sourceFormula, item, followDefinitions));
        }
      }
      return innerResultPromise;
    }
    if ((sourceFormula instanceof FmtHLM.MetaRefExpression_exists || sourceFormula instanceof FmtHLM.MetaRefExpression_existsUnique)
        && targetFormula instanceof FmtHLM.MetaRefExpression_exists) {
      let replacedParameters: Fmt.ReplacedParameter[] = [];
      if (sourceFormula.parameters.isEquivalentTo(targetFormula.parameters, undefined, replacedParameters)
          && (!targetFormula.formula || sourceFormula.formula?.isEquivalentTo(targetFormula.formula, undefined, replacedParameters))) {
        return CachedPromise.resolve(true);
      }
    }
    let resultPromise = this.isTrivialContradiction(sourceFormula, followDefinitions)
      .or(() => this.isTrivialTautology(targetFormula, followDefinitions));
    if (followDefinitions) {
      resultPromise = resultPromise
        .or(() => this.unfoldsTo(sourceFormula, targetFormula))
        .or(() => this.unfoldsTo(targetFormula, sourceFormula));
    }
    if (sourceFormula instanceof FmtHLM.MetaRefExpression_and) {
      if (sourceFormula.formulas) {
        for (let item of sourceFormula.formulas) {
          resultPromise = resultPromise.or(() => this.triviallyImplies(item, targetFormula, followDefinitions));
        }
      }
    } else if (targetFormula instanceof FmtHLM.MetaRefExpression_or) {
      if (targetFormula.formulas) {
        for (let item of targetFormula.formulas) {
          resultPromise = resultPromise.or(() => this.triviallyImplies(sourceFormula, item, followDefinitions));
        }
      }
    }
    if (followDefinitions) {
      if (sourceFormula instanceof Fmt.DefinitionRefExpression && !(sourceFormula.path.parentPath instanceof Fmt.Path)) {
        resultPromise = resultPromise.or(() =>
          this.getDefinition(sourceFormula.path).then((definition: Fmt.Definition) => {
            let innerResultPromise = CachedPromise.resolve(false);
            if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
              for (let definitionFormula of definition.contents.definition) {
                innerResultPromise = innerResultPromise.or(() => {
                  let substitutedDefinitionFormula = this.substitutePath(definitionFormula, sourceFormula.path, [definition]);
                  return this.triviallyImplies(substitutedDefinitionFormula, targetFormula, false);
                });
              }
            }
            return innerResultPromise;
          }));
      }
      if (targetFormula instanceof Fmt.DefinitionRefExpression && !(targetFormula.path.parentPath instanceof Fmt.Path)) {
        resultPromise = resultPromise.or(() =>
          this.getDefinition(targetFormula.path).then((definition: Fmt.Definition) => {
            let innerResultPromise = CachedPromise.resolve(false);
            if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
              for (let definitionFormula of definition.contents.definition) {
                innerResultPromise = innerResultPromise.or(() => {
                  let substitutedDefinitionFormula = this.substitutePath(definitionFormula, targetFormula.path, [definition]);
                  return this.triviallyImplies(sourceFormula, substitutedDefinitionFormula, false);
                });
              }
            }
            return innerResultPromise;
          }));
      }
    }
    return resultPromise;
  }

  // TODO when checking expressions for equality, ignore certain aspects:
  // * existence of constraint arguments
  // * proofs in arguments
  // * different variants of associative expressions
  private areExpressionsSyntacticallyEquivalent(left: Fmt.Expression, right: Fmt.Expression): boolean {
    let fn = (leftPart: Fmt.Expression, rightPart: Fmt.Expression) => {
      if ((leftPart instanceof FmtHLM.MetaRefExpression_setAssociative || leftPart instanceof FmtHLM.MetaRefExpression_associative)
          && !(rightPart instanceof FmtHLM.MetaRefExpression_setAssociative || rightPart instanceof FmtHLM.MetaRefExpression_associative)) {
        if (this.areExpressionsSyntacticallyEquivalent(leftPart.term, rightPart)) {
          return true;
        }
      } else if ((rightPart instanceof FmtHLM.MetaRefExpression_setAssociative || rightPart instanceof FmtHLM.MetaRefExpression_associative)
                 && !(leftPart instanceof FmtHLM.MetaRefExpression_setAssociative || leftPart instanceof FmtHLM.MetaRefExpression_associative)) {
        if (this.areExpressionsSyntacticallyEquivalent(leftPart, rightPart.term)) {
          return true;
        }
      } else if (((leftPart instanceof FmtHLM.MetaRefExpression_setEquals && rightPart instanceof FmtHLM.MetaRefExpression_setEquals)
           || (leftPart instanceof FmtHLM.MetaRefExpression_equals && rightPart instanceof FmtHLM.MetaRefExpression_equals))
          && leftPart.terms.length === rightPart.terms.length) {
        let leftTerms = [...leftPart.terms];
        let rightTerms = [...rightPart.terms];
        for (let leftTerm of leftTerms) {
          let found = false;
          for (let rightIndex = 0; rightIndex < rightTerms.length; rightIndex++) {
            if (this.areExpressionsSyntacticallyEquivalent(leftTerm, rightTerms[rightIndex])) {
              found = true;
              rightTerms.splice(rightIndex, 1);
              break;
            }
          }
          if (!found) {
            return false;
          }
        }
        return true;
      }
      return false;
    };
    return left.isEquivalentTo(right, fn);
  }

  getFormulaDefinitions(formula: Fmt.Expression, side: number | undefined): CachedPromise<HLMFormulaDefinition[]> | undefined {
    if (formula instanceof FmtHLM.MetaRefExpression_not) {
      let negationDefinitionsPromise = this.getFormulaDefinitions(formula.formula, side);
      if (negationDefinitionsPromise) {
        return negationDefinitionsPromise.then((negationDefinitions: HLMFormulaDefinition[]) => {
          let result: CachedPromise<HLMFormulaDefinition[]> = CachedPromise.resolve([]);
          for (let negationDefinition of negationDefinitions) {
            result = result.then((currentResult: HLMFormulaDefinition[]) =>
              this.negateFormula(negationDefinition.formula, true).then((negatedFormula: Fmt.Expression) =>
                currentResult.concat({
                  formula: negatedFormula,
                  definitionRef: negationDefinition.definitionRef
                })));
          }
          return result;
        });
      }
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      let path = formula.path;
      return this.getOuterDefinition(formula).then((definition: Fmt.Definition) => {
        let result: HLMFormulaDefinition[] = [];
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
          for (let item of definition.contents.definition) {
            result.push({
              formula: this.substitutePath(item, path, [definition]),
              definitionRef: formula
            });
          }
        }
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      // TODO special support for embeddings (e.g. prove that an integer is a natural number)
      if (formula._set instanceof FmtHLM.MetaRefExpression_enumeration) {
        let result = new FmtHLM.MetaRefExpression_or;
        result.formulas = formula._set.terms?.map((term: Fmt.Expression) => {
          let equality = new FmtHLM.MetaRefExpression_equals;
          equality.terms = [formula.element, term];
          return equality;
        });
        return CachedPromise.resolve([{
          formula: result
        }]);
      } else if (formula._set instanceof FmtHLM.MetaRefExpression_subset) {
        let paramType = formula._set.parameter.type as FmtHLM.MetaRefExpression_Element;
        let elementConstraint = new FmtHLM.MetaRefExpression_in;
        elementConstraint.element = formula.element;
        elementConstraint._set = paramType._set;
        let subsetFormula = FmtUtils.substituteVariable(formula._set.formula, formula._set.parameter, formula.element);
        let result = new FmtHLM.MetaRefExpression_and;
        result.formulas = [elementConstraint, subsetFormula];
        return CachedPromise.resolve([{
          formula: result
        }]);
      } else if (formula._set instanceof FmtHLM.MetaRefExpression_extendedSubset) {
        let equality = new FmtHLM.MetaRefExpression_equals;
        equality.terms = [formula.element, formula._set.term];
        let result = new FmtHLM.MetaRefExpression_exists;
        result.parameters = formula._set.parameters;
        result.formula = equality;
        return CachedPromise.resolve([{
          formula: result
        }]);
      } else if (formula._set instanceof Fmt.DefinitionRefExpression) {
        let definitionRef = formula._set;
        let path = definitionRef.path;
        return this.getOuterDefinition(definitionRef).then((definition: Fmt.Definition) => {
          let resultPromise: CachedPromise<HLMFormulaDefinition[]> = CachedPromise.resolve([]);
          if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
            for (let item of definition.contents.definition) {
              resultPromise = resultPromise.then((currentResult: HLMFormulaDefinition[]) => {
                let newFormula = new FmtHLM.MetaRefExpression_in;
                newFormula.element = formula.element;
                newFormula._set = this.substitutePath(item, path, [definition]);
                let newFormulaDefinitionsPromise = this.getFormulaDefinitions(newFormula, side);
                if (newFormulaDefinitionsPromise) {
                  return newFormulaDefinitionsPromise.then((newFormulaDefinitions: HLMFormulaDefinition[]) =>
                    currentResult.concat(newFormulaDefinitions.map((newFormulaDefinition: HLMFormulaDefinition): HLMFormulaDefinition => ({
                      formula: newFormulaDefinition.formula,
                      definitionRef: definitionRef
                    }))));
                } else {
                  return currentResult;
                }
              });
            }
          }
          return resultPromise;
        });
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      let result = new FmtHLM.MetaRefExpression_forall;
      result.parameters = new Fmt.ParameterList;
      let paramType = new FmtHLM.MetaRefExpression_Element;
      paramType._set = formula.subset;
      let param = this.createParameter(paramType, 'x');
      result.parameters.push(param);
      let variableRef = new Fmt.VariableRefExpression(param);
      let resultFormula = new FmtHLM.MetaRefExpression_in;
      resultFormula.element = variableRef;
      resultFormula._set = formula.superset;
      result.formula = resultFormula;
      return CachedPromise.resolve([{
        formula: result
      }]);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals && formula.terms.length === 2) {
      if (side === undefined) {
        // TODO constructor equality
      } else if (side >= 0 && side < formula.terms.length) {
        // TODO embedding
        let term = formula.terms[side];
        let otherTerm = formula.terms[1 - side];
        if (term instanceof Fmt.DefinitionRefExpression) {
          let definitionRef = term;
          let path = definitionRef.path;
          return this.getOuterDefinition(definitionRef).then((definition: Fmt.Definition) => {
            if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
              let contents = definition.contents;
              let paramType = contents.parameter.type as FmtHLM.MetaRefExpression_Element;
              let elementCondition = new FmtHLM.MetaRefExpression_in;
              elementCondition.element = otherTerm;
              elementCondition._set = this.substitutePath(paramType._set, path, [definition]);
              return contents.definition.map((item: Fmt.Expression) => {
                let substitutedItem = this.substitutePath(item, path, [definition]);
                substitutedItem = FmtUtils.substituteVariable(substitutedItem, contents.parameter, otherTerm);
                let conjunction = new FmtHLM.MetaRefExpression_and;
                conjunction.formulas = [elementCondition, substitutedItem];
                return {
                  formula: conjunction,
                  definitionRef: definitionRef
                };
              });
            }
            return [];
          });
        }
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
      let uniquenessFormula = new FmtHLM.MetaRefExpression_forall;
      uniquenessFormula.parameters = new Fmt.ParameterList;
      let replacedParameters: Fmt.ReplacedParameter[] = [];
      formula.parameters.clone(uniquenessFormula.parameters, replacedParameters);
      let equalities: Fmt.Expression[] = [];
      for (let param of formula.parameters) {
        if (param.type instanceof FmtHLM.MetaRefExpression_Element) {
          let equality = new FmtHLM.MetaRefExpression_equals;
          let originalVariableRef = new Fmt.VariableRefExpression(param);
          let substitutedVariableRef = new Fmt.VariableRefExpression(param.findReplacement(replacedParameters));
          equality.terms = [substitutedVariableRef, originalVariableRef];
          equalities.push(equality);
        }
      }
      if (equalities.length === 1) {
        uniquenessFormula.formula = equalities[0];
      } else {
        let equalityConjunction = new FmtHLM.MetaRefExpression_and;
        equalityConjunction.formulas = equalities;
        uniquenessFormula.formula = equalityConjunction;
      }
      let result = new FmtHLM.MetaRefExpression_exists;
      result.parameters = formula.parameters;
      if (formula.formula) {
        let resultFormula = new FmtHLM.MetaRefExpression_and;
        resultFormula.formulas = [formula.formula, uniquenessFormula];
        result.formula = resultFormula;
      } else {
        result.formula = uniquenessFormula;
      }
      return CachedPromise.resolve([{
        formula: result
      }]);
    }
    return undefined;
  }

  getFormulaCases(formula: Fmt.Expression, side: number | undefined, isGoal: boolean): CachedPromise<HLMFormulaCase[]> | undefined {
    if (side === undefined) {
      if (formula instanceof (isGoal ? FmtHLM.MetaRefExpression_and : FmtHLM.MetaRefExpression_or) && formula.formulas) {
        return CachedPromise.resolve(formula.formulas.map((item: Fmt.Expression) => ({formula: item})));
      } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
        let getValueFormula = (value: Fmt.Expression) => value;
        return this.getStructuralFormulaCases(formula.construction, formula.term, formula.cases, getValueFormula);
      }
    } else {
      if (formula instanceof FmtHLM.MetaRefExpression_setEquals && side >= 0 && side < formula.terms.length) {
        let term = formula.terms[side];
        if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
          let getValueFormula = (value: Fmt.Expression) => {
            let valueFormula = new FmtHLM.MetaRefExpression_setEquals;
            valueFormula.terms = formula.terms.slice();
            valueFormula.terms[side] = value;
            return valueFormula;
          };
          return this.getStructuralFormulaCases(term.construction, term.term, term.cases, getValueFormula);
        }
      } else if (formula instanceof FmtHLM.MetaRefExpression_equals && side >= 0 && side < formula.terms.length) {
        let term = formula.terms[side];
        let getValueFormula = (value: Fmt.Expression) => {
          let valueFormula = new FmtHLM.MetaRefExpression_equals;
          valueFormula.terms = formula.terms.slice();
          valueFormula.terms[side] = value;
          return valueFormula;
        };
        if (term instanceof FmtHLM.MetaRefExpression_cases) {
          let result = term.cases.map((item: FmtHLM.ObjectContents_Case): HLMFormulaCase => {
            let parameters = new Fmt.ParameterList;
            parameters.push(this.createConstraintParameter(item.formula, '_1'));
            return {
              parameters: parameters,
              formula: getValueFormula(item.value)
            };
          });
          return CachedPromise.resolve(result);
        } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
          return this.getStructuralFormulaCases(term.construction, term.term, term.cases, getValueFormula);
        }
      } else if (formula instanceof FmtHLM.MetaRefExpression_equiv && side >= 0 && side < formula.formulas.length) {
        let term = formula.formulas[side];
        if (term instanceof FmtHLM.MetaRefExpression_structural) {
          let getValueFormula = (value: Fmt.Expression) => {
            let valueFormula = new FmtHLM.MetaRefExpression_equiv;
            valueFormula.formulas = formula.formulas.slice();
            valueFormula.formulas[side] = value;
            return valueFormula;
          };
          return this.getStructuralFormulaCases(term.construction, term.term, term.cases, getValueFormula);
        }
      }
    }
    return undefined;
  }

  private getStructuralFormulaCases(construction: Fmt.Expression, term: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], getValueFormula: (value: Fmt.Expression) => Fmt.Expression): CachedPromise<HLMFormulaCase[]> | undefined {
    if (construction instanceof Fmt.DefinitionRefExpression) {
      let resultPromise: CachedPromise<HLMFormulaCase[]> = CachedPromise.resolve([]);
      for (let structuralCase of cases) {
        resultPromise = resultPromise.then((currentResult: HLMFormulaCase[]) =>
          this.getStructuralCaseTerm(construction.path, structuralCase).then((structuralCaseTerm: Fmt.Expression) => {
            let valueFormula = getValueFormula(structuralCase.value);
            return currentResult.concat({
              parameters: this.getStructuralCaseParametersWithConstraint(term, structuralCase, structuralCaseTerm),
              formula: this.getInductionProofGoal(valueFormula, term, structuralCaseTerm)
            });
          }));
      }
      return resultPromise;
    } else {
      return undefined;
    }
  }

  translateIndex(externalIndex: Fmt.BN | undefined): number | undefined {
    return externalIndex === undefined ? undefined : externalIndex.toNumber() - 1;
  }

  fillPlaceholderArguments(params: Fmt.ParameterList, args: Fmt.ArgumentList, createPlaceholder: CreatePlaceholderFn, createParameterList: CreateParameterListFn): void {
    for (let param of params) {
      let argValue = this.createArgumentValue(param, createPlaceholder, createParameterList);
      if (argValue) {
        let argument = new Fmt.Argument;
        argument.name = param.name;
        argument.value = argValue;
        args.push(argument);
      }
    }
  }

  fillDefaultPlaceholderArguments(params: Fmt.ParameterList, args: Fmt.ArgumentList, targetPath: Fmt.PathItem | undefined): void {
    let createPlaceholder = (placeholderType: HLMExpressionType) => new Fmt.PlaceholderExpression(placeholderType);
    let createParameterList = (source: Fmt.ParameterList) => this.createParameterList(source, targetPath);
    this.fillPlaceholderArguments(params, args, createPlaceholder, createParameterList);
  }

  createArgumentValue(param: Fmt.Parameter, createPlaceholder: CreatePlaceholderFn, createParameterList: CreateParameterListFn): Fmt.Expression | undefined {
    if (param.type instanceof Fmt.IndexedExpression) {
      return new Fmt.ArrayExpression([]);
    }
    return this.createArgumentItemValue(param, createPlaceholder, createParameterList);
  }

  createArgumentItemValue(param: Fmt.Parameter, createPlaceholder: CreatePlaceholderFn, createParameterList: CreateParameterListFn): Fmt.Expression | undefined {
    let contents = this.createArgumentContents(param, createPlaceholder, createParameterList);
    if (contents) {
      return contents.toExpression(false);
    }
    let paramType = param.type;
    if (paramType instanceof FmtHLM.MetaRefExpression_Nat) {
      return new Fmt.PlaceholderExpression(undefined);
    }
    return undefined;
  }

  private createArgumentContents(param: Fmt.Parameter, createPlaceholder: CreatePlaceholderFn, createParameterList: CreateParameterListFn): Fmt.ObjectContents | undefined {
    let paramType = param.type;
    if (paramType instanceof FmtHLM.MetaRefExpression_Prop) {
      let propArg = new FmtHLM.ObjectContents_PropArg;
      propArg.formula = createPlaceholder(HLMExpressionType.Formula);
      return propArg;
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Set) {
      let setArg = new FmtHLM.ObjectContents_SetArg;
      setArg._set = createPlaceholder(HLMExpressionType.SetTerm);
      return setArg;
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Subset) {
      let subsetArg = new FmtHLM.ObjectContents_SubsetArg;
      subsetArg._set = createPlaceholder(HLMExpressionType.SetTerm);
      return subsetArg;
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Element) {
      let elementArg = new FmtHLM.ObjectContents_ElementArg;
      elementArg.element = createPlaceholder(HLMExpressionType.ElementTerm);
      return elementArg;
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Binder) {
      let binderArg = new FmtHLM.ObjectContents_BinderArg;
      binderArg.sourceParameters = createParameterList(paramType.sourceParameters);
      binderArg.targetArguments = new Fmt.ArgumentList;
      this.fillPlaceholderArguments(paramType.targetParameters, binderArg.targetArguments, createPlaceholder, createParameterList);
      return binderArg;
    } else {
      return undefined;
    }
  }

  createElementParameter(defaultName: string, usedNames: Set<string>): Fmt.Parameter {
    let elementType = new FmtHLM.MetaRefExpression_Element;
    elementType._set = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    return this.createParameter(elementType, defaultName, usedNames);
  }

  createConstraintParameter(constraint: Fmt.Expression, name: string): Fmt.Parameter {
    let constraintType = new FmtHLM.MetaRefExpression_Constraint;
    constraintType.formula = constraint;
    return this.createParameter(constraintType, name);
  }

  createParameterList(source: Fmt.ParameterList, targetPath: Fmt.PathItem | undefined, usedNames?: Set<string>): Fmt.ParameterList {
    let substitutionContext = new SubstitutionContext;
    this.addTargetPathSubstitution(targetPath, substitutionContext);
    let substitutedSource = this.applySubstitutionContextToParameterList(source, substitutionContext);
    let result = new Fmt.ParameterList;
    substitutedSource.clone(result);
    if (usedNames) {
      this.adaptParameterNames(result, usedNames);
    }
    return result;
  }

  adaptParameterNames(parameterList: Fmt.ParameterList, usedNames: Set<string>): void {
    for (let param of parameterList) {
      param.name = this.getUnusedDefaultName(param.name, usedNames);
      let type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        this.adaptParameterNames(type.sourceParameters, usedNames);
        this.adaptParameterNames(type.targetParameters, usedNames);
      }
    }
  }

  canAutoFillParameter(param: Fmt.Parameter, dependentParams: Fmt.Parameter[]): boolean {
    for (let dependentParam of dependentParams) {
      let type = dependentParam.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        if (this.canAutoFillParameter(param, type.sourceParameters) || this.canAutoFillParameter(param, type.targetParameters)) {
          return true;
        }
      } else if (this.isValueParamType(type)) {
        if (this.referencesParameter(type, param)) {
          return true;
        }
      }
    }
    return false;
  }

  markUnreferencedParametersAsAuto(params: Fmt.ParameterList, referencedParams: Fmt.Parameter[]): void {
    for (let param of params) {
      let type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        this.markUnreferencedParametersAsAuto(type.targetParameters, referencedParams);
      } else if (type instanceof FmtHLM.MetaRefExpression_Prop || type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_Element) {
        if (referencedParams.indexOf(param) < 0) {
          type.auto = new FmtHLM.MetaRefExpression_true;
        }
      }
    }
  }
}
