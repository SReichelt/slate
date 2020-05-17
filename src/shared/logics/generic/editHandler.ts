import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as Edit from '../../format/edit';
import * as Logic from '../logic';
import * as FmtNotation from '../../notation/meta';
import * as Notation from '../../notation/notation';
import * as Menu from '../../notation/menu';
import * as Dialog from '../../notation/dialog';
import { readCode } from '../../format/utils';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, defaultReferences } from '../../data/libraryDataProvider';
import { MRUList } from '../../data/mostRecentlyUsedList';
import { GenericUtils } from './utils';
import { GenericRenderer, RenderedVariable, RenderedTemplateArguments } from './renderer';
import CachedPromise from '../../data/cachedPromise';

export type RenderTypeFn = (type: string | undefined) => Notation.RenderedExpression;

export type SetNotationFn = (notation: Fmt.Expression[] | undefined) => void;
export type SetNotationItemFn = (notationItem: Fmt.Expression | undefined) => void;

export type RenderParameterFn = (parameter: Fmt.Parameter) => Notation.RenderedExpression;
export type InsertParameterFn = (parameter: Fmt.Parameter) => void;

export type RenderExpressionFn = (expression: Fmt.Expression) => Notation.RenderedExpression;
export type InsertExpressionFn = (expression: Fmt.Expression) => void;
export type SetExpressionFn = (expression: Fmt.Expression | undefined) => void;

export type GetExpressionsFn = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, fromMRUList: boolean) => CachedPromise<Fmt.Expression[]> | undefined;

export abstract class GenericEditHandler {
  static lastInsertedParameter?: Fmt.Parameter;

  constructor(protected definition: Fmt.Definition, protected libraryDataProvider: LibraryDataProvider, protected editAnalysis: Edit.EditAnalysis, protected utils: GenericUtils, protected templates: Fmt.File, protected mruList: MRUList) {}

  update(): CachedPromise<void> {
    this.editAnalysis.analyzeDefinition(this.definition, this.libraryDataProvider.logic.getRootContext());
    return CachedPromise.resolve();
  }

  protected getTypeRow(type: string | undefined, onRenderType: RenderTypeFn, info: LibraryItemInfo): Menu.ExpressionMenuRow {
    let item = new Menu.ExpressionMenuItem(onRenderType(type));
    item.action = new Menu.ImmediateExpressionMenuAction(() => {
      let newInfo = {
        ...info,
        type: type
      };
      return this.libraryDataProvider.setLocalItemInfo(this.definition.name, newInfo);
    });
    item.selected = info.type === type;
    return item;
  }

