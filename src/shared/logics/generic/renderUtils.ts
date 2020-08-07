import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as FmtNotation from '../../notation/meta';
import * as Notation from '../../notation/notation';
import { GenericUtils } from './utils';
import CachedPromise from '../../data/cachedPromise';
import { RenderedTemplateArguments } from './renderer';

export interface PropertyInfo {
  property?: string;
  singular?: string;
  plural?: string;
  article?: string;
  isFeature: boolean;
  definitionRef?: Fmt.DefinitionRefExpression;
  extracted: boolean;
}

export class AbbreviationParamExpression extends Notation.RenderedExpression {
  constructor(public abbreviationParam: Fmt.Parameter) {
    super();
  }
}

export abstract class GenericRenderUtils {
  constructor(protected definition: Fmt.Definition, protected utils: GenericUtils, protected templates: Fmt.File) {}

  protected abstract getNotation(definition: Fmt.Definition): Fmt.Expression | undefined;
  protected abstract getConstraint(param: Fmt.Parameter): [Fmt.Expression | undefined, number];

  getNotationAlternatives(definition: Fmt.Definition): (Fmt.Expression | undefined)[] {
    let notation = this.getNotation(definition);
    return this.getSelections(notation);
  }

  private getSelections(notation: Fmt.Expression | undefined, args?: Map<Fmt.Parameter, Fmt.Expression>): (Fmt.Expression | undefined)[] {
    if (notation instanceof FmtNotation.MetaRefExpression_sel) {
      let result: (Fmt.Expression | undefined)[] = [];
      for (let selection of notation.items) {
        let resultItems: Fmt.Expression[] = [];
        selection.traverse((subExpression: Fmt.Expression) => {
          if (args) {
            if (subExpression instanceof FmtNotation.MetaRefExpression_rev && subExpression.list instanceof Fmt.VariableRefExpression) {
              let arg = args.get(subExpression.list.variable);
              if (arg instanceof Fmt.ArrayExpression) {
                resultItems.push(...arg.items);
              }
            }
          } else {
            if (subExpression instanceof Fmt.VariableRefExpression) {
              resultItems.push(subExpression);
            }
          }
        });
        if (resultItems.length) {
          let arrayExpression = new Fmt.ArrayExpression;
          arrayExpression.items = resultItems.reverse();
          result.push(arrayExpression);
        } else {
          result.push(undefined);
        }
      }
      return result;
    } else if (notation instanceof Fmt.DefinitionRefExpression && !notation.path.parentPath) {
      let template = this.templates.definitions.getDefinition(notation.path.name);
      if (template.contents instanceof FmtNotation.ObjectContents_Template) {
        let templateArgs = new Map<Fmt.Parameter, Fmt.Expression>();
        for (let templateParam of template.parameters) {
          let templateArg = notation.path.arguments.getOptionalValue(templateParam.name);
          if (templateArg) {
            if (args) {
              for (let [param, arg] of args) {
                templateArg = FmtUtils.substituteVariable(templateArg, param, arg);
              }
            }
            templateArgs.set(templateParam, templateArg);
          };
        }
        return this.getSelections(template.contents.notation, templateArgs);
      }
    }
    return [undefined];
  }

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
          let currentProperty = this.getConstraintParamProperty(parameters[index], remainingParameters[index], remainingDefinitions[index]);
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
        let handled = false;
        if (property.singular || property.plural) {
          if (property.article === undefined) {
            property.article = 'a';
          }
          if (!property.isFeature) {
            if (!nounAllowed) {
              break;
            }
            Object.assign(noun, property);
            handled = true;
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
          handled = true;
        }
        if (!handled) {
          break;
        }
        remainingParameters.splice(0, parameters.length);
        remainingDefinitions.splice(0, parameters.length);
        nounAllowed = false;
      }
    }
    return result;
  }

  private getConstraintParamProperty(param: Fmt.Parameter, constraintParam: Fmt.Parameter, definition: Fmt.Definition | undefined): PropertyInfo | undefined {
    if (definition) {
      let [constraint, negationCount] = this.getConstraint(constraintParam);
      if (constraint instanceof Fmt.DefinitionRefExpression) {
        return this.getConstraintProperty(param, constraint, negationCount, definition);
      }
    }
    return undefined;
  }

  getConstraintProperty(param: Fmt.Parameter, constraint: Fmt.DefinitionRefExpression, negationCount: number, definition: Fmt.Definition): PropertyInfo | undefined {
    let notation = this.getNotation(definition);
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

  matchParameterizedNotation(expression: Notation.ExpressionValue, notation: Notation.ExpressionValue, abbreviationArgs: RenderedTemplateArguments): CachedPromise<boolean> {
    if (expression === notation) {
      return CachedPromise.resolve(true);
    }
    if (notation instanceof Array) {
      if (expression instanceof Array && expression.length === notation.length) {
        let result = CachedPromise.resolve(true);
        for (let index = 0; index < expression.length; index++) {
          let expressionItem = expression[index];
          let notationItem = notation[index];
          result = result.and(() => this.matchParameterizedNotation(expressionItem, notationItem, abbreviationArgs));
        }
        return result;
      }
    } else if (notation instanceof AbbreviationParamExpression) {
      let paramName = notation.abbreviationParam.name;
      if (abbreviationArgs[paramName] === notation) {
        abbreviationArgs[paramName] = expression;
        return CachedPromise.resolve(true);
      } else {
        return this.matchParameterizedNotation(expression, abbreviationArgs[paramName], abbreviationArgs);
      }
    } else if (notation instanceof Notation.TemplateInstanceExpression) {
      if (expression instanceof Notation.TemplateInstanceExpression && expression.template === notation.template) {
        let result = CachedPromise.resolve(true);
        for (let param of expression.template.parameters) {
          let expressionArg = expression.config.getArgFn(param.name);
          let notationArg = notation.config.getArgFn(param.name);
          if (notationArg !== undefined) {
            if (expressionArg === undefined) {
              return CachedPromise.resolve(false);
            }
            result = result.and(() => this.matchParameterizedNotation(expressionArg, notationArg, abbreviationArgs));
          }
        }
        return result;
      } else if (expression instanceof Notation.IndirectExpression) {
        return this.matchParameterizedNotation(expression.resolve(), notation, abbreviationArgs);
      } else if (expression instanceof Notation.PromiseExpression) {
        return expression.promise.then((innerExpression: Notation.RenderedExpression) =>
          this.matchParameterizedNotation(innerExpression, notation, abbreviationArgs));
      }
    } else if (notation instanceof Notation.UserDefinedExpression) {
      return this.matchParameterizedNotation(expression, notation.resolve(), abbreviationArgs);
    } else if (notation instanceof Notation.PromiseExpression) {
      return notation.promise.then((innerNotation: Notation.RenderedExpression) =>
        this.matchParameterizedNotation(expression, innerNotation, abbreviationArgs));
    } else if (notation instanceof Notation.RenderedExpression && notation.semanticLinks) {
      if (expression instanceof Notation.RenderedExpression && expression.semanticLinks) {
        for (let semanticLink of notation.semanticLinks) {
          if (semanticLink.linkedObject instanceof Fmt.Parameter) {
            for (let expressionSemanticLink of expression.semanticLinks) {
              if (expressionSemanticLink.linkedObject === semanticLink.linkedObject) {
                return CachedPromise.resolve(true);
              }
            }
          }
        }
      }
    }
    return CachedPromise.resolve(false);
  }
}
