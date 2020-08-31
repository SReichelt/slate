import * as Fmt from './format';
import * as Ctx from './context';
import * as Meta from './metaModel';
import { isWhitespaceCharacter, isSpecialCharacter, isNumericalCharacter } from './common';

export interface Location {
  line: number;
  col: number;
}

export interface Range {
  start: Location;
  end: Location;
}

function fixRange(range: Range): Range {
  if (range.start.line > range.end.line || (range.start.line === range.end.line && range.start.col > range.end.col)) {
    return {
      start: range.end,
      end: range.start
    };
  } else {
    return range;
  }
}

export interface InputStream {
  readChar(): string;
  peekChar(): string;
  getLocation(): Location;
  fork(): InputStream;
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
      this.pos += c.length;
      if (c === '\n') {
        this.line++;
        this.col = 0;
      } else {
        this.col += c.length;
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

  getLocation(): Location {
    return {
      line: this.line,
      col: this.col
    };
  }

  fork(): InputStream {
    let result = new StringInputStream(this.str);
    result.pos = this.pos;
    result.endPos = this.endPos;
    result.line = this.line;
    result.col = this.col;
    return result;
  }
}

export interface ErrorHandler {
  error(msg: string, range: Range): void;
  unfilledPlaceholder(range: Range): void;
  checkMarkdownCode: boolean;
}

export interface ObjectRangeInfo {
  object: Object;
  context?: Ctx.Context;
  metaDefinitions?: Fmt.MetaDefinitionFactory;
  range: Range;
  nameRange?: Range;
  linkRange?: Range;
  signatureRange?: Range;
}

export interface RangeHandler {
  reportRange(info: ObjectRangeInfo): void;
  reportConversion?(raw: Fmt.Expression, converted: Fmt.ObjectContents): void;
}

export class EmptyExpression extends Fmt.Expression {
  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters?: Fmt.ReplacedParameter[]): Fmt.Expression {
    return this;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    return expression instanceof EmptyExpression;
  }
}

interface RawDocumentationComment {
  items: RawDocumentationItem[];
  range: Range;
}

interface RawDocumentationItem {
  kind?: string;
  parameterName?: string;
  text: string;
  range: Range;
  nameRange?: Range;
}

export class Reader {
  private markedStart?: Location;
  private markedEnd?: Location;
  private triedChars: string[] = [];
  private atError = false;
  private metaModel: Meta.MetaModel | undefined;

  constructor(private stream: InputStream, private errorHandler: ErrorHandler, private getMetaModel: Meta.MetaModelGetter, private rangeHandler?: RangeHandler) {}

  readFile(): Fmt.File {
    let file = this.readPartialFile();
    if (this.peekChar()) {
      this.error('Definition or end of file expected');
    }
    return file;
  }

  readPartialFile(): Fmt.File {
    let fileStart = this.markStart();
    let file = new Fmt.File;
    this.readChar('%');
    file.metaModelPath = this.readPath(undefined);
    this.readChar('%');
    try {
      this.metaModel = this.getMetaModel(file.metaModelPath);
    } catch (error) {
      this.error(error.message, this.markEnd(fileStart));
      this.metaModel = new Meta.DummyMetaModel(file.metaModelPath.name);
    }
    try {
      let context = this.metaModel.getRootContext();
      this.readDefinitions(file.definitions, this.metaModel.definitionTypes, context);
      this.markEnd(fileStart, file, context);
    } finally {
      this.metaModel = undefined;
    }
    return file;
  }

