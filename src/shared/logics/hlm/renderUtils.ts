import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtNotation from '../../notation/meta';
import { GenericRenderUtils } from '../generic/renderUtils';
import { HLMUtils } from './utils';
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
    if (param.type.expression instanceof FmtHLM.MetaRefExpression_Constraint) {
      constraint = param.type.expression.formula;
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
      if (param.type.expression instanceof FmtHLM.MetaRefExpression_Constraint) {
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
              && currentCaseDefinition.term instanceof Fmt.VariableRefExpression
              && !currentCaseDefinition.term.indices) {
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
    let type = param.type.expression;
    if (!(type instanceof FmtHLM.MetaRefExpression_Element) || type.auto) {
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
        let caseTermPromise = this.utils.getStructuralCaseTerm(extractedCase.constructions![index].path, structuralCase, isDefinition);
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
        return paramOverridePromise.then((paramOverride) => this.utils.substituteVariable(expression, param, () => paramOverride));
      });
    }
    return expressionPromise;
  }

  convertBoundStructuralCasesToOverrides(parameters: Fmt.Parameter[], bindingArgumentList: Fmt.ArgumentList, elementParameterOverrides: ElementParameterOverrides): Fmt.ArgumentList {
    let newBindingArgumentList: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
    let changed = false;
    for (let bindingArg of bindingArgumentList) {
      if (bindingArg.value instanceof Fmt.CompoundExpression && bindingArg.value.arguments.length) {
        let expression = bindingArg.value.arguments[0].value;
        if (expression instanceof Fmt.ParameterExpression) {
          // Looks like a nested binding argument; recurse into it.
          if (bindingArg.value.arguments.length > 1) {
            let nestedArgumentsExpression = bindingArg.value.arguments[1].value;
            if (nestedArgumentsExpression instanceof Fmt.CompoundExpression) {
              let allParameters: Fmt.Parameter[] = [];
              allParameters.push(...parameters);
              allParameters.push(...expression.parameters);
              let newNestedArguments = this.convertBoundStructuralCasesToOverrides(allParameters, nestedArgumentsExpression.arguments, elementParameterOverrides);
              if (newNestedArguments !== nestedArgumentsExpression.arguments) {
                bindingArg = bindingArg.clone();
                (bindingArg.value as Fmt.CompoundExpression).arguments[0].value = expression;
                ((bindingArg.value as Fmt.CompoundExpression).arguments[1].value as Fmt.CompoundExpression).arguments = newNestedArguments;
                changed = true;
              }
            }
          }
        } else {
          // We expect this to be a regular argument.
          let newExpression = this.convertStructuralCaseToOverride(parameters, expression, elementParameterOverrides);
          if (newExpression !== expression) {
            bindingArg = bindingArg.clone();
            (bindingArg.value as Fmt.CompoundExpression).arguments[0].value = newExpression;
            changed = true;
          }
        }
      }
      newBindingArgumentList.push(bindingArg);
    }
    if (changed) {
      return newBindingArgumentList;
    }
    return bindingArgumentList;
  }

  getDefinitionNotation(definition: Fmt.Definition): FmtNotation.ObjectContents_DefinitionNotation | undefined {
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition && definition.contents.definitionNotation instanceof Fmt.CompoundExpression) {
      let result = new FmtNotation.ObjectContents_DefinitionNotation;
      result.fromCompoundExpression(definition.contents.definitionNotation);
      return result;
    }
    return undefined;
  }
}
