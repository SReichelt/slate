import * as Fmt from '../format/format';
import * as FmtWriter from '../format/write';
import * as Display from './display';

export class SourceCodeStream implements FmtWriter.OutputStream {
  private expressionStack: Display.RowExpression[];
  result: Display.RenderedExpression;

  constructor() {
    let root = new Display.RowExpression([]);
    root.styleClasses = ['source-code'];
    this.expressionStack = [root];
    this.result = root;
  }

  write(str: string): void {
    let text = new Display.TextExpression(str);
    this.expressionStack[this.expressionStack.length - 1].items.push(text);
  }

  startRange(object: Object, name: boolean, link: boolean, tag: boolean, signature: boolean): void {
    let range = new Display.RowExpression([]);
    range.styleClasses = ['source-code'];
    if (((object instanceof Fmt.Expression || object instanceof Fmt.Definition || object instanceof Fmt.Argument || object instanceof Fmt.DocumentationComment) && !tag && !link && !tag && !signature) || (object instanceof Fmt.DocumentationItem && tag)) {
      // TODO mark semantic link as non-mathematical inside "display" and "definitionDisplay" arguments
      range.semanticLinks = [new Display.SemanticLink(object)];
    }
    if (object instanceof Fmt.MetaRefExpression && tag) {
      range.styleClasses.push('meta-ref');
    } else if (object instanceof Fmt.VariableRefExpression && name) {
      range.styleClasses.push('var');
      range.semanticLinks = [new Display.SemanticLink(object.variable)];
    } else if (object instanceof Fmt.Parameter && name) {
      range.styleClasses.push('var');
      range.semanticLinks = [new Display.SemanticLink(object, true)];
    } else if (object instanceof Fmt.Argument && name) {
      range.styleClasses.push('arg');
      range.styleClasses.push('var');
    } else if (object instanceof Fmt.DocumentationComment) {
      range.styleClasses.push('comment');
    } else if (object instanceof Fmt.DocumentationItem && tag) {
      range.styleClasses.push('keyword');
    } else if (object instanceof Fmt.StringExpression) {
      range.styleClasses.push('string');
    }
    this.expressionStack[this.expressionStack.length - 1].items.push(range);
    this.expressionStack.push(range);
  }

  endRange(): void {
    this.expressionStack.pop();
  }
}