  readPath(context: Ctx.Context | undefined): Fmt.Path {
    let pathStart = this.markStart();
    let linkStart = pathStart;
    let parentPath: Fmt.PathItem | undefined = undefined;
    for (;;) {
      this.skipWhitespace(false);
      let itemStart = this.markStart();
      if (this.tryReadChar('.')) {
        let item = this.tryReadChar('.') ? new Fmt.ParentPathItem : new Fmt.IdentityPathItem;
        item.parentPath = parentPath;
        let itemRange = this.markEnd(itemStart);
        this.markEnd(pathStart, item, context, undefined, itemRange);
        parentPath = item;
        this.readChar('/');
      } else {
        let identifier = this.readIdentifier();
        this.skipWhitespace(false);
        if (this.peekChar() === '/') {
          let item = new Fmt.NamedPathItem;
          item.name = identifier;
          item.parentPath = parentPath;
          let itemRange = this.markEnd(itemStart);
          this.markEnd(pathStart, item, context, undefined, itemRange);
          parentPath = item;
          this.readChar('/');
        } else {
          for (;;) {
            let nameRange = this.markEnd(itemStart);
            let linkRange = this.markEnd(linkStart);
            let path = new Fmt.Path;
            path.name = identifier;
            if (context) {
              this.readOptionalArgumentList(path.arguments, context);
            }
            path.parentPath = parentPath;
            this.markEnd(pathStart, path, context, undefined, nameRange, linkRange);
            if (!this.tryReadChar('.')) {
              return path;
            }
            parentPath = path;
            this.skipWhitespace(false);
            itemStart = linkStart = this.markStart();
            identifier = this.readIdentifier();
          }
        }
      }
    }
  }

  readDefinitions(definitions: Fmt.Definition[], metaDefinitions: Fmt.MetaDefinitionFactory, context: Ctx.Context): void {
    let definitionsStart = this.markStart();
    for (;;) {
      let documentationComment = this.skipWhitespace();
      let definition = this.tryReadDefinition(documentationComment, metaDefinitions, context);
      if (definition) {
        definitions.push(definition);
      } else {
        break;
      }
    }
    this.markEnd(definitionsStart, definitions, context, metaDefinitions);
  }

  tryReadDefinition(documentationComment: RawDocumentationComment | undefined, metaDefinitions: Fmt.MetaDefinitionFactory, context: Ctx.Context): Fmt.Definition | undefined {
    let definitionStart = this.markStart();
    if (!this.tryReadChar('$')) {
      return undefined;
    }
    let definition = new Fmt.Definition;
    let nameStart = this.markStart();
    definition.name = this.readIdentifier();
    let nameRange = this.markEnd(nameStart);
    context = new Ctx.ParentInfoContext(definition, context);
    this.readOptionalParameterList(definition.parameters, context);
    let typeContext = context.metaModel.getDefinitionTypeContext(definition, context);
    definition.type = this.readType(metaDefinitions, typeContext);
    let signatureRange = this.markEnd(definitionStart);
    if (documentationComment) {
      definition.documentation = new Fmt.DocumentationComment;
      definition.documentation.items = documentationComment.items.map((item) => {
        let result = new Fmt.DocumentationItem;
        result.kind = item.kind;
        if (item.parameterName) {
          try {
            result.parameter = definition.parameters.getParameter(item.parameterName);
          } catch (error) {
            this.error(error.message, item.nameRange);
          }
        }
        result.text = item.text;
        this.rangeHandler?.reportRange({
          object: result,
          context: context,
          metaDefinitions: metaDefinitions,
          range: item.range,
          nameRange: item.nameRange,
          linkRange: item.nameRange
        });
        return result;
      });
      this.rangeHandler?.reportRange({
        object: definition.documentation,
        context: context,
        metaDefinitions: metaDefinitions,
        range: documentationComment.range
      });
    }
    this.readChar('{');
    let metaInnerDefinitionTypes: Fmt.MetaDefinitionFactory | undefined = undefined;
    let contents: Fmt.ObjectContents | undefined;
    let type = definition.type;
    if (type instanceof Fmt.MetaRefExpression) {
      metaInnerDefinitionTypes = type.getMetaInnerDefinitionTypes();
      contents = type.createDefinitionContents();
    } else {
      contents = new Fmt.GenericObjectContents;
    }
    let contentsContext = context.metaModel.getDefinitionContentsContext(definition, context);
    if (metaInnerDefinitionTypes) {
      this.readDefinitions(definition.innerDefinitions, metaInnerDefinitionTypes, contentsContext);
    }
    if (contents) {
      let args = new Fmt.ArgumentList;
      let argumentsStart = this.markStart();
      this.readArguments(args, contentsContext);
      try {
        let reportFn = this.rangeHandler?.reportConversion?.bind(this.rangeHandler);
        contents.fromArgumentList(args, reportFn);
      } catch (error) {
        this.error(error.message, this.markEnd(argumentsStart));
      }
      definition.contents = contents;
    }
    this.readChar('}');
    this.markEnd(definitionStart, definition, context, metaDefinitions, nameRange, undefined, signatureRange);
    return definition;
  }

