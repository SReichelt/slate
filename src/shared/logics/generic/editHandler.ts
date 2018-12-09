import * as Fmt from '../../format/format';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';

export abstract class GenericEditHandler {
  constructor(protected libraryDataAccessor: LibraryDataAccessor, protected templates: Fmt.File) {
  }

  addDisplayMenu(expression: Display.RenderedExpression, onSetDisplay: (display: Fmt.ArrayExpression | undefined) => void): void {
    expression.onMenuOpened = () => {
      let menu = new Menu.ExpressionMenu;
      let defaultAction = new Menu.ImmediateExpressionMenuAction;
      defaultAction.onExecute = () => onSetDisplay(undefined);
      let defaultItem = new Menu.ExpressionMenuItem;
      defaultItem.expression = new Display.TextExpression('Default');
      defaultItem.action = defaultAction;
      menu.rows = [
        defaultItem,
        new Menu.ExpressionMenuSeparator
      ];
      // TODO
      if (true) {
        let textAction = new Menu.ImmediateExpressionMenuAction;
        textAction.onExecute = () => {};
        let textItem = new Menu.ExpressionMenuItem;
        textItem.expression = new Display.TextExpression('Symbol/Text');
        textItem.action = textAction;
        menu.rows.push(
          textItem,
          new Menu.ExpressionMenuSeparator
        );
      }
      for (let template of this.templates.definitions) {
        let templateAction = new Menu.ImmediateExpressionMenuAction;
        templateAction.onExecute = () => {};
        let item = new Menu.ExpressionMenuItem;
        item.expression = new Display.TextExpression(template.name);
        item.action = templateAction;
        menu.rows.push(item);
      }
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
