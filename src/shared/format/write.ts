import * as Fmt from './format';
import { isSpecialCharacter, isNumericalCharacter } from './common';

export interface OutputStream {
  write(str: string): void;
  error(message: string): void;
  startRange?(object: Object, name: boolean, link: boolean, tag: boolean, signature: boolean): void;
  endRange?(): void;
}

export class StringOutputStream implements OutputStream {
  str: string = '';

  write(str: string): void {
    this.str += str;
  }

  error(message: string): void {
    throw new Error(message);
  }
}

export interface IndentInfo {
  indent: string;
  outerIndent: string;
}

interface PathInfo {
  path: Fmt.PathItem;
  occurrences: number;
}

export class Writer {
  private lineLength = 0;
  private pathAliases: Fmt.PathAlias[] = [];

  constructor(private stream: OutputStream, private allowPlaceholders: boolean = false, private skipOmittableParameters: boolean = false, private newLineStr: string = '\n', private indentStr: string = '  ', private spaceStr: string = ' ') {}

  writeFile(file: Fmt.File, indent: IndentInfo | undefined = {indent: '', outerIndent: ''}): void {
    this.constructPathAliases(file);
    this.writeRange(file, false, false, false, false, () => {
      this.write('%');
      this.writePath(file.metaModelPath, indent);
      this.write('%');
      this.writeNewLine();
      if (file.definitions.length) {
        this.writeNewLine(true);
        this.writeFileContents(file, indent);
      }
    });
  }

  constructPathAliases(file: Fmt.File): void {
    let paths = new Map<string, PathInfo[]>();
    file.traverse((expression: Fmt.Expression) => {
      if (expression instanceof Fmt.DefinitionRefExpression) {
        let path = expression.path;
        while (path.parentPath instanceof Fmt.Path) {
          path = path.parentPath;
        }
        this.addToPathAliases(path, paths);
      }
    });
    this.disambiguatePathAliases(paths);
    let keys = [...paths.keys()];
    keys.sort();
    for (let name of keys) {
      for (let pathInfo of paths.get(name)!) {
        if (pathInfo.occurrences > 1) {
          this.pathAliases.push(new Fmt.PathAlias(name, pathInfo.path));
          break;
        }
      }
    }
  }

  private addToPathAliases(path: Fmt.PathItem | undefined, paths: Map<string, PathInfo[]>): void {
    if (path instanceof Fmt.NamedPathItem && path.parentPath) {
      let name = path.name;
      let pathInfos = paths.get(name);
      if (!pathInfos) {
        pathInfos = [];
        paths.set(name, pathInfos);
      }
      let pathWithoutArgs = new Fmt.NamedPathItem(path.name, path.parentPath);
      for (let pathInfo of pathInfos) {
        if (pathWithoutArgs.isEquivalentTo(pathInfo.path)) {
          pathInfo.occurrences++;
          return;
        }
      }
      pathInfos.push({
        path: pathWithoutArgs,
        occurrences: 1
      });
    }
  }

  private disambiguatePathAliases(paths: Map<string, PathInfo[]>): void {
    let adapted: boolean;
    do {
      adapted = false;
      for (let pathInfos of paths.values()) {
        let usedCount = 0;
        for (let pathInfo of pathInfos) {
          if (pathInfo.occurrences > 1) {
            usedCount++;
          }
        }
        let nameConflict = (usedCount > 1);
        for (let pathInfo of pathInfos.slice()) {
          if (nameConflict ? pathInfo.occurrences > 1 : pathInfo.occurrences === 1) {
            this.addToPathAliases(pathInfo.path.parentPath, paths);
            pathInfo.occurrences = 0;
            adapted = true;
          }
        }
        if (adapted) {
          // Restart because we need a new iterator.
          break;
        }
      }
    } while (adapted);
  }