  tryReadParameterList(parameters: Fmt.ParameterList, context: Ctx.Context): boolean {
    let result = false;
    let parameterListStart = this.markStart();
    if (this.tryReadChar('(')) {
      this.readParameters(parameters, context);
      this.readChar(')');
      result = true;
    }
    this.markEnd(parameterListStart, parameters, context);
    return result;
  }

  readParameterList(parameters: Fmt.ParameterList, context: Ctx.Context): void {
    this.skipWhitespace();
    if (!this.tryReadParameterList(parameters, context)) {
      this.error('Parameter list expected');
    }
  }

  readOptionalParameterList(parameters: Fmt.ParameterList, context: Ctx.Context): void {
    this.skipWhitespace();
    this.tryReadParameterList(parameters, context);
  }

  readParameters(parameters: Fmt.ParameterList, context: Ctx.Context): void {
    this.skipWhitespace();
    let group = this.tryReadParameterGroup(context);
    if (group) {
      parameters.push(...group);
      this.skipWhitespace();
      while (this.tryReadChar(',')) {
        for (let parameter of group) {
          context = context.metaModel.getNextParameterContext(parameter, context);
        }
        group = this.readParameterGroup(context);
        parameters.push(...group);
        this.skipWhitespace();
      }
    }
  }

  tryReadParameterGroup(context: Ctx.Context): Fmt.Parameter[] | undefined {
    let group: Fmt.Parameter[] = [];
    let groupStart = this.markStart();
    let nameStart = groupStart;
    let name = this.tryReadIdentifier();
    if (!name) {
      return undefined;
    }
    let nameRanges: Range[] = [this.markEnd(nameStart)];
    for (;;) {
      let parameter = new Fmt.Parameter;
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
      group.push(parameter);
      this.skipWhitespace();
      if (!this.tryReadChar(',')) {
        break;
      }
      this.skipWhitespace();
      nameStart = this.markStart();
      name = this.readIdentifier();
      nameRanges.push(this.markEnd(nameStart));
    }
    let typeContext = context.metaModel.getParameterTypeContext(group[0], context);
    let type = this.readType(typeContext.metaModel.expressionTypes, typeContext);
    for (let parameter of group) {
      parameter.type = type;
    }
    this.skipWhitespace();
    if (this.tryReadChar('=')) {
      let defaultValue = this.readExpression(false, context.metaModel.functions, context);
      for (let parameter of group) {
        parameter.defaultValue = defaultValue;
      }
    }
    for (let index = 0; index < group.length; index++) {
      this.markEnd(groupStart, group[index], context, undefined, nameRanges[index]);
    }
    return group;
  }

  readParameterGroup(context: Ctx.Context): Fmt.Parameter[] {
    this.skipWhitespace();
    return this.tryReadParameterGroup(context) || this.error('Parameter expected') || [];
  }

  tryReadArgumentList(args: Fmt.ArgumentList, context: Ctx.Context): boolean {
    let result = false;
    let argumentListStart = this.markStart();
    if (this.tryReadChar('(')) {
      this.readArguments(args, context);
      this.readChar(')');
      result = true;
    }
    this.markEnd(argumentListStart, args, context);
    return result;
  }

  readOptionalArgumentList(args: Fmt.ArgumentList, context: Ctx.Context): void {
    this.skipWhitespace();
    this.tryReadArgumentList(args, context);
  }

  readArguments(args: Fmt.ArgumentList, context: Ctx.Context): void {
    this.skipWhitespace();
    let argIndex = 0;
    let arg = this.tryReadArgument(argIndex, args, context);
    if (arg) {
      args.push(arg);
      this.skipWhitespace();
      while (this.tryReadChar(',')) {
        context = context.metaModel.getNextArgumentContext(arg, argIndex, context);
        argIndex++;
        arg = this.readArgument(argIndex, args, context);
        args.push(arg);
        this.skipWhitespace();
      }
    }
  }

