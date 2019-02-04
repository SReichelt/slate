import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtDisplay from '../../display/meta';
import * as Logic from '../logic';
import { GenericRenderer, RenderedVariable } from '../generic/renderer';
import * as Display from '../../display/display';
import { HLMEditHandler } from './editHandler';
import { HLMUtils } from './utils';
import { LibraryDataAccessor, LibraryItemInfo } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

interface ParameterListState {
  fullSentence: boolean;
  sentence: boolean;
  abbreviate: boolean;
  forcePlural: boolean;
  enableSpecializations: boolean;
  started: boolean;
  inLetExpr: boolean;
  inConstraint: boolean;
  inDefinition: boolean;
  inDefinitionDisplayGroup: boolean;
}

interface ReplacementParameters {
  parameters?: Fmt.ParameterList;
  indices?: Display.RenderedExpression[];
  isDefinition: boolean;
}

interface PropertyInfo {
  property?: string;
  singular?: string;
  plural?: string;
  article?: string;
  isFeature: boolean;
  definitionRef?: Fmt.DefinitionRefExpression;
  extracted: boolean;
}

export class HLMRenderer extends GenericRenderer implements Logic.LogicRenderer {
  utils: HLMUtils;

  constructor(definition: Fmt.Definition, includeProofs: boolean, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File, editHandler?: HLMEditHandler) {
    super(definition, includeProofs, libraryDataAccessor, templates, editHandler);
    this.utils = new HLMUtils(definition, libraryDataAccessor);
  }