  private findPathAlias(path: Fmt.PathItem): Fmt.PathAlias | undefined {
    if (path instanceof Fmt.NamedPathItem && path.parentPath && !(path.parentPath instanceof Fmt.Path)) {
      let pathWithoutArgs = new Fmt.NamedPathItem(path.name, path.parentPath);
      for (let pathAlias of this.pathAliases) {
        if (pathWithoutArgs.isEquivalentTo(pathAlias.path)) {
          return pathAlias;
        }
      }
    }
    return undefined;
  }

  writePath(path: Fmt.Path, indent?: IndentInfo, useAliases: boolean = false): void {
    let argumentListIndent = indent;
    let lastArgumentListIndent = indent;
    if (this.hasArguments(path.parentPath)) {
      argumentListIndent = this.indent(indent);
      lastArgumentListIndent = this.indent(indent, true);
    }
    this.writeFullPath(path, argumentListIndent, lastArgumentListIndent, useAliases);
  }

  private hasArguments(pathItem: Fmt.PathItem | undefined): boolean {
    if (pathItem instanceof Fmt.Path) {
      if (pathItem.arguments.length) {
        return true;
      }
      return this.hasArguments(pathItem.parentPath);
    } else {
      return false;
    }
  }

  private writeFullPath(path: Fmt.Path, argumentListIndent?: IndentInfo, lastArgumentListIndent?: IndentInfo, useAliases: boolean = false): void {
    this.writeRange(path, false, false, false, false, () => {
      if (path.parentPath instanceof Fmt.Path) {
        this.writeFullPath(path.parentPath, argumentListIndent, argumentListIndent, useAliases);
        this.write('.');
        this.writeIdentifier(path.name, path, true);
      } else {
        this.writePathItem(path, true, useAliases);
      }
      this.writeOptionalArgumentList(path.arguments, lastArgumentListIndent);
    });
  }

  writePathItem(path: Fmt.PathItem, isLinkRange: boolean, useAliases: boolean): void {
    this.writeRange(path, false, isLinkRange, false, false, () => {
      let pathAlias = useAliases ? this.findPathAlias(path) : undefined;
      if (pathAlias) {
        this.write('~');
        this.writeIdentifier(pathAlias.name, path, false);
      } else {
        if (path.parentPath) {
          this.writePathItem(path.parentPath, false, useAliases);
          this.write('/');
        }
        if (path instanceof Fmt.IdentityPathItem) {
          this.write('.');
        } else if (path instanceof Fmt.ParentPathItem) {
          this.write('..');
        } else if (path instanceof Fmt.NamedPathItem) {
          this.writeIdentifier(path.name, path, false);
        } else {
          this.error('Unsupported path item type');
        }
      }
    });
  }

  writeFileContents(file: Fmt.File, indent?: IndentInfo): void {
    if (this.pathAliases.length) {
      this.writePathAliasList(indent);
      this.writeNewLine();
      this.writeNewLine(true);
    }
    this.writeDefinitions(file.definitions, indent);
  }

  private writePathAliasList(indent?: IndentInfo): void {
    this.write('[');
    this.writePathAliases(indent);
    this.write(']');
  }

  private writePathAliases(indent?: IndentInfo): void {
    let aliasIndent = this.indent(indent);
    let first = true;
    for (let pathAlias of this.pathAliases) {
      if (first) {
        first = false;
        this.writeNewLine();
      } else {
        this.write(',');
        this.writeNewLine(true);
      }
      this.writeIndent(aliasIndent);
      this.writePathAlias(pathAlias);
    }
    this.writeNewLine();
    if (indent) {
      this.write(indent.outerIndent);
    }
  }

  private writePathAlias(pathAlias: Fmt.PathAlias): void {
    this.writeRange(pathAlias, false, false, false, false, () => {
      this.writeRange(pathAlias, false, false, true, false, () => {
        this.write('$~');
        this.writeIdentifier(pathAlias.name, pathAlias, false);
      });
      this.writeOptionalSpace();
      this.write('=');
      this.writeOptionalSpace();
      this.write('$');
      this.writePathItem(pathAlias.path, true, false);
    });
  }

