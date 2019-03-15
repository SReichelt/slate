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
  newParameterContext = new Map<Fmt.ParameterList, Ctx.Context>();
  newArgumentContext = new Map<Fmt.ArgumentList, Ctx.Context>();
  expressionEditInfo = new Map<Fmt.Expression, ExpressionEditInfo>();

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
    this.analyzeType(definition.type, typeContext);
    let contentsContext = context.metaModel.getDefinitionContentsContext(definition, context);
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
    let typeContext = context.metaModel.getParameterTypeContext(parameter, context);
    this.analyzeType(parameter.type, typeContext);
    if (parameter.defaultValue) {
      this.analyzeExpression(parameter.defaultValue, true, (newValue) => parameter.defaultValue = newValue, context);
    }
    if (parameter.dependencies) {
      this.analyzeExpressions(parameter.dependencies, true, context);
    }
  }

  analyzeArgumentList(args: Fmt.ArgumentList, onApply: (() => void) | undefined, context: Ctx.Context): void {
    let previousArgs: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
    for (let index = 0; index < args.length; index++) {
      let arg = args[index];
      let onRemove = () => args.splice(index, 1);
      this.analyzeArgument(arg, index, previousArgs, onApply, onRemove, context);
      context = context.metaModel.getNextArgumentContext(arg, index, context);
      previousArgs.push(arg);
    }
    if (!onApply) {
      this.newArgumentContext.set(args, context);
    }
  }

  analyzeArgument(arg: Fmt.Argument, argIndex: number, previousArgs: Fmt.ArgumentList, onApply: (() => void) | undefined, onRemove: () => void, context: Ctx.Context): void {
    let valueContext = context.metaModel.getArgumentValueContext(arg, argIndex, previousArgs, context);
    let onSetValue = (newValue: Fmt.Expression | undefined) => {
      if (newValue) {
        arg.value = newValue;
      } else {
        onRemove();
      }
      if (onApply) {
        onApply();
      }
    };
    this.analyzeExpression(arg.value, arg.optional || false, onSetValue, valueContext);
  }

  analyzeType(type: Fmt.Type, context: Ctx.Context): void {
    this.analyzeExpression(type.expression, false, (newValue) => type.expression = newValue!, context);
  }

  analyzeObjectContents(contents: Fmt.ObjectContents, context: Ctx.Context): void {
    if (contents instanceof Fmt.GenericObjectContents) {
      this.analyzeArgumentList(contents.arguments, undefined, context);
    } else {
      let args: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
      contents.toArgumentList(args);
      let onApply = () => contents.fromArgumentList(args);
      this.analyzeArgumentList(args, onApply, context);
    }
  }

  analyzeExpression(expression: Fmt.Expression, optional: boolean, onSetValue: SetExpressionFn, context: Ctx.Context): void {
    this.expressionEditInfo.set(expression, {
      expression: expression,
      optional: optional,
      onSetValue: onSetValue,
      context: context
    });
    context = new Ctx.ParentInfoContext(expression, context);
    if (expression instanceof Fmt.VariableRefExpression) {
      if (expression.indices) {
        this.analyzeExpressions(expression.indices, false, context);
      }
    } else if (expression instanceof Fmt.MetaRefExpression) {
      if (expression instanceof Fmt.GenericMetaRefExpression) {
        this.analyzeArgumentList(expression.arguments, undefined, context);
      } else {
        let args: Fmt.ArgumentList = Object.create(Fmt.ArgumentList.prototype);
        expression.toArgumentList(args);
        let onApply = () => expression.fromArgumentList(args);
        this.analyzeArgumentList(args, onApply, context);
      }
    } else if (expression instanceof Fmt.DefinitionRefExpression) {
      this.analyzePath(expression.path, context);
    } else if (expression instanceof Fmt.ParameterExpression) {
      this.analyzeParameterList(expression.parameters, context);
    } else if (expression instanceof Fmt.CompoundExpression) {
      this.analyzeArgumentList(expression.arguments, undefined, context);
    } else if (expression instanceof Fmt.ArrayExpression) {
      this.analyzeExpressions(expression.items, true, context);
    }
  }

  analyzeExpressions(expressions: Fmt.Expression[], canRemove: boolean, context: Ctx.Context): void {
    for (let index = 0; index < expressions.length; index++) {
      let onSetValue = (newValue: Fmt.Expression | undefined) => {
        if (newValue) {
          expressions[index] = newValue;
        } else {
          expressions.splice(index, 1);
        }
      };
      this.analyzeExpression(expressions[index], canRemove, onSetValue, context);
    }
  }
}
