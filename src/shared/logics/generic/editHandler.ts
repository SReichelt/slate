import * as Fmt from '../../format/format';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import * as Dialog from '../../display/dialog';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import { GenericRenderer, RenderedVariable } from './renderer';

export abstract class GenericEditHandler {
  constructor(protected libraryDataAccessor: LibraryDataAccessor, protected templates: Fmt.File) {
  }

  addDisplayMenu(expression: Display.RenderedExpression, display: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, onGetDefault: () => Display.RenderedExpression, onGetVariables: () => RenderedVariable[], renderer: GenericRenderer): void {
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
    let isDefault = (display === undefined);
    this.addGenericDisplayMenu(expression, displayItem, onSetDisplayItem, onGetDefault, onGetVariables, isDefault, renderer);
  }

  private addGenericDisplayMenu(expression: Display.RenderedExpression, displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, onGetDefault: () => Display.RenderedExpression, onGetVariables: () => RenderedVariable[], isDefault: boolean, renderer: GenericRenderer): void {
    expression.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [
        this.getDisplayMenuDefaultRow(onGetDefault(), onSetDisplayItem, isDefault)
      ];
      let variables = onGetVariables();
      // TODO condition
      if (true) {
        menu.rows.push(
          new Menu.ExpressionMenuSeparator,
          this.getDisplayMenuTextRow(displayItem, onSetDisplayItem)
        );
        // TODO condition
        if (variables.length) {
          menu.rows.push(
            this.getDisplayMenuVariablesRow(variables, displayItem, onSetDisplayItem)
          );
        }
      }
      if (this.templates.definitions.length) {
        menu.rows.push(
          new Menu.ExpressionMenuSeparator
        );
        for (let template of this.templates.definitions) {
          menu.rows.push(
            this.getDisplayMenuTemplateRow(template, variables, displayItem, onSetDisplayItem, renderer)
          );
        }
      }
      // TODO multiple alternatives
      return menu;
    };
  }

  private getDisplayMenuDefaultRow(renderedDefault: Display.RenderedExpression, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, isDefault: boolean): Menu.ExpressionMenuRow {
    let defaultAction = new Menu.ImmediateExpressionMenuAction;
    defaultAction.onExecute = () => onSetDisplayItem(undefined);
    let defaultItem = new Menu.ExpressionMenuItem;
    defaultItem.expression = renderedDefault;
    defaultItem.action = defaultAction;
    let defaultRow = new Menu.StandardExpressionMenuRow;
    defaultRow.title = 'Default';
    defaultRow.subMenu = defaultItem;
    if (isDefault) {
      defaultItem.selected = true;
      defaultRow.selected = true;
    }
    return defaultRow;
  }

  private getDisplayMenuTextRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void): Menu.ExpressionMenuRow {
    let textItem = new Menu.ExpressionMenuTextInput;
    let textRow = new Menu.StandardExpressionMenuRow;
    textRow.title = 'Symbol/Text';
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
    let variablesGroup = new Menu.ExpressionMenuItemList;
    let variablesRow = new Menu.StandardExpressionMenuRow;
    variablesRow.title = 'Variable';
    variablesRow.subMenu = variablesGroup;
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
    return variablesRow;
  }

  private getDisplayMenuTemplateRow(template: Fmt.Definition, variables: RenderedVariable[], displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let templateAction = new Menu.DialogExpressionMenuAction;
    templateAction.onOpen = () => {
      let renderedVariables: Display.RenderedTemplateArguments = {};
      for (let variable of variables) {
        renderedVariables[variable.param.name] = variable.display;
      }
      let dialog = new Dialog.ExpressionDialog;
      dialog.items = [];
      let newDisplayItem: Fmt.DefinitionRefExpression;
      if (displayItem instanceof Fmt.DefinitionRefExpression && !displayItem.path.parentPath && displayItem.path.name === template.name) {
        newDisplayItem = displayItem.clone() as Fmt.DefinitionRefExpression;
      } else {
        let newPath = new Fmt.Path;
        newPath.name = template.name;
        newDisplayItem = new Fmt.DefinitionRefExpression;
        newDisplayItem.path = newPath;
      }
      let paramIndex = 0;
      for (let param of template.parameters) {
        let paramItem = new Dialog.ExpressionDialogParameterItem;
        paramItem.parameter = new Display.TextExpression(param.name);
        paramItem.parameter.styleClasses = ['source-code'];
        let value = newDisplayItem.path.arguments.getOptionalValue(param.name, paramIndex);
        let isDefault = false;
        if (!value) {
          value = param.defaultValue;
          isDefault = true;
        }
        paramItem.value = this.renderDisplayExpression(value, renderedVariables, renderer);
        let onSetParamDisplay = (paramDisplay: Fmt.Expression | undefined) => {
          let args = newDisplayItem.path.arguments;
          // TODO
        };
        let onGetParamDefault = () => this.renderDisplayExpression(param.defaultValue, renderedVariables, renderer);
        this.addGenericDisplayMenu(paramItem.value, value, onSetParamDisplay, onGetParamDefault, () => variables, isDefault, renderer);
        dialog.items.push(paramItem);
        paramIndex++;
      }
      dialog.onOK = () => onSetDisplayItem(newDisplayItem);
      return dialog;
    };
    let templateRow = new Menu.StandardExpressionMenuRow;
    let title = new Display.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    templateRow.title = title;
    if (displayItem instanceof Fmt.DefinitionRefExpression && displayItem.path.name === template.name) {
      templateRow.selected = true;
    }
    templateRow.titleAction = templateAction;
    return templateRow;
  }

  private renderDisplayExpression(value: Fmt.Expression | undefined, renderedVariables: Display.RenderedTemplateArguments, renderer: GenericRenderer): Display.RenderedExpression {
    if (value) {
      if (value instanceof Fmt.ArrayExpression) {
        let items = value.items.map((item: Fmt.Expression) => this.renderDisplayExpression(item, renderedVariables, renderer));
        return renderer.renderTemplate('Group', {'items': items});
      } else {
        return renderer.renderDisplayExpression(value, renderedVariables);
      }
    } else {
      return new Display.EmptyExpression;
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
