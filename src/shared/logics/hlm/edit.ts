import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Edit from '../../format/edit';
import * as FmtHLM from './meta';

export class HLMEditAnalysis extends Edit.EditAnalysis {
  analyzeObjectContents(contents: Fmt.ObjectContents, context: Ctx.Context): void {
    if (contents instanceof FmtHLM.ObjectContents_Embedding) {
      this.analyzeParameter(contents.parameter, context);
      this.analyzeExpression(contents.target, false, (value) => (contents.target = value!), undefined, context);
      if (contents.wellDefinednessProof) {
        this.analyzeObjectContents(contents.wellDefinednessProof, context);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_ConstructionRewriteDefinition) {
      this.analyzeParameter(contents.parameter, context);
      this.analyzeExpression(contents.value, false, (value) => (contents.value = value!), undefined, context);
    } else if (contents instanceof FmtHLM.ObjectContents_ConstructorEqualityDefinition) {
      this.analyzeEquivalenceList(contents.definition, 1, contents.equivalenceProofs, context);
      if (contents.reflexivityProof) {
        this.analyzeObjectContents(contents.reflexivityProof, context);
      }
      if (contents.symmetryProof) {
        this.analyzeObjectContents(contents.symmetryProof, context);
      }
      if (contents.transitivityProof) {
        this.analyzeObjectContents(contents.transitivityProof, context);
      }
    } else if (contents instanceof FmtHLM.ObjectContents_ConstructorRewriteDefinition) {
      this.analyzeExpression(contents.value, false, (value) => (contents.value = value!), undefined, context);
    } else if (contents instanceof FmtHLM.ObjectContents_SetOperator
               || contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
      this.analyzeEquivalenceList(contents.definition, 1, contents.equalityProofs, context);
    } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
      this.analyzeEquivalenceList(contents.definition, 1, contents.equivalenceProofs, context);
    } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
      this.analyzeParameter(contents.parameter, context);
      let parameterContext = context.metaModel.getParameterContext(contents.parameter, context);
      this.analyzeEquivalenceList(contents.definition, 1, contents.equivalenceProofs, parameterContext);
    } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
      this.analyzeExpression(contents.claim, false, (value) => (contents.claim = value!), undefined, context);
      if (contents.proofs) {
        for (let proof of contents.proofs) {
          this.analyzeObjectContents(proof, context);
        }
      }
    } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
      this.analyzeEquivalenceList(contents.conditions, 2, contents.equivalenceProofs, context);
    } else {
      super.analyzeObjectContents(contents, context);
    }
  }

  private analyzeEquivalenceList(expressions: Fmt.Expression[], minLength: number, equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined, context: Ctx.Context): void {
    this.analyzeExpressions(expressions, minLength, undefined, context);
    if (equivalenceProofs) {
      for (let proof of equivalenceProofs) {
        this.analyzeObjectContents(proof, context);
      }
    }
  }

  protected analyzeMetaRefExpression(expression: Fmt.MetaRefExpression, context: Ctx.Context): void {
    if (expression instanceof FmtHLM.MetaRefExpression_equals || expression instanceof FmtHLM.MetaRefExpression_setEquals) {
      this.analyzeExpressions(expression.terms, 2, undefined, context);
    } else if (expression instanceof FmtHLM.MetaRefExpression_and || expression instanceof FmtHLM.MetaRefExpression_or) {
      if (expression.formulas) {
        this.analyzeExpressions(expression.formulas, 2, undefined, context);
      }
    } else {
      super.analyzeMetaRefExpression(expression, context);
    }
  }
}
