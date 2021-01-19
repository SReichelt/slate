import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as FmtHLM from './meta';
import * as FmtNotation from '../../notation/meta';
import * as Logic from '../logic';
import * as HLMMacro from './macro';
import { GenericRenderer, RenderedVariable, ArgumentWithInfo, RenderedTemplateArgument, RenderedTemplateArguments } from '../generic/renderer';
import * as Notation from '../../notation/notation';
import { HLMExpressionType } from './types';
import { HLMEditHandler, ParameterSelection, SetTermSelection, fullSetTermSelection, ElementTermSelection, fullElementTermSelection, FormulaSelection, fullFormulaSelection, InsertProofFn } from './editHandler';
import { GenericEditHandler } from '../generic/editHandler';
import { HLMUtils, HLMSubstitutionContext, HLMProofStepContext } from './utils';
import { HLMRenderUtils, ExtractedStructuralCase, ElementParameterOverrides } from './renderUtils';
import { HLMCheckResult } from './checker';
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
  indices?: Notation.RenderedExpression[];
  omitArguments?: number;
  replaceAssociativeArg?: Notation.RenderedExpression;
  macroInvocation?: HLMMacro.HLMMacroInvocation;
}

enum ArgumentListStyle {
  Group,
  Tuple,
  Definitions,
  Formulas
}

interface ParameterListState {
  fullSentence: boolean;
  sentence: boolean;
  abbreviate: boolean;
  forcePlural: boolean;
  enableSpecializations: boolean;
  inInsertMenu: boolean;
  elementParameterOverrides?: ElementParameterOverrides;
  started: boolean;
  inLetExpr: boolean;
  inConstraint: boolean;
  inDefinition: boolean;
  inDefinitionNotationGroup: boolean;
  inForEach: boolean;
  inExistsUnique: boolean;
  associatedParameterList?: Fmt.ParameterList;
  associatedDefinition?: Fmt.Definition;
  extractedConstraints?: Fmt.Parameter[];
  outputPromise?: CachedPromise<void>;
}

interface ConstraintExtractionContainer {
  resultPromise?: CachedPromise<Fmt.Parameter[]>;
}

interface ProofOutputImplication {
  dependsOnPrevious: boolean;
  source?: Notation.RenderedExpression;
  sourceFormula?: Notation.RenderedExpression;
  result: Fmt.Expression;
  resultLink?: Object;
  resultPrefixes?: Notation.RenderedExpression[];
  resultSuffixes?: Notation.RenderedExpression[];
  resultPunctuation?: Notation.RenderedExpression[];
  resultIsEditable: boolean;
}

interface ProofOutputState {
  paragraphs: Notation.RenderedExpression[];
  startRow?: Notation.RenderedExpression[];
  startRowSpacing?: string;
  implications?: ProofOutputImplication[];
  additionalRow?: Notation.RenderedExpression;
  isPreview: boolean;
  onApply: () => void;
}

interface ProofGridState {
  rows: Notation.RenderedExpression[][];
  implicationSymbolColumn?: number;
  equalitySymbolColumn?: number;
  pendingPunctuation?: Notation.RenderedExpression[];
}

interface HLMProofStepRenderContext extends HLMProofStepContext {
  originalParameters: Fmt.Parameter[];
  substitutedParameters: Fmt.Parameter[];
  previousStep?: Fmt.Parameter;
  isLastStep: boolean;
}

