import { GenericUtils, SubstitutionContext } from '../generic/utils';
import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as FmtHLM from './meta';
import { HLMExpressionType } from './types';
import * as Macro from '../macro';
import * as HLMMacro from './macro';
import * as HLMMacros from './macros/macros';
import { LibraryDefinition } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

export class HLMSubstitutionContext extends SubstitutionContext {}

export interface HLMBaseContext {
  stepResults: Map<Fmt.Parameter, Fmt.Expression>;
}

export interface HLMProofStepContext extends HLMBaseContext {
  originalGoal?: Fmt.Expression;
  goal?: Fmt.Expression;
  previousResult?: Fmt.Expression;
}

export interface HLMUnfoldParameters {
  // Unfold variables of type %SetDef and %Def.
  unfoldVariableDefinitions: boolean;

  // Unfold explicit operator definitions. In HLMTypeSearchParameters, also influences followSupersets and followEmbeddings.
  followDefinitions: boolean;

  // Unfold macro operators. This should usually be equal to followDefinitions, but we avoid unfolding macros in type searches.
  unfoldMacros: boolean;

  // If false, avoid unfolding operator definitions that yield unsubstituted structural case expressions.
  allowStructuralCaseResults: boolean;

  // If true, all other settings apply to arguments as well, including indices.
  // Otherwise they only apply to the root, or, in the case of substituteStructuralCases and extractStructuralCases, to root arguments.
  unfoldArguments: boolean;

  // Replace structural case expressions with their value if the constructor term is given by a specific constructor expression.
  // Note that the constructor term is automatically unfolded partially to determine whether this is the case (castAndFullyUnfoldElementTermOutside),
  // as this substitution rather strongly simplifies the result even if such unfolding was necessary.
  substituteStructuralCases: boolean;

  // If false, when unfolding a definition that contains a structural expression, avoid constructor terms as results.
  // This is important in unfoldStrictSimplifications, as the resulting term is not actually perceived as simpler.
  // TODO clean this up, using unit tests that specify exactly what to unfold when
  allowConstructorResultsFromStructuralDefinitionSubstitution: boolean;

  // If a structural case expression appears at an inner location without additional binders, move it to the outside.
  // This includes:
  // * Arguments, including indices (at the root level, or in case of unfoldArguments at deeper levels).
  // * The constructor term of a structural case expression at the root.
  extractStructuralCases: boolean;

  // Set by unfoldsTo to exclude unfold operations that "cannot possibly" lead to the desired result.
  // (At the moment, this is a heuristic that sometimes fails.)
  requiredUnfoldLocation?: Fmt.Expression;
}

export const unfoldAll: HLMUnfoldParameters = {
  unfoldVariableDefinitions: true,
  followDefinitions: true,
  unfoldMacros: true,
  allowStructuralCaseResults: false,
  unfoldArguments: true,
  substituteStructuralCases: true,
  allowConstructorResultsFromStructuralDefinitionSubstitution: true,
  extractStructuralCases: true
};

export const unfoldStrictSimplifications: HLMUnfoldParameters = {
  unfoldVariableDefinitions: false,
  followDefinitions: false,
  unfoldMacros: false,
  allowStructuralCaseResults: false,
  unfoldArguments: true,
  substituteStructuralCases: true,
  allowConstructorResultsFromStructuralDefinitionSubstitution: false,
  extractStructuralCases: false
};

export interface HLMTypeSearchParameters extends HLMUnfoldParameters {
  // In addition to unfolding, also return declared supersets of the given set.
  followSupersets?: boolean;

  // In addition to unfolding, also return declared subsets of the given set which are given by embeddings.
  // Requires followDefinitions to be set as well.
  followEmbeddings?: boolean;

  // If a set operator has several alternative definitions, follow all of them instead of just the first.
  followAllAlternatives?: boolean;
}

export const eliminateVariablesOnly: HLMTypeSearchParameters = {
  unfoldVariableDefinitions: true,
  followDefinitions: false,
  followSupersets: true,
  followEmbeddings: false,
  followAllAlternatives: false,
  unfoldMacros: false,
  allowStructuralCaseResults: true,
  unfoldArguments: false,
  substituteStructuralCases: false,
  allowConstructorResultsFromStructuralDefinitionSubstitution: false,
  extractStructuralCases: false
};

export const findExplicitlyDeclaredSuperset: HLMTypeSearchParameters = {
  unfoldVariableDefinitions: true,
  followDefinitions: true,
  followSupersets: true,
  followEmbeddings: false,
  followAllAlternatives: true,
  unfoldMacros: false,
  allowStructuralCaseResults: true,
  unfoldArguments: false,
  substituteStructuralCases: false,
  allowConstructorResultsFromStructuralDefinitionSubstitution: false,
  extractStructuralCases: false
};

export const findFinalSuperset: HLMTypeSearchParameters = {
  unfoldVariableDefinitions: true,
  followDefinitions: true,
  followSupersets: true,
  followEmbeddings: false,
  followAllAlternatives: false,
  unfoldMacros: false,
  allowStructuralCaseResults: true,
  unfoldArguments: false,
  substituteStructuralCases: false,
  allowConstructorResultsFromStructuralDefinitionSubstitution: false,
  extractStructuralCases: false
};

export const findConstruction: HLMTypeSearchParameters = {
  unfoldVariableDefinitions: true,
  followDefinitions: true,
  followSupersets: true,
  followEmbeddings: false,
  followAllAlternatives: false,
  unfoldMacros: false,
  allowStructuralCaseResults: true,
  unfoldArguments: false,
  substituteStructuralCases: true,
  allowConstructorResultsFromStructuralDefinitionSubstitution: true,
  extractStructuralCases: false
};

export const followEmbedding: HLMTypeSearchParameters = {
  unfoldVariableDefinitions: true,
  followDefinitions: true,
  followSupersets: false,
  followEmbeddings: true,
  followAllAlternatives: true,
  unfoldMacros: false,
  allowStructuralCaseResults: true,
  unfoldArguments: false,
  substituteStructuralCases: false,
  allowConstructorResultsFromStructuralDefinitionSubstitution: false,
  extractStructuralCases: false
};

export const followSupersetsAndEmbeddings: HLMTypeSearchParameters = {
  unfoldVariableDefinitions: true,
  followDefinitions: true,
  followSupersets: true,
  followEmbeddings: true,
  followAllAlternatives: false,
  unfoldMacros: false,
  allowStructuralCaseResults: true,
  unfoldArguments: false,
  substituteStructuralCases: false,
  allowConstructorResultsFromStructuralDefinitionSubstitution: false,
  extractStructuralCases: false
};

export interface HLMFormulaDefinition {
  formula: Fmt.Expression;
  definitionRef?: Fmt.DefinitionRefExpression;
  side?: number;
}

export interface HLMFormulaCase {
  parameters?: Fmt.ParameterList;
  formula: Fmt.Expression;
}

export interface HLMFormulaCases {
  cases: HLMFormulaCase[];
  side?: number;
}

export interface HLMEquivalenceListInfo {
  items: Fmt.Expression[];
  getEquivalenceGoal: (from: Fmt.Expression, to: Fmt.Expression, proofParameters: Fmt.ParameterList) => Fmt.Expression;
  wrapAround: boolean;
}

export interface HLMSubstitutionSourceInfo {
  source: Fmt.Expression;
  targets: Fmt.Expression[];
}

export interface HLMSubstitutionResult {
  sourceIndex: number;
  result: Fmt.Expression;
}

type CreatePlaceholderFn = (placeholderType: HLMExpressionType) => Fmt.PlaceholderExpression;

function createStandardPlaceholder(placeholderType: HLMExpressionType) {
  return new Fmt.PlaceholderExpression(placeholderType);
}

class HLMMacroInvocationConfig extends Macro.DefaultMacroInvocationConfig {
  constructor(protected utils: HLMUtils, protected parentPath: Fmt.PathItem | undefined) {
    super();
  }

  createArgumentExpression(param: Fmt.Parameter): Fmt.Expression | undefined {
    const substitutionContext = new HLMSubstitutionContext;
    this.utils.addTargetPathSubstitution(this.parentPath, substitutionContext);
    return this.utils.createArgumentItemValue(param, substitutionContext);
  }
}

class HLMMacroInvocationConfigWithPlaceholders extends HLMMacroInvocationConfig {
  getNumberExpression(value: number, onSetValue?: (newValue: number) => void): Fmt.Expression {
    if (value || !onSetValue) {
      return super.getNumberExpression(value);
    } else {
      const result = new Fmt.PlaceholderExpression(undefined);
      result.specialRole = Fmt.SpecialPlaceholderRole.Temporary;
      result.onFill = (expression: Fmt.Expression) => {
        if (expression instanceof Fmt.IntegerExpression) {
          onSetValue(Number(expression.value));
        }
      };
      return result;
    }
  }
}

interface ClonedExpressionInfo<T> {
  clonedExpression: Fmt.Expression;
  expressionType: HLMExpressionType;
  targetObject: T;
}

interface ConstructionEqualityInstance {
  constructionPath: Fmt.Path;
  leftTerms: Fmt.DefinitionRefExpression[];
  rightTerms: Fmt.DefinitionRefExpression[];
}

export class HLMUtils extends GenericUtils {
  getRawArgument(argumentList: Fmt.ArgumentList, param: Fmt.Parameter): Fmt.Expression {
    return argumentList.getValue(param.name);
  }

  getArgument<ContentClass extends Fmt.ObjectContents>(argumentList: Fmt.ArgumentList, param: Fmt.Parameter, contentClass: {createFromExpression(expression: Fmt.Expression): ContentClass}): ContentClass {
    const rawArg = this.getRawArgument(argumentList, param);
    return contentClass.createFromExpression(rawArg);
  }

  getArgValue(argumentList: Fmt.ArgumentList, param: Fmt.Parameter): Fmt.Expression {
    const arg = this.getRawArgument(argumentList, param);
    return this.extractArgValue(arg);
  }

  extractArgValue(arg: Fmt.Expression): Fmt.Expression {
    if (arg instanceof Fmt.CompoundExpression) {
      if (arg.arguments.length && (arg.arguments[0].name === undefined || arg.arguments.length === 1)) {
        return arg.arguments[0].value;
      } else {
        throw new Error('Missing argument');
      }
    } else {
      return arg;
    }
  }

  isValueParamType(type: Fmt.Expression): boolean {
    return (type instanceof FmtHLM.MetaRefExpression_Prop || type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_Element);
  }

  getParameterExpressionType(param: Fmt.Parameter): HLMExpressionType | undefined {
    const type = param.type;
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

  getParameterArgument(param: Fmt.Parameter, context?: HLMSubstitutionContext, targetParam?: Fmt.Parameter, addIndices?: (expression: Fmt.Expression) => Fmt.Expression): Fmt.Argument | undefined {
    const type = param.type;
    if (this.isValueParamType(type) || type instanceof FmtHLM.MetaRefExpression_Binder) {
      let value: Fmt.Expression;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        const targetType = targetParam ? targetParam.type as FmtHLM.MetaRefExpression_Binder : undefined;
        const sourceParameters = targetType ? targetType.sourceParameters : this.applySubstitutionContextToParameterList(type.sourceParameters, context);
        const newContext = new HLMSubstitutionContext(context);
        this.addParameterListSubstitution(type.sourceParameters, sourceParameters, newContext);
        const targetInnerParameters = targetType?.targetParameters;
        const addNewIndices = (expression: Fmt.Expression) => {
          const index: Fmt.Index = {
            parameters: sourceParameters,
            arguments: this.getParameterArguments(sourceParameters, context, undefined, addIndices)
          };
          return new Fmt.IndexedExpression(addIndices ? addIndices(expression) : expression, index);
        };
        const targetArguments = this.getParameterArguments(type.targetParameters, newContext, targetInnerParameters, addNewIndices);
        const binderArg = new FmtHLM.ObjectContents_BinderArg(sourceParameters, targetArguments);
        value = binderArg.toExpression(false);
      } else {
        const variableRefExpression = new Fmt.VariableRefExpression(param);
        value = addIndices ? addIndices(variableRefExpression) : variableRefExpression;
      }
      return new Fmt.Argument(param.name, value);
    }
    // No need to adjust context according to parameter; it is only used for binders.
    return undefined;
  }

  getParameterArguments(parameters: Fmt.Parameter[], context?: HLMSubstitutionContext, targetParameters?: Fmt.Parameter[], addIndices?: (expression: Fmt.Expression) => Fmt.Expression): Fmt.ArgumentList {
    const result = new Fmt.ArgumentList;
    for (let paramIndex = 0; paramIndex < parameters.length; paramIndex++) {
      const param = parameters[paramIndex];
      const targetParam = targetParameters ? targetParameters[paramIndex] : undefined;
      const arg = this.getParameterArgument(param, context, targetParam, addIndices);
      if (arg) {
        result.push(arg);
      }
    }
    return result;
  }

  isTrueFormula(formula: Fmt.Expression): boolean {
    return (formula instanceof FmtHLM.MetaRefExpression_and && !formula.formulas);
  }

  isFalseFormula(formula: Fmt.Expression): boolean {
    return (formula instanceof FmtHLM.MetaRefExpression_or && !formula.formulas);
  }

  createConjunction(formulas: Fmt.Expression[]): Fmt.Expression {
    return this.simplifyConjunctionItems(formulas) ?? new FmtHLM.MetaRefExpression_and(...formulas);
  }

  private simplifyConjunctionItems(items: Fmt.Expression[]): Fmt.Expression | undefined {
    if (items.length === 1) {
      return items[0];
    } else {
      let resultItems: Fmt.Expression[] | undefined = undefined;
      let index = 0;
      for (const item of items) {
        if (this.isFalseFormula(item)) {
          return item;
        } else if (item instanceof FmtHLM.MetaRefExpression_and) {
          if (!resultItems) {
            resultItems = items.slice(0, index);
          }
          if (item.formulas) {
            resultItems.push(...item.formulas);
          }
        } else if (resultItems) {
          resultItems.push(item);
        }
        index++;
      }
      if (resultItems) {
        return new FmtHLM.MetaRefExpression_and(...resultItems);
      } else {
        return undefined;
      }
    }
  }

  createDisjunction(formulas: Fmt.Expression[]): Fmt.Expression {
    return this.simplifyDisjunctionItems(formulas) ?? new FmtHLM.MetaRefExpression_or(...formulas);
  }

  private simplifyDisjunctionItems(items: Fmt.Expression[]): Fmt.Expression | undefined {
    if (items.length === 1) {
      return items[0];
    } else {
      let resultItems: Fmt.Expression[] | undefined = undefined;
      let index = 0;
      for (const item of items) {
        if (this.isTrueFormula(item)) {
          return item;
        } else if (item instanceof FmtHLM.MetaRefExpression_or) {
          if (!resultItems) {
            resultItems = items.slice(0, index);
          }
          if (item.formulas) {
            resultItems.push(...item.formulas);
          }
        } else if (resultItems) {
          resultItems.push(item);
        }
        index++;
      }
      if (resultItems) {
        return new FmtHLM.MetaRefExpression_or(...resultItems);
      } else {
        return undefined;
      }
    }
  }

  createEquivalence(formulas: Fmt.Expression[]): Fmt.Expression {
    return this.simplifyEquivalenceItems(formulas) ?? new FmtHLM.MetaRefExpression_equiv(...formulas);
  }

  private simplifyEquivalenceItems(items: Fmt.Expression[]): Fmt.Expression | undefined {
    if (items.length <= 1) {
      return new FmtHLM.MetaRefExpression_and;
    } else {
      let hasTrueItem = false;
      let hasFalseItem = false;
      let resultItems: Fmt.Expression[] | undefined = undefined;
      let index = 0;
      for (const item of items) {
        if (this.isTrueFormula(item)) {
          hasTrueItem = true;
          if (!resultItems) {
            resultItems = items.slice(0, index);
          }
        } if (this.isFalseFormula(item)) {
          hasFalseItem = true;
          if (!resultItems) {
            resultItems = items.slice(0, index);
          }
        } else if (resultItems) {
          resultItems.push(item);
        }
        index++;
      }
      if (resultItems) {
        if (!hasFalseItem) {
          return this.createConjunction(resultItems);
        } else if (!hasTrueItem) {
          return this.createConjunction(this.negateFormulas(resultItems, false).getImmediateResult()!);
        } else {
          return new FmtHLM.MetaRefExpression_or;
        }
      } else {
        return undefined;
      }
    }
  }

