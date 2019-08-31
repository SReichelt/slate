import { GenericUtils } from '../generic/utils';
import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import CachedPromise from '../../data/cachedPromise';

export class DefinitionVariableRefExpression extends Fmt.VariableRefExpression {}

export interface HLMSubstitutionContext {
  targetPath?: Fmt.PathItem;
  previousSetTerm?: Fmt.Expression;
  parameterLists?: Fmt.ParameterList[];
  argumentLists?: Fmt.ArgumentList[];
  originalBindingParameters?: Fmt.Parameter[];
  substitutedBindingParameters?: Fmt.Parameter[];
}

export class HLMUtils extends GenericUtils {
  getRawArgument(argumentLists: Fmt.ArgumentList[], param: Fmt.Parameter): Fmt.Expression | undefined {
    for (let argumentList of argumentLists) {
      let value = argumentList.getOptionalValue(param.name);
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  getArgument<ContentClass extends Fmt.ObjectContents>(argumentLists: Fmt.ArgumentList[], param: Fmt.Parameter, contentClass: {new(): ContentClass}): ContentClass | undefined {
    let arg = this.getRawArgument(argumentLists, param);
    if (arg) {
      if (arg instanceof Fmt.CompoundExpression) {
        let contents = new contentClass;
        contents.fromCompoundExpression(arg);
        return contents;
      } else {
        throw new Error('Compound expression expected');
      }
    }
    return undefined;
  }

  isValueParamType(type: Fmt.Expression): boolean {
    return (type instanceof FmtHLM.MetaRefExpression_Prop || type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_Element);
  }

  private getArgValue(argumentList: Fmt.ArgumentList, param: Fmt.Parameter): Fmt.Expression | undefined {
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      let propArg = this.getArgument([argumentList], param, FmtHLM.ObjectContents_PropArg);
      if (propArg) {
        return propArg.formula;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
      let setArg = this.getArgument([argumentList], param, FmtHLM.ObjectContents_SetArg);
      if (setArg) {
        return setArg._set;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      let subsetArg = this.getArgument([argumentList], param, FmtHLM.ObjectContents_SubsetArg);
      if (subsetArg) {
        return subsetArg._set;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      let elementArg = this.getArgument([argumentList], param, FmtHLM.ObjectContents_ElementArg);
      if (elementArg) {
        return elementArg.element;
      }
    }
    return undefined;
  }

  getParameterArgument(param: Fmt.Parameter, context: HLMSubstitutionContext, targetParam?: Fmt.Parameter, indices?: Fmt.Expression[]): Fmt.Argument | undefined {
    let type = param.type.expression;
    if (this.isValueParamType(type) || type instanceof FmtHLM.MetaRefExpression_Binding) {
      let arg = new Fmt.Argument;
      arg.name = param.name;
      let argValue = new Fmt.CompoundExpression;
      if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        let bindingArg = new FmtHLM.ObjectContents_BindingArg;
        let bindingArgParam = new Fmt.Parameter;
        bindingArgParam.name = targetParam ? targetParam.name : param.name;
        let bindingArgParamType = new Fmt.Type;
        let bindingArgParamTypeExpr = new FmtHLM.MetaRefExpression_Element;
        bindingArgParamTypeExpr._set = this.substituteParameterSet(type._set, context, false);
        bindingArgParamType.expression = bindingArgParamTypeExpr;
        bindingArgParamType.arrayDimensions = 0;
        bindingArgParam.type = bindingArgParamType;
        bindingArgParam.optional = false;
        bindingArgParam.list = false;
        bindingArg.parameter = bindingArgParam;
        let newContext: HLMSubstitutionContext = {
          ...context,
          previousSetTerm: bindingArgParamTypeExpr._set,
          originalBindingParameters: context.originalBindingParameters ? [...context.originalBindingParameters, param] : [param],
          substitutedBindingParameters: context.substitutedBindingParameters ? [...context.substitutedBindingParameters, bindingArgParam] : [bindingArgParam]
        };
        let targetInnerParameters = targetParam ? (targetParam.type.expression as FmtHLM.MetaRefExpression_Binding).parameters : undefined;
        let indexExpr = new Fmt.VariableRefExpression;
        indexExpr.variable = bindingArgParam;
        let newIndices = indices ? [...indices, indexExpr] : [indexExpr];
        bindingArg.arguments = Object.create(Fmt.ArgumentList.prototype);
        this.getParameterArguments(bindingArg.arguments, type.parameters, newContext, targetInnerParameters, newIndices);
        bindingArg.toCompoundExpression(argValue);
      } else {
        let varExpr = new Fmt.VariableRefExpression;
        varExpr.variable = param;
        varExpr.indices = indices;
        if (type instanceof FmtHLM.MetaRefExpression_Prop) {
          let propArg = new FmtHLM.ObjectContents_PropArg;
          propArg.formula = varExpr;
          propArg.toCompoundExpression(argValue);
        } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
          let setArg = new FmtHLM.ObjectContents_SetArg;
          setArg._set = varExpr;
          setArg.toCompoundExpression(argValue);
        } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
          let subsetArg = new FmtHLM.ObjectContents_SubsetArg;
          subsetArg._set = varExpr;
          subsetArg.toCompoundExpression(argValue);
        } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
          let elementArg = new FmtHLM.ObjectContents_ElementArg;
          elementArg.element = varExpr;
          elementArg.toCompoundExpression(argValue);
        }
      }
      arg.value = argValue;
      return arg;
    }
    // No need to adjust context according to parameter; it is only used for bindings.
    context.previousSetTerm = undefined;
    return undefined;
  }