export class HLMRenderer extends GenericRenderer implements Logic.LogicRenderer {
  protected readOnlyRenderer: HLMRenderer;
  private additionalIndices = new Map<Fmt.Parameter, Notation.RenderedExpression[]>();

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
    const paragraphs: Notation.RenderedExpression[] = [];
    const row: Notation.RenderedExpression[] = [];
    let space: string | undefined = undefined;
    if (options.includeLabel && itemInfo !== undefined) {
      row.push(this.renderDefinitionLabel(itemInfo));
      space = '  ';
    }
    const definition = this.definition;
    const contents = definition.contents;
    let cases: ExtractedStructuralCase[] | undefined = undefined;
    let hasCases = false;
    if (contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      this.addDefinitionText(paragraphs);
    } else {
      const hasParameters = definition.parameters.length > 0;
      if (hasParameters || this.editHandler) {
        if (space) {
          row.push(new Notation.TextExpression(space));
        }
        row.push(this.renderParameterList(definition.parameters, true, false, false, definition));
        space = ' ';
      }
      let introText: Notation.RenderedExpression | undefined = undefined;
      if (contents instanceof FmtHLM.ObjectContents_Theorem) {
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
          const semanticLink = new Notation.SemanticLink(introText, false, false);
          const onRenderStandardIntro = () => this.renderStandardTheoremIntro(hasParameters);
          const onRenderEquivalenceIntro = () => this.renderEquivalenceTheoremIntro(hasParameters);
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
          const semanticLink = new Notation.SemanticLink(introText, false, false);
          const onRenderExplicitIntro = () => this.renderExplicitDefinitionIntro();
          const onRenderImplicitIntro = (parameter: Fmt.Parameter) => this.renderImplicitDefinitionIntro(parameter);
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
    if (row.length) {
      paragraphs.unshift(row.length === 1 ? row[0] : new Notation.RowExpression(row));
    }
    const definitionRef = this.renderDefinedSymbol([definition]);
    if (hasCases) {
      const definitionRow = new Notation.RowExpression([definitionRef]);
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
    const definition = innerDefinition || this.definition;
    const contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_Theorem) {
      let claim: Notation.RenderedExpression | undefined = undefined;
      if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
        const formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        claim = this.renderFormula(contents.claim, formulaSelection);
      } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
        const formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        const items = contents.conditions.map((formula) => this.renderFormula(formula, formulaSelection));
        claim = this.renderTemplate('EquivalenceRelation', {
                                      'operands': items
                                    });
      }
      if (claim) {
        if (definition.parameters.length) {
          const extractedConstraints: ConstraintExtractionContainer = {};
          const parameters = this.readOnlyRenderer.renderParameterList(definition.parameters, false, false, false, undefined, undefined, extractedConstraints);
          const addendum = new Notation.RowExpression([new Notation.TextExpression('if '), parameters]);
          addendum.styleClasses = ['addendum'];
          const extendedClaimPromise = extractedConstraints.resultPromise!.then((constraintParams: Fmt.Parameter[]) => {
            if (constraintParams.length) {
              const constraints = this.renderParameters(constraintParams, false, true, false);
              claim!.optionalParenStyle = '[]';
              return this.renderTemplate('ImplicationRelation', {
                                           'operands': [constraints, claim]
                                         });
            } else {
              return claim!;
            }
          });
          const extendedClaim = new Notation.PromiseExpression(extendedClaimPromise);
          if (multiLine) {
            return new Notation.ParagraphExpression([extendedClaim, addendum]);
          } else {
            return new Notation.RowExpression([extendedClaim, new Notation.TextExpression('  '), addendum]);
          }
        } else {
          return claim;
        }
      }
    } else if (!(contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      const definitions = [definition];
      if (definition !== this.definition) {
        definitions.unshift(this.definition);
      }
      const omitArguments = contents instanceof FmtHLM.ObjectContents_Construction ? 1 : 2;
      let result = this.renderDefinitionRef(definitions, undefined, omitArguments);
      const definitionNotation = this.renderUtils.getDefinitionNotation(definition);
      const pluralName = definitionNotation?.pluralName;
      if (pluralName) {
        const options: ArgumentRenderingOptions = {
          omitArguments: omitArguments
        };
        let name = this.renderDefinitionNotationExpression(pluralName, definitions, undefined, options);
        name = this.splitName(name);
        const nameWithParens = new Notation.ParenExpression(name, '()');
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
    const formattedInfoPromise = itemInfo.then((info: LibraryItemInfo) => {
      const typeLabelText = this.getDefinitionTypeLabel(info.type);
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
          const semanticLink = new Notation.SemanticLink(title, false, false);
          this.editHandler.addTitleMenu(semanticLink, info);
          title.semanticLinks = [semanticLink];
        }
        const row: Notation.RenderedExpression[] = [new Notation.TextExpression(text + ' '), title, new Notation.TextExpression('.')];
        if (this.editHandler) {
          const typeLabel = new Notation.TextExpression(typeLabelText);
          if (this.definition.contents instanceof FmtHLM.ObjectContents_Theorem || this.definition.contents instanceof FmtHLM.ObjectContents_Predicate) {
            const semanticLink = new Notation.SemanticLink(typeLabel, false, false);
            const onRenderType = (type: string | undefined) => {
              const renderedType = new Notation.TextExpression(this.getDefinitionTypeLabel(type));
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
    const result = new Notation.PromiseExpression(formattedInfoPromise);
    result.styleClasses = ['label'];
    return result;
  }

  private getDefinitionTypeLabel(type: string | undefined): string {
    if (type) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    } else {
      return this.definition.contents instanceof FmtHLM.ObjectContents_Theorem ? 'Proposition' : 'Definition';
    }
  }

  private renderExplicitDefinitionIntro(): Notation.RenderedExpression {
    return new Notation.TextExpression('We define');
  }

  private renderImplicitDefinitionIntro(parameter: Fmt.Parameter): Notation.RenderedExpression {
    const row: Notation.RenderedExpression[] = [
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

  renderParameterList(parameters: Fmt.ParameterList, sentence: boolean, abbreviate: boolean, forcePlural: boolean, associatedDefinition?: Fmt.Definition, elementParameterOverrides?: ElementParameterOverrides, extractedConstraints?: ConstraintExtractionContainer): Notation.RenderedExpression {
    const initialState: ParameterListState = {
      fullSentence: sentence,
      sentence: sentence,
      abbreviate: abbreviate,
      forcePlural: forcePlural,
      enableSpecializations: true,
      inInsertMenu: false,
      elementParameterOverrides: elementParameterOverrides,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionNotationGroup: false,
      inForEach: false,
      inExistsUnique: false,
      associatedParameterList: parameters,
      associatedDefinition: associatedDefinition
    };
    return this.renderParametersWithInitialState(parameters, initialState, undefined, extractedConstraints);
  }

  renderParameters(parameters: Fmt.Parameter[], sentence: boolean, abbreviate: boolean, forcePlural: boolean, elementParameterOverrides?: ElementParameterOverrides, extractedConstraints?: ConstraintExtractionContainer): Notation.RenderedExpression {
    const initialState: ParameterListState = {
      fullSentence: sentence,
      sentence: sentence,
      abbreviate: abbreviate,
      forcePlural: forcePlural,
      enableSpecializations: true,
      inInsertMenu: false,
      elementParameterOverrides: elementParameterOverrides,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionNotationGroup: false,
      inForEach: false,
      inExistsUnique: false
    };
    return this.renderParametersWithInitialState(parameters, initialState, undefined, extractedConstraints);
  }

  renderParameter(parameter: Fmt.Parameter, sentence: boolean, forcePlural: boolean, markAsDummy: boolean, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
    const initialState: ParameterListState = {
      fullSentence: sentence,
      sentence: sentence,
      abbreviate: true,
      forcePlural: forcePlural,
      enableSpecializations: true,
      inInsertMenu: markAsDummy,
      elementParameterOverrides: elementParameterOverrides,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionNotationGroup: false,
      inForEach: false,
      inExistsUnique: false
    };
    return this.renderParametersWithInitialState([parameter], initialState);
  }

  private renderParametersWithInitialState(parameters: Fmt.Parameter[], initialState: ParameterListState, indices?: Notation.RenderedExpression[], extractedConstraints?: ConstraintExtractionContainer): Notation.RenderedExpression {
    let renderer: HLMRenderer = this;
    if (indices) {
      renderer = Object.create(this);
      renderer.additionalIndices = new Map(renderer.additionalIndices);
      for (const param of parameters) {
        renderer.additionalIndices.set(param, indices);
      }
    }

    const state: ParameterListState = {...initialState};
    if (extractedConstraints) {
      state.extractedConstraints = [];
    }
    let resolveDefinitions: CachedPromise<(Fmt.Definition | undefined)[]> = CachedPromise.resolve([]);
    resolveDefinitions = renderer.extractParameterDefinitions(parameters, resolveDefinitions);
    const render = resolveDefinitions.then((constraintDefinitions: (Fmt.Definition | undefined)[]) => renderer.renderParametersWithResolvedDefinitions(parameters, constraintDefinitions, state, indices));
    if (extractedConstraints) {
      extractedConstraints.resultPromise = render.then(() => state.extractedConstraints!);
    }
    return new Notation.PromiseExpression(render);
  }

  private extractParameterDefinitions(parameters: Fmt.Parameter[], resolveDefinitions: CachedPromise<(Fmt.Definition | undefined)[]>): CachedPromise<(Fmt.Definition | undefined)[]> {
    for (const param of parameters) {
      let expression: Fmt.Expression | undefined = undefined;
      const type = param.type;
      if (type instanceof FmtHLM.MetaRefExpression_Subset) {
        expression = type.superset;
      } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
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
    return resolveDefinitions;
  }

  private renderParametersWithResolvedDefinitions(parameters: Fmt.Parameter[], constraintDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices?: Notation.RenderedExpression[]): Notation.RenderedExpression {
    const row: Notation.RenderedExpression[] = [];
    const remainingParameters = parameters.slice();
    const remainingDefinitions = constraintDefinitions.slice();
    const currentGroup: Fmt.Parameter[] = [];
    let currentGroupDefinition: Fmt.Definition | undefined = undefined;
    while (remainingParameters.length) {
      const param = remainingParameters[0];
      if (currentGroup.length && param.type !== currentGroup[0].type) {
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
      } else if (state.started && !state.inInsertMenu) {
        // Occurs if bound parameter list is empty.
        row.push(new Notation.TextExpression(', '));
      }
      const stateCopy: ParameterListState = {
        ...state,
        associatedParameterList: undefined,
        inInsertMenu: true
      };
      if (stateCopy.started) {
        stateCopy.fullSentence = false;
      }
      const onRenderParam = (parameter: Fmt.Parameter) => this.renderParametersWithInitialState([parameter], stateCopy, indices);
      const onInsertParam = (parameter: Fmt.Parameter) => {
        state.associatedParameterList!.push(parameter);
        if (stateCopy.associatedDefinition && this.utils.isValueParamType(parameter.type)) {
          const contents = stateCopy.associatedDefinition.contents;
          if (contents instanceof FmtHLM.ObjectContents_Definition) {
            contents.notation = undefined;
            contents.definitionNotation = undefined;
          }
        }
        GenericEditHandler.lastInsertedParameter = parameter;
      };
      const paramSelection: ParameterSelection = {
        allowSets: !state.inExistsUnique,
        allowConstraint: state.fullSentence || !isEmpty,
        allowProposition: state.associatedDefinition !== undefined && (state.associatedParameterList !== state.associatedDefinition.parameters || state.associatedDefinition.contents instanceof FmtHLM.ObjectContents_Constructor) && !state.inExistsUnique,
        allowDefinition: state.fullSentence && !state.inExistsUnique,
        allowBinder: state.associatedDefinition !== undefined && !state.inForEach && !state.inExistsUnique
      };
      const insertButton = this.editHandler.getParameterInsertButton(onRenderParam, onInsertParam, paramSelection, state.inForEach);
      row.push(insertButton);
    }
  }

  private addParameterGroup(parameters: Fmt.Parameter[], definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[], remainingDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[]): void {
    const param = parameters[0];
    const type = param.type;

    if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      this.addBinder(type, state, indices, row);
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      if (state.extractedConstraints && (state.associatedParameterList || state.extractedConstraints.length || remainingParameters.length)) {
        state.extractedConstraints.push(param);
      } else {
        this.addConstraint(type, remainingParameters, remainingDefinitions, state, row);
      }
    } else {
      this.addRegularParameterGroup(parameters, type, definition, remainingParameters, remainingDefinitions, state, indices, row);
    }
  }

  private addBinder(type: FmtHLM.MetaRefExpression_Binder, state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[]): void {
    state.inLetExpr = false;
    state.inConstraint = false;
    state.inDefinition = false;
    state.inDefinitionNotationGroup = false;

    const targetState = {
      ...state,
      associatedParameterList: type.targetParameters
    };
    const targetIndices = this.addIndices(type, indices);
    row.push(this.renderParametersWithInitialState(type.targetParameters, targetState, targetIndices));

    row.push(new Notation.TextExpression(state.abbreviate ? ' f.e. ' : ' for each '));
    const sourceState: ParameterListState = {
      ...state,
      fullSentence: false,
      sentence: false,
      abbreviate: true,
      forcePlural: false,
      started: false,
      inForEach: true,
      associatedParameterList: type.sourceParameters,
      extractedConstraints: undefined
    };
    row.push(this.renderParametersWithInitialState(type.sourceParameters, sourceState));

    state.started = true;
  }

  private addConstraint(type: FmtHLM.MetaRefExpression_Constraint, remainingParameters: Fmt.Parameter[], remainingDefinitions: (Fmt.Definition | undefined)[], state: ParameterListState, row: Notation.RenderedExpression[]): void {
    if ((state.inLetExpr || (state.inConstraint && state.sentence)) && !state.inDefinition) {
      let connective: string;
      if (state.inConstraint) {
        connective = 'and ';
      } else {
        connective = state.abbreviate ? 's.t. ' : 'such that ';
      }
      if (!state.inInsertMenu) {
        connective = ' ' + connective;
      }
      row.push(new Notation.TextExpression(connective));
    } else {
      if (state.started && !state.inInsertMenu) {
        row.push(new Notation.TextExpression(', '));
      }
      if (state.sentence) {
        row.push(new Notation.TextExpression(state.fullSentence && !state.started ? 'Assume ' : 'assume '));
      }
    }

    const formulaSelection: FormulaSelection = {
      allowTruthValue: false,
      allowEquiv: true,
      allowCases: true
    };
    let formula = this.renderFormula(type.formula, formulaSelection);
    while (remainingParameters.length) {
      const nextType = remainingParameters[0].type;
      if (nextType instanceof FmtHLM.MetaRefExpression_Constraint && this.hasAssociativeArg(nextType.formula)) {
        formula = this.renderFormula(nextType.formula, formulaSelection, formula);
        remainingParameters.pop();
        remainingDefinitions.pop();
      } else {
        break;
      }
    }
    if (state.sentence && !(state.inConstraint || (remainingParameters.length && remainingParameters[0].type instanceof FmtHLM.MetaRefExpression_Constraint))) {
      row.push(formula);
    } else {
      const formulaWithParens = new Notation.InnerParenExpression(formula);
      formulaWithParens.maxLevel = -2;
      if (state.sentence && !remainingParameters.length) {
        formulaWithParens.right = false;
      }
      row.push(formulaWithParens);
    }

    state.inConstraint = true;
    state.inDefinition = false;
    state.started = true;
  }

  private addRegularParameterGroup(parameters: Fmt.Parameter[], type: Fmt.Expression, definition: Fmt.Definition | undefined, remainingParameters: Fmt.Parameter[] | undefined, remainingDefinitions: (Fmt.Definition | undefined)[] | undefined, state: ParameterListState, indices: Notation.RenderedExpression[] | undefined, row: Notation.RenderedExpression[]): void {
    if (state.started) {
      if (state.inForEach) {
        let connective = 'and ';
        if (!state.inInsertMenu) {
          connective = ' ' + connective;
        }
        row.push(new Notation.TextExpression(connective));
      } else if (!state.inInsertMenu) {
        row.push(new Notation.TextExpression(', '));
      }
    }
    if (state.sentence && !state.inLetExpr) {
      row.push(new Notation.TextExpression(state.fullSentence && !state.started ? 'Let ' : 'let '));
    }
    state.inLetExpr = true;
    state.inConstraint = false;
    state.inDefinition = false;

    const variableDefinitions = this.renderVariableDefinitions(parameters, indices, state.inInsertMenu, state.associatedParameterList, state.elementParameterOverrides);
    let variableNotation: Notation.RenderedExpression | undefined;
    const noun: PropertyInfo = {
      isFeature: false,
      extracted: false
    };
    const singular: Notation.RenderedExpression[] = [];
    const plural: Notation.RenderedExpression[] = [];
    let combineWithNext = false;
    if (definition && state.enableSpecializations) {
      const definitionRef = this.getNotationDefinitionRef(type);
      if (definitionRef instanceof Fmt.DefinitionRefExpression) {
        noun.definitionRef = definitionRef;
        const definitions: Fmt.Definition[] = [];
        const argumentLists: Fmt.ArgumentList[] = [];
        this.utils.analyzeDefinitionRef(definitionRef, definition, definitions, argumentLists);
        const innerDefinition = definitions[definitions.length - 1];
        const definitionNotation = this.renderUtils.getDefinitionNotation(innerDefinition);
        if (definitionNotation) {
          const args = this.getRenderedTemplateArguments(definitions, argumentLists);
          args[definitionNotation.parameter.name] = variableDefinitions;
          if (definitionNotation.notation) {
            variableNotation = this.renderNotationExpression(definitionNotation.notation, args);
            this.addSemanticLink(variableNotation, definitionRef);
          }
          if (!(state.abbreviate && definitionNotation.nameOptional instanceof FmtNotation.MetaRefExpression_true)) {
            if (definitionNotation.singularName) {
              noun.singular = this.applyName(definitionNotation.singularName, args, definitionRef, singular);
              if (definitionNotation.singularName instanceof Fmt.StringExpression && remainingParameters && remainingParameters.length && remainingDefinitions && remainingDefinitions.length) {
                const nextDefinitionRef = this.getNotationDefinitionRef(remainingParameters[0].type);
                const nextDefinition = remainingDefinitions[0];
                if (nextDefinitionRef instanceof Fmt.DefinitionRefExpression && nextDefinition) {
                  const nextDefinitions: Fmt.Definition[] = [];
                  const nextArgumentLists: Fmt.ArgumentList[] = [];
                  this.utils.analyzeDefinitionRef(nextDefinitionRef, nextDefinition, nextDefinitions, nextArgumentLists);
                  const nextInnerDefinition = nextDefinitions[nextDefinitions.length - 1];
                  const nextDefinitionNotation = this.renderUtils.getDefinitionNotation(nextInnerDefinition);
                  if (nextDefinitionNotation && nextDefinitionNotation.singularName instanceof Fmt.StringExpression && definitionNotation.singularName.value === nextDefinitionNotation.singularName.value) {
                    combineWithNext = true;
                  }
                }
              }
            }
            if (definitionNotation.pluralName) {
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
    if (singular.length && plural.length && (!state.abbreviate || (singular.length === 1 && plural.length === 1))) {
      if (properties && properties.length) {
        noun.article = undefined;
        this.addExtractedProperties(properties, singular, plural);
      }
      if (this.editHandler && state.associatedParameterList && !state.inDefinitionNotationGroup && !remainingParameters?.length) {
        const firstObjectParam = parameters[0];
        const onRenderFormulas = (expressions: Fmt.Expression[]) => this.renderConstraintMenuItem(expressions, firstObjectParam);
        const parameterList = state.associatedParameterList;
        const onInsertParam = (parameter: Fmt.Parameter) => parameterList.push(parameter);
        this.editHandler.addPropertyInsertButton(parameterList, singular, plural, parameters, onInsertParam, onRenderFormulas);
      }
      if (!variableNotation) {
        variableNotation = variableDefinitions;
      }
      if (state.abbreviate) {
        const which = parameters.length === 1 && !state.forcePlural && !combineWithNext ? singular : plural;
        row.push(...which);
        row.push(new Notation.TextExpression(' '));
        row.push(variableNotation);
      } else {
        row.push(variableNotation);
        if (combineWithNext) {
          state.inDefinitionNotationGroup = true;
        } else {
          const isPlural = parameters.length > 1 || state.inDefinitionNotationGroup;
          this.addNounDefinition(isPlural ? plural : singular, noun.article, isPlural, state.sentence, row);
          state.inDefinitionNotationGroup = false;
        }
      }
    } else if (variableNotation) {
      row.push(variableNotation);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      const termSelection: SetTermSelection = {
        allowEnumeration: true,
        allowSubset: true,
        allowCases: false
      };
      row.push(this.renderTemplate('SubsetParameter', {
                                     'variable': variableDefinitions,
                                     'superset': this.renderSetTerm(type.superset, termSelection)
                                   }));
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      const termSelection: SetTermSelection = {
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
        const constraintProperty = this.renderUtils.getConstraintProperty(firstObjectParam, constraint as Fmt.DefinitionRefExpression, negationCount, constraintDefinition);
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
      const renderedFormulas = expressions.map((expression: Fmt.Expression) => this.renderFormulaInternal(expression)[0]!);
      return this.renderGroup(renderedFormulas, ', ');
    }));
  }

  private getNotationDefinitionRef(type: Fmt.Expression): Fmt.Expression | undefined {
    if (type instanceof FmtHLM.MetaRefExpression_Element) {
      return type._set;
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      return type.element;
    } else {
      return undefined;
    }
  }

  renderVariableDefinitions(parameters: Fmt.Parameter[], indices?: Notation.RenderedExpression[], markAsDummy: boolean = false, parameterList?: Fmt.ParameterList, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
    const items = parameters.map((param) => this.renderVariable(param, indices, true, markAsDummy, parameterList, elementParameterOverrides));
    return this.renderGroup(items);
  }

  renderVariable(param: Fmt.Parameter, indices?: Notation.RenderedExpression[], isDefinition: boolean = false, isDummy: boolean = false, parameterList?: Fmt.ParameterList, elementParameterOverrides?: ElementParameterOverrides): Notation.RenderedExpression {
    if (elementParameterOverrides) {
      const variableOverride = elementParameterOverrides.get(param);
      if (variableOverride) {
        const termPromise = variableOverride.then((term: Fmt.Expression) => this.readOnlyRenderer.renderElementTerm(term, fullElementTermSelection));
        return new Notation.PromiseExpression(termPromise);
      }
    }
    return super.renderVariable(param, indices, isDefinition, isDummy, parameterList);
  }

  renderDefinedSymbol(definitions: Fmt.Definition[]): Notation.RenderedExpression {
    const innerDefinition = definitions[definitions.length - 1];
    const contents = innerDefinition.contents as FmtHLM.ObjectContents_Definition;
    const definitionRef = this.renderDefinitionRef(definitions);
    const onSetNotation = (notation: Fmt.Expression | undefined) => {
      if (notation) {
        const referencedParams = this.utils.findReferencedParameters(notation);
        for (const definition of definitions) {
          this.utils.markUnreferencedParametersAsAuto(definition.parameters, referencedParams);
        }
      }
      contents.notation = notation;
    };
    const onGetDefault = () => this.renderDefaultDefinitionRef(definitions);
    const onGetVariables = () => {
      const parameters: Fmt.Parameter[] = [];
      for (const definition of definitions) {
        parameters.push(...definition.parameters);
      }
      const variables: RenderedVariable[] = [];
      this.addRenderedVariables(parameters, variables);
      return variables;
    };
    const isPredicate = contents instanceof FmtHLM.ObjectContents_Predicate;
    this.setDefinitionSemanticLink(definitionRef, innerDefinition, contents.notation, onSetNotation, onGetDefault, onGetVariables, isPredicate);
    return definitionRef;
  }

  renderSetTerm(term: Fmt.Expression, termSelection: SetTermSelection): Notation.RenderedExpression {
    const result = this.renderSetTermInternal(term, false);
    if (!result) {
      return new Notation.ErrorExpression('Unknown expression type');
    }
    const semanticLink = this.addSemanticLink(result, term);
    if (this.editHandler) {
      const onRenderTerm = (expression: Fmt.Expression) => this.renderSetTermInternal(expression, true)!;
      this.editHandler.addSetTermMenu(semanticLink, term, onRenderTerm, termSelection);
    }
    return result;
  }

  renderSetTermInternal(term: Fmt.Expression, markParametersAsDummy: boolean): Notation.RenderedExpression | undefined {
    if (term instanceof FmtHLM.MetaRefExpression_enumeration) {
      const termSelection: ElementTermSelection = {
        allowCases: false,
        allowConstructors: true
      };
      const items = term.terms ? term.terms.map((item) => this.renderElementTerm(item, termSelection)) : [];
      if (this.editHandler) {
        const onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression)!;
        this.editHandler.addEnumerationInsertButton(items, term, onRenderTerm, termSelection);
      }
      return this.renderTemplate('Enumeration', {
                                   'items': items
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_subset) {
      const elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      const formula = this.renderUtils.convertStructuralCaseToOverride([term.parameter], term.formula, elementParameterOverrides);
      const formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderTemplate('SetBuilder', {
                                   'element': this.renderParameter(term.parameter, false, true, markParametersAsDummy, elementParameterOverrides),
                                   'constraint': this.renderFormula(formula, formulaSelection)
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_extendedSubset) {
      const elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      const element = this.renderUtils.convertStructuralCaseToOverride(term.parameters, term.term, elementParameterOverrides);
      const termSelection: ElementTermSelection = {
        allowCases: false,
        allowConstructors: true
      };
      return this.renderTemplate('SetBuilder', {
                                   'element': this.renderElementTerm(element, termSelection),
                                   'constraint': this.renderParameterList(term.parameters, false, false, false, undefined, elementParameterOverrides)
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_setStructuralCases) {
      const renderCase = (value: Fmt.Expression | undefined) => {
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
        result = new Notation.AssociativeExpression(result);
        this.addSemanticLink(result, term.term);
      }
      return result;
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderElementTerm(term: Fmt.Expression, termSelection: ElementTermSelection): Notation.RenderedExpression {
    const result = this.renderElementTermInternal(term);
    if (!result) {
      return new Notation.ErrorExpression('Unknown expression type');
    }
    const semanticLink = this.addSemanticLink(result, term);
    if (this.editHandler) {
      const onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression)!;
      this.editHandler.addElementTermMenu(semanticLink, term, onRenderTerm, termSelection);
    }
    return result;
  }

  renderElementTermInternal(term: Fmt.Expression): Notation.RenderedExpression | undefined {
    if (term instanceof FmtHLM.MetaRefExpression_cases) {
      const rows = term.cases.map((item) => {
        const value = this.renderElementTerm(item.value, fullElementTermSelection);
        const formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: false
        };
        const formula = this.renderFormula(item.formula, formulaSelection);
        return this.buildCaseRow(value, formula);
      });
      if (this.editHandler) {
        rows.push([this.editHandler.getCaseInsertButton(term)]);
      }
      return this.renderTemplate('Cases', {
                                   'cases': rows
                                 });
    } else if (term instanceof FmtHLM.MetaRefExpression_structuralCases) {
      const renderCase = (value: Fmt.Expression | undefined) => {
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
        result = new Notation.AssociativeExpression(result);
        this.addSemanticLink(result, term.term);
      }
      return result;
    } else {
      return this.renderGenericExpression(term);
    }
  }

  renderFormula(formula: Fmt.Expression, formulaSelection: FormulaSelection, replaceAssociativeArg?: Notation.RenderedExpression): Notation.RenderedExpression {
    const [result, innerFormula] = this.renderFormulaInternal(formula, replaceAssociativeArg);
    if (!result) {
      return new Notation.ErrorExpression('Unknown expression type');
    }
    const semanticLink = this.addSemanticLink(result, formula);
    if (this.editHandler) {
      const onRenderFormula = (expression: Fmt.Expression) => this.renderFormulaInternal(expression)[0]!;
      this.editHandler.addFormulaMenu(semanticLink, formula, onRenderFormula, formulaSelection);
    }
    this.addSemanticLink(result, innerFormula);
    return result;
  }

  private renderFormulaInternal(formula: Fmt.Expression, replaceAssociativeArg?: Notation.RenderedExpression): [Notation.RenderedExpression | undefined, Fmt.Expression] {
    let negationCount = 0;
    while (formula instanceof FmtHLM.MetaRefExpression_not) {
      const innerFormula = formula.formula;
      if (innerFormula instanceof Fmt.VariableRefExpression
          || innerFormula instanceof Fmt.IndexedExpression
          || innerFormula instanceof Fmt.PlaceholderExpression
          || ((innerFormula instanceof FmtHLM.MetaRefExpression_setEquals || innerFormula instanceof FmtHLM.MetaRefExpression_equals)
              && innerFormula.terms.length !== 2)
          || formula instanceof FmtHLM.MetaRefExpression_structural) {
        break;
      }
      negationCount++;
      formula = innerFormula;
    }
    const result = this.renderFormulaWithNegationCount(formula, negationCount, replaceAssociativeArg);
    if (result) {
      result.optionalParenStyle = '[]';
    }
    return [result, formula];
  }

  private renderFormulaWithNegationCount(formula: Fmt.Expression, negationCount: number, replaceAssociativeArg?: Notation.RenderedExpression): Notation.RenderedExpression | undefined {
    if (formula instanceof FmtHLM.MetaRefExpression_not) {
      const formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderTemplate('Negation', {
                                   'operand': this.renderFormula(formula.formula, formulaSelection)
                                 }, negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_and) {
      if (formula.formulas) {
        const formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        const operands: Notation.RenderedExpression[] = [];
        let prevItem: Notation.RenderedExpression | undefined = undefined;
        for (const item of formula.formulas) {
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
        const formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: true
        };
        const operands = formula.formulas.map((item) => this.renderFormula(item, formulaSelection));
        return this.renderTemplate('Disjunction', {
                                     'operands': operands
                                   }, negationCount);
      } else {
        return this.renderTemplate('False', {}, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_equiv) {
      const formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      const operands = formula.formulas.map((item) => this.renderFormula(item, formulaSelection));
      return this.renderTemplate('EquivalenceRelation', {
                                   'operands': operands
                                 }, negationCount);
    } else if (formula instanceof FmtHLM.MetaRefExpression_forall) {
      const formulaSelection: FormulaSelection = {
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
        const formulaSelection: FormulaSelection = {
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
      const initialState: ParameterListState = {
        fullSentence: false,
        sentence: false,
        abbreviate: true,
        forcePlural: false,
        enableSpecializations: true,
        inInsertMenu: false,
        started: false,
        inLetExpr: false,
        inConstraint: false,
        inDefinition: false,
        inDefinitionNotationGroup: false,
        inForEach: false,
        inExistsUnique: true,
        associatedParameterList: formula.parameters
      };
      if (formula.formula) {
        const formulaSelection: FormulaSelection = {
          allowTruthValue: false,
          allowEquiv: false,
          allowCases: false
        };
        return this.renderTemplate('UniqueExistentialQuantification', {
                                     'parameters': this.renderParametersWithInitialState(formula.parameters, initialState),
                                     'formula': this.renderFormula(formula.formula, formulaSelection)
                                   }, negationCount);
      } else {
        return this.renderTemplate('PlainUniqueExistentialQuantification', {
                                     'parameters': this.renderParametersWithInitialState(formula.parameters, initialState)
                                   }, negationCount);
      }
    } else if (formula instanceof FmtHLM.MetaRefExpression_in) {
      const elementTermSelection: ElementTermSelection = {
        allowCases: false,
        allowConstructors: true
      };
      const setTermSelection: SetTermSelection = {
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
      const subsetTermSelection: SetTermSelection = {
        allowEnumeration: false,
        allowSubset: false,
        allowCases: false
      };
      const supersetTermSelection: SetTermSelection = {
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
      const renderCase = (value: Fmt.Expression | undefined) => {
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
    const termSelection: ElementTermSelection = {
      allowCases: false,
      allowConstructors: false
    };
    const termNotation = this.renderElementTerm(term, termSelection);
    let rows: Notation.RenderedExpression[][];
    if (cases.length) {
      rows = cases.map((structuralCase: FmtHLM.ObjectContents_StructuralCase) => {
        let constructorNotation: Notation.RenderedExpression;
        if (construction instanceof Fmt.DefinitionRefExpression) {
          const constructorPromise = this.utils.getStructuralCaseTerm(construction.path, structuralCase);
          const constructorNotationPromise = constructorPromise.then((constructorExpr: Fmt.Expression) => this.renderElementTerm(constructorExpr, termSelection));
          constructorNotation = new Notation.PromiseExpression(constructorNotationPromise);
        } else {
          constructorNotation = new Notation.TextExpression('…');
        }
        const formula = this.renderTemplate('EqualityRelation', {
                                            'operands': [termNotation, constructorNotation]
                                          });
        const value = renderCase(structuralCase.value);
        const row = this.buildCaseRow(value, formula);
        if (structuralCase.parameters) {
          this.addCaseParameters(structuralCase.parameters, undefined, row);
        }
        return row;
      });
    } else {
      const formula = this.renderTemplate('EqualityRelation', {
                                          'operands': [termNotation, new Notation.TextExpression('…')]
                                        });
      if (this.editHandler && this.editHandler.isTemporaryExpression(term)) {
        const row = this.buildCaseRow(renderCase(undefined), formula);
        const ellipsis = new Notation.TextExpression('⋮');
        ellipsis.styleClasses = ['ellipsis'];
        const ellipsisRow = [ellipsis, ellipsis];
        rows = [row, ellipsisRow];
      } else {
        const ellipsis = new Notation.TextExpression('…');
        const row = this.buildCaseRow(ellipsis, formula);
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
      const extractedConstraints: ConstraintExtractionContainer = {};
      const parameterList = this.readOnlyRenderer.renderParameters(parameters, false, false, false, elementParameterOverrides, extractedConstraints);
      const extendedParameterListPromise = extractedConstraints.resultPromise!.then((constraintParams: Fmt.Parameter[]) => {
        if (constraintParams.length) {
          return new Notation.RowExpression([parameterList, new Notation.TextExpression(' with suitable conditions')]);
        } else {
          return parameterList;
        }
      });
      const extendedParameterList = new Notation.PromiseExpression(extendedParameterListPromise);
      const caseParameters = new Notation.ParenExpression(extendedParameterList, '()');
      caseParameters.styleClasses = ['case-parameters'];
      row.push(caseParameters);
    }
  }

  private renderGenericExpression(expression: Fmt.Expression, omitArguments: number = 0, negationCount: number = 0, parameterOverrides?: ParameterOverrides, replaceAssociativeArg?: Notation.RenderedExpression): Notation.RenderedExpression | undefined {
    if (expression instanceof Fmt.VariableRefExpression || expression instanceof Fmt.IndexedExpression) {
      let indices: Notation.RenderedExpression[] | undefined = undefined;
      while (expression instanceof Fmt.IndexedExpression) {
        if (!indices) {
          indices = [];
        }
        if (expression.parameters) {
          indices.unshift(this.renderArgumentList(expression.parameters, expression.arguments, undefined, ArgumentListStyle.Group));
        } else if (expression.arguments) {
          // Fallback when rendering code within markdown.
          for (let argIndex = expression.arguments.length - 1; argIndex >= 0; argIndex--) {
            const arg = expression.arguments[argIndex];
            let value = arg.value;
            if (value instanceof Fmt.CompoundExpression && value.arguments.length) {
              value = value.arguments[0].value;
            }
            indices.unshift(this.renderExpression(value));
          }
        }
        expression = expression.body;
      }
      if (expression instanceof Fmt.VariableRefExpression) {
        const additionalIndices = this.additionalIndices.get(expression.variable);
        if (additionalIndices) {
          indices = indices ? [...additionalIndices, ...indices] : additionalIndices;
        }
        const isDefinition = (expression as any).isDefinition === true;
        const elementParameterOverrides = parameterOverrides?.elementParameterOverrides;
        return this.renderVariable(expression.variable, indices, isDefinition, false, undefined, elementParameterOverrides);
      } else {
        return undefined;
      }
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      const definitionRefExpression = expression;
      const childPaths: Fmt.Path[] = [];
      this.utils.splitPath(definitionRefExpression.path, childPaths);
      const definitionPromise = this.utils.getDefinition(childPaths[0]);
      const expressionPromise = definitionPromise.then((definition) => {
        const definitions: Fmt.Definition[] = [];
        const argumentLists: Fmt.ArgumentList[] = [];
        this.utils.analyzeDefinitionRefPath(childPaths, definition, definitions, argumentLists);
        let macroInvocation: HLMMacro.HLMMacroInvocation | undefined = undefined;
        if (definitions.length === 1 && definitions[0].contents instanceof FmtHLM.ObjectContents_MacroOperator) {
          macroInvocation = this.utils.getMacroInvocation(definitionRefExpression, definitions[0]);
        }
        return this.renderDefinitionRef(definitions, argumentLists, omitArguments, negationCount, parameterOverrides, replaceAssociativeArg, macroInvocation);
      });
      return new Notation.PromiseExpression(expressionPromise);
    } else if (expression instanceof Fmt.PlaceholderExpression) {
      return new Notation.PlaceholderExpression(expression.placeholderType);
    } else {
      return undefined;
    }
  }

  private renderItemNumber(expression: Fmt.DefinitionRefExpression): Notation.RenderedExpression {
    const itemNumberPromise = this.utils.getItemInfo(expression).then((itemInfo: LibraryItemInfo) => new Notation.TextExpression(formatItemNumber(itemInfo.itemNumber)));
    const result = new Notation.PromiseExpression(itemNumberPromise);
    this.addSemanticLink(result, expression);
    return result;
  }

  renderExpression(expression: Fmt.Expression): Notation.RenderedExpression {
    let result: Notation.RenderedExpression | undefined;
    if (expression instanceof Fmt.DefinitionRefExpression && !(expression.path.parentPath instanceof Fmt.Path) && !expression.path.arguments.length) {
      const definitionPromise = this.utils.getDefinition(expression.path);
      const expressionPromise = definitionPromise.then((definition) => {
        if (definition.contents instanceof FmtHLM.ObjectContents_Definition) {
          return this.renderDefinitionRef([definition], undefined, 2);
        } else {
          return this.renderItemNumber(expression);
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
    const definitionPromise = this.utils.getDefinition(expression.path);
    const expressionPromise = definitionPromise.then((definition) => {
      return this.renderDefinitionRef([definition]);
    });
    const result = new Notation.PromiseExpression(expressionPromise);
    this.addSemanticLink(result, expression);
    return result;
  }

  private renderDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], omitArguments: number = 0, negationCount: number = 0, parameterOverrides?: ParameterOverrides, replaceAssociativeArg?: Notation.RenderedExpression, macroInvocation?: HLMMacro.HLMMacroInvocation): Notation.RenderedExpression {
    let result: Notation.RenderedExpression | undefined = undefined;
    const definition = definitions[definitions.length - 1];
    const options: ArgumentRenderingOptions = {
      ...parameterOverrides,
      omitArguments: omitArguments,
      replaceAssociativeArg: replaceAssociativeArg,
      macroInvocation: macroInvocation
    };
    if (definition.contents instanceof FmtHLM.ObjectContents_Definition && definition.contents.notation) {
      result = this.renderDefinitionNotationExpression(definition.contents.notation, definitions, argumentLists, options, negationCount);
    }
    if (!result) {
      result = this.renderDefaultDefinitionRef(definitions, argumentLists, options, negationCount);
    }
    if (definitions[0] === this.definition) {
      this.addSemanticLink(result, definition);
    }
    return result;
  }

  private renderDefaultDefinitionRef(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], options: ArgumentRenderingOptions = {}, negationCount: number = 0): Notation.RenderedExpression {
    const definition = definitions[definitions.length - 1];
    const name = definition.name.split(' ').join('-');
    let result: Notation.RenderedExpression = new Notation.TextExpression(name);
    if (definition.contents instanceof FmtHLM.ObjectContents_Constructor) {
      result.styleClasses = ['ctor'];
    }
    if (definitions.length > 1) {
      result = this.renderTemplate('SubSup', {
                                     'body': result,
                                     'sub': this.renderDefinitionRef(definitions.slice(0, -1), argumentLists?.slice(0, -1))
                                   });
    }
    if (!options.omitArguments) {
      const args: RenderedTemplateArgument[] = [];
      const argumentList = argumentLists ? argumentLists[argumentLists.length - 1] : undefined;
      this.fillArguments(definition.parameters, argumentList, options, undefined, args);
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

  private renderDefinitionNotationExpression(notation: Fmt.Expression, definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], options: ArgumentRenderingOptions = {}, negationCount: number = 0): Notation.RenderedExpression {
    const args = this.getRenderedTemplateArguments(definitions, argumentLists, options);
    const result = this.renderNotationExpression(notation, args, options.omitArguments, negationCount);
    return this.applyAbbreviations(result, definitions[definitions.length - 1], args, options.omitArguments, negationCount);
  }

  private getRenderedTemplateArguments(definitions: Fmt.Definition[], argumentLists?: Fmt.ArgumentList[], options: ArgumentRenderingOptions = {}): RenderedTemplateArguments {
    const args: RenderedTemplateArguments = {};
    let index = 0;
    for (const curDefinition of definitions) {
      const curReplacementParameters = index === definitions.length - 1 ? options.replacementParameters : undefined;
      const curArgumentList = argumentLists && !curReplacementParameters ? argumentLists[index] : undefined;
      const curOptions: ArgumentRenderingOptions = {
        ...options,
        replacementParameters: curReplacementParameters,
        elementParameterOverrides: index === definitions.length - 1 ? options.elementParameterOverrides : undefined
      };
      const curParams: Fmt.Parameter[] = [];
      const curArgs: RenderedTemplateArgument[] = [];
      this.fillArguments(curDefinition.parameters, curArgumentList, curOptions, curParams, curArgs);
      for (let paramIndex = 0; paramIndex < curParams.length; paramIndex++) {
        const curParam = curParams[paramIndex];
        args[curParam.name] = curArgs[paramIndex];
      }
      index++;
    }
    return args;
  }

  private renderArgumentList(parameters: Fmt.ParameterList, argumentList?: Fmt.ArgumentList, indices?: Notation.RenderedExpression[], style: ArgumentListStyle = ArgumentListStyle.Tuple): Notation.RenderedExpression {
    if (style === ArgumentListStyle.Formulas) {
      return this.renderArgumentFormulas(parameters, argumentList);
    } else {
      const options: ArgumentRenderingOptions = {
        indices: indices
      };
      const params: Fmt.Parameter[] | undefined = style === ArgumentListStyle.Definitions ? [] : undefined;
      const args: RenderedTemplateArgument[] = [];
      this.fillArguments(parameters, argumentList, options, params, args);
      switch (style) {
      case ArgumentListStyle.Group:
        return this.renderArgumentTuple(args, 'Group');
      case ArgumentListStyle.Tuple:
        return this.renderArgumentTuple(args, 'Tuple');
      case ArgumentListStyle.Definitions:
        return this.renderArgumentDefinitionList(params!, args);
      }
    }
  }

  private renderArgumentTuple(args: RenderedTemplateArgument[], templateName: string = 'Tuple'): Notation.RenderedExpression {
    if (args.length === 1) {
      return ArgumentWithInfo.getValue(args[0]);
    } else {
      return this.renderTemplate(templateName, {'items': args});
    }
  }

  private renderArgumentDefinitionList(params: Fmt.Parameter[], args: RenderedTemplateArgument[]): Notation.RenderedExpression {
    // TODO better handling of binders?
    const items = params.map((param: Fmt.Parameter, index: number) =>
      this.renderTemplate('EqualityDefinition', {
        'operands': [
          this.renderVariable(param),
          ArgumentWithInfo.getValue(args[index])
        ]
      }));
    return this.renderGroup(items, ', ');
  }

  private renderArgumentFormulas(parameters: Fmt.Parameter[], argumentList?: Fmt.ArgumentList): Notation.RenderedExpression {
    let substitutionContext: HLMSubstitutionContext | undefined = undefined;
    if (argumentList) {
      substitutionContext = new HLMSubstitutionContext;
      this.utils.addArgumentListSubstitution(parameters, argumentList, undefined, substitutionContext);
    }
    const items: Notation.RenderedExpression[] = [];
    const currentGroup: Fmt.Parameter[] = [];
    for (const param of parameters) {
      if (currentGroup.length && param.type !== currentGroup[0].type) {
        this.addArgumentFormula(currentGroup, substitutionContext, items);
        currentGroup.length = 0;
      }
      currentGroup.push(param);
    }
    if (currentGroup.length) {
      this.addArgumentFormula(currentGroup, substitutionContext, items);
    }
    return this.renderGroup(items, ', ');
  }

  private addArgumentFormula(params: Fmt.Parameter[], substitutionContext: HLMSubstitutionContext | undefined, items: Notation.RenderedExpression[]): void {
    const type = params[0].type;
    if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      const argValues = params.map((param: Fmt.Parameter) =>
        this.utils.applySubstitutionContext(new Fmt.VariableRefExpression(param), substitutionContext));
      const args = argValues.map((argValue: Fmt.Expression) =>
        this.renderSetTerm(argValue, fullSetTermSelection));
      const superset = this.utils.applySubstitutionContext(type.superset, substitutionContext);
      items.push(this.renderTemplate('SubsetRelation', {
                                       'operands': [
                                         this.renderGroup(args),
                                         this.readOnlyRenderer.renderSetTerm(superset, fullSetTermSelection)
                                       ]
                                     }));
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      const argValues = params.map((param: Fmt.Parameter) =>
        this.utils.applySubstitutionContext(new Fmt.VariableRefExpression(param), substitutionContext));
      const args = argValues.map((argValue: Fmt.Expression) =>
        this.renderElementTerm(argValue, fullElementTermSelection));
      const set = this.utils.applySubstitutionContext(type._set, substitutionContext);
      items.push(this.renderTemplate('ElementRelation', {
                                       'operands': [
                                         this.renderGroup(args),
                                         this.readOnlyRenderer.renderSetTerm(set, fullSetTermSelection)
                                       ]
                                     }));
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      const formula = this.utils.applySubstitutionContext(type.formula, substitutionContext);
      items.push(this.renderFormula(formula, fullFormulaSelection));
    }
  }

  private fillArguments(parameters: Fmt.ParameterList, argumentList: Fmt.ArgumentList | undefined, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    const replacementParams = options.replacementParameters?.parameters;
    let index = 0;
    for (const param of parameters) {
      const replacementParam = replacementParams ? replacementParams[index] : undefined;
      this.fillArgument(param, replacementParam, argumentList, options, resultParams, resultArgs);
      index++;
    }
  }

  private fillArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, argumentList: Fmt.ArgumentList | undefined, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      this.fillBinderArgument(param, replacementParam, type, argumentList, options, resultParams, resultArgs);
    } else {
      while (type instanceof Fmt.IndexedExpression) {
        type = type.body;
      }
      if (this.utils.isValueParamType(type)
          || type instanceof FmtHLM.MetaRefExpression_Nat) {
        this.fillRegularArgument(param, replacementParam, argumentList, options, resultParams, resultArgs);
      }
    }
  }

  private fillBinderArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, type: FmtHLM.MetaRefExpression_Binder, argumentList: Fmt.ArgumentList | undefined, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    let sourceParameters: Fmt.ParameterList;
    let targetParameters: Fmt.ParameterList;
    let targetArguments: Fmt.ArgumentList | undefined;
    let newIndices = options.indices;
    if (argumentList) {
      try {
        const arg = this.utils.getArgument(argumentList, param, FmtHLM.ObjectContents_BinderArg);
        sourceParameters = arg.sourceParameters;
        targetParameters = type.targetParameters;
        targetArguments = arg.targetArguments;
      } catch (error) {
        if (!resultParams) {
          resultArgs.push(new Notation.ErrorExpression(error.message));
        }
        return;
      }
    } else {
      const replacementType = (replacementParam ?? param).type as FmtHLM.MetaRefExpression_Binder;
      sourceParameters = replacementType.sourceParameters;
      targetParameters = replacementType.targetParameters;
      newIndices = this.addIndices(replacementType, options.indices);
    }
    let elementParameterOverrides = options.elementParameterOverrides;
    if (targetArguments && !options.indices) {
      if (!elementParameterOverrides) {
        elementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      }
      targetArguments = this.renderUtils.convertBoundStructuralCasesToOverrides(sourceParameters, targetArguments, elementParameterOverrides);
    }
    const sourceArgs: RenderedTemplateArgument[] = resultParams ? resultArgs : [];
    const targetArgs: RenderedTemplateArgument[] = resultParams ? resultArgs : [];
    const sourceOptions: ArgumentRenderingOptions = {
      ...options,
      replacementParameters: {parameters: sourceParameters, isDefinition: argumentList !== undefined},
      elementParameterOverrides: elementParameterOverrides,
      indices: undefined
    };
    this.fillArguments(type.sourceParameters, undefined, sourceOptions, resultParams, sourceArgs);
    const targetOptions: ArgumentRenderingOptions = {
      ...options,
      replacementParameters: options.replacementParameters ? {...options.replacementParameters, parameters: targetParameters} : undefined,
      elementParameterOverrides: elementParameterOverrides,
      indices: newIndices
    };
    this.fillArguments(type.targetParameters, targetArguments, targetOptions, resultParams, targetArgs);
    if (!resultParams) {
      resultArgs.push(this.renderTemplate('Binder', {
                                            'variable': this.renderArgumentTuple(sourceArgs),
                                            'value': this.renderArgumentTuple(targetArgs)
                                          }));
    }
  }

  private fillRegularArgument(param: Fmt.Parameter, replacementParam: Fmt.Parameter | undefined, argumentList: Fmt.ArgumentList | undefined, options: ArgumentRenderingOptions, resultParams: Fmt.Parameter[] | undefined, resultArgs: RenderedTemplateArgument[]): void {
    if (resultParams) {
      resultParams.push(param);
    }
    const paramToDisplay = replacementParam ?? param;
    const elementParameterOverrides = options.elementParameterOverrides;
    if (elementParameterOverrides) {
      const variableOverride = elementParameterOverrides.get(paramToDisplay);
      if (variableOverride) {
        const termPromise = variableOverride.then((term: Fmt.Expression) => this.readOnlyRenderer.renderElementTerm(term, fullElementTermSelection));
        resultArgs.push(new Notation.PromiseExpression(termPromise));
        return;
      }
    }
    if (argumentList) {
      let rawArg: Fmt.Expression | undefined = undefined;
      let index = 0;
      for (const curArg of argumentList) {
        if (curArg.name === param.name) {
          rawArg = curArg.value;
          break;
        }
        index++;
      }
      if (rawArg) {
        const onGetValue = () => this.getRegularArgumentResult(rawArg!, param, param.type, options.replaceAssociativeArg, options.macroInvocation);
        resultArgs.push(new ArgumentWithInfo(onGetValue, index));
      } else {
        resultArgs.push(new Notation.ErrorExpression('Undefined argument'));
      }
    } else {
      const isDefinition = options.replacementParameters?.isDefinition;
      resultArgs.push(this.renderVariable(paramToDisplay, options.indices, isDefinition, !!options.omitArguments, undefined, elementParameterOverrides));
    }
  }

  private getRegularArgumentResult(rawArg: Fmt.Expression, param: Fmt.Parameter, type: Fmt.Expression, replaceAssociativeArg?: Notation.RenderedExpression, macroInvocation?: HLMMacro.HLMMacroInvocation): Notation.ExpressionValue {
    if (type instanceof Fmt.IndexedExpression) {
      if (rawArg instanceof Fmt.ArrayExpression) {
        const result: Notation.ExpressionValue[] = [];
        let index = 0;
        for (const item of rawArg.items) {
          if (this.options.maxListLength && index >= this.options.maxListLength) {
            const ellipsis = this.renderTemplate('BottomEllipsis');
            ellipsis.styleClasses = ['dummy'];
            result.push(ellipsis);
            break;
          }
          const renderedItem = this.getRegularArgumentResult(item, param, type.body, undefined, macroInvocation);
          if (!(type.body instanceof Fmt.IndexedExpression)) {
            this.addSemanticLink(renderedItem, item);
          }
          result.push(renderedItem);
          index++;
        }
        if (this.editHandler && macroInvocation) {
          this.editHandler.addArrayArgumentInsertButton(result, param, type.body, macroInvocation, rawArg);
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
    if (this.utils.isValueParamType(type)) {
      const arg = this.utils.extractArgValue(rawArg);
      if (arg) {
        if (type instanceof FmtHLM.MetaRefExpression_Prop) {
          const formulaSelection: FormulaSelection = {
            allowTruthValue: true,
            allowEquiv: false,
            allowCases: true
          };
          return this.renderFormula(arg, formulaSelection);
        } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
          if (replaceAssociativeArg && arg instanceof FmtHLM.MetaRefExpression_setAssociative) {
            return new Notation.AssociativeExpression(replaceAssociativeArg);
          }
          return this.renderSetTerm(arg, fullSetTermSelection);
        } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
          if (replaceAssociativeArg && arg instanceof FmtHLM.MetaRefExpression_setAssociative) {
            return new Notation.AssociativeExpression(replaceAssociativeArg);
          }
          return this.renderSetTerm(arg, fullSetTermSelection);
        } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
          if (replaceAssociativeArg && arg instanceof FmtHLM.MetaRefExpression_associative) {
            return new Notation.AssociativeExpression(replaceAssociativeArg);
          }
          return this.renderElementTerm(arg, fullElementTermSelection);
        }
      }
      return new Notation.ErrorExpression('Malformed argument');
    } else if (type instanceof FmtHLM.MetaRefExpression_Nat) {
      let result: Notation.TextExpression;
      if (rawArg instanceof Fmt.PlaceholderExpression) {
        result = this.renderInteger(undefined);
        result.requestTextInput = true;
      } else {
        const arg = rawArg as Fmt.IntegerExpression;
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

  private addIndices(type: FmtHLM.MetaRefExpression_Binder, indices: Notation.RenderedExpression[] | undefined): Notation.RenderedExpression[] {
    const index = this.renderArgumentList(type.sourceParameters, undefined, undefined, ArgumentListStyle.Group);
    return indices ? indices.concat(index) : [index];
  }

  private hasAssociativeArg(expression: Fmt.Expression): boolean {
    while (expression instanceof FmtHLM.MetaRefExpression_not) {
      expression = expression.formula;
    }
    if (expression instanceof Fmt.DefinitionRefExpression) {
      for (const arg of expression.path.arguments) {
        let argValue = arg.value;
        if (argValue instanceof Fmt.CompoundExpression && argValue.arguments.length) {
          argValue = argValue.arguments[0].value;
        }
        if (argValue instanceof FmtHLM.MetaRefExpression_setAssociative || argValue instanceof FmtHLM.MetaRefExpression_associative) {
          return true;
        }
      }
    }
    return false;
  }

  private applyAbbreviations(expression: Notation.RenderedExpression, definition: Fmt.Definition, args: RenderedTemplateArguments, omitArguments: number = 0, negationCount: number = 0): Notation.RenderedExpression {
    if (!omitArguments) {
      const innerDefinitionContents = definition.contents;
      if (innerDefinitionContents instanceof FmtHLM.ObjectContents_Definition && innerDefinitionContents.abbreviations) {
        for (const abbreviationExpression of innerDefinitionContents.abbreviations) {
          const abbreviation = FmtNotation.ObjectContents_NotationAbbreviation.createFromExpression(abbreviationExpression);
          const [variableRefExpression, indexContext] = this.utils.extractVariableRefExpression(abbreviation.originalParameter);
          if (variableRefExpression && !indexContext) {
            const abbreviationArgs: RenderedTemplateArguments = {...args};
            for (const abbreviationParam of abbreviation.parameters) {
              abbreviationArgs[abbreviationParam.name] = new AbbreviationParamExpression(abbreviationParam);
            }
            const param = variableRefExpression.variable;
            const arg = ArgumentWithInfo.getValue(args[param.name]);
            const notation = this.renderNotationExpression(abbreviation.originalParameterValue, abbreviationArgs, omitArguments, negationCount);
            const originalExpression = expression;
            const semanticLinks: Notation.SemanticLink[] = [];
            const abbreviationPromise = this.renderUtils.matchParameterizedNotation(arg, notation, abbreviationArgs, semanticLinks).then((canAbbreviate: boolean) => {
              if (canAbbreviate) {
                for (const abbreviationParam of abbreviation.parameters) {
                  // This check aims to make sure that we never abbreviate to single variables, e.g. that we don't
                  // abbreviate (X -> Y, x |-> f(x)) to f.
                  // We may want to restrict it to the case that abbreviation.abbreviation is a simple reference
                  // to abbreviationParam.
                  if (this.renderUtils.isRenderedVariable(abbreviationArgs[abbreviationParam.name])) {
                    return originalExpression;
                  }
                }
                const result = this.renderNotationExpression(abbreviation.abbreviation, abbreviationArgs, omitArguments, negationCount);
                result.semanticLinks = semanticLinks;
                return result;
              } else {
                return originalExpression;
              }
            });
            expression = new Notation.PromiseExpression(abbreviationPromise);
          }
        }
      }
    }
    return expression;
  }

  private addDefinitionContents(paragraphs: Notation.RenderedExpression[], definitionRef: Notation.RenderedExpression, cases: ExtractedStructuralCase[] | undefined, includeExtras: boolean): void {
    const contents = this.renderDefinitionContents(definitionRef, cases);
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
    const definition = this.definition;
    const contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      return undefined;
    } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      const formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      return this.renderFormula(contents.claim, formulaSelection);
    } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      const formulaSelection: FormulaSelection = {
        allowTruthValue: false,
        allowEquiv: false,
        allowCases: true
      };
      const conditions = contents.conditions;
      const items = conditions.map((formula) => this.renderFormula(formula, formulaSelection));
      let result: Notation.RenderedExpression = new Notation.ListExpression(items, '1.');
      if (this.editHandler) {
        const onInsertDefinition = () => conditions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
        const insertButton = this.editHandler.getImmediateInsertButton(onInsertDefinition);
        result = new Notation.ParagraphExpression([result, insertButton]);
      }
      return result;
    } else if (contents instanceof FmtHLM.ObjectContents_Definition) {
      if (contents instanceof FmtHLM.ObjectContents_Construction) {
        const rows = definition.innerDefinitions.map((innerDefinition) => {
          const constructorDef = this.renderDefinedSymbol([definition, innerDefinition]);
          const row = [constructorDef];
          if (innerDefinition.parameters.length || this.editHandler) {
            row.push(this.renderParameterList(innerDefinition.parameters, false, false, false, innerDefinition));
          }
          return row;
        });
        if (this.editHandler) {
          rows.push([this.editHandler.getConstructorInsertButton(definition.innerDefinitions)]);
        }
        const construction = this.renderTemplate('Construction', {
                                                 'constructors': rows
                                               });
        return this.renderTemplate('ConstructionDefinition', {
                                     'operands': [definitionRef, construction]
                                   });
      } else {
        const renderDefinitionRef = (elementParameterOverrides?: ElementParameterOverrides) => {
          if (elementParameterOverrides && elementParameterOverrides.size) {
            const parameterOverrides: ParameterOverrides = {
              elementParameterOverrides: elementParameterOverrides
            };
            return this.readOnlyRenderer.renderDefinitionRef([definition], undefined, 0, 0, parameterOverrides);
          }
          return definitionRef;
        };
        let renderLeftSide = renderDefinitionRef;
        if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          const definitions = contents.definition;
          const renderRightSide = (term: Fmt.Expression) => this.renderSetTerm(term, fullSetTermSelection);
          const onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm));
          return this.renderMultiDefinitions('Equality', cases!, renderLeftSide, renderRightSide, -1, onInsertDefinition);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          const definitions = contents.definition;
          const renderRightSide = (term: Fmt.Expression) => this.renderElementTerm(term, fullElementTermSelection);
          const onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
          return this.renderMultiDefinitionsWithSpecializations('Equality', cases!, renderLeftSide, renderRightSide, -1, onInsertDefinition);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          const parameter = this.renderVariable(contents.parameter);
          const definitions = contents.definition;
          renderLeftSide = (elementParameterOverrides?: ElementParameterOverrides) =>
            this.renderTemplate('EqualityRelation', {
                                  'operands': [renderDefinitionRef(elementParameterOverrides), parameter]
                                });
          const formulaSelection: FormulaSelection = {
            allowTruthValue: false,
            allowEquiv: false,
            allowCases: true
          };
          const renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, formulaSelection);
          const onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
          return this.renderMultiDefinitions('Equivalence', cases!, renderLeftSide, renderRightSide, -3, onInsertDefinition);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          const definitions = contents.definition;
          const formulaSelection: FormulaSelection = {
            allowTruthValue: false,
            allowEquiv: false,
            allowCases: true
          };
          const renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, formulaSelection);
          const onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
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
    const rows: Notation.RenderedExpression[][] = [];
    for (const currentCase of cases) {
      const elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
      this.renderUtils.fillVariableOverridesFromExtractedCase(currentCase, elementParameterOverrides);
      let first = true;
      for (const definition of currentCase.definitions) {
        let leftItem: Notation.RenderedExpression;
        if (first) {
          const caseDefinition = renderLeftSide(elementParameterOverrides);
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
        const rightItem = new Notation.InnerParenExpression(renderRightSide(definition));
        rightItem.left = true;
        rightItem.right = false;
        rightItem.maxLevel = parenLevel;
        const row = [leftItem, rightItem];
        if (first && currentCase.caseParameters) {
          this.addCaseParameters(currentCase.caseParameters, elementParameterOverrides, row);
        }
        rows.push(row);
        first = false;
      }
    }
    if (this.editHandler) {
      const insertButton = this.editHandler.getImmediateInsertButton(onInsertDefinition);
      rows.push([new Notation.RowExpression([insertButton, new Notation.TextExpression(' ')]), new Notation.EmptyExpression]);
    }
    const result = new Notation.TableExpression(rows);
    result.styleClasses = ['aligned', 'definitions'];
    return result;
  }

  private renderMultiDefinitionsWithSpecializations(type: string, cases: ExtractedStructuralCase[], renderLeftSide: (elementParameterOverrides?: ElementParameterOverrides) => Notation.RenderedExpression, renderRightSide: (expression: Fmt.Expression) => Notation.RenderedExpression, parenLevel: number, onInsertDefinition: () => void): Notation.RenderedExpression {
    if (cases.length === 1) {
      const currentCase = cases[0];
      if (currentCase.definitions.length === 1) {
        const expression = currentCase.definitions[0];
        if (expression instanceof Fmt.DefinitionRefExpression) {
          const definitionRef = expression;
          const promise = this.utils.getOuterDefinition(definitionRef)
            .then((outerDefinition: Fmt.Definition) => {
              const definitions: Fmt.Definition[] = [];
              const argumentLists: Fmt.ArgumentList[] = [];
              this.utils.analyzeDefinitionRef(definitionRef, outerDefinition, definitions, argumentLists);
              const innerDefinition = definitions[definitions.length - 1];
              const innerDefinitionNotation = this.renderUtils.getDefinitionNotation(innerDefinition);
              if (innerDefinitionNotation) {
                const elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
                this.renderUtils.fillVariableOverridesFromExtractedCase(currentCase, elementParameterOverrides);
                const options: ArgumentRenderingOptions = {
                  elementParameterOverrides: elementParameterOverrides
                };
                const args = this.getRenderedTemplateArguments(definitions, argumentLists, options);
                args[innerDefinitionNotation.parameter.name] = renderLeftSide(elementParameterOverrides);
                if (innerDefinitionNotation.notation) {
                  let result = this.renderNotationExpression(innerDefinitionNotation.notation, args);
                  this.addSemanticLink(result, definitionRef);
                  if (this.editHandler) {
                    const insertButton = this.editHandler.getImmediateInsertButton(onInsertDefinition);
                    result = new Notation.ParagraphExpression([result, insertButton]);
                  }
                  return result;
                }
              } else if (outerDefinition !== innerDefinition) {
                const outerDefinitionNotation = this.renderUtils.getDefinitionNotation(outerDefinition);
                if (outerDefinitionNotation && outerDefinitionNotation.singularName && !(outerDefinitionNotation.nameOptional instanceof FmtNotation.MetaRefExpression_true)) {
                  const singular: Notation.RenderedExpression[] = [];
                  const args = this.getRenderedTemplateArguments(definitions, argumentLists);
                  this.applyName(outerDefinitionNotation.singularName, args, definitionRef, singular);
                  const renderRightSideOrig = renderRightSide;
                  renderRightSide = (rightSideExpression: Fmt.Expression) => {
                    const row = [renderRightSideOrig(rightSideExpression)];
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
    const definition = this.definition;
    const contents = definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      const standardTheorem = contents;
      const onInsertProof = (proof: FmtHLM.ObjectContents_Proof) => {
        if (standardTheorem.proofs) {
          standardTheorem.proofs.push(proof);
        } else {
          standardTheorem.proofs = [proof];
        }
      };
      this.addProofs(standardTheorem.proofs, 'Proof', standardTheorem.claim, onInsertProof, paragraphs);
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
      const implicitOperator = contents;
      if (contents.definition.length > 1) {
        this.addEquivalenceProofs(contents.equivalenceProofs, 'Equivalence', '⇒', paragraphs);
      }
      const onInsertProof = (proof: FmtHLM.ObjectContents_Proof) => (implicitOperator.wellDefinednessProof = proof);
      this.addProof(implicitOperator.wellDefinednessProof, 'Well-definedness', undefined, onInsertProof, paragraphs);
    }
    if (cases) {
      this.addStructuralCaseProofs(cases, paragraphs);
    }
  }

  private addStructuralCaseProofs(cases: ExtractedStructuralCase[], paragraphs: Notation.RenderedExpression[]): void {
    let nonIsomorphicCasesPromise: CachedPromise<FmtHLM.ObjectContents_StructuralCase[]> = CachedPromise.resolve([]);
    for (const currentCase of cases) {
      if (currentCase.structuralCases) {
        for (const structuralCase of currentCase.structuralCases) {
          const currentStructuralCase = structuralCase;
          const constructorRef = currentStructuralCase._constructor;
          if (constructorRef instanceof Fmt.DefinitionRefExpression) {
            const currentConstructorRef = constructorRef;
            const constructionPromise = this.utils.getOuterDefinition(constructorRef);
            nonIsomorphicCasesPromise = nonIsomorphicCasesPromise.then((previousCases: FmtHLM.ObjectContents_StructuralCase[]) => {
              return constructionPromise.then((construction: Fmt.Definition) => {
                const constructor = construction.innerDefinitions.getDefinition(currentConstructorRef.path.name);
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
    const immediateResult = nonIsomorphicCasesPromise.getImmediateResult();
    if (!immediateResult || immediateResult.length) {
      const proofPromise = nonIsomorphicCasesPromise.then((nonIsomorphicCases: FmtHLM.ObjectContents_StructuralCase[]) => {
        if (nonIsomorphicCases.length) {
          const subParagraphs: Notation.RenderedExpression[] = [];
          const proofs = nonIsomorphicCases.map((nonIsomorphicCase) => nonIsomorphicCase.wellDefinednessProof);
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
    const definition = this.definition;

    if (definition.contents instanceof FmtHLM.ObjectContents_Construction) {
      const equalityDefinitionParagraphs: Notation.RenderedExpression[] = [];
      this.addEqualityDefinitions(equalityDefinitionParagraphs);
      if (equalityDefinitionParagraphs.length) {
        const equalityDefinitions = new Notation.ParagraphExpression(equalityDefinitionParagraphs);
        equalityDefinitions.styleClasses = ['display-math'];
        paragraphs.push(equalityDefinitions);
      }

      const embedding = definition.contents.embedding;
      if (embedding) {
        const source = embedding.parameter.type as FmtHLM.MetaRefExpression_Element;
        const rows: Notation.RenderedExpression[][] = [];
        const subset = this.renderSetTerm(source._set, fullSetTermSelection);
        const superset = this.renderDefinitionRef([definition]);
        this.addSemanticLink(superset, definition);
        const full = (embedding.full instanceof FmtHLM.MetaRefExpression_true);
        const supersetDefinition = this.renderTemplate(full ? 'FullEmbeddingDefinition' : 'EmbeddingDefinition', {
                                                       'operands': [new Notation.EmptyExpression, superset]
                                                     });
        const supersetWithText = new Notation.RowExpression([supersetDefinition, new Notation.TextExpression(' via')]);
        rows.push([subset, supersetWithText]);
        const elementParameterOverrides: ElementParameterOverrides = new Map<Fmt.Parameter, CachedPromise<Fmt.Expression>>();
        const targetTerm = this.renderUtils.convertStructuralCaseToOverride([embedding.parameter], embedding.target, elementParameterOverrides);
        const subsetElement = this.renderVariable(embedding.parameter, undefined, true, false, undefined, elementParameterOverrides);
        const target = this.renderElementTerm(targetTerm, fullElementTermSelection);
        const supersetElement = this.renderTemplate('EqualityRelation', {
                                                    'operands': [new Notation.EmptyExpression, target]
                                                  });
        rows.push([subsetElement, supersetElement]);
        const table = new Notation.TableExpression(rows);
        table.styleClasses = ['aligned', 'inline'];
        paragraphs.push(table);
        this.addIndentedProof(embedding.wellDefinednessProof, 'Well-definedness', paragraphs);
      } else if (this.editHandler) {
        const onRenderEmbedding = (subset: Fmt.Expression, full: boolean) =>
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
      const notation = definition.contents.notation;
      if (notation && FmtUtils.containsSubExpression(notation, (subExpression: Fmt.Expression) => (subExpression instanceof FmtNotation.MetaRefExpression_neg && subExpression.items.length > 1))) {
        const args = this.getRenderedTemplateArguments([definition]);
        const extraContents = this.renderTemplate('EquivalenceDefinition', {
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
      const definitionNotation = this.renderUtils.getDefinitionNotation(definition);
      if (definitionNotation) {
        const args = this.utils.getParameterArguments(definition.parameters);
        const path = new Fmt.Path(definition.name, args);
        const term = new Fmt.DefinitionRefExpression(path);
        const type = new FmtHLM.MetaRefExpression_Element(term);
        const parameter = this.utils.createParameter(type, definitionNotation.parameter.name);
        const row: Notation.RenderedExpression[] = [];
        row.push(new Notation.TextExpression('We write “'));
        const initialState: ParameterListState = {
          fullSentence: false,
          sentence: true,
          abbreviate: false,
          forcePlural: false,
          enableSpecializations: true,
          inInsertMenu: false,
          started: false,
          inLetExpr: false,
          inConstraint: false,
          inDefinition: false,
          inDefinitionNotationGroup: false,
          inForEach: false,
          inExistsUnique: false
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
      for (const constructorDefinition of definition.innerDefinitions) {
        const constructorDefinitionNotation = this.renderUtils.getDefinitionNotation(constructorDefinition);
        if (constructorDefinitionNotation) {
          const parentArgs = this.utils.getParameterArguments(definition.parameters);
          const parentPath = new Fmt.Path(definition.name, parentArgs);
          const args = this.utils.getParameterArguments(constructorDefinition.parameters);
          const path = new Fmt.Path(constructorDefinition.name, args);
          path.parentPath = parentPath;
          const term = new Fmt.DefinitionRefExpression(path);
          const type = new FmtHLM.MetaRefExpression_Def(term);
          const parameter = this.utils.createParameter(type, constructorDefinitionNotation.parameter.name);
          const row: Notation.RenderedExpression[] = [];
          row.push(new Notation.TextExpression('We write “'));
          const initialState: ParameterListState = {
            fullSentence: false,
            sentence: false,
            abbreviate: false,
            forcePlural: false,
            enableSpecializations: true,
            inInsertMenu: false,
            started: false,
            inLetExpr: false,
            inConstraint: false,
            inDefinition: false,
            inDefinitionNotationGroup: false,
            inForEach: false,
            inExistsUnique: false
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
    const definition = this.definition;
    for (const innerDefinition of definition.innerDefinitions) {
      const constructorContents = innerDefinition.contents;
      if (constructorContents instanceof FmtHLM.ObjectContents_Constructor) {
        const equalityDefinition = constructorContents.equalityDefinition;
        if (equalityDefinition) {
          const leftParameterOverrides: ParameterOverrides = {
            replacementParameters: {
              parameters: equalityDefinition.leftParameters,
              isDefinition: false
            }
          };
          const rightParameterOverrides: ParameterOverrides = {
            replacementParameters: {
              parameters: equalityDefinition.rightParameters,
              isDefinition: false
            }
          };
          const leftConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, 0, 0, leftParameterOverrides);
          this.addSemanticLink(leftConstructor, innerDefinition);
          const rightConstructor = this.renderDefinitionRef([definition, innerDefinition], undefined, 0, 0, rightParameterOverrides);
          this.addSemanticLink(rightConstructor, innerDefinition);
          const equality = this.renderTemplate('EqualityRelation', {
                                               'operands': [leftConstructor, rightConstructor]
                                             });
          this.addSemanticLink(equality, equalityDefinition);
          const definitions = equalityDefinition.definition;
          const renderRightSide = (formula: Fmt.Expression) => this.renderFormula(formula, fullFormulaSelection);
          const parameters = [...equalityDefinition.leftParameters, ...equalityDefinition.rightParameters];
          const singleCase: ExtractedStructuralCase = {
            caseParameters: parameters,
            definitions: definitions
          };
          const onInsertDefinition = () => definitions.push(new Fmt.PlaceholderExpression(HLMExpressionType.Formula));
          const equivalenceDef = this.renderMultiDefinitions('Equivalence', [singleCase], () => equality, renderRightSide, -3, onInsertDefinition);
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
    const definition = this.definition;
    let hasSubsetEmbedding = false;
    for (const param of definition.parameters) {
      const type = param.type;
      if ((type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) && type.embedSubsets) {
        hasSubsetEmbedding = true;
        break;
      }
    }
    if (hasSubsetEmbedding) {
      const row: Notation.RenderedExpression[] = [];
      row.push(new Notation.TextExpression('For '));
      const replacementParams = new Fmt.ParameterList;
      let hadParameters = false;
      for (const param of definition.parameters) {
        const type = param.type;
        if ((type instanceof FmtHLM.MetaRefExpression_Set || type instanceof FmtHLM.MetaRefExpression_Subset) && type.embedSubsets) {
          const replacementParam = param.clone();
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
      const parameterOverrides: ParameterOverrides = {
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
    const wrappedValue = new Notation.InnerParenExpression(value);
    wrappedValue.left = false;
    wrappedValue.maxLevel = -10;
    const text = new Notation.TextExpression('if ');
    const formulaWithText = new Notation.RowExpression([text, formula]);
    formulaWithText.styleClasses = ['case-parameters'];
    return [wrappedValue, formulaWithText];
  }

  private addProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, onInsertProof: InsertProofFn | undefined, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
      const context: HLMProofStepContext = {
        goal: externalGoal,
        stepResults: new Map<Fmt.Parameter, Fmt.Expression>()
      };
      const state: ProofOutputState = {
        paragraphs: paragraphs,
        isPreview: false,
        onApply: () => {}
      };
      this.addProofsInternal(proofs, heading, context, false, onInsertProof, state);
    }
  }

  private addProofsInternal(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, context: HLMProofStepContext, indentSteps: boolean, onInsertProof: InsertProofFn | undefined, state: ProofOutputState): void {
    if (proofs && proofs.length) {
      let proofNumber = 1;
      for (const proof of proofs) {
        const proofHeading = heading && proofs.length > 1 ? `${heading} ${proofNumber}` : heading;
        this.addProofInternal(proof, proofHeading, context, false, indentSteps, false, state);
        proofNumber++;
      }
      if (this.editHandler && onInsertProof) {
        const editHandler = this.editHandler;
        state.paragraphs.push(editHandler.createConditionalElement((checkResult: HLMCheckResult) => {
          if (checkResult.rechecker?.hasIncompleteProofs()) {
            return new Notation.EmptyExpression;
          } else {
            return editHandler.getProofInsertButton(onInsertProof);
          }
        }));
      }
    } else if (!this.utils.containsPlaceholders()) {
      this.addNoProofPlaceholder(heading, onInsertProof, state);
    }
  }

  private addOptionalProofInternal(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, context: HLMProofStepContext, showExternalGoal: boolean, isListItem: boolean, indentSteps: boolean, onInsertProof: InsertProofFn | undefined, state: ProofOutputState): void {
    if (proof) {
      this.addProofInternal(proof, heading, context, showExternalGoal, isListItem, indentSteps, state);
    } else if (!this.utils.containsPlaceholders()) {
      const displayedGoal = showExternalGoal ? this.getDisplayedGoal(context.goal) : undefined;
      if (displayedGoal) {
        if (state.startRow) {
          this.outputStartRowSpacing(state);
        } else {
          state.startRow = [];
        }
        const renderedGoal = this.readOnlyRenderer.renderFormula(displayedGoal, fullFormulaSelection);
        state.startRow.push(
          renderedGoal,
          new Notation.TextExpression(':')
        );
        state.startRowSpacing = ' ';
      }
      this.addNoProofPlaceholder(heading, onInsertProof, state);
    }
  }

  private addProofInternal(proof: FmtHLM.ObjectContents_Proof, heading: string | undefined, context: HLMProofStepContext, showExternalGoal: boolean, isListItem: boolean, indentSteps: boolean, state: ProofOutputState): void {
    if (!state.startRow) {
      state.startRow = [];
    }
    let hasContents = false;
    if (heading) {
      state.startRow.push(this.renderSubHeading(heading));
      state.startRowSpacing = '  ';
    }
    // If the first step is a reference to our own theorem, display it as an induction hypothesis instead.
    let parameters = proof.parameters;
    let steps = proof.steps;
    while (steps.length) {
      const firstStep = steps[0];
      const firstStepType = firstStep.type;
      if (firstStepType instanceof FmtHLM.MetaRefExpression_UseTheorem && this.utils.isSelfReference(firstStepType.theorem) && firstStepType.result) {
        const inductionHypothesis = new Fmt.Parameter(firstStep.name, new FmtHLM.MetaRefExpression_Constraint(firstStepType.result));
        parameters = parameters ? new Fmt.ParameterList(...parameters, inductionHypothesis) : new Fmt.ParameterList(inductionHypothesis);
        const newSteps = new Fmt.ParameterList(...steps.slice(1));
        const substitutionContext = new HLMSubstitutionContext;
        this.utils.addParameterSubstitution(firstStep, inductionHypothesis, substitutionContext);
        steps = this.utils.applySubstitutionContextToParameterList(newSteps, substitutionContext);
      } else {
        break;
      }
    }
    if (parameters && parameters.length) {
      this.outputStartRowSpacing(state);
      state.startRow.push(this.readOnlyRenderer.renderParameterList(parameters, true, false, false));
      state.startRowSpacing = ' ';
      hasContents = true;
    }
    let displayedGoal = showExternalGoal ? this.getDisplayedGoal(context.goal) : undefined;
    if (proof.goal) {
      context = {
        ...context,
        goal: proof.goal
      };
      displayedGoal = state.isPreview ? proof.goal : this.getDisplayedGoal(proof.goal, displayedGoal);
    }
    let singleStep: Fmt.Parameter | undefined = undefined;
    let singleStepType: Fmt.Expression | undefined = undefined;
    if (steps.length === 1) {
      singleStep = steps[0];
      singleStepType = singleStep.type;
      if ((singleStepType instanceof FmtHLM.MetaRefExpression_ProveForAll && displayedGoal instanceof FmtHLM.MetaRefExpression_forall)
          || singleStepType instanceof FmtHLM.MetaRefExpression_ProveCases) {
        displayedGoal = undefined;
      }
      while (singleStepType instanceof FmtHLM.MetaRefExpression_ProveBySubstitution
             && (singleStepType.source instanceof FmtHLM.MetaRefExpression_UseTheorem || singleStepType.source instanceof FmtHLM.MetaRefExpression_UseImplicitOperator)
             && !singleStepType.proof) {
        singleStepType = singleStepType.source;
        singleStep = undefined;
      }
    }
    const hasSingleSource = ((singleStepType instanceof FmtHLM.MetaRefExpression_ProveDef && (!singleStepType.proof || (singleStepType.proof.goal && this.utils.isTrueFormula(singleStepType.proof.goal))))
                           || ((singleStepType instanceof FmtHLM.MetaRefExpression_UseTheorem || singleStepType instanceof FmtHLM.MetaRefExpression_UseImplicitOperator) && !(singleStep && singleStepType.result)));
    if (displayedGoal) {
      if (!this.editHandler
          && singleStepType instanceof FmtHLM.MetaRefExpression_ProveBySubstitution
          && (displayedGoal instanceof FmtHLM.MetaRefExpression_setEquals || displayedGoal instanceof FmtHLM.MetaRefExpression_equals)) {
        if (hasContents) {
          this.outputStartRowSpacing(state);
          state.startRow.push(new Notation.TextExpression('Then:'));
        }
        this.commitStartRow(state);
        const renderContext: HLMProofStepRenderContext = {
          ...context,
          goal: displayedGoal,
          originalParameters: [],
          substitutedParameters: [],
          isLastStep: true
        };
        if (!singleStep) {
          singleStep = new Fmt.Parameter('_', singleStepType);
        }
        this.addProofStep(proof, singleStep, renderContext, state);
        this.commitImplications(state, false, true);
        return;
      }
      this.outputStartRowSpacing(state);
      const renderedGoal = this.readOnlyRenderer.renderFormula(displayedGoal, fullFormulaSelection);
      if (hasContents) {
        state.startRow.push(new Notation.TextExpression('Then '));
      }
      if ((singleStepType instanceof Fmt.VariableRefExpression || singleStepType instanceof Fmt.IndexedExpression || singleStepType instanceof FmtHLM.MetaRefExpression_Consider) && !this.editHandler) {
        this.outputStartRowSpacing(state);
        state.startRow.push(
          renderedGoal,
          new Notation.TextExpression('.')
        );
        this.commitStartRow(state);
        return;
      } else if (hasSingleSource) {
        this.outputStartRowSpacing(state);
        state.startRow.push(
          renderedGoal,
          new Notation.TextExpression(' by '),
          this.readOnlyRenderer.renderProofStepSource(singleStepType!),
          new Notation.TextExpression('.')
        );
        this.commitStartRow(state);
        return;
      }
      if ((!steps.length && !this.editHandler) || state.isPreview) {
        state.startRow.push(renderedGoal);
        if (hasContents || !state.isPreview) {
          state.startRow.push(new Notation.TextExpression('.'));
        }
        this.commitStartRow(state);
        return;
      } else {
        if (!hasContents && !isListItem) {
          state.startRow.push(new Notation.TextExpression('We show that '));
        }
        state.startRow.push(
          renderedGoal,
          new Notation.TextExpression(':')
        );
      }
      state.startRowSpacing = ' ';
      hasContents = true;
    } else {
      if (hasSingleSource) {
        this.outputStartRowSpacing(state);
        state.startRow.push(
          new Notation.TextExpression('By '),
          this.renderProofStepSource(singleStepType!),
          new Notation.TextExpression('.')
        );
        this.commitStartRow(state);
        return;
      }
    }
    this.utils.updateInitialProofStepContext(proof, context, true);
    if (steps.length) {
      if (hasContents || indentSteps) {
        this.commitStartRow(state);
      }
      if (indentSteps) {
        const indentedState: ProofOutputState = {
          paragraphs: [],
          isPreview: state.isPreview,
          onApply: state.onApply
        };
        this.addProofSteps(proof, steps, context, indentedState);
        const indentedSteps = new Notation.ParagraphExpression(indentedState.paragraphs);
        indentedSteps.styleClasses = ['indented'];
        state.paragraphs.push(indentedSteps);
      } else {
        this.addProofSteps(proof, steps, context, state);
      }
    } else if (!state.isPreview) {
      this.outputStartRowSpacing(state);
      if (this.editHandler) {
        const renderContext: HLMProofStepRenderContext = {
          ...context,
          originalParameters: [],
          substitutedParameters: [],
          isLastStep: true
        };
        state.startRow.push(this.getConditionalProofStepInsertButton(proof, renderContext, false, state));
      } else {
        state.startRow.push(this.getTrivialProofPlaceholder());
      }
    }
    this.commitStartRow(state);
  }

  private getDisplayedGoal(goal: Fmt.Expression | undefined, originalGoal?: Fmt.Expression): Fmt.Expression | undefined {
    if (goal && !this.utils.isFalseFormula(goal) && !this.utils.isTrueFormula(goal)) {
      if (((goal instanceof FmtHLM.MetaRefExpression_setEquals && originalGoal instanceof FmtHLM.MetaRefExpression_setEquals)
           || (goal instanceof FmtHLM.MetaRefExpression_equals && originalGoal instanceof FmtHLM.MetaRefExpression_equals))
          && goal.terms.length >= 2 && originalGoal.terms.length >= 2) {
        const newTerms = goal.terms.slice();
        if (newTerms[0].isEquivalentTo(newTerms[newTerms.length - 1])) {
          newTerms.pop();
        }
        let extended = false;
        if (!newTerms[0].isEquivalentTo(originalGoal.terms[0])) {
          newTerms.unshift(originalGoal.terms[0]);
          extended = true;
        }
        if (!newTerms[newTerms.length - 1].isEquivalentTo(originalGoal.terms[originalGoal.terms.length - 1])) {
          newTerms.push(originalGoal.terms[originalGoal.terms.length - 1]);
          extended = true;
        }
        if (extended) {
          return (goal instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(...newTerms) : new FmtHLM.MetaRefExpression_equals(...newTerms));
        }
      }
      return goal;
    } else {
      return originalGoal;
    }
  }

  private addNoProofPlaceholder(heading: string | undefined, onInsertProof: InsertProofFn | undefined, state: ProofOutputState): void {
    if (!state.startRow) {
      state.startRow = [];
    }
    const noProof = new Notation.TextExpression('No proof.');
    noProof.styleClasses = ['proof-placeholder'];
    if (heading && heading !== 'Proof') {
      state.startRow.push(this.renderSubHeading(heading));
      state.startRowSpacing = '  ';
    }
    if (state.startRowSpacing) {
      state.startRow.push(new Notation.TextExpression(state.startRowSpacing));
      state.startRowSpacing = undefined;
    }
    state.startRow.push(noProof);
    if (this.editHandler && onInsertProof) {
      const insertButton = this.editHandler.getProofInsertButton(onInsertProof);
      state.startRow.push(new Notation.TextExpression(' '), insertButton);
    }
    state.paragraphs.push(new Notation.RowExpression(state.startRow));
    state.startRow = undefined;
    state.startRowSpacing = undefined;
  }

  private getTrivialProofPlaceholder(): Notation.RenderedExpression {
    const trivial = new Notation.TextExpression('Trivial.');
    trivial.styleClasses = ['proof-placeholder'];
    return trivial;
  }

  private addProof(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, externalGoal: Fmt.Expression | undefined, onInsertProof: InsertProofFn | undefined, paragraphs: Notation.RenderedExpression[]): void {
    const proofs = proof ? [proof] : undefined;
    this.addProofs(proofs, heading, externalGoal, onInsertProof, paragraphs);
  }

  private addSubProof(proof: FmtHLM.ObjectContents_Proof | undefined, context: HLMProofStepContext, indentSteps: boolean, state: ProofOutputState): void {
    this.commitImplications(state, false);
    if (proof || this.editHandler) {
      const showExternalGoal = !(proof?.steps.length && this.isDependentProofStepType(proof.steps[0].type));
      // TODO set onInsertProof
      this.addOptionalProofInternal(proof, undefined, context, showExternalGoal, false, indentSteps, undefined, state);
    } else if (context.goal) {
      if (!state.startRow) {
        state.startRow = [];
      }
      this.outputStartRowSpacing(state);
      state.startRow.push(this.readOnlyRenderer.renderFormula(context.goal, fullFormulaSelection));
      if (!state.isPreview) {
        state.startRow.push(new Notation.TextExpression('.'));
      }
      this.commitStartRow(state);
    } else if (state.startRow) {
      this.addNoProofPlaceholder(undefined, undefined, state);
    }
  }

  private addIndentedProof(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
      const context: HLMProofStepContext = {
        stepResults: new Map<Fmt.Parameter, Fmt.Expression>()
      };
      const state: ProofOutputState = {
        paragraphs: paragraphs,
        isPreview: false,
        onApply: () => {}
      };
      this.addIndentedProofInternal(proof, heading, context, state);
    }
  }

  private addIndentedSubProof(proof: FmtHLM.ObjectContents_Proof | undefined, context: HLMProofStepContext, state: ProofOutputState): void {
    this.commitImplications(state, true);
    this.addIndentedProofInternal(proof, undefined, context, state);
  }

  private addIndentedProofInternal(proof: FmtHLM.ObjectContents_Proof | undefined, heading: string | undefined, context: HLMProofStepContext, state: ProofOutputState): void {
    const indentedState: ProofOutputState = {
      paragraphs: [],
      isPreview: state.isPreview,
      onApply: state.onApply
    };
    // TODO set onInsertProof
    this.addOptionalProofInternal(proof, heading, context, false, false, false, undefined, indentedState);
    const indentedProof = new Notation.ParagraphExpression(indentedState.paragraphs);
    indentedProof.styleClasses = ['indented'];
    state.paragraphs.push(indentedProof);
  }

  private addProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], heading: string | undefined, labels: string[] | undefined, externalGoal: Fmt.Expression | undefined, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
      const context: HLMProofStepContext = {
        goal: externalGoal,
        stepResults: new Map<Fmt.Parameter, Fmt.Expression>()
      };
      const state: ProofOutputState = {
        paragraphs: paragraphs,
        isPreview: false,
        onApply: () => {}
      };
      this.addProofListInternal(proofs, heading, labels, context, state);
    }
  }

  private addProofListInternal(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], heading: string | undefined, labels: string[] | undefined, context: HLMProofStepContext, state: ProofOutputState): void {
    if (proofs.every((proof) => !proof)) {
      this.addNoProofPlaceholder(heading, undefined, state);
    } else {
      if (heading) {
        state.paragraphs.push(this.renderSubHeading(heading));
      }
      if (state.isPreview && labels) {
        const labelText = labels.map((label) => `${label}.`).join(' ');
        state.paragraphs.push(new Notation.TextExpression(labelText));
      } else {
        const items = proofs.map((proof) => {
          const itemState: ProofOutputState = {
            paragraphs: [],
            isPreview: state.isPreview,
            onApply: state.onApply
          };
          this.addOptionalProofInternal(proof, undefined, context, false, true, false, undefined, itemState);
          return new Notation.ParagraphExpression(itemState.paragraphs);
        });
        if (items.length) {
          if (items.length === 1 && !labels) {
            state.paragraphs.push(items[0]);
          } else {
            const list = new Notation.ListExpression(items, labels ? labels.map((label) => `${label}.`) : '*');
            state.paragraphs.push(list);
          }
        }
      }
    }
  }

  private addEquivalenceProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined, heading: string | undefined, symbol: string, paragraphs: Notation.RenderedExpression[]): void {
    if (this.options.includeProofs) {
      if (proofs && proofs.length) {
        const labels = this.getEquivalenceProofLabels(proofs, symbol);
        this.addProofList(proofs, heading, labels, undefined, paragraphs);
      } else {
        const state: ProofOutputState = {
          paragraphs: paragraphs,
          isPreview: false,
          onApply: () => {}
        };
        // TODO implement insertion
        this.addNoProofPlaceholder(heading, undefined, state);
      }
    }
  }

  private getEquivalenceProofLabels(proofs: FmtHLM.ObjectContents_Proof[], symbol: string, reverseSymbol?: string): string[] {
    return proofs.map((proof: FmtHLM.ObjectContents_Proof) => {
      let label = '?';
      if (proof._from !== undefined && proof._to !== undefined) {
        if (reverseSymbol) {
          if (proof._from === BigInt(1) && proof._to === BigInt(2)) {
            label = symbol;
          } else if (proof._from === BigInt(2) && proof._to === BigInt(1)) {
            label = reverseSymbol;
          }
        } else {
          label = `${proof._from}${symbol}${proof._to}`;
        }
      }
      return label;
    });
  }

  private addSubProofList(proofs: (FmtHLM.ObjectContents_Proof | undefined)[], labels: string[] | undefined, context: HLMProofStepContext, state: ProofOutputState): void {
    this.commitImplications(state, false);
    this.addProofListInternal(proofs, undefined, labels, context, state);
  }

  private addProofSteps(proof: FmtHLM.ObjectContents_Proof, steps: Fmt.ParameterList, context: HLMProofStepContext, state: ProofOutputState): void {
    const renderContext: HLMProofStepRenderContext = {
      ...context,
      originalParameters: [],
      substitutedParameters: [],
      isLastStep: false
    };
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      if (stepIndex === steps.length - 1) {
        renderContext.isLastStep = true;
      } else if (step.type instanceof FmtHLM.MetaRefExpression_Consider) {
        const nextStep = steps[stepIndex + 1];
        if (nextStep.type instanceof FmtHLM.MetaRefExpression_UseCases) {
          continue;
        }
      }
      let renderedStep = step;
      if (renderContext.originalParameters.length && renderContext.substitutedParameters.length) {
        // TODO this breaks the connection between the source code and the rendered version
        const substitutionContext = new HLMSubstitutionContext;
        this.utils.addParameterListSubstitution(renderContext.originalParameters, renderContext.substitutedParameters, substitutionContext);
        renderedStep = this.utils.applySubstitutionContextToParameter(renderedStep, substitutionContext);
      }
      const stepResult = this.addProofStep(proof, renderedStep, renderContext, state);
      if (stepResult) {
        renderContext.stepResults.set(step, stepResult);
      }
      renderContext.previousStep = step;
      renderContext.previousResult = stepResult;
    }
    this.commitImplications(state, false, true);
  }

  private addProofStep(proof: FmtHLM.ObjectContents_Proof, step: Fmt.Parameter, context: HLMProofStepRenderContext, state: ProofOutputState): Fmt.Expression | undefined {
    try {
      let type = step.type;
      const addImplication = (implication: ProofOutputImplication) => {
        if (context.isLastStep) {
          const displayContradiction = (context.goal !== undefined && this.utils.isFalseFormula(context.goal) && !this.utils.isFalseFormula(implication.result));
          const insertionContext = {
            ...context,
            previousStep: step,
            previousResult: implication.result
          };
          if (!this.addConditionalProofStepInsertButton(proof, insertionContext, displayContradiction, state) && displayContradiction) {
            if (!implication.resultPunctuation) {
              implication.resultPunctuation = [];
            }
            implication.resultPunctuation.push(
              new Notation.TextExpression('\u2002'),
              this.renderTemplate('Contradiction')
            );
          }
        }
        if (state.implications) {
          state.implications.push(implication);
        } else {
          state.implications = [implication];
        }
      };
      if (type instanceof FmtHLM.MetaRefExpression_ProveDef) {
        const subProofContext: HLMProofStepContext = {
          stepResults: context.stepResults
        };
        this.addSubProof(type.proof, subProofContext, false, state);
        return undefined;
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveForAll) {
        let goal: Fmt.Expression | undefined = undefined;
        if (context.goal instanceof FmtHLM.MetaRefExpression_forall && type.proof.parameters) {
          goal = this.utils.substituteParameters(context.goal.formula, context.goal.parameters, type.proof.parameters);
        }
        const subProofContext: HLMProofStepContext = {
          goal: goal,
          stepResults: context.stepResults
        };
        this.addSubProof(type.proof, subProofContext, false, state);
        return undefined;
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveBySubstitution) {
        this.renderProofBySubstitution(proof, type, context, undefined, state, addImplication);
        return undefined;
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveByContradiction) {
        let newGoal: Fmt.Expression = new FmtHLM.MetaRefExpression_or;
        if (context.goal instanceof FmtHLM.MetaRefExpression_or && context.goal.formulas) {
          const index = this.utils.externalToInternalIndex(type.proof._to);
          if (index !== undefined && index >= 0 && index < context.goal.formulas.length) {
            newGoal = context.goal.formulas[index];
          }
        }
        const subProofContext: HLMProofStepContext = {
          goal: newGoal,
          stepResults: context.stepResults
        };
        this.addSubProof(type.proof, subProofContext, false, state);
        return undefined;
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveByInduction) {
        const term = type.term;
        const hasCases = type.cases.length > 1;
        const isInduction = hasCases && type.cases.some((structuralCase: FmtHLM.ObjectContents_StructuralCase) => this.utils.referencesSelf(structuralCase.value));
        if (isInduction || state.isPreview) {
          if (!state.startRow) {
            state.startRow = [];
          }
          this.outputStartRowSpacing(state);
          const termSelection: ElementTermSelection = {
            allowCases: false,
            allowConstructors: false
          };
          state.startRow.push(
            new Notation.TextExpression(isInduction ? 'By induction on ' : hasCases ? 'Split on ' : 'Decompose '),
            this.readOnlyRenderer.renderElementTerm(term, termSelection),
            new Notation.TextExpression('.')
          );
        }
        this.commitStartRow(state);
        if (!state.isPreview) {
          this.commitImplications(state, false);
          if (type.construction instanceof Fmt.DefinitionRefExpression) {
            const path = type.construction.path;
            const items = type.cases.map((structuralCase: FmtHLM.ObjectContents_StructuralCase) => {
              const subProof = FmtHLM.ObjectContents_Proof.createFromExpression(structuralCase.value);
              const renderedSubProof = this.createInductionSubProofForRendering(structuralCase);
              const structuralCaseTermPromise = this.utils.getStructuralCaseTerm(path, structuralCase);
              const subProofPromise = structuralCaseTermPromise.then((structuralCaseTerm: Fmt.Expression) => {
                const subProofContext: HLMProofStepContext = {
                  goal: context.goal && !subProof.parameters ? this.utils.getInductionProofGoal(context.goal, term, structuralCaseTerm) : context.goal,
                  stepResults: context.stepResults
                };
                const subState: ProofOutputState = {
                  paragraphs: [],
                  isPreview: state.isPreview,
                  onApply: () => {
                    // Need to manually apply goal (but not steps) as the proof object we are operating on has been created temporarily from an expression.
                    // TODO this should be improved, by generating code where structuralCase.value already has the correct type
                    // TODO also reflect the correct type in the VSCode extension
                    subProof.goal = renderedSubProof.goal;
                    structuralCase.value = subProof.toExpression(false);
                    state.onApply();
                  }
                };
                this.addSubProof(renderedSubProof, subProofContext, false, subState);
                return new Notation.ParagraphExpression(subState.paragraphs);
              });
              return new Notation.PromiseExpression(subProofPromise);
            });
            const list = new Notation.ListExpression(items, '*');
            state.paragraphs.push(list);
          }
        }
        return undefined;
      }
      this.commitStartRow(state);
      if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
        this.commitImplications(state, false);
        state.paragraphs.push(this.renderParameter(step, true, false, false));
        const result = this.utils.getProofStepResult(step, context);
        if (context.isLastStep) {
          const insertionContext = {
            ...context,
            previousStep: step,
            previousResult: result
          };
          this.addConditionalProofStepInsertButton(proof, insertionContext, false, state);
        }
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_Consider || type instanceof Fmt.VariableRefExpression || type instanceof Fmt.IndexedExpression) {
        const result = this.utils.getProofStepTypeResult(type, context);
        if (result) {
          if (type instanceof FmtHLM.MetaRefExpression_Consider) {
            type = type.variable;
          }
          addImplication({
            dependsOnPrevious: false,
            result: result,
            resultLink: type,
            resultIsEditable: false
          });
        }
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_State) {
        let byDefinition: Fmt.Expression | undefined = undefined;
        let bySubstitution: Fmt.Expression | undefined = undefined;
        let definitionDependency: Fmt.Expression | undefined;
        const subProof = type.proof;
        if (subProof?.steps.length === 1) {
          const subStepType = subProof.steps[0].type;
          if (subStepType instanceof FmtHLM.MetaRefExpression_ProveDef) {
            if (subStepType.proof) {
              if (subStepType.proof.steps.length === 1 && subStepType.proof.goal instanceof FmtHLM.MetaRefExpression_exists && subStepType.proof.goal.formula) {
                const subSubStepType = subStepType.proof.steps[0].type;
                if (subSubStepType instanceof FmtHLM.MetaRefExpression_ProveExists && !subSubStepType.proof) {
                  byDefinition = subStepType;
                  definitionDependency = this.utils.substituteArguments(subStepType.proof.goal.formula, subStepType.proof.goal.parameters, subSubStepType.arguments, undefined);
                }
              }
            } else {
              byDefinition = subStepType;
            }
          } else if (subStepType instanceof FmtHLM.MetaRefExpression_ProveBySubstitution) {
            bySubstitution = subStepType;
          }
        }
        const implication: ProofOutputImplication = {
          dependsOnPrevious: false,
          result: type.statement,
          resultIsEditable: true
        };
        let fullSentence = false;
        if (definitionDependency || (context.previousStep && this.utils.referencesParameter(type, context.previousStep))) {
          if (definitionDependency && !(context.previousResult && definitionDependency.isEquivalentTo(context.previousResult))) {
            implication.source = this.readOnlyRenderer.renderFormula(definitionDependency, fullFormulaSelection);
          } else {
            implication.dependsOnPrevious = true;
          }
        } else {
          implication.resultPrefixes = [new Notation.TextExpression('We have ')];
          fullSentence = true;
        }
        if (fullSentence) {
          this.commitImplications(state, false);
        }
        let showSubProof = subProof !== undefined || this.editHandler !== undefined;
        if (byDefinition) {
          // TODO link to definition
          implication.resultSuffixes = [
            new Notation.TextExpression(' by '),
            this.renderProofStepSource(byDefinition)
          ];
          showSubProof = false;
        } else if (bySubstitution) {
          showSubProof = false;
        }
        if (fullSentence || showSubProof) {
          implication.resultPunctuation = [new Notation.TextExpression(showSubProof ? ':' : '.')];
        }
        addImplication(implication);
        if (showSubProof) {
          const subProofContext: HLMProofStepContext = {
            goal: type.statement,
            stepResults: context.stepResults
          };
          this.addIndentedSubProof(subProof, subProofContext, state);
        }
        return type.statement;
      } else if (this.isDependentProofStepType(type) || type instanceof FmtHLM.MetaRefExpression_UseTheorem) {
        const result = this.utils.getProofStepTypeResult(type, context);
        if (!result) {
          return undefined;
        }
        let dependsOnPrevious = (context.previousResult !== undefined);
        let sourceFormula: Notation.RenderedExpression | undefined = undefined;
        let sourceType = type;
        if (type instanceof FmtHLM.MetaRefExpression_Substitute) {
          if (type.source instanceof FmtHLM.MetaRefExpression_UseTheorem
              || type.source instanceof FmtHLM.MetaRefExpression_UseImplicitOperator) {
            sourceType = type.source;
          }
          sourceFormula = this.getSourceFormula(type.source, context);
        }
        let source: Notation.RenderedExpression | undefined = undefined;
        if (sourceType instanceof FmtHLM.MetaRefExpression_UseDef
            || sourceType instanceof FmtHLM.MetaRefExpression_Unfold) {
          source = new Notation.TextExpression('def');
          // TODO link to definition
          if (state.isPreview) {
            dependsOnPrevious = true;
          }
        } else if (sourceType instanceof FmtHLM.MetaRefExpression_UseForAll && context.previousResult instanceof FmtHLM.MetaRefExpression_forall) {
          source = this.renderArgumentList(context.previousResult.parameters, sourceType.arguments, undefined, ArgumentListStyle.Formulas);
        } else if (sourceType instanceof FmtHLM.MetaRefExpression_UseTheorem && sourceType.theorem instanceof Fmt.DefinitionRefExpression) {
          source = this.renderItemNumber(sourceType.theorem);
          dependsOnPrevious = (type instanceof FmtHLM.MetaRefExpression_Substitute
                               || (context.previousStep !== undefined && this.utils.referencesParameter(sourceType, context.previousStep)));
        }
        addImplication({
          dependsOnPrevious: dependsOnPrevious,
          source: source,
          sourceFormula: sourceFormula,
          result: result,
          resultIsEditable: false
        });
        // TODO add sub-proofs (maybe inline like in expressions, or maybe expandable)
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_UseImplicitOperator) {
        const result = this.utils.getProofStepTypeResult(type, context);
        if (!result) {
          return undefined;
        }
        addImplication({
          dependsOnPrevious: false,
          result: result,
          resultIsEditable: false,
          resultSuffixes: [
            new Notation.TextExpression(' by '),
            this.readOnlyRenderer.renderProofStepSource(type)
          ]
        });
        return result;
      } else if (type instanceof FmtHLM.MetaRefExpression_UseCases
                 || type instanceof FmtHLM.MetaRefExpression_ProveCases) {
        const subProofContext: HLMProofStepContext = {
          stepResults: context.stepResults
        };
        if (type instanceof FmtHLM.MetaRefExpression_UseCases) {
          subProofContext.goal = context.goal;
        }
        this.addSubProofList(type.caseProofs, undefined, subProofContext, state);
      } else if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
        if (context.previousResult instanceof FmtHLM.MetaRefExpression_exists || context.previousResult instanceof FmtHLM.MetaRefExpression_existsUnique) {
          context.originalParameters.push(...type.parameters);
          context.substitutedParameters.push(...context.previousResult.parameters);
          const result = context.previousResult.formula;
          const insertionContext: HLMProofStepRenderContext = {
            ...context,
            previousStep: step,
            previousResult: result
          };
          this.addConditionalProofStepInsertButton(proof, insertionContext, false, state);
          return result;
        } else {
          this.commitImplications(state, false);
          state.paragraphs.push(new Notation.ErrorExpression('Previous result is not existentially quantified'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveExists) {
        this.commitImplications(state, false);
        if (context.goal instanceof FmtHLM.MetaRefExpression_exists) {
          const argumentList = this.renderArgumentList(context.goal.parameters, type.arguments, undefined, ArgumentListStyle.Definitions);
          state.startRow = [
            new Notation.TextExpression('Take '),
            argumentList,
            new Notation.TextExpression('.')
          ];
          state.startRowSpacing = ' ';
          if (type.proof && !(type.proof.steps.length === 1 && type.proof.steps[0].type instanceof FmtHLM.MetaRefExpression_Consider)) {
            const subProofContext: HLMProofStepContext = {
              stepResults: context.stepResults,
              goal: context.goal.formula ? this.utils.substituteArguments(context.goal.formula, context.goal.parameters, type.arguments, undefined) : undefined
            };
            this.addSubProof(type.proof, subProofContext, true, state);
          } else {
            this.commitStartRow(state);
          }
        } else {
          state.paragraphs.push(new Notation.ErrorExpression('Goal is not existentially quantified'));
        }
      } else if (type instanceof FmtHLM.MetaRefExpression_ProveEquivalence) {
        let labels: string[] | undefined = undefined;
        if (context.goal instanceof FmtHLM.MetaRefExpression_setEquals) {
          labels = this.getEquivalenceProofLabels(type.proofs, '⊆', context.goal.terms.length === 2 ? '⊇' : undefined);
        } else if (context.goal instanceof FmtHLM.MetaRefExpression_equiv) {
          labels = this.getEquivalenceProofLabels(type.proofs, '⇒', context.goal.formulas.length === 2 ? '⇐' : undefined);
        }
        const subProofContext: HLMProofStepContext = {
          stepResults: context.stepResults
        };
        this.addSubProofList(type.proofs, labels, subProofContext, state);
      } else {
        this.commitImplications(state, false);
        state.paragraphs.push(new Notation.ErrorExpression('Unknown proof step type'));
      }
    } catch (e) {
      this.commitImplications(state, false);
      state.paragraphs.push(new Notation.ErrorExpression(e.message));
    }
    return undefined;
  }

  private isDependentProofStepType(type: Fmt.Expression): boolean {
    return (type instanceof FmtHLM.MetaRefExpression_UseDef
            || type instanceof FmtHLM.MetaRefExpression_Unfold
            || type instanceof FmtHLM.MetaRefExpression_UseForAll
            || type instanceof FmtHLM.MetaRefExpression_Substitute);
  }

  private renderProofStepSource(type: Fmt.Expression): Notation.RenderedExpression {
    if (type instanceof FmtHLM.MetaRefExpression_ProveDef) {
      // TODO link to definition
      return new Notation.TextExpression('definition');
    } else if (type instanceof FmtHLM.MetaRefExpression_UseTheorem && type.theorem instanceof Fmt.DefinitionRefExpression) {
      return this.readOnlyRenderer.renderItemNumber(type.theorem);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseImplicitOperator) {
      const result = new Notation.RowExpression([
        new Notation.TextExpression('definition of '),
        this.readOnlyRenderer.renderElementTerm(type.operator, fullElementTermSelection)
      ]);
      this.addSemanticLink(result, type.operator);
      return result;
    } else {
      return new Notation.ErrorExpression('Unknown proof step source');
    }
  }

  private renderProofBySubstitution(proof: FmtHLM.ObjectContents_Proof, type: FmtHLM.MetaRefExpression_ProveBySubstitution, context: HLMProofStepRenderContext, originalLeftTerm: Fmt.Expression | undefined, state: ProofOutputState, addImplication: (implication: ProofOutputImplication) => void): void {
    const goal = context.goal;
    const sourceContext: HLMProofStepRenderContext = {
      ...context,
      goal: undefined,
      isLastStep: false,
      originalGoal: undefined,
      previousResult: undefined,
      previousStep: undefined
    };
    const subProofContext: HLMProofStepRenderContext = {
      ...sourceContext,
      goal: type.goal
    };
    if (!this.editHandler && !state.isPreview) {
      if (((goal instanceof FmtHLM.MetaRefExpression_setEquals && type.goal instanceof FmtHLM.MetaRefExpression_setEquals)
           || (goal instanceof FmtHLM.MetaRefExpression_equals && type.goal instanceof FmtHLM.MetaRefExpression_equals))
          && goal.terms.length >= 2
          && type.goal.terms.length === 2) {
        const targetTerm = type.goal.terms[1];
        if (goal.terms[1].isEquivalentTo(targetTerm)
            && (originalLeftTerm || !type.goal.terms[0].isEquivalentTo(targetTerm))) {
          const leftTerm = originalLeftTerm ?? goal.terms[0];
          const rightTerm = type.goal.terms[0];
          const equality = goal instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(leftTerm, rightTerm) : new FmtHLM.MetaRefExpression_equals(leftTerm, rightTerm);
          let source: Notation.RenderedExpression | undefined = undefined;
          const sourceType = type.source;
          if (sourceType instanceof FmtHLM.MetaRefExpression_UseTheorem && sourceType.theorem instanceof Fmt.DefinitionRefExpression) {
            source = this.renderItemNumber(sourceType.theorem);
          }
          addImplication({
            dependsOnPrevious: originalLeftTerm !== undefined,
            result: equality,
            resultIsEditable: false,
            source: source,
            sourceFormula: this.getSourceFormula(type.source, context)
          });
          const targetReached = this.continueCalculation(type.proof, subProofContext, leftTerm, rightTerm, state, addImplication);
          const addProof = type.proof?.steps.length && !targetReached;
          for (let additionalRightTermIndex = targetReached || rightTerm.isEquivalentTo(targetTerm) ? 2 : 1; additionalRightTermIndex < goal.terms.length; additionalRightTermIndex++) {
            const additionalRightTerm = goal.terms[additionalRightTermIndex];
            const additionalEquality = goal instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(leftTerm, additionalRightTerm) : new FmtHLM.MetaRefExpression_equals(leftTerm, additionalRightTerm);
            const punctuation = additionalRightTermIndex === goal.terms.length - 1 && addProof ? [new Notation.TextExpression(':')] : undefined;
            addImplication({
              dependsOnPrevious: true,
              result: additionalEquality,
              resultIsEditable: false,
              resultPunctuation: punctuation
            });
          }
          if (!addProof) {
            return;
          }
        } else if (goal.terms.length > 2
                   && goal.terms.slice(2).some((term: Fmt.Expression) => term.isEquivalentTo(targetTerm))) {
          const leftTerm = originalLeftTerm ?? goal.terms[0];
          const rightTerm = goal.terms[1];
          const equality = goal instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(leftTerm, rightTerm) : new FmtHLM.MetaRefExpression_equals(leftTerm, rightTerm);
          addImplication({
            dependsOnPrevious: originalLeftTerm !== undefined,
            result: equality,
            resultIsEditable: false
          });
          const newGoal = goal instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(...goal.terms.slice(1)) : new FmtHLM.MetaRefExpression_equals(...goal.terms.slice(1));
          const newContext = {
            ...context,
            goal: newGoal
          };
          this.renderProofBySubstitution(proof, type, newContext, leftTerm, state, addImplication);
          return;
        }
      }
    }
    if (!(type.source instanceof Fmt.VariableRefExpression || type.source instanceof Fmt.IndexedExpression || type.source instanceof FmtHLM.MetaRefExpression_Consider)) {
      const step = new Fmt.Parameter('_', type.source);
      this.addProofStep(proof, step, sourceContext, state);
    }
    this.addSubProof(type.proof, subProofContext, false, state);
    if (goal && !type.proof && !this.editHandler && !state.isPreview) {
      addImplication({
        dependsOnPrevious: true,
        result: goal,
        resultIsEditable: false,
        sourceFormula: this.getSourceFormula(type.source, context)
      });
    }
  }

  private continueCalculation(subProof: FmtHLM.ObjectContents_Proof | undefined, context: HLMProofStepRenderContext, leftTerm: Fmt.Expression, previousRightTerm: Fmt.Expression, state: ProofOutputState, addImplication: (implication: ProofOutputImplication) => void): boolean {
    if (subProof?.steps.length === 1) {
      const firstStep = subProof.steps[0];
      const type = firstStep.type;
      if (type instanceof FmtHLM.MetaRefExpression_ProveBySubstitution) {
        this.renderProofBySubstitution(subProof, type, context, leftTerm, state, addImplication);
        return true;
      } else {
        const firstStepResult = this.utils.getProofStepResult(firstStep, context);
        if ((firstStepResult instanceof FmtHLM.MetaRefExpression_setEquals || firstStepResult instanceof FmtHLM.MetaRefExpression_equals)
            && firstStepResult.terms.length === 2) {
          let rightTerm: Fmt.Expression;
          if (firstStepResult.terms[0].isEquivalentTo(previousRightTerm)) {
            rightTerm = firstStepResult.terms[1];
          } else if (firstStepResult.terms[1].isEquivalentTo(previousRightTerm)) {
            rightTerm = firstStepResult.terms[0];
          } else {
            return false;
          }
          const finalEquality = firstStepResult instanceof FmtHLM.MetaRefExpression_setEquals ? new FmtHLM.MetaRefExpression_setEquals(leftTerm, rightTerm) : new FmtHLM.MetaRefExpression_equals(leftTerm, rightTerm);
          let source: Notation.RenderedExpression | undefined = undefined;
          if (firstStep.type instanceof FmtHLM.MetaRefExpression_UseTheorem && firstStep.type.theorem instanceof Fmt.DefinitionRefExpression) {
            source = this.renderItemNumber(firstStep.type.theorem);
          }
          addImplication({
            dependsOnPrevious: true,
            result: finalEquality,
            resultIsEditable: false,
            source: source
          });
          return true;
        }
      }
    }
    return false;
  }

  private getSourceFormula(source: Fmt.Expression, context: HLMProofStepContext): Notation.RenderedExpression | undefined {
    const sourceContext: HLMProofStepContext = {
      stepResults: context.stepResults
    };
    const sourceResult = this.utils.getProofStepTypeResult(source, sourceContext);
    if (sourceResult) {
      const sourceFormula = this.readOnlyRenderer.renderFormula(sourceResult, fullFormulaSelection);
      if (!sourceFormula.styleClasses) {
        sourceFormula.styleClasses = [];
      }
      this.readOnlyRenderer.addSemanticLink(sourceFormula, source);
      return sourceFormula;
    } else {
      return undefined;
    }
  }

  private getConditionalProofStepInsertButton(proof: FmtHLM.ObjectContents_Proof, context: HLMProofStepRenderContext, displayContradiction: boolean, state: ProofOutputState): Notation.RenderedExpression {
    const onRenderTrivialProof = () => (displayContradiction ? this.renderTemplate('Contradiction') : new Notation.EmptyExpression);
    const onRenderProofStep = (renderedStep: Fmt.Parameter) => this.readOnlyRenderer.renderProofStepPreview(proof, renderedStep, context);
    const onRenderFormula = (expression: Fmt.Expression) => this.readOnlyRenderer.renderFormulaInternal(expression)[0]!;
    const onRenderArgumentList = (parameterList: Fmt.ParameterList, argumentList: Fmt.ArgumentList, innerEditHandler: HLMEditHandler) => {
      const innerRenderer = new HLMRenderer(this.definition, this.libraryDataAccessor, this.utils, this.renderUtils, this.templates, this.options, innerEditHandler);
      return innerRenderer.renderArgumentList(parameterList, argumentList, undefined, ArgumentListStyle.Definitions);
    };
    return this.editHandler!.getConditionalProofStepInsertButton(proof, state.onApply, onRenderTrivialProof, onRenderProofStep, onRenderFormula, onRenderArgumentList);
  }

  private addConditionalProofStepInsertButton(proof: FmtHLM.ObjectContents_Proof, context: HLMProofStepRenderContext, displayContradiction: boolean, state: ProofOutputState): boolean {
    if (this.editHandler) {
      if (!this.utils.containsPlaceholders()) {
        state.additionalRow = this.getConditionalProofStepInsertButton(proof, context, displayContradiction, state);
      }
      return true;
    } else {
      return false;
    }
  }

  private renderProofStepPreview(proof: FmtHLM.ObjectContents_Proof, step: Fmt.Parameter, context: HLMProofStepRenderContext): Notation.RenderedExpression {
    context = {
      ...context,
      isLastStep: false
    };
    const state: ProofOutputState = {
      paragraphs: [],
      isPreview: true,
      onApply: () => {}
    };
    this.addProofStep(proof, step, context, state);
    this.commitImplications(state, false);
    if (state.paragraphs.length === 1) {
      return state.paragraphs[0];
    } else {
      return new Notation.ParagraphExpression(state.paragraphs);
    }
  }

  private createInductionSubProofForRendering(structuralCase: FmtHLM.ObjectContents_StructuralCase): FmtHLM.ObjectContents_Proof {
    const subProof = FmtHLM.ObjectContents_Proof.createFromExpression(structuralCase.value);
    if (structuralCase.parameters) {
      if (subProof.parameters) {
        subProof.parameters = new Fmt.ParameterList(...structuralCase.parameters, ...subProof.parameters);
      } else {
        subProof.parameters = structuralCase.parameters;
      }
    }
    return subProof;
  }

  private outputStartRowSpacing(state: ProofOutputState): void {
    if (state.startRowSpacing) {
      state.startRow?.push(new Notation.TextExpression(state.startRowSpacing));
      state.startRowSpacing = undefined;
    }
  }

  private commitStartRow(state: ProofOutputState): void {
    if (state.startRow) {
      if (state.startRow.length) {
        state.paragraphs.push(new Notation.RowExpression(state.startRow));
      }
      state.startRow = undefined;
      state.startRowSpacing = undefined;
    }
  }

  private commitImplications(state: ProofOutputState, forceLeftAlignment: boolean, commitAdditionalRow: boolean = false): void {
    if (state.implications || (commitAdditionalRow && state.additionalRow)) {
      this.commitStartRow(state);
      const gridState: ProofGridState = {
        rows: []
      };
      if (state.implications) {
        for (let index = 0; index < state.implications.length; index++) {
          const implication = state.implications[index];
          const nextImplication = index + 1 < state.implications.length ? state.implications[index + 1] : undefined;
          let mergeEquality = nextImplication !== undefined && nextImplication.dependsOnPrevious && this.canMergeEquality(implication.result, nextImplication.result);
          if (!implication.dependsOnPrevious || (mergeEquality && gridState.equalitySymbolColumn === undefined)) {
            this.commitProofGrid(gridState, state.paragraphs);
          }
          const row: Notation.RenderedExpression[] = [];
          this.outputImplication(implication, gridState, mergeEquality, row);
          if (gridState.implicationSymbolColumn === undefined
              && gridState.equalitySymbolColumn === undefined
              && nextImplication?.dependsOnPrevious
              && (!forceLeftAlignment || state.implications.length === index + 2)) {
            index++;
            const nextNextImplication = index + 1 < state.implications.length ? state.implications[index + 1] : undefined;
            mergeEquality = nextNextImplication !== undefined && nextNextImplication.dependsOnPrevious && this.canMergeEquality(nextImplication.result, nextNextImplication.result);
            this.outputImplication(nextImplication, gridState, mergeEquality, row);
          }
          gridState.rows.push(row);
          if ((gridState.equalitySymbolColumn !== undefined && !mergeEquality)
              || (forceLeftAlignment && !implication.dependsOnPrevious)) {
            this.commitProofGrid(gridState, state.paragraphs);
          }
        }
        this.commitPunctuation(gridState);
        state.implications = undefined;
      }
      if (commitAdditionalRow && state.additionalRow) {
        const row: Notation.RenderedExpression[] = [];
        if (gridState.implicationSymbolColumn !== undefined) {
          while (!row.length || row.length < gridState.implicationSymbolColumn) {
            row.push(new Notation.EmptyExpression);
          }
        }
        row.push(state.additionalRow);
        gridState.rows.push(row);
        state.additionalRow = undefined;
      }
      this.commitProofGrid(gridState, state.paragraphs);
    }
  }

  private canMergeEquality(currentResult: Fmt.Expression, nextResult: Fmt.Expression): boolean {
    return ((currentResult instanceof FmtHLM.MetaRefExpression_setEquals || currentResult instanceof FmtHLM.MetaRefExpression_equals)
            && currentResult.terms.length === 2
            && (nextResult instanceof FmtHLM.MetaRefExpression_setEquals || nextResult instanceof FmtHLM.MetaRefExpression_equals)
            && nextResult.terms.length === 2
            && currentResult.terms[0].isEquivalentTo(nextResult.terms[0]));
  }

  private outputImplication(implication: ProofOutputImplication, gridState: ProofGridState, mergeEquality: boolean, row: Notation.RenderedExpression[]): void {
    if ((implication.dependsOnPrevious || (implication.source && !mergeEquality)) && gridState.equalitySymbolColumn === undefined) {
      this.outputImplicationSymbol(implication, gridState, row);
    }
    if (mergeEquality || gridState.equalitySymbolColumn !== undefined) {
      this.outputEquality(implication, gridState, row);
    } else {
      this.outputImplicationResult(implication, row);
    }
    if (implication.resultPunctuation) {
      gridState.pendingPunctuation = implication.resultPunctuation;
    }
  }

  private outputImplicationSymbol(implication: ProofOutputImplication, gridState: ProofGridState, row: Notation.RenderedExpression[]): void {
    if (implication.source && !implication.dependsOnPrevious) {
      row.push(implication.source);
      implication.source = undefined;
    }
    if (gridState.implicationSymbolColumn === undefined) {
      gridState.implicationSymbolColumn = row.length;
    }
    const leftAligned = !gridState.implicationSymbolColumn;
    // Implication symbol cannot be in the first column because only odd columns are center-aligned.
    while (!row.length || row.length < gridState.implicationSymbolColumn) {
      row.push(new Notation.EmptyExpression);
    }
    const implicationRow: Notation.RenderedExpression[] = [
      this.renderTemplate('ProofImplication', {
                            'source': implication.source,
                            'formula': implication.sourceFormula
                          }),
      new Notation.TextExpression('\u2002')
    ];
    if (!leftAligned) {
      implicationRow.unshift(new Notation.TextExpression('\u2002'));
    }
    row.push(new Notation.RowExpression(implicationRow));
    implication.source = undefined;
    implication.sourceFormula = undefined;
  }

  private outputImplicationResult(implication: ProofOutputImplication, row: Notation.RenderedExpression[]): void {
    const renderer = implication.resultIsEditable ? this : this.readOnlyRenderer;
    const formulaSelection: FormulaSelection = {
      allowTruthValue: false,
      allowEquiv: false,
      allowCases: true
    };
    const result = (this.utils.isFalseFormula(implication.result)
                  ? renderer.renderTemplate('Contradiction')
                  : renderer.renderFormula(implication.result, formulaSelection));
    if (implication.resultLink) {
      renderer.addSemanticLink(result, implication.result);
    }
    const resultWithParens = new Notation.InnerParenExpression(result);
    resultWithParens.maxLevel = -3;
    if (implication.resultPrefixes || implication.resultSuffixes) {
      const resultRow: Notation.RenderedExpression[] = [];
      if (implication.resultPrefixes) {
        resultRow.push(...implication.resultPrefixes);
      }
      resultRow.push(resultWithParens);
      if (implication.resultSuffixes) {
        resultRow.push(...implication.resultSuffixes);
      }
      row.push(new Notation.RowExpression(resultRow));
    } else {
      row.push(resultWithParens);
    }
  }

  private outputEquality(implication: ProofOutputImplication, gridState: ProofGridState, row: Notation.RenderedExpression[]): void {
    const result = implication.result;
    let left: Notation.RenderedExpression;
    let right: Notation.RenderedExpression;
    if (result instanceof FmtHLM.MetaRefExpression_setEquals && result.terms.length === 2) {
      left = this.readOnlyRenderer.renderSetTerm(result.terms[0], fullSetTermSelection);
      right = this.readOnlyRenderer.renderSetTerm(result.terms[1], fullSetTermSelection);
    } else if (result instanceof FmtHLM.MetaRefExpression_equals && result.terms.length === 2) {
      left = this.readOnlyRenderer.renderElementTerm(result.terms[0], fullElementTermSelection);
      right = this.readOnlyRenderer.renderElementTerm(result.terms[1], fullElementTermSelection);
    } else {
      // Should never happen according to canMergeEquality.
      return;
    }
    if (gridState.equalitySymbolColumn === undefined) {
      if (implication.resultPrefixes) {
        row.push(new Notation.RowExpression([...implication.resultPrefixes, left]));
      } else {
        row.push(left);
      }
      gridState.equalitySymbolColumn = row.length;
    } else {
      while (row.length < gridState.equalitySymbolColumn) {
        row.push(new Notation.EmptyExpression);
      }
    }
    row.push(new Notation.RowExpression([
      new Notation.TextExpression('\u2008'),
      this.renderTemplate('ProofEquality', {
                            'source': implication.source,
                            'formula': implication.sourceFormula
                          }),
      new Notation.TextExpression('\u2008')
    ]));
    if (implication.resultSuffixes) {
      row.push(new Notation.RowExpression([right, ...implication.resultSuffixes]));
    } else {
      row.push(right);
    }
  }

  private commitProofGrid(gridState: ProofGridState, paragraphs: Notation.RenderedExpression[]): void {
    this.commitPunctuation(gridState);
    if (gridState.rows.length) {
      const table = new Notation.TableExpression(gridState.rows);
      table.styleClasses = ['proof-grid'];
      paragraphs.push(table);
    }
    gridState.rows = [];
    gridState.implicationSymbolColumn = undefined;
    gridState.equalitySymbolColumn = undefined;
  }

  private commitPunctuation(gridState: ProofGridState): void {
    if (gridState.pendingPunctuation && gridState.rows.length) {
      const lastRow = gridState.rows[gridState.rows.length - 1];
      if (lastRow.length) {
        lastRow[lastRow.length - 1] = new Notation.RowExpression([
          lastRow[lastRow.length - 1],
          ...gridState.pendingPunctuation
        ]);
      } else {
        lastRow.push(...gridState.pendingPunctuation);
      }
    }
    gridState.pendingPunctuation = undefined;
  }

  addPlaceholderMenu(placeholder: Fmt.PlaceholderExpression, semanticLink: Notation.SemanticLink): void {
    if (this.editHandler) {
      switch (placeholder.placeholderType) {
      case HLMExpressionType.SetTerm:
        {
          const onRenderTerm = (expression: Fmt.Expression) => this.renderSetTermInternal(expression, false)!;
          this.editHandler.addSetTermMenu(semanticLink, placeholder, onRenderTerm, fullSetTermSelection);
        }
        break;
      case HLMExpressionType.ElementTerm:
        {
          const onRenderTerm = (expression: Fmt.Expression) => this.renderElementTermInternal(expression)!;
          this.editHandler.addElementTermMenu(semanticLink, placeholder, onRenderTerm, fullElementTermSelection);
        }
        break;
      case HLMExpressionType.Formula:
        {
          const onRenderFormula = (expression: Fmt.Expression) => this.renderFormulaInternal(expression)[0]!;
          this.editHandler.addFormulaMenu(semanticLink, placeholder, onRenderFormula, fullFormulaSelection);
        }
        break;
      }
    }
  }

  getDefinitionParts(): Logic.ObjectRenderFns {
    const result = new Map<Object, Logic.RenderFn>();
    this.addDefinitionParts([this.definition], result);
    return result;
  }

  private addDefinitionParts(definitions: Fmt.Definition[], result: Logic.ObjectRenderFns): void {
    const definition = definitions[definitions.length - 1];
    const contents = definition.contents;
    if (!(contents instanceof FmtHLM.ObjectContents_MacroOperator)) {
      this.addParameterListParts(definition.parameters, definition, result);
      for (const innerDefinition of definition.innerDefinitions) {
        this.addDefinitionParts(definitions.concat(innerDefinition), result);
      }
      if (contents instanceof FmtHLM.ObjectContents_Definition) {
        const notation = contents.notation;
        if (notation) {
          result.set(notation, () => this.renderDefinitionNotationExpression(notation, definitions));
        }
        if (contents instanceof FmtHLM.ObjectContents_Construction) {
          const embedding = contents.embedding;
          if (embedding) {
            result.set(embedding.parameter, () => this.renderParameter(embedding.parameter, false, false, false));
            result.set(embedding.target, () => this.renderElementTerm(embedding.target, fullElementTermSelection));
            this.addProofParts(embedding.wellDefinednessProof, result);
          }
        } else if (contents instanceof FmtHLM.ObjectContents_Constructor) {
          const equalityDefinition = contents.equalityDefinition;
          if (equalityDefinition) {
            this.addParameterListParts(equalityDefinition.leftParameters, undefined, result);
            this.addParameterListParts(equalityDefinition.rightParameters, undefined, result);
            for (const item of equalityDefinition.definition) {
              this.addFormulaParts(item, result);
            }
            this.addProofListParts(equalityDefinition.equivalenceProofs, result);
            this.addProofParts(equalityDefinition.reflexivityProof, result);
            this.addProofParts(equalityDefinition.symmetryProof, result);
            this.addProofParts(equalityDefinition.transitivityProof, result);
          }
          const rewrite = contents.rewrite;
          if (rewrite) {
            this.addElementTermParts(rewrite.value, result);
            if (rewrite.theorem) {
              this.addGenericExpressionParts(rewrite.theorem, result);
            }
          }
        } else if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          for (const item of contents.definition) {
            this.addSetTermParts(item, result);
          }
          this.addProofListParts(contents.equalityProofs, result);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          for (const item of contents.definition) {
            this.addElementTermParts(item, result);
          }
          this.addProofListParts(contents.equalityProofs, result);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          this.addParameterParts(contents.parameter, result);
          for (const item of contents.definition) {
            this.addFormulaParts(item, result);
          }
          this.addProofParts(contents.wellDefinednessProof, result);
          this.addProofListParts(contents.equivalenceProofs, result);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          for (const item of contents.definition) {
            this.addFormulaParts(item, result);
          }
          this.addProofListParts(contents.equivalenceProofs, result);
        }
      } else {
        if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
          this.addFormulaParts(contents.claim, result);
          this.addProofListParts(contents.proofs, result);
        } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          for (const item of contents.conditions) {
            this.addFormulaParts(item, result);
          }
          this.addProofListParts(contents.equivalenceProofs, result);
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
  }

  private addPathParts(path: Fmt.Path, result: Logic.ObjectRenderFns): void {
    this.addArgumentListParts(path.arguments, result);
    if (path.parentPath instanceof Fmt.Path) {
      this.addPathParts(path.parentPath, result);
    }
  }

  private addParameterListParts(parameters: Fmt.ParameterList, associatedDefinition: Fmt.Definition | undefined, result: Logic.ObjectRenderFns): void {
    const initialState: ParameterListState = {
      fullSentence: true,
      sentence: true,
      abbreviate: false,
      forcePlural: false,
      enableSpecializations: true,
      inInsertMenu: false,
      started: false,
      inLetExpr: false,
      inConstraint: false,
      inDefinition: false,
      inDefinitionNotationGroup: false,
      inForEach: false,
      inExistsUnique: false,
      associatedDefinition: associatedDefinition
    };
    let currentGroup: Fmt.Parameter[] = [];
    for (const param of parameters) {
      if (currentGroup.length && param.type !== currentGroup[0].type) {
        const group = currentGroup;
        result.set(group[0], () => this.renderParametersWithInitialState(group, initialState));
        currentGroup = [];
      }
      currentGroup.push(param);
    }
    if (currentGroup.length) {
      const group = currentGroup;
      result.set(group[0], () => this.renderParametersWithInitialState(group, initialState));
    }
  }

  private addParameterParts(parameter: Fmt.Parameter, result: Logic.ObjectRenderFns): void {
    result.set(parameter, () => this.renderParameter(parameter, false, false, false));
  }

  private addArgumentListParts(args: Fmt.ArgumentList, result: Logic.ObjectRenderFns): void {
    for (const arg of args) {
      if (arg.value instanceof Fmt.CompoundExpression) {
        let index = 0;
        for (const item of arg.value.arguments) {
          if (item.name === 'proof' || (item.name && item.name.endsWith('Proof'))) {
            const proof = FmtHLM.ObjectContents_Proof.createFromExpression(item.value);
            this.addProofParts(proof, result);
          } else if (item.name === 'arguments') {
            const value = item.value as Fmt.CompoundExpression;
            this.addArgumentListParts(value.arguments, result);
          } else if (!index) {
            this.addGenericExpressionParts(item.value, result);
          }
          index++;
        }
      } else {
        this.addGenericExpressionParts(arg.value, result);
      }
    }
  }

  private addProofListParts(proofs: FmtHLM.ObjectContents_Proof[] | undefined, result: Logic.ObjectRenderFns): void {
    if (proofs && this.options.includeProofs) {
      for (const proof of proofs) {
        this.addProofParts(proof, result);
      }
    }
  }

  private addProofParts(proof: FmtHLM.ObjectContents_Proof | undefined, result: Logic.ObjectRenderFns): void {
    if (proof && this.options.includeProofs) {
      if (proof.parameters) {
        this.addParameterListParts(proof.parameters, undefined, result);
      }
      const goal = proof.goal;
      if (goal) {
        result.set(goal, () => this.renderFormula(goal, fullFormulaSelection));
      }
      for (const step of proof.steps) {
        this.addProofStepParts(step, result);
      }
    }
  }

  private addProofStepParts(step: Fmt.Parameter, result: Logic.ObjectRenderFns): void {
    const type = step.type;
    if (type instanceof FmtHLM.MetaRefExpression_SetDef || type instanceof FmtHLM.MetaRefExpression_Def) {
      this.addParameterParts(step, result);
    } else {
      this.addProofStepTypeParts(type, result);
    }
  }

  private addProofStepTypeParts(type: Fmt.Expression, result: Logic.ObjectRenderFns): void {
    if (type instanceof FmtHLM.MetaRefExpression_Consider && type.result) {
      this.addFormulaParts(type.result, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_State) {
      this.addFormulaParts(type.statement, result);
      this.addProofParts(type.proof, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseDef
               || type instanceof FmtHLM.MetaRefExpression_Unfold) {
      if (type.result) {
        this.addFormulaParts(type.result, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_UseCases
               || type instanceof FmtHLM.MetaRefExpression_ProveCases) {
      this.addProofListParts(type.caseProofs, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseForAll) {
      this.addArgumentListParts(type.arguments, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseExists) {
      this.addParameterListParts(type.parameters, undefined, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveDef
               || type instanceof FmtHLM.MetaRefExpression_ProveByContradiction
               || type instanceof FmtHLM.MetaRefExpression_ProveForAll) {
      this.addProofParts(type.proof, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_UseTheorem) {
      this.addGenericExpressionParts(type.theorem, result);
      if (type.input) {
        this.addProofStepTypeParts(type.input, result);
      }
      if (type.result) {
        this.addFormulaParts(type.result, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveExists) {
      this.addArgumentListParts(type.arguments, result);
      this.addProofParts(type.proof, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveEquivalence) {
      this.addProofListParts(type.proofs, result);
    } else if (type instanceof FmtHLM.MetaRefExpression_Substitute) {
      this.addProofStepTypeParts(type.source, result);
      if (type.result) {
        this.addFormulaParts(type.result, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveByInduction) {
      this.addElementTermParts(type.term, result);
      this.addGenericExpressionParts(type.construction, result);
      for (const structuralCase of type.cases) {
        this.addGenericExpressionParts(structuralCase._constructor, result);
        const proof = FmtHLM.ObjectContents_Proof.createFromExpression(structuralCase.value);
        this.addProofParts(proof, result);
      }
    } else if (type instanceof FmtHLM.MetaRefExpression_ProveBySubstitution) {
      this.addProofStepTypeParts(type.source, result);
      this.addFormulaParts(type.goal, result);
      this.addProofParts(type.proof, result);
    }
  }

  private addRenderedVariables(parameters: Fmt.Parameter[], variables: RenderedVariable[], indices?: Notation.RenderedExpression[]): void {
    const remainingParameters = [...parameters];
    while (remainingParameters.length) {
      const param = remainingParameters.shift()!;
      const paramType = param.type;
      if (this.utils.isValueParamType(paramType)) {
        const renderedVariable = this.renderVariable(param, indices);
        variables.push({
          param: param,
          notation: renderedVariable,
          canAutoFill: this.utils.canAutoFillParameter(param, remainingParameters)
        });
      } else if (paramType instanceof FmtHLM.MetaRefExpression_Binder) {
        const newIndices: Notation.RenderedExpression[] = indices ? indices.slice() : [];
        for (const sourceParam of paramType.sourceParameters) {
          const renderedVariable = this.renderVariable(sourceParam);
          variables.push({
            param: sourceParam,
            notation: renderedVariable,
            canAutoFill: false
          });
          newIndices.push(renderedVariable);
        }
        this.addRenderedVariables(paramType.targetParameters, variables, newIndices);
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
