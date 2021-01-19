import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
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

export type SetNotationFn = (notation: Fmt.Expression | undefined) => void;
export type UpdateNotationFn = () => void;

export type RenderParameterFn = (parameter: Fmt.Parameter) => Notation.RenderedExpression;
export type InsertParameterFn = (parameter: Fmt.Parameter) => void;

export type RenderExpressionFn = (expression: Fmt.Expression) => Notation.RenderedExpression;
export type InsertExpressionFn = (expression: Fmt.Expression) => void;
export type SetExpressionFn = (expression: Fmt.Expression | undefined) => void;

export type RenderExpressionsFn = (expressions: Fmt.Expression[]) => Notation.RenderedExpression;

export type RenderArgumentsFn<HandlerT extends GenericEditHandler> = (parameterList: Fmt.ParameterList, argumentList: Fmt.ArgumentList, innerEditHandler: HandlerT) => Notation.RenderedExpression;

export type GetExpressionsFn = (getPath: () => Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, fromMRUList: boolean) => CachedPromise<Fmt.Expression[]> | undefined;

export abstract class GenericEditHandler {
  protected editAnalysis: Edit.EditAnalysis;
  static lastInsertedParameter?: Fmt.Parameter;

  constructor(protected definition: Fmt.Definition, protected libraryDataProvider: LibraryDataProvider, private createEditAnalysisFn: () => Edit.EditAnalysis, protected utils: GenericUtils, protected templates: Fmt.File, protected mruList: MRUList) {}

  update(): CachedPromise<void> {
    this.editAnalysis = this.createEditAnalysisFn();
    return CachedPromise.resolve();
  }

  protected getUsedParameterNames(): Set<string> {
    return new Set<string>(this.editAnalysis.usedParameterNames);
  }

  protected cloneAndAdaptParameterNames<T extends Fmt.FileObject<T>>(expression: T): T {
    const replacedParameters: Fmt.ReplacedParameter[] = [];
    const result = expression.clone(replacedParameters);
    if (replacedParameters.length) {
      const usedParameterNames = this.getUsedParameterNames();
      for (const replacedParameter of replacedParameters) {
        const param = replacedParameter.replacement;
        const newName = this.utils.getUnusedDefaultName(param.name, usedParameterNames);
        FmtUtils.renameParameter(param, newName, undefined, result);
      }
    }
    return result;
  }

  isTemporaryExpression(expression: Fmt.Expression): boolean {
    return this.editAnalysis.expressionEditInfo.get(expression) === undefined;
  }

  protected getTypeRow(type: string | undefined, onRenderType: RenderTypeFn, info: LibraryItemInfo): Menu.ExpressionMenuRow {
    const action = new Menu.ImmediateExpressionMenuAction(() => {
      const newInfo = {
        ...info,
        type: type
      };
      return this.libraryDataProvider.setLocalItemInfo(this.definition.name, newInfo);
    });
    const item = new Menu.ExpressionMenuItem(onRenderType(type), action);
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
    const titleText = info.title || '';
    const titleAction = new Menu.ImmediateExpressionMenuAction(() => {
      const newInfo = {
        ...info,
        title: titleText || undefined
      };
      return this.libraryDataProvider.setLocalItemInfo(this.definition.name, newInfo);
    });
    const titleRow = new Menu.StandardExpressionMenuRow('Title');
    titleRow.subMenu = new Menu.ExpressionMenuTextInput(titleText, 20, false, titleAction);
    titleRow.selected = info.title !== undefined;
    return titleRow;
  }

  protected getActionInsertButton(action: Menu.ExpressionMenuAction | undefined): Notation.RenderedExpression {
    const insertButton = new Notation.InsertPlaceholderExpression;
    insertButton.action = action;
    return insertButton;
  }

  getImmediateInsertButton(onInsert: () => void, enabled: boolean = true): Notation.RenderedExpression {
    const action = enabled ? new Menu.ImmediateExpressionMenuAction(onInsert) : undefined;
    return this.getActionInsertButton(action);
  }

  protected getSemanticLinkInsertButton(onInitialize: (semanticLink: Notation.SemanticLink) => void, mandatory: boolean = false): Notation.RenderedExpression {
    const insertButton = new Notation.InsertPlaceholderExpression(mandatory);
    const semanticLink = new Notation.SemanticLink(insertButton, false, false);
    onInitialize(semanticLink);
    insertButton.semanticLinks = [semanticLink];
    return insertButton;
  }

  protected getMenuInsertButton(onMenuOpened: () => Menu.ExpressionMenu, mandatory: boolean = false, autoOpen: boolean = false): Notation.RenderedExpression {
    const onInitialize = (semanticLink: Notation.SemanticLink) => {
      semanticLink.onMenuOpened = onMenuOpened;
      semanticLink.autoOpenMenu = autoOpen;
    };
    return this.getSemanticLinkInsertButton(onInitialize, mandatory);
  }