  getParameterArguments(args: Fmt.ArgumentList, parameters: Fmt.Parameter[], context: HLMSubstitutionContext = {}, targetParameters?: Fmt.Parameter[], indices?: Fmt.Expression[]): void {
    for (let paramIndex = 0; paramIndex < parameters.length; paramIndex++) {
      let param = parameters[paramIndex];
      let targetParam = targetParameters ? targetParameters[paramIndex] : undefined;
      let arg = this.getParameterArgument(param, context, targetParam, indices);
      if (arg) {
        args.push(arg);
      }
    }
  }

  getStructuralCaseTerm(construction: Fmt.Path, structuralCase: FmtHLM.ObjectContents_StructuralCase, markAsDefinition: boolean = false): CachedPromise<Fmt.Expression> {
    let constructionDefinitionPromise = this.libraryDataAccessor.fetchItem(construction);
    let resultPromise = constructionDefinitionPromise.then((constructionDefinition: Fmt.Definition) => {
      let constructorExpr = structuralCase._constructor as Fmt.DefinitionRefExpression;
      let constructorPath = constructorExpr.path;
      let constructionPath = constructorPath.parentPath as Fmt.Path;
      let constructorDefinition = constructionDefinition.innerDefinitions.getDefinition(constructorExpr.path.name);
      let constructorDefinitionContents = constructorDefinition.contents as FmtHLM.ObjectContents_Constructor;
      let result: Fmt.Expression;
      if (structuralCase.rewrite instanceof FmtHLM.MetaRefExpression_true && constructorDefinitionContents.rewrite) {
        result = constructorDefinitionContents.rewrite.value;
        result = this.substituteTargetPath(result, constructionPath.parentPath);
        result = this.substituteArguments(result, constructionDefinition.parameters, constructionPath.arguments);
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
    });
    return resultPromise;
  }

  getEmbeddingTargetTerm(construction: Fmt.Definition, target: Fmt.Expression): Fmt.Expression {
    let constructorExpr = target as Fmt.DefinitionRefExpression;
    let constructorPath = constructorExpr.path;
    let constructionPath = constructorPath.parentPath as Fmt.Path;
    let fullConstructionPath = new Fmt.Path;
    fullConstructionPath.parentPath = constructionPath.parentPath;
    fullConstructionPath.name = constructionPath.name;
    let context: HLMSubstitutionContext = {targetPath: constructionPath.parentPath};
    this.getParameterArguments(fullConstructionPath.arguments, construction.parameters, context);
    let resultPath = new Fmt.Path;
    resultPath.parentPath = fullConstructionPath;
    resultPath.name = constructorPath.name;
    resultPath.arguments = constructorPath.arguments;
    let resultRef = new Fmt.DefinitionRefExpression;
    resultRef.path = resultPath;
    return resultRef;
  }

  substituteParameters(expression: Fmt.Expression, originalParameters: Fmt.Parameter[], substitutedParameters: Fmt.Parameter[], markAsDefinition: boolean = false): Fmt.Expression {
    for (let paramIndex = 0; paramIndex < originalParameters.length && paramIndex < substitutedParameters.length; paramIndex++) {
      expression = this.substituteParameter(expression, originalParameters[paramIndex], substitutedParameters[paramIndex], markAsDefinition);
    }
    return expression;
  }

  substituteParameter(expression: Fmt.Expression, originalParam: Fmt.Parameter, substitutedParam: Fmt.Parameter, markAsDefinition: boolean = false): Fmt.Expression {
    expression = this.substituteVariable(expression, originalParam, (indices?: Fmt.Expression[]) => {
      let substitutedExpression = markAsDefinition ? new DefinitionVariableRefExpression : new Fmt.VariableRefExpression;
      substitutedExpression.variable = substitutedParam;
      substitutedExpression.indices = indices;
      return substitutedExpression;
    });
    let originalType = originalParam.type.expression;
    let substitutedType = substitutedParam.type.expression;
    if (originalType instanceof FmtHLM.MetaRefExpression_Binding && substitutedType instanceof FmtHLM.MetaRefExpression_Binding) {
      expression = this.substituteParameters(expression, originalType.parameters, substitutedType.parameters, markAsDefinition);
    }
    return expression;
  }

  substituteArguments(expression: Fmt.Expression, parameters: Fmt.ParameterList, args: Fmt.ArgumentList, indexVariables?: Fmt.Parameter[]): Fmt.Expression {
    for (let param of parameters) {
      let type = param.type.expression;
      if (this.isValueParamType(type)) {
        let argValue = this.getArgValue(args, param);
        if (argValue) {
          expression = this.substituteVariable(expression, param, (indices?: Fmt.Expression[]) => {
            let substitutedArg = argValue!;
            if (indexVariables) {
              for (let index = 0; index < indexVariables.length; index++) {
                substitutedArg = this.substituteVariable(substitutedArg, indexVariables[index], () => indices![index]);
              }
            }
            return substitutedArg;
          });
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        let argValue = this.getArgument([args], param, FmtHLM.ObjectContents_BindingArg);
        if (argValue) {
          let newIndexVariables = indexVariables ? [...indexVariables, argValue.parameter] : [argValue.parameter];
          expression = this.substituteArguments(expression, type.parameters, argValue.arguments, newIndexVariables);
        }
      }
    }
    return expression;
  }

  substituteAllArguments(expression: Fmt.Expression, parameterLists: Fmt.ParameterList[], argumentLists: Fmt.ArgumentList[], indexVariables?: Fmt.Parameter[]): Fmt.Expression {
    if (parameterLists.length !== argumentLists.length) {
      throw new Error('Number of parameter and argument lists do not match');
    }
    for (let index = 0; index < parameterLists.length; index++) {
      expression = this.substituteArguments(expression, parameterLists[index], argumentLists[index], indexVariables);
    }
    return expression;
  }

  substituteIndices(expression: Fmt.Expression, variable: Fmt.VariableRefExpression): Fmt.Expression {
    if (variable.indices) {
      let bindingParameter: Fmt.Parameter | undefined = variable.variable;
      for (let indexIndex = variable.indices.length - 1; indexIndex >= 0; indexIndex--) {
        bindingParameter = this.getParentBinding(bindingParameter);
        if (!bindingParameter) {
          throw new Error('Too many indices');
        }
        let index = variable.indices[indexIndex];
        expression = this.substituteVariable(expression, bindingParameter, () => index);
      }
    }
    return expression;
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
    expression = this.substituteTargetPath(expression, path.parentPath);
    let parameterLists: Fmt.ParameterList[] = [];
    for (let definition of definitions) {
      parameterLists.push(definition.parameters);
    }
    let argumentLists: Fmt.ArgumentList[] = [];
    for (let pathItem: Fmt.PathItem | undefined = path; pathItem instanceof Fmt.Path; pathItem = pathItem.parentPath) {
      argumentLists.unshift(pathItem.arguments);
    }
    expression = this.substituteAllArguments(expression, parameterLists, argumentLists);
    return expression;
  }

  substituteParameterSet(term: Fmt.Expression, context: HLMSubstitutionContext, setAsPreviousSetTerm: boolean): Fmt.Expression {
    if (term instanceof FmtHLM.MetaRefExpression_previous && context.previousSetTerm) {
      return context.previousSetTerm;
    } else {
      term = this.substituteTargetPath(term, context.targetPath);
      if (context.parameterLists && context.argumentLists) {
        term = this.substituteAllArguments(term, context.parameterLists, context.argumentLists);
      }
      if (context.originalBindingParameters && context.substitutedBindingParameters) {
        term = this.substituteParameters(term, context.originalBindingParameters, context.substitutedBindingParameters);
      }
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
      if (type instanceof FmtHLM.MetaRefExpression_Binding && this.parameterListContainsParameter(type.parameters, param)) {
        return true;
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

  getParentBinding(param: Fmt.Parameter): Fmt.Parameter | undefined {
    for (let previousParam = param.previousParameter; previousParam; previousParam = previousParam.previousParameter) {
      let type = previousParam.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        if (type.parameters.indexOf(param) >= 0) {
          return previousParam;
        }
      }
    }
    return undefined;
  }

  getProofStepResult(step: Fmt.Parameter, previousResult?: Fmt.Expression): Fmt.Expression | undefined {
    let type = step.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      let result = new FmtHLM.MetaRefExpression_setEquals;
      let left = new Fmt.VariableRefExpression;
      left.variable = step;
      result.left = left;
      result.right = type._set;
      return result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      let result = new FmtHLM.MetaRefExpression_equals;
      let left = new Fmt.VariableRefExpression;
      left.variable = step;
      result.left = left;
      result.right = type.element;
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
               || type instanceof FmtHLM.MetaRefExpression_ResolveDef
               || type instanceof FmtHLM.MetaRefExpression_UseTheorem
               || type instanceof FmtHLM.MetaRefExpression_Substitute) {
      return type.result;
    } else if (type instanceof FmtHLM.MetaRefExpression_Embed) {
      let result = new FmtHLM.MetaRefExpression_equals;
      result.left = type.input;
      result.right = type.output;
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
          let result = new FmtHLM.MetaRefExpression_setEquals;
          result.left = this.substitutePrevious(type.term, previousResult.left);
          result.right = this.substitutePrevious(type.term, previousResult.right);
          return result;
        } else {
          throw new Error('Previous result is not an equality expression');
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Extend) {
        if (previousResult instanceof FmtHLM.MetaRefExpression_setEquals || previousResult instanceof FmtHLM.MetaRefExpression_equals) {
          let result = new FmtHLM.MetaRefExpression_equals;
          result.left = this.substitutePrevious(type.term, previousResult.left);
          result.right = this.substitutePrevious(type.term, previousResult.right);
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

  // TODO honor embedSubsets
  getNextSuperset(term: Fmt.Expression, followEmbeddings: boolean): CachedPromise<Fmt.Expression | undefined> {
    if (term instanceof Fmt.VariableRefExpression) {
      let type = term.variable.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Set) {
        return CachedPromise.resolve(undefined);
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
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
        return CachedPromise.resolve(this.substituteIndices(superset, term));
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
        return CachedPromise.resolve(this.substituteIndices(type._set, term));
      } else {
        return CachedPromise.reject(new Error('Set variable expected'));
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression | undefined | CachedPromise<Fmt.Expression | undefined> => {
        if (followEmbeddings && definition.contents instanceof FmtHLM.ObjectContents_Construction && definition.contents.embedding) {
          let type = definition.contents.embedding.parameter.type.expression;
          if (type instanceof FmtHLM.MetaRefExpression_Element) {
            return this.substitutePath(type._set, term.path, [definition]);
          } else {
            return CachedPromise.reject(new Error('Element parameter expected'));
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator && definition.contents.definition instanceof Fmt.ArrayExpression && definition.contents.definition.items.length) {
          let item = definition.contents.definition.items[0];
          return this.substitutePath(item, term.path, [definition]);
        } else {
          return undefined;
        }
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
      if (term.terms && term.terms.length) {
        return this.getDeclaredSet(term.terms[0]);
      } else {
        return CachedPromise.resolve(undefined);
      }
    } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
      let type = term.parameter.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Element) {
        return CachedPromise.resolve(type._set);
      } else {
        return CachedPromise.reject(new Error('Element parameter expected'));
      }
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      return this.getDeclaredSet(term.term);
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      if (term.cases.length) {
        let structuralCase = term.cases[0];
        if (this.referencesCaseParameter(structuralCase)) {
          return this.getNextSuperset(structuralCase.value, followEmbeddings).then((superset: Fmt.Expression | undefined) => {
            if (superset || term.cases.length > 1 || structuralCase.rewrite) {
              return this.buildSingleStructuralCaseSetTerm(term.term, term.construction, structuralCase._constructor, structuralCase.parameters, superset || structuralCase.value);
            } else {
              return undefined;
            }
          });
        } else {
          return CachedPromise.resolve(structuralCase.value);
        }
      } else {
        return this.getWildcardFinalSet();
      }
    } else {
      return CachedPromise.reject(new Error('Set term expected'));
    }
  }

  getFinalSuperset(term: Fmt.Expression, followEmbeddings: boolean): CachedPromise<Fmt.Expression> {
    return this.getFinalSupersetInternal(term, followEmbeddings, []);
  }

  private getFinalSupersetInternal(term: Fmt.Expression, followEmbeddings: boolean, visitedDefinitions: Fmt.DefinitionRefExpression[]): CachedPromise<Fmt.Expression> {
    if (term instanceof Fmt.DefinitionRefExpression) {
      for (let visitedDefinition of visitedDefinitions) {
        if (term.isEquivalentTo(visitedDefinition)) {
          return CachedPromise.reject(new Error('Invalid circular reference'));
        }
      }
      visitedDefinitions.push(term);
    }
    return this.getNextSuperset(term, followEmbeddings).then((next: Fmt.Expression | undefined) => {
      if (next) {
        return this.getFinalSupersetInternal(next, followEmbeddings, visitedDefinitions);
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
        if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Binding) {
          let set = type._set;
          let parameter: Fmt.Parameter | undefined = term.variable;
          while (set instanceof FmtHLM.MetaRefExpression_previous) {
            parameter = parameter.previousParameter;
            if (!parameter) {
              break;
            }
            type = parameter.type.expression;
            if (!(type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Binding)) {
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
          let path = term.path;
          return this.getOuterDefinition(term).then((definition: Fmt.Definition) => {
            if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
              if (definition.contents.definition instanceof Fmt.ArrayExpression && definition.contents.definition.items.length) {
                let item = definition.contents.definition.items[0];
                return this.getDeclaredSetInternal(this.substitutePath(item, path, [definition]), visitedDefinitions);
              } else {
                return this.getWildcardFinalSet();
              }
            } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
              let type = definition.contents.parameter.type.expression;
              if (type instanceof FmtHLM.MetaRefExpression_Element) {
                return CachedPromise.resolve(this.substitutePath(type._set, path, [definition]));
              } else {
                return CachedPromise.reject(new Error('Element parameter expected'));
              }
            } else if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
              // TODO
              return this.getWildcardFinalSet();
            } else {
              return CachedPromise.reject(new Error('Referenced definition must be a constructor or operator'));
            }
          });
        }
      } else if (term instanceof FmtHLM.MetaRefExpression_cases) {
        if (term.cases.length) {
          term = term.cases[0].value;
        } else {
          return this.getWildcardFinalSet();
        }
      } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
        if (term.cases.length) {
          let structuralCase = term.cases[0];
          if (this.referencesCaseParameter(structuralCase)) {
            let structuralCasesTerm = term;
            return this.getDeclaredSet(structuralCase.value).then((declaredSet: Fmt.Expression) => {
              return this.buildSingleStructuralCaseSetTerm(structuralCasesTerm.term, structuralCasesTerm.construction, structuralCase._constructor, structuralCase.parameters, declaredSet);
            });
          } else {
            term = structuralCase.value;
          }
        } else {
          return this.getWildcardFinalSet();
        }
      } else {
        return CachedPromise.reject(new Error('Element term expected'));
      }
    }
  }

  getFinalSet(term: Fmt.Expression, followEmbeddings: boolean): CachedPromise<Fmt.Expression> {
    return this.getDeclaredSet(term).then((set: Fmt.Expression) => this.getFinalSuperset(set, followEmbeddings));
  }

  getWildcardFinalSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(new FmtHLM.MetaRefExpression_enumeration);
  }

  isWildcardFinalSet(term: Fmt.Expression): boolean {
    return term instanceof FmtHLM.MetaRefExpression_enumeration && !term.terms;
  }

  buildSingleStructuralCaseSetTerm(term: Fmt.Expression, construction: Fmt.Expression, constructor: Fmt.Expression, parameters: Fmt.ParameterList | undefined, value: Fmt.Expression): FmtHLM.MetaRefExpression_setStructuralCases {
    let structuralCase = new FmtHLM.ObjectContents_StructuralCase;
    structuralCase._constructor = constructor;
    structuralCase.parameters = parameters;
    structuralCase.value = value;
    let result = new FmtHLM.MetaRefExpression_setStructuralCases;
    result.term = term;
    result.construction = construction;
    result.cases = [structuralCase];
    return result;
  }
}
