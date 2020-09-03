import * as Fmt from './format';
import * as Ctx from './context';

export type SetExpressionFn = (newValue: Fmt.Expression | undefined) => void;

export interface ExpressionEditInfo {
  expression?: Fmt.Expression;
  optional: boolean;
  onSetValue: SetExpressionFn;
  context: Ctx.Context;
}

export class EditAnalysis {
  definitionContentsContext = new Map<Fmt.Definition, Ctx.Context>();
  newParameterContext = new Map<Fmt.ParameterList, Ctx.Context>();
  newArgumentContext = new Map<Fmt.ArgumentList, Ctx.Context>();
  expressionEditInfo = new Map<Fmt.Expression, ExpressionEditInfo>();
  usedParameterNames = new Set<string>();

  clear() {
    this.definitionContentsContext.clear();
    this.newParameterContext.clear();
    this.newArgumentContext.clear();
    this.expressionEditInfo.clear();
    this.usedParameterNames.clear();
  }

  analyzeFile(file: Fmt.File, context: Ctx.Context): void {
    this.analyzeDefinitions(file.definitions, context);
  }

  analyzePath(path: Fmt.Path, context: Ctx.Context): void {
    this.analyzeArgumentList(path.arguments, undefined, context);
    if (path.parentPath instanceof Fmt.Path) {
      this.analyzePath(path.parentPath, context);
    }
  }

  analyzeDefinitions(definitions: Fmt.Definition[], context: Ctx.Context): void {
    for (let definition of definitions) {
      this.analyzeDefinition(definition, context);
    }
  }

  analyzeDefinition(definition: Fmt.Definition, context: Ctx.Context): void {
    context = new Ctx.ParentInfoContext(definition, context);
    this.analyzeParameterList(definition.parameters, context);
    let typeContext = context.metaModel.getDefinitionTypeContext(definition, context);
    this.analyzeExpression(definition.type, false, (newValue) => (definition.type = newValue!), undefined, typeContext);
    let contentsContext = context.metaModel.getDefinitionContentsContext(definition, context);
    this.definitionContentsContext.set(definition, contentsContext);
    this.analyzeDefinitions(definition.innerDefinitions, contentsContext);
    if (definition.contents) {
      this.analyzeObjectContents(definition.contents, contentsContext);
    }
  }

  analyzeParameterList(parameters: Fmt.ParameterList, context: Ctx.Context): void {
    for (let parameter of parameters) {
      this.analyzeParameter(parameter, context);
      context = context.metaModel.getNextParameterContext(parameter, context);
    }
    this.newParameterContext.set(parameters, context);
  }

  analyzeParameter(parameter: Fmt.Parameter, context: Ctx.Context): void {
    if (parameter.name !== '_') {
      this.usedParameterNames.add(parameter.name);
    }
    let typeContext = context.metaModel.getParameterTypeContext(parameter, context);
    this.analyzeExpression(parameter.type, false, (newValue) => (parameter.type = newValue!), undefined, typeContext);
    if (parameter.defaultValue) {
      this.analyzeExpression(parameter.defaultValue, true, (newValue) => (parameter.defaultValue = newValue), undefined, context);
    }
    if (parameter.dependencies) {
      this.analyzeExpressions(parameter.dependencies, 0, undefined, context);
    }
  }

  analyzeArgumentList(args: Fmt.ArgumentList, onApplyConvertedArgument: (() => void) | undefined, context: Ctx.Context): void {
    let previousArgs = new Fmt.ArgumentList;
    for (let index = 0; index < args.length; index++) {
      let arg = args[index];
      let onRemove = () => args.splice(index, 1);
      this.analyzeArgument(arg, index, previousArgs, onApplyConvertedArgument, onRemove, context);
      context = context.metaModel.getNextArgumentContext(arg, index, context);
      previousArgs.push(arg);
    }
    if (!onApplyConvertedArgument) {
      this.newArgumentContext.set(args, context);
    }
  }

  analyzeArgument(arg: Fmt.Argument, argIndex: number, previousArgs: Fmt.ArgumentList, onApplyConvertedArgument: (() => void) | undefined, onRemove: () => void, context: Ctx.Context): void {
    let valueContext = context.metaModel.getArgumentValueContext(arg, argIndex, previousArgs, context);
    let onSetValue = (newValue: Fmt.Expression | undefined) => {
      if (newValue) {
        arg.value = newValue;
      } else {
        onRemove();
      }
      onApplyConvertedArgument?.();
    };
    this.analyzeExpression(arg.value, arg.optional, onSetValue, onApplyConvertedArgument, valueContext);
  }

  analyzeObjectContents(contents: Fmt.ObjectContents, context: Ctx.Context): void {
    if (contents instanceof Fmt.GenericObjectContents) {
      this.analyzeArgumentList(contents.arguments, undefined, context);
    } else {
      let args = contents.toArgumentList(true);
      let onApply = () => contents.fromArgumentList(args);
      this.analyzeArgumentList(args, onApply, context);
    }
  }

  analyzeExpression(expression: Fmt.Expression, optional: boolean, onSetValue: SetExpressionFn, onApplyConvertedArgument: (() => void) | undefined, context: Ctx.Context): void {
    this.expressionEditInfo.set(expression, {
      expression: expression,
      optional: optional,
      onSetValue: onSetValue,
      context: context
    });
    context = new Ctx.ParentInfoContext(expression, context);
    if (expression instanceof Fmt.MetaRefExpression) {
      this.analyzeMetaRefExpression(expression, context);
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      this.analyzePath(expression.path, context);
    } else if (expression instanceof Fmt.ParameterExpression) {
      this.analyzeParameterList(expression.parameters, context);
    } else if (expression instanceof Fmt.CompoundExpression) {
      this.analyzeArgumentList(expression.arguments, onApplyConvertedArgument, context);
    } else if (expression instanceof Fmt.ArrayExpression) {
      this.analyzeExpressions(expression.items, 0, onApplyConvertedArgument, context);
    } else if (expression instanceof Fmt.IndexedExpression) {
      this.analyzeExpression(expression.body, false, (newValue) => (expression.body = newValue!), undefined, context);
      if (expression.arguments) {
        this.analyzeArgumentList(expression.arguments, undefined, context);
      }
    }
  }

  protected analyzeMetaRefExpression(expression: Fmt.MetaRefExpression, context: Ctx.Context): void {
    if (expression instanceof Fmt.GenericMetaRefExpression) {
      this.analyzeArgumentList(expression.arguments, undefined, context);
    } else {
      let args = expression.toArgumentList();
      let onApply = () => expression.fromArgumentList(args);
      this.analyzeArgumentList(args, onApply, context);
    }
  }

  analyzeExpressions(expressions: Fmt.Expression[], minLength: number, onApplyConvertedArgument: (() => void) | undefined, context: Ctx.Context): void {
    let canRemove = expressions.length > minLength;
    for (let index = 0; index < expressions.length; index++) {
      let onSetValue = (newValue: Fmt.Expression | undefined) => {
        if (newValue) {
          expressions[index] = newValue;
        } else {
          expressions.splice(index, 1);
        }
        onApplyConvertedArgument?.();
      };
      this.analyzeExpression(expressions[index], canRemove, onSetValue, onApplyConvertedArgument, context);
    }
  }
}
