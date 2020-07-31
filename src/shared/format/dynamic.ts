import * as Fmt from './format';
import * as Ctx from './context';
import * as Meta from './metaModel';
import * as FmtMeta from './meta';

export type ObjectContentsCallbackFn = (expression: Fmt.CompoundExpression, objectContents: DynamicObjectContents) => void;
export type MemberCallbackFn = (member: Fmt.Parameter, value: Fmt.Expression) => void;

export class DynamicMetaModel extends Meta.MetaModel {
  fileName: string;
  definitions: Fmt.DefinitionList;
  private getReferencedMetaModel: Meta.MetaModelGetter;
  onObjectContentsCreated?: ObjectContentsCallbackFn;

  constructor(file: Fmt.File, fileName: string, getReferencedMetaModel: Meta.MetaModelGetter) {
    let definitions = file.definitions;
    let metaModelDefinition = definitions[0];
    let metaModelDefinitionContents = metaModelDefinition.contents as FmtMeta.ObjectContents_MetaModel;
    let definitionTypes = new DynamicMetaDefinitionFactory(definitions, metaModelDefinitionContents.definitionTypes, metaModelDefinitionContents.expressionTypes);
    let expressionTypes = new DynamicMetaDefinitionFactory(definitions, metaModelDefinitionContents.expressionTypes);
    let functions = new DynamicMetaDefinitionFactory(definitions, metaModelDefinitionContents.functions);
    super(metaModelDefinition.name, definitionTypes, expressionTypes, functions);
    this.fileName = fileName;
    this.definitions = definitions;
    this.getReferencedMetaModel = getReferencedMetaModel;
    definitionTypes.metaModel = this;
    expressionTypes.metaModel = this;
    functions.metaModel = this;
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Ctx.Context): Ctx.Context {
    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Ctx.Context): Ctx.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Ctx.Context): Ctx.Context {
    if (this.getParentTypeDefinition(previousContext) || previousContext.parentObject instanceof DynamicMetaRefExpression) {
      // Specific dependencies handled in getArgumentValueContext.
      return previousContext;
    } else {
      // Unspecific compound expression; support arbitrary references to parameter lists in previous arguments.
      return super.getNextArgumentContext(argument, argumentIndex, previousContext);
    }
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Ctx.Context): Ctx.Context {
    let context = parentContext;
    let parentTypeDefinition = this.getParentTypeDefinition(context);
    if (parentTypeDefinition) {
      let member = this.findMember(parentTypeDefinition, argument.name, argumentIndex).result;
      if (member) {
        for (; context instanceof Ctx.DerivedContext; context = context.parentContext) {
          if (context instanceof DefinitionContentsContext || context instanceof Ctx.ParentInfoContext) {
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
              for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {
                if (currentContext instanceof ParameterTypeContext) {
                  context = new Ctx.ParameterContext(currentContext.parameter, context);
                  break;
                }
              }
            } else if (dependency instanceof Fmt.VariableRefExpression) {
              context = this.getArgumentExports(previousArguments, parent.metaDefinition.parameters, dependency, context);
            }
          }
        }
        context = this.getArgumentTypeContext(metaParameter.type, context);
      } catch (error) {
      }
    }
    return context;
  }

  private getParentTypeDefinition(context: Ctx.Context): Fmt.Definition | undefined {
    let parent = context.parentObject;
    if (parent instanceof Fmt.Definition && parent.type instanceof DynamicMetaRefExpression) {
      return parent.type.metaDefinition;
    } else if (parent instanceof Fmt.CompoundExpression) {
      for (; context instanceof Ctx.DerivedContext; context = context.parentContext) {
        if (context instanceof ArgumentTypeContext) {
          let definition = this.definitions.getDefinition(context.metaDefinitionName);
          if (definition.type instanceof FmtMeta.MetaRefExpression_ExpressionType) {
            return definition;
          }
        }
        if (context.parentObject !== parent && !(context.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    return undefined;
  }

  private getArgumentTypeContext(type: Fmt.Expression, parentContext: Ctx.Context): Ctx.Context {
    if (type instanceof Fmt.DefinitionRefExpression) {
      let path = type.path;
      let context = new ArgumentTypeContext(path.name, parentContext);
      let metaModel = this.getReferencedMetaModelFromPath(path);
      if (metaModel) {
        context.metaModel = metaModel;
      }
      return context;
    }
    return parentContext;
  }

  protected getExports(expression: Fmt.Expression, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): Ctx.Context {
    let context = parentContext;
    if (expression instanceof DynamicMetaRefExpression) {
      let metaContents = expression.metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
      if (metaContents.exports) {
        for (let metaExport of metaContents.exports) {
          context = this.getArgumentExports(expression.arguments, expression.metaDefinition.parameters, metaExport, context, indexParameterLists);
        }
      }
    }
    return context;
  }

  private getArgumentExports(argumentList: Fmt.ArgumentList, parameterList: Fmt.ParameterList, parameterExpression: Fmt.Expression, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[], indexOffset: number = 0): Ctx.Context {
    let context = parentContext;
    while (parameterExpression instanceof Fmt.IndexedExpression) {
      if (parameterExpression.arguments) {
        let newIndexParameterLists: Fmt.ParameterList[] = [];
        for (let indexArg of parameterExpression.arguments) {
          if (indexArg.value instanceof Fmt.VariableRefExpression) {
            let indexValue = this.getArgumentValue(argumentList, parameterList, indexArg.value.variable);
            if (indexValue instanceof Fmt.ParameterExpression) {
              newIndexParameterLists.push(indexValue.parameters);
            }
          }
        }
        indexParameterLists = indexParameterLists ? newIndexParameterLists.concat(indexParameterLists) : newIndexParameterLists;
      }
      parameterExpression = parameterExpression.body;
    }
    if (parameterExpression instanceof Fmt.VariableRefExpression) {
      let parameter = parameterExpression.variable;
      let value = this.getArgumentValue(argumentList, parameterList, parameter, indexOffset);
      if (value) {
        context = this.getValueExports(value, parameter.type, context, indexParameterLists);
      }
    }
    return context;
  }

  private getMemberArgumentExports(argumentList: Fmt.ArgumentList, metaDefinition: Fmt.Definition, member: Fmt.Parameter, parentContext: Ctx.Context): {result: Ctx.Context, memberCount: number} {
    let context = parentContext;
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression) {
      let [parentMetaModel, parentMetaDefinition] = this.getMetaDefinition(metaContents.superType.path);
      let parentExports = parentMetaModel.getMemberArgumentExports(argumentList, parentMetaDefinition, member, context);
      context = parentExports.result;
      parentMemberCount = parentExports.memberCount;
    }
    if (metaContents.members) {
      let value = this.getArgumentValue(argumentList, metaContents.members, member, parentMemberCount);
      if (value) {
        context = this.getValueExports(value, member.type, context);
      }
      parentMemberCount += metaContents.members.length;
    }
    return {result: context, memberCount: parentMemberCount};
  }

  private getValueExports(expression: Fmt.Expression, metaType: Fmt.Expression, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): Ctx.Context {
    if (expression instanceof Fmt.ArrayExpression) {
      let context = parentContext;
      for (let item of expression.items) {
        context = this.getValueExports(item, metaType, context, indexParameterLists);
      }
      return context;
    } else if (expression instanceof Fmt.ParameterExpression) {
      return this.getParameterListContext(expression.parameters, parentContext, indexParameterLists);
    } else if (expression instanceof Fmt.CompoundExpression && metaType instanceof Fmt.DefinitionRefExpression) {
      let [metaModel, metaDefinition] = this.getMetaDefinition(metaType.path);
      return metaModel.getTypeExports(expression.arguments, metaDefinition, parentContext, indexParameterLists).result;
    } else {
      return parentContext;
    }
  }

  private getTypeExports(argumentList: Fmt.ArgumentList, metaDefinition: Fmt.Definition, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): {result: Ctx.Context, memberCount: number} {
    let context = parentContext;
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression) {
      let [parentMetaModel, parentMetaDefinition] = this.getMetaDefinition(metaContents.superType.path);
      let parentExports = parentMetaModel.getTypeExports(argumentList, parentMetaDefinition, context, indexParameterLists);
      context = parentExports.result;
      parentMemberCount = parentExports.memberCount;
    }
    if (metaContents.members) {
      if (metaContents.exports) {
        for (let metaExport of metaContents.exports) {
          if (metaExport instanceof Fmt.VariableRefExpression) {
            context = this.getArgumentExports(argumentList, metaContents.members, metaExport, context, indexParameterLists, parentMemberCount);
          }
        }
      }
      parentMemberCount += metaContents.members.length;
    }
    return {result: context, memberCount: parentMemberCount};
  }

  private getArgumentValue(argumentList: Fmt.ArgumentList, parameterList: Fmt.ParameterList, parameter: Fmt.Parameter, indexOffset: number = 0): Fmt.Expression | undefined {
    let index = parameterList.indexOf(parameter);
    if (index >= 0) {
      return argumentList.getOptionalValue(parameter.name, indexOffset + index);
    } else {
      return undefined;
    }
  }

  hasObjectContents(metaDefinition: Fmt.Definition): boolean {
    if (metaDefinition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
      if (metaDefinition.contents.members) {
        return true;
      }
      if (metaDefinition.contents.superType instanceof Fmt.DefinitionRefExpression) {
        let [parentMetaModel, parentMetaDefinition] = this.getMetaDefinition(metaDefinition.contents.superType.path);
        return parentMetaModel.hasObjectContents(parentMetaDefinition);
      }
    }
    return false;
  }

  findMember(metaDefinition: Fmt.Definition, name?: string, index?: number): {result: Fmt.Parameter | undefined, memberCount: number} {
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let result: Fmt.Parameter | undefined = undefined;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression) {
      let [parentMetaModel, parentMetaDefinition] = this.getMetaDefinition(metaContents.superType.path);
      let parentMember = parentMetaModel.findMember(parentMetaDefinition, name, index);
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

  private checkValueImpl(type: Fmt.Expression, value: Fmt.Expression, onObjectContentsCreated?: ObjectContentsCallbackFn, onMemberFound?: MemberCallbackFn): void {
    if (type instanceof Fmt.IndexedExpression) {
      if (!(value instanceof Fmt.ArrayExpression)) {
        throw new Error('Array expression expected');
      }
      for (let item of value.items) {
        this.checkValueImpl(type.body, item, onObjectContentsCreated, onMemberFound);
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
    } else if (type instanceof Fmt.DefinitionRefExpression) {
      let [metaModel, metaDefinition] = this.getMetaDefinition(type.path);
      if (metaDefinition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && metaModel.hasObjectContents(metaDefinition)) {
        if (!(value instanceof Fmt.CompoundExpression)) {
          throw new Error('Compound expression expected');
        }
        let objectContents = new DynamicObjectContents(metaModel, metaDefinition, false, onMemberFound);
        onObjectContentsCreated?.(value, objectContents);
        objectContents.fromCompoundExpression(value);
      }
    }
  }

  checkValue(type: Fmt.Expression, value: Fmt.Expression, onObjectContentsCreated?: ObjectContentsCallbackFn, onMemberFound?: MemberCallbackFn): void {
    this.checkValueImpl(type, value, onObjectContentsCreated ?? this.onObjectContentsCreated, onMemberFound);
  }

  private getReferencedMetaModelFromPath(path: Fmt.Path): Meta.MetaModel | undefined {
    let parentPath = path.parentPath;
    if (parentPath instanceof Fmt.NamedPathItem) {
      let metaModelPath = new Fmt.Path;
      metaModelPath.parentPath = parentPath.parentPath;
      metaModelPath.name = parentPath.name;
      return this.getReferencedMetaModel(metaModelPath);
    } else {
      return undefined;
    }
  }

  getMetaDefinition(path: Fmt.Path): [DynamicMetaModel, Fmt.Definition] {
    if (path.parentPath) {
      let metaModel = this.getReferencedMetaModelFromPath(path);
      if (metaModel instanceof DynamicMetaModel) {
        return metaModel.getNamedMetaDefinition(path.name);
      } else {
        throw new Error('Path does not reference a meta model');
      }
    } else {
      return this.getNamedMetaDefinition(path.name);
    }
  }

  private getNamedMetaDefinition(name: string): [DynamicMetaModel, Fmt.Definition] {
    return [this, this.definitions.getDefinition(name)];
  }
}

export class DynamicMetaDefinitionFactory implements Fmt.MetaDefinitionFactory {
  metaModel: DynamicMetaModel;
  metaDefinitions = new Map<string, Fmt.Definition>();
  includesAny = false;

  constructor(definitions: Fmt.DefinitionList, list: Fmt.Expression[] | undefined, secondaryList?: Fmt.Expression[]) {
    if (list) {
      for (let item of list) {
        if (item instanceof Fmt.DefinitionRefExpression && !item.path.parentPath) {
          this.metaDefinitions.set(item.path.name, definitions.getDefinition(item.path.name));
        } else if (item instanceof FmtMeta.MetaRefExpression_Any) {
          this.includesAny = true;
          if (secondaryList) {
            for (let secondaryItem of secondaryList) {
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

  allowArbitraryReferences(): boolean {
    return this.includesAny;
  }
}

export class DynamicMetaRefExpression extends Fmt.GenericMetaRefExpression {
  originalArguments?: Fmt.ArgumentList;

  constructor(public metaModel: DynamicMetaModel, public metaDefinition: Fmt.Definition) {
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

  canOmit(): boolean {
    if (this.metaDefinition.contents instanceof FmtMeta.ObjectContents_ParameterType) {
      return this.metaDefinition.contents.canOmit instanceof FmtMeta.MetaRefExpression_true;
    }
    return false;
  }
}

export class DynamicObjectContents extends Fmt.GenericObjectContents {
  originalArguments?: Fmt.ArgumentList;

  constructor(public metaModel: DynamicMetaModel, public metaDefinition: Fmt.Definition, private isDefinition: boolean, private onMemberFound?: MemberCallbackFn) {
    super();
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.originalArguments = argumentList;
    this.checkMembers(argumentList, this.metaModel, this.metaDefinition);
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

  private checkMembers(argumentList: Fmt.ArgumentList, metaModel: DynamicMetaModel, metaDefinition: Fmt.Definition): {memberCount: number, hadOptionalMembers: boolean} {
    let memberIndex = 0;
    let hadOptionalMembers = this.isDefinition;
    if (metaDefinition.contents instanceof FmtMeta.ObjectContents_DefinedType) {
      let superType = metaDefinition.contents.superType;
      if (superType instanceof Fmt.DefinitionRefExpression) {
        let [superTypeMetaModel, superTypeMetaDefinition] = metaModel.getMetaDefinition(superType.path);
        let superTypeResult = this.checkMembers(argumentList, superTypeMetaModel, superTypeMetaDefinition);
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
            metaModel.checkValue(member.type, value);
            this.onMemberFound?.(member, value);
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

class DefinitionContentsContext extends Ctx.DerivedContext {
  constructor(public definition: Fmt.Definition, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

class ParameterTypeContext extends Ctx.DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

class ArgumentTypeContext extends Ctx.DerivedContext {
  constructor(public metaDefinitionName: string, parentContext: Ctx.Context) {
    super(parentContext);
  }
}