  getStructuralCaseTerm(constructionPath: Fmt.Path, structuralCase: FmtHLM.ObjectContents_StructuralCase): CachedPromise<Fmt.Expression> {
    const constructionDefinitionPromise = this.libraryDataAccessor.fetchItem(constructionPath, false);
    const resultPromise = constructionDefinitionPromise.then((libraryDefinition: LibraryDefinition) => {
      const constructionDefinition = libraryDefinition.definition;
      const constructorExpr = structuralCase._constructor as Fmt.DefinitionRefExpression;
      const constructorPath = constructorExpr.path;
      const constructorDefinition = constructionDefinition.innerDefinitions.getDefinition(constructorExpr.path.name);
      const constructorContents = constructorDefinition.contents as FmtHLM.ObjectContents_Constructor;
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
      const context = new SubstitutionContext;
      this.addTargetPathSubstitution(constructionPath.parentPath, context);
      const resultArgs = this.getParameterArguments(constructorDefinition.parameters, context, structuralCase.parameters);
      const resultPath = new Fmt.Path(constructorPath.name, resultArgs, constructionPath);
      result = new Fmt.DefinitionRefExpression(resultPath);
    }
    if (constructorDefinition.parameters.length) {
      result = this.substituteParameters(result, constructorDefinition.parameters, structuralCase.parameters!);
    }
    return result;
  }

  getStructuralCaseConstraintParameter(term: Fmt.Expression, structuralCaseTerm: Fmt.Expression): Fmt.Parameter {
    const structuralCaseEquality = new FmtHLM.MetaRefExpression_equals(term, structuralCaseTerm);
    return this.createConstraintParameter(structuralCaseEquality, '_');
  }

  getStructuralCaseParametersWithConstraint(term: Fmt.Expression, structuralCase: FmtHLM.ObjectContents_StructuralCase, structuralCaseTerm: Fmt.Expression): Fmt.ParameterList {
    const result = new Fmt.ParameterList;
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
    const context = new SubstitutionContext;
    this.addParameterListSubstitution(originalParameters, substitutedParameters, context);
    return this.applySubstitutionContext(expression, context);
  }

  addParameterSubstitution(originalParam: Fmt.Parameter, substitutedParam: Fmt.Parameter, context: SubstitutionContext): void {
    context.replacedParameters.push({
      original: originalParam,
      replacement: substitutedParam
    });
    const originalType = originalParam.type;
    const substitutedType = substitutedParam.type;
    if (originalType instanceof FmtHLM.MetaRefExpression_Binder && substitutedType instanceof FmtHLM.MetaRefExpression_Binder) {
      this.addParameterListSubstitution(originalType.sourceParameters, substitutedType.sourceParameters, context);
      this.addParameterListSubstitution(originalType.targetParameters, substitutedType.targetParameters, context);
    }
  }

  substituteParameter(expression: Fmt.Expression, originalParam: Fmt.Parameter, substitutedParam: Fmt.Parameter): Fmt.Expression {
    const context = new SubstitutionContext;
    this.addParameterSubstitution(originalParam, substitutedParam, context);
    return this.applySubstitutionContext(expression, context);
  }

  addArgumentListSubstitution(parameters: Fmt.Parameter[], args: Fmt.ArgumentList, targetPath: Fmt.PathItem | undefined, context: SubstitutionContext): void {
    const previousParameters: Fmt.Parameter[] = [];
    for (const param of parameters) {
      let type = param.type;
      if (this.isValueParamType(type)) {
        const argValue = this.getArgValue(args, param);
        this.addVariableSubstitution(param, argValue, context);
      } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        const argValue = this.getArgument(args, param, FmtHLM.ObjectContents_BinderArg);
        this.addParameterListSubstitution(type.sourceParameters, argValue.sourceParameters, context);
        this.addArgumentListSubstitution(type.targetParameters, argValue.targetArguments, targetPath, context);
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
        let value = type instanceof FmtHLM.MetaRefExpression_SetDef ? type._set : type.element;
        const valueContext = new SubstitutionContext;
        this.addTargetPathSubstitution(targetPath, valueContext);
        this.addArgumentListSubstitution(previousParameters, args, targetPath, valueContext);
        value = this.applySubstitutionContext(value, valueContext);
        this.addVariableSubstitution(param, value, context);
      } else {
        while (type instanceof Fmt.IndexedExpression) {
          type = type.body;
        }
        if (type instanceof FmtHLM.MetaRefExpression_Bool || type instanceof FmtHLM.MetaRefExpression_Nat) {
          const argValue = this.getRawArgument(args, param);
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
    const context = new SubstitutionContext;
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
        const [variableRefExpression, indexContext] = this.extractVariableRefExpression(subExpression);
        if (variableRefExpression && variableRefExpression.variable === variable) {
          return this.applySubstitutionContext(value, indexContext);
        }
      }
      return subExpression;
    });
  }

  substitutePath(expression: Fmt.Expression, path: Fmt.Path, definitions: Fmt.Definition[]): Fmt.Expression {
    const context = new SubstitutionContext;
    this.addPathSubstitution(path, definitions, context);
    return this.applySubstitutionContext(expression, context);
  }

  addPathSubstitution(path: Fmt.Path, definitions: Fmt.Definition[], context: SubstitutionContext): void {
    let parentPath = path.parentPath;
    while (parentPath instanceof Fmt.Path) {
      parentPath = parentPath.parentPath;
    }
    this.addTargetPathSubstitution(parentPath, context);
    const parameterLists: Fmt.ParameterList[] = [];
    for (const definition of definitions) {
      parameterLists.push(definition.parameters);
    }
    const argumentLists: Fmt.ArgumentList[] = [];
    for (let pathItem: Fmt.PathItem | undefined = path; pathItem instanceof Fmt.Path; pathItem = pathItem.parentPath) {
      argumentLists.unshift(pathItem.arguments);
    }
    this.addArgumentListsSubstitution(parameterLists, argumentLists, parentPath, context);
  }

  parameterListContainsParameter(parameters: Fmt.Parameter[], param: Fmt.Parameter): boolean {
    for (const currentParam of parameters) {
      if (currentParam === param) {
        return true;
      }
      const type = currentParam.type;
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
    const parameters = structuralCase.parameters;
    if (parameters) {
      structuralCase.value.traverse((subExpression: Fmt.Expression) => {
        if (subExpression instanceof Fmt.VariableRefExpression && this.parameterListContainsParameter(parameters, subExpression.variable)) {
          referencesCaseParameter = true;
        }
      });
    }
    return referencesCaseParameter;
  }

  addAllParametersToSet(parameters: Fmt.Parameter[], result: Set<Fmt.Parameter>): void {
    for (const param of parameters) {
      result.add(param);
      const type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        this.addAllParametersToSet(type.sourceParameters, result);
        this.addAllParametersToSet(type.targetParameters, result);
      }
    }
  }

  getMacroInvocation(expression: Fmt.DefinitionRefExpression, definition: Fmt.Definition): HLMMacro.HLMMacroInvocation {
    const parentPath = expression.path.parentPath;
    const libraryDataAccessor = this.libraryDataAccessor.getAccessorForSection(parentPath);
    const macroInstance = HLMMacros.instantiateMacro(libraryDataAccessor, definition);
    const config = this.supportPlaceholders ? new HLMMacroInvocationConfigWithPlaceholders(this, parentPath) : new HLMMacroInvocationConfig(this, parentPath);
    return macroInstance.invoke(this, expression, config);
  }

  updateInitialProofStepContext(proof: FmtHLM.ObjectContents_Proof, context: HLMProofStepContext, maySetPreviousResult: boolean): void {
    if (proof.goal) {
      context.goal = proof.goal;
    }
    if (maySetPreviousResult && proof.parameters && proof.parameters.length) {
      const lastParam = proof.parameters[proof.parameters.length - 1];
      context.previousResult = this.getParameterConstraint(lastParam, context);
    }
  }

  getProofStepResult(step: Fmt.Parameter, context: HLMProofStepContext): Fmt.Expression | undefined {
    return this.getProofStepTypeResult(step.type, context) ?? this.getParameterConstraint(step, context);
  }

