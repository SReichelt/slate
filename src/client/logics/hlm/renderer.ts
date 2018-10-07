import * as Fmt from '../../../shared/format/format';
import * as FmtHLM from '../../../shared/logics/hlm/meta';
import * as FmtDisplay from '../../../shared/display/meta';
import * as Logic from '../logic';
import * as Generic from '../generic';
import * as Display from '../../../shared/display/display';
import { HLMUtils } from '../../../shared/logics/hlm/utils';
import { LibraryDataAccessor, LibraryItemInfo } from '../../../shared/data/libraryDataAccessor';
import CachedPromise from '../../../shared/data/cachedPromise';

interface ParameterListState {
  sentence: boolean;
  abbreviate: boolean;
  inQuantifier: boolean;
  forcePlural: boolean;
  enableSpecializations: boolean;
  started: boolean;
  inLetExpr: boolean;
  inConstraint: boolean;
  inDefinitionDisplayGroup: boolean;
}

interface ReplacementParameters {
  parameters: Fmt.ParameterList;
  indices?: Display.RenderedExpression[];
  isDefinition: boolean;
}

export class HLMRenderer extends Generic.GenericRenderer implements Logic.LogicRenderer {
  private utils: HLMUtils;

  constructor(libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File) {
    super(libraryDataAccessor, templates);
    this.utils = new HLMUtils(libraryDataAccessor);
  }

