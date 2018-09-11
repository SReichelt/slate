import * as Fmt from './format';
import * as FmtMeta from './meta';

function hasObjectContents(definitions: Fmt.DefinitionList, metaDefinition: Fmt.Definition): boolean {
  if (metaDefinition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
    if (metaDefinition.contents.members) {
      return true;
    }
    if (metaDefinition.contents.superType instanceof Fmt.DefinitionRefExpression && !metaDefinition.contents.superType.path.parentPath) {
      let parentMetaDefinition = definitions.getDefinition(metaDefinition.contents.superType.path.name);
      return hasObjectContents(definitions, parentMetaDefinition);
    }
  }
  return false;
}

function findMember(definitions: Fmt.DefinitionList, metaDefinition: Fmt.Definition, name?: string, index?: number): {result: Fmt.Parameter | undefined, memberCount: number} {
  let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
  let result: Fmt.Parameter | undefined = undefined;
  let parentMemberCount = 0;
  if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
    let parentMetaDefinition = definitions.getDefinition(metaContents.superType.path.name);
    let parentMember = findMember(definitions, parentMetaDefinition, name, index);
    result = parentMember.result;
    parentMemberCount = parentMember.memberCount;
  }
  if (metaContents.members) {
    if (name !== undefined) {
      for (let member of metaContents.members) {
        if (member.name === name) {
          result = member;
        }
      }
    } else if (index !== undefined && !result && index >= parentMemberCount && index < parentMemberCount + metaContents.members.length) {
      result = metaContents.members[index - parentMemberCount];
    }
    parentMemberCount += metaContents.members.length;
  }
  return {result: result, memberCount: parentMemberCount};
}

function checkValueImpl(definitions: Fmt.DefinitionList, type: Fmt.Expression, arrayDimensions: number, value: Fmt.Expression): void {
  if (arrayDimensions) {
    if (!(value instanceof Fmt.ArrayExpression)) {
      throw new Error('Array expression expected');
    }
    for (let item of value.items) {
      checkValueImpl(definitions, type, arrayDimensions - 1, item);
    }
  } else if (type instanceof Fmt.MetaRefExpression) {
    if (type instanceof FmtMeta.MetaRefExpression_ParameterList) {
      if (!(value instanceof Fmt.ParameterExpression)) {
        throw new Error('Parameter expression expected');
      }
    } else if (type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
      if (!(value instanceof Fmt.ParameterExpression)) {
        throw new Error('Parameter expression expected');
      }
      if (value.parameters.length !== 1) {
        throw new Error('Single parameter expected');
      }
    }
  } else if (type instanceof Fmt.DefinitionRefExpression && !type.path.parentPath) {
    let metaDefinition = definitions.getDefinition(type.path.name);
    if (hasObjectContents(definitions, metaDefinition)) {
      if (!(value instanceof Fmt.CompoundExpression)) {
        throw new Error('Compound expression expected');
      }
      let objectContents = new DynamicObjectContents(definitions, metaDefinition, false);
      objectContents.fromCompoundExpression(value);
    }
  }
}

function checkValue(definitions: Fmt.DefinitionList, type: Fmt.Type, value: Fmt.Expression): void {
  checkValueImpl(definitions, type.expression, type.arrayDimensions, value);
}

class DynamicObjectContents extends Fmt.GenericObjectContents {
  constructor(private definitions: Fmt.DefinitionList, public metaDefinition: Fmt.Definition, private isDefinition: boolean) {
    super();
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.checkMembers(argumentList, this.metaDefinition);
    let argIndex = 0;
    for (let arg of argumentList) {
      if (!findMember(this.definitions, this.metaDefinition, arg.name, argIndex).result) {
        if (arg.name !== undefined) {
          throw new Error(`Member "${arg.name}" not found`);
        } else {
          throw new Error(`Too many arguments`);
        }
      }
      argIndex++;
    }
  }