  writeDefinitions(definitions: Fmt.Definition[], indent?: IndentInfo): void {
    let first = true;
    for (let definition of definitions) {
      if (first) {
        first = false;
      } else {
        this.writeNewLine(true);
      }
      this.writeIndent(indent);
      this.writeDefinition(definition, indent);
    }
  }

  writeDefinition(definition: Fmt.Definition, indent?: IndentInfo): void {
    if (definition.documentation && this.newLineStr) {
      this.writeDocumentationComment(definition.documentation, indent);
    }
    this.writeRange(definition, false, false, false, false, () => {
      this.writeRange(definition, false, false, false, true, () => {
        this.writeRange(definition, false, false, true, false, () => {
          this.write('$');
          this.writeIdentifier(definition.name, definition, false);
        });
        this.writeOptionalParameterList(definition.parameters, indent);
        this.writeType(definition.type, indent);
      });
      this.writeOptionalSpace();
      this.write('{');
      let args: Fmt.ArgumentList | undefined = undefined;
      if (definition.contents) {
        args = definition.contents.toArgumentList(true);
      }
      if (definition.innerDefinitions.length || (args && args.length)) {
        this.writeNewLine();
        let innerIndent = this.indent(indent);
        this.writeDefinitions(definition.innerDefinitions, innerIndent);
        if (args && args.length) {
          if (definition.innerDefinitions.length) {
            this.writeNewLine(true);
          }
          this.writeArguments(args, innerIndent, true);
        }
        this.writeIndent(indent);
      }
      this.write('}');
    });
    this.writeNewLine();
  }

  writeParameterList(parameters: Fmt.ParameterList, indent?: IndentInfo): void {
    this.writeRange(parameters, false, false, false, false, () => {
      this.write('(');
      this.writeParameters(parameters, indent);
      this.write(')');
    });
  }

  writeOptionalParameterList(parameters: Fmt.ParameterList, indent?: IndentInfo): void {
    if (parameters.length) {
      this.writeParameterList(parameters, indent);
    }
  }

  writeParameters(parameters: Fmt.ParameterList, indent?: IndentInfo): void {
    let groupIndent = indent;
    let multiLine = (this.newLineStr.length > 0
                     && parameters.length > 1
                     && parameters.some((param: Fmt.Parameter) => this.isLargeParameter(param, false)));
    let currentGroup: Fmt.Parameter[] = [];
    let firstGroup = true;
    for (let parameter of parameters) {
      if (this.skipOmittableParameters && parameter.type instanceof Fmt.MetaRefExpression && parameter.type.canOmit()) {
        continue;
      }
      if (currentGroup.length && (parameter.type !== currentGroup[0].type || parameter.defaultValue !== currentGroup[0].defaultValue)) {
        if (firstGroup && multiLine) {
          groupIndent = this.indent(groupIndent);
        }
        this.writeParameterGroupWithPrefix(currentGroup, groupIndent, multiLine, !firstGroup);
        currentGroup.length = 0;
        firstGroup = false;
      }
      currentGroup.push(parameter);
    }
    if (firstGroup) {
      multiLine = false;
    }
    if (currentGroup.length) {
      this.writeParameterGroupWithPrefix(currentGroup, groupIndent, multiLine, !firstGroup);
    }
    if (multiLine) {
      this.writeNewLine();
      if (indent) {
        this.write(indent.outerIndent);
      }
    }
  }

  writeParameterGroupWithPrefix(parameters: Fmt.Parameter[], indent?: IndentInfo, multiLine: boolean = false, prependComma: boolean = false): void {
    if (prependComma) {
      this.write(',');
      if (!multiLine) {
        this.writeOptionalSpace();
      }
    }
    if (multiLine) {
      this.writeNewLine();
      this.writeIndent(indent);
    }
    this.writeParameterGroup(parameters, indent);
  }