  addTitleMenu(semanticLink: Notation.SemanticLink, info: LibraryItemInfo): void {
    semanticLink.onMenuOpened = () => {
      return new Menu.ExpressionMenu(CachedPromise.resolve([this.getTitleRow(info)]));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private getTitleRow(info: LibraryItemInfo): Menu.ExpressionMenuRow {
    let titleItem = new Menu.ExpressionMenuTextInput;
    titleItem.text = info.title || '';
    titleItem.expectedTextLength = 20;
    titleItem.action = new Menu.ImmediateExpressionMenuAction(() => {
      let newInfo = {
        ...info,
        title: titleItem.text || undefined
      };
      return this.libraryDataProvider.setLocalItemInfo(this.definition.name, newInfo);
    });
    let titleRow = new Menu.StandardExpressionMenuRow('Title');
    titleRow.subMenu = titleItem;
    titleRow.selected = info.title !== undefined;
    return titleRow;
  }

  protected getActionInsertButton(action: Menu.ExpressionMenuAction): Notation.RenderedExpression {
    let insertButton = new Notation.InsertPlaceholderExpression;
    insertButton.action = action;
    return insertButton;
  }

  getImmediateInsertButton(onInsert: () => void): Notation.RenderedExpression {
    let action = new Menu.ImmediateExpressionMenuAction(onInsert);
    return this.getActionInsertButton(action);
  }

  addNotationMenu(semanticLink: Notation.SemanticLink, notation: Fmt.Expression[] | undefined, onSetNotation: SetNotationFn, onGetDefault: () => Notation.RenderedExpression | undefined, onGetVariables: () => RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): void {
    let notationItem = notation && notation.length === 1 ? notation[0] : undefined;
    let onSetNotationItem = (newNotationItem: Fmt.Expression | undefined) => {
      if (newNotationItem) {
        onSetNotation([newNotationItem]);
      } else {
        onSetNotation(undefined);
      }
    };
    let type = new FmtNotation.MetaRefExpression_Expr;
    semanticLink.onMenuOpened = () => {
      let defaultValue = onGetDefault();
      let variables = onGetVariables();
      let rows: Menu.ExpressionMenuRow[] = [];
      this.addNotationMenuRows(rows, notationItem, onSetNotationItem, defaultValue, variables, type, !notation, true, false, isPredicate, renderer);
      if (variables.length > 1) {
        rows.push(
          new Menu.ExpressionMenuSeparator,
          this.getNotationMenuAlternativesRow(notation, onSetNotation, variables, true, isPredicate, renderer)
        );
      }
      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private addNotationItemMenu(semanticLink: Notation.SemanticLink, notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, defaultValue: Notation.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    semanticLink.onMenuOpened = () => {
      let isDefault = !notationItem && !canRemove;
      let rows: Menu.ExpressionMenuRow[] = [];
      this.addNotationMenuRows(rows, notationItem, onSetNotationItem, defaultValue, variables, type, isDefault, isTopLevel, canRemove, isPredicate, renderer);
      if (rows.length === 1) {
        let row = rows[0];
        if (row instanceof Menu.StandardExpressionMenuRow && row.subMenu instanceof Menu.ExpressionMenu) {
          return row.subMenu;
        }
      }
      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private addNotationMenuRows(rows: Menu.ExpressionMenuRow[], notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, defaultValue: Notation.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isDefault: boolean, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    if (defaultValue || canRemove) {
      rows.push(
        this.getNotationMenuDefaultRow(defaultValue, onSetNotationItem, isDefault, canRemove),
        new Menu.ExpressionMenuSeparator
      );
    }
    let complexExpressionRequired = isTopLevel && variables.length !== 0;
    if (type instanceof FmtNotation.MetaRefExpression_Expr) {
      if (!complexExpressionRequired) {
        rows.push(this.getNotationMenuTextRow(notationItem, onSetNotationItem));
        if (variables.length && !isTopLevel) {
          rows.push(this.getNotationMenuVariablesRow(notationItem, onSetNotationItem, variables));
        }
      }
      rows.push(this.getNotationMenuTemplatesRow(notationItem, onSetNotationItem, variables, isTopLevel, isPredicate, complexExpressionRequired, renderer));
    } else if (type instanceof FmtNotation.MetaRefExpression_Bool) {
      rows.push(this.getNotationMenuFalseRow(notationItem, onSetNotationItem));
      rows.push(this.getNotationMenuTrueRow(notationItem, onSetNotationItem));
    } else if (type instanceof FmtNotation.MetaRefExpression_Int) {
      rows.push(this.getNotationMenuIntegerRow(notationItem, onSetNotationItem));
    } else if (type instanceof FmtNotation.MetaRefExpression_String) {
      rows.push(this.getNotationMenuTextRow(notationItem, onSetNotationItem, 'String'));
    }
    if (isPredicate && !isTopLevel) {
      rows.push(this.getNotationMenuNegationRow(notationItem, onSetNotationItem, variables, type, isTopLevel, isPredicate, renderer));
    }
  }

  private getNotationMenuDefaultRow(renderedDefault: Notation.RenderedExpression | undefined, onSetNotationItem: SetNotationItemFn, isDefault: boolean, isRemoveRow: boolean): Menu.ExpressionMenuRow {
    let defaultAction = new Menu.ImmediateExpressionMenuAction(() => onSetNotationItem(undefined));
    let defaultRow = new Menu.StandardExpressionMenuRow(isRemoveRow ? 'Remove' : 'Default');
    if (isRemoveRow) {
      defaultRow.iconType = 'remove';
    }
    if (renderedDefault) {
      let defaultItem = new Menu.ExpressionMenuItem(renderedDefault);
      defaultItem.action = defaultAction;
      defaultItem.selected = isDefault;
      defaultRow.subMenu = defaultItem;
    } else {
      defaultRow.titleAction = defaultAction;
    }
    return defaultRow;
  }

  private getNotationMenuFalseRow(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn): Menu.ExpressionMenuRow {
    let falseRow = new Menu.StandardExpressionMenuRow('False');
    falseRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => onSetNotationItem(new FmtNotation.MetaRefExpression_false));
    falseRow.selected = notationItem instanceof FmtNotation.MetaRefExpression_false;
    return falseRow;
  }

  private getNotationMenuTrueRow(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn): Menu.ExpressionMenuRow {
    let trueRow = new Menu.StandardExpressionMenuRow('True');
    trueRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => onSetNotationItem(new FmtNotation.MetaRefExpression_true));
    trueRow.selected = notationItem instanceof FmtNotation.MetaRefExpression_true;
    return trueRow;
  }

  private getNotationMenuIntegerRow(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn): Menu.ExpressionMenuRow {
    let integerItem = new Menu.ExpressionMenuTextInput;
    if (notationItem instanceof Fmt.IntegerExpression) {
      integerItem.selected = true;
      integerItem.text = notationItem.value.toString();
    } else {
      integerItem.text = '';
    }
    integerItem.expectedTextLength = 4;
    integerItem.action = new Menu.ImmediateExpressionMenuAction(() => {
      let newNotationItem = new Fmt.IntegerExpression;
      newNotationItem.value = new Fmt.BN(integerItem.text, 10);
      onSetNotationItem(newNotationItem);
    });
    let integerRow = new Menu.StandardExpressionMenuRow('Number');
    integerRow.subMenu = integerItem;
    return integerRow;
  }

  private getNotationMenuTextRow(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, title: string = 'Symbol/Text'): Menu.ExpressionMenuRow {
    let textItem = new Menu.ExpressionMenuTextInput;
    if (notationItem instanceof Fmt.StringExpression) {
      textItem.selected = true;
      textItem.text = notationItem.value;
    } else {
      textItem.text = '';
    }
    textItem.expectedTextLength = 4;
    textItem.action = new Menu.ImmediateExpressionMenuAction(() => {
      let newNotationItem = new Fmt.StringExpression;
      newNotationItem.value = textItem.text;
      onSetNotationItem(newNotationItem);
    });
    let textRow = new Menu.StandardExpressionMenuRow(title);
    textRow.subMenu = textItem;
    return textRow;
  }

  private getNotationMenuVariablesRow(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, variables: RenderedVariable[]): Menu.ExpressionMenuRow {
    let items: Menu.ExpressionMenuItem[] = [];
    for (let variable of variables) {
      let variableItem = new Menu.ExpressionMenuItem(variable.notation);
      if (notationItem instanceof Fmt.VariableRefExpression && notationItem.variable === variable.param) {
        variableItem.selected = true;
      }
      variableItem.action = new Menu.ImmediateExpressionMenuAction(() => {
        let newNotationItem = new Fmt.VariableRefExpression;
        newNotationItem.variable = variable.param;
        onSetNotationItem(newNotationItem);
      });
      items.push(variableItem);
    }
    let variablesGroup = new Menu.ExpressionMenuItemList(CachedPromise.resolve(items));
    let variablesRow = new Menu.StandardExpressionMenuRow('Variable');
    variablesRow.subMenu = variablesGroup;
    return variablesRow;
  }

  private getNotationMenuTemplatesRow(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, complexExpressionRequired: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let rows: Menu.ExpressionMenuRow[] = [];
    for (let template of this.templates.definitions) {
      if (!complexExpressionRequired || template.parameters.length) {
        let templateRow = this.getNotationMenuTemplateRow(template, notationItem, onSetNotationItem, variables, isTopLevel, isPredicate, renderer);
        rows.push(templateRow);
      }
    }
    let templateMenu = new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    templateMenu.variable = true;
    let templatesRow = new Menu.StandardExpressionMenuRow('Template');
    templatesRow.subMenu = templateMenu;
    return templatesRow;
  }

  private getNotationMenuTemplateRow(template: Fmt.Definition, notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let title = new Notation.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    let templateRow = new Menu.StandardExpressionMenuRow(title);
    templateRow.info = this.getDocumentation(template);
    templateRow.examples = this.getExamples(template, renderer);
    if (template.parameters.length) {
      templateRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getTemplateDialog(template, notationItem, onSetNotationItem, variables, isTopLevel, isPredicate, renderer));
    } else {
      templateRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => {
        let newPath = new Fmt.Path;
        newPath.name = template.name;
        let newNotationItem = new Fmt.DefinitionRefExpression;
        newNotationItem.path = newPath;
        onSetNotationItem(newNotationItem);
      });
    }
    templateRow.selected = notationItem instanceof Fmt.DefinitionRefExpression && notationItem.path.name === template.name;
    return templateRow;
  }

  private getTemplateDialog(template: Fmt.Definition, notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let title: Notation.RenderedExpression = new Notation.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    if (template.documentation) {
      let paragraphs: Notation.RenderedExpression[] = [title];
      this.addDocumentation(template.documentation, undefined, paragraphs);
      title = new Notation.ParagraphExpression(paragraphs);
    }
    let titleItem = new Dialog.ExpressionDialogInfoItem;
    titleItem.info = title;
    let dialog = new Dialog.ExpressionDialog;
    dialog.styleClasses = ['wide'];
    dialog.items = [
      titleItem,
      new Dialog.ExpressionDialogSeparatorItem
    ];
    let newNotationItem: Fmt.DefinitionRefExpression;
    if (notationItem instanceof Fmt.DefinitionRefExpression && !notationItem.path.parentPath && notationItem.path.name === template.name) {
      newNotationItem = notationItem.clone() as Fmt.DefinitionRefExpression;
    } else {
      let newPath = new Fmt.Path;
      newPath.name = template.name;
      for (let param of template.parameters) {
        if (param.type.arrayDimensions) {
          let emptyArray = new Fmt.ArrayExpression;
          emptyArray.items = [];
          newPath.arguments.add(emptyArray, param.name);
        }
      }
      newNotationItem = new Fmt.DefinitionRefExpression;
      newNotationItem.path = newPath;
    }
    let previewItem = this.createTemplateDialogPreviewItem(newNotationItem, isTopLevel && isPredicate, renderedTemplateArguments, renderer);
    let messageItem: Dialog.ExpressionDialogInfoItem | undefined = undefined;
    if (isTopLevel) {
      messageItem = new Dialog.ExpressionDialogInfoItem;
      messageItem.visible = false;
      messageItem.info = new Notation.EmptyExpression;
    }
    let requiredArgumentsFilled = this.checkRequiredArguments(template, newNotationItem);
    previewItem.visible = requiredArgumentsFilled;
    let okEnabled = requiredArgumentsFilled;
    if (messageItem && !this.checkReferencedParameters(newNotationItem, variables, messageItem)) {
      okEnabled = false;
    }
    let paramIndex = 0;
    let previousParamNames: string[] = [];
    for (let param of template.parameters) {
      let paramItem = new Dialog.ExpressionDialogParameterItem;
      paramItem.title = new Notation.TextExpression(param.name);
      paramItem.title.styleClasses = ['source-code'];
      let localPreviousParamNames = previousParamNames.slice();
      paramItem.onGetValue = () => {
        let value = newNotationItem.path.arguments.getOptionalValue(param.name, paramIndex);
        let onSetParamNotation = (newValue: Fmt.Expression | undefined) => {
          newNotationItem.path.arguments.setValue(newValue, param.name, paramIndex, localPreviousParamNames);
          requiredArgumentsFilled = this.checkRequiredArguments(template, newNotationItem);
          previewItem.visible = requiredArgumentsFilled;
          previewItem.changed();
          okEnabled = requiredArgumentsFilled;
          if (messageItem && !this.checkReferencedParameters(newNotationItem, variables, messageItem)) {
            okEnabled = false;
          }
        };
        let canRemove = param.optional && value !== undefined;
        return this.renderArgumentValue(value, param.type.expression, param.type.arrayDimensions, param.defaultValue, onSetParamNotation, variables, renderedTemplateArguments, false, canRemove, isPredicate, renderer);
      };
      paramItem.info = this.getDocumentation(template, param);
      dialog.items.push(paramItem);
      previousParamNames.push(param.name);
      paramIndex++;
    }
    dialog.items.push(
      new Dialog.ExpressionDialogSeparatorItem,
      previewItem
    );
    if (messageItem) {
      dialog.items.push(messageItem);
    }
    dialog.onCheckOKEnabled = () => okEnabled;
    dialog.onOK = () => onSetNotationItem(newNotationItem);
    return dialog;
  }

  private getDocumentation(definition: Fmt.Definition, param?: Fmt.Parameter): Notation.RenderedExpression | undefined {
    if (definition.documentation) {
      let paragraphs: Notation.RenderedExpression[] = [];
      this.addDocumentation(definition.documentation, param, paragraphs);
      if (paragraphs.length) {
        return new Notation.ParagraphExpression(paragraphs);
      }
    }
    return undefined;
  }

  private addDocumentation(documentation: Fmt.DocumentationComment, param: Fmt.Parameter | undefined, paragraphs: Notation.RenderedExpression[]): void {
    for (let documentationItem of documentation.items) {
      if (param) {
        if (documentationItem.parameter !== param) {
          continue;
        }
      } else {
        if (documentationItem.kind) {
          break;
        }
      }
      let paragraph = new Notation.MarkdownExpression(documentationItem.text);
      paragraph.styleClasses = ['info-text'];
      paragraphs.push(paragraph);
    }
  }

  private getExamples(definition: Fmt.Definition, renderer: GenericRenderer): Notation.RenderedExpression[] | undefined {
    if (definition.documentation) {
      let result: Notation.RenderedExpression[] = [];
      for (let documentationItem of definition.documentation.items) {
        if (documentationItem.kind === 'example') {
          let example = new Notation.MarkdownExpression(documentationItem.text);
          example.onRenderCode = (code: string) => {
            try {
              let expression = readCode(code, FmtNotation.metaModel);
              let config: Notation.RenderedTemplateConfig = {
                getArgFn: (name: string) => {
                  let variable = new Notation.TextExpression(name);
                  variable.styleClasses = ['var', 'dummy'];
                  return variable;
                },
                negationCount: 0,
                forceInnerNegations: 0
              };
              return renderer.renderUserDefinedExpression(expression, config);
            } catch (error) {
              return new Notation.ErrorExpression(error.message);
            }
          };
          result.push(example);
        }
      }
      if (result.length) {
        return result;
      }
    }
    return undefined;
  }

  private renderArgumentValue(value: Fmt.Expression | undefined, type: Fmt.Expression, arrayDimensions: number, defaultValue: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, variables: RenderedVariable[], renderedTemplateArguments: RenderedTemplateArguments, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): Notation.RenderedExpression {
    if (arrayDimensions) {
      if (value instanceof Fmt.ArrayExpression) {
        let items: Notation.RenderedExpression[] = [];
        for (let index = 0; index < value.items.length; index++) {
          let item = value.items[index];
          let onSetItem = (newValue: Fmt.Expression | undefined) => {
            if (newValue) {
              value.items[index] = newValue;
            } else {
              value.items.splice(index, 1);
            }
          };
          items.push(this.renderArgumentValue(item, type, arrayDimensions - 1, undefined, onSetItem, variables, renderedTemplateArguments, isTopLevel, true, isPredicate, renderer));
        }
        let group = items.length ? renderer.renderTemplate('Group', {'items': items}) : undefined;
        if (arrayDimensions === 1) {
          let insertButton = new Notation.InsertPlaceholderExpression;
          let semanticLink = new Notation.SemanticLink(insertButton, false, false);
          let onInsertItem = (newValue: Fmt.Expression | undefined) => {
            if (newValue) {
              value.items.push(newValue);
            }
          };
          this.addNotationItemMenu(semanticLink, undefined, onInsertItem, undefined, variables, type, isTopLevel, false, isPredicate, renderer);
          insertButton.semanticLinks = [semanticLink];
          if (group) {
            return new Notation.RowExpression([
              group,
              new Notation.TextExpression(' '),
              insertButton
            ]);
          } else {
            return insertButton;
          }
        } else {
          // TODO (low priority) add proper support for multi-dimensional arrays
          if (group) {
            return group;
          } else {
            return new Notation.EmptyExpression;
          }
        }
      } else {
        return new Notation.EmptyExpression;
      }
    } else {
      let valueOrDefault = value || defaultValue;
      let renderedValue = valueOrDefault ? renderer.renderNotationExpression(valueOrDefault, renderedTemplateArguments) : new Notation.EmptyExpression;
      let semanticLink = new Notation.SemanticLink(renderedValue, false, false);
      let onGetDefault = () => defaultValue ? renderer.renderNotationExpression(defaultValue, renderedTemplateArguments) : undefined;
      this.addNotationItemMenu(semanticLink, value, onSetNotationItem, onGetDefault(), variables, type, isTopLevel, canRemove, isPredicate, renderer);
      renderedValue.semanticLinks = [semanticLink];
      return renderedValue;
    }
  }

  private createTemplateDialogPreviewItem(notationItem: Fmt.Expression, includeNegation: boolean, renderedTemplateArguments: RenderedTemplateArguments, renderer: GenericRenderer): Dialog.ExpressionDialogListItem<number | undefined> {
    // TODO add preview in different contexts, to validate parentheses
    let listItem = new Dialog.ExpressionDialogListItem<number | undefined>();
    listItem.items = includeNegation ? [0, 1] : [undefined];
    listItem.onRenderItem = (negationCount: number | undefined) => renderer.renderNotationExpression(notationItem, renderedTemplateArguments, negationCount);
    return listItem;
  }

  private checkReferencedParameters(notationItem: Fmt.Expression, variables: RenderedVariable[], messageItem: Dialog.ExpressionDialogInfoItem): boolean {
    let referencedParams = this.utils.findReferencedParameters(notationItem);
    let missingVariables: RenderedVariable[] = [];
    let autoVariables: RenderedVariable[] = [];
    for (let variable of variables) {
      if (!referencedParams.has(variable.param)) {
        if (variable.canAutoFill) {
          autoVariables.push(variable);
        } else {
          missingVariables.push(variable);
        }
      }
    }
    if (missingVariables.length) {
      this.setMessageItem(missingVariables, 'must be included', messageItem);
      return false;
    } else if (autoVariables.length) {
      this.setMessageItem(autoVariables, 'will be inferred automatically if possible', messageItem);
    } else {
      messageItem.info = new Notation.EmptyExpression;
      messageItem.visible = false;
    }
    return true;
  }

  private checkRequiredArguments(template: Fmt.Definition, notationItem: Fmt.DefinitionRefExpression): boolean {
    for (let param of template.parameters) {
      if (!param.optional && !param.defaultValue && !notationItem.path.arguments.getOptionalValue(param.name)) {
        return false;
      }
    }
    return true;
  }

  private setMessageItem(variables: RenderedVariable[], textFragment: string, messageItem: Dialog.ExpressionDialogInfoItem): void {
    let row: Notation.RenderedExpression[] = [];
    for (let variable of variables) {
      let text = new Notation.TextExpression(row.length ? ', ' : variables.length > 1 ? `The following variables ${textFragment}: ` : `The following variable ${textFragment}: `);
      text.styleClasses = ['info-text'];
      row.push(
        text,
        variable.notation
      );
    }
    messageItem.info = new Notation.RowExpression(row);
    messageItem.visible = true;
  }

  private getNotationMenuNegationRow(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let negationRow = new Menu.StandardExpressionMenuRow('With negation');
    negationRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getNegationDialog(notationItem, onSetNotationItem, variables, type, isTopLevel, isPredicate, renderer));
    negationRow.selected = notationItem instanceof FmtNotation.MetaRefExpression_neg;
    return negationRow;
  }

  private getNegationDialog(notationItem: Fmt.Expression | undefined, onSetNotationItem: SetNotationItemFn, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let dialog = new Dialog.ExpressionDialog;
    dialog.items = [];
    let newNotationItem: FmtNotation.MetaRefExpression_neg;
    if (notationItem instanceof FmtNotation.MetaRefExpression_neg) {
      newNotationItem = notationItem.clone() as FmtNotation.MetaRefExpression_neg;
    } else {
      newNotationItem = new FmtNotation.MetaRefExpression_neg;
      newNotationItem.items = [];
      if (notationItem) {
        newNotationItem.items.push(notationItem);
      }
    }
    for (let index = 0; index <= 1; index++) {
      let paramItem = new Dialog.ExpressionDialogParameterItem;
      paramItem.title = index ? 'Negated' : 'Regular';
      let onSetItem = (newItem: Fmt.Expression | undefined) => {
        if (newItem) {
          if (newNotationItem.items.length <= index) {
            do {
              newNotationItem.items.push(newItem);
            } while (newNotationItem.items.length <= index);
          } else {
            newNotationItem.items[index] = newItem;
          }
        }
      };
      paramItem.onGetValue = () => {
        let regular = newNotationItem.items.length > index ? newNotationItem.items[index] : undefined;
        return this.renderArgumentValue(regular, type, 0, undefined, onSetItem, variables, renderedTemplateArguments, isTopLevel, false, isPredicate, renderer);
      };
      dialog.items.push(paramItem);
    }
    dialog.onOK = () => onSetNotationItem(newNotationItem);
    return dialog;
  }

  private getNotationMenuAlternativesRow(notation: Fmt.Expression[] | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let alternativesRow = new Menu.StandardExpressionMenuRow('Multiple alternatives');
    alternativesRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getAlternativesDialog(notation, onSetNotation, variables, isTopLevel, isPredicate, renderer));
    alternativesRow.selected = notation !== undefined && notation.length > 1;
    return alternativesRow;
  }