  private checkMembers(argumentList: Fmt.ArgumentList, metaDefinition: Fmt.Definition): {memberCount: number, hadOptionalMembers: boolean} {
    let memberIndex = 0;
    let hadOptionalMembers = !this.isDefinition;
    if (metaDefinition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
      let superType = metaDefinition.contents.superType;
      if (superType instanceof Fmt.DefinitionRefExpression && !superType.path.parentPath) {
        let superTypeMetaDefinition = this.definitions.getDefinition(superType.path.name);
        let superTypeResult = this.checkMembers(argumentList, superTypeMetaDefinition);
        memberIndex = superTypeResult.memberCount;
        hadOptionalMembers = superTypeResult.hadOptionalMembers;
      }
      if (metaDefinition.contents.members) {
        for (let member of metaDefinition.contents.members) {
          let memberName: string | undefined = member.name;
          let value: Fmt.Expression | undefined;
          if (member.optional || member.defaultValue) {
            hadOptionalMembers = true;
            value = argumentList.getOptionalValue(memberName, memberIndex);
          } else {
            value = argumentList.getValue(memberName, memberIndex);
            if (!hadOptionalMembers) {
              memberName = undefined;
            }
          }
          if (value) {
            checkValue(this.definitions, member.type, value);
            this.arguments.add(value, memberName);
          }
          memberIndex++;
        }
      }
    }
    return {
      memberCount: memberIndex,
      hadOptionalMembers: hadOptionalMembers
    };
  }
}

class DynamicMetaRefExpression extends Fmt.GenericMetaRefExpression {
  constructor(private definitions: Fmt.DefinitionList, public metaDefinition: Fmt.Definition) {
    super();
    this.name = metaDefinition.name;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let paramIndex = 0;
    let hadOptionalParams = false;
    for (let param of this.metaDefinition.parameters) {
      let paramName = param.list ? undefined : param.name;
      let value: Fmt.Expression | undefined;
      if (param.optional || param.defaultValue) {
        hadOptionalParams = true;
        value = argumentList.getOptionalValue(paramName, paramIndex);
      } else {
        value = argumentList.getValue(paramName, paramIndex);
        if (!hadOptionalParams) {
          paramName = undefined;
        }
      }
      if (value) {
        checkValue(this.definitions, param.type, value);
        this.arguments.add(value, paramName);
      }
      paramIndex++;
      if (param.list) {
        while (value) {
          value = argumentList.getOptionalValue(paramName, paramIndex);
          if (value) {
            checkValue(this.definitions, param.type, value);
            this.arguments.add(value, paramName);
          }
          paramIndex++;
        }
      }
    }
    let argIndex = 0;
    for (let arg of argumentList) {
      this.metaDefinition.parameters.getParameter(arg.name, argIndex);
      argIndex++;
    }
  }

  getMetaInnerDefinitionTypes(): Fmt.MetaDefinitionFactory | undefined {
    if (this.metaDefinition.contents instanceof FmtMeta.ObjectContents_DefinitionType) {
      let metaModelDefinition = this.definitions[0];
      let metaModelDefinitionContents = metaModelDefinition.contents as FmtMeta.ObjectContents_MetaModel;
      return new DynamicMetaDefinitionFactory(this.definitions, this.metaDefinition.contents.innerDefinitionTypes, metaModelDefinitionContents.expressionTypes);
    } else {
      return undefined;
    }
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    if (hasObjectContents(this.definitions, this.metaDefinition)) {
      return new DynamicObjectContents(this.definitions, this.metaDefinition, true);
    } else {
      return super.createDefinitionContents();
    }
  }
}

class DynamicMetaDefinitionFactory implements Fmt.MetaDefinitionFactory {
  private metaDefinitions = new Map<string, Fmt.Definition>();
  private includesAny = false;

  constructor(private definitions: Fmt.DefinitionList, list: Fmt.Expression | undefined, secondaryList?: Fmt.Expression) {
    if (list instanceof Fmt.ArrayExpression) {
      for (let item of list.items) {
        if (item instanceof Fmt.DefinitionRefExpression && !item.path.parentPath) {
          this.metaDefinitions.set(item.path.name, definitions.getDefinition(item.path.name));
        } else if (item instanceof FmtMeta.MetaRefExpression_Any) {
          this.includesAny = true;
          if (secondaryList instanceof Fmt.ArrayExpression) {
            for (let secondaryItem of secondaryList.items) {
              if (secondaryItem instanceof Fmt.DefinitionRefExpression && !secondaryItem.path.parentPath) {
                this.metaDefinitions.set(secondaryItem.path.name, definitions.getDefinition(secondaryItem.path.name));
              }
            }
          }
        }
      }
    }
  }

  createMetaRefExpression(name: string): Fmt.MetaRefExpression {
    let metaDefinition = this.metaDefinitions.get(name);
    if (metaDefinition) {
      return new DynamicMetaRefExpression(this.definitions, metaDefinition);
    } else {
      throw new Error(`Meta object "${name}" not found`);
    }
  }

