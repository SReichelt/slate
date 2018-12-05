import * as Fmt from '../format/format';
import * as Display from '../display/display';
import * as Menu from '../display/menu';
import { LibraryDataAccessor } from '../data/libraryDataAccessor';

export abstract class GenericRenderer {
  constructor(protected libraryDataAccessor: LibraryDataAccessor, protected templates: Fmt.File, protected editing: boolean) {}

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

  renderVariable(param: Fmt.Parameter, indices?: Display.RenderedExpression[], isDefinition: boolean = false): Display.RenderedExpression {
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
    let result: Display.RenderedExpression = new Display.TextExpression(name);
    if (suffixes) {
      let subExpression = new Display.SubSupExpression(result);
      subExpression.sub = this.renderTemplate('Group', {'items': suffixes});
      if (suffixes.length > 1) {
        subExpression.sub = new Display.OuterParenExpression(subExpression.sub);
      }
      result = subExpression;
    }
    result.styleClasses = ['var'];
    result.semanticLinks = [new Display.SemanticLink(param, isDefinition)];
    if (indices) {
      let subExpression = new Display.SubSupExpression(result);
      subExpression.sub = this.renderTemplate('Group', {'items': indices});
      if (indices.length > 1) {
        subExpression.sub = new Display.OuterParenExpression(subExpression.sub);
      }
      result = subExpression;
    }
    return result;
  }

  protected renderNegation(expression: Display.RenderedExpression): Display.RenderedExpression {
    return this.renderTemplate('Negation', {'operand': expression});
  }

  protected setSemanticLink(expression: Display.RenderedExpression, linkedObject: Object): Display.RenderedExpression {
    let semanticLink = new Display.SemanticLink(linkedObject);
    if (expression.semanticLinks) {
      expression.semanticLinks.unshift(semanticLink);
    } else {
      expression.semanticLinks = [semanticLink];
    }
    return expression;
  }

  protected setDefinitionSemanticLink(expression: Display.RenderedExpression, linkedObject: Object, onSetDisplay: (display: Fmt.ArrayExpression | undefined) => void): Display.RenderedExpression {
    expression.semanticLinks = [new Display.SemanticLink(linkedObject, true)];
    if (this.editing) {
      expression.onMenuOpened = () => {
        let menu = new Menu.ExpressionMenu;
        let defaultItem = new Menu.ExpressionMenuItem;
        defaultItem.expression = new Display.TextExpression('Default');
        defaultItem.onClick = () => onSetDisplay(undefined);
        menu.rows = [
          defaultItem,
          new Menu.ExpressionMenuSeparator
        ];
        // TODO
        if (true) {
          let textItem = new Menu.ExpressionMenuItem;
          textItem.expression = new Display.TextExpression('Symbol/Text');
          textItem.onClick = () => {};
          menu.rows.push(
            textItem,
            new Menu.ExpressionMenuSeparator
          );
        }
        for (let template of this.templates.definitions) {
          let item = new Menu.ExpressionMenuItem;
          item.expression = new Display.TextExpression(template.name);
          item.onClick = () => alert(template.name);
          menu.rows.push(item);
        }
        return menu;
      };
    }
    return expression;
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

  formatItemNumber(itemNumber: number[]): string {
    return itemNumber.join('.');
  }

  protected addDefinitionRemarks(definition: Fmt.Definition, paragraphs: Display.RenderedExpression[]): void {
    let allKinds = ['remarks', 'references'];
    for (let kind of allKinds) {
      this.addDefinitionRemarksOfKind(definition, paragraphs, allKinds, kind);
    }
  }

  private addDefinitionRemarksOfKind(definition: Fmt.Definition, paragraphs: Display.RenderedExpression[], allKinds: string[], kind: string): void {
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
    if (text || this.editing) {
      let heading = new Display.TextExpression(kind.charAt(0).toUpperCase() + kind.slice(1) + '.');
      heading.styleClasses = ['sub-heading'];
      paragraphs.push(heading);
      let markdown = new Display.MarkdownExpression(text);
      if (this.editing) {
        markdown.onTextChanged = (newText: string) => {
          let newItems: Fmt.DocumentationItem[] = [];
          for (let otherKind of allKinds) {
            if (otherKind === kind) {
              if (newText) {
                let item = new Fmt.DocumentationItem;
                item.kind = kind;
                item.text = newText;
                newItems.push(item);
              }
            } else {
              if (definition.documentation) {
                for (let item of definition.documentation.items) {
                  if (item.kind === otherKind) {
                    newItems.push(item);
                  }
                }
              }
            }
          }
          if (newItems.length) {
            if (!definition.documentation) {
              definition.documentation = new Fmt.DocumentationComment;
            }
            definition.documentation.items = newItems;
          } else {
            definition.documentation = undefined;
          }
        };
      }
      paragraphs.push(markdown);
    }
  }
}
