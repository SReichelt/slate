import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtNotation from '../../notation/meta';
import { HLMUtils } from './utils';
import CachedPromise from '../../data/cachedPromise';

export interface PropertyInfo {
  property?: string;
  singular?: string;
  plural?: string;
  article?: string;
  isFeature: boolean;
  definitionRef?: Fmt.DefinitionRefExpression;
  extracted: boolean;
}

export interface ExtractedStructuralCase {
  affectedParameters?: Fmt.Parameter[];
  constructions?: Fmt.DefinitionRefExpression[];
  structuralCases?: FmtHLM.ObjectContents_StructuralCase[];
  caseParameters?: Fmt.Parameter[];
  definitions: Fmt.Expression[];
}

export type ElementParameterOverrides = Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>;

export class HLMRenderUtils {
  constructor(private definition: Fmt.Definition, private utils: HLMUtils, private templates: Fmt.File) {}

  extractProperties(parameters: Fmt.Parameter[], noun: PropertyInfo, remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined): PropertyInfo[] | undefined {
    let result: PropertyInfo[] | undefined = undefined;
    if (remainingParameters && remainingDefinitions) {
      let nounAllowed = noun.singular !== undefined;
      while (remainingParameters.length >= parameters.length && remainingDefinitions.length >= parameters.length) {
        let definition = remainingDefinitions[0];
        if (!definition) {
          break;
        }
        for (let index = 1; index < parameters.length; index++) {
          if (remainingDefinitions[index] !== definition) {
            definition = undefined;
            break;
          }
        }
        if (!definition) {
          break;
        }
        let property: PropertyInfo | undefined = undefined;
        for (let index = 0; index < parameters.length; index++) {
          let currentProperty = this.getProperty(parameters[index], remainingParameters[index], remainingDefinitions[index]);
          if (!currentProperty) {
            property = undefined;
            break;
          }
          if (property) {
            if (currentProperty.property !== property.property
                || currentProperty.singular !== property.singular
                || currentProperty.plural !== property.plural
                || currentProperty.isFeature !== property.isFeature) {
              property = undefined;
              break;
            }
          } else {
            property = currentProperty;
          }
        }
        if (!property) {
          break;
        }
        if (property.singular || property.plural) {
          if (property.article === undefined) {
            property.article = 'a';
          }
          if (!property.isFeature) {
            if (!nounAllowed) {
              break;
            }
            Object.assign(noun, property);
          }
        }
        if (property.property || property.isFeature) {
          if (!(noun.singular && noun.plural)) {
            break;
          }
          if (!result) {
            result = [];
          }
          result.push(property);
        }
        remainingParameters.splice(0, parameters.length);
        remainingDefinitions.splice(0, parameters.length);
        nounAllowed = false;
      }
    }
    return result;
  }

  private getProperty(param: Fmt.Parameter, constraintParam: Fmt.Parameter, definition: Fmt.Definition | undefined): PropertyInfo | undefined {
    if (constraintParam.type.expression instanceof FmtHLM.MetaRefExpression_Constraint) {
      let negationCount = 0;
      let constraint = constraintParam.type.expression.formula;
      while (constraint instanceof FmtHLM.MetaRefExpression_not) {
        negationCount++;
        constraint = constraint.formula;
      }
      if (constraint instanceof Fmt.DefinitionRefExpression
          && definition
          && definition.contents instanceof FmtHLM.ObjectContents_Definition
          && definition.contents.notation) {
        let notation = definition.contents.notation;
        if (notation instanceof Fmt.DefinitionRefExpression && !notation.path.parentPath) {
          let template = this.templates.definitions.getDefinition(notation.path.name);
          if (template.contents instanceof FmtNotation.ObjectContents_Template) {
            let elements = template.contents.elements;
            if (elements && elements.operand instanceof Fmt.VariableRefExpression) {
              let operand = notation.path.arguments.getValue(elements.operand.variable.name);
              if (operand instanceof Fmt.VariableRefExpression) {
                let operandArg = constraint.path.arguments.getValue(operand.variable.name);
                if (operandArg instanceof Fmt.CompoundExpression && operandArg.arguments.length) {
                  let operandArgValue = operandArg.arguments[0].value;
                  if (operandArgValue instanceof Fmt.VariableRefExpression && operandArgValue.variable === param) {
                    return {
                      property: this.getNotationArgument(notation, elements.property, negationCount),
                      singular: this.getNotationArgument(notation, elements.singular, negationCount),
                      plural: this.getNotationArgument(notation, elements.plural, negationCount),
                      article: this.getNotationArgument(notation, elements.article, negationCount),
                      isFeature: elements.isFeature instanceof FmtNotation.MetaRefExpression_true,
                      definitionRef: constraint,
                      extracted: true
                    };
                  }
                }
              }
            }
          }
        }
      }
    }
    return undefined;
  }

  private getNotationArgument(notation: Fmt.DefinitionRefExpression, element: Fmt.Expression | undefined, negationCount: number): string | undefined {
    if (element instanceof Fmt.VariableRefExpression) {
      let value = notation.path.arguments.getOptionalValue(element.variable.name);
      if (value instanceof FmtNotation.MetaRefExpression_neg) {
        if (negationCount < value.items.length) {
          value = value.items[negationCount];
          negationCount = 0;
        }
      }
      if (value instanceof Fmt.StringExpression && !negationCount) {
        return value.value;
      }
    }
    return undefined;
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
            let currentParameterIndex = parameters.indexOf(currentParameter);
            let currentParameterStructuralCase: FmtHLM.ObjectContents_StructuralCase | undefined = undefined;
            if (currentParameterIndex < 0 && currentCase.structuralCases) {
              for (let structuralCase of currentCase.structuralCases) {
                if (structuralCase.parameters) {
                  currentParameterIndex = structuralCase.parameters.indexOf(currentParameter);
                  if (currentParameterIndex >= 0) {
                    currentParameterStructuralCase = structuralCase;
                    break;
                  }
                }
              }
            }
            let currentParameterType = currentParameter.type.expression;
            if (currentParameterIndex >= 0 && currentParameterType instanceof FmtHLM.MetaRefExpression_Element && !currentParameterType.auto) {
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

  convertStructuralCaseToOverride(parameters: Fmt.Parameter[], expression: Fmt.Expression, elementParameterOverrides: ElementParameterOverrides): Fmt.Expression {
    let allowedParameters = parameters.filter((parameter) => parameter.name.startsWith('_'));
    let cases = this.doExtractStructuralCases(allowedParameters, [expression], false);
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
    let allowedParameters = parameters.filter((param) => param.name.startsWith('_'));
    if (allowedParameters.length) {
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
                allParameters.push(...allowedParameters);
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
            let newExpression = this.convertStructuralCaseToOverride(allowedParameters, expression, elementParameterOverrides);
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
    }
    return bindingArgumentList;
  }
}