  writeParameterGroup(parameters: Fmt.Parameter[], indent?: IndentInfo): void {
    this.writeRanges(parameters, () => {
      parameters.forEach((parameter: Fmt.Parameter, index: number) => {
        this.writeIdentifier(parameter.name, parameter, false);
        if (parameter.dependencies) {
          this.write('[');
          this.writeExpressions(parameter.dependencies, indent);
          this.write(']');
        }
        if (parameter.list) {
          this.write('...');
        }
        if (parameter.optional) {
          this.write('?');
        }
        if (index === parameters.length - 1) {
          this.writeType(parameter.type, indent);
          if (parameter.defaultValue) {
            this.writeOptionalSpace();
            this.write('=');
            this.writeOptionalSpace();
            this.writeExpression(parameter.defaultValue, indent);
          }
        } else {
          this.write(',');
        }
      });
    });
  }

  writeParameter(parameter: Fmt.Parameter, indent?: IndentInfo): void {
    this.writeParameterGroup([parameter], indent);
  }

  writeArgumentList(args: Fmt.ArgumentList, indent?: IndentInfo): void {
    this.writeRange(args, false, false, false, false, () => {
      this.write('(');
      this.writeArguments(args, indent);
      this.write(')');
    });
  }

  writeOptionalArgumentList(args: Fmt.ArgumentList, indent?: IndentInfo): void {
    if (args.length) {
      this.writeArgumentList(args, indent);
    }
  }

  writeArguments(args: Fmt.ArgumentList, indent?: IndentInfo, blockMode: boolean = false, compoundExpression: boolean = false): void {
    let argIndent = indent;
    if (!this.newLineStr) {
      blockMode = false;
    }
    let multiLine = true;
    if (!blockMode) {
      multiLine = (this.newLineStr.length > 0
                   && args.length > 1
                   && args.some((arg: Fmt.Argument) => this.isLargeArgument(arg, compoundExpression)));
      if (multiLine) {
        argIndent = this.indent(argIndent);
      }
    }
    let index = 0;
    let prevArg: Fmt.Argument | undefined = undefined;
    for (let arg of args) {
      let newLine = (multiLine
                     && (blockMode
                         || !prevArg
                         || this.isLargeArgument(prevArg)
                         || this.isLargeArgument(arg)));
      if (index) {
        this.write(',');
        if (!newLine) {
          this.writeOptionalSpace();
        }
      }
      if (newLine) {
        if (index || !blockMode) {
          this.writeNewLine();
        }
        this.writeIndent(argIndent);
      }
      this.writeArgument(arg, argIndent);
      index++;
      prevArg = arg;
    }
    if (multiLine) {
      this.writeNewLine();
      if (indent && !blockMode) {
        this.write(indent.outerIndent);
      }
    }
  }

  writeArgument(arg: Fmt.Argument, indent?: IndentInfo): void {
    this.writeRange(arg, false, false, false, false, () => {
      if (arg.name) {
        this.writeIdentifier(arg.name, arg, true);
        this.writeOptionalSpace();
        this.write('=');
        this.writeOptionalSpace();
      }
      this.writeExpression(arg.value, indent);
    });
  }

  writeType(type: Fmt.Expression, indent?: IndentInfo): void {
    this.write(':');
    this.writeOptionalSpace();
    this.writeExpression(type, indent);
  }

  writeExpressions(expressions: Fmt.Expression[], indent?: IndentInfo, maxLineLength: number = 0): void {
    let expressionIndent = indent;
    if (expressions.length <= 1 || !this.newLineStr) {
      maxLineLength = 0;
    } else {
      expressionIndent = this.indent(expressionIndent);
    }
    let index = 0;
    let remainingLineLength = 0;
    for (let expression of expressions) {
      if (index) {
        this.write(',');
        if (remainingLineLength) {
          this.writeOptionalSpace();
        }
      }
      if (maxLineLength && !remainingLineLength) {
        this.writeNewLine();
        this.writeIndent(expressionIndent);
        remainingLineLength = maxLineLength;
      }
      this.writeExpression(expression, expressionIndent);
      index++;
      remainingLineLength--;
    }
    if (maxLineLength) {
      this.writeNewLine();
      if (indent) {
        this.write(indent.outerIndent);
      }
    }
  }

