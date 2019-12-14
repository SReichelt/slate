import { GenericUtils } from '../generic/utils';
import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as HLMMacro from './macro';
import * as HLMMacros from './macros/macros';
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
        bindingArg.toCompoundExpression(argValue, false);
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
      if (type instanceof FmtHLM.MetaRefExpression_Expr || type instanceof FmtHLM.MetaRefExpression_Bool || type instanceof FmtHLM.MetaRefExpression_Nat || type instanceof FmtHLM.MetaRefExpression_DefinitionRef) {
        let argValue = this.getRawArgument([args], param);
        if (argValue) {
          expression = this.substituteVariable(expression, param, () => argValue!);
        }
      } else if (!param.type.arrayDimensions) {
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

  resolveSetTerm(term: Fmt.Expression): CachedPromise<Fmt.Expression[] | undefined> {
    if (term instanceof Fmt.VariableRefExpression) {
      let type = term.variable.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
        return CachedPromise.resolve([this.substituteIndices(type._set, term)]);
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined => {
        if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
          return definition.contents.definition.map((item: Fmt.Expression) => this.substitutePath(item, term.path, [definition]));
        }
        return undefined;
      });
    }
    return CachedPromise.resolve(undefined);
  }

  resolveElementTerm(term: Fmt.Expression): CachedPromise<Fmt.Expression[] | undefined> {
    if (term instanceof Fmt.VariableRefExpression) {
      let type = term.variable.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Def) {
        return CachedPromise.resolve([this.substituteIndices(type.element, term)]);
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined => {
        if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          return definition.contents.definition.map((item: Fmt.Expression) => this.substitutePath(item, term.path, [definition]));
        } else if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
          // TODO
        }
        return undefined;
      });
    }
    return CachedPromise.resolve(undefined);
  }

  getNextSuperset(term: Fmt.Expression, followEmbeddings: boolean, inTypeCast: boolean = false): CachedPromise<Fmt.Expression | undefined> {
    if (term instanceof Fmt.VariableRefExpression) {
      let type = term.variable.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Set) {
        if (inTypeCast && term.indices) {
          let newIndicesPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
          let indicesChanged = false;
          for (let index of term.indices) {
            newIndicesPromise = newIndicesPromise.then((newIndices: Fmt.Expression[]) => {
              if (indicesChanged) {
                return newIndices.concat(index);
              } else {
                return this.getNextTypeCastTerm(index, followEmbeddings).then((newIndex: Fmt.Expression | undefined) => {
                  if (newIndex) {
                    indicesChanged = true;
                    return newIndices.concat(newIndex);
                  } else {
                    return newIndices.concat(index);
                  }
                });
              }
            });
          }
          return newIndicesPromise.then((newIndices: Fmt.Expression[]) => {
            if (indicesChanged) {
              let newTerm = new Fmt.VariableRefExpression;
              newTerm.variable = term.variable;
              newTerm.indices = newIndices;
              return newTerm;
            } else {
              return undefined;
            }
          });
        }
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
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          if (followEmbeddings && definition.contents.embedding) {
            let type = definition.contents.embedding.parameter.type.expression;
            if (type instanceof FmtHLM.MetaRefExpression_Element) {
              return this.substitutePath(type._set, term.path, [definition]);
            } else {
              return CachedPromise.reject(new Error('Element parameter expected'));
            }
          } else {
            let supersetResult: CachedPromise<Fmt.Expression | undefined> = CachedPromise.resolve(undefined);
            for (let param of definition.parameters) {
              let type = param.type.expression;
              if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) {
                if (inTypeCast || (followEmbeddings && type.embedSubsets instanceof FmtHLM.MetaRefExpression_true)) {
                  supersetResult = supersetResult.then((currentResult: Fmt.Expression | undefined): Fmt.Expression | undefined | CachedPromise<Fmt.Expression | undefined> => {
                    if (currentResult) {
                      return currentResult;
                    } else {
                      let argValue = this.getArgValue(term.path.arguments, param);
                      if (argValue) {
                        return this.getNextSuperset(argValue, followEmbeddings, inTypeCast).then((superset: Fmt.Expression | undefined) => {
                          if (superset) {
                            let result = term.clone() as Fmt.DefinitionRefExpression;
                            if (type instanceof FmtHLM.MetaRefExpression_Set) {
                              let resultArg = this.getRawArgument([result.path.arguments], param) as Fmt.CompoundExpression;
                              let newArg = new FmtHLM.ObjectContents_SetArg;
                              newArg._set = superset;
                              newArg.toCompoundExpression(resultArg, false);
                            } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
                              let resultArg = this.getRawArgument([result.path.arguments], param) as Fmt.CompoundExpression;
                              let newArg = new FmtHLM.ObjectContents_SubsetArg;
                              newArg._set = superset;
                              newArg.toCompoundExpression(resultArg, false);
                            }
                            return result;
                          } else {
                            return undefined;
                          }
                        });
                      } else {
                        return undefined;
                      }
                    }
                  });
                }
              } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
                if (inTypeCast) {
                  supersetResult = supersetResult.then((currentResult: Fmt.Expression | undefined): Fmt.Expression | undefined | CachedPromise<Fmt.Expression | undefined> => {
                    if (currentResult) {
                      return currentResult;
                    } else {
                      let argValue = this.getArgValue(term.path.arguments, param);
                      if (argValue) {
                        return this.getNextTypeCastTerm(argValue, followEmbeddings).then((newTerm: Fmt.Expression | undefined) => {
                          if (newTerm) {
                            let result = term.clone() as Fmt.DefinitionRefExpression;
                            let resultArg = this.getArgument([result.path.arguments], param, FmtHLM.ObjectContents_ElementArg)!;
                            resultArg.element = newTerm;
                            return result;
                          } else {
                            return undefined;
                          }
                        });
                      } else {
                        return undefined;
                      }
                    }
                  });
                }
              }
            }
            return supersetResult;
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
          let definitionList = definition.contents.definition;
          if (definitionList.length) {
            let item = definitionList[0];
            return this.substitutePath(item, term.path, [definition]);
          }
        }
        return undefined;
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
      let resultPromise: CachedPromise<Fmt.Expression | undefined> = CachedPromise.resolve(this.getWildcardFinalSet());
      for (let structuralCase of term.cases) {
        resultPromise = resultPromise.then((currentResult: Fmt.Expression | undefined) => {
          if (currentResult && !this.isWildcardFinalSet(currentResult)) {
            return currentResult;
          } else {
            if (this.referencesCaseParameter(structuralCase)) {
              if (term.cases.length === 1 && term.term instanceof Fmt.DefinitionRefExpression && term.term.path.parentPath instanceof Fmt.Path && structuralCase._constructor instanceof Fmt.DefinitionRefExpression && structuralCase._constructor.path.parentPath instanceof Fmt.Path) {
                if (term.term.path.parentPath.isEquivalentTo(structuralCase._constructor.path.parentPath) && term.term.path.name === structuralCase._constructor.path.name) {
                  let constructorPath = term.term.path;
                  return this.getOuterDefinition(structuralCase._constructor).then((definition: Fmt.Definition) => {
                    let innerDefinition = definition.innerDefinitions.getDefinition(constructorPath.name);
                    let substituted = this.substituteParameters(structuralCase.value, structuralCase.parameters!, innerDefinition.parameters);
                    return this.substitutePath(substituted, constructorPath, [definition, innerDefinition]);
                  });
                }
              } else if (term.term instanceof FmtHLM.MetaRefExpression_structuralCases && term.term.cases.length === 1) {
                let innerTerm = term.term;
                let innerStructuralCase = innerTerm.cases[0];
                let innerResultTerm = this.buildSingleStructuralCaseSetTerm(innerStructuralCase.value, term.construction, structuralCase._constructor, structuralCase.parameters, structuralCase.value);
                return this.buildSingleStructuralCaseSetTerm(innerTerm.term, innerTerm.construction, innerStructuralCase._constructor, innerStructuralCase.parameters, innerResultTerm);
              }
              return this.resolveElementTerm(term.term).then((resolvedTerms: Fmt.Expression[] | undefined) => {
                if (resolvedTerms && resolvedTerms.length === 1) {
                  return this.buildSingleStructuralCaseSetTerm(resolvedTerms[0], term.construction, structuralCase._constructor, structuralCase.parameters, structuralCase.value);
                } else {
                  return this.getNextSuperset(structuralCase.value, followEmbeddings, inTypeCast).then((superset: Fmt.Expression | undefined) => {
                    if (superset || term.cases.length > 1 || structuralCase.rewrite) {
                      return this.buildSingleStructuralCaseSetTerm(term.term, term.construction, structuralCase._constructor, structuralCase.parameters, superset || structuralCase.value);
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
      return resultPromise;
    } else if (term instanceof FmtHLM.MetaRefExpression_setAssociative) {
      return CachedPromise.resolve(term.term);
    } else {
      return CachedPromise.reject(new Error('Set term expected'));
    }
  }

  private getNextTypeCastTerm(term: Fmt.Expression, followEmbeddings: boolean): CachedPromise<Fmt.Expression | undefined> {
    if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      return this.getNextSuperset(term._set, followEmbeddings, true).then((superset: Fmt.Expression | undefined) => {
        if (superset) {
          return this.getTypeCastTerm(superset);
        } else {
          return undefined;
        }
      });
    } else {
      return this.getDeclaredSet(term).then((set: Fmt.Expression) => this.getTypeCastTerm(set));
    }
  }

  private getTypeCastTerm(set: Fmt.Expression): Fmt.Expression {
    let newTerm = new FmtHLM.MetaRefExpression_asElementOf;
    newTerm.term = new FmtHLM.MetaRefExpression_previous;
    newTerm._set = set;
    return newTerm;
  }

  getFinalSuperset(term: Fmt.Expression, followEmbeddings: boolean, inTypeCast: boolean = false): CachedPromise<Fmt.Expression> {
    return this.getFinalSupersetInternal(term, followEmbeddings, inTypeCast, []);
  }

  private getFinalSupersetInternal(term: Fmt.Expression, followEmbeddings: boolean, inTypeCast: boolean, visitedDefinitions: Fmt.DefinitionRefExpression[]): CachedPromise<Fmt.Expression> {
    if (term instanceof Fmt.DefinitionRefExpression) {
      for (let visitedDefinition of visitedDefinitions) {
        if (term.isEquivalentTo(visitedDefinition)) {
          return CachedPromise.reject(new Error('Invalid circular reference'));
        }
      }
      visitedDefinitions.push(term);
    }
    return this.getNextSuperset(term, followEmbeddings, inTypeCast).then((next: Fmt.Expression | undefined) => {
      if (next) {
        return this.getFinalSupersetInternal(next, followEmbeddings, inTypeCast, visitedDefinitions);
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
              if (definition.contents.definition.length) {
                let item = definition.contents.definition[0];
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
              let libraryDataAccessor = this.libraryDataAccessor.getAccessorForSection(path.parentPath);
              return HLMMacros.instantiateMacro(libraryDataAccessor, definition)
                .then((macroInstance: HLMMacro.HLMMacroInstance) => macroInstance.invoke(this, path))
                .then((macroInvocation: HLMMacro.HLMMacroInvocation) => macroInvocation.getDeclaredSet());
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
              return this.buildSingleStructuralCaseSetTerm(structuralCasesTerm.term, structuralCasesTerm.construction, structuralCase._constructor, structuralCase.parameters, declaredSet);
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
      } else {
        return CachedPromise.reject(new Error('Element term expected'));
      }
    }
  }

  getFinalSet(term: Fmt.Expression, followEmbeddings: boolean): CachedPromise<Fmt.Expression> {
    return this.getDeclaredSet(term).then((set: Fmt.Expression) => this.getFinalSuperset(set, followEmbeddings));
  }

  getWildcardFinalSet(): Fmt.Expression {
    return new FmtHLM.MetaRefExpression_enumeration;
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

  negateFormula(formula: Fmt.Expression): CachedPromise<Fmt.Expression> {
    if (formula instanceof FmtHLM.MetaRefExpression_not) {
      return CachedPromise.resolve(formula.formula);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and) {
      return this.negateFormulae(formula.formulae).then((negatedFormulae: Fmt.Expression[] | undefined) => {
        let result = new FmtHLM.MetaRefExpression_or;
        result.formulae = negatedFormulae;
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      return this.negateFormulae(formula.formulae).then((negatedFormulae: Fmt.Expression[] | undefined) => {
        let result = new FmtHLM.MetaRefExpression_and;
        result.formulae = negatedFormulae;
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

  negateFormulae(formulae: Fmt.Expression[] | undefined): CachedPromise<Fmt.Expression[] | undefined> {
    if (formulae) {
      let result: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
      for (let formula of formulae) {
        result = result.then((negatedFormulae: Fmt.Expression[]) =>
          this.negateFormula(formula).then((negatedFormula: Fmt.Expression) =>
            negatedFormulae.concat(negatedFormula)
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
      if (formula.formulae) {
        for (let item of formula.formulae) {
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
      if (formula.formulae) {
        let formulae = formula.formulae;
        for (let item of formulae) {
          resultPromise = resultPromise.then((currentResult: boolean) => {
            if (currentResult) {
              return true;
            } else {
              return this.isTrivialTautology(item);
            }
          });
          if (item !== formulae[0]) {
            resultPromise = resultPromise.then((currentResult: boolean) => {
              if (currentResult) {
                return true;
              } else {
                return this.negateFormula(item).then((negatedItem: Fmt.Expression) => {
                  for (let previousItem of formulae) {
                    if (previousItem === item) {
                      break;
                    }
                    if (this.areFormulaeSyntacticallyEquivalent(negatedItem, previousItem)) {
                      return true;
                    }
                    if (previousItem instanceof FmtHLM.MetaRefExpression_not && this.areFormulaeSyntacticallyEquivalent(item, formula)) {
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
      if (formula.left.isEquivalentTo(formula.right)) {
        return CachedPromise.resolve(true);
      }
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
    if (this.areFormulaeSyntacticallyEquivalent(sourceFormula, targetFormula)) {
      return CachedPromise.resolve(true);
    }
    if (sourceFormula instanceof FmtHLM.MetaRefExpression_and) {
      let resultPromise = this.isTrivialTautology(targetFormula);
      if (sourceFormula.formulae) {
        for (let item of sourceFormula.formulae) {
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
      if (sourceFormula.formulae) {
        for (let item of sourceFormula.formulae) {
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
      if (targetFormula.formulae) {
        for (let item of targetFormula.formulae) {
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
      if (targetFormula.formulae) {
        for (let item of targetFormula.formulae) {
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

  private areFormulaeSyntacticallyEquivalent(left: Fmt.Expression, right: Fmt.Expression): boolean {
    let fn = (leftPart: Fmt.Expression, rightPart: Fmt.Expression) => {
      if ((leftPart instanceof FmtHLM.MetaRefExpression_equals && rightPart instanceof FmtHLM.MetaRefExpression_equals)
          || (leftPart instanceof FmtHLM.MetaRefExpression_setEquals && rightPart instanceof FmtHLM.MetaRefExpression_setEquals)) {
        return ((leftPart.left.isEquivalentTo(rightPart.left) && leftPart.right.isEquivalentTo(rightPart.right))
                || (leftPart.left.isEquivalentTo(rightPart.right) && leftPart.right.isEquivalentTo(rightPart.left)));
      }
      return false;
    };
    return left.isEquivalentTo(right, fn);
  }
}
