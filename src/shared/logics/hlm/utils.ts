import { GenericUtils } from '../generic/utils';
import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Ctx from '../../format/context';
import { HLMExpressionType } from './hlm';
import * as Macro from '../macro';
import * as HLMMacro from './macro';
import * as HLMMacros from './macros/macros';
import { LibraryDefinition } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

export class DefinitionVariableRefExpression extends Fmt.VariableRefExpression {}

export interface HLMSubstitutionContext {
  targetPath?: Fmt.PathItem;
  previousSetTerm?: Fmt.Expression;  // TODO #65 remove
  parameterLists?: Fmt.ParameterList[];
  argumentLists?: Fmt.ArgumentList[];
  originalBinders?: Fmt.Parameter[];
  substitutedBinders?: Fmt.Parameter[];
}

export interface HLMUnfoldParameters {
  followDefinitions: boolean;
  unfoldFixedSubterms: boolean;
  extractStructuralCasesFromFixedSubterms: boolean;
}

export interface HLMTypeSearchParameters extends HLMUnfoldParameters {
  followSupersets: boolean;
  followEmbeddings: boolean;
}

const eliminateVariablesOnly: HLMTypeSearchParameters = {
  followDefinitions: false,
  followSupersets: true,
  followEmbeddings: false,
  unfoldFixedSubterms: false,
  extractStructuralCasesFromFixedSubterms: false
};

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
    if (rawArg instanceof Fmt.CompoundExpression) {
      let contents = new contentClass;
      contents.fromCompoundExpression(rawArg);
      return contents;
    } else {
      throw new Error('Compound expression expected');
    }
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
    let type = param.type.expression;
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

  // OPT omit proofs during argument conversion, as they are not used
  private getArgValue(argumentList: Fmt.ArgumentList, param: Fmt.Parameter): Fmt.Expression | undefined {
    let arg = this.getRawArgument([argumentList], param);
    if (arg) {
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Prop) {
        let propArg = this.convertArgument(arg, FmtHLM.ObjectContents_PropArg);
        return propArg.formula;
      } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
        let setArg = this.convertArgument(arg, FmtHLM.ObjectContents_SetArg);
        return setArg._set;
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        let subsetArg = this.convertArgument(arg, FmtHLM.ObjectContents_SubsetArg);
        return subsetArg._set;
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        let elementArg = this.convertArgument(arg, FmtHLM.ObjectContents_ElementArg);
        return elementArg.element;
      }
    }
    return undefined;
  }

  getParameterArgument(param: Fmt.Parameter, context: HLMSubstitutionContext, targetParam?: Fmt.Parameter, indices?: Fmt.Index[]): Fmt.Argument | undefined {
    let type = param.type.expression;
    if (this.isValueParamType(type) || type instanceof FmtHLM.MetaRefExpression_Binder) {
      let arg = new Fmt.Argument;
      arg.name = param.name;
      let argValue = new Fmt.CompoundExpression;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        let targetType = targetParam ? targetParam.type.expression as FmtHLM.MetaRefExpression_Binder : undefined;
        let binderArg = new FmtHLM.ObjectContents_BinderArg;
        binderArg.sourceParameters = targetType ? targetType.sourceParameters : this.applySubstitutionContextToParameterList(type.sourceParameters, context);
        let newContext: HLMSubstitutionContext = {
          ...context,
          previousSetTerm: undefined,
          originalBinders: context.originalBinders ? [...context.originalBinders, ...type.sourceParameters] : type.sourceParameters,
          substitutedBinders: context.substitutedBinders ? [...context.substitutedBinders, ...binderArg.sourceParameters] : binderArg.sourceParameters
        };
        let targetInnerParameters = targetType?.targetParameters;
        let index: Fmt.Index = {
          parameters: binderArg.sourceParameters,
          arguments: Object.create(Fmt.ArgumentList.prototype)
        };
        this.getParameterArguments(index.arguments!, binderArg.sourceParameters, context, undefined, indices);
        let newIndices = indices ? [...indices, index] : [index];
        binderArg.targetArguments = Object.create(Fmt.ArgumentList.prototype);
        this.getParameterArguments(binderArg.targetArguments, type.targetParameters, newContext, targetInnerParameters, newIndices);
        binderArg.toCompoundExpression(argValue, false);
      } else {
        let varExpr = new Fmt.VariableRefExpression;
        varExpr.variable = param;
        varExpr.indices = indices;
        if (type instanceof FmtHLM.MetaRefExpression_Prop) {
          let propArg = new FmtHLM.ObjectContents_PropArg;
          propArg.formula = varExpr;
          propArg.toCompoundExpression(argValue, false);
        } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
          let setArg = new FmtHLM.ObjectContents_SetArg;
          setArg._set = varExpr;
          setArg.toCompoundExpression(argValue, false);
        } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
          let subsetArg = new FmtHLM.ObjectContents_SubsetArg;
          subsetArg._set = varExpr;
          subsetArg.toCompoundExpression(argValue, false);
        } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
          let elementArg = new FmtHLM.ObjectContents_ElementArg;
          elementArg.element = varExpr;
          elementArg.toCompoundExpression(argValue, false);
        }
      }
      arg.value = argValue;
      return arg;
    }
    // No need to adjust context according to parameter; it is only used for bindings.
    context.previousSetTerm = undefined;
    return undefined;
  }

  getParameterArguments(args: Fmt.ArgumentList, parameters: Fmt.Parameter[], context: HLMSubstitutionContext = {}, targetParameters?: Fmt.Parameter[], indices?: Fmt.Index[]): void {
    for (let paramIndex = 0; paramIndex < parameters.length; paramIndex++) {
      let param = parameters[paramIndex];
      let targetParam = targetParameters ? targetParameters[paramIndex] : undefined;
      let arg = this.getParameterArgument(param, context, targetParam, indices);
      if (arg) {
        args.push(arg);
      }
    }
  }

  getStructuralCaseTerm(constructionPath: Fmt.Path, structuralCase: FmtHLM.ObjectContents_StructuralCase, markAsDefinition: boolean = false): CachedPromise<Fmt.Expression> {
    let constructionDefinitionPromise = this.libraryDataAccessor.fetchItem(constructionPath, false);
    let resultPromise = constructionDefinitionPromise.then((libraryDefinition: LibraryDefinition) => {
      let constructionDefinition = libraryDefinition.definition;
      let constructorExpr = structuralCase._constructor as Fmt.DefinitionRefExpression;
      let constructorPath = constructorExpr.path;
      let constructorDefinition = constructionDefinition.innerDefinitions.getDefinition(constructorExpr.path.name);
      let constructorContents = constructorDefinition.contents as FmtHLM.ObjectContents_Constructor;
      return this.getResolvedStructuralCaseTerm(constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents, markAsDefinition);
    });
    return resultPromise;
  }

  getResolvedStructuralCaseTerm(constructionPath: Fmt.Path, constructionDefinition: Fmt.Definition, structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorPath: Fmt.Path, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor, markAsDefinition: boolean = false): Fmt.Expression {
    let result: Fmt.Expression;
    if (structuralCase.rewrite instanceof FmtHLM.MetaRefExpression_true && constructorContents.rewrite) {
      result = constructorContents.rewrite.value;
      result = this.substitutePath(result, constructionPath, [constructionDefinition]);
    } else {
      let resultPath = new Fmt.Path;
      resultPath.parentPath = constructionPath;
      resultPath.name = constructorPath.name;
      let context: HLMSubstitutionContext = {targetPath: constructionPath.parentPath};
      this.getParameterArguments(resultPath.arguments, constructorDefinition.parameters, context, structuralCase.parameters);
      let resultRef = new Fmt.DefinitionRefExpression;
      resultRef.path = resultPath;
      result = resultRef;
    }
    if (constructorDefinition.parameters.length) {
      result = this.substituteParameters(result, constructorDefinition.parameters, structuralCase.parameters!, markAsDefinition);
    }
    return result;
  }

  createStructuralCaseConstraintParameter(term: Fmt.Expression, constructionPath: Fmt.Path, constructionDefinition: Fmt.Definition, structuralCase: FmtHLM.ObjectContents_StructuralCase, constructorPath: Fmt.Path, constructorDefinition: Fmt.Definition, constructorContents: FmtHLM.ObjectContents_Constructor): Fmt.Parameter {
    let caseTerm = this.getResolvedStructuralCaseTerm(constructionPath, constructionDefinition, structuralCase, constructorPath, constructorDefinition, constructorContents);
    let constraint = new FmtHLM.MetaRefExpression_equals;
    constraint.terms = [term, caseTerm];
    let constraintType = new FmtHLM.MetaRefExpression_Constraint;
    constraintType.formula = constraint;
    return this.createParameter(constraintType, '_');
  }

  substituteParameters(expression: Fmt.Expression, originalParameters: Fmt.Parameter[], substitutedParameters: Fmt.Parameter[], markAsDefinition: boolean = false): Fmt.Expression {
    for (let paramIndex = 0; paramIndex < originalParameters.length && paramIndex < substitutedParameters.length; paramIndex++) {
      expression = this.substituteParameter(expression, originalParameters[paramIndex], substitutedParameters[paramIndex], markAsDefinition);
    }
    return expression;
  }

  substituteParameter(expression: Fmt.Expression, originalParam: Fmt.Parameter, substitutedParam: Fmt.Parameter, markAsDefinition: boolean = false): Fmt.Expression {
    expression = this.substituteVariable(expression, originalParam, (variableRef: Fmt.VariableRefExpression) => {
      let substitutedExpression = markAsDefinition ? new DefinitionVariableRefExpression : new Fmt.VariableRefExpression;
      substitutedExpression.variable = substitutedParam;
      substitutedExpression.indices = variableRef.indices;
      return substitutedExpression;
    });
    let originalType = originalParam.type.expression;
    let substitutedType = substitutedParam.type.expression;
    if (originalType instanceof FmtHLM.MetaRefExpression_Binder && substitutedType instanceof FmtHLM.MetaRefExpression_Binder) {
      expression = this.substituteParameters(expression, originalType.targetParameters, substitutedType.targetParameters, markAsDefinition);
      let replacedParameters: Fmt.ReplacedParameter[] = [];
      for (let paramIndex = 0; paramIndex < originalType.sourceParameters.length && paramIndex < substitutedType.sourceParameters.length; paramIndex++) {
        replacedParameters.push({
          original: originalType.sourceParameters[paramIndex],
          replacement: substitutedType.sourceParameters[paramIndex]
        });
      }
      let identityFn = (subExpression: Fmt.Expression) => subExpression;
      expression = expression.substitute(identityFn, replacedParameters);
    }
    return expression;
  }

  substituteArguments(expression: Fmt.Expression, parameters: Fmt.Parameter[], args: Fmt.ArgumentList, targetPath?: Fmt.PathItem): Fmt.Expression {
    let previousParameters: Fmt.Parameter[] = [];
    for (let param of parameters) {
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Bool || type instanceof FmtHLM.MetaRefExpression_Nat) {
        let argValue = this.getRawArgument([args], param);
        if (argValue) {
          expression = this.substituteVariable(expression, param, () => argValue!);
        }
      } else if (!param.type.arrayDimensions) {
        if (this.isValueParamType(type)) {
          let argValue = this.getArgValue(args, param);
          if (argValue) {
            expression = this.substituteVariableWithIndices(expression, param, argValue);
          }
        } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
          let argValue = this.getArgument([args], param, FmtHLM.ObjectContents_BinderArg);
          if (argValue) {
            expression = this.substituteParameters(expression, type.sourceParameters, argValue.sourceParameters);
            expression = this.substituteArguments(expression, type.targetParameters, argValue.targetArguments, targetPath);
          }
        } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
          let value = this.substituteTargetPath(type._set, targetPath);
          value = this.substituteArguments(value, previousParameters, args, targetPath);
          expression = this.substituteVariableWithIndices(expression, param, value);
        } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
          let value = this.substituteTargetPath(type.element, targetPath);
          value = this.substituteArguments(value, previousParameters, args, targetPath);
          expression = this.substituteVariableWithIndices(expression, param, value);
        }
      }
      previousParameters.push(param);
    }
    return expression;
  }

  substituteAllArguments(expression: Fmt.Expression, parameterLists: Fmt.ParameterList[], argumentLists: Fmt.ArgumentList[], targetPath?: Fmt.PathItem): Fmt.Expression {
    if (parameterLists.length !== argumentLists.length) {
      throw new Error('Number of parameter and argument lists do not match');
    }
    for (let index = 0; index < parameterLists.length; index++) {
      expression = this.substituteArguments(expression, parameterLists[index], argumentLists[index], targetPath);
    }
    return expression;
  }

  substituteIndices(expression: Fmt.Expression, variable: Fmt.VariableRefExpression): Fmt.Expression {
    if (variable.indices) {
      for (let index of variable.indices) {
        if (index.parameters && index.arguments) {
          expression = this.substituteArguments(expression, index.parameters, index.arguments);
        }
      }
    }
    return expression;
  }

  substituteVariableWithIndices(expression: Fmt.Expression, variable: Fmt.Parameter, value: Fmt.Expression): Fmt.Expression {
    return this.substituteVariable(expression, variable, (variableRef: Fmt.VariableRefExpression) => {
      return this.substituteIndices(value, variableRef);
    });
  }

  substitutePrevious(expression: Fmt.Expression, previous: Fmt.Expression): Fmt.Expression {
    return expression.substitute((subExpression: Fmt.Expression) => {
      if (subExpression instanceof FmtHLM.MetaRefExpression_previous) {
        return previous;
      } else {
        return subExpression;
      }
    });
  }

  substitutePath(expression: Fmt.Expression, path: Fmt.Path, definitions: Fmt.Definition[]): Fmt.Expression {
    let parentPath = path.parentPath;
    while (parentPath instanceof Fmt.Path) {
      parentPath = parentPath.parentPath;
    }
    expression = this.substituteTargetPath(expression, parentPath);
    let parameterLists: Fmt.ParameterList[] = [];
    for (let definition of definitions) {
      parameterLists.push(definition.parameters);
    }
    let argumentLists: Fmt.ArgumentList[] = [];
    for (let pathItem: Fmt.PathItem | undefined = path; pathItem instanceof Fmt.Path; pathItem = pathItem.parentPath) {
      argumentLists.unshift(pathItem.arguments);
    }
    expression = this.substituteAllArguments(expression, parameterLists, argumentLists, parentPath);
    return expression;
  }

  applySubstitutionContext(expression: Fmt.Expression, context: HLMSubstitutionContext): Fmt.Expression {
    expression = this.substituteTargetPath(expression, context.targetPath);
    if (context.parameterLists && context.argumentLists) {
      expression = this.substituteAllArguments(expression, context.parameterLists, context.argumentLists, context.targetPath);
    }
    if (context.originalBinders && context.substitutedBinders) {
      expression = this.substituteParameters(expression, context.originalBinders, context.substitutedBinders);
    }
    return expression;
  }

  applySubstitutionContextToParameterList(parameters: Fmt.ParameterList, context: HLMSubstitutionContext): Fmt.ParameterList {
    let result: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
    parameters.clone(result);
    for (let param of result) {
      param.type.expression = this.applySubstitutionContext(param.type.expression, context);
    }
    return result;
  }

  // TODO #65 remove?
  substituteParameterSet(term: Fmt.Expression, context: HLMSubstitutionContext, setAsPreviousSetTerm: boolean): Fmt.Expression {
    if (term instanceof FmtHLM.MetaRefExpression_previous && context.previousSetTerm) {
      return context.previousSetTerm;
    } else {
      term = this.applySubstitutionContext(term, context);
      if (setAsPreviousSetTerm) {
        context.previousSetTerm = term;
      }
      return term;
    }
  }

  parameterListContainsParameter(parameterList: Fmt.ParameterList, param: Fmt.Parameter): boolean {
    for (let currentParam of parameterList) {
      if (currentParam === param) {
        return true;
      }
      let type = currentParam.type.expression;
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

  getMacroInvocation(expression: Fmt.DefinitionRefExpression, definition: Fmt.Definition): HLMMacro.HLMMacroInvocation {
    let parentPath = expression.path.parentPath;
    let libraryDataAccessor = this.libraryDataAccessor.getAccessorForSection(parentPath);
    let macroInstance = HLMMacros.instantiateMacro(libraryDataAccessor, definition);
    let config = this.supportPlaceholders ? new HLMMacroInvocationConfigWithPlaceholders(this, parentPath) : new HLMMacroInvocationConfig(this, parentPath);
    return macroInstance.invoke(this, expression, config);
  }

  getProofStepResult(step: Fmt.Parameter, previousResult?: Fmt.Expression): Fmt.Expression | undefined {
    let type = step.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      let result = new FmtHLM.MetaRefExpression_setEquals;
      let left = new Fmt.VariableRefExpression;
      left.variable = step;
      result.terms = [left, type._set];
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      let result = new FmtHLM.MetaRefExpression_equals;
      let left = new Fmt.VariableRefExpression;
      left.variable = step;
      result.terms = [left, type.element];
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Consider) {
      if (type.variable instanceof Fmt.VariableRefExpression) {
        return this.getParameterConstraint(type.variable.variable, type.variable);
      } else {
        throw new Error('Variable reference expected');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      return type.statement;
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
               || type instanceof FmtHLM.MetaRefExpression_UnfoldDef
               || type instanceof FmtHLM.MetaRefExpression_UseTheorem
               || type instanceof FmtHLM.MetaRefExpression_Substitute) {
      return type.result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Embed) {
      let result = new FmtHLM.MetaRefExpression_equals;
      result.terms = [type.input, type.output];
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_UseExists
               || type instanceof FmtHLM.MetaRefExpression_UseForAll
               || type instanceof FmtHLM.MetaRefExpression_SetExtend
               || type instanceof FmtHLM.MetaRefExpression_Extend) {
      if (!previousResult && step.previousParameter) {
        previousResult = this.getParameterConstraint(step.previousParameter);
      }
      if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
        if (previousResult instanceof FmtHLM.MetaRefExpression_exists || previousResult instanceof FmtHLM.MetaRefExpression_existsUnique) {
          return previousResult.formula;
        } else {
          throw new Error('Previous result is not an existentially quantified expression');
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
        if (previousResult instanceof FmtHLM.MetaRefExpression_forall) {
          return this.substituteArguments(previousResult.formula, previousResult.parameters, type.arguments);
        } else {
          throw new Error('Previous result is not a universally quantified expression');
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_SetExtend) {
        if (previousResult instanceof FmtHLM.MetaRefExpression_setEquals || previousResult instanceof FmtHLM.MetaRefExpression_equals) {
          let term = type.term;
          let result = new FmtHLM.MetaRefExpression_setEquals;
          result.terms = previousResult.terms.map((item) => this.substitutePrevious(term, item));
          return result;
        } else {
          throw new Error('Previous result is not an equality expression');
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Extend) {
        if (previousResult instanceof FmtHLM.MetaRefExpression_setEquals || previousResult instanceof FmtHLM.MetaRefExpression_equals) {
          let term = type.term;
          let result = new FmtHLM.MetaRefExpression_equals;
          result.terms = previousResult.terms.map((item) => this.substitutePrevious(term, item));
          return result;
        } else {
          throw new Error('Previous result is not an equality expression');
        }
      } else {
        throw new Error('Unknown proof step');
      }
    } else {
      return undefined;
    }
  }

  getParameterConstraint(param: Fmt.Parameter, variableRefExpression?: Fmt.VariableRefExpression): Fmt.Expression | undefined {
    let variableType = param.type.expression;
    if (variableType instanceof FmtHLM.MetaRefExpression_Subset) {
      if (!variableRefExpression) {
        variableRefExpression = new Fmt.VariableRefExpression;
        variableRefExpression.variable = param;
      }
      let result = new FmtHLM.MetaRefExpression_sub;
      result.subset = variableRefExpression;
      result.superset = this.substituteIndices(variableType.superset, variableRefExpression);
      return result;
    } else if (variableType instanceof FmtHLM.MetaRefExpression_Element) {
      if (!variableRefExpression) {
        variableRefExpression = new Fmt.VariableRefExpression;
        variableRefExpression.variable = param;
      }
      let result = new FmtHLM.MetaRefExpression_in;
      result.element = variableRefExpression;
      result._set = this.substituteIndices(variableType._set, variableRefExpression);
      return result;
    } else if (variableType instanceof FmtHLM.MetaRefExpression_Constraint) {
      return variableType.formula;
    } else {
      return this.getProofStepResult(param);
    }
  }

  getNextElementTerms(term: Fmt.Expression, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    if (term instanceof Fmt.VariableRefExpression) {
      let type = term.variable.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Element) {
        return this.getNextIndices(term, HLMExpressionType.ElementTerm, unfoldParameters);
      } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
        return CachedPromise.resolve([this.substituteIndices(type.element, term)]);
      } else {
        return CachedPromise.reject(new Error('Element variable expected'));
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      if (!unfoldParameters.followDefinitions) {
        return CachedPromise.resolve(undefined);
      }
      // TODO unfold construction arguments?
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined => {
        if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          return definition.contents.definition.map((item: Fmt.Expression) => this.substitutePath(item, term.path, [definition]));
        } else if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
          // TODO
        }
        return undefined;
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      return CachedPromise.resolve([term.term]);
    } else if (term instanceof FmtHLM.MetaRefExpression_associative) {
      return CachedPromise.resolve([term.term]);
    }
    return CachedPromise.resolve(undefined);
  }

  getNextElementTerm(term: Fmt.Expression, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression | undefined> {
    return this.getNextElementTerms(term, unfoldParameters).then((resultTerms: Fmt.Expression[] | undefined) => (resultTerms?.length ? resultTerms[0] : undefined));
  }

  getNextSetTerms(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression[] | undefined> {
    if (term instanceof Fmt.VariableRefExpression) {
      let type = term.variable.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Set) {
        return this.getNextIndices(term, HLMExpressionType.SetTerm, typeSearchParameters);
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        if (typeSearchParameters.followSupersets) {
          let superset = type.superset;
          let parameter: Fmt.Parameter | undefined = term.variable;
          while (superset instanceof FmtHLM.MetaRefExpression_previous) {
            parameter = parameter.previousParameter;
            if (!parameter) {
              break;
            }
            type = parameter.type.expression;
            if (!(type instanceof FmtHLM.MetaRefExpression_Subset)) {
              break;
            }
            superset = type.superset;
          }
          return CachedPromise.resolve([this.substituteIndices(superset, term)]);
        }
        return CachedPromise.resolve(undefined);
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
        return CachedPromise.resolve([this.substituteIndices(type._set, term)]);
      } else {
        return CachedPromise.reject(new Error('Set variable expected'));
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      if (!typeSearchParameters.followDefinitions) {
        return CachedPromise.resolve(undefined);
      }
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          if (typeSearchParameters.followEmbeddings && definition.contents.embedding) {
            let type = definition.contents.embedding.parameter.type.expression;
            if (type instanceof FmtHLM.MetaRefExpression_Element) {
              return this.followSetTermWithPath(type._set, term.path, definition).then((superset: Fmt.Expression) => [superset]);
            } else {
              return CachedPromise.reject(new Error('Element parameter expected'));
            }
          } else if (typeSearchParameters.unfoldFixedSubterms || typeSearchParameters.extractStructuralCasesFromFixedSubterms) {
            return this.unfoldConstructionArguments(term, definition, typeSearchParameters);
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
          if (typeSearchParameters.followSupersets) {
            let definitionList = definition.contents.definition;
            if (definitionList.length) {
              let item = definitionList[0];
              return this.followSetTermWithPath(item, term.path, definition).then((superset: Fmt.Expression) => [superset]);
            }
          } else {
            return definition.contents.definition.map((item: Fmt.Expression) => this.substitutePath(item, term.path, [definition]));
          }
        }
        return undefined;
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
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
        let type = term.parameter.type.expression;
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
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      let mergeResult = this.mergeStructuralCases(term);
      if (mergeResult) {
        return CachedPromise.resolve([mergeResult]);
      }
      if (typeSearchParameters.followSupersets) {
        let resultPromise: CachedPromise<Fmt.Expression | undefined> = CachedPromise.resolve(this.getWildcardFinalSet());
        for (let structuralCase of term.cases) {
          resultPromise = resultPromise.then((currentResult: Fmt.Expression | undefined) => {
            if (currentResult && !this.isWildcardFinalSet(currentResult)) {
              return currentResult;
            } else {
              if (this.referencesCaseParameter(structuralCase)) {
                if (term.term instanceof Fmt.PlaceholderExpression && structuralCase.parameters) {
                  let args: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
                  let createPlaceholder = (placeholderType: HLMExpressionType) => {
                    let result = new Fmt.PlaceholderExpression(placeholderType);
                    result.isTemporary = true;
                    return result;
                  };
                  let createParameterList = (source: Fmt.ParameterList) => this.createParameterList(source, undefined);
                  this.fillPlaceholderArguments(structuralCase.parameters, args, createPlaceholder, createParameterList);
                  return this.substituteArguments(structuralCase.value, structuralCase.parameters, args);
                } else if (term.cases.length === 1 && term.term instanceof Fmt.DefinitionRefExpression && term.term.path.parentPath instanceof Fmt.Path && term.construction instanceof Fmt.DefinitionRefExpression && structuralCase._constructor instanceof Fmt.DefinitionRefExpression && structuralCase._constructor.path.parentPath instanceof Fmt.Path) {
                  if (term.term.path.parentPath.isEquivalentTo(term.construction.path) && term.term.path.name === structuralCase._constructor.path.name) {
                    let constructorPath = term.term.path;
                    return this.getOuterDefinition(structuralCase._constructor).then((definition: Fmt.Definition) => {
                      let innerDefinition = definition.innerDefinitions.getDefinition(constructorPath.name);
                      let substituted = this.substituteParameters(structuralCase.value, structuralCase.parameters!, innerDefinition.parameters, false);
                      return this.substituteArguments(substituted, innerDefinition.parameters, constructorPath.arguments);
                    });
                  }
                } else if (term.term instanceof FmtHLM.MetaRefExpression_structuralCases && term.term.cases.length === 1) {
                  let innerTerm = term.term;
                  let innerStructuralCase = innerTerm.cases[0];
                  let innerResultTerm = this.buildSingleStructuralCaseTerm(innerStructuralCase.value, term.construction, structuralCase._constructor, structuralCase.parameters, structuralCase.value, HLMExpressionType.SetTerm);
                  return this.buildSingleStructuralCaseTerm(innerTerm.term, innerTerm.construction, innerStructuralCase._constructor, innerStructuralCase.parameters, innerResultTerm, HLMExpressionType.SetTerm);
                }
                return this.getNextElementTerm(term.term, typeSearchParameters).then((nextTerm: Fmt.Expression | undefined) => {
                  if (nextTerm) {
                    return this.buildSingleStructuralCaseTerm(nextTerm, term.construction, structuralCase._constructor, structuralCase.parameters, structuralCase.value, HLMExpressionType.SetTerm);
                  } else {
                    return this.getNextSetTerm(structuralCase.value, typeSearchParameters).then((superset: Fmt.Expression | undefined) => {
                      if (superset || term.cases.length > 1 || structuralCase.rewrite) {
                        return this.buildSingleStructuralCaseTerm(term.term, term.construction, structuralCase._constructor, structuralCase.parameters, superset || structuralCase.value, HLMExpressionType.SetTerm);
                      } else {
                        return undefined;
                      }
                    });
                  }
                });
              } else {
                return CachedPromise.resolve(structuralCase.value);
              }
            }
          });
        }
        return resultPromise.then((currentResult: Fmt.Expression | undefined) => (currentResult ? [currentResult] : undefined));
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

  getNextSetTerm(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression | undefined> {
    return this.getNextSetTerms(term, typeSearchParameters).then((resultTerms: Fmt.Expression[] | undefined) => (resultTerms?.length ? resultTerms[0] : undefined));
  }

  private getNextIndices(term: Fmt.VariableRefExpression, expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    if (term.indices && (unfoldParameters.unfoldFixedSubterms || unfoldParameters.extractStructuralCasesFromFixedSubterms)) {
      // TODO #65 merge with unfoldConstructionArguments
/*      let newIndicesPromise: CachedPromise<Fmt.ArgumentList[][]> = CachedPromise.resolve([[]]);
      let indicesChanged = false;
      let extractedStructuralCases: FmtHLM.MetaRefExpression_structuralCases | undefined = undefined;
      for (let index of term.indices) {
        for (let indexArg of index) {
          newIndicesPromise = newIndicesPromise.then((newIndices: Fmt.ArgumentList[][]) => {
            if (!indicesChanged) {
              if (unfoldParameters.extractStructuralCasesFromFixedSubterms && index instanceof FmtHLM.MetaRefExpression_structuralCases && index.cases.length === 1) {
                indicesChanged = true;
                extractedStructuralCases = index;
                let structuralCase = index.cases[0];
                return newIndices.map((prevIndices: Fmt.ArgumentList[]) => prevIndices.concat(structuralCase.value));
              } else if (unfoldParameters.unfoldFixedSubterms) {
                return this.getNextElementTerms(index, unfoldParameters).then((unfoldedTerms: Fmt.Expression[] | undefined) => {
                  if (unfoldedTerms) {
                    indicesChanged = true;
                    let changedIndices: Fmt.ArgumentList[][] = [];
                    for (let prevIndices of newIndices) {
                      for (let unfoldedTerm of unfoldedTerms) {
                        changedIndices.push(prevIndices.concat(unfoldedTerm));
                      }
                    }
                    return changedIndices;
                  } else {
                    return newIndices.map((prevIndices: Fmt.ArgumentList[]) => prevIndices.concat(index));
                  }
                });
              }
            }
            return newIndices.map((prevIndices: Fmt.ArgumentList[]) => prevIndices.concat(index));
          });
        }
      }
      return newIndicesPromise.then((newIndices: Fmt.ArgumentList[][]) => {
        if (indicesChanged) {
          return newIndices.map((indices: Fmt.ArgumentList[]) => {
            let newTerm = new Fmt.VariableRefExpression;
            newTerm.variable = term.variable;
            newTerm.indices = indices;
            if (extractedStructuralCases) {
              let structuralCase = extractedStructuralCases.cases[0];
              return this.buildSingleStructuralCaseTerm(extractedStructuralCases.term, extractedStructuralCases.construction, structuralCase._constructor, structuralCase.parameters, newTerm, expressionType);
            } else {
              return newTerm;
            }
          });
        } else {
          return undefined;
        }
      });*/
    }
    return CachedPromise.resolve(undefined);
  }

  private unfoldConstructionArguments(term: Fmt.DefinitionRefExpression, definition: Fmt.Definition, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression[] | undefined> {
    let supersetResult: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    for (let param of definition.parameters) {
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) {
        let embedSubsets = typeSearchParameters.followEmbeddings && type.embedSubsets instanceof FmtHLM.MetaRefExpression_true;
        supersetResult = supersetResult.then((currentResult: Fmt.Expression[] | undefined): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
          if (currentResult) {
            return currentResult;
          } else {
            let argValue = this.getArgValue(term.path.arguments, param);
            if (argValue) {
              if (typeSearchParameters.extractStructuralCasesFromFixedSubterms && argValue instanceof FmtHLM.MetaRefExpression_setStructuralCases && argValue.cases.length === 1) {
                let structuralCase = argValue.cases[0];
                let replacedTerm = this.replaceSetArgValue(term, param, structuralCase.value);
                return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, replacedTerm, HLMExpressionType.SetTerm)];
              } else {
                let innerSearchParameters: HLMTypeSearchParameters = {
                  followDefinitions: typeSearchParameters.followDefinitions,
                  followSupersets: embedSubsets,
                  followEmbeddings: embedSubsets,
                  unfoldFixedSubterms: typeSearchParameters.unfoldFixedSubterms,
                  extractStructuralCasesFromFixedSubterms: typeSearchParameters.extractStructuralCasesFromFixedSubterms
                };
                return this.getNextSetTerms(argValue, innerSearchParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                  if (newArgValues) {
                    return newArgValues.map((newArgValue: Fmt.Expression) => this.replaceSetArgValue(term, param, newArgValue));
                  } else {
                    return undefined;
                  }
                });
              }
            } else {
              return undefined;
            }
          }
        });
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        supersetResult = supersetResult.then((currentResult: Fmt.Expression[] | undefined): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
          if (currentResult) {
            return currentResult;
          } else {
            let argValue = this.getArgValue(term.path.arguments, param);
            if (argValue) {
              if (typeSearchParameters.extractStructuralCasesFromFixedSubterms && argValue instanceof FmtHLM.MetaRefExpression_structuralCases && argValue.cases.length === 1) {
                let structuralCase = argValue.cases[0];
                let replacedTerm = this.replaceElementArgValue(term, param, structuralCase.value);
                return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, replacedTerm, HLMExpressionType.SetTerm)];
              } else {
                return this.getNextElementTerms(argValue, typeSearchParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                  if (newArgValues) {
                    return newArgValues.map((newArgValue: Fmt.Expression) => this.replaceElementArgValue(term, param, newArgValue));
                  } else {
                    return undefined;
                  }
                });
              }
            } else {
              return undefined;
            }
          }
        });
      }
    }
    return supersetResult;
  }

  private replaceSetArgValue(term: Fmt.DefinitionRefExpression, param: Fmt.Parameter, newValue: Fmt.Expression): Fmt.DefinitionRefExpression {
    let result = term.clone() as Fmt.DefinitionRefExpression;
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Set) {
      let resultArg = this.getRawArgument([result.path.arguments], param) as Fmt.CompoundExpression;
      let newArg = new FmtHLM.ObjectContents_SetArg;
      newArg._set = newValue;
      newArg.toCompoundExpression(resultArg, false);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      let resultArg = this.getRawArgument([result.path.arguments], param) as Fmt.CompoundExpression;
      let newArg = new FmtHLM.ObjectContents_SubsetArg;
      newArg._set = newValue;
      newArg.toCompoundExpression(resultArg, false);
    }
    return result;
  }

  private replaceElementArgValue(term: Fmt.DefinitionRefExpression, param: Fmt.Parameter, newValue: Fmt.Expression): Fmt.DefinitionRefExpression {
    let result = term.clone() as Fmt.DefinitionRefExpression;
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Element) {
      let resultArg = this.getRawArgument([result.path.arguments], param) as Fmt.CompoundExpression;
      let newArg = new FmtHLM.ObjectContents_ElementArg;
      newArg.element = newValue;
      newArg.toCompoundExpression(resultArg, false);
    }
    return result;
  }

  private mergeStructuralCases(term: FmtHLM.MetaRefExpression_setStructuralCases): Fmt.Expression | undefined {
    if (term.cases.length === 1) {
      let structuralCase = term.cases[0];
      let currentStructuralCase = structuralCase;
      let innerTerm = currentStructuralCase.value;
      while (innerTerm instanceof FmtHLM.MetaRefExpression_setStructuralCases && innerTerm.cases.length === 1) {
        let innerStructuralCase = innerTerm.cases[0];
        if (term.term.isEquivalentTo(innerTerm.term)) {
          let newInnerValue = innerStructuralCase.parameters && structuralCase.parameters ? this.substituteParameters(innerStructuralCase.value, innerStructuralCase.parameters, structuralCase.parameters) : innerStructuralCase.value;
          return this.substituteExpression(term, innerTerm, newInnerValue);
        }
        currentStructuralCase = innerStructuralCase;
        innerTerm = innerStructuralCase.value;
      }
    }
    return undefined;
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
    return this.getNextSetTerm(term, typeSearchParameters).then((next: Fmt.Expression | undefined) => {
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
      if (term instanceof Fmt.VariableRefExpression) {
        let type = term.variable.type.expression;
        if (type instanceof FmtHLM.MetaRefExpression_Element) {
          let set = type._set;
          let parameter: Fmt.Parameter | undefined = term.variable;
          while (set instanceof FmtHLM.MetaRefExpression_previous) {
            parameter = parameter.previousParameter;
            if (!parameter) {
              break;
            }
            type = parameter.type.expression;
            if (!(type instanceof FmtHLM.MetaRefExpression_Element)) {
              break;
            }
            set = type._set;
          }
          return CachedPromise.resolve(this.substituteIndices(set, term));
        } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
          term = this.substituteIndices(type.element, term);
        } else {
          return CachedPromise.reject(new Error('Element variable expected'));
        }
      } else if (term instanceof Fmt.DefinitionRefExpression) {
        if (term.path.parentPath instanceof Fmt.Path) {
          let constructionTerm = new Fmt.DefinitionRefExpression;
          constructionTerm.path = term.path.parentPath;
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
              let type = definition.contents.parameter.type.expression;
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

  buildSingleStructuralCaseTerm(term: Fmt.Expression, construction: Fmt.Expression, constructor: Fmt.Expression, parameters: Fmt.ParameterList | undefined, value: Fmt.Expression, expressionType: HLMExpressionType): Fmt.Expression {
    let structuralCase = new FmtHLM.ObjectContents_StructuralCase;
    structuralCase._constructor = constructor;
    structuralCase.parameters = parameters;
    structuralCase.value = value;
    let result = expressionType === HLMExpressionType.SetTerm ? new FmtHLM.MetaRefExpression_setStructuralCases : expressionType === HLMExpressionType.ElementTerm ? new FmtHLM.MetaRefExpression_structuralCases : new FmtHLM.MetaRefExpression_structural;
    result.term = term;
    result.construction = construction;
    result.cases = [structuralCase];
    return result;
  }

  negateFormula(formula: Fmt.Expression): CachedPromise<Fmt.Expression> {
    if (formula instanceof FmtHLM.MetaRefExpression_not) {
      return CachedPromise.resolve(formula.formula);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and) {
      return this.negateFormulas(formula.formulas).then((negatedFormulas: Fmt.Expression[] | undefined) => {
        let result = new FmtHLM.MetaRefExpression_or;
        result.formulas = negatedFormulas;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      return this.negateFormulas(formula.formulas).then((negatedFormulas: Fmt.Expression[] | undefined) => {
        let result = new FmtHLM.MetaRefExpression_and;
        result.formulas = negatedFormulas;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      return this.negateFormula(formula.formula).then((negatedFormula: Fmt.Expression) => {
        let result = new FmtHLM.MetaRefExpression_exists;
        result.parameters = formula.parameters;
        result.formula = negatedFormula;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_exists && formula.formula) {
      return this.negateFormula(formula.formula).then((negatedFormula: Fmt.Expression) => {
        let result = new FmtHLM.MetaRefExpression_forall;
        result.parameters = formula.parameters;
        result.formula = negatedFormula;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      let resultCases: CachedPromise<FmtHLM.ObjectContents_StructuralCase[]> = CachedPromise.resolve([]);
      for (let structuralCase of formula.cases) {
        resultCases = resultCases.then((negatedCases: FmtHLM.ObjectContents_StructuralCase[]) =>
          this.negateFormula(structuralCase.value).then((negatedFormula: Fmt.Expression) => {
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
    } else if (formula instanceof Fmt.DefinitionRefExpression && !formula.path.parentPath) {
      return this.getDefinition(formula.path).then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate && definition.contents.properties) {
          let negationArg = definition.contents.properties.getOptionalValue('negation');
          if (negationArg) {
            return negationArg;
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

  negateFormulas(formulas: Fmt.Expression[] | undefined): CachedPromise<Fmt.Expression[] | undefined> {
    if (formulas) {
      let result: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
      for (let formula of formulas) {
        result = result.then((negatedFormulas: Fmt.Expression[]) =>
          this.negateFormula(formula).then((negatedFormula: Fmt.Expression) =>
            negatedFormulas.concat(negatedFormula)
          )
        );
      }
      return result;
    } else {
      return CachedPromise.resolve(undefined);
    }
  }

  isTrivialTautology(formula: Fmt.Expression): CachedPromise<boolean> {
    if (formula instanceof FmtHLM.MetaRefExpression_and) {
      let resultPromise = CachedPromise.resolve(true);
      if (formula.formulas) {
        for (let item of formula.formulas) {
          resultPromise = resultPromise.then((currentResult: boolean) => {
            if (!currentResult) {
              return false;
            } else {
              return this.isTrivialTautology(item);
            }
          });
        }
      }
      return resultPromise;
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      let resultPromise = CachedPromise.resolve(false);
      if (formula.formulas) {
        let formulas = formula.formulas;
        for (let item of formulas) {
          resultPromise = resultPromise.then((currentResult: boolean) => {
            if (currentResult) {
              return true;
            } else {
              return this.isTrivialTautology(item);
            }
          });
          if (item !== formulas[0]) {
            resultPromise = resultPromise.then((currentResult: boolean) => {
              if (currentResult) {
                return true;
              } else {
                return this.negateFormula(item).then((negatedItem: Fmt.Expression) => {
                  for (let previousItem of formulas) {
                    if (previousItem === item) {
                      break;
                    }
                    if (this.areFormulasSyntacticallyEquivalent(negatedItem, previousItem)) {
                      return true;
                    }
                    if (previousItem instanceof FmtHLM.MetaRefExpression_not && this.areFormulasSyntacticallyEquivalent(item, formula)) {
                      return true;
                    }
                  }
                  return false;
                });
              }
            });
          }
        }
      }
      return resultPromise;
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      return this.isTrivialTautology(formula.formula);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals || formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      for (let index = 0; index + 1 < formula.terms.length; index++) {
        if (!formula.terms[index].isEquivalentTo(formula.terms[formula.terms.length - 1])) {
          return CachedPromise.resolve(false);
        }
      }
      return CachedPromise.resolve(true);
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      if (formula.subset.isEquivalentTo(formula.superset)) {
        return CachedPromise.resolve(true);
      }
    }
    return CachedPromise.resolve(false);
  }

  isTrivialContradiction(formula: Fmt.Expression): CachedPromise<boolean> {
    return this.negateFormula(formula).then((negatedFormula: Fmt.Expression) => this.isTrivialTautology(negatedFormula));
  }

  triviallyImplies(sourceFormula: Fmt.Expression, targetFormula: Fmt.Expression, followDefinitions: boolean): CachedPromise<boolean> {
    if (this.areFormulasSyntacticallyEquivalent(sourceFormula, targetFormula)) {
      return CachedPromise.resolve(true);
    }
    if (sourceFormula instanceof FmtHLM.MetaRefExpression_and) {
      let resultPromise = this.isTrivialTautology(targetFormula);
      if (sourceFormula.formulas) {
        for (let item of sourceFormula.formulas) {
          resultPromise = resultPromise.then((currentResult: boolean) => {
            if (currentResult) {
              return true;
            } else {
              return this.triviallyImplies(item, targetFormula, followDefinitions);
            }
          });
        }
      }
      return resultPromise;
    } else if (sourceFormula instanceof FmtHLM.MetaRefExpression_or) {
      let resultPromise = CachedPromise.resolve(true);
      if (sourceFormula.formulas) {
        for (let item of sourceFormula.formulas) {
          resultPromise = resultPromise.then((currentResult: boolean) => {
            if (!currentResult) {
              return false;
            } else {
              return this.triviallyImplies(item, targetFormula, followDefinitions);
            }
          });
        }
      }
      return resultPromise;
    }
    if (targetFormula instanceof FmtHLM.MetaRefExpression_and) {
      let resultPromise = CachedPromise.resolve(true);
      if (targetFormula.formulas) {
        for (let item of targetFormula.formulas) {
          resultPromise = resultPromise.then((currentResult: boolean) => {
            if (!currentResult) {
              return false;
            } else {
              return this.triviallyImplies(sourceFormula, item, followDefinitions);
            }
          });
        }
      }
      return resultPromise;
    } else if (targetFormula instanceof FmtHLM.MetaRefExpression_or) {
      let resultPromise = this.isTrivialContradiction(sourceFormula);
      if (targetFormula.formulas) {
        for (let item of targetFormula.formulas) {
          resultPromise = resultPromise.then((currentResult: boolean) => {
            if (currentResult) {
              return true;
            } else {
              return this.triviallyImplies(sourceFormula, item, followDefinitions);
            }
          });
        }
      }
      return resultPromise;
    }
    let finalResultPromise = CachedPromise.resolve(false);
    if (followDefinitions) {
      if (sourceFormula instanceof Fmt.DefinitionRefExpression && !sourceFormula.path.parentPath) {
        finalResultPromise = finalResultPromise.then((currentFinalResult: boolean) => {
          if (currentFinalResult) {
            return true;
          } else {
            return this.getDefinition(sourceFormula.path).then((definition: Fmt.Definition) => {
              let resultPromise = CachedPromise.resolve(false);
              if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
                for (let definitionFormula of definition.contents.definition) {
                  resultPromise = resultPromise.then((currentResult: boolean) => {
                    if (currentResult) {
                      return true;
                    } else {
                      let substitutedDefinitionFormula = this.substitutePath(definitionFormula, sourceFormula.path, [definition]);
                      return this.triviallyImplies(substitutedDefinitionFormula, targetFormula, false);
                    }
                  });
                }
              }
              return resultPromise;
            });
          }
        });
      }
      if (targetFormula instanceof Fmt.DefinitionRefExpression && !targetFormula.path.parentPath) {
        finalResultPromise = finalResultPromise.then((currentFinalResult: boolean) => {
          if (currentFinalResult) {
            return true;
          } else {
            return this.getDefinition(targetFormula.path).then((definition: Fmt.Definition) => {
              let resultPromise = CachedPromise.resolve(false);
              if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
                for (let definitionFormula of definition.contents.definition) {
                  resultPromise = resultPromise.then((currentResult: boolean) => {
                    if (currentResult) {
                      return true;
                    } else {
                      let substitutedDefinitionFormula = this.substitutePath(definitionFormula, targetFormula.path, [definition]);
                      return this.triviallyImplies(sourceFormula, substitutedDefinitionFormula, false);
                    }
                  });
                }
              }
              return resultPromise;
            });
          }
        });
      }
    }
    return finalResultPromise;
  }

  private areFormulasSyntacticallyEquivalent(left: Fmt.Expression, right: Fmt.Expression): boolean {
    let fn = (leftPart: Fmt.Expression, rightPart: Fmt.Expression) => {
      if (((leftPart instanceof FmtHLM.MetaRefExpression_equals && rightPart instanceof FmtHLM.MetaRefExpression_equals)
           || (leftPart instanceof FmtHLM.MetaRefExpression_setEquals && rightPart instanceof FmtHLM.MetaRefExpression_setEquals))
          && leftPart.terms.length === rightPart.terms.length) {
        let leftTerms = [...leftPart.terms];
        let rightTerms = [...rightPart.terms];
        for (let leftTerm of leftTerms) {
          let found = false;
          for (let rightIndex = 0; rightIndex < rightTerms.length; rightIndex++) {
            if (leftTerm.isEquivalentTo(rightTerms[rightIndex])) {
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

  fillDefaultPlaceholderArguments(params: Fmt.ParameterList, args: Fmt.ArgumentList, targetPath: Fmt.PathItem | undefined, context?: Ctx.Context): void {
    let createPlaceholder = (placeholderType: HLMExpressionType) => new Fmt.PlaceholderExpression(placeholderType);
    let createParameterList = (source: Fmt.ParameterList) => {
      let result = Object.create(Fmt.ParameterList.prototype);
      source.substituteExpression((subExpression: Fmt.Expression) => this.substituteImmediatePath(subExpression, targetPath), result);
      return result;
    };
    this.fillPlaceholderArguments(params, args, createPlaceholder, createParameterList);
  }

  createArgumentValue(param: Fmt.Parameter, createPlaceholder: CreatePlaceholderFn, createParameterList: CreateParameterListFn): Fmt.Expression | undefined {
    if (param.type.arrayDimensions) {
      let result = new Fmt.ArrayExpression;
      result.items = [];
      return result;
    }
    return this.createArgumentItemValue(param, createPlaceholder, createParameterList);
  }

  createArgumentItemValue(param: Fmt.Parameter, createPlaceholder: CreatePlaceholderFn, createParameterList: CreateParameterListFn): Fmt.Expression | undefined {
    let contents = this.createArgumentContents(param, createPlaceholder, createParameterList);
    if (contents) {
      let argValue = new Fmt.CompoundExpression;
      contents.toCompoundExpression(argValue, false);
      return argValue;
    }
    let paramType = param.type.expression;
    if (paramType instanceof FmtHLM.MetaRefExpression_Nat) {
      return new Fmt.PlaceholderExpression(undefined);
    }
    return undefined;
  }

  private createArgumentContents(param: Fmt.Parameter, createPlaceholder: CreatePlaceholderFn, createParameterList: CreateParameterListFn): Fmt.ObjectContents | undefined {
    let paramType = param.type.expression;
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
      binderArg.targetArguments = Object.create(Fmt.ArgumentList.prototype);
      this.fillPlaceholderArguments(paramType.targetParameters, binderArg.targetArguments, createPlaceholder, createParameterList);
      return binderArg;
    } else {
      return undefined;
    }
  }

  createElementParameter(defaultName: string, context?: Ctx.Context): Fmt.Parameter {
    let elementType = new FmtHLM.MetaRefExpression_Element;
    elementType._set = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    return this.createParameter(elementType, defaultName, context);
  }

  createParameterList(source: Fmt.ParameterList, targetPath: Fmt.PathItem | undefined, context?: Ctx.Context): Fmt.ParameterList {
    let result: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
    source.substituteExpression((subExpression: Fmt.Expression) => this.substituteImmediatePath(subExpression, targetPath), result);
    if (context) {
      this.adaptParameterNames(result, context);
    }
    return result;
  }

  canAutoFillParameter(param: Fmt.Parameter, dependentParams: Fmt.Parameter[]): boolean {
    for (let dependentParam of dependentParams) {
      let type = dependentParam.type.expression;
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
      let type = param.type.expression;
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
