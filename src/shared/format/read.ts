import * as Fmt from './format';
import { isWhitespaceCharacter, isSpecialCharacter, isNumericalCharacter } from './common';

export interface InputStream {
  readChar(): string;
  peekChar(): string;

  line: number;
  col: number;
}

export class StringInputStream implements InputStream {
  private pos: number;
  private endPos: number;

  line: number = 0;
  col: number = 0;

  constructor(private str: string) {
    this.pos = 0;
    this.endPos = str.length;
  }

  readChar(): string {
    if (this.pos < this.endPos) {
      let c = this.str.charAt(this.pos);
      this.pos++;
      if (c === '\n') {
        this.line++;
        this.col = 0;
      } else {
        this.col++;
      }
      return c;
    } else {
      return '';
    }
  }

  peekChar(): string {
    if (this.pos < this.endPos) {
      return this.str.charAt(this.pos);
    } else {
      return '';
    }
  }
}

type ErrorHandler = (msg: string, line: number, col: number) => void;

export class Reader {
  private triedChars: string[] = [];
  private atError = false;

  constructor(private stream: InputStream, private errorHandler: ErrorHandler, private metaModel: Fmt.MetaModel) {}

  readFile(): Fmt.File {
    let file = new Fmt.File;
    let context = this.metaModel.getRootContext();
    this.readChar('%');
    file.metaModelPath = this.readPath(context, file);
    if (context.metaDefinitions && file.metaModelPath.name && file.metaModelPath.name !== context.metaDefinitions.metaModelName) {
      this.error(`Expected file of type "${context.metaDefinitions.metaModelName}"`);
    }
    this.readChar('%');
    let definitionTypes = context.metaDefinitions ? context.metaDefinitions.definitionTypes : undefined;
    this.readDefinitions(file.definitions, definitionTypes, context);
    this.skipWhitespace();
    if (this.peekChar()) {
      this.error('Definition or end of file expected');
    }
    return file;
  }

  readPath(context: Fmt.Context, parent: Object): Fmt.Path {
    let path: Fmt.PathItem | undefined = undefined;
    for (;;) {
      this.skipWhitespace();
      if (this.tryReadChar('.')) {
        let item = this.tryReadChar('.') ? new Fmt.ParentPathItem : new Fmt.IdentityPathItem;
        item.parentPath = path;
        path = item;
        this.readChar('/');
      } else {
        this.skipWhitespace();
        let identifier = this.readIdentifier();
        this.skipWhitespace();
        if (this.tryReadChar('/')) {
          let item = new Fmt.NamedPathItem;
          item.name = identifier;
          item.parentPath = path;
          path = item;
        } else {
          for (;;) {
            let item = new Fmt.Path;
            item.name = identifier;
            this.readOptionalArgumentList(item.arguments, context, parent);
            item.parentPath = path;
            if (!this.tryReadChar('.')) {
              return item;
            }
            path = item;
            this.skipWhitespace();
            identifier = this.readIdentifier();
          }
        }
      }
    }
  }

  readDefinitions(definitions: Fmt.Definition[], metaDefinitionList: Fmt.MetaDefinitionList | undefined, context: Fmt.Context): void {
    for (;;) {
      this.skipWhitespace();
      let definition = this.tryReadDefinition(metaDefinitionList, context);
      if (definition) {
        definitions.push(definition);
      } else {
        break;
      }
    }
  }

  tryReadDefinition(metaDefinitionList: Fmt.MetaDefinitionList | undefined, context: Fmt.Context): Fmt.Definition | undefined {
    if (!this.tryReadChar('$')) {
      return undefined;
    }
    let definition = new Fmt.Definition;
    definition.name = this.readIdentifier();
    this.readOptionalParameterList(definition.parameters, context, definition);
    let typeContext = this.metaModel.getDefinitionTypeContext(definition, context);
    definition.type = this.readType(metaDefinitionList, typeContext);
    this.readChar('{');
    let metaInnerDefinitionTypes: Fmt.MetaDefinitionList | undefined = undefined;
    let contentClass: any = Fmt.GenericObjectContents;
    if (definition.type.expression instanceof Fmt.MetaRefExpression) {
      let typeExpressionClass: any = definition.type.expression.constructor;
      metaInnerDefinitionTypes = typeExpressionClass.metaInnerDefinitionTypes;
      contentClass = typeExpressionClass.metaContents;
    }
    let contentsContext = this.metaModel.getDefinitionContentsContext(definition, context);
    this.readDefinitions(definition.innerDefinitions, metaInnerDefinitionTypes, contentsContext);
    if (contentClass) {
      let contents = new contentClass;
      let args: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
      this.readArguments(args, contentsContext, definition);
      try {
        contents.fromArgumentList(args);
      } catch (error) {
        this.error(error.message);
      }
      definition.contents = contents;
    }
    this.readChar('}');
    return definition;
  }

