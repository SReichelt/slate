import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtNotation from '../../notation/meta';
import * as Logic from '../logic';
import * as HLMMacro from './macro';
import { GenericRenderer, RenderedVariable, ArgumentWithInfo, RenderedTemplateArgument, RenderedTemplateArguments } from '../generic/renderer';
import * as Notation from '../../notation/notation';
import { HLMExpressionType } from './hlm';
import { HLMEditHandler, ParameterSelection, SetTermSelection, fullSetTermSelection, ElementTermSelection, fullElementTermSelection, FormulaSelection, fullFormulaSelection } from './editHandler';
import { GenericEditHandler } from '../generic/editHandler';
import { HLMUtils, DefinitionVariableRefExpression } from './utils';
import { HLMRenderUtils, ExtractedStructuralCase, ElementParameterOverrides } from './renderUtils';
import { PropertyInfo, AbbreviationParamExpression } from '../generic/renderUtils';
import { LibraryDataAccessor, LibraryItemInfo, formatItemNumber } from '../../data/libraryDataAccessor';
import CachedPromise from '../../data/cachedPromise';

interface ReplacementParameters {
  parameters?: Fmt.ParameterList;
  isDefinition: boolean;
}

interface ParameterOverrides {
  replacementParameters?: ReplacementParameters;
  elementParameterOverrides?: ElementParameterOverrides;
}

interface ArgumentRenderingOptions extends ParameterOverrides {
  argumentLists?: Fmt.ArgumentList[];
  indices?: Notation.RenderedExpression[];
  combineBindings?: boolean;  // TODO #65 remove
  omitArguments?: number;
  replaceAssociativeArg?: Notation.RenderedExpression;
  macroInvocation?: HLMMacro.HLMMacroInvocation;
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
  inDefinitionNotationGroup: boolean;
  associatedParameterList?: Fmt.ParameterList;
  associatedDefinition?: Fmt.Definition;
}

export class HLMRenderer extends GenericRenderer implements Logic.LogicRenderer {
  protected readOnlyRenderer: HLMRenderer;

  constructor(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, protected utils: HLMUtils, protected renderUtils: HLMRenderUtils, templates: Fmt.File, options: Logic.LogicRendererOptions, protected editHandler?: HLMEditHandler) {
    super(definition, libraryDataAccessor, utils, templates, options, editHandler);
    if (editHandler) {
      this.readOnlyRenderer = Object.create(this);
      this.readOnlyRenderer.editHandler = undefined;
    } else {
      this.readOnlyRenderer = this;
    }
  }