  tryReadArgument(argIndex: number, previousArgs: Fmt.ArgumentList, context: Ctx.Context): Fmt.Argument | undefined {
    let argStart = this.markStart();
    let arg = new Fmt.Argument;
    let nameRange: Range | undefined = undefined;
    let identifier = this.tryReadIdentifier();
    if (identifier) {
      let identifierRange = this.markEnd(argStart);
      this.skipWhitespace();
      if (this.tryReadChar('=')) {
        arg.name = identifier;
        nameRange = identifierRange;
        let valueContext = context.metaModel.getArgumentValueContext(arg, argIndex, previousArgs, context);
        arg.value = this.readExpression(false, valueContext.metaModel.functions, valueContext);
      } else {
        let valueContext = context.metaModel.getArgumentValueContext(arg, argIndex, previousArgs, context);
        let [expression, indexParameterLists] = this.readExpressionAfterIdentifier(identifier, identifierRange, valueContext);
        this.markEnd(argStart, expression, valueContext, valueContext.metaModel.functions, identifierRange);
        expression = this.readExpressionIndices(expression, indexParameterLists, argStart, context);
        arg.value = expression;
      }
    } else {
      let valueContext = context.metaModel.getArgumentValueContext(arg, argIndex, previousArgs, context);
      let value = this.tryReadExpression(false, valueContext.metaModel.functions, valueContext);
      if (!value) {
        return undefined;
      }
      arg.value = value;
    }
    this.markEnd(argStart, arg, context, undefined, nameRange);
    return arg;
  }

  readArgument(argIndex: number, previousArguments: Fmt.ArgumentList, context: Ctx.Context): Fmt.Argument {
    this.skipWhitespace();
    return this.tryReadArgument(argIndex, previousArguments, context) || this.error('Argument expected') || new Fmt.Argument;
  }

  readType(metaDefinitions: Fmt.MetaDefinitionFactory, context: Ctx.Context): Fmt.Expression {
    this.readChar(':');
    return this.readExpression(true, metaDefinitions, context);
  }

  readExpressions(context: Ctx.Context): Fmt.Expression[] {
    let expressions: Fmt.Expression[] = [];
    this.skipWhitespace();
    let expression = this.tryReadExpression(false, context.metaModel.functions, context);
    if (expression) {
      expressions.push(expression);
      this.skipWhitespace();
      while (this.tryReadChar(',')) {
        expressions.push(this.readExpression(false, context.metaModel.functions, context));
        this.skipWhitespace();
      }
    }
    return expressions;
  }

