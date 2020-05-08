import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Edit from '../../format/edit';
import * as FmtHLM from './meta';

export class HLMEditAnalysis extends Edit.EditAnalysis {
  analyzeObjectContents(contents: Fmt.ObjectContents, context: Ctx.Context): void {
    if (contents instanceof FmtHLM.ObjectContents_Construction || contents instanceof FmtHLM.ObjectContents_Constructor) {
      super.analyzeObjectContents(contents, context);
    } else if (contents instanceof FmtHLM.ObjectContents_Embedding) {
      this.analyzeParameter(contents.parameter, context);
      this.analyzeExpression(contents.target, false, (value) => (contents.target = value!), undefined, context);
    } else if (contents instanceof FmtHLM.ObjectContents_EqualityDefinition
               || contents instanceof FmtHLM.ObjectContents_SetOperator
               || contents instanceof FmtHLM.ObjectContents_ExplicitOperator
               || contents instanceof FmtHLM.ObjectContents_Predicate) {
      this.analyzeExpressions(contents.definition, 1, undefined, context);
    } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
      this.analyzeParameter(contents.parameter, context);
      let parameterContext = context.metaModel.getParameterContext(contents.parameter, context);
      this.analyzeExpressions(contents.definition, 1, undefined, parameterContext);
    } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      this.analyzeExpression(contents.claim, false, (value) => (contents.claim = value!), undefined, context);
    } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      this.analyzeExpressions(contents.conditions, 2, undefined, context);
    }
  }

  protected analyzeMetaRefExpression(expression: Fmt.MetaRefExpression, context: Ctx.Context): void {
    if (expression instanceof FmtHLM.MetaRefExpression_equals || expression instanceof FmtHLM.MetaRefExpression_setEquals) {
      this.analyzeExpressions(expression.terms, 2, undefined, context);
    } else if (expression instanceof FmtHLM.MetaRefExpression_and || expression instanceof FmtHLM.MetaRefExpression_or) {
      if (expression.formulae) {
        this.analyzeExpressions(expression.formulae, 2, undefined, context);
      }
    } else {
      super.analyzeMetaRefExpression(expression, context);
    }
  }
}