  renderDefinition(itemInfo: CachedPromise<LibraryItemInfo> | undefined, options: Logic.RenderedDefinitionOptions): Notation.RenderedExpression | undefined {
    let space: string | undefined = undefined;
    let row: Notation.RenderedExpression[] = [];
    if (options.includeLabel && itemInfo !== undefined) {
      row.push(this.renderDefinitionLabel(itemInfo));
      space = '  ';
    }
    let definition = this.definition;
    let contents = definition.contents;
    let cases: ExtractedStructuralCase[] | undefined = undefined;
    let hasCases = false;
    if (!(contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      let hasParameters = definition.parameters.length > 0;
      if (hasParameters || this.editHandler) {
        if (space) {
          row.push(new Notation.TextExpression(space));
        }
        row.push(this.renderParameterList(definition.parameters, true, false, false, definition));
        space = ' ';
      }
      let introText: Notation.RenderedExpression | undefined = undefined;
      if (contents instanceof FmtHLM.ObjectContents_StandardTheorem || contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
        if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          introText = this.renderEquivalenceTheoremIntro(hasParameters);
        } else {
          if (hasParameters || this.editHandler) {
            introText = this.renderStandardTheoremIntro(hasParameters);
          }
        }
        if (this.editHandler) {
          if (!introText) {
            introText = new Notation.InsertPlaceholderExpression;
          }
          let semanticLink = new Notation.SemanticLink(introText, false, false);
          let onRenderStandardIntro = () => this.renderStandardTheoremIntro(hasParameters);
          let onRenderEquivalenceIntro = () => this.renderEquivalenceTheoremIntro(hasParameters);
          this.editHandler.addTheoremTypeMenu(semanticLink, onRenderStandardIntro, onRenderEquivalenceIntro);
          introText.semanticLinks = [semanticLink];
        }
      } else {
        if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          introText = this.renderImplicitDefinitionIntro(contents.parameter);
        } else {
          introText = this.renderExplicitDefinitionIntro();
        }
        if ((contents instanceof FmtHLM.ObjectContents_ExplicitOperator || contents instanceof FmtHLM.ObjectContents_ImplicitOperator) && this.editHandler) {
          let semanticLink = new Notation.SemanticLink(introText, false, false);
          let onRenderExplicitIntro = () => this.renderExplicitDefinitionIntro();
          let onRenderImplicitIntro = (parameter: Fmt.Parameter) => this.renderImplicitDefinitionIntro(parameter);
          this.editHandler.addImplicitDefinitionMenu(semanticLink, onRenderExplicitIntro, onRenderImplicitIntro);
          introText.semanticLinks = [semanticLink];
        }
        if (contents instanceof FmtHLM.ObjectContents_SetOperator || contents instanceof FmtHLM.ObjectContents_ExplicitOperator || contents instanceof FmtHLM.ObjectContents_ImplicitOperator || contents instanceof FmtHLM.ObjectContents_Predicate) {
          cases = this.renderUtils.extractStructuralCases(contents.definition);
          hasCases = cases.length > 0 && cases[0].structuralCases !== undefined;
        }
      }
      if (introText) {
        if (space) {
          row.push(new Notation.TextExpression(space));
        }
        row.push(introText);
        if (!hasCases && !(introText instanceof Notation.InsertPlaceholderExpression)) {
          row.push(new Notation.TextExpression(':'));
        }
      }
    }
    let paragraphs: Notation.RenderedExpression[] = [];
    if (row.length) {
      paragraphs.push(row.length === 1 ? row[0] : new Notation.RowExpression(row));
    }
    let definitionRef = this.renderDefinedSymbol([definition]);
    if (hasCases) {
      let definitionRow = new Notation.RowExpression([definitionRef]);
      definitionRow.styleClasses = ['display-math'];
      paragraphs.push(definitionRow);
      paragraphs.push(new Notation.TextExpression('by:'));
    }
    this.addDefinitionContents(paragraphs, definitionRef, cases, options.includeExtras);
    if (options.includeRemarks) {
      this.addDefinitionRemarks(paragraphs);
    }
    if (paragraphs.length) {
      return new Notation.ParagraphExpression(paragraphs);
    } else {
      return undefined;
    }
  }

  renderDefinitionSummary(innerDefinition?: Fmt.Definition, multiLine: boolean = false): Notation.RenderedExpression | undefined {
    let definition = innerDefinition || this.definition;
    let contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_StandardTheorem || contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      let claim: Notation.RenderedExpression | undefined = undefined;
      if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        claim = this.renderFormula(contents.claim, formulaSelection);
      } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        let items = contents.conditions.map((formula) => this.renderFormula(formula, formulaSelection));
        claim = this.renderTemplate('EquivalenceRelation', {
                                      'operands': items
                                    });
      }
      if (claim) {
        if (definition.parameters.length) {
          let extractedConstraints: Fmt.Parameter[] = [];
          let reducedParameters = this.renderUtils.extractConstraints(definition.parameters, extractedConstraints);
          let parameters = this.readOnlyRenderer.renderParameters(reducedParameters, false, false, false);
          let addendum = new Notation.RowExpression([new Notation.TextExpression('if '), parameters]);
          addendum.styleClasses = ['addendum'];
          if (extractedConstraints.length) {
            let constraints = this.renderParameters(extractedConstraints, false, true, false);
            claim.optionalParenStyle = '[]';
            claim = this.renderTemplate('ImplicationRelation', {
                                          'operands': [constraints, claim]
                                        });
          }
          if (multiLine) {
            return new Notation.ParagraphExpression([claim, addendum]);
          } else {
            return new Notation.RowExpression([claim, new Notation.TextExpression('  '), addendum]);
          }
        } else {
          return claim;
        }
      }
    } else if (!(contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      let definitions = [definition];
      if (definition !== this.definition) {
        definitions.unshift(this.definition);
      }
      let omitArguments = contents instanceof FmtHLM.ObjectContents_Construction ? 1 : 2;
      let result = this.renderDefinitionRef(definitions, undefined, omitArguments);
      let definitionNotation = this.renderUtils.getDefinitionNotation(definition);
      let pluralName = definitionNotation?.pluralName;
      if (pluralName) {
        let options: ArgumentRenderingOptions = {
          omitArguments: omitArguments
        };
        let name = this.renderDefinitionNotationExpression(pluralName, definitions, options);
        name = this.splitName(name);
        let nameWithParens = new Notation.ParenExpression(name, '()');
        nameWithParens.styleClasses = ['addendum-hint'];
        result = new Notation.RowExpression([
          result,
          new Notation.TextExpression(' '),
          nameWithParens
        ]);
      }
      return result;
    }
    return undefined;
  }

  renderDefinitionLabel(itemInfo: CachedPromise<LibraryItemInfo>): Notation.RenderedExpression {
    let formattedInfoPromise = itemInfo.then((info: LibraryItemInfo) => {
      let typeLabelText = this.getDefinitionTypeLabel(info.type);
      let text = this.editHandler ? '' : typeLabelText;
      text += ' ';
      text += formatItemNumber(info.itemNumber);
      if (info.title || this.editHandler) {
        let title: Notation.RenderedExpression;
        if (info.title) {
          title = new Notation.TextExpression(`(${info.title})`);
          title.styleClasses = ['title'];
        } else {
          title = new Notation.InsertPlaceholderExpression;
          title.styleClasses = ['mini-placeholder'];
        }
        if (this.editHandler) {
          let semanticLink = new Notation.SemanticLink(title, false, false);
          this.editHandler.addTitleMenu(semanticLink, info);
          title.semanticLinks = [semanticLink];
        }
        let row: Notation.RenderedExpression[] = [new Notation.TextExpression(text + ' '), title, new Notation.TextExpression('.')];
        if (this.editHandler) {
          let typeLabel = new Notation.TextExpression(typeLabelText);
          if (this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem || this.definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem || this.definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
            let semanticLink = new Notation.SemanticLink(typeLabel, false, false);
            let onRenderType = (type: string | undefined) => {
              let renderedType = new Notation.TextExpression(this.getDefinitionTypeLabel(type));
              renderedType.styleClasses = ['label'];
              return renderedType;
            };
            this.editHandler.addTypeMenu(semanticLink, onRenderType, info);
            typeLabel.semanticLinks = [semanticLink];
          }
          row.unshift(typeLabel);
        }
        return new Notation.RowExpression(row);
      } else {
        text += '.';
        return new Notation.TextExpression(text);
      }
    });
    let result = new Notation.PromiseExpression(formattedInfoPromise);
    result.styleClasses = ['label'];
    return result;
  }

  private getDefinitionTypeLabel(type: string | undefined): string {
    if (type) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    } else {
      return this.definition.contents instanceof FmtHLM.ObjectContents_StandardTheorem || this.definition.contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem ? 'Proposition' : 'Definition';
    }
  }

  private renderExplicitDefinitionIntro(): Notation.RenderedExpression {
    return new Notation.TextExpression('We define');
  }

  private renderImplicitDefinitionIntro(parameter: Fmt.Parameter): Notation.RenderedExpression {
    let row: Notation.RenderedExpression[] = [
      new Notation.TextExpression('For '),
      this.renderParameter(parameter, false, true, false),
      new Notation.TextExpression(', we define')
    ];
    return new Notation.RowExpression(row);
  }

  private renderStandardTheoremIntro(hasParameters: boolean): Notation.RenderedExpression {
    return new Notation.TextExpression(hasParameters ? 'Then' : 'We have');
  }

  private renderEquivalenceTheoremIntro(hasParameters: boolean): Notation.RenderedExpression {
    return new Notation.TextExpression(hasParameters ? 'Then the following are equivalent' : 'The following are equivalent');
  }

  renderParameterList(parameters: Fmt.ParameterList, sentence: boolean, abbreviate: boolean, forcePlural: boolean, associatedDefinition?: Fmt.Definition, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
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
      inDefinitionNotationGroup: false,
      associatedParameterList: parameters,
      associatedDefinition: associatedDefinition
    };
    return this.renderParametersWithInitialState(parameters, initialState, undefined);
  }

  renderParameters(parameters: Fmt.Parameter[], sentence: boolean, abbreviate: boolean, forcePlural: boolean, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
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
      inDefinitionNotationGroup: false
    };
    return this.renderParametersWithInitialState(parameters, initialState, undefined);
  }

  renderParameter(parameter: Fmt.Parameter, sentence: boolean, forcePlural: boolean, markAsDummy: boolean, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
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
      inDefinitionNotationGroup: false
    };
    return this.renderParametersWithInitialState([parameter], initialState);
  }

  private renderParametersWithInitialState(parameters: Fmt.Parameter[], initialState: ParameterListState, indices?: Notation.RenderedExpression[]): Notation.RenderedExpression {
    let state: ParameterListState = {...initialState};
    let resolveDefinitions: CachedPromise<(Fmt.Definition | undefined)[]> = CachedPromise.resolve([]);
    resolveDefinitions = this.extractParameterDefinitions(parameters, resolveDefinitions);
    let render = resolveDefinitions.then((constraintDefinitions: (Fmt.Definition | undefined)[]) => this.renderParametersWithResolvedDefinitions(parameters, constraintDefinitions, state, indices));
    return new Notation.PromiseExpression(render);
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

  private renderParametersWithResolvedDefinitions(parameters: Fmt.Parameter[], constraintDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices?: Notation.RenderedExpression[]): Notation.RenderedExpression {
    let row: Notation.RenderedExpression[] = [];
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
    this.addParameterInsertButton(state, indices, row, !parameters.length);
    if (state.started && state.fullSentence && !indices) {
      row.push(new Notation.TextExpression('.'));
      state.started = false;
      state.inLetExpr = false;
      state.inConstraint = false;
    }
    return new Notation.RowExpression(row);
  }

  private addParameterInsertButton(state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[], isEmpty: boolean): void {
    if (this.editHandler && state.associatedParameterList) {
      if (row.length) {
        row.push(new Notation.TextExpression(' '));
      } else if (state.started) {
        // Occurs if bound parameter list is empty.
        row.push(new Notation.TextExpression(', '));
      }
      let insertButton = new Notation.InsertPlaceholderExpression;
      let semanticLink = new Notation.SemanticLink(insertButton, false, false);
      let stateCopy: ParameterListState = {
        ...state,
        associatedParameterList: undefined,
        markAsDummy: true
      };
      if (stateCopy.started) {
        stateCopy.fullSentence = false;
        stateCopy.started = false;
      }
      let onRenderParam = (parameter: Fmt.Parameter) => this.renderParametersWithInitialState([parameter], stateCopy, indices);
      let onInsertParam = (parameter: Fmt.Parameter) => {
        state.associatedParameterList!.push(parameter);
        if (stateCopy.associatedDefinition && this.utils.isValueParamType(parameter.type.expression)) {
          let contents = stateCopy.associatedDefinition.contents;
          if (contents instanceof FmtHLM.ObjectContents_Definition) {
            contents.notation = undefined;
            contents.definitionNotation = undefined;
          }
        }
        GenericEditHandler.lastInsertedParameter = parameter;
      };
      let paramSelection: ParameterSelection = {
        allowConstraint: state.fullSentence || !isEmpty,
        allowProposition: state.associatedDefinition !== undefined && (state.associatedParameterList !== state.associatedDefinition.parameters || state.associatedDefinition.contents instanceof FmtHLM.ObjectContents_Constructor),
        allowDefinition: state.fullSentence,
        allowBinding: state.associatedDefinition !== undefined
      };
      this.editHandler.addParameterMenu(semanticLink, state.associatedParameterList, onRenderParam, onInsertParam, paramSelection);
      insertButton.semanticLinks = [semanticLink];
      row.push(insertButton);
    }
  }

  private combineParameter(param: Fmt.Parameter, firstParam: Fmt.Parameter): boolean {
    let paramType = param.type.expression;
    let firstParamType = firstParam.type.expression;
    return ((paramType instanceof FmtHLM.MetaRefExpression_Prop && firstParamType instanceof FmtHLM.MetaRefExpression_Prop)
            || (paramType instanceof FmtHLM.MetaRefExpression_Set && firstParamType instanceof FmtHLM.MetaRefExpression_Set)
            || (paramType instanceof FmtHLM.MetaRefExpression_Subset && firstParamType instanceof FmtHLM.MetaRefExpression_Subset && paramType.superset instanceof FmtHLM.MetaRefExpression_previous)
            || (paramType instanceof FmtHLM.MetaRefExpression_Element && firstParamType instanceof FmtHLM.MetaRefExpression_Element && paramType._set instanceof FmtHLM.MetaRefExpression_previous));
  }

  private addParameterGroup(parameters: Fmt.Parameter[], definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[], remainingDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[]): void {
    let type = parameters[0].type.expression;

    if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      this.addBindingParameterGroup(parameters, type, definition, remainingDefinitions, state, indices, row);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      this.addBinder(type, state, indices, row);
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      this.addConstraint(type, remainingParameters, remainingDefinitions, state, row);
    } else {
      this.addRegularParameterGroup(parameters, type, definition, remainingParameters, remainingDefinitions, state, indices, row);
    }
  }

  private addBindingParameterGroup(parameters: Fmt.Parameter[], type: FmtHLM.MetaRefExpression_Binding, definition: Fmt.Definition | undefined, remainingDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[]): void {
    state.inLetExpr = false;
    state.inConstraint = false;
    state.inDefinition = false;

    for (let param of parameters) {
      let forEachRow: Notation.RenderedExpression[] = [new Notation.TextExpression(state.abbreviate ? ' f.e. ' : ' for each ')];
      let forEachState: ParameterListState = {
        fullSentence: false,
        sentence: false,
        abbreviate: true,
        forcePlural: false,
        enableSpecializations: state.enableSpecializations,
        markAsDummy: state.markAsDummy,
        started: false,
        inLetExpr: false,
        inConstraint: false,
        inDefinition: false,
        inDefinitionNotationGroup: false,
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
            forEachRow.push(new Notation.TextExpression(' and '));
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
      let innerIndices: Notation.RenderedExpression[] = indices ? indices.slice() : [];
      for (let variable of variables) {
        innerIndices.push(this.renderVariable(variable));
      }
      row.push(this.renderParametersWithInitialState(innerParameters, innerState, innerIndices));

      row.push(...forEachRow);
    }

    state.started = true;
  }

  private addBinder(type: FmtHLM.MetaRefExpression_Binder, state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[]): void {
    state.inLetExpr = false;
    state.inConstraint = false;
    state.inDefinition = false;
    state.inDefinitionNotationGroup = false;

    let targetState = {
      ...state,
      associatedParameterList: type.targetParameters
    };
    let targetIndices = this.addIndices(type, indices);
    row.push(this.renderParametersWithInitialState(type.targetParameters, targetState, targetIndices));

    row.push(new Notation.TextExpression(state.abbreviate ? ' f.e. ' : ' for each '));
    let sourceState: ParameterListState = {
      ...state,
      fullSentence: false,
      sentence: false,
      abbreviate: true,
      forcePlural: false,
      started: false
    };
    row.push(this.renderParametersWithInitialState(type.sourceParameters, sourceState, indices));

    state.started = true;
  }

  private addConstraint(type: FmtHLM.MetaRefExpression_Constraint, remainingParameters: Fmt.Parameter[], remainingDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, row: Notation.RenderedExpression[]): void {
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
      row.push(new Notation.TextExpression(connective));
    } else {
      if (state.started) {
        row.push(new Notation.TextExpression(', '));
      }
      if (state.sentence) {
        row.push(new Notation.TextExpression(state.fullSentence && !state.started ? 'Assume ' : 'assume '));
      }
    }

    let formulaSelection: FormulaSelection = {
      allowTruthValue: false,
      allowEquiv: true,
      allowCases: true
    };
    let formula = this.renderFormula(type.formula, formulaSelection);
    while (remainingParameters.length) {
      let nextType = remainingParameters[0].type.expression;
      if (nextType instanceof FmtHLM.MetaRefExpression_Constraint && this.hasAssociativeArg(nextType.formula)) {
        formula = this.renderFormula(nextType.formula, formulaSelection, formula);
        remainingParameters.pop();
        remainingDefinitions.pop();
      } else {
        break;
      }
    }
    if (state.sentence && !(state.inConstraint || (remainingParameters.length && remainingParameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Constraint))) {
      row.push(formula);
    } else {
      let formulaWithParens = new Notation.InnerParenExpression(formula);
      formulaWithParens.maxLevel = -2;
      row.push(formulaWithParens);
    }

    state.inConstraint = true;
    state.inDefinition = false;
    state.started = true;
  }

  private addRegularParameterGroup(parameters: Fmt.Parameter[], type: Fmt.Expression, definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined, state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[]): void {
    if (state.started) {
      row.push(new Notation.TextExpression(', '));
    }
    if (state.sentence && !state.inLetExpr) {
      row.push(new Notation.TextExpression(state.fullSentence && !state.started ? 'Let ' : 'let '));
    }
    state.inLetExpr = true;
    state.inConstraint = false;
    state.inDefinition = false;

    let variableDefinitions = this.renderVariableDefinitions(parameters, indices, state.markAsDummy, state.associatedParameterList, state.elementParameterOverrides);
    let variableNotation: Notation.RenderedExpression | undefined;
    let noun: PropertyInfo = {
      isFeature: false,
      extracted: false
    };
    let singular: Notation.RenderedExpression[] = [];
    let plural: Notation.RenderedExpression[] = [];
    let combineWithNext = false;
    if (definition && state.enableSpecializations) {
      let definitionRef = this.getNotationDefinitionRef(type);
      if (definitionRef instanceof Fmt.DefinitionRefExpression) {
        noun.definitionRef = definitionRef;
        let definitions: Fmt.Definition[] = [];
        let argumentLists: Fmt.ArgumentList[] = [];
        this.utils.analyzeDefinitionRef(definitionRef, definition, definitions, argumentLists);
        let innerDefinition = definitions[definitions.length - 1];
        let definitionNotation = this.renderUtils.getDefinitionNotation(innerDefinition);
        if (definitionNotation) {
          let options: ArgumentRenderingOptions = {
            argumentLists: argumentLists
          };
          let args = this.getRenderedTemplateArguments(definitions, options);
          args[definitionNotation.parameter.name] = variableDefinitions;
          if (definitionNotation.notation) {
            variableNotation = this.renderNotationExpression(definitionNotation.notation, args);
            this.addSemanticLink(variableNotation, definitionRef);
          }
          if (!(state.abbreviate && definitionNotation.nameOptional instanceof FmtNotation.MetaRefExpression_true)) {
            if (definitionNotation.singularName && (!state.abbreviate || definitionNotation.singularName instanceof Fmt.StringExpression)) {
              noun.singular = this.applyName(definitionNotation.singularName, args, definitionRef, singular);
              if (definitionNotation.singularName instanceof Fmt.StringExpression && remainingParameters && remainingParameters.length && remainingDefinitions && remainingDefinitions.length) {
                let nextDefinitionRef = this.getNotationDefinitionRef(remainingParameters[0].type.expression);
                let nextDefinition = remainingDefinitions[0];
                if (nextDefinitionRef instanceof Fmt.DefinitionRefExpression && nextDefinition) {
                  let nextDefinitions: Fmt.Definition[] = [];
                  let nextArgumentLists: Fmt.ArgumentList[] = [];
                  this.utils.analyzeDefinitionRef(nextDefinitionRef, nextDefinition, nextDefinitions, nextArgumentLists);
                  let nextInnerDefinition = nextDefinitions[nextDefinitions.length - 1];
                  let nextDefinitionNotation = this.renderUtils.getDefinitionNotation(nextInnerDefinition);
                  if (nextDefinitionNotation && nextDefinitionNotation.singularName instanceof Fmt.StringExpression && definitionNotation.singularName.value === nextDefinitionNotation.singularName.value) {
                    combineWithNext = true;
                  }
                }
              }
            }
            if (definitionNotation.pluralName && (!state.abbreviate || definitionNotation.pluralName instanceof Fmt.StringExpression)) {
              noun.plural = this.applyName(definitionNotation.pluralName, args, definitionRef, plural);
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
    let properties: PropertyInfo[] | undefined = undefined;
    if (!state.inDefinitionNotationGroup) {
      properties = this.renderUtils.extractProperties(parameters, noun, remainingParameters, remainingDefinitions);
    }
    this.replaceName(noun.singular, noun.definitionRef, noun.extracted, singular);
    this.replaceName(noun.plural, noun.definitionRef, noun.extracted, plural);
    if (singular.length && plural.length) {
      if (properties && properties.length) {
        noun.article = undefined;
        this.addExtractedProperties(properties, singular, plural);
      }
      // TODO remove the condition that we are not inside a binding parameter; requires #65
      if (this.editHandler && state.associatedParameterList && !state.inDefinitionNotationGroup && !remainingParameters?.length && !indices) {
        let firstObjectParam = parameters[0];
        let onRenderFormulas = (expressions: Fmt.Expression[]) => this.renderConstraintMenuItem(expressions, firstObjectParam);
        let parameterList = state.associatedParameterList;
        let onInsertParam = (parameter: Fmt.Parameter) => parameterList.push(parameter);
        this.editHandler.addPropertyInsertButton(parameterList, singular, plural, parameters, onInsertParam, onRenderFormulas);
      }
      if (!variableNotation) {
        variableNotation = variableDefinitions;
      }
      if (state.abbreviate) {
        let which = parameters.length === 1 && !state.forcePlural && !combineWithNext ? singular : plural;
        row.push(...which);
        row.push(new Notation.TextExpression(' '));
        row.push(variableNotation);
      } else {
        row.push(variableNotation);
        if (combineWithNext) {
          state.inDefinitionNotationGroup = true;
        } else {
          let isPlural = parameters.length > 1 || state.inDefinitionNotationGroup;
          this.addNounDefinition(isPlural ? plural : singular, noun.article, isPlural, state.sentence, row);
          state.inDefinitionNotationGroup = false;
        }
      }
    } else if (variableNotation) {
      row.push(variableNotation);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      let termSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: true,
        allowCases: false
      };
      row.push(this.renderTemplate('SubsetParameter', {
                                     'variable': variableDefinitions,
                                     'superset': this.renderSetTerm(type.superset, termSelection)
                                   }));
    } else if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Binding) {
      let termSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: false,
        allowCases: false
      };
      row.push(this.renderTemplate('ElementParameter', {
                                     'variable': variableDefinitions,
                                     'set': this.renderSetTerm(type._set, termSelection)
                                   }));
    } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      row.push(this.renderTemplate('VariableDefinition', {
                                     'variable': variableDefinitions,
                                     'term': this.renderSetTerm(type._set, fullSetTermSelection)
                                   }));
      state.inDefinition = true;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      row.push(this.renderTemplate('VariableDefinition', {
                                     'variable': variableDefinitions,
                                     'term': this.renderElementTerm(type.element, fullElementTermSelection)
                                   }));
      state.inDefinition = true;
    } else {
      row.push(new Notation.ErrorExpression('Unknown parameter type'));
    }

    state.started = true;
  }

  private applyName(name: Fmt.Expression, args: RenderedTemplateArguments, definitionRef: Fmt.DefinitionRefExpression, result: Notation.RenderedExpression[]): string | undefined {
    result.length = 0;
    let expression = this.renderNotationExpression(name, args);
    let firstItem = this.splitName(expression, result);
    this.addSemanticLink(firstItem, definitionRef);
    if (firstItem instanceof Notation.TextExpression) {
      return firstItem.text;
    } else {
      return undefined;
    }
  }

  private splitName(expression: Notation.RenderedExpression, result?: Notation.RenderedExpression[]): Notation.RenderedExpression {
    while (expression instanceof Notation.UserDefinedExpression) {
      expression = expression.resolve();
    }
    if (expression instanceof Notation.RowExpression && expression.items.length) {
      result?.push(...expression.items);
      return expression.items[0];
    } else {
      result?.push(expression);
      return expression;
    }
  }

  private replaceName(name: string | undefined, definitionRef: Fmt.DefinitionRefExpression | undefined, alwaysApply: boolean, result: Notation.RenderedExpression[]): void {
    if (name && (alwaysApply || !result.length)) {
      let newName = new Notation.TextExpression(name);
      this.addSemanticLink(newName, definitionRef || newName);
      if (result.length) {
        result[0] = newName;
      } else {
        result.push(newName);
      }
    }
  }

  private addNounDefinition(noun: Notation.RenderedExpression[], article: string | undefined, isPlural: boolean, isLetExpression: boolean, row: Notation.RenderedExpression[]): void {
    if (isPlural) {
      if (isLetExpression) {
        row.push(new Notation.TextExpression(' be '));
        row.push(...noun);
      } else {
        row.push(new Notation.TextExpression(' are '));
        row.push(...noun);
      }
    } else {
      let nounStart = noun[0];
      if (nounStart instanceof Notation.PlaceholderExpression && noun.length > 2) {
        let space = noun[1];
        if (space instanceof Notation.TextExpression && space.text === ' ') {
          nounStart = noun[2];
        }
      }
      for (;;) {
        if (nounStart instanceof Notation.RowExpression && nounStart.items.length) {
          nounStart = nounStart.items[0];
        } else if (nounStart instanceof Notation.IndirectExpression) {
          nounStart = nounStart.resolve();
        } else {
          break;
        }
      }
      if (!article) {
        article = this.getSingularArticle(nounStart instanceof Notation.TextExpression ? nounStart.text : undefined);
      }
      if (isLetExpression) {
        row.push(new Notation.TextExpression(` be ${article} `));
        row.push(...noun);
      } else {
        row.push(new Notation.TextExpression(` is ${article} `));
        row.push(...noun);
      }
    }
  }

  private getSingularArticle(nextWord?: string): string {
    // TODO handle single-letter case, in particular variables include e.g. greek letters
    // (Note: We currently do not even have access to the variable name.)
    if (nextWord && nextWord.length > 1) {
      let firstChar = nextWord.charAt(0).toLowerCase();
      switch (firstChar) {
      case 'a':
      case 'e':
      case 'i':
      case 'o':
      case 'u':
        // We currently do not consider any special cases such as a silent 'h'. That seems complicated.
        // Other languages are even worse.
        return 'an';
      default:
        return 'a';
      }
    }
    return 'a/an';
  }

  private addExtractedProperties(properties: PropertyInfo[], singular: Notation.RenderedExpression[], plural: Notation.RenderedExpression[]) {
    for (let property of properties) {
      let space = new Notation.TextExpression(' ');
      if (property.property) {
        let renderedProperty = new Notation.TextExpression(property.property);
        if (property.definitionRef) {
          this.addSemanticLink(renderedProperty, property.definitionRef);
        }
        singular.unshift(space);
        singular.unshift(renderedProperty);
        plural.unshift(space);
        plural.unshift(renderedProperty);
      }
      else if (property.singular) {
        let preposition = new Notation.TextExpression(' with ');
        singular.push(preposition);
        plural.push(preposition);
        if (property.article) {
          singular.push(new Notation.TextExpression(property.article));
          singular.push(space);
        }
        let renderedProperty = new Notation.TextExpression(property.singular);
        if (property.definitionRef) {
          this.addSemanticLink(renderedProperty, property.definitionRef);
        }
        singular.push(renderedProperty);
        if (property.plural) {
          renderedProperty = new Notation.TextExpression(property.plural);
          if (property.definitionRef) {
            this.addSemanticLink(renderedProperty, property.definitionRef);
          }
        }
        plural.push(renderedProperty);
      }
    }
  }

  private renderConstraintMenuItem(expressions: Fmt.Expression[], firstObjectParam: Fmt.Parameter): Notation.RenderedExpression {
    let constraintDefinitionPromise: CachedPromise<Fmt.Definition | undefined> = CachedPromise.resolve(undefined);
    let constraint: Fmt.Expression | undefined = undefined;
    let negationCount = 0;
    if (expressions.length) {
      constraint = expressions[0];
      while (constraint instanceof FmtHLM.MetaRefExpression_not) {
        constraint = constraint.formula;
        negationCount++;
      }
      if (constraint instanceof Fmt.DefinitionRefExpression) {
        constraintDefinitionPromise = this.utils.getDefinition(constraint.path);
      }
    }
    return new Notation.PromiseExpression(constraintDefinitionPromise.then((constraintDefinition: Fmt.Definition | undefined) => {
      if (constraintDefinition) {
        let constraintProperty = this.renderUtils.getConstraintProperty(firstObjectParam, constraint as Fmt.DefinitionRefExpression, negationCount, constraintDefinition);
        if (constraintProperty && !constraintProperty.isFeature) {
          let property: string | undefined = undefined;
          if (constraintProperty.property) {
            property = constraintProperty.property;
          } else if (expressions.length === 1) {
            if (constraintProperty.singular) {
              property = constraintProperty.singular;
              if (constraintProperty.article) {
                property = constraintProperty.article + ' ' + property;
              }
            }
          } else {
            if (constraintProperty.plural) {
              property = constraintProperty.plural;
            }
          }
          if (property) {
            return new Notation.TextExpression(property);
          }
        }
      }
      let renderedFormulas = expressions.map((expression: Fmt.Expression) => this.renderFormulaInternal(expression)[0]!);
      return this.renderGroup(renderedFormulas, ', ');
    }));
  }

  private getNotationDefinitionRef(type: Fmt.Expression): Fmt.Expression | undefined {
    if (type instanceof FmtHLM.MetaRefExpression_Element || type instanceof FmtHLM.MetaRefExpression_Binding) {
      return type._set;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      return type.element;
    } else {
      return undefined;
    }
  }

  renderVariableDefinitions(parameters: Fmt.Parameter[], indices?: Notation.RenderedExpression[], markAsDummy: boolean = false, parameterList?: Fmt.ParameterList, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
    let items = parameters.map((param) => this.renderVariable(param, indices, true, markAsDummy, parameterList, elementParameterOverrides));
    return this.renderGroup(items);
  }

  renderVariable(param: Fmt.Parameter, indices?: Notation.RenderedExpression[], isDefinition: boolean = false, isDummy: boolean = false, parameterList?: Fmt.ParameterList, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
    if (elementParameterOverrides) {
      let variableOverride = elementParameterOverrides.get(param);
      if (variableOverride) {
        let termPromise = variableOverride.then((term: Fmt.Expression) => this.readOnlyRenderer.renderElementTerm(term, fullElementTermSelection));
        return new Notation.PromiseExpression(termPromise);
      }
    }
    return super.renderVariable(param, indices, isDefinition, isDummy, parameterList);
  }

  renderDefinedSymbol(definitions: Fmt.Definition[]): Notation.RenderedExpression {
    let innerDefinition = definitions[definitions.length - 1];
    let contents = innerDefinition.contents as FmtHLM.ObjectContents_Definition;
    let definitionRef = this.renderDefinitionRef(definitions);
    let onSetNotation = (notation: Fmt.Expression | undefined) => {
      if (notation) {
        let referencedParams = this.utils.findReferencedParameters(notation);
        for (let definition of definitions) {
          this.utils.markUnreferencedParametersAsAuto(definition.parameters, referencedParams);
        }
      }
      contents.notation = notation;
    };
    let onGetDefault = () => this.renderDefaultDefinitionRef(definitions);
    let onGetVariables = () => {
      let parameters: Fmt.Parameter[] = [];
      for (let definition of definitions) {
        parameters.push(...definition.parameters);
      }
      let variables: RenderedVariable[] = [];
      this.addRenderedVariables(parameters, variables);
      return variables;
    };
    let isPredicate = contents instanceof FmtHLM.ObjectContents_Predicate;
    this.setDefinitionSemanticLink(definitionRef, innerDefinition, contents.notation, onSetNotation, onGetDefault, onGetVariables, isPredicate);
    return definitionRef;
  }

  renderSetTerm(term: Fmt.Expression, termSelection: SetTermSelection): Notation.RenderedExpression {
    let result = this.renderSetTermInternal(term, false);
    if (!result) {
      return new Notation.ErrorExpression('Unknown expression type');
    }
    let semanticLink = this.addSemanticLink(result, term);
    if (this.editHandler) {
      let onRenderTerm = (expression: Fmt.Expression) => this.renderSetTermInternal(expression, true)!;
      this.editHandler.addSetTermMenu(semanticLink, term, onRenderTerm, termSelection);
    }
    return result;
  }

  renderSetTermInternal(term: Fmt.Expression, markParametersAsDummy: boolean): Notation.RenderedExpression | undefined {
    if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
      let termSelection: ElementTermSelection = {
        allowCases: false,
        allowConstructors: true
      };
      let items = term.terms ? term.terms.map((item) => this.renderElementTerm(item, termSelection)) : [];
      if (this.editHandler) {
        let onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression)!;
        this.editHandler.addEnumerationInsertButton(items, term, onRenderTerm, termSelection);
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
        allowCases: false,
        allowConstructors: true
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
          return new Notation.PlaceholderExpression(HLMExpressionType.SetTerm);
        }
      };
      return this.renderStructuralCases(term.term, term.construction, term.cases, renderCase);
    } else if (term instanceof FmtHLM.MetaRefExpression_setAssociative) {
      let result = this.renderSetTermInternal(term.term, markParametersAsDummy);
      if (result) {
        result = new Notation.DecoratedExpression(result);
        this.addSemanticLink(result, term.term);
      }
      return result;
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderElementTerm(term: Fmt.Expression, termSelection: ElementTermSelection): Notation.RenderedExpression {
    let result = this.renderElementTermInternal(term);
    if (!result) {
      return new Notation.ErrorExpression('Unknown expression type');
    }
    let semanticLink = this.addSemanticLink(result, term);
    if (this.editHandler) {
      let onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression)!;
      this.editHandler.addElementTermMenu(semanticLink, term, onRenderTerm, termSelection);
    }
    return result;
  }

  renderElementTermInternal(term: Fmt.Expression): Notation.RenderedExpression | undefined {
    if (term instanceof FmtHLM.MetaRefExpression_cases) {
      let rows = term.cases.map((item) => {
        let value = this.renderElementTerm(item.value, fullElementTermSelection);
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: false
        };
        let formula = this.renderFormula(item.formula, formulaSelection);
        return this.buildCaseRow(value, formula);
      });
      if (this.editHandler) {
        rows.push([this.editHandler.getCaseInsertButton(term)]);
      }
      return this.renderTemplate('Cases', {
                                   'cases': rows
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      let renderCase = (value: Fmt.Expression | undefined) => {
        if (value) {
          return this.renderElementTerm(value, fullElementTermSelection);
        } else {
          return new Notation.PlaceholderExpression(HLMExpressionType.ElementTerm);
        }
      };
      return this.renderStructuralCases(term.term, term.construction, term.cases, renderCase);
    } else if (term instanceof FmtHLM.MetaRefExpression_asElementOf) {
      return this.renderElementTermInternal(term.term);
    } else if (term instanceof FmtHLM.MetaRefExpression_associative) {
      let result = this.renderElementTermInternal(term.term);
      if (result) {
        result = new Notation.DecoratedExpression(result);
        this.addSemanticLink(result, term.term);
      }
      return result;
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderFormula(formula: Fmt.Expression, formulaSelection: FormulaSelection, replaceAssociativeArg?: Notation.RenderedExpression): Notation.RenderedExpression {
    let [result, innerFormula] = this.renderFormulaInternal(formula, replaceAssociativeArg);
    if (!result) {
      return new Notation.ErrorExpression('Unknown expression type');
    }
    let semanticLink = this.addSemanticLink(result, formula);
    if (this.editHandler) {
      let onRenderFormula = (expression: Fmt.Expression) => this.renderFormulaInternal(expression)[0]!;
      this.editHandler.addFormulaMenu(semanticLink, formula, onRenderFormula, formulaSelection);
    }
    this.addSemanticLink(result, innerFormula);
    return result;
  }

  private renderFormulaInternal(formula: Fmt.Expression, replaceAssociativeArg?: Notation.RenderedExpression): [Notation.RenderedExpression | undefined, Fmt.Expression] {
    let negationCount = 0;
    while (formula instanceof FmtHLM.MetaRefExpression_not) {
      let innerFormula = formula.formula;
      if (innerFormula instanceof Fmt.VariableRefExpression
          || innerFormula instanceof Fmt.PlaceholderExpression
          || ((innerFormula instanceof FmtHLM.MetaRefExpression_setEquals || innerFormula instanceof FmtHLM.MetaRefExpression_equals)
              && innerFormula.terms.length !== 2)
          || formula instanceof FmtHLM.MetaRefExpression_structural) {
        break;
      }
      negationCount++;
      formula = innerFormula;
    }
    let result = this.renderFormulaWithNegationCount(formula, negationCount, replaceAssociativeArg);
    if (result) {
      result.optionalParenStyle = '[]';
    }
    return [result, formula];
  }

  private renderFormulaWithNegationCount(formula: Fmt.Expression, negationCount: number, replaceAssociativeArg?: Notation.RenderedExpression): Notation.RenderedExpression | undefined {
    if (formula instanceof FmtHLM.MetaRefExpression_not) {
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderTemplate('Negation', {
                                   'operand': this.renderFormula(formula.formula, formulaSelection)
                                 }, negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and) {
      if (formula.formulas) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        let operands: Notation.RenderedExpression[] = [];
        let prevItem: Notation.RenderedExpression | undefined = undefined;
        for (let item of formula.formulas) {
          if (this.hasAssociativeArg(item)) {
            operands.pop();
          } else {
            prevItem = undefined;
          }
          prevItem = this.renderFormula(item, formulaSelection, prevItem);
          operands.push(prevItem);
        }
        return this.renderTemplate('Conjunction', {
                                     'operands': operands
                                   }, negationCount);
      } else {
        return this.renderTemplate('True', {}, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_or) {
      if (formula.formulas) {
        let formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        let operands = formula.formulas.map((item) => this.renderFormula(item, formulaSelection));
        return this.renderTemplate('Disjunction', {
                                     'operands': operands
                                   }, negationCount);
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
                                   'operands': [
                                     this.renderFormula(formula.left, formulaSelection),
                                     this.renderFormula(formula.right, formulaSelection)
                                   ]
                                 }, negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: true,
        allowCases: true
      };
      return this.renderTemplate('UniversalQuantification', {
                                   'parameters': this.renderParameterList(formula.parameters, false, true, true),
                                   'formula': this.renderFormula(formula.formula, formulaSelection)
                                 }, negationCount);
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
                                   }, negationCount);
      } else {
        return this.renderTemplate('PlainExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false)
                                   }, negationCount);
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
                                   }, negationCount);
      } else {
        return this.renderTemplate('PlainUniqueExistentialQuantification', {
                                     'parameters': this.renderParameterList(formula.parameters, false, true, false)
                                   }, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      let elementTermSelection: ElementTermSelection = {
        allowCases: false,
        allowConstructors: true
      };
      let setTermSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: false,
        allowCases: true
      };
      return this.renderTemplate('ElementRelation', {
                                   'operands': [
                                     this.renderElementTerm(formula.element, elementTermSelection),
                                     this.renderSetTerm(formula._set, setTermSelection)
                                   ]
                                 }, negationCount);
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
                                   'operands': [
                                     this.renderSetTerm(formula.subset, subsetTermSelection),
                                     this.renderSetTerm(formula.superset, supersetTermSelection)
                                   ]
                                 }, negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_setEquals) {
      return this.renderTemplate('EqualityRelation', {
                                   'operands': formula.terms.map((item) => this.renderSetTerm(item, fullSetTermSelection))
                                 }, negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_equals) {
      return this.renderTemplate('EqualityRelation', {
                                   'operands': formula.terms.map((item) => this.renderElementTerm(item, fullElementTermSelection))
                                 }, negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_structural) {
      let renderCase = (value: Fmt.Expression | undefined) => {
        if (value) {
          return this.renderFormula(value, fullFormulaSelection);
        } else {
          return new Notation.PlaceholderExpression(HLMExpressionType.Formula);
        }
      };
      return this.renderStructuralCases(formula.term, formula.construction, formula.cases, renderCase);
    } else {
      return this.renderGenericExpression(formula, 0, negationCount, undefined, replaceAssociativeArg);
    }
  }

  private renderStructuralCases(term: Fmt.Expression, construction: Fmt.Expression, cases: FmtHLM.ObjectContents_StructuralCase[], renderCase: (value: Fmt.Expression | undefined) => Notation.RenderedExpression): Notation.RenderedExpression {
    let termSelection: ElementTermSelection = {
      allowCases: false,
      allowConstructors: false
    };
    let termNotation = this.renderElementTerm(term, termSelection);
    let rows: Notation.RenderedExpression[][];
    if (cases.length) {
      rows = cases.map((structuralCase) => {
        let constructorNotation: Notation.RenderedExpression;
        if (construction instanceof Fmt.DefinitionRefExpression) {
          let constructorPromise = this.utils.getStructuralCaseTerm(construction.path, structuralCase);
          let constructorNotationPromise = constructorPromise.then((constructorExpr: Fmt.Expression) => this.renderElementTerm(constructorExpr, termSelection));
          constructorNotation = new Notation.PromiseExpression(constructorNotationPromise);
        } else {
          constructorNotation = new Notation.TextExpression('…');
        }
        let formula = this.renderTemplate('EqualityRelation', {
                                            'operands': [termNotation, constructorNotation]
                                          });
        let value = renderCase(structuralCase.value);
        let row = this.buildCaseRow(value, formula);
        if (structuralCase.parameters) {
          this.addCaseParameters(structuralCase.parameters, undefined, row);
        }
        return row;
      });
    } else {
      let formula = this.renderTemplate('EqualityRelation', {
                                          'operands': [termNotation, new Notation.TextExpression('…')]
                                        });
      if (this.editHandler && this.editHandler.isTemporaryExpression(term)) {
        let row = this.buildCaseRow(renderCase(undefined), formula);
        let ellipsis = new Notation.TextExpression('⋮');
        ellipsis.styleClasses = ['ellipsis'];
        let ellipsisRow = [ellipsis, ellipsis];
        rows = [row, ellipsisRow];
      } else {
        let ellipsis = new Notation.TextExpression('…');
        let row = this.buildCaseRow(ellipsis, formula);
        rows = [row];
      }
    }
    if (rows.length === 1) {
      return this.renderTemplate('SingleCase', {
                                   'case': rows[0]
                                 });
    } else {
      return this.renderTemplate('Cases', {
                                   'cases': rows
                                 });
    }
  }

  private addCaseParameters(parameters: Fmt.Parameter[], elementParameterOverrides: ElementParameterOverrides | undefined, row: Notation.RenderedExpression[]): void {
    if (parameters.length) {
      let extractedConstraints: Fmt.Parameter[] = [];
      let extractedParameters = this.renderUtils.extractConstraints(parameters, extractedConstraints);
      if (extractedConstraints.length <= 1 || !extractedParameters.length) {
        extractedConstraints = [];
        extractedParameters = parameters;
      }
      let parameterList = this.readOnlyRenderer.renderParameters(extractedParameters, false, false, false, elementParameterOverrides);
      if (extractedConstraints.length) {
        let caseRow = [parameterList, new Notation.TextExpression(' with suitable conditions')];
        parameterList = new Notation.RowExpression(caseRow);
      }
      let caseParameters = new Notation.ParenExpression(parameterList, '()');
      caseParameters.styleClasses = ['case-parameters'];
      row.push(caseParameters);
    }
  }

  private renderGenericExpression(expression: Fmt.Expression, omitArguments: number = 0, negationCount: number = 0, parameterOverrides?: ParameterOverrides, replaceAssociativeArg?: Notation.RenderedExpression): Notation.RenderedExpression | undefined {
    if (expression instanceof Fmt.VariableRefExpression) {
      // TODO #65
      let indices = /*expression.indices ? expression.indices.map((index: Fmt.ArgumentList) => this.renderArgumentList(index)) :*/ undefined;
      let isDefinition = expression instanceof DefinitionVariableRefExpression;
      let elementParameterOverrides = parameterOverrides?.elementParameterOverrides;
      return this.renderVariable(expression.variable, indices, isDefinition, false, undefined, elementParameterOverrides);
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      let childPaths: Fmt.Path[] = [];
      this.utils.splitPath(expression.path, childPaths);
      let definitionPromise = this.utils.getDefinition(childPaths[0]);
      let expressionPromise = definitionPromise.then((definition) => {
        let definitions: Fmt.Definition[] = [];
        let argumentLists: Fmt.ArgumentList[] = [];
        this.utils.analyzeDefinitionRefPath(childPaths, definition, definitions, argumentLists);
        let macroInvocation: HLMMacro.HLMMacroInvocation | undefined = undefined;
        if (definitions.length === 1 && definitions[0].contents instanceof FmtHLM.ObjectContents_MacroOperator) {
          macroInvocation = this.utils.getMacroInvocation(expression, definitions[0]);
        }
        return this.renderDefinitionRef(definitions, argumentLists, omitArguments, negationCount, parameterOverrides, replaceAssociativeArg, macroInvocation);
      });
      return new Notation.PromiseExpression(expressionPromise);
    } else if (expression instanceof FmtHLM.MetaRefExpression_previous) {
      return new Notation.TextExpression('…');
    } else if (expression instanceof Fmt.PlaceholderExpression) {
      return new Notation.PlaceholderExpression(expression.placeholderType);
    } else {
      return undefined;
    }
  }

  renderExpression(expression: Fmt.Expression): Notation.RenderedExpression {
    let result: Notation.RenderedExpression | undefined;
    if (expression instanceof Fmt.DefinitionRefExpression && !expression.path.arguments.length) {
      let definitionPromise = this.utils.getDefinition(expression.path);
      let expressionPromise = definitionPromise.then((definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
          return this.renderDefinitionRef([definition], undefined, 2);
        } else {
          return this.libraryDataAccessor.getItemInfo(expression.path).then((itemInfo: LibraryItemInfo) => {
            let itemNumber = new Notation.TextExpression(formatItemNumber(itemInfo.itemNumber));
            this.addSemanticLink(itemNumber, definition);
            return itemNumber;
          });
        }
      });
      result = new Notation.PromiseExpression(expressionPromise);
    } else {
      result = this.renderGenericExpression(expression);
      if (!result) {
        result = this.renderSetTermInternal(expression, false);
      }
      if (!result) {
        result = this.renderElementTermInternal(expression);
      }
      if (!result) {
        result = this.renderFormulaInternal(expression)[0];
      }
      if (!result) {
        return new Notation.ErrorExpression('Unknown expression type');
      }
    }
    this.addSemanticLink(result, expression);
    return result;
  }

  renderExampleExpression(expression: Fmt.DefinitionRefExpression): Notation.RenderedExpression {
    let definitionPromise = this.utils.getDefinition(expression.path);
    let expressionPromise = definitionPromise.then((definition) => {
      return this.renderDefinitionRef([definition]);
    });
    let result = new Notation.PromiseExpression(expressionPromise);
    this.addSemanticLink(result, expression);
    return result;
  }

  private renderDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: number = 0, negationCount: number = 0, parameterOverrides?: ParameterOverrides, replaceAssociativeArg?: Notation.RenderedExpression, macroInvocation?: HLMMacro.HLMMacroInvocation): Notation.RenderedExpression {
    let result: Notation.RenderedExpression | undefined = undefined;
    let definition = definitions[definitions.length - 1];
    let options: ArgumentRenderingOptions = {
      ...parameterOverrides,
      argumentLists: argumentLists,
      omitArguments: omitArguments,
      replaceAssociativeArg: replaceAssociativeArg,
      macroInvocation: macroInvocation
    };
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition && definition.contents.notation) {
      result = this.renderDefinitionNotationExpression(definition.contents.notation, definitions, options, negationCount);
    }
    if (!result) {
      result = this.renderDefaultDefinitionRef(definitions, options, negationCount);
    }
    if (definitions[0] === this.definition) {
      this.addSemanticLink(result, definition);
    }
    return result;
  }

  private renderDefaultDefinitionRef(definitions: Fmt.Definition[], options: ArgumentRenderingOptions = {}, negationCount: number = 0): Notation.RenderedExpression {
    let definition = definitions[definitions.length - 1];
    let name = definition.name.split(' ').join('-');
    let result: Notation.RenderedExpression = new Notation.TextExpression(name);
    if (definition.contents instanceof FmtHLM.ObjectContents_Constructor) {
      result.styleClasses = ['ctor'];
    }
    if (definitions.length > 1) {
      result = this.renderTemplate('SubSup', {
                                     'body': result,
                                     'sub': this.renderDefinitionRef(definitions.slice(0, -1), options.argumentLists?.slice(0, -1))
                                   });
    }
    if (!options.omitArguments) {
      let args: RenderedTemplateArgument[] = [];
      this.fillArguments(definition.parameters, options, undefined, args);
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

  private renderDefinitionNotationExpression(notation: Fmt.Expression, definitions: Fmt.Definition[], options: ArgumentRenderingOptions = {}, negationCount: number = 0): Notation.RenderedExpression {
    let args = this.getRenderedTemplateArguments(definitions, options);
    let result = this.renderNotationExpression(notation, args, options.omitArguments, negationCount);
    return this.applyAbbreviations(result, definitions[definitions.length - 1], args, options.omitArguments, negationCount);
  }

  private getRenderedTemplateArguments(definitions: Fmt.Definition[], options: ArgumentRenderingOptions = {}): RenderedTemplateArguments {
    let args: RenderedTemplateArguments = {};
    let index = 0;
    for (let curDefinition of definitions) {
      let curReplacementParameters = index === definitions.length - 1 ? options.replacementParameters : undefined;
      let curOptions: ArgumentRenderingOptions = {
        ...options,
        replacementParameters: curReplacementParameters,
        elementParameterOverrides: index === definitions.length - 1 ? options.elementParameterOverrides : undefined,
        argumentLists: options.argumentLists && !curReplacementParameters ? options.argumentLists.slice(0, index + 1) : undefined
      };
      let curParams: Fmt.Parameter[] = [];
      let curArgs: RenderedTemplateArgument[] = [];
      this.fillArguments(curDefinition.parameters, curOptions, curParams, curArgs);
      for (let paramIndex = 0; paramIndex < curParams.length; paramIndex++) {
        let curParam = curParams[paramIndex];
        args[curParam.name] = curArgs[paramIndex];
      }
      index++;
    }
    return args;
  }

  private renderArgumentList(parameters: Fmt.ParameterList, argumentList?: Fmt.ArgumentList, indices?: Notation.RenderedExpression[]): Notation.RenderedExpression {
    let options: ArgumentRenderingOptions = {
      argumentLists: argumentList ? [argumentList] : undefined,
      indices: indices,
      combineBindings: true
    };
    let args: RenderedTemplateArgument[] = [];
    this.fillArguments(parameters, options, undefined, args);
    if (args.length === 1) {
      return ArgumentWithInfo.getValue(args[0]);
    } else {
      return this.renderTemplate('Tuple', {'items': args});
    }
  }

  private renderArgumentDefinitionList(parameters: Fmt.ParameterList, argumentList: Fmt.ArgumentList): Notation.RenderedExpression {
    let options: ArgumentRenderingOptions = {
      argumentLists: [argumentList],
      combineBindings: true
    };
    let params: Fmt.Parameter[] = [];
    let args: RenderedTemplateArgument[] = [];
    // TODO handle bindings better
    this.fillArguments(parameters, options, params, args);
    let items = params.map((param: Fmt.Parameter, index: number) =>
      this.renderTemplate('EqualityDefinition', {
        'operands': [
          this.renderVariable(param),
          ArgumentWithInfo.getValue(args[index])
        ]
      }));
    return this.renderGroup(items, ', ');
  }

  private fillArguments(parameters: Fmt.ParameterList, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    let replacementParams = options.replacementParameters?.parameters;
    let index = 0;
    for (let param of parameters) {
      let replacementParam = replacementParams ? replacementParams[index] : undefined;
      this.fillArgument(param, replacementParam, options, resultParams, resultArgs);
      index++;
    }
  }

  private fillArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    let type = (param ?? replacementParam).type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      this.fillBindingArgument(param, replacementParam, type, options, resultParams, resultArgs);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      this.fillBinderArgument(param, replacementParam, type, options, resultParams, resultArgs);
    } else if (this.utils.isValueParamType(type)
               || type instanceof FmtHLM.MetaRefExpression_Nat) {
      this.fillRegularArgument(param, replacementParam, type, options, resultParams, resultArgs);
    }
  }

  private fillBindingArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, type: FmtHLM.MetaRefExpression_Binding, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    let parameter: Fmt.Parameter | undefined = undefined;
    let bindingArgumentList: Fmt.ArgumentList | undefined = undefined;
    let newIndices = options.indices;
    if (options.argumentLists) {
      let arg = this.utils.getArgument(options.argumentLists, param, FmtHLM.ObjectContents_BindingArg);
      if (arg) {
        parameter = arg.parameter;
        bindingArgumentList = arg.arguments;
      }
    } else {
      parameter = replacementParam || param;
      newIndices = options.indices ? options.indices.slice() : [];
      newIndices.push(this.renderVariable(parameter, undefined, false, !!options.omitArguments));
    }
    if (resultParams) {
      resultParams.push(param);
    }
    if (parameter && (bindingArgumentList || !options.argumentLists)) {
      let elementParameterOverrides = options.elementParameterOverrides;
      if (bindingArgumentList && !options.indices) {
        if (!elementParameterOverrides) {
          elementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
        }
        bindingArgumentList = this.renderUtils.convertBoundStructuralCasesToOverrides([parameter], bindingArgumentList, elementParameterOverrides);
      }
      let variableDefinition = this.renderVariable(parameter, undefined, options.argumentLists !== undefined, !!options.omitArguments, undefined, elementParameterOverrides);
      if (options.combineBindings) {
        resultArgs.push(this.renderTemplate('Binding', {
                                              'variable': variableDefinition,
                                              'value': this.renderArgumentList(type.parameters, bindingArgumentList, newIndices)
                                            }));
      } else {
        resultArgs.push(variableDefinition);
        let bindingRenderingOptions: ArgumentRenderingOptions = {
          ...options,
          elementParameterOverrides: elementParameterOverrides,
          argumentLists: bindingArgumentList ? [bindingArgumentList] : undefined,
          indices: newIndices
        };
        if (replacementParam) {
          let replacementParamType = replacementParam.type.expression as FmtHLM.MetaRefExpression_Binding;
          bindingRenderingOptions.replacementParameters = {
            parameters: replacementParamType.parameters,
            isDefinition: options.replacementParameters!.isDefinition
          };
        }
        this.fillArguments(type.parameters, bindingRenderingOptions, resultParams, resultArgs);
      }
    } else {
      resultArgs.push(new Notation.ErrorExpression('Undefined argument'));
    }
  }

  private fillBinderArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, type: FmtHLM.MetaRefExpression_Binder, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    let sourceParameters: Fmt.ParameterList | undefined = undefined;
    let targetArguments: Fmt.ArgumentList | undefined = undefined;
    let newIndices = options.indices;
    if (options.argumentLists) {
      let arg = this.utils.getArgument(options.argumentLists, param, FmtHLM.ObjectContents_BinderArg);
      if (arg) {
        sourceParameters = arg.sourceParameters;
        targetArguments = arg.targetArguments;
      }
    } else {
      sourceParameters = type.sourceParameters;
      newIndices = this.addIndices(type, options.indices, !!options.omitArguments);
    }
    if (resultParams) {
      resultParams.push(param);
    }
    if (sourceParameters && (targetArguments || !options.argumentLists)) {
      let elementParameterOverrides = options.elementParameterOverrides;
      if (targetArguments && !options.indices) {
        if (!elementParameterOverrides) {
          elementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
        }
        // TODO #65
        //targetArguments = this.renderUtils.convertBoundStructuralCasesToOverrides([parameter], targetArguments, elementParameterOverrides);
      }
      // TODO #65
      //let variableDefinition = this.renderVariable(parameter, undefined, options.argumentLists !== undefined, !!options.omitArguments, undefined, elementParameterOverrides);
      resultArgs.push(this.renderTemplate('Binding', {
                                            // TODO #65 honor rendering options corresponding to renderVariable
                                            'variable': this.renderArgumentList(sourceParameters),
                                            'value': this.renderArgumentList(type.targetParameters, targetArguments, newIndices)
                                          }));
      let sourceOptions: ArgumentRenderingOptions = {
        ...options,
        argumentLists: undefined,
        indices: undefined
      };
      this.fillArguments(sourceParameters, sourceOptions, resultParams, resultArgs);
      let targetOptions: ArgumentRenderingOptions = {
        ...options,
        elementParameterOverrides: elementParameterOverrides,
        argumentLists: targetArguments ? [targetArguments] : undefined,
        indices: newIndices
      };
      this.fillArguments(type.targetParameters, targetOptions, resultParams, resultArgs);
    } else {
      resultArgs.push(new Notation.ErrorExpression('Undefined argument'));
    }
  }

  private fillRegularArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, type: Fmt.Expression, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    if (resultParams) {
      resultParams.push(param);
    }
    let paramToDisplay = replacementParam || param;
    let elementParameterOverrides = options.elementParameterOverrides;
    if (elementParameterOverrides) {
      let variableOverride = elementParameterOverrides.get(paramToDisplay);
      if (variableOverride) {
        let termPromise = variableOverride.then((term: Fmt.Expression) => this.readOnlyRenderer.renderElementTerm(term, fullElementTermSelection));
        resultArgs.push(new Notation.PromiseExpression(termPromise));
        return;
      }
    }
    if (options.argumentLists) {
      let rawArg: Fmt.Expression | undefined = undefined;
      let index = 0;
      for (let argumentList of options.argumentLists) {
        for (let curArg of argumentList) {
          if (curArg.name === param.name) {
            rawArg = curArg.value;
            break;
          }
          index++;
        }
      }
      if (rawArg) {
        let onGetValue = () => this.getRegularArgumentResult(rawArg!, param, type, param.type.arrayDimensions, options.replaceAssociativeArg, options.macroInvocation);
        resultArgs.push(new ArgumentWithInfo(onGetValue, index));
      } else {
        resultArgs.push(new Notation.ErrorExpression('Undefined argument'));
      }
    } else {
      let isDefinition = options.replacementParameters?.isDefinition;
      resultArgs.push(this.renderVariable(paramToDisplay, options.indices, isDefinition, !!options.omitArguments, undefined, elementParameterOverrides));
    }
  }

  private getRegularArgumentResult(rawArg: Fmt.Expression, param: Fmt.Parameter, type: Fmt.Expression, remainingArrayDimensions: number, replaceAssociativeArg?: Notation.RenderedExpression, macroInvocation?: HLMMacro.HLMMacroInvocation): Notation.ExpressionValue {
    if (remainingArrayDimensions) {
      if (rawArg instanceof Fmt.ArrayExpression) {
        let innerArrayDimensions = remainingArrayDimensions - 1;
        let result: Notation.ExpressionValue[] = [];
        let index = 0;
        for (let item of rawArg.items) {
          if (this.options.maxListLength && index >= this.options.maxListLength) {
            let ellipsis = this.renderTemplate('BottomEllipsis');
            ellipsis.styleClasses = ['dummy'];
            result.push(ellipsis);
            break;
          }
          let renderedItem = this.getRegularArgumentResult(item, param, type, innerArrayDimensions, undefined, macroInvocation);
          if (!innerArrayDimensions) {
            this.addSemanticLink(renderedItem, item);
          }
          result.push(renderedItem);
          index++;
        }
        if (this.editHandler && macroInvocation) {
          this.editHandler.addArrayArgumentInsertButton(result, param, macroInvocation, rawArg, innerArrayDimensions);
        }
        return result;
      } else {
        return new Notation.ErrorExpression('Array expression expected');
      }
    } else {
      return this.renderRegularArgument(rawArg, type, replaceAssociativeArg);
    }
  }

  private renderRegularArgument(rawArg: Fmt.Expression, type: Fmt.Expression, replaceAssociativeArg?: Notation.RenderedExpression): Notation.RenderedExpression {
    if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      let arg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_PropArg);
      let formulaSelection: FormulaSelection = {
        allowTruthValue: true,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderFormula(arg.formula, formulaSelection);
    } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
      let arg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_SetArg);
      if (replaceAssociativeArg && arg._set instanceof FmtHLM.MetaRefExpression_setAssociative) {
        return new Notation.DecoratedExpression(replaceAssociativeArg);
      }
      return this.renderSetTerm(arg._set, fullSetTermSelection);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      let arg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_SubsetArg);
      if (replaceAssociativeArg && arg._set instanceof FmtHLM.MetaRefExpression_setAssociative) {
        return new Notation.DecoratedExpression(replaceAssociativeArg);
      }
      return this.renderSetTerm(arg._set, fullSetTermSelection);
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      let arg = this.utils.convertArgument(rawArg, FmtHLM.ObjectContents_ElementArg);
      if (replaceAssociativeArg && arg.element instanceof FmtHLM.MetaRefExpression_associative) {
        return new Notation.DecoratedExpression(replaceAssociativeArg);
      }
      return this.renderElementTerm(arg.element, fullElementTermSelection);
    } else if (type instanceof FmtHLM.MetaRefExpression_Nat) {
      let result: Notation.TextExpression;
      if (rawArg instanceof Fmt.PlaceholderExpression) {
        result = new Notation.TextExpression('');
        result.requestTextInput = true;
      } else {
        let arg = rawArg as Fmt.IntegerExpression;
        result = this.renderInteger(arg.value);
      }
      if (this.editHandler) {
        this.editHandler.addIntegerEditor(result, rawArg, false);
      }
      return result;
    } else {
      return new Notation.ErrorExpression('Unhandled parameter type');
    }
  }

  private addIndices(type: FmtHLM.MetaRefExpression_Binder, indices: Notation.RenderedExpression[] | undefined, markAsDummy: boolean = false): Notation.RenderedExpression[] {
    let result: Notation.RenderedExpression[] = indices ? indices.slice() : [];
    for (let sourceParam of type.sourceParameters) {
      if (this.utils.isValueParamType(sourceParam.type.expression)) {
        result.push(this.renderVariable(sourceParam, undefined, false, markAsDummy));
      }
    }
    return result;
  }

  private hasAssociativeArg(expression: Fmt.Expression): boolean {
    while (expression instanceof FmtHLM.MetaRefExpression_not) {
      expression = expression.formula;
    }
    if (expression instanceof Fmt.DefinitionRefExpression) {
      for (let arg of expression.path.arguments) {
        if (arg.value instanceof Fmt.CompoundExpression) {
          for (let compoundArg of arg.value.arguments) {
            if (compoundArg.value instanceof FmtHLM.MetaRefExpression_setAssociative || compoundArg.value instanceof FmtHLM.MetaRefExpression_associative) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private applyAbbreviations(expression: Notation.RenderedExpression, definition: Fmt.Definition, args: RenderedTemplateArguments, omitArguments: number = 0, negationCount: number = 0): Notation.RenderedExpression {
    if (!omitArguments) {
      let innerDefinitionContents = definition.contents;
      if (innerDefinitionContents instanceof FmtHLM.ObjectContents_Definition && innerDefinitionContents.abbreviations) {
        for (let abbreviationExpression of innerDefinitionContents.abbreviations) {
          if (abbreviationExpression instanceof Fmt.CompoundExpression) {
            let abbreviation = new FmtNotation.ObjectContents_NotationAbbreviation;
            abbreviation.fromCompoundExpression(abbreviationExpression);
            if (abbreviation.originalParameter instanceof Fmt.VariableRefExpression) {
              let abbreviationArgs: RenderedTemplateArguments = {...args};
              for (let abbreviationParam of abbreviation.parameters) {
                abbreviationArgs[abbreviationParam.name] = new AbbreviationParamExpression(abbreviationParam);
              }
              let param = abbreviation.originalParameter.variable;
              let arg = ArgumentWithInfo.getValue(args[param.name]);
              let notation = this.renderNotationExpression(abbreviation.originalParameterValue, abbreviationArgs, omitArguments, negationCount);
              let originalExpression = expression;
              let abbreviationPromise = this.renderUtils.matchParameterizedNotation(arg, notation, abbreviationArgs).then((canAbbreviate: boolean) => {
                if (canAbbreviate) {
                  return this.renderNotationExpression(abbreviation.abbreviation, abbreviationArgs, omitArguments, negationCount);
                } else {
                  return originalExpression;
                }
              });
              expression = new Notation.PromiseExpression(abbreviationPromise);
            }
          }
        }
      }
    }
    return expression;
  }

  private addDefinitionContents(paragraphs: Notation.RenderedExpression[], definitionRef: Notation.RenderedExpression, cases: ExtractedStructuralCase[] | undefined, includeExtras: boolean): void {
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

  private renderDefinitionContents(definitionRef: Notation.RenderedExpression, cases: ExtractedStructuralCase[] | undefined): Notation.RenderedExpression | undefined {
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
      let formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      let conditions = contents.conditions;
      let items = conditions.map((formula) => this.renderFormula(formula, formulaSelection));
      let result: Notation.RenderedExpression = new Notation.ListExpression(items, '1.');
      if (this.editHandler) {
        let onInsertDefinition = () => conditions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
        let insertButton = this.editHandler.getImmediateInsertButton(onInsertDefinition);
        result = new Notation.ParagraphExpression([result, insertButton]);
      }
      return result;
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
        if (this.editHandler) {
          rows.push([this.editHandler.getConstructorInsertButton(definition.innerDefinitions)]);
        }
        let construction = this.renderTemplate('Construction', {
                                                 'constructors': rows
                                               });
        return this.renderTemplate('ConstructionDefinition', {
                                     'operands': [definitionRef, construction]
                                   });
      } else {
        let renderDefinitionRef = (elementParameterOverrides?: ElementParameterOverrides) => {
          if (elementParameterOverrides && elementParameterOverrides.size) {
            let parameterOverrides: ParameterOverrides = {
              elementParameterOverrides: elementParameterOverrides
            };
            return this.readOnlyRenderer.renderDefinitionRef([definition], undefined, 0, 0, parameterOverrides);
          }
          return definitionRef;
        };
        let renderLeftSide = renderDefinitionRef;
        if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          let definitions = contents.definition;
          let renderRightSide = (term: Fmt.Expression) => this.renderSetTerm(term, fullSetTermSelection);
          let onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
          return this.renderMultiDefinitions('Equality', cases!, renderLeftSide, renderRightSide, -1, onInsertDefinition);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          let definitions = contents.definition;
          let renderRightSide = (term: Fmt.Expression) => this.renderElementTerm(term, fullElementTermSelection);
          let onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
          return this.renderMultiDefinitionsWithSpecializations('Equality', cases!, renderLeftSide, renderRightSide, -1, onInsertDefinition);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          let parameter = this.renderVariable(contents.parameter);
          let definitions = contents.definition;
          renderLeftSide = (elementParameterOverrides?: ElementParameterOverrides) =>
            this.renderTemplate('EqualityRelation', {
                                  'operands': [renderDefinitionRef(elementParameterOverrides), parameter]
                                });
          let formulaSelection: FormulaSelection = {
            allowTruthValue: false,
            allowEquiv: false,
            allowCases: true
          };
          let renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, formulaSelection);
          let onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
          return this.renderMultiDefinitions('Equivalence', cases!, renderLeftSide, renderRightSide, -3, onInsertDefinition);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          let definitions = contents.definition;
          let formulaSelection: FormulaSelection = {
            allowTruthValue: false,
            allowEquiv: false,
            allowCases: true
          };
          let renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, formulaSelection);
          let onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
          return this.renderMultiDefinitions('Equivalence', cases!, renderLeftSide, renderRightSide, -3, onInsertDefinition);
        } else {
          return new Notation.EmptyExpression;
        }
      }
    } else {
      return new Notation.EmptyExpression;
    }
  }

  private renderMultiDefinitions(type: string, cases: ExtractedStructuralCase[], renderLeftSide: (elementParameterOverrides?: ElementParameterOverrides) => Notation.RenderedExpression, renderRightSide: (expression: Fmt.Expression) => Notation.RenderedExpression, parenLevel: number, onInsertDefinition: () => void): Notation.RenderedExpression {
    let rows: Notation.RenderedExpression[][] = [];
    for (let currentCase of cases) {
      let elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      this.renderUtils.fillVariableOverridesFromExtractedCase(currentCase, elementParameterOverrides);
      let first = true;
      for (let definition of currentCase.definitions) {
        let leftItem: Notation.RenderedExpression;
        if (first) {
          let caseDefinition = renderLeftSide(elementParameterOverrides);
          leftItem = this.renderTemplate(type + 'Definition', {
                                           'operands': [caseDefinition, new Notation.EmptyExpression]
                                         });
          if (rows.length) {
            rows.push([]);
          }
        } else {
          leftItem = this.renderTemplate(type + 'Relation', {
                                           'operands': [new Notation.EmptyExpression, new Notation.EmptyExpression]
                                         });
        }
        let rightItem = new Notation.InnerParenExpression(renderRightSide(definition));
        rightItem.left = true;
        rightItem.right = false;
        rightItem.maxLevel = parenLevel;
        let row = [leftItem, rightItem];
        if (first && currentCase.caseParameters) {
          this.addCaseParameters(currentCase.caseParameters, elementParameterOverrides, row);
        }
        rows.push(row);
        first = false;
      }
    }
    if (this.editHandler) {
      let insertButton = this.editHandler.getImmediateInsertButton(onInsertDefinition);
      rows.push([new Notation.RowExpression([insertButton, new Notation.TextExpression(' ')]), new Notation.EmptyExpression]);
    }
    let result = new Notation.TableExpression(rows);
    result.styleClasses = ['aligned', 'definitions'];
    return result;
  }

  private renderMultiDefinitionsWithSpecializations(type: string, cases: ExtractedStructuralCase[], renderLeftSide: (elementParameterOverrides?: ElementParameterOverrides) => Notation.RenderedExpression, renderRightSide: (expression: Fmt.Expression) => Notation.RenderedExpression, parenLevel: number, onInsertDefinition: () => void): Notation.RenderedExpression {
    if (cases.length === 1) {
      let currentCase = cases[0];
      if (currentCase.definitions.length === 1) {
        let expression = currentCase.definitions[0];
        if (expression instanceof Fmt.DefinitionRefExpression) {
          let definitionRef = expression;
          let promise = this.utils.getOuterDefinition(definitionRef)
            .then((outerDefinition: Fmt.Definition) => {
              let definitions: Fmt.Definition[] = [];
              let argumentLists: Fmt.ArgumentList[] = [];
              this.utils.analyzeDefinitionRef(definitionRef, outerDefinition, definitions, argumentLists);
              let innerDefinition = definitions[definitions.length - 1];
              let innerDefinitionNotation = this.renderUtils.getDefinitionNotation(innerDefinition);
              if (innerDefinitionNotation) {
                let elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
                this.renderUtils.fillVariableOverridesFromExtractedCase(currentCase, elementParameterOverrides);
                let options: ArgumentRenderingOptions = {
                  argumentLists: argumentLists,
                  elementParameterOverrides: elementParameterOverrides
                };
                let args = this.getRenderedTemplateArguments(definitions, options);
                args[innerDefinitionNotation.parameter.name] = renderLeftSide(elementParameterOverrides);
                if (innerDefinitionNotation.notation) {
                  let result = this.renderNotationExpression(innerDefinitionNotation.notation, args);
                  this.addSemanticLink(result, definitionRef);
                  if (this.editHandler) {
                    let insertButton = this.editHandler.getImmediateInsertButton(onInsertDefinition);
                    result = new Notation.ParagraphExpression([result, insertButton]);
                  }
                  return result;
                }
              } else if (outerDefinition !== innerDefinition) {
                let outerDefinitionNotation = this.renderUtils.getDefinitionNotation(outerDefinition);
                if (outerDefinitionNotation && outerDefinitionNotation.singularName && !(outerDefinitionNotation.nameOptional instanceof FmtNotation.MetaRefExpression_true)) {
                  let singular: Notation.RenderedExpression[] = [];
                  let options: ArgumentRenderingOptions = {
                    argumentLists: argumentLists
                  };
                  let args = this.getRenderedTemplateArguments(definitions, options);
                  this.applyName(outerDefinitionNotation.singularName, args, definitionRef, singular);
                  let renderRightSideOrig = renderRightSide;
                  renderRightSide = (rightSideExpression: Fmt.Expression) => {
                    let row = [renderRightSideOrig(rightSideExpression)];
                    this.addNounDefinition(singular, undefined, false, false, row);
                    return new Notation.RowExpression(row);
                  };
                }
              }
              return this.renderMultiDefinitions(type, cases, renderLeftSide, renderRightSide, parenLevel, onInsertDefinition);
            });
          return new Notation.PromiseExpression(promise);
        }
      }
    }
    return this.renderMultiDefinitions(type, cases, renderLeftSide, renderRightSide, parenLevel, onInsertDefinition);
  }

  private addDefinitionProofs(cases: ExtractedStructuralCase[] | undefined, paragraphs: Notation.RenderedExpression[]): void {
    let definition = this.definition;
    let contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      this.addProofs(contents.proofs, 'Proof', contents.claim, paragraphs);
    } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      this.addEquivalenceProofs(contents.equivalenceProofs, 'Proof', '⇒', paragraphs);
    } else if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
      if (contents.definition.length > 1) {
        this.addEquivalenceProofs(contents.equalityProofs, 'Equality', '⊆', paragraphs);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
      if (contents.definition.length > 1) {
        this.addEquivalenceProofs(contents.equalityProofs, 'Equality', '=', paragraphs);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
      if (contents.definition.length > 1) {
        this.addEquivalenceProofs(contents.equivalenceProofs, 'Equivalence', '⇒', paragraphs);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
      if (contents.definition.length > 1) {
        this.addEquivalenceProofs(contents.equivalenceProofs, 'Equivalence', '⇒', paragraphs);
      }
      this.addProof(contents.wellDefinednessProof, 'Well-definedness', undefined, paragraphs);
    }
    if (cases) {
      this.addStructuralCaseProofs(cases, paragraphs);
    }
  }

  private addStructuralCaseProofs(cases: ExtractedStructuralCase[], paragraphs: Notation.RenderedExpression[]): void {
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
          let subParagraphs: Notation.RenderedExpression[] = [];
          let proofs = nonIsomorphicCases.map((nonIsomorphicCase) => nonIsomorphicCase.wellDefinednessProof);
          this.addProofList(proofs, 'Well-definedness', undefined, undefined, subParagraphs);
          return new Notation.ParagraphExpression(subParagraphs);
        } else {
          // TODO this results in an empty paragraph; needs to be fixed somehow
          return new Notation.EmptyExpression;
        }
      });
      paragraphs.push(new Notation.PromiseExpression(proofPromise));
    }
  }

  private addExtraDefinitionContents(paragraphs: Notation.RenderedExpression[]): void {
    let definition = this.definition;

    if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
      let equalityDefinitionParagraphs: Notation.RenderedExpression[] = [];
      this.addEqualityDefinitions(equalityDefinitionParagraphs);
      if (equalityDefinitionParagraphs.length) {
        let equalityDefinitions = new Notation.ParagraphExpression(equalityDefinitionParagraphs);
        equalityDefinitions.styleClasses = ['display-math'];
        paragraphs.push(equalityDefinitions);
      }

      let embedding = definition.contents.embedding;
      if (embedding) {
        let source = embedding.parameter.type.expression as FmtHLM.MetaRefExpression_Element;
        let rows: Notation.RenderedExpression[][] = [];
        let subset = this.renderSetTerm(source._set, fullSetTermSelection);
        let superset = this.renderDefinitionRef([definition]);
        this.addSemanticLink(superset, definition);
        let full = (embedding.full instanceof FmtHLM.MetaRefExpression_true);
        let supersetDefinition = this.renderTemplate(full ? 'FullEmbeddingDefinition' : 'EmbeddingDefinition', {
                                                       'operands': [new Notation.EmptyExpression, superset]
                                                     });
        let supersetWithText = new Notation.RowExpression([supersetDefinition, new Notation.TextExpression(' via')]);
        rows.push([subset, supersetWithText]);
        let elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
        let targetTerm = this.renderUtils.convertStructuralCaseToOverride([embedding.parameter], embedding.target, elementParameterOverrides);
        let subsetElement = this.renderVariable(embedding.parameter, undefined, true, false, undefined, elementParameterOverrides);
        let target = this.renderElementTerm(targetTerm, fullElementTermSelection);
        let supersetElement = this.renderTemplate('EqualityRelation', {
                                                    'operands': [new Notation.EmptyExpression, target]
                                                  });
        rows.push([subsetElement, supersetElement]);
        let table = new Notation.TableExpression(rows);
        table.styleClasses = ['aligned', 'inline'];
        paragraphs.push(table);
        this.addIndentedProof(embedding.wellDefinednessProof, 'Well-definedness', paragraphs);
      } else if (this.editHandler) {
        let onRenderEmbedding = (subset: Fmt.Expression, full: boolean) =>
          this.renderTemplate(full ? 'FullEmbeddingDefinition' : 'EmbeddingDefinition', {
                                'operands': [
                                  this.renderSetTerm(subset, fullSetTermSelection),
                                  this.renderDefinitionRef([definition])
                                ]
                              });
        paragraphs.push(this.editHandler.getEmbeddingInsertButton(definition.contents, onRenderEmbedding));
      }

      this.addSubsetEmbeddings(paragraphs);
    } else if (definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
      let notation = definition.contents.notation;
      if (notation && this.utils.containsSubExpression(notation, (subExpression: Fmt.Expression) => (subExpression instanceof FmtNotation.MetaRefExpression_neg && subExpression.items.length > 1))) {
        let args = this.getRenderedTemplateArguments([definition]);
        let extraContents = this.renderTemplate('EquivalenceDefinition', {
                                                  'operands': [
                                                    this.renderNotationExpression(notation, args, 0, 1),
                                                    this.renderNotationExpression(notation, args, 0, 1, 1)
                                                  ]
                                                });
        if (!extraContents.styleClasses) {
          extraContents.styleClasses = [];
        }
        extraContents.styleClasses.push('display-math');
        paragraphs.push(extraContents);
      }
    }

    if (definition.contents instanceof FmtHLM.ObjectContents_Construction || definition.contents instanceof FmtHLM.ObjectContents_SetOperator) {
      let definitionNotation = this.renderUtils.getDefinitionNotation(definition);
      if (definitionNotation) {
        let path = new Fmt.Path;
        path.name = definition.name;
        this.utils.getParameterArguments(path.arguments, definition.parameters);
        let term = new Fmt.DefinitionRefExpression;
        term.path = path;
        let type = new FmtHLM.MetaRefExpression_Element;
        type._set = term;
        let parameter = this.utils.createParameter(type, definitionNotation.parameter.name);
        let row: Notation.RenderedExpression[] = [];
        row.push(new Notation.TextExpression('We write “'));
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
          inDefinitionNotationGroup: false
        };
        row.push(this.renderParametersWithInitialState([parameter], initialState));
        row.push(new Notation.TextExpression('” for “'));
        initialState.enableSpecializations = false;
        row.push(this.renderParametersWithInitialState([parameter], initialState));
        row.push(new Notation.TextExpression('.”'));
        paragraphs.push(new Notation.RowExpression(row));
      }
    }

    if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
      for (let constructorDefinition of definition.innerDefinitions) {
        let constructorDefinitionNotation = this.renderUtils.getDefinitionNotation(constructorDefinition);
        if (constructorDefinitionNotation) {
          let parentPath = new Fmt.Path;
          parentPath.name = definition.name;
          this.utils.getParameterArguments(parentPath.arguments, definition.parameters);
          let path = new Fmt.Path;
          path.name = constructorDefinition.name;
          this.utils.getParameterArguments(path.arguments, constructorDefinition.parameters);
          path.parentPath = parentPath;
          let term = new Fmt.DefinitionRefExpression;
          term.path = path;
          let type = new FmtHLM.MetaRefExpression_Def;
          type.element = term;
          let parameter = this.utils.createParameter(type, constructorDefinitionNotation.parameter.name);
          let row: Notation.RenderedExpression[] = [];
          row.push(new Notation.TextExpression('We write “'));
          let initialState: ParameterListState = {
            fullSentence: false,
            sentence: false,
            abbreviate: false,
            forcePlural: false,
            enableSpecializations: true,
            markAsDummy: false,
            started: false,
            inLetExpr: false,
            inConstraint: false,
            inDefinition: false,
            inDefinitionNotationGroup: false
          };
          row.push(this.renderParametersWithInitialState([parameter], initialState));
          row.push(new Notation.TextExpression('” for “'));
          initialState.enableSpecializations = false;
          row.push(this.renderParametersWithInitialState([parameter], initialState));
          row.push(new Notation.TextExpression('.”'));
          paragraphs.push(new Notation.RowExpression(row));
        }
      }
    }
  }

  private addEqualityDefinitions(paragraphs: Notation.RenderedExpression[]): void {
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
          let leftConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, 0, 0, leftParameterOverrides);
          this.addSemanticLink(leftConstructor, innerDefinition);
          let rightConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, 0, 0, rightParameterOverrides);
          this.addSemanticLink(rightConstructor, innerDefinition);
          let equality = this.renderTemplate('EqualityRelation', {
                                               'operands': [leftConstructor, rightConstructor]
                                             });
          this.addSemanticLink(equality, equalityDefinition);
          let definitions = equalityDefinition.definition;
          let renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, fullFormulaSelection);
          let parameters = [...equalityDefinition.leftParameters, ...equalityDefinition.rightParameters];
          let singleCase: ExtractedStructuralCase = {
            caseParameters: parameters,
            definitions: definitions
          };
          let onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
          let equivalenceDef = this.renderMultiDefinitions('Equivalence', [singleCase], () => equality, renderRightSide, -3, onInsertDefinition);
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

  private addSubsetEmbeddings(paragraphs: Notation.RenderedExpression[]): void {
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
      let row: Notation.RenderedExpression[] = [];
      row.push(new Notation.TextExpression('For '));
      let replacementParams: Fmt.ParameterList = Object.create(Fmt.ParameterList.prototype);
      let hadParameters = false;
      for (let param of definition.parameters) {
        let type = param.type.expression;
        if ((type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) && type.embedSubsets) {
          let replacementParam = param.clone();
          replacementParam.name += '\'';
          replacementParams.push(replacementParam);
          if (hadParameters) {
            row.push(new Notation.TextExpression(' and '));
          } else {
            hadParameters = true;
          }
          row.push(this.renderTemplate('SubsetParameter', {
                                         'variable': this.renderVariable(replacementParam, undefined, true),
                                         'superset': this.renderVariable(param)
                                       }));
        } else {
          replacementParams.push(param);
        }
      }
      row.push(new Notation.TextExpression(', we canonically treat elements of '));
      let parameterOverrides: ParameterOverrides = {
        replacementParameters: {
          parameters: replacementParams,
          isDefinition: false
        }
      };
      row.push(this.renderDefinitionRef([definition], undefined, 0, 0, parameterOverrides));
      row.push(new Notation.TextExpression(' as elements of '));
      row.push(this.renderDefinitionRef([definition]));
      row.push(new Notation.TextExpression('.'));
      paragraphs.push(new Notation.RowExpression(row));
    }
  }

  private buildCaseRow(value: Notation.RenderedExpression, formula: Notation.RenderedExpression): Notation.RenderedExpression[] {
    let wrappedValue = new Notation.InnerParenExpression(value);
    wrappedValue.left = false;
    wrappedValue.maxLevel = -10;
    let text = new Notation.TextExpression('if ');
    let formulaWithText = new Notation.RowExpression([text, formula]);
    formulaWithText.styleClasses = ['case-parameters'];
    return [wrappedValue, formulaWithText];
  }

  private addProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Notation.RenderedExpression[]): void {
    this.addProofsInternal(proofs, heading, externalGoal, undefined, undefined, paragraphs);
  }

  private addProofsInternal(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, startRow: Notation.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
      if (proofs && proofs.length) {
        let proofNumber = 1;
        for (let proof of proofs) {
          let row: Notation.RenderedExpression[] | undefined = startRow || [];
          let spacing = startRowSpacing;
          let hasContents = false;
          if (heading) {
            let labelText = proofs.length > 1 ? `${heading} ${proofNumber}` : heading;
            row.push(this.renderSubHeading(labelText));
            spacing = '  ';
          }
          if (proof.parameters && proof.parameters.length) {
            if (spacing) {
              row.push(new Notation.TextExpression(spacing));
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
                row.push(new Notation.TextExpression(spacing));
              }
              if (hasContents) {
                row.push(new Notation.TextExpression('Then '));
              } else {
                row.push(new Notation.TextExpression('We show that '));
              }
              row.push(this.readOnlyRenderer.renderFormula(proof.goal, fullFormulaSelection));
              row.push(new Notation.TextExpression(':'));
              spacing = ' ';
              hasContents = true;
            }
          }
          if (proof.steps.length) {
            if (hasContents) {
              paragraphs.push(new Notation.RowExpression(row));
              row = undefined;
              spacing = undefined;
            }
            let goal = proof.goal || externalGoal;
            this.addProofSteps(proof, goal, row, spacing, paragraphs);
          } else {
            if (spacing) {
              row.push(new Notation.TextExpression(spacing));
            }
            let trivial = new Notation.TextExpression('Trivial.');
            trivial.styleClasses = ['proof-placeholder'];
            row.push(trivial);
            paragraphs.push(new Notation.RowExpression(row));
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

  private addNoProofPlaceholder(heading: string | undefined, startRow: Notation.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Notation.RenderedExpression[]): void {
    let row = startRow || [];
    let spacing = startRowSpacing;
    let noProof = new Notation.TextExpression('No proof.');
    noProof.styleClasses = ['proof-placeholder'];
    if (heading && heading !== 'Proof') {
      row.push(this.renderSubHeading(heading));
      spacing = '  ';
    }
    if (spacing) {
      row.push(new Notation.TextExpression(spacing));
    }
    row.push(noProof);
    paragraphs.push(new Notation.RowExpression(row));
  }

  private addProof(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Notation.RenderedExpression[]): void {
    let proofs = proof ? [proof] : undefined;
    this.addProofs(proofs, heading, externalGoal, paragraphs);
  }

  private addSubProof(proof: FmtHLM.ObjectContents_Proof | undefined, externalGoal: Fmt.Expression | undefined, startRow: Notation.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Notation.RenderedExpression[]): void {
    let proofs = proof ? [proof] : undefined;
    this.addProofsInternal(proofs, undefined, externalGoal, startRow, startRowSpacing, paragraphs);
  }

  private addIndentedProof(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, paragraphs: Notation.RenderedExpression[]): void {
    this.addIndentedProofInternal(proof, heading, undefined, paragraphs);
  }

  private addIndentedSubProof(proof: FmtHLM.ObjectContents_Proof | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Notation.RenderedExpression[]): void {
    this.addIndentedProofInternal(proof, undefined, externalGoal, paragraphs);
  }

  private addIndentedProofInternal(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
      let subParagraphs: Notation.RenderedExpression[] = [];
      let proofs = proof ? [proof] : undefined;
      this.addProofsInternal(proofs, heading, externalGoal, undefined, undefined, subParagraphs);
      let subProof = new Notation.ParagraphExpression(subParagraphs);
      subProof.styleClasses = ['indented'];
      paragraphs.push(subProof);
    }
  }

  private addProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], heading: string | undefined, labels: string[] | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
      if (proofs.every((proof) => proof === undefined)) {
        this.addProof(undefined, heading, externalGoal, paragraphs);
      } else {
        if (heading) {
          paragraphs.push(this.renderSubHeading(heading));
        }
        let items = proofs.map((proof) => {
          let subParagraphs: Notation.RenderedExpression[] = [];
          this.addProof(proof, undefined, externalGoal, subParagraphs);
          return new Notation.ParagraphExpression(subParagraphs);
        });
        let list = new Notation.ListExpression(items, labels ? labels.map((label) => `${label}.`) : '1.');
        paragraphs.push(list);
      }
    }
  }

  private addEquivalenceProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, symbol: string, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
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

  private addSubProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], labels: string[] | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Notation.RenderedExpression[]): void {
    this.addProofList(proofs, undefined, labels, externalGoal, paragraphs);
  }

  private addProofSteps(proof: FmtHLM.ObjectContents_Proof, goal: Fmt.Expression | undefined, startRow: Notation.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Notation.RenderedExpression[]): void {
    let currentResult: Fmt.Expression | undefined = undefined;
    if (proof.parameters && proof.parameters.length) {
      let lastParamType = proof.parameters[proof.parameters.length - 1].type.expression;
      if (lastParamType instanceof FmtHLM.MetaRefExpression_Constraint) {
        currentResult = lastParamType.formula;
      }
    }
    let originalParameters: Fmt.Parameter[] = [];
    let substitutedParameters: Fmt.Parameter[] = [];
    for (let step of proof.steps) {
      if (originalParameters.length && substitutedParameters.length) {
        // TODO this breaks the connection between the source code and the rendered version
        step = step.substituteExpression((expression: Fmt.Expression) => this.utils.substituteParameters(expression, originalParameters, substitutedParameters));
      }
      currentResult = this.addProofStep(step, goal, currentResult, originalParameters, substitutedParameters, startRow, startRowSpacing, paragraphs);
      startRow = undefined;
    }
    if (startRow && startRow.length) {
      paragraphs.push(new Notation.RowExpression(startRow));
    }
  }

  private addProofStep(step: Fmt.Parameter, goal: Fmt.Expression | undefined, previousResult: Fmt.Expression | undefined, originalParameters: Fmt.Parameter[], substitutedParameters: Fmt.Parameter[], startRow: Notation.RenderedExpression[] | undefined, startRowSpacing: string | undefined, paragraphs: Notation.RenderedExpression[]): Fmt.Expression | undefined {
    try {
      let type = step.type.expression;
      if (type instanceof FmtHLM.MetaRefExpression_State) {
        if (!startRow) {
          startRow = [];
        }
        if (startRowSpacing) {
          startRow.push(new Notation.TextExpression(startRowSpacing));
        }
        startRow.push(new Notation.TextExpression('We have '));
        startRow.push(this.renderFormula(type.statement, fullFormulaSelection));
        // TODO only omit proof if trivial
        if (type.proof) {
          startRow.push(new Notation.TextExpression(':'));
          paragraphs.push(new Notation.RowExpression(startRow));
          this.addIndentedSubProof(type.proof, type.statement, paragraphs);
        } else {
          startRow.push(new Notation.TextExpression('.'));
          paragraphs.push(new Notation.RowExpression(startRow));
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
      }
      if (startRow) {
        paragraphs.push(new Notation.RowExpression(startRow));
      }
      if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
        paragraphs.push(this.renderParameter(step, true, false, false));
      } else if (type instanceof FmtHLM.MetaRefExpression_Consider
                 || type instanceof FmtHLM.MetaRefExpression_Embed) {
        let result = this.utils.getProofStepResult(step);
        if (result) {
          paragraphs.push(this.readOnlyRenderer.renderFormula(result, fullFormulaSelection));
        }
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
                 || type instanceof FmtHLM.MetaRefExpression_UnfoldDef
                 || type instanceof FmtHLM.MetaRefExpression_UseForAll
                 || type instanceof FmtHLM.MetaRefExpression_Embed
                 || type instanceof FmtHLM.MetaRefExpression_SetExtend
                 || type instanceof FmtHLM.MetaRefExpression_Extend
                 || type instanceof FmtHLM.MetaRefExpression_UseTheorem
                 || type instanceof FmtHLM.MetaRefExpression_Substitute) {
        let result = this.utils.getProofStepResult(step, previousResult);
        if (!result) {
          return undefined;
        }
        let dependsOnPrevious = !!previousResult;
        let source: Notation.RenderedExpression | undefined = undefined;
        let sourceType = type;
        if (sourceType instanceof FmtHLM.MetaRefExpression_Substitute) {
          if (sourceType.source.type.expression instanceof FmtHLM.MetaRefExpression_UseTheorem) {
            sourceType = sourceType.source.type.expression;
          } else {
            let sourceResult = this.utils.getProofStepResult(sourceType.source);
            if (sourceResult) {
              source = this.readOnlyRenderer.renderFormula(sourceResult, fullFormulaSelection);
              if (!source.styleClasses) {
                source.styleClasses = [];
              }
              source.styleClasses.push('miniature');
              this.addSemanticLink(source, sourceType.source);
            }
          }
        }
        if (sourceType instanceof FmtHLM.MetaRefExpression_UseDef
            || sourceType instanceof FmtHLM.MetaRefExpression_UnfoldDef) {
          source = new Notation.TextExpression('def');
          source.styleClasses = ['miniature'];
          // TODO link to definition
        } else if (sourceType instanceof FmtHLM.MetaRefExpression_UseTheorem) {
          if (sourceType.theorem instanceof Fmt.DefinitionRefExpression) {
            let itemNumberPromise = this.utils.getItemInfo(sourceType.theorem).then((itemInfo: LibraryItemInfo) => new Notation.TextExpression(formatItemNumber(itemInfo.itemNumber)));
            source = new Notation.PromiseExpression(itemNumberPromise);
            source.styleClasses = ['miniature'];
            this.addSemanticLink(source, sourceType.theorem);
          }
          // TODO unset dependsOnPrevious if theorem does not depend on previous
        }
        let resultToDisplay: Notation.RenderedExpression;
        if (result instanceof FmtHLM.MetaRefExpression_or && !result.formulas) {
          resultToDisplay = new Notation.TextExpression('⚡');
        } else {
          resultToDisplay = this.readOnlyRenderer.renderFormula(result, fullFormulaSelection);
        }
        let args: RenderedTemplateArguments = {
          'result': resultToDisplay
        };
        if (source) {
          args['source'] = source;
        }
        let renderedStep = this.renderTemplate(dependsOnPrevious ? 'DependentProofStep' : 'SourceProofStep', args);
        paragraphs.push(renderedStep);
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_UseCases
                 || type instanceof FmtHLM.MetaRefExpression_ProveCases) {
        this.addSubProofList(type.caseProofs, undefined, goal, paragraphs);
      } else if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
        if (previousResult instanceof FmtHLM.MetaRefExpression_exists || previousResult instanceof FmtHLM.MetaRefExpression_existsUnique) {
          originalParameters.push(...type.parameters);
          substitutedParameters.push(...previousResult.parameters);
          return previousResult.formula;
        } else {
          paragraphs.push(new Notation.ErrorExpression('Previous result is not existentially quantified'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveExists) {
        if (goal instanceof FmtHLM.MetaRefExpression_exists || goal instanceof FmtHLM.MetaRefExpression_existsUnique) {
          let argumentList = this.renderArgumentDefinitionList(goal.parameters, type.arguments);
          let row = [
            new Notation.TextExpression('Choose '),
            argumentList,
            new Notation.TextExpression('.')
          ];
          if (type.proof) {
            this.addSubProof(type.proof, undefined, row, ' ', paragraphs);
          } else {
            // TODO only omit proof if trivial
            paragraphs.push(new Notation.RowExpression(row));
          }
        } else {
          paragraphs.push(new Notation.ErrorExpression('Goal is not existentially quantified'));
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
        paragraphs.push(new Notation.ErrorExpression('Unknown proof step type'));
      }
    } catch (e) {
      paragraphs.push(new Notation.ErrorExpression(e.message));
    }
    return undefined;
  }

  addPlaceholderMenu(placeholder: Fmt.PlaceholderExpression, semanticLink: Notation.SemanticLink): void {
    if (this.editHandler) {
      switch (placeholder.placeholderType) {
      case HLMExpressionType.SetTerm:
        {
          let onRenderTerm = (expression: Fmt.Expression) => this.renderSetTermInternal(expression, false)!;
          this.editHandler.addSetTermMenu(semanticLink, placeholder, onRenderTerm, fullSetTermSelection);
        }
        break;
      case HLMExpressionType.ElementTerm:
        {
          let onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression)!;
          this.editHandler.addElementTermMenu(semanticLink, placeholder, onRenderTerm, fullElementTermSelection);
        }
        break;
      case HLMExpressionType.Formula:
        {
          let onRenderFormula = (expression: Fmt.Expression) => this.renderFormulaInternal(expression)[0]!;
          this.editHandler.addFormulaMenu(semanticLink, placeholder, onRenderFormula, fullFormulaSelection);
        }
        break;
      }
    }
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
        if (contents.notation) {
          let notation = contents.notation;
          result.set(notation, () => this.renderDefinitionNotationExpression(notation, definitions));
        }
        if (contents instanceof FmtHLM.ObjectContents_Construction) {
          if (contents.embedding) {
            let embedding = contents.embedding;
            result.set(embedding.parameter, () => this.renderParameter(embedding.parameter, false, false, false));
            result.set(embedding.target, () => this.renderElementTerm(embedding.target, fullElementTermSelection));
            if (embedding.wellDefinednessProof) {
              this.addProofParts(embedding.wellDefinednessProof, result);
            }
          }
        } else if (contents instanceof FmtHLM.ObjectContents_Constructor) {
          if (contents.equalityDefinition) {
            let equalityDefinition = contents.equalityDefinition;
            this.addParameterListParts(equalityDefinition.leftParameters, undefined, result);
            this.addParameterListParts(equalityDefinition.rightParameters, undefined, result);
            for (let item of equalityDefinition.definition) {
              this.addFormulaParts(item, result);
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
        } else if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          for (let item of contents.definition) {
            this.addSetTermParts(item, result);
          }
          if (contents.equalityProofs) {
            this.addProofListParts(contents.equalityProofs, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          for (let item of contents.definition) {
            this.addElementTermParts(item, result);
          }
          if (contents.equalityProofs) {
            this.addProofListParts(contents.equalityProofs, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          this.addParameterParts(contents.parameter, result);
          for (let item of contents.definition) {
            this.addFormulaParts(item, result);
          }
          if (contents.wellDefinednessProof) {
            this.addProofParts(contents.wellDefinednessProof, result);
          }
          if (contents.equivalenceProofs) {
            this.addProofListParts(contents.equivalenceProofs, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          for (let item of contents.definition) {
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
        } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          for (let item of contents.conditions) {
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

  private addParameterListParts(parameters: Fmt.ParameterList, associatedDefinition: Fmt.Definition | undefined, result: Logic.ObjectRenderFns): void {
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
      inDefinitionNotationGroup: false,
      associatedDefinition: associatedDefinition
    };
    let currentGroup: Fmt.Parameter[] = [];
    for (let param of parameters) {
      if (currentGroup.length && !this.combineParameter(param, currentGroup[0])) {
        let group = currentGroup;
        result.set(group[0], () => this.renderParametersWithInitialState(group, initialState));
        currentGroup = [];
      }
      currentGroup.push(param);
    }
    if (currentGroup.length) {
      let group = currentGroup;
      result.set(group[0], () => this.renderParametersWithInitialState(group, initialState));
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
    if (this.options.includeProofs) {
      for (let proof of proofs) {
        this.addProofParts(proof, result);
      }
    }
  }

  private addProofParts(proof: FmtHLM.ObjectContents_Proof, result: Logic.ObjectRenderFns): void {
    if (this.options.includeProofs) {
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
      this.addParameterParts(step, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      this.addFormulaParts(type.statement, result);
      if (type.proof) {
        this.addProofParts(type.proof, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
               || type instanceof FmtHLM.MetaRefExpression_UnfoldDef) {
      this.addFormulaParts(type.result, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseCases
               || type instanceof FmtHLM.MetaRefExpression_ProveCases) {
      this.addProofListParts(type.caseProofs, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
      this.addArgumentListParts(type.arguments, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
      this.addParameterListParts(type.parameters, undefined, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveDef
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

  private addRenderedVariables(parameters: Fmt.Parameter[], variables: RenderedVariable[], indices?: Notation.RenderedExpression[]): void {
    let remainingParameters = [...parameters];
    while (remainingParameters.length) {
      let param = remainingParameters.shift()!;
      let paramType = param.type.expression;
      if (this.utils.isValueParamType(paramType)) {
        let renderedVariable = this.renderVariable(param, indices);
        variables.push({
          param: param,
          notation: renderedVariable,
          canAutoFill: this.utils.canAutoFillParameter(param, remainingParameters)
        });
      } else if (paramType instanceof FmtHLM.MetaRefExpression_Binding) {
        let renderedVariable = this.renderVariable(param);
        variables.push({
          param: param,
          notation: renderedVariable,
          canAutoFill: false
        });
        let newIndices: Notation.RenderedExpression[] = indices ? indices.slice() : [];
        newIndices.push(renderedVariable);
        this.addRenderedVariables(paramType.parameters, variables, newIndices);
      }
    }
  }

  updateEditorState(onAutoFilled?: () => void): CachedPromise<void> {
    if (this.editHandler) {
      return this.editHandler.update(onAutoFilled);
    } else {
      return CachedPromise.resolve();
    }
  }
}