  renderDefinition(itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined {
    let row: Display.RenderedExpression[] = [];
    if (includeLabel && itemInfo !== undefined) {
      row.push(this.renderDefinitionLabel(itemInfo));
    }
    let definition = this.definition;
    if (!(definition.contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      let hasParameters = false;
      if (definition.parameters.length) {
        hasParameters = true;
        if (row.length) {
          row.push(new Display.TextExpression('  '));
        }
        row.push(this.renderParameterList(definition.parameters, true, false, false));
        row.push(new Display.TextExpression(' '));
      }
      if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
        if (hasParameters) {
          row.push(new Display.TextExpression('Then:'));
        }
      } else {
        if (row.length && !hasParameters) {
          row.push(new Display.TextExpression('  '));
        }
        if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          row.push(new Display.TextExpression(hasParameters ? 'Then the following are equivalent:' : 'The following are equivalent:'));
        } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          row.push(new Display.TextExpression('For '));
          row.push(this.renderParameter(definition.contents.parameter, false));
          row.push(new Display.TextExpression(', we define:'));
        } else {
          row.push(new Display.TextExpression('We define:'));
        }
      }
    }
    let paragraphs: Display.RenderedExpression[] = [];
    if (row.length) {
      paragraphs.push(row.length === 1 ? row[0] : new Display.RowExpression(row));
    }
    this.addDefinitionContents(paragraphs, includeExtras);
    if (includeRemarks) {
      this.addDefinitionRemarks(paragraphs);
    }
    if (paragraphs.length) {
      return new Display.ParagraphExpression(paragraphs);
    } else {
      return undefined;
    }
  }

  renderDefinitionSummary(multiLine: boolean = false): Display.RenderedExpression | undefined {
    let definition = this.definition;
    if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem || definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      let claim: Display.RenderedExpression | undefined = undefined;
      if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
        claim = this.renderFormula(definition.contents.claim);
      } else if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
        let conditions = definition.contents.conditions as Fmt.ArrayExpression;
        let items = conditions.items.map((formula) => this.renderFormula(formula));
        claim = this.renderTemplate('MultiEquivalenceRelation', {
                                      'operands': items
                                    });
      }
      if (claim) {
        if (definition.parameters.length) {
          let extractedConstraints: Fmt.Parameter[] = [];
          let reducedParameters = this.extractConstraints(definition.parameters, extractedConstraints);
          let parameters = this.renderParameterList(reducedParameters, false, false, false);
          let addendum = new Display.RowExpression([new Display.TextExpression('if '), parameters]);
          addendum.styleClasses = ['addendum'];
          if (extractedConstraints.length) {
            let items = extractedConstraints.map((param: Fmt.Parameter) => this.renderParameter(param, false));
            let constraints = this.renderTemplate('Group', {
              'items': items,
              'separator': new Display.TextExpression(', ')
            });
            claim.optionalParenStyle = '[]';
            claim = this.renderTemplate('ImplicationRelation', {
                                          'left': constraints,
                                          'right': claim
                                        });
          }
          if (multiLine) {
            return new Display.ParagraphExpression([claim, addendum]);
          } else {
            return new Display.RowExpression([claim, new Display.TextExpression('  '), addendum]);
          }
        } else {
          return claim;
        }
      }
    } else if (!(definition.contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      return this.renderDefinitionRef([definition], undefined, true);
    }
    return undefined;
  }

  renderDefinitionLabel(itemInfo: CachedPromise<LibraryItemInfo>): Display.RenderedExpression {
    let formattedInfoPromise = itemInfo.then((info: LibraryItemInfo) => {
      let text: string;
      if (info.type) {
        text = info.type.charAt(0).toUpperCase() + info.type.slice(1);
      } else {
        text = this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem || this.definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem ? 'Proposition' : 'Definition';
      }
      text += ' ';
      text += this.formatItemNumber(info.itemNumber);
      if (info.title) {
        let title = new Display.TextExpression(' (' + info.title + ')');
        title.styleClasses = ['title'];
        return new Display.RowExpression([new Display.TextExpression(text), title, new Display.TextExpression('.')]);
      }
      text += '.';
      return new Display.TextExpression(text);
    });
    let result = new Display.PromiseExpression(formattedInfoPromise);
    result.styleClasses = ['label'];
    return result;
  }

  renderParameterList(parameters: Fmt.Parameter[], sentence: boolean, abbreviate: boolean, forcePlural: boolean): Display.RenderedExpression {
    let initialState: ParameterListState = {
      fullSentence: sentence,
      sentence: sentence,
      abbreviate: abbreviate,
      forcePlural: forcePlural,
      enableSpecializations: true,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionDisplayGroup: false
    };
    return this.renderParameters(parameters, initialState, undefined);
  }

  renderParameter(parameter: Fmt.Parameter, forcePlural: boolean): Display.RenderedExpression {
    let initialState: ParameterListState = {
      fullSentence: false,
      sentence: false,
      abbreviate: true,
      forcePlural: forcePlural,
      enableSpecializations: true,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionDisplayGroup: false
    };
    return this.renderParameters([parameter], initialState);
  }

  renderParameters(parameters: Fmt.Parameter[], initialState: ParameterListState, indices?: Display.RenderedExpression[]): Display.RenderedExpression {
    let state = Object.assign({}, initialState);
    let resolveDefinitions: CachedPromise<(Fmt.Definition | undefined)[]> = CachedPromise.resolve([]);
    for (let param of parameters) {
      let expression: Fmt.Expression | undefined = undefined;
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        expression = type.superset;
      } else if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Binding) {
        expression = type._set;
      } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
        expression = type.formula;
        while (expression instanceof FmtHLM.MetaRefExpression_not) {
          expression = expression.formula;
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
        expression = type._set;
      } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
        expression = type.element;
      }
      resolveDefinitions = resolveDefinitions.then((constraintDefinitions: (Fmt.Definition | undefined)[]) => {
        if (expression instanceof Fmt.DefinitionRefExpression) {
          return this.utils.getOuterDefinition(expression)
            .then((definition: Fmt.Definition) => constraintDefinitions.concat(definition));
        } else {
          return constraintDefinitions.concat(undefined);
        }
      });
    }
    let render = resolveDefinitions.then((constraintDefinitions: (Fmt.Definition | undefined)[]) => this.renderParametersWithResolvedDefinitions(parameters, constraintDefinitions, state, indices));
    return new Display.PromiseExpression(render);
  }

  private renderParametersWithResolvedDefinitions(parameters: Fmt.Parameter[], constraintDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices?: Display.RenderedExpression[]): Display.RenderedExpression {
    let row: Display.RenderedExpression[] = [];
    let remainingParameters = parameters.slice();
    let remainingDefinitions = constraintDefinitions.slice();
    let currentGroup: Fmt.Parameter[] = [];
    let currentGroupDefinition: Fmt.Definition | undefined = undefined;
    while (remainingParameters.length) {
      let param = remainingParameters[0];
      if (currentGroup.length && !this.combineParameter(param, currentGroup[0])) {
        row.push(this.renderParameterGroup(currentGroup, currentGroupDefinition, remainingParameters, remainingDefinitions, state, indices));
        currentGroup.length = 0;
        currentGroupDefinition = undefined;
      } else {
        if (!currentGroup.length) {
          currentGroupDefinition = remainingDefinitions[0];
        }
        currentGroup.push(param);
        remainingParameters.splice(0, 1);
        remainingDefinitions.splice(0, 1);
      }
    }
    if (currentGroup.length) {
      row.push(this.renderParameterGroup(currentGroup, currentGroupDefinition, undefined, undefined, state, indices));
    }
    if (state.started && state.fullSentence && !indices) {
      row.push(new Display.TextExpression('.'));
      state.started = false;
      state.inLetExpr = false;
      state.inConstraint = false;
    }
    return new Display.RowExpression(row);
  }

  private combineParameter(param: Fmt.Parameter, firstParam: Fmt.Parameter): boolean {
    let paramType = param.type.expression;
    let firstParamType = firstParam.type.expression;
    return (paramType instanceof FmtHLM.MetaRefExpression_Set && firstParamType instanceof FmtHLM.MetaRefExpression_Set)
            || (paramType instanceof FmtHLM.MetaRefExpression_Subset && paramType.superset instanceof FmtHLM.MetaRefExpression_previous)
            || (paramType instanceof FmtHLM.MetaRefExpression_Element && paramType._set instanceof FmtHLM.MetaRefExpression_previous)
            || (paramType instanceof FmtHLM.MetaRefExpression_Symbol && firstParamType instanceof FmtHLM.MetaRefExpression_Symbol);
  }

  private renderParameterGroup(parameters: Fmt.Parameter[], definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined, state: ParameterListState, indices?: Display.RenderedExpression[]): Display.RenderedExpression {
    let type = parameters[0].type.expression;
    let row: Display.RenderedExpression[] = [];

    if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      state.inLetExpr = false;
      state.inConstraint = false;
      state.inDefinition = false;

      for (let param of parameters) {
        row.push(new Display.TextExpression(state.abbreviate ? ' f.e. ' : ' for each '));
        let variables: Fmt.Parameter[] = [param];
        let currentVariableGroup: Fmt.Parameter[] = [param];
        let currentVariableGroupType = type;
        let innerParameters = type.parameters;
        while (innerParameters.length === 1) {
          let innerParameter = innerParameters[0];
          let innerBindingType: Fmt.Expression = innerParameter.type.expression;
          if (innerBindingType instanceof FmtHLM.MetaRefExpression_Binding) {
            if (!(innerBindingType._set instanceof FmtHLM.MetaRefExpression_previous)) {
              row.push(this.renderTemplate('ElementParameter', {
                                             'element': this.renderVariableDefinitions(currentVariableGroup),
                                             'set': this.renderSetTerm(currentVariableGroupType._set)
                                           }));
              currentVariableGroup.length = 0;
              currentVariableGroupType = innerBindingType;
              row.push(new Display.TextExpression(' and '));
            }
            variables.push(innerParameter);
            currentVariableGroup.push(innerParameter);
            innerParameters = innerBindingType.parameters;
          } else {
            break;
          }
        }
        row.push(this.renderTemplate('ElementParameter', {
                                       'element': this.renderVariableDefinitions(currentVariableGroup),
                                       'set': this.renderSetTerm(currentVariableGroupType._set)
                                     }));

        let newIndices: Display.RenderedExpression[] = indices ? indices.slice() : [];
        for (let variable of variables) {
          newIndices.push(this.renderVariable(variable));
        }
        row.unshift(this.renderParameters(innerParameters, state, newIndices));

        state.inLetExpr = false;
        state.inConstraint = false;
        state.inDefinition = false;
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      if (state.started && state.inLetExpr && !state.inDefinition) {
        if (state.inConstraint) {
          row.push(new Display.TextExpression(' and '));
        } else {
          row.push(new Display.TextExpression(state.abbreviate ? ' s.t. ' : ' such that '));
        }
      } else {
        if (state.started) {
          row.push(new Display.TextExpression(', '));
        }
        if (state.sentence) {
          row.push(new Display.TextExpression(state.fullSentence && !state.started ? 'Assume ' : 'assume '));
        }
      }
      state.inConstraint = true;
      state.inDefinition = false;

      let formula = this.renderFormula(type.formula);
      if (state.sentence) {
        row.push(formula);
      } else {
        let formulaWithParens = new Display.InnerParenExpression(formula);
        formulaWithParens.maxLevel = -2;
        row.push(formulaWithParens);
      }
    } else {
      if (state.sentence) {
        if (state.started) {
          row.push(new Display.TextExpression(', '));
          if (!state.inLetExpr) {
            row.push(new Display.TextExpression('let '));
          }
        } else {
          row.push(new Display.TextExpression(state.fullSentence ? 'Let ' : 'let '));
        }
      } else {
        if (state.started) {
          row.push(new Display.TextExpression(', '));
        }
      }
      state.inLetExpr = true;
      state.inConstraint = false;
      state.inDefinition = false;

      let variableDefinitions = this.renderVariableDefinitions(parameters, indices);
      let variableDisplay: Display.RenderedExpression | undefined;
      let noun: PropertyInfo = {
        isFeature: false,
        extracted: false
      };
      let singular: Display.RenderedExpression[] = [];
      let plural: Display.RenderedExpression[] = [];
      let combineWithNext = false;
      if (definition && state.enableSpecializations) {
        let definitionRef = this.getDisplayDefinitionRef(type);
        if (definitionRef instanceof Fmt.DefinitionRefExpression) {
          noun.definitionRef = definitionRef;
          let definitions: Fmt.Definition[] = [];
          let argumentLists: Fmt.ArgumentList[] = [];
          this.utils.analyzeDefinitionRef(definitionRef, definition, definitions, argumentLists);
          let innerDefinition = definitions[definitions.length - 1];
          if (innerDefinition.contents instanceof FmtHLM.ObjectContents_Definition) {
            let definitionDisplay = innerDefinition.contents.definitionDisplay;
            if (definitionDisplay) {
              let args = this.getRenderedTemplateArguments(definitions, argumentLists);
              args[definitionDisplay.parameter.name] = variableDefinitions;
              if (definitionDisplay.display
                  && definitionDisplay.display instanceof Fmt.ArrayExpression
                  && definitionDisplay.display.items.length) {
                let display = this.findBestMatch(definitionDisplay.display.items, argumentLists)!;
                variableDisplay = this.renderDisplayExpression(display, args);
                this.setSemanticLink(variableDisplay, definitionRef);
              }
              if (!(state.abbreviate && definitionDisplay.nameOptional instanceof FmtDisplay.MetaRefExpression_true)) {
                if (definitionDisplay.singularName && (!state.abbreviate || definitionDisplay.singularName instanceof Fmt.StringExpression)) {
                  noun.singular = this.applyName(definitionDisplay.singularName, args, definitionRef, singular);
                  if (definitionDisplay.singularName instanceof Fmt.StringExpression && remainingParameters && remainingParameters.length && remainingDefinitions && remainingDefinitions.length) {
                    let nextDefinitionRef = this.getDisplayDefinitionRef(remainingParameters[0].type.expression);
                    let nextDefinition = remainingDefinitions[0];
                    if (nextDefinitionRef instanceof Fmt.DefinitionRefExpression && nextDefinition) {
                      let nextDefinitions: Fmt.Definition[] = [];
                      let nextArgumentLists: Fmt.ArgumentList[] = [];
                      this.utils.analyzeDefinitionRef(nextDefinitionRef, nextDefinition, nextDefinitions, nextArgumentLists);
                      let nextInnerDefinition = nextDefinitions[nextDefinitions.length - 1];
                      if (nextInnerDefinition.contents instanceof FmtHLM.ObjectContents_Definition) {
                        let nextDefinitionDisplay = nextInnerDefinition.contents.definitionDisplay;
                        if (nextDefinitionDisplay && nextDefinitionDisplay.singularName instanceof Fmt.StringExpression && definitionDisplay.singularName.value === nextDefinitionDisplay.singularName.value) {
                          combineWithNext = true;
                        }
                      }
                    }
                  }
                }
                if (definitionDisplay.pluralName && (!state.abbreviate || definitionDisplay.pluralName instanceof Fmt.StringExpression)) {
                  noun.plural = this.applyName(definitionDisplay.pluralName, args, definitionRef, plural);
                }
              }
            }
          }
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
        noun.singular = 'set';
        noun.plural = 'sets';
      } else if (type instanceof FmtHLM.MetaRefExpression_Symbol) {
        noun.singular = 'symbol';
        noun.plural = 'symbols';
      }
      let properties = this.extractProperties(parameters, noun, remainingParameters, remainingDefinitions);
      this.replaceName(noun.singular, noun.definitionRef, noun.extracted, singular);
      this.replaceName(noun.plural, noun.definitionRef, noun.extracted, plural);
      if (singular.length && plural.length) {
        if (properties && properties.length) {
          noun.article = undefined;
          for (let property of properties) {
            let space = new Display.TextExpression(' ');
            if (property.property) {
              let renderedProperty = new Display.TextExpression(property.property);
              if (property.definitionRef) {
                this.setSemanticLink(renderedProperty, property.definitionRef);
              }
              singular.unshift(space);
              singular.unshift(renderedProperty);
              plural.unshift(space);
              plural.unshift(renderedProperty);
            } else if (property.singular) {
              let preposition = new Display.TextExpression(' with ');
              singular.push(preposition);
              plural.push(preposition);
              if (property.article) {
                singular.push(new Display.TextExpression(property.article));
                singular.push(space);
              }
              let renderedProperty = new Display.TextExpression(property.singular);
              if (property.definitionRef) {
                this.setSemanticLink(renderedProperty, property.definitionRef);
              }
              singular.push(renderedProperty);
              if (property.plural) {
                renderedProperty = new Display.TextExpression(property.plural);
                if (property.definitionRef) {
                  this.setSemanticLink(renderedProperty, property.definitionRef);
                }
              }
              plural.push(renderedProperty);
            }
          }
        }
        if (!variableDisplay) {
          variableDisplay = variableDefinitions;
        }
        if (state.abbreviate) {
          let which = parameters.length === 1 && !state.forcePlural && !combineWithNext ? singular : plural;
          row.push(...which);
          row.push(new Display.TextExpression(' '));
          row.push(variableDisplay);
        } else {
          row.push(variableDisplay);
          if (combineWithNext) {
            state.inDefinitionDisplayGroup = true;
          } else {
            if (parameters.length === 1 && !state.inDefinitionDisplayGroup) {
              let singularStart = singular[0];
              for (;;) {
                if (singularStart instanceof Display.RowExpression && singularStart.items.length) {
                  singularStart = singularStart.items[0];
                } else if (singularStart instanceof Display.IndirectExpression) {
                  singularStart = singularStart.resolve();
                } else {
                  break;
                }
              }
              if (!noun.article) {
                noun.article = this.getSingularArticle(singularStart instanceof Display.TextExpression ? singularStart.text : undefined);
              }
              if (state.sentence) {
                row.push(new Display.TextExpression(` be ${noun.article} `));
                row.push(...singular);
              } else {
                row.push(new Display.TextExpression(` is ${noun.article} `));
                row.push(...singular);
              }
            } else {
              if (state.sentence) {
                row.push(new Display.TextExpression(' be '));
                row.push(...plural);
              } else {
                row.push(new Display.TextExpression(' are '));
                row.push(...plural);
              }
            }
            state.inDefinitionDisplayGroup = false;
          }
        }
      } else if (variableDisplay) {
        row.push(variableDisplay);
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        row.push(this.renderTemplate('SubsetParameter', {
                                       'subset': variableDefinitions,
                                       'superset': this.renderSetTerm(type.superset)
                                     }));
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        row.push(this.renderTemplate('ElementParameter', {
                                       'element': variableDefinitions,
                                       'set': this.renderSetTerm(type._set)
                                     }));
      } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
        row.push(this.renderTemplate('VariableDefinition', {
                                       'left': variableDefinitions,
                                       'right': this.renderSetTerm(type._set)
                                     }));
        state.inDefinition = true;
      } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
        row.push(this.renderTemplate('VariableDefinition', {
                                       'left': variableDefinitions,
                                       'right': this.renderElementTerm(type.element)
                                     }));
        state.inDefinition = true;
      } else {
        row.push(new Display.ErrorExpression('Unknown parameter type'));
      }
    }

    state.started = true;

    return new Display.RowExpression(row);
  }

  private applyName(name: Fmt.Expression, args: Display.RenderedTemplateArguments, definitionRef: Fmt.DefinitionRefExpression, result: Display.RenderedExpression[]): string | undefined {
    result.length = 0;
    let expression = this.renderDisplayExpression(name, args);
    while (expression instanceof Display.IndirectExpression) {
      expression = expression.resolve();
    }
    if (expression instanceof Display.RowExpression && expression.items.length) {
      result.push(...expression.items);
    } else {
      result.push(expression);
    }
    let firstItem = result[0];
    this.setSemanticLink(firstItem, definitionRef);
    if (firstItem instanceof Display.TextExpression) {
      return firstItem.text;
    } else {
      return undefined;
    }
  }

  private replaceName(name: string | undefined, definitionRef: Fmt.DefinitionRefExpression | undefined, alwaysApply: boolean, result: Display.RenderedExpression[]): void {
    if (name && (alwaysApply || !result.length)) {
      let newName = new Display.TextExpression(name);
      this.setSemanticLink(newName, definitionRef || newName);
      if (result.length) {
        result[0] = newName;
      } else {
        result.push(newName);
      }
    }
  }

  private getSingularArticle(nextWord?: string): string {
    if (nextWord) {
      let firstChar = nextWord.charAt(0);
      if (firstChar === 'a' || firstChar === 'e' || firstChar === 'i' || firstChar === 'o' || firstChar === 'u') {
        // We currently do not consider any special cases such as a silent 'h'. That seems complicated.
        // Other languages are even worse.
        return 'an';
      }
    }
    return 'a';
  }

  private getDisplayDefinitionRef(type: Fmt.Expression): Fmt.Expression | undefined {
    if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Binding) {
      return type._set;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      return type.element;
    } else {
      return undefined;
    }
  }

  private extractProperties(parameters: Fmt.Parameter[], noun: PropertyInfo, remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined): PropertyInfo[] | undefined {
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
          && definition.contents.display instanceof Fmt.ArrayExpression
          && definition.contents.display.items.length) {
        let display = definition.contents.display.items[0];
        if (display instanceof Fmt.DefinitionRefExpression) {
          if (display.path.name === 'Property'
              || display.path.name === 'NounProperty'
              || display.path.name === 'Feature') {
            let operand = display.path.arguments.getValue('operand');
            if (operand instanceof Fmt.VariableRefExpression) {
              let operandArg = constraint.path.arguments.getValue(operand.variable.name);
              if (operandArg instanceof Fmt.CompoundExpression && operandArg.arguments.length) {
                let operandArgValue = operandArg.arguments[0].value;
                if (operandArgValue instanceof Fmt.VariableRefExpression && operandArgValue.variable === param) {
                  return {
                    property: this.getDisplayArgument(display, 'property', negationCount),
                    singular: this.getDisplayArgument(display, 'singular', negationCount),
                    plural: this.getDisplayArgument(display, 'plural', negationCount),
                    article: this.getDisplayArgument(display, 'article', negationCount),
                    isFeature: display.path.name === 'Feature',
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
    return undefined;
  }

  private getDisplayArgument(display: Fmt.DefinitionRefExpression, paramName: string, negationCount: number): string | undefined {
    let value = display.path.arguments.getOptionalValue(paramName);
    if (value instanceof FmtDisplay.MetaRefExpression_neg) {
      if (negationCount < value.items.length) {
        value = value.items[negationCount];
        negationCount = 0;
      }
    }
    if (value instanceof Fmt.StringExpression && !negationCount) {
      return value.value;
    }
    return undefined;
  }

  private extractConstraints(parameters: Fmt.Parameter[], extractedConstraints: Fmt.Parameter[]): Fmt.Parameter[] {
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

  renderVariableDefinitions(parameters: Fmt.Parameter[], indices?: Display.RenderedExpression[], markAsDummy: boolean = false): Display.RenderedExpression {
    let items = parameters.map((param) => this.renderVariable(param, indices, true, markAsDummy));
    return this.renderTemplate('Group', {'items': items});
  }

  renderVariable(param: Fmt.Parameter, indices?: Display.RenderedExpression[], isDefinition: boolean = false, isDummy: boolean = false): Display.RenderedExpression {
    let result = super.renderVariable(param, indices, isDefinition, isDummy);
    if (!isDummy) {
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Element && type.shortcut && (isDefinition || type.shortcut._override instanceof FmtHLM.MetaRefExpression_true)) {
        result = this.renderShortcut(type.shortcut, result, indices, isDefinition);
      }
    }
    return result;
  }

  renderShortcut(shortcut: FmtHLM.ObjectContents_Shortcut, element: Display.RenderedExpression, indices?: Display.RenderedExpression[], isDefinition: boolean = false): Display.RenderedExpression {
    let replacementParameters: ReplacementParameters = {
      parameters: shortcut.parameters,
      indices: indices,
      isDefinition: isDefinition
    };
    let shortcutDisplay = this.renderGenericExpression(shortcut._constructor, false, 0, replacementParameters);
    this.setSemanticLink(shortcutDisplay, shortcut._constructor);
    if (shortcut._override instanceof FmtHLM.MetaRefExpression_true) {
      return shortcutDisplay;
    } else {
      return this.renderTemplate('Shortcut', {
                                   'element': element,
                                   'shortcut': shortcutDisplay
                                 });
    }
  }

  renderSetTerm(term: Fmt.Expression): Display.RenderedExpression {
    return this.setSemanticLink(this.renderSetTermInternal(term), term);
  }

  renderSetTermInternal(term: Fmt.Expression): Display.RenderedExpression {
    if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
      return this.renderTemplate('Enumeration', {
                                   'items': term.terms ? term.terms.map((item) => this.renderElementTerm(item)) : []
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
      return this.renderTemplate('SetBuilder', {
                                   'element': this.renderParameter(term.parameter, true),
                                   'constraint': this.renderFormula(term.formula)
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      return this.renderTemplate('SetBuilder', {
                                   'element': this.renderElementTerm(term.term),
                                   'constraint': this.renderParameterList(term.parameters, false, false, false)
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      return this.renderStructuralCases(term.term, term.construction, term.cases, this.renderSetTerm.bind(this));
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderElementTerm(term: Fmt.Expression): Display.RenderedExpression {
    return this.setSemanticLink(this.renderElementTermInternal(term), term);
  }

  renderElementTermInternal(term: Fmt.Expression): Display.RenderedExpression {
    if (term instanceof FmtHLM.MetaRefExpression_cases) {
      let rows = term.cases.map((caseExpr) => {
        let value = this.renderElementTerm(caseExpr.value);
        let formula = this.renderFormula(caseExpr.formula);
        return this.buildCaseRow(value, formula);
      });
      return this.renderTemplate('Cases', {
        'cases': rows
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      return this.renderStructuralCases(term.term, term.construction, term.cases, this.renderElementTerm.bind(this));
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderSymbolTerm(term: Fmt.Expression): Display.RenderedExpression {
    return this.setSemanticLink(this.renderSymbolTermInternal(term), term);
  }

  private renderSymbolTermInternal(term: Fmt.Expression): Display.RenderedExpression {
    return this.renderGenericExpression(term);
  }

  renderFormula(formula: Fmt.Expression): Display.RenderedExpression {
    let negationCount = 0;
    let innerFormula = formula;
    while (innerFormula instanceof FmtHLM.MetaRefExpression_not) {
      negationCount++;
      innerFormula = innerFormula.formula;
    }
    let result = this.setSemanticLink(this.setSemanticLink(this.renderFormulaInternal(innerFormula, negationCount), formula), innerFormula);
    result.optionalParenStyle = '[]';
    return result;
  }

  private renderFormulaInternal(formula: Fmt.Expression, negationCount: number): Display.RenderedExpression {
    if (formula instanceof FmtHLM.MetaRefExpression_and) {
      if (formula.formulae) {
        return this.renderTemplate('Conjunction', {
                                     'operands': formula.formulae.map((item) => this.renderFormula(item))
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('True', {}, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      if (formula.formulae) {
        return this.renderTemplate('Disjunction', {
                                     'operands': formula.formulae.map((item) => this.renderFormula(item))
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('False', {}, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      return this.renderTemplate('UniversalQuantification', {
                                   'parameters': this.renderParameterList(formula.parameters, false, true, true),
                                   'formula': this.renderFormula(formula.formula)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_exists) {
      if (formula.formula) {
        return this.renderTemplate('ExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false),
                                     'formula': this.renderFormula(formula.formula)
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('PlainExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false)
                                   },
                                   negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
      if (formula.formula) {
        return this.renderTemplate('UniqueExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false),
                                     'formula': this.renderFormula(formula.formula)
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('PlainUniqueExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false)
                                   },
                                   negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      return this.renderTemplate('ElementRelation', {
                                   'element': this.renderElementTerm(formula.element),
                                   'set': this.renderSetTerm(formula._set)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      return this.renderTemplate('SubsetRelation', {
                                   'subset': this.renderSetTerm(formula.subset),
                                   'superset': this.renderSetTerm(formula.superset)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      return this.renderTemplate('EqualityRelation', {
                                   'left': this.renderSetTerm(formula.left),
                                   'right': this.renderSetTerm(formula.right)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
      return this.renderTemplate('EqualityRelation', {
                                   'left': this.renderElementTerm(formula.left),
                                   'right': this.renderElementTerm(formula.right)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      return this.renderStructuralCases(formula.term, formula.construction, formula.cases, this.renderFormula.bind(this));
    } else {
      return this.renderGenericExpression(formula, false, negationCount);
    }
  }

  private renderStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], renderCase: (value: Fmt.Expression) => Display.RenderedExpression): Display.RenderedExpression {
    let termDisplay = this.renderElementTerm(term);
    let constructionExpr = construction as Fmt.DefinitionRefExpression;
    let constructionPath = constructionExpr.path;
    let rows = cases.map((caseExpr) => {
      let value = renderCase(caseExpr.value);
      let constructorPromise = this.utils.getStructuralCaseTerm(constructionPath, caseExpr);
      let constructorDisplayPromise = constructorPromise.then((constructorExpr: Fmt.Expression) => this.renderElementTerm(constructorExpr));
      let constructorDisplay = new Display.PromiseExpression(constructorDisplayPromise);
      let formula = this.renderTemplate('EqualityRelation', {
                                          'left': termDisplay,
                                          'right': constructorDisplay
                                        });
      let row = this.buildCaseRow(value, formula);
      if (caseExpr.parameters && caseExpr.parameters.length) {
        let parameters = this.renderParameterList(caseExpr.parameters, false, false, false);
        row.push(new Display.ParenExpression(parameters, '()'));
      }
      return row;
    });
    return this.renderTemplate('Cases', {
      'cases': rows,
    });
  }

  private renderGenericExpression(expression: Fmt.Expression, omitArguments: boolean = false, negationCount: number = 0, replacementParameters?: ReplacementParameters): Display.RenderedExpression {
    if (expression instanceof Fmt.VariableRefExpression) {
      let indices = expression.indices ? expression.indices.map((term) => this.renderElementTerm(term)) : undefined;
      return this.renderVariable(expression.variable, indices);
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      let childPaths: Fmt.Path[] = [];
      this.utils.splitPath(expression.path, childPaths);
      let definitionPromise = this.utils.getDefinition(childPaths[0]);
      let expressionPromise = definitionPromise.then((definition) => {
        let definitions: Fmt.Definition[] = [];
        let argumentLists: Fmt.ArgumentList[] = [];
        this.utils.analyzeDefinitionRefPath(childPaths, definition, definitions, argumentLists);
        return this.renderDefinitionRef(definitions, argumentLists, omitArguments, negationCount, replacementParameters);
      });
      return new Display.PromiseExpression(expressionPromise);
    } else if (expression instanceof FmtHLM.MetaRefExpression_previous) {
      return new Display.TextExpression('…');
    } else {
      return new Display.ErrorExpression('Unknown expression type');
    }
  }

  renderExampleExpression(expression: Fmt.DefinitionRefExpression): Display.RenderedExpression {
    let definitionPromise = this.utils.getDefinition(expression.path);
    let expressionPromise = definitionPromise.then((definition) => {
      return this.renderDefinitionRef([definition]);
    });
    let result = new Display.PromiseExpression(expressionPromise);
    return this.setSemanticLink(result, expression);
  }

  private renderDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: boolean = false, negationCount: number = 0, replacementParameters?: ReplacementParameters): Display.RenderedExpression {
    let result: Display.RenderedExpression | undefined = undefined;
    let definition = definitions[definitions.length - 1];
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
      result = this.renderDefinitionDisplayExpression(definition.contents.display, definitions, argumentLists, omitArguments, negationCount, replacementParameters);
    }
    if (!result) {
      result = this.renderDefaultDefinitionRef(definitions, argumentLists, omitArguments, negationCount, replacementParameters);
    }
    if (definitions[0] === this.definition) {
      this.setSemanticLink(result, definition);
    }
    return result;
  }

  private renderDefaultDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: boolean = false, negationCount: number = 0, replacementParameters?: ReplacementParameters): Display.RenderedExpression {
    let definition = definitions[definitions.length - 1];
    let result: Display.RenderedExpression = new Display.TextExpression(definition.name);
    if (definition.contents instanceof FmtHLM.ObjectContents_Constructor) {
      result.styleClasses = ['ctor'];
    }
    if (definitions.length > 1) {
      let subSupExpression = new Display.SubSupExpression(result);
      subSupExpression.sub = this.renderDefinitionRef(definitions.slice(0, -1), argumentLists ? argumentLists.slice(0, -1) : undefined);
      result = subSupExpression;
    }
    if (!omitArguments) {
      let args: Display.RenderedExpression[] = [];
      let curArgumentLists = replacementParameters ? undefined : argumentLists;
      this.fillArguments(definition.parameters, replacementParameters, curArgumentLists, undefined, true, false, undefined, args);
      if (args.length) {
        result = this.renderTemplate('Function', {
                                      'function': result,
                                      'arguments': args
                                    });
      }
    }
    for (let i = 0; i < negationCount; i++) {
      result = this.renderNegation(result);
    }
    return result;
  }

  private renderDefinitionDisplayExpression(displayExpression: Fmt.Expression | undefined, definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: boolean = false, negationCount: number = 0, replacementParameters?: ReplacementParameters): Display.RenderedExpression | undefined {
    if (displayExpression instanceof Fmt.ArrayExpression
        && displayExpression.items.length) {
      let display = this.findBestMatch(displayExpression.items, argumentLists)!;
      if (omitArguments && display instanceof Fmt.DefinitionRefExpression) {
        let abbr: Fmt.Expression | undefined = undefined;
        if (display.path.name === 'Operator'
            || display.path.name === 'AssociativeOperator'
            || display.path.name === 'Relation'
            || display.path.name === 'TextualRelation'
            || display.path.name === 'BooleanOperator'
            || display.path.name === 'FunctionOperator') {
          abbr = display.path.arguments.getValue('symbol');
        } else if (display.path.name === 'Function') {
          abbr = display.path.arguments.getValue('function');
        } else if (display.path.name === 'Property'
                   || display.path.name === 'MultiProperty') {
          abbr = display.path.arguments.getValue('property');
          if (abbr instanceof FmtDisplay.MetaRefExpression_neg) {
            let negationList = new Fmt.ArrayExpression;
            negationList.items = [];
            let comma = new Fmt.StringExpression;
            comma.value = ', ';
            for (let item of abbr.items) {
              if (negationList.items.length) {
                negationList.items.push(comma);
              }
              negationList.items.push(item);
            }
            abbr = negationList;
          }
        } else if (display.path.name === 'NounProperty'
                   || display.path.name === 'Feature') {
          abbr = display.path.arguments.getValue('singular');
        }
        if (abbr instanceof Fmt.StringExpression || abbr instanceof Fmt.ArrayExpression || abbr instanceof Fmt.MetaRefExpression) {
          display = abbr;
        }
      }
      let args = this.getRenderedTemplateArguments(definitions, argumentLists, replacementParameters, omitArguments);
      return this.renderDisplayExpression(display, args, negationCount);
    } else {
      return undefined;
    }
  }

  private getRenderedTemplateArguments(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], replacementParameters?: ReplacementParameters, markAsDummy: boolean = false): Display.RenderedTemplateArguments {
    let args: Display.RenderedTemplateArguments = {};
    let index = 0;
    for (let curDefinition of definitions) {
      let curParams: Fmt.Parameter[] = [];
      let curArgs: Display.RenderedExpression[] = [];
      let curReplacementParameters = index === definitions.length - 1 ? replacementParameters : undefined;
      let curArgumentLists = argumentLists && !curReplacementParameters ? argumentLists.slice(0, index + 1) : undefined;
      this.fillArguments(curDefinition.parameters, curReplacementParameters, curArgumentLists, undefined, false, markAsDummy, curParams, curArgs);
      for (let paramIndex = 0; paramIndex < curParams.length; paramIndex++) {
        let curParam = curParams[paramIndex];
        args[curParam.name] = curArgs[paramIndex];
      }
      index++;
    }
    return args;
  }

  private renderArgumentList(parameters: Fmt.ParameterList, argumentList?: Fmt.ArgumentList, indices?: Display.RenderedExpression[]): Display.RenderedExpression {
    let args: Display.RenderedExpression[] = [];
    this.fillArguments(parameters, undefined, argumentList ? [argumentList] : undefined, indices, true, false, undefined, args);
    if (args.length === 1) {
      return args[0];
    } else {
      return new Display.ParenExpression(this.renderTemplate('Group', {'items': args}), '()');
    }
  }

  private renderArgumentDefinitionList(parameters: Fmt.ParameterList, argumentList: Fmt.ArgumentList): Display.RenderedExpression {
    let params: Fmt.Parameter[] = [];
    let args: Display.RenderedExpression[] = [];
    // TODO handle bindings better
    this.fillArguments(parameters, undefined, [argumentList], undefined, true, false, params, args);
    args = params.map((param: Fmt.Parameter, index: number) => this.renderTemplate('EqualityDefinition', {'left': this.renderVariable(param), 'right': args[index]}));
    if (args.length === 1) {
      return args[0];
    } else {
      return this.renderTemplate('Group', {'items': args, 'separator': ', '});
    }
  }

  private fillArguments(parameters: Fmt.ParameterList, replacementParameters: ReplacementParameters | undefined, argumentLists: Fmt.ArgumentList[] | undefined, indices: Display.RenderedExpression[] | undefined, combineBindings: boolean, markAsDummy: boolean, resultParams: Fmt.Parameter[] | undefined, resultArgs: Display.RenderedExpression[]): void {
    if (replacementParameters) {
      indices = replacementParameters.indices;
    }
    let index = 0;
    for (let param of parameters) {
      let replacementParam = replacementParameters && replacementParameters.parameters ? replacementParameters.parameters[index] : undefined;
      let paramToDisplay = replacementParam || param;
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Binding) {
        let parameter: Fmt.Parameter | undefined = undefined;
        let bindingArgumentList: Fmt.ArgumentList | undefined = undefined;
        let newIndices = indices;
        if (argumentLists) {
          let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_BindingArg);
          if (arg) {
            parameter = arg.parameter;
            bindingArgumentList = arg.arguments;
          }
        } else {
          parameter = paramToDisplay;
          newIndices = indices ? indices.slice() : [];
          newIndices.push(this.renderVariable(parameter, undefined, false, markAsDummy));
        }
        if (resultParams) {
          resultParams.push(param);
        }
        if (parameter && (bindingArgumentList || !argumentLists)) {
          let variableDefinition = this.renderVariableDefinitions([parameter], undefined, markAsDummy);
          if (combineBindings) {
            resultArgs.push(this.renderTemplate('Binding', {
                                                  'variable': variableDefinition,
                                                  'value': this.renderArgumentList(type.parameters, bindingArgumentList, newIndices)
                                                }));
          } else {
            resultArgs.push(variableDefinition);
            let replacementBindingParameters: ReplacementParameters | undefined = undefined;
            if (replacementParam) {
              let replacementParamType = replacementParam.type.expression as FmtHLM.MetaRefExpression_Binding;
              replacementBindingParameters = {
                parameters: replacementParamType.parameters,
                indices: newIndices,
                isDefinition: replacementParameters!.isDefinition
              };
            }
            this.fillArguments(type.parameters, replacementBindingParameters, bindingArgumentList ? [bindingArgumentList] : undefined, newIndices, combineBindings, markAsDummy, resultParams, resultArgs);
          }
        } else {
          resultArgs.push(new Display.ErrorExpression('Undefined argument'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set
                 || type instanceof FmtHLM.MetaRefExpression_Subset
                 || type instanceof FmtHLM.MetaRefExpression_Element
                 || type instanceof FmtHLM.MetaRefExpression_Symbol
                 || type instanceof FmtHLM.MetaRefExpression_Nat
                 || type instanceof FmtHLM.MetaRefExpression_DefinitionRef) {
        if (resultParams) {
          resultParams.push(param);
        }
        if (argumentLists) {
          if (type instanceof FmtHLM.MetaRefExpression_Set) {
            let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_SetArg);
            if (arg) {
              resultArgs.push(this.renderSetTerm(arg._set));
            } else {
              resultArgs.push(new Display.ErrorExpression('Undefined argument'));
            }
          } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
            let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_SubsetArg);
            if (arg) {
              resultArgs.push(this.renderSetTerm(arg._set));
            } else {
              resultArgs.push(new Display.ErrorExpression('Undefined argument'));
            }
          } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
            let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_ElementArg);
            if (arg) {
              resultArgs.push(this.renderElementTerm(arg.element));
            } else {
              resultArgs.push(new Display.ErrorExpression('Undefined argument'));
            }
          } else if (type instanceof FmtHLM.MetaRefExpression_Symbol) {
            let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_SymbolArg);
            if (arg) {
              resultArgs.push(this.renderSymbolTerm(arg.symbol));
            } else {
              resultArgs.push(new Display.ErrorExpression('Undefined argument'));
            }
          } else if (type instanceof FmtHLM.MetaRefExpression_Nat) {
            let arg = this.getRawArgument(argumentLists, param);
            if (arg instanceof Fmt.IntegerExpression) {
              resultArgs.push(new Display.TextExpression(arg.value.toString()));
            } else {
              resultArgs.push(new Display.ErrorExpression('Undefined argument'));
            }
          } else if (type instanceof FmtHLM.MetaRefExpression_DefinitionRef) {
            let arg = this.getRawArgument(argumentLists, param);
            if (arg instanceof Fmt.DefinitionRefExpression) {
              let definitionRef = this.renderGenericExpression(arg, true);
              this.setSemanticLink(definitionRef, arg);
              resultArgs.push(definitionRef);
            } else {
              resultArgs.push(new Display.ErrorExpression('Undefined argument'));
            }
          } else {
            resultArgs.push(new Display.ErrorExpression('Unhandled parameter type'));
          }
        } else {
          resultArgs.push(this.renderVariable(paramToDisplay, indices, replacementParameters && replacementParameters.isDefinition, markAsDummy));
        }
      }
      index++;
    }
  }

  private getRawArgument(argumentLists: Fmt.ArgumentList[], param: Fmt.Parameter): Fmt.Expression | undefined {
    for (let argumentList of argumentLists) {
      let value = argumentList.getOptionalValue(param.name);
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  private getArgument<ContentClass extends Fmt.ObjectContents>(argumentLists: Fmt.ArgumentList[], param: Fmt.Parameter, contentClass: {new(): ContentClass}): ContentClass | undefined {
    let arg = this.getRawArgument(argumentLists, param);
    if (arg instanceof Fmt.CompoundExpression) {
      let contents = new contentClass;
      contents.fromCompoundExpression(arg);
      return contents;
    }
    return undefined;
  }

  private addDefinitionContents(paragraphs: Display.RenderedExpression[], includeExtras: boolean): void {
    let contents = this.renderDefinitionContents();
    if (contents) {
      if (!contents.styleClasses) {
        contents.styleClasses = [];
      }
      contents.styleClasses.push('display-math');
      paragraphs.push(contents);
    }
    if (includeExtras) {
      this.addExtraDefinitionContents(paragraphs);
    }
    this.addDefinitionProofs(paragraphs);
  }

  renderDefinitionContents(): Display.RenderedExpression | undefined {
    let definition = this.definition;
    if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      return undefined;
    } else if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      return this.renderFormula(definition.contents.claim);
    } else if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      let conditions = definition.contents.conditions as Fmt.ArrayExpression;
      let items = conditions.items.map((formula) => this.renderFormula(formula));
      return new Display.ListExpression(items, '1.');
    } else if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
      let contents = definition.contents;
      let definitionRef = this.renderDefinitionRef([definition]);
      let onSetDisplay = (display: Fmt.ArrayExpression | undefined) => (contents.display = display);
      let onGetDefault = () => this.renderDefaultDefinitionRef([definition]);
      let onGetVariables = () => {
        let variables: RenderedVariable[] = [];
        this.addRenderedVariables(definition.parameters, variables);
        return variables;
      };
      let isPredicate = contents instanceof FmtHLM.ObjectContents_Predicate;
      this.setDefinitionSemanticLink(definitionRef, definition, contents.display, onSetDisplay, onGetDefault, onGetVariables, isPredicate);
      if (contents instanceof FmtHLM.ObjectContents_Construction) {
        let rows = definition.innerDefinitions.map((innerDefinition) => {
          let innerContents = innerDefinition.contents as FmtHLM.ObjectContents_Definition;
          let constructorDef = this.renderDefinitionRef([definition, innerDefinition]);
          let onSetConstructorDisplay = (display: Fmt.ArrayExpression | undefined) => (innerContents.display = display);
          let onGetConstructorDefault = () => this.renderDefaultDefinitionRef([definition, innerDefinition]);
          let onGetConstructorVariables = () => {
            let variables: RenderedVariable[] = [];
            this.addRenderedVariables(definition.parameters, variables);
            this.addRenderedVariables(innerDefinition.parameters, variables);
            return variables;
          };
          this.setDefinitionSemanticLink(constructorDef, innerDefinition, innerContents.display, onSetConstructorDisplay, onGetConstructorDefault, onGetConstructorVariables, false);
          let row = [constructorDef];
          if (innerDefinition.parameters.length) {
            row.push(this.renderParameterList(innerDefinition.parameters, false, false, false));
          }
          return row;
        });
        let construction = this.renderTemplate('Construction', {
          'constructors': rows,
        });
        return this.renderTemplate('ConstructionDefinition', {
          'left': definitionRef,
          'right': construction
        });
      } else if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
        let definitions = contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((term) => this.renderSetTerm(term));
        return this.renderMultiDefinitions('Equality', definitionRef, items);
      } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
        let definitions = contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((term) => this.renderElementTerm(term));
        return this.renderMultiDefinitionsWithSpecializations('Equality', definitionRef, items, definitions.items);
      } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
        let equality = this.renderTemplate('EqualityRelation', {
          'left': definitionRef,
          'right': this.renderVariable(contents.parameter)
        });
        let definitions = contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((formula) => this.renderFormula(formula));
        return this.renderMultiDefinitions('Equivalence', equality, items);
      } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
        let definitions = contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((formula) => this.renderFormula(formula));
        return this.renderMultiDefinitions('Equivalence', definitionRef, items);
      } else {
        return new Display.EmptyExpression;
      }
    } else {
      return new Display.EmptyExpression;
    }
  }

  private renderMultiDefinitions(type: string, left: Display.RenderedExpression, right: Display.RenderedExpression[]): Display.RenderedExpression {
    let rows = right.map((rightItem, index) => {
      let leftItem: Display.RenderedExpression;
      if (index === 0) {
        leftItem = this.renderTemplate(type + 'Definition', {
          'left': left,
          'right': new Display.EmptyExpression
        });
      } else {
        leftItem = this.renderTemplate(type + 'Relation', {
          'left': new Display.EmptyExpression,
          'right': new Display.EmptyExpression
        });
      }
      return [leftItem, rightItem];
    });
    let result = new Display.TableExpression(rows);
    result.styleClasses = ['aligned'];
    return result;
  }

  private renderMultiDefinitionsWithSpecializations(type: string, left: Display.RenderedExpression, right: Display.RenderedExpression[], rightExpressions: Fmt.Expression[]): Display.RenderedExpression {
    if (right.length === 1 && rightExpressions.length === 1) {
      let expression = rightExpressions[0];
      if (expression instanceof Fmt.DefinitionRefExpression) {
        let definitionRef = expression;
        let promise = this.utils.getOuterDefinition(definitionRef)
          .then((definition: Fmt.Definition) => {
            let definitions: Fmt.Definition[] = [];
            let argumentLists: Fmt.ArgumentList[] = [];
            this.utils.analyzeDefinitionRef(definitionRef, definition, definitions, argumentLists);
            let innerDefinition = definitions[definitions.length - 1];
            if (innerDefinition.contents instanceof FmtHLM.ObjectContents_Definition) {
              let definitionDisplay = innerDefinition.contents.definitionDisplay;
              if (definitionDisplay) {
                let args = this.getRenderedTemplateArguments(definitions, argumentLists);
                args[definitionDisplay.parameter.name] = left;
                if (definitionDisplay.display
                    && definitionDisplay.display instanceof Fmt.ArrayExpression
                    && definitionDisplay.display.items.length) {
                  let display = this.findBestMatch(definitionDisplay.display.items, argumentLists)!;
                  let result = this.renderDisplayExpression(display, args);
                  return this.setSemanticLink(result, definitionRef);
                }
              }
            }
            return this.renderMultiDefinitions(type, left, right);
          });
        return new Display.PromiseExpression(promise);
      }
    }
    return this.renderMultiDefinitions(type, left, right);
  }

  private addDefinitionProofs(paragraphs: Display.RenderedExpression[]): void {
    let definition = this.definition;
    if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      this.addProofs(definition.contents.proofs, 'Proof', definition.contents.claim, paragraphs);
    } else if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      this.addEquivalenceProofs(definition.contents.equivalenceProofs, 'Proof', '⇒', paragraphs);
    } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
      if (definition.contents.definition instanceof Fmt.ArrayExpression && definition.contents.definition.items.length > 1) {
        this.addEquivalenceProofs(definition.contents.equalityProofs, 'Equality', '⊆', paragraphs);
      }
    } else if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
      if (definition.contents.definition instanceof Fmt.ArrayExpression && definition.contents.definition.items.length > 1) {
        this.addEquivalenceProofs(definition.contents.equalityProofs, 'Equality', '=', paragraphs);
      }
    } else if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
      if (definition.contents.definition instanceof Fmt.ArrayExpression && definition.contents.definition.items.length > 1) {
        this.addEquivalenceProofs(definition.contents.equivalenceProofs, 'Equivalence', '⇒', paragraphs);
      }
    } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
      if (definition.contents.definition instanceof Fmt.ArrayExpression && definition.contents.definition.items.length > 1) {
        this.addEquivalenceProofs(definition.contents.equivalenceProofs, 'Equivalence', '⇒', paragraphs);
      }
      this.addProof(definition.contents.wellDefinednessProof, 'Well-definedness', undefined, paragraphs);
    }
    this.addShortcutProofs(paragraphs);
  }

  private addShortcutProofs(paragraphs: Display.RenderedExpression[]): void {
    // TODO after the shortcut redesign, we can display actual proofs here
    let hasNonIsomorphicShortcutPromise = CachedPromise.resolve(false);
    for (let param of this.definition.parameters) {
      let type = param.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_Element && type.shortcut && type.shortcut._constructor instanceof Fmt.DefinitionRefExpression) {
        let constructorRef = type.shortcut._constructor;
        let constructionPromise = this.utils.getOuterDefinition(constructorRef);
        hasNonIsomorphicShortcutPromise = hasNonIsomorphicShortcutPromise.then((hasNonIsomorphicShortcut: boolean) => {
          if (hasNonIsomorphicShortcut) {
            return true;
          }
          return constructionPromise.then((construction: Fmt.Definition) => {
            let constructor = construction.innerDefinitions.getDefinition(constructorRef.path.name);
            if (constructor.contents instanceof FmtHLM.ObjectContents_Constructor && constructor.contents.equalityDefinition) {
              if (!(constructor.contents.equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true)) {
                return true;
              }
            }
            return false;
          });
        });
      }
    }
    let immediateResult = hasNonIsomorphicShortcutPromise.getImmediateResult();
    if (immediateResult !== false) {
      let proofPromise = hasNonIsomorphicShortcutPromise.then((hasNonIsomorphicShortcut: boolean) => {
        if (hasNonIsomorphicShortcut) {
          let subParagraphs: Display.RenderedExpression[] = [];
          this.addNoProofPlaceholder('Well-definedness', undefined, undefined, subParagraphs);
          return new Display.ParagraphExpression(subParagraphs);
        } else {
          return new Display.EmptyExpression;
        }
      });
      paragraphs.push(new Display.PromiseExpression(proofPromise));
    }
  }

  private addExtraDefinitionContents(paragraphs: Display.RenderedExpression[]): void {
    let definition = this.definition;
    if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
      for (let innerDefinition of definition.innerDefinitions) {
        let constructorContents = innerDefinition.contents;
        if (constructorContents instanceof FmtHLM.ObjectContents_Constructor && innerDefinition.parameters.length) {
          let equalityDefinition = constructorContents.equalityDefinition;
          if (equalityDefinition) {
            // Unfortunately, normal concatenation doesn't seem to work with our derived arrays.
            let combinedParameters: Fmt.Parameter[] = [];
            combinedParameters.push(...equalityDefinition.leftParameters);
            combinedParameters.push(...equalityDefinition.rightParameters);
            let parameters = this.renderParameterList(combinedParameters, false, true, true);
            let leftParameters: ReplacementParameters = {
              parameters: equalityDefinition.leftParameters,
              isDefinition: false
            };
            let rightParameters: ReplacementParameters = {
              parameters: equalityDefinition.rightParameters,
              isDefinition: false
            };
            let leftConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, false, 0, leftParameters);
            this.setSemanticLink(leftConstructor, innerDefinition);
            let rightConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, false, 0, rightParameters);
            this.setSemanticLink(rightConstructor, innerDefinition);
            let equality = this.renderTemplate('EqualityRelation', {
              'left': leftConstructor,
              'right': rightConstructor
            });
            this.setSemanticLink(equality, equalityDefinition);
            let definitions = equalityDefinition.definition as Fmt.ArrayExpression;
            let items = definitions.items.map((formula) => this.renderFormula(formula));
            let equivalenceDef = this.renderMultiDefinitions('Equivalence', equality, items);
            let quantification = this.renderTemplate('UniversalQuantification', {
              'parameters': parameters,
              'formula': equivalenceDef
            });
            paragraphs.push(quantification);
            if (!(equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true)) {
              this.addIndentedProof(equalityDefinition.reflexivityProof, 'Reflexivity', paragraphs);
              this.addIndentedProof(equalityDefinition.symmetryProof, 'Symmetry', paragraphs);
              this.addIndentedProof(equalityDefinition.transitivityProof, 'Transitivity', paragraphs);
            }
          }
        }
      }
      let embedding = definition.contents.embedding;
      if (embedding) {
        let source = embedding.parameter.type.expression as FmtHLM.MetaRefExpression_Element;
        let rows: Display.RenderedExpression[][] = [];
        let subset = this.renderSetTerm(source._set);
        let superset = this.renderDefinitionRef([definition]);
        this.setSemanticLink(superset, definition);
        let supersetDefinition = this.renderTemplate('EmbeddingDefinition', {
          'subset': new Display.EmptyExpression,
          'superset': superset
        });
        let supersetWithText = new Display.RowExpression([supersetDefinition, new Display.TextExpression(' via')]);
        rows.push([subset, supersetWithText]);
        let subsetElement = this.renderVariableDefinitions([embedding.parameter]);
        let targetTerm = this.utils.getEmbeddingTargetTerm(definition, embedding.target);
        let target = this.renderElementTerm(targetTerm);
        let supersetElement = this.renderTemplate('EqualityRelation', {
          'left': new Display.EmptyExpression,
          'right': target
        });
        rows.push([subsetElement, supersetElement]);
        let table = new Display.TableExpression(rows);
        table.styleClasses = ['aligned', 'inline'];
        paragraphs.push(table);
        this.addIndentedProof(embedding.wellDefinednessProof, 'Well-definedness', paragraphs);
      }
      this.addSubsetEmbeddings(paragraphs);
    } else if (definition.contents instanceof FmtHLM.ObjectContents_Predicate
               && definition.contents.display instanceof Fmt.ArrayExpression
               && definition.contents.display.items.length) {
      let display = definition.contents.display.items[0];
      if (display instanceof Fmt.DefinitionRefExpression) {
        if (display.path.name === 'Property'
            || display.path.name === 'MultiProperty') {
          let property = display.path.arguments.getValue('property');
          if (property instanceof FmtDisplay.MetaRefExpression_neg && property.items.length > 1) {
            let args = this.getRenderedTemplateArguments([definition]);
            let extraContents = this.renderTemplate('EquivalenceDefinition', {
              'left': this.renderDisplayExpression(display, args, 1),
              'right': this.renderDisplayExpression(display, args, 1, 1)
            });
            if (!extraContents.styleClasses) {
              extraContents.styleClasses = [];
            }
            extraContents.styleClasses.push('display-math');
            paragraphs.push(extraContents);
          }
        }
      }
    }

    if ((definition.contents instanceof FmtHLM.ObjectContents_Construction
         || definition.contents instanceof FmtHLM.ObjectContents_SetOperator)
        && definition.contents.definitionDisplay) {
      let path = new Fmt.Path;
      path.name = definition.name;
      path.arguments = this.utils.getParameterArguments(definition.parameters);
      let term = new Fmt.DefinitionRefExpression;
      term.path = path;
      let type = new FmtHLM.MetaRefExpression_Element;
      type._set = term;
      let parameter = new Fmt.Parameter;
      parameter.name = definition.contents.definitionDisplay.parameter.name;
      parameter.type = new Fmt.Type;
      parameter.type.expression = type;
      let row: Display.RenderedExpression[] = [];
      row.push(new Display.TextExpression('We write “'));
      let initialState: ParameterListState = {
        fullSentence: false,
        sentence: true,
        abbreviate: false,
        forcePlural: false,
        enableSpecializations: true,
        started: false,
        inLetExpr: false,
        inConstraint: false,
        inDefinition: false,
        inDefinitionDisplayGroup: false
      };
      row.push(this.renderParameters([parameter], initialState));
      row.push(new Display.TextExpression('” for “'));
      initialState.enableSpecializations = false;
      row.push(this.renderParameters([parameter], initialState));
      row.push(new Display.TextExpression('.”'));
      paragraphs.push(new Display.RowExpression(row));
    }

    if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
      for (let constructorDefinition of definition.innerDefinitions) {
        if (constructorDefinition.contents instanceof FmtHLM.ObjectContents_Constructor
            && constructorDefinition.contents.definitionDisplay) {
          let parentPath = new Fmt.Path;
          parentPath.name = definition.name;
          parentPath.arguments = this.utils.getParameterArguments(definition.parameters);
          let path = new Fmt.Path;
          path.name = constructorDefinition.name;
          path.arguments = this.utils.getParameterArguments(constructorDefinition.parameters);
          path.parentPath = parentPath;
          let term = new Fmt.DefinitionRefExpression;
          term.path = path;
          let type = new FmtHLM.MetaRefExpression_Def;
          type.element = term;
          let parameter = new Fmt.Parameter;
          parameter.name = constructorDefinition.contents.definitionDisplay.parameter.name;
          parameter.type = new Fmt.Type;
          parameter.type.expression = type;
          let row: Display.RenderedExpression[] = [];
          row.push(new Display.TextExpression('We write “'));
          let initialState: ParameterListState = {
            fullSentence: false,
            sentence: true,
            abbreviate: true,
            forcePlural: false,
            enableSpecializations: true,
            started: false,
            inLetExpr: false,
            inConstraint: false,
            inDefinition: false,
            inDefinitionDisplayGroup: false
          };
          row.push(this.renderParameters([parameter], initialState));
          row.push(new Display.TextExpression('” for “'));
          initialState.enableSpecializations = false;
          row.push(this.renderParameters([parameter], initialState));
          row.push(new Display.TextExpression('.”'));
          paragraphs.push(new Display.RowExpression(row));
        }
      }
    }
  }

  private addSubsetEmbeddings(paragraphs: Display.RenderedExpression[]): void {
    let definition = this.definition;
    let hasSubsetEmbedding = false;
    for (let param of definition.parameters) {
      let type = param.type.expression;
      if ((type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) && type.embedSubsets) {
        hasSubsetEmbedding = true;
        break;
      }
    }
    if (hasSubsetEmbedding) {
      let row: Display.RenderedExpression[] = [];
      row.push(new Display.TextExpression('For '));
      let replacementParams = Object.create(Fmt.ParameterList.prototype);
      let hadParameters = false;
      for (let param of definition.parameters) {
        let type = param.type.expression;
        if ((type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) && type.embedSubsets) {
          let replacementParam = param.clone();
          replacementParam.name += '\'';
          replacementParams.push(replacementParam);
          if (hadParameters) {
            row.push(new Display.TextExpression(' and '));
          } else {
            hadParameters = true;
          }
          row.push(this.renderTemplate('SubsetParameter', {
                                        'subset': this.renderVariable(replacementParam, undefined, true),
                                        'superset': this.renderVariable(param)
                                      }));
        } else {
          replacementParams.push(param);
        }
      }
      row.push(new Display.TextExpression(', we canonically treat elements of '));
      let replacementParameters: ReplacementParameters = {
        parameters: replacementParams,
        isDefinition: false
      };
      row.push(this.renderDefinitionRef([definition], undefined, false, 0, replacementParameters));
      row.push(new Display.TextExpression(' as element of '));
      row.push(this.renderDefinitionRef([definition]));
      row.push(new Display.TextExpression('.'));
      paragraphs.push(new Display.RowExpression(row));
    }
  }

  private buildCaseRow(value: Display.RenderedExpression, formula: Display.RenderedExpression): Display.RenderedExpression[] {
    let wrappedValue = new Display.InnerParenExpression(value);
    wrappedValue.left = false;
    wrappedValue.maxLevel = -10;
    let text = new Display.TextExpression('if ');
    let formulaWithText = new Display.RowExpression([text, formula]);
    return [wrappedValue, formulaWithText];
  }

  private addProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    this.addProofsInternal(proofs, heading, externalGoal, undefined, undefined, paragraphs);
  }

  private addProofsInternal(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, startRow: Display.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Display.RenderedExpression[]): void {
    if (this.includeProofs) {
      if (proofs && proofs.length) {
        let proofNumber = 1;
        for (let proof of proofs) {
          let row: Display.RenderedExpression[] | undefined = startRow || [];
          let spacing = startRowSpacing;
          let hasContents = false;
          if (heading) {
            let labelText = proofs.length > 1 ? `${heading} ${proofNumber}` : heading;
            row.push(this.renderSubHeading(labelText));
            spacing = '  ';
          }
          if (proof.parameters && proof.parameters.length) {
            if (spacing) {
              row.push(new Display.TextExpression(spacing));
            }
            row.push(this.renderParameterList(proof.parameters, true, false, false));
            spacing = ' ';
            hasContents = true;
          }
          if (proof.goal) {
            let skipGoal = false;
            if (proof.steps.length) {
              let firstStepType = proof.steps[0].type.expression;
              if (firstStepType instanceof FmtHLM.MetaRefExpression_ProveForAll && proof.goal instanceof FmtHLM.MetaRefExpression_forall) {
                skipGoal = true;
              }
            }
            if (!skipGoal) {
              if (spacing) {
                row.push(new Display.TextExpression(spacing));
              }
              if (hasContents) {
                row.push(new Display.TextExpression('Then '));
              } else {
                row.push(new Display.TextExpression('We show that '));
              }
              row.push(this.renderFormula(proof.goal));
              row.push(new Display.TextExpression(':'));
              spacing = ' ';
              hasContents = true;
            }
          }
          if (proof.steps.length) {
            if (hasContents) {
              paragraphs.push(new Display.RowExpression(row));
              row = undefined;
              spacing = undefined;
            }
            let goal = proof.goal || externalGoal;
            this.addProofSteps(proof, goal, undefined, row, spacing, paragraphs);
          } else {
            if (spacing) {
              row.push(new Display.TextExpression(spacing));
            }
            let trivial = new Display.TextExpression('Trivial.');
            trivial.styleClasses = ['proof-placeholder'];
            row.push(trivial);
            paragraphs.push(new Display.RowExpression(row));
          }
          proofNumber++;
          startRow = undefined;
          startRowSpacing = undefined;
        }
      } else {
        this.addNoProofPlaceholder(heading, startRow, startRowSpacing, paragraphs);
      }
    }
  }

  private addNoProofPlaceholder(heading: string | undefined, startRow: Display.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Display.RenderedExpression[]): void {
    let row = startRow || [];
    let spacing = startRowSpacing;
    let noProof = new Display.TextExpression('No proof.');
    noProof.styleClasses = ['proof-placeholder'];
    if (heading && heading !== 'Proof') {
      row.push(this.renderSubHeading(heading));
      spacing = '  ';
    }
    if (spacing) {
      row.push(new Display.TextExpression(spacing));
    }
    row.push(noProof);
    paragraphs.push(new Display.RowExpression(row));
  }

  private addProof(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    let proofs = proof ? [proof] : undefined;
    this.addProofs(proofs, heading, externalGoal, paragraphs);
  }

  private addSubProof(proof: FmtHLM.ObjectContents_Proof | undefined, externalGoal: Fmt.Expression | undefined, startRow: Display.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Display.RenderedExpression[]): void {
    let proofs = proof ? [proof] : undefined;
    this.addProofsInternal(proofs, undefined, externalGoal, startRow, startRowSpacing, paragraphs);
  }

  private addIndentedProof(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, paragraphs: Display.RenderedExpression[]): void {
    this.addIndentedProofInternal(proof, heading, undefined, paragraphs);
  }

  private addIndentedSubProof(proof: FmtHLM.ObjectContents_Proof | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    this.addIndentedProofInternal(proof, undefined, externalGoal, paragraphs);
  }

  private addIndentedProofInternal(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    if (this.includeProofs) {
      let subParagraphs: Display.RenderedExpression[] = [];
      let proofs = proof ? [proof] : undefined;
      this.addProofsInternal(proofs, heading, externalGoal, undefined, undefined, subParagraphs);
      let subProof = new Display.ParagraphExpression(subParagraphs);
      subProof.styleClasses = ['indented'];
      paragraphs.push(subProof);
    }
  }

  private addProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], labels: string[] | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    if (this.includeProofs) {
      let items = proofs.map((proof) => {
        let subParagraphs: Display.RenderedExpression[] = [];
        this.addProof(proof, undefined, externalGoal, subParagraphs);
        return new Display.ParagraphExpression(subParagraphs);
      });
      let list = new Display.ListExpression(items, labels ? labels.map((label) => `${label}.`) : '1.');
      paragraphs.push(list);
    }
  }

  private addEquivalenceProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, symbol: string, paragraphs: Display.RenderedExpression[]): void {
    if (this.includeProofs) {
      if (proofs && proofs.length) {
        if (heading) {
          paragraphs.push(this.renderSubHeading(heading));
        }
        let labels: string[] = [];
        for (let proof of proofs) {
          let label = '?';
          if (proof._from !== undefined && proof._to !== undefined) {
            label = `${proof._from}${symbol}${proof._to}`;
          }
          labels.push(label);
        }
        this.addProofList(proofs, labels, undefined, paragraphs);
      } else {
        this.addNoProofPlaceholder(heading, undefined, undefined, paragraphs);
      }
    }
  }

  private addSubProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], labels: string[] | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    this.addProofList(proofs, labels, externalGoal, paragraphs);
  }

  private addProofSteps(proof: FmtHLM.ObjectContents_Proof, goal: Fmt.Expression | undefined, replacementParameters: Fmt.ParameterList | undefined, startRow: Display.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Display.RenderedExpression[]): void {
    let currentResult: Fmt.Expression | undefined = undefined;
    let parameters = replacementParameters || proof.parameters;
    if (parameters && parameters.length) {
      let lastParamType = parameters[parameters.length - 1].type.expression;
      if (lastParamType instanceof FmtHLM.MetaRefExpression_Constraint) {
        currentResult = lastParamType.formula;
      }
    }
    for (let step of proof.steps) {
      if (proof.parameters && replacementParameters) {
        // TODO this breaks the connection between the source code and the rendered version
        step = step.substituteExpression((expression: Fmt.Expression) => this.utils.substituteParameters(expression, proof.parameters!, replacementParameters));
      }
      currentResult = this.addProofStep(step, goal, currentResult, startRow, startRowSpacing, paragraphs);
      startRow = undefined;
    }
    if (startRow && startRow.length) {
      paragraphs.push(new Display.RowExpression(startRow));
    }
  }

  private addProofStep(step: Fmt.Parameter, goal: Fmt.Expression | undefined, previousResult: Fmt.Expression | undefined, startRow: Display.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Display.RenderedExpression[]): Fmt.Expression | undefined {
    try {
      let type = step.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_State) {
        if (!startRow) {
          startRow = [];
        }
        if (startRowSpacing) {
          startRow.push(new Display.TextExpression(startRowSpacing));
        }
        startRow.push(new Display.TextExpression('We have '));
        startRow.push(this.renderFormula(type.statement));
        // TODO only omit proof if trivial
        if (type.proof) {
          startRow.push(new Display.TextExpression(':'));
          paragraphs.push(new Display.RowExpression(startRow));
          this.addIndentedSubProof(type.proof, type.statement, paragraphs);
        } else {
          startRow.push(new Display.TextExpression('.'));
          paragraphs.push(new Display.RowExpression(startRow));
        }
        return type.statement;
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveDef
                 || type instanceof FmtHLM.MetaRefExpression_ProveForAll) {
        this.addSubProof(type.proof, goal, startRow, startRowSpacing, paragraphs);
        return undefined;
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveNeg) {
        let externalGoal = new FmtHLM.MetaRefExpression_or;
        this.addSubProof(type.proof, externalGoal, startRow, startRowSpacing, paragraphs);
        return undefined;
      } else if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
        if (type.proof.parameters && (previousResult instanceof FmtHLM.MetaRefExpression_exists || previousResult instanceof FmtHLM.MetaRefExpression_existsUnique)) {
          let replacementParameters = Object.create(Fmt.ParameterList.prototype);
          replacementParameters.push(...previousResult.parameters);
          if (previousResult.formula) {
            let constraint = new FmtHLM.MetaRefExpression_Constraint;
            constraint.formula = previousResult.formula;
            let constraintType = new Fmt.Type;
            constraintType.expression = constraint;
            constraintType.arrayDimensions = 0;
            let constraintParam = new Fmt.Parameter;
            constraintParam.name = '_';
            constraintParam.type = constraintType;
            constraintParam.optional = false;
            constraintParam.list = false;
            replacementParameters.push(constraintParam);
          }
          this.addProofSteps(type.proof, goal, replacementParameters, startRow, startRowSpacing, paragraphs);
        } else {
          paragraphs.push(new Display.ErrorExpression('Previous result is not existentially quantified'));
        }
        return undefined;
      }
      if (startRow) {
        paragraphs.push(new Display.RowExpression(startRow));
      }
      if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
        paragraphs.push(this.renderParameterList([step], true, false, false));
      } else if (type instanceof FmtHLM.MetaRefExpression_Consider
                 || type instanceof FmtHLM.MetaRefExpression_Embed) {
        let result = this.utils.getProofStepResult(step);
        paragraphs.push(this.renderFormula(result));
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
                 || type instanceof FmtHLM.MetaRefExpression_ResolveDef
                 || type instanceof FmtHLM.MetaRefExpression_UseForAll
                 || type instanceof FmtHLM.MetaRefExpression_Embed
                 || type instanceof FmtHLM.MetaRefExpression_SetExtend
                 || type instanceof FmtHLM.MetaRefExpression_Extend
                 || type instanceof FmtHLM.MetaRefExpression_UseTheorem
                 || type instanceof FmtHLM.MetaRefExpression_Substitute) {
        let result = this.utils.getProofStepResult(step, previousResult);
        let dependsOnPrevious = !!previousResult;
        let source = undefined;
        let sourceType = type;
        if (sourceType instanceof FmtHLM.MetaRefExpression_Substitute) {
          if (sourceType.source.type.expression instanceof FmtHLM.MetaRefExpression_UseTheorem) {
            sourceType = sourceType.source.type.expression;
          } else {
            source = this.renderFormula(this.utils.getProofStepResult(sourceType.source));
            if (!source.styleClasses) {
              source.styleClasses = [];
            }
            source.styleClasses.push('miniature');
            this.setSemanticLink(source, sourceType.source);
          }
        }
        if (sourceType instanceof FmtHLM.MetaRefExpression_UseDef
            || sourceType instanceof FmtHLM.MetaRefExpression_ResolveDef) {
          source = new Display.TextExpression('def');
          // TODO link to definition
        } else if (sourceType instanceof FmtHLM.MetaRefExpression_UseTheorem) {
          if (sourceType.theorem instanceof Fmt.DefinitionRefExpression) {
            let itemNumberPromise = this.utils.getItemInfo(sourceType.theorem).then((itemInfo: LibraryItemInfo) => new Display.TextExpression(this.formatItemNumber(itemInfo.itemNumber)));
            source = new Display.PromiseExpression(itemNumberPromise);
            source.styleClasses = ['miniature'];
            this.setSemanticLink(source, sourceType.theorem);
          }
          // TODO unset dependsOnPrevious if theorem does not depend on previous
        }
        let resultToDisplay: Display.RenderedExpression;
        if (result instanceof FmtHLM.MetaRefExpression_or && !result.formulae) {
          resultToDisplay = new Display.TextExpression('⚡');
        } else {
          resultToDisplay = this.renderFormula(result);
        }
        let renderedStep = this.renderTemplate(dependsOnPrevious ? 'DependentProofStep' : 'SourceProofStep', {
                                                 'result': resultToDisplay,
                                                 'source': source
                                               });
        paragraphs.push(renderedStep);
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_UseCases
                 || type instanceof FmtHLM.MetaRefExpression_ProveCases) {
        this.addSubProofList(type.caseProofs, undefined, goal, paragraphs);
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveExists) {
        if (goal instanceof FmtHLM.MetaRefExpression_exists || goal instanceof FmtHLM.MetaRefExpression_existsUnique) {
          let argumentList = this.renderArgumentDefinitionList(goal.parameters, type.arguments);
          let row = [
            new Display.TextExpression('Choose '),
            argumentList,
            new Display.TextExpression('.')
          ];
          if (type.proof) {
            this.addSubProof(type.proof, undefined, row, ' ', paragraphs);
          } else {
            // TODO only omit proof if trivial
            paragraphs.push(new Display.RowExpression(row));
          }
        } else {
          paragraphs.push(new Display.ErrorExpression('Goal is not existentially quantified'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveSetEquals) {
        // TODO omit proofs if missing but trivial
        let subProofs = [type.subsetProof, type.supersetProof];
        let labels = ['⊆', '⊇'];
        // TODO set external goals
        this.addSubProofList(subProofs, labels, undefined, paragraphs);
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveByInduction) {
        let subProofs: FmtHLM.ObjectContents_Proof[] = [];
        for (let structuralCase of type.cases) {
          let subProof = new FmtHLM.ObjectContents_Proof;
          subProof.fromCompoundExpression(structuralCase.value as Fmt.CompoundExpression);
          subProofs.push(subProof);
        }
        this.addSubProofList(subProofs, undefined, undefined, paragraphs);
      } else {
        paragraphs.push(new Display.ErrorExpression('Unknown proof step type'));
      }
    } catch (e) {
      paragraphs.push(new Display.ErrorExpression(e.message));
    }
    return undefined;
  }

  getDefinitionParts(): Map<Object, Logic.RenderFn> {
    let result = new Map<Object, Logic.RenderFn>();
    this.addDefinitionParts([this.definition], result);
    return result;
  }

  private addDefinitionParts(definitions: Fmt.Definition[], result: Map<Object, Logic.RenderFn>): void {
    let definition = definitions[definitions.length - 1];
    if (!(definition.contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      this.addParameterListParts(definition.parameters, result);
      for (let innerDefinition of definition.innerDefinitions) {
        this.addDefinitionParts(definitions.concat(innerDefinition), result);
      }
      if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
        if (definition.contents.display) {
          result.set(definition.contents.display, () => this.renderDefinitionRef(definitions));
        }
        if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
          if (definition.contents.embedding) {
            let embedding = definition.contents.embedding;
            result.set(embedding.parameter, () => this.renderParameter(embedding.parameter, false));
            result.set(embedding.target, () => {
              let target = this.utils.getEmbeddingTargetTerm(definition, embedding.target);
              return this.renderElementTerm(target);
            });
            if (embedding.wellDefinednessProof) {
              this.addProofParts(embedding.wellDefinednessProof, result);
            }
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_Constructor) {
          if (definition.contents.equalityDefinition) {
            let equalityDefinition = definition.contents.equalityDefinition;
            this.addParameterListParts(equalityDefinition.leftParameters, result);
            this.addParameterListParts(equalityDefinition.rightParameters, result);
            if (equalityDefinition.definition instanceof Fmt.ArrayExpression) {
              for (let item of equalityDefinition.definition.items) {
                this.addFormulaParts(item, result);
              }
            }
            if (equalityDefinition.equivalenceProofs) {
              this.addProofListParts(equalityDefinition.equivalenceProofs, result);
            }
            if (equalityDefinition.reflexivityProof) {
              this.addProofParts(equalityDefinition.reflexivityProof, result);
            }
            if (equalityDefinition.symmetryProof) {
              this.addProofParts(equalityDefinition.symmetryProof, result);
            }
            if (equalityDefinition.transitivityProof) {
              this.addProofParts(equalityDefinition.transitivityProof, result);
            }
          }
          if (definition.contents.rewrite) {
            let rewrite = definition.contents.rewrite;
            this.addElementTermParts(rewrite.value, result);
            if (rewrite.theorem) {
              this.addGenericExpressionParts(rewrite.theorem, result);
            }
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator && definition.contents.definition instanceof Fmt.ArrayExpression) {
          for (let item of definition.contents.definition.items) {
            this.addSetTermParts(item, result);
          }
          if (definition.contents.equalityProofs) {
            this.addProofListParts(definition.contents.equalityProofs, result);
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator && definition.contents.definition instanceof Fmt.ArrayExpression) {
          for (let item of definition.contents.definition.items) {
            this.addElementTermParts(item, result);
          }
          if (definition.contents.equalityProofs) {
            this.addProofListParts(definition.contents.equalityProofs, result);
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator && definition.contents.definition instanceof Fmt.ArrayExpression) {
          this.addParameterParts(definition.contents.parameter, result);
          for (let item of definition.contents.definition.items) {
            this.addFormulaParts(item, result);
          }
          if (definition.contents.wellDefinednessProof) {
            this.addProofParts(definition.contents.wellDefinednessProof, result);
          }
          if (definition.contents.equivalenceProofs) {
            this.addProofListParts(definition.contents.equivalenceProofs, result);
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_Predicate && definition.contents.definition instanceof Fmt.ArrayExpression) {
          for (let item of definition.contents.definition.items) {
            this.addFormulaParts(item, result);
          }
          if (definition.contents.equivalenceProofs) {
            this.addProofListParts(definition.contents.equivalenceProofs, result);
          }
        }
      } else {
        if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
          this.addFormulaParts(definition.contents.claim, result);
          if (definition.contents.proofs) {
            this.addProofListParts(definition.contents.proofs, result);
          }
        } else if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem && definition.contents.conditions instanceof Fmt.ArrayExpression) {
          for (let item of definition.contents.conditions.items) {
            this.addFormulaParts(item, result);
          }
          if (definition.contents.equivalenceProofs) {
            this.addProofListParts(definition.contents.equivalenceProofs, result);
          }
        }
      }
    }
  }

  private addSetTermParts(term: Fmt.Expression, result: Map<Object, Logic.RenderFn>): void {
    result.set(term, () => this.renderSetTerm(term));
    this.addGenericExpressionParts(term, result);
  }

  private addElementTermParts(term: Fmt.Expression, result: Map<Object, Logic.RenderFn>): void {
    result.set(term, () => this.renderElementTerm(term));
    this.addGenericExpressionParts(term, result);
  }

  private addFormulaParts(formula: Fmt.Expression, result: Map<Object, Logic.RenderFn>): void {
    result.set(formula, () => this.renderFormula(formula));
    this.addGenericExpressionParts(formula, result);
  }

  private addGenericExpressionParts(expression: Fmt.Expression, result: Map<Object, Logic.RenderFn>): void {
    if (expression instanceof Fmt.DefinitionRefExpression) {
      this.addPathParts(expression.path, result);
    }
    // TODO call addGenericExpressionParts recursively for all sub-expressions
  }

  private addPathParts(path: Fmt.Path, result: Map<Object, Logic.RenderFn>): void {
    this.addArgumentListParts(path.arguments, result);
    if (path.parentPath instanceof Fmt.Path) {
      this.addPathParts(path.parentPath, result);
    }
  }

  private addParameterListParts(parameters: Fmt.Parameter[], result: Map<Object, Logic.RenderFn>): void {
    let initialState: ParameterListState = {
      fullSentence: true,
      sentence: true,
      abbreviate: false,
      forcePlural: false,
      enableSpecializations: true,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionDisplayGroup: false
    };
    let currentGroup: Fmt.Parameter[] = [];
    for (let param of parameters) {
      if (currentGroup.length && !this.combineParameter(param, currentGroup[0])) {
        let group = currentGroup;
        result.set(group[0], () => this.renderParameters(group, initialState));
        currentGroup = [];
      }
      currentGroup.push(param);
    }
    if (currentGroup.length) {
      let group = currentGroup;
      result.set(group[0], () => this.renderParameters(group, initialState));
    }
  }

  private addParameterParts(parameter: Fmt.Parameter, result: Map<Object, Logic.RenderFn>): void {
    result.set(parameter, () => this.renderParameter(parameter, false));
  }

  private addArgumentListParts(args: Fmt.ArgumentList, result: Map<Object, Logic.RenderFn>): void {
    for (let arg of args) {
      if (arg.value instanceof Fmt.CompoundExpression) {
        let index = 0;
        for (let item of arg.value.arguments) {
          if (item.name === 'proof' || (item.name && item.name.endsWith('Proof'))) {
            let value = item.value as Fmt.CompoundExpression;
            let proof = new FmtHLM.ObjectContents_Proof;
            proof.fromCompoundExpression(value);
            this.addProofParts(proof, result);
          } else if (item.name === 'arguments') {
            let value = item.value as Fmt.CompoundExpression;
            this.addArgumentListParts(value.arguments, result);
          } else if (!index) {
            this.addGenericExpressionParts(item.value, result);
          }
          index++;
        }
      }
    }
  }

  private addProofListParts(proofs: FmtHLM.ObjectContents_Proof[], result: Map<Object, Logic.RenderFn>): void {
    if (this.includeProofs) {
      for (let proof of proofs) {
        this.addProofParts(proof, result);
      }
    }
  }

  private addProofParts(proof: FmtHLM.ObjectContents_Proof, result: Map<Object, Logic.RenderFn>): void {
    if (this.includeProofs) {
      if (proof.parameters) {
        this.addParameterListParts(proof.parameters, result);
      }
      if (proof.goal) {
        let goal = proof.goal;
        result.set(goal, () => this.renderFormula(goal));
      }
      for (let step of proof.steps) {
        this.addProofStepParts(step, result);
      }
    }
  }

  private addProofStepParts(step: Fmt.Parameter, result: Map<Object, Logic.RenderFn>): void {
    let type = step.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
      this.addParameterListParts([step], result);
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      this.addFormulaParts(type.statement, result);
      if (type.proof) {
        this.addProofParts(type.proof, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
               || type instanceof FmtHLM.MetaRefExpression_ResolveDef) {
      this.addFormulaParts(type.result, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseCases
               || type instanceof FmtHLM.MetaRefExpression_ProveCases) {
      this.addProofListParts(type.caseProofs, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
      this.addArgumentListParts(type.arguments, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseExists
               || type instanceof FmtHLM.MetaRefExpression_ProveDef
               || type instanceof FmtHLM.MetaRefExpression_ProveNeg
               || type instanceof FmtHLM.MetaRefExpression_ProveForAll) {
      this.addProofParts(type.proof, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_Embed) {
      this.addGenericExpressionParts(type.construction, result);
      this.addElementTermParts(type.input, result);
      this.addElementTermParts(type.output, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_SetExtend) {
      this.addSetTermParts(type.term, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_Extend) {
      this.addElementTermParts(type.term, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseTheorem) {
      this.addGenericExpressionParts(type.theorem, result);
      this.addFormulaParts(type.result, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveExists) {
      this.addArgumentListParts(type.arguments, result);
      if (type.proof) {
        this.addProofParts(type.proof, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveSetEquals) {
      if (type.subsetProof) {
        this.addProofParts(type.subsetProof, result);
      }
      if (type.supersetProof) {
        this.addProofParts(type.supersetProof, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Substitute) {
      this.addProofStepParts(type.source, result);
      this.addFormulaParts(type.result, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveByInduction) {
      this.addElementTermParts(type.term, result);
      this.addGenericExpressionParts(type.construction, result);
      for (let structuralCase of type.cases) {
        this.addGenericExpressionParts(structuralCase._constructor, result);
        let proof = new FmtHLM.ObjectContents_Proof;
        proof.fromCompoundExpression(structuralCase.value as Fmt.CompoundExpression);
        this.addProofParts(proof, result);
      }
    }
  }

  private addRenderedVariables(parameters: Fmt.ParameterList, variables: RenderedVariable[], indices?: Display.RenderedExpression[]): void {
    for (let param of parameters) {
      let paramType = param.type.expression;
      let renderedVariable: Display.RenderedExpression;
      let auto = false;
      if (paramType instanceof FmtHLM.MetaRefExpression_Set
          || paramType instanceof FmtHLM.MetaRefExpression_Subset
          || paramType instanceof FmtHLM.MetaRefExpression_Element
          || paramType instanceof FmtHLM.MetaRefExpression_Symbol) {
        renderedVariable = this.renderVariable(param, indices);
        auto = paramType.auto instanceof FmtHLM.MetaRefExpression_true;
      } else if (paramType instanceof FmtHLM.MetaRefExpression_Binding) {
        renderedVariable = this.renderVariable(param);
      } else {
        continue;
      }
      variables.push({
        param: param,
        display: renderedVariable,
        required: !auto
      });
      if (paramType instanceof FmtHLM.MetaRefExpression_Binding) {
        let newIndices: Display.RenderedExpression[] = indices ? indices.slice() : [];
        newIndices.push(renderedVariable);
        this.addRenderedVariables(paramType.parameters, variables, newIndices);
      }
    }
  }
}