  private getAlternativesDialog(notation: Fmt.Expression[] | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let dialog = new Dialog.ExpressionDialog;
    dialog.items = [];
    let newNotation: Fmt.Expression[] = [];
    if (notation) {
      newNotation = notation.slice();
    }
    let paramItem = new Dialog.ExpressionDialogParameterItem;
    paramItem.title = 'Alternatives';
    paramItem.onGetValue = () => {
      let newNotationExpression = new Fmt.ArrayExpression;
      newNotationExpression.items = newNotation;
      let type = new FmtNotation.MetaRefExpression_Expr;
      let onSetNotationExpression = (notationExpression: Fmt.Expression) => {
        if (notationExpression instanceof Fmt.ArrayExpression) {
          onSetNotation(notationExpression.items);
        }
      };
      return this.renderArgumentValue(newNotationExpression, type, 1, undefined, onSetNotationExpression, variables, renderedTemplateArguments, isTopLevel, false, isPredicate, renderer);
    };
    dialog.items.push(paramItem);
    dialog.onOK = () => onSetNotation(newNotation);
    return dialog;
  }

  private getRenderedTemplateArguments(variables: RenderedVariable[]): RenderedTemplateArguments {
    let renderedTemplateArguments: RenderedTemplateArguments = {};
    for (let variable of variables) {
      renderedTemplateArguments[variable.param.name] = variable.notation;
    }
    return renderedTemplateArguments;
  }

