import * as Fmt from './format';
import { isSpecialCharacter, isNumericalCharacter } from './common';

export interface OutputStream {
  write(str: string): void;
}

export class StringOutputStream implements OutputStream {
  str: string = '';

  write(str: string): void {
    this.str += str;
  }
}


interface IndentInfo {
  indent: string;
  outerIndent: string;
}

export class Writer {
  private lineLength = 0;

  constructor(private stream: OutputStream) {}

  writeFile(file: Fmt.File): void {
    let indentInfo: IndentInfo = {
      indent: '',
      outerIndent: ''
    };
    this.write('%');
    this.writePath(file.metaModelPath, indentInfo);
    this.write('%');
    this.writeNewLine();
    if (file.definitions.length) {
      this.writeNewLine();
      this.writeDefinitions(file.definitions, indentInfo);
    }
  }

  writePath(path: Fmt.Path, indent: IndentInfo): void {
    let argumentListIndent = indent;
    let lastArgumentListIndent = indent;
    if (path.parentPath instanceof Fmt.Path) {
      argumentListIndent = this.indent(indent);
      lastArgumentListIndent = this.indent(indent, true);
    }
    this.writeFullPath(path, argumentListIndent, lastArgumentListIndent);
  }

  private writeFullPath(path: Fmt.Path, argumentListIndent: IndentInfo, lastArgumentListIndent: IndentInfo): void {
    if (path.parentPath) {
      if (path.parentPath instanceof Fmt.Path) {
        this.writeFullPath(path.parentPath, argumentListIndent, argumentListIndent);
        this.write('.');
      } else {
        this.writePathItem(path.parentPath);
        this.write('/');
      }
    }
    this.writeIdentifier(path.name);
    this.writeOptionalArgumentList(path.arguments, lastArgumentListIndent, true);
  }

  private writePathItem(path: Fmt.PathItem): void {
    if (path.parentPath) {
      this.writePathItem(path.parentPath);
      this.write('/');
    }
    if (path instanceof Fmt.IdentityPathItem) {
      this.write('.');
    } else if (path instanceof Fmt.ParentPathItem) {
      this.write('..');
    } else if (path instanceof Fmt.NamedPathItem) {
      this.writeIdentifier(path.name);
    } else {
      throw new Error('Unsupported path item type');
    }
  }

  writeDefinitions(definitions: Fmt.Definition[], indent: IndentInfo): void {
    let first = true;
    for (let definition of definitions) {
      if (first) {
        first = false;
      } else {
        this.writeNewLine();
      }
      this.writeIndent(indent);
      this.writeDefinition(definition, indent);
    }
  }

  writeDefinition(definition: Fmt.Definition, indent: IndentInfo): void {
    if (definition.documentation) {
      this.writeDocumentationComment(definition.documentation, indent);
    }
    this.write('$');
    this.writeIdentifier(definition.name);
    this.writeOptionalParameterList(definition.parameters, indent, true);
    this.writeType(definition.type, indent);
    this.write(' {');
    let args: Fmt.ArgumentList | undefined = undefined;
    if (definition.contents) {
      args = Object.create(Fmt.ArgumentList.prototype);
      definition.contents.toArgumentList(args!);
    }
    if (definition.innerDefinitions.length || (args && args.length)) {
      this.writeNewLine();
      let innerIndent = this.indent(indent);
      this.writeDefinitions(definition.innerDefinitions, innerIndent);
      if (args && args.length) {
        if (definition.innerDefinitions.length) {
          this.writeNewLine();
        }
        this.writeArguments(args, innerIndent, true, true);
      }
      this.writeIndent(indent);
    }
    this.write('}');
    this.writeNewLine();
  }

  writeParameterList(parameters: Fmt.ParameterList, indent: IndentInfo, multiLine: boolean): void {
    this.write('(');
    this.writeParameters(parameters, indent, multiLine);
    this.write(')');
  }

  writeOptionalParameterList(parameters: Fmt.ParameterList, indent: IndentInfo, multiLine: boolean): void {
    if (parameters.length) {
      this.writeParameterList(parameters, indent, multiLine);
    }
  }

  writeParameters(parameters: Fmt.ParameterList, indent: IndentInfo, multiLine: boolean): void {
    let paramIndent = indent;
    let lastParamIndent = indent;
    if (parameters.length <= 1) {
      multiLine = false;
    } else {
      paramIndent = this.indent(paramIndent);
      lastParamIndent = this.indent(lastParamIndent, !multiLine);
    }
    let index = 0;
    for (let parameter of parameters) {
      if (index) {
        this.write(',');
        if (!multiLine) {
          this.write(' ');
        }
      }
      if (multiLine) {
        this.writeNewLine();
        this.writeIndent(paramIndent);
      }
      this.writeParameter(parameter, index === parameters.length - 1 ? lastParamIndent : paramIndent);
      index++;
    }
    if (multiLine) {
      this.writeNewLine();
      this.write(indent.outerIndent);
    }
  }