  allowDefinitionRefs(): boolean {
    return this.includesAny;
  }
}

class DefinitionContentsContext extends Fmt.DerivedContext {
  constructor(public definition: Fmt.Definition, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

class ParameterTypeContext extends Fmt.DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

class ArgumentTypeContext extends Fmt.DerivedContext {
  constructor(public metaDefinitionName: string, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

export class DynamicMetaModel extends Fmt.MetaModel {
  private definitions: Fmt.DefinitionList;
  private getReferencedMetaModel: Fmt.MetaModelGetter;

  constructor(file: Fmt.File, getReferencedMetaModel: Fmt.MetaModelGetter) {
    let definitions = file.definitions;
    let metaModelDefinition = definitions[0];
    let metaModelDefinitionContents = metaModelDefinition.contents as FmtMeta.ObjectContents_MetaModel;
    let definitionTypes = new DynamicMetaDefinitionFactory(definitions, metaModelDefinitionContents.definitionTypes, metaModelDefinitionContents.expressionTypes);
    let expressionTypes = new DynamicMetaDefinitionFactory(definitions, metaModelDefinitionContents.expressionTypes);
    let functions = new DynamicMetaDefinitionFactory(definitions, metaModelDefinitionContents.functions);
    super(definitionTypes, expressionTypes, functions);
    this.definitions = definitions;
    this.getReferencedMetaModel = getReferencedMetaModel;
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Fmt.Context): Fmt.Context {
    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Fmt.Context): Fmt.Context {
    let parentTypeDefinition = this.getParentTypeDefinition(parentContext);
    if (parentTypeDefinition) {
      let member = findMember(this.definitions, parentTypeDefinition, argument.name, argumentIndex).result;
      if (member) {
        while (parentContext instanceof Fmt.DerivedContext) {
          if (parentContext instanceof DefinitionContentsContext || parentContext instanceof Fmt.ParentInfoContext) {
            let stop = true;
            if (member.dependencies) {
              for (let dependency of member.dependencies) {
                if (dependency instanceof Fmt.DefinitionRefExpression) {
                  let curParentTypeDefinition = this.getParentTypeDefinition(parentContext);
                  if (curParentTypeDefinition && !dependency.path.parentPath && dependency.path.name === curParentTypeDefinition.name) {
                    stop = true;
                    break;
                  }
                  stop = false;
                }
              }
            }
            if (stop) {
              break;
            }
          }
          parentContext = parentContext.parentContext;
        }
        if (member.dependencies) {
          for (let dependency of member.dependencies) {
            if (dependency instanceof Fmt.VariableRefExpression) {
              parentContext = this.getMemberArgumentExports(previousArguments, parentTypeDefinition, dependency.variable, parentContext).result;
            }
          }
        }
        if (member.type.expression instanceof Fmt.DefinitionRefExpression) {
          parentContext = new ArgumentTypeContext(member.type.expression.path.name, parentContext);
          let parentPath = member.type.expression.path.parentPath;
          if (parentPath instanceof Fmt.NamedPathItem) {
            let metaModelPath = new Fmt.Path;
            metaModelPath.parentPath = parentPath.parentPath;
            metaModelPath.name = parentPath.name;
            parentContext.metaModel = this.getReferencedMetaModel(metaModelPath);
          }
        }
      }
    }
    let parent = parentContext.parentObject;
    if (parent instanceof DynamicMetaRefExpression) {
      try {
        let metaParameter = parent.metaDefinition.parameters.getParameter(argument.name, argumentIndex);
        if (metaParameter.dependencies) {
          for (let dependency of metaParameter.dependencies) {
            if (dependency instanceof FmtMeta.MetaRefExpression_self) {
              for (let context = parentContext; context instanceof Fmt.DerivedContext; context = context.parentContext) {
                if (context instanceof ParameterTypeContext) {
                  parentContext = new Fmt.ParameterContext(context.parameter, parentContext);
                  break;
                }
              }
              break;
            }
          }
        }
      } catch (error) {
      }
    }
    return super.getArgumentValueContext(argument, argumentIndex, previousArguments, parentContext);
  }

  private getParentTypeDefinition(parentContext: Fmt.Context): Fmt.Definition | undefined {
    let parent = parentContext.parentObject;
    if (parent instanceof Fmt.Definition && parent.type.expression instanceof DynamicMetaRefExpression) {
      return parent.type.expression.metaDefinition;
    } else if (parent instanceof Fmt.CompoundExpression) {
      for (let context = parentContext; context instanceof Fmt.DerivedContext; context = context.parentContext) {
        if (context instanceof ArgumentTypeContext) {
          return this.definitions.getDefinition(context.metaDefinitionName);
        } else if (context.parentObject !== parent && !(context.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    return undefined;
  }

  protected getExports(expression: Fmt.Expression, parentContext: Fmt.Context): Fmt.Context {
    if (expression instanceof DynamicMetaRefExpression) {
      let metaContents = expression.metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
      if (metaContents.exports instanceof Fmt.ArrayExpression) {
        for (let metaExport of metaContents.exports.items) {
          if (metaExport instanceof Fmt.VariableRefExpression) {
            parentContext = this.getArgumentExports(expression.arguments, expression.metaDefinition.parameters, metaExport.variable, parentContext);
          }
        }
      }
    }
    return super.getExports(expression, parentContext);
  }

  private getArgumentExports(argumentList: Fmt.ArgumentList, parameterList: Fmt.ParameterList, parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    let index = parameterList.indexOf(parameter);
    if (index >= 0) {
      let value = argumentList.getOptionalValue(parameter.name, index);
      if (value) {
        parentContext = this.getValueExports(value, parameter.type.expression, parentContext);
      }
    }
    return parentContext;
  }

  private getMemberArgumentExports(argumentList: Fmt.ArgumentList, metaDefinition: Fmt.Definition, member: Fmt.Parameter, parentContext: Fmt.Context): {result: Fmt.Context, memberCount: number} {
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
      let parentMetaDefinition = this.definitions.getDefinition(metaContents.superType.path.name);
      let parentExports = this.getMemberArgumentExports(argumentList, parentMetaDefinition, member, parentContext);
      parentContext = parentExports.result;
      parentMemberCount = parentExports.memberCount;
    }
    if (metaContents.members) {
      let index = metaContents.members.indexOf(member);
      if (index >= 0) {
        let value = argumentList.getOptionalValue(member.name, parentMemberCount + index);
        if (value) {
          parentContext = this.getValueExports(value, member.type.expression, parentContext);
        }
      }
      parentMemberCount += metaContents.members.length;
    }
    return {result: parentContext, memberCount: parentMemberCount};
  }

  private getValueExports(expression: Fmt.Expression, metaType: Fmt.Expression, parentContext: Fmt.Context): Fmt.Context {
    if (expression instanceof Fmt.ArrayExpression) {
      for (let item of expression.items) {
        parentContext = this.getValueExports(item, metaType, parentContext);
      }
      return parentContext;
    } else if (expression instanceof Fmt.ParameterExpression) {
      return this.getParameterListContext(expression.parameters, parentContext);
    } else if (expression instanceof Fmt.CompoundExpression && metaType instanceof Fmt.DefinitionRefExpression && !metaType.path.parentPath) {
      let metaDefinition = this.definitions.getDefinition(metaType.path.name);
      return this.getTypeExports(expression.arguments, metaDefinition, parentContext).result;
    } else {
      return parentContext;
    }
  }

  private getTypeExports(argumentList: Fmt.ArgumentList, metaDefinition: Fmt.Definition, parentContext: Fmt.Context): {result: Fmt.Context, memberCount: number} {
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
      let parentMetaDefinition = this.definitions.getDefinition(metaContents.superType.path.name);
      let parentExports = this.getTypeExports(argumentList, parentMetaDefinition, parentContext);
      parentContext = parentExports.result;
      parentMemberCount = parentExports.memberCount;
    }
    if (metaContents.members) {
      if (metaContents.exports instanceof Fmt.ArrayExpression) {
        for (let metaExport of metaContents.exports.items) {
          if (metaExport instanceof Fmt.VariableRefExpression) {
            let index = metaContents.members.indexOf(metaExport.variable);
            if (index >= 0) {
              let value = argumentList.getOptionalValue(metaExport.variable.name, parentMemberCount + index);
              if (value) {
                parentContext = this.getValueExports(value, metaExport.variable.type.expression, parentContext);
              }
            }
          }
        }
      }
      parentMemberCount += metaContents.members.length;
    }
    return {result: parentContext, memberCount: parentMemberCount};
  }
}