  tryReadParameterList(parameters: Fmt.ParameterList, context: Fmt.Context, parent: Object): boolean {
    if (!this.tryReadChar('(')) {
      return false;
    }
    this.readParameters(parameters, context, parent);
    this.readChar(')');
    return true;
  }

  readParameterList(parameters: Fmt.ParameterList, context: Fmt.Context, parent: Object): void {
    this.skipWhitespace();
    if (!this.tryReadParameterList(parameters, context, parent)) {
      this.error('Parameter list expected');
    }
  }

  readOptionalParameterList(parameters: Fmt.ParameterList, context: Fmt.Context, parent: Object): void {
    this.skipWhitespace();
    this.tryReadParameterList(parameters, context, parent);
  }

  readParameters(parameters: Fmt.ParameterList, context: Fmt.Context, parent: Object): void {
    this.skipWhitespace();
    let parameter = this.tryReadParameter(context, parent);
    if (parameter) {
      parameters.push(parameter);
      this.skipWhitespace();
      while (this.tryReadChar(',')) {
        context = this.metaModel.getNextParameterContext(parameter, context, parent);
        parameter = this.readParameter(context, parent);
        parameters.push(parameter);
        this.skipWhitespace();
      }
    }
  }

  tryReadParameter(context: Fmt.Context, parent: Object): Fmt.Parameter | undefined {
    let parameter = new Fmt.Parameter;
    let name = this.tryReadIdentifier();
    if (!name) {
      return undefined;
    }
    parameter.name = name;
    this.skipWhitespace();
    if (this.tryReadChar('[')) {
      parameter.dependencies = this.readExpressions(context);
      this.readChar(']');
      this.skipWhitespace();
    }
    if (parameter.list = this.tryReadChar('.')) {
      this.readChar('.');
      this.readChar('.');
      this.skipWhitespace();
    }
    parameter.optional = this.tryReadChar('?');
    let expressionTypes = context.metaDefinitions ? context.metaDefinitions.expressionTypes : undefined;
    let typeContext = this.metaModel.getParameterTypeContext(parameter, context, parent);
    parameter.type = this.readType(expressionTypes, typeContext);
    this.skipWhitespace();
    if (this.tryReadChar('=')) {
      let functions = context.metaDefinitions ? context.metaDefinitions.functions : undefined;
      parameter.defaultValue = this.readExpression(false, functions, context);
    }
    return parameter;
  }

  readParameter(context: Fmt.Context, parent: Object): Fmt.Parameter {
    this.skipWhitespace();
    return this.tryReadParameter(context, parent) || this.error('Parameter expected') || new Fmt.Parameter;
  }

  tryReadArgumentList(args: Fmt.ArgumentList, context: Fmt.Context, parent: Object): boolean {
    if (!this.tryReadChar('(')) {
      return false;
    }
    this.readArguments(args, context, parent);
    this.readChar(')');
    return true;
  }

  readOptionalArgumentList(args: Fmt.ArgumentList, context: Fmt.Context, parent: Object): void {
    this.skipWhitespace();
    this.tryReadArgumentList(args, context, parent);
  }

  readArguments(args: Fmt.ArgumentList, context: Fmt.Context, parent: Object): void {
    this.skipWhitespace();
    let arg = this.tryReadArgument(context, parent);
    if (arg) {
      args.push(arg);
      this.skipWhitespace();
      while (this.tryReadChar(',')) {
        context = this.metaModel.getNextArgumentContext(arg, context, parent);
        arg = this.readArgument(context, parent);
        args.push(arg);
        this.skipWhitespace();
      }
    }
  }

  tryReadArgument(context: Fmt.Context, parent: Object): Fmt.Argument | undefined {
    let arg = new Fmt.Argument;
    let identifier = this.tryReadIdentifier();
    if (identifier) {
      this.skipWhitespace();
      if (this.tryReadChar('=')) {
        arg.name = identifier;
        let functions = context.metaDefinitions ? context.metaDefinitions.functions : undefined;
        let contentsContext = this.metaModel.getArgumentValueContext(arg, context, parent);
        arg.value = this.readExpression(false, functions, contentsContext);
      } else {
        let contentsContext = this.metaModel.getArgumentValueContext(arg, context, parent);
        arg.value = this.readExpressionAfterIdentifier(identifier, contentsContext);
      }
    } else {
      let functions = context.metaDefinitions ? context.metaDefinitions.functions : undefined;
      let contentsContext = this.metaModel.getArgumentValueContext(arg, context, parent);
      let value = this.tryReadExpression(false, functions, contentsContext);
      if (!value) {
        return undefined;
      }
      arg.value = value;
    }
    return arg;
  }

