import * as fs from 'fs';
import * as Fmt from '../shared/format/format';
import * as FmtMeta from '../shared/format/meta';
import * as FmtReader from '../shared/format/read';
import { translateMemberName } from '../shared/format/common';

function isVisibleType(visibleTypeNames: string[], definition: Fmt.Definition): boolean {
  return visibleTypeNames.indexOf(definition.name) >= 0;
}

function getSuperName(definition: Fmt.Definition): string | undefined {
  if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
    let superType = definition.contents.superType;
    if (superType instanceof Fmt.DefinitionRefExpression && !superType.path.parentPath) {
      return superType.path.name;
    }
  }
  return undefined;
}

function getSuperDefinition(inFile: Fmt.File, definition: Fmt.Definition): Fmt.Definition | undefined {
  let superName = getSuperName(definition);
  if (superName) {
    return inFile.definitions.getDefinition(superName);
  } else {
    return undefined;
  }
}

function hasObjectContents(inFile: Fmt.File, definition: Fmt.Definition): boolean {
  if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
    return true;
  }
  let superDefinition = getSuperDefinition(inFile, definition);
  if (superDefinition) {
    return hasObjectContents(inFile, superDefinition);
  } else {
    return false;
  }
}

function getMemberCount(inFile: Fmt.File, definition: Fmt.Definition): number {
  let result = 0;
  let superDefinition = getSuperDefinition(inFile, definition);
  if (superDefinition) {
    result += getMemberCount(inFile, superDefinition);
  }
  if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
    result += definition.contents.members.length;
  }
  return result;
}

function getMemberContentType(inFile: Fmt.File, type: Fmt.Type): string | undefined {
  if (type.expression instanceof Fmt.MetaRefExpression) {
    if (type.expression instanceof FmtMeta.MetaRefExpression_Int) {
      return 'Fmt.BigInt';
    } else if (type.expression instanceof FmtMeta.MetaRefExpression_String) {
      return 'string';
    } else if (type.expression instanceof FmtMeta.MetaRefExpression_SingleParameter) {
      return 'Fmt.Parameter';
    } else if (type.expression instanceof FmtMeta.MetaRefExpression_ParameterList) {
      return 'Fmt.ParameterList';
    } else if (type.expression instanceof FmtMeta.MetaRefExpression_ArgumentList) {
      return 'Fmt.ArgumentList';
    }
  } else if (type.expression instanceof Fmt.DefinitionRefExpression) {
    let path = type.expression.path;
    if (!path.parentPath) {
      let definition = inFile.definitions.getDefinition(path.name);
      if (definition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && hasObjectContents(inFile, definition)) {
        return `ObjectContents_${definition.name}`;
      }
    }
  }
  return undefined;
}

function getMemberType(inFile: Fmt.File, type: Fmt.Type): string {
  let contentType = getMemberContentType(inFile, type);
  if (contentType) {
    for (let i = 0; i < type.arrayDimensions; i++) {
      contentType += `[]`;
    }
    return contentType;
  } else {
    return 'Fmt.Expression';
  }
}

