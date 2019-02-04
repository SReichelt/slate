import { GenericUtils } from '../generic/utils';
import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import CachedPromise from '../../data/cachedPromise';

export class HLMUtils extends GenericUtils {
  private getArgValueArg(argValue: Fmt.CompoundExpression, paramType: Fmt.Expression): Fmt.Expression | undefined {
    if (paramType instanceof FmtHLM.MetaRefExpression_Set) {
      let setArg = new FmtHLM.ObjectContents_SetArg;
      setArg.fromCompoundExpression(argValue);
      return setArg._set;
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Subset) {
      let subsetArg = new FmtHLM.ObjectContents_SubsetArg;
      subsetArg.fromCompoundExpression(argValue);
      return subsetArg._set;
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Element) {
      let elementArg = new FmtHLM.ObjectContents_ElementArg;
      elementArg.fromCompoundExpression(argValue);
      return elementArg.element;
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Symbol) {
      let symbolArg = new FmtHLM.ObjectContents_SymbolArg;
      symbolArg.fromCompoundExpression(argValue);
      return symbolArg.symbol;
    } else {
      return undefined;
    }
  }

  getParameterArgument(param: Fmt.Parameter, targetPath?: Fmt.PathItem, indices?: Fmt.Expression[]): Fmt.Argument | undefined {
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Symbol || type instanceof FmtHLM.MetaRefExpression_Binding) {
      let arg = new Fmt.Argument;
      arg.name = param.name;
      let argValue = new Fmt.CompoundExpression;
      if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        let bindingArg = new FmtHLM.ObjectContents_BindingArg;
        let bindingArgParam = new Fmt.Parameter;
        bindingArgParam.name = param.name;
        let bindingArgParamType = new Fmt.Type;
        let bindingArgParamTypeExpr = new FmtHLM.MetaRefExpression_Element;
        bindingArgParamTypeExpr._set = this.substitutePath(type._set, targetPath);
        bindingArgParamType.expression = bindingArgParamTypeExpr;
        bindingArgParamType.arrayDimensions = 0;
        bindingArgParam.type = bindingArgParamType;
        bindingArgParam.optional = false;
        bindingArgParam.list = false;
        bindingArg.parameter = bindingArgParam;
        let indexExpr = new Fmt.VariableRefExpression;
        indexExpr.variable = bindingArgParam;
        let newIndices = indices ? indices.concat([indexExpr]) : [indexExpr];
        bindingArg.arguments = this.getParameterArguments(type.parameters, targetPath, newIndices);
        bindingArg.toCompoundExpression(argValue);
      } else {
        let varExpr = new Fmt.VariableRefExpression;
        varExpr.variable = param;
        varExpr.indices = indices;
        if (type instanceof FmtHLM.MetaRefExpression_Set) {
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
        } else if (type instanceof FmtHLM.MetaRefExpression_Symbol) {
          let symbolArg = new FmtHLM.ObjectContents_SymbolArg;
          symbolArg.symbol = varExpr;
          symbolArg.toCompoundExpression(argValue);
        }
      }
      arg.value = argValue;
      return arg;
    }
    return undefined;
  }

  getParameterArguments(parameters: Fmt.ParameterList, targetPath?: Fmt.PathItem, indices?: Fmt.Expression[]): Fmt.ArgumentList {
    let result = Object.create(Fmt.ArgumentList.prototype);
    for (let param of parameters) {
      let arg = this.getParameterArgument(param, targetPath, indices);
      if (arg) {
        result.push(arg);
      }
    }
    return result;
  }

  getStructuralCaseTerm(construction: Fmt.Path, structuralCase: FmtHLM.ObjectContents_StructuralCase): CachedPromise<Fmt.Expression> {
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
        result = this.substitutePath(result, constructionPath.parentPath);
        result = this.substituteArguments(result, constructionDefinition.parameters, constructionPath.arguments);
      } else {
        let resultPath = new Fmt.Path;
        resultPath.parentPath = constructionPath;
        resultPath.name = constructorPath.name;
        resultPath.arguments = this.getParameterArguments(constructorDefinition.parameters, constructionPath.parentPath);
        let resultRef = new Fmt.DefinitionRefExpression;
        resultRef.path = resultPath;
        result = resultRef;
      }
      if (constructorDefinition.parameters.length) {
        result = this.substituteParameters(result, constructorDefinition.parameters, structuralCase.parameters!);
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
    fullConstructionPath.arguments = this.getParameterArguments(construction.parameters, constructionPath.parentPath);
    let resultPath = new Fmt.Path;
    resultPath.parentPath = fullConstructionPath;
    resultPath.name = constructorPath.name;
    resultPath.arguments = constructorPath.arguments;
    let resultRef = new Fmt.DefinitionRefExpression;
    resultRef.path = resultPath;
    return resultRef;
  }

  substituteParameters(expression: Fmt.Expression, originalParameters: Fmt.ParameterList, substitutedParameters: Fmt.ParameterList): Fmt.Expression {
    for (let paramIndex = 0; paramIndex < originalParameters.length; paramIndex++) {
      let originalParam = originalParameters[paramIndex];
      let substitutedParam = substitutedParameters[paramIndex];
      expression = this.substituteVariable(expression, originalParam, (indices?: Fmt.Expression[]) => {
        let substitutedExpression = new Fmt.VariableRefExpression;
        substitutedExpression.variable = substitutedParam;
        substitutedExpression.indices = indices;
        return substitutedExpression;
      });
      let originalType = originalParam.type.expression;
      if (originalType instanceof FmtHLM.MetaRefExpression_Binding) {
        let substitutedType = substitutedParam.type.expression as FmtHLM.MetaRefExpression_Binding;
        expression = this.substituteParameters(expression, originalType.parameters, substitutedType.parameters);
      }
    }
    return expression;
  }

  substituteArguments(expression: Fmt.Expression, parameters: Fmt.ParameterList, args: Fmt.ArgumentList, indexVariables?: Fmt.Parameter[]): Fmt.Expression {
    for (let param of parameters) {
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Symbol) {
        let argValue = args.getValue(param.name) as Fmt.CompoundExpression;
        let argValueArg = this.getArgValueArg(argValue, type)!;
        expression = this.substituteVariable(expression, param, (indices?: Fmt.Expression[]) => {
          let substitutedArg = argValueArg;
          if (indexVariables) {
            for (let index = 0; index < indexVariables.length; index++) {
              substitutedArg = this.substituteVariable(substitutedArg, indexVariables[index], () => indices![index]);
            }
          }
          return substitutedArg;
        });
      } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        let argValue = args.getValue(param.name) as Fmt.CompoundExpression;
        let bindingArgValue = new FmtHLM.ObjectContents_BindingArg;
        bindingArgValue.fromCompoundExpression(argValue);
        let newIndexVariables = indexVariables ? indexVariables.concat([bindingArgValue.parameter]) : [bindingArgValue.parameter];
        expression = this.substituteArguments(expression, type.parameters, bindingArgValue.arguments, newIndexVariables);
      }
    }
    return expression;
  }

  substituteIndices(expression: Fmt.Expression, variable: Fmt.VariableRefExpression): Fmt.Expression {
    if (variable.indices) {
      for (let index of variable.indices) {
        // TODO
        //let bindingVariable = (the parent binding of variable.variable that belongs to index);
        //expression = this.substituteVariable(expression, bindingVariable, () => index);
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

  getProofStepResult(step: Fmt.Parameter, previousResult?: Fmt.Expression): Fmt.Expression {
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
        let variable = type.variable.variable;
        let variableType = variable.type.expression;
        if (variableType instanceof FmtHLM.MetaRefExpression_Subset) {
          let result = new FmtHLM.MetaRefExpression_sub;
          result.subset = type.variable;
          result.superset = this.substituteIndices(variableType.superset, type.variable);
          return result;
        } else if (variableType instanceof FmtHLM.MetaRefExpression_Element) {
          let result = new FmtHLM.MetaRefExpression_in;
          result.element = type.variable;
          result._set = this.substituteIndices(variableType._set, type.variable);
          return result;
        } else if (variableType instanceof FmtHLM.MetaRefExpression_Constraint) {
          return variableType.formula;
        } else {
          return this.getProofStepResult(type.variable.variable, previousResult);
        }
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
    } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
      if (previousResult instanceof FmtHLM.MetaRefExpression_forall) {
        return this.substituteArguments(previousResult.formula, previousResult.parameters, type.arguments);
      } else {
        throw new Error('Previous result is not a universally quantified expression');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Embed) {
      let result = new FmtHLM.MetaRefExpression_equals;
      result.left = type.input;
      result.right = type.output;
      return result;
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
      throw new Error('Proof step does not have a result');
    }
  }
}