  getProofStepTypeResult(type: Fmt.Expression, context: HLMProofStepContext): Fmt.Expression | undefined {
    if (type instanceof FmtHLM.MetaRefExpression_Consider) {
      if (type.result) {
        return type.result;
      } else {
        type = type.variable;
      }
    }
    if (type instanceof Fmt.VariableRefExpression || type instanceof Fmt.IndexedExpression) {
      const [variableRefExpression, indexContext] = this.extractVariableRefExpression(type);
      if (variableRefExpression) {
        return this.getParameterConstraint(variableRefExpression.variable, context, variableRefExpression, indexContext);
      } else {
        throw new Error('Variable reference expected');
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      return type.statement;
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
               || type instanceof FmtHLM.MetaRefExpression_Unfold
               || type instanceof FmtHLM.MetaRefExpression_UseTheorem
               || type instanceof FmtHLM.MetaRefExpression_UseImplicitOperator
               || type instanceof FmtHLM.MetaRefExpression_Substitute) {
      return this.getImplicationResult(type.result, context);
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
      return undefined;
    }
  }

  getImplicationResult(declaredResult: Fmt.Expression | undefined, context: HLMProofStepContext): Fmt.Expression {
    return declaredResult ?? context.goal ?? new FmtHLM.MetaRefExpression_or;
  }

  getParameterConstraint(param: Fmt.Parameter, context: HLMBaseContext, variableRefExpression?: Fmt.VariableRefExpression, indexContext?: SubstitutionContext): Fmt.Expression | undefined {
    const getVariableRefExpression = () => {
      if (variableRefExpression) {
        return variableRefExpression;
      } else {
        return new Fmt.VariableRefExpression(param);
      }
    };
    const type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      const subset = getVariableRefExpression();
      const superset = this.applySubstitutionContext(type.superset, indexContext);
      return new FmtHLM.MetaRefExpression_sub(subset, superset);
    } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      const left = getVariableRefExpression();
      const right = this.applySubstitutionContext(type._set, indexContext);
      return new FmtHLM.MetaRefExpression_setEquals(left, right);
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      const element = getVariableRefExpression();
      const set = this.applySubstitutionContext(type._set, indexContext);
      return new FmtHLM.MetaRefExpression_in(element, set);
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      const left = getVariableRefExpression();
      const right = this.applySubstitutionContext(type.element, indexContext);
      return new FmtHLM.MetaRefExpression_equals(left, right);
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      return type.formula;
    } else {
      return context.stepResults.get(param);
    }
  }

  addProofConstraint(parameters: Fmt.ParameterList, formula: Fmt.Expression): void {
    if (formula instanceof FmtHLM.MetaRefExpression_and) {
      if (formula.formulas) {
        for (const item of formula.formulas) {
          this.addProofConstraint(parameters, item);
        }
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_exists) {
      parameters.push(...formula.parameters);
      if (formula.formula) {
        this.addProofConstraint(parameters, formula.formula);
      }
    } else {
      parameters.push(this.createConstraintParameter(formula, '_1'));
    }
  }

  getProveByContradictionVariant(disjunctions: Fmt.Expression[], index: number): [Fmt.Expression, Fmt.Expression] {
    if (disjunctions.length === 2) {
      return [disjunctions[1 - index], disjunctions[index]];
    } else {
      const goalToNegate = new FmtHLM.MetaRefExpression_or(...disjunctions);
      goalToNegate.formulas!.splice(index, 1);
      return [goalToNegate, disjunctions[index]];
    }
  }

  getNextFormulas(formula: Fmt.Expression, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    const [variableRefExpression, indexContext] = this.extractVariableRefExpression(formula);
    if (variableRefExpression) {
      const type = variableRefExpression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_Prop) {
        return this.unfoldIndices(formula, HLMExpressionType.Formula, unfoldParameters);
      } else {
        return CachedPromise.reject(new Error('Formula variable expected'));
      }
    } else if (formula instanceof Fmt.DefinitionRefExpression) {
      if (!(unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases || unfoldParameters.substituteStructuralCases)) {
        return CachedPromise.resolve(undefined);
      }
      return this.getOuterDefinition(formula).then((definition: Fmt.Definition): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
          // Normally, we don't unfold predicates; they are in the realm of "use definition" and "prove by definition" instead,
          // i.e. we want the user to be a bit more explicit about them.
          // If substituteStructuralCases is set, we make an exception for predicates defined by structural induction, as e.g.
          // "has property" and "related" are implemented this way and should be transparently unfolded when giving an explicitly
          // defined predicate.
          // We do want to unfold arguments.
          return this.unfoldDefinition(formula, [definition], definition.contents.definition, HLMExpressionType.Formula, unfoldParameters);
        }
        return undefined;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      return this.unfoldStructuralCases(formula, HLMExpressionType.Formula, unfoldParameters);
    } else if (formula instanceof FmtHLM.MetaRefExpression_not) {
      if (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === formula) {
        if (formula.formula instanceof FmtHLM.MetaRefExpression_not) {
          return CachedPromise.resolve([formula.formula.formula]);
        } else if (unfoldParameters.requiredUnfoldLocation === formula) {
          if (formula.formula instanceof FmtHLM.MetaRefExpression_equiv) {
            unfoldParameters = {
              ...unfoldParameters,
              requiredUnfoldLocation: undefined
            };
          } else {
            return CachedPromise.resolve(undefined);
          }
        }
      }
      return this.getNextFormulas(formula.formula, unfoldParameters).then((nextFormulas: Fmt.Expression[] | undefined) =>
        nextFormulas?.map((nextFormula: Fmt.Expression) => new FmtHLM.MetaRefExpression_not(nextFormula)));
    } else if ((formula instanceof FmtHLM.MetaRefExpression_and || formula instanceof FmtHLM.MetaRefExpression_or || formula instanceof FmtHLM.MetaRefExpression_equiv) && formula.formulas) {
      if (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === formula) {
        const simplifiedFormula = (formula instanceof FmtHLM.MetaRefExpression_and ? this.simplifyConjunctionItems(formula.formulas) :
                                 formula instanceof FmtHLM.MetaRefExpression_or ? this.simplifyDisjunctionItems(formula.formulas) :
                                 formula instanceof FmtHLM.MetaRefExpression_equiv ? this.simplifyEquivalenceItems(formula.formulas) :
                                 undefined);
        if (simplifiedFormula) {
          return CachedPromise.resolve([simplifiedFormula]);
        } else if (unfoldParameters.requiredUnfoldLocation === formula) {
          unfoldParameters = {
            ...unfoldParameters,
            requiredUnfoldLocation: undefined
          };
        }
      }
      let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
      formula.formulas.forEach((item: Fmt.Expression, index: number) => {
        result = this.concatResults(result, () =>
          this.getNextFormulas(item, unfoldParameters).then((nextItems: Fmt.Expression[] | undefined) =>
            nextItems?.map((nextItem: Fmt.Expression) => {
              const resultItems = formula.formulas!.map((originalItem: Fmt.Expression, currentIndex: number) => {
                if (currentIndex === index) {
                  return nextItem;
                } else {
                  return originalItem;
                }
              });
              return formula instanceof FmtHLM.MetaRefExpression_or ? new FmtHLM.MetaRefExpression_or(...resultItems) : formula instanceof FmtHLM.MetaRefExpression_and ? new FmtHLM.MetaRefExpression_and(...resultItems) : new FmtHLM.MetaRefExpression_equiv(...resultItems);
            })));
      });
      return result;
    } else {
      if (unfoldParameters.requiredUnfoldLocation === formula) {
        return CachedPromise.resolve(undefined);
      }
      if (formula instanceof FmtHLM.MetaRefExpression_forall || formula instanceof FmtHLM.MetaRefExpression_exists || formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
        const cloneExpression = (): ClonedExpressionInfo<Fmt.ParameterList> => {
          const clonedExpression = formula.clone() as (FmtHLM.MetaRefExpression_forall | FmtHLM.MetaRefExpression_exists | FmtHLM.MetaRefExpression_existsUnique);
          return {
            clonedExpression: clonedExpression,
            expressionType: HLMExpressionType.Formula,
            targetObject: clonedExpression.parameters
          };
        };
        const parametersResult = this.unfoldParameters(formula.parameters, unfoldParameters, cloneExpression);
        const innerFormula = formula.formula;
        if (innerFormula) {
          return this.concatResults(parametersResult, () => this.getNextFormulas(innerFormula, unfoldParameters).then((nextFormulas: Fmt.Expression[] | undefined) =>
            nextFormulas?.map((nextFormula: Fmt.Expression) =>
              formula instanceof FmtHLM.MetaRefExpression_existsUnique ? new FmtHLM.MetaRefExpression_existsUnique(formula.parameters, nextFormula) : formula instanceof FmtHLM.MetaRefExpression_exists ? new FmtHLM.MetaRefExpression_exists(formula.parameters, nextFormula) : new FmtHLM.MetaRefExpression_forall(formula.parameters, nextFormula))));
        } else {
          return parametersResult;
        }
      } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
        const elementResult = this.getNextElementTerms(formula.element, unfoldParameters).then((nextElements: Fmt.Expression[] | undefined) =>
          nextElements?.map((nextElement: Fmt.Expression) => new FmtHLM.MetaRefExpression_in(nextElement, formula._set)));
        return this.concatResults(elementResult, () => this.getNextSetTerms(formula._set, unfoldParameters).then((nextSets: Fmt.Expression[] | undefined) => {
          if (nextSets) {
            const result: Fmt.Expression[] = [];
            for (const nextSet of nextSets) {
              if (!(nextSet instanceof FmtHLM.MetaRefExpression_subset || nextSet instanceof FmtHLM.MetaRefExpression_extendedSubset)) {
                result.push(new FmtHLM.MetaRefExpression_in(formula.element, nextSet));
              }
            }
            return result;
          } else {
            return undefined;
          }
        }));
      } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
        const subsetResult = this.getNextSetTerms(formula.subset, unfoldParameters).then((nextSubsets: Fmt.Expression[] | undefined) =>
          nextSubsets?.map((nextSubset: Fmt.Expression) => new FmtHLM.MetaRefExpression_sub(nextSubset, formula.superset)));
        return this.concatResults(subsetResult, () => this.getNextSetTerms(formula.superset, unfoldParameters).then((nextSupersets: Fmt.Expression[] | undefined) =>
          nextSupersets?.map((nextSuperset: Fmt.Expression) => new FmtHLM.MetaRefExpression_sub(formula.subset, nextSuperset))));
      } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
        let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
        formula.terms.forEach((innerTerm: Fmt.Expression, index: number) => {
          result = this.concatResults(result, () =>
            this.getNextSetTerms(innerTerm, unfoldParameters).then((nextInnerTerms: Fmt.Expression[] | undefined) =>
              nextInnerTerms?.map((nextInnerTerm: Fmt.Expression) => {
                const terms = formula.terms!.map((originalInnerTerm: Fmt.Expression, currentIndex: number) => {
                  if (currentIndex === index) {
                    return nextInnerTerm;
                  } else {
                    return originalInnerTerm;
                  }
                });
                return new FmtHLM.MetaRefExpression_setEquals(...terms);
              })));
        });
        return result;
      } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
        let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
        formula.terms.forEach((innerTerm: Fmt.Expression, index: number) => {
          result = this.concatResults(result, () =>
            this.getNextElementTerms(innerTerm, unfoldParameters).then((nextInnerTerms: Fmt.Expression[] | undefined) =>
              nextInnerTerms?.map((nextInnerTerm: Fmt.Expression) => {
                const terms = formula.terms!.map((originalInnerTerm: Fmt.Expression, currentIndex: number) => {
                  if (currentIndex === index) {
                    return nextInnerTerm;
                  } else {
                    return originalInnerTerm;
                  }
                });
                return new FmtHLM.MetaRefExpression_equals(...terms);
              })));
        });
        return result;
      } else {
        return CachedPromise.resolve(undefined);
      }
    }
  }

  getNextSetTerms(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression[] | undefined> {
    const [variableRefExpression, indexContext] = this.extractVariableRefExpression(term);
    if (variableRefExpression) {
      const type = variableRefExpression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_Set) {
        return this.unfoldIndices(term, HLMExpressionType.SetTerm, typeSearchParameters);
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        if (typeSearchParameters.followSupersets) {
          return CachedPromise.resolve([this.applySubstitutionContext(type.superset, indexContext)]);
        }
        return CachedPromise.resolve(undefined);
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
        if (typeSearchParameters.unfoldVariableDefinitions && (!typeSearchParameters.requiredUnfoldLocation || typeSearchParameters.requiredUnfoldLocation === term)) {
          return CachedPromise.resolve([this.applySubstitutionContext(type._set, indexContext)]);
        } else {
          return CachedPromise.resolve(undefined);
        }
      } else {
        return CachedPromise.reject(new Error('Set variable expected'));
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      if (!(typeSearchParameters.followDefinitions || typeSearchParameters.unfoldArguments || typeSearchParameters.extractStructuralCases || typeSearchParameters.substituteStructuralCases)) {
        return CachedPromise.resolve(undefined);
      }
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          if (typeSearchParameters.followDefinitions && typeSearchParameters.followEmbeddings && definition.contents.embedding) {
            const type = definition.contents.embedding.parameter.type;
            if (type instanceof FmtHLM.MetaRefExpression_Element) {
              return this.followSetTermWithPath(type._set, term.path, definition).then((superset: Fmt.Expression) => [superset]);
            } else {
              return CachedPromise.reject(new Error('Element parameter expected'));
            }
          } else {
            return this.unfoldDefinitionArguments(term, [definition], HLMExpressionType.SetTerm, typeSearchParameters);
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
          if (typeSearchParameters.followDefinitions && typeSearchParameters.followSupersets && !typeSearchParameters.followAllAlternatives) {
            const definitionList = definition.contents.definition;
            if (definitionList.length) {
              const item = definitionList[0];
              return this.followSetTermWithPath(item, term.path, definition).then((superset: Fmt.Expression) => [superset]);
            }
          } else {
            return this.unfoldDefinition(term, [definition], definition.contents.definition, HLMExpressionType.SetTerm, typeSearchParameters);
          }
        }
        return undefined;
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      let resultPromise = this.unfoldStructuralCases(term, HLMExpressionType.SetTerm, typeSearchParameters);
      if (typeSearchParameters.followSupersets) {
        for (const structuralCase of term.cases) {
          resultPromise = resultPromise.or(() => {
            if (typeSearchParameters.followSupersets) {
              // When following supersets, if we can get a result from any structural case, we use that.
              if (!this.referencesCaseParameter(structuralCase)) {
                return [structuralCase.value];
              }
              if (term.term instanceof Fmt.PlaceholderExpression && structuralCase.parameters) {
                const createPlaceholder = (placeholderType: HLMExpressionType) => {
                  const result = new Fmt.PlaceholderExpression(placeholderType);
                  result.specialRole = Fmt.SpecialPlaceholderRole.Temporary;
                  return result;
                };
                const args = this.getPlaceholderArguments(structuralCase.parameters, undefined, createPlaceholder);
                return [this.substituteArguments(structuralCase.value, structuralCase.parameters, args)];
              }
              return this.getNextElementTerms(term.term, typeSearchParameters).then((nextTerms: Fmt.Expression[] | undefined) => {
                if (nextTerms) {
                  return nextTerms.map((nextTerm: Fmt.Expression) =>
                    this.buildSingleStructuralCaseTerm(nextTerm, term.construction, structuralCase._constructor, structuralCase.parameters, structuralCase.value, HLMExpressionType.SetTerm));
                } else {
                  return this.getNextSetTerms(structuralCase.value, typeSearchParameters).then((supersets: Fmt.Expression[] | undefined) => {
                    if (supersets) {
                      return supersets.map((superset: Fmt.Expression) => this.buildSingleStructuralCaseTerm(term.term, term.construction, structuralCase._constructor, structuralCase.parameters, superset, HLMExpressionType.SetTerm));
                    } else if (term.cases.length > 1 || structuralCase.rewrite) {
                      return [this.buildSingleStructuralCaseTerm(term.term, term.construction, structuralCase._constructor, structuralCase.parameters, structuralCase.value, HLMExpressionType.SetTerm)];
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
      return resultPromise;
    } else {
      if (typeSearchParameters.followSupersets && (!typeSearchParameters.requiredUnfoldLocation || typeSearchParameters.requiredUnfoldLocation === term)) {
        if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
          if (term.terms && term.terms.length) {
            for (const element of term.terms) {
              if (!(element instanceof Fmt.PlaceholderExpression)) {
                return this.getDeclaredSet(element).then((declaredSet: Fmt.Expression) => [declaredSet]);
              }
            }
          }
        } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
          const type = term.parameter.type;
          if (type instanceof FmtHLM.MetaRefExpression_Element) {
            return CachedPromise.resolve([type._set]);
          } else {
            return CachedPromise.reject(new Error('Element parameter expected'));
          }
        } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
          return this.getDeclaredSet(term.term).then((declaredSet: Fmt.Expression) => [declaredSet]);
        } else if (term instanceof FmtHLM.MetaRefExpression_setAssociative) {
          return CachedPromise.resolve([term.term]);
        }
      }
      return CachedPromise.resolve(undefined);
    }
  }

  private getNextPrimarySetTerm(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression | undefined> {
    return this.getNextSetTerms(term, typeSearchParameters).then((resultTerms: Fmt.Expression[] | undefined) => (resultTerms?.length ? resultTerms[0] : undefined));
  }

  getNextElementTerms(term: Fmt.Expression, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    const [variableRefExpression, indexContext] = this.extractVariableRefExpression(term);
    if (variableRefExpression) {
      const type = variableRefExpression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_Element) {
        return this.unfoldIndices(term, HLMExpressionType.ElementTerm, unfoldParameters);
      } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
        if (unfoldParameters.unfoldVariableDefinitions && (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === term)) {
          return CachedPromise.resolve([this.applySubstitutionContext(type.element, indexContext)]);
        } else {
          return CachedPromise.resolve(undefined);
        }
      } else {
        return CachedPromise.reject(new Error('Element variable expected'));
      }
    } else if (term instanceof Fmt.DefinitionRefExpression) {
      if (!(unfoldParameters.followDefinitions || unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases || unfoldParameters.substituteStructuralCases)) {
        return CachedPromise.resolve(undefined);
      }
      if (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === term) {
        // TODO if any argument refers to a macro, ask that macro to unfold the whole term
      }
      return this.getOuterDefinition(term).then((definition: Fmt.Definition): Fmt.Expression[] | undefined | CachedPromise<Fmt.Expression[] | undefined> => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          const innerDefinition = definition.innerDefinitions.getDefinition(term.path.name);
          return this.unfoldDefinitionArguments(term, [definition, innerDefinition], HLMExpressionType.ElementTerm, unfoldParameters);
        } else if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          return this.unfoldDefinition(term, [definition], definition.contents.definition, HLMExpressionType.ElementTerm, unfoldParameters);
        } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          return this.unfoldDefinitionArguments(term, [definition], HLMExpressionType.ElementTerm, unfoldParameters);
        } else if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
          if (unfoldParameters.unfoldMacros && (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === term)) {
            const macroInvocation = this.getMacroInvocation(term, definition);
            return macroInvocation.unfold();
          }
        }
        return undefined;
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      return this.unfoldStructuralCases(term, HLMExpressionType.ElementTerm, unfoldParameters);
    } else {
      if (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === term) {
        if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
          return this.cast(term.term, term._set)
            .then((currentResult: Fmt.Expression) => [currentResult]);
        }
      }
      return CachedPromise.resolve(undefined);
    }
  }

  getNextExpressions(expression: Fmt.Expression, unfoldParameters: HLMUnfoldParameters, expressionType: HLMExpressionType): CachedPromise<Fmt.Expression[] | undefined> {
    switch (expressionType) {
    case HLMExpressionType.SetTerm:
      return this.getNextSetTerms(expression, unfoldParameters);
    case HLMExpressionType.ElementTerm:
      return this.getNextElementTerms(expression, unfoldParameters);
    case HLMExpressionType.Formula:
      return this.getNextFormulas(expression, unfoldParameters);
    default:
      throw new Error('Invalid expression type');
    }
  }

  private cast(term: Fmt.Expression, set: Fmt.Expression): CachedPromise<Fmt.Expression> {
    return this.getFinalSuperset(set, findFinalSuperset).then((finalSet: Fmt.Expression) => {
      if (finalSet instanceof Fmt.DefinitionRefExpression) {
        const path = finalSet.path;
        return this.getDefinition(path).then((definition: Fmt.Definition) => {
          if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
            const embedding = definition.contents.embedding;
            if (embedding && embedding.parameter.type instanceof FmtHLM.MetaRefExpression_Element) {
              const subset = this.substitutePath(embedding.parameter.type._set, path, [definition]);
              return this.isDeclaredElementOf(term, subset).then((matchesEmbedding: boolean) => {
                if (matchesEmbedding) {
                  const target = this.substitutePath(embedding!.target, path, [definition]);
                  return FmtUtils.substituteVariable(target, embedding!.parameter, term);
                } else {
                  return term;
                }
              });
            }
          }
          return term;
        });
      }
      return term;
    });
  }

  private unfoldIndices(expression: Fmt.Expression, expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    if (unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases) {
      for (let innerExpression: Fmt.Expression = expression, innerExpressionIndex = 0; innerExpression instanceof Fmt.IndexedExpression; innerExpression = innerExpression.body, innerExpressionIndex++) {
        if (innerExpression.parameters && innerExpression.arguments) {
          const curParameters = innerExpression.parameters;
          const curArguments = innerExpression.arguments;
          const curInnerExpressionIndex = innerExpressionIndex;
          result = this.concatResults(result, () => {
            const cloneExpression = (): ClonedExpressionInfo<Fmt.ArgumentList> => {
              const clonedExpression = expression.clone();
              let clonedInnerExpression = clonedExpression as Fmt.IndexedExpression;
              for (let i = 0; i < curInnerExpressionIndex; i++) {
                clonedInnerExpression = clonedInnerExpression.body as Fmt.IndexedExpression;
              }
              return {
                clonedExpression: clonedExpression,
                expressionType: expressionType,
                targetObject: clonedInnerExpression.arguments!
              };
            };
            return this.unfoldArguments(curParameters, curArguments, unfoldParameters, cloneExpression);
          });
        }
      }
    }
    return result;
  }

  private unfoldDefinition(expression: Fmt.DefinitionRefExpression, definitions: Fmt.Definition[], definitionList: Fmt.Expression[], expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    let resultPromise: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    if ((unfoldParameters.followDefinitions || unfoldParameters.substituteStructuralCases)
        && (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === expression)) {
      for (const item of definitionList) {
        resultPromise = resultPromise.then((currentResult: Fmt.Expression[] | undefined) => {
          let simplifiedResultPromise: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
          let substituted: Fmt.Expression | undefined = undefined;
          const isStructuralExpression = (item instanceof FmtHLM.MetaRefExpression_structural || item instanceof FmtHLM.MetaRefExpression_setStructuralCases || item instanceof FmtHLM.MetaRefExpression_structuralCases);
          if (isStructuralExpression && unfoldParameters.substituteStructuralCases) {
            substituted = this.substitutePath(item, expression.path, definitions);
            const structuralExpression = substituted as FmtHLM.MetaRefExpression_structural | FmtHLM.MetaRefExpression_setStructuralCases | FmtHLM.MetaRefExpression_structuralCases;
            simplifiedResultPromise = this.substituteStructuralCase(structuralExpression, unfoldParameters.allowConstructorResultsFromStructuralDefinitionSubstitution);
          }
          return simplifiedResultPromise.then((simplifiedResult: Fmt.Expression[] | undefined) => {
            if (simplifiedResult) {
              return currentResult ? currentResult.concat(simplifiedResult) : simplifiedResult;
            } else if (unfoldParameters.followDefinitions
                       && expressionType !== HLMExpressionType.Formula
                       && (!isStructuralExpression || unfoldParameters.allowStructuralCaseResults)) {
              if (!substituted) {
                substituted = this.substitutePath(item, expression.path, definitions);
              }
              const simplified = this.fixSubstitutionArtifacts(substituted);
              return currentResult ? currentResult.concat(simplified) : [simplified];
            } else {
              return currentResult;
            }
          });
        });
      }
    }
    return resultPromise.then((currentResult: Fmt.Expression[] | undefined) =>
      this.unfoldDefinitionArguments(expression, definitions, expressionType, unfoldParameters).then((argumentResult: Fmt.Expression[] | undefined) =>
        (currentResult && argumentResult ? currentResult.concat(argumentResult) : currentResult ?? argumentResult)));
  }

  private unfoldDefinitionArguments(expression: Fmt.DefinitionRefExpression, definitions: Fmt.Definition[], expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters, startDefinitionIndex: number = 0): CachedPromise<Fmt.Expression[] | undefined> {
    const cloneExpression = (): ClonedExpressionInfo<Fmt.ArgumentList> => {
      const clonedExpression = expression.clone() as Fmt.DefinitionRefExpression;
      let clonedPath = clonedExpression.path;
      for (let definitionIndex = startDefinitionIndex + 1; definitionIndex < definitions.length; definitionIndex++) {
        clonedPath = clonedPath.parentPath as Fmt.Path;
      }
      return {
        clonedExpression: clonedExpression,
        expressionType: expressionType,
        targetObject: clonedPath.arguments
      };
    };
    let path = expression.path;
    for (let definitionIndex = startDefinitionIndex + 1; definitionIndex < definitions.length; definitionIndex++) {
      path = path.parentPath as Fmt.Path;
    }
    let result = this.unfoldArguments(definitions[startDefinitionIndex].parameters, path.arguments, unfoldParameters, cloneExpression);
    if (startDefinitionIndex < definitions.length - 1) {
      result = this.concatResults(result, () => this.unfoldDefinitionArguments(expression, definitions, expressionType, unfoldParameters, startDefinitionIndex + 1));
    }
    return result;
  }

  private unfoldArguments(parameters: Fmt.ParameterList, args: Fmt.ArgumentList, unfoldParameters: HLMUnfoldParameters, cloneExpression: () => ClonedExpressionInfo<Fmt.ArgumentList>): CachedPromise<Fmt.Expression[] | undefined> {
    let result: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    if (unfoldParameters.unfoldArguments || unfoldParameters.extractStructuralCases) {
      for (const param of parameters) {
        const type = param.type;
        // TODO also unfold arguments inside binders
        if (type instanceof FmtHLM.MetaRefExpression_Prop) {
          result = this.concatResults(result, () => {
            const argValue = this.getArgValue(args, param);
            if (unfoldParameters.extractStructuralCases && argValue instanceof FmtHLM.MetaRefExpression_structural && argValue.cases.length === 1) {
              const structuralCase = argValue.cases[0];
              const clonedExpressionInfo = cloneExpression();
              this.replaceArgValue(clonedExpressionInfo.targetObject, param, structuralCase.value);
              return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, clonedExpressionInfo.clonedExpression, clonedExpressionInfo.expressionType)];
            } else if (unfoldParameters.unfoldArguments) {
              return this.getNextFormulas(argValue, unfoldParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                if (newArgValues) {
                  return newArgValues.map((newArgValue: Fmt.Expression) => {
                    const clonedExpressionInfo = cloneExpression();
                    this.replaceArgValue(clonedExpressionInfo.targetObject, param, newArgValue);
                    return clonedExpressionInfo.clonedExpression;
                  });
                } else {
                  return undefined;
                }
              });
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) {
          const embedSubsets = type.embedSubsets instanceof FmtHLM.MetaRefExpression_true;
          result = this.concatResults(result, () => {
            const argValue = this.getArgValue(args, param);
            if (unfoldParameters.extractStructuralCases && argValue instanceof FmtHLM.MetaRefExpression_setStructuralCases && argValue.cases.length === 1) {
              const structuralCase = argValue.cases[0];
              const clonedExpressionInfo = cloneExpression();
              this.replaceArgValue(clonedExpressionInfo.targetObject, param, structuralCase.value);
              return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, clonedExpressionInfo.clonedExpression, clonedExpressionInfo.expressionType)];
            } else if (unfoldParameters.unfoldArguments) {
              const innerSearchParameters: HLMTypeSearchParameters = {
                ...unfoldParameters,
                followSupersets: embedSubsets,
                followEmbeddings: embedSubsets
              };
              return this.getNextSetTerms(argValue, innerSearchParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                if (newArgValues) {
                  return newArgValues.map((newArgValue: Fmt.Expression) => {
                    const clonedExpressionInfo = cloneExpression();
                    this.replaceArgValue(clonedExpressionInfo.targetObject, param, newArgValue);
                    return clonedExpressionInfo.clonedExpression;
                  });
                } else {
                  return undefined;
                }
              });
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
          result = this.concatResults(result, () => {
            const argValue = this.getArgValue(args, param);
            if (unfoldParameters.extractStructuralCases && argValue instanceof FmtHLM.MetaRefExpression_structuralCases && argValue.cases.length === 1) {
              const structuralCase = argValue.cases[0];
              const clonedExpressionInfo = cloneExpression();
              this.replaceArgValue(clonedExpressionInfo.targetObject, param, structuralCase.value);
              return [this.buildSingleStructuralCaseTerm(argValue.term, argValue.construction, structuralCase._constructor, structuralCase.parameters, clonedExpressionInfo.clonedExpression, clonedExpressionInfo.expressionType)];
            } else if (unfoldParameters.unfoldArguments) {
              return this.getNextElementTerms(argValue, unfoldParameters).then((newArgValues: Fmt.Expression[] | undefined) => {
                if (newArgValues) {
                  return newArgValues.map((newArgValue: Fmt.Expression) => {
                    const clonedExpressionInfo = cloneExpression();
                    this.replaceArgValue(clonedExpressionInfo.targetObject, param, newArgValue);
                    return clonedExpressionInfo.clonedExpression;
                  });
                } else {
                  return undefined;
                }
              });
            } else {
              return undefined;
            }
          });
        }
      }
    }
    return result;
  }

  private replaceArgValue(args: Fmt.ArgumentList, param: Fmt.Parameter, newValue: Fmt.Expression): void {
    for (const arg of args) {
      if (arg.name === param.name) {
        arg.value = newValue;
      }
    }
  }

  private fixSubstitutionArtifacts(expression: Fmt.Expression): Fmt.Expression {
    if (expression instanceof FmtHLM.MetaRefExpression_subset
        && expression.formula instanceof FmtHLM.MetaRefExpression_and
        && expression.formula.formulas
        && expression.parameter.type instanceof FmtHLM.MetaRefExpression_Element) {
      let newItems: Fmt.Expression[] | undefined = undefined;
      let index = 0;
      for (const item of expression.formula.formulas) {
        if (item instanceof FmtHLM.MetaRefExpression_in
            && item.element instanceof Fmt.VariableRefExpression
            && item.element.variable === expression.parameter
            && item._set.isEquivalentTo(expression.parameter.type._set)) {
          if (!newItems) {
            newItems = expression.formula.formulas.slice(0, index);
          }
        } else if (newItems) {
          newItems.push(item);
        }
        index++;
      }
      if (newItems) {
        return new FmtHLM.MetaRefExpression_subset(expression.parameter, this.createConjunction(newItems));
      }
    }
    return expression;
  }

  private unfoldStructuralCases(expression: FmtHLM.MetaRefExpression_structural | FmtHLM.MetaRefExpression_setStructuralCases | FmtHLM.MetaRefExpression_structuralCases, expressionType: HLMExpressionType, unfoldParameters: HLMUnfoldParameters): CachedPromise<Fmt.Expression[] | undefined> {
    if (unfoldParameters.extractStructuralCases) {
      if (expression.cases.length === 1) {
        const structuralCase = expression.cases[0];
        let currentStructuralCase = structuralCase;
        let innerTerm = currentStructuralCase.value;
        while ((innerTerm instanceof FmtHLM.MetaRefExpression_structural || innerTerm instanceof FmtHLM.MetaRefExpression_setStructuralCases || innerTerm instanceof FmtHLM.MetaRefExpression_structuralCases)
               && innerTerm.cases.length === 1) {
          const innerStructuralCase = innerTerm.cases[0];
          if ((!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === innerTerm)
              && expression.term.isEquivalentTo(innerTerm.term)) {
            const newInnerValue = innerStructuralCase.parameters && structuralCase.parameters ? this.substituteParameters(innerStructuralCase.value, innerStructuralCase.parameters, structuralCase.parameters) : innerStructuralCase.value;
            return CachedPromise.resolve([FmtUtils.substituteExpression<Fmt.Expression>(expression, innerTerm, newInnerValue)]);
          }
          currentStructuralCase = innerStructuralCase;
          innerTerm = innerStructuralCase.value;
        }
      }

      if ((!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === expression.term)
          && expression.term instanceof FmtHLM.MetaRefExpression_structuralCases
          && expression.term.cases.length === 1) {
        const innerStructuralCase = expression.term.cases[0];
        const innerResultTerm = this.buildStructuralCaseTerm(innerStructuralCase.value, expression.construction, expression.cases, expressionType);
        return CachedPromise.resolve([this.buildSingleStructuralCaseTerm(expression.term.term, expression.term.construction, innerStructuralCase._constructor, innerStructuralCase.parameters, innerResultTerm, expressionType)]);
      }
    }

    let constructorResultPromise: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    if (unfoldParameters.substituteStructuralCases
        && (!unfoldParameters.requiredUnfoldLocation || unfoldParameters.requiredUnfoldLocation === expression)) {
      constructorResultPromise = this.substituteStructuralCase(expression, unfoldParameters.allowConstructorResultsFromStructuralDefinitionSubstitution);
    }

    return constructorResultPromise.then((constructorResult: Fmt.Expression[] | undefined) => {
      if (constructorResult) {
        return constructorResult;
      } else if (unfoldParameters.requiredUnfoldLocation !== expression) {
        return this.getNextElementTerms(expression.term, unfoldParameters).then((nextTerms: Fmt.Expression[] | undefined) =>
          nextTerms?.map((nextTerm: Fmt.Expression) => this.buildStructuralCaseTerm(nextTerm, expression.construction, expression.cases, expressionType)));
      } else {
        return undefined;
      }
    });
  }

  private substituteStructuralCase(expression: FmtHLM.MetaRefExpression_structural | FmtHLM.MetaRefExpression_setStructuralCases | FmtHLM.MetaRefExpression_structuralCases, allowConstructorResult: boolean): CachedPromise<Fmt.Expression[] | undefined> {
    // TODO also (first) check whether expression.term is a rewritten constructor term like "... + 1"
    return this.castAndFullyUnfoldElementTermOutside(expression.term, expression.construction).then((constructorTerms: Fmt.Expression[]) => {
      let resultPromise: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
      for (const constructorTerm of constructorTerms) {
        resultPromise = resultPromise.then((currentResult: Fmt.Expression[] | undefined) => {
          const substitutionResultPromise = this.substituteStructuralCaseInternal(expression, constructorTerm);
          if (substitutionResultPromise) {
            return substitutionResultPromise
              .then((substitutionResult: Fmt.Expression) => {
                if (substitutionResult instanceof FmtHLM.MetaRefExpression_structural || substitutionResult instanceof FmtHLM.MetaRefExpression_setStructuralCases || substitutionResult instanceof FmtHLM.MetaRefExpression_structuralCases) {
                  return this.substituteStructuralCase(substitutionResult, allowConstructorResult);
                } else if (substitutionResult instanceof Fmt.DefinitionRefExpression && substitutionResult.path.parentPath instanceof Fmt.Path && !allowConstructorResult) {
                  return undefined;
                } else {
                  return [substitutionResult];
                }
              })
              .then((substitutionResults: Fmt.Expression[] | undefined) =>
                (currentResult && substitutionResults ? currentResult.concat(substitutionResults) : substitutionResults));
          } else {
            return currentResult;
          }
        });
      }
      return resultPromise;
    });
  }

  private substituteStructuralCaseInternal(expression: FmtHLM.MetaRefExpression_structural | FmtHLM.MetaRefExpression_setStructuralCases | FmtHLM.MetaRefExpression_structuralCases, constructorTerm: Fmt.Expression): CachedPromise<Fmt.Expression> | undefined {
    if (constructorTerm instanceof Fmt.DefinitionRefExpression
        && constructorTerm.path.parentPath instanceof Fmt.Path
        && expression.construction instanceof Fmt.DefinitionRefExpression
        && constructorTerm.path.parentPath.isEquivalentTo(expression.construction.path)) {
      const constructorPath = constructorTerm.path;
      for (const structuralCase of expression.cases) {
        if (structuralCase._constructor instanceof Fmt.DefinitionRefExpression
            && structuralCase._constructor.path.parentPath instanceof Fmt.Path
            && constructorTerm.path.name === structuralCase._constructor.path.name) {
          const constructorExpression = structuralCase._constructor;
          return this.getOuterDefinition(constructorExpression).then((definition: Fmt.Definition) => {
            const innerDefinition = definition.innerDefinitions.getDefinition(constructorPath.name);
            const substituted = structuralCase.parameters ? this.substituteParameters(structuralCase.value, structuralCase.parameters, innerDefinition.parameters) : structuralCase.value;
            return this.substituteArguments(substituted, innerDefinition.parameters, constructorPath.arguments);
          });
        }
      }
    }
    return undefined;
  }

  private unfoldParameters(parameterList: Fmt.ParameterList, unfoldParameters: HLMUnfoldParameters, cloneExpression: () => ClonedExpressionInfo<Fmt.ParameterList>): CachedPromise<Fmt.Expression[] | undefined> {
    let resultPromise: CachedPromise<Fmt.Expression[] | undefined> = CachedPromise.resolve(undefined);
    let paramIndex = 0;
    for (const param of parameterList) {
      const curParamIndex = paramIndex;
      const cloneAndAnalyze = (): [ClonedExpressionInfo<Fmt.ParameterList>, Fmt.Parameter, HLMSubstitutionContext] => {
        const clonedExpressionInfo = cloneExpression();
        const clonedParameterList = clonedExpressionInfo.targetObject;
        const clonedParam = clonedParameterList[curParamIndex];
        const substitutionContext = new HLMSubstitutionContext;
        this.addParameterListSubstitution(parameterList.slice(0, curParamIndex), clonedParameterList.slice(0, curParamIndex), substitutionContext);
        return [clonedExpressionInfo, clonedParam, substitutionContext];
      };
      resultPromise = this.concatResults(resultPromise, () => {
        const type = param.type;
        if (type instanceof FmtHLM.MetaRefExpression_Subset) {
          return this.getNextSetTerms(type.superset, unfoldParameters).then((nextSetTerms: Fmt.Expression[] | undefined) => {
            if (nextSetTerms) {
              const result: Fmt.Expression[] = [];
              for (const nextSetTerm of nextSetTerms) {
                const [clonedExpressionInfo, clonedParam, substitutionContext] = cloneAndAnalyze();
                const clonedType = clonedParam.type as FmtHLM.MetaRefExpression_Subset;
                clonedType.superset = this.applySubstitutionContext(nextSetTerm, substitutionContext);
                result.push(clonedExpressionInfo.clonedExpression);
              }
              return result;
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
          return this.getNextSetTerms(type._set, unfoldParameters).then((nextSetTerms: Fmt.Expression[] | undefined) => {
            if (nextSetTerms) {
              const result: Fmt.Expression[] = [];
              for (const nextSetTerm of nextSetTerms) {
                const [clonedExpressionInfo, clonedParam, substitutionContext] = cloneAndAnalyze();
                const clonedType = clonedParam.type as FmtHLM.MetaRefExpression_Element;
                clonedType._set = this.applySubstitutionContext(nextSetTerm, substitutionContext);
                result.push(clonedExpressionInfo.clonedExpression);
              }
              return result;
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
          return this.getNextFormulas(type.formula, unfoldParameters).then((nextFormulas: Fmt.Expression[] | undefined) => {
            if (nextFormulas) {
              const result: Fmt.Expression[] = [];
              for (const nextFormula of nextFormulas) {
                const [clonedExpressionInfo, clonedParam, substitutionContext] = cloneAndAnalyze();
                const clonedType = clonedParam.type as FmtHLM.MetaRefExpression_Constraint;
                clonedType.formula = this.applySubstitutionContext(nextFormula, substitutionContext);
                result.push(clonedExpressionInfo.clonedExpression);
              }
              return result;
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
          return this.getNextSetTerms(type._set, unfoldParameters).then((nextSetTerms: Fmt.Expression[] | undefined) => {
            if (nextSetTerms) {
              const result: Fmt.Expression[] = [];
              for (const nextSetTerm of nextSetTerms) {
                const [clonedExpressionInfo, clonedParam, substitutionContext] = cloneAndAnalyze();
                const clonedType = clonedParam.type as FmtHLM.MetaRefExpression_SetDef;
                clonedType._set = this.applySubstitutionContext(nextSetTerm, substitutionContext);
                result.push(clonedExpressionInfo.clonedExpression);
              }
              return result;
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
          return this.getNextElementTerms(type.element, unfoldParameters).then((nextElementTerms: Fmt.Expression[] | undefined) => {
            if (nextElementTerms) {
              const result: Fmt.Expression[] = [];
              for (const nextElementTerm of nextElementTerms) {
                const [clonedExpressionInfo, clonedParam, substitutionContext] = cloneAndAnalyze();
                const clonedType = clonedParam.type as FmtHLM.MetaRefExpression_Def;
                clonedType.element = this.applySubstitutionContext(nextElementTerm, substitutionContext);
                result.push(clonedExpressionInfo.clonedExpression);
              }
              return result;
            } else {
              return undefined;
            }
          });
        } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
          const binder = type;
          const cloneExpressionForSource = (): ClonedExpressionInfo<Fmt.ParameterList> => {
            const [clonedExpressionInfo, clonedParam, substitutionContext] = cloneAndAnalyze();
            const clonedType = clonedParam.type as FmtHLM.MetaRefExpression_Binder;
            return {
              ...clonedExpressionInfo,
              targetObject: this.applySubstitutionContextToParameterList(clonedType.sourceParameters, substitutionContext)
            };
          };
          const sourceResult = this.unfoldParameters(binder.sourceParameters, unfoldParameters, cloneExpressionForSource);
          const cloneExpressionForTarget = (): ClonedExpressionInfo<Fmt.ParameterList> => {
            const [clonedExpressionInfo, clonedParam, substitutionContext] = cloneAndAnalyze();
            const clonedType = clonedParam.type as FmtHLM.MetaRefExpression_Binder;
            return {
              ...clonedExpressionInfo,
              targetObject: this.applySubstitutionContextToParameterList(clonedType.targetParameters, substitutionContext)
            };
          };
          return this.concatResults(sourceResult, () => this.unfoldParameters(binder.targetParameters, unfoldParameters, cloneExpressionForTarget));
        }
        return undefined;
      });
      paramIndex++;
    }
    return resultPromise;
  }

  private concatResults<T>(resultPromise: CachedPromise<T[] | undefined>, fn: () => T[] | undefined | CachedPromise<T[] | undefined>): CachedPromise<T[] | undefined> {
    return resultPromise.then((currentResult: T[] | undefined) => {
      if (currentResult) {
        return CachedPromise.resolve()
          .then(fn)
          .then((newResult: T[] | undefined) => (newResult ? currentResult.concat(newResult) : currentResult));
      } else {
        return fn();
      }
    });
  }

  simplifyFormula(formula: Fmt.Expression): CachedPromise<Fmt.Expression> {
    return this.getNextFormulas(formula, unfoldStrictSimplifications).then((nextFormulas: Fmt.Expression[] | undefined) => {
      if (nextFormulas && nextFormulas.length) {
        return this.simplifyFormula(nextFormulas[0]);
      } else {
        return formula;
      }
    });
  }

  getFinalSuperset(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression> {
    return this.getFinalSupersetInternal(term, typeSearchParameters, []);
  }

  private getFinalSupersetInternal(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters, visitedDefinitions: Fmt.DefinitionRefExpression[]): CachedPromise<Fmt.Expression> {
    if (term instanceof Fmt.DefinitionRefExpression) {
      for (const visitedDefinition of visitedDefinitions) {
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
      const [variableRefExpression, indexContext] = this.extractVariableRefExpression(term);
      if (variableRefExpression) {
        const type = variableRefExpression.variable.type;
        if (type instanceof FmtHLM.MetaRefExpression_Element) {
          return CachedPromise.resolve(this.applySubstitutionContext(type._set, indexContext));
        } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
          term = this.applySubstitutionContext(type.element, indexContext);
        } else {
          return CachedPromise.reject(new Error('Element variable expected'));
        }
      } else if (term instanceof Fmt.DefinitionRefExpression) {
        if (term.path.parentPath instanceof Fmt.Path) {
          const constructionTerm = new Fmt.DefinitionRefExpression(term.path.parentPath);
          return CachedPromise.resolve(constructionTerm);
        } else {
          for (const visitedDefinition of visitedDefinitions) {
            if (term.isEquivalentTo(visitedDefinition)) {
              return CachedPromise.reject(new Error('Invalid circular reference'));
            }
          }
          visitedDefinitions.push(term);
          const definitionRefExpression = term;
          return this.getOuterDefinition(term).then((definition: Fmt.Definition) => {
            if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
              if (definition.contents.definition.length) {
                const item = definition.contents.definition[0];
                return this.getFinalSetWithPath(item, definitionRefExpression.path, definition);
              } else {
                return this.getWildcardFinalSet();
              }
            } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
              const type = definition.contents.parameter.type;
              if (type instanceof FmtHLM.MetaRefExpression_Element) {
                return this.followSetTermWithPath(type._set, definitionRefExpression.path, definition);
              } else {
                return CachedPromise.reject(new Error('Element parameter expected'));
              }
            } else if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
              const macroInvocation = this.getMacroInvocation(definitionRefExpression, definition);
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
          const structuralCase = term.cases[0];
          if (this.referencesCaseParameter(structuralCase)) {
            const structuralCasesTerm = term;
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
        const result = new FmtHLM.MetaRefExpression_enumeration(term);
        return CachedPromise.resolve(result);
      } else {
        return CachedPromise.reject(new Error('Element term expected'));
      }
    }
  }

  getFinalSet(term: Fmt.Expression, typeSearchParameters: HLMTypeSearchParameters): CachedPromise<Fmt.Expression> {
    const visitedDefinitions: Fmt.DefinitionRefExpression[] = [];
    return this.getDeclaredSetInternal(term, visitedDefinitions).then((set: Fmt.Expression) => this.getFinalSupersetInternal(set, typeSearchParameters, visitedDefinitions));
  }

  getCommonSuperset(terms: Fmt.Expression[]): CachedPromise<Fmt.Expression | undefined> {
    return this.getCommonSupersetInternal(terms).or(() => this.getCommonFinalSuperset(terms));
  }

  getCommonFinalSuperset(terms: Fmt.Expression[]): CachedPromise<Fmt.Expression | undefined> {
    let finalSetsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (const term of terms) {
      finalSetsPromise = finalSetsPromise.then((currentFinalSets: Fmt.Expression[]) =>
        this.getFinalSuperset(term, findFinalSuperset).then((finalSet: Fmt.Expression) =>
          currentFinalSets.concat(finalSet)));
    }
    return finalSetsPromise.then((finalSets: Fmt.Expression[]) => this.getCommonSupersetInternal(finalSets));
  }

  private getCommonSupersetInternal(terms: Fmt.Expression[]): CachedPromise<Fmt.Expression | undefined> {
    let resultPromise: CachedPromise<Fmt.Expression | undefined> = CachedPromise.resolve(undefined);
    for (const term of terms) {
      let termIsCommonSupersetPromise = CachedPromise.resolve(true);
      for (const otherTerm of terms) {
        if (otherTerm !== term) {
          termIsCommonSupersetPromise = termIsCommonSupersetPromise.and(() => this.isDeclaredSubsetOf(otherTerm, term));
        }
      }
      resultPromise = resultPromise.or(() => termIsCommonSupersetPromise.then((termIsCommonSuperset: boolean) =>
        (termIsCommonSuperset ? term : undefined)));
    }
    return resultPromise;
  }

  getCommonFinalSet(terms: Fmt.Expression[]): CachedPromise<Fmt.Expression | undefined> {
    let declaredSetsPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (const term of terms) {
      declaredSetsPromise = declaredSetsPromise.then((currentDeclaredSets: Fmt.Expression[]) =>
        this.getDeclaredSet(term).then((declaredSet: Fmt.Expression) =>
          currentDeclaredSets.concat(declaredSet)));
    }
    return declaredSetsPromise.then((declaredSets: Fmt.Expression[]) => this.getCommonFinalSuperset(declaredSets));
  }

  private fullyUnfoldOutside(expression: Fmt.Expression, expressionType: HLMExpressionType): CachedPromise<Fmt.Expression[]> {
    const unfoldOutside: HLMUnfoldParameters = {
      unfoldVariableDefinitions: true,
      followDefinitions: true,
      unfoldMacros: true,
      allowStructuralCaseResults: true,
      unfoldArguments: false,
      substituteStructuralCases: true,
      allowConstructorResultsFromStructuralDefinitionSubstitution: true,
      extractStructuralCases: false,
      requiredUnfoldLocation: expression
    };
    return this.getNextExpressions(expression, unfoldOutside, expressionType).then((nextExpressions: Fmt.Expression[] | undefined) => {
      if (nextExpressions) {
        let resultPromise: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
        for (const nextExpression of nextExpressions) {
          resultPromise = resultPromise.then((currentResult: Fmt.Expression[]) =>
            this.fullyUnfoldOutside(nextExpression, expressionType).then((unfoldedNextExpressions: Fmt.Expression[]) => {
              for (const unfoldedNextExpression of unfoldedNextExpressions) {
                if (!currentResult.some((resultTerm: Fmt.Expression) => unfoldedNextExpression.isEquivalentTo(resultTerm))) {
                  currentResult = currentResult.concat(unfoldedNextExpression);
                }
              }
              return currentResult;
            }));
        }
        return resultPromise;
      } else {
        return [expression];
      }
    });
  }

  private castAndFullyUnfoldElementTermOutside(term: Fmt.Expression, set: Fmt.Expression): CachedPromise<Fmt.Expression[]> {
    return this.cast(term, set).then((castTerm: Fmt.Expression) =>
      this.fullyUnfoldOutside(castTerm, HLMExpressionType.ElementTerm));
  }

  private getTargetUtils(path: Fmt.Path, definition: Fmt.Definition): HLMUtils {
    const libraryDataAccessor = this.libraryDataAccessor.getAccessorForSection(path.parentPath);
    return new HLMUtils(definition, libraryDataAccessor, this.supportPlaceholders);
  }

  private followSetTermWithPath(term: Fmt.Expression, path: Fmt.Path, definition: Fmt.Definition): CachedPromise<Fmt.Expression> {
    const targetUtils = this.getTargetUtils(path, definition);
    return targetUtils.getFinalSuperset(term, eliminateVariablesOnly)
      .then((finalSet: Fmt.Expression) => this.substitutePath(finalSet, path, [definition]));
  }

  private getFinalSetWithPath(term: Fmt.Expression, path: Fmt.Path, definition: Fmt.Definition): CachedPromise<Fmt.Expression> {
    const targetUtils = this.getTargetUtils(path, definition);
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
    switch (expressionType) {
    case HLMExpressionType.SetTerm:
      return new FmtHLM.MetaRefExpression_setStructuralCases(term, construction, cases);
    case HLMExpressionType.ElementTerm:
      return new FmtHLM.MetaRefExpression_structuralCases(term, construction, cases);
    case HLMExpressionType.Formula:
      return new FmtHLM.MetaRefExpression_structural(term, construction, cases);
    default:
      throw new Error('Invalid expression type');
    }
  }

  buildSingleStructuralCaseTerm(term: Fmt.Expression, construction: Fmt.Expression, constructor: Fmt.Expression, parameters: Fmt.ParameterList | undefined, value: Fmt.Expression, expressionType: HLMExpressionType): Fmt.Expression {
    const structuralCase = new FmtHLM.ObjectContents_StructuralCase(constructor, parameters, value);
    return this.buildStructuralCaseTerm(term, construction, [structuralCase], expressionType);
  }

  formulaUnfoldsTo(source: Fmt.Expression, target: Fmt.Expression): CachedPromise<boolean> {
    return this.unfoldsTo(source, target, HLMExpressionType.Formula);
  }

  private unfoldsTo(source: Fmt.Expression, target: Fmt.Expression, expressionType: HLMExpressionType, checkForSyntacticEquivalence: boolean = true): CachedPromise<boolean> {
    const knownDifferences: Fmt.Expression[] = [];
    const newUnfoldLocations: Fmt.Expression[] = [];
    const unfoldLocationsToCheck: Fmt.Expression[] = [];
    // Note that findDifferenceFn will only be called for pairs of subexpressions that are different.
    const findDifferenceFn = (nonMatchingExpression: Fmt.Expression, subExpression: Fmt.Expression) => {
      if (knownDifferences.indexOf(subExpression) < 0) {
        newUnfoldLocations.push(subExpression);
        return true;
      } else {
        // Also consider unfolding at the common parent of differences found in previous iterations.
        return false;
      }
    };
    for (;;) {
      // If we call isEquivalentTo like this, it is guaranteed to call findDifferenceFn with subexpressions
      // of source as the right-hand side, but not necessarily with subexpressions of target as the left-hand
      // side.
      target.isEquivalentTo(source, findDifferenceFn);
      if (newUnfoldLocations.length) {
        unfoldLocationsToCheck.push(newUnfoldLocations[0]);
      }
      if (newUnfoldLocations.length <= 1) {
        // If we only have a single (additional) difference, we can stop considering parents.
        break;
      }
      knownDifferences.push(...newUnfoldLocations);
      newUnfoldLocations.length = 0;
    }

    if (!unfoldLocationsToCheck.length
        || (checkForSyntacticEquivalence && this.areExpressionsSyntacticallyEquivalent(source, target))) {
      return CachedPromise.resolve(true);
    }

    let resultPromise = CachedPromise.resolve(false);
    for (const unfoldLocation of unfoldLocationsToCheck) {
      const allowDefinitionRefExpression = !(expressionType === HLMExpressionType.Formula && unfoldLocation === source);
      if (this.canUnfoldAt(unfoldLocation, allowDefinitionRefExpression)) {
        const unfoldParameters: HLMUnfoldParameters = {
          ...unfoldAll,
          requiredUnfoldLocation: unfoldLocation
        };
        resultPromise = resultPromise.or(() =>
          this.getNextExpressions(source, unfoldParameters, expressionType).then((nextSources: Fmt.Expression[] | undefined) => {
            let result = CachedPromise.resolve(false);
            if (nextSources) {
              for (const nextSource of nextSources) {
                result = result.or(() => this.unfoldsTo(nextSource, target, expressionType, false));
              }
            }
            return result;
          }));
      }
    }

    return resultPromise;
  }

  private canUnfoldAt(expression: Fmt.Expression, allowDefinitionRefExpression: boolean): boolean {
    if (expression instanceof Fmt.VariableRefExpression) {
      const type = expression.variable.type;
      if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
        return true;
      }
    }
    if (expression instanceof Fmt.DefinitionRefExpression) {
      return allowDefinitionRefExpression;
    }
    if (expression instanceof FmtHLM.MetaRefExpression_structural
        || expression instanceof FmtHLM.MetaRefExpression_setStructuralCases
        || expression instanceof FmtHLM.MetaRefExpression_structuralCases
        || expression instanceof FmtHLM.MetaRefExpression_not
        || expression instanceof FmtHLM.MetaRefExpression_and
        || expression instanceof FmtHLM.MetaRefExpression_or
        || expression instanceof FmtHLM.MetaRefExpression_equiv) {
      return true;
    }
    return false;
  }

  getSubstitutionSourceInfo(source: Fmt.Expression, sourceIndex: number): HLMSubstitutionSourceInfo | undefined {
    const equivalenceListInfo = this.getEquivalenceListInfo(source);
    if (equivalenceListInfo && sourceIndex >= 0 && sourceIndex < equivalenceListInfo.items.length) {
      return this.createSubstitutionSourceInfo(equivalenceListInfo, sourceIndex);
    } else {
      return undefined;
    }
  }

  private createSubstitutionSourceInfo(equivalenceListInfo: HLMEquivalenceListInfo, sourceIndex: number): HLMSubstitutionSourceInfo {
    return {
      source: equivalenceListInfo.items[sourceIndex],
      targets: equivalenceListInfo.items.slice(0, sourceIndex).concat(equivalenceListInfo.items.slice(sourceIndex + 1))
    };
  }

  getAllSubstitutionResults(expression: Fmt.Expression, sourceInfo: HLMSubstitutionSourceInfo, substituteIndividualSubExpressions: boolean): Fmt.Expression[] {
    const result: Fmt.Expression[] = [];
    for (const target of sourceInfo.targets) {
      let substitutedExpression = expression.substitute((subExpression: Fmt.Expression) => {
        if (this.areExpressionsSyntacticallyEquivalent(subExpression, sourceInfo.source)) {
          return target;
        } else {
          return subExpression;
        }
      });
      if (substitutedExpression !== expression) {
        result.push(substitutedExpression);
        if (substituteIndividualSubExpressions) {
          for (let substitutionIndex = 0; substitutedExpression !== expression; substitutionIndex++) {
            let currentIndex = 0;
            substitutedExpression = expression.substitute((subExpression: Fmt.Expression) => {
              if (this.areExpressionsSyntacticallyEquivalent(subExpression, sourceInfo.source) && currentIndex++ === substitutionIndex) {
                return target;
              } else {
                return subExpression;
              }
            });
          }
        }
      }
    }
    return result;
  }

  getAllSubstitutions(expression: Fmt.Expression, source: Fmt.Expression, substituteIndividualSubExpressions: boolean): HLMSubstitutionResult[] | undefined {
    const equivalenceListInfo = this.getEquivalenceListInfo(source);
    if (equivalenceListInfo) {
      const result: HLMSubstitutionResult[] = [];
      for (let sourceIndex = 0; sourceIndex < equivalenceListInfo.items.length; sourceIndex++) {
        const sourceInfo = this.createSubstitutionSourceInfo(equivalenceListInfo, sourceIndex);
        for (const substitutionResult of this.getAllSubstitutionResults(expression, sourceInfo, substituteIndividualSubExpressions)) {
          result.push({
            result: substitutionResult,
            sourceIndex: sourceIndex
          });
        }
      }
      return result;
    } else {
      return undefined;
    }
  }

  substitutesTo(input: Fmt.Expression, output: Fmt.Expression, sourceInfo: HLMSubstitutionSourceInfo): boolean {
    const unificationFn = (left: Fmt.Expression, right: Fmt.Expression) =>
      (this.areExpressionsSyntacticallyEquivalent(left, sourceInfo.source)
       && sourceInfo.targets.some((target: Fmt.Expression) => this.areExpressionsSyntacticallyEquivalent(right, target)));
    return input.isEquivalentTo(output, unificationFn);
  }

  negateFormula(formula: Fmt.Expression, followDefinitions: boolean): CachedPromise<Fmt.Expression> {
    if (formula instanceof FmtHLM.MetaRefExpression_not) {
      return CachedPromise.resolve(formula.formula);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and) {
      return this.negateFormulas(formula.formulas ?? [], followDefinitions).then((negatedFormulas: Fmt.Expression[]) =>
        new FmtHLM.MetaRefExpression_or(...negatedFormulas));
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      return this.negateFormulas(formula.formulas ?? [], followDefinitions).then((negatedFormulas: Fmt.Expression[]) =>
        new FmtHLM.MetaRefExpression_and(...negatedFormulas));
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      return this.negateFormula(formula.formula, followDefinitions).then((negatedFormula: Fmt.Expression) =>
        new FmtHLM.MetaRefExpression_exists(formula.parameters, negatedFormula));
    } else if (formula instanceof FmtHLM.MetaRefExpression_exists && formula.formula) {
      return this.negateFormula(formula.formula, followDefinitions).then((negatedFormula: Fmt.Expression) =>
        new FmtHLM.MetaRefExpression_forall(formula.parameters, negatedFormula));
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      let resultCases: CachedPromise<FmtHLM.ObjectContents_StructuralCase[]> = CachedPromise.resolve([]);
      for (const structuralCase of formula.cases) {
        resultCases = resultCases.then((negatedCases: FmtHLM.ObjectContents_StructuralCase[]) =>
          this.negateFormula(structuralCase.value, followDefinitions).then((negatedFormula: Fmt.Expression) => {
            const resultCase = new FmtHLM.ObjectContents_StructuralCase(structuralCase._constructor, structuralCase.parameters, negatedFormula, structuralCase.rewrite);
            return negatedCases.concat(resultCase);
          })
        );
      }
      return resultCases.then((cases: FmtHLM.ObjectContents_StructuralCase[]) =>
        new FmtHLM.MetaRefExpression_structural(formula.term, formula.construction, cases));
    } else if (formula instanceof Fmt.DefinitionRefExpression && !(formula.path.parentPath instanceof Fmt.Path) && followDefinitions) {
      return this.getDefinition(formula.path).then((definition: Fmt.Definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate && definition.contents.properties) {
          const negationArg = definition.contents.properties.getOptionalValue('negation');
          if (negationArg) {
            return this.substitutePath(negationArg, formula.path, [definition]);
          }
        }
        return new FmtHLM.MetaRefExpression_not(formula);
      });
    } else {
      return CachedPromise.resolve(new FmtHLM.MetaRefExpression_not(formula));
    }
  }

  negateFormulas(formulas: Fmt.Expression[], followDefinitions: boolean): CachedPromise<Fmt.Expression[]> {
    let result: CachedPromise<Fmt.Expression[]> = CachedPromise.resolve([]);
    for (const formula of formulas) {
      result = result.then((negatedFormulas: Fmt.Expression[]) =>
        this.negateFormula(formula, followDefinitions).then((negatedFormula: Fmt.Expression) =>
          negatedFormulas.concat(negatedFormula)
        )
      );
    }
    return result;
  }

  isTrivialTautology(formula: Fmt.Expression, followDefinitions: boolean): CachedPromise<boolean> {
    if (formula instanceof FmtHLM.MetaRefExpression_and) {
      let resultPromise = CachedPromise.resolve(true);
      if (formula.formulas) {
        for (const item of formula.formulas) {
          resultPromise = resultPromise.and(() => this.isTrivialTautology(item, followDefinitions));
        }
      }
      return resultPromise;
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      if (formula.formulas) {
        let resultPromise = CachedPromise.resolve(false);
        const items = formula.formulas;
        for (const item of items) {
          resultPromise = resultPromise.or(() => this.isTrivialTautology(item, followDefinitions));
        }
        return resultPromise.or(() => this.containsContradictoryFormulas(items, followDefinitions));
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      let resultPromise = CachedPromise.resolve(true);
      const firstFormula = formula.formulas[0];
      for (let index = 1; index < formula.formulas.length; index++) {
        const currentFormula = formula.formulas[index];
        if (followDefinitions) {
          resultPromise = resultPromise.and(() =>
            this.formulaUnfoldsTo(firstFormula, currentFormula).or(() => this.formulaUnfoldsTo(currentFormula, firstFormula)));
        } else if (!this.areExpressionsSyntacticallyEquivalent(firstFormula, currentFormula)) {
          return CachedPromise.resolve(false);
        }
      }
      return resultPromise;
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      return this.isTrivialTautology(formula.formula, followDefinitions);
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      if (formula._set instanceof FmtHLM.MetaRefExpression_enumeration && formula._set.terms) {
        for (const term of formula._set.terms) {
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
      const expressionType = formula instanceof FmtHLM.MetaRefExpression_setEquals ? HLMExpressionType.SetTerm : HLMExpressionType.ElementTerm;
      let resultPromise = CachedPromise.resolve(true);
      const firstTerm = formula.terms[0];
      for (let index = 1; index < formula.terms.length; index++) {
        const currentTerm = formula.terms[index];
        if (followDefinitions) {
          resultPromise = resultPromise.and(() =>
            this.unfoldsTo(firstTerm, currentTerm, expressionType).or(() => this.unfoldsTo(currentTerm, firstTerm, expressionType)));
        } else if (!this.areExpressionsSyntacticallyEquivalent(firstTerm, currentTerm)) {
          return CachedPromise.resolve(false);
        }
      }
      return resultPromise;
    }
    return CachedPromise.resolve(false);
  }

  isTrivialContradiction(formula: Fmt.Expression, followDefinitions: boolean): CachedPromise<boolean> {
    if ((formula instanceof FmtHLM.MetaRefExpression_and || formula instanceof FmtHLM.MetaRefExpression_equiv) && formula.formulas) {
      // Avoid negating all formulas, as that can obscure contradictions between them.
      let resultPromise = CachedPromise.resolve(false);
      const items = formula.formulas;
      if (formula instanceof FmtHLM.MetaRefExpression_and) {
        for (const item of items) {
          resultPromise = resultPromise.or(() => this.isTrivialContradiction(item, followDefinitions));
        }
      }
      return resultPromise.or(() => this.containsContradictoryFormulas(items, followDefinitions));
    }
    return this.negateFormula(formula, followDefinitions).then((negatedFormula: Fmt.Expression) => this.isTrivialTautology(negatedFormula, followDefinitions));
  }

  private containsContradictoryFormulas(formulas: Fmt.Expression[], followDefinitions: boolean): CachedPromise<boolean> {
    let resultPromise = CachedPromise.resolve(false);
    for (let index = 1; index < formulas.length; index++) {
      const formula = formulas[index];
      resultPromise = resultPromise.or(() =>
        this.negateFormula(formula, followDefinitions).then((negatedItem: Fmt.Expression) => {
          for (const previousFormula of formulas) {
            if (previousFormula === formula) {
              break;
            }
            if (this.areExpressionsSyntacticallyEquivalent(negatedItem, previousFormula)) {
              return true;
            }
            if (previousFormula instanceof FmtHLM.MetaRefExpression_not && this.areExpressionsSyntacticallyEquivalent(formula, previousFormula.formula)) {
              return true;
            }
          }
          return false;
        }));
    }
    return resultPromise;
  }

  private isDeclaredSubsetOf(subset: Fmt.Expression, superset: Fmt.Expression): CachedPromise<boolean> {
    return this.isExplicitlyDeclaredSubsetOf(subset, superset).or(() =>
      this.getNextSetTerms(superset, followEmbedding).then((nextSupersets: Fmt.Expression[] | undefined) => {
        let result = CachedPromise.resolve(false);
        if (nextSupersets) {
          for (const nextSuperset of nextSupersets) {
            result = result.or(() => this.isDeclaredSubsetOf(subset, nextSuperset));
          }
        }
        return result;
      }));
  }

  private isExplicitlyDeclaredSubsetOf(subset: Fmt.Expression, superset: Fmt.Expression): CachedPromise<boolean> {
    if (this.areExpressionsSyntacticallyEquivalent(subset, superset)) {
      return CachedPromise.resolve(true);
    } else {
      return this.getNextSetTerms(subset, findExplicitlyDeclaredSuperset).then((nextSubsets: Fmt.Expression[] | undefined) => {
        let result = CachedPromise.resolve(false);
        if (nextSubsets) {
          for (const nextSubset of nextSubsets) {
            result = result.or(() => this.isExplicitlyDeclaredSubsetOf(nextSubset, superset));
          }
        }
        return result;
      });
    }
  }

  private isDeclaredElementOf(element: Fmt.Expression, set: Fmt.Expression): CachedPromise<boolean> {
    return this.getDeclaredSet(element).then((declaredSet: Fmt.Expression) =>
      this.isDeclaredSubsetOf(declaredSet, set));
  }

  triviallyImplies(sourceFormula: Fmt.Expression, targetFormula: Fmt.Expression, followDefinitions: boolean): CachedPromise<boolean> {
    if (this.areExpressionsSyntacticallyEquivalent(sourceFormula, targetFormula)) {
      return CachedPromise.resolve(true);
    }
    if (sourceFormula instanceof FmtHLM.MetaRefExpression_or) {
      let innerResultPromise = CachedPromise.resolve(true);
      if (sourceFormula.formulas) {
        for (const item of sourceFormula.formulas) {
          innerResultPromise = innerResultPromise.and(() => this.triviallyImplies(item, targetFormula, followDefinitions));
        }
      }
      return innerResultPromise;
    }
    if (targetFormula instanceof FmtHLM.MetaRefExpression_and) {
      let innerResultPromise = CachedPromise.resolve(true);
      if (targetFormula.formulas) {
        for (const item of targetFormula.formulas) {
          innerResultPromise = innerResultPromise.and(() => this.triviallyImplies(sourceFormula, item, followDefinitions));
        }
      }
      return innerResultPromise;
    }
    if ((sourceFormula instanceof FmtHLM.MetaRefExpression_exists || sourceFormula instanceof FmtHLM.MetaRefExpression_existsUnique)
        && targetFormula instanceof FmtHLM.MetaRefExpression_exists) {
      const replacedParameters: Fmt.ReplacedParameter[] = [];
      if (sourceFormula.parameters.isEquivalentTo(targetFormula.parameters, undefined, replacedParameters)
          && (!targetFormula.formula || sourceFormula.formula?.isEquivalentTo(targetFormula.formula, undefined, replacedParameters))) {
        return CachedPromise.resolve(true);
      }
    }
    let resultPromise = this.isTrivialContradiction(sourceFormula, followDefinitions)
      .or(() => this.isTrivialTautology(targetFormula, followDefinitions));
    if ((targetFormula instanceof FmtHLM.MetaRefExpression_setEquals || targetFormula instanceof FmtHLM.MetaRefExpression_equals) && targetFormula.terms.length > 2) {
      const chainEqualities: Fmt.Expression[] = [];
      const listEqualities: Fmt.Expression[] = [];
      const listRightTerm = targetFormula.terms[targetFormula.terms.length - 1];
      for (let leftIndex = 0; leftIndex < targetFormula.terms.length - 1; leftIndex++) {
        const leftTerm = targetFormula.terms[leftIndex];
        const chainRightTerm = targetFormula.terms[leftIndex + 1];
        const chainEquality = (targetFormula instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(leftTerm, chainRightTerm) : new FmtHLM.MetaRefExpression_equals(leftTerm, chainRightTerm));
        chainEqualities.push(chainEquality);
        const listEquality = (targetFormula instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(leftTerm, listRightTerm) : new FmtHLM.MetaRefExpression_equals(leftTerm, listRightTerm));
        listEqualities.push(listEquality);
      }
      resultPromise = resultPromise
        .or(() => this.triviallyImplies(sourceFormula, new FmtHLM.MetaRefExpression_and(...chainEqualities), followDefinitions))
        .or(() => this.triviallyImplies(sourceFormula, new FmtHLM.MetaRefExpression_and(...listEqualities), followDefinitions));
    } else if ((sourceFormula instanceof FmtHLM.MetaRefExpression_setEquals || sourceFormula instanceof FmtHLM.MetaRefExpression_equals) && sourceFormula.terms.length > 2) {
      for (let leftIndex = 0; leftIndex < sourceFormula.terms.length - 1; leftIndex++) {
        const leftTerm = sourceFormula.terms[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < sourceFormula.terms.length; rightIndex++) {
          const rightTerm = sourceFormula.terms[rightIndex];
          const partialEquality = (sourceFormula instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(leftTerm, rightTerm) : new FmtHLM.MetaRefExpression_equals(leftTerm, rightTerm));
          resultPromise = resultPromise.or(() => this.triviallyImplies(partialEquality, targetFormula, followDefinitions));
        }
      }
    }
    if (sourceFormula instanceof FmtHLM.MetaRefExpression_and) {
      if (sourceFormula.formulas) {
        for (const item of sourceFormula.formulas) {
          resultPromise = resultPromise.or(() => this.triviallyImplies(item, targetFormula, followDefinitions));
        }
      }
    } else if (targetFormula instanceof FmtHLM.MetaRefExpression_or) {
      if (targetFormula.formulas) {
        for (const item of targetFormula.formulas) {
          resultPromise = resultPromise.or(() => this.triviallyImplies(sourceFormula, item, followDefinitions));
        }
      }
    } else if (followDefinitions) {
      resultPromise = resultPromise
        .or(() => this.formulaUnfoldsTo(sourceFormula, targetFormula))
        .or(() => this.formulaUnfoldsTo(targetFormula, sourceFormula));
    }
    if (followDefinitions) {
      if (sourceFormula instanceof Fmt.DefinitionRefExpression && !(sourceFormula.path.parentPath instanceof Fmt.Path)) {
        resultPromise = resultPromise.or(() =>
          this.getDefinition(sourceFormula.path).then((definition: Fmt.Definition) => {
            let innerResultPromise = CachedPromise.resolve(false);
            if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
              for (const definitionFormula of definition.contents.definition) {
                innerResultPromise = innerResultPromise.or(() => {
                  const substitutedDefinitionFormula = this.substitutePath(definitionFormula, sourceFormula.path, [definition]);
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
              for (const definitionFormula of definition.contents.definition) {
                innerResultPromise = innerResultPromise.or(() => {
                  const substitutedDefinitionFormula = this.substitutePath(definitionFormula, targetFormula.path, [definition]);
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

  // TODO when checking expressions for equivalence, ignore certain aspects:
  // * existence of constraint arguments
  // * proofs in arguments
  // * different variants of associative and commutative expressions
  // * rewritten constructor terms
  // * expressions that have been proven to be compatible with other expressions.
  // However, we somehow need to make sure to avoid circularly depending on such properties while proving them.
  // Maybe these properties could be inner definitions that are explicitly referenced.
  areExpressionsSyntacticallyEquivalent(left: Fmt.Expression, right: Fmt.Expression): boolean {
    const fn = (leftPart: Fmt.Expression, rightPart: Fmt.Expression) => {
      if ((leftPart instanceof FmtHLM.MetaRefExpression_setAssociative || leftPart instanceof FmtHLM.MetaRefExpression_associative || leftPart instanceof FmtHLM.MetaRefExpression_asElementOf)
          && !(rightPart instanceof FmtHLM.MetaRefExpression_setAssociative || rightPart instanceof FmtHLM.MetaRefExpression_associative || rightPart instanceof FmtHLM.MetaRefExpression_asElementOf)) {
        if (this.areExpressionsSyntacticallyEquivalent(leftPart.term, rightPart)) {
          return true;
        }
      } else if ((rightPart instanceof FmtHLM.MetaRefExpression_setAssociative || rightPart instanceof FmtHLM.MetaRefExpression_associative || rightPart instanceof FmtHLM.MetaRefExpression_asElementOf)
                 && !(leftPart instanceof FmtHLM.MetaRefExpression_setAssociative || leftPart instanceof FmtHLM.MetaRefExpression_associative || leftPart instanceof FmtHLM.MetaRefExpression_asElementOf)) {
        if (this.areExpressionsSyntacticallyEquivalent(leftPart, rightPart.term)) {
          return true;
        }
      } else if (((leftPart instanceof FmtHLM.MetaRefExpression_setEquals && rightPart instanceof FmtHLM.MetaRefExpression_setEquals)
                  || (leftPart instanceof FmtHLM.MetaRefExpression_equals && rightPart instanceof FmtHLM.MetaRefExpression_equals))
                 && leftPart.terms.length === rightPart.terms.length) {
        const leftTerms = [...leftPart.terms];
        const rightTerms = [...rightPart.terms];
        for (const leftTerm of leftTerms) {
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
      } else if ((leftPart instanceof FmtHLM.MetaRefExpression_equiv && rightPart instanceof FmtHLM.MetaRefExpression_equiv)
                 && leftPart.formulas.length === rightPart.formulas.length) {
        const leftFormulas = [...leftPart.formulas];
        const rightFormulas = [...rightPart.formulas];
        for (const leftFormula of leftFormulas) {
          let found = false;
          for (let rightIndex = 0; rightIndex < rightFormulas.length; rightIndex++) {
            if (this.areExpressionsSyntacticallyEquivalent(leftFormula, rightFormulas[rightIndex])) {
              found = true;
              rightFormulas.splice(rightIndex, 1);
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
      const negationDefinitionsPromise = this.getFormulaDefinitions(formula.formula, side);
      if (negationDefinitionsPromise) {
        return negationDefinitionsPromise.then((negationDefinitions: HLMFormulaDefinition[]) => {
          let result: CachedPromise<HLMFormulaDefinition[]> = CachedPromise.resolve([]);
          for (const negationDefinition of negationDefinitions) {
            result = result.then((currentResult: HLMFormulaDefinition[]) =>
              this.negateFormula(negationDefinition.formula, true).then((negatedFormula: Fmt.Expression) =>
                currentResult.concat({
                  formula: negatedFormula,
                  definitionRef: negationDefinition.definitionRef,
                  side: negationDefinition.side
                })));
          }
          return result;
        });
      }
    } else if (formula instanceof Fmt.DefinitionRefExpression && side === undefined) {
      const path = formula.path;
      return this.getOuterDefinition(formula).then((definition: Fmt.Definition) => {
        const result: HLMFormulaDefinition[] = [];
        if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
          for (const item of definition.contents.definition) {
            result.push({
              formula: this.substitutePath(item, path, [definition]),
              definitionRef: formula
            });
          }
        }
        return result;
      });
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      return this.getElementFormulaDefinitions(formula.element, formula._set, side);
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub && side === undefined) {
      const paramType = new FmtHLM.MetaRefExpression_Element(formula.subset);
      const param = this.createParameter(paramType, 'x');
      const parameters = new Fmt.ParameterList(param);
      const variableRef = new Fmt.VariableRefExpression(param);
      const resultFormula = new FmtHLM.MetaRefExpression_in(variableRef, formula.superset);
      const result = new FmtHLM.MetaRefExpression_forall(parameters, resultFormula);
      return CachedPromise.resolve([{
        formula: result
      }]);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals && formula.terms.length === 2) {
      if (side === undefined) {
        return this.getTermEqualityDefinitions(formula.terms[0], formula.terms[1]);
      } else if (side >= 0 && side < formula.terms.length) {
        const term = formula.terms[side];
        if (term instanceof Fmt.DefinitionRefExpression) {
          const otherTerm = formula.terms[1 - side];
          return this.getImplicitOperatorDefinition(term, otherTerm, side);
        }
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_existsUnique && side === undefined) {
      const replacedParameters: Fmt.ReplacedParameter[] = [];
      const parameters = formula.parameters.clone(replacedParameters);
      const equalities: Fmt.Expression[] = [];
      for (const param of formula.parameters) {
        if (param.type instanceof FmtHLM.MetaRefExpression_Element) {
          const originalVariableRef = new Fmt.VariableRefExpression(param);
          const substitutedVariableRef = new Fmt.VariableRefExpression(param.findReplacement(replacedParameters));
          const equality = new FmtHLM.MetaRefExpression_equals(substitutedVariableRef, originalVariableRef);
          equalities.push(equality);
        }
      }
      if (formula.formula) {
        const substitutedFormula = formula.formula.clone(replacedParameters);
        parameters.push(this.createConstraintParameter(substitutedFormula, '_1'));
      }
      const equalityFormula = this.createConjunction(equalities);
      const uniquenessFormula = new FmtHLM.MetaRefExpression_forall(parameters, equalityFormula);
      const resultFormula = formula.formula ? this.createConjunction([formula.formula, uniquenessFormula]) : uniquenessFormula;
      const result = new FmtHLM.MetaRefExpression_exists(formula.parameters, resultFormula);
      return CachedPromise.resolve([{
        formula: result
      }]);
    }
    return undefined;
  }

  private getElementFormulaDefinitions(element: Fmt.Expression, set: Fmt.Expression, side: number | undefined): CachedPromise<HLMFormulaDefinition[]> | undefined {
    // TODO special support for embeddings (e.g. prove that an integer is a natural number)
    if (set instanceof FmtHLM.MetaRefExpression_enumeration && side === undefined) {
      const formulas = set.terms?.map((term: Fmt.Expression) =>
        new FmtHLM.MetaRefExpression_equals(element, term)) ?? [];
      const result = this.createDisjunction(formulas);
      return CachedPromise.resolve([{
        formula: result
      }]);
    } else if (set instanceof FmtHLM.MetaRefExpression_subset && side === undefined) {
      const paramType = set.parameter.type as FmtHLM.MetaRefExpression_Element;
      const elementConstraint = new FmtHLM.MetaRefExpression_in(element, paramType._set);
      let result = FmtUtils.substituteVariable(set.formula, set.parameter, element);
      if (!(result instanceof FmtHLM.MetaRefExpression_and
            && result.formulas?.some((item: Fmt.Expression) => elementConstraint.isEquivalentTo(item)))) {
        result = this.createConjunction([elementConstraint, result]);
      }
      return CachedPromise.resolve([{
        formula: result
      }]);
    } else if (set instanceof FmtHLM.MetaRefExpression_extendedSubset && side === undefined) {
      const equality = new FmtHLM.MetaRefExpression_equals(element, set.term);
      const result = new FmtHLM.MetaRefExpression_exists(set.parameters, equality);
      return CachedPromise.resolve([{
        formula: result
      }]);
    } else if (set instanceof Fmt.DefinitionRefExpression) {
      const definitionRef = set;
      const path = definitionRef.path;
      return this.getOuterDefinition(definitionRef).then((definition: Fmt.Definition) => {
        let resultPromise: CachedPromise<HLMFormulaDefinition[]> = CachedPromise.resolve([]);
        if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
          for (const item of definition.contents.definition) {
            resultPromise = resultPromise.then((currentResult: HLMFormulaDefinition[]) => {
              const unfoldedSet = this.substitutePath(item, path, [definition]);
              const newFormula = new FmtHLM.MetaRefExpression_in(element, unfoldedSet);
              const newFormulaDefinitionsPromise = this.getFormulaDefinitions(newFormula, side);
              if (newFormulaDefinitionsPromise) {
                return newFormulaDefinitionsPromise.then((newFormulaDefinitions: HLMFormulaDefinition[]) =>
                  currentResult.concat(newFormulaDefinitions.map((newFormulaDefinition: HLMFormulaDefinition): HLMFormulaDefinition => ({
                    formula: newFormulaDefinition.formula,
                    definitionRef: definitionRef,
                    side: newFormulaDefinition.side
                  }))));
              } else {
                return currentResult;
              }
            });
          }
        }
        return resultPromise;
      });
    } else {
      return undefined;
    }
  }

  private getTermEqualityDefinitions(left: Fmt.Expression, right: Fmt.Expression): CachedPromise<HLMFormulaDefinition[]> {
    return this.getCommonFinalSet([left, right]).then((set: Fmt.Expression) =>
      this.castAndFullyUnfoldElementTermOutside(left, set).then((unfoldedLeftTerms: Fmt.Expression[]) =>
        this.castAndFullyUnfoldElementTermOutside(right, set).then((unfoldedRightTerms: Fmt.Expression[]) => {
          const instances: ConstructionEqualityInstance[] = [];
          for (const unfoldedLeft of unfoldedLeftTerms) {
            if (unfoldedLeft instanceof Fmt.DefinitionRefExpression && unfoldedLeft.path.parentPath instanceof Fmt.Path) {
              const instance = this.getConstructionEqualityInstance(instances, unfoldedLeft.path.parentPath);
              instance.leftTerms.push(unfoldedLeft);
            }
          }
          for (const unfoldedRight of unfoldedRightTerms) {
            if (unfoldedRight instanceof Fmt.DefinitionRefExpression && unfoldedRight.path.parentPath instanceof Fmt.Path) {
              const instance = this.getConstructionEqualityInstance(instances, unfoldedRight.path.parentPath);
              instance.rightTerms.push(unfoldedRight);
            }
          }
          let resultPromise: CachedPromise<HLMFormulaDefinition[]> = CachedPromise.resolve([]);
          for (const instance of instances) {
            const definitionRef = new Fmt.DefinitionRefExpression(instance.constructionPath);
            resultPromise = resultPromise.then((currentResult: HLMFormulaDefinition[]) =>
              this.getDefinition(instance.constructionPath).then((constructionDefinition: Fmt.Definition) => {
                if (constructionDefinition.contents instanceof FmtHLM.ObjectContents_Construction && constructionDefinition.contents.rewrite) {
                  const rewriteDefinition = constructionDefinition.contents.rewrite;
                  if (!instance.leftTerms.length) {
                    const substitutedValue = this.substitutePath(rewriteDefinition.value, instance.constructionPath, [constructionDefinition]);
                    const rewrittenLeft = FmtUtils.substituteVariable(substitutedValue, rewriteDefinition.parameter, left);
                    if (rewrittenLeft instanceof Fmt.DefinitionRefExpression && rewrittenLeft.path.parentPath instanceof Fmt.Path && rewrittenLeft.path.parentPath.isEquivalentTo(instance.constructionPath)) {
                      instance.leftTerms.push(rewrittenLeft);
                    }
                  }
                  if (!instance.rightTerms.length) {
                    const substitutedValue = this.substitutePath(rewriteDefinition.value, instance.constructionPath, [constructionDefinition]);
                    const rewrittenRight = FmtUtils.substituteVariable(substitutedValue, rewriteDefinition.parameter, right);
                    if (rewrittenRight instanceof Fmt.DefinitionRefExpression && rewrittenRight.path.parentPath instanceof Fmt.Path && rewrittenRight.path.parentPath.isEquivalentTo(instance.constructionPath)) {
                      instance.rightTerms.push(rewrittenRight);
                    }
                  }
                }
                for (const leftTerm of instance.leftTerms) {
                  for (const rightTerm of instance.rightTerms) {
                    if (leftTerm.path.name === rightTerm.path.name) {
                      if (leftTerm.isEquivalentTo(rightTerm)) {
                        currentResult.push({
                          formula: new FmtHLM.MetaRefExpression_and,
                          definitionRef: definitionRef
                        });
                      } else {
                        const constructorDefinition = constructionDefinition.innerDefinitions.getDefinition(leftTerm.path.name);
                        const equalityDefinitions = this.getConstructorEqualityDefinitions(instance.constructionPath, constructionDefinition, constructorDefinition, leftTerm.path.arguments, rightTerm.path.arguments);
                        for (const equalityDefinition of equalityDefinitions) {
                          currentResult.push({
                            formula: equalityDefinition,
                            definitionRef: definitionRef
                          });
                        }
                      }
                    } else {
                      currentResult.push({
                        formula: new FmtHLM.MetaRefExpression_or,
                        definitionRef: definitionRef
                      });
                    }
                  }
                }
                return currentResult;
              }));
          }
          return resultPromise;
        })));
  }

  private getConstructionEqualityInstance(instances: ConstructionEqualityInstance[], constructionPath: Fmt.Path): ConstructionEqualityInstance {
    for (const instance of instances) {
      if (constructionPath.isEquivalentTo(instance.constructionPath)) {
        return instance;
      }
    }
    const newInstance: ConstructionEqualityInstance = {
      constructionPath: constructionPath,
      leftTerms: [],
      rightTerms: []
    };
    instances.push(newInstance);
    return newInstance;
  }

  private getConstructorEqualityDefinitions(constructionPath: Fmt.Path, constructionDefinition: Fmt.Definition, constructorDefinition: Fmt.Definition, leftArguments: Fmt.ArgumentList, rightArguments: Fmt.ArgumentList): Fmt.Expression[] {
    if (constructionDefinition.contents instanceof FmtHLM.ObjectContents_Construction) {
      if (constructorDefinition.contents instanceof FmtHLM.ObjectContents_Constructor) {
        const equalityDefinition = constructorDefinition.contents.equalityDefinition;
        if (equalityDefinition) {
          const leftParameters = equalityDefinition.leftParameters;
          const rightParameters = equalityDefinition.rightParameters;
          return equalityDefinition.definition.map((equalityFormula: Fmt.Expression) => {
            const substitutionContext = new HLMSubstitutionContext;
            this.addTargetPathSubstitution(constructionPath.parentPath, substitutionContext);
            this.addArgumentListSubstitution(constructionDefinition.parameters, constructionPath.arguments, constructionPath.parentPath, substitutionContext);
            equalityFormula = this.applySubstitutionContext(equalityFormula, substitutionContext);
            // Since we need to substitute the constructor parameters twice, we cannot use a single substitution context here.
            // TODO figure out whether avoiding substitution contexts causes any problems
            equalityFormula = this.substituteParameters(equalityFormula, leftParameters, constructorDefinition.parameters);
            equalityFormula = this.substituteArguments(equalityFormula, constructorDefinition.parameters, leftArguments, constructionPath.parentPath);
            equalityFormula = this.substituteParameters(equalityFormula, rightParameters, constructorDefinition.parameters);
            equalityFormula = this.substituteArguments(equalityFormula, constructorDefinition.parameters, rightArguments, constructionPath.parentPath);
            return equalityFormula;
          });
        } else {
          return [new FmtHLM.MetaRefExpression_and];
        }
      }
    }
    return [];
  }

  private getImplicitOperatorDefinition(term: Fmt.DefinitionRefExpression, otherTerm: Fmt.Expression, side: number): CachedPromise<HLMFormulaDefinition[]> {
    const path = term.path;
    return this.getOuterDefinition(term).then((definition: Fmt.Definition) => {
      if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
        const contents = definition.contents;
        const paramType = contents.parameter.type as FmtHLM.MetaRefExpression_Element;
        const set = this.substitutePath(paramType._set, path, [definition]);
        const elementCondition = new FmtHLM.MetaRefExpression_in(otherTerm, set);
        return contents.definition.map((item: Fmt.Expression) => {
          let substitutedItem = this.substitutePath(item, path, [definition]);
          substitutedItem = FmtUtils.substituteVariable(substitutedItem, contents.parameter, otherTerm);
          if (substitutedItem instanceof FmtHLM.MetaRefExpression_equals && side < substitutedItem.terms.length) {
            substitutedItem = new FmtHLM.MetaRefExpression_equals(substitutedItem.terms[side], ...substitutedItem.terms.slice(0, side), ...substitutedItem.terms.slice(side + 1, substitutedItem.terms.length));
          }
          const conjunction = new FmtHLM.MetaRefExpression_and(elementCondition, substitutedItem);
          return {
            formula: conjunction,
            definitionRef: term,
            side: side
          };
        });
      }
      return [];
    });
  }

  getAllFormulaDefinitions(formula: Fmt.Expression): CachedPromise<HLMFormulaDefinition[]> | undefined {
    let resultPromise: CachedPromise<HLMFormulaDefinition[]> | undefined = undefined;
    for (const side of this.getAllFormulaSides(formula)) {
      if (resultPromise) {
        resultPromise = resultPromise.then((currentResult: HLMFormulaDefinition[]) => {
          const nextResultPromise = this.getFormulaDefinitions(formula, side);
          if (nextResultPromise) {
            return nextResultPromise.then((nextResult: HLMFormulaDefinition[]) => currentResult.concat(nextResult));
          } else {
            return currentResult;
          }
        });
      } else {
        resultPromise = this.getFormulaDefinitions(formula, side);
      }
    }
    return resultPromise;
  }

  getFormulaCases(formula: Fmt.Expression, side: number | undefined, isGoal: boolean): CachedPromise<HLMFormulaCase[] | undefined> | undefined {
    if (side === undefined) {
      if (formula instanceof (isGoal ? FmtHLM.MetaRefExpression_and : FmtHLM.MetaRefExpression_or) && formula.formulas) {
        return CachedPromise.resolve(formula.formulas.map((item: Fmt.Expression) => ({formula: item})));
      } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
        const getValueFormula = (value: Fmt.Expression) => value;
        return this.getStructuralFormulaCases(formula.construction, formula.term, formula.cases, getValueFormula);
      }
    } else {
      if (formula instanceof FmtHLM.MetaRefExpression_setEquals && side >= 0 && side < formula.terms.length) {
        const getValueFormula = (value: Fmt.Expression) => {
          const valueFormula = new FmtHLM.MetaRefExpression_setEquals(...formula.terms);
          valueFormula.terms[side] = value;
          return valueFormula;
        };
        return this.getFormulaSetTermCases(formula.terms[side], getValueFormula);
      } else if (formula instanceof FmtHLM.MetaRefExpression_equals && side >= 0 && side < formula.terms.length) {
        const getValueFormula = (value: Fmt.Expression) => {
          const valueFormula = new FmtHLM.MetaRefExpression_equals(...formula.terms);
          valueFormula.terms[side] = value;
          return valueFormula;
        };
        return this.getFormulaElementTermCases(formula.terms[side], getValueFormula);
      } else if (formula instanceof FmtHLM.MetaRefExpression_equiv && side >= 0 && side < formula.formulas.length) {
        const getValueFormula = (value: Fmt.Expression) => {
          const valueFormula = new FmtHLM.MetaRefExpression_equiv(...formula.formulas);
          valueFormula.formulas[side] = value;
          return valueFormula;
        };
        return this.getFormulaFormulaCases(formula.formulas[side], getValueFormula);
      }
    }
    return undefined;
  }

  private getFormulaSetTermCases(term: Fmt.Expression, getValueFormula: (value: Fmt.Expression) => Fmt.Expression): CachedPromise<HLMFormulaCase[] | undefined> {
    return this.fullyUnfoldOutside(term, HLMExpressionType.SetTerm).then((unfoldedTerms: Fmt.Expression[]) => {
      for (const unfoldedTerm of unfoldedTerms) {
        if (unfoldedTerm instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
          return this.getStructuralFormulaCases(unfoldedTerm.construction, unfoldedTerm.term, unfoldedTerm.cases, getValueFormula);
        }
      }
      return undefined;
    });
  }

  private getFormulaElementTermCases(term: Fmt.Expression, getValueFormula: (value: Fmt.Expression) => Fmt.Expression): CachedPromise<HLMFormulaCase[] | undefined> {
    return this.fullyUnfoldOutside(term, HLMExpressionType.ElementTerm).then((unfoldedTerms: Fmt.Expression[]) => {
      for (const unfoldedTerm of unfoldedTerms) {
        if (unfoldedTerm instanceof FmtHLM.MetaRefExpression_cases) {
          return unfoldedTerm.cases.map((item: FmtHLM.ObjectContents_Case): HLMFormulaCase => {
            const constraintParam = this.createConstraintParameter(item.formula, '_1');
            return {
              parameters: new Fmt.ParameterList(constraintParam),
              formula: getValueFormula(item.value)
            };
          });
        } else if (unfoldedTerm instanceof FmtHLM.MetaRefExpression_structuralCases) {
          return this.getStructuralFormulaCases(unfoldedTerm.construction, unfoldedTerm.term, unfoldedTerm.cases, getValueFormula);
        }
      }
      return undefined;
    });
  }

  private getFormulaFormulaCases(formula: Fmt.Expression, getValueFormula: (value: Fmt.Expression) => Fmt.Expression): CachedPromise<HLMFormulaCase[] | undefined> {
    return this.fullyUnfoldOutside(formula, HLMExpressionType.Formula).then((unfoldedFormulas: Fmt.Expression[]) => {
      for (const unfoldedFormula of unfoldedFormulas) {
        if (unfoldedFormula instanceof FmtHLM.MetaRefExpression_structural) {
          return this.getStructuralFormulaCases(unfoldedFormula.construction, unfoldedFormula.term, unfoldedFormula.cases, getValueFormula);
        }
      }
      return undefined;
    });
  }

  private getStructuralFormulaCases(construction: Fmt.Expression, term: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], getValueFormula: (value: Fmt.Expression) => Fmt.Expression): CachedPromise<HLMFormulaCase[]> | undefined {
    if (construction instanceof Fmt.DefinitionRefExpression) {
      let resultPromise: CachedPromise<HLMFormulaCase[]> = CachedPromise.resolve([]);
      for (const structuralCase of cases) {
        resultPromise = resultPromise.then((currentResult: HLMFormulaCase[]) =>
          this.getStructuralCaseTerm(construction.path, structuralCase).then((structuralCaseTerm: Fmt.Expression) => {
            const valueFormula = getValueFormula(structuralCase.value);
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

  private getFormulaCaseList(formula: Fmt.Expression, side: number | undefined, isGoal: boolean): CachedPromise<HLMFormulaCases | undefined> | undefined {
    return this.getFormulaCases(formula, side, isGoal)?.then((cases: HLMFormulaCase[] | undefined): HLMFormulaCases | undefined => (cases ? {
      cases: cases,
      side: side
    } : undefined));
  }

  getAllFormulaCases(formula: Fmt.Expression, isGoal: boolean): CachedPromise<HLMFormulaCases[]> | undefined {
    let resultPromise: CachedPromise<HLMFormulaCases[]> | undefined = undefined;
    for (const side of this.getAllFormulaSides(formula)) {
      if (resultPromise) {
        resultPromise = resultPromise.then((currentResult: HLMFormulaCases[]) => {
          const nextResultPromise = this.getFormulaCaseList(formula, side, isGoal);
          if (nextResultPromise) {
            return nextResultPromise.then((nextResult: HLMFormulaCases | undefined) =>
              (nextResult ? currentResult.concat(nextResult) : currentResult));
          } else {
            return currentResult;
          }
        });
      } else {
        resultPromise = this.getFormulaCaseList(formula, side, isGoal)?.then((caseList: HLMFormulaCases | undefined) =>
          (caseList ? [caseList] : []));
      }
    }
    return resultPromise;
  }

  getUseCasesProofParameters(formulaCase: HLMFormulaCase): Fmt.ParameterList {
    const result = new Fmt.ParameterList;
    if (formulaCase.parameters) {
      result.push(...formulaCase.parameters);
    }
    this.addProofConstraint(result, formulaCase.formula);
    return result;
  }

  private getAllFormulaSides(formula: Fmt.Expression): (number | undefined)[] {
    const result: (number | undefined)[] = [];
    if (formula instanceof FmtHLM.MetaRefExpression_setEquals || formula instanceof FmtHLM.MetaRefExpression_equals) {
      for (let index = 0; index < formula.terms.length; index++) {
        result.push(index);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      for (let index = 0; index < formula.formulas.length; index++) {
        result.push(index);
      }
    }
    result.push(undefined);
    return result;
  }

  externalToInternalIndex(externalIndex: BigInt | undefined): number | undefined {
    return externalIndex === undefined ? undefined : Number(externalIndex) - 1;
  }

  internalToExternalIndex(internalIndex: number | undefined): BigInt | undefined {
    return internalIndex === undefined ? undefined : BigInt(internalIndex + 1);
  }

  getPlaceholderArguments(params: Fmt.ParameterList, substitutionContext?: HLMSubstitutionContext, createPlaceholder: CreatePlaceholderFn = createStandardPlaceholder): Fmt.ArgumentList {
    const result = new Fmt.ArgumentList;
    const previousParams: Fmt.Parameter[] = [];
    for (const param of params) {
      const argumentSubstitutionContext = new HLMSubstitutionContext(substitutionContext);
      this.addArgumentListSubstitution(previousParams, result, undefined, argumentSubstitutionContext);
      const argValue = this.createArgumentValue(param, argumentSubstitutionContext, createPlaceholder);
      if (argValue) {
        result.push(new Fmt.Argument(param.name, argValue));
      }
      previousParams.push(param);
    }
    return result;
  }

  createArgumentValue(param: Fmt.Parameter, substitutionContext?: HLMSubstitutionContext, createPlaceholder: CreatePlaceholderFn = createStandardPlaceholder): Fmt.Expression | undefined {
    if (param.type instanceof Fmt.IndexedExpression) {
      return new Fmt.ArrayExpression([]);
    }
    return this.createArgumentItemValue(param, substitutionContext, createPlaceholder);
  }

  createArgumentItemValue(param: Fmt.Parameter, substitutionContext?: HLMSubstitutionContext, createPlaceholder: CreatePlaceholderFn = createStandardPlaceholder): Fmt.Expression | undefined {
    const paramType = param.type;
    if (paramType instanceof FmtHLM.MetaRefExpression_Prop) {
      return createPlaceholder(HLMExpressionType.Formula);
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Set || paramType instanceof FmtHLM.MetaRefExpression_Subset) {
      return createPlaceholder(HLMExpressionType.SetTerm);
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Element) {
      return createPlaceholder(HLMExpressionType.ElementTerm);
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Binder) {
      const substitutedSourceParameters = this.applySubstitutionContextToParameterList(paramType.sourceParameters, substitutionContext);
      const substitutedTargetParameters = this.applySubstitutionContextToParameterList(paramType.targetParameters, substitutionContext);
      const sourceParameters = substitutedSourceParameters.clone();
      const targetArguments = this.getPlaceholderArguments(substitutedTargetParameters, substitutionContext, createPlaceholder);
      const binderArg = new FmtHLM.ObjectContents_BinderArg(sourceParameters, targetArguments);
      return binderArg.toExpression(false);
    } else if (paramType instanceof FmtHLM.MetaRefExpression_Nat) {
      return new Fmt.PlaceholderExpression(undefined);
    } else {
      return undefined;
    }
  }

  createElementParameter(defaultName: string, usedNames: Set<string>): Fmt.Parameter {
    const elementType = new FmtHLM.MetaRefExpression_Element(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
    return this.createParameter(elementType, defaultName, usedNames);
  }

  createConstraintParameter(constraint: Fmt.Expression, name: string): Fmt.Parameter {
    const constraintType = new FmtHLM.MetaRefExpression_Constraint(constraint);
    return this.createParameter(constraintType, name);
  }

  adaptParameterNames(parameterList: Fmt.ParameterList, usedNames: Set<string>, scope?: Fmt.Traversable): void {
    for (const param of parameterList) {
      FmtUtils.renameParameter(param, this.getUnusedDefaultName(param.name, usedNames), parameterList, scope);
      const type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        this.adaptParameterNames(type.sourceParameters, usedNames, scope);
        this.adaptParameterNames(type.targetParameters, usedNames, scope);
      }
    }
  }

  canAutoFillParameter(param: Fmt.Parameter, dependentParams: Fmt.Parameter[]): boolean {
    for (const dependentParam of dependentParams) {
      const type = dependentParam.type;
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
    for (const param of params) {
      const type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Binder) {
        this.markUnreferencedParametersAsAuto(type.targetParameters, referencedParams);
      } else if (type instanceof FmtHLM.MetaRefExpression_Prop || type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset || type instanceof FmtHLM.MetaRefExpression_Element) {
        if (referencedParams.indexOf(param) < 0) {
          type.auto = new FmtHLM.MetaRefExpression_true;
        }
      }
    }
  }

  getSetTermEquivalenceListInfo(items: Fmt.Expression[]): HLMEquivalenceListInfo {
    return {
      items: items,
      getEquivalenceGoal: (from: Fmt.Expression, to: Fmt.Expression) => new FmtHLM.MetaRefExpression_sub(from, to),
      wrapAround: true
    };
  }

  getElementTermEquivalenceListInfo(items: Fmt.Expression[]): HLMEquivalenceListInfo {
    return {
      items: items,
      getEquivalenceGoal: (from: Fmt.Expression, to: Fmt.Expression) => new FmtHLM.MetaRefExpression_equals(from, to),
      wrapAround: false
    };
  }

  getFormulaEquivalenceListInfo(items: Fmt.Expression[]): HLMEquivalenceListInfo {
    return {
      items: items,
      getEquivalenceGoal: (from: Fmt.Expression, to: Fmt.Expression, proofParameters: Fmt.ParameterList) => {
        this.addProofConstraint(proofParameters, from);
        return to;
      },
      wrapAround: true
    };
  }

  getEquivalenceListInfo(formula: Fmt.Expression | undefined): HLMEquivalenceListInfo | undefined {
    if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      return this.getSetTermEquivalenceListInfo(formula.terms);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
      return this.getElementTermEquivalenceListInfo(formula.terms);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      return this.getFormulaEquivalenceListInfo(formula.formulas);
    } else {
      return undefined;
    }
  }

  getImplicitOperatorDefinitionResults(definitionRef: Fmt.DefinitionRefExpression, definition: Fmt.Definition, contents: FmtHLM.ObjectContents_ImplicitOperator): Fmt.Expression[] {
    return contents.definition.map((item: Fmt.Expression) => {
      const substitutedItem = this.substitutePath(item, definitionRef.path, [definition]);
      return FmtUtils.substituteVariable(substitutedItem, contents.parameter, definitionRef);
    });
  }
}