function outputReadConvCode(inFile: Fmt.File, argName: string, source: string, target: string, type: Fmt.Type, contentType: string | undefined, targetIsList: boolean, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  let outputBegin = targetIsList ? `${target}.push(` : `${target} = `;
  let outputEnd = targetIsList ? `)` : '';
  if (contentType) {
    if (remainingArrayDimensions) {
      outFileStr += `${indent}if (${source} instanceof Fmt.ArrayExpression) {\n`;
      let subTarget = target;
      if (targetIsList) {
        subTarget = 'newItem' + remainingArrayDimensions;
        outFileStr += `${indent}  let ${subTarget} = [];\n`;
      } else {
        outFileStr += `${indent}  ${target} = [];\n`;
      }
      let item = 'item';
      if (remainingArrayDimensions - 1) {
        item += remainingArrayDimensions - 1;
      }
      outFileStr += `${indent}  for (let ${item} of ${source}.items) {\n`;
      outFileStr += outputReadConvCode(inFile, argName, item, subTarget, type, contentType, true, remainingArrayDimensions - 1, `${indent}    `);
      outFileStr += `${indent}  }\n`;
      if (targetIsList) {
        outFileStr += `${indent}  ${outputBegin}${subTarget}${outputEnd};\n`;
      }
      outFileStr += `${indent}} else {\n`;
      outFileStr += `${indent}  throw new Error('${argName}: Array expression expected');\n`;
      outFileStr += `${indent}}\n`;
    } else {
      if (type.expression instanceof Fmt.MetaRefExpression) {
        if (type.expression instanceof FmtMeta.MetaRefExpression_Int) {
          outFileStr += `${indent}if (${source} instanceof Fmt.IntegerExpression) {\n`;
          outFileStr += `${indent}  ${outputBegin}${source}.value${outputEnd};\n`;
          outFileStr += `${indent}} else {\n`;
          outFileStr += `${indent}  throw new Error('${argName}: Integer expected');\n`;
          outFileStr += `${indent}}\n`;
        } else if (type.expression instanceof FmtMeta.MetaRefExpression_String) {
          outFileStr += `${indent}if (${source} instanceof Fmt.StringExpression) {\n`;
          outFileStr += `${indent}  ${outputBegin}${source}.value${outputEnd};\n`;
          outFileStr += `${indent}} else {\n`;
          outFileStr += `${indent}  throw new Error('${argName}: String expected');\n`;
          outFileStr += `${indent}}\n`;
        } else if (type.expression instanceof FmtMeta.MetaRefExpression_SingleParameter) {
          outFileStr += `${indent}if (${source} instanceof Fmt.ParameterExpression && ${source}.parameters.length === 1) {\n`;
          outFileStr += `${indent}  ${outputBegin}${source}.parameters[0]${outputEnd};\n`;
          outFileStr += `${indent}} else {\n`;
          outFileStr += `${indent}  throw new Error('${argName}: Parameter expression with single parameter expected');\n`;
          outFileStr += `${indent}}\n`;
        } else if (type.expression instanceof FmtMeta.MetaRefExpression_ParameterList) {
          outFileStr += `${indent}if (${source} instanceof Fmt.ParameterExpression) {\n`;
          outFileStr += `${indent}  ${outputBegin}${source}.parameters${outputEnd};\n`;
          outFileStr += `${indent}} else {\n`;
          outFileStr += `${indent}  throw new Error('${argName}: Parameter expression expected');\n`;
          outFileStr += `${indent}}\n`;
        } else if (type.expression instanceof FmtMeta.MetaRefExpression_ArgumentList) {
          outFileStr += `${indent}if (${source} instanceof Fmt.CompoundExpression) {\n`;
          outFileStr += `${indent}  ${outputBegin}${source}.arguments${outputEnd};\n`;
          outFileStr += `${indent}} else {\n`;
          outFileStr += `${indent}  throw new Error('${argName}: Compound expression expected');\n`;
          outFileStr += `${indent}}\n`;
        }
      } else if (type.expression instanceof Fmt.DefinitionRefExpression) {
        let path = type.expression.path;
        if (!path.parentPath) {
          let definition = inFile.definitions.getDefinition(path.name);
          if (definition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && hasObjectContents(inFile, definition)) {
            let subTarget = 'newItem';
            if (remainingArrayDimensions) {
              subTarget += remainingArrayDimensions;
            }
            outFileStr += `${indent}if (${source} instanceof Fmt.CompoundExpression) {\n`;
            outFileStr += `${indent}  let ${subTarget} = new ObjectContents_${definition.name};\n`;
            outFileStr += `${indent}  ${subTarget}.fromCompoundExpression(${source});\n`;
            outFileStr += `${indent}  ${outputBegin}${subTarget}${outputEnd};\n`;
            outFileStr += `${indent}} else {\n`;
            outFileStr += `${indent}  throw new Error('${argName}: Compound expression expected');\n`;
            outFileStr += `${indent}}\n`;
          }
        }
      }
    }
  }
  if (!outFileStr) {
    outFileStr = `${indent}${outputBegin}${source}${outputEnd};\n`;
  }
  return outFileStr;
}

