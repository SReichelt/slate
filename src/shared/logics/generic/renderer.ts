import * as Fmt from '../../format/format';
import * as Display from '../../display/display';
import { GenericEditHandler } from './editHandler';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';

export interface RenderedVariable {
  param: Fmt.Parameter;
  display: Display.RenderedExpression;
  required: boolean;
}

export abstract class GenericRenderer {
  private variableNameEditHandler?: GenericEditHandler;

  constructor(protected definition: Fmt.Definition, protected includeProofs: boolean, protected libraryDataAccessor: LibraryDataAccessor, protected templates: Fmt.File, protected editHandler?: GenericEditHandler) {
    // Variable names can be edited even in some cases where the rest is read-only.
    // Derived classes can reset editHandler but not variableNameEditHandler.
    this.variableNameEditHandler = editHandler;
  }

  renderTemplate(templateName: string, args: Display.RenderedTemplateArguments = {}, negationCount: number = 0): Display.RenderedExpression {
    let template: Fmt.Definition;
    try {
      template = this.templates.definitions.getDefinition(templateName);
    } catch (error) {
      return new Display.ErrorExpression(error.message);
    }
    let config = this.getRenderedTemplateConfig(args, negationCount);
    return new Display.TemplateInstanceExpression(template, config, this.templates);
  }

  renderDisplayExpression(display: Fmt.Expression, args: Display.RenderedTemplateArguments = {}, negationCount: number = 0, forceInnerNegations: number = 0): Display.RenderedExpression {
    let config = this.getRenderedTemplateConfig(args, negationCount, forceInnerNegations);
    return new Display.UserDefinedExpression(display, config, this.templates);
  }

  private getRenderedTemplateConfig(args: Display.RenderedTemplateArguments, negationCount: number, forceInnerNegations: number = 0): Display.RenderedTemplateConfig {
    let config = new Display.RenderedTemplateConfig;
    config.args = args;
    config.negationCount = negationCount;
    config.forceInnerNegations = forceInnerNegations;
    config.negationFallbackFn = this.renderNegation.bind(this);
    return config;
  }

  renderVariable(param: Fmt.Parameter, indices?: Display.RenderedExpression[], isDefinition: boolean = false, isDummy: boolean = false, parameterList?: Fmt.Parameter[]): Display.RenderedExpression {
    let name = param.name;
    let suffixes: Display.RenderedExpression[] | undefined = undefined;
    let underscorePos = name.indexOf('_');
    if (underscorePos > 0) {
      let rest = name.substring(underscorePos + 1);
      name = name.substring(0, underscorePos);
      suffixes = [];
      underscorePos = rest.indexOf('_');
      while (underscorePos > 0) {
        suffixes.push(new Display.TextExpression(rest.substring(0, underscorePos)));
        rest = rest.substring(underscorePos + 1);
        underscorePos = rest.indexOf('_');
      }
      suffixes.push(new Display.TextExpression(rest));
    }
    let text = new Display.TextExpression(name);
    if (isDefinition && this.variableNameEditHandler) {
      this.variableNameEditHandler.addVariableNameEditor(text, param, parameterList);
    }
    let result: Display.RenderedExpression = text;
    if (suffixes) {
      let subExpression = new Display.SubSupExpression(result);
      subExpression.sub = this.renderTemplate('Group', {'items': suffixes});
      result = subExpression;
    }
    result.styleClasses = ['var'];
    if (isDummy) {
      result.styleClasses.push('dummy');
    }
    result.semanticLinks = [new Display.SemanticLink(param, isDefinition)];
    if (indices) {
      let subExpression = new Display.SubSupExpression(result);
      subExpression.sub = this.renderTemplate('Group', {'items': indices});
      result = subExpression;
    }
    return result;
  }

  protected renderNegation(expression: Display.RenderedExpression): Display.RenderedExpression {
    return this.renderTemplate('Negation', {'operand': expression});
  }

  protected addSemanticLink(expression: Display.RenderedExpression, linkedObject: Object): Display.SemanticLink {
    let semanticLink = new Display.SemanticLink(linkedObject);
    if (expression.semanticLinks) {
      expression.semanticLinks.unshift(semanticLink);
    } else {
      expression.semanticLinks = [semanticLink];
    }
    return semanticLink;
  }

