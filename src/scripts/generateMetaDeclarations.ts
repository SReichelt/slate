import * as fs from 'fs';
import * as Fmt from 'slate-shared/format/format';
import * as FmtMeta from 'slate-shared/format/meta';
import * as FmtReader from 'slate-shared/format/read';
import { translateMemberName } from 'slate-shared/format/common';

interface ReferencedMetaModel {
  inFileName: string;
  outFileName: string;
}

class MetaDeclarationGenerator {
  private visibleTypeNames: string[] = [];

  constructor(private inFile: Fmt.File) {}

  private isVisibleType(definition: Fmt.Definition): boolean {
    return this.visibleTypeNames.indexOf(definition.name) >= 0;
  }

  private getSuperName(definition: Fmt.Definition): string | undefined {
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
      let superType = definition.contents.superType;
      if (superType instanceof Fmt.DefinitionRefExpression && !superType.path.parentPath) {
        return superType.path.name;
      }
    }
    return undefined;
  }

  private getSuperDefinition(definition: Fmt.Definition): Fmt.Definition | undefined {
    let superName = this.getSuperName(definition);
    if (superName) {
      return this.inFile.definitions.getDefinition(superName);
    } else {
      return undefined;
    }
  }

  private hasObjectContents(definition: Fmt.Definition): boolean {
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinitionType
        || (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members)) {
      return true;
    } else {
      let superDefinition = this.getSuperDefinition(definition);
      if (superDefinition) {
        return this.hasObjectContents(superDefinition);
      } else {
        return false;
      }
    }
  }

  private getMemberCount(definition: Fmt.Definition): number {
    let result = 0;
    let superDefinition = this.getSuperDefinition(definition);
    if (superDefinition) {
      result += this.getMemberCount(superDefinition);
    }
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      result += definition.contents.members.length;
    }
    return result;
  }

  private getMemberIndex(definition: Fmt.Definition, member: Fmt.Parameter): number | undefined {
    let superDefinition = this.getSuperDefinition(definition);
    if (superDefinition) {
      let result = this.getMemberIndex(superDefinition, member);
      if (result !== undefined) {
        return result;
      }
    }
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      let result = definition.contents.members.indexOf(member);
      if (result >= 0) {
        return result;
      }
    }
    return undefined;
  }

  private getAllMembers(definition: Fmt.Definition): Fmt.Parameter[] {
    let result: Fmt.Parameter[];
    let superDefinition = this.getSuperDefinition(definition);
    if (superDefinition) {
      result = this.getAllMembers(superDefinition);
    } else {
      result = [];
    }
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      result.push(...definition.contents.members);
    }
    return result;
  }

  private getMemberContentType(type: Fmt.Expression): string | undefined {
    if (type instanceof Fmt.MetaRefExpression) {
      if (type instanceof FmtMeta.MetaRefExpression_Int) {
        return 'BigInt';
      } else if (type instanceof FmtMeta.MetaRefExpression_String) {
        return 'string';
      } else if (type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
        return 'Fmt.Parameter';
      } else if (type instanceof FmtMeta.MetaRefExpression_ParameterList) {
        return 'Fmt.ParameterList';
      } else if (type instanceof FmtMeta.MetaRefExpression_ArgumentList) {
        return 'Fmt.ArgumentList';
      }
    } else if (type instanceof Fmt.DefinitionRefExpression) {
      let path = type.path;
      if (!path.parentPath) {
        let definition = this.inFile.definitions.getDefinition(path.name);
        if (definition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(definition)) {
          return `ObjectContents_${definition.name}`;
        }
      }
    }
    return undefined;
  }

  private getMemberType(type: Fmt.Expression): string {
    if (type instanceof Fmt.IndexedExpression) {
      return this.getMemberType(type.body) + '[]';
    } else {
      return this.getMemberContentType(type) ?? 'Fmt.Expression';
    }
  }

  private getParameterMemberType(parameter: Fmt.Parameter): string {
    let memberType = this.getMemberType(parameter.type);
    if (parameter.list) {
      memberType += '[]';
    }
    return memberType;
  }

  private getEffectiveType(type: Fmt.Expression, list: boolean = false): Fmt.Expression {
    if (type instanceof Fmt.IndexedExpression) {
      let bodyType = this.getEffectiveType(type.body);
      if (bodyType instanceof Fmt.PlaceholderExpression) {
        type = bodyType;
      }
    }
    if (list) {
      return new Fmt.IndexedExpression(type);
    } else {
      return type;
    }
  }

  private makeUniqueName(name: string, type: Fmt.Expression) {
    if (type instanceof Fmt.IndexedExpression) {
      let index = 0;
      do {
        index++;
        type = type.body;
      } while (type instanceof Fmt.IndexedExpression);
      return name + index;
    } else {
      return name;
    }
  }

  private outputReadConvCode(argName: string, source: string, target: string, type: Fmt.Expression, targetIsList: boolean, indent: string): string {
    let outFileStr = '';
    let outputBegin = targetIsList ? `${target}.push(` : `${target} = `;
    let outputEnd = targetIsList ? `)` : '';
    if (type instanceof Fmt.IndexedExpression) {
      outFileStr += `${indent}if (${source} instanceof Fmt.ArrayExpression) {\n`;
      if (type.body instanceof Fmt.IndexedExpression || this.getMemberContentType(type.body)) {
        let subTarget = target;
        if (targetIsList) {
          subTarget = this.makeUniqueName('newItem', type);
          outFileStr += `${indent}  let ${subTarget} = [];\n`;
        } else {
          outFileStr += `${indent}  ${target} = [];\n`;
        }
        let item = this.makeUniqueName('item', type.body);
        outFileStr += `${indent}  for (let ${item} of ${source}.items) {\n`;
        outFileStr += this.outputReadConvCode(argName, item, subTarget, type.body, true, `${indent}    `);
        outFileStr += `${indent}  }\n`;
        if (targetIsList) {
          outFileStr += `${indent}  ${outputBegin}${subTarget}${outputEnd};\n`;
        }
      } else {
        outFileStr += `${indent}  ${outputBegin}${source}.items${outputEnd};\n`;
      }
      outFileStr += `${indent}} else {\n`;
      outFileStr += `${indent}  throw new Error('${argName}: Array expression expected');\n`;
      outFileStr += `${indent}}\n`;
    } else if (type instanceof Fmt.MetaRefExpression) {
      if (type instanceof FmtMeta.MetaRefExpression_Int) {
        outFileStr += `${indent}if (${source} instanceof Fmt.IntegerExpression) {\n`;
        outFileStr += `${indent}  ${outputBegin}${source}.value${outputEnd};\n`;
        outFileStr += `${indent}} else {\n`;
        outFileStr += `${indent}  throw new Error('${argName}: Integer expected');\n`;
        outFileStr += `${indent}}\n`;
      } else if (type instanceof FmtMeta.MetaRefExpression_String) {
        outFileStr += `${indent}if (${source} instanceof Fmt.StringExpression) {\n`;
        outFileStr += `${indent}  ${outputBegin}${source}.value${outputEnd};\n`;
        outFileStr += `${indent}} else {\n`;
        outFileStr += `${indent}  throw new Error('${argName}: String expected');\n`;
        outFileStr += `${indent}}\n`;
      } else if (type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
        outFileStr += `${indent}if (${source} instanceof Fmt.ParameterExpression && ${source}.parameters.length === 1) {\n`;
        outFileStr += `${indent}  ${outputBegin}${source}.parameters[0]${outputEnd};\n`;
        outFileStr += `${indent}} else {\n`;
        outFileStr += `${indent}  throw new Error('${argName}: Parameter expression with single parameter expected');\n`;
        outFileStr += `${indent}}\n`;
      } else if (type instanceof FmtMeta.MetaRefExpression_ParameterList) {
        outFileStr += `${indent}if (${source} instanceof Fmt.ParameterExpression) {\n`;
        outFileStr += `${indent}  ${outputBegin}${source}.parameters${outputEnd};\n`;
        outFileStr += `${indent}} else {\n`;
        outFileStr += `${indent}  throw new Error('${argName}: Parameter expression expected');\n`;
        outFileStr += `${indent}}\n`;
      } else if (type instanceof FmtMeta.MetaRefExpression_ArgumentList) {
        outFileStr += `${indent}if (${source} instanceof Fmt.CompoundExpression) {\n`;
        outFileStr += `${indent}  ${outputBegin}${source}.arguments${outputEnd};\n`;
        outFileStr += `${indent}} else {\n`;
        outFileStr += `${indent}  throw new Error('${argName}: Compound expression expected');\n`;
        outFileStr += `${indent}}\n`;
      }
    } else if (type instanceof Fmt.DefinitionRefExpression) {
      let path = type.path;
      if (!path.parentPath) {
        let definition = this.inFile.definitions.getDefinition(path.name);
        if (definition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(definition)) {
          let subTarget = this.makeUniqueName('newItem', type);
          outFileStr += `${indent}let ${subTarget} = ObjectContents_${definition.name}.createFromExpression(${source}, reportFn);\n`;
          outFileStr += `${indent}${outputBegin}${subTarget}${outputEnd};\n`;
          outFileStr += `${indent}reportFn?.(${source}, ${subTarget});\n`;
        }
      }
    }
    if (!outFileStr) {
      outFileStr = `${indent}${outputBegin}${source}${outputEnd};\n`;
    }
    return outFileStr;
  }

  private outputReadCode(argName: string, argIndex: number, target: string, type: Fmt.Expression, optional: boolean, list: boolean, indent: string): string {
    let outFileStr = '';
    let variableName = argName + 'Raw';
    if (list) {
      if (optional) {
        outFileStr += `${indent}if (${target}) {\n`;
        outFileStr += `${indent}  ${target} = undefined;\n`;
        outFileStr += `${indent}}\n`;
      } else {
        outFileStr += `${indent}${target} = [];\n`;
      }
      outFileStr += `${indent}let index = ${argIndex};\n`;
      outFileStr += `${indent}for (;;) {\n`;
      outFileStr += `${indent}  let ${variableName} = argumentList.getOptionalValue(undefined, index);\n`;
      outFileStr += `${indent}  if (${variableName} === undefined) {\n`;
      outFileStr += `${indent}    break;\n`;
      outFileStr += `${indent}  }\n`;
      if (optional) {
        outFileStr += `${indent}  if (!${target}) {\n`;
        outFileStr += `${indent}    ${target} = [];\n`;
        outFileStr += `${indent}  }\n`;
      }
      outFileStr += this.outputReadConvCode(argName, variableName, `${target}`, type, true, `${indent}  `);
      outFileStr += `${indent}  index++;\n`;
      outFileStr += `${indent}}\n`;
    } else {
      if (type instanceof Fmt.IndexedExpression || this.getMemberContentType(type)) {
        outFileStr += `${indent}let ${variableName} = argumentList.get${optional ? 'Optional' : ''}Value('${argName}', ${argIndex});\n`;
        if (optional) {
          outFileStr += `${indent}if (${variableName} !== undefined) {\n`;
          outFileStr += this.outputReadConvCode(argName, variableName, `${target}`, type, false, `${indent}  `);
          outFileStr += `${indent}}\n`;
        } else {
          outFileStr += this.outputReadConvCode(argName, variableName, `${target}`, type, false, indent);
        }
      } else {
        outFileStr += `${indent}${target} = argumentList.get${optional ? 'Optional' : ''}Value('${argName}', ${argIndex});\n`;
      }
    }
    return outFileStr;
  }

  private outputWriteConvCode(argName: string, source: string, target: string, type: Fmt.Expression, optional: boolean, list: boolean, named: number, targetIsList: boolean, indent: string): string {
    let outFileStr = '';
    if (list) {
      let item = argName + 'Arg';
      outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
      outFileStr += this.outputWriteConvCode(argName, item, target, type, true, false, 0, targetIsList, `${indent}  `);
      outFileStr += `${indent}}\n`;
    } else {
      let argNameCode = named > 1 ? `'${argName}'` : named > 0 ? `outputAllNames ? '${argName}' : undefined` : 'undefined';
      let outputBegin = targetIsList ? `${target}.push(` : `${target}.push(new Fmt.Argument(${argNameCode}, `;
      let outputEnd = targetIsList ? `)` : `, ${optional}))`;
      let variableName = argName + 'Expr';
      if (targetIsList) {
        variableName = this.makeUniqueName('newItem', type);
      }
      if (type instanceof Fmt.IndexedExpression) {
        let subTarget = `${variableName}Items`;
        outFileStr += `${indent}let ${subTarget}: Fmt.Expression[] = [];\n`;
        let item = this.makeUniqueName('item', type.body);
        outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
        outFileStr += this.outputWriteConvCode(argName, item, subTarget, type.body, true, false, 0, true, `${indent}  `);
        outFileStr += `${indent}}\n`;
        outFileStr += `${indent}let ${variableName} = new Fmt.ArrayExpression(${subTarget});\n`;
        outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
      } else if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof FmtMeta.MetaRefExpression_Int) {
          outFileStr += `${indent}let ${variableName} = new Fmt.IntegerExpression(${source});\n`;
          outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
        } else if (type instanceof FmtMeta.MetaRefExpression_String) {
          outFileStr += `${indent}let ${variableName} = new Fmt.StringExpression(${source});\n`;
          outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
        } else if (type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
          outFileStr += `${indent}let ${variableName} = new Fmt.ParameterExpression(new Fmt.ParameterList(${source}));\n`;
          outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
        } else if (type instanceof FmtMeta.MetaRefExpression_ParameterList) {
          outFileStr += `${indent}let ${variableName} = new Fmt.ParameterExpression(${source});\n`;
          outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
        } else if (type instanceof FmtMeta.MetaRefExpression_ArgumentList) {
          outFileStr += `${indent}let ${variableName} = new Fmt.CompoundExpression(${source});\n`;
          outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
        }
      } else if (type instanceof Fmt.DefinitionRefExpression) {
        let path = type.path;
        if (!path.parentPath) {
          let definition = this.inFile.definitions.getDefinition(path.name);
          if (definition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(definition)) {
            outFileStr += `${indent}let ${variableName} = ${source}.toExpression(true, reportFn);\n`;
            outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
            outFileStr += `${indent}reportFn?.(${variableName}, ${source});\n`;
          }
        }
      }
      if (!outFileStr) {
        outFileStr = `${indent}${outputBegin}${source}${outputEnd};\n`;
      }
    }
    return outFileStr;
  }

  private outputWriteCode(argName: string, source: string, type: Fmt.Expression, optional: boolean, list: boolean, named: number, indent: string): string {
    let outFileStr = '';
    if (optional) {
      outFileStr += `${indent}if (${source} !== undefined) {\n`;
      outFileStr += this.outputWriteConvCode(argName, source, 'argumentList', type, optional, list, named, false, `${indent}  `);
      outFileStr += `${indent}}\n`;
    } else {
      outFileStr += this.outputWriteConvCode(argName, source, 'argumentList', type, optional, list, named, false, indent);
    }
    return outFileStr;
  }

  private canOmitBraces(definition: Fmt.Definition): boolean {
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && !definition.contents.superType && definition.contents.members && definition.contents.members.length) {
      let first = true;
      for (let member of definition.contents.members) {
        if (first) {
          if (member.optional || this.getMemberContentType(member.type) || member.type instanceof Fmt.IndexedExpression) {
            return false;
          }
          first = false;
        } else {
          if (!member.optional) {
            return false;
          }
        }
      }
      return true;
    } else {
      return false;
    }
  }

  private outputTraversalCode(source: string, type: Fmt.Expression, indent: string): string {
    let outFileStr = '';
    if (type instanceof Fmt.IndexedExpression) {
      let item = this.makeUniqueName('item', type.body);
      outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
      outFileStr += this.outputTraversalCode(item, type.body, `${indent}  `);
      outFileStr += `${indent}}\n`;
    } else {
      outFileStr += `${indent}${source}.traverse(fn);\n`;
    }
    return outFileStr;
  }

  private outputSubstitutionCode(source: string, target: string, type: Fmt.Expression, defineTarget: boolean, targetIsList: boolean, listInitRequired: boolean, indent: string): string {
    let outFileStr = '';
    let subTarget = target;
    let init = target;
    if (targetIsList) {
      subTarget = this.makeUniqueName('newItem', type);
      init = `let ${subTarget}`;
    } else if (defineTarget) {
      init = `let ${init}`;
    }
    if (type instanceof Fmt.IndexedExpression) {
      if (listInitRequired) {
        if (targetIsList || defineTarget) {
          init += `: ${this.getMemberType(type)}`;
        }
        outFileStr += `${indent}${init} = [];\n`;
      }
      let item = this.makeUniqueName('item', type.body);
      outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
      outFileStr += this.outputSubstitutionCode(item, subTarget, type.body, false, true, true, `${indent}  `);
      outFileStr += `${indent}}\n`;
    } else {
      let contentType = this.getMemberContentType(type);
      if (contentType && !contentType.startsWith('Fmt.')) {
        if (targetIsList || defineTarget) {
          init += `: ${contentType}`;
        }
        outFileStr += `${indent}${init} = Object.create(${contentType}.prototype) as ${contentType};\n`;
        outFileStr += `${indent}if (${source}.substitute(fn, ${subTarget}, replacedParameters)) {\n`;
        outFileStr += `${indent}  changed = true;\n`;
        outFileStr += `${indent}}\n`;
      } else {
        outFileStr += `${indent}${init} = ${source}.substitute(fn, replacedParameters);\n`;
        outFileStr += `${indent}if (${subTarget} !== ${source}) {\n`;
        outFileStr += `${indent}  changed = true;\n`;
        outFileStr += `${indent}}\n`;
      }
    }
    if (targetIsList) {
      outFileStr += `${indent}${target}.push(${subTarget});\n`;
    }
    return outFileStr;
  }

  private outputComparisonCode(left: string, right: string, type: Fmt.Expression, indent: string): string {
    let outFileStr = '';
    if (type instanceof Fmt.IndexedExpression) {
      let index = this.makeUniqueName('i', type.body);
      let leftItem = this.makeUniqueName('leftItem', type.body);
      let rightItem = this.makeUniqueName('rightItem', type.body);
      outFileStr += `${indent}if (${left} || ${right}) {\n`;
      outFileStr += `${indent}  if (!${left} || !${right} || ${left}.length !== ${right}.length) {\n`;
      outFileStr += `${indent}    return false;\n`;
      outFileStr += `${indent}  }\n`;
      outFileStr += `${indent}  for (let ${index} = 0; ${index} < ${left}.length; ${index}++) {\n`;
      outFileStr += `${indent}    let ${leftItem} = ${left}[${index}];\n`;
      outFileStr += `${indent}    let ${rightItem} = ${right}[${index}];\n`;
      outFileStr += this.outputComparisonCode(leftItem, rightItem, type.body, `${indent}    `);
      outFileStr += `${indent}  }\n`;
      outFileStr += `${indent}}\n`;
    } else if (type instanceof FmtMeta.MetaRefExpression_Int || type instanceof FmtMeta.MetaRefExpression_String) {
      outFileStr += `${indent}if (${left} !== ${right}) {\n`;
      outFileStr += `${indent}  return false;\n`;
      outFileStr += `${indent}}\n`;
    } else {
      outFileStr += `${indent}if (!Fmt.areObjectsEquivalent(${left}, ${right}, fn, replacedParameters)) {\n`;
      outFileStr += `${indent}  return false;\n`;
      outFileStr += `${indent}}\n`;
    }
    return outFileStr;
  }

  private outputDefinitionList(list?: Fmt.Expression[], secondaryList?: Fmt.Expression[]): string {
    let outFileStr = `{`;
    if (list) {
      let first = true;
      for (let item of list) {
        if (item instanceof Fmt.DefinitionRefExpression && !item.path.parentPath) {
          if (first) {
            first = false;
          } else {
            outFileStr += `, `;
          }
          let name = item.path.name;
          outFileStr += `'${name}': MetaRefExpression_${name}`;
          if (this.visibleTypeNames.indexOf(name) < 0) {
            this.visibleTypeNames.push(name);
          }
        } else if (item instanceof FmtMeta.MetaRefExpression_Any) {
          if (secondaryList) {
            for (let secondaryItem of secondaryList) {
              if (secondaryItem instanceof Fmt.DefinitionRefExpression && !secondaryItem.path.parentPath) {
                if (first) {
                  first = false;
                } else {
                  outFileStr += `, `;
                }
                let name = secondaryItem.path.name;
                outFileStr += `'${name}': MetaRefExpression_${name}`;
                if (this.visibleTypeNames.indexOf(name) < 0) {
                  this.visibleTypeNames.push(name);
                }
              }
            }
          }
          if (first) {
            first = false;
          } else {
            outFileStr += `, `;
          }
          outFileStr += `'': null`;
        }
      }
    }
    outFileStr += `}`;
    return outFileStr;
  }

  private addVisibleTypes(list?: Fmt.Expression[], secondaryList?: Fmt.Expression[]): void {
    this.outputDefinitionList(list, secondaryList);
  }

  private outputDeclarations(): string {
    let outFileStr = '';
    for (let definition of this.inFile.definitions) {
      if (definition.type instanceof FmtMeta.MetaRefExpression_MetaModel) {
        continue;
      }
      if (this.hasObjectContents(definition)) {
        outFileStr += this.outputObjectContents(definition);
      }
      if (this.isVisibleType(definition)) {
        outFileStr += this.outputMetaRefExpression(definition);
      }
    }
    return outFileStr;
  }

  private outputObjectContents(definition: Fmt.Definition): string {
    let outFileStr = '';
    let superDefinition = this.getSuperDefinition(definition);
    if (superDefinition && !this.hasObjectContents(superDefinition)) {
      superDefinition = undefined;
    }
    let superClass = superDefinition ? `ObjectContents_${superDefinition.name}` : `Fmt.ObjectContents`;
    outFileStr += `export class ObjectContents_${definition.name} extends ${superClass} {\n`;
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      outFileStr += this.outputConstructor(definition.contents.members, superDefinition ? this.getAllMembers(superDefinition) : []);
      outFileStr += `\n`;
    }
    outFileStr += `  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_${definition.name} {\n`;
    outFileStr += `    let result: ObjectContents_${definition.name} = Object.create(ObjectContents_${definition.name}.prototype);\n`;
    outFileStr += `    result.fromArgumentList(argumentList, reportFn);\n`;
    outFileStr += `    return result;\n`;
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {\n`;
    if (superDefinition) {
      outFileStr += `    super.fromArgumentList(argumentList, reportFn);\n`;
    }
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      let argIndex = 0;
      if (superDefinition) {
        argIndex += this.getMemberCount(superDefinition);
      }
      for (let member of definition.contents.members) {
        let memberName = translateMemberName(member.name);
        let optional = member.optional || member.defaultValue !== undefined;
        outFileStr += this.outputReadCode(member.name, argIndex, `this.${memberName}`, member.type, optional, false, `    `);
        argIndex++;
      }
    }
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {\n`;
    if (superDefinition) {
      outFileStr += `    let argumentList = super.toArgumentList(outputAllNames, reportFn);\n`;
    } else {
      outFileStr += `    let argumentList = new Fmt.ArgumentList;\n`;
    }
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      let named = 1;
      for (let member of definition.contents.members) {
        let memberName = translateMemberName(member.name);
        let optional = member.optional || member.defaultValue !== undefined;
        if (optional) {
          named = 2;
        }
        outFileStr += this.outputWriteCode(member.name, `this.${memberName}`, member.type, optional, false, named, `    `);
      }
    }
    outFileStr += `    return argumentList;\n`;
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_${definition.name} {\n`;
    outFileStr += `    let result: ObjectContents_${definition.name} = Object.create(ObjectContents_${definition.name}.prototype);\n`;
    outFileStr += `    result.fromExpression(expression, reportFn);\n`;
    outFileStr += `    return result;\n`;
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    if (this.canOmitBraces(definition) && definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members && definition.contents.members.length) {
      let firstMemberName = translateMemberName(definition.contents.members[0].name);
      outFileStr += `  fromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): void {\n`;
      outFileStr += `    if (expression instanceof Fmt.CompoundExpression) {\n`;
      outFileStr += `      super.fromExpression(expression, reportFn);\n`;
      outFileStr += `    } else {\n`;
      outFileStr += `      this.${firstMemberName} = expression;\n`;
      outFileStr += `    }\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  toExpression(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.Expression {\n`;
      outFileStr += `    if (outputAllNames`;
      let first = true;
      for (let member of definition.contents.members) {
        let memberName = translateMemberName(member.name);
        if (first) {
          outFileStr += ` || this.${memberName} instanceof Fmt.CompoundExpression`;
          first = false;
        } else {
          outFileStr += ` || this.${memberName}`;
        }
      }
      outFileStr += `) {\n`;
      outFileStr += `      return super.toExpression(outputAllNames, reportFn);\n`;
      outFileStr += `    } else {\n`;
      outFileStr += `      return this.${firstMemberName};\n`;
      outFileStr += `    }\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
    }
    outFileStr += `  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_${definition.name} {\n`;
    outFileStr += `    let result: ObjectContents_${definition.name} = Object.create(ObjectContents_${definition.name}.prototype);\n`;
    outFileStr += `    this.substitute(undefined, result, replacedParameters);\n`;
    outFileStr += `    return result;\n`;
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  traverse(fn: Fmt.ExpressionTraversalFn): void {\n`;
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      for (let member of definition.contents.members) {
        let memberName = translateMemberName(member.name);
        if (!(member.type instanceof FmtMeta.MetaRefExpression_Int || member.type instanceof FmtMeta.MetaRefExpression_String)) {
          outFileStr += `    if (this.${memberName}) {\n`;
          outFileStr += this.outputTraversalCode(`this.${memberName}`, member.type, '      ');
          outFileStr += `    }\n`;
        }
      }
    }
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_${definition.name}, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {\n`;
    if (superDefinition) {
      outFileStr += `    let changed = super.substitute(fn, result, replacedParameters);\n`;
    } else {
      outFileStr += `    let changed = false;\n`;
    }
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      for (let member of definition.contents.members) {
        let memberName = translateMemberName(member.name);
        if (member.type instanceof FmtMeta.MetaRefExpression_Int || member.type instanceof FmtMeta.MetaRefExpression_String) {
          outFileStr += `    result.${memberName} = this.${memberName};\n`;
        } else {
          outFileStr += `    if (this.${memberName}) {\n`;
          outFileStr += this.outputSubstitutionCode(`this.${memberName}`, `result.${memberName}`, member.type, false, false, true, '      ');
          outFileStr += `    }\n`;
        }
      }
    }
    outFileStr += `    return changed;\n`;
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  isEquivalentTo(objectContents: ObjectContents_${definition.name}, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {\n`;
    outFileStr += `    if (this === objectContents && !replacedParameters.length) {\n`;
    outFileStr += `      return true;\n`;
    outFileStr += `    }\n`;
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
      for (let member of definition.contents.members) {
        let memberName = translateMemberName(member.name);
        outFileStr += this.outputComparisonCode(`this.${memberName}`, `objectContents.${memberName}`, member.type, '    ');
      }
    }
    if (superDefinition) {
      outFileStr += `    return super.isEquivalentTo(objectContents, fn, replacedParameters);\n`;
    } else {
      outFileStr += `    return true;\n`;
    }
    outFileStr += `  }\n`;
    outFileStr += `}\n\n`;
    return outFileStr;
  }

  private outputMetaRefExpression(definition: Fmt.Definition): string {
    let outFileStr = '';
    outFileStr += `export class MetaRefExpression_${definition.name} extends Fmt.MetaRefExpression {\n`;
    if (definition.parameters.length) {
      outFileStr += this.outputConstructor(definition.parameters);
      outFileStr += `\n`;
    }
    outFileStr += `  getName(): string {\n`;
    outFileStr += `    return '${definition.name}';\n`;
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {\n`;
    let argIndex = 0;
    for (let parameter of definition.parameters) {
      let memberName = translateMemberName(parameter.name);
      let optional = parameter.optional || parameter.defaultValue !== undefined;
      outFileStr += this.outputReadCode(parameter.name, argIndex, `this.${memberName}`, parameter.type, optional, parameter.list, `    `);
      argIndex++;
    }
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {\n`;
    outFileStr += `    let argumentList = new Fmt.ArgumentList;\n`;
    let named = 0;
    for (let parameter of definition.parameters) {
      let memberName = translateMemberName(parameter.name);
      let optional = parameter.optional || parameter.defaultValue !== undefined;
      if (optional && !parameter.list) {
        named = 2;
      }
      outFileStr += this.outputWriteCode(parameter.name, `this.${memberName}`, parameter.type, optional, parameter.list, named, `    `);
    }
    outFileStr += `    return argumentList;\n`;
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {\n`;
    if (definition.parameters.length) {
      outFileStr += `    let changed = false;\n`;
      for (let parameter of definition.parameters) {
        let memberName = translateMemberName(parameter.name);
        if (!(parameter.type instanceof FmtMeta.MetaRefExpression_Int || parameter.type instanceof FmtMeta.MetaRefExpression_String) || parameter.list) {
          let memberType = this.getParameterMemberType(parameter);
          let optional = parameter.optional || parameter.defaultValue !== undefined;
          if (optional) {
            if (parameter.list) {
              outFileStr += `    let ${memberName}Result: ${memberType} = [];\n`;
            } else {
              outFileStr += `    let ${memberName}Result: ${memberType} | undefined = undefined;\n`;
            }
            outFileStr += `    if (this.${memberName}) {\n`;
            outFileStr += this.outputSubstitutionCode(`this.${memberName}`, `${memberName}Result`, this.getEffectiveType(parameter.type, parameter.list), false, false, !parameter.list, `      `);
            outFileStr += `    }\n`;
          } else {
            outFileStr += this.outputSubstitutionCode(`this.${memberName}`, `${memberName}Result`, this.getEffectiveType(parameter.type, parameter.list), true, false, true, `    `);
          }
        }
      }
      outFileStr += `    if (fn && !changed) {\n`;
      outFileStr += `      return fn(this);\n`;
      outFileStr += `    }\n`;
      outFileStr += `    let result = new MetaRefExpression_${definition.name}(`;
      let paramIndex = 0;
      for (let parameter of definition.parameters) {
        if (paramIndex) {
          outFileStr += `, `;
        }
        let memberName = translateMemberName(parameter.name);
        if (parameter.list) {
          outFileStr += `...${memberName}Result`;
        } else if (parameter.type instanceof FmtMeta.MetaRefExpression_Int || parameter.type instanceof FmtMeta.MetaRefExpression_String) {
          outFileStr += `this.${memberName}`;
        } else {
          outFileStr += `${memberName}Result`;
        }
        paramIndex++;
      }
      outFileStr += `);\n`;
      outFileStr += `    return fn ? fn(result) : result;\n`;
    } else {
      outFileStr += `    if (fn) {\n`;
      outFileStr += `      return fn(this);\n`;
      outFileStr += `    } else {\n`;
      outFileStr += `      return new MetaRefExpression_${definition.name};\n`;
      outFileStr += `    }\n`;
    }
    outFileStr += `  }\n`;
    outFileStr += `\n`;
    outFileStr += `  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {\n`;
    outFileStr += `    if (!(expression instanceof MetaRefExpression_${definition.name})) {\n`;
    outFileStr += `      return false;\n`;
    outFileStr += `    }\n`;
    for (let parameter of definition.parameters) {
      let memberName = translateMemberName(parameter.name);
      outFileStr += this.outputComparisonCode(`this.${memberName}`, `expression.${memberName}`, this.getEffectiveType(parameter.type, parameter.list), '    ');
    }
    outFileStr += `    return true;\n`;
    outFileStr += `  }\n`;
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinitionType && definition.contents.innerDefinitionTypes && definition.contents.innerDefinitionTypes.length) {
      let metaModel = this.inFile.definitions[0];
      outFileStr += `\n`;
      outFileStr += `  getMetaInnerDefinitionTypes(): Fmt.MetaDefinitionFactory | undefined {\n`;
      outFileStr += `    const innerDefinitionTypes: Fmt.MetaDefinitionList = ${this.outputDefinitionList(definition.contents.innerDefinitionTypes, (metaModel.contents as FmtMeta.ObjectContents_MetaModel).expressionTypes)};\n`;
      outFileStr += `    return new Fmt.StandardMetaDefinitionFactory(innerDefinitionTypes);\n`;
      outFileStr += `  }\n`;
    }
    if (this.hasObjectContents(definition)) {
      outFileStr += `\n`;
      outFileStr += `  createDefinitionContents(): Fmt.ObjectContents | undefined {\n`;
      outFileStr += `    return Object.create(ObjectContents_${definition.name}.prototype);\n`;
      outFileStr += `  }\n`;
    }
    if (definition.contents instanceof FmtMeta.ObjectContents_ParameterType && definition.contents.canOmit instanceof FmtMeta.MetaRefExpression_true) {
      outFileStr += `\n`;
      outFileStr += `  canOmit(): boolean { return true; }\n`;
    }
    outFileStr += `}\n\n`;
    return outFileStr;
  }

  private outputConstructor(parameters: Fmt.ParameterList, superTypeParameters: Fmt.Parameter[] = []): string {
    let outFileStr = '';
    for (let parameter of parameters) {
      let memberName = translateMemberName(parameter.name);
      if (parameter.list || this.getParamName(memberName) !== memberName) {
        let memberType = this.getParameterMemberType(parameter);
        let optional = parameter.optional || parameter.defaultValue !== undefined;
        outFileStr += `  ${memberName}${optional ? '?' : ''}: ${memberType};\n`;
        outFileStr += `\n`;
      }
    }
    outFileStr += `  constructor(`;
    let allParameters = superTypeParameters.concat(parameters);
    let mandatoryParamCount = 0;
    let paramIndex = 0;
    for (let parameter of allParameters) {
      let optional = parameter.optional || parameter.defaultValue !== undefined;
      paramIndex++;
      if (!optional) {
        mandatoryParamCount = paramIndex;
      }
    }
    paramIndex = 0;
    for (let parameter of allParameters) {
      if (paramIndex) {
        outFileStr += `, `;
      }
      let memberName = translateMemberName(parameter.name);
      let paramName = this.getParamName(memberName);
      let memberType = this.getParameterMemberType(parameter);
      let optional = parameter.optional || parameter.defaultValue !== undefined;
      if (parameter.list) {
        outFileStr += `...`;
      } else if (paramName === memberName && paramIndex >= superTypeParameters.length) {
        outFileStr += `public `;
      }
      outFileStr += paramName;
      if (paramIndex < mandatoryParamCount) {
        outFileStr += `: ${memberType}`;
        if (optional) {
          outFileStr += ` | undefined`;
        }
      } else {
        if (optional && !parameter.list) {
          outFileStr += `?`;
        }
        outFileStr += `: ${memberType}`;
      }
      paramIndex++;
    }
    outFileStr += `) {\n`;
    outFileStr += `    super(`;
    paramIndex = 0;
    for (let parameter of superTypeParameters) {
      if (paramIndex) {
        outFileStr += `, `;
      }
      let memberName = translateMemberName(parameter.name);
      let paramName = this.getParamName(memberName);
      outFileStr += paramName;
      paramIndex++;
    }
    outFileStr += `);\n`;
    for (let parameter of parameters) {
      let memberName = translateMemberName(parameter.name);
      let paramName = this.getParamName(memberName);
      if (parameter.list || paramName !== memberName) {
        let optional = parameter.optional || parameter.defaultValue !== undefined;
        if (optional) {
          outFileStr += `    if (${paramName}.length) {\n`;
          outFileStr += `      this.${memberName} = ${paramName};\n`;
          outFileStr += `    }\n`;
        } else {
          outFileStr += `    this.${memberName} = ${paramName};\n`;
        }
      }
    }
    outFileStr += `  }\n`;
    return outFileStr;
  }

  private getParamName(memberName: string): string {
    // 'arguments' is special in JavaScript.
    if (memberName === 'arguments') {
      return 'args';
    } else {
      return memberName;
    }
  }

  private outputExportValueCode(argName: string, source: string, context: string, indexParameterLists: string[] | undefined, type: Fmt.Expression, indent: string): string {
    let outFileStr = '';
    if (type instanceof Fmt.IndexedExpression) {
      let item = this.makeUniqueName('item', type.body);
      outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
      outFileStr += this.outputExportValueCode(argName, item, context, indexParameterLists, type.body, `${indent}  `);
      outFileStr += `${indent}}\n`;
    } else if (type instanceof Fmt.MetaRefExpression) {
      let indices = 'indexParameterLists';
      if (indexParameterLists) {
        indices = `${indices} ? [${[...indexParameterLists, `...${indices}`].join(', ')}] : [${indexParameterLists.join(', ')}]`;
      }
      if (type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
        outFileStr += `${indent}${context} = this.getParameterContext(${source}, ${context}, ${indices});\n`;
      } else if (type instanceof FmtMeta.MetaRefExpression_ParameterList) {
        outFileStr += `${indent}${context} = this.getParameterListContext(${source}, ${context}, ${indices});\n`;
      }
    } else if (type instanceof Fmt.DefinitionRefExpression) {
      let path = type.path;
      if (!path.parentPath) {
        let definition: Fmt.Definition | undefined = this.inFile.definitions.getDefinition(path.name);
        if (definition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(definition)) {
          for (; definition; definition = this.getSuperDefinition(definition)) {
            outFileStr += this.outputDefinitionExportCode(definition, source, context, indexParameterLists, indent);
          }
        }
      }
    }
    return outFileStr;
  }

  private outputExportCode(argName: string, source: string, context: string, indexParameterLists: string[] | undefined, type: Fmt.Expression, optional: boolean, list: boolean, indent: string): string {
    let outFileStr = '';
    let effectiveType = this.getEffectiveType(type, list);
    if (optional) {
      outFileStr += `${indent}if (${source} !== undefined) {\n`;
      outFileStr += this.outputExportValueCode(argName, source, context, indexParameterLists, effectiveType, `${indent}  `);
      outFileStr += `${indent}}\n`;
    } else {
      outFileStr += this.outputExportValueCode(argName, source, context, indexParameterLists, effectiveType, indent);
    }
    return outFileStr;
  }

  private outputDefinitionExportCode(definition: Fmt.Definition, source: string, context: string, indexParameterLists: string[] | undefined, indent: string): string {
    let outFileStr = '';
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
      let exports = definition.contents.exports;
      if (exports) {
        for (let item of exports) {
          let itemIndexParameterLists = indexParameterLists;
          while (item instanceof Fmt.IndexedExpression) {
            if (item.arguments) {
              let newIndexParameterLists: string[] = [];
              for (let indexArg of item.arguments) {
                if (indexArg.value instanceof Fmt.VariableRefExpression) {
                  let indexValue = indexArg.value.variable;
                  let indexName = translateMemberName(indexValue.name);
                  newIndexParameterLists.push(`${source}.${indexName}`);
                }
              }
              itemIndexParameterLists = itemIndexParameterLists ? newIndexParameterLists.concat(itemIndexParameterLists) : newIndexParameterLists;
            }
            item = item.body;
          }
          if (item instanceof Fmt.VariableRefExpression) {
            let member = item.variable;
            let memberName = translateMemberName(member.name);
            let optional = member.optional || member.defaultValue !== undefined;
            outFileStr += this.outputExportCode(member.name, `${source}.${memberName}`, context, itemIndexParameterLists, member.type, optional, member.list, indent);
          }
        }
      }
    }
    return outFileStr;
  }

  private outputRawExportValueCode(argName: string, source: string, context: string, type: Fmt.Expression, indent: string): string {
    let outFileStr = '';
    if (type instanceof Fmt.IndexedExpression) {
      let item = this.makeUniqueName('item', type.body);
      let exportValueCode = this.outputRawExportValueCode(argName, item, context, type.body, `${indent}    `);
      if (exportValueCode) {
        outFileStr += `${indent}if (${source} instanceof Fmt.ArrayExpression) {\n`;
        outFileStr += `${indent}  for (let ${item} of ${source}.items) {\n`;
        outFileStr += exportValueCode;
        outFileStr += `${indent}  }\n`;
        outFileStr += `${indent}}\n`;
      }
    } else if (type instanceof Fmt.MetaRefExpression) {
      if (type instanceof FmtMeta.MetaRefExpression_SingleParameter || type instanceof FmtMeta.MetaRefExpression_ParameterList) {
        outFileStr += `${indent}if (${source} instanceof Fmt.ParameterExpression) {\n`;
        outFileStr += `${indent}  ${context} = this.getParameterListContext(${source}.parameters, ${context});\n`;
        outFileStr += `${indent}}\n`;
      }
    } else if (type instanceof Fmt.DefinitionRefExpression) {
      let path = type.path;
      if (!path.parentPath) {
        let definition: Fmt.Definition | undefined = this.inFile.definitions.getDefinition(path.name);
        if (definition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(definition)) {
          for (; definition; definition = this.getSuperDefinition(definition)) {
            let definitionExportCode = this.outputRawDefinitionExportCode(definition, `${source}.arguments`, context, `${indent}  `);
            if (definitionExportCode) {
              outFileStr += `${indent}if (${source} instanceof Fmt.CompoundExpression) {\n`;
              outFileStr += definitionExportCode;
              outFileStr += `${indent}}\n`;
            }
          }
        }
      }
    }
    return outFileStr;
  }

  private outputRawExportCode(argName: string, argIndex: number, source: string, context: string, type: Fmt.Expression, list: boolean, indent: string): string {
    let outFileStr = '';
    let value = `${argName}Value`;
    let effectiveType = this.getEffectiveType(type, list);
    let exportValueCode = this.outputRawExportValueCode(argName, value, context, effectiveType, indent);
    if (exportValueCode) {
      outFileStr += `${indent}let ${value} = ${source}.getOptionalValue('${argName}', ${argIndex});\n`;
      outFileStr += exportValueCode;
    }
    return outFileStr;
  }

  private outputRawDefinitionExportCode(definition: Fmt.Definition, source: string, context: string, indent: string): string {
    let outFileStr = '';
    if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
      let exports = definition.contents.exports;
      if (exports) {
        for (let item of exports) {
          if (item instanceof Fmt.VariableRefExpression) {
            let member = item.variable;
            let memberIndex = this.getMemberIndex(definition, member);
            if (memberIndex !== undefined) {
              outFileStr += this.outputRawExportCode(member.name, memberIndex, source, context, member.type, member.list, indent);
            }
          }
        }
      }
    }
    return outFileStr;
  }

  private outputMemberDependencyCode(definition: Fmt.Definition, argumentVar: string, argumentIndexVar: string, source: string, context: string, indent: string): string {
    let outFileStr = '';
    let memberIndex = 0;
    for (let member of this.getAllMembers(definition)) {
      let argumentTypeStr = this.outputArgumentTypeContext(member, `${indent}  `);
      if (member.dependencies || argumentTypeStr) {
        outFileStr += `${indent}if (${argumentVar}.name === '${member.name}' || (${argumentVar}.name ${member.list ? '>=' : '==='} undefined && ${argumentIndexVar} === ${memberIndex})) {\n`;
        if (member.dependencies) {
          let hasParentRestriction = false;
          for (let dependency of member.dependencies) {
            if (dependency instanceof Fmt.DefinitionRefExpression && !dependency.path.parentPath) {
              if (!hasParentRestriction) {
                outFileStr += `${indent}  for (; context instanceof Ctx.DerivedContext; context = context.parentContext) {\n`;
                hasParentRestriction = true;
              }
              let dependencyDefinition = this.inFile.definitions.getDefinition(dependency.path.name);
              if (this.isVisibleType(dependencyDefinition)) {
                outFileStr += `${indent}    if (context instanceof DefinitionContentsContext && context.definition.type instanceof MetaRefExpression_${dependency.path.name}) {\n`;
                outFileStr += `${indent}      break;\n`;
                outFileStr += `${indent}    }\n`;
              }
              if (this.hasObjectContents(dependencyDefinition)) {
                outFileStr += `${indent}    if (context instanceof ArgumentTypeContext && context.objectContentsClass === ObjectContents_${dependency.path.name}) {\n`;
                outFileStr += `${indent}      break;\n`;
                outFileStr += `${indent}    }\n`;
              }
            }
          }
          if (hasParentRestriction) {
            outFileStr += `${indent}  }\n`;
          }
          for (let dependency of member.dependencies) {
            if (dependency instanceof Fmt.VariableRefExpression) {
              let variable = dependency.variable;
              let variableIndex = this.getMemberIndex(definition, variable);
              if (variableIndex !== undefined) {
                outFileStr += this.outputRawExportCode(variable.name, variableIndex, source, context, variable.type, variable.list, `${indent}  `);
              }
            }
          }
        }
        outFileStr += argumentTypeStr;
        outFileStr += `${indent}}\n`;
      }
      memberIndex++;
    }
    return outFileStr;
  }

  private outputParameterDependencyCode(parameters: Fmt.ParameterList, argumentVar: string, argumentIndexVar: string, source: string, context: string, indent: string): string {
    let outFileStr = '';
    let paramIndex = 0;
    for (let param of parameters) {
      let argumentTypeStr = this.outputArgumentTypeContext(param, `${indent}  `);
      if (param.dependencies || argumentTypeStr) {
        outFileStr += `${indent}if (${argumentVar}.name === '${param.name}' || (${argumentVar}.name === undefined && ${argumentIndexVar} ${param.list ? '>=' : '==='} ${paramIndex})) {\n`;
        if (param.dependencies) {
          for (let dependency of param.dependencies) {
            if (dependency instanceof FmtMeta.MetaRefExpression_self) {
              outFileStr += `${indent}  for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {\n`;
              outFileStr += `${indent}    if (currentContext instanceof ParameterTypeContext) {\n`;
              outFileStr += `${indent}      context = new Ctx.ParameterContext(currentContext.parameter, context);\n`;
              outFileStr += `${indent}      break;\n`;
              outFileStr += `${indent}    }\n`;
              outFileStr += `${indent}  }\n`;
            } else if (dependency instanceof Fmt.VariableRefExpression) {
              let variable = dependency.variable;
              let variableIndex = parameters.indexOf(variable);
              if (variableIndex >= 0) {
                outFileStr += this.outputRawExportCode(variable.name, variableIndex, source, context, variable.type, variable.list, `${indent}  `);
              }
            }
          }
        }
        outFileStr += argumentTypeStr;
        outFileStr += `${indent}}\n`;
      }
      paramIndex++;
    }
    return outFileStr;
  }

  private outputDefinitionMemberDependencyCode(definitionTypes: Fmt.Expression[] | undefined, indent: string): string {
    let outFileStr = '';
    if (definitionTypes) {
      for (let definitionType of definitionTypes) {
        if (definitionType instanceof Fmt.DefinitionRefExpression) {
          let definition = this.inFile.definitions.getDefinition(definitionType.path.name);
          if (definition.contents instanceof FmtMeta.ObjectContents_DefinitionType) {
            let memberDependencyCode = this.outputMemberDependencyCode(definition, 'argument', 'argumentIndex', 'previousArguments', 'context', `${indent}  `);
            if (memberDependencyCode) {
              outFileStr += `${indent}if (type instanceof MetaRefExpression_${definitionType.path.name}) {\n`;
              outFileStr += memberDependencyCode;
              outFileStr += `${indent}}\n`;
            }
            outFileStr += this.outputDefinitionMemberDependencyCode(definition.contents.innerDefinitionTypes, indent);
          }
        }
      }
    }
    return outFileStr;
  }

  private outputExpressionMemberDependencyCode(indent: string): string {
    let outFileStr = '';
    for (let definition of this.inFile.definitions) {
      if (definition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(definition)) {
        let memberDependencyCode = this.outputMemberDependencyCode(definition, 'argument', 'argumentIndex', 'previousArguments', 'context', `${indent}  `);
        if (memberDependencyCode) {
          outFileStr += `${indent}if (currentContext.objectContentsClass === ObjectContents_${definition.name}) {\n`;
          outFileStr += memberDependencyCode;
          outFileStr += `${indent}}\n`;
        }
      }
    }
    return outFileStr;
  }

  private outputDefinitionParameterDependencyCode(indent: string): string {
    let outFileStr = '';
    for (let definition of this.inFile.definitions) {
      if (definition.type instanceof FmtMeta.MetaRefExpression_MetaModel) {
        continue;
      }
      if (this.isVisibleType(definition)) {
        let parameterDependencyCode = this.outputParameterDependencyCode(definition.parameters, 'argument', 'argumentIndex', 'previousArguments', 'context', '        ');
        if (parameterDependencyCode) {
          outFileStr += `${indent}if (parent instanceof MetaRefExpression_${definition.name}) {\n`;
          outFileStr += parameterDependencyCode;
          outFileStr += `${indent}}\n`;
        }
      }
    }
    return outFileStr;
  }

  private outputArgumentTypeContext(param: Fmt.Parameter, indent: string): string {
    let outFileStr = '';
    let type = param.type;
    while (type instanceof Fmt.IndexedExpression) {
      type = type.body;
    }
    if (type instanceof Fmt.DefinitionRefExpression) {
      let path = type.path;
      if (path.parentPath) {
        if (path.parentPath instanceof Fmt.NamedPathItem) {
          outFileStr += `${indent}context = new Ctx.DerivedContext(context);\n`;
          let metaModelName = path.parentPath.name;
          if (metaModelName) {
            metaModelName = metaModelName.charAt(0).toUpperCase() + metaModelName.substring(1);
            outFileStr += `${indent}context.metaModel = Fmt${metaModelName}.metaModel;\n`;
          }
        }
      } else {
        let typeDefinition = this.inFile.definitions.getDefinition(path.name);
        if (typeDefinition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(typeDefinition)) {
          outFileStr += `${indent}context = new ArgumentTypeContext(ObjectContents_${path.name}, context);\n`;
        }
      }
    }
    return outFileStr;
  }

  private outputMetaDefinitions(): string {
    let outFileStr = '';
    let metaModel = this.inFile.definitions[0];
    if (metaModel && metaModel.contents instanceof FmtMeta.ObjectContents_MetaModel) {
      outFileStr += `class DefinitionContentsContext extends Ctx.DerivedContext {\n`;
      outFileStr += `  constructor(public definition: Fmt.Definition, parentContext: Ctx.Context) {\n`;
      outFileStr += `    super(parentContext);\n`;
      outFileStr += `  }\n`;
      outFileStr += `}\n`;
      outFileStr += `\n`;
      outFileStr += `class ParameterTypeContext extends Ctx.DerivedContext {\n`;
      outFileStr += `  constructor(public parameter: Fmt.Parameter, parentContext: Ctx.Context) {\n`;
      outFileStr += `    super(parentContext);\n`;
      outFileStr += `  }\n`;
      outFileStr += `}\n`;
      outFileStr += `\n`;
      outFileStr += `class ArgumentTypeContext extends Ctx.DerivedContext {\n`;
      outFileStr += `  constructor(public objectContentsClass: Function, parentContext: Ctx.Context) {\n`;
      outFileStr += `    super(parentContext);\n`;
      outFileStr += `  }\n`;
      outFileStr += `}\n`;
      outFileStr += `\n`;
      outFileStr += `const definitionTypes: Fmt.MetaDefinitionList = ${this.outputDefinitionList(metaModel.contents.definitionTypes, metaModel.contents.expressionTypes)};\n`;
      outFileStr += `const expressionTypes: Fmt.MetaDefinitionList = ${this.outputDefinitionList(metaModel.contents.expressionTypes)};\n`;
      outFileStr += `const functions: Fmt.MetaDefinitionList = ${this.outputDefinitionList(metaModel.contents.functions)};\n`;
      outFileStr += `\n`;
      for (;;) {
        let oldVisibleTypeCount = this.visibleTypeNames.length;
        for (let definition of this.inFile.definitions) {
          if (this.isVisibleType(definition) && definition.contents instanceof FmtMeta.ObjectContents_DefinitionType && definition.contents.innerDefinitionTypes) {
            this.addVisibleTypes(definition.contents.innerDefinitionTypes, metaModel.contents.expressionTypes);
          }
        }
        if (this.visibleTypeNames.length === oldVisibleTypeCount) {
          break;
        }
      }
      outFileStr += `export class MetaModel extends Meta.MetaModel {\n`;
      outFileStr += `  constructor() {\n`;
      outFileStr += `    super('${metaModel.name}',\n`;
      outFileStr += `          new Fmt.StandardMetaDefinitionFactory(definitionTypes),\n`;
      outFileStr += `          new Fmt.StandardMetaDefinitionFactory(expressionTypes),\n`;
      outFileStr += `          new Fmt.StandardMetaDefinitionFactory(functions));\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Ctx.Context): Ctx.Context {\n`;
      outFileStr += `    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Ctx.Context): Ctx.Context {\n`;
      outFileStr += `    return new ParameterTypeContext(parameter, parentContext);\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Ctx.Context): Ctx.Context {\n`;
      outFileStr += `    let parent = previousContext.parentObject;\n`;
      outFileStr += `    if (parent instanceof Fmt.Definition) {\n`;
      let hasDefinitionTypes = false;
      for (let definitionType of metaModel.contents.definitionTypes) {
        if (definitionType instanceof Fmt.DefinitionRefExpression) {
          if (hasDefinitionTypes) {
            outFileStr += `\n            || `;
          } else {
            outFileStr += `      let type = parent.type;\n`;
            outFileStr += `      if (type instanceof Fmt.MetaRefExpression) {\n`;
            outFileStr += `        if (`;
            hasDefinitionTypes = true;
          }
          outFileStr += `type instanceof MetaRefExpression_${definitionType.path.name}`;
        }
      }
      if (hasDefinitionTypes) {
        outFileStr += `) {\n`;
        outFileStr += `          return previousContext;\n`;
        outFileStr += `        }\n`;
        outFileStr += `      }\n`;
      }
      outFileStr += `    }\n`;
      outFileStr += `    if (parent instanceof Fmt.CompoundExpression) {\n`;
      outFileStr += `      for (let currentContext = previousContext; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {\n`;
      outFileStr += `        if (currentContext instanceof ArgumentTypeContext) {\n`;
      outFileStr += `          return previousContext;\n`;
      outFileStr += `        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {\n`;
      outFileStr += `          break;\n`;
      outFileStr += `        }\n`;
      outFileStr += `      }\n`;
      outFileStr += `    }\n`;
      outFileStr += `    if (parent instanceof Fmt.MetaRefExpression) {\n`;
      outFileStr += `      return previousContext;\n`;
      outFileStr += `    }\n`;
      outFileStr += `    return super.getNextArgumentContext(argument, argumentIndex, previousContext);\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Ctx.Context): Ctx.Context {\n`;
      outFileStr += `    let context = parentContext;\n`;
      outFileStr += `    let parent = context.parentObject;\n`;
      let definitionMemberDependencyCode = this.outputDefinitionMemberDependencyCode(metaModel.contents.definitionTypes, '        ');
      if (definitionMemberDependencyCode) {
        outFileStr += `    if (parent instanceof Fmt.Definition) {\n`;
        outFileStr += `      let type = parent.type;\n`;
        outFileStr += `      if (type instanceof Fmt.MetaRefExpression) {\n`;
        outFileStr += definitionMemberDependencyCode;
        outFileStr += `      }\n`;
        outFileStr += `    }\n`;
      }
      outFileStr += `    if (parent instanceof Fmt.CompoundExpression) {\n`;
      outFileStr += `      for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {\n`;
      outFileStr += `        if (currentContext instanceof ArgumentTypeContext) {\n`;
      outFileStr += this.outputExpressionMemberDependencyCode('          ');
      outFileStr += `          break;\n`;
      outFileStr += `        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {\n`;
      outFileStr += `          break;\n`;
      outFileStr += `        }\n`;
      outFileStr += `      }\n`;
      outFileStr += `    }\n`;
      let parameterDependencyCode = this.outputDefinitionParameterDependencyCode('      ');
      if (parameterDependencyCode) {
        outFileStr += `    if (parent instanceof Fmt.MetaRefExpression) {\n`;
        outFileStr += parameterDependencyCode;
        outFileStr += `    }\n`;
      }
      outFileStr += `    return context;\n`;
      outFileStr += `  }\n`;
      let hasExports = false;
      for (let definition of this.inFile.definitions) {
        if (definition.type instanceof FmtMeta.MetaRefExpression_MetaModel) {
          continue;
        }
        if (this.isVisibleType(definition)) {
          let definitionExportCode = this.outputDefinitionExportCode(definition, 'expression', 'context', undefined, '      ');
          if (definitionExportCode) {
            if (!hasExports) {
              outFileStr += `\n`;
              outFileStr += `  protected getExports(expression: Fmt.Expression, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): Ctx.Context {\n`;
              outFileStr += `    let context = parentContext;\n`;
              hasExports = true;
            }
            outFileStr += `    if (expression instanceof MetaRefExpression_${definition.name}) {\n`;
            outFileStr += definitionExportCode;
            outFileStr += `    }\n`;
          }
        }
      }
      if (hasExports) {
        outFileStr += `    return context;\n`;
        outFileStr += `  }\n`;
      }
      outFileStr += `}\n`;
      outFileStr += `\n`;
      outFileStr += `export const metaModel = new MetaModel;\n`;
      outFileStr += `\n`;
      outFileStr += `export function getMetaModel(path?: Fmt.Path): MetaModel {\n`;
      outFileStr += `  if (path && path.name !== '${metaModel.name}') {\n`;
      outFileStr += `    throw new Error('File of type "${metaModel.name}" expected');\n`;
      outFileStr += `  }\n`;
      outFileStr += `  return metaModel;\n`;
      outFileStr += `}\n`;
    }
    return outFileStr;
  }

  outputAll(inFileName: string, outFileName: string, referencedMetaModels: ReferencedMetaModel[]): string {
    let outFileStr = `// Generated from ${inFileName} by generateMetaDeclarations.ts.\n`;
    outFileStr += `\n`;

    let srcPath = outFileName.split('/');
    srcPath.pop();
    let dstPath = 'src/shared/format'.split('/');
    while (srcPath.length && dstPath.length && srcPath[0] === dstPath[0]) {
      srcPath.splice(0, 1);
      dstPath.splice(0, 1);
    }
    let relPathStr = srcPath.length ? '' : './';
    for (let _item of srcPath) {
      relPathStr += '../';
    }
    for (let item of dstPath) {
      relPathStr += item + '/';
    }
    outFileStr += `import * as Fmt from '${relPathStr}format';\n`;
    outFileStr += `import * as Ctx from '${relPathStr}context';\n`;
    outFileStr += `import * as Meta from '${relPathStr}metaModel';\n`;
    outFileStr += `\n`;
    outFileStr += `/* eslint-disable no-shadow */\n`;
    for (let ref of referencedMetaModels) {
      let refName = ref.inFileName.split('/').pop()!.split('.')[0]!;
      refName = refName[0].toUpperCase() + refName.substring(1);
      srcPath = outFileName.split('/');
      srcPath.pop();
      dstPath = ref.outFileName.split('/');
      let dstName = dstPath.pop()!.split('.')[0]!;
      while (srcPath.length && dstPath.length && srcPath[0] === dstPath[0]) {
        srcPath.splice(0, 1);
        dstPath.splice(0, 1);
      }
      relPathStr = srcPath.length ? '' : './';
      for (let _item of srcPath) {
        relPathStr += '../';
      }
      for (let item of dstPath) {
        relPathStr += item + '/';
      }
      outFileStr += `import * as Fmt${refName} from '${relPathStr}${dstName}';\n`;
    }
    outFileStr += `\n`;

    let metaDefinitions = this.outputMetaDefinitions();

    outFileStr += this.outputDeclarations();
    outFileStr += metaDefinitions;

    return outFileStr;
  }
}

function generate(inFileName: string, outFileName: string, referencedMetaModels: ReferencedMetaModel[]): void {
  let inFileStr: string = fs.readFileSync(inFileName, 'utf8');
  let inFile: Fmt.File = FmtReader.readString(inFileStr, inFileName, FmtMeta.getMetaModel);

  let generator = new MetaDeclarationGenerator(inFile);
  let outFileStr = generator.outputAll(inFileName, outFileName, referencedMetaModels);

  fs.writeFileSync(outFileName, outFileStr, 'utf8');
}

if (process.argv.length < 4) {
  console.error('usage: src/scripts/generateMetaDeclarations.sh <infile> <outfile> [<refinfile> <refoutfile> [...]]');
  process.exit(2);
}

let refs: ReferencedMetaModel[] = [];
for (let argIndex = 4; argIndex + 1 < process.argv.length; argIndex++) {
  refs.push({
    inFileName: process.argv[argIndex],
    outFileName: process.argv[argIndex + 1]
  });
}
generate(process.argv[2], process.argv[3], refs);