function outputReadCode(inFile: Fmt.File, argName: string, argIndex: number, memberName: string, type: Fmt.Type, optional: boolean, list: boolean, indent: string): string {
  let outFileStr = '';
  let variableName = argName + 'Raw';
  let contentType = getMemberContentType(inFile, type);
  if (list) {
    if (optional) {
      outFileStr += `${indent}let initialized = false;\n`;
    } else {
      outFileStr += `${indent}this.${memberName} = [];\n`;
    }
    outFileStr += `${indent}let index = ${argIndex};\n`;
    outFileStr += `${indent}for (;;) {\n`;
    outFileStr += `${indent}  let ${variableName} = argumentList.getOptionalValue(undefined, index);\n`;
    outFileStr += `${indent}  if (${variableName} === undefined) {\n`;
    outFileStr += `${indent}    break;\n`;
    outFileStr += `${indent}  }\n`;
    if (optional) {
      outFileStr += `${indent}  if (!initialized) {\n`;
      outFileStr += `${indent}    this.${memberName} = [];\n`;
      outFileStr += `${indent}    initialized = true;\n`;
      outFileStr += `${indent}  }\n`;
    }
    outFileStr += outputReadConvCode(inFile, argName, variableName, `this.${memberName}!`, type, contentType, true, type.arrayDimensions, `${indent}  `);
    outFileStr += `${indent}  index++;\n`;
    outFileStr += `${indent}}\n`;
  } else {
    if (contentType) {
      outFileStr += `${indent}let ${variableName} = argumentList.get${optional ? 'Optional' : ''}Value('${argName}', ${argIndex});\n`;
      if (optional) {
        outFileStr += `${indent}if (${variableName} !== undefined) {\n`;
        outFileStr += outputReadConvCode(inFile, argName, variableName, `this.${memberName}`, type, contentType, false, type.arrayDimensions, `${indent}  `);
        outFileStr += `${indent}}\n`;
      } else {
        outFileStr += outputReadConvCode(inFile, argName, variableName, `this.${memberName}`, type, contentType, false, type.arrayDimensions, indent);
      }
    } else {
      outFileStr += `${indent}this.${memberName} = argumentList.get${optional ? 'Optional' : ''}Value('${argName}', ${argIndex});\n`;
    }
  }
  return outFileStr;
}