  protected setDefinitionSemanticLink(expression: Display.RenderedExpression, linkedObject: Object, display: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, onGetDefault: () => Display.RenderedExpression, onGetVariables: () => RenderedVariable[], isPredicate: boolean): Display.SemanticLink {
    let semanticLink = new Display.SemanticLink(linkedObject, true);
    if (this.editHandler) {
      this.editHandler.addDisplayMenu(semanticLink, display, onSetDisplay, onGetDefault, onGetVariables, isPredicate, this);
    }
    expression.semanticLinks = [semanticLink];
    return semanticLink;
  }

  protected findBestMatch(items: Fmt.Expression[], argumentLists?: (Fmt.ArgumentList | undefined)[]): Fmt.Expression | undefined {
    if (items.length === 1) {
      return items[0];
    }
    let result: Fmt.Expression | undefined = undefined;
    let resultPenalty = 0;
    for (let item of items) {
      let penalty = this.getMatchPenalty(item, argumentLists);
      if (!result || penalty < resultPenalty) {
        result = item;
        resultPenalty = penalty;
      }
      if (!penalty) {
        break;
      }
    }
    return result;
  }

  private getMatchPenalty(expression: Fmt.Expression, argumentLists?: (Fmt.ArgumentList | undefined)[]): number {
    let penalty = 0;
    if (argumentLists) {
      let refs: Fmt.Parameter[] = [];
      this.collectVariableRefs(expression, refs);
      if (refs.length) {
        let refIndex = 0;
        for (let argumentList of argumentLists) {
          if (argumentList) {
            for (let arg of argumentList) {
              let origRefIndex = refIndex;
              let argFound = false;
              while (refIndex < refs.length) {
                if (refs[refIndex++].name === arg.name) {
                  argFound = true;
                  break;
                }
              }
              if (!argFound) {
                refIndex = 0;
                while (refIndex < origRefIndex) {
                  if (refs[refIndex++].name === arg.name) {
                    argFound = true;
                    penalty += origRefIndex - refIndex;
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
    return penalty;
  }

  private collectVariableRefs(expression: Fmt.Expression, refs: Fmt.Parameter[]): void {
    if (expression instanceof Fmt.VariableRefExpression) {
      refs.push(expression.variable);
      if (expression.indices) {
        for (let item of expression.indices) {
          this.collectVariableRefs(item, refs);
        }
      }
    } else if (expression instanceof Fmt.ArrayExpression) {
      for (let item of expression.items) {
        this.collectVariableRefs(item, refs);
      }
    } else if (expression instanceof Fmt.CompoundExpression) {
      for (let arg of expression.arguments) {
        this.collectVariableRefs(arg.value, refs);
      }
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      for (let pathItem: Fmt.PathItem | undefined = expression.path; pathItem; pathItem = pathItem.parentPath) {
        if (pathItem instanceof Fmt.Path) {
          for (let arg of pathItem.arguments) {
            this.collectVariableRefs(arg.value, refs);
          }
        }
      }
    }
  }

  protected renderSubHeading(heading: string): Display.RenderedExpression {
    let subHeading = new Display.TextExpression(`${heading}.`);
    subHeading.styleClasses = ['sub-heading'];
    return subHeading;
  }

  protected addDefinitionRemarks(paragraphs: Display.RenderedExpression[]): void {
    let allKinds = ['remarks', 'references'];
    for (let kind of allKinds) {
      this.addDefinitionRemarksOfKind(paragraphs, allKinds, kind);
    }
  }

  private addDefinitionRemarksOfKind(paragraphs: Display.RenderedExpression[], allKinds: string[], kind: string): void {
    let definition = this.definition;
    let text = '';
    if (definition.documentation) {
      for (let item of definition.documentation.items) {
        if (item.kind === kind) {
          if (text) {
            text += '\n\n';
          }
          text += item.text;
        }
      }
    }
    if (text || this.editHandler) {
      paragraphs.push(this.renderSubHeading(kind.charAt(0).toUpperCase() + kind.slice(1)));
      let markdown = new Display.MarkdownExpression(text);
      if (this.editHandler) {
        this.editHandler.addDefinitionRemarkEditor(markdown, definition, allKinds, kind);
      }
      paragraphs.push(markdown);
    }
  }
}