  protected addListItemInsertButton(renderedItems: Notation.ExpressionValue[], innerType: Fmt.Expression, onInsertItem: () => void, enabledPromise: CachedPromise<boolean>): void {
    const insertButtonPromise = enabledPromise.then((enabled: boolean) => this.getImmediateInsertButton(onInsertItem, enabled));
    let insertButton: Notation.ExpressionValue = new Notation.PromiseExpression(insertButtonPromise);
    while (innerType instanceof Fmt.IndexedExpression) {
      insertButton = [insertButton];
      innerType = innerType.body;
    }
    renderedItems.push(insertButton);
  }

  addNotationMenu(semanticLink: Notation.SemanticLink, notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, onGetDefault: () => Notation.RenderedExpression | undefined, onGetVariables: () => RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): void {
    const type = new FmtNotation.MetaRefExpression_Expr;
    semanticLink.onMenuOpened = () => {
      const defaultValue = onGetDefault();
      const variables = onGetVariables();
      const rows: Menu.ExpressionMenuRow[] = [];
      this.addNotationMenuRows(rows, notation, onSetNotation, defaultValue, variables, type, !notation, true, false, isPredicate, renderer);
      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private addNotationItemMenu(semanticLink: Notation.SemanticLink, notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, defaultValue: Notation.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    semanticLink.onMenuOpened = () => {
      const isDefault = !notation && !canRemove;
      const rows: Menu.ExpressionMenuRow[] = [];
      this.addNotationMenuRows(rows, notation, onSetNotation, defaultValue, variables, type, isDefault, isTopLevel, canRemove, isPredicate, renderer);
      if (rows.length === 1) {
        const row = rows[0];
        if (row instanceof Menu.StandardExpressionMenuRow && row.subMenu instanceof Menu.ExpressionMenu) {
          return row.subMenu;
        }
      }
      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private addNotationMenuRows(rows: Menu.ExpressionMenuRow[], notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, defaultValue: Notation.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isDefault: boolean, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    if (defaultValue || canRemove) {
      rows.push(
        this.getNotationMenuDefaultRow(defaultValue, onSetNotation, isDefault, canRemove),
        new Menu.ExpressionMenuSeparator
      );
    }
    const complexExpressionRequired = isTopLevel && variables.length !== 0;
    if (type instanceof FmtNotation.MetaRefExpression_Expr) {
      if (!complexExpressionRequired) {
        rows.push(this.getNotationMenuTextRow(notation, onSetNotation));
        if (variables.length && !isTopLevel) {
          rows.push(this.getNotationMenuVariablesRow(notation, onSetNotation, variables));
        }
      }
      rows.push(this.getNotationMenuTemplatesRow(notation, onSetNotation, variables, isTopLevel, isPredicate, complexExpressionRequired, renderer));
    } else if (type instanceof FmtNotation.MetaRefExpression_Bool) {
      rows.push(this.getNotationMenuFalseRow(notation, onSetNotation));
      rows.push(this.getNotationMenuTrueRow(notation, onSetNotation));
    } else if (type instanceof FmtNotation.MetaRefExpression_Int) {
      rows.push(this.getNotationMenuIntegerRow(notation, onSetNotation));
    } else if (type instanceof FmtNotation.MetaRefExpression_String) {
      rows.push(this.getNotationMenuTextRow(notation, onSetNotation, 'String'));
    }
    if (isPredicate && !isTopLevel) {
      rows.push(this.getNotationMenuNegationRow(notation, onSetNotation, variables, type, isTopLevel, isPredicate, renderer));
    }
  }

  private getNotationMenuDefaultRow(renderedDefault: Notation.RenderedExpression | undefined, onSetNotation: SetNotationFn, isDefault: boolean, isRemoveRow: boolean): Menu.ExpressionMenuRow {
    const defaultAction = new Menu.ImmediateExpressionMenuAction(() => onSetNotation(undefined));
    const defaultRow = new Menu.StandardExpressionMenuRow(isRemoveRow ? 'Remove' : 'Default');
    if (isRemoveRow) {
      defaultRow.iconType = 'remove';
    }
    if (renderedDefault) {
      const defaultItem = new Menu.ExpressionMenuItem(renderedDefault, defaultAction);
      defaultItem.selected = isDefault;
      defaultRow.subMenu = defaultItem;
    } else {
      defaultRow.titleAction = defaultAction;
    }
    return defaultRow;
  }

  private getNotationMenuFalseRow(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn): Menu.ExpressionMenuRow {
    const falseRow = new Menu.StandardExpressionMenuRow('False');
    falseRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => onSetNotation(new FmtNotation.MetaRefExpression_false));
    falseRow.selected = notation instanceof FmtNotation.MetaRefExpression_false;
    return falseRow;
  }

  private getNotationMenuTrueRow(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn): Menu.ExpressionMenuRow {
    const trueRow = new Menu.StandardExpressionMenuRow('True');
    trueRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => onSetNotation(new FmtNotation.MetaRefExpression_true));
    trueRow.selected = notation instanceof FmtNotation.MetaRefExpression_true;
    return trueRow;
  }

  private getNotationMenuIntegerRow(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn): Menu.ExpressionMenuRow {
    const text = notation instanceof Fmt.IntegerExpression ? notation.value.toString() : '';
    const action = new Menu.ImmediateExpressionMenuAction(() => {
      try {
        const value = BigInt(integerItem.text);
        const newNotation = new Fmt.IntegerExpression(value);
        onSetNotation(newNotation);
      } catch {}
    });
    const integerItem = new Menu.ExpressionMenuTextInput(text, 4, false, action);
    integerItem.selected = (notation !== undefined);
    const integerRow = new Menu.StandardExpressionMenuRow('Number');
    integerRow.subMenu = integerItem;
    return integerRow;
  }

  private getNotationMenuTextRow(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, title: string = 'Symbol/Text'): Menu.ExpressionMenuRow {
    const text = notation instanceof Fmt.StringExpression ? notation.value : '';
    const action = new Menu.ImmediateExpressionMenuAction(() => {
      const newNotation = new Fmt.StringExpression(textItem.text);
      onSetNotation(newNotation);
    });
    const textItem = new Menu.ExpressionMenuTextInput(text, 4, true, action);
    textItem.selected = (notation !== undefined);
    const textRow = new Menu.StandardExpressionMenuRow(title);
    textRow.subMenu = textItem;
    return textRow;
  }

  private getNotationMenuVariablesRow(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[]): Menu.ExpressionMenuRow {
    const items: Menu.ExpressionMenuItem[] = [];
    for (const variable of variables) {
      const action = new Menu.ImmediateExpressionMenuAction(() => {
        const newNotation = new Fmt.VariableRefExpression(variable.param);
        onSetNotation(newNotation);
      });
      const variableItem = new Menu.ExpressionMenuItem(variable.notation, action);
      if (notation instanceof Fmt.VariableRefExpression && notation.variable === variable.param) {
        variableItem.selected = true;
      }
      items.push(variableItem);
    }
    const variablesGroup = new Menu.ExpressionMenuItemList(CachedPromise.resolve(items));
    const variablesRow = new Menu.StandardExpressionMenuRow('Variable');
    variablesRow.subMenu = variablesGroup;
    return variablesRow;
  }

  private getNotationMenuTemplatesRow(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, complexExpressionRequired: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    const rows: Menu.ExpressionMenuRow[] = [];
    for (const template of this.templates.definitions) {
      if ((!complexExpressionRequired || template.parameters.length)
          && this.isTemplateApplicable(template, isTopLevel, isPredicate)) {
        const templateRow = this.getNotationMenuTemplateRow(template, notation, onSetNotation, variables, isTopLevel, isPredicate, renderer);
        rows.push(templateRow);
      }
    }
    const templateMenu = new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    templateMenu.variable = true;
    const templatesRow = new Menu.StandardExpressionMenuRow('Template');
    templatesRow.subMenu = templateMenu;
    return templatesRow;
  }

  private isTemplateApplicable(template: Fmt.Definition, isTopLevel: boolean, isPredicate: boolean): boolean {
    if (template.contents instanceof FmtNotation.ObjectContents_Template) {
      const context = template.contents.context;
      if (context) {
        if (isTopLevel) {
          if (isPredicate) {
            return context.predicate instanceof FmtNotation.MetaRefExpression_true;
          } else {
            return context.operator instanceof FmtNotation.MetaRefExpression_true;
          }
        } else {
          return context.argument instanceof FmtNotation.MetaRefExpression_true;
        }
      } else {
        let notation = template.contents.notation;
        while (notation instanceof FmtNotation.MetaRefExpression_sel && notation.items.length) {
          notation = notation.items[0];
        }
        if (notation instanceof Fmt.DefinitionRefExpression && !notation.path.parentPath) {
          const notationTemplate = this.templates.definitions.getDefinition(notation.path.name);
          return this.isTemplateApplicable(notationTemplate, isTopLevel, isPredicate);
        }
      }
    }
    return false;
  }

  private getNotationMenuTemplateRow(template: Fmt.Definition, notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    const title = new Notation.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    const templateRow = new Menu.StandardExpressionMenuRow(title);
    templateRow.info = this.getDocumentation(template);
    templateRow.examples = this.getExamples(template, renderer);
    if (template.parameters.length) {
      templateRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getTemplateDialog(template, notation, onSetNotation, variables, isTopLevel, isPredicate, renderer));
    } else {
      templateRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => {
        const newPath = new Fmt.Path(template.name);
        const newNotation = new Fmt.DefinitionRefExpression(newPath);
        onSetNotation(newNotation);
      });
    }
    templateRow.selected = notation instanceof Fmt.DefinitionRefExpression && notation.path.name === template.name;
    return templateRow;
  }