  protected getParameterPlaceholderItem(type: Fmt.Expression, defaultName: string, parameterList: Fmt.ParameterList, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn): Menu.ExpressionMenuItem {
    let context = this.editAnalysis.newParameterContext.get(parameterList);
    let parameter = this.utils.createParameter(type, defaultName, context);

    let item = new Menu.ExpressionMenuItem(onRenderParam(parameter));
    item.action = new Menu.ImmediateExpressionMenuAction(() => onInsertParam(parameter));
    return item;
  }

  protected getVariableRow(expressionEditInfo: Edit.ExpressionEditInfo, onGetExpressions: (variable: Fmt.Parameter) => CachedPromise<Fmt.Expression[]>, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuRow {
    let variables = expressionEditInfo.context.getVariables();
    let variableItems: CachedPromise<Menu.ExpressionMenuItem[]> = CachedPromise.resolve([]);
    let variableNames = new Set<string>();
    for (let variableIndex = variables.length - 1; variableIndex >= 0; variableIndex--) {
      let variable = variables[variableIndex];
      if (variableNames.has(variable.name)) {
        // Cannot reference shadowed variable.
        continue;
      } else {
        variableNames.add(variable.name);
      }
      variableItems = variableItems.then((items: Menu.ExpressionMenuItem[]) =>
        onGetExpressions(variable).then((expressions: Fmt.Expression[]) => {
          let newItems = expressions.map((expression: Fmt.Expression) => this.getExpressionItem(expression, expressionEditInfo, onRenderExpression));
          return newItems.concat(items);
        })
      );
    }
    let variableList = new Menu.ExpressionMenuItemList(variableItems);
    variableList.variable = true;
    let variableRow = new Menu.StandardExpressionMenuRow('Variable');
    variableRow.subMenu = variableList;
    return variableRow;
  }

  protected getDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, definitionTypes: Logic.LogicDefinitionType[], onGetExpressions: GetExpressionsFn, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuRow {
    let selectedDefinition = this.getSelectedDefinition(expressionEditInfo);

    let definitionRow = new Menu.StandardExpressionMenuRow('Definition');
    definitionRow.titleAction = new Menu.DialogExpressionMenuAction(() => {
      let treeItem = new Dialog.ExpressionDialogTreeItem;
      treeItem.libraryDataProvider = this.libraryDataProvider.getRootProvider();
      treeItem.templates = this.templates;
      treeItem.onFilter = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => {
        let relativePath = this.libraryDataProvider.getRelativePathWithProvider(libraryDataProvider, path);
        let expressionsPromise = onGetExpressions(relativePath, libraryDefinition.definition, definition, false);
        if (expressionsPromise) {
          return expressionsPromise.then((expressions: Fmt.Expression[]) => expressions.length > 0);
        } else {
          return CachedPromise.resolve(false);
        }
      };
      let selectionItem = new Dialog.ExpressionDialogSelectionItem<Fmt.Expression>();
      selectionItem.items = [];
      selectionItem.onRenderItem = onRenderExpression;
      treeItem.onItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise?: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => {
        let absolutePath = libraryDataProvider.getAbsolutePath(path);
        let relativePath = this.libraryDataProvider.getRelativePath(absolutePath);
        treeItem.selectedItemPath = absolutePath;
        treeItem.changed();
        if (!libraryDefinitionPromise) {
          libraryDefinitionPromise = libraryDataProvider.fetchItem(FmtUtils.getOuterPath(path), false);
        }
        libraryDefinitionPromise.then((libraryDefinition: LibraryDefinition) => {
          let definition = FmtUtils.getInnerDefinition(libraryDefinition.definition, path);
          let expressionsPromise = onGetExpressions(relativePath, libraryDefinition.definition, definition, false);
          if (expressionsPromise) {
            expressionsPromise.then((expressions: Fmt.Expression[]) => {
              selectionItem.items = expressions;
              selectionItem.selectedItem = expressions.length ? expressions[0] : undefined;
              selectionItem.changed();
            });
          }
        });
      };
      if (selectedDefinition) {
        treeItem.onItemClicked(this.libraryDataProvider, selectedDefinition.path);
      } else {
        let dummyPath = new Fmt.Path;
        dummyPath.name = '';
        treeItem.selectedItemPath = this.libraryDataProvider.getAbsolutePath(dummyPath);
      }
      let dialog = new Dialog.ExpressionDialog;
      dialog.items = [
        treeItem,
        selectionItem
      ];
      dialog.onOK = () => {
        if (selectionItem.selectedItem) {
          this.setValueAndAddToMRU(selectionItem.selectedItem, expressionEditInfo);
        }
      };
      dialog.onCheckOKEnabled = () => (selectionItem.selectedItem !== undefined);
      return dialog;
    });
    definitionRow.iconType = definitionTypes[0];
    definitionRow.subMenu = new Menu.ExpressionMenu(this.getMRURows(expressionEditInfo, onGetExpressions, onRenderExpression));
    if (selectedDefinition) {
      definitionRow.selected = true;
    }
    return definitionRow;
  }

  protected abstract getSelectedDefinition(expressionEditInfo: Edit.ExpressionEditInfo): Fmt.DefinitionRefExpression | undefined;

  private getMRURows(expressionEditInfo: Edit.ExpressionEditInfo, onGetExpressions: GetExpressionsFn, onRenderExpression: RenderExpressionFn): CachedPromise<Menu.ExpressionMenuRow[]> {
    let iterator = this.mruList.iterator(this.libraryDataProvider);
    let addAllDefinitions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, rows: Menu.ExpressionMenuRow[]) => {
      let result = onGetExpressions(path, outerDefinition, definition, true) || CachedPromise.resolve([]);
      return result.then((expressions: Fmt.Expression[]): void | CachedPromise<void> => {
        if (expressions.length) {
          let items = expressions.map((expression: Fmt.Expression) => this.getExpressionItem(expression, expressionEditInfo, onRenderExpression));
          if (items.length === 1) {
            rows.push(items[0]);
          } else {
            rows.push(new Menu.ExpressionMenuItemList(CachedPromise.resolve(items)));
          }
        }
        if (definition.innerDefinitions.length) {
          let currentResult = CachedPromise.resolve();
          for (let innerDefinition of definition.innerDefinitions) {
            let innerPath = new Fmt.Path;
            innerPath.name = innerDefinition.name;
            innerPath.parentPath = path;
            currentResult = currentResult.then(() => addAllDefinitions(innerPath, outerDefinition, innerDefinition, rows));
          }
          return currentResult;
        }
      });
    };
    let extendRows = (rows: Menu.ExpressionMenuRow[]) =>
      iterator.next().then((path: Fmt.Path | undefined): Menu.ExpressionMenuRow[] | CachedPromise<Menu.ExpressionMenuRow[]> => {
        if (path) {
          let relativePath = this.libraryDataProvider.getRelativePath(path);
          return this.libraryDataProvider.fetchItem(relativePath, false, false)
            .then((libraryDefinition: LibraryDefinition) => addAllDefinitions(relativePath, libraryDefinition.definition, libraryDefinition.definition, rows))
            .catch(() => {})
            .then(() => {
              if (rows.length < 8) {
                return extendRows(rows);
              } else {
                return rows;
              }
            });
        } else {
          return rows;
        }
      });
    return extendRows([]);
  }