  writeParameter(parameter: Fmt.Parameter, indent: IndentInfo): void {
    this.writeIdentifier(parameter.name);
    if (parameter.dependencies) {
      this.write('[');
      this.writeExpressions(parameter.dependencies, indent, false, false);
      this.write(']');
    }
    if (parameter.list) {
      this.write('...');
    }
    if (parameter.optional) {
      this.write('?');
    }
    this.writeType(parameter.type, indent);
    if (parameter.defaultValue) {
      this.write(' = ');
      this.writeExpression(parameter.defaultValue, indent);
    }
  }

  writeArgumentList(args: Fmt.ArgumentList, indent: IndentInfo, multiLine: boolean): void {
    this.write('(');
    this.writeArguments(args, indent, false, multiLine);
    this.write(')');
  }

  writeOptionalArgumentList(args: Fmt.ArgumentList, indent: IndentInfo, multiLine: boolean): void {
    if (args.length) {
      this.writeArgumentList(args, indent, multiLine);
    }
  }

  writeArguments(args: Fmt.ArgumentList, indent: IndentInfo, blockMode: boolean, multiLine: boolean): void {
    let argIndent = indent;
    let lastArgIndent = indent;
    if (!blockMode) {
      if (args.length <= 1) {
        multiLine = false;
      } else {
        argIndent = this.indent(argIndent);
        lastArgIndent = this.indent(lastArgIndent, !multiLine);
      }
    }
    let index = 0;
    for (let arg of args) {
      if (index) {
        this.write(',');
        if (!multiLine) {
          this.write(' ');
        }
      }
      if (multiLine) {
        if (index || !blockMode) {
          this.writeNewLine();
        }
        this.writeIndent(argIndent);
      }
      this.writeArgument(arg, index === args.length - 1 ? lastArgIndent : argIndent);
      index++;
    }
    if (multiLine) {
      this.writeNewLine();
      if (!blockMode) {
        this.write(indent.outerIndent);
      }
    }
  }

  writeArgument(arg: Fmt.Argument, indent: IndentInfo): void {
    if (arg.name) {
      this.writeIdentifier(arg.name);
      this.write(' = ');
    }
    this.writeExpression(arg.value, indent);
  }

  writeType(type: Fmt.Type, indent: IndentInfo): void {
    this.write(': ');
    this.writeExpression(type.expression, indent);
    if (type.arrayDimensions) {
      this.write('[');
      for (let i = 1; i < type.arrayDimensions; i++) {
        this.write(',');
      }
      this.write(']');
    }
  }

  writeExpressions(expressions: Fmt.Expression[], indent: IndentInfo, multiLine: boolean, squeeze: boolean): void {
    let expressionIndent = indent;
    let lastExpressionIndent = indent;
    if (expressions.length <= 1) {
      multiLine = false;
    } else {
      expressionIndent = this.indent(expressionIndent);
      lastExpressionIndent = this.indent(lastExpressionIndent, !multiLine);
    }
    let index = 0;
    for (let expression of expressions) {
      if (index) {
        this.write(',');
        if (!(multiLine || squeeze)) {
          this.write(' ');
        }
      }
      if (multiLine) {
        this.writeNewLine();
        this.writeIndent(expressionIndent);
      }
      this.writeExpression(expression, index === expressions.length - 1 ? lastExpressionIndent : expressionIndent);
      index++;
    }
    if (multiLine) {
      this.writeNewLine();
      this.write(indent.outerIndent);
    }
  }

  writeExpressionList(expressions: Fmt.Expression[], indent: IndentInfo, squeeze: boolean): void {
    let hasLargeItem = false;
    for (let item of expressions) {
      if (this.isLargeExpression(item)) {
        hasLargeItem = true;
        break;
      }
    }
    this.write('[');
    this.writeExpressions(expressions, indent, hasLargeItem, squeeze);
    this.write(']');
  }

  writeOptionalExpressionList(expressions: Fmt.Expression[] | undefined, indent: IndentInfo, squeeze: boolean): void {
    if (expressions && expressions.length) {
      this.writeExpressionList(expressions, indent, squeeze);
    }
  }

