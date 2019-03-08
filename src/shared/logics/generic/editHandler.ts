import * as Fmt from '../../format/format';
import * as FmtDisplay from '../../display/meta';
import * as Display from '../../display/display';
import * as Menu from '../../display/menu';
import * as Dialog from '../../display/dialog';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';
import { GenericRenderer, RenderedVariable } from './renderer';

export class PlaceholderExpression extends Fmt.Expression {
  constructor(public placeholderType: any) {
    super();
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters?: Fmt.ReplacedParameter[]): Fmt.Expression {
    return this;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    return expression instanceof PlaceholderExpression
           && this.placeholderType === expression.placeholderType;
  }
}

export abstract class GenericEditHandler {
  static lastInsertedParameter?: Fmt.Parameter;

  constructor(protected libraryDataAccessor: LibraryDataAccessor, protected templates: Fmt.File) {
  }

  addDisplayMenu(semanticLink: Display.SemanticLink, display: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, onGetDefault: () => Display.RenderedExpression | undefined, onGetVariables: () => RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): void {
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
    semanticLink.onMenuOpened = () => {
      let defaultValue = onGetDefault();
      let variables = onGetVariables();
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];
      this.addDisplayMenuRows(menu.rows, displayItem, onSetDisplayItem, defaultValue, variables, type, !display, true, false, isPredicate, renderer);
      if (variables.length > 1) {
        menu.rows.push(
          new Menu.ExpressionMenuSeparator,
          this.getDisplayMenuAlternativesRow(display, onSetDisplay, variables, true, isPredicate, renderer)
        );
      }
      return menu;
    };
  }

  private addDisplayItemMenu(expression: Display.RenderedExpression, displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, defaultValue: Display.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    let semanticLink = new Display.SemanticLink(expression, false, false);
    semanticLink.onMenuOpened = () => {
      let isDefault = !displayItem && !canRemove;
      let menu = new Menu.ExpressionMenu;
      menu.rows = [];
      this.addDisplayMenuRows(menu.rows, displayItem, onSetDisplayItem, defaultValue, variables, type, isDefault, isTopLevel, canRemove, isPredicate, renderer);
      if (menu.rows.length === 1) {
        let row = menu.rows[0];
        if (row instanceof Menu.StandardExpressionMenuRow && row.subMenu instanceof Menu.ExpressionMenu) {
          return row.subMenu;
        }
      }
      return menu;
    };
    expression.semanticLinks = [semanticLink];
  }

  private addDisplayMenuRows(rows: Menu.ExpressionMenuRow[], displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, defaultValue: Display.RenderedExpression | undefined, variables: RenderedVariable[], type: Fmt.Expression, isDefault: boolean, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): void {
    if (defaultValue || canRemove) {
      rows.push(
        this.getDisplayMenuDefaultRow(defaultValue, onSetDisplayItem, isDefault, canRemove ? 'Remove' : 'Default'),
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

  private getDisplayMenuVariablesRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[]): Menu.ExpressionMenuRow {
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

  private getDisplayMenuTemplatesRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[], isPredicate: boolean, complexExpressionRequired: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let templatesRow = new Menu.StandardExpressionMenuRow;
    templatesRow.title = 'Template';
    let templateMenu = new Menu.ExpressionMenu;
    templateMenu.rows = [];
    for (let template of this.templates.definitions) {
      if (!complexExpressionRequired || template.parameters.length) {
        let templateRow = this.getDisplayMenuTemplateRow(template, displayItem, onSetDisplayItem, variables, isPredicate, renderer);
        templateMenu.rows.push(templateRow);
        if (templateRow.selected) {
          templatesRow.selected = true;
        }
      }
    }
    templatesRow.subMenu = templateMenu;
    return templatesRow;
  }

  private getDisplayMenuTemplateRow(template: Fmt.Definition, displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let templateRow = new Menu.StandardExpressionMenuRow;
    let title = new Display.TextExpression(template.name);
    title.styleClasses = ['source-code'];
    templateRow.title = title;
    if (template.parameters.length) {
      let templateAction = new Menu.DialogExpressionMenuAction;
      templateAction.onOpen = () => this.getTemplateDialog(template, displayItem, onSetDisplayItem, variables, isPredicate, renderer);
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

  private getTemplateDialog(template: Fmt.Definition, displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[], isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
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
        return this.renderArgumentValue(value, param.type.expression, param.type.arrayDimensions, param.defaultValue, onSetParamDisplay, variables, renderedTemplateArguments, false, param.optional, isPredicate, renderer);
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

  private renderArgumentValue(value: Fmt.Expression | undefined, type: Fmt.Expression, arrayDimensions: number, defaultValue: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[], renderedVariables: Display.RenderedTemplateArguments, isTopLevel: boolean, canRemove: boolean, isPredicate: boolean, renderer: GenericRenderer): Display.RenderedExpression {
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
          let onInsertItem = (newValue: Fmt.Expression | undefined) => {
            if (newValue) {
              value.items.push(newValue);
            }
          };
          this.addDisplayItemMenu(insertButton, undefined, onInsertItem, undefined, variables, type, isTopLevel, false, isPredicate, renderer);
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
      this.addDisplayItemMenu(renderedValue, value, onSetDisplayItem, onGetDefault(), variables, type, isTopLevel, canRemove, isPredicate, renderer);
      return renderedValue;
    }
  }

  private getDisplayMenuNegationRow(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let negationRow = new Menu.StandardExpressionMenuRow;
    negationRow.title = 'With negation';
    let negationAction = new Menu.DialogExpressionMenuAction;
    negationAction.onOpen = () => this.getNegationDialog(displayItem, onSetDisplayItem, variables, type, isTopLevel, isPredicate, renderer);
    negationRow.titleAction = negationAction;
    negationRow.selected = displayItem instanceof FmtDisplay.MetaRefExpression_neg;
    return negationRow;
  }

  private getNegationDialog(displayItem: Fmt.Expression | undefined, onSetDisplayItem: (displayItem: Fmt.Expression | undefined) => void, variables: RenderedVariable[], type: Fmt.Expression, isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
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

  private getDisplayMenuAlternativesRow(display: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Menu.ExpressionMenuRow {
    let alternativesRow = new Menu.StandardExpressionMenuRow;
    alternativesRow.title = 'Multiple alternatives';
    let alternativesAction = new Menu.DialogExpressionMenuAction;
    alternativesAction.onOpen = () => this.getAlternativesDialog(display, onSetDisplay, variables, isTopLevel, isPredicate, renderer);
    alternativesRow.titleAction = alternativesAction;
    alternativesRow.selected = display instanceof Fmt.ArrayExpression && display.items.length > 1;
    return alternativesRow;
  }

  private getAlternativesDialog(display: Fmt.Expression | undefined, onSetDisplay: (display: Fmt.Expression | undefined) => void, variables: RenderedVariable[], isTopLevel: boolean, isPredicate: boolean, renderer: GenericRenderer): Dialog.ExpressionDialog {
    let renderedTemplateArguments = this.getRenderedTemplateArguments(variables);
    let dialog = new Dialog.ExpressionDialog;
    dialog.items = [];
    let newDisplay: Fmt.ArrayExpression;
    if (display instanceof Fmt.ArrayExpression) {
      newDisplay = display.clone() as Fmt.ArrayExpression;
    } else {
      newDisplay = new Fmt.ArrayExpression;
      newDisplay.items = [];
    }
    let paramItem = new Dialog.ExpressionDialogParameterItem;
    paramItem.title = 'Alternatives';
    paramItem.onGetValue = () => {
      let type = new FmtDisplay.MetaRefExpression_Expr;
      return this.renderArgumentValue(newDisplay, type, 1, undefined, onSetDisplay, variables, renderedTemplateArguments, isTopLevel, false, isPredicate, renderer);
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

  addVariableNameEditor(text: Display.TextExpression, param: Fmt.Parameter) {
    text.onTextChanged = (newText: string) => param.name = newText;
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
  }
}