  readArgument(context: Fmt.Context, parent: Object): Fmt.Argument {
    this.skipWhitespace();
    return this.tryReadArgument(context, parent) || this.error('Argument expected') || new Fmt.Argument;
  }

  tryReadType(metaDefinitionList: Fmt.MetaDefinitionList | undefined, context: Fmt.Context): Fmt.Type | undefined {
    if (!this.tryReadChar(':')) {
      return undefined;
    }
    let type = new Fmt.Type;
    type.expression = this.readExpression(true, metaDefinitionList, context) as Fmt.ObjectRefExpression;
    type.arrayDimensions = 0;
    this.skipWhitespace();
    if (this.tryReadChar('[')) {
      do {
        type.arrayDimensions++;
        this.skipWhitespace();
      } while (this.tryReadChar(','));
      this.readChar(']');
    }
    return type;
  }

  readType(metaDefinitionList: Fmt.MetaDefinitionList | undefined, context: Fmt.Context): Fmt.Type {
    this.skipWhitespace();
    return this.tryReadType(metaDefinitionList, context) || this.error('Type expected') || new Fmt.Type;
  }

  readExpressions(context: Fmt.Context): Fmt.Expression[] {
    let expressions: Fmt.Expression[] = [];
    this.skipWhitespace();
    let functions = context.metaDefinitions ? context.metaDefinitions.functions : undefined;
    let expression = this.tryReadExpression(false, functions, context);
    if (expression) {
      expressions.push(expression);
      this.skipWhitespace();
      while (this.tryReadChar(',')) {
        expressions.push(this.readExpression(false, functions, context));
        this.skipWhitespace();
      }
    }
    return expressions;
  }

  tryReadExpression(isType: boolean, metaDefinitionList: Fmt.MetaDefinitionList | undefined, context: Fmt.Context): Fmt.Expression | undefined {
    if (this.tryReadChar('%')) {
      let name = this.readIdentifier();
      let expression: Fmt.MetaRefExpression | undefined = undefined;
      if (metaDefinitionList && name) {
        let metaDefinitionClass = metaDefinitionList[name];
        if (metaDefinitionClass) {
          expression = new metaDefinitionClass;
        } else {
          this.error(`Meta object "${name}" not found`);
        }
      }
      if (!expression) {
        let genericExpression = new Fmt.GenericMetaRefExpression;
        genericExpression.name = name;
        expression = genericExpression;
      }
      let args: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
      this.readOptionalArgumentList(args, context, expression!);
      try {
        expression!.fromArgumentList(args);
      } catch (error) {
        this.error(error.message);
      }
      return expression;
    } else if (isType && metaDefinitionList && !metaDefinitionList['']) {
      return undefined;
    } else if (this.tryReadChar('$')) {
      let expression = new Fmt.DefinitionRefExpression;
      expression.path = this.readPath(context, expression);
      return expression;
    } else {
      let identifier = this.tryReadIdentifier();
      if (identifier) {
        return this.readExpressionAfterIdentifier(identifier, context);
      } else if (isType) {
        return undefined;
      } else if (this.tryReadChar('{')) {
        let expression = new Fmt.CompoundExpression;
        this.readArguments(expression.arguments, context, expression);
        this.readChar('}');
        return expression;
      } else if (this.tryReadChar('#')) {
        let expression = new Fmt.ParameterExpression;
        this.readParameterList(expression.parameters, context, expression);
        return expression;
      } else if (this.tryReadChar('[')) {
        let expression = new Fmt.ArrayExpression;
        expression.items = this.readExpressions(context);
        this.readChar(']');
        return expression;
      } else {
        let str = this.tryReadString('\'');
        if (str !== undefined) {
          let expression = new Fmt.StringExpression;
          expression.value = str;
          return expression;
        } else {
          let num = this.tryReadInteger();
          if (num !== undefined) {
            let expression = new Fmt.IntegerExpression;
            expression.value = num;
            return expression;
          } else {
            return undefined;
          }
        }
      }
    }
  }

  private readExpressionAfterIdentifier(identifier: string, context: Fmt.Context): Fmt.Expression {
    let expression = new Fmt.VariableRefExpression;
    try {
      expression.variable = context.getVariable(identifier);
    } catch (error) {
      this.error(error.message);
    }
    this.skipWhitespace();
    if (this.tryReadChar('[')) {
      expression.indices = this.readExpressions(context);
      this.readChar(']');
    }
    return expression;
  }

