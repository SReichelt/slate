import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtDisplay from '../../display/meta';
import { LogicFormat } from '../format';

export class HLMFormat implements LogicFormat {
  metaModel: HLMMetaModel = new HLMMetaModel;
}

class HLMMetaModel extends Fmt.MetaModel {
  constructor() {
    super(FmtHLM.metaDefinitions);
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Fmt.Context): Fmt.Context {
    let definitionContext = new DefinitionContext(definition, parentContext);
    return super.getDefinitionContentsContext(definition, definitionContext);
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context, parent: Object): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, previousContext: Fmt.Context, parent: Object): Fmt.Context {
    if (parent instanceof FmtHLM.MetaRefExpression_Binding && previousContext instanceof ParameterTypeContext) {
      previousContext = new Fmt.ParameterContext(previousContext.parameter, previousContext);
    }
    if (argument.value instanceof Fmt.ParameterExpression && !(parent instanceof Fmt.DefinitionRefExpression)) {
      return this.getParameterListContext(argument.value.parameters, previousContext);
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

  protected getExports(expression: Fmt.Expression, parentContext: Fmt.Context): Fmt.Context {
    if (expression instanceof FmtHLM.MetaRefExpression_Element && expression.shortcut && expression.shortcut.parameters) {
      return this.getParameterListContext(expression.shortcut.parameters, parentContext);
    } else if (expression instanceof FmtHLM.MetaRefExpression_Binding) {
      return this.getParameterListContext(expression.parameters, parentContext);
    } else {
      return parentContext;
    }
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
