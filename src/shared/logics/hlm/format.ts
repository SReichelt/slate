import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as FmtDisplay from '../../display/meta';
import { LogicFormat } from '../format';

export class HLMFormat implements LogicFormat {
  getMetaModel(): Fmt.MetaModel { return new HLMMetaModel; }
}

// TODO remove after it is fully generated
class HLMMetaModel extends FmtHLM.MetaModel {
  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Fmt.Context): Fmt.Context {
    let definitionContext = new DefinitionContext(definition, parentContext);
    return super.getDefinitionContentsContext(definition, definitionContext);
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Fmt.Context): Fmt.Context {
    let parent = parentContext.parentObject;
    if (parent instanceof FmtHLM.MetaRefExpression_Binding) {
      for (let context = parentContext; context instanceof Fmt.DerivedContext; context = context.parentContext) {
        if (context instanceof ParameterTypeContext) {
          parentContext = new Fmt.ParameterContext(context.parameter, parentContext);
        }
      }
    } else if (parent instanceof Fmt.Definition) {
      switch (argument.name) {
      case 'equalityDefinition':
        while (parentContext instanceof Fmt.DerivedContext && !(parentContext instanceof DefinitionContext)) {
          parentContext = parentContext.parentContext;
        }
        break;
      case 'display':
      case 'definitionDisplay':
        let context = new Fmt.DerivedContext(parentContext);
        context.metaModel = FmtDisplay.metaModel;
        return context;
      }
    }
    return parentContext;
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