  readExpression(isType: boolean, metaDefinitionList: Fmt.MetaDefinitionList | undefined, context: Fmt.Context): Fmt.Expression {
    this.skipWhitespace();
    return this.tryReadExpression(isType, metaDefinitionList, context) || this.error('Expression expected') || new Fmt.StringExpression;
  }

  tryReadString(quoteChar: string): string | undefined {
    if (!this.tryReadChar(quoteChar)) {
      return undefined;
    }
    let str = '';
    do {
      for (;;) {
        let c = this.readAnyChar();
        if (!c) {
          this.error('Unterminated string');
          break;
        } else if (c === quoteChar) {
          break;
        } else if (c === '\\') {
          c = this.readAnyChar();
          switch (c) {
          case '\\':
          case '"':
          case '\'':
            str += c;
            break;
          case 't':
            str += '\t';
            break;
          case 'r':
            str += '\r';
            break;
          case 'n':
            str += '\n';
            break;
          default:
            this.error('Unknown escape sequence');
          }
        } else {
          str += c;
        }
      }
      this.skipWhitespace();
    } while (this.tryReadChar(quoteChar));
    return str;
  }

  tryReadInteger(): Fmt.BigInt | undefined {
    let c = this.peekChar();
    if (isNumericalCharacter(c) || c === '+' || c === '-') {
      let numStr = '';
      do {
        numStr += this.readAnyChar();
        c = this.peekChar();
      } while (isNumericalCharacter(c));
      return new Fmt.BN(numStr, 10);
    } else {
      return undefined;
    }
  }

  tryReadIdentifier(): string | undefined {
    let c = this.peekChar();
    if (c === '"') {
      return this.tryReadString('"');
    } else if (isSpecialCharacter(c) || isNumericalCharacter(c)) {
      if (this.triedChars.indexOf('') < 0) {
        this.triedChars.push('');
      }
      return undefined;
    } else {
      let identifier = '';
      do {
        identifier += this.readAnyChar();
        c = this.peekChar();
      } while (c && !isSpecialCharacter(c));
      return identifier;
    }
  }

  readIdentifier(): string {
    return this.tryReadIdentifier() || this.error('Identifier expected') || '';
  }

  private skipWhitespace(): void {
    for (;;) {
      let c = this.peekChar();
      if (isWhitespaceCharacter(c)) {
        this.readAnyChar();
      } else {
        break;
      }
    }
  }

  private tryReadChar(c: string): boolean {
    if (this.peekChar() === c) {
      this.readAnyChar();
      return true;
    } else {
      this.triedChars.push(c);
      return false;
    }
  }

  private readChar(c: string): void {
    this.skipWhitespace();
    if (!this.tryReadChar(c)) {
      let expected = '';
      let index = 0;
      for (let tried of this.triedChars) {
        if (index) {
          if (this.triedChars.length > 2) {
            expected += ',';
          }
          expected += ' ';
          if (index === this.triedChars.length - 1) {
            expected += 'or ';
          }
        }
        expected += tried ? `'${tried}'` : expected ? 'identifier' : 'Identifier';
        index++;
      }
      this.error(`${expected} expected`);
    }
  }

  private peekChar(): string {
    return this.stream.peekChar();
  }

  private readAnyChar(): string {
    this.triedChars.length = 0;
    this.atError = false;
    return this.stream.readChar();
  }

  private error(msg: string): void {
    if (!this.atError) {
      this.errorHandler(msg, this.stream.line, this.stream.col);
      this.atError = true;
    }
  }
}


export function readStream(stream: InputStream, fileName: string, metaModel: Fmt.MetaModel): Fmt.File {
  let errorHandler = (msg: string, line: number, col: number) => {
    let error: any = new SyntaxError(`${fileName}:${line + 1}:${col + 1}: ${msg}`);
    error.fileName = fileName;
    error.lineNumber = line + 1;
    error.columnNumber = col + 1;
    throw error;
  };
  let reader = new Reader(stream, errorHandler, metaModel);
  return reader.readFile();
}

export function readString(str: string, fileName: string, metaModel: Fmt.MetaModel): Fmt.File {
  return readStream(new StringInputStream(str), fileName, metaModel);
}

interface TextResponse {
  url: string;
  text(): Promise<string>;
}

export function readResponse(response: TextResponse, metaModel: Fmt.MetaModel): Promise<Fmt.File> {
  return response.text().then((str: string) => readString(str, response.url, metaModel));
}
