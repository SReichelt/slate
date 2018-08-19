import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtDisplay from '../../display/meta';
import { LogicFormat } from '../format';

export class HLMFormat implements LogicFormat {
  contextProvider: HLMContextProvider = new HLMContextProvider(FmtHLM.metaDefinitions);
}

class HLMContextProvider extends Fmt.ContextProvider {
  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Fmt.Context): Fmt.Context {
    let definitionContext = new DefinitionContext(definition, parentContext);
    return this.createParameterListContext(definition.parameters, definitionContext);
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context, parent: Object): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextParameterContext(parameter: Fmt.Parameter, previousContext: Fmt.Context, parent: Object): Fmt.Context {
    return this.createParameterContext(parameter, previousContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, previousContext: Fmt.Context, parent: Object): Fmt.Context {
    if (parent instanceof FmtHLM.MetaRefExpression_Binding && previousContext instanceof ParameterTypeContext) {
      previousContext = new Fmt.ParameterContext(previousContext.parameter, previousContext);
    }
    if (argument.value instanceof Fmt.ParameterExpression && !(parent instanceof Fmt.DefinitionRefExpression)) {
      return this.createParameterListContext(argument.value.parameters, previousContext);
    }
    return previousContext;
  }

  getArgumentValueContext(argument: Fmt.Argument, parentContext: Fmt.Context, parent: Object): Fmt.Context {
    if (parent instanceof Fmt.Definition) {
      switch (argument.name) {
      case 'equalityDefinition':
        while (parentContext instanceof Fmt.DerivedContext && !(parentContext instanceof DefinitionContext)) {
          parentContext = parentContext.parentContext;
        }
        break;
      case 'display':
      case 'definitionDisplay':
        let context = new Fmt.DerivedContext(parentContext);
        context.metaDefinitions = FmtDisplay.metaDefinitions;
        return context;
      }
    }
    return parentContext;
  }

  private createParameterContext(parameter: Fmt.Parameter, parentContext: Fmt.Context, suffix?: string): Fmt.Context {
    if (suffix) {
      let newParameter: Fmt.Parameter = Object.create(parameter);
      newParameter.name += suffix;
      parameter = newParameter;
    }
    let context: Fmt.Context = new Fmt.ParameterContext(parameter, parentContext);
    let type = parameter.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Element && type.shortcut && type.shortcut.parameters) {
      context = this.createParameterListContext(type.shortcut.parameters, context, suffix);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      context = this.createParameterListContext(type.parameters, context, suffix);
    }
    return context;
  }

  private createParameterListContext(parameters: Fmt.ParameterList, parentContext: Fmt.Context, suffix?: string): Fmt.Context {
    let context = parentContext;
    for (let param of parameters) {
      context = this.createParameterContext(param, context, suffix);
    }
    return context;
  }
}

class DefinitionContext extends Fmt.DerivedContext {
  constructor(public definition: Fmt.Definition, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

class ParameterTypeContext extends Fmt.DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Fmt.Context) {
    super(parentContext);
  }
}
