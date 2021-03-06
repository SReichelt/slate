// Generated from data/logics/hlm.slate by generateMetaDeclarations.ts.

import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Meta from '../../format/metaModel';

/* eslint-disable no-shadow */
import * as FmtNotation from '../../notation/meta';

export class ObjectContents_Definition extends Fmt.ObjectContents {
  constructor(public properties?: Fmt.ArgumentList, public notation?: Fmt.Expression, public abbreviations?: Fmt.Expression[], public definitionNotation?: Fmt.Expression) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Definition {
    const result: ObjectContents_Definition = Object.create(ObjectContents_Definition.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const propertiesRaw = argumentList.getOptionalValue('properties', 0);
    if (propertiesRaw !== undefined) {
      if (propertiesRaw instanceof Fmt.CompoundExpression) {
        this.properties = propertiesRaw.arguments;
      } else {
        throw new Error('properties: Compound expression expected');
      }
    }
    this.notation = argumentList.getOptionalValue('notation', 1);
    const abbreviationsRaw = argumentList.getOptionalValue('abbreviations', 2);
    if (abbreviationsRaw !== undefined) {
      if (abbreviationsRaw instanceof Fmt.ArrayExpression) {
        this.abbreviations = abbreviationsRaw.items;
      } else {
        throw new Error('abbreviations: Array expression expected');
      }
    }
    this.definitionNotation = argumentList.getOptionalValue('definitionNotation', 3);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.properties !== undefined) {
      const propertiesExpr = new Fmt.CompoundExpression(this.properties);
      argumentList.push(new Fmt.Argument('properties', propertiesExpr, true));
    }
    if (this.notation !== undefined) {
      argumentList.push(new Fmt.Argument('notation', this.notation, true));
    }
    if (this.abbreviations !== undefined) {
      const abbreviationsExprItems: Fmt.Expression[] = [];
      for (const item of this.abbreviations) {
        abbreviationsExprItems.push(item);
      }
      const abbreviationsExpr = new Fmt.ArrayExpression(abbreviationsExprItems);
      argumentList.push(new Fmt.Argument('abbreviations', abbreviationsExpr, true));
    }
    if (this.definitionNotation !== undefined) {
      argumentList.push(new Fmt.Argument('definitionNotation', this.definitionNotation, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Definition {
    const result: ObjectContents_Definition = Object.create(ObjectContents_Definition.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Definition {
    const result: ObjectContents_Definition = Object.create(ObjectContents_Definition.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.properties) {
      this.properties.traverse(fn);
    }
    if (this.notation) {
      this.notation.traverse(fn);
    }
    if (this.abbreviations) {
      for (const item of this.abbreviations) {
        item.traverse(fn);
      }
    }
    if (this.definitionNotation) {
      this.definitionNotation.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Definition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.properties) {
      result.properties = this.properties.substitute(fn, replacedParameters);
      if (result.properties !== this.properties) {
        changed = true;
      }
    }
    if (this.notation) {
      result.notation = this.notation.substitute(fn, replacedParameters);
      if (result.notation !== this.notation) {
        changed = true;
      }
    }
    if (this.abbreviations) {
      result.abbreviations = [];
      for (const item of this.abbreviations) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.abbreviations.push(newItem);
      }
    }
    if (this.definitionNotation) {
      result.definitionNotation = this.definitionNotation.substitute(fn, replacedParameters);
      if (result.definitionNotation !== this.definitionNotation) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Definition, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.properties, objectContents.properties, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.notation, objectContents.notation, fn, replacedParameters)) {
      return false;
    }
    if (this.abbreviations || objectContents.abbreviations) {
      if (!this.abbreviations || !objectContents.abbreviations || this.abbreviations.length !== objectContents.abbreviations.length) {
        return false;
      }
      for (let i = 0; i < this.abbreviations.length; i++) {
        const leftItem = this.abbreviations[i];
        const rightItem = objectContents.abbreviations[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (!Fmt.areObjectsEquivalent(this.definitionNotation, objectContents.definitionNotation, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_Construction extends ObjectContents_Definition {
  constructor(properties?: Fmt.ArgumentList, notation?: Fmt.Expression, abbreviations?: Fmt.Expression[], definitionNotation?: Fmt.Expression, public embedding?: ObjectContents_Embedding, public rewrite?: ObjectContents_ConstructionRewriteDefinition) {
    super(properties, notation, abbreviations, definitionNotation);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Construction {
    const result: ObjectContents_Construction = Object.create(ObjectContents_Construction.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const embeddingRaw = argumentList.getOptionalValue('embedding', 4);
    if (embeddingRaw !== undefined) {
      const newItem = ObjectContents_Embedding.createFromExpression(embeddingRaw, reportFn);
      this.embedding = newItem;
      reportFn?.(embeddingRaw, newItem);
    }
    const rewriteRaw = argumentList.getOptionalValue('rewrite', 5);
    if (rewriteRaw !== undefined) {
      const newItem = ObjectContents_ConstructionRewriteDefinition.createFromExpression(rewriteRaw, reportFn);
      this.rewrite = newItem;
      reportFn?.(rewriteRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    if (this.embedding !== undefined) {
      const embeddingExpr = this.embedding.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('embedding', embeddingExpr, true));
      reportFn?.(embeddingExpr, this.embedding);
    }
    if (this.rewrite !== undefined) {
      const rewriteExpr = this.rewrite.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('rewrite', rewriteExpr, true));
      reportFn?.(rewriteExpr, this.rewrite);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Construction {
    const result: ObjectContents_Construction = Object.create(ObjectContents_Construction.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Construction {
    const result: ObjectContents_Construction = Object.create(ObjectContents_Construction.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.embedding) {
      this.embedding.traverse(fn);
    }
    if (this.rewrite) {
      this.rewrite.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Construction, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.embedding) {
      result.embedding = Object.create(ObjectContents_Embedding.prototype) as ObjectContents_Embedding;
      if (this.embedding.substitute(fn, result.embedding, replacedParameters)) {
        changed = true;
      }
    }
    if (this.rewrite) {
      result.rewrite = Object.create(ObjectContents_ConstructionRewriteDefinition.prototype) as ObjectContents_ConstructionRewriteDefinition;
      if (this.rewrite.substitute(fn, result.rewrite, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Construction, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.embedding, objectContents.embedding, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.rewrite, objectContents.rewrite, fn, replacedParameters)) {
      return false;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_Construction extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Construction';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Construction;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Construction)) {
      return false;
    }
    return true;
  }

  getMetaInnerDefinitionTypes(): Fmt.MetaDefinitionFactory | undefined {
    const innerDefinitionTypes: Fmt.MetaDefinitionList = {'Constructor': MetaRefExpression_Constructor};
    return new Fmt.StandardMetaDefinitionFactory(innerDefinitionTypes);
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_Construction.prototype);
  }
}

export class ObjectContents_Embedding extends Fmt.ObjectContents {
  constructor(public parameter: Fmt.Parameter, public target: Fmt.Expression, public full?: Fmt.Expression, public wellDefinednessProof?: ObjectContents_Proof) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Embedding {
    const result: ObjectContents_Embedding = Object.create(ObjectContents_Embedding.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.target = argumentList.getValue('target', 1);
    this.full = argumentList.getOptionalValue('full', 2);
    const wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 3);
    if (wellDefinednessProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(wellDefinednessProofRaw, reportFn);
      this.wellDefinednessProof = newItem;
      reportFn?.(wellDefinednessProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parameterExpr = new Fmt.ParameterExpression(new Fmt.ParameterList(this.parameter));
    argumentList.push(new Fmt.Argument(outputAllNames ? 'parameter' : undefined, parameterExpr, false));
    argumentList.push(new Fmt.Argument(outputAllNames ? 'target' : undefined, this.target, false));
    if (this.full !== undefined) {
      argumentList.push(new Fmt.Argument('full', this.full, true));
    }
    if (this.wellDefinednessProof !== undefined) {
      const wellDefinednessProofExpr = this.wellDefinednessProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('wellDefinednessProof', wellDefinednessProofExpr, true));
      reportFn?.(wellDefinednessProofExpr, this.wellDefinednessProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Embedding {
    const result: ObjectContents_Embedding = Object.create(ObjectContents_Embedding.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Embedding {
    const result: ObjectContents_Embedding = Object.create(ObjectContents_Embedding.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.parameter) {
      this.parameter.traverse(fn);
    }
    if (this.target) {
      this.target.traverse(fn);
    }
    if (this.full) {
      this.full.traverse(fn);
    }
    if (this.wellDefinednessProof) {
      this.wellDefinednessProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Embedding, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.parameter) {
      result.parameter = this.parameter.substitute(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.target) {
      result.target = this.target.substitute(fn, replacedParameters);
      if (result.target !== this.target) {
        changed = true;
      }
    }
    if (this.full) {
      result.full = this.full.substitute(fn, replacedParameters);
      if (result.full !== this.full) {
        changed = true;
      }
    }
    if (this.wellDefinednessProof) {
      result.wellDefinednessProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.wellDefinednessProof.substitute(fn, result.wellDefinednessProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Embedding, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.parameter, objectContents.parameter, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.target, objectContents.target, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.full, objectContents.full, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.wellDefinednessProof, objectContents.wellDefinednessProof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_ConstructionRewriteDefinition extends Fmt.ObjectContents {
  constructor(public parameter: Fmt.Parameter, public value: Fmt.Expression, public theorem?: Fmt.Expression) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstructionRewriteDefinition {
    const result: ObjectContents_ConstructionRewriteDefinition = Object.create(ObjectContents_ConstructionRewriteDefinition.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.value = argumentList.getValue('value', 1);
    this.theorem = argumentList.getOptionalValue('theorem', 2);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parameterExpr = new Fmt.ParameterExpression(new Fmt.ParameterList(this.parameter));
    argumentList.push(new Fmt.Argument(outputAllNames ? 'parameter' : undefined, parameterExpr, false));
    argumentList.push(new Fmt.Argument(outputAllNames ? 'value' : undefined, this.value, false));
    if (this.theorem !== undefined) {
      argumentList.push(new Fmt.Argument('theorem', this.theorem, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstructionRewriteDefinition {
    const result: ObjectContents_ConstructionRewriteDefinition = Object.create(ObjectContents_ConstructionRewriteDefinition.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ConstructionRewriteDefinition {
    const result: ObjectContents_ConstructionRewriteDefinition = Object.create(ObjectContents_ConstructionRewriteDefinition.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.parameter) {
      this.parameter.traverse(fn);
    }
    if (this.value) {
      this.value.traverse(fn);
    }
    if (this.theorem) {
      this.theorem.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ConstructionRewriteDefinition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.parameter) {
      result.parameter = this.parameter.substitute(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.value) {
      result.value = this.value.substitute(fn, replacedParameters);
      if (result.value !== this.value) {
        changed = true;
      }
    }
    if (this.theorem) {
      result.theorem = this.theorem.substitute(fn, replacedParameters);
      if (result.theorem !== this.theorem) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ConstructionRewriteDefinition, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.parameter, objectContents.parameter, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.value, objectContents.value, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.theorem, objectContents.theorem, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_Constructor extends ObjectContents_Definition {
  constructor(properties?: Fmt.ArgumentList, notation?: Fmt.Expression, abbreviations?: Fmt.Expression[], definitionNotation?: Fmt.Expression, public equalityDefinition?: ObjectContents_ConstructorEqualityDefinition, public rewrite?: ObjectContents_ConstructorRewriteDefinition) {
    super(properties, notation, abbreviations, definitionNotation);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Constructor {
    const result: ObjectContents_Constructor = Object.create(ObjectContents_Constructor.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const equalityDefinitionRaw = argumentList.getOptionalValue('equalityDefinition', 4);
    if (equalityDefinitionRaw !== undefined) {
      const newItem = ObjectContents_ConstructorEqualityDefinition.createFromExpression(equalityDefinitionRaw, reportFn);
      this.equalityDefinition = newItem;
      reportFn?.(equalityDefinitionRaw, newItem);
    }
    const rewriteRaw = argumentList.getOptionalValue('rewrite', 5);
    if (rewriteRaw !== undefined) {
      const newItem = ObjectContents_ConstructorRewriteDefinition.createFromExpression(rewriteRaw, reportFn);
      this.rewrite = newItem;
      reportFn?.(rewriteRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    if (this.equalityDefinition !== undefined) {
      const equalityDefinitionExpr = this.equalityDefinition.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('equalityDefinition', equalityDefinitionExpr, true));
      reportFn?.(equalityDefinitionExpr, this.equalityDefinition);
    }
    if (this.rewrite !== undefined) {
      const rewriteExpr = this.rewrite.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('rewrite', rewriteExpr, true));
      reportFn?.(rewriteExpr, this.rewrite);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Constructor {
    const result: ObjectContents_Constructor = Object.create(ObjectContents_Constructor.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Constructor {
    const result: ObjectContents_Constructor = Object.create(ObjectContents_Constructor.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.equalityDefinition) {
      this.equalityDefinition.traverse(fn);
    }
    if (this.rewrite) {
      this.rewrite.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Constructor, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.equalityDefinition) {
      result.equalityDefinition = Object.create(ObjectContents_ConstructorEqualityDefinition.prototype) as ObjectContents_ConstructorEqualityDefinition;
      if (this.equalityDefinition.substitute(fn, result.equalityDefinition, replacedParameters)) {
        changed = true;
      }
    }
    if (this.rewrite) {
      result.rewrite = Object.create(ObjectContents_ConstructorRewriteDefinition.prototype) as ObjectContents_ConstructorRewriteDefinition;
      if (this.rewrite.substitute(fn, result.rewrite, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Constructor, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.equalityDefinition, objectContents.equalityDefinition, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.rewrite, objectContents.rewrite, fn, replacedParameters)) {
      return false;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_Constructor extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Constructor';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Constructor;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Constructor)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_Constructor.prototype);
  }
}

export class ObjectContents_ConstructorEqualityDefinition extends Fmt.ObjectContents {
  constructor(public leftParameters: Fmt.ParameterList, public rightParameters: Fmt.ParameterList, public definition: Fmt.Expression[], public equivalenceProofs?: ObjectContents_Proof[], public reflexivityProof?: ObjectContents_Proof, public symmetryProof?: ObjectContents_Proof, public transitivityProof?: ObjectContents_Proof, public isomorphic?: Fmt.Expression) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstructorEqualityDefinition {
    const result: ObjectContents_ConstructorEqualityDefinition = Object.create(ObjectContents_ConstructorEqualityDefinition.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const leftParametersRaw = argumentList.getValue('leftParameters', 0);
    if (leftParametersRaw instanceof Fmt.ParameterExpression) {
      this.leftParameters = leftParametersRaw.parameters;
    } else {
      throw new Error('leftParameters: Parameter expression expected');
    }
    const rightParametersRaw = argumentList.getValue('rightParameters', 1);
    if (rightParametersRaw instanceof Fmt.ParameterExpression) {
      this.rightParameters = rightParametersRaw.parameters;
    } else {
      throw new Error('rightParameters: Parameter expression expected');
    }
    const definitionRaw = argumentList.getValue('definition', 2);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    const equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 3);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (const item of equivalenceProofsRaw.items) {
          const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
          this.equivalenceProofs.push(newItem);
          reportFn?.(item, newItem);
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
    const reflexivityProofRaw = argumentList.getOptionalValue('reflexivityProof', 4);
    if (reflexivityProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(reflexivityProofRaw, reportFn);
      this.reflexivityProof = newItem;
      reportFn?.(reflexivityProofRaw, newItem);
    }
    const symmetryProofRaw = argumentList.getOptionalValue('symmetryProof', 5);
    if (symmetryProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(symmetryProofRaw, reportFn);
      this.symmetryProof = newItem;
      reportFn?.(symmetryProofRaw, newItem);
    }
    const transitivityProofRaw = argumentList.getOptionalValue('transitivityProof', 6);
    if (transitivityProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(transitivityProofRaw, reportFn);
      this.transitivityProof = newItem;
      reportFn?.(transitivityProofRaw, newItem);
    }
    this.isomorphic = argumentList.getOptionalValue('isomorphic', 7);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const leftParametersExpr = new Fmt.ParameterExpression(this.leftParameters);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'leftParameters' : undefined, leftParametersExpr, false));
    const rightParametersExpr = new Fmt.ParameterExpression(this.rightParameters);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'rightParameters' : undefined, rightParametersExpr, false));
    const definitionExprItems: Fmt.Expression[] = [];
    for (const item of this.definition) {
      definitionExprItems.push(item);
    }
    const definitionExpr = new Fmt.ArrayExpression(definitionExprItems);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'definition' : undefined, definitionExpr, false));
    if (this.equivalenceProofs !== undefined) {
      const equivalenceProofsExprItems: Fmt.Expression[] = [];
      for (const item of this.equivalenceProofs) {
        const newItem = item.toExpression(true, reportFn);
        equivalenceProofsExprItems.push(newItem);
        reportFn?.(newItem, item);
      }
      const equivalenceProofsExpr = new Fmt.ArrayExpression(equivalenceProofsExprItems);
      argumentList.push(new Fmt.Argument('equivalenceProofs', equivalenceProofsExpr, true));
    }
    if (this.reflexivityProof !== undefined) {
      const reflexivityProofExpr = this.reflexivityProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('reflexivityProof', reflexivityProofExpr, true));
      reportFn?.(reflexivityProofExpr, this.reflexivityProof);
    }
    if (this.symmetryProof !== undefined) {
      const symmetryProofExpr = this.symmetryProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('symmetryProof', symmetryProofExpr, true));
      reportFn?.(symmetryProofExpr, this.symmetryProof);
    }
    if (this.transitivityProof !== undefined) {
      const transitivityProofExpr = this.transitivityProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('transitivityProof', transitivityProofExpr, true));
      reportFn?.(transitivityProofExpr, this.transitivityProof);
    }
    if (this.isomorphic !== undefined) {
      argumentList.push(new Fmt.Argument('isomorphic', this.isomorphic, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstructorEqualityDefinition {
    const result: ObjectContents_ConstructorEqualityDefinition = Object.create(ObjectContents_ConstructorEqualityDefinition.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ConstructorEqualityDefinition {
    const result: ObjectContents_ConstructorEqualityDefinition = Object.create(ObjectContents_ConstructorEqualityDefinition.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.leftParameters) {
      this.leftParameters.traverse(fn);
    }
    if (this.rightParameters) {
      this.rightParameters.traverse(fn);
    }
    if (this.definition) {
      for (const item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (const item of this.equivalenceProofs) {
        item.traverse(fn);
      }
    }
    if (this.reflexivityProof) {
      this.reflexivityProof.traverse(fn);
    }
    if (this.symmetryProof) {
      this.symmetryProof.traverse(fn);
    }
    if (this.transitivityProof) {
      this.transitivityProof.traverse(fn);
    }
    if (this.isomorphic) {
      this.isomorphic.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ConstructorEqualityDefinition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.leftParameters) {
      result.leftParameters = this.leftParameters.substitute(fn, replacedParameters);
      if (result.leftParameters !== this.leftParameters) {
        changed = true;
      }
    }
    if (this.rightParameters) {
      result.rightParameters = this.rightParameters.substitute(fn, replacedParameters);
      if (result.rightParameters !== this.rightParameters) {
        changed = true;
      }
    }
    if (this.definition) {
      result.definition = [];
      for (const item of this.definition) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (const item of this.equivalenceProofs) {
        const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
        if (item.substitute(fn, newItem, replacedParameters)) {
          changed = true;
        }
        result.equivalenceProofs.push(newItem);
      }
    }
    if (this.reflexivityProof) {
      result.reflexivityProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.reflexivityProof.substitute(fn, result.reflexivityProof, replacedParameters)) {
        changed = true;
      }
    }
    if (this.symmetryProof) {
      result.symmetryProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.symmetryProof.substitute(fn, result.symmetryProof, replacedParameters)) {
        changed = true;
      }
    }
    if (this.transitivityProof) {
      result.transitivityProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.transitivityProof.substitute(fn, result.transitivityProof, replacedParameters)) {
        changed = true;
      }
    }
    if (this.isomorphic) {
      result.isomorphic = this.isomorphic.substitute(fn, replacedParameters);
      if (result.isomorphic !== this.isomorphic) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ConstructorEqualityDefinition, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.leftParameters, objectContents.leftParameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.rightParameters, objectContents.rightParameters, fn, replacedParameters)) {
      return false;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || this.definition.length !== objectContents.definition.length) {
        return false;
      }
      for (let i = 0; i < this.definition.length; i++) {
        const leftItem = this.definition[i];
        const rightItem = objectContents.definition[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        const leftItem = this.equivalenceProofs[i];
        const rightItem = objectContents.equivalenceProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (!Fmt.areObjectsEquivalent(this.reflexivityProof, objectContents.reflexivityProof, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.symmetryProof, objectContents.symmetryProof, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.transitivityProof, objectContents.transitivityProof, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.isomorphic, objectContents.isomorphic, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_ConstructorRewriteDefinition extends Fmt.ObjectContents {
  constructor(public value: Fmt.Expression, public theorem?: Fmt.Expression) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstructorRewriteDefinition {
    const result: ObjectContents_ConstructorRewriteDefinition = Object.create(ObjectContents_ConstructorRewriteDefinition.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.value = argumentList.getValue('value', 0);
    this.theorem = argumentList.getOptionalValue('theorem', 1);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(outputAllNames ? 'value' : undefined, this.value, false));
    if (this.theorem !== undefined) {
      argumentList.push(new Fmt.Argument('theorem', this.theorem, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstructorRewriteDefinition {
    const result: ObjectContents_ConstructorRewriteDefinition = Object.create(ObjectContents_ConstructorRewriteDefinition.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  fromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): void {
    if (expression instanceof Fmt.CompoundExpression) {
      super.fromExpression(expression, reportFn);
    } else {
      this.value = expression;
    }
  }

  toExpression(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.Expression {
    if (outputAllNames || this.value instanceof Fmt.CompoundExpression || this.theorem) {
      return super.toExpression(outputAllNames, reportFn);
    } else {
      return this.value;
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ConstructorRewriteDefinition {
    const result: ObjectContents_ConstructorRewriteDefinition = Object.create(ObjectContents_ConstructorRewriteDefinition.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.value) {
      this.value.traverse(fn);
    }
    if (this.theorem) {
      this.theorem.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ConstructorRewriteDefinition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.value) {
      result.value = this.value.substitute(fn, replacedParameters);
      if (result.value !== this.value) {
        changed = true;
      }
    }
    if (this.theorem) {
      result.theorem = this.theorem.substitute(fn, replacedParameters);
      if (result.theorem !== this.theorem) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ConstructorRewriteDefinition, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.value, objectContents.value, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.theorem, objectContents.theorem, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_SetOperator extends ObjectContents_Definition {
  constructor(properties: Fmt.ArgumentList | undefined, notation: Fmt.Expression | undefined, abbreviations: Fmt.Expression[] | undefined, definitionNotation: Fmt.Expression | undefined, public definition: Fmt.Expression[], public equalityProofs?: ObjectContents_Proof[], public setRestriction?: Fmt.Expression, public setRestrictionProof?: ObjectContents_Proof) {
    super(properties, notation, abbreviations, definitionNotation);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_SetOperator {
    const result: ObjectContents_SetOperator = Object.create(ObjectContents_SetOperator.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const definitionRaw = argumentList.getValue('definition', 4);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    const equalityProofsRaw = argumentList.getOptionalValue('equalityProofs', 5);
    if (equalityProofsRaw !== undefined) {
      if (equalityProofsRaw instanceof Fmt.ArrayExpression) {
        this.equalityProofs = [];
        for (const item of equalityProofsRaw.items) {
          const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
          this.equalityProofs.push(newItem);
          reportFn?.(item, newItem);
        }
      } else {
        throw new Error('equalityProofs: Array expression expected');
      }
    }
    this.setRestriction = argumentList.getOptionalValue('setRestriction', 6);
    const setRestrictionProofRaw = argumentList.getOptionalValue('setRestrictionProof', 7);
    if (setRestrictionProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(setRestrictionProofRaw, reportFn);
      this.setRestrictionProof = newItem;
      reportFn?.(setRestrictionProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    const definitionExprItems: Fmt.Expression[] = [];
    for (const item of this.definition) {
      definitionExprItems.push(item);
    }
    const definitionExpr = new Fmt.ArrayExpression(definitionExprItems);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'definition' : undefined, definitionExpr, false));
    if (this.equalityProofs !== undefined) {
      const equalityProofsExprItems: Fmt.Expression[] = [];
      for (const item of this.equalityProofs) {
        const newItem = item.toExpression(true, reportFn);
        equalityProofsExprItems.push(newItem);
        reportFn?.(newItem, item);
      }
      const equalityProofsExpr = new Fmt.ArrayExpression(equalityProofsExprItems);
      argumentList.push(new Fmt.Argument('equalityProofs', equalityProofsExpr, true));
    }
    if (this.setRestriction !== undefined) {
      argumentList.push(new Fmt.Argument('setRestriction', this.setRestriction, true));
    }
    if (this.setRestrictionProof !== undefined) {
      const setRestrictionProofExpr = this.setRestrictionProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('setRestrictionProof', setRestrictionProofExpr, true));
      reportFn?.(setRestrictionProofExpr, this.setRestrictionProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_SetOperator {
    const result: ObjectContents_SetOperator = Object.create(ObjectContents_SetOperator.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SetOperator {
    const result: ObjectContents_SetOperator = Object.create(ObjectContents_SetOperator.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definition) {
      for (const item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equalityProofs) {
      for (const item of this.equalityProofs) {
        item.traverse(fn);
      }
    }
    if (this.setRestriction) {
      this.setRestriction.traverse(fn);
    }
    if (this.setRestrictionProof) {
      this.setRestrictionProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_SetOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = [];
      for (const item of this.definition) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equalityProofs) {
      result.equalityProofs = [];
      for (const item of this.equalityProofs) {
        const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
        if (item.substitute(fn, newItem, replacedParameters)) {
          changed = true;
        }
        result.equalityProofs.push(newItem);
      }
    }
    if (this.setRestriction) {
      result.setRestriction = this.setRestriction.substitute(fn, replacedParameters);
      if (result.setRestriction !== this.setRestriction) {
        changed = true;
      }
    }
    if (this.setRestrictionProof) {
      result.setRestrictionProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.setRestrictionProof.substitute(fn, result.setRestrictionProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_SetOperator, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || this.definition.length !== objectContents.definition.length) {
        return false;
      }
      for (let i = 0; i < this.definition.length; i++) {
        const leftItem = this.definition[i];
        const rightItem = objectContents.definition[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.equalityProofs || objectContents.equalityProofs) {
      if (!this.equalityProofs || !objectContents.equalityProofs || this.equalityProofs.length !== objectContents.equalityProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equalityProofs.length; i++) {
        const leftItem = this.equalityProofs[i];
        const rightItem = objectContents.equalityProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (!Fmt.areObjectsEquivalent(this.setRestriction, objectContents.setRestriction, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.setRestrictionProof, objectContents.setRestrictionProof, fn, replacedParameters)) {
      return false;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_SetOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'SetOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_SetOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_SetOperator)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_SetOperator.prototype);
  }
}

export class ObjectContents_Operator extends ObjectContents_Definition {
  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Operator {
    const result: ObjectContents_Operator = Object.create(ObjectContents_Operator.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Operator {
    const result: ObjectContents_Operator = Object.create(ObjectContents_Operator.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Operator {
    const result: ObjectContents_Operator = Object.create(ObjectContents_Operator.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Operator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    const changed = super.substitute(fn, result, replacedParameters);
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Operator, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class ObjectContents_ExplicitOperator extends ObjectContents_Operator {
  constructor(properties: Fmt.ArgumentList | undefined, notation: Fmt.Expression | undefined, abbreviations: Fmt.Expression[] | undefined, definitionNotation: Fmt.Expression | undefined, public definition: Fmt.Expression[], public equalityProofs?: ObjectContents_Proof[], public setRestriction?: Fmt.Expression, public setRestrictionProof?: ObjectContents_Proof) {
    super(properties, notation, abbreviations, definitionNotation);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ExplicitOperator {
    const result: ObjectContents_ExplicitOperator = Object.create(ObjectContents_ExplicitOperator.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const definitionRaw = argumentList.getValue('definition', 4);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    const equalityProofsRaw = argumentList.getOptionalValue('equalityProofs', 5);
    if (equalityProofsRaw !== undefined) {
      if (equalityProofsRaw instanceof Fmt.ArrayExpression) {
        this.equalityProofs = [];
        for (const item of equalityProofsRaw.items) {
          const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
          this.equalityProofs.push(newItem);
          reportFn?.(item, newItem);
        }
      } else {
        throw new Error('equalityProofs: Array expression expected');
      }
    }
    this.setRestriction = argumentList.getOptionalValue('setRestriction', 6);
    const setRestrictionProofRaw = argumentList.getOptionalValue('setRestrictionProof', 7);
    if (setRestrictionProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(setRestrictionProofRaw, reportFn);
      this.setRestrictionProof = newItem;
      reportFn?.(setRestrictionProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    const definitionExprItems: Fmt.Expression[] = [];
    for (const item of this.definition) {
      definitionExprItems.push(item);
    }
    const definitionExpr = new Fmt.ArrayExpression(definitionExprItems);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'definition' : undefined, definitionExpr, false));
    if (this.equalityProofs !== undefined) {
      const equalityProofsExprItems: Fmt.Expression[] = [];
      for (const item of this.equalityProofs) {
        const newItem = item.toExpression(true, reportFn);
        equalityProofsExprItems.push(newItem);
        reportFn?.(newItem, item);
      }
      const equalityProofsExpr = new Fmt.ArrayExpression(equalityProofsExprItems);
      argumentList.push(new Fmt.Argument('equalityProofs', equalityProofsExpr, true));
    }
    if (this.setRestriction !== undefined) {
      argumentList.push(new Fmt.Argument('setRestriction', this.setRestriction, true));
    }
    if (this.setRestrictionProof !== undefined) {
      const setRestrictionProofExpr = this.setRestrictionProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('setRestrictionProof', setRestrictionProofExpr, true));
      reportFn?.(setRestrictionProofExpr, this.setRestrictionProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ExplicitOperator {
    const result: ObjectContents_ExplicitOperator = Object.create(ObjectContents_ExplicitOperator.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ExplicitOperator {
    const result: ObjectContents_ExplicitOperator = Object.create(ObjectContents_ExplicitOperator.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definition) {
      for (const item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equalityProofs) {
      for (const item of this.equalityProofs) {
        item.traverse(fn);
      }
    }
    if (this.setRestriction) {
      this.setRestriction.traverse(fn);
    }
    if (this.setRestrictionProof) {
      this.setRestrictionProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ExplicitOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = [];
      for (const item of this.definition) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equalityProofs) {
      result.equalityProofs = [];
      for (const item of this.equalityProofs) {
        const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
        if (item.substitute(fn, newItem, replacedParameters)) {
          changed = true;
        }
        result.equalityProofs.push(newItem);
      }
    }
    if (this.setRestriction) {
      result.setRestriction = this.setRestriction.substitute(fn, replacedParameters);
      if (result.setRestriction !== this.setRestriction) {
        changed = true;
      }
    }
    if (this.setRestrictionProof) {
      result.setRestrictionProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.setRestrictionProof.substitute(fn, result.setRestrictionProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ExplicitOperator, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || this.definition.length !== objectContents.definition.length) {
        return false;
      }
      for (let i = 0; i < this.definition.length; i++) {
        const leftItem = this.definition[i];
        const rightItem = objectContents.definition[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.equalityProofs || objectContents.equalityProofs) {
      if (!this.equalityProofs || !objectContents.equalityProofs || this.equalityProofs.length !== objectContents.equalityProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equalityProofs.length; i++) {
        const leftItem = this.equalityProofs[i];
        const rightItem = objectContents.equalityProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (!Fmt.areObjectsEquivalent(this.setRestriction, objectContents.setRestriction, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.setRestrictionProof, objectContents.setRestrictionProof, fn, replacedParameters)) {
      return false;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_ExplicitOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ExplicitOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_ExplicitOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ExplicitOperator)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_ExplicitOperator.prototype);
  }
}

export class ObjectContents_ImplicitOperator extends ObjectContents_Operator {
  constructor(properties: Fmt.ArgumentList | undefined, notation: Fmt.Expression | undefined, abbreviations: Fmt.Expression[] | undefined, definitionNotation: Fmt.Expression | undefined, public parameter: Fmt.Parameter, public definition: Fmt.Expression[], public equivalenceProofs?: ObjectContents_Proof[], public wellDefinednessProof?: ObjectContents_Proof) {
    super(properties, notation, abbreviations, definitionNotation);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ImplicitOperator {
    const result: ObjectContents_ImplicitOperator = Object.create(ObjectContents_ImplicitOperator.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const parameterRaw = argumentList.getValue('parameter', 4);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    const definitionRaw = argumentList.getValue('definition', 5);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    const equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 6);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (const item of equivalenceProofsRaw.items) {
          const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
          this.equivalenceProofs.push(newItem);
          reportFn?.(item, newItem);
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
    const wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 7);
    if (wellDefinednessProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(wellDefinednessProofRaw, reportFn);
      this.wellDefinednessProof = newItem;
      reportFn?.(wellDefinednessProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    const parameterExpr = new Fmt.ParameterExpression(new Fmt.ParameterList(this.parameter));
    argumentList.push(new Fmt.Argument(outputAllNames ? 'parameter' : undefined, parameterExpr, false));
    const definitionExprItems: Fmt.Expression[] = [];
    for (const item of this.definition) {
      definitionExprItems.push(item);
    }
    const definitionExpr = new Fmt.ArrayExpression(definitionExprItems);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'definition' : undefined, definitionExpr, false));
    if (this.equivalenceProofs !== undefined) {
      const equivalenceProofsExprItems: Fmt.Expression[] = [];
      for (const item of this.equivalenceProofs) {
        const newItem = item.toExpression(true, reportFn);
        equivalenceProofsExprItems.push(newItem);
        reportFn?.(newItem, item);
      }
      const equivalenceProofsExpr = new Fmt.ArrayExpression(equivalenceProofsExprItems);
      argumentList.push(new Fmt.Argument('equivalenceProofs', equivalenceProofsExpr, true));
    }
    if (this.wellDefinednessProof !== undefined) {
      const wellDefinednessProofExpr = this.wellDefinednessProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('wellDefinednessProof', wellDefinednessProofExpr, true));
      reportFn?.(wellDefinednessProofExpr, this.wellDefinednessProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ImplicitOperator {
    const result: ObjectContents_ImplicitOperator = Object.create(ObjectContents_ImplicitOperator.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ImplicitOperator {
    const result: ObjectContents_ImplicitOperator = Object.create(ObjectContents_ImplicitOperator.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.parameter) {
      this.parameter.traverse(fn);
    }
    if (this.definition) {
      for (const item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (const item of this.equivalenceProofs) {
        item.traverse(fn);
      }
    }
    if (this.wellDefinednessProof) {
      this.wellDefinednessProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ImplicitOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.parameter) {
      result.parameter = this.parameter.substitute(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.definition) {
      result.definition = [];
      for (const item of this.definition) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (const item of this.equivalenceProofs) {
        const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
        if (item.substitute(fn, newItem, replacedParameters)) {
          changed = true;
        }
        result.equivalenceProofs.push(newItem);
      }
    }
    if (this.wellDefinednessProof) {
      result.wellDefinednessProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.wellDefinednessProof.substitute(fn, result.wellDefinednessProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ImplicitOperator, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.parameter, objectContents.parameter, fn, replacedParameters)) {
      return false;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || this.definition.length !== objectContents.definition.length) {
        return false;
      }
      for (let i = 0; i < this.definition.length; i++) {
        const leftItem = this.definition[i];
        const rightItem = objectContents.definition[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        const leftItem = this.equivalenceProofs[i];
        const rightItem = objectContents.equivalenceProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (!Fmt.areObjectsEquivalent(this.wellDefinednessProof, objectContents.wellDefinednessProof, fn, replacedParameters)) {
      return false;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_ImplicitOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ImplicitOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_ImplicitOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ImplicitOperator)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_ImplicitOperator.prototype);
  }
}

export class ObjectContents_MacroOperator extends ObjectContents_Operator {
  constructor(properties?: Fmt.ArgumentList, notation?: Fmt.Expression, abbreviations?: Fmt.Expression[], definitionNotation?: Fmt.Expression, public variables?: Fmt.ParameterList, public references?: Fmt.ArgumentList) {
    super(properties, notation, abbreviations, definitionNotation);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_MacroOperator {
    const result: ObjectContents_MacroOperator = Object.create(ObjectContents_MacroOperator.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const variablesRaw = argumentList.getOptionalValue('variables', 4);
    if (variablesRaw !== undefined) {
      if (variablesRaw instanceof Fmt.ParameterExpression) {
        this.variables = variablesRaw.parameters;
      } else {
        throw new Error('variables: Parameter expression expected');
      }
    }
    const referencesRaw = argumentList.getOptionalValue('references', 5);
    if (referencesRaw !== undefined) {
      if (referencesRaw instanceof Fmt.CompoundExpression) {
        this.references = referencesRaw.arguments;
      } else {
        throw new Error('references: Compound expression expected');
      }
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    if (this.variables !== undefined) {
      const variablesExpr = new Fmt.ParameterExpression(this.variables);
      argumentList.push(new Fmt.Argument('variables', variablesExpr, true));
    }
    if (this.references !== undefined) {
      const referencesExpr = new Fmt.CompoundExpression(this.references);
      argumentList.push(new Fmt.Argument('references', referencesExpr, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_MacroOperator {
    const result: ObjectContents_MacroOperator = Object.create(ObjectContents_MacroOperator.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_MacroOperator {
    const result: ObjectContents_MacroOperator = Object.create(ObjectContents_MacroOperator.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.variables) {
      this.variables.traverse(fn);
    }
    if (this.references) {
      this.references.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_MacroOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.variables) {
      result.variables = this.variables.substitute(fn, replacedParameters);
      if (result.variables !== this.variables) {
        changed = true;
      }
    }
    if (this.references) {
      result.references = this.references.substitute(fn, replacedParameters);
      if (result.references !== this.references) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_MacroOperator, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.variables, objectContents.variables, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.references, objectContents.references, fn, replacedParameters)) {
      return false;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_MacroOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'MacroOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_MacroOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_MacroOperator)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_MacroOperator.prototype);
  }
}

export class ObjectContents_Predicate extends ObjectContents_Definition {
  constructor(properties: Fmt.ArgumentList | undefined, notation: Fmt.Expression | undefined, abbreviations: Fmt.Expression[] | undefined, definitionNotation: Fmt.Expression | undefined, public definition: Fmt.Expression[], public equivalenceProofs?: ObjectContents_Proof[]) {
    super(properties, notation, abbreviations, definitionNotation);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Predicate {
    const result: ObjectContents_Predicate = Object.create(ObjectContents_Predicate.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const definitionRaw = argumentList.getValue('definition', 4);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    const equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 5);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (const item of equivalenceProofsRaw.items) {
          const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
          this.equivalenceProofs.push(newItem);
          reportFn?.(item, newItem);
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    const definitionExprItems: Fmt.Expression[] = [];
    for (const item of this.definition) {
      definitionExprItems.push(item);
    }
    const definitionExpr = new Fmt.ArrayExpression(definitionExprItems);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'definition' : undefined, definitionExpr, false));
    if (this.equivalenceProofs !== undefined) {
      const equivalenceProofsExprItems: Fmt.Expression[] = [];
      for (const item of this.equivalenceProofs) {
        const newItem = item.toExpression(true, reportFn);
        equivalenceProofsExprItems.push(newItem);
        reportFn?.(newItem, item);
      }
      const equivalenceProofsExpr = new Fmt.ArrayExpression(equivalenceProofsExprItems);
      argumentList.push(new Fmt.Argument('equivalenceProofs', equivalenceProofsExpr, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Predicate {
    const result: ObjectContents_Predicate = Object.create(ObjectContents_Predicate.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Predicate {
    const result: ObjectContents_Predicate = Object.create(ObjectContents_Predicate.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definition) {
      for (const item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (const item of this.equivalenceProofs) {
        item.traverse(fn);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Predicate, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = [];
      for (const item of this.definition) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (const item of this.equivalenceProofs) {
        const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
        if (item.substitute(fn, newItem, replacedParameters)) {
          changed = true;
        }
        result.equivalenceProofs.push(newItem);
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Predicate, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || this.definition.length !== objectContents.definition.length) {
        return false;
      }
      for (let i = 0; i < this.definition.length; i++) {
        const leftItem = this.definition[i];
        const rightItem = objectContents.definition[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        const leftItem = this.equivalenceProofs[i];
        const rightItem = objectContents.equivalenceProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_Predicate extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Predicate';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Predicate;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Predicate)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_Predicate.prototype);
  }
}

export class ObjectContents_Theorem extends Fmt.ObjectContents {
  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Theorem {
    const result: ObjectContents_Theorem = Object.create(ObjectContents_Theorem.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Theorem {
    const result: ObjectContents_Theorem = Object.create(ObjectContents_Theorem.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Theorem {
    const result: ObjectContents_Theorem = Object.create(ObjectContents_Theorem.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Theorem, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    const changed = false;
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Theorem, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    return true;
  }
}

export class ObjectContents_StandardTheorem extends ObjectContents_Theorem {
  constructor(public claim: Fmt.Expression, public proofs?: ObjectContents_Proof[]) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_StandardTheorem {
    const result: ObjectContents_StandardTheorem = Object.create(ObjectContents_StandardTheorem.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    this.claim = argumentList.getValue('claim', 0);
    const proofsRaw = argumentList.getOptionalValue('proofs', 1);
    if (proofsRaw !== undefined) {
      if (proofsRaw instanceof Fmt.ArrayExpression) {
        this.proofs = [];
        for (const item of proofsRaw.items) {
          const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
          this.proofs.push(newItem);
          reportFn?.(item, newItem);
        }
      } else {
        throw new Error('proofs: Array expression expected');
      }
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'claim' : undefined, this.claim, false));
    if (this.proofs !== undefined) {
      const proofsExprItems: Fmt.Expression[] = [];
      for (const item of this.proofs) {
        const newItem = item.toExpression(true, reportFn);
        proofsExprItems.push(newItem);
        reportFn?.(newItem, item);
      }
      const proofsExpr = new Fmt.ArrayExpression(proofsExprItems);
      argumentList.push(new Fmt.Argument('proofs', proofsExpr, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_StandardTheorem {
    const result: ObjectContents_StandardTheorem = Object.create(ObjectContents_StandardTheorem.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_StandardTheorem {
    const result: ObjectContents_StandardTheorem = Object.create(ObjectContents_StandardTheorem.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.claim) {
      this.claim.traverse(fn);
    }
    if (this.proofs) {
      for (const item of this.proofs) {
        item.traverse(fn);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_StandardTheorem, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.claim) {
      result.claim = this.claim.substitute(fn, replacedParameters);
      if (result.claim !== this.claim) {
        changed = true;
      }
    }
    if (this.proofs) {
      result.proofs = [];
      for (const item of this.proofs) {
        const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
        if (item.substitute(fn, newItem, replacedParameters)) {
          changed = true;
        }
        result.proofs.push(newItem);
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_StandardTheorem, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.claim, objectContents.claim, fn, replacedParameters)) {
      return false;
    }
    if (this.proofs || objectContents.proofs) {
      if (!this.proofs || !objectContents.proofs || this.proofs.length !== objectContents.proofs.length) {
        return false;
      }
      for (let i = 0; i < this.proofs.length; i++) {
        const leftItem = this.proofs[i];
        const rightItem = objectContents.proofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_StandardTheorem extends Fmt.MetaRefExpression {
  getName(): string {
    return 'StandardTheorem';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_StandardTheorem;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_StandardTheorem)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_StandardTheorem.prototype);
  }
}

export class ObjectContents_EquivalenceTheorem extends ObjectContents_Theorem {
  constructor(public conditions: Fmt.Expression[], public equivalenceProofs?: ObjectContents_Proof[]) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_EquivalenceTheorem {
    const result: ObjectContents_EquivalenceTheorem = Object.create(ObjectContents_EquivalenceTheorem.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const conditionsRaw = argumentList.getValue('conditions', 0);
    if (conditionsRaw instanceof Fmt.ArrayExpression) {
      this.conditions = conditionsRaw.items;
    } else {
      throw new Error('conditions: Array expression expected');
    }
    const equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 1);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (const item of equivalenceProofsRaw.items) {
          const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
          this.equivalenceProofs.push(newItem);
          reportFn?.(item, newItem);
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    const conditionsExprItems: Fmt.Expression[] = [];
    for (const item of this.conditions) {
      conditionsExprItems.push(item);
    }
    const conditionsExpr = new Fmt.ArrayExpression(conditionsExprItems);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'conditions' : undefined, conditionsExpr, false));
    if (this.equivalenceProofs !== undefined) {
      const equivalenceProofsExprItems: Fmt.Expression[] = [];
      for (const item of this.equivalenceProofs) {
        const newItem = item.toExpression(true, reportFn);
        equivalenceProofsExprItems.push(newItem);
        reportFn?.(newItem, item);
      }
      const equivalenceProofsExpr = new Fmt.ArrayExpression(equivalenceProofsExprItems);
      argumentList.push(new Fmt.Argument('equivalenceProofs', equivalenceProofsExpr, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_EquivalenceTheorem {
    const result: ObjectContents_EquivalenceTheorem = Object.create(ObjectContents_EquivalenceTheorem.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_EquivalenceTheorem {
    const result: ObjectContents_EquivalenceTheorem = Object.create(ObjectContents_EquivalenceTheorem.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.conditions) {
      for (const item of this.conditions) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (const item of this.equivalenceProofs) {
        item.traverse(fn);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_EquivalenceTheorem, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.conditions) {
      result.conditions = [];
      for (const item of this.conditions) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.conditions.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (const item of this.equivalenceProofs) {
        const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
        if (item.substitute(fn, newItem, replacedParameters)) {
          changed = true;
        }
        result.equivalenceProofs.push(newItem);
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_EquivalenceTheorem, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.conditions || objectContents.conditions) {
      if (!this.conditions || !objectContents.conditions || this.conditions.length !== objectContents.conditions.length) {
        return false;
      }
      for (let i = 0; i < this.conditions.length; i++) {
        const leftItem = this.conditions[i];
        const rightItem = objectContents.conditions[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        const leftItem = this.equivalenceProofs[i];
        const rightItem = objectContents.equivalenceProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_EquivalenceTheorem extends Fmt.MetaRefExpression {
  getName(): string {
    return 'EquivalenceTheorem';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_EquivalenceTheorem;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_EquivalenceTheorem)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return Object.create(ObjectContents_EquivalenceTheorem.prototype);
  }
}

export class MetaRefExpression_Bool extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Bool';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Bool;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Bool)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_true extends Fmt.MetaRefExpression {
  getName(): string {
    return 'true';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_true;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_true)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_false extends Fmt.MetaRefExpression {
  getName(): string {
    return 'false';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_false;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_false)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Nat extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Nat';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Nat;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Nat)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Prop extends Fmt.MetaRefExpression {
  constructor(public auto?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Prop';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.auto = argumentList.getOptionalValue('auto', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.auto !== undefined) {
      argumentList.push(new Fmt.Argument('auto', this.auto, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let autoResult: Fmt.Expression | undefined = undefined;
    if (this.auto) {
      autoResult = this.auto.substitute(fn, replacedParameters);
      if (autoResult !== this.auto) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Prop(autoResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Prop)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.auto, expression.auto, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Set extends Fmt.MetaRefExpression {
  constructor(public auto?: Fmt.Expression, public embedSubsets?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Set';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.auto = argumentList.getOptionalValue('auto', 0);
    this.embedSubsets = argumentList.getOptionalValue('embedSubsets', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.auto !== undefined) {
      argumentList.push(new Fmt.Argument('auto', this.auto, true));
    }
    if (this.embedSubsets !== undefined) {
      argumentList.push(new Fmt.Argument('embedSubsets', this.embedSubsets, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let autoResult: Fmt.Expression | undefined = undefined;
    if (this.auto) {
      autoResult = this.auto.substitute(fn, replacedParameters);
      if (autoResult !== this.auto) {
        changed = true;
      }
    }
    let embedSubsetsResult: Fmt.Expression | undefined = undefined;
    if (this.embedSubsets) {
      embedSubsetsResult = this.embedSubsets.substitute(fn, replacedParameters);
      if (embedSubsetsResult !== this.embedSubsets) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Set(autoResult, embedSubsetsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Set)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.auto, expression.auto, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.embedSubsets, expression.embedSubsets, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Subset extends Fmt.MetaRefExpression {
  constructor(public superset: Fmt.Expression, public auto?: Fmt.Expression, public embedSubsets?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Subset';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.superset = argumentList.getValue('superset', 0);
    this.auto = argumentList.getOptionalValue('auto', 1);
    this.embedSubsets = argumentList.getOptionalValue('embedSubsets', 2);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.superset, false));
    if (this.auto !== undefined) {
      argumentList.push(new Fmt.Argument('auto', this.auto, true));
    }
    if (this.embedSubsets !== undefined) {
      argumentList.push(new Fmt.Argument('embedSubsets', this.embedSubsets, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const supersetResult = this.superset.substitute(fn, replacedParameters);
    if (supersetResult !== this.superset) {
      changed = true;
    }
    let autoResult: Fmt.Expression | undefined = undefined;
    if (this.auto) {
      autoResult = this.auto.substitute(fn, replacedParameters);
      if (autoResult !== this.auto) {
        changed = true;
      }
    }
    let embedSubsetsResult: Fmt.Expression | undefined = undefined;
    if (this.embedSubsets) {
      embedSubsetsResult = this.embedSubsets.substitute(fn, replacedParameters);
      if (embedSubsetsResult !== this.embedSubsets) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Subset(supersetResult, autoResult, embedSubsetsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Subset)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.superset, expression.superset, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.auto, expression.auto, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.embedSubsets, expression.embedSubsets, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Element extends Fmt.MetaRefExpression {
  constructor(public _set: Fmt.Expression, public auto?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Element';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
    this.auto = argumentList.getOptionalValue('auto', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this._set, false));
    if (this.auto !== undefined) {
      argumentList.push(new Fmt.Argument('auto', this.auto, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const _setResult = this._set.substitute(fn, replacedParameters);
    if (_setResult !== this._set) {
      changed = true;
    }
    let autoResult: Fmt.Expression | undefined = undefined;
    if (this.auto) {
      autoResult = this.auto.substitute(fn, replacedParameters);
      if (autoResult !== this.auto) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Element(_setResult, autoResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Element)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this._set, expression._set, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.auto, expression.auto, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Constraint extends Fmt.MetaRefExpression {
  constructor(public formula: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Constraint';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.formula, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const formulaResult = this.formula.substitute(fn, replacedParameters);
    if (formulaResult !== this.formula) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Constraint(formulaResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Constraint)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, expression.formula, fn, replacedParameters)) {
      return false;
    }
    return true;
  }

  canOmit(): boolean { return true; }
}

export class MetaRefExpression_Binder extends Fmt.MetaRefExpression {
  constructor(public sourceParameters: Fmt.ParameterList, public targetParameters: Fmt.ParameterList) {
    super();
  }

  getName(): string {
    return 'Binder';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const sourceParametersRaw = argumentList.getValue('sourceParameters', 0);
    if (sourceParametersRaw instanceof Fmt.ParameterExpression) {
      this.sourceParameters = sourceParametersRaw.parameters;
    } else {
      throw new Error('sourceParameters: Parameter expression expected');
    }
    const targetParametersRaw = argumentList.getValue('targetParameters', 1);
    if (targetParametersRaw instanceof Fmt.ParameterExpression) {
      this.targetParameters = targetParametersRaw.parameters;
    } else {
      throw new Error('targetParameters: Parameter expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const sourceParametersExpr = new Fmt.ParameterExpression(this.sourceParameters);
    argumentList.push(new Fmt.Argument(undefined, sourceParametersExpr, false));
    const targetParametersExpr = new Fmt.ParameterExpression(this.targetParameters);
    argumentList.push(new Fmt.Argument(undefined, targetParametersExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const sourceParametersResult = this.sourceParameters.substitute(fn, replacedParameters);
    if (sourceParametersResult !== this.sourceParameters) {
      changed = true;
    }
    const targetParametersResult = this.targetParameters.substitute(fn, replacedParameters);
    if (targetParametersResult !== this.targetParameters) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Binder(sourceParametersResult, targetParametersResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Binder)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.sourceParameters, expression.sourceParameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.targetParameters, expression.targetParameters, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_SetDef extends Fmt.MetaRefExpression {
  constructor(public _set: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'SetDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this._set, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const _setResult = this._set.substitute(fn, replacedParameters);
    if (_setResult !== this._set) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_SetDef(_setResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_SetDef)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this._set, expression._set, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Def extends Fmt.MetaRefExpression {
  constructor(public element: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Def';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.element = argumentList.getValue('element', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.element, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const elementResult = this.element.substitute(fn, replacedParameters);
    if (elementResult !== this.element) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Def(elementResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Def)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.element, expression.element, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_PropArg extends Fmt.ObjectContents {
  constructor(public formula: Fmt.Expression) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_PropArg {
    const result: ObjectContents_PropArg = Object.create(ObjectContents_PropArg.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(outputAllNames ? 'formula' : undefined, this.formula, false));
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_PropArg {
    const result: ObjectContents_PropArg = Object.create(ObjectContents_PropArg.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  fromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): void {
    if (expression instanceof Fmt.CompoundExpression) {
      super.fromExpression(expression, reportFn);
    } else {
      this.formula = expression;
    }
  }

  toExpression(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.Expression {
    if (outputAllNames || this.formula instanceof Fmt.CompoundExpression) {
      return super.toExpression(outputAllNames, reportFn);
    } else {
      return this.formula;
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_PropArg {
    const result: ObjectContents_PropArg = Object.create(ObjectContents_PropArg.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.formula) {
      this.formula.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_PropArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_PropArg, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, objectContents.formula, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_SetArg extends Fmt.ObjectContents {
  constructor(public _set: Fmt.Expression) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_SetArg {
    const result: ObjectContents_SetArg = Object.create(ObjectContents_SetArg.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(outputAllNames ? 'set' : undefined, this._set, false));
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_SetArg {
    const result: ObjectContents_SetArg = Object.create(ObjectContents_SetArg.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  fromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): void {
    if (expression instanceof Fmt.CompoundExpression) {
      super.fromExpression(expression, reportFn);
    } else {
      this._set = expression;
    }
  }

  toExpression(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.Expression {
    if (outputAllNames || this._set instanceof Fmt.CompoundExpression) {
      return super.toExpression(outputAllNames, reportFn);
    } else {
      return this._set;
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SetArg {
    const result: ObjectContents_SetArg = Object.create(ObjectContents_SetArg.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this._set) {
      this._set.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_SetArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_SetArg, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this._set, objectContents._set, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_SubsetArg extends Fmt.ObjectContents {
  constructor(public _set: Fmt.Expression, public subsetProof?: ObjectContents_Proof) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_SubsetArg {
    const result: ObjectContents_SubsetArg = Object.create(ObjectContents_SubsetArg.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
    const subsetProofRaw = argumentList.getOptionalValue('subsetProof', 1);
    if (subsetProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(subsetProofRaw, reportFn);
      this.subsetProof = newItem;
      reportFn?.(subsetProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(outputAllNames ? 'set' : undefined, this._set, false));
    if (this.subsetProof !== undefined) {
      const subsetProofExpr = this.subsetProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('subsetProof', subsetProofExpr, true));
      reportFn?.(subsetProofExpr, this.subsetProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_SubsetArg {
    const result: ObjectContents_SubsetArg = Object.create(ObjectContents_SubsetArg.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  fromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): void {
    if (expression instanceof Fmt.CompoundExpression) {
      super.fromExpression(expression, reportFn);
    } else {
      this._set = expression;
    }
  }

  toExpression(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.Expression {
    if (outputAllNames || this._set instanceof Fmt.CompoundExpression || this.subsetProof) {
      return super.toExpression(outputAllNames, reportFn);
    } else {
      return this._set;
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SubsetArg {
    const result: ObjectContents_SubsetArg = Object.create(ObjectContents_SubsetArg.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this._set) {
      this._set.traverse(fn);
    }
    if (this.subsetProof) {
      this.subsetProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_SubsetArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    if (this.subsetProof) {
      result.subsetProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.subsetProof.substitute(fn, result.subsetProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_SubsetArg, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this._set, objectContents._set, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.subsetProof, objectContents.subsetProof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_ElementArg extends Fmt.ObjectContents {
  constructor(public element: Fmt.Expression, public elementProof?: ObjectContents_Proof) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ElementArg {
    const result: ObjectContents_ElementArg = Object.create(ObjectContents_ElementArg.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.element = argumentList.getValue('element', 0);
    const elementProofRaw = argumentList.getOptionalValue('elementProof', 1);
    if (elementProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(elementProofRaw, reportFn);
      this.elementProof = newItem;
      reportFn?.(elementProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(outputAllNames ? 'element' : undefined, this.element, false));
    if (this.elementProof !== undefined) {
      const elementProofExpr = this.elementProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('elementProof', elementProofExpr, true));
      reportFn?.(elementProofExpr, this.elementProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ElementArg {
    const result: ObjectContents_ElementArg = Object.create(ObjectContents_ElementArg.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  fromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): void {
    if (expression instanceof Fmt.CompoundExpression) {
      super.fromExpression(expression, reportFn);
    } else {
      this.element = expression;
    }
  }

  toExpression(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.Expression {
    if (outputAllNames || this.element instanceof Fmt.CompoundExpression || this.elementProof) {
      return super.toExpression(outputAllNames, reportFn);
    } else {
      return this.element;
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ElementArg {
    const result: ObjectContents_ElementArg = Object.create(ObjectContents_ElementArg.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.element) {
      this.element.traverse(fn);
    }
    if (this.elementProof) {
      this.elementProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ElementArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.element) {
      result.element = this.element.substitute(fn, replacedParameters);
      if (result.element !== this.element) {
        changed = true;
      }
    }
    if (this.elementProof) {
      result.elementProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.elementProof.substitute(fn, result.elementProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ElementArg, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.element, objectContents.element, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.elementProof, objectContents.elementProof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_ConstraintArg extends Fmt.ObjectContents {
  constructor(public proof?: ObjectContents_Proof) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstraintArg {
    const result: ObjectContents_ConstraintArg = Object.create(ObjectContents_ConstraintArg.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const proofRaw = argumentList.getOptionalValue('proof', 0);
    if (proofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.proof !== undefined) {
      const proofExpr = this.proof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('proof', proofExpr, true));
      reportFn?.(proofExpr, this.proof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ConstraintArg {
    const result: ObjectContents_ConstraintArg = Object.create(ObjectContents_ConstraintArg.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ConstraintArg {
    const result: ObjectContents_ConstraintArg = Object.create(ObjectContents_ConstraintArg.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.proof) {
      this.proof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ConstraintArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.proof) {
      result.proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.proof.substitute(fn, result.proof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ConstraintArg, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, objectContents.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_BinderArg extends Fmt.ObjectContents {
  constructor(public sourceParameters: Fmt.ParameterList, public targetArguments: Fmt.ArgumentList) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_BinderArg {
    const result: ObjectContents_BinderArg = Object.create(ObjectContents_BinderArg.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const sourceParametersRaw = argumentList.getValue('sourceParameters', 0);
    if (sourceParametersRaw instanceof Fmt.ParameterExpression) {
      this.sourceParameters = sourceParametersRaw.parameters;
    } else {
      throw new Error('sourceParameters: Parameter expression expected');
    }
    const targetArgumentsRaw = argumentList.getValue('targetArguments', 1);
    if (targetArgumentsRaw instanceof Fmt.CompoundExpression) {
      this.targetArguments = targetArgumentsRaw.arguments;
    } else {
      throw new Error('targetArguments: Compound expression expected');
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const sourceParametersExpr = new Fmt.ParameterExpression(this.sourceParameters);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'sourceParameters' : undefined, sourceParametersExpr, false));
    const targetArgumentsExpr = new Fmt.CompoundExpression(this.targetArguments);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'targetArguments' : undefined, targetArgumentsExpr, false));
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_BinderArg {
    const result: ObjectContents_BinderArg = Object.create(ObjectContents_BinderArg.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_BinderArg {
    const result: ObjectContents_BinderArg = Object.create(ObjectContents_BinderArg.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.sourceParameters) {
      this.sourceParameters.traverse(fn);
    }
    if (this.targetArguments) {
      this.targetArguments.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_BinderArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.sourceParameters) {
      result.sourceParameters = this.sourceParameters.substitute(fn, replacedParameters);
      if (result.sourceParameters !== this.sourceParameters) {
        changed = true;
      }
    }
    if (this.targetArguments) {
      result.targetArguments = this.targetArguments.substitute(fn, replacedParameters);
      if (result.targetArguments !== this.targetArguments) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_BinderArg, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.sourceParameters, objectContents.sourceParameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.targetArguments, objectContents.targetArguments, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_enumeration extends Fmt.MetaRefExpression {
  terms?: Fmt.Expression[];

  constructor(...terms: Fmt.Expression[]) {
    super();
    if (terms.length) {
      this.terms = terms;
    }
  }

  getName(): string {
    return 'enumeration';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    if (this.terms) {
      this.terms = undefined;
    }
    let index = 0;
    for (;;) {
      const termsRaw = argumentList.getOptionalValue(undefined, index);
      if (termsRaw === undefined) {
        break;
      }
      if (!this.terms) {
        this.terms = [];
      }
      this.terms.push(termsRaw);
      index++;
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.terms !== undefined) {
      for (const termsArg of this.terms) {
        argumentList.push(new Fmt.Argument(undefined, termsArg, true));
      }
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termsResult: Fmt.Expression[] = [];
    if (this.terms) {
      for (const item of this.terms) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        termsResult.push(newItem);
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_enumeration(...termsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_enumeration)) {
      return false;
    }
    if (this.terms || expression.terms) {
      if (!this.terms || !expression.terms || this.terms.length !== expression.terms.length) {
        return false;
      }
      for (let i = 0; i < this.terms.length; i++) {
        const leftItem = this.terms[i];
        const rightItem = expression.terms[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_subset extends Fmt.MetaRefExpression {
  constructor(public parameter: Fmt.Parameter, public formula: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'subset';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.formula = argumentList.getValue('formula', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parameterExpr = new Fmt.ParameterExpression(new Fmt.ParameterList(this.parameter));
    argumentList.push(new Fmt.Argument(undefined, parameterExpr, false));
    argumentList.push(new Fmt.Argument(undefined, this.formula, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const parameterResult = this.parameter.substitute(fn, replacedParameters);
    if (parameterResult !== this.parameter) {
      changed = true;
    }
    const formulaResult = this.formula.substitute(fn, replacedParameters);
    if (formulaResult !== this.formula) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_subset(parameterResult, formulaResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_subset)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameter, expression.parameter, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, expression.formula, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_extendedSubset extends Fmt.MetaRefExpression {
  constructor(public parameters: Fmt.ParameterList, public term: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'extendedSubset';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.term = argumentList.getValue('term', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parametersExpr = new Fmt.ParameterExpression(this.parameters);
    argumentList.push(new Fmt.Argument(undefined, parametersExpr, false));
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const parametersResult = this.parameters.substitute(fn, replacedParameters);
    if (parametersResult !== this.parameters) {
      changed = true;
    }
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_extendedSubset(parametersResult, termResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_extendedSubset)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameters, expression.parameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_setStructuralCases extends Fmt.MetaRefExpression {
  constructor(public term: Fmt.Expression, public construction: Fmt.Expression, public cases: ObjectContents_StructuralCase[]) {
    super();
  }

  getName(): string {
    return 'setStructuralCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    const casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (const item of casesRaw.items) {
        const newItem = ObjectContents_StructuralCase.createFromExpression(item, reportFn);
        this.cases.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    argumentList.push(new Fmt.Argument(undefined, this.construction, false));
    const casesExprItems: Fmt.Expression[] = [];
    for (const item of this.cases) {
      const newItem = item.toExpression(true, reportFn);
      casesExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const casesExpr = new Fmt.ArrayExpression(casesExprItems);
    argumentList.push(new Fmt.Argument(undefined, casesExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    const constructionResult = this.construction.substitute(fn, replacedParameters);
    if (constructionResult !== this.construction) {
      changed = true;
    }
    const casesResult: ObjectContents_StructuralCase[] = [];
    for (const item of this.cases) {
      const newItem: ObjectContents_StructuralCase = Object.create(ObjectContents_StructuralCase.prototype) as ObjectContents_StructuralCase;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      casesResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_setStructuralCases(termResult, constructionResult, casesResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_setStructuralCases)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.construction, expression.construction, fn, replacedParameters)) {
      return false;
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        const leftItem = this.cases[i];
        const rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_setAssociative extends Fmt.MetaRefExpression {
  constructor(public term: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'setAssociative';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_setAssociative(termResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_setAssociative)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_cases extends Fmt.MetaRefExpression {
  constructor(public cases: ObjectContents_Case[], public totalityProof?: ObjectContents_Proof) {
    super();
  }

  getName(): string {
    return 'cases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const casesRaw = argumentList.getValue('cases', 0);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (const item of casesRaw.items) {
        const newItem = ObjectContents_Case.createFromExpression(item, reportFn);
        this.cases.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
    const totalityProofRaw = argumentList.getOptionalValue('totalityProof', 1);
    if (totalityProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(totalityProofRaw, reportFn);
      this.totalityProof = newItem;
      reportFn?.(totalityProofRaw, newItem);
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const casesExprItems: Fmt.Expression[] = [];
    for (const item of this.cases) {
      const newItem = item.toExpression(true, reportFn);
      casesExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const casesExpr = new Fmt.ArrayExpression(casesExprItems);
    argumentList.push(new Fmt.Argument(undefined, casesExpr, false));
    if (this.totalityProof !== undefined) {
      const totalityProofExpr = this.totalityProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('totalityProof', totalityProofExpr, true));
      reportFn?.(totalityProofExpr, this.totalityProof);
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const casesResult: ObjectContents_Case[] = [];
    for (const item of this.cases) {
      const newItem: ObjectContents_Case = Object.create(ObjectContents_Case.prototype) as ObjectContents_Case;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      casesResult.push(newItem);
    }
    let totalityProofResult: ObjectContents_Proof | undefined = undefined;
    if (this.totalityProof) {
      totalityProofResult = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.totalityProof.substitute(fn, totalityProofResult, replacedParameters)) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_cases(casesResult, totalityProofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_cases)) {
      return false;
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        const leftItem = this.cases[i];
        const rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (!Fmt.areObjectsEquivalent(this.totalityProof, expression.totalityProof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_structuralCases extends Fmt.MetaRefExpression {
  constructor(public term: Fmt.Expression, public construction: Fmt.Expression, public cases: ObjectContents_StructuralCase[]) {
    super();
  }

  getName(): string {
    return 'structuralCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    const casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (const item of casesRaw.items) {
        const newItem = ObjectContents_StructuralCase.createFromExpression(item, reportFn);
        this.cases.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    argumentList.push(new Fmt.Argument(undefined, this.construction, false));
    const casesExprItems: Fmt.Expression[] = [];
    for (const item of this.cases) {
      const newItem = item.toExpression(true, reportFn);
      casesExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const casesExpr = new Fmt.ArrayExpression(casesExprItems);
    argumentList.push(new Fmt.Argument(undefined, casesExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    const constructionResult = this.construction.substitute(fn, replacedParameters);
    if (constructionResult !== this.construction) {
      changed = true;
    }
    const casesResult: ObjectContents_StructuralCase[] = [];
    for (const item of this.cases) {
      const newItem: ObjectContents_StructuralCase = Object.create(ObjectContents_StructuralCase.prototype) as ObjectContents_StructuralCase;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      casesResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_structuralCases(termResult, constructionResult, casesResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_structuralCases)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.construction, expression.construction, fn, replacedParameters)) {
      return false;
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        const leftItem = this.cases[i];
        const rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_asElementOf extends Fmt.MetaRefExpression {
  constructor(public term: Fmt.Expression, public _set: Fmt.Expression, public proof?: ObjectContents_Proof) {
    super();
  }

  getName(): string {
    return 'asElementOf';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this._set = argumentList.getValue('set', 1);
    const proofRaw = argumentList.getOptionalValue('proof', 2);
    if (proofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    argumentList.push(new Fmt.Argument(undefined, this._set, false));
    if (this.proof !== undefined) {
      const proofExpr = this.proof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('proof', proofExpr, true));
      reportFn?.(proofExpr, this.proof);
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    const _setResult = this._set.substitute(fn, replacedParameters);
    if (_setResult !== this._set) {
      changed = true;
    }
    let proofResult: ObjectContents_Proof | undefined = undefined;
    if (this.proof) {
      proofResult = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.proof.substitute(fn, proofResult, replacedParameters)) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_asElementOf(termResult, _setResult, proofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_asElementOf)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this._set, expression._set, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_associative extends Fmt.MetaRefExpression {
  constructor(public term: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'associative';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_associative(termResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_associative)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_not extends Fmt.MetaRefExpression {
  constructor(public formula: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'not';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.formula, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const formulaResult = this.formula.substitute(fn, replacedParameters);
    if (formulaResult !== this.formula) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_not(formulaResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_not)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, expression.formula, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_and extends Fmt.MetaRefExpression {
  formulas?: Fmt.Expression[];

  constructor(...formulas: Fmt.Expression[]) {
    super();
    if (formulas.length) {
      this.formulas = formulas;
    }
  }

  getName(): string {
    return 'and';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    if (this.formulas) {
      this.formulas = undefined;
    }
    let index = 0;
    for (;;) {
      const formulasRaw = argumentList.getOptionalValue(undefined, index);
      if (formulasRaw === undefined) {
        break;
      }
      if (!this.formulas) {
        this.formulas = [];
      }
      this.formulas.push(formulasRaw);
      index++;
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.formulas !== undefined) {
      for (const formulasArg of this.formulas) {
        argumentList.push(new Fmt.Argument(undefined, formulasArg, true));
      }
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const formulasResult: Fmt.Expression[] = [];
    if (this.formulas) {
      for (const item of this.formulas) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        formulasResult.push(newItem);
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_and(...formulasResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_and)) {
      return false;
    }
    if (this.formulas || expression.formulas) {
      if (!this.formulas || !expression.formulas || this.formulas.length !== expression.formulas.length) {
        return false;
      }
      for (let i = 0; i < this.formulas.length; i++) {
        const leftItem = this.formulas[i];
        const rightItem = expression.formulas[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_or extends Fmt.MetaRefExpression {
  formulas?: Fmt.Expression[];

  constructor(...formulas: Fmt.Expression[]) {
    super();
    if (formulas.length) {
      this.formulas = formulas;
    }
  }

  getName(): string {
    return 'or';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    if (this.formulas) {
      this.formulas = undefined;
    }
    let index = 0;
    for (;;) {
      const formulasRaw = argumentList.getOptionalValue(undefined, index);
      if (formulasRaw === undefined) {
        break;
      }
      if (!this.formulas) {
        this.formulas = [];
      }
      this.formulas.push(formulasRaw);
      index++;
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.formulas !== undefined) {
      for (const formulasArg of this.formulas) {
        argumentList.push(new Fmt.Argument(undefined, formulasArg, true));
      }
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const formulasResult: Fmt.Expression[] = [];
    if (this.formulas) {
      for (const item of this.formulas) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        formulasResult.push(newItem);
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_or(...formulasResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_or)) {
      return false;
    }
    if (this.formulas || expression.formulas) {
      if (!this.formulas || !expression.formulas || this.formulas.length !== expression.formulas.length) {
        return false;
      }
      for (let i = 0; i < this.formulas.length; i++) {
        const leftItem = this.formulas[i];
        const rightItem = expression.formulas[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_equiv extends Fmt.MetaRefExpression {
  formulas: Fmt.Expression[];

  constructor(...formulas: Fmt.Expression[]) {
    super();
    this.formulas = formulas;
  }

  getName(): string {
    return 'equiv';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formulas = [];
    let index = 0;
    for (;;) {
      const formulasRaw = argumentList.getOptionalValue(undefined, index);
      if (formulasRaw === undefined) {
        break;
      }
      this.formulas.push(formulasRaw);
      index++;
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    for (const formulasArg of this.formulas) {
      argumentList.push(new Fmt.Argument(undefined, formulasArg, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const formulasResult: Fmt.Expression[] = [];
    for (const item of this.formulas) {
      const newItem = item.substitute(fn, replacedParameters);
      if (newItem !== item) {
        changed = true;
      }
      formulasResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_equiv(...formulasResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_equiv)) {
      return false;
    }
    if (this.formulas || expression.formulas) {
      if (!this.formulas || !expression.formulas || this.formulas.length !== expression.formulas.length) {
        return false;
      }
      for (let i = 0; i < this.formulas.length; i++) {
        const leftItem = this.formulas[i];
        const rightItem = expression.formulas[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_forall extends Fmt.MetaRefExpression {
  constructor(public parameters: Fmt.ParameterList, public formula: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'forall';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getValue('formula', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parametersExpr = new Fmt.ParameterExpression(this.parameters);
    argumentList.push(new Fmt.Argument(undefined, parametersExpr, false));
    argumentList.push(new Fmt.Argument(undefined, this.formula, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const parametersResult = this.parameters.substitute(fn, replacedParameters);
    if (parametersResult !== this.parameters) {
      changed = true;
    }
    const formulaResult = this.formula.substitute(fn, replacedParameters);
    if (formulaResult !== this.formula) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_forall(parametersResult, formulaResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_forall)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameters, expression.parameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, expression.formula, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_exists extends Fmt.MetaRefExpression {
  constructor(public parameters: Fmt.ParameterList, public formula?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'exists';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getOptionalValue('formula', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parametersExpr = new Fmt.ParameterExpression(this.parameters);
    argumentList.push(new Fmt.Argument(undefined, parametersExpr, false));
    if (this.formula !== undefined) {
      argumentList.push(new Fmt.Argument('formula', this.formula, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const parametersResult = this.parameters.substitute(fn, replacedParameters);
    if (parametersResult !== this.parameters) {
      changed = true;
    }
    let formulaResult: Fmt.Expression | undefined = undefined;
    if (this.formula) {
      formulaResult = this.formula.substitute(fn, replacedParameters);
      if (formulaResult !== this.formula) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_exists(parametersResult, formulaResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_exists)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameters, expression.parameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, expression.formula, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_existsUnique extends Fmt.MetaRefExpression {
  constructor(public parameters: Fmt.ParameterList, public formula?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'existsUnique';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getOptionalValue('formula', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parametersExpr = new Fmt.ParameterExpression(this.parameters);
    argumentList.push(new Fmt.Argument(undefined, parametersExpr, false));
    if (this.formula !== undefined) {
      argumentList.push(new Fmt.Argument('formula', this.formula, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const parametersResult = this.parameters.substitute(fn, replacedParameters);
    if (parametersResult !== this.parameters) {
      changed = true;
    }
    let formulaResult: Fmt.Expression | undefined = undefined;
    if (this.formula) {
      formulaResult = this.formula.substitute(fn, replacedParameters);
      if (formulaResult !== this.formula) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_existsUnique(parametersResult, formulaResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_existsUnique)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameters, expression.parameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, expression.formula, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_in extends Fmt.MetaRefExpression {
  constructor(public element: Fmt.Expression, public _set: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'in';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.element = argumentList.getValue('element', 0);
    this._set = argumentList.getValue('set', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.element, false));
    argumentList.push(new Fmt.Argument(undefined, this._set, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const elementResult = this.element.substitute(fn, replacedParameters);
    if (elementResult !== this.element) {
      changed = true;
    }
    const _setResult = this._set.substitute(fn, replacedParameters);
    if (_setResult !== this._set) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_in(elementResult, _setResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_in)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.element, expression.element, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this._set, expression._set, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_sub extends Fmt.MetaRefExpression {
  constructor(public subset: Fmt.Expression, public superset: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'sub';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.subset = argumentList.getValue('subset', 0);
    this.superset = argumentList.getValue('superset', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.subset, false));
    argumentList.push(new Fmt.Argument(undefined, this.superset, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const subsetResult = this.subset.substitute(fn, replacedParameters);
    if (subsetResult !== this.subset) {
      changed = true;
    }
    const supersetResult = this.superset.substitute(fn, replacedParameters);
    if (supersetResult !== this.superset) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_sub(subsetResult, supersetResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_sub)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.subset, expression.subset, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.superset, expression.superset, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_setEquals extends Fmt.MetaRefExpression {
  terms: Fmt.Expression[];

  constructor(...terms: Fmt.Expression[]) {
    super();
    this.terms = terms;
  }

  getName(): string {
    return 'setEquals';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.terms = [];
    let index = 0;
    for (;;) {
      const termsRaw = argumentList.getOptionalValue(undefined, index);
      if (termsRaw === undefined) {
        break;
      }
      this.terms.push(termsRaw);
      index++;
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    for (const termsArg of this.terms) {
      argumentList.push(new Fmt.Argument(undefined, termsArg, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termsResult: Fmt.Expression[] = [];
    for (const item of this.terms) {
      const newItem = item.substitute(fn, replacedParameters);
      if (newItem !== item) {
        changed = true;
      }
      termsResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_setEquals(...termsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_setEquals)) {
      return false;
    }
    if (this.terms || expression.terms) {
      if (!this.terms || !expression.terms || this.terms.length !== expression.terms.length) {
        return false;
      }
      for (let i = 0; i < this.terms.length; i++) {
        const leftItem = this.terms[i];
        const rightItem = expression.terms[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_equals extends Fmt.MetaRefExpression {
  terms: Fmt.Expression[];

  constructor(...terms: Fmt.Expression[]) {
    super();
    this.terms = terms;
  }

  getName(): string {
    return 'equals';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.terms = [];
    let index = 0;
    for (;;) {
      const termsRaw = argumentList.getOptionalValue(undefined, index);
      if (termsRaw === undefined) {
        break;
      }
      this.terms.push(termsRaw);
      index++;
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    for (const termsArg of this.terms) {
      argumentList.push(new Fmt.Argument(undefined, termsArg, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termsResult: Fmt.Expression[] = [];
    for (const item of this.terms) {
      const newItem = item.substitute(fn, replacedParameters);
      if (newItem !== item) {
        changed = true;
      }
      termsResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_equals(...termsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_equals)) {
      return false;
    }
    if (this.terms || expression.terms) {
      if (!this.terms || !expression.terms || this.terms.length !== expression.terms.length) {
        return false;
      }
      for (let i = 0; i < this.terms.length; i++) {
        const leftItem = this.terms[i];
        const rightItem = expression.terms[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_structural extends Fmt.MetaRefExpression {
  constructor(public term: Fmt.Expression, public construction: Fmt.Expression, public cases: ObjectContents_StructuralCase[]) {
    super();
  }

  getName(): string {
    return 'structural';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    const casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (const item of casesRaw.items) {
        const newItem = ObjectContents_StructuralCase.createFromExpression(item, reportFn);
        this.cases.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    argumentList.push(new Fmt.Argument(undefined, this.construction, false));
    const casesExprItems: Fmt.Expression[] = [];
    for (const item of this.cases) {
      const newItem = item.toExpression(true, reportFn);
      casesExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const casesExpr = new Fmt.ArrayExpression(casesExprItems);
    argumentList.push(new Fmt.Argument(undefined, casesExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    const constructionResult = this.construction.substitute(fn, replacedParameters);
    if (constructionResult !== this.construction) {
      changed = true;
    }
    const casesResult: ObjectContents_StructuralCase[] = [];
    for (const item of this.cases) {
      const newItem: ObjectContents_StructuralCase = Object.create(ObjectContents_StructuralCase.prototype) as ObjectContents_StructuralCase;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      casesResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_structural(termResult, constructionResult, casesResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_structural)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.construction, expression.construction, fn, replacedParameters)) {
      return false;
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        const leftItem = this.cases[i];
        const rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class ObjectContents_Proof extends Fmt.ObjectContents {
  constructor(public _from: BigInt | undefined, public _to: BigInt | undefined, public parameters: Fmt.ParameterList | undefined, public goal: Fmt.Expression | undefined, public steps: Fmt.ParameterList) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Proof {
    const result: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const fromRaw = argumentList.getOptionalValue('from', 0);
    if (fromRaw !== undefined) {
      if (fromRaw instanceof Fmt.IntegerExpression) {
        this._from = fromRaw.value;
      } else {
        throw new Error('from: Integer expected');
      }
    }
    const toRaw = argumentList.getOptionalValue('to', 1);
    if (toRaw !== undefined) {
      if (toRaw instanceof Fmt.IntegerExpression) {
        this._to = toRaw.value;
      } else {
        throw new Error('to: Integer expected');
      }
    }
    const parametersRaw = argumentList.getOptionalValue('parameters', 2);
    if (parametersRaw !== undefined) {
      if (parametersRaw instanceof Fmt.ParameterExpression) {
        this.parameters = parametersRaw.parameters;
      } else {
        throw new Error('parameters: Parameter expression expected');
      }
    }
    this.goal = argumentList.getOptionalValue('goal', 3);
    const stepsRaw = argumentList.getValue('steps', 4);
    if (stepsRaw instanceof Fmt.ParameterExpression) {
      this.steps = stepsRaw.parameters;
    } else {
      throw new Error('steps: Parameter expression expected');
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this._from !== undefined) {
      const fromExpr = new Fmt.IntegerExpression(this._from);
      argumentList.push(new Fmt.Argument('from', fromExpr, true));
    }
    if (this._to !== undefined) {
      const toExpr = new Fmt.IntegerExpression(this._to);
      argumentList.push(new Fmt.Argument('to', toExpr, true));
    }
    if (this.parameters !== undefined) {
      const parametersExpr = new Fmt.ParameterExpression(this.parameters);
      argumentList.push(new Fmt.Argument('parameters', parametersExpr, true));
    }
    if (this.goal !== undefined) {
      argumentList.push(new Fmt.Argument('goal', this.goal, true));
    }
    const stepsExpr = new Fmt.ParameterExpression(this.steps);
    argumentList.push(new Fmt.Argument('steps', stepsExpr, false));
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Proof {
    const result: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Proof {
    const result: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.parameters) {
      this.parameters.traverse(fn);
    }
    if (this.goal) {
      this.goal.traverse(fn);
    }
    if (this.steps) {
      this.steps.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Proof, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    result._from = this._from;
    result._to = this._to;
    if (this.parameters) {
      result.parameters = this.parameters.substitute(fn, replacedParameters);
      if (result.parameters !== this.parameters) {
        changed = true;
      }
    }
    if (this.goal) {
      result.goal = this.goal.substitute(fn, replacedParameters);
      if (result.goal !== this.goal) {
        changed = true;
      }
    }
    if (this.steps) {
      result.steps = this.steps.substitute(fn, replacedParameters);
      if (result.steps !== this.steps) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Proof, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this._from !== objectContents._from) {
      return false;
    }
    if (this._to !== objectContents._to) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameters, objectContents.parameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.goal, objectContents.goal, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.steps, objectContents.steps, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Consider extends Fmt.MetaRefExpression {
  constructor(public variable: Fmt.Expression, public result?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Consider';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.variable = argumentList.getValue('variable', 0);
    this.result = argumentList.getOptionalValue('result', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.variable, false));
    if (this.result !== undefined) {
      argumentList.push(new Fmt.Argument('result', this.result, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const variableResult = this.variable.substitute(fn, replacedParameters);
    if (variableResult !== this.variable) {
      changed = true;
    }
    let resultResult: Fmt.Expression | undefined = undefined;
    if (this.result) {
      resultResult = this.result.substitute(fn, replacedParameters);
      if (resultResult !== this.result) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Consider(variableResult, resultResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Consider)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.variable, expression.variable, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_State extends Fmt.MetaRefExpression {
  constructor(public statement: Fmt.Expression, public proof?: ObjectContents_Proof) {
    super();
  }

  getName(): string {
    return 'State';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.statement = argumentList.getValue('statement', 0);
    const proofRaw = argumentList.getOptionalValue('proof', 1);
    if (proofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.statement, false));
    if (this.proof !== undefined) {
      const proofExpr = this.proof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('proof', proofExpr, true));
      reportFn?.(proofExpr, this.proof);
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const statementResult = this.statement.substitute(fn, replacedParameters);
    if (statementResult !== this.statement) {
      changed = true;
    }
    let proofResult: ObjectContents_Proof | undefined = undefined;
    if (this.proof) {
      proofResult = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.proof.substitute(fn, proofResult, replacedParameters)) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_State(statementResult, proofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_State)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.statement, expression.statement, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UseDef extends Fmt.MetaRefExpression {
  constructor(public side?: BigInt, public result?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'UseDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    this.result = argumentList.getOptionalValue('result', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.side !== undefined) {
      const sideExpr = new Fmt.IntegerExpression(this.side);
      argumentList.push(new Fmt.Argument('side', sideExpr, true));
    }
    if (this.result !== undefined) {
      argumentList.push(new Fmt.Argument('result', this.result, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let resultResult: Fmt.Expression | undefined = undefined;
    if (this.result) {
      resultResult = this.result.substitute(fn, replacedParameters);
      if (resultResult !== this.result) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_UseDef(this.side, resultResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseDef)) {
      return false;
    }
    if (this.side !== expression.side) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UseCases extends Fmt.MetaRefExpression {
  constructor(public side: BigInt | undefined, public caseProofs: ObjectContents_Proof[]) {
    super();
  }

  getName(): string {
    return 'UseCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    const caseProofsRaw = argumentList.getValue('caseProofs', 1);
    if (caseProofsRaw instanceof Fmt.ArrayExpression) {
      this.caseProofs = [];
      for (const item of caseProofsRaw.items) {
        const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
        this.caseProofs.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('caseProofs: Array expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.side !== undefined) {
      const sideExpr = new Fmt.IntegerExpression(this.side);
      argumentList.push(new Fmt.Argument('side', sideExpr, true));
    }
    const caseProofsExprItems: Fmt.Expression[] = [];
    for (const item of this.caseProofs) {
      const newItem = item.toExpression(true, reportFn);
      caseProofsExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const caseProofsExpr = new Fmt.ArrayExpression(caseProofsExprItems);
    argumentList.push(new Fmt.Argument('caseProofs', caseProofsExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const caseProofsResult: ObjectContents_Proof[] = [];
    for (const item of this.caseProofs) {
      const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      caseProofsResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_UseCases(this.side, caseProofsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseCases)) {
      return false;
    }
    if (this.side !== expression.side) {
      return false;
    }
    if (this.caseProofs || expression.caseProofs) {
      if (!this.caseProofs || !expression.caseProofs || this.caseProofs.length !== expression.caseProofs.length) {
        return false;
      }
      for (let i = 0; i < this.caseProofs.length; i++) {
        const leftItem = this.caseProofs[i];
        const rightItem = expression.caseProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_UseForAll extends Fmt.MetaRefExpression {
  arguments: Fmt.ArgumentList;

  constructor(args: Fmt.ArgumentList) {
    super();
    this.arguments = args;
  }

  getName(): string {
    return 'UseForAll';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const argumentsRaw = argumentList.getValue('arguments', 0);
    if (argumentsRaw instanceof Fmt.CompoundExpression) {
      this.arguments = argumentsRaw.arguments;
    } else {
      throw new Error('arguments: Compound expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const argumentsExpr = new Fmt.CompoundExpression(this.arguments);
    argumentList.push(new Fmt.Argument(undefined, argumentsExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const argumentsResult = this.arguments.substitute(fn, replacedParameters);
    if (argumentsResult !== this.arguments) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_UseForAll(argumentsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseForAll)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.arguments, expression.arguments, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UseExists extends Fmt.MetaRefExpression {
  constructor(public parameters: Fmt.ParameterList) {
    super();
  }

  getName(): string {
    return 'UseExists';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const parametersExpr = new Fmt.ParameterExpression(this.parameters);
    argumentList.push(new Fmt.Argument(undefined, parametersExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const parametersResult = this.parameters.substitute(fn, replacedParameters);
    if (parametersResult !== this.parameters) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_UseExists(parametersResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseExists)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameters, expression.parameters, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Substitute extends Fmt.MetaRefExpression {
  constructor(public source: Fmt.Expression, public sourceSide: BigInt, public result?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Substitute';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.source = argumentList.getValue('source', 0);
    const sourceSideRaw = argumentList.getValue('sourceSide', 1);
    if (sourceSideRaw instanceof Fmt.IntegerExpression) {
      this.sourceSide = sourceSideRaw.value;
    } else {
      throw new Error('sourceSide: Integer expected');
    }
    this.result = argumentList.getOptionalValue('result', 2);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.source, false));
    const sourceSideExpr = new Fmt.IntegerExpression(this.sourceSide);
    argumentList.push(new Fmt.Argument(undefined, sourceSideExpr, false));
    if (this.result !== undefined) {
      argumentList.push(new Fmt.Argument('result', this.result, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const sourceResult = this.source.substitute(fn, replacedParameters);
    if (sourceResult !== this.source) {
      changed = true;
    }
    let resultResult: Fmt.Expression | undefined = undefined;
    if (this.result) {
      resultResult = this.result.substitute(fn, replacedParameters);
      if (resultResult !== this.result) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Substitute(sourceResult, this.sourceSide, resultResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Substitute)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.source, expression.source, fn, replacedParameters)) {
      return false;
    }
    if (this.sourceSide !== expression.sourceSide) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Unfold extends Fmt.MetaRefExpression {
  constructor(public result?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'Unfold';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.result = argumentList.getOptionalValue('result', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.result !== undefined) {
      argumentList.push(new Fmt.Argument('result', this.result, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let resultResult: Fmt.Expression | undefined = undefined;
    if (this.result) {
      resultResult = this.result.substitute(fn, replacedParameters);
      if (resultResult !== this.result) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_Unfold(resultResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Unfold)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UseTheorem extends Fmt.MetaRefExpression {
  constructor(public theorem: Fmt.Expression, public input?: Fmt.Expression, public result?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'UseTheorem';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.theorem = argumentList.getValue('theorem', 0);
    this.input = argumentList.getOptionalValue('input', 1);
    this.result = argumentList.getOptionalValue('result', 2);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.theorem, false));
    if (this.input !== undefined) {
      argumentList.push(new Fmt.Argument('input', this.input, true));
    }
    if (this.result !== undefined) {
      argumentList.push(new Fmt.Argument('result', this.result, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const theoremResult = this.theorem.substitute(fn, replacedParameters);
    if (theoremResult !== this.theorem) {
      changed = true;
    }
    let inputResult: Fmt.Expression | undefined = undefined;
    if (this.input) {
      inputResult = this.input.substitute(fn, replacedParameters);
      if (inputResult !== this.input) {
        changed = true;
      }
    }
    let resultResult: Fmt.Expression | undefined = undefined;
    if (this.result) {
      resultResult = this.result.substitute(fn, replacedParameters);
      if (resultResult !== this.result) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_UseTheorem(theoremResult, inputResult, resultResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseTheorem)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.theorem, expression.theorem, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.input, expression.input, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UseImplicitOperator extends Fmt.MetaRefExpression {
  constructor(public operator: Fmt.Expression, public result?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'UseImplicitOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.operator = argumentList.getValue('operator', 0);
    this.result = argumentList.getOptionalValue('result', 1);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.operator, false));
    if (this.result !== undefined) {
      argumentList.push(new Fmt.Argument('result', this.result, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const operatorResult = this.operator.substitute(fn, replacedParameters);
    if (operatorResult !== this.operator) {
      changed = true;
    }
    let resultResult: Fmt.Expression | undefined = undefined;
    if (this.result) {
      resultResult = this.result.substitute(fn, replacedParameters);
      if (resultResult !== this.result) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_UseImplicitOperator(operatorResult, resultResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseImplicitOperator)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.operator, expression.operator, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveDef extends Fmt.MetaRefExpression {
  constructor(public side?: BigInt, public proof?: ObjectContents_Proof) {
    super();
  }

  getName(): string {
    return 'ProveDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    const proofRaw = argumentList.getOptionalValue('proof', 1);
    if (proofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.side !== undefined) {
      const sideExpr = new Fmt.IntegerExpression(this.side);
      argumentList.push(new Fmt.Argument('side', sideExpr, true));
    }
    if (this.proof !== undefined) {
      const proofExpr = this.proof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('proof', proofExpr, true));
      reportFn?.(proofExpr, this.proof);
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let proofResult: ObjectContents_Proof | undefined = undefined;
    if (this.proof) {
      proofResult = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.proof.substitute(fn, proofResult, replacedParameters)) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveDef(this.side, proofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveDef)) {
      return false;
    }
    if (this.side !== expression.side) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveByContradiction extends Fmt.MetaRefExpression {
  constructor(public proof: ObjectContents_Proof) {
    super();
  }

  getName(): string {
    return 'ProveByContradiction';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const proofRaw = argumentList.getValue('proof', 0);
    const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
    this.proof = newItem;
    reportFn?.(proofRaw, newItem);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const proofExpr = this.proof.toExpression(true, reportFn);
    argumentList.push(new Fmt.Argument(undefined, proofExpr, false));
    reportFn?.(proofExpr, this.proof);
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const proofResult: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
    if (this.proof.substitute(fn, proofResult, replacedParameters)) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveByContradiction(proofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveByContradiction)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveForAll extends Fmt.MetaRefExpression {
  constructor(public proof: ObjectContents_Proof) {
    super();
  }

  getName(): string {
    return 'ProveForAll';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const proofRaw = argumentList.getValue('proof', 0);
    const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
    this.proof = newItem;
    reportFn?.(proofRaw, newItem);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const proofExpr = this.proof.toExpression(true, reportFn);
    argumentList.push(new Fmt.Argument(undefined, proofExpr, false));
    reportFn?.(proofExpr, this.proof);
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const proofResult: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
    if (this.proof.substitute(fn, proofResult, replacedParameters)) {
      changed = true;
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveForAll(proofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveForAll)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveExists extends Fmt.MetaRefExpression {
  arguments: Fmt.ArgumentList;

  constructor(args: Fmt.ArgumentList, public proof?: ObjectContents_Proof) {
    super();
    this.arguments = args;
  }

  getName(): string {
    return 'ProveExists';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const argumentsRaw = argumentList.getValue('arguments', 0);
    if (argumentsRaw instanceof Fmt.CompoundExpression) {
      this.arguments = argumentsRaw.arguments;
    } else {
      throw new Error('arguments: Compound expression expected');
    }
    const proofRaw = argumentList.getOptionalValue('proof', 1);
    if (proofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const argumentsExpr = new Fmt.CompoundExpression(this.arguments);
    argumentList.push(new Fmt.Argument(undefined, argumentsExpr, false));
    if (this.proof !== undefined) {
      const proofExpr = this.proof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('proof', proofExpr, true));
      reportFn?.(proofExpr, this.proof);
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const argumentsResult = this.arguments.substitute(fn, replacedParameters);
    if (argumentsResult !== this.arguments) {
      changed = true;
    }
    let proofResult: ObjectContents_Proof | undefined = undefined;
    if (this.proof) {
      proofResult = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.proof.substitute(fn, proofResult, replacedParameters)) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveExists(argumentsResult, proofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveExists)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.arguments, expression.arguments, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveEquivalence extends Fmt.MetaRefExpression {
  constructor(public proofs: ObjectContents_Proof[]) {
    super();
  }

  getName(): string {
    return 'ProveEquivalence';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const proofsRaw = argumentList.getValue('proofs', 0);
    if (proofsRaw instanceof Fmt.ArrayExpression) {
      this.proofs = [];
      for (const item of proofsRaw.items) {
        const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
        this.proofs.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('proofs: Array expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const proofsExprItems: Fmt.Expression[] = [];
    for (const item of this.proofs) {
      const newItem = item.toExpression(true, reportFn);
      proofsExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const proofsExpr = new Fmt.ArrayExpression(proofsExprItems);
    argumentList.push(new Fmt.Argument(undefined, proofsExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const proofsResult: ObjectContents_Proof[] = [];
    for (const item of this.proofs) {
      const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      proofsResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveEquivalence(proofsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveEquivalence)) {
      return false;
    }
    if (this.proofs || expression.proofs) {
      if (!this.proofs || !expression.proofs || this.proofs.length !== expression.proofs.length) {
        return false;
      }
      for (let i = 0; i < this.proofs.length; i++) {
        const leftItem = this.proofs[i];
        const rightItem = expression.proofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveCases extends Fmt.MetaRefExpression {
  constructor(public side: BigInt | undefined, public caseProofs: ObjectContents_Proof[]) {
    super();
  }

  getName(): string {
    return 'ProveCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    const caseProofsRaw = argumentList.getValue('caseProofs', 1);
    if (caseProofsRaw instanceof Fmt.ArrayExpression) {
      this.caseProofs = [];
      for (const item of caseProofsRaw.items) {
        const newItem = ObjectContents_Proof.createFromExpression(item, reportFn);
        this.caseProofs.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('caseProofs: Array expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.side !== undefined) {
      const sideExpr = new Fmt.IntegerExpression(this.side);
      argumentList.push(new Fmt.Argument('side', sideExpr, true));
    }
    const caseProofsExprItems: Fmt.Expression[] = [];
    for (const item of this.caseProofs) {
      const newItem = item.toExpression(true, reportFn);
      caseProofsExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const caseProofsExpr = new Fmt.ArrayExpression(caseProofsExprItems);
    argumentList.push(new Fmt.Argument('caseProofs', caseProofsExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const caseProofsResult: ObjectContents_Proof[] = [];
    for (const item of this.caseProofs) {
      const newItem: ObjectContents_Proof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      caseProofsResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveCases(this.side, caseProofsResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveCases)) {
      return false;
    }
    if (this.side !== expression.side) {
      return false;
    }
    if (this.caseProofs || expression.caseProofs) {
      if (!this.caseProofs || !expression.caseProofs || this.caseProofs.length !== expression.caseProofs.length) {
        return false;
      }
      for (let i = 0; i < this.caseProofs.length; i++) {
        const leftItem = this.caseProofs[i];
        const rightItem = expression.caseProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveByInduction extends Fmt.MetaRefExpression {
  constructor(public term: Fmt.Expression, public construction: Fmt.Expression, public cases: ObjectContents_StructuralCase[]) {
    super();
  }

  getName(): string {
    return 'ProveByInduction';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    const casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (const item of casesRaw.items) {
        const newItem = ObjectContents_StructuralCase.createFromExpression(item, reportFn);
        this.cases.push(newItem);
        reportFn?.(item, newItem);
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.term, false));
    argumentList.push(new Fmt.Argument(undefined, this.construction, false));
    const casesExprItems: Fmt.Expression[] = [];
    for (const item of this.cases) {
      const newItem = item.toExpression(true, reportFn);
      casesExprItems.push(newItem);
      reportFn?.(newItem, item);
    }
    const casesExpr = new Fmt.ArrayExpression(casesExprItems);
    argumentList.push(new Fmt.Argument(undefined, casesExpr, false));
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const termResult = this.term.substitute(fn, replacedParameters);
    if (termResult !== this.term) {
      changed = true;
    }
    const constructionResult = this.construction.substitute(fn, replacedParameters);
    if (constructionResult !== this.construction) {
      changed = true;
    }
    const casesResult: ObjectContents_StructuralCase[] = [];
    for (const item of this.cases) {
      const newItem: ObjectContents_StructuralCase = Object.create(ObjectContents_StructuralCase.prototype) as ObjectContents_StructuralCase;
      if (item.substitute(fn, newItem, replacedParameters)) {
        changed = true;
      }
      casesResult.push(newItem);
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveByInduction(termResult, constructionResult, casesResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveByInduction)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.term, expression.term, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.construction, expression.construction, fn, replacedParameters)) {
      return false;
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        const leftItem = this.cases[i];
        const rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveBySubstitution extends Fmt.MetaRefExpression {
  constructor(public source: Fmt.Expression, public sourceSide: BigInt, public goal: Fmt.Expression, public proof?: ObjectContents_Proof) {
    super();
  }

  getName(): string {
    return 'ProveBySubstitution';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.source = argumentList.getValue('source', 0);
    const sourceSideRaw = argumentList.getValue('sourceSide', 1);
    if (sourceSideRaw instanceof Fmt.IntegerExpression) {
      this.sourceSide = sourceSideRaw.value;
    } else {
      throw new Error('sourceSide: Integer expected');
    }
    this.goal = argumentList.getValue('goal', 2);
    const proofRaw = argumentList.getOptionalValue('proof', 3);
    if (proofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    }
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(undefined, this.source, false));
    const sourceSideExpr = new Fmt.IntegerExpression(this.sourceSide);
    argumentList.push(new Fmt.Argument(undefined, sourceSideExpr, false));
    argumentList.push(new Fmt.Argument(undefined, this.goal, false));
    if (this.proof !== undefined) {
      const proofExpr = this.proof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('proof', proofExpr, true));
      reportFn?.(proofExpr, this.proof);
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    const sourceResult = this.source.substitute(fn, replacedParameters);
    if (sourceResult !== this.source) {
      changed = true;
    }
    const goalResult = this.goal.substitute(fn, replacedParameters);
    if (goalResult !== this.goal) {
      changed = true;
    }
    let proofResult: ObjectContents_Proof | undefined = undefined;
    if (this.proof) {
      proofResult = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.proof.substitute(fn, proofResult, replacedParameters)) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ProveBySubstitution(sourceResult, this.sourceSide, goalResult, proofResult);
    return fn ? fn(result) : result;
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveBySubstitution)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.source, expression.source, fn, replacedParameters)) {
      return false;
    }
    if (this.sourceSide !== expression.sourceSide) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.goal, expression.goal, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_Case extends Fmt.ObjectContents {
  constructor(public formula: Fmt.Expression, public value: Fmt.Expression, public exclusivityProof?: ObjectContents_Proof) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_Case {
    const result: ObjectContents_Case = Object.create(ObjectContents_Case.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
    this.value = argumentList.getValue('value', 1);
    const exclusivityProofRaw = argumentList.getOptionalValue('exclusivityProof', 2);
    if (exclusivityProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(exclusivityProofRaw, reportFn);
      this.exclusivityProof = newItem;
      reportFn?.(exclusivityProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(outputAllNames ? 'formula' : undefined, this.formula, false));
    argumentList.push(new Fmt.Argument(outputAllNames ? 'value' : undefined, this.value, false));
    if (this.exclusivityProof !== undefined) {
      const exclusivityProofExpr = this.exclusivityProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('exclusivityProof', exclusivityProofExpr, true));
      reportFn?.(exclusivityProofExpr, this.exclusivityProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_Case {
    const result: ObjectContents_Case = Object.create(ObjectContents_Case.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Case {
    const result: ObjectContents_Case = Object.create(ObjectContents_Case.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.formula) {
      this.formula.traverse(fn);
    }
    if (this.value) {
      this.value.traverse(fn);
    }
    if (this.exclusivityProof) {
      this.exclusivityProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Case, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    if (this.value) {
      result.value = this.value.substitute(fn, replacedParameters);
      if (result.value !== this.value) {
        changed = true;
      }
    }
    if (this.exclusivityProof) {
      result.exclusivityProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.exclusivityProof.substitute(fn, result.exclusivityProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Case, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.formula, objectContents.formula, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.value, objectContents.value, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.exclusivityProof, objectContents.exclusivityProof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class ObjectContents_StructuralCase extends Fmt.ObjectContents {
  constructor(public _constructor: Fmt.Expression, public parameters: Fmt.ParameterList | undefined, public value: Fmt.Expression, public rewrite?: Fmt.Expression, public wellDefinednessProof?: ObjectContents_Proof) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_StructuralCase {
    const result: ObjectContents_StructuralCase = Object.create(ObjectContents_StructuralCase.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._constructor = argumentList.getValue('constructor', 0);
    const parametersRaw = argumentList.getOptionalValue('parameters', 1);
    if (parametersRaw !== undefined) {
      if (parametersRaw instanceof Fmt.ParameterExpression) {
        this.parameters = parametersRaw.parameters;
      } else {
        throw new Error('parameters: Parameter expression expected');
      }
    }
    this.value = argumentList.getValue('value', 2);
    this.rewrite = argumentList.getOptionalValue('rewrite', 3);
    const wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 4);
    if (wellDefinednessProofRaw !== undefined) {
      const newItem = ObjectContents_Proof.createFromExpression(wellDefinednessProofRaw, reportFn);
      this.wellDefinednessProof = newItem;
      reportFn?.(wellDefinednessProofRaw, newItem);
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    argumentList.push(new Fmt.Argument(outputAllNames ? 'constructor' : undefined, this._constructor, false));
    if (this.parameters !== undefined) {
      const parametersExpr = new Fmt.ParameterExpression(this.parameters);
      argumentList.push(new Fmt.Argument('parameters', parametersExpr, true));
    }
    argumentList.push(new Fmt.Argument('value', this.value, false));
    if (this.rewrite !== undefined) {
      argumentList.push(new Fmt.Argument('rewrite', this.rewrite, true));
    }
    if (this.wellDefinednessProof !== undefined) {
      const wellDefinednessProofExpr = this.wellDefinednessProof.toExpression(true, reportFn);
      argumentList.push(new Fmt.Argument('wellDefinednessProof', wellDefinednessProofExpr, true));
      reportFn?.(wellDefinednessProofExpr, this.wellDefinednessProof);
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_StructuralCase {
    const result: ObjectContents_StructuralCase = Object.create(ObjectContents_StructuralCase.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_StructuralCase {
    const result: ObjectContents_StructuralCase = Object.create(ObjectContents_StructuralCase.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this._constructor) {
      this._constructor.traverse(fn);
    }
    if (this.parameters) {
      this.parameters.traverse(fn);
    }
    if (this.value) {
      this.value.traverse(fn);
    }
    if (this.rewrite) {
      this.rewrite.traverse(fn);
    }
    if (this.wellDefinednessProof) {
      this.wellDefinednessProof.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_StructuralCase, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this._constructor) {
      result._constructor = this._constructor.substitute(fn, replacedParameters);
      if (result._constructor !== this._constructor) {
        changed = true;
      }
    }
    if (this.parameters) {
      result.parameters = this.parameters.substitute(fn, replacedParameters);
      if (result.parameters !== this.parameters) {
        changed = true;
      }
    }
    if (this.value) {
      result.value = this.value.substitute(fn, replacedParameters);
      if (result.value !== this.value) {
        changed = true;
      }
    }
    if (this.rewrite) {
      result.rewrite = this.rewrite.substitute(fn, replacedParameters);
      if (result.rewrite !== this.rewrite) {
        changed = true;
      }
    }
    if (this.wellDefinednessProof) {
      result.wellDefinednessProof = Object.create(ObjectContents_Proof.prototype) as ObjectContents_Proof;
      if (this.wellDefinednessProof.substitute(fn, result.wellDefinednessProof, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_StructuralCase, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this._constructor, objectContents._constructor, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.parameters, objectContents.parameters, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.value, objectContents.value, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.rewrite, objectContents.rewrite, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.wellDefinednessProof, objectContents.wellDefinednessProof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

class DefinitionContentsContext extends Ctx.DerivedContext {
  constructor(public definition: Fmt.Definition, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

class ParameterTypeContext extends Ctx.DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

class ArgumentTypeContext extends Ctx.DerivedContext {
  constructor(public objectContentsClass: Function, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

const definitionTypes: Fmt.MetaDefinitionList = {'Construction': MetaRefExpression_Construction, 'SetOperator': MetaRefExpression_SetOperator, 'ExplicitOperator': MetaRefExpression_ExplicitOperator, 'ImplicitOperator': MetaRefExpression_ImplicitOperator, 'MacroOperator': MetaRefExpression_MacroOperator, 'Predicate': MetaRefExpression_Predicate, 'StandardTheorem': MetaRefExpression_StandardTheorem, 'EquivalenceTheorem': MetaRefExpression_EquivalenceTheorem};
const expressionTypes: Fmt.MetaDefinitionList = {'Bool': MetaRefExpression_Bool, 'Nat': MetaRefExpression_Nat, 'Prop': MetaRefExpression_Prop, 'Set': MetaRefExpression_Set, 'Subset': MetaRefExpression_Subset, 'Element': MetaRefExpression_Element, 'Constraint': MetaRefExpression_Constraint, 'Binder': MetaRefExpression_Binder, 'SetDef': MetaRefExpression_SetDef, 'Def': MetaRefExpression_Def, 'Consider': MetaRefExpression_Consider, 'State': MetaRefExpression_State, 'UseDef': MetaRefExpression_UseDef, 'UseCases': MetaRefExpression_UseCases, 'UseForAll': MetaRefExpression_UseForAll, 'UseExists': MetaRefExpression_UseExists, 'Substitute': MetaRefExpression_Substitute, 'Unfold': MetaRefExpression_Unfold, 'UseTheorem': MetaRefExpression_UseTheorem, 'UseImplicitOperator': MetaRefExpression_UseImplicitOperator, 'ProveDef': MetaRefExpression_ProveDef, 'ProveByContradiction': MetaRefExpression_ProveByContradiction, 'ProveForAll': MetaRefExpression_ProveForAll, 'ProveExists': MetaRefExpression_ProveExists, 'ProveEquivalence': MetaRefExpression_ProveEquivalence, 'ProveCases': MetaRefExpression_ProveCases, 'ProveByInduction': MetaRefExpression_ProveByInduction, 'ProveBySubstitution': MetaRefExpression_ProveBySubstitution};
const functions: Fmt.MetaDefinitionList = {'true': MetaRefExpression_true, 'false': MetaRefExpression_false, 'enumeration': MetaRefExpression_enumeration, 'subset': MetaRefExpression_subset, 'extendedSubset': MetaRefExpression_extendedSubset, 'setStructuralCases': MetaRefExpression_setStructuralCases, 'setAssociative': MetaRefExpression_setAssociative, 'cases': MetaRefExpression_cases, 'structuralCases': MetaRefExpression_structuralCases, 'asElementOf': MetaRefExpression_asElementOf, 'associative': MetaRefExpression_associative, 'not': MetaRefExpression_not, 'and': MetaRefExpression_and, 'or': MetaRefExpression_or, 'equiv': MetaRefExpression_equiv, 'forall': MetaRefExpression_forall, 'exists': MetaRefExpression_exists, 'existsUnique': MetaRefExpression_existsUnique, 'in': MetaRefExpression_in, 'sub': MetaRefExpression_sub, 'setEquals': MetaRefExpression_setEquals, 'equals': MetaRefExpression_equals, 'structural': MetaRefExpression_structural, 'State': MetaRefExpression_State, 'UseTheorem': MetaRefExpression_UseTheorem, 'UseImplicitOperator': MetaRefExpression_UseImplicitOperator, '': null};

export class MetaModel extends Meta.MetaModel {
  constructor() {
    super('hlm',
          new Fmt.StandardMetaDefinitionFactory(definitionTypes),
          new Fmt.StandardMetaDefinitionFactory(expressionTypes),
          new Fmt.StandardMetaDefinitionFactory(functions));
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Ctx.Context): Ctx.Context {
    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Ctx.Context): Ctx.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Ctx.Context): Ctx.Context {
    const parent = previousContext.parentObject;
    if (parent instanceof Fmt.Definition) {
      const type = parent.type;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_Construction
            || type instanceof MetaRefExpression_SetOperator
            || type instanceof MetaRefExpression_ExplicitOperator
            || type instanceof MetaRefExpression_ImplicitOperator
            || type instanceof MetaRefExpression_MacroOperator
            || type instanceof MetaRefExpression_Predicate
            || type instanceof MetaRefExpression_StandardTheorem
            || type instanceof MetaRefExpression_EquivalenceTheorem) {
          return previousContext;
        }
      }
    }
    if (parent instanceof Fmt.CompoundExpression) {
      for (let currentContext = previousContext; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {
        if (currentContext instanceof ArgumentTypeContext) {
          return previousContext;
        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    if (parent instanceof Fmt.MetaRefExpression) {
      return previousContext;
    }
    return super.getNextArgumentContext(argument, argumentIndex, previousContext);
  }

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Ctx.Context): Ctx.Context {
    let context = parentContext;
    const parent = context.parentObject;
    if (parent instanceof Fmt.Definition) {
      const type = parent.type;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_Construction) {
          if (argument.name === 'notation' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'abbreviations' || (argument.name === undefined && argumentIndex === 2)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definitionNotation' || (argument.name === undefined && argumentIndex === 3)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'embedding' || (argument.name === undefined && argumentIndex === 4)) {
            context = new ArgumentTypeContext(ObjectContents_Embedding, context);
          }
          if (argument.name === 'rewrite' || (argument.name === undefined && argumentIndex === 5)) {
            context = new ArgumentTypeContext(ObjectContents_ConstructionRewriteDefinition, context);
          }
        }
        if (type instanceof MetaRefExpression_Constructor) {
          if (argument.name === 'notation' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'abbreviations' || (argument.name === undefined && argumentIndex === 2)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definitionNotation' || (argument.name === undefined && argumentIndex === 3)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'equalityDefinition' || (argument.name === undefined && argumentIndex === 4)) {
            for (; context instanceof Ctx.DerivedContext; context = context.parentContext) {
              if (context instanceof DefinitionContentsContext && context.definition.type instanceof MetaRefExpression_Construction) {
                break;
              }
              if (context instanceof ArgumentTypeContext && context.objectContentsClass === ObjectContents_Construction) {
                break;
              }
            }
            context = new ArgumentTypeContext(ObjectContents_ConstructorEqualityDefinition, context);
          }
          if (argument.name === 'rewrite' || (argument.name === undefined && argumentIndex === 5)) {
            context = new ArgumentTypeContext(ObjectContents_ConstructorRewriteDefinition, context);
          }
        }
        if (type instanceof MetaRefExpression_SetOperator) {
          if (argument.name === 'notation' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'abbreviations' || (argument.name === undefined && argumentIndex === 2)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definitionNotation' || (argument.name === undefined && argumentIndex === 3)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'equalityProofs' || (argument.name === undefined && argumentIndex === 5)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
          if (argument.name === 'setRestrictionProof' || (argument.name === undefined && argumentIndex === 7)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_ExplicitOperator) {
          if (argument.name === 'notation' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'abbreviations' || (argument.name === undefined && argumentIndex === 2)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definitionNotation' || (argument.name === undefined && argumentIndex === 3)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'equalityProofs' || (argument.name === undefined && argumentIndex === 5)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
          if (argument.name === 'setRestrictionProof' || (argument.name === undefined && argumentIndex === 7)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_ImplicitOperator) {
          if (argument.name === 'notation' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'abbreviations' || (argument.name === undefined && argumentIndex === 2)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definitionNotation' || (argument.name === undefined && argumentIndex === 3)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definition' || (argument.name === undefined && argumentIndex === 5)) {
            const parameterValue = previousArguments.getOptionalValue('parameter', 0);
            if (parameterValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(parameterValue.parameters, context);
            }
          }
          if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 6)) {
            const parameterValue = previousArguments.getOptionalValue('parameter', 0);
            if (parameterValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(parameterValue.parameters, context);
            }
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
          if (argument.name === 'wellDefinednessProof' || (argument.name === undefined && argumentIndex === 7)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_MacroOperator) {
          if (argument.name === 'notation' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'abbreviations' || (argument.name === undefined && argumentIndex === 2)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definitionNotation' || (argument.name === undefined && argumentIndex === 3)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'references' || (argument.name === undefined && argumentIndex === 5)) {
            const variablesValue = previousArguments.getOptionalValue('variables', 0);
            if (variablesValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(variablesValue.parameters, context);
            }
          }
        }
        if (type instanceof MetaRefExpression_Predicate) {
          if (argument.name === 'notation' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'abbreviations' || (argument.name === undefined && argumentIndex === 2)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'definitionNotation' || (argument.name === undefined && argumentIndex === 3)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtNotation.metaModel;
          }
          if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 5)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_StandardTheorem) {
          if (argument.name === 'proofs' || (argument.name === undefined && argumentIndex === 1)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_EquivalenceTheorem) {
          if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 1)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
      }
    }
    if (parent instanceof Fmt.CompoundExpression) {
      for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {
        if (currentContext instanceof ArgumentTypeContext) {
          if (currentContext.objectContentsClass === ObjectContents_Embedding) {
            if (argument.name === 'target' || (argument.name === undefined && argumentIndex === 1)) {
              const parameterValue = previousArguments.getOptionalValue('parameter', 0);
              if (parameterValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parameterValue.parameters, context);
              }
            }
            if (argument.name === 'wellDefinednessProof' || (argument.name === undefined && argumentIndex === 3)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_ConstructionRewriteDefinition) {
            if (argument.name === 'value' || (argument.name === undefined && argumentIndex === 1)) {
              const parameterValue = previousArguments.getOptionalValue('parameter', 0);
              if (parameterValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parameterValue.parameters, context);
              }
            }
            if (argument.name === 'theorem' || (argument.name === undefined && argumentIndex === 2)) {
              const parameterValue = previousArguments.getOptionalValue('parameter', 0);
              if (parameterValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parameterValue.parameters, context);
              }
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_ConstructorEqualityDefinition) {
            if (argument.name === 'definition' || (argument.name === undefined && argumentIndex === 2)) {
              const leftParametersValue = previousArguments.getOptionalValue('leftParameters', 0);
              if (leftParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(leftParametersValue.parameters, context);
              }
              const rightParametersValue = previousArguments.getOptionalValue('rightParameters', 1);
              if (rightParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(rightParametersValue.parameters, context);
              }
            }
            if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 3)) {
              const leftParametersValue = previousArguments.getOptionalValue('leftParameters', 0);
              if (leftParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(leftParametersValue.parameters, context);
              }
              const rightParametersValue = previousArguments.getOptionalValue('rightParameters', 1);
              if (rightParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(rightParametersValue.parameters, context);
              }
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
            if (argument.name === 'reflexivityProof' || (argument.name === undefined && argumentIndex === 4)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
            if (argument.name === 'symmetryProof' || (argument.name === undefined && argumentIndex === 5)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
            if (argument.name === 'transitivityProof' || (argument.name === undefined && argumentIndex === 6)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_SubsetArg) {
            if (argument.name === 'subsetProof' || (argument.name === undefined && argumentIndex === 1)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_ElementArg) {
            if (argument.name === 'elementProof' || (argument.name === undefined && argumentIndex === 1)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_ConstraintArg) {
            if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 0)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_BinderArg) {
            if (argument.name === 'targetArguments' || (argument.name === undefined && argumentIndex === 1)) {
              const sourceParametersValue = previousArguments.getOptionalValue('sourceParameters', 0);
              if (sourceParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(sourceParametersValue.parameters, context);
              }
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_Proof) {
            if (argument.name === 'goal' || (argument.name === undefined && argumentIndex === 3)) {
              const parametersValue = previousArguments.getOptionalValue('parameters', 2);
              if (parametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parametersValue.parameters, context);
              }
            }
            if (argument.name === 'steps' || (argument.name === undefined && argumentIndex === 4)) {
              const parametersValue = previousArguments.getOptionalValue('parameters', 2);
              if (parametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parametersValue.parameters, context);
              }
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_Case) {
            if (argument.name === 'exclusivityProof' || (argument.name === undefined && argumentIndex === 2)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_StructuralCase) {
            if (argument.name === 'value' || (argument.name === undefined && argumentIndex === 2)) {
              const parametersValue = previousArguments.getOptionalValue('parameters', 1);
              if (parametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parametersValue.parameters, context);
              }
            }
            if (argument.name === 'wellDefinednessProof' || (argument.name === undefined && argumentIndex === 4)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          break;
        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    if (parent instanceof Fmt.MetaRefExpression) {
      if (parent instanceof MetaRefExpression_Binder) {
        if (argument.name === 'targetParameters' || (argument.name === undefined && argumentIndex === 1)) {
          const sourceParametersValue = previousArguments.getOptionalValue('sourceParameters', 0);
          if (sourceParametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(sourceParametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_subset) {
        if (argument.name === 'formula' || (argument.name === undefined && argumentIndex === 1)) {
          const parameterValue = previousArguments.getOptionalValue('parameter', 0);
          if (parameterValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parameterValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_extendedSubset) {
        if (argument.name === 'term' || (argument.name === undefined && argumentIndex === 1)) {
          const parametersValue = previousArguments.getOptionalValue('parameters', 0);
          if (parametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_setStructuralCases) {
        if (argument.name === 'cases' || (argument.name === undefined && argumentIndex === 2)) {
          context = new ArgumentTypeContext(ObjectContents_StructuralCase, context);
        }
      }
      if (parent instanceof MetaRefExpression_cases) {
        if (argument.name === 'cases' || (argument.name === undefined && argumentIndex === 0)) {
          context = new ArgumentTypeContext(ObjectContents_Case, context);
        }
        if (argument.name === 'totalityProof' || (argument.name === undefined && argumentIndex === 1)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_structuralCases) {
        if (argument.name === 'cases' || (argument.name === undefined && argumentIndex === 2)) {
          context = new ArgumentTypeContext(ObjectContents_StructuralCase, context);
        }
      }
      if (parent instanceof MetaRefExpression_asElementOf) {
        if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 2)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_forall) {
        if (argument.name === 'formula' || (argument.name === undefined && argumentIndex === 1)) {
          const parametersValue = previousArguments.getOptionalValue('parameters', 0);
          if (parametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_exists) {
        if (argument.name === 'formula' || (argument.name === undefined && argumentIndex === 1)) {
          const parametersValue = previousArguments.getOptionalValue('parameters', 0);
          if (parametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_existsUnique) {
        if (argument.name === 'formula' || (argument.name === undefined && argumentIndex === 1)) {
          const parametersValue = previousArguments.getOptionalValue('parameters', 0);
          if (parametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_structural) {
        if (argument.name === 'cases' || (argument.name === undefined && argumentIndex === 2)) {
          context = new ArgumentTypeContext(ObjectContents_StructuralCase, context);
        }
      }
      if (parent instanceof MetaRefExpression_State) {
        if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 1)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_UseCases) {
        if (argument.name === 'caseProofs' || (argument.name === undefined && argumentIndex === 1)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveDef) {
        if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 1)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveByContradiction) {
        if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 0)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveForAll) {
        if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 0)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveExists) {
        if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 1)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveEquivalence) {
        if (argument.name === 'proofs' || (argument.name === undefined && argumentIndex === 0)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveCases) {
        if (argument.name === 'caseProofs' || (argument.name === undefined && argumentIndex === 1)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveByInduction) {
        if (argument.name === 'cases' || (argument.name === undefined && argumentIndex === 2)) {
          context = new ArgumentTypeContext(ObjectContents_StructuralCase, context);
        }
      }
      if (parent instanceof MetaRefExpression_ProveBySubstitution) {
        if (argument.name === 'proof' || (argument.name === undefined && argumentIndex === 3)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
      }
    }
    return context;
  }

  protected getExports(expression: Fmt.Expression, parentContext: Ctx.Context, indexParameterLists?: Fmt.ParameterList[]): Ctx.Context {
    let context = parentContext;
    if (expression instanceof MetaRefExpression_Binder) {
      context = this.getParameterListContext(expression.sourceParameters, context, indexParameterLists);
      context = this.getParameterListContext(expression.targetParameters, context, indexParameterLists ? [expression.sourceParameters, ...indexParameterLists] : [expression.sourceParameters]);
    }
    if (expression instanceof MetaRefExpression_UseExists) {
      context = this.getParameterListContext(expression.parameters, context, indexParameterLists);
    }
    return context;
  }
}

export const metaModel = new MetaModel;

export function getMetaModel(path?: Fmt.Path): MetaModel {
  if (path && path.name !== 'hlm') {
    throw new Error('File of type "hlm" expected');
  }
  return metaModel;
}