function outputWriteConvCode(inFile: Fmt.File, argName: string, source: string, target: string, type: Fmt.Type, list: boolean, named: boolean, contentType: string | undefined, targetIsList: boolean, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  if (list) {
    let item = argName + 'Arg';
    outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
    outFileStr += outputWriteConvCode(inFile, argName, item, target, type, false, false, contentType, targetIsList, remainingArrayDimensions, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    let outputBegin = targetIsList ? `${target}.push(` : `${target}.add(`;
    let outputEnd = named ? `, '${argName}')` : `)`;
    if (contentType) {
      let variableName = argName + 'Expr';
      if (targetIsList) {
        variableName = 'newItem';
        if (remainingArrayDimensions) {
          variableName += remainingArrayDimensions;
        }
      }
      if (remainingArrayDimensions) {
        outFileStr += `${indent}let ${variableName} = new Fmt.ArrayExpression;\n`;
        let subTarget = `${variableName}.items`;
        outFileStr += `${indent}${subTarget} = [];\n`;
        let item = 'item';
        if (remainingArrayDimensions - 1) {
          item += remainingArrayDimensions - 1;
        }
        outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
        outFileStr += outputWriteConvCode(inFile, argName, item, subTarget, type, false, false, contentType, true, remainingArrayDimensions - 1, `${indent}  `);
        outFileStr += `${indent}}\n`;
        outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
      } else {
        if (type.expression instanceof Fmt.MetaRefExpression) {
          if (type.expression instanceof FmtMeta.MetaRefExpression_Int) {
            outFileStr += `${indent}let ${variableName} = new Fmt.IntegerExpression;\n`;
            outFileStr += `${indent}${variableName}.value = ${source};\n`;
            outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
          } else if (type.expression instanceof FmtMeta.MetaRefExpression_String) {
            outFileStr += `${indent}let ${variableName} = new Fmt.StringExpression;\n`;
            outFileStr += `${indent}${variableName}.value = ${source};\n`;
            outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
          } else if (type.expression instanceof FmtMeta.MetaRefExpression_SingleParameter) {
            outFileStr += `${indent}let ${variableName} = new Fmt.ParameterExpression;\n`;
            outFileStr += `${indent}${variableName}.parameters.push(${source});\n`;
            outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
          } else if (type.expression instanceof FmtMeta.MetaRefExpression_ParameterList) {
            outFileStr += `${indent}let ${variableName} = new Fmt.ParameterExpression;\n`;
            outFileStr += `${indent}${variableName}.parameters.push(...${source});\n`;
            outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
          } else if (type.expression instanceof FmtMeta.MetaRefExpression_ArgumentList) {
            outFileStr += `${indent}let ${variableName} = new Fmt.CompoundExpression;\n`;
            outFileStr += `${indent}${variableName}.arguments = ${source};\n`;
            outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
          }
        } else if (type.expression instanceof Fmt.DefinitionRefExpression) {
          let path = type.expression.path;
          if (!path.parentPath) {
            let definition = inFile.definitions.getDefinition(path.name);
            if (definition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && hasObjectContents(inFile, definition)) {
              outFileStr += `${indent}let ${variableName} = new Fmt.CompoundExpression;\n`;
              outFileStr += `${indent}${source}.toCompoundExpression(${variableName});\n`;
              outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
            }
          }
        }
      }
    }
    if (!outFileStr) {
      outFileStr = `${indent}${outputBegin}${source}${outputEnd};\n`;
    }
  }
  return outFileStr;
}

function outputWriteCode(inFile: Fmt.File, argName: string, memberName: string, type: Fmt.Type, optional: boolean, list: boolean, named: boolean, indent: string): string {
  let outFileStr = '';
  let contentType = getMemberContentType(inFile, type);
  if (optional) {
    outFileStr += `${indent}if (this.${memberName} !== undefined) {\n`;
    outFileStr += outputWriteConvCode(inFile, argName, `this.${memberName}`, 'argumentList', type, list, named, contentType, false, type.arrayDimensions, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    outFileStr += outputWriteConvCode(inFile, argName, `this.${memberName}`, 'argumentList', type, list, named, contentType, false, type.arrayDimensions, indent);
  }
  return outFileStr;
}

function outputSubstitutionCode(inFile: Fmt.File, source: string, target: string, contentType: string | undefined, targetIsList: boolean, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  let subTarget = target;
  let init = target;
  if (targetIsList) {
    subTarget = 'newItem';
    if (remainingArrayDimensions) {
      subTarget += remainingArrayDimensions;
    }
    init = `let ${subTarget}`;
  }
  if (remainingArrayDimensions) {
    outFileStr += `${indent}${init} = [];\n`;
    let item = 'item';
    if (remainingArrayDimensions - 1) {
      item += remainingArrayDimensions - 1;
    }
    outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
    outFileStr += outputSubstitutionCode(inFile, item, subTarget, contentType, true, remainingArrayDimensions - 1, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    if (contentType && (!contentType.startsWith('Fmt.') || contentType.endsWith('List'))) {
      if (contentType.startsWith('Fmt.') && contentType.endsWith('List')) {
        outFileStr += `${indent}${init} = Object.create(${contentType}.prototype);\n`;
      } else {
        outFileStr += `${indent}${init} = new ${contentType};\n`;
      }
      outFileStr += `${indent}if (${source}.substituteExpression(fn, ${subTarget}!, replacedParameters)) {\n`;
      outFileStr += `${indent}  changed = true;\n`;
      outFileStr += `${indent}}\n`;
    } else {
      if (contentType) {
        outFileStr += `${indent}${init} = ${source}.substituteExpression(fn, replacedParameters);\n`;
      } else {
        outFileStr += `${indent}${init} = ${source}.substitute(fn, replacedParameters);\n`;
      }
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

function outputDefinitionList(visibleTypeNames: string[], list?: Fmt.Expression, secondaryList?: Fmt.Expression): string {
  let outFileStr = `{`;
  if (list instanceof Fmt.ArrayExpression) {
    let first = true;
    for (let item of list.items) {
      if (item instanceof Fmt.DefinitionRefExpression && !item.path.parentPath) {
        if (first) {
          first = false;
        } else {
          outFileStr += `, `;
        }
        let name = item.path.name;
        outFileStr += `'${name}': MetaRefExpression_${name}`;
        visibleTypeNames.push(name);
      } else if (item instanceof FmtMeta.MetaRefExpression_Any) {
        if (secondaryList instanceof Fmt.ArrayExpression) {
          for (let secondaryItem of secondaryList.items) {
            if (secondaryItem instanceof Fmt.DefinitionRefExpression && !secondaryItem.path.parentPath) {
              if (first) {
                first = false;
              } else {
                outFileStr += `, `;
              }
              let name = secondaryItem.path.name;
              outFileStr += `'${name}': MetaRefExpression_${name}`;
              visibleTypeNames.push(name);
            }
          }
        }
        if (first) {
          first = false;
        } else {
          outFileStr += `, `;
        }
        outFileStr += `'': Fmt.GenericMetaRefExpression`;
      }
    }
  }
  outFileStr += `}`;
  return outFileStr;
}

function outputDeclarations(inFile: Fmt.File, visibleTypeNames: string[]): string {
  let outFileStr = '';
  let metaModel = inFile.definitions[0];

  for (let definition of inFile.definitions) {
    if (definition.type.expression instanceof FmtMeta.MetaRefExpression_MetaModel) {
      continue;
    }

    if (hasObjectContents(inFile, definition)) {
      let superName = getSuperName(definition);
      let superClass = superName ? `ObjectContents_${superName}` : `Fmt.ObjectContents`;
      outFileStr += `export class ObjectContents_${definition.name} extends ${superClass} {\n`;
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        for (let member of definition.contents.members) {
          let memberName = translateMemberName(member.name);
          let memberType = getMemberType(inFile, member.type);
          let contentType = getMemberContentType(inFile, member.type);
          let optional = member.optional || (!contentType && member.defaultValue !== undefined);
          outFileStr += `  ${memberName}${optional ? '?' : ''}: ${memberType};\n`;
        }
        outFileStr += `\n`;
      }
      outFileStr += `  fromArgumentList(argumentList: Fmt.ArgumentList): void {\n`;
      if (superName) {
        outFileStr += `    super.fromArgumentList(argumentList);\n`;
      }
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        let argIndex = 0;
        let superDefinition = getSuperDefinition(inFile, definition);
        if (superDefinition) {
          argIndex += getMemberCount(inFile, superDefinition);
        }
        for (let member of definition.contents.members) {
          let memberName = translateMemberName(member.name);
          let optional = member.optional || member.defaultValue !== undefined;
          outFileStr += outputReadCode(inFile, member.name, argIndex, memberName, member.type, optional, false, `    `);
          argIndex++;
        }
      }
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  toArgumentList(argumentList: Fmt.ArgumentList): void {\n`;
      if (superName) {
        outFileStr += `    super.toArgumentList(argumentList);\n`;
      } else {
        outFileStr += `    argumentList.length = 0;\n`;
      }
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        for (let member of definition.contents.members) {
          let memberName = translateMemberName(member.name);
          let optional = member.optional || member.defaultValue !== undefined;
          outFileStr += outputWriteCode(inFile, member.name, memberName, member.type, optional, false, true, `    `);
        }
      }
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_${definition.name}, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {\n`;
      if (superName) {
        outFileStr += `    let changed = super.substituteExpression(fn, result, replacedParameters);\n`;
      } else {
        outFileStr += `    let changed = false;\n`;
      }
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        for (let member of definition.contents.members) {
          if (member.type.expression instanceof FmtMeta.MetaRefExpression_Int || member.type.expression instanceof FmtMeta.MetaRefExpression_String) {
            continue;
          }
          let memberName = translateMemberName(member.name);
          let contentType = getMemberContentType(inFile, member.type);
          let arrayDimensions = contentType ? member.type.arrayDimensions : 0;
          outFileStr += `    if (this.${memberName}) {\n`;
          outFileStr += outputSubstitutionCode(inFile, `this.${memberName}`, `result.${memberName}`, contentType, false, arrayDimensions, `      `);
          outFileStr += `    }\n`;
        }
      }
      outFileStr += `    return changed;\n`;
      outFileStr += `  }\n`;
      outFileStr += `}\n\n`;
    }

    if (isVisibleType(visibleTypeNames, definition)) {
      outFileStr += `export class MetaRefExpression_${definition.name} extends Fmt.MetaRefExpression {\n`;
      if (definition.parameters.length) {
        for (let parameter of definition.parameters) {
          let memberName = translateMemberName(parameter.name);
          let memberType = getMemberType(inFile, parameter.type);
          let contentType = getMemberContentType(inFile, parameter.type);
          let optional = parameter.optional || (!contentType && parameter.defaultValue !== undefined);
          if (parameter.list) {
            memberType += '[]';
          }
          outFileStr += `  ${memberName}${optional ? '?' : ''}: ${memberType};\n`;
        }
        outFileStr += `\n`;
      }
      outFileStr += `  getName(): string {\n`;
      outFileStr += `    return '${definition.name}';\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  fromArgumentList(argumentList: Fmt.ArgumentList): void {\n`;
      let argIndex = 0;
      for (let parameter of definition.parameters) {
        let memberName = translateMemberName(parameter.name);
        let optional = parameter.optional || parameter.defaultValue !== undefined;
        outFileStr += outputReadCode(inFile, parameter.name, argIndex, memberName, parameter.type, optional, parameter.list, `    `);
        argIndex++;
      }
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  toArgumentList(argumentList: Fmt.ArgumentList): void {\n`;
      outFileStr += `    argumentList.length = 0;\n`;
      let named = false;
      for (let parameter of definition.parameters) {
        let memberName = translateMemberName(parameter.name);
        let optional = parameter.optional || parameter.defaultValue !== undefined;
        if (optional && !parameter.list) {
          named = true;
        }
        outFileStr += outputWriteCode(inFile, parameter.name, memberName, parameter.type, optional, parameter.list, named, `    `);
      }
      outFileStr += `  }\n`;
      if (definition.parameters.length) {
        outFileStr += `\n`;
        outFileStr += `  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {\n`;
        outFileStr += `    let result = new MetaRefExpression_${definition.name};\n`;
        outFileStr += `    let changed = false;\n`;
        for (let parameter of definition.parameters) {
          if (parameter.type.expression instanceof FmtMeta.MetaRefExpression_Int || parameter.type.expression instanceof FmtMeta.MetaRefExpression_String) {
            continue;
          }
          let memberName = translateMemberName(parameter.name);
          let contentType = getMemberContentType(inFile, parameter.type);
          let arrayDimensions = contentType ? parameter.type.arrayDimensions : 0;
          if (parameter.list) {
            arrayDimensions++;
          }
          outFileStr += `    if (this.${memberName}) {\n`;
          outFileStr += outputSubstitutionCode(inFile, `this.${memberName}`, `result.${memberName}`, contentType, false, arrayDimensions, `      `);
          outFileStr += `    }\n`;
        }
        outFileStr += `    if (!changed) {\n`;
        outFileStr += `      result = this;\n`;
        outFileStr += `    }\n`;
        outFileStr += `    return fn(result);\n`;
        outFileStr += `  }\n`;
      }
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinitionType && definition.contents.innerDefinitionTypes instanceof Fmt.ArrayExpression && definition.contents.innerDefinitionTypes.items.length) {
        outFileStr += `\n`;
        outFileStr += `  getMetaInnerDefinitionTypes(): Fmt.MetaDefinitionFactory | undefined {\n`;
        outFileStr += `    const innerDefinitionTypes: Fmt.MetaDefinitionList = ${outputDefinitionList(visibleTypeNames, definition.contents.innerDefinitionTypes, (metaModel.contents as FmtMeta.ObjectContents_MetaModel).expressionTypes)};\n`;
        outFileStr += `    return new Fmt.StandardMetaDefinitionFactory(innerDefinitionTypes);\n`;
        outFileStr += `  }\n`;
      }
      if (hasObjectContents(inFile, definition)) {
        outFileStr += `\n`;
        outFileStr += `  createDefinitionContents(): Fmt.ObjectContents | undefined {\n`;
        outFileStr += `    return new ObjectContents_${definition.name};\n`;
        outFileStr += `  }\n`;
      }
      outFileStr += `}\n\n`;
    }
  }

  return outFileStr;
}

function outputMetaDefinitions(inFile: Fmt.File, visibleTypeNames: string[]): string {
  let outFileStr = '';
  let metaModel = inFile.definitions[0];
  if (metaModel && metaModel.contents instanceof FmtMeta.ObjectContents_MetaModel) {
    outFileStr += `const definitionTypes: Fmt.MetaDefinitionList = ${outputDefinitionList(visibleTypeNames, metaModel.contents.definitionTypes, metaModel.contents.expressionTypes)};\n`;
    outFileStr += `const expressionTypes: Fmt.MetaDefinitionList = ${outputDefinitionList(visibleTypeNames, metaModel.contents.expressionTypes)};\n`;
    outFileStr += `const functions: Fmt.MetaDefinitionList = ${outputDefinitionList(visibleTypeNames, metaModel.contents.functions)};\n`;
    outFileStr += `\n`;
    outFileStr += `export const metaModel = new Fmt.MetaModel(\n`;
    outFileStr += `  new Fmt.StandardMetaDefinitionFactory(definitionTypes),\n`;
    outFileStr += `  new Fmt.StandardMetaDefinitionFactory(expressionTypes),\n`;
    outFileStr += `  new Fmt.StandardMetaDefinitionFactory(functions)\n`;
    outFileStr += `);\n`;
    outFileStr += `\n`;
    outFileStr += `export function getMetaModel(path: Fmt.Path) {\n`;
    outFileStr += `  if (path.name !== '${metaModel.name}') {\n`;
    outFileStr += `    throw new Error('File of type "${metaModel.name}" expected');\n`;
    outFileStr += `  }\n`;
    outFileStr += `  return metaModel;\n`;
    outFileStr += `}\n`;
  }
  return outFileStr;
}

function generate(inFileName: string, outFileName: string): void {
  let inFileStr: string = fs.readFileSync(inFileName, 'utf8');
  let inFile: Fmt.File = FmtReader.readString(inFileStr, inFileName, FmtMeta.getMetaModel);

  let outFileStr = `// Generated from ${inFileName} by generateMetaDeclarations.ts.\n`;
  outFileStr += `// tslint:disable:class-name\n`;
  outFileStr += `// tslint:disable:variable-name\n`;
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
  outFileStr += `import * as Fmt from '${relPathStr}format';\n\n`;

  let visibleTypeNames: string[] = [];
  let metaDefinitions = outputMetaDefinitions(inFile, visibleTypeNames);

  outFileStr += outputDeclarations(inFile, visibleTypeNames);
  outFileStr += metaDefinitions;

  fs.writeFileSync(outFileName, outFileStr, 'utf8');
}

if (process.argv.length !== 4) {
  console.error('usage: src/scripts/generateMetaDeclarations.sh <infile> <outfile>');
  process.exit(1);
}

generate(process.argv[2], process.argv[3]);
