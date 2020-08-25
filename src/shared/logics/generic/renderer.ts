import * as Fmt from '../../format/format';
import * as Notation from '../../notation/notation';
import * as Logic from '../logic';
import { GenericUtils } from './utils';
import { GenericEditHandler, SetNotationFn } from './editHandler';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import { readCode } from '../../format/utils';

export interface RenderedVariable {
  param: Fmt.Parameter;
  notation: Notation.RenderedExpression;
  canAutoFill: boolean;
}

export class ArgumentWithInfo {
  private value?: Notation.ExpressionValue;

  constructor(private onGetValue: () => Notation.ExpressionValue, public index: number) {}

  getValue(): Notation.ExpressionValue {
    if (this.value === undefined) {
      this.value = this.onGetValue();
    }
    return this.value;
  }

  static getValue(arg: RenderedTemplateArgument | undefined): Notation.ExpressionValue {
    if (Array.isArray(arg)) {
      return arg.map((item: RenderedTemplateArgument) => ArgumentWithInfo.getValue(item));
    } else if (arg instanceof ArgumentWithInfo) {
      return arg.getValue();
    } else {
      return arg;
    }
  }

  static getArgIndex(args: RenderedTemplateArguments, value: Notation.ExpressionValue): number {
    for (let arg of Object.values(args)) {
      if (arg instanceof ArgumentWithInfo && arg.getValue() === value) {
        return arg.index;
      }
    }
    return -1;
  }
}

export type RenderedTemplateArgument = Notation.ExpressionValue | ArgumentWithInfo;

export interface RenderedTemplateArguments {
  [name: string]: RenderedTemplateArgument;
}

const allRemarkKinds = [undefined, 'example', 'remarks', 'references'];

export abstract class GenericRenderer {
  private variableNameEditHandler?: GenericEditHandler;

  constructor(protected definition: Fmt.Definition, protected libraryDataAccessor: LibraryDataAccessor, protected utils: GenericUtils, protected templates: Fmt.File, protected options: Logic.LogicRendererOptions, protected editHandler?: GenericEditHandler) {
    // Variable names can be edited even in some cases where the rest is read-only.
    // Derived classes can reset editHandler but not variableNameEditHandler.
    this.variableNameEditHandler = editHandler;
  }

  renderTemplate(templateName: string, args: RenderedTemplateArguments = {}, negationCount: number = 0): Notation.RenderedExpression {
    let template: Fmt.Definition;
    try {
      template = this.templates.definitions.getDefinition(templateName);
    } catch (error) {
      return new Notation.ErrorExpression(error.message);
    }
    let config = this.getRenderedTemplateConfig(args, 0, negationCount);
    return new Notation.TemplateInstanceExpression(template, config, this.templates);
  }

  renderNotationExpression(notation: Fmt.Expression, args: RenderedTemplateArguments = {}, omitArguments: number = 0, negationCount: number = 0, forceInnerNegations: number = 0): Notation.RenderedExpression {
    let config = this.getRenderedTemplateConfig(args, omitArguments, negationCount, forceInnerNegations);
    return this.renderUserDefinedExpression(notation, config);
  }

  renderUserDefinedExpression(notation: Fmt.Expression, config: Notation.RenderedTemplateConfig): Notation.RenderedExpression {
    return new Notation.UserDefinedExpression(notation, config, this.templates);
  }

  private getRenderedTemplateConfig(args: RenderedTemplateArguments, omitArguments: number, negationCount: number, forceInnerNegations: number = 0): Notation.RenderedTemplateConfig {
    let getArgFn = (name: string) => ArgumentWithInfo.getValue(args[name]);
    let isBeforeFn = undefined;
    if (Object.values(args).some((arg) => (arg instanceof ArgumentWithInfo))) {
      isBeforeFn = (value1: Notation.ExpressionValue, value2: Notation.ExpressionValue) => (ArgumentWithInfo.getArgIndex(args, value1) < ArgumentWithInfo.getArgIndex(args, value2));
    }
    return {
      getArgFn: getArgFn,
      isBeforeFn: isBeforeFn,
      omitArguments: omitArguments,
      negationCount: negationCount,
      forceInnerNegations: forceInnerNegations,
      negationFallbackFn: this.renderNegation.bind(this)
    };
  }

  protected renderGroup(items: Notation.RenderedExpression[], separator?: string): Notation.RenderedExpression {
    if (items.length === 1) {
      return items[0];
    } else {
      let args: RenderedTemplateArguments = {'items': items};
      if (separator !== undefined) {
        args['separator'] = separator;
      }
      return this.renderTemplate('Group', args);
    }
  }

