import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as FmtHLM from './meta';
import * as FmtNotation from '../../notation/meta';
import { GenericRenderUtils } from '../generic/renderUtils';
import { HLMUtils, HLMSubstitutionContext } from './utils';
import CachedPromise from '../../data/cachedPromise';

export interface ExtractedStructuralCase {
  affectedParameters?: Fmt.Parameter[];
  constructions?: Fmt.DefinitionRefExpression[];
  structuralCases?: FmtHLM.ObjectContents_StructuralCase[];
  caseParameters?: Fmt.Parameter[];
  definitions: Fmt.Expression[];
}

export type ElementParameterOverrides = Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>;

export class HLMRenderUtils extends GenericRenderUtils {
  constructor(definition: Fmt.Definition, protected utils: HLMUtils, templates: Fmt.File) {
    super(definition, utils, templates);
  }

  protected getNotation(definition: Fmt.Definition): Fmt.Expression | undefined {
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
      return definition.contents.notation;
    } else {
      return undefined;
    }
  }

  protected getConstraint(param: Fmt.Parameter): [Fmt.Expression | undefined, number] {
    let constraint = undefined;
    let negationCount = 0;
    if (param.type instanceof FmtHLM.MetaRefExpression_Constraint) {
      constraint = param.type.formula;
      while (constraint instanceof FmtHLM.MetaRefExpression_not) {
        negationCount++;
        constraint = constraint.formula;
      }
    }
    return [constraint, negationCount];
  }

  extractConstraints(parameters: Fmt.Parameter[], extractedConstraints: Fmt.Parameter[]): Fmt.Parameter[] {
    let result: Fmt.Parameter[] = [];
    for (let param of parameters) {
      if (param.type instanceof FmtHLM.MetaRefExpression_Constraint) {
        extractedConstraints.push(param);
      } else {
        result.push(param);
      }
    }
    return result;
  }

  extractStructuralCases(definitions: Fmt.Expression[]): ExtractedStructuralCase[] {
    return this.doExtractStructuralCases(this.definition.parameters, definitions, true);
  }

  private doExtractStructuralCases(parameters: Fmt.Parameter[], expressions: Fmt.Expression[], allowMultipleCases: boolean): ExtractedStructuralCase[] {
    let cases: ExtractedStructuralCase[] = [{definitions: expressions}];
    if (expressions.length) {
      let changed: boolean;
      do {
        changed = false;
        for (let currentCase of cases) {
          let currentCaseDefinition = currentCase.definitions[0];
          while (currentCaseDefinition instanceof FmtHLM.MetaRefExpression_asElementOf || currentCaseDefinition instanceof FmtHLM.MetaRefExpression_setAssociative || currentCaseDefinition instanceof FmtHLM.MetaRefExpression_associative) {
            currentCaseDefinition = currentCaseDefinition.term;
          }
          if ((currentCaseDefinition instanceof FmtHLM.MetaRefExpression_setStructuralCases || currentCaseDefinition instanceof FmtHLM.MetaRefExpression_structuralCases || currentCaseDefinition instanceof FmtHLM.MetaRefExpression_structural)
              && currentCaseDefinition.construction instanceof Fmt.DefinitionRefExpression
              && currentCaseDefinition.cases.length
              && (currentCaseDefinition.cases.length === 1 || (expressions.length === 1 && allowMultipleCases))
              && currentCaseDefinition.term instanceof Fmt.VariableRefExpression) {
            let currentParameter = currentCaseDefinition.term.variable;
            let currentParameterStructuralCase = this.findExtractableInductionParameterOrigin(currentParameter, parameters, currentCase.structuralCases);
            if (currentParameterStructuralCase !== undefined && this.mayExtractStructuralCases(currentParameter, currentCaseDefinition.cases)) {
              let affectedParameters = currentCase.affectedParameters ? [currentParameter, ...currentCase.affectedParameters] : [currentParameter];
              let constructions = currentCase.constructions ? [currentCaseDefinition.construction, ...currentCase.constructions] : [currentCaseDefinition.construction];
              let previousStructuralCases = currentCase.structuralCases || [];
              let previousCaseParameters = currentCase.caseParameters || [];
              let otherDefinitions = currentCase.definitions.slice(1);
              for (let structuralCase of currentCaseDefinition.cases) {
                let caseStructuralCases = [structuralCase, ...previousStructuralCases];
                let caseParameters = previousCaseParameters.slice();
                if (structuralCase.parameters && !currentParameterStructuralCase) {
                  caseParameters.unshift(...structuralCase.parameters);
                }
                let caseDefinitions = [structuralCase.value, ...otherDefinitions];
                let extractedCase: ExtractedStructuralCase = {
                  affectedParameters: affectedParameters,
                  constructions: constructions,
                  structuralCases: caseStructuralCases,
                  caseParameters: caseParameters,
                  definitions: caseDefinitions
                };
                if (changed) {
                  cases.push(extractedCase);
                } else {
                  Object.assign(currentCase, extractedCase);
                  changed = true;
                }
              }
              break;
            }
          }
        }
      } while (changed);
    }
    return cases;
  }

  private findExtractableInductionParameterOrigin(param: Fmt.Parameter, parameters: Fmt.Parameter[], parentCases: FmtHLM.ObjectContents_StructuralCase[] | undefined): FmtHLM.ObjectContents_StructuralCase | null | undefined {
    if (!(param.type instanceof FmtHLM.MetaRefExpression_Element) || param.type.auto) {
      return undefined;
    }
    if (parameters.indexOf(param) >= 0) {
      return null;
    }
    if (parentCases) {
      for (let parentCase of parentCases) {
        if (parentCase.parameters) {
          if (parentCase.parameters.indexOf(param) >= 0) {
            return parentCase;
          }
        }
      }
    }
    return undefined;
  }

  private mayExtractStructuralCases(param: Fmt.Parameter, cases: FmtHLM.ObjectContents_StructuralCase[]): boolean {
    for (let structuralCase of cases) {
      if (this.utils.referencesParameter(structuralCase.value, param)) {
        return false;
      }
    }
    return true;
  }

  convertStructuralCaseToOverride(parameters: Fmt.Parameter[], expression: Fmt.Expression, elementParameterOverrides: ElementParameterOverrides): Fmt.Expression {
    let cases = this.doExtractStructuralCases(parameters, [expression], false);
    if (cases.length === 1) {
      let extractedCase = cases[0];
      if (this.fillVariableOverridesFromExtractedCase(extractedCase, elementParameterOverrides, true)) {
        return extractedCase.definitions[0];
      }
    }
    return expression;
  }

  fillVariableOverridesFromExtractedCase(extractedCase: ExtractedStructuralCase, elementParameterOverrides: ElementParameterOverrides, isDefinition: boolean = false): boolean {
    if (extractedCase.structuralCases) {
      for (let index = 0; index < extractedCase.structuralCases.length; index++) {
        let structuralCase = extractedCase.structuralCases[index];
        let caseTermPromise = this.utils.getStructuralCaseTerm(extractedCase.constructions![index].path, structuralCase);
        if (isDefinition && extractedCase.caseParameters) {
          caseTermPromise = caseTermPromise.then((caseTerm: Fmt.Expression) => {
            let substitutionContext = new HLMSubstitutionContext;
            this.markParametersAsDefinition(extractedCase.caseParameters!, substitutionContext);
            return this.utils.applySubstitutionContext(caseTerm, substitutionContext);
          });
        }
        caseTermPromise = this.applyElementParameterOverrides(caseTermPromise, elementParameterOverrides);
        elementParameterOverrides.set(extractedCase.affectedParameters![index], caseTermPromise);
      }
      return true;
    }
    return false;
  }

  applyElementParameterOverrides(expressionPromise: CachedPromise<Fmt.Expression>, elementParameterOverrides: ElementParameterOverrides): CachedPromise<Fmt.Expression> {
    for (let [param, paramOverridePromise] of elementParameterOverrides) {
      expressionPromise = expressionPromise.then((expression) => {
        return paramOverridePromise.then((paramOverride) => FmtUtils.substituteVariable(expression, param, paramOverride));
      });
    }
    return expressionPromise;
  }

  private markParametersAsDefinition(parameters: Fmt.Parameter[], substitutionContext: HLMSubstitutionContext): void {
    substitutionContext.substitutionFns.push((subExpression: Fmt.Expression) => {
      if (subExpression instanceof Fmt.VariableRefExpression && this.utils.parameterListContainsParameter(parameters, subExpression.variable)) {
        let result = subExpression.clone();
        (result as any).isDefinition = true;
        return result;
      } else {
        return subExpression;
      }
    });
  }

  convertBoundStructuralCasesToOverrides(parameters: Fmt.Parameter[], binderArgumentList: Fmt.ArgumentList, elementParameterOverrides: ElementParameterOverrides): Fmt.ArgumentList {
    let newBinderArgumentList: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
    let changed = false;
    for (let binderArg of binderArgumentList) {
      let binderArgValue = binderArg.value;
      if (binderArgValue instanceof Fmt.CompoundExpression && binderArgValue.arguments.length > 1 && binderArgValue.arguments[0].value instanceof Fmt.ParameterExpression) {
          // Looks like a nested binder argument; recurse into it.
        let expression = binderArgValue.arguments[0].value;
        let nestedArgumentsExpression = binderArgValue.arguments[1].value;
        if (nestedArgumentsExpression instanceof Fmt.CompoundExpression) {
          let allParameters: Fmt.Parameter[] = [];
          allParameters.push(...parameters);
          allParameters.push(...expression.parameters);
          let newNestedArguments = this.convertBoundStructuralCasesToOverrides(allParameters, nestedArgumentsExpression.arguments, elementParameterOverrides);
          if (newNestedArguments !== nestedArgumentsExpression.arguments) {
            binderArg = binderArg.clone();
            let newBinderArgValue = binderArg.value as Fmt.CompoundExpression;
            newBinderArgValue.arguments[0].value = expression;
            (newBinderArgValue.arguments[1].value as Fmt.CompoundExpression).arguments = newNestedArguments;
            changed = true;
          }
        }
      } else {
        // We expect this to be a regular argument.
        if (binderArgValue instanceof Fmt.CompoundExpression && binderArgValue.arguments.length) {
          binderArgValue = binderArgValue.arguments[0].value;
        }
        let newBinderArgValue = this.convertStructuralCaseToOverride(parameters, binderArgValue, elementParameterOverrides);
        if (newBinderArgValue !== binderArgValue) {
          binderArg = binderArg.clone();
          binderArg.value = newBinderArgValue;
          changed = true;
        }
      }
      newBinderArgumentList.push(binderArg);
    }
    if (changed) {
      return newBinderArgumentList;
    }
    return binderArgumentList;
  }

  getDefinitionNotation(definition: Fmt.Definition): FmtNotation.ObjectContents_DefinitionNotation | undefined {
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition && definition.contents.definitionNotation) {
      let result = new FmtNotation.ObjectContents_DefinitionNotation;
      result.fromExpression(definition.contents.definitionNotation);
      return result;
    } else {
      return undefined;
    }
  }
}