  renderDefinition(definition: Fmt.Definition, itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeProofs: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined {
    let row: Display.RenderedExpression[] = [];
    if (includeLabel && itemInfo !== undefined) {
      row.push(this.renderDefinitionLabel(definition, itemInfo));
    }
    if (!(definition.contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      let hasParameters = false;
      if (definition.parameters.length) {
        hasParameters = true;
        if (row.length) {
          row.push(new Display.TextExpression('  '));
        }
        row.push(this.renderParameterList(definition.parameters, false, false, false));
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
          row.push(this.renderParameter(definition.contents.parameter));
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
    this.addDefinitionContents(definition, paragraphs, includeExtras, includeProofs);
    if (includeRemarks) {
      this.addDefinitionRemarks(definition, paragraphs);
    }
    if (paragraphs.length) {
      return new Display.ParagraphExpression(paragraphs);
    } else {
      return undefined;
    }
  }

  renderDefinitionSummary(definition: Fmt.Definition): Display.RenderedExpression | undefined {
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
          let parameters = this.renderParameterList(definition.parameters, true, false, false);
          let addendum = new Display.RowExpression([new Display.TextExpression('   if '), parameters]);
          addendum.styleClasses = ['addendum'];
          return new Display.RowExpression([claim, addendum]);
        } else {
          return claim;
        }
      }
    } else {
      return this.renderDefinitionRef([definition], undefined, true);
    }
    return undefined;
  }

  renderDefinitionLabel(definition: Fmt.Definition, itemInfo: CachedPromise<LibraryItemInfo>): Display.RenderedExpression {
    let formattedInfoPromise = itemInfo.then((info: LibraryItemInfo) => {
      let text: string;
      if (info.type) {
        text = info.type.charAt(0).toUpperCase() + info.type.slice(1);
      } else {
        text = definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem || definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem ? 'Proposition' : 'Definition';
      }
      text += ' ';
      text += this.formatItemNumber(info.itemNumber);
      if (info.title instanceof Fmt.CompoundExpression) {
        let englishTitle = info.title.arguments.getOptionalValue('en');
        if (englishTitle instanceof Fmt.StringExpression) {
          let title = new Display.TextExpression(' (' + englishTitle.value + ')');
          title.styleClasses = ['title'];
          return new Display.RowExpression([new Display.TextExpression(text), title, new Display.TextExpression('.')]);
        }
      }
      text += '.';
      return new Display.TextExpression(text);
    });
    let result = new Display.PromiseExpression(formattedInfoPromise);
    result.styleClasses = ['label'];
    return result;
  }

  renderParameterList(parameters: Fmt.Parameter[], abbreviate: boolean, inQuantifier: boolean, forcePlural: boolean): Display.RenderedExpression {
    let initialState: ParameterListState = {
      sentence: !abbreviate,
      abbreviate: abbreviate,
      inQuantifier: inQuantifier,
      forcePlural: forcePlural,
      enableSpecializations: true,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinitionDisplayGroup: false
    };
    return this.renderParameters(parameters, initialState);
  }

  renderParameter(parameter: Fmt.Parameter): Display.RenderedExpression {
    let initialState: ParameterListState = {
      sentence: false,
      abbreviate: true,
      inQuantifier: false,
      forcePlural: false,
      enableSpecializations: false,
      started: false,
      inLetExpr: false,
      inConstraint: false,
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
          let path = this.utils.getOuterDefinitionPath(expression);
          return this.libraryDataAccessor.fetchItem(path)
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
      if (currentGroup.length
          && !((param.type.expression instanceof FmtHLM.MetaRefExpression_Set && currentGroup[0].type.expression instanceof FmtHLM.MetaRefExpression_Set)
               || (param.type.expression instanceof FmtHLM.MetaRefExpression_Subset && param.type.expression.superset instanceof FmtHLM.MetaRefExpression_previous)
               || (param.type.expression instanceof FmtHLM.MetaRefExpression_Element && param.type.expression._set instanceof FmtHLM.MetaRefExpression_previous)
               || (param.type.expression instanceof FmtHLM.MetaRefExpression_Symbol && currentGroup[0].type.expression instanceof FmtHLM.MetaRefExpression_Symbol))) {
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
    if (state.started && state.sentence && !indices) {
      row.push(new Display.TextExpression('.'));
      state.started = false;
      state.inLetExpr = false;
      state.inConstraint = false;
    }
    return new Display.RowExpression(row);
  }

  private renderParameterGroup(parameters: Fmt.Parameter[], definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined, state: ParameterListState, indices?: Display.RenderedExpression[]): Display.RenderedExpression {
    let type = parameters[0].type.expression;
    let row: Display.RenderedExpression[] = [];

    if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      state.inLetExpr = false;
      state.inConstraint = false;

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
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      if (state.abbreviate && !state.inQuantifier) {
        if (state.started) {
          row.push(new Display.TextExpression(', '));
        }
      } else {
        if (state.started) {
          if (state.inConstraint) {
            row.push(new Display.TextExpression(' and '));
          } else {
            row.push(new Display.TextExpression(state.abbreviate ? ' s.t. ' : ' such that '));
          }
        } else if (!state.abbreviate) {
          row.push(new Display.TextExpression(state.sentence ? 'Assume ' : 'assume '));
        }
        state.inConstraint = true;
      }

      row.push(this.renderFormula(type.formula));
    } else {
      if (state.abbreviate) {
        if (state.started) {
          row.push(new Display.TextExpression(', '));
        }
      } else {
        if (state.started) {
          row.push(new Display.TextExpression(', '));
          if (!state.inLetExpr) {
            row.push(new Display.TextExpression('let '));
          }
        } else {
          row.push(new Display.TextExpression(state.sentence ? 'Let ' : 'let '));
        }
        state.inLetExpr = true;
      }
      state.inConstraint = false;

      let variableDefinitions = this.renderVariableDefinitions(parameters, indices);
      let variableDisplay: Display.RenderedExpression | undefined;
      let singular: Display.RenderedExpression | undefined = undefined;
      let plural: Display.RenderedExpression | undefined = undefined;
      let combineWithNext = false;
      if (definition && state.enableSpecializations) {
        let definitionRef = this.getDisplayDefinitionRef(type);
        if (definitionRef instanceof Fmt.DefinitionRefExpression) {
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
                if (definitionDisplay.singularName) {
                  singular = this.renderDisplayExpression(definitionDisplay.singularName, args);
                  this.setSemanticLink(singular, definitionRef);
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
                if (definitionDisplay.pluralName) {
                  plural = this.renderDisplayExpression(definitionDisplay.pluralName, args);
                  this.setSemanticLink(plural, definitionRef);
                }
              }
            }
          }
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
        singular = new Display.TextExpression('set');
        plural = new Display.TextExpression('sets');
      } else if (type instanceof FmtHLM.MetaRefExpression_Symbol) {
        singular = new Display.TextExpression('symbol');
        plural = new Display.TextExpression('symbols');
      }
      if (singular && plural) {
        let properties = this.extractProperties(parameters, remainingParameters, remainingDefinitions);
        if (properties && properties.length) {
          let singularRow = [singular];
          let pluralRow = [plural];
          for (let property of properties) {
            singularRow.unshift(new Display.TextExpression(' '));
            singularRow.unshift(property);
            pluralRow.unshift(new Display.TextExpression(' '));
            pluralRow.unshift(property);
          }
          singular = new Display.RowExpression(singularRow);
          plural = new Display.RowExpression(pluralRow);
        }
        if (!variableDisplay) {
          variableDisplay = variableDefinitions;
        }
        if (state.inQuantifier) {
          row.push(parameters.length === 1 && !state.forcePlural && !combineWithNext ? singular : plural);
          row.push(new Display.TextExpression(' '));
          row.push(variableDisplay);
        } else {
          row.push(variableDisplay);
          if (combineWithNext) {
            state.inDefinitionDisplayGroup = true;
          } else {
            if (parameters.length === 1 && !state.inDefinitionDisplayGroup) {
              let singularStart = singular;
              while (singularStart instanceof Display.RowExpression && singularStart.items.length) {
                singularStart = singularStart.items[0];
              }
              let article = 'a';
              if (singularStart instanceof Display.TextExpression && singularStart.text.length) {
                let firstChar = singularStart.text.charAt(0);
                if (firstChar === 'a' || firstChar === 'e' || firstChar === 'i' || firstChar === 'o' || firstChar === 'u') {
                  // We currently do not consider any special cases such as a silent 'h'. That seems complicated.
                  // Other languages are even worse.
                  article = 'an';
                }
              }
              if (state.abbreviate) {
                row.push(new Display.TextExpression(` is ${article} `));
                row.push(singular);
              } else {
                row.push(new Display.TextExpression(` be ${article} `));
                row.push(singular);
              }
            } else {
              if (state.abbreviate) {
                row.push(new Display.TextExpression(' are '));
                row.push(plural);
              } else {
                row.push(new Display.TextExpression(' be '));
                row.push(plural);
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
      } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
        row.push(this.renderTemplate('VariableDefinition', {
                                       'left': variableDefinitions,
                                       'right': this.renderElementTerm(type.element)
                                     }));
      } else {
        row.push(new Display.ErrorExpression('Unknown parameter type'));
      }
    }

    state.started = true;

    return new Display.RowExpression(row);
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

  private extractProperties(parameters: Fmt.Parameter[], remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined): Display.RenderedExpression[] | undefined {
    let result: Display.RenderedExpression[] | undefined = undefined;
    if (remainingParameters && remainingDefinitions) {
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
        let property: string | undefined = undefined;
        let definitionRef: Fmt.DefinitionRefExpression | undefined = undefined;
        for (let index = 0; index < parameters.length; index++) {
          let currentProperty = this.getProperty(parameters[index], remainingParameters[index], remainingDefinitions[index]);
          if (currentProperty) {
            if (property) {
              if (currentProperty.property !== property) {
                property = undefined;
                break;
              }
            } else {
              property = currentProperty.property;
              definitionRef = currentProperty.definitionRef;
            }
          } else {
            property = undefined;
            break;
          }
        }
        if (property) {
          if (!result) {
            result = [];
          }
          let propertyExpression = new Display.TextExpression(property);
          propertyExpression.semanticLink = new Display.SemanticLink(definitionRef, false, false);
          result.push(propertyExpression);
          remainingParameters.splice(0, parameters.length);
          remainingDefinitions.splice(0, parameters.length);
        } else {
          break;
        }
      }
    }
    return result;
  }

  private getProperty(param: Fmt.Parameter, constraintParam: Fmt.Parameter, definition: Fmt.Definition | undefined): {property: string, definitionRef: Fmt.DefinitionRefExpression} | undefined {
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
          if (display.path.name === 'Property') {
            if (!display.path.arguments.getOptionalValue('article')) {
              let operand = display.path.arguments.getValue('operand');
              if (operand instanceof Fmt.VariableRefExpression) {
                let operandArg = constraint.path.arguments.getValue(operand.variable.name);
                if (operandArg instanceof Fmt.CompoundExpression && operandArg.arguments.length) {
                  let operandArgValue = operandArg.arguments[0].value;
                  if (operandArgValue instanceof Fmt.VariableRefExpression && operandArgValue.variable === param) {
                    let property = display.path.arguments.getValue('property');
                    if (property instanceof FmtDisplay.MetaRefExpression_neg) {
                      if (negationCount < property.items.length) {
                        property = property.items[negationCount];
                        negationCount = 0;
                      }
                    }
                    if (property instanceof Fmt.StringExpression && !negationCount) {
                      return {property: property.value, definitionRef: constraint};
                    }
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

  renderVariableDefinitions(parameters: Fmt.Parameter[], indices?: Display.RenderedExpression[]): Display.RenderedExpression {
    let items = parameters.map((param) => this.renderVariable(param, indices, true));
    return this.renderTemplate('Group', {'items': items});
  }

  renderVariable(param: Fmt.Parameter, indices?: Display.RenderedExpression[], isDefinition: boolean = false): Display.RenderedExpression {
    let result = super.renderVariable(param, indices, isDefinition);
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Element && type.shortcut && (isDefinition || type.shortcut._override instanceof FmtHLM.MetaRefExpression_true)) {
      result = this.renderShortcut(type.shortcut, result, indices, isDefinition);
    }
    return result;
  }

  renderShortcut(shortcut: FmtHLM.ObjectContents_Shortcut, element: Display.RenderedExpression, indices?: Display.RenderedExpression[], isDefinition: boolean = false): Display.RenderedExpression {
    let replacementParameters: ReplacementParameters = {
      parameters: shortcut.parameters,
      indices: indices,
      isDefinition: isDefinition
    };
    let shortcutDisplay = this.renderGenericExpression(shortcut._constructor, 0, replacementParameters);
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
                                   'element': this.renderParameter(term.parameter),
                                   'constraint': this.renderFormula(term.formula)
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      return this.renderTemplate('SetBuilder', {
                                   'element': this.renderElementTerm(term.term),
                                   'constraint': this.renderParameterList(term.parameters, true, false, false)
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
    while (formula instanceof FmtHLM.MetaRefExpression_not) {
      negationCount++;
      formula = formula.formula;
    }
    let result = this.setSemanticLink(this.renderFormulaInternal(formula, negationCount), formula);
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
                                   'parameters': this.renderParameterList(formula.parameters, true, true, true),
                                   'formula': this.renderFormula(formula.formula)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_exists) {
      if (formula.formula) {
        return this.renderTemplate('ExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, true, true, false),
                                     'formula': this.renderFormula(formula.formula)
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('PlainExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, true, true, false)
                                   },
                                   negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_existsUnique) {
      if (formula.formula) {
        return this.renderTemplate('UniqueExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, true, true, false),
                                     'formula': this.renderFormula(formula.formula)
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('PlainUniqueExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, true, true, false)
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
      return this.renderGenericExpression(formula, negationCount);
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
        let parameters = this.renderParameterList(caseExpr.parameters, true, false, false);
        row.push(new Display.ParenExpression(parameters, '()'));
      }
      return row;
    });
    return this.renderTemplate('Cases', {
      'cases': rows,
    });
  }

  private renderGenericExpression(expression: Fmt.Expression, negationCount: number = 0, replacementParameters?: ReplacementParameters): Display.RenderedExpression {
    if (expression instanceof Fmt.VariableRefExpression) {
      let indices = expression.indices ? expression.indices.map((term) => this.renderElementTerm(term)) : undefined;
      return this.renderVariable(expression.variable, indices);
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      let childPaths: Fmt.Path[] = [];
      this.utils.splitPath(expression.path, childPaths);
      let definitionPromise = this.libraryDataAccessor.fetchItem(childPaths[0]);
      let expressionPromise = definitionPromise.then((definition) => {
        let definitions: Fmt.Definition[] = [];
        let argumentLists: Fmt.ArgumentList[] = [];
        this.utils.analyzeDefinitionRefPath(childPaths, definition, definitions, argumentLists);
        return this.renderDefinitionRef(definitions, argumentLists, false, negationCount, replacementParameters);
      });
      return new Display.PromiseExpression(expressionPromise);
    } else {
      return new Display.ErrorExpression('Unknown expression type');
    }
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
    return result;
  }

  private renderDefaultDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: boolean = false, negationCount: number = 0, replacementParameters?: ReplacementParameters): Display.RenderedExpression {
    let definition = definitions[definitions.length - 1];
    let result: Display.RenderedExpression = new Display.TextExpression(definition.name);
    if (definition.contents instanceof FmtHLM.ObjectContents_Constructor) {
      result.styleClasses = ['constructor'];
    }
    if (definitions.length > 1) {
      let subSupExpression = new Display.SubSupExpression(result);
      subSupExpression.sub = this.renderDefinitionRef(definitions.slice(0, -1), argumentLists ? argumentLists.slice(0, -1) : undefined);
      result = subSupExpression;
    }
    let args: Display.RenderedExpression[] = [];
    let curArgumentLists = replacementParameters ? undefined : argumentLists;
    this.fillArguments(definition.parameters, replacementParameters, curArgumentLists, undefined, true, undefined, args);
    if (args.length && !omitArguments) {
      result = this.renderTemplate('Function', {
                                     'function': result,
                                     'arguments': args
                                   });
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
            || display.path.name === 'UnaryOperator'
            || display.path.name === 'Relation'
            || display.path.name === 'BooleanOperator'
            || display.path.name === 'UnaryBooleanOperator'
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
        }
        if (abbr instanceof Fmt.StringExpression || abbr instanceof Fmt.ArrayExpression || abbr instanceof Fmt.MetaRefExpression) {
          display = abbr;
        }
      }
      let args = this.getRenderedTemplateArguments(definitions, argumentLists, replacementParameters);
      return this.renderDisplayExpression(display, args, negationCount);
    } else {
      return undefined;
    }
  }

  private getRenderedTemplateArguments(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], replacementParameters?: ReplacementParameters): Display.RenderedTemplateArguments {
    let args: Display.RenderedTemplateArguments = {};
    let index = 0;
    for (let curDefinition of definitions) {
      let curParams: Fmt.Parameter[] = [];
      let curArgs: Display.RenderedExpression[] = [];
      let curReplacementParameters = index === definitions.length - 1 ? replacementParameters : undefined;
      let curArgumentLists = argumentLists && !curReplacementParameters ? argumentLists.slice(0, index + 1) : undefined;
      this.fillArguments(curDefinition.parameters, curReplacementParameters, curArgumentLists, undefined, false, curParams, curArgs);
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
    this.fillArguments(parameters, undefined, argumentList ? [argumentList] : undefined, indices, true, undefined, args);
    if (args.length === 1) {
      return args[0];
    } else {
      return new Display.ParenExpression(this.renderTemplate('Group', {'items': args}), '()');
    }
  }

  private fillArguments(parameters: Fmt.ParameterList, replacementParameters: ReplacementParameters | undefined, argumentLists: Fmt.ArgumentList[] | undefined, indices: Display.RenderedExpression[] | undefined, combineBindings: boolean, resultParams: Fmt.Parameter[] | undefined, resultArgs: Display.RenderedExpression[]): void {
    if (replacementParameters) {
      indices = replacementParameters.indices;
    }
    let index = 0;
    for (let param of parameters) {
      let replacementParam = replacementParameters ? replacementParameters.parameters[index] : undefined;
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
          newIndices.push(this.renderVariable(parameter));
        }
        if (resultParams) {
          resultParams.push(param);
        }
        if (parameter && (bindingArgumentList || !argumentLists)) {
          if (combineBindings) {
            resultArgs.push(this.renderTemplate('Binding', {
                                                  'variable': this.renderVariableDefinitions([parameter]),
                                                  'value': this.renderArgumentList(type.parameters, bindingArgumentList, newIndices)
                                                }));
          } else {
            resultArgs.push(this.renderVariableDefinitions([parameter]));
            let replacementBindingParameters: ReplacementParameters | undefined = undefined;
            if (replacementParam) {
              let replacementParamType = replacementParam.type.expression as FmtHLM.MetaRefExpression_Binding;
              replacementBindingParameters = {
                parameters: replacementParamType.parameters,
                indices: newIndices,
                isDefinition: replacementParameters!.isDefinition
              };
            }
            this.fillArguments(type.parameters, replacementBindingParameters, bindingArgumentList ? [bindingArgumentList] : undefined, newIndices, combineBindings, resultParams, resultArgs);
          }
        } else {
          resultArgs.push(new Display.ErrorExpression('Undefined argument'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set
                 || type instanceof FmtHLM.MetaRefExpression_Subset
                 || type instanceof FmtHLM.MetaRefExpression_Element
                 || type instanceof FmtHLM.MetaRefExpression_Symbol
                 || type instanceof FmtHLM.MetaRefExpression_Nat) {
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
          } else {
            resultArgs.push(new Display.ErrorExpression('Unhandled parameter type'));
          }
        } else {
          resultArgs.push(this.renderVariable(paramToDisplay, indices, replacementParameters && replacementParameters.isDefinition));
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

  private addDefinitionContents(definition: Fmt.Definition, paragraphs: Display.RenderedExpression[], includeExtras: boolean, includeProofs: boolean): void {
    let contents = this.renderDefinitionContents(definition);
    if (contents) {
      if (!contents.styleClasses) {
        contents.styleClasses = [];
      }
      contents.styleClasses.push('display-math');
      paragraphs.push(contents);
    }
    if (includeExtras) {
      this.addExtraDefinitionContents(definition, paragraphs);
    }
  }

  renderDefinitionContents(definition: Fmt.Definition): Display.RenderedExpression | undefined {
    if (definition.contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      return undefined;
    } else if (definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      return this.renderFormula(definition.contents.claim);
    } else if (definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      let conditions = definition.contents.conditions as Fmt.ArrayExpression;
      let items = conditions.items.map((formula) => this.renderFormula(formula));
      return new Display.ListExpression(items, '1.');
    } else {
      let definitionRef = this.renderDefinitionRef([definition]);
      definitionRef.semanticLink = new Display.SemanticLink(definition, false, true);
      if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
        let hasParameters = false;
        let rows = definition.innerDefinitions.map((innerDefinition) => {
          let constructorDef = this.renderDefinitionRef([definition, innerDefinition]);
          constructorDef.semanticLink = new Display.SemanticLink(innerDefinition, false, true);
          let row = [constructorDef];
          if (innerDefinition.parameters.length) {
            hasParameters = true;
            row.push(this.renderParameterList(innerDefinition.parameters, true, false, false));
          }
          return row;
        });
        if (hasParameters) {
          for (let row of rows) {
            if (row.length < 2) {
              row.push(new Display.EmptyExpression);
            }
          }
        }
        let construction = this.renderTemplate('Construction', {
          'constructors': rows,
        });
        return this.renderTemplate('ConstructionDefinition', {
          'left': definitionRef,
          'right': construction
        });
      } else if (definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
        let definitions = definition.contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((term) => this.renderSetTerm(term));
        return this.renderMultiDefinitions('Equality', definitionRef, items);
      } else if (definition.contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
        let definitions = definition.contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((term) => this.renderElementTerm(term));
        return this.renderMultiDefinitionsWithSpecializations('Equality', definitionRef, items, definitions.items);
      } else if (definition.contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
        let contents = definition.contents;
        let equality = this.renderTemplate('EqualityRelation', {
          'left': definitionRef,
          'right': this.renderVariable(contents.parameter)
        });
        equality.semanticLink = new Display.SemanticLink(definition);
        let definitions = contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((formula) => this.renderFormula(formula));
        return this.renderMultiDefinitions('Equivalence', equality, items);
      } else if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
        let definitions = definition.contents.definition as Fmt.ArrayExpression;
        let items = definitions.items.map((formula) => this.renderFormula(formula));
        return this.renderMultiDefinitions('Equivalence', definitionRef, items);
      } else {
        return new Display.EmptyExpression;
      }
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
      return {left: leftItem, right: rightItem};
    });
    let result = new Display.AlignedExpression(rows);
    result.styleClasses = ['baseline'];
    return result;
  }

  private renderMultiDefinitionsWithSpecializations(type: string, left: Display.RenderedExpression, right: Display.RenderedExpression[], rightExpressions: Fmt.Expression[]): Display.RenderedExpression {
    if (right.length === 1 && rightExpressions.length === 1) {
      let expression = rightExpressions[0];
      if (expression instanceof Fmt.DefinitionRefExpression) {
        let definitionRef = expression;
        let path = this.utils.getOuterDefinitionPath(definitionRef);
        let promise = this.libraryDataAccessor.fetchItem(path)
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

  private addExtraDefinitionContents(definition: Fmt.Definition, paragraphs: Display.RenderedExpression[]): void {
    if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
      for (let innerDefinition of definition.innerDefinitions) {
        let constructorContents = innerDefinition.contents;
        if (constructorContents instanceof FmtHLM.ObjectContents_Constructor && innerDefinition.parameters.length) {
          let equalityDefinition = constructorContents.equalityDefinition;
          if (equalityDefinition) {
            // Unfortunately, normal concatenation doesn't seem to work with our derived arrays.
            let combinedParameters = [];
            for (let param of equalityDefinition.leftParameters) {
              combinedParameters.push(param);
            }
            for (let param of equalityDefinition.rightParameters) {
              combinedParameters.push(param);
            }
            let parameters = this.renderParameterList(combinedParameters, true, true, true);
            let leftParameters: ReplacementParameters = {
              parameters: equalityDefinition.leftParameters,
              isDefinition: false
            };
            let rightParameters: ReplacementParameters = {
              parameters: equalityDefinition.rightParameters,
              isDefinition: false
            };
            let equality = this.renderTemplate('EqualityRelation', {
              'left': this.renderDefinitionRef([definition, innerDefinition], undefined, false, 0, leftParameters),
              'right': this.renderDefinitionRef([definition, innerDefinition], undefined, false, 0, rightParameters)
            });
            let definitions = equalityDefinition.definition as Fmt.ArrayExpression;
            let items = definitions.items.map((formula) => this.renderFormula(formula));
            let equivalenceDef = this.renderMultiDefinitions('Equivalence', equality, items);
            let quantification = this.renderTemplate('UniversalQuantification', {
              'parameters': parameters,
              'formula': equivalenceDef
            });
            paragraphs.push(quantification);
          }
        }
      }
      let embedding = definition.contents.embedding;
      if (embedding) {
        let source = embedding.parameter.type.expression as FmtHLM.MetaRefExpression_Element;
        let rows: Display.RenderedExpressionPair[] = [];
        let subset = this.renderSetTerm(source._set);
        let superset = this.renderTemplate('EmbeddingDefinition', {
          'subset': new Display.EmptyExpression,
          'superset': new Display.RowExpression([this.renderDefinitionRef([definition]), new Display.TextExpression(' via')])
        });
        rows.push({left: subset, right: superset});
        let subsetElement = this.renderVariableDefinitions([embedding.parameter]);
        let target = this.utils.getEmbeddingTargetTerm(definition, embedding.target);
        let supersetElement = this.renderTemplate('EqualityRelation', {
          'left': new Display.EmptyExpression,
          'right': this.renderElementTerm(target)
        });
        rows.push({left: subsetElement, right: supersetElement});
        paragraphs.push(new Display.AlignedExpression(rows));
      }
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
        sentence: false,
        abbreviate: false,
        inQuantifier: false,
        forcePlural: false,
        enableSpecializations: true,
        started: false,
        inLetExpr: false,
        inConstraint: false,
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
            sentence: false,
            abbreviate: true,
            inQuantifier: false,
            forcePlural: false,
            enableSpecializations: true,
            started: false,
            inLetExpr: false,
            inConstraint: false,
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

  private addDefinitionRemarks(definition: Fmt.Definition, paragraphs: Display.RenderedExpression[]): void {
    if (definition.documentation) {
      for (let item of definition.documentation.items) {
        if (item.kind === 'remarks' || item.kind === 'references') {
          let heading = new Display.TextExpression(item.kind.charAt(0).toUpperCase() + item.kind.slice(1) + '.');
          heading.styleClasses = ['sub-heading'];
          paragraphs.push(heading);
          paragraphs.push(new Display.MarkdownExpression(item.text));
        }
      }
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
}