  protected getExpressionItem(expression: Fmt.Expression, expressionEditInfo: Edit.ExpressionEditInfo, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuItem {
    let renderedExpression = onRenderExpression(expression);
    let item = new Menu.ExpressionMenuItem(renderedExpression);
    item.action = new Menu.ImmediateExpressionMenuAction(() => this.setValueAndAddToMRU(expression, expressionEditInfo));
    let origExpression = expressionEditInfo.expression;
    if (origExpression && !(origExpression instanceof Fmt.DefinitionRefExpression)) {
      let newExpression = expression;
      if (Object.getPrototypeOf(newExpression) === Object.getPrototypeOf(origExpression)) {
        if (newExpression instanceof Fmt.VariableRefExpression && origExpression instanceof Fmt.VariableRefExpression) {
          item.selected = newExpression.variable === origExpression.variable;
        } else {
          item.selected = true;
        }
      }
    }
    return item;
  }

  private setValueAndAddToMRU(expression: Fmt.Expression, expressionEditInfo: Edit.ExpressionEditInfo): void {
    expressionEditInfo.onSetValue(expression);
    if (expression instanceof Fmt.DefinitionRefExpression) {
      let absolutePath = this.libraryDataProvider.getAbsolutePath(expression.path);
      this.mruList.add(absolutePath);
    }
  }

  protected addParameterToGroup(param: Fmt.Parameter, parameterList?: Fmt.ParameterList): Fmt.Parameter | undefined {
    if (parameterList) {
      let index = parameterList.indexOf(param);
      if (index >= 0) {
        let paramClone = param.clone();
        let context = this.editAnalysis.newParameterContext.get(parameterList);
        if (context) {
          paramClone.name = this.utils.getUnusedDefaultName(paramClone.name, context);
        }
        paramClone.previousParameter = param;
        let cloneIndex = index + 1;
        parameterList.splice(cloneIndex, 0, paramClone);
        let nextIndex = cloneIndex + 1;
        if (nextIndex < parameterList.length) {
          parameterList[nextIndex].previousParameter = paramClone;
        }
        return paramClone;
      }
    }
    return undefined;
  }

  addVariableNameEditor(text: Notation.TextExpression, param: Fmt.Parameter, parameterList?: Fmt.ParameterList) {
    text.onTextChanged = (newText: string) => {
      if (!newText) {
        return false;
      }
      // TODO prevent shadowing of other variables
      if (newText.endsWith(',')) {
        let newName = newText.substring(0, newText.length - 1);
        if (newName) {
          param.name = newName;
        }
        if (param.name) {
          let paramClone = this.addParameterToGroup(param, parameterList);
          if (paramClone) {
            GenericEditHandler.lastInsertedParameter = paramClone;
          }
        }
      } else {
        param.name = newText;
      }
      return true;
    };
    if (GenericEditHandler.lastInsertedParameter === param) {
      text.requestTextInput = true;
      GenericEditHandler.lastInsertedParameter = undefined;
    }
  }

  addDefinitionRemarkEditor(markdown: Notation.MarkdownExpression, definition: Fmt.Definition, allKinds: string[], kind: string): void {
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
    if (kind === 'references') {
      markdown.searchURLs = [];
      for (let defaultReference of defaultReferences) {
        if (defaultReference.searchUrlPrefix) {
          markdown.searchURLs.push({
            title: defaultReference.title,
            searchUrlPrefix: defaultReference.searchUrlPrefix
          });
        }
      }
      markdown.defaultSearchText = this.definition.name;
    }
  }

  addIntegerEditor(text: Notation.TextExpression, expression: Fmt.Expression, negativeValuesAllowed: boolean): void {
    let expressionEditInfo = this.editAnalysis.expressionEditInfo.get(expression);
    if (expressionEditInfo) {
      text.onTextChanged = (newText: string) => {
        if (!newText || newText === '-') {
          return false;
        }
        let newValue: Fmt.BN;
        try {
          newValue = new Fmt.BN(newText);
        } catch (error) {
          return false;
        }
        if (newValue.isNeg() && !negativeValuesAllowed) {
          return false;
        }
        let newExpression = new Fmt.IntegerExpression;
        newExpression.value = newValue;
        expressionEditInfo!.onSetValue(newExpression);
        return true;
      };
    }
  }
}
