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

function getMemberIndex(inFile: Fmt.File, definition: Fmt.Definition, member: Fmt.Parameter): number | undefined {
  let superDefinition = getSuperDefinition(inFile, definition);
  if (superDefinition) {
    let result = getMemberIndex(inFile, superDefinition, member);
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

function getAllMembers(inFile: Fmt.File, definition: Fmt.Definition): Fmt.Parameter[] {
  let result: Fmt.Parameter[];
  let superDefinition = getSuperDefinition(inFile, definition);
  if (superDefinition) {
    result = getAllMembers(inFile, superDefinition);
  } else {
    result = [];
  }
  if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
    result.push(...definition.contents.members);
  }
  return result;
}

function getMemberContentType(inFile: Fmt.File, type: Fmt.Type): string | undefined {
  if (type.expression instanceof Fmt.MetaRefExpression) {
    if (type.expression instanceof FmtMeta.MetaRefExpression_Int) {
      return 'Fmt.BN';
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
  if (!contentType) {
    contentType = 'Fmt.Expression';
  }
  for (let i = 0; i < type.arrayDimensions; i++) {
    contentType += `[]`;
  }
  return contentType;
}

function outputReadConvCode(inFile: Fmt.File, argName: string, source: string, target: string, type: Fmt.Type, contentType: string | undefined, targetIsList: boolean, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  let outputBegin = targetIsList ? `${target}.push(` : `${target} = `;
  let outputEnd = targetIsList ? `)` : '';
  if (remainingArrayDimensions) {
    outFileStr += `${indent}if (${source} instanceof Fmt.ArrayExpression) {\n`;
    if (remainingArrayDimensions > 1 || contentType) {
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
    } else {
      outFileStr += `${indent}  ${outputBegin}${source}.items${outputEnd};\n`;
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
      outFileStr += `${indent}if (this.${memberName}) {\n`;
      outFileStr += `${indent}  this.${memberName} = undefined;\n`;
      outFileStr += `${indent}}\n`;
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
      outFileStr += `${indent}  if (!this.${memberName}) {\n`;
      outFileStr += `${indent}    this.${memberName} = [];\n`;
      outFileStr += `${indent}  }\n`;
    }
    outFileStr += outputReadConvCode(inFile, argName, variableName, `this.${memberName}!`, type, contentType, true, type.arrayDimensions, `${indent}  `);
    outFileStr += `${indent}  index++;\n`;
    outFileStr += `${indent}}\n`;
  } else {
    if (contentType || type.arrayDimensions) {
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

function outputWriteConvCode(inFile: Fmt.File, argName: string, source: string, target: string, type: Fmt.Type, optional: boolean, list: boolean, named: number, targetIsList: boolean, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  if (list) {
    let item = argName + 'Arg';
    outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
    outFileStr += outputWriteConvCode(inFile, argName, item, target, type, true, false, 0, targetIsList, remainingArrayDimensions, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    let outputBegin = targetIsList ? `${target}.push(` : `${target}.add(`;
    let outputEnd = targetIsList ? `)` : named > 1 ? `, '${argName}', ${optional})` : named > 0 ? `, outputAllNames ? '${argName}' : undefined, ${optional})` : `, undefined, ${optional})`;
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
      outFileStr += outputWriteConvCode(inFile, argName, item, subTarget, type, true, false, 0, true, remainingArrayDimensions - 1, `${indent}  `);
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
          outFileStr += `${indent}${variableName}.parameters = ${source};\n`;
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
            outFileStr += `${indent}${source}.toCompoundExpression(${variableName}, true);\n`;
            outFileStr += `${indent}${outputBegin}${variableName}${outputEnd};\n`;
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

function outputWriteCode(inFile: Fmt.File, argName: string, source: string, type: Fmt.Type, optional: boolean, list: boolean, named: number, indent: string): string {
  let outFileStr = '';
  if (optional) {
    outFileStr += `${indent}if (${source} !== undefined) {\n`;
    outFileStr += outputWriteConvCode(inFile, argName, source, 'argumentList', type, optional, list, named, false, type.arrayDimensions, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    outFileStr += outputWriteConvCode(inFile, argName, source, 'argumentList', type, optional, list, named, false, type.arrayDimensions, indent);
  }
  return outFileStr;
}

function outputTraversalCode(inFile: Fmt.File, source: string, contentType: string | undefined, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  if (remainingArrayDimensions) {
    let item = 'item';
    if (remainingArrayDimensions - 1) {
      item += remainingArrayDimensions - 1;
    }
    outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
    outFileStr += outputTraversalCode(inFile, item, contentType, remainingArrayDimensions - 1, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    outFileStr += `${indent}${source}.traverse(fn);\n`;
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

function outputComparisonCode(inFile: Fmt.File, left: string, right: string, contentType: string | undefined, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  if (remainingArrayDimensions) {
    let index = 'i';
    let leftItem = 'leftItem';
    let rightItem = 'rightItem';
    if (remainingArrayDimensions - 1) {
      index += remainingArrayDimensions - 1;
      leftItem += remainingArrayDimensions - 1;
      rightItem += remainingArrayDimensions - 1;
    }
    outFileStr += `${indent}if (${left} || ${right}) {\n`;
    outFileStr += `${indent}  if (!${left} || !${right} || ${left}.length !== ${right}.length) {\n`;
    outFileStr += `${indent}    return false;\n`;
    outFileStr += `${indent}  }\n`;
    outFileStr += `${indent}  for (let ${index} = 0; ${index} < ${left}.length; ${index}++) {\n`;
    outFileStr += `${indent}    let ${leftItem} = ${left}[${index}];\n`;
    outFileStr += `${indent}    let ${rightItem} = ${right}[${index}];\n`;
    outFileStr += outputComparisonCode(inFile, leftItem, rightItem, contentType, remainingArrayDimensions - 1, `${indent}    `);
    outFileStr += `${indent}  }\n`;
    outFileStr += `${indent}}\n`;
  } else {
    if (contentType === 'Fmt.BN') {
      outFileStr += `${indent}if (${left} !== undefined || ${right} !== undefined) {\n`;
      outFileStr += `${indent}  if (${left} === undefined || ${right} === undefined || !${left}.eq(${right})) {\n`;
      outFileStr += `${indent}    return false;\n`;
      outFileStr += `${indent}  }\n`;
      outFileStr += `${indent}}\n`;
    } else if (contentType === 'string') {
      outFileStr += `${indent}if (${left} !== ${right}) {\n`;
      outFileStr += `${indent}  return false;\n`;
      outFileStr += `${indent}}\n`;
    } else {
      outFileStr += `${indent}if (${left} || ${right}) {\n`;
      outFileStr += `${indent}  if (!${left} || !${right} || !${left}.isEquivalentTo(${right}, fn, replacedParameters)) {\n`;
      outFileStr += `${indent}    return false;\n`;
      outFileStr += `${indent}  }\n`;
      outFileStr += `${indent}}\n`;
    }
  }
  return outFileStr;
}

function outputDefinitionList(visibleTypeNames: string[], list?: Fmt.Expression[], secondaryList?: Fmt.Expression[]): string {
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
        if (visibleTypeNames.indexOf(name) < 0) {
          visibleTypeNames.push(name);
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
              if (visibleTypeNames.indexOf(name) < 0) {
                visibleTypeNames.push(name);
              }
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

function addVisibleTypes(visibleTypeNames: string[], list?: Fmt.Expression[], secondaryList?: Fmt.Expression[]): void {
  outputDefinitionList(visibleTypeNames, list, secondaryList);
}

function outputDeclarations(inFile: Fmt.File, visibleTypeNames: string[]): string {
  let outFileStr = '';
  let metaModel = inFile.definitions[0];

  for (let definition of inFile.definitions) {
    if (definition.type.expression instanceof FmtMeta.MetaRefExpression_MetaModel) {
      continue;
    }

    if (hasObjectContents(inFile, definition)) {
      let superDefinition = getSuperDefinition(inFile, definition);
      if (superDefinition && !hasObjectContents(inFile, superDefinition)) {
        superDefinition = undefined;
      }
      let superClass = superDefinition ? `ObjectContents_${superDefinition.name}` : `Fmt.ObjectContents`;
      outFileStr += `export class ObjectContents_${definition.name} extends ${superClass} {\n`;
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        for (let member of definition.contents.members) {
          let memberName = translateMemberName(member.name);
          let memberType = getMemberType(inFile, member.type);
          let optional = member.optional || member.defaultValue !== undefined;
          outFileStr += `  ${memberName}${optional ? '?' : ''}: ${memberType};\n`;
        }
        outFileStr += `\n`;
      }
      outFileStr += `  fromArgumentList(argumentList: Fmt.ArgumentList): void {\n`;
      if (superDefinition) {
        outFileStr += `    super.fromArgumentList(argumentList);\n`;
      }
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        let argIndex = 0;
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
      outFileStr += `  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean): void {\n`;
      if (superDefinition) {
        outFileStr += `    super.toArgumentList(argumentList, outputAllNames);\n`;
      } else {
        outFileStr += `    argumentList.length = 0;\n`;
      }
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        let named = 1;
        for (let member of definition.contents.members) {
          let memberName = translateMemberName(member.name);
          let optional = member.optional || member.defaultValue !== undefined;
          if (optional) {
            named = 2;
          }
          outFileStr += outputWriteCode(inFile, member.name, `this.${memberName}`, member.type, optional, false, named, `    `);
        }
      }
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_${definition.name} {\n`;
      outFileStr += `    let result = new ObjectContents_${definition.name};\n`;
      outFileStr += `    this.substituteExpression(undefined, result, replacedParameters);\n`;
      outFileStr += `    return result;\n`;
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  traverse(fn: Fmt.ExpressionTraversalFn): void {\n`;
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        for (let member of definition.contents.members) {
          let memberName = translateMemberName(member.name);
          if (!(member.type.expression instanceof FmtMeta.MetaRefExpression_Int || member.type.expression instanceof FmtMeta.MetaRefExpression_String)) {
            let contentType = getMemberContentType(inFile, member.type);
            outFileStr += `    if (this.${memberName}) {\n`;
            outFileStr += outputTraversalCode(inFile, `this.${memberName}`, contentType, member.type.arrayDimensions, '      ');
            outFileStr += `    }\n`;
          }
        }
      }
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_${definition.name}, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {\n`;
      if (superDefinition) {
        outFileStr += `    let changed = super.substituteExpression(fn, result, replacedParameters);\n`;
      } else {
        outFileStr += `    let changed = false;\n`;
      }
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType && definition.contents.members) {
        for (let member of definition.contents.members) {
          let memberName = translateMemberName(member.name);
          if (member.type.expression instanceof FmtMeta.MetaRefExpression_Int || member.type.expression instanceof FmtMeta.MetaRefExpression_String) {
            outFileStr += `    result.${memberName} = this.${memberName};\n`;
          } else {
            let contentType = getMemberContentType(inFile, member.type);
            outFileStr += `    if (this.${memberName}) {\n`;
            outFileStr += outputSubstitutionCode(inFile, `this.${memberName}`, `result.${memberName}`, contentType, false, member.type.arrayDimensions, '      ');
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
          let contentType = getMemberContentType(inFile, member.type);
          outFileStr += outputComparisonCode(inFile, `this.${memberName}`, `objectContents.${memberName}`, contentType, member.type.arrayDimensions, '    ');
        }
      }
      if (superDefinition) {
        outFileStr += `    return super.isEquivalentTo(objectContents, fn, replacedParameters);\n`;
      } else {
        outFileStr += `    return true;\n`;
      }
      outFileStr += `  }\n`;
      outFileStr += `}\n\n`;
    }

    if (isVisibleType(visibleTypeNames, definition)) {
      outFileStr += `export class MetaRefExpression_${definition.name} extends Fmt.MetaRefExpression {\n`;
      if (definition.parameters.length) {
        for (let parameter of definition.parameters) {
          let memberName = translateMemberName(parameter.name);
          let memberType = getMemberType(inFile, parameter.type);
          let optional = parameter.optional || parameter.defaultValue !== undefined;
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
      let named = 0;
      for (let parameter of definition.parameters) {
        let memberName = translateMemberName(parameter.name);
        let optional = parameter.optional || parameter.defaultValue !== undefined;
        if (optional && !parameter.list) {
          named = 2;
        }
        outFileStr += outputWriteCode(inFile, parameter.name, `this.${memberName}`, parameter.type, optional, parameter.list, named, `    `);
      }
      outFileStr += `  }\n`;
      outFileStr += `\n`;
      outFileStr += `  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {\n`;
      if (definition.parameters.length) {
        outFileStr += `    let result = new MetaRefExpression_${definition.name};\n`;
        outFileStr += `    let changed = false;\n`;
        for (let parameter of definition.parameters) {
          let memberName = translateMemberName(parameter.name);
          if ((parameter.type.expression instanceof FmtMeta.MetaRefExpression_Int || parameter.type.expression instanceof FmtMeta.MetaRefExpression_String) && !parameter.list) {
            outFileStr += `    result.${memberName} = this.${memberName};\n`;
          } else {
            let contentType = getMemberContentType(inFile, parameter.type);
            let arrayDimensions = contentType ? parameter.type.arrayDimensions : 0;
            if (parameter.list) {
              arrayDimensions++;
            }
            outFileStr += `    if (this.${memberName}) {\n`;
            outFileStr += outputSubstitutionCode(inFile, `this.${memberName}`, `result.${memberName}`, contentType, false, arrayDimensions, '      ');
            outFileStr += `    }\n`;
          }
        }
        outFileStr += `    return this.getSubstitutionResult(fn, result, changed);\n`;
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
        let contentType = getMemberContentType(inFile, parameter.type);
        let arrayDimensions = contentType ? parameter.type.arrayDimensions : 0;
        if (parameter.list) {
          arrayDimensions++;
        }
        outFileStr += outputComparisonCode(inFile, `this.${memberName}`, `expression.${memberName}`, contentType, arrayDimensions, '    ');
      }
      outFileStr += `    return true;\n`;
      outFileStr += `  }\n`;
      if (definition.contents instanceof FmtMeta.ObjectContents_DefinitionType && definition.contents.innerDefinitionTypes && definition.contents.innerDefinitionTypes.length) {
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
      if (definition.contents instanceof FmtMeta.ObjectContents_ParameterType && definition.contents.canOmit instanceof FmtMeta.MetaRefExpression_true) {
        outFileStr += `\n`;
        outFileStr += `  canOmit(): boolean { return true; }\n`;
      }
      outFileStr += `}\n\n`;
    }
  }

  return outFileStr;
}

function outputExportValueCode(inFile: Fmt.File, argName: string, source: string, context: string, indexParameterLists: string[] | undefined, type: Fmt.Type, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  if (remainingArrayDimensions) {
    let item = 'item';
    if (remainingArrayDimensions - 1) {
      item += remainingArrayDimensions - 1;
    }
    outFileStr += `${indent}for (let ${item} of ${source}) {\n`;
    outFileStr += outputExportValueCode(inFile, argName, item, context, indexParameterLists, type, remainingArrayDimensions - 1, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    if (type.expression instanceof Fmt.MetaRefExpression) {
      let indices = 'indexParameterLists';
      if (indexParameterLists) {
        indices = `${indices} ? [${[...indexParameterLists, `...${indices}`].join(', ')}] : [${indexParameterLists.join(', ')}]`;
      }
      if (type.expression instanceof FmtMeta.MetaRefExpression_SingleParameter) {
        outFileStr += `${indent}${context} = this.getParameterContext(${source}, ${context}, ${indices});\n`;
      } else if (type.expression instanceof FmtMeta.MetaRefExpression_ParameterList) {
        outFileStr += `${indent}${context} = this.getParameterListContext(${source}, ${context}, ${indices});\n`;
      }
    } else if (type.expression instanceof Fmt.DefinitionRefExpression) {
      let path = type.expression.path;
      if (!path.parentPath) {
        let definition: Fmt.Definition | undefined = inFile.definitions.getDefinition(path.name);
        if (definition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && hasObjectContents(inFile, definition)) {
          for (; definition; definition = getSuperDefinition(inFile, definition)) {
            outFileStr += outputDefinitionExportCode(inFile, definition, source, context, indexParameterLists, indent);
          }
        }
      }
    }
  }
  return outFileStr;
}

function outputExportCode(inFile: Fmt.File, argName: string, source: string, context: string, indexParameterLists: string[] | undefined, type: Fmt.Type, optional: boolean, list: boolean, indent: string): string {
  let outFileStr = '';
  let arrayDimensions = getMemberContentType(inFile, type) ? type.arrayDimensions : 0;
  if (list) {
    arrayDimensions++;
  }
  if (optional) {
    outFileStr += `${indent}if (${source} !== undefined) {\n`;
    outFileStr += outputExportValueCode(inFile, argName, source, context, indexParameterLists, type, arrayDimensions, `${indent}  `);
    outFileStr += `${indent}}\n`;
  } else {
    outFileStr += outputExportValueCode(inFile, argName, source, context, indexParameterLists, type, arrayDimensions, indent);
  }
  return outFileStr;
}

function outputDefinitionExportCode(inFile: Fmt.File, definition: Fmt.Definition, source: string, context: string, indexParameterLists: string[] | undefined, indent: string): string {
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
          outFileStr += outputExportCode(inFile, member.name, `${source}.${memberName}`, context, itemIndexParameterLists, member.type, optional, member.list, indent);
        }
      }
    }
  }
  return outFileStr;
}

function outputRawExportValueCode(inFile: Fmt.File, argName: string, source: string, context: string, type: Fmt.Type, remainingArrayDimensions: number, indent: string): string {
  let outFileStr = '';
  if (remainingArrayDimensions) {
    let item = 'item';
    if (remainingArrayDimensions - 1) {
      item += remainingArrayDimensions - 1;
    }
    let exportValueCode = outputRawExportValueCode(inFile, argName, item, context, type, remainingArrayDimensions - 1, `${indent}    `);
    if (exportValueCode) {
      outFileStr += `${indent}if (${source} instanceof Fmt.ArrayExpression) {\n`;
      outFileStr += `${indent}  for (let ${item} of ${source}.items) {\n`;
      outFileStr += exportValueCode;
      outFileStr += `${indent}  }\n`;
      outFileStr += `${indent}}\n`;
    }
  } else {
    if (type.expression instanceof Fmt.MetaRefExpression) {
      if (type.expression instanceof FmtMeta.MetaRefExpression_SingleParameter || type.expression instanceof FmtMeta.MetaRefExpression_ParameterList) {
        outFileStr += `${indent}if (${source} instanceof Fmt.ParameterExpression) {\n`;
        outFileStr += `${indent}  ${context} = this.getParameterListContext(${source}.parameters, ${context});\n`;
        outFileStr += `${indent}}\n`;
      }
    } else if (type.expression instanceof Fmt.DefinitionRefExpression) {
      let path = type.expression.path;
      if (!path.parentPath) {
        let definition: Fmt.Definition | undefined = inFile.definitions.getDefinition(path.name);
        if (definition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && hasObjectContents(inFile, definition)) {
          for (; definition; definition = getSuperDefinition(inFile, definition)) {
            let definitionExportCode = outputRawDefinitionExportCode(inFile, definition, `${source}.arguments`, context, `${indent}  `);
            if (definitionExportCode) {
              outFileStr += `${indent}if (${source} instanceof Fmt.CompoundExpression) {\n`;
              outFileStr += definitionExportCode;
              outFileStr += `${indent}}\n`;
            }
          }
        }
      }
    }
  }
  return outFileStr;
}

function outputRawExportCode(inFile: Fmt.File, argName: string, argIndex: number, source: string, context: string, type: Fmt.Type, list: boolean, indent: string): string {
  let outFileStr = '';
  let arrayDimensions = getMemberContentType(inFile, type) ? type.arrayDimensions : 0;
  if (list) {
    arrayDimensions++;
  }
  let value = `${argName}Value`;
  let exportValueCode = outputRawExportValueCode(inFile, argName, value, context, type, arrayDimensions, indent);
  if (exportValueCode) {
    outFileStr += `${indent}let ${value} = ${source}.getOptionalValue('${argName}', ${argIndex});\n`;
    outFileStr += exportValueCode;
  }
  return outFileStr;
}

function outputRawDefinitionExportCode(inFile: Fmt.File, definition: Fmt.Definition, source: string, context: string, indent: string): string {
  let outFileStr = '';
  if (definition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
    let exports = definition.contents.exports;
    if (exports) {
      for (let item of exports) {
        if (item instanceof Fmt.VariableRefExpression) {
          let member = item.variable;
          let memberIndex = getMemberIndex(inFile, definition, member);
          if (memberIndex !== undefined) {
            outFileStr += outputRawExportCode(inFile, member.name, memberIndex, source, context, member.type, member.list, indent);
          }
        }
      }
    }
  }
  return outFileStr;
}

function outputMemberDependencyCode(inFile: Fmt.File, visibleTypeNames: string[], definition: Fmt.Definition, argumentVar: string, argumentIndexVar: string, source: string, context: string, indent: string): string {
  let outFileStr = '';
  let memberIndex = 0;
  for (let member of getAllMembers(inFile, definition)) {
    let argumentTypeStr = outputArgumentTypeContext(inFile, member, `${indent}  `);
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
            let dependencyDefinition = inFile.definitions.getDefinition(dependency.path.name);
            if (isVisibleType(visibleTypeNames, dependencyDefinition)) {
              outFileStr += `${indent}    if (context instanceof DefinitionContentsContext && context.definition.type.expression instanceof MetaRefExpression_${dependency.path.name}) {\n`;
              outFileStr += `${indent}      break;\n`;
              outFileStr += `${indent}    }\n`;
            }
            if (hasObjectContents(inFile, dependencyDefinition)) {
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
            let variableIndex = getMemberIndex(inFile, definition, variable);
            if (variableIndex !== undefined) {
              outFileStr += outputRawExportCode(inFile, variable.name, variableIndex, source, context, variable.type, variable.list, `${indent}  `);
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

function outputParameterDependencyCode(inFile: Fmt.File, parameters: Fmt.ParameterList, argumentVar: string, argumentIndexVar: string, source: string, context: string, indent: string): string {
  let outFileStr = '';
  let paramIndex = 0;
  for (let param of parameters) {
    let argumentTypeStr = outputArgumentTypeContext(inFile, param, `${indent}  `);
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
              outFileStr += outputRawExportCode(inFile, variable.name, variableIndex, source, context, variable.type, variable.list, `${indent}  `);
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

function outputDefinitionMemberDependencyCode(inFile: Fmt.File, definitionTypes: Fmt.Expression[] | undefined, visibleTypeNames: string[], indent: string): string {
  let outFileStr = '';
  if (definitionTypes) {
    for (let definitionType of definitionTypes) {
      if (definitionType instanceof Fmt.DefinitionRefExpression) {
        let definition = inFile.definitions.getDefinition(definitionType.path.name);
        if (definition.contents instanceof FmtMeta.ObjectContents_DefinitionType) {
          let memberDependencyCode = outputMemberDependencyCode(inFile, visibleTypeNames, definition, 'argument', 'argumentIndex', 'previousArguments', 'context', `${indent}  `);
          if (memberDependencyCode) {
            outFileStr += `${indent}if (type instanceof MetaRefExpression_${definitionType.path.name}) {\n`;
            outFileStr += memberDependencyCode;
            outFileStr += `${indent}}\n`;
          }
          outFileStr += outputDefinitionMemberDependencyCode(inFile, definition.contents.innerDefinitionTypes, visibleTypeNames, indent);
        }
      }
    }
  }
  return outFileStr;
}

function outputExpressionMemberDependencyCode(inFile: Fmt.File, visibleTypeNames: string[], indent: string): string {
  let outFileStr = '';
  for (let definition of inFile.definitions) {
    if (definition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && hasObjectContents(inFile, definition)) {
      let memberDependencyCode = outputMemberDependencyCode(inFile, visibleTypeNames, definition, 'argument', 'argumentIndex', 'previousArguments', 'context', `${indent}  `);
      if (memberDependencyCode) {
        outFileStr += `${indent}if (currentContext.objectContentsClass === ObjectContents_${definition.name}) {\n`;
        outFileStr += memberDependencyCode;
        outFileStr += `${indent}}\n`;
      }
    }
  }
  return outFileStr;
}

function outputDefinitionParameterDependencyCode(inFile: Fmt.File, visibleTypeNames: string[], indent: string): string {
  let outFileStr = '';
  for (let definition of inFile.definitions) {
    if (definition.type.expression instanceof FmtMeta.MetaRefExpression_MetaModel) {
      continue;
    }
    if (isVisibleType(visibleTypeNames, definition)) {
      let parameterDependencyCode = outputParameterDependencyCode(inFile, definition.parameters, 'argument', 'argumentIndex', 'previousArguments', 'context', '        ');
      if (parameterDependencyCode) {
        outFileStr += `${indent}if (parent instanceof MetaRefExpression_${definition.name}) {\n`;
        outFileStr += parameterDependencyCode;
        outFileStr += `${indent}}\n`;
      }
    }
  }
  return outFileStr;
}

function outputArgumentTypeContext(inFile: Fmt.File, param: Fmt.Parameter, indent: string): string {
  let outFileStr = '';
  if (param.type.expression instanceof Fmt.DefinitionRefExpression) {
    let path = param.type.expression.path;
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
      let typeDefinition = inFile.definitions.getDefinition(path.name);
      if (typeDefinition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && hasObjectContents(inFile, typeDefinition)) {
        outFileStr += `${indent}context = new ArgumentTypeContext(ObjectContents_${path.name}, context);\n`;
      }
    }
  }
  return outFileStr;
}

function outputMetaDefinitions(inFile: Fmt.File, visibleTypeNames: string[]): string {
  let outFileStr = '';
  let metaModel = inFile.definitions[0];
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
    outFileStr += `  constructor(public objectContentsClass: {new(): Fmt.ObjectContents}, parentContext: Ctx.Context) {\n`;
    outFileStr += `    super(parentContext);\n`;
    outFileStr += `  }\n`;
    outFileStr += `}\n`;
    outFileStr += `\n`;
    outFileStr += `const definitionTypes: Fmt.MetaDefinitionList = ${outputDefinitionList(visibleTypeNames, metaModel.contents.definitionTypes, metaModel.contents.expressionTypes)};\n`;
    outFileStr += `const expressionTypes: Fmt.MetaDefinitionList = ${outputDefinitionList(visibleTypeNames, metaModel.contents.expressionTypes)};\n`;
    outFileStr += `const functions: Fmt.MetaDefinitionList = ${outputDefinitionList(visibleTypeNames, metaModel.contents.functions)};\n`;
    outFileStr += `\n`;
    for (;;) {
      let oldVisibleTypeCount = visibleTypeNames.length;
      for (let definition of inFile.definitions) {
        if (isVisibleType(visibleTypeNames, definition) && definition.contents instanceof FmtMeta.ObjectContents_DefinitionType && definition.contents.innerDefinitionTypes) {
          addVisibleTypes(visibleTypeNames, definition.contents.innerDefinitionTypes, metaModel.contents.expressionTypes);
        }
      }
      if (visibleTypeNames.length === oldVisibleTypeCount) {
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
          outFileStr += `      let type = parent.type.expression;\n`;
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
    let definitionMemberDependencyCode = outputDefinitionMemberDependencyCode(inFile, metaModel.contents.definitionTypes, visibleTypeNames, '        ');
    if (definitionMemberDependencyCode) {
      outFileStr += `    if (parent instanceof Fmt.Definition) {\n`;
      outFileStr += `      let type = parent.type.expression;\n`;
      outFileStr += `      if (type instanceof Fmt.MetaRefExpression) {\n`;
      outFileStr += definitionMemberDependencyCode;
      outFileStr += `      }\n`;
      outFileStr += `    }\n`;
    }
    outFileStr += `    if (parent instanceof Fmt.CompoundExpression) {\n`;
    outFileStr += `      for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {\n`;
    outFileStr += `        if (currentContext instanceof ArgumentTypeContext) {\n`;
    outFileStr += outputExpressionMemberDependencyCode(inFile, visibleTypeNames, '          ');
    outFileStr += `          break;\n`;
    outFileStr += `        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {\n`;
    outFileStr += `          break;\n`;
    outFileStr += `        }\n`;
    outFileStr += `      }\n`;
    outFileStr += `    }\n`;
    let parameterDependencyCode = outputDefinitionParameterDependencyCode(inFile, visibleTypeNames, '      ');
    if (parameterDependencyCode) {
      outFileStr += `    if (parent instanceof Fmt.MetaRefExpression) {\n`;
      outFileStr += parameterDependencyCode;
      outFileStr += `    }\n`;
    }
    outFileStr += `    return context;\n`;
    outFileStr += `  }\n`;
    let hasExports = false;
    for (let definition of inFile.definitions) {
      if (definition.type.expression instanceof FmtMeta.MetaRefExpression_MetaModel) {
        continue;
      }
      if (isVisibleType(visibleTypeNames, definition)) {
        let definitionExportCode = outputDefinitionExportCode(inFile, definition, 'expression', 'context', undefined, '      ');
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

interface ReferencedMetaModel {
  inFileName: string;
  outFileName: string;
}

function generate(inFileName: string, outFileName: string, ReferencedMetaModels: ReferencedMetaModel[]): void {
  let inFileStr: string = fs.readFileSync(inFileName, 'utf8');
  let inFile: Fmt.File = FmtReader.readString(inFileStr, inFileName, FmtMeta.getMetaModel);

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
  for (let ref of ReferencedMetaModels) {
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

  let visibleTypeNames: string[] = [];
  let metaDefinitions = outputMetaDefinitions(inFile, visibleTypeNames);

  outFileStr += outputDeclarations(inFile, visibleTypeNames);
  outFileStr += metaDefinitions;

  fs.writeFileSync(outFileName, outFileStr, 'utf8');
}

if (process.argv.length < 4) {
  console.error('usage: src/scripts/generateMetaDeclarations.sh <infile> <outfile> [<refinfile> <refoutfile> [...]]');
  process.exit(2);
}

let refs: ReferencedMetaModel[] = [];
for (let argIndex = 4; argIndex + 1 < process.argv.length; argIndex++) {
  refs.push({inFileName: process.argv[argIndex], outFileName: process.argv[argIndex + 1]});
}
generate(process.argv[2], process.argv[3], refs);
