import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtDisplay from '../../display/meta';
import * as Logic from '../logic';
import { GenericRenderer, RenderedVariable } from '../generic/renderer';
import * as Display from '../../display/display';
import { HLMTermType } from './hlm';
import { HLMEditHandler, ParameterSelection, SetTermSelection, fullSetTermSelection, ElementTermSelection, fullElementTermSelection, FormulaSelection, fullFormulaSelection } from './editHandler';
import { PlaceholderExpression, GenericEditHandler } from '../generic/editHandler';
import { HLMUtils, DefinitionVariableRefExpression } from './utils';
import { HLMRenderUtils, ExtractedStructuralCase, PropertyInfo, ElementParameterOverrides } from './renderUtils';
import { LibraryDataAccessor, LibraryItemInfo, formatItemNumber } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

interface ReplacementParameters {
  parameters?: Fmt.ParameterList;
  indices?: Display.RenderedExpression[];
  isDefinition: boolean;
}

interface ParameterOverrides {
  replacementParameters?: ReplacementParameters;
  elementParameterOverrides?: ElementParameterOverrides;
}

interface ParameterListState {
  fullSentence: boolean;
  sentence: boolean;
  abbreviate: boolean;
  forcePlural: boolean;
  enableSpecializations: boolean;
  markAsDummy: boolean;
  elementParameterOverrides?: ElementParameterOverrides;
  started: boolean;
  inLetExpr: boolean;
  inConstraint: boolean;
  inDefinition: boolean;
  inDefinitionDisplayGroup: boolean;
  associatedParameterList?: Fmt.Parameter[];
  associatedDefinition?: Fmt.Definition;
}

export class HLMRenderer extends GenericRenderer implements Logic.LogicRenderer {
  protected utils: HLMUtils;
  protected renderUtils: HLMRenderUtils;
  protected readOnlyRenderer: HLMRenderer;

  constructor(definition: Fmt.Definition, includeProofs: boolean, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File, protected editHandler?: HLMEditHandler) {
    super(definition, includeProofs, libraryDataAccessor, templates, editHandler);
    this.utils = new HLMUtils(definition, libraryDataAccessor);
    this.renderUtils = new HLMRenderUtils(definition, this.utils);
    if (editHandler) {
      this.readOnlyRenderer = Object.create(this);
      this.readOnlyRenderer.editHandler = undefined;
    } else {
      this.readOnlyRenderer = this;
    }
  }

