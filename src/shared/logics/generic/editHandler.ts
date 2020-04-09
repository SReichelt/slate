import * as Fmt from '../../format/format';
import * as FmtUtils from '../../format/utils';
import * as Edit from '../../format/edit';
import * as Logic from '../logic';
import * as FmtDisplay from '../../display/meta';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import * as Dialog from '../../display/dialog';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, defaultReferenceSearchURLs } from '../../data/libraryDataProvider';
import { MRUList } from '../../data/mostRecentlyUsedList';
import { GenericUtils } from './utils';
import { GenericRenderer, RenderedVariable } from './renderer';
import CachedPromise from '../../data/cachedPromise';

export type RenderTypeFn = (type: string | undefined) => Display.RenderedExpression;

export type SetDisplayFn = (display: Fmt.Expression[] | undefined) => void;
export type SetDisplayItemFn = (displayItem: Fmt.Expression | undefined) => void;

export type RenderParameterFn = (parameter: Fmt.Parameter) => Display.RenderedExpression;
export type InsertParameterFn = (parameter: Fmt.Parameter) => void;

export type RenderExpressionFn = (expression: Fmt.Expression) => Display.RenderedExpression;
export type InsertExpressionFn = (expression: Fmt.Expression) => void;
export type SetExpressionFn = (expression: Fmt.Expression | undefined) => void;

