import * as Fmt from '../../format/format';
import * as FmtDisplay from '../../display/meta';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import * as Dialog from '../../display/dialog';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import { GenericRenderer, RenderedVariable } from './renderer';

export abstract class GenericEditHandler {
  constructor(protected libraryDataAccessor: LibraryDataAccessor, protected templates: Fmt.File) {
  }

  addDisplayMenu(semanticLink: Display.SemanticLink, display: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, onGetDefault: () => Display.RenderedExpression | undefined, onGetVariables: () => RenderedVariable[], renderer: GenericRenderer): void {
    let displayItem = display instanceof Fmt.ArrayExpression && display.items.length === 1 ? display.items[0] : undefined;
    let onSetDisplayItem = (newDisplayItem: Fmt.Expression | undefined) => {
      if (newDisplayItem) {
        let newDisplay = new Fmt.ArrayExpression;
        newDisplay.items = [newDisplayItem];
        onSetDisplay(newDisplay);
      } else {
        onSetDisplay(undefined);
      }
    };
    let type = new FmtDisplay.MetaRefExpression_Expr;
    semanticLink.onMenuOpened = () => this.getDisplayMenu(displayItem, onSetDisplayItem, onGetDefault(), onGetVariables(), type, !display, true, false, renderer);
  }

  private getDisplayMenu(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, defaultValue: Display.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isDefault: boolean, isTopLevel: boolean, canRemove: boolean, renderer: GenericRenderer): Menu.ExpressionMenu {
    let menu = new Menu.ExpressionMenu;
    menu.rows = [];
    if (defaultValue || canRemove) {
      menu.rows.push(
        this.getDisplayMenuDefaultRow(defaultValue, onSetDisplayItem, isDefault, canRemove ? 'Remove' : 'Default'),
        new Menu.ExpressionMenuSeparator
      );
    }
    let complexExpressionRequired = isTopLevel && variables.some((variable) => variable.required);
    if (type instanceof FmtDisplay.MetaRefExpression_Expr) {
      if (!complexExpressionRequired) {
        menu.rows.push(this.getDisplayMenuTextRow(displayItem, onSetDisplayItem));
        if (variables.length && !isTopLevel) {
          menu.rows.push(this.getDisplayMenuVariablesRow(variables, displayItem, onSetDisplayItem));
        }
      }
      menu.rows.push(this.getDisplayMenuTemplatesRow(complexExpressionRequired, variables, displayItem, onSetDisplayItem, renderer));
      // TODO multiple alternatives
    } else if (type instanceof FmtDisplay.MetaRefExpression_Bool) {
      menu.rows.push(this.getDisplayMenuFalseRow(displayItem, onSetDisplayItem));
      menu.rows.push(this.getDisplayMenuTrueRow(displayItem, onSetDisplayItem));
    } else if (type instanceof FmtDisplay.MetaRefExpression_Int) {
      menu.rows.push(this.getDisplayMenuIntegerRow(displayItem, onSetDisplayItem));
    } else if (type instanceof FmtDisplay.MetaRefExpression_String) {
      menu.rows.push(this.getDisplayMenuTextRow(displayItem, onSetDisplayItem, 'String'));
    }
    // TODO negations
    return menu;
  }

  private getDisplayMenuDefaultRow(renderedDefault: Display.RenderedExpression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, isDefault: boolean, title: string = 'Default'): Menu.ExpressionMenuRow {
    let defaultAction = new Menu.ImmediateExpressionMenuAction;
    defaultAction.onExecute = () => onSetDisplayItem(undefined);
    let defaultRow = new Menu.StandardExpressionMenuRow;
    defaultRow.title = title;
    if (renderedDefault) {
      let defaultItem = new Menu.ExpressionMenuItem;
      defaultItem.expression = renderedDefault;
      defaultItem.action = defaultAction;
      defaultItem.selected = isDefault;
      defaultRow.subMenu = defaultItem;
    } else {
      defaultRow.titleAction = defaultAction;
    }
    defaultRow.selected = isDefault;
    return defaultRow;
  }

