import * as Fmt from '../../format/format';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';

export abstract class GenericEditHandler {
  constructor(protected libraryDataAccessor: LibraryDataAccessor, protected templates: Fmt.File) {
  }

  addDisplayMenu(expression: Display.RenderedExpression, display: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, onGetDefault: () => Display.RenderedExpression): void {
    let displayItem = display instanceof Fmt.ArrayExpression && display.items.length === 1 ? display.items[0] : undefined;
    expression.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      let defaultAction = new Menu.ImmediateExpressionMenuAction;
      defaultAction.onExecute = () => onSetDisplay(undefined);
      let defaultItem = new Menu.ExpressionMenuItem;
      defaultItem.expression = onGetDefault();
      defaultItem.action = defaultAction;
      let defaultRow = new Menu.StandardExpressionMenuRow;
      defaultRow.title = 'Default';
      defaultRow.subMenu = defaultItem;
      if (!display) {
        defaultItem.selected = true;
        defaultRow.selected = true;
      }
      menu.rows = [
        defaultRow,
        new Menu.ExpressionMenuSeparator
      ];
      // TODO condition
      if (true) {
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
        menu.rows.push(
          textRow,
          new Menu.ExpressionMenuSeparator
        );
      }
      for (let template of this.templates.definitions) {
        let templateRow = new Menu.StandardExpressionMenuRow;
        templateRow.title = template.name + '...';
        if (displayItem instanceof Fmt.DefinitionRefExpression && displayItem.path.name === template.name) {
          templateRow.selected = true;
        }
        menu.rows.push(templateRow);
      }
      // TODO multiple alternatives
      return menu;
    };
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
