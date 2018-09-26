import * as Fmt from './format';
import * as FmtMeta from './meta';

export class DynamicMetaModel extends Fmt.MetaModel {
  definitions: Fmt.DefinitionList;
  private getReferencedMetaModel: Fmt.MetaModelGetter;
  objectContentsMap: Map<Fmt.ArgumentList, DynamicObjectContents>;

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
    this.objectContentsMap = new Map<Fmt.ArgumentList, DynamicObjectContents>();
    definitionTypes.metaModel = this;
    expressionTypes.metaModel = this;
    functions.metaModel = this;
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Fmt.Context): Fmt.Context {
    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Fmt.Context): Fmt.Context {
    if (this.getParentTypeDefinition(previousContext) || previousContext.parentObject instanceof DynamicMetaRefExpression) {
      // Specific dependencies handled in getArgumentValueContext.
      return previousContext;
    } else {
      // Unspecific compound expression; support arbitrary references to parameter lists in previous arguments.
      return super.getNextArgumentContext(argument, argumentIndex, previousContext);
    }
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Fmt.Context): Fmt.Context {
    let context = parentContext;
    let parentTypeDefinition = this.getParentTypeDefinition(context);
    if (parentTypeDefinition) {
      let member = this.findMember(parentTypeDefinition, argument.name, argumentIndex).result;
      if (member) {
        for (; context instanceof Fmt.DerivedContext; context = context.parentContext) {
          if (context instanceof DefinitionContentsContext || context instanceof Fmt.ParentInfoContext) {
            let stop = true;
            if (member.dependencies) {
              for (let dependency of member.dependencies) {
                if (dependency instanceof Fmt.DefinitionRefExpression) {
                  let curParentTypeDefinition = this.getParentTypeDefinition(context);
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
        }
        if (member.dependencies) {
          for (let dependency of member.dependencies) {
            if (dependency instanceof Fmt.VariableRefExpression) {
              context = this.getMemberArgumentExports(previousArguments, parentTypeDefinition, dependency.variable, context).result;
            }
          }
        }
        context = this.getArgumentTypeContext(member.type, context);
      }
    }
    let parent = context.parentObject;
    if (parent instanceof DynamicMetaRefExpression) {
      try {
        let metaParameter = parent.metaDefinition.parameters.getParameter(argument.name, argumentIndex);
        if (metaParameter.dependencies) {
          for (let dependency of metaParameter.dependencies) {
            if (dependency instanceof FmtMeta.MetaRefExpression_self) {
              for (let currentContext = context; currentContext instanceof Fmt.DerivedContext; currentContext = currentContext.parentContext) {
                if (currentContext instanceof ParameterTypeContext) {
                  context = new Fmt.ParameterContext(currentContext.parameter, context);
                  break;
                }
              }
            } else if (dependency instanceof Fmt.VariableRefExpression) {
              context = this.getArgumentExports(previousArguments, parent.metaDefinition.parameters, dependency.variable, context);
            }
          }
        }
        context = this.getArgumentTypeContext(metaParameter.type, context);
      } catch (error) {
      }
    }
    return context;
  }

  private getParentTypeDefinition(context: Fmt.Context): Fmt.Definition | undefined {
    let parent = context.parentObject;
    if (parent instanceof Fmt.Definition && parent.type.expression instanceof DynamicMetaRefExpression) {
      return parent.type.expression.metaDefinition;
    } else if (parent instanceof Fmt.CompoundExpression) {
      for (; context instanceof Fmt.DerivedContext; context = context.parentContext) {
        if (context instanceof ArgumentTypeContext) {
          return this.definitions.getDefinition(context.metaDefinitionName);
        } else if (context.parentObject !== parent && !(context.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    return undefined;
  }

  private getArgumentTypeContext(type: Fmt.Type, parentContext: Fmt.Context): Fmt.Context {
    if (type.expression instanceof Fmt.DefinitionRefExpression) {
      let context = new ArgumentTypeContext(type.expression.path.name, parentContext);
      let parentPath = type.expression.path.parentPath;
      if (parentPath instanceof Fmt.NamedPathItem) {
        let metaModelPath = new Fmt.Path;
        metaModelPath.parentPath = parentPath.parentPath;
        metaModelPath.name = parentPath.name;
        context.metaModel = this.getReferencedMetaModel(metaModelPath);
      }
      return context;
    }
    return parentContext;
  }

  protected getExports(expression: Fmt.Expression, parentContext: Fmt.Context): Fmt.Context {
    let context = parentContext;
    if (expression instanceof DynamicMetaRefExpression) {
      let metaContents = expression.metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
      if (metaContents.exports instanceof Fmt.ArrayExpression) {
        for (let metaExport of metaContents.exports.items) {
          if (metaExport instanceof Fmt.VariableRefExpression) {
            context = this.getArgumentExports(expression.arguments, expression.metaDefinition.parameters, metaExport.variable, context);
          }
        }
      }
    }
    return context;
  }

  private getArgumentExports(argumentList: Fmt.ArgumentList, parameterList: Fmt.ParameterList, parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    let context = parentContext;
    let index = parameterList.indexOf(parameter);
    if (index >= 0) {
      let value = argumentList.getOptionalValue(parameter.name, index);
      if (value) {
        context = this.getValueExports(value, parameter.type.expression, context);
      }
    }
    return context;
  }

  private getMemberArgumentExports(argumentList: Fmt.ArgumentList, metaDefinition: Fmt.Definition, member: Fmt.Parameter, parentContext: Fmt.Context): {result: Fmt.Context, memberCount: number} {
    let context = parentContext;
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
      let parentMetaDefinition = this.definitions.getDefinition(metaContents.superType.path.name);
      let parentExports = this.getMemberArgumentExports(argumentList, parentMetaDefinition, member, context);
      context = parentExports.result;
      parentMemberCount = parentExports.memberCount;
    }
    if (metaContents.members) {
      let index = metaContents.members.indexOf(member);
      if (index >= 0) {
        let value = argumentList.getOptionalValue(member.name, parentMemberCount + index);
        if (value) {
          context = this.getValueExports(value, member.type.expression, context);
        }
      }
      parentMemberCount += metaContents.members.length;
    }
    return {result: context, memberCount: parentMemberCount};
  }

  private getValueExports(expression: Fmt.Expression, metaType: Fmt.Expression, parentContext: Fmt.Context): Fmt.Context {
    if (expression instanceof Fmt.ArrayExpression) {
      let context = parentContext;
      for (let item of expression.items) {
        context = this.getValueExports(item, metaType, context);
      }
      return context;
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
    let context = parentContext;
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
      let parentMetaDefinition = this.definitions.getDefinition(metaContents.superType.path.name);
      let parentExports = this.getTypeExports(argumentList, parentMetaDefinition, context);
      context = parentExports.result;
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
                context = this.getValueExports(value, metaExport.variable.type.expression, context);
              }
            }
          }
        }
      }
      parentMemberCount += metaContents.members.length;
    }
    return {result: context, memberCount: parentMemberCount};
  }

  hasObjectContents(metaDefinition: Fmt.Definition): boolean {
    if (metaDefinition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
      if (metaDefinition.contents.members) {
        return true;
      }
      if (metaDefinition.contents.superType instanceof Fmt.DefinitionRefExpression && !metaDefinition.contents.superType.path.parentPath) {
        let parentMetaDefinition = this.definitions.getDefinition(metaDefinition.contents.superType.path.name);
        return this.hasObjectContents(parentMetaDefinition);
      }
    }
    return false;
  }

  findMember(metaDefinition: Fmt.Definition, name?: string, index?: number): {result: Fmt.Parameter | undefined, memberCount: number} {
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let result: Fmt.Parameter | undefined = undefined;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
      let parentMetaDefinition = this.definitions.getDefinition(metaContents.superType.path.name);
      let parentMember = this.findMember(parentMetaDefinition, name, index);
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

  private checkValueImpl(type: Fmt.Expression, arrayDimensions: number, value: Fmt.Expression): void {
    if (arrayDimensions) {
      if (!(value instanceof Fmt.ArrayExpression)) {
        throw new Error('Array expression expected');
      }
      for (let item of value.items) {
        this.checkValueImpl(type, arrayDimensions - 1, item);
      }
    } else if (type instanceof Fmt.MetaRefExpression) {
      if (type instanceof FmtMeta.MetaRefExpression_Int) {
        if (!(value instanceof Fmt.IntegerExpression)) {
          throw new Error('Integer expected');
        }
      } else if (type instanceof FmtMeta.MetaRefExpression_String) {
        if (!(value instanceof Fmt.StringExpression)) {
          throw new Error('String expected');
        }
      } else if (type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
        if (!(value instanceof Fmt.ParameterExpression)) {
          throw new Error('Parameter expression expected');
        }
        if (value.parameters.length !== 1) {
          throw new Error('Single parameter expected');
        }
      } else if (type instanceof FmtMeta.MetaRefExpression_ParameterList) {
        if (!(value instanceof Fmt.ParameterExpression)) {
          throw new Error('Parameter expression expected');
        }
      } else if (type instanceof FmtMeta.MetaRefExpression_ArgumentList) {
        if (!(value instanceof Fmt.CompoundExpression)) {
          throw new Error('Compound expression expected');
        }
      }
    } else if (type instanceof Fmt.DefinitionRefExpression && !type.path.parentPath) {
      let metaDefinition = this.definitions.getDefinition(type.path.name);
      if (metaDefinition.type.expression instanceof FmtMeta.MetaRefExpression_ExpressionType && this.hasObjectContents(metaDefinition)) {
        if (!(value instanceof Fmt.CompoundExpression)) {
          throw new Error('Compound expression expected');
        }
        let objectContents = new DynamicObjectContents(this, metaDefinition, false);
        objectContents.fromCompoundExpression(value);
      }
    }
  }

  checkValue(type: Fmt.Type, value: Fmt.Expression): void {
    this.checkValueImpl(type.expression, type.arrayDimensions, value);
  }
}

class DynamicMetaDefinitionFactory implements Fmt.MetaDefinitionFactory {
  metaModel: DynamicMetaModel;
  private metaDefinitions = new Map<string, Fmt.Definition>();
  private includesAny = false;

  constructor(definitions: Fmt.DefinitionList, list: Fmt.Expression | undefined, secondaryList?: Fmt.Expression) {
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
      return new DynamicMetaRefExpression(this.metaModel, metaDefinition);
    } else {
      throw new Error(`Meta object "${name}" not found`);
    }
  }

  allowDefinitionRefs(): boolean {
    return this.includesAny;
  }
}

export class DynamicMetaRefExpression extends Fmt.GenericMetaRefExpression {
  originalArguments?: Fmt.ArgumentList;

  constructor(private metaModel: DynamicMetaModel, public metaDefinition: Fmt.Definition) {
    super();
    this.name = metaDefinition.name;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.originalArguments = argumentList;
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
        this.metaModel.checkValue(param.type, value);
        this.arguments.add(value, paramName);
      }
      paramIndex++;
      if (param.list) {
        while (value) {
          value = argumentList.getOptionalValue(paramName, paramIndex);
          if (value) {
            this.metaModel.checkValue(param.type, value);
            this.arguments.add(value, paramName);
          }
          paramIndex++;
        }
      }
    }
    let foundParams = new Set<Fmt.Parameter>();
    let argIndex = 0;
    for (let arg of argumentList) {
      let param = this.metaDefinition.parameters.getParameter(arg.name, argIndex);
      if (foundParams.has(param) && !param.list) {
        throw new Error(`Duplicate argument for "${param.name}"`);
      } else {
        foundParams.add(param);
      }
      argIndex++;
    }
  }

  getMetaInnerDefinitionTypes(): Fmt.MetaDefinitionFactory | undefined {
    if (this.metaDefinition.contents instanceof FmtMeta.ObjectContents_DefinitionType) {
      let metaModelDefinition = this.metaModel.definitions[0];
      let metaModelDefinitionContents = metaModelDefinition.contents as FmtMeta.ObjectContents_MetaModel;
      let factory = new DynamicMetaDefinitionFactory(this.metaModel.definitions, this.metaDefinition.contents.innerDefinitionTypes, metaModelDefinitionContents.expressionTypes);
      factory.metaModel = this.metaModel;
      return factory;
    } else {
      return undefined;
    }
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    if (this.metaModel.hasObjectContents(this.metaDefinition)) {
      return new DynamicObjectContents(this.metaModel, this.metaDefinition, true);
    } else {
      return super.createDefinitionContents();
    }
  }
}

export class DynamicObjectContents extends Fmt.GenericObjectContents {
  originalArguments?: Fmt.ArgumentList;

  constructor(private metaModel: DynamicMetaModel, public metaDefinition: Fmt.Definition, private isDefinition: boolean) {
    super();
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.originalArguments = argumentList;
    this.metaModel.objectContentsMap.set(argumentList, this);
    this.checkMembers(argumentList, this.metaDefinition);
    let foundMembers = new Set<Fmt.Parameter>();
    let argIndex = 0;
    for (let arg of argumentList) {
      let member = this.metaModel.findMember(this.metaDefinition, arg.name, argIndex).result;
      if (member) {
        if (foundMembers.has(member)) {
          throw new Error(`Duplicate argument for "${member.name}"`);
        } else {
          foundMembers.add(member);
        }
      } else {
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
        let superTypeMetaDefinition = this.metaModel.definitions.getDefinition(superType.path.name);
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
            this.metaModel.checkValue(member.type, value);
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