  renderVariable(param: Fmt.Parameter, indices?: Notation.RenderedExpression[], isDefinition: boolean = false, isDummy: boolean = false, parameterList?: Fmt.ParameterList): Notation.RenderedExpression {
    let name = param.name;
    let suffixes: Notation.RenderedExpression[] | undefined = undefined;
    let underscorePos = name.indexOf('_');
    if (underscorePos > 0) {
      let rest = name.substring(underscorePos + 1);
      name = name.substring(0, underscorePos);
      suffixes = [];
      underscorePos = rest.indexOf('_');
      while (underscorePos > 0) {
        let suffix = new Notation.TextExpression(rest.substring(0, underscorePos));
        suffix.styleClasses = ['var'];
        suffixes.push(suffix);
        rest = rest.substring(underscorePos + 1);
        underscorePos = rest.indexOf('_');
      }
      let lastSuffix = new Notation.TextExpression(rest);
      lastSuffix.styleClasses = ['var'];
      suffixes.push(lastSuffix);
    }
    let text = new Notation.TextExpression(name);
    text.styleClasses = ['var'];
    if (isDefinition && this.variableNameEditHandler) {
      this.variableNameEditHandler.addVariableNameEditor(text, param, parameterList);
    }
    let result: Notation.RenderedExpression = text;
    if (suffixes) {
      let subExpression = new Notation.SubSupExpression(result);
      subExpression.sub = this.renderTemplate('Group', {'items': suffixes, 'separator': ','});
      subExpression.fallback = new Notation.RowExpression([result, new Notation.TextExpression('_'), subExpression.sub]);
      subExpression.styleClasses = ['var'];
      result = subExpression;
    }
    if (isDummy) {
      result.styleClasses!.push('dummy');
    }
    result.semanticLinks = [new Notation.SemanticLink(param, isDefinition)];
    if (indices) {
      result = this.renderTemplate('SubSup', {
                                     'body': result,
                                     'sub': this.renderTemplate('Group', {'items': indices})
                                   });
    }
    return result;
  }

  protected renderNegation(expression: Notation.RenderedExpression): Notation.RenderedExpression {
    expression.optionalParenStyle = '[]';
    return this.renderTemplate('Negation', {'operand': expression});
  }

  protected renderInteger(value: Fmt.BN): Notation.TextExpression {
    let result = new Notation.TextExpression(value.toString());
    result.styleClasses = ['integer'];
    return result;
  }

  protected addSemanticLink(expression: Notation.RenderedExpression, linkedObject: Object): Notation.SemanticLink {
    let semanticLink = new Notation.SemanticLink(linkedObject);
    if (expression.semanticLinks) {
      expression.semanticLinks.unshift(semanticLink);
    } else {
      expression.semanticLinks = [semanticLink];
    }
    return semanticLink;
  }

  protected setDefinitionSemanticLink(expression: Notation.RenderedExpression, linkedObject: Object, notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, onGetDefault: () => Notation.RenderedExpression, onGetVariables: () => RenderedVariable[], isPredicate: boolean): Notation.SemanticLink {
    let semanticLink = new Notation.SemanticLink(linkedObject, true);
    if (this.editHandler) {
      this.editHandler.addNotationMenu(semanticLink, notation, onSetNotation, onGetDefault, onGetVariables, isPredicate, this);
    }
    expression.semanticLinks = [semanticLink];
    return semanticLink;
  }

  protected renderSubHeading(heading: string): Notation.RenderedExpression {
    let subHeading = new Notation.TextExpression(`${heading}.`);
    subHeading.styleClasses = ['sub-heading'];
    return subHeading;
  }

  protected addDefinitionText(paragraphs: Notation.RenderedExpression[]): void {
    this.addDefinitionRemarksOfKind(paragraphs, undefined);
  }

  protected addDefinitionRemarks(paragraphs: Notation.RenderedExpression[]): void {
    for (let kind of allRemarkKinds) {
      if (kind) {
        this.addDefinitionRemarksOfKind(paragraphs, kind);
      }
    }
  }

  private addDefinitionRemarksOfKind(paragraphs: Notation.RenderedExpression[], kind: string | undefined): void {
    let definition = this.definition;
    let texts: string[] = [];
    if (definition.documentation) {
      for (let item of definition.documentation.items) {
        if (item.kind === kind) {
          texts.push(item.text);
        }
      }
    }
    let canEdit = this.editHandler && kind !== 'example';
    if (texts.length || canEdit) {
      let text = texts.join(kind === 'example' ? ', ' : '\n\n');
      let markdown = new Notation.MarkdownExpression(text);
      markdown.onRenderCode = (code: string) => {
        try {
          let metaModel = this.libraryDataAccessor.logic.getMetaModel();
          let expression = readCode(code, metaModel);
          return this.renderExpression(expression);
        } catch (error) {
          return new Notation.ErrorExpression(error.message);
        }
      };
      if (canEdit) {
        this.editHandler!.addDefinitionRemarkEditor(markdown, definition, allRemarkKinds, kind);
      }
      if (kind) {
        let headingText = kind.charAt(0).toUpperCase() + kind.slice(1);
        if (headingText === 'Example' && texts.length > 1) {
          headingText = 'Examples';
        }
        let heading = this.renderSubHeading(headingText);
        if (canEdit) {
          let initiallyUnfolded = text.length > 0 && !this.utils.containsPlaceholders();
          paragraphs.push(new Notation.FoldableExpression(heading, markdown, initiallyUnfolded));
        } else {
          paragraphs.push(heading, markdown);
        }
      } else {
        paragraphs.push(markdown);
      }
    }
  }

  abstract renderExpression(expression: Fmt.Expression): Notation.RenderedExpression;
}