  private getDisplayMenuFalseRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void): Menu.ExpressionMenuRow {
    let falseRow = new Menu.StandardExpressionMenuRow;
    falseRow.title = 'False';
    let falseAction = new Menu.ImmediateExpressionMenuAction;
    falseAction.onExecute = () => onSetDisplayItem(new FmtDisplay.MetaRefExpression_false);
    falseRow.titleAction = falseAction;
    falseRow.selected = displayItem instanceof FmtDisplay.MetaRefExpression_false;
    return falseRow;
  }

  private getDisplayMenuTrueRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void): Menu.ExpressionMenuRow {
    let trueRow = new Menu.StandardExpressionMenuRow;
    trueRow.title = 'True';
    let trueAction = new Menu.ImmediateExpressionMenuAction;
    trueAction.onExecute = () => onSetDisplayItem(new FmtDisplay.MetaRefExpression_true);
    trueRow.titleAction = trueAction;
    trueRow.selected = displayItem instanceof FmtDisplay.MetaRefExpression_true;
    return trueRow;
  }

  private getDisplayMenuIntegerRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void): Menu.ExpressionMenuRow {
    let integerItem = new Menu.ExpressionMenuTextInput;
    let integerRow = new Menu.StandardExpressionMenuRow;
    integerRow.title = 'Number';
    integerRow.subMenu = integerItem;
    if (displayItem instanceof Fmt.IntegerExpression) {
      integerItem.selected = true;
      integerRow.selected = true;
      integerItem.text = displayItem.value.toString();
    } else {
      integerItem.text = '';
    }
    let integerAction = new Menu.ImmediateExpressionMenuAction;
    integerAction.onExecute = () => {
      let newDisplayItem = new Fmt.IntegerExpression;
      newDisplayItem.value = new Fmt.BN(integerItem.text, 10);
      onSetDisplayItem(newDisplayItem);
    };
    integerItem.action = integerAction;
    return integerRow;
  }

  private getDisplayMenuTextRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, title: string = 'Symbol/Text'): Menu.ExpressionMenuRow {
    let textItem = new Menu.ExpressionMenuTextInput;
    let textRow = new Menu.StandardExpressionMenuRow;
    textRow.title = title;
    textRow.subMenu = textItem;
    if (displayItem instanceof Fmt.StringExpression) {
      textItem.selected = true;
      textRow.selected = true;
      textItem.text = displayItem.value;
    } else {
      textItem.text = '';
    }
    let textAction = new Menu.ImmediateExpressionMenuAction;
    textAction.onExecute = () => {
      let newDisplayItem = new Fmt.StringExpression;
      newDisplayItem.value = textItem.text;
      onSetDisplayItem(newDisplayItem);
    };
    textItem.action = textAction;
    return textRow;
  }

  private getDisplayMenuVariablesRow(variables: RenderedVariable[], displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void): Menu.ExpressionMenuRow {
    let variablesRow = new Menu.StandardExpressionMenuRow;
    variablesRow.title = 'Variable';
    let variablesGroup = new Menu.ExpressionMenuItemList;
    variablesGroup.items = [];
    for (let variable of variables) {
      let variableItem = new Menu.ExpressionMenuItem;
      variableItem.expression = variable.display;
      if (displayItem instanceof Fmt.VariableRefExpression && displayItem.variable === variable.param) {
        variableItem.selected = true;
        variablesRow.selected = true;
      }
      let variableAction = new Menu.ImmediateExpressionMenuAction;
      variableAction.onExecute = () => {
        let newDisplayItem = new Fmt.VariableRefExpression;
        newDisplayItem.variable = variable.param;
        onSetDisplayItem(newDisplayItem);
      };
      variableItem.action = variableAction;
      variablesGroup.items.push(variableItem);
    }
    variablesRow.subMenu = variablesGroup;
    return variablesRow;
  }

  private getDisplayMenuTemplatesRow(complexExpressionRequired: boolean, variables: RenderedVariable[], displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let templatesRow = new Menu.StandardExpressionMenuRow;
    templatesRow.title = 'Template';
    let templateMenu = new Menu.ExpressionMenu;
    templateMenu.rows = [];
    for (let template of this.templates.definitions) {
      if (!complexExpressionRequired || template.parameters.length) {
        let templateRow = this.getDisplayMenuTemplateRow(template, variables, displayItem, onSetDisplayItem, renderer);
        templateMenu.rows.push(templateRow);
        if (templateRow.selected) {
          templatesRow.selected = true;
        }
      }
    }
    templatesRow.subMenu = templateMenu;
    return templatesRow;
  }

  private getDisplayMenuTemplateRow(template: Fmt.Definition, variables: RenderedVariable[], displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let templateRow = new Menu.StandardExpressionMenuRow;
    let title = new Display.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    templateRow.title = title;
    if (template.parameters.length) {
      let templateAction = new Menu.DialogExpressionMenuAction;
      templateAction.onOpen = () => this.getTemplateDialog(template, variables, displayItem, onSetDisplayItem, renderer);
      templateRow.titleAction = templateAction;
    } else {
      let templateAction = new Menu.ImmediateExpressionMenuAction;
      templateAction.onExecute = () => {
        let newPath = new Fmt.Path;
        newPath.name = template.name;
        let newDisplayItem = new Fmt.DefinitionRefExpression;
        newDisplayItem.path = newPath;
        onSetDisplayItem(newDisplayItem);
      };
      templateRow.titleAction = templateAction;
    }
    templateRow.selected = displayItem instanceof Fmt.DefinitionRefExpression && displayItem.path.name === template.name;
    return templateRow;
  }

  private getTemplateDialog(template: Fmt.Definition, variables: RenderedVariable[], displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedVariables: Display.RenderedTemplateArguments = {};
    for (let variable of variables) {
      renderedVariables[variable.param.name] = variable.display;
    }
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
      paramItem.parameter = new Display.TextExpression(param.name);
      paramItem.parameter.styleClasses = ['source-code'];
      let localPreviousParamNames = previousParamNames.slice();
      paramItem.onGetValue = () => {
        let value = newDisplayItem.path.arguments.getOptionalValue(param.name, paramIndex);
        let onSetParamDisplay = (newValue: Fmt.Expression | undefined) => {
          newDisplayItem.path.arguments.setValue(newValue, param.name, paramIndex, localPreviousParamNames);
        };
        return this.renderArgumentValue(value, param.type.expression, param.type.arrayDimensions, param.defaultValue, onSetParamDisplay, variables, renderedVariables, false, renderer);
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

  private renderArgumentValue(value: Fmt.Expression | undefined, type: Fmt.Expression, arrayDimensions: number, defaultValue: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[], renderedVariables: Display.RenderedTemplateArguments, canRemove: boolean, renderer: GenericRenderer): Display.RenderedExpression {
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
          items.push(this.renderArgumentValue(item, type, arrayDimensions - 1, undefined, onSetItem, variables, renderedVariables, true, renderer));
        }
        let group = items.length ? renderer.renderTemplate('Group', {'items': items}) : undefined;
        if (arrayDimensions === 1) {
          let insertButton = new Display.InsertPlaceholderExpression;
          let onInsertItem = (newValue: Fmt.Expression | undefined) => {
            if (newValue) {
              value.items.push(newValue);
            }
          };
          let semanticLink = new Display.SemanticLink(insertButton, false, false);
          semanticLink.onMenuOpened = () => this.getDisplayMenu(undefined, onInsertItem, undefined, variables, type, false, false, false, renderer);
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
      let onGetDefault = () => defaultValue ? renderer.renderDisplayExpression(defaultValue, renderedVariables) : undefined;
      let semanticLink = new Display.SemanticLink(renderedValue, false, false);
      semanticLink.onMenuOpened = () => this.getDisplayMenu(value, onSetDisplayItem, onGetDefault(), variables, type, !value, false, canRemove, renderer);
      renderedValue.semanticLinks = [semanticLink];
      return renderedValue;
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
  }
}
