import * as Fmt from './format';
import * as Ctx from './context';

export class MetaModel {
  constructor(public name: string, public definitionTypes: Fmt.MetaDefinitionFactory, public expressionTypes: Fmt.MetaDefinitionFactory, public functions: Fmt.MetaDefinitionFactory) {}

  getRootContext(): Ctx.Context {
    return new Ctx.EmptyContext(this);
  }

  getDefinitionTypeContext(definition: Fmt.Definition, parentContext: Ctx.Context): Ctx.Context {
    return parentContext;
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Ctx.Context): Ctx.Context {
    return this.getParameterListContext(definition.parameters, parentContext);
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Ctx.Context): Ctx.Context {
    return parentContext;
  }

  getNextParameterContext(parameter: Fmt.Parameter, previousContext: Ctx.Context): Ctx.Context {
    return this.getParameterContext(parameter, previousContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Ctx.Context): Ctx.Context {
    if (argument.value instanceof Fmt.ParameterExpression) {
      return this.getParameterListContext(argument.value.parameters, previousContext);
    } else {
      return previousContext;
    }
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Ctx.Context): Ctx.Context {
    return parentContext;
  }

  getParameterContext(parameter: Fmt.Parameter, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): Ctx.Context {
    let innerContext = this.getExports(parameter.type, parentContext, indexParameterLists);
    return new Ctx.ParameterContext(parameter, innerContext, indexParameterLists);
  }

  getParameterListContext(parameters: Fmt.ParameterList, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): Ctx.Context {
    let context = parentContext;
    for (let param of parameters) {
      context = this.getParameterContext(param, context, indexParameterLists);
    }
    return context;
  }

  protected getExports(expression: Fmt.Expression, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): Ctx.Context {
    return parentContext;
  }
}

export class DummyMetaModel extends MetaModel {
  constructor(name: string) {
    let dummyFactory = new Fmt.GenericMetaDefinitionFactory;
    super(name, dummyFactory, dummyFactory, dummyFactory);
  }

  getRootContext(): Ctx.Context {
    return new Ctx.DummyContext(this);
  }
}

export type MetaModelGetter = (path?: Fmt.Path) => MetaModel;

export function getDummyMetaModel(path: Fmt.Path): MetaModel {
  return new DummyMetaModel(path.name);
}
