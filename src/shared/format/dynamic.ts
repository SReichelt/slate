import * as Fmt from './format';
import * as FmtMeta from './meta';

class DynamicMetaRefExpression extends Fmt.GenericMetaRefExpression {
  constructor(public metaDefinition: Fmt.Definition) {
    super();
    this.name = metaDefinition.name;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let paramIndex = 0;
    for (let param of this.metaDefinition.parameters) {
      if (!(param.optional || param.defaultValue)) {
        argumentList.getValue(param.name, paramIndex);
      }
      paramIndex++;
    }
    super.fromArgumentList(argumentList);
  }
}

class DynamicMetaDefinitionFactoryImpl implements Fmt.MetaDefinitionFactory {
  private metaDefinitions = new Map<string, Fmt.Definition>();
  private includesAny = false;

  constructor(file: Fmt.File, list: Fmt.Expression | undefined, secondaryList?: Fmt.Expression) {
    if (list instanceof Fmt.ArrayExpression) {
      for (let item of list.items) {
        if (item instanceof Fmt.DefinitionRefExpression && !item.path.parentPath) {
          this.metaDefinitions.set(item.path.name, file.definitions.getDefinition(item.path.name));
        } else if (item instanceof FmtMeta.MetaRefExpression_Any) {
          this.includesAny = true;
          if (secondaryList instanceof Fmt.ArrayExpression) {
            for (let secondaryItem of secondaryList.items) {
              if (secondaryItem instanceof Fmt.DefinitionRefExpression && !secondaryItem.path.parentPath) {
                this.metaDefinitions.set(secondaryItem.path.name, file.definitions.getDefinition(secondaryItem.path.name));
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
      return new DynamicMetaRefExpression(metaDefinition);
    } else {
      throw new Error(`Meta object "${name}" not found`);
    }
  }

  allowDefinitionRefs(): boolean {
    return this.includesAny;
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
    let metaModelDefinition = file.definitions[0];
    let metaModelDefinitionContents = metaModelDefinition.contents as FmtMeta.ObjectContents_MetaModel;
    let definitionTypes = new DynamicMetaDefinitionFactoryImpl(file, metaModelDefinitionContents.definitionTypes, metaModelDefinitionContents.expressionTypes);
    let expressionTypes = new DynamicMetaDefinitionFactoryImpl(file, metaModelDefinitionContents.expressionTypes);
    let functions = new DynamicMetaDefinitionFactoryImpl(file, metaModelDefinitionContents.functions);
    super(definitionTypes, expressionTypes, functions);
    this.definitions = file.definitions;
    this.getReferencedMetaModel = getReferencedMetaModel;
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, parentContext: Fmt.Context): Fmt.Context {
    // TODO in cases where we know dependencies, check those
    let parent = parentContext.parentObject;
    let parentTypeDefinition: Fmt.Definition | undefined = undefined;
    if (parent instanceof Fmt.Definition && parent.type.expression instanceof DynamicMetaRefExpression) {
      parentTypeDefinition = parent.type.expression.metaDefinition;
    } else if (parent instanceof Fmt.CompoundExpression) {
      for (let context = parentContext; context instanceof Fmt.DerivedContext; context = context.parentContext) {
        if (context instanceof ArgumentTypeContext) {
          parentTypeDefinition = this.definitions.getDefinition(context.metaDefinitionName);
          break;
        } else if (context.parentObject !== parent && !(context.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    if (parentTypeDefinition) {
      let member = this.findMember(parentTypeDefinition, argument.name, argumentIndex).result;
      if (member && member.type.expression instanceof Fmt.DefinitionRefExpression) {
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
    if (parent instanceof DynamicMetaRefExpression) {
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
    }
    return super.getArgumentValueContext(argument, argumentIndex, parentContext);
  }

  private findMember(metaDefinition: Fmt.Definition, name?: string, index?: number): {result: Fmt.Parameter | undefined, memberCount: number} {
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

  protected getExports(expression: Fmt.Expression, parentContext: Fmt.Context): Fmt.Context {
    if (expression instanceof DynamicMetaRefExpression) {
      let metaContents = expression.metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
      if (metaContents.exports instanceof Fmt.ArrayExpression) {
        for (let metaExport of metaContents.exports.items) {
          if (metaExport instanceof Fmt.VariableRefExpression) {
            let index = expression.metaDefinition.parameters.indexOf(metaExport.variable);
            if (index >= 0) {
              let value = expression.arguments.getOptionalValue(metaExport.variable.name, index);
              if (value) {
                parentContext = this.getValueExports(value, metaExport.variable.type.expression, parentContext);
              }
            }
          }
        }
      }
    }
    return super.getExports(expression, parentContext);
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
      return this.getTypeExports(expression, metaDefinition, parentContext).result;
    } else {
      return parentContext;
    }
  }

  private getTypeExports(expression: Fmt.CompoundExpression, metaDefinition: Fmt.Definition, parentContext: Fmt.Context): {result: Fmt.Context, memberCount: number} {
    let metaContents = metaDefinition.contents as FmtMeta.ObjectContents_DefinedType;
    let parentMemberCount = 0;
    if (metaContents.superType instanceof Fmt.DefinitionRefExpression && !metaContents.superType.path.parentPath) {
      let parentMetaDefinition = this.definitions.getDefinition(metaContents.superType.path.name);
      let parentExports = this.getTypeExports(expression, parentMetaDefinition, parentContext);
      parentContext = parentExports.result;
      parentMemberCount = parentExports.memberCount;
    }
    if (metaContents.members) {
      if (metaContents.exports instanceof Fmt.ArrayExpression) {
        for (let metaExport of metaContents.exports.items) {
          if (metaExport instanceof Fmt.VariableRefExpression) {
            let index = metaContents.members.indexOf(metaExport.variable);
            if (index >= 0) {
              let value = expression.arguments.getOptionalValue(metaExport.variable.name, parentMemberCount + index);
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