  private getTemplateDialog(template: Fmt.Definition, notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    const renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let title: Notation.RenderedExpression = new Notation.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    if (template.documentation) {
      const paragraphs: Notation.RenderedExpression[] = [title];
      this.addDocumentation(template.documentation, undefined, paragraphs);
      title = new Notation.ParagraphExpression(paragraphs);
    }
    const dialog = new Dialog.ExpressionDialog([
      new Dialog.ExpressionDialogInfoItem(() => title),
      new Dialog.ExpressionDialogSeparatorItem
    ]);
    dialog.styleClasses = ['wide'];
    let newNotation: Fmt.DefinitionRefExpression;
    if (notation instanceof Fmt.DefinitionRefExpression && !notation.path.parentPath && notation.path.name === template.name) {
      newNotation = notation.clone() as Fmt.DefinitionRefExpression;
    } else {
      const newPath = new Fmt.Path(template.name);
      if (isTopLevel) {
        this.preFillArguments(template.parameters, newPath.arguments, variables);
      }
      newNotation = new Fmt.DefinitionRefExpression(newPath);
    }
    const previewItem = this.createTemplateDialogPreviewItem(newNotation, isTopLevel && isPredicate, renderedTemplateArguments, renderer);
    let messageItem: Dialog.ExpressionDialogInfoItem | undefined = undefined;
    if (isTopLevel) {
      messageItem = new Dialog.ExpressionDialogInfoItem(() => undefined);
    }
    let requiredArgumentsFilled = this.checkRequiredArguments(template, newNotation);
    previewItem.visible = requiredArgumentsFilled;
    let okEnabled = requiredArgumentsFilled;
    if (messageItem && !this.checkReferencedParameters(newNotation, variables, messageItem)) {
      okEnabled = false;
    }
    let paramIndex = 0;
    const previousParamNames: string[] = [];
    for (const param of template.parameters) {
      const paramTitle = new Notation.TextExpression(param.name);
      paramTitle.styleClasses = ['source-code'];
      const localPreviousParamNames = previousParamNames.slice();
      const onGetValue = () => {
        const value = newNotation.path.arguments.getOptionalValue(param.name, paramIndex);
        const onUpdateParamNotation = () => {
          requiredArgumentsFilled = this.checkRequiredArguments(template, newNotation);
          previewItem.visible = requiredArgumentsFilled;
          previewItem.changed();
          okEnabled = requiredArgumentsFilled;
          if (messageItem && !this.checkReferencedParameters(newNotation, variables, messageItem)) {
            okEnabled = false;
          }
        };
        const onSetParamNotation = (newValue: Fmt.Expression | undefined) => {
          newNotation.path.arguments.setValue(param.name, paramIndex, newValue, localPreviousParamNames);
          onUpdateParamNotation();
        };
        const canRemove = param.optional && value !== undefined;
        return this.renderArgumentValue(value, param.type, param.defaultValue, onSetParamNotation, onUpdateParamNotation, variables, renderedTemplateArguments, false, canRemove, isPredicate, renderer);
      };
      const paramItem = new Dialog.ExpressionDialogParameterItem(paramTitle, onGetValue);
      paramItem.onGetInfo = () => this.getDocumentation(template, param);
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
    dialog.onOK = () => onSetNotation(newNotation);
    return dialog;
  }

  private getDocumentation(definition: Fmt.Definition, param?: Fmt.Parameter): Notation.RenderedExpression | undefined {
    if (definition.documentation) {
      const paragraphs: Notation.RenderedExpression[] = [];
      this.addDocumentation(definition.documentation, param, paragraphs);
      if (paragraphs.length) {
        return new Notation.ParagraphExpression(paragraphs);
      }
    }
    return undefined;
  }

  private addDocumentation(documentation: Fmt.DocumentationComment, param: Fmt.Parameter | undefined, paragraphs: Notation.RenderedExpression[]): void {
    for (const documentationItem of documentation.items) {
      if (param) {
        if (documentationItem.parameter !== param) {
          continue;
        }
      } else {
        if (documentationItem.kind) {
          break;
        }
      }
      const paragraph = new Notation.MarkdownExpression(documentationItem.text);
      paragraph.styleClasses = ['info-text'];
      paragraphs.push(paragraph);
    }
  }

  private getExamples(definition: Fmt.Definition, renderer: GenericRenderer): Notation.RenderedExpression[] | undefined {
    if (definition.documentation) {
      const result: Notation.RenderedExpression[] = [];
      for (const documentationItem of definition.documentation.items) {
        if (documentationItem.kind === 'example') {
          const example = new Notation.MarkdownExpression(documentationItem.text);
          example.onRenderCode = (code: string) => {
            try {
              const expression = readCode(code, FmtNotation.metaModel);
              const config: Notation.RenderedTemplateConfig = {
                getArgFn: (name: string) => {
                  const variable = new Notation.TextExpression(name);
                  variable.styleClasses = ['var', 'dummy'];
                  return variable;
                },
                omitArguments: 0,
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

  private renderArgumentValue(value: Fmt.Expression | undefined, type: Fmt.Expression, defaultValue: Fmt.Expression | undefined, onSetNotation: SetNotationFn, onUpdateNotation: UpdateNotationFn, variables: RenderedVariable[], renderedTemplateArguments: RenderedTemplateArguments, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): Notation.RenderedExpression {
    if (type instanceof Fmt.IndexedExpression) {
      let arrayExpression: Fmt.ArrayExpression;
      if (value instanceof Fmt.ArrayExpression) {
        arrayExpression = value;
      } else {
        arrayExpression = new Fmt.ArrayExpression([]);
        onUpdateNotation = () => onSetNotation(arrayExpression);
      }
      const items: Notation.RenderedExpression[] = [];
      for (let index = 0; index < arrayExpression.items.length; index++) {
        const item = arrayExpression.items[index];
        const onSetItem = (newValue: Fmt.Expression | undefined) => {
          if (newValue) {
            arrayExpression.items[index] = newValue;
          } else {
            arrayExpression.items.splice(index, 1);
          }
          onUpdateNotation();
        };
        let argValue = this.renderArgumentValue(item, type.body, undefined, onSetItem, onUpdateNotation, variables, renderedTemplateArguments, isTopLevel, true, isPredicate, renderer);
        if (type.body instanceof Fmt.IndexedExpression) {
          argValue = new Notation.ParenExpression(argValue, '[]');
        }
        items.push(argValue);
      }
      const group: Notation.RenderedExpression | undefined = items.length ? renderer.renderTemplate('Group', {'items': items}) : undefined;
      const insertButton = new Notation.InsertPlaceholderExpression;
      if (type.body instanceof Fmt.IndexedExpression) {
        const onInsertItem = () => {
          const newItem = new Fmt.ArrayExpression([]);
          arrayExpression.items.push(newItem);
          onUpdateNotation();
        };
        insertButton.action = new Menu.ImmediateExpressionMenuAction(onInsertItem);
      } else {
        const semanticLink = new Notation.SemanticLink(insertButton, false, false);
        const onInsertItem = (newValue: Fmt.Expression | undefined) => {
          if (newValue) {
            arrayExpression.items.push(newValue);
            onUpdateNotation();
          }
        };
        this.addNotationItemMenu(semanticLink, undefined, onInsertItem, undefined, variables, type, isTopLevel, false, isPredicate, renderer);
        insertButton.semanticLinks = [semanticLink];
      }
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
      const valueOrDefault = value || defaultValue;
      const renderedValue = valueOrDefault ? renderer.renderNotationExpression(valueOrDefault, renderedTemplateArguments) : new Notation.EmptyExpression;
      const semanticLink = new Notation.SemanticLink(renderedValue, false, false);
      const onGetDefault = () => defaultValue ? renderer.renderNotationExpression(defaultValue, renderedTemplateArguments) : undefined;
      this.addNotationItemMenu(semanticLink, value, onSetNotation, onGetDefault(), variables, type, isTopLevel, canRemove, isPredicate, renderer);
      renderedValue.semanticLinks = [semanticLink];
      return renderedValue;
    }
  }

  private createTemplateDialogPreviewItem(notation: Fmt.Expression, includeNegation: boolean, renderedTemplateArguments: RenderedTemplateArguments, renderer: GenericRenderer): Dialog.ExpressionDialogListItem<number | undefined> {
    // TODO add preview in different contexts, to validate parentheses
    const items = includeNegation ? [0, 1] : [undefined];
    const onRenderItem = (negationCount: number | undefined) => renderer.renderNotationExpression(notation, renderedTemplateArguments, 0, negationCount);
    return new Dialog.ExpressionDialogListItem<number | undefined>(items, onRenderItem);
  }

  private checkReferencedParameters(notation: Fmt.Expression, variables: RenderedVariable[], messageItem: Dialog.ExpressionDialogInfoItem): boolean {
    const referencedParams = this.utils.findReferencedParameters(notation);
    const missingVariables: RenderedVariable[] = [];
    const autoVariables: RenderedVariable[] = [];
    for (const variable of variables) {
      if (referencedParams.indexOf(variable.param) < 0) {
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
      messageItem.onRenderExpression = () => undefined;
    }
    return true;
  }

  private checkRequiredArguments(template: Fmt.Definition, notation: Fmt.DefinitionRefExpression): boolean {
    for (const param of template.parameters) {
      if (!param.optional && !param.defaultValue && !notation.path.arguments.getOptionalValue(param.name)) {
        return false;
      }
    }
    return true;
  }

  private setMessageItem(variables: RenderedVariable[], textFragment: string, messageItem: Dialog.ExpressionDialogInfoItem): void {
    const row: Notation.RenderedExpression[] = [];
    for (const variable of variables) {
      const text = new Notation.TextExpression(row.length ? ', ' : variables.length > 1 ? `The following variables ${textFragment}: ` : `The following variable ${textFragment}: `);
      text.styleClasses = ['info-text'];
      row.push(
        text,
        variable.notation
      );
    }
    messageItem.onRenderExpression = () => new Notation.RowExpression(row);
  }

  private preFillArguments(params: Fmt.ParameterList, args: Fmt.ArgumentList, variables: RenderedVariable[]): void {
    const requiredVariables = variables.filter((variable: RenderedVariable) => !variable.canAutoFill);
    for (const param of params) {
      if (param.type instanceof Fmt.IndexedExpression) {
        const items: Fmt.Expression[] = [];
        if (!(param.type.body instanceof Fmt.IndexedExpression) && (param.name === 'items' || param.name === 'arguments' || (param.name === 'operands' && requiredVariables.length === 2))) {
          for (const variable of requiredVariables) {
            const value = new Fmt.VariableRefExpression(variable.param);
            items.push(value);
          }
        }
        const arrayValue = new Fmt.ArrayExpression(items);
        args.push(new Fmt.Argument(param.name, arrayValue));
      } else {
        if (param.name === 'function' || param.name === 'property' || param.name === 'singular' || param.name === 'plural') {
          const text = param.name === 'plural' ? this.definition.name + 's' : this.definition.name;
          const value = new Fmt.StringExpression(text);
          args.push(new Fmt.Argument(param.name, value));
        } else if (param.name === 'operand' && requiredVariables.length === 1) {
          const value = new Fmt.VariableRefExpression(requiredVariables[0].param);
          args.push(new Fmt.Argument(param.name, value));
        }
      }
    }
  }

  private getNotationMenuNegationRow(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    const negationRow = new Menu.StandardExpressionMenuRow('With negation');
    negationRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getNegationDialog(notation, onSetNotation, variables, type, isTopLevel, isPredicate, renderer));
    negationRow.selected = notation instanceof FmtNotation.MetaRefExpression_neg;
    return negationRow;
  }

  private getNegationDialog(notation: Fmt.Expression | undefined, onSetNotation: SetNotationFn, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    const renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    const items: Dialog.ExpressionDialogItem[] = [];
    let newNotation: FmtNotation.MetaRefExpression_neg;
    if (notation instanceof FmtNotation.MetaRefExpression_neg) {
      newNotation = notation.clone() as FmtNotation.MetaRefExpression_neg;
    } else {
      newNotation = new FmtNotation.MetaRefExpression_neg;
      newNotation.items = [];
      if (notation) {
        newNotation.items.push(notation);
      }
    }
    for (let index = 0; index <= 1; index++) {
      const paramTitle = index ? 'Negated' : 'Regular';
      const onSetItem = (newItem: Fmt.Expression | undefined) => {
        if (newItem) {
          if (newNotation.items.length <= index) {
            do {
              newNotation.items.push(newItem);
            } while (newNotation.items.length <= index);
          } else {
            newNotation.items[index] = newItem;
          }
        }
      };
      const onGetValue = () => {
        const regular = newNotation.items.length > index ? newNotation.items[index] : undefined;
        return this.renderArgumentValue(regular, type, undefined, onSetItem, () => {}, variables, renderedTemplateArguments, isTopLevel, false, isPredicate, renderer);
      };
      items.push(new Dialog.ExpressionDialogParameterItem(paramTitle, onGetValue));
    }
    const onOK = () => onSetNotation(newNotation);
    return new Dialog.ExpressionDialog(items, onOK);
  }

  private getRenderedTemplateArguments(variables: RenderedVariable[]): RenderedTemplateArguments {
    const renderedTemplateArguments: RenderedTemplateArguments = {};
    for (const variable of variables) {
      renderedTemplateArguments[variable.param.name] = variable.notation;
    }
    return renderedTemplateArguments;
  }

  protected getParameterPlaceholderItem(type: Fmt.Expression, defaultName: string, onRenderParam: RenderParameterFn, onInsertParam: InsertParameterFn): Menu.ExpressionMenuItem {
    const parameter = this.utils.createParameter(type, defaultName, this.getUsedParameterNames());

    const action = new Menu.ImmediateExpressionMenuAction(() => onInsertParam(parameter));
    return new Menu.ExpressionMenuItem(onRenderParam(parameter), action);
  }

  protected getVariableRow(expressionEditInfo: Edit.ExpressionEditInfo, onGetExpressions: (variableInfo: Ctx.VariableInfo) => CachedPromise<Fmt.Expression[]>, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuRow {
    let variableItems: CachedPromise<Menu.ExpressionMenuItem[]> = CachedPromise.resolve([]);
    for (const variableInfo of expressionEditInfo.context.getVariables()) {
      variableItems = variableItems.then((items: Menu.ExpressionMenuItem[]) =>
        onGetExpressions(variableInfo).then((expressions: Fmt.Expression[]) => {
          const newItems = expressions.map((expression: Fmt.Expression) => this.getExpressionItem(expression, expressionEditInfo, onRenderExpression));
          return items.concat(newItems);
        })
      );
    }
    const variableList = new Menu.ExpressionMenuItemList(variableItems);
    variableList.variable = true;
    const variableRow = new Menu.StandardExpressionMenuRow('Variable');
    variableRow.subMenu = variableList;
    return variableRow;
  }

  protected getDefinitionRow(expressionEditInfo: Edit.ExpressionEditInfo, definitionTypes: Logic.LogicDefinitionType[], onGetExpressions: GetExpressionsFn, onRenderExpression: RenderExpressionFn): Menu.ExpressionMenuRow {
    const selectedDefinition = this.getSelectedDefinition(expressionEditInfo);

    const definitionRow = new Menu.StandardExpressionMenuRow('Definition');
    definitionRow.titleAction = new Menu.DialogExpressionMenuAction(() => {
      const treeItem = new Dialog.ExpressionDialogTreeItem(this.libraryDataProvider.getRootProvider(), this.templates);
      treeItem.onFilter = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => {
        const getPath = () => this.libraryDataProvider.getRelativePathWithProvider(libraryDataProvider, path);
        const expressionsPromise = onGetExpressions(getPath, libraryDefinition.definition, definition, false);
        if (expressionsPromise) {
          return expressionsPromise.then((expressions: Fmt.Expression[]) => expressions.length > 0);
        } else {
          return CachedPromise.resolve(false);
        }
      };
      const selectionItem = new Dialog.ExpressionDialogSelectionItem<Fmt.Expression>([], onRenderExpression);
      treeItem.onItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise?: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => {
        const absolutePath = libraryDataProvider.getAbsolutePath(path);
        treeItem.selectedItemPath = absolutePath;
        treeItem.changed();
        if (!libraryDefinitionPromise) {
          libraryDefinitionPromise = libraryDataProvider.fetchItem(FmtUtils.getOuterPath(path), false);
        }
        libraryDefinitionPromise.then((libraryDefinition: LibraryDefinition) => {
          const getPath = () => this.libraryDataProvider.getRelativePath(absolutePath);
          const definition = FmtUtils.getInnerDefinition(libraryDefinition.definition, path);
          const expressionsPromise = onGetExpressions(getPath, libraryDefinition.definition, definition, false);
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
        const dummyPath = new Fmt.Path('');
        treeItem.selectedItemPath = this.libraryDataProvider.getAbsolutePath(dummyPath);
      }
      const items = [
        treeItem,
        selectionItem
      ];
      const onOK = () => {
        if (selectionItem.selectedItem) {
          this.setValueAndAddToMRU(selectionItem.selectedItem, expressionEditInfo);
        }
      };
      const dialog = new Dialog.ExpressionDialog(items, onOK);
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
    const iterator = this.mruList.iterator(this.libraryDataProvider);
    const addAllDefinitions = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition, rows: Menu.ExpressionMenuRow[]) => {
      const result = onGetExpressions(() => path, outerDefinition, definition, true) || CachedPromise.resolve([]);
      return result.then((expressions: Fmt.Expression[]): void | CachedPromise<void> => {
        if (expressions.length) {
          const items = expressions.map((expression: Fmt.Expression) => this.getExpressionItem(expression, expressionEditInfo, onRenderExpression));
          if (items.length === 1) {
            rows.push(items[0]);
          } else {
            rows.push(new Menu.ExpressionMenuItemList(CachedPromise.resolve(items)));
          }
        }
        if (definition.innerDefinitions.length) {
          let currentResult = CachedPromise.resolve();
          for (const innerDefinition of definition.innerDefinitions) {
            const innerPath = new Fmt.Path(innerDefinition.name, undefined, path);
            currentResult = currentResult.then(() => addAllDefinitions(innerPath, outerDefinition, innerDefinition, rows));
          }
          return currentResult;
        }
      });
    };
    const extendRows = (rows: Menu.ExpressionMenuRow[]) =>
      iterator.next().then((path: Fmt.Path | undefined): Menu.ExpressionMenuRow[] | CachedPromise<Menu.ExpressionMenuRow[]> => {
        if (path) {
          const relativePath = this.libraryDataProvider.getRelativePath(path);
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
    const renderedExpression = onRenderExpression(expression);
    const action = new Menu.ImmediateExpressionMenuAction(() => this.setValueAndAddToMRU(expression, expressionEditInfo));
    const item = new Menu.ExpressionMenuItem(renderedExpression, action);
    const origExpression = expressionEditInfo.expression;
    if (origExpression && !(origExpression instanceof Fmt.DefinitionRefExpression)) {
      const newExpression = expression;
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
    this.addToMRU(expression);
  }

  protected addToMRU(expression: Fmt.Expression): void {
    if (expression instanceof Fmt.DefinitionRefExpression) {
      const absolutePath = this.libraryDataProvider.getAbsolutePath(expression.path);
      this.mruList.add(absolutePath);
    }
  }

  protected addParameterToGroup(param: Fmt.Parameter, parameterList?: Fmt.ParameterList): Fmt.Parameter | undefined {
    if (parameterList) {
      const index = parameterList.indexOf(param);
      if (index >= 0) {
        const paramClone = param.shallowClone();
        paramClone.name = this.utils.getUnusedDefaultName(paramClone.name, this.getUsedParameterNames());
        parameterList.splice(index + 1, 0, paramClone);
        return paramClone;
      }
    }
    return undefined;
  }

  addVariableNameEditor(text: Notation.TextExpression, param: Fmt.Parameter, parameterList?: Fmt.ParameterList): void {
    text.onTextChanged = (newText: string) => {
      if (!newText) {
        return false;
      }
      // TODO prevent shadowing of other variables (important because writer cannot check it)
      if (newText.endsWith(',')) {
        const newName = newText.substring(0, newText.length - 1);
        if (newName) {
          this.utils.renameParameter(param, newName, parameterList);
        }
        if (param.name) {
          const paramClone = this.addParameterToGroup(param, parameterList);
          if (paramClone) {
            GenericEditHandler.lastInsertedParameter = paramClone;
          }
        }
      } else {
        this.utils.renameParameter(param, newText, parameterList);
      }
      return true;
    };
    if (GenericEditHandler.lastInsertedParameter === param) {
      text.requestTextInput = true;
      GenericEditHandler.lastInsertedParameter = undefined;
    }
  }

  addDefinitionRemarkEditor(markdown: Notation.MarkdownExpression, definition: Fmt.Definition, allKinds: (string | undefined)[], kind: string | undefined): void {
    markdown.onTextChanged = (newText: string) => {
      const newItems: Fmt.DocumentationItem[] = [];
      for (const otherKind of allKinds) {
        if (otherKind === kind) {
          if (newText) {
            newItems.push(new Fmt.DocumentationItem(kind, undefined, newText));
          }
        } else {
          if (definition.documentation) {
            for (const item of definition.documentation.items) {
              if (item.kind === otherKind) {
                newItems.push(item);
              }
            }
          }
        }
      }
      if (newItems.length) {
        if (definition.documentation) {
          definition.documentation.items = newItems;
        } else {
          definition.documentation = new Fmt.DocumentationComment(newItems);
        }
      } else {
        definition.documentation = undefined;
      }
    };
    if (kind === 'references') {
      markdown.searchURLs = [];
      for (const defaultReference of defaultReferences) {
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
    const expressionEditInfo = this.editAnalysis.expressionEditInfo.get(expression);
    if (expressionEditInfo) {
      text.onTextChanged = (newText: string) => {
        if (!newText || newText === '-') {
          return false;
        }
        let newValue: BigInt;
        try {
          newValue = BigInt(newText);
        } catch (error) {
          return false;
        }
        if (newValue < BigInt(0) && !negativeValuesAllowed) {
          return false;
        }
        const newExpression = new Fmt.IntegerExpression(newValue);
        expressionEditInfo!.onSetValue(newExpression);
        return true;
      };
    }
  }
}