  tryReadExpression(isType: boolean, metaDefinitions: Fmt.MetaDefinitionFactory, context: Ctx.Context): Fmt.Expression | undefined {
    let expressionStart = this.markStart();
    let expression: Fmt.Expression | undefined = undefined;
    let indexParameterLists: Fmt.ParameterList[] | undefined = undefined;
    let nameRange: Range | undefined = undefined;
    if (this.tryReadChar('%')) {
      let nameStart = this.markStart();
      let name = this.readIdentifier();
      nameRange = this.markEnd(nameStart);
      if (metaDefinitions && name) {
        try {
          expression = metaDefinitions.createMetaRefExpression(name);
        } catch (error) {
          this.error(error.message, this.markEnd(expressionStart));
        }
      }
      if (!expression) {
        let genericExpression = new Fmt.GenericMetaRefExpression;
        genericExpression.name = name;
        expression = genericExpression;
      }
      context = new Ctx.ParentInfoContext(expression, context);
      let args = new Fmt.ArgumentList;
      this.readOptionalArgumentList(args, context);
      try {
        let reportFn = this.rangeHandler?.reportConversion?.bind(this.rangeHandler);
        (expression as Fmt.MetaRefExpression).fromArgumentList(args, reportFn);
      } catch (error) {
        this.error(error.message, this.markEnd(expressionStart));
      }
    } else if (metaDefinitions && !metaDefinitions.allowArbitraryReferences()) {
      // Other expressions not allowed in this case.
    } else if (this.tryReadChar('$')) {
      let definitionRefExpression = new Fmt.DefinitionRefExpression;
      context = new Ctx.ParentInfoContext(definitionRefExpression, context);
      definitionRefExpression.path = this.readPath(context);
      expression = definitionRefExpression;
    } else {
      let identifier = this.tryReadIdentifier();
      if (identifier) {
        nameRange = this.markEnd(expressionStart);
        [expression, indexParameterLists] = this.readExpressionAfterIdentifier(identifier, nameRange, context);
      } else if (isType) {
        // Other expressions not allowed in this case.
      } else if (this.tryReadChar('{')) {
        let compoundExpression = new Fmt.CompoundExpression;
        context = new Ctx.ParentInfoContext(compoundExpression, context);
        this.readArguments(compoundExpression.arguments, context);
        this.readChar('}');
        expression = compoundExpression;
      } else if (this.tryReadChar('#')) {
        let parameterExpression = new Fmt.ParameterExpression;
        context = new Ctx.ParentInfoContext(parameterExpression, context);
        this.readParameterList(parameterExpression.parameters, context);
        expression = parameterExpression;
      } else if (this.tryReadChar('[')) {
        let arrayExpression = new Fmt.ArrayExpression;
        arrayExpression.items = this.readExpressions(context);
        this.readChar(']');
        expression = arrayExpression;
      } else if (this.tryReadChar('?')) {
        let range = this.markEnd(expressionStart);
        let errorRange = this.getErrorRange(range);
        this.errorHandler.unfilledPlaceholder(errorRange);
        expression = new Fmt.PlaceholderExpression(undefined);
      } else {
        let str = this.tryReadString('\'');
        if (str !== undefined) {
          let stringExpression = new Fmt.StringExpression;
          stringExpression.value = str;
          expression = stringExpression;
        } else {
          let num = this.tryReadInteger();
          if (num !== undefined) {
            let integerExpression = new Fmt.IntegerExpression;
            integerExpression.value = num;
            expression = integerExpression;
          }
        }
      }
    }
    if (expression) {
      this.markEnd(expressionStart, expression, context, metaDefinitions, nameRange, nameRange);
      expression = this.readExpressionIndices(expression, indexParameterLists, expressionStart, context);
    }
    return expression;
  }

  private readExpressionAfterIdentifier(identifier: string, identifierRange: Range, context: Ctx.Context): [Fmt.Expression, Fmt.ParameterList[] | undefined] {
    let expression = new Fmt.VariableRefExpression;
    let indexParameterLists: Fmt.ParameterList[] | undefined = undefined;
    try {
      let variableInfo = context.getVariable(identifier);
      expression.variable = variableInfo.parameter;
      indexParameterLists = variableInfo.indexParameterLists;
    } catch (error) {
      this.error(error.message, identifierRange);
    }
    return [expression, indexParameterLists];
  }

  private readExpressionIndices(expression: Fmt.Expression, indexParameterLists: Fmt.ParameterList[] | undefined, expressionStart: Location, context: Ctx.Context): Fmt.Expression {
    this.skipWhitespace();
    let indexIndex = 0;
    while (this.tryReadChar('[')) {
      let indexedExpression = new Fmt.IndexedExpression;
      indexedExpression.body = expression;
      if (indexParameterLists && indexIndex < indexParameterLists.length) {
        indexedExpression.parameters = indexParameterLists[indexIndex];
      }
      indexedExpression.arguments = new Fmt.ArgumentList;
      this.readArguments(indexedExpression.arguments!, context);
      this.readChar(']');
      this.markEnd(expressionStart, indexedExpression, context);
      expression = indexedExpression;
      indexIndex++;
    }
    if (indexParameterLists) {
      for (; indexIndex < indexParameterLists.length; indexIndex++) {
        let indexedExpression = new Fmt.IndexedExpression;
        indexedExpression.body = expression;
        indexedExpression.parameters = indexParameterLists[indexIndex];
        expression = indexedExpression;
      }
    }
    return expression;
  }

  readExpression(isType: boolean, metaDefinitions: Fmt.MetaDefinitionFactory, context: Ctx.Context): Fmt.Expression {
    this.skipWhitespace();
    let expression = this.tryReadExpression(isType, metaDefinitions, context);
    if (!expression) {
      this.error('Expression expected');
      expression = new EmptyExpression;
      this.markEnd(this.markStart(), expression, context, metaDefinitions);
    }
    return expression;
  }