  writeExpressionList(expressions: Fmt.Expression[], indent?: IndentInfo): void {
    let maxLineLength = expressions.length > 10 ? 10 : 0;
    for (let item of expressions) {
      if (this.isLargeExpression(item)) {
        maxLineLength = 1;
        break;
      }
    }
    this.write('[');
    this.writeExpressions(expressions, indent, maxLineLength);
    this.write(']');
  }

  writeExpression(expression: Fmt.Expression, indent?: IndentInfo): void {
    this.writeRange(expression, false, false, false, false, () => {
      if (expression instanceof Fmt.IntegerExpression) {
        this.writeInteger(expression.value);
      } else if (expression instanceof Fmt.StringExpression) {
        this.writeString(expression.value, '\'', true);
      } else if (expression instanceof Fmt.VariableRefExpression) {
        this.writeIdentifier(expression.variable.name, expression, true);
      } else if (expression instanceof Fmt.MetaRefExpression) {
        this.writeRange(expression, false, false, true, false, () => {
          this.write('%');
          this.writeIdentifier(expression.getName(), expression, true);
        });
        let args = expression.toArgumentList();
        this.writeOptionalArgumentList(args, indent);
      } else if (expression instanceof Fmt.DefinitionRefExpression) {
        this.write('$');
        this.writePath(expression.path, indent, true);
      } else if (expression instanceof Fmt.ParameterExpression) {
        this.write('#');
        this.writeParameterList(expression.parameters, indent);
      } else if (expression instanceof Fmt.CompoundExpression) {
        this.write('{');
        this.writeArguments(expression.arguments, indent, false, true);
        this.write('}');
      } else if (expression instanceof Fmt.ArrayExpression) {
        this.writeExpressionList(expression.items, indent);
      } else if (expression instanceof Fmt.IndexedExpression) {
        this.writeExpression(expression.body);
        if (expression.arguments) {
          this.write('[');
          this.writeArguments(expression.arguments, indent);
          this.write(']');
        }
      } else if (expression instanceof Fmt.PlaceholderExpression) {
        if (this.allowPlaceholders) {
          this.write('?');
        } else {
          this.error('Object contains unfilled placeholder');
        }
      } else {
        this.error('Unsupported expression type');
      }
    });
  }

  private isLargeExpression(expression: Fmt.Expression): boolean {
    return ((expression instanceof Fmt.MetaRefExpression && (expression instanceof Fmt.GenericMetaRefExpression ? expression.arguments.length !== 0 : Object.keys(expression).length !== 0))
            || (expression instanceof Fmt.DefinitionRefExpression && (expression.path.arguments.length !== 0 || (expression.path.parentPath !== undefined && !this.findPathAlias(expression.path))))
            || expression instanceof Fmt.ParameterExpression
            || expression instanceof Fmt.CompoundExpression
            || expression instanceof Fmt.ArrayExpression
            || (expression instanceof Fmt.IndexedExpression && ((expression.arguments !== undefined && expression.arguments.length > 0) || this.isLargeExpression(expression.body))));
  }

  private isLongName(name: string): boolean {
    while (name.endsWith('\'')) {
      name = name.substring(0, name.length - 1);
    }
    return name.length > 1 && String.fromCodePoint(name.codePointAt(0)!) !== name;
  }

  private isLargeArgument(arg: Fmt.Argument, checkName: boolean = true): boolean {
    if (checkName && arg.name && this.isLongName(arg.name)) {
      return true;
    }
    return this.isLargeExpression(arg.value);
  }

  private isLargeParameter(param: Fmt.Parameter, checkName: boolean = true): boolean {
    if (checkName && this.isLongName(param.name)) {
      return true;
    }
    return (this.isLargeExpression(param.type)
            || (param.dependencies !== undefined && param.dependencies.some((dependency: Fmt.Expression) => this.isLargeExpression(dependency)))
            || (param.defaultValue !== undefined && this.isLargeExpression(param.defaultValue)));
  }