  writeExpression(expression: Fmt.Expression, indent: IndentInfo): void {
    if (expression instanceof Fmt.IntegerExpression) {
      this.writeInteger(expression.value);
    } else if (expression instanceof Fmt.StringExpression) {
      this.writeString(expression.value, '\'', true);
    } else if (expression instanceof Fmt.VariableRefExpression) {
      this.writeIdentifier(expression.variable.name);
      this.writeOptionalExpressionList(expression.indices, indent, true);
    } else if (expression instanceof Fmt.MetaRefExpression) {
      this.write('%');
      this.writeIdentifier(expression.getName());
      let args: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
      expression.toArgumentList(args);
      let hasLargeArg = false;
      for (let arg of args) {
        if (arg.name || this.isLargeExpression(arg.value)) {
          hasLargeArg = true;
          break;
        }
      }
      this.writeOptionalArgumentList(args, indent, hasLargeArg);
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      this.write('$');
      this.writePath(expression.path, indent);
    } else if (expression instanceof Fmt.ParameterExpression) {
      this.write('#');
      this.writeParameterList(expression.parameters, indent, true);
    } else if (expression instanceof Fmt.CompoundExpression) {
      this.write('{');
      this.writeArguments(expression.arguments, indent, false, true);
      this.write('}');
    } else if (expression instanceof Fmt.ArrayExpression) {
      this.writeExpressionList(expression.items, indent, false);
    } else {
      throw new Error('Unsupported expression type');
    }
  }

  private isLargeExpression(expression: Fmt.Expression): boolean {
    return (expression instanceof Fmt.MetaRefExpression
            || expression instanceof Fmt.DefinitionRefExpression
            || expression instanceof Fmt.ParameterExpression
            || expression instanceof Fmt.CompoundExpression
            || expression instanceof Fmt.ArrayExpression);
  }

  writeString(str: string, quoteChar: string, breakLines: boolean): void {
    let indentLength = this.lineLength;
    let result = quoteChar;
    let insertLineBreak = false;
    for (let c of str) {
      if (insertLineBreak) {
        result += quoteChar;
        this.write(result);
        this.writeNewLine();
        this.write(' '.repeat(indentLength));
        result = quoteChar;
        insertLineBreak = false;
      }
      switch (c) {
      case '\\':
      case quoteChar:
        result += '\\' + c;
        break;
      case '\t':
        result += '\\t';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\n':
        result += '\\n';
        if (breakLines) {
          insertLineBreak = true;
        }
        break;
      default:
        result += c;
      }
    }
    result += quoteChar;
    this.write(result);
  }

  writeInteger(value: Fmt.BigInt): void {
    this.write(value.toString());
  }

  writeIdentifier(identifier: string): void {
    if (identifier) {
      let first = true;
      for (let c of identifier) {
        if (isSpecialCharacter(c) || (first && isNumericalCharacter(c))) {
          this.writeString(identifier, '"', false);
          return;
        }
        first = false;
      }
      this.write(identifier);
    } else {
      this.write('""');
    }
  }

  writeDocumentationComment(documentationComment: Fmt.DocumentationComment, indent: IndentInfo): void {
    this.write('/**');
    let needEmptyLine = false;
    for (let item of documentationComment.items) {
      if (needEmptyLine) {
        this.writeNewLine();
        this.writeIndent(indent);
        this.write(' *');
        needEmptyLine = false;
      }
      this.writeNewLine();
      this.writeIndent(indent);
      this.write(' *');
      if (item.kind) {
        this.write(' @');
        this.write(item.kind);
      } else {
        needEmptyLine = true;
      }
      if (item.parameter) {
        this.write(' ');
        this.writeIdentifier(item.parameter.name);
      }
      let indentLength = this.lineLength + 1;
      let textLine = '';
      for (let c of item.text) {
        if (c === '\r') {
          // ignore
        } else if (c === '\n') {
          if (textLine) {
            if (indentLength > this.lineLength) {
              this.write(' '.repeat(indentLength - this.lineLength));
            }
            this.write(textLine);
          }
          textLine = '';
          this.writeNewLine();
          this.writeIndent(indent);
          this.write(' *');
        } else if (c === '/' && textLine.endsWith('*')) {
          textLine += ' /';
        } else {
          textLine += c;
        }
      }
      if (textLine) {
        if (indentLength > this.lineLength) {
          this.write(' '.repeat(indentLength - this.lineLength));
        }
        this.write(textLine);
      }
    }
    this.writeNewLine();
    this.writeIndent(indent);
    this.write(' */');
    this.writeNewLine();
    this.writeIndent(indent);
  }

  private write(str: string): void {
    this.stream.write(str);
    this.lineLength += str.length;
  }

  private writeNewLine(): void {
    this.stream.write('\n');
    this.lineLength = 0;
  }

  private writeIndent(indent: IndentInfo): void {
    this.write(indent.indent);
  }

  private indent(indent: IndentInfo, keepOuterIndent: boolean = false): IndentInfo {
    let newIndent = indent.indent + '  ';
    return {
      indent: newIndent,
      outerIndent: keepOuterIndent ? indent.outerIndent : newIndent
    };
  }
}


export function writeStream(file: Fmt.File, stream: OutputStream): void {
  let writer = new Writer(stream);
  writer.writeFile(file);
}

export function writeString(file: Fmt.File): string {
  let stream = new StringOutputStream;
  writeStream(file, stream);
  return stream.str;
}
