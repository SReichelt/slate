import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import CachedPromise from '../../data/cachedPromise';

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition): CachedPromise<Logic.LogicCheckResult> {
    let definitionChecker = new HLMDefinitionChecker(definition);
    return definitionChecker.checkDefinition();
  }
}

export class HLMDefinitionChecker {
  private result: Logic.LogicCheckResult = {diagnostics: []};
  private promise = CachedPromise.resolve();

  constructor(private definition: Fmt.Definition) {}

  checkDefinition(): CachedPromise<Logic.LogicCheckResult> {
    let contents = this.definition.contents;
    if (contents instanceof FmtHLM.ObjectContents_MacroOperator) {
      this.checkMacroOperator(contents);
    } else {
      this.checkParameterList(this.definition.parameters);
      if (contents instanceof FmtHLM.ObjectContents_Construction) {
        this.checkConstruction(contents);
      } else {
        for (let innerDefinition of this.definition.innerDefinitions) {
          this.error(innerDefinition, 'This type of object does not support inner definitions.');
        }
        if (contents instanceof FmtHLM.ObjectContents_SetOperator) {
          this.checkSetOperator(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_ExplicitOperator) {
          this.checkExplicitOperator(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_ImplicitOperator) {
          this.checkImplicitOperator(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_Predicate) {
          this.checkPredicate(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_StandardTheorem) {
          this.checkStandardTheorem(contents);
        } else if (contents instanceof FmtHLM.ObjectContents_EquivalenceTheorem) {
          this.checkEquivalenceTheorem(contents);
        } else {
          this.error(this.definition.type, 'Invalid object type');
        }
      }
    }
    return this.promise.then(() => this.result);
  }

  private checkConstruction(contents: FmtHLM.ObjectContents_Construction): void {
    for (let innerDefinition of this.definition.innerDefinitions) {
      this.checkParameterList(innerDefinition.parameters);
      let innerContents = innerDefinition.contents;
      if (innerContents instanceof FmtHLM.ObjectContents_Constructor) {
        this.checkConstructor(innerDefinition, innerContents);
      } else {
        this.error(innerDefinition, 'Invalid object type');
      }
    }
    if (contents.embedding) {
    }
  }

  private checkConstructor(innerDefinition: Fmt.Definition, innerContents: FmtHLM.ObjectContents_Constructor): void {
    if (innerContents.equalityDefinition) {
      this.checkEqualityDefinition(innerDefinition, innerContents.equalityDefinition);
    } else if (innerDefinition.parameters.length) {
      this.error(innerDefinition, 'Constructor with parameters requires equality definition');
    }
    if (innerContents.rewrite) {
      this.checkRewriteDefinition(innerContents.rewrite);
    }
  }

  private checkEqualityDefinition(innerDefinition: Fmt.Definition, equalityDefinition: FmtHLM.ObjectContents_EqualityDefinition): void {
    let leftParameters = equalityDefinition.leftParameters;
    if (!leftParameters.isEquivalentTo(innerDefinition.parameters)) {
      this.error(leftParameters, 'Parameters of equality definition must match constructor parameters');
    }
    let rightParameters = equalityDefinition.rightParameters;
    let unificationFn = undefined;
    if (leftParameters.length && rightParameters.length) {
      let leftFirstType = leftParameters[0].type.expression;
      let rightFirstType = rightParameters[0].type.expression;
      if (leftFirstType instanceof FmtHLM.MetaRefExpression_Subset && rightFirstType instanceof FmtHLM.MetaRefExpression_Subset && rightFirstType.superset instanceof FmtHLM.MetaRefExpression_previous) {
        unificationFn = (actual: Fmt.Expression, expected: Fmt.Expression) => expected === leftFirstType && actual === rightFirstType;
        for (let leftParam of leftParameters.slice(1)) {
          let leftParamType = leftParam.type.expression;
          if (!(leftParamType instanceof FmtHLM.MetaRefExpression_Subset && leftParamType.superset instanceof FmtHLM.MetaRefExpression_previous)) {
            unificationFn = undefined;
            break;
          }
        }
      }
      if (leftFirstType instanceof FmtHLM.MetaRefExpression_Element && rightFirstType instanceof FmtHLM.MetaRefExpression_Element && rightFirstType._set instanceof FmtHLM.MetaRefExpression_previous) {
        unificationFn = (actual: Fmt.Expression, expected: Fmt.Expression) => expected === leftFirstType && actual === rightFirstType;
        for (let leftParam of leftParameters.slice(1)) {
          let leftParamType = leftParam.type.expression;
          if (!(leftParamType instanceof FmtHLM.MetaRefExpression_Element && leftParamType._set instanceof FmtHLM.MetaRefExpression_previous)) {
            unificationFn = undefined;
            break;
          }
        }
      }
    }
    if (!rightParameters.isEquivalentTo(leftParameters, unificationFn)) {
      this.error(rightParameters, 'Parameters of equality definition must match constructor parameters');
    }
    this.checkEquivalentFormulas(equalityDefinition.definition, equalityDefinition.equivalenceProofs);
    this.checkProof(equalityDefinition.reflexivityProof);
  }

  private checkRewriteDefinition(rewrite: FmtHLM.ObjectContents_RewriteDefinition): void {
    this.checkElementTerm(rewrite.value);
    // TODO check whether rewrite definition matches referenced theorem
  }

  private checkSetOperator(contents: FmtHLM.ObjectContents_SetOperator): void {
    this.checkEquivalentSetTerms(contents.definition, contents.equalityProofs);
  }

  private checkExplicitOperator(contents: FmtHLM.ObjectContents_ExplicitOperator): void {
    this.checkEquivalentElementTerms(contents.definition, contents.equalityProofs);
  }

  private checkImplicitOperator(contents: FmtHLM.ObjectContents_ImplicitOperator): void {
    this.checkParameter(contents.parameter);
    this.checkEquivalentFormulas(contents.definition, contents.equivalenceProofs);
    this.checkProof(contents.wellDefinednessProof);
  }

  private checkPredicate(contents: FmtHLM.ObjectContents_Predicate): void {
    this.checkEquivalentFormulas(contents.definition, contents.equivalenceProofs);
  }

  private checkStandardTheorem(contents: FmtHLM.ObjectContents_StandardTheorem): void {
    this.checkFormula(contents.claim);
    this.checkProofs(contents.proofs);
  }

  private checkEquivalenceTheorem(contents: FmtHLM.ObjectContents_EquivalenceTheorem): void {
    this.checkEquivalentFormulas(contents.conditions, contents.equivalenceProofs);
  }

  private checkMacroOperator(contents: FmtHLM.ObjectContents_MacroOperator): void {
    // TODO
  }

  private checkParameterList(parameterList: Fmt.ParameterList): void {
    for (let param of parameterList) {
      this.checkParameter(param);
    }
  }

  private checkParameter(param: Fmt.Parameter): void {
    if (param.optional) {
      this.error(param, 'HLM parameters cannot be declared optional');
    }
    if (param.list) {
      this.error(param, 'List parameters are not supported in HLM');
    }
    if (param.defaultValue) {
      this.error(param, 'Parameter default values are not supported in HLM');
    }
    if (param.dependencies) {
      this.error(param, 'Parameters with dependencies are not supported in HLM');
    }
    if (param.type.arrayDimensions) {
      this.error(param, 'Array parameters are not supported in HLM');
    }
    this.checkParameterType(param.type.expression);
  }

  private checkParameterType(type: Fmt.Expression): void {
    if (type instanceof FmtHLM.MetaRefExpression_Prop) {
      this.checkBoolConstant(type.auto);
    } else if (type instanceof FmtHLM.MetaRefExpression_Set) {
      this.checkBoolConstant(type.auto);
      this.checkBoolConstant(type.embedSubsets);
    } else if (type instanceof FmtHLM.MetaRefExpression_Subset) {
      this.checkSetTerm(type.superset);
      this.checkBoolConstant(type.auto);
      this.checkBoolConstant(type.embedSubsets);
    } else if (type instanceof FmtHLM.MetaRefExpression_Element) {
      this.checkSetTerm(type._set);
      this.checkBoolConstant(type.auto);
    } else if (type instanceof FmtHLM.MetaRefExpression_Constraint) {
      this.checkFormula(type.formula);
    } else if (type instanceof FmtHLM.MetaRefExpression_SetDef) {
      this.checkSetTerm(type._set);
    } else if (type instanceof FmtHLM.MetaRefExpression_Def) {
      this.checkElementTerm(type.element);
    } else if (type instanceof FmtHLM.MetaRefExpression_Binding) {
      this.checkSetTerm(type._set);
      this.checkParameterList(type.parameters);
    } else {
      this.error(type, 'Invalid parameter type');
    }
  }

  private checkSetTerm(term: Fmt.Expression): void {
    // TODO
  }

  private checkElementTerm(term: Fmt.Expression): void {
    // TODO
  }

  private checkFormula(formula: Fmt.Expression): void {
    // TODO
  }

  private checkEquivalentSetTerms(expression: Fmt.Expression, equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined): void {
    if (expression instanceof Fmt.ArrayExpression) {
      for (let term of expression.items) {
        this.checkSetTerm(term);
      }
      this.checkProofs(equivalenceProofs);
    } else {
      this.error(expression, 'Array expression expected');
    }
  }

  private checkEquivalentElementTerms(expression: Fmt.Expression, equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined): void {
    if (expression instanceof Fmt.ArrayExpression) {
      for (let term of expression.items) {
        this.checkElementTerm(term);
      }
      this.checkProofs(equivalenceProofs);
    } else {
      this.error(expression, 'Array expression expected');
    }
  }

  private checkEquivalentFormulas(expression: Fmt.Expression, equivalenceProofs: FmtHLM.ObjectContents_Proof[] | undefined): void {
    if (expression instanceof Fmt.ArrayExpression) {
      for (let formula of expression.items) {
        this.checkFormula(formula);
      }
      this.checkProofs(equivalenceProofs);
    } else {
      this.error(expression, 'Array expression expected');
    }
  }

  private checkProof(proof: FmtHLM.ObjectContents_Proof | undefined): void {
    // TODO
  }

  private checkProofs(proofs: FmtHLM.ObjectContents_Proof[] | undefined): void {
    // TODO
  }

  private checkBoolConstant(expression: Fmt.Expression | undefined): void {
    if (expression === undefined || expression instanceof FmtHLM.MetaRefExpression_false || expression instanceof FmtHLM.MetaRefExpression_true) {
    } else {
      this.error(expression, 'Boolean value expected');
    }
  }

  private error(object: Object, message: string): void {
    this.result.diagnostics.push({
      object: object,
      message: message,
      severity: Logic.DiagnosticSeverity.Error
    });
  }
}