  writeString(str: string, quoteChar: string, breakLines: boolean): void {
    if (!this.newLineStr) {
      breakLines = false;
    }
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

  writeInteger(value: Fmt.BN): void {
    this.write(value.toString());
  }

  writeIdentifier(identifier: string, object: Object, isLinkRange: boolean): void {
    this.writeRange(object, true, isLinkRange, false, false, () => {
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
    });
  }

  writeDocumentationComment(documentationComment: Fmt.DocumentationComment, indent?: IndentInfo): void {
    this.writeRange(documentationComment, false, false, false, false, () => {
      this.write('/**');
      let prevItem: Fmt.DocumentationItem | undefined = undefined;
      let needEmptyLine = false;
      for (let item of documentationComment.items) {
        if (prevItem
            && (!item.kind
                || item.kind !== prevItem.kind
                || prevItem.text.indexOf('\n') >= 0
                || item.text.indexOf('\n') >= 0)) {
          needEmptyLine = true;
        }
        if (needEmptyLine) {
          this.writeNewLine();
          this.writeIndent(indent);
          this.write(' *');
          needEmptyLine = false;
        }
        this.writeNewLine();
        this.writeRange(item, false, false, false, false, () => {
          this.writeIndent(indent);
          this.write(' *');
          if (item.kind) {
            this.write(' ');
            this.writeRange(item, false, false, true, false, () => {
              this.write('@');
              this.write(item.kind!);
            });
          }
          if (item.parameter) {
            this.write(' ');
            this.writeIdentifier(item.parameter.name, item, true);
          }
          let indentLength = this.lineLength + 1;
          let textLine = '';
          for (let c of item.text.trim()) {
            if (c === '\r') {
              // ignore
            } else if (c === '\n') {
              textLine = textLine;
              if (textLine.startsWith('@')) {
                textLine = textLine.substring(1);
              }
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
          textLine = textLine;
          if (textLine) {
            if (indentLength > this.lineLength) {
              this.write(' '.repeat(indentLength - this.lineLength));
            }
            this.write(textLine);
          }
        });
        prevItem = item;
      }
      this.writeNewLine();
      this.writeIndent(indent);
      this.write(' */');
    });
    this.writeNewLine();
    this.writeIndent(indent);
  }

  write(str: string): void {
    this.stream.write(str);
    this.lineLength += str.length;
  }

  writeNewLine(writeSpaceIfSingleLine: boolean = false): void {
    if (this.newLineStr) {
      this.stream.write(this.newLineStr);
      this.lineLength = 0;
    } else if (writeSpaceIfSingleLine) {
      this.write(' ');
    }
  }

  writeOptionalSpace(): void {
    this.write(this.spaceStr);
  }

  private writeIndent(indent: IndentInfo | undefined): void {
    if (indent) {
      this.write(indent.indent);
    }
  }

  private indent(indent: IndentInfo | undefined, keepOuterIndent: boolean = false): IndentInfo | undefined {
    if (indent) {
      let newIndent = indent.indent + this.indentStr;
      return {
        indent: newIndent,
        outerIndent: keepOuterIndent ? indent.outerIndent : newIndent
      };
    } else {
      return undefined;
    }
  }

  private writeRange(object: Object, name: boolean, link: boolean, tag: boolean, signature: boolean, fn: () => void): void {
    if (this.stream.startRange) {
      this.stream.startRange(object, name, link, tag, signature);
    }
    try {
      fn();
    } finally {
      if (this.stream.endRange) {
        this.stream.endRange();
      }
    }
  }

  private writeRanges(objects: Object[], fn: () => void): void {
    if (objects.length) {
      this.writeRange(objects[0], false, false, false, false, () =>
        this.writeRanges(objects.slice(1), fn));
    } else {
      fn();
    }
  }

  private error(message: string): void {
    this.stream.error(message);
  }
}


export function writeStream(file: Fmt.File, stream: OutputStream, allowPlaceholders: boolean = false): void {
  let writer = new Writer(stream, allowPlaceholders);
  writer.writeFile(file);
}

export function writeString(file: Fmt.File, allowPlaceholders: boolean = false): string {
  let stream = new StringOutputStream;
  writeStream(file, stream, allowPlaceholders);
  return stream.str;
}