  renderDefinition(itemInfo: CachedPromise<LibraryItemInfo> | undefined, includeLabel: boolean, includeExtras: boolean, includeRemarks: boolean): Display.RenderedExpression | undefined {
    let space: string | undefined = undefined;
    let row: Display.RenderedExpression[] = [];
    if (includeLabel && itemInfo !== undefined) {
      row.push(this.renderDefinitionLabel(itemInfo));
      space = '  ';
    }
    let definition = this.definition;
    let contents = definition.contents;
    let cases: ExtractedStructuralCase[] | undefined = undefined;
    let hasCases = false;
    if (!(contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      let hasParameters = false;
      if (definition.parameters.length || this.editHandler) {
        hasParameters = true;
        if (space) {
          row.push(new Display.TextExpression(space));
        }
        row.push(this.renderParameterList(definition.parameters, true, false, false, definition));
        space = ' ';
      }
      if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
        if (hasParameters) {
          if (space) {
            row.push(new Display.TextExpression(space));
          }
          row.push(new Display.TextExpression('Then:'));
        }
      } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
        if (space) {
          row.push(new Display.TextExpression(space));
        }
        row.push(new Display.TextExpression(hasParameters ? 'Then the following are equivalent:' : 'The following are equivalent:'));
      } else {
        if (contents instanceof FmtHLM.ObjectContents_SetOperator || contents instanceof FmtHLM.ObjectContents_ExplicitOperator || contents instanceof FmtHLM.ObjectContents_ImplicitOperator || contents instanceof FmtHLM.ObjectContents_Predicate) {
          cases = this.renderUtils.extractStructuralCases(contents.definition);
          hasCases = cases.length > 0 && cases[0].structuralCases !== undefined;
        }
        let colon = hasCases ? '' : ':';
        if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          if (space) {
            row.push(new Display.TextExpression(space));
          }
          row.push(new Display.TextExpression('For '));
          row.push(this.renderParameter(contents.parameter, false, false, false));
          row.push(new Display.TextExpression(', we define' + colon));
        } else {
          if (space) {
            row.push(new Display.TextExpression(space));
          }
          row.push(new Display.TextExpression('We define' + colon));
        }
      }
    }
    let paragraphs: Display.RenderedExpression[] = [];
    if (row.length) {
      paragraphs.push(row.length === 1 ? row[0] : new Display.RowExpression(row));
    }
    let definitionRef = this.renderDefinedSymbol([definition]);
    if (hasCases) {
      let definitionRow = new Display.RowExpression([definitionRef]);
      definitionRow.styleClasses = ['display-math'];
      paragraphs.push(definitionRow);
      paragraphs.push(new Display.TextExpression('by:'));
    }
    this.addDefinitionContents(paragraphs, definitionRef, cases, includeExtras);
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
    let contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_StandardTheorem || contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      let claim: Display.RenderedExpression | undefined = undefined;
      if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        claim = this.renderFormula(contents.claim, formulaSelection);
      } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
        let conditions = contents.conditions as Fmt.ArrayExpression;
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        let items = conditions.items.map((formula) => this.renderFormula(formula, formulaSelection));
        claim = this.renderTemplate('MultiEquivalenceRelation', {
                                      'operands': items
                                    });
      }
      if (claim) {
        if (definition.parameters.length) {
          let extractedConstraints: Fmt.Parameter[] = [];
          let reducedParameters = this.renderUtils.extractConstraints(definition.parameters, extractedConstraints);
          let parameters = this.readOnlyRenderer.renderParameterList(reducedParameters, false, false, false, definition);
          let addendum = new Display.RowExpression([new Display.TextExpression('if '), parameters]);
          addendum.styleClasses = ['addendum'];
          if (extractedConstraints.length) {
            let items = extractedConstraints.map((param: Fmt.Parameter) => this.renderParameter(param, false, false, false));
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
    } else if (!(contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
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
      text += formatItemNumber(info.itemNumber);
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

  renderParameterList(parameters: Fmt.Parameter[], sentence: boolean, abbreviate: boolean, forcePlural: boolean, associatedDefinition?: Fmt.Definition, elementParameterOverrides?: ElementParameterOverrides): Display.RenderedExpression {
    let initialState: ParameterListState = {
      fullSentence: sentence,
      sentence: sentence,
      abbreviate: abbreviate,
      forcePlural: forcePlural,
      enableSpecializations: true,
      markAsDummy: false,
      elementParameterOverrides: elementParameterOverrides,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionDisplayGroup: false,
      associatedParameterList: parameters,
      associatedDefinition: associatedDefinition
    };
    return this.renderParameters(parameters, initialState, undefined);
  }

  renderParameter(parameter: Fmt.Parameter, sentence: boolean, forcePlural: boolean, markAsDummy: boolean, elementParameterOverrides?: ElementParameterOverrides): Display.RenderedExpression {
    let initialState: ParameterListState = {
      fullSentence: sentence,
      sentence: sentence,
      abbreviate: true,
      forcePlural: forcePlural,
      enableSpecializations: true,
      markAsDummy: markAsDummy,
      elementParameterOverrides: elementParameterOverrides,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionDisplayGroup: false
    };
    return this.renderParameters([parameter], initialState);
  }

  renderParameters(parameters: Fmt.Parameter[], initialState: ParameterListState, indices?: Display.RenderedExpression[]): Display.RenderedExpression {
    let state: ParameterListState = {...initialState};
    let resolveDefinitions: CachedPromise<(Fmt.Definition | undefined)[]> = CachedPromise.resolve([]);
    resolveDefinitions = this.extractParameterDefinitions(parameters, resolveDefinitions);
    let render = resolveDefinitions.then((constraintDefinitions: (Fmt.Definition | undefined)[]) => this.renderParametersWithResolvedDefinitions(parameters, constraintDefinitions, state, indices));
    return new Display.PromiseExpression(render);
  }

  private extractParameterDefinitions(parameters: Fmt.Parameter[], resolveDefinitions: CachedPromise<(Fmt.Definition | undefined)[]>): CachedPromise<(Fmt.Definition | undefined)[]> {
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
      if (type instanceof FmtHLM.MetaRefExpression_Binding
          && type.parameters.length === 1
          && type.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Binding) {
        resolveDefinitions = this.extractParameterDefinitions(type.parameters, resolveDefinitions);
      }
    }
    return resolveDefinitions;
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
        this.addParameterGroup(currentGroup, currentGroupDefinition, remainingParameters, remainingDefinitions, state, indices, row);
        currentGroup.length = 0;
        currentGroupDefinition = undefined;
      } else {
        if (!currentGroup.length) {
          currentGroupDefinition = remainingDefinitions[0];
        }
        currentGroup.push(param);
        remainingParameters.shift();
        remainingDefinitions.shift();
      }
    }
    if (currentGroup.length) {
      this.addParameterGroup(currentGroup, currentGroupDefinition, remainingParameters, remainingDefinitions, state, indices, row);
    }
    if (this.editHandler && state.associatedParameterList) {
      if (row.length) {
        row.push(new Display.TextExpression(' '));
      } else if (state.started) {
        /* Occurs if bound parameter list is empty. */
        row.push(new Display.TextExpression(', '));
      }
      let insertButton = new Display.InsertPlaceholderExpression;
      if (state.associatedParameterList) {
        let semanticLink = new Display.SemanticLink(insertButton, false, false);
        let stateCopy: ParameterListState = {
          ...state,
          associatedParameterList: undefined,
          markAsDummy: true
        };
        if (stateCopy.started) {
          stateCopy.fullSentence = false;
          stateCopy.started = false;
        }
        let onRenderParam = (parameter: Fmt.Parameter) => this.renderParameters([parameter], stateCopy, indices);
        let onInsertParam = (parameter: Fmt.Parameter) => {
          state.associatedParameterList!.push(parameter);
          if (stateCopy.associatedDefinition) {
            let contents = stateCopy.associatedDefinition.contents;
            if (contents instanceof FmtHLM.ObjectContents_Definition) {
              contents.display = undefined;
              contents.definitionDisplay = undefined;
            }
          }
          GenericEditHandler.lastInsertedParameter = parameter;
        };
        let paramSelection: ParameterSelection = {
          allowConstraint: parameters.length !== 0 || state.fullSentence,
          allowProposition: state.associatedDefinition !== undefined && (state.associatedParameterList !== state.associatedDefinition.parameters || state.associatedDefinition.contents instanceof FmtHLM.ObjectContents_Constructor),
          allowDefinition: state.fullSentence,
          allowBinding: state.associatedDefinition !== undefined
        };
        this.editHandler.addParameterMenu(semanticLink, onRenderParam, onInsertParam, paramSelection);
        insertButton.semanticLinks = [semanticLink];
      }
      row.push(insertButton);
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
    return ((paramType instanceof FmtHLM.MetaRefExpression_Prop && firstParamType instanceof FmtHLM.MetaRefExpression_Prop)
            || (paramType instanceof FmtHLM.MetaRefExpression_Set && firstParamType instanceof FmtHLM.MetaRefExpression_Set)
            || (paramType instanceof FmtHLM.MetaRefExpression_Subset && firstParamType instanceof FmtHLM.MetaRefExpression_Subset && paramType.superset instanceof FmtHLM.MetaRefExpression_previous)
            || (paramType instanceof FmtHLM.MetaRefExpression_Element && firstParamType instanceof FmtHLM.MetaRefExpression_Element && paramType._set instanceof FmtHLM.MetaRefExpression_previous));
  }

  private addParameterGroup(parameters: Fmt.Parameter[], definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[], remainingDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices: Display.RenderedExpression[] | undefined, row: Display.RenderedExpression[]): void {
    let type = parameters[0].type.expression;

    if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      this.addBindingParameterGroup(parameters, type, definition, remainingDefinitions, state, indices, row);
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      this.addConstraint(type, state, row);
    } else {
      this.addRegularParameterGroup(parameters, type, definition, remainingParameters, remainingDefinitions, state, indices, row);
    }
  }

  private addBindingParameterGroup(parameters: Fmt.Parameter[], type: FmtHLM.MetaRefExpression_Binding, definition: Fmt.Definition | undefined, remainingDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices: Display.RenderedExpression[] | undefined, row: Display.RenderedExpression[]): void {
    state.inLetExpr = false;
    state.inConstraint = false;
    state.inDefinition = false;

    for (let param of parameters) {
      let forEachRow: Display.RenderedExpression[] = [new Display.TextExpression(state.abbreviate ? ' f.e. ' : ' for each ')];
      let forEachState: ParameterListState = {
        fullSentence: false,
        sentence: false,
        abbreviate: true,
        forcePlural: false,
        enableSpecializations: state.enableSpecializations,
        markAsDummy: false,
        started: false,
        inLetExpr: false,
        inConstraint: false,
        inDefinition: false,
        inDefinitionDisplayGroup: false,
        associatedDefinition: state.associatedDefinition
      };

      let variables: Fmt.Parameter[] = [param];
      let currentVariableGroup: Fmt.Parameter[] = [param];
      let currentVariableGroupType = type;
      let innerParameters = type.parameters;
      let currentDefinition = definition;
      while (innerParameters.length === 1) {
        let innerParameter = innerParameters[0];
        let innerBindingType: Fmt.Expression = innerParameter.type.expression;
        if (innerBindingType instanceof FmtHLM.MetaRefExpression_Binding) {
          if (innerBindingType._set instanceof FmtHLM.MetaRefExpression_previous) {
            remainingDefinitions.shift();
          } else {
            this.addRegularParameterGroup(currentVariableGroup, currentVariableGroupType, currentDefinition, undefined, undefined, forEachState, undefined, forEachRow);
            currentVariableGroup.length = 0;
            currentVariableGroupType = innerBindingType;
            forEachRow.push(new Display.TextExpression(' and '));
            forEachState.started = false;
            currentDefinition = remainingDefinitions.shift();
          }
          variables.push(innerParameter);
          currentVariableGroup.push(innerParameter);
          innerParameters = innerBindingType.parameters;
        } else {
          break;
        }
      }
      this.addRegularParameterGroup(currentVariableGroup, currentVariableGroupType, currentDefinition, undefined, undefined, forEachState, undefined, forEachRow);

      let innerState = {
        ...state,
        associatedParameterList: innerParameters
      };
      let innerIndices: Display.RenderedExpression[] = indices ? indices.slice() : [];
      for (let variable of variables) {
        innerIndices.push(this.renderVariable(variable));
      }
      row.push(this.renderParameters(innerParameters, innerState, innerIndices));

      row.push(...forEachRow);
    }

    state.started = true;
  }

  private addConstraint(type: FmtHLM.MetaRefExpression_Constraint, state: ParameterListState, row: Display.RenderedExpression[]): void {
    if (state.inLetExpr && !state.inDefinition) {
      let connective: string;
      if (state.inConstraint) {
        connective = 'and ';
      } else {
        connective = state.abbreviate ? 's.t. ' : 'such that ';
      }
      if (state.started) {
        connective = ' ' + connective;
      }
      row.push(new Display.TextExpression(connective));
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

    let formulaSelection: FormulaSelection = {
      allowTruthValue: false,
      allowEquiv: true,
      allowCases: true
    };
    let formula = this.renderFormula(type.formula, formulaSelection);
    if (state.sentence) {
      row.push(formula);
    } else {
      let formulaWithParens = new Display.InnerParenExpression(formula);
      formulaWithParens.maxLevel = -2;
      row.push(formulaWithParens);
    }

    state.started = true;
  }

  private addRegularParameterGroup(parameters: Fmt.Parameter[], type: Fmt.Expression, definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined, state: ParameterListState, indices: Display.RenderedExpression[] | undefined, row: Display.RenderedExpression[]): void {
    if (state.started) {
      row.push(new Display.TextExpression(', '));
    }
    if (state.sentence && !state.inLetExpr) {
      row.push(new Display.TextExpression(state.fullSentence && !state.started ? 'Let ' : 'let '));
    }
    state.inLetExpr = true;
    state.inConstraint = false;
    state.inDefinition = false;

    let variableDefinitions = this.renderVariableDefinitions(parameters, indices, state.markAsDummy, state.associatedParameterList, state.elementParameterOverrides);
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
              this.addSemanticLink(variableDisplay, definitionRef);
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
    } else if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      noun.singular = 'proposition';
      noun.plural = 'propositions';
    } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
      noun.singular = 'set';
      noun.plural = 'sets';
    }
    let properties = this.renderUtils.extractProperties(parameters, noun, remainingParameters, remainingDefinitions);
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
              this.addSemanticLink(renderedProperty, property.definitionRef);
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
              this.addSemanticLink(renderedProperty, property.definitionRef);
            }
            singular.push(renderedProperty);
            if (property.plural) {
              renderedProperty = new Display.TextExpression(property.plural);
              if (property.definitionRef) {
                this.addSemanticLink(renderedProperty, property.definitionRef);
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
      let termSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: true,
        allowCases: false
      };
      row.push(this.renderTemplate('SubsetParameter', {
                                      'subset': variableDefinitions,
                                      'superset': this.renderSetTerm(type.superset, termSelection)
                                    }));
    } else if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Binding) {
      let termSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: false,
        allowCases: false
      };
      row.push(this.renderTemplate('ElementParameter', {
                                      'element': variableDefinitions,
                                      'set': this.renderSetTerm(type._set, termSelection)
                                    }));
    } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      row.push(this.renderTemplate('VariableDefinition', {
                                      'left': variableDefinitions,
                                      'right': this.renderSetTerm(type._set, fullSetTermSelection)
                                    }));
      state.inDefinition = true;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      row.push(this.renderTemplate('VariableDefinition', {
                                      'left': variableDefinitions,
                                      'right': this.renderElementTerm(type.element, fullElementTermSelection)
                                    }));
      state.inDefinition = true;
    } else {
      row.push(new Display.ErrorExpression('Unknown parameter type'));
    }

    state.started = true;
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
    this.addSemanticLink(firstItem, definitionRef);
    if (firstItem instanceof Display.TextExpression) {
      return firstItem.text;
    } else {
      return undefined;
    }
  }

  private replaceName(name: string | undefined, definitionRef: Fmt.DefinitionRefExpression | undefined, alwaysApply: boolean, result: Display.RenderedExpression[]): void {
    if (name && (alwaysApply || !result.length)) {
      let newName = new Display.TextExpression(name);
      this.addSemanticLink(newName, definitionRef || newName);
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

  renderVariableDefinitions(parameters: Fmt.Parameter[], indices?: Display.RenderedExpression[], markAsDummy: boolean = false, parameterList?: Fmt.Parameter[], elementParameterOverrides?: ElementParameterOverrides): Display.RenderedExpression {
    let items = parameters.map((param) => this.renderVariable(param, indices, true, markAsDummy, parameterList, elementParameterOverrides));
    if (items.length === 1) {
      return items[0];
    } else {
      return this.renderTemplate('Group', {'items': items});
    }
  }

  renderVariable(param: Fmt.Parameter, indices?: Display.RenderedExpression[], isDefinition: boolean = false, isDummy: boolean = false, parameterList?: Fmt.Parameter[], elementParameterOverrides?: ElementParameterOverrides): Display.RenderedExpression {
    if (elementParameterOverrides) {
      let variableOverride = elementParameterOverrides.get(param);
      if (variableOverride) {
        let termPromise = variableOverride.then((term: Fmt.Expression) => this.readOnlyRenderer.renderElementTerm(term, fullElementTermSelection));
        return new Display.PromiseExpression(termPromise);
      }
    }
    return super.renderVariable(param, indices, isDefinition, isDummy, parameterList);
  }

  renderDefinedSymbol(definitions: Fmt.Definition[]): Display.RenderedExpression {
    let innerDefinition = definitions[definitions.length - 1];
    let contents = innerDefinition.contents as FmtHLM.ObjectContents_Definition;
    let definitionRef = this.renderDefinitionRef(definitions);
    let onSetDisplay = (display: Fmt.ArrayExpression | undefined) => (contents.display = display);
    let onGetDefault = () => this.renderDefaultDefinitionRef(definitions);
    let onGetVariables = () => {
      let variables: RenderedVariable[] = [];
      for (let definition of definitions) {
        this.addRenderedVariables(definition.parameters, variables);
      }
      return variables;
    };
    let isPredicate = contents instanceof FmtHLM.ObjectContents_Predicate;
    this.setDefinitionSemanticLink(definitionRef, innerDefinition, contents.display, onSetDisplay, onGetDefault, onGetVariables, isPredicate);
    return definitionRef;
  }

  renderSetTerm(term: Fmt.Expression, termSelection: SetTermSelection): Display.RenderedExpression {
    let result = this.renderSetTermInternal(term, false);
    let semanticLink = this.addSemanticLink(result, term);
    if (this.editHandler) {
      let onRenderTerm = (expression: Fmt.Expression) => this.renderSetTermInternal(expression, true);
      this.editHandler.addSetTermMenu(semanticLink, term, onRenderTerm, termSelection);
    }
    return result;
  }

  renderSetTermInternal(term: Fmt.Expression, markParametersAsDummy: boolean): Display.RenderedExpression {
    if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
      let termSelection: ElementTermSelection = {
        allowCases: false
      };
      let items = term.terms ? term.terms.map((item) => this.renderElementTerm(item, termSelection)) : [];
      if (this.editHandler) {
        let onInsertTerm = (expression: Fmt.Expression) => {
          if (term.terms) {
            term.terms.push(expression);
          } else {
            term.terms = [expression];
          }
        };
        let onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression);
        this.editHandler.addElementTermInsertButton(items, term, onInsertTerm, onRenderTerm, termSelection);
      }
      return this.renderTemplate('Enumeration', {
                                   'items': items
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
      let elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      let formula = this.renderUtils.convertStructuralCaseToOverride([term.parameter], term.formula, elementParameterOverrides);
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderTemplate('SetBuilder', {
                                   'element': this.renderParameter(term.parameter, false, true, markParametersAsDummy, elementParameterOverrides),
                                   'constraint': this.renderFormula(formula, formulaSelection)
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      let elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      let element = this.renderUtils.convertStructuralCaseToOverride(term.parameters, term.term, elementParameterOverrides);
      let termSelection: ElementTermSelection = {
        allowCases: false
      };
      return this.renderTemplate('SetBuilder', {
                                   'element': this.renderElementTerm(element, termSelection),
                                   'constraint': this.renderParameterList(term.parameters, false, false, false, undefined, elementParameterOverrides)
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      let renderCase = (value: Fmt.Expression | undefined) => {
        if (value) {
          return this.renderSetTerm(value, fullSetTermSelection);
        } else {
          return new Display.PlaceholderExpression(HLMTermType.SetTerm);
        }
      };
      return this.renderStructuralCases(term.term, term.construction, term.cases, renderCase);
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderElementTerm(term: Fmt.Expression, termSelection: ElementTermSelection): Display.RenderedExpression {
    let result = this.renderElementTermInternal(term);
    let semanticLink = this.addSemanticLink(result, term);
    if (this.editHandler) {
      let onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression);
      this.editHandler.addElementTermMenu(semanticLink, term, onRenderTerm, termSelection);
    }
    return result;
  }

  renderElementTermInternal(term: Fmt.Expression): Display.RenderedExpression {
    if (term instanceof FmtHLM.MetaRefExpression_cases) {
      let rows = term.cases.map((structuralCase) => {
        let value = this.renderElementTerm(structuralCase.value, fullElementTermSelection);
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: false
        };
        let formula = this.renderFormula(structuralCase.formula, formulaSelection);
        return this.buildCaseRow(value, formula);
      });
      return this.renderTemplate('Cases', {
        'cases': rows
      });
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      let renderCase = (value: Fmt.Expression | undefined) => {
        if (value) {
          return this.renderElementTerm(value, fullElementTermSelection);
        } else {
          return new Display.PlaceholderExpression(HLMTermType.ElementTerm);
        }
      };
      return this.renderStructuralCases(term.term, term.construction, term.cases, renderCase);
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderFormula(formula: Fmt.Expression, formulaSelection: FormulaSelection): Display.RenderedExpression {
    let [result, innerFormula] = this.renderFormulaInternal(formula);
    let semanticLink = this.addSemanticLink(result, formula);
    if (this.editHandler) {
      let onRenderFormula = (expression: Fmt.Expression) => this.renderFormulaInternal(expression)[0];
      this.editHandler.addFormulaMenu(semanticLink, formula, onRenderFormula, formulaSelection);
    }
    this.addSemanticLink(result, innerFormula);
    return result;
  }

  private renderFormulaInternal(formula: Fmt.Expression): [Display.RenderedExpression, Fmt.Expression] {
    let negationCount = 0;
    let innerFormula = formula;
    while (innerFormula instanceof FmtHLM.MetaRefExpression_not) {
      negationCount++;
      innerFormula = innerFormula.formula;
    }
    let result = this.renderFormulaWithNegationCount(innerFormula, negationCount);
    result.optionalParenStyle = '[]';
    return [result, innerFormula];
  }

  private renderFormulaWithNegationCount(formula: Fmt.Expression, negationCount: number): Display.RenderedExpression {
    if (formula instanceof FmtHLM.MetaRefExpression_and) {
      if (formula.formulae) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        return this.renderTemplate('Conjunction', {
                                     'operands': formula.formulae.map((item) => this.renderFormula(item, formulaSelection))
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('True', {}, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      if (formula.formulae) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        return this.renderTemplate('Disjunction', {
                                     'operands': formula.formulae.map((item) => this.renderFormula(item, formulaSelection))
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('False', {}, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderTemplate('EquivalenceRelation', {
                                   'left': this.renderFormula(formula.left, formulaSelection),
                                   'right': this.renderFormula(formula.right, formulaSelection)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: true,
        allowCases: true
      };
      return this.renderTemplate('UniversalQuantification', {
                                   'parameters': this.renderParameterList(formula.parameters, false, true, true),
                                   'formula': this.renderFormula(formula.formula, formulaSelection)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_exists) {
      if (formula.formula) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: false
        };
        return this.renderTemplate('ExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false),
                                     'formula': this.renderFormula(formula.formula, formulaSelection)
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
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: false
        };
        return this.renderTemplate('UniqueExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false),
                                     'formula': this.renderFormula(formula.formula, formulaSelection)
                                   },
                                   negationCount);
      } else {
        return this.renderTemplate('PlainUniqueExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false)
                                   },
                                   negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      let elementTermSelection: ElementTermSelection = {
        allowCases: false
      };
      let setTermSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: false,
        allowCases: true
      };
      return this.renderTemplate('ElementRelation', {
                                   'element': this.renderElementTerm(formula.element, elementTermSelection),
                                   'set': this.renderSetTerm(formula._set, setTermSelection)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_sub) {
      let subsetTermSelection: SetTermSelection = {
        allowEnumeration: false,
        allowSubset: false,
        allowCases: false
      };
      let supersetTermSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: true,
        allowCases: true
      };
      return this.renderTemplate('SubsetRelation', {
                                   'subset': this.renderSetTerm(formula.subset, subsetTermSelection),
                                   'superset': this.renderSetTerm(formula.superset, supersetTermSelection)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      return this.renderTemplate('EqualityRelation', {
                                   'left': this.renderSetTerm(formula.left, fullSetTermSelection),
                                   'right': this.renderSetTerm(formula.right, fullSetTermSelection)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
      return this.renderTemplate('EqualityRelation', {
                                   'left': this.renderElementTerm(formula.left, fullElementTermSelection),
                                   'right': this.renderElementTerm(formula.right, fullElementTermSelection)
                                 },
                                 negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      let renderCase = (value: Fmt.Expression | undefined) => {
        if (value) {
          return this.renderFormula(value, fullFormulaSelection);
        } else {
          return new Display.PlaceholderExpression(HLMTermType.Formula);
        }
      };
      return this.renderStructuralCases(formula.term, formula.construction, formula.cases, renderCase);
    } else {
      return this.renderGenericExpression(formula, false, negationCount);
    }
  }

  private renderStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], renderCase: (value: Fmt.Expression | undefined) => Display.RenderedExpression): Display.RenderedExpression {
    let termSelection: ElementTermSelection = {
      allowCases: false
    };
    let termDisplay = this.renderElementTerm(term, termSelection);
    let rows: Display.RenderedExpression[][];
    if (construction instanceof PlaceholderExpression) {
      let formula = this.renderTemplate('EqualityRelation', {
                                          'left': termDisplay,
                                          'right': new Display.TextExpression('…')
                                        });
      let row = this.buildCaseRow(renderCase(undefined), formula);
      let ellipsis = new Display.TextExpression('⋮');
      ellipsis.styleClasses = ['ellipsis'];
      let ellipsisRow = [ellipsis, ellipsis];
      rows = [row, ellipsisRow];
    } else {
      let constructionExpr = construction as Fmt.DefinitionRefExpression;
      let constructionPath = constructionExpr.path;
      rows = cases.map((structuralCase) => {
        let value = renderCase(structuralCase.value);
        let constructorPromise = this.utils.getStructuralCaseTerm(constructionPath, structuralCase);
        let constructorDisplayPromise = constructorPromise.then((constructorExpr: Fmt.Expression) => this.renderElementTerm(constructorExpr, termSelection));
        let constructorDisplay = new Display.PromiseExpression(constructorDisplayPromise);
        let formula = this.renderTemplate('EqualityRelation', {
                                            'left': termDisplay,
                                            'right': constructorDisplay
                                          });
        let row = this.buildCaseRow(value, formula);
        if (structuralCase.parameters) {
          this.addCaseParameters(structuralCase.parameters, undefined, row);
        }
        return row;
      });
    }
    return this.renderTemplate('Cases', {
      'cases': rows,
    });
  }

  private addCaseParameters(parameters: Fmt.Parameter[], elementParameterOverrides: ElementParameterOverrides | undefined, row: Display.RenderedExpression[]): void {
    if (parameters.length) {
      let extractedConstraints: Fmt.Parameter[] = [];
      let extractedParameters = this.renderUtils.extractConstraints(parameters, extractedConstraints);
      if (!extractedParameters.length) {
        extractedConstraints = [];
        extractedParameters = parameters;
      }
      let parameterList = this.readOnlyRenderer.renderParameterList(extractedParameters, false, false, false, undefined, elementParameterOverrides);
      if (extractedConstraints.length) {
        let caseRow = [parameterList, new Display.TextExpression(' with suitable conditions')];
        parameterList = new Display.RowExpression(caseRow);
      }
      let caseParameters = new Display.ParenExpression(parameterList, '()');
      caseParameters.styleClasses = ['case-parameters'];
      row.push(caseParameters);
    }
  }

  private renderGenericExpression(expression: Fmt.Expression, omitArguments: boolean = false, negationCount: number = 0, parameterOverrides?: ParameterOverrides): Display.RenderedExpression {
    if (expression instanceof Fmt.VariableRefExpression) {
      let termSelection: ElementTermSelection = {
        allowCases: false
      };
      let indices = expression.indices ? expression.indices.map((term) => this.renderElementTerm(term, termSelection)) : undefined;
      let isDefinition = expression instanceof DefinitionVariableRefExpression;
      let elementParameterOverrides = parameterOverrides ? parameterOverrides.elementParameterOverrides : undefined;
      return this.renderVariable(expression.variable, indices, isDefinition, false, undefined, elementParameterOverrides);
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      let childPaths: Fmt.Path[] = [];
      this.utils.splitPath(expression.path, childPaths);
      let definitionPromise = this.utils.getDefinition(childPaths[0]);
      let expressionPromise = definitionPromise.then((definition) => {
        let definitions: Fmt.Definition[] = [];
        let argumentLists: Fmt.ArgumentList[] = [];
        this.utils.analyzeDefinitionRefPath(childPaths, definition, definitions, argumentLists);
        return this.renderDefinitionRef(definitions, argumentLists, omitArguments, negationCount, parameterOverrides);
      });
      return new Display.PromiseExpression(expressionPromise);
    } else if (expression instanceof FmtHLM.MetaRefExpression_previous) {
      return new Display.TextExpression('…');
    } else if (expression instanceof PlaceholderExpression) {
      return new Display.PlaceholderExpression(expression.placeholderType);
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
    this.addSemanticLink(result, expression);
    return result;
  }

  private renderDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: boolean = false, negationCount: number = 0, parameterOverrides?: ParameterOverrides): Display.RenderedExpression {
    let result: Display.RenderedExpression | undefined = undefined;
    let definition = definitions[definitions.length - 1];
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
      result = this.renderDefinitionDisplayExpression(definition.contents.display, definitions, argumentLists, omitArguments, negationCount, parameterOverrides);
    }
    if (!result) {
      result = this.renderDefaultDefinitionRef(definitions, argumentLists, omitArguments, negationCount, parameterOverrides);
    }
    if (definitions[0] === this.definition) {
      this.addSemanticLink(result, definition);
    }
    return result;
  }

  private renderDefaultDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: boolean = false, negationCount: number = 0, parameterOverrides?: ParameterOverrides): Display.RenderedExpression {
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
      let curArgumentLists = parameterOverrides ? undefined : argumentLists;
      this.fillArguments(definition.parameters, parameterOverrides, curArgumentLists, undefined, true, false, undefined, args);
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

  private renderDefinitionDisplayExpression(displayExpression: Fmt.Expression | undefined, definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: boolean = false, negationCount: number = 0, parameterOverrides?: ParameterOverrides): Display.RenderedExpression | undefined {
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
      let args = this.getRenderedTemplateArguments(definitions, argumentLists, parameterOverrides, omitArguments);
      return this.renderDisplayExpression(display, args, negationCount);
    } else {
      return undefined;
    }
  }

  private getRenderedTemplateArguments(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], parameterOverrides?: ParameterOverrides, markAsDummy: boolean = false): Display.RenderedTemplateArguments {
    let args: Display.RenderedTemplateArguments = {};
    let index = 0;
    for (let curDefinition of definitions) {
      let curParams: Fmt.Parameter[] = [];
      let curArgs: Display.RenderedExpression[] = [];
      let curParameterOverrides = index === definitions.length - 1 ? parameterOverrides : undefined;
      let curReplacementParameters = curParameterOverrides ? curParameterOverrides.replacementParameters : undefined;
      let curArgumentLists = argumentLists && !curReplacementParameters ? argumentLists.slice(0, index + 1) : undefined;
      this.fillArguments(curDefinition.parameters, curParameterOverrides, curArgumentLists, undefined, false, markAsDummy, curParams, curArgs);
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

  private fillArguments(parameters: Fmt.ParameterList, parameterOverrides: ParameterOverrides | undefined, argumentLists: Fmt.ArgumentList[] | undefined, indices: Display.RenderedExpression[] | undefined, combineBindings: boolean, markAsDummy: boolean, resultParams: Fmt.Parameter[] | undefined, resultArgs: Display.RenderedExpression[]): void {
    let replacementParameters = parameterOverrides ? parameterOverrides.replacementParameters : undefined;
    if (replacementParameters) {
      indices = replacementParameters.indices;
    }
    let index = 0;
    for (let param of parameters) {
      let replacementParam = replacementParameters && replacementParameters.parameters ? replacementParameters.parameters[index] : undefined;
      this.fillArgument(param, replacementParam, parameterOverrides, argumentLists, indices, combineBindings, markAsDummy, resultParams, resultArgs);
      index++;
    }
  }

  private fillArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, parameterOverrides: ParameterOverrides | undefined, argumentLists: Fmt.ArgumentList[] | undefined, indices: Display.RenderedExpression[] | undefined, combineBindings: boolean, markAsDummy: boolean, resultParams: Fmt.Parameter[] | undefined, resultArgs: Display.RenderedExpression[]): void {
    let type = param.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      this.fillBindingArgument(param, replacementParam, type, parameterOverrides, argumentLists, indices, combineBindings, markAsDummy, resultParams, resultArgs);
    } else if (this.utils.isValueParamType(type)
               || type instanceof FmtHLM.MetaRefExpression_Nat
               || type instanceof FmtHLM.MetaRefExpression_DefinitionRef) {
      this.fillRegularArgument(param, replacementParam, type, parameterOverrides, argumentLists, indices, markAsDummy, resultParams, resultArgs);
    }
  }

  private fillBindingArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, type: FmtHLM.MetaRefExpression_Binding, parameterOverrides: ParameterOverrides | undefined, argumentLists: Fmt.ArgumentList[] | undefined, indices: Display.RenderedExpression[] | undefined, combineBindings: boolean, markAsDummy: boolean, resultParams: Fmt.Parameter[] | undefined, resultArgs: Display.RenderedExpression[]): void {
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
      parameter = replacementParam || param;
      newIndices = indices ? indices.slice() : [];
      newIndices.push(this.renderVariable(parameter, undefined, false, markAsDummy));
    }
    if (resultParams) {
      resultParams.push(param);
    }
    if (parameter && (bindingArgumentList || !argumentLists)) {
      let elementParameterOverrides: ElementParameterOverrides | undefined = parameterOverrides ? parameterOverrides.elementParameterOverrides : undefined;
      if (bindingArgumentList && !indices) {
        if (!elementParameterOverrides) {
          elementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
        }
        bindingArgumentList = this.renderUtils.convertBoundStructuralCasesToOverrides([parameter], bindingArgumentList, elementParameterOverrides);
      }
      let variableDefinition = this.renderVariableDefinitions([parameter], undefined, markAsDummy, undefined, elementParameterOverrides);
      if (combineBindings) {
        resultArgs.push(this.renderTemplate('Binding', {
                                              'variable': variableDefinition,
                                              'value': this.renderArgumentList(type.parameters, bindingArgumentList, newIndices)
                                            }));
      } else {
        resultArgs.push(variableDefinition);
        let bindingParameterOverrides: ParameterOverrides = {
          elementParameterOverrides: elementParameterOverrides
        };
        if (replacementParam) {
          let replacementParamType = replacementParam.type.expression as FmtHLM.MetaRefExpression_Binding;
          bindingParameterOverrides.replacementParameters = {
            parameters: replacementParamType.parameters,
            indices: newIndices,
            isDefinition: parameterOverrides!.replacementParameters!.isDefinition
          };
        }
        this.fillArguments(type.parameters, bindingParameterOverrides, bindingArgumentList ? [bindingArgumentList] : undefined, newIndices, combineBindings, markAsDummy, resultParams, resultArgs);
      }
    } else {
      resultArgs.push(new Display.ErrorExpression('Undefined argument'));
    }
  }

  private fillRegularArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, type: Fmt.Expression, parameterOverrides: ParameterOverrides | undefined, argumentLists: Fmt.ArgumentList[] | undefined, indices: Display.RenderedExpression[] | undefined, markAsDummy: boolean, resultParams: Fmt.Parameter[] | undefined, resultArgs: Display.RenderedExpression[]): void {
    if (resultParams) {
      resultParams.push(param);
    }
    let paramToDisplay = replacementParam || param;
    let elementParameterOverrides = parameterOverrides ? parameterOverrides.elementParameterOverrides : undefined;
    if (elementParameterOverrides) {
      let variableOverride = elementParameterOverrides.get(paramToDisplay);
      if (variableOverride) {
        let termPromise = variableOverride.then((term: Fmt.Expression) => this.readOnlyRenderer.renderElementTerm(term, fullElementTermSelection));
        resultArgs.push(new Display.PromiseExpression(termPromise));
        return;
      }
    }
    if (argumentLists) {
      if (type instanceof FmtHLM.MetaRefExpression_Prop) {
        let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_PropArg);
        if (arg) {
          let formulaSelection: FormulaSelection = {
            allowTruthValue: true,
            allowEquiv: false,
            allowCases: true
          };
          resultArgs.push(this.renderFormula(arg.formula, formulaSelection));
        } else {
          resultArgs.push(new Display.ErrorExpression('Undefined argument'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
        let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_SetArg);
        if (arg) {
          resultArgs.push(this.renderSetTerm(arg._set, fullSetTermSelection));
        } else {
          resultArgs.push(new Display.ErrorExpression('Undefined argument'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_SubsetArg);
        if (arg) {
          resultArgs.push(this.renderSetTerm(arg._set, fullSetTermSelection));
        } else {
          resultArgs.push(new Display.ErrorExpression('Undefined argument'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
        let arg = this.getArgument(argumentLists, param, FmtHLM.ObjectContents_ElementArg);
        if (arg) {
          resultArgs.push(this.renderElementTerm(arg.element, fullElementTermSelection));
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
          this.addSemanticLink(definitionRef, arg);
          resultArgs.push(definitionRef);
        } else {
          resultArgs.push(new Display.ErrorExpression('Undefined argument'));
        }
      } else {
        resultArgs.push(new Display.ErrorExpression('Unhandled parameter type'));
      }
    } else {
      let isDefinition = parameterOverrides && parameterOverrides.replacementParameters ? parameterOverrides.replacementParameters.isDefinition : false;
      resultArgs.push(this.renderVariable(paramToDisplay, indices, isDefinition, markAsDummy, undefined, elementParameterOverrides));
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

  private addDefinitionContents(paragraphs: Display.RenderedExpression[], definitionRef: Display.RenderedExpression, cases: ExtractedStructuralCase[] | undefined, includeExtras: boolean): void {
    let contents = this.renderDefinitionContents(definitionRef, cases);
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
    this.addDefinitionProofs(cases, paragraphs);
  }

  private renderDefinitionContents(definitionRef: Display.RenderedExpression, cases: ExtractedStructuralCase[] | undefined): Display.RenderedExpression | undefined {
    let definition = this.definition;
    let contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      return undefined;
    } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderFormula(contents.claim, formulaSelection);
    } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      let conditions = contents.conditions as Fmt.ArrayExpression;
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      let items = conditions.items.map((formula) => this.renderFormula(formula, formulaSelection));
      return new Display.ListExpression(items, '1.');
    } else if (contents instanceof FmtHLM.ObjectContents_Definition) {
      if (contents instanceof FmtHLM.ObjectContents_Construction) {
        let rows = definition.innerDefinitions.map((innerDefinition) => {
          let constructorDef = this.renderDefinedSymbol([definition, innerDefinition]);
          let row = [constructorDef];
          if (innerDefinition.parameters.length || this.editHandler) {
            row.push(this.renderParameterList(innerDefinition.parameters, false, false, false, innerDefinition));
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
      } else {
        let renderDefinitionRef = (elementParameterOverrides?: ElementParameterOverrides) => {
          if (elementParameterOverrides && elementParameterOverrides.size) {
            let parameterOverrides: ParameterOverrides = {
              elementParameterOverrides: elementParameterOverrides
            };
            return this.renderDefinitionRef([definition], undefined, false, 0, parameterOverrides);
          }
          return definitionRef;
        };
        let renderLeftSide = renderDefinitionRef;
        if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          let renderRightSide = (term: Fmt.Expression) => this.renderSetTerm(term, fullSetTermSelection);
          return this.renderMultiDefinitions('Equality', cases!, renderLeftSide, renderRightSide);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          let renderRightSide = (term: Fmt.Expression) => this.renderElementTerm(term, fullElementTermSelection);
          return this.renderMultiDefinitionsWithSpecializations('Equality', cases!, renderLeftSide, renderRightSide);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          let parameter = this.renderVariable(contents.parameter);
          renderLeftSide = (elementParameterOverrides?: ElementParameterOverrides) =>
            this.renderTemplate('EqualityRelation', {
                                  'left': renderDefinitionRef(elementParameterOverrides),
                                  'right': parameter
                                });
          let formulaSelection: FormulaSelection = {
            allowTruthValue: false,
            allowEquiv: false,
            allowCases: true
          };
          let renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, formulaSelection);
          return this.renderMultiDefinitions('Equivalence', cases!, renderLeftSide, renderRightSide, -3);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          let formulaSelection: FormulaSelection = {
            allowTruthValue: false,
            allowEquiv: false,
            allowCases: true
          };
          let renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, formulaSelection);
          return this.renderMultiDefinitions('Equivalence', cases!, renderLeftSide, renderRightSide, -3);
        } else {
          return new Display.EmptyExpression;
        }
      }
    } else {
      return new Display.EmptyExpression;
    }
  }

  private renderMultiDefinitions(type: string, cases: ExtractedStructuralCase[], renderLeftSide: (elementParameterOverrides?: ElementParameterOverrides) => Display.RenderedExpression, renderRightSide: (expression: Fmt.Expression) => Display.RenderedExpression, parenLevel: number = -1): Display.RenderedExpression {
    let rows: Display.RenderedExpression[][] = [];
    for (let currentCase of cases) {
      let elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      this.renderUtils.fillVariableOverridesFromExtractedCase(currentCase, elementParameterOverrides);
      let first = true;
      for (let definition of currentCase.definitions) {
        let leftItem: Display.RenderedExpression;
        if (first) {
          let caseDefinition = renderLeftSide(elementParameterOverrides);
          leftItem = this.renderTemplate(type + 'Definition', {
                                           'left': caseDefinition,
                                           'right': new Display.EmptyExpression
                                         });
          if (rows.length) {
            rows.push([]);
          }
        } else {
          leftItem = this.renderTemplate(type + 'Relation', {
                                           'left': new Display.EmptyExpression,
                                           'right': new Display.EmptyExpression
                                         });
        }
        let rightItem = new Display.InnerParenExpression(renderRightSide(definition));
        rightItem.maxLevel = parenLevel;
        let row = [leftItem, rightItem];
        if (first && currentCase.caseParameters) {
          this.addCaseParameters(currentCase.caseParameters, elementParameterOverrides, row);
        }
        rows.push(row);
        first = false;
      }
    }
    let result = new Display.TableExpression(rows);
    result.styleClasses = ['aligned', 'definitions'];
    return result;
  }

  private renderMultiDefinitionsWithSpecializations(type: string, cases: ExtractedStructuralCase[], renderLeftSide: (elementParameterOverrides?: ElementParameterOverrides) => Display.RenderedExpression, renderRightSide: (expression: Fmt.Expression) => Display.RenderedExpression, parenLevel: number = -1): Display.RenderedExpression {
    if (cases.length === 1) {
      let currentCase = cases[0];
      if (currentCase.definitions.length === 1) {
        let expression = currentCase.definitions[0];
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
                  let elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
                  this.renderUtils.fillVariableOverridesFromExtractedCase(currentCase, elementParameterOverrides);
                  let parameterOverrides: ParameterOverrides = {elementParameterOverrides: elementParameterOverrides};
                  let args = this.getRenderedTemplateArguments(definitions, argumentLists, parameterOverrides);
                  args[definitionDisplay.parameter.name] = renderLeftSide(elementParameterOverrides);
                  if (definitionDisplay.display
                      && definitionDisplay.display instanceof Fmt.ArrayExpression
                      && definitionDisplay.display.items.length) {
                    let display = this.findBestMatch(definitionDisplay.display.items, argumentLists)!;
                    let result = this.renderDisplayExpression(display, args);
                    this.addSemanticLink(result, definitionRef);
                    return result;
                  }
                }
              }
              return this.renderMultiDefinitions(type, cases, renderLeftSide, renderRightSide, parenLevel);
            });
          return new Display.PromiseExpression(promise);
        }
      }
    }
    return this.renderMultiDefinitions(type, cases, renderLeftSide, renderRightSide, parenLevel);
  }

  private addDefinitionProofs(cases: ExtractedStructuralCase[] | undefined, paragraphs: Display.RenderedExpression[]): void {
    let definition = this.definition;
    let contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      this.addProofs(contents.proofs, 'Proof', contents.claim, paragraphs);
    } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      this.addEquivalenceProofs(contents.equivalenceProofs, 'Proof', '⇒', paragraphs);
    } else if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
      if (contents.definition instanceof Fmt.ArrayExpression && contents.definition.items.length > 1) {
        this.addEquivalenceProofs(contents.equalityProofs, 'Equality', '⊆', paragraphs);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
      if (contents.definition instanceof Fmt.ArrayExpression && contents.definition.items.length > 1) {
        this.addEquivalenceProofs(contents.equalityProofs, 'Equality', '=', paragraphs);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
      if (contents.definition instanceof Fmt.ArrayExpression && contents.definition.items.length > 1) {
        this.addEquivalenceProofs(contents.equivalenceProofs, 'Equivalence', '⇒', paragraphs);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
      if (contents.definition instanceof Fmt.ArrayExpression && contents.definition.items.length > 1) {
        this.addEquivalenceProofs(contents.equivalenceProofs, 'Equivalence', '⇒', paragraphs);
      }
      this.addProof(contents.wellDefinednessProof, 'Well-definedness', undefined, paragraphs);
    }
    if (cases) {
      this.addStructuralCaseProofs(cases, paragraphs);
    }
  }

  private addStructuralCaseProofs(cases: ExtractedStructuralCase[], paragraphs: Display.RenderedExpression[]): void {
    let nonIsomorphicCasesPromise: CachedPromise<FmtHLM.ObjectContents_StructuralCase[]> = CachedPromise.resolve([]);
    for (let currentCase of cases) {
      if (currentCase.structuralCases) {
        for (let structuralCase of currentCase.structuralCases) {
          let currentStructuralCase = structuralCase;
          let constructorRef = currentStructuralCase._constructor;
          if (constructorRef instanceof Fmt.DefinitionRefExpression) {
            let currentConstructorRef = constructorRef;
            let constructionPromise = this.utils.getOuterDefinition(constructorRef);
            nonIsomorphicCasesPromise = nonIsomorphicCasesPromise.then((previousCases: FmtHLM.ObjectContents_StructuralCase[]) => {
              return constructionPromise.then((construction: Fmt.Definition) => {
                let constructor = construction.innerDefinitions.getDefinition(currentConstructorRef.path.name);
                if (constructor.contents instanceof FmtHLM.ObjectContents_Constructor && constructor.contents.equalityDefinition) {
                  if (!(constructor.contents.equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true)) {
                    return [...previousCases, currentStructuralCase];
                  }
                }
                return previousCases;
              });
            });
          }
        }
      }
    }
    let immediateResult = nonIsomorphicCasesPromise.getImmediateResult();
    if (!immediateResult || immediateResult.length) {
      let proofPromise = nonIsomorphicCasesPromise.then((nonIsomorphicCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        if (nonIsomorphicCases.length) {
          let subParagraphs: Display.RenderedExpression[] = [];
          let proofs = nonIsomorphicCases.map((nonIsomorphicCase) => nonIsomorphicCase.wellDefinednessProof);
          this.addProofList(proofs, 'Well-definedness', undefined, undefined, subParagraphs);
          return new Display.ParagraphExpression(subParagraphs);
        } else {
          // TODO this results in an empty paragraph; needs to be fixed somehow
          return new Display.EmptyExpression;
        }
      });
      paragraphs.push(new Display.PromiseExpression(proofPromise));
    }
  }

  private addExtraDefinitionContents(paragraphs: Display.RenderedExpression[]): void {
    let definition = this.definition;

    if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
      let equalityDefinitionParagraphs: Display.RenderedExpression[] = [];
      this.addEqualityDefinitions(equalityDefinitionParagraphs);
      if (equalityDefinitionParagraphs.length) {
        let equalityDefinitions = new Display.ParagraphExpression(equalityDefinitionParagraphs);
        equalityDefinitions.styleClasses = ['display-math'];
        paragraphs.push(equalityDefinitions);
      }

      let embedding = definition.contents.embedding;
      if (embedding) {
        let source = embedding.parameter.type.expression as FmtHLM.MetaRefExpression_Element;
        let rows: Display.RenderedExpression[][] = [];
        let subset = this.renderSetTerm(source._set, fullSetTermSelection);
        let superset = this.renderDefinitionRef([definition]);
        this.addSemanticLink(superset, definition);
        let supersetDefinition = this.renderTemplate('EmbeddingDefinition', {
          'subset': new Display.EmptyExpression,
          'superset': superset
        });
        let supersetWithText = new Display.RowExpression([supersetDefinition, new Display.TextExpression(' via')]);
        rows.push([subset, supersetWithText]);
        let subsetElement = this.renderVariableDefinitions([embedding.parameter]);
        let targetTerm = this.utils.getEmbeddingTargetTerm(definition, embedding.target);
        let target = this.renderElementTerm(targetTerm, fullElementTermSelection);
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
        markAsDummy: false,
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
            markAsDummy: false,
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

  private addEqualityDefinitions(paragraphs: Display.RenderedExpression[]): void {
    let definition = this.definition;
    for (let innerDefinition of definition.innerDefinitions) {
      let constructorContents = innerDefinition.contents;
      if (constructorContents instanceof FmtHLM.ObjectContents_Constructor) {
        let equalityDefinition = constructorContents.equalityDefinition;
        if (equalityDefinition) {
          let leftParameterOverrides: ParameterOverrides = {
            replacementParameters: {
              parameters: equalityDefinition.leftParameters,
              isDefinition: false
            }
          };
          let rightParameterOverrides: ParameterOverrides = {
            replacementParameters: {
              parameters: equalityDefinition.rightParameters,
              isDefinition: false
            }
          };
          let leftConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, false, 0, leftParameterOverrides);
          this.addSemanticLink(leftConstructor, innerDefinition);
          let rightConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, false, 0, rightParameterOverrides);
          this.addSemanticLink(rightConstructor, innerDefinition);
          let equality = this.renderTemplate('EqualityRelation', {
            'left': leftConstructor,
            'right': rightConstructor
          });
          this.addSemanticLink(equality, equalityDefinition);
          let renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, fullFormulaSelection);
          let definitions = equalityDefinition.definition as Fmt.ArrayExpression;
          let parameters: Fmt.Parameter[] = [];
          parameters.push(...equalityDefinition.leftParameters);
          parameters.push(...equalityDefinition.rightParameters);
          let singleCase: ExtractedStructuralCase = {
            caseParameters: parameters,
            definitions: definitions.items
          };
          let equivalenceDef = this.renderMultiDefinitions('Equivalence', [singleCase], () => equality, renderRightSide, -3);
          paragraphs.push(equivalenceDef);
          if (!(equalityDefinition.isomorphic instanceof FmtHLM.MetaRefExpression_true)) {
            this.addIndentedProof(equalityDefinition.reflexivityProof, 'Reflexivity', paragraphs);
            this.addIndentedProof(equalityDefinition.symmetryProof, 'Symmetry', paragraphs);
            this.addIndentedProof(equalityDefinition.transitivityProof, 'Transitivity', paragraphs);
          }
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
      let parameterOverrides: ParameterOverrides = {
        replacementParameters: {
          parameters: replacementParams,
          isDefinition: false
        }
      };
      row.push(this.renderDefinitionRef([definition], undefined, false, 0, parameterOverrides));
      row.push(new Display.TextExpression(' as elements of '));
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
    formulaWithText.styleClasses = ['case-parameters'];
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
            row.push(this.readOnlyRenderer.renderParameterList(proof.parameters, true, false, false));
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
              row.push(this.readOnlyRenderer.renderFormula(proof.goal, fullFormulaSelection));
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

  private addProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], heading: string | undefined, labels: string[] | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    if (this.includeProofs) {
      if (proofs.every((proof) => proof === undefined)) {
        this.addProof(undefined, heading, externalGoal, paragraphs);
      } else {
        if (heading) {
          paragraphs.push(this.renderSubHeading(heading));
        }
        let items = proofs.map((proof) => {
          let subParagraphs: Display.RenderedExpression[] = [];
          this.addProof(proof, undefined, externalGoal, subParagraphs);
          return new Display.ParagraphExpression(subParagraphs);
        });
        let list = new Display.ListExpression(items, labels ? labels.map((label) => `${label}.`) : '1.');
        paragraphs.push(list);
      }
    }
  }

  private addEquivalenceProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, symbol: string, paragraphs: Display.RenderedExpression[]): void {
    if (this.includeProofs) {
      if (proofs && proofs.length) {
        let labels: string[] = [];
        for (let proof of proofs) {
          let label = '?';
          if (proof._from !== undefined && proof._to !== undefined) {
            label = `${proof._from}${symbol}${proof._to}`;
          }
          labels.push(label);
        }
        this.addProofList(proofs, heading, labels, undefined, paragraphs);
      } else {
        this.addNoProofPlaceholder(heading, undefined, undefined, paragraphs);
      }
    }
  }

  private addSubProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], labels: string[] | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Display.RenderedExpression[]): void {
    this.addProofList(proofs, undefined, labels, externalGoal, paragraphs);
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
        startRow.push(this.renderFormula(type.statement, fullFormulaSelection));
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
        paragraphs.push(this.renderParameter(step, true, false, false));
      } else if (type instanceof FmtHLM.MetaRefExpression_Consider
                 || type instanceof FmtHLM.MetaRefExpression_Embed) {
        let result = this.utils.getProofStepResult(step);
        paragraphs.push(this.readOnlyRenderer.renderFormula(result, fullFormulaSelection));
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
            source = this.readOnlyRenderer.renderFormula(this.utils.getProofStepResult(sourceType.source), fullFormulaSelection);
            if (!source.styleClasses) {
              source.styleClasses = [];
            }
            source.styleClasses.push('miniature');
            this.addSemanticLink(source, sourceType.source);
          }
        }
        if (sourceType instanceof FmtHLM.MetaRefExpression_UseDef
            || sourceType instanceof FmtHLM.MetaRefExpression_ResolveDef) {
          source = new Display.TextExpression('def');
          source.styleClasses = ['miniature'];
          // TODO link to definition
        } else if (sourceType instanceof FmtHLM.MetaRefExpression_UseTheorem) {
          if (sourceType.theorem instanceof Fmt.DefinitionRefExpression) {
            let itemNumberPromise = this.utils.getItemInfo(sourceType.theorem).then((itemInfo: LibraryItemInfo) => new Display.TextExpression(formatItemNumber(itemInfo.itemNumber)));
            source = new Display.PromiseExpression(itemNumberPromise);
            source.styleClasses = ['miniature'];
            this.addSemanticLink(source, sourceType.theorem);
          }
          // TODO unset dependsOnPrevious if theorem does not depend on previous
        }
        let resultToDisplay: Display.RenderedExpression;
        if (result instanceof FmtHLM.MetaRefExpression_or && !result.formulae) {
          resultToDisplay = new Display.TextExpression('⚡');
        } else {
          resultToDisplay = this.readOnlyRenderer.renderFormula(result, fullFormulaSelection);
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

  getDefinitionParts(): Logic.ObjectRenderFns {
    let result = new Map<Object, Logic.RenderFn>();
    this.addDefinitionParts([this.definition], result);
    return result;
  }

  private addDefinitionParts(definitions: Fmt.Definition[], result: Logic.ObjectRenderFns): void {
    let definition = definitions[definitions.length - 1];
    let contents = definition.contents;
    if (!(contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      this.addParameterListParts(definition.parameters, definition, result);
      for (let innerDefinition of definition.innerDefinitions) {
        this.addDefinitionParts(definitions.concat(innerDefinition), result);
      }
      if (contents instanceof FmtHLM.ObjectContents_Definition) {
        if (contents.display) {
          result.set(contents.display, () => this.renderDefinitionRef(definitions));
        }
        if (contents instanceof FmtHLM.ObjectContents_Construction) {
          if (contents.embedding) {
            let embedding = contents.embedding;
            result.set(embedding.parameter, () => this.renderParameter(embedding.parameter, false, false, false));
            result.set(embedding.target, () => {
              let target = this.utils.getEmbeddingTargetTerm(definition, embedding.target);
              return this.renderElementTerm(target, fullElementTermSelection);
            });
            if (embedding.wellDefinednessProof) {
              this.addProofParts(embedding.wellDefinednessProof, result);
            }
          }
        } else if (contents instanceof FmtHLM.ObjectContents_Constructor) {
          if (contents.equalityDefinition) {
            let equalityDefinition = contents.equalityDefinition;
            this.addParameterListParts(equalityDefinition.leftParameters, undefined, result);
            this.addParameterListParts(equalityDefinition.rightParameters, undefined, result);
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
          if (contents.rewrite) {
            let rewrite = contents.rewrite;
            this.addElementTermParts(rewrite.value, result);
            if (rewrite.theorem) {
              this.addGenericExpressionParts(rewrite.theorem, result);
            }
          }
        } else if (contents instanceof FmtHLM.ObjectContents_SetOperator && contents.definition instanceof Fmt.ArrayExpression) {
          for (let item of contents.definition.items) {
            this.addSetTermParts(item, result);
          }
          if (contents.equalityProofs) {
            this.addProofListParts(contents.equalityProofs, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator && contents.definition instanceof Fmt.ArrayExpression) {
          for (let item of contents.definition.items) {
            this.addElementTermParts(item, result);
          }
          if (contents.equalityProofs) {
            this.addProofListParts(contents.equalityProofs, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator && contents.definition instanceof Fmt.ArrayExpression) {
          this.addParameterParts(contents.parameter, result);
          for (let item of contents.definition.items) {
            this.addFormulaParts(item, result);
          }
          if (contents.wellDefinednessProof) {
            this.addProofParts(contents.wellDefinednessProof, result);
          }
          if (contents.equivalenceProofs) {
            this.addProofListParts(contents.equivalenceProofs, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate && contents.definition instanceof Fmt.ArrayExpression) {
          for (let item of contents.definition.items) {
            this.addFormulaParts(item, result);
          }
          if (contents.equivalenceProofs) {
            this.addProofListParts(contents.equivalenceProofs, result);
          }
        }
      } else {
        if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
          this.addFormulaParts(contents.claim, result);
          if (contents.proofs) {
            this.addProofListParts(contents.proofs, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem && contents.conditions instanceof Fmt.ArrayExpression) {
          for (let item of contents.conditions.items) {
            this.addFormulaParts(item, result);
          }
          if (contents.equivalenceProofs) {
            this.addProofListParts(contents.equivalenceProofs, result);
          }
        }
      }
    }
  }

  private addSetTermParts(term: Fmt.Expression, result: Logic.ObjectRenderFns): void {
    result.set(term, () => this.renderSetTerm(term, fullSetTermSelection));
    this.addGenericExpressionParts(term, result);
  }

  private addElementTermParts(term: Fmt.Expression, result: Logic.ObjectRenderFns): void {
    result.set(term, () => this.renderElementTerm(term, fullElementTermSelection));
    this.addGenericExpressionParts(term, result);
  }

  private addFormulaParts(formula: Fmt.Expression, result: Logic.ObjectRenderFns): void {
    result.set(formula, () => this.renderFormula(formula, fullFormulaSelection));
    this.addGenericExpressionParts(formula, result);
  }

  private addGenericExpressionParts(expression: Fmt.Expression, result: Logic.ObjectRenderFns): void {
    if (expression instanceof Fmt.DefinitionRefExpression) {
      this.addPathParts(expression.path, result);
    }
    // TODO call addGenericExpressionParts recursively for all sub-expressions
  }

  private addPathParts(path: Fmt.Path, result: Logic.ObjectRenderFns): void {
    this.addArgumentListParts(path.arguments, result);
    if (path.parentPath instanceof Fmt.Path) {
      this.addPathParts(path.parentPath, result);
    }
  }

  private addParameterListParts(parameters: Fmt.Parameter[], associatedDefinition: Fmt.Definition | undefined, result: Logic.ObjectRenderFns): void {
    let initialState: ParameterListState = {
      fullSentence: true,
      sentence: true,
      abbreviate: false,
      forcePlural: false,
      enableSpecializations: true,
      markAsDummy: false,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionDisplayGroup: false,
      associatedDefinition: associatedDefinition
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

  private addParameterParts(parameter: Fmt.Parameter, result: Logic.ObjectRenderFns): void {
    result.set(parameter, () => this.renderParameter(parameter, false, false, false));
  }

  private addArgumentListParts(args: Fmt.ArgumentList, result: Logic.ObjectRenderFns): void {
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

  private addProofListParts(proofs: FmtHLM.ObjectContents_Proof[], result: Logic.ObjectRenderFns): void {
    if (this.includeProofs) {
      for (let proof of proofs) {
        this.addProofParts(proof, result);
      }
    }
  }

  private addProofParts(proof: FmtHLM.ObjectContents_Proof, result: Logic.ObjectRenderFns): void {
    if (this.includeProofs) {
      if (proof.parameters) {
        this.addParameterListParts(proof.parameters, undefined, result);
      }
      if (proof.goal) {
        let goal = proof.goal;
        result.set(goal, () => this.renderFormula(goal, fullFormulaSelection));
      }
      for (let step of proof.steps) {
        this.addProofStepParts(step, result);
      }
    }
  }

  private addProofStepParts(step: Fmt.Parameter, result: Logic.ObjectRenderFns): void {
    let type = step.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
      this.addParameterListParts([step], undefined, result);
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
      if (paramType instanceof FmtHLM.MetaRefExpression_Prop
          || paramType instanceof FmtHLM.MetaRefExpression_Set
          || paramType instanceof FmtHLM.MetaRefExpression_Subset
          || paramType instanceof FmtHLM.MetaRefExpression_Element) {
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
