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
    expression.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      menu.rows = [
        this.getDisplayMenuDefaultRow(onGetDefault(), onSetDisplay, display === undefined),
        new Menu.ExpressionMenuSeparator
      ];
      // TODO condition
      if (true) {
        menu.rows.push(
          this.getDisplayMenuTextRow(displayItem, onSetDisplay),
          new Menu.ExpressionMenuSeparator
        );
      }
      // TODO variables
      let variables = onGetVariables();
      for (let template of this.templates.definitions) {
        menu.rows.push(
          this.getDisplayMenuTemplateRow(template, variables, displayItem, onSetDisplay, renderer)
        );
      }
      // TODO multiple alternatives
      return menu;
    };
  }

  private getDisplayMenuDefaultRow(renderedDefault: Display.RenderedExpression, onSetDisplay: (display: Fmt.Expression | undefined) => void, selected: boolean): Menu.ExpressionMenuRow {
    let defaultAction = new Menu.ImmediateExpressionMenuAction;
    defaultAction.onExecute = () => onSetDisplay(undefined);
    let defaultItem = new Menu.ExpressionMenuItem;
    defaultItem.expression = renderedDefault;
    defaultItem.action = defaultAction;
    let defaultRow = new Menu.StandardExpressionMenuRow;
    defaultRow.title = 'Default';
    defaultRow.subMenu = defaultItem;
    if (selected) {
      defaultItem.selected = true;
      defaultRow.selected = true;
    }
    return defaultRow;
  }

  private getDisplayMenuTextRow(displayItem: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void): Menu.ExpressionMenuRow {
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
      let newDisplay = new Fmt.ArrayExpression;
      let newText = new Fmt.StringExpression;
      newText.value = textItem.text;
      newDisplay.items = [newText];
      onSetDisplay(newDisplay);
    };
    textItem.action = textAction;
    return textRow;
  }

  private getDisplayMenuTemplateRow(template: Fmt.Definition, variables: RenderedVariable[], displayItem: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let templateAction = new Menu.DialogExpressionMenuAction;
    templateAction.onOpen = () => {
      let args: Display.RenderedTemplateArguments = {};
      for (let variable of variables) {
        args[variable.name] = variable.display;
      }
      let dialog = new Dialog.ExpressionDialog;
      dialog.items = [];
      let paramIndex = 0;
      for (let param of template.parameters) {
        let paramItem = new Dialog.ExpressionDialogParameterItem;
        paramItem.parameter = new Display.TextExpression(param.name);
        paramItem.parameter.styleClasses = ['source-code'];
        let value: Fmt.Expression | undefined = undefined;
        if (displayItem instanceof Fmt.DefinitionRefExpression && displayItem.path.name === template.name) {
          value = displayItem.path.arguments.getOptionalValue(param.name, paramIndex);
        } else if (param.defaultValue) {
          value = param.defaultValue;
        }
        paramItem.value = value ? renderer.renderDisplayExpression(value, args) : new Display.EmptyExpression;
        dialog.items.push(paramItem);
        paramIndex++;
      }
      // TODO
      dialog.onOK = () => {};
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