  tryReadString(quoteChar: string): string | undefined {
    let stringStart = this.markStart();
    if (!this.tryReadChar(quoteChar)) {
      return undefined;
    }
    let str = '';
    do {
      for (;;) {
        let c = this.readAnyChar();
        if (!c) {
          this.error('Unterminated string', this.markEnd(stringStart));
          break;
        } else if (c === quoteChar) {
          break;
        } else if (c === '\\') {
          c = this.peekChar();
          let escapedCharacter = this.getEscapedCharacter(c);
          if (escapedCharacter) {
            str += escapedCharacter;
          } else {
            this.error('Unknown escape sequence');
          }
          this.readAnyChar();
        } else {
          str += c;
        }
      }
      this.skipWhitespace(false);
    } while (this.tryReadChar(quoteChar));
    return str;
  }

  tryReadInteger(): Fmt.BN | undefined {
    let c = this.peekChar();
    if (isNumericalCharacter(c) || c === '+' || c === '-') {
      let numStr = '';
      do {
        numStr += this.readAnyChar();
        c = this.peekChar();
      } while (isNumericalCharacter(c));
      let num = new Fmt.BN(numStr, 10);
      return num;
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

  private skipWhitespace(allowComments: boolean = true): RawDocumentationComment | undefined {
    let result: RawDocumentationComment | undefined = undefined;
    let c = this.stream.peekChar();
    if (isWhitespaceCharacter(c) || (allowComments && c === '/')) {
      this.markedEnd = this.stream.getLocation();
      do {
        if (allowComments && c === '/') {
          let commentStart = this.stream.getLocation();
          this.stream.readChar();
          c = this.stream.peekChar();
          switch (c) {
          case '/':
            this.stream.readChar();
            do {
              c = this.stream.readChar();
            } while (c && c !== '\r' && c !== '\n');
            break;
          case '*':
            this.stream.readChar();
            let documentationItems: RawDocumentationItem[] | undefined = undefined;
            c = this.stream.peekChar();
            if (c === '*') {
              this.stream.readChar();
              documentationItems = [];
            }
            let atLineStart = false;
            let afterAsterisk = true;
            let atCommentLineStart = true;
            let inKind = false;
            let atNameStart = false;
            let inUnescapedName = false;
            let inEscapedName = false;
            let inEscapeSequence = false;
            let inMarkdownCode = '';
            let atMarkdownStart = false;
            let kind: string | undefined = undefined;
            let name: string | undefined = undefined;
            let text = '';
            let textStartCol = 0;
            let commentLineStart: Location | undefined = undefined;
            let itemStart: Location | undefined = undefined;
            let itemEnd: Location | undefined = undefined;
            let nameStart: Location | undefined = undefined;
            let nameEnd: Location | undefined = undefined;
            for (;;) {
              if (atLineStart || afterAsterisk) {
                commentLineStart = this.stream.getLocation();
              }
              c = this.stream.readChar();
              if (!c) {
                this.markedEnd = undefined;
                this.error('Unterminated comment', this.markEnd(commentStart));
                break;
              } else if (c === '*') {
                if (this.stream.peekChar() === '/') {
                  this.stream.readChar();
                  break;
                }
                if (atLineStart) {
                  atLineStart = false;
                  afterAsterisk = true;
                  c = '';
                } else {
                  afterAsterisk = false;
                }
              } else if (c === '\r' || c === '\n') {
                atLineStart = true;
                afterAsterisk = false;
              } else if (isWhitespaceCharacter(c) && (atLineStart || afterAsterisk)) {
                c = '';
                afterAsterisk = false;
              } else {
                atLineStart = false;
                afterAsterisk = false;
              }
              if (documentationItems && c) {
                if (c !== '`') {
                  atMarkdownStart = false;
                }
                if (c === '\r' || c === '\n') {
                  if (text) {
                    text += c;
                  }
                  atCommentLineStart = true;
                  inKind = false;
                  atNameStart = false;
                  inUnescapedName = false;
                  inEscapedName = false;
                  inEscapeSequence = false;
                } else if (atCommentLineStart && c === '@') {
                  if (kind || text) {
                    if (!itemStart) {
                      itemStart = this.stream.getLocation();
                    }
                    if (!itemEnd) {
                      itemEnd = this.stream.getLocation();
                    }
                    documentationItems.push({
                      kind: kind,
                      parameterName: name,
                      text: text.trimRight(),
                      range: {
                        start: itemStart,
                        end: itemEnd
                      },
                      nameRange: nameStart && nameEnd ? {
                        start: nameStart,
                        end: nameEnd
                      } : undefined
                    });
                  }
                  kind = '';
                  name = undefined;
                  text = '';
                  atCommentLineStart = false;
                  inKind = true;
                  textStartCol = 0;
                  itemStart = commentLineStart;
                  itemEnd = undefined;
                  nameStart = undefined;
                  nameEnd = undefined;
                } else if (inKind) {
                  if (isWhitespaceCharacter(c)) {
                    inKind = false;
                    if (kind === 'param') {
                      atNameStart = true;
                      nameStart = this.stream.getLocation();
                    }
                  } else {
                    kind += c;
                  }
                } else if (atNameStart) {
                  if (isWhitespaceCharacter(c)) {
                    nameStart = this.stream.getLocation();
                  } else if (c === '"') {
                    name = '';
                    atNameStart = false;
                    inEscapedName = true;
                  } else {
                    atNameStart = false;
                    inUnescapedName = true;
                    name = c;
                    nameEnd = this.stream.getLocation();
                  }
                } else if (inUnescapedName) {
                  if (isWhitespaceCharacter(c)) {
                    inUnescapedName = false;
                  } else {
                    name += c;
                    nameEnd = this.stream.getLocation();
                  }
                } else if (inEscapedName) {
                  if (inEscapeSequence) {
                    let escapedCharacter = this.getEscapedCharacter(c);
                    if (escapedCharacter) {
                      name += escapedCharacter;
                    }
                    inEscapeSequence = false;
                  } else if (c === '\\') {
                    inEscapeSequence = true;
                  } else if (c === '"') {
                    inEscapedName = false;
                    nameEnd = this.stream.getLocation();
                  } else {
                    name += c;
                    itemEnd = this.stream.getLocation();
                  }
                } else {
                  if (!text) {
                    textStartCol = this.stream.getLocation().col;
                  } else if (this.stream.getLocation().col >= textStartCol) {
                    atCommentLineStart = false;
                  }
                  if ((!text || atCommentLineStart) && isWhitespaceCharacter(c)) {
                    if (atCommentLineStart) {
                      commentLineStart = this.stream.getLocation();
                    }
                  } else {
                    text += c;
                    if (!itemStart) {
                      itemStart = commentLineStart;
                    }
                    itemEnd = this.stream.getLocation();
                    if (c === '`') {
                      if (inMarkdownCode) {
                        if (atMarkdownStart) {
                          inMarkdownCode += c;
                        } else if (text.endsWith(inMarkdownCode)) {
                          inMarkdownCode = '';
                        }
                      } else {
                        inMarkdownCode = c;
                        atMarkdownStart = true;
                      }
                      if (atMarkdownStart && this.errorHandler.checkMarkdownCode && this.stream.peekChar() !== '`') {
                        let origStream = this.stream;
                        this.stream = this.stream.fork();
                        try {
                          let dummyContext = new Ctx.DummyContext(this.metaModel!);
                          this.readExpression(false, this.metaModel!.functions, dummyContext);
                          this.skipWhitespace(false);
                          for (let endChar of inMarkdownCode) {
                            this.readChar(endChar);
                          }
                        } finally {
                          this.stream = origStream;
                        }
                      }
                    }
                  }
                }
              }
            }
            if (documentationItems) {
              if (kind || text) {
                if (!itemStart) {
                  itemStart = this.stream.getLocation();
                }
                if (!itemEnd) {
                  itemEnd = this.stream.getLocation();
                }
                documentationItems.push({
                  kind: kind,
                  parameterName: name,
                  text: text.trimRight(),
                  range: {
                    start: itemStart,
                    end: itemEnd
                  },
                  nameRange: nameStart && nameEnd ? {
                    start: nameStart,
                    end: nameEnd
                  } : undefined
                });
              }
              result = {
                items: documentationItems,
                range: {
                  start: commentStart,
                  end: this.stream.getLocation()
                }
              };
            }
            break;
          default:
            this.error(`'/' or '*' expected`);
          }
        } else {
          this.stream.readChar();
        }
        c = this.stream.peekChar();
      } while (isWhitespaceCharacter(c) || (allowComments && c === '/'));
      if (this.markedStart) {
        Object.assign(this.markedStart, this.stream.getLocation());
      }
    }
    return result;
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
    this.markedStart = undefined;
    this.markedEnd = undefined;
    this.skipWhitespace(c !== '/');
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
    this.markedStart = undefined;
    this.markedEnd = undefined;
    this.triedChars.length = 0;
    this.atError = false;
    return this.stream.readChar();
  }

  private getEscapedCharacter(escapeCharacter: string): string | undefined {
    switch (escapeCharacter) {
    case '\\':
    case '"':
    case '\'':
      return escapeCharacter;
    case 't':
      return '\t';
    case 'r':
      return '\r';
    case 'n':
      return '\n';
    default:
      return undefined;
    }
  }

  private markStart(): Location {
    if (!this.markedStart) {
      this.markedStart = this.stream.getLocation();
    }
    return this.markedStart;
  }

  private markEnd(start: Location, object?: Object, context?: Ctx.Context, metaDefinitions?: Fmt.MetaDefinitionFactory, nameRange?: Range, linkRange?: Range, signatureRange?: Range): Range {
    if (!this.markedEnd) {
      this.markedEnd = this.stream.getLocation();
    }
    let range = fixRange({
      start: start,
      end: this.markedEnd
    });
    if (object !== undefined && this.rangeHandler) {
      if (nameRange) {
        nameRange = fixRange(nameRange);
      }
      if (linkRange) {
        linkRange = fixRange(linkRange);
      }
      if (signatureRange) {
        signatureRange = fixRange(signatureRange);
      }
      this.rangeHandler.reportRange({
        object: object,
        context: context,
        metaDefinitions: metaDefinitions,
        range: range,
        nameRange: nameRange,
        linkRange: linkRange,
        signatureRange: signatureRange
      });
    }
    return range;
  }

  private getErrorRange(range?: Range): Range {
    if (range) {
      return fixRange(range);
    } else {
      let start = this.stream.getLocation();
      let end = start;
      let c = this.peekChar();
      if (c && c !== '\r' && c !== '\n') {
        end = {
          line: end.line,
          col: end.col + 1
        };
      }
      return {
        start: start,
        end: end
      };
    }
  }

  private error(msg: string, range?: Range): void {
    if (!this.atError) {
      let errorRange = this.getErrorRange(range);
      this.errorHandler.error(msg, errorRange);
      this.atError = true;
    }
  }
}


export class DefaultErrorHandler implements ErrorHandler {
  constructor(private fileName?: string, public checkMarkdownCode: boolean = false, private allowPlaceholders: boolean = false) {}

  error(msg: string, range: Range): void {
    let line = range.start.line + 1;
    let col = range.start.col + 1;
    msg = `${line}:${col}: ${msg}`;
    if (this.fileName) {
      msg = `${this.fileName}:${msg}`;
    }
    let error: any = new SyntaxError(msg);
    error.fileName = this.fileName;
    error.lineNumber = line;
    error.columnNumber = col;
    throw error;
  }

  unfilledPlaceholder(range: Range): void {
    if (!this.allowPlaceholders) {
      this.error('Unfilled placeholder', range);
    }
  }
}

export function readStream(stream: InputStream, errorHandler: ErrorHandler, getMetaModel: Meta.MetaModelGetter, rangeHandler?: RangeHandler): Fmt.File {
  let reader = new Reader(stream, errorHandler, getMetaModel, rangeHandler);
  return reader.readFile();
}

export function readString(str: string, fileName: string, getMetaModel: Meta.MetaModelGetter, rangeHandler?: RangeHandler): Fmt.File {
  let stream = new StringInputStream(str);
  let errorHandler = new DefaultErrorHandler(fileName);
  return readStream(stream, errorHandler, getMetaModel, rangeHandler);
}
