import * as Fmt from '../format/format';
import * as FmtWriter from '../format/write';
import * as Notation from './notation';
import { useItalicsForVariable } from './unicode';
import * as Logic from '../logics/logic';

interface StackItem {
  range?: Notation.RowExpression;
  object?: Object;
  isMathematical: boolean;
}

export class SourceCodeStream implements FmtWriter.OutputStream {
  private stack: StackItem[];
  result: Notation.RenderedExpression;

  constructor(private renderer?: Logic.LogicRenderer) {
    let root = new Notation.RowExpression([]);
    root.styleClasses = ['source-code'];
    this.stack = [{
      range: root,
      isMathematical: true
    }];
    this.result = root;
  }

  private addExpression(expression: Notation.RenderedExpression): void {
    let back = this.stack[this.stack.length - 1];
    if (back.range) {
      if (back.object instanceof Fmt.Argument && !expression.styleClasses) {
        expression.styleClasses = ['arg'];
      }
      back.range.items.push(expression);
    }
  }

  write(str: string): void {
    this.addExpression(new Notation.TextExpression(str));
  }

  error(message: string): void {
    this.addExpression(new Notation.ErrorExpression(message));
  }

  startRange(object: Object, name: boolean, link: boolean, tag: boolean, signature: boolean): void {
    let back = this.stack[this.stack.length - 1];
    if (back.range) {
      if (object instanceof Fmt.PlaceholderExpression) {
        let placeholder = new Notation.PlaceholderExpression(object.placeholderType);
        let semanticLink = new Notation.SemanticLink(object, false, back.isMathematical);
        if (this.renderer) {
          this.renderer.addPlaceholderMenu(object, semanticLink);
        }
        placeholder.semanticLinks = [semanticLink];
        back.range.items.push(placeholder);
        this.stack.push({
          isMathematical: false
        });
      } else {
        let isMathematical = back.isMathematical;
        if (object instanceof Fmt.Argument && object.name === 'notation') {
          isMathematical = false;
        }
        let range = new Notation.RowExpression([]);
        range.styleClasses = ['source-code'];
        if (((object instanceof Fmt.Expression || object instanceof Fmt.Argument || object instanceof Fmt.DocumentationComment || object instanceof Fmt.DocumentationItem)
             && !link && !tag && !signature)
            || (object instanceof Fmt.Definition && signature)) {
          range.semanticLinks = [new Notation.SemanticLink(object, signature, isMathematical)];
        }
        if (object instanceof Fmt.MetaRefExpression && tag) {
          range.styleClasses.push('meta-ref');
        } else if (object instanceof Fmt.VariableRefExpression && name) {
          range.styleClasses.push('var');
          if (useItalicsForVariable(object.variable.name)) {
            range.styleClasses.push('italic');
          }
          range.semanticLinks = [new Notation.SemanticLink(object.variable)];
        } else if (object instanceof Fmt.Parameter && name) {
          range.styleClasses.push('var');
          if (useItalicsForVariable(object.name)) {
            range.styleClasses.push('italic');
          }
          range.semanticLinks = [new Notation.SemanticLink(object, true)];
        } else if (object instanceof Fmt.Argument && name) {
          range.styleClasses.push('arg');
          range.styleClasses.push('var');
          if (object.name && useItalicsForVariable(object.name)) {
            range.styleClasses.push('italic');
          }
        } else if (object instanceof Fmt.DocumentationComment) {
          range.styleClasses.push('comment');
        } else if (object instanceof Fmt.DocumentationItem && tag) {
          range.styleClasses.push('keyword');
        } else if (object instanceof Fmt.StringExpression) {
          range.styleClasses.push('string');
        } else if (object instanceof Fmt.IntegerExpression) {
          range.styleClasses.push('number');
        }
        back.range.items.push(range);
        this.stack.push({
          range: range,
          object: object,
          isMathematical: isMathematical
        });
      }
    } else {
      this.stack.push({
        isMathematical: false
      });
    }
  }

  endRange(): void {
    this.stack.pop();
  }
}