export type GetExpressionsFn = (path: Fmt.Path, outerDefinition: Fmt.Definition, definition: Fmt.Definition) => CachedPromise<Fmt.Expression[]> | undefined;

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

  addTitleMenu(semanticLink: Display.SemanticLink, info: LibraryItemInfo): void {
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

  protected getActionInsertButton(action: Menu.ExpressionMenuAction): Display.RenderedExpression {
    let insertButton = new Display.InsertPlaceholderExpression;
    insertButton.action = action;
    return insertButton;
  }

  getImmediateInsertButton(onInsert: () => void): Display.RenderedExpression {
    let action = new Menu.ImmediateExpressionMenuAction(onInsert);
    return this.getActionInsertButton(action);
  }

  addDisplayMenu(semanticLink: Display.SemanticLink, display: Fmt.Expression[] | undefined, onSetDisplay: SetDisplayFn, onGetDefault: () => Display.RenderedExpression | undefined, onGetVariables: () => RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): void {
    let displayItem = display && display.length === 1 ? display[0] : undefined;
    let onSetDisplayItem = (newDisplayItem: Fmt.Expression | undefined) => {
      if (newDisplayItem) {
        onSetDisplay([newDisplayItem]);
      } else {
        onSetDisplay(undefined);
      }
    };
    let type = new FmtDisplay.MetaRefExpression_Expr;
    semanticLink.onMenuOpened = () => {
      let defaultValue = onGetDefault();
      let variables = onGetVariables();
      let rows: Menu.ExpressionMenuRow[] = [];
      this.addDisplayMenuRows(rows, displayItem, onSetDisplayItem, defaultValue, variables, type, !display, true, false, isPredicate, renderer);
      if (variables.length > 1) {
        rows.push(
          new Menu.ExpressionMenuSeparator,
          this.getDisplayMenuAlternativesRow(display, onSetDisplay, variables, true, isPredicate, renderer)
        );
      }
      return new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    };
    semanticLink.alwaysShowMenu = true;
  }

  private addDisplayItemMenu(semanticLink: Display.SemanticLink, displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, defaultValue: Display.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    semanticLink.onMenuOpened = () => {
      let isDefault = !displayItem && !canRemove;
      let rows: Menu.ExpressionMenuRow[] = [];
      this.addDisplayMenuRows(rows, displayItem, onSetDisplayItem, defaultValue, variables, type, isDefault, isTopLevel, canRemove, isPredicate, renderer);
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

  private addDisplayMenuRows(rows: Menu.ExpressionMenuRow[], displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, defaultValue: Display.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isDefault: boolean, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    if (defaultValue || canRemove) {
      rows.push(
        this.getDisplayMenuDefaultRow(defaultValue, onSetDisplayItem, isDefault, canRemove),
        new Menu.ExpressionMenuSeparator
      );
    }
    let complexExpressionRequired = isTopLevel && variables.some((variable) => variable.required);
    if (type instanceof FmtDisplay.MetaRefExpression_Expr) {
      if (!complexExpressionRequired) {
        rows.push(this.getDisplayMenuTextRow(displayItem, onSetDisplayItem));
        if (variables.length && !isTopLevel) {
          rows.push(this.getDisplayMenuVariablesRow(displayItem, onSetDisplayItem, variables));
        }
      }
      rows.push(this.getDisplayMenuTemplatesRow(displayItem, onSetDisplayItem, variables, isPredicate, complexExpressionRequired, renderer));
    } else if (type instanceof FmtDisplay.MetaRefExpression_Bool) {
      rows.push(this.getDisplayMenuFalseRow(displayItem, onSetDisplayItem));
      rows.push(this.getDisplayMenuTrueRow(displayItem, onSetDisplayItem));
    } else if (type instanceof FmtDisplay.MetaRefExpression_Int) {
      rows.push(this.getDisplayMenuIntegerRow(displayItem, onSetDisplayItem));
    } else if (type instanceof FmtDisplay.MetaRefExpression_String) {
      rows.push(this.getDisplayMenuTextRow(displayItem, onSetDisplayItem, 'String'));
    }
    if (isPredicate && !isTopLevel) {
      rows.push(this.getDisplayMenuNegationRow(displayItem, onSetDisplayItem, variables, type, isTopLevel, isPredicate, renderer));
    }
  }

  private getDisplayMenuDefaultRow(renderedDefault: Display.RenderedExpression | undefined, onSetDisplayItem: SetDisplayItemFn, isDefault: boolean, isRemoveRow: boolean): Menu.ExpressionMenuRow {
    let defaultAction = new Menu.ImmediateExpressionMenuAction(() => onSetDisplayItem(undefined));
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

  private getDisplayMenuFalseRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn): Menu.ExpressionMenuRow {
    let falseRow = new Menu.StandardExpressionMenuRow('False');
    falseRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => onSetDisplayItem(new FmtDisplay.MetaRefExpression_false));
    falseRow.selected = displayItem instanceof FmtDisplay.MetaRefExpression_false;
    return falseRow;
  }

  private getDisplayMenuTrueRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn): Menu.ExpressionMenuRow {
    let trueRow = new Menu.StandardExpressionMenuRow('True');
    trueRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => onSetDisplayItem(new FmtDisplay.MetaRefExpression_true));
    trueRow.selected = displayItem instanceof FmtDisplay.MetaRefExpression_true;
    return trueRow;
  }

  private getDisplayMenuIntegerRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn): Menu.ExpressionMenuRow {
    let integerItem = new Menu.ExpressionMenuTextInput;
    if (displayItem instanceof Fmt.IntegerExpression) {
      integerItem.selected = true;
      integerItem.text = displayItem.value.toString();
    } else {
      integerItem.text = '';
    }
    integerItem.expectedTextLength = 4;
    integerItem.action = new Menu.ImmediateExpressionMenuAction(() => {
      let newDisplayItem = new Fmt.IntegerExpression;
      newDisplayItem.value = new Fmt.BN(integerItem.text, 10);
      onSetDisplayItem(newDisplayItem);
    });
    let integerRow = new Menu.StandardExpressionMenuRow('Number');
    integerRow.subMenu = integerItem;
    return integerRow;
  }

  private getDisplayMenuTextRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, title: string = 'Symbol/Text'): Menu.ExpressionMenuRow {
    let textItem = new Menu.ExpressionMenuTextInput;
    if (displayItem instanceof Fmt.StringExpression) {
      textItem.selected = true;
      textItem.text = displayItem.value;
    } else {
      textItem.text = '';
    }
    textItem.expectedTextLength = 4;
    textItem.action = new Menu.ImmediateExpressionMenuAction(() => {
      let newDisplayItem = new Fmt.StringExpression;
      newDisplayItem.value = textItem.text;
      onSetDisplayItem(newDisplayItem);
    });
    let textRow = new Menu.StandardExpressionMenuRow(title);
    textRow.subMenu = textItem;
    return textRow;
  }

  private getDisplayMenuVariablesRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, variables: RenderedVariable[]): Menu.ExpressionMenuRow {
    let items: Menu.ExpressionMenuItem[] = [];
    for (let variable of variables) {
      let variableItem = new Menu.ExpressionMenuItem(variable.display);
      if (displayItem instanceof Fmt.VariableRefExpression && displayItem.variable === variable.param) {
        variableItem.selected = true;
      }
      variableItem.action = new Menu.ImmediateExpressionMenuAction(() => {
        let newDisplayItem = new Fmt.VariableRefExpression;
        newDisplayItem.variable = variable.param;
        onSetDisplayItem(newDisplayItem);
      });
      items.push(variableItem);
    }
    let variablesGroup = new Menu.ExpressionMenuItemList(CachedPromise.resolve(items));
    let variablesRow = new Menu.StandardExpressionMenuRow('Variable');
    variablesRow.subMenu = variablesGroup;
    return variablesRow;
  }

  private getDisplayMenuTemplatesRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, variables: RenderedVariable[], isPredicate: boolean, complexExpressionRequired: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let rows: Menu.ExpressionMenuRow[] = [];
    for (let template of this.templates.definitions) {
      if (!complexExpressionRequired || template.parameters.length) {
        let templateRow = this.getDisplayMenuTemplateRow(template, displayItem, onSetDisplayItem, variables, isPredicate, renderer);
        rows.push(templateRow);
      }
    }
    let templateMenu = new Menu.ExpressionMenu(CachedPromise.resolve(rows));
    templateMenu.variable = true;
    let templatesRow = new Menu.StandardExpressionMenuRow('Template');
    templatesRow.subMenu = templateMenu;
    return templatesRow;
  }

  private getDisplayMenuTemplateRow(template: Fmt.Definition, displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, variables: RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let title = new Display.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    let templateRow = new Menu.StandardExpressionMenuRow(title);
    if (template.parameters.length) {
      templateRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getTemplateDialog(template, displayItem, onSetDisplayItem, variables, isPredicate, renderer));
    } else {
      templateRow.titleAction = new Menu.ImmediateExpressionMenuAction(() => {
        let newPath = new Fmt.Path;
        newPath.name = template.name;
        let newDisplayItem = new Fmt.DefinitionRefExpression;
        newDisplayItem.path = newPath;
        onSetDisplayItem(newDisplayItem);
      });
    }
    templateRow.selected = displayItem instanceof Fmt.DefinitionRefExpression && displayItem.path.name === template.name;
    return templateRow;
  }

  private getTemplateDialog(template: Fmt.Definition, displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, variables: RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let titleItem = new Dialog.ExpressionDialogInfoItem;
    titleItem.info = new Display.TextExpression(template.name);
    titleItem.info.styleClasses = ['source-code'];
    // TODO comment
    let dialog = new Dialog.ExpressionDialog;
    dialog.items = [
      titleItem,
      new Dialog.ExpressionDialogSeparatorItem
    ];
    let newDisplayItem: Fmt.DefinitionRefExpression;
    if (displayItem instanceof Fmt.DefinitionRefExpression && !displayItem.path.parentPath && displayItem.path.name === template.name) {
      newDisplayItem = displayItem.clone() as Fmt.DefinitionRefExpression;
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
      newDisplayItem = new Fmt.DefinitionRefExpression;
      newDisplayItem.path = newPath;
    }
    let paramIndex = 0;
    let previousParamNames: string[] = [];
    for (let param of template.parameters) {
      let paramItem = new Dialog.ExpressionDialogParameterItem;
      paramItem.title = new Display.TextExpression(param.name);
      paramItem.title.styleClasses = ['source-code'];
      let localPreviousParamNames = previousParamNames.slice();
      paramItem.onGetValue = () => {
        let value = newDisplayItem.path.arguments.getOptionalValue(param.name, paramIndex);
        let onSetParamDisplay = (newValue: Fmt.Expression | undefined) => {
          newDisplayItem.path.arguments.setValue(newValue, param.name, paramIndex, localPreviousParamNames);
        };
        let canRemove = param.optional && value !== undefined;
        return this.renderArgumentValue(value, param.type.expression, param.type.arrayDimensions, param.defaultValue, onSetParamDisplay, variables, renderedTemplateArguments, false, canRemove, isPredicate, renderer);
      };
      // TODO tooltip
      dialog.items.push(paramItem);
      previousParamNames.push(param.name);
      paramIndex++;
    }
    // TODO preview
    // TODO disable OK if required arguments are missing
    // TODO disable OK if required variables do not appear anywhere
    dialog.onOK = () => onSetDisplayItem(newDisplayItem);
    return dialog;
  }

  private renderArgumentValue(value: Fmt.Expression | undefined, type: Fmt.Expression, arrayDimensions: number, defaultValue: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, variables: RenderedVariable[], renderedVariables: Display.RenderedTemplateArguments, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): Display.RenderedExpression {
    if (arrayDimensions) {
      if (value instanceof Fmt.ArrayExpression) {
        let items: Display.RenderedExpression[] = [];
        for (let index = 0; index < value.items.length; index++) {
          let item = value.items[index];
          let onSetItem = (newValue: Fmt.Expression | undefined) => {
            if (newValue) {
              value.items[index] = newValue;
            } else {
              value.items.splice(index, 1);
            }
          };
          items.push(this.renderArgumentValue(item, type, arrayDimensions - 1, undefined, onSetItem, variables, renderedVariables, isTopLevel, true, isPredicate, renderer));
        }
        let group = items.length ? renderer.renderTemplate('Group', {'items': items}) : undefined;
        if (arrayDimensions === 1) {
          let insertButton = new Display.InsertPlaceholderExpression;
          let semanticLink = new Display.SemanticLink(insertButton, false, false);
          let onInsertItem = (newValue: Fmt.Expression | undefined) => {
            if (newValue) {
              value.items.push(newValue);
            }
          };
          this.addDisplayItemMenu(semanticLink, undefined, onInsertItem, undefined, variables, type, isTopLevel, false, isPredicate, renderer);
          insertButton.semanticLinks = [semanticLink];
          if (group) {
            return new Display.RowExpression([
              group,
              new Display.TextExpression(' '),
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
            return new Display.EmptyExpression;
          }
        }
      } else {
        return new Display.EmptyExpression;
      }
    } else {
      let valueOrDefault = value || defaultValue;
      let renderedValue = valueOrDefault ? renderer.renderDisplayExpression(valueOrDefault, renderedVariables) : new Display.EmptyExpression;
      let semanticLink = new Display.SemanticLink(renderedValue, false, false);
      let onGetDefault = () => defaultValue ? renderer.renderDisplayExpression(defaultValue, renderedVariables) : undefined;
      this.addDisplayItemMenu(semanticLink, value, onSetDisplayItem, onGetDefault(), variables, type, isTopLevel, canRemove, isPredicate, renderer);
      renderedValue.semanticLinks = [semanticLink];
      return renderedValue;
    }
  }

  private getDisplayMenuNegationRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let negationRow = new Menu.StandardExpressionMenuRow('With negation');
    negationRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getNegationDialog(displayItem, onSetDisplayItem, variables, type, isTopLevel, isPredicate, renderer));
    negationRow.selected = displayItem instanceof FmtDisplay.MetaRefExpression_neg;
    return negationRow;
  }

  private getNegationDialog(displayItem: Fmt.Expression | undefined, onSetDisplayItem: SetDisplayItemFn, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let dialog = new Dialog.ExpressionDialog;
    dialog.items = [];
    let newDisplayItem: FmtDisplay.MetaRefExpression_neg;
    if (displayItem instanceof FmtDisplay.MetaRefExpression_neg) {
      newDisplayItem = displayItem.clone() as FmtDisplay.MetaRefExpression_neg;
    } else {
      newDisplayItem = new FmtDisplay.MetaRefExpression_neg;
      newDisplayItem.items = [];
      if (displayItem) {
        newDisplayItem.items.push(displayItem);
      }
    }
    for (let index = 0; index <= 1; index++) {
      let paramItem = new Dialog.ExpressionDialogParameterItem;
      paramItem.title = index ? 'Negated' : 'Regular';
      let onSetItem = (newItem: Fmt.Expression | undefined) => {
        if (newItem) {
          if (newDisplayItem.items.length <= index) {
            do {
              newDisplayItem.items.push(newItem);
            } while (newDisplayItem.items.length <= index);
          } else {
            newDisplayItem.items[index] = newItem;
          }
        }
      };
      paramItem.onGetValue = () => {
        let regular = newDisplayItem.items.length > index ? newDisplayItem.items[index] : undefined;
        return this.renderArgumentValue(regular, type, 0, undefined, onSetItem, variables, renderedTemplateArguments, isTopLevel, false, isPredicate, renderer);
      };
      dialog.items.push(paramItem);
    }
    dialog.onOK = () => onSetDisplayItem(newDisplayItem);
    return dialog;
  }

  private getDisplayMenuAlternativesRow(display: Fmt.Expression[] | undefined, onSetDisplay: SetDisplayFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let alternativesRow = new Menu.StandardExpressionMenuRow('Multiple alternatives');
    alternativesRow.titleAction = new Menu.DialogExpressionMenuAction(() => this.getAlternativesDialog(display, onSetDisplay, variables, isTopLevel, isPredicate, renderer));
    alternativesRow.selected = display !== undefined && display.length > 1;
    return alternativesRow;
  }

  private getAlternativesDialog(display: Fmt.Expression[] | undefined, onSetDisplay: SetDisplayFn, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let dialog = new Dialog.ExpressionDialog;
    dialog.items = [];
    let newDisplay: Fmt.Expression[] = [];
    if (display) {
      newDisplay = display.slice();
    }
    let paramItem = new Dialog.ExpressionDialogParameterItem;
    paramItem.title = 'Alternatives';
    paramItem.onGetValue = () => {
      let newDisplayExpression = new Fmt.ArrayExpression;
      newDisplayExpression.items = newDisplay;
      let type = new FmtDisplay.MetaRefExpression_Expr;
      let onSetDisplayExpression = (displayExpression: Fmt.Expression) => {
        if (displayExpression instanceof Fmt.ArrayExpression) {
          onSetDisplay(displayExpression.items);
        }
      };
      return this.renderArgumentValue(newDisplayExpression, type, 1, undefined, onSetDisplayExpression, variables, renderedTemplateArguments, isTopLevel, false, isPredicate, renderer);
    };
    dialog.items.push(paramItem);
    dialog.onOK = () => onSetDisplay(newDisplay);
    return dialog;
  }

  private getRenderedTemplateArguments(variables: RenderedVariable[]): Display.RenderedTemplateArguments {
    let renderedTemplateArguments: Display.RenderedTemplateArguments = {};
    for (let variable of variables) {
      renderedTemplateArguments[variable.param.name] = variable.display;
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
        let expressionsPromise = onGetExpressions(relativePath, libraryDefinition.definition, definition);
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
          let expressionsPromise = onGetExpressions(relativePath, libraryDefinition.definition, definition);
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
      let result = onGetExpressions(path, outerDefinition, definition) || CachedPromise.resolve([]);
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
          let result = CachedPromise.resolve();
          for (let innerDefinition of definition.innerDefinitions) {
            let innerPath = new Fmt.Path;
            innerPath.name = innerDefinition.name;
            innerPath.parentPath = path;
            result = result.then(() => addAllDefinitions(innerPath, outerDefinition, innerDefinition, rows));
          }
          return result;
        }
      });
    }
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
    // TODO tooltip
    let item = new Menu.ExpressionMenuItem(onRenderExpression(expression));
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

  addVariableNameEditor(text: Display.TextExpression, param: Fmt.Parameter, parameterList?: Fmt.ParameterList) {
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

  addDefinitionRemarkEditor(markdown: Display.MarkdownExpression, definition: Fmt.Definition, allKinds: string[], kind: string): void {
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
      markdown.searchURLs = defaultReferenceSearchURLs;
      markdown.defaultSearchText = this.definition.name;
    }
  }

  addIntegerEditor(text: Display.TextExpression, expression: Fmt.Expression, negativeValuesAllowed: boolean): void {
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
