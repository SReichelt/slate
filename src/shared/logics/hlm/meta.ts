// Generated from data/logics/hlm.slate by generateMetaDeclarations.ts.

import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Meta from '../../format/metaModel';
import * as FmtNotation from '../../notation/meta';

export class ObjectContents_Definition extends Fmt.ObjectContents {
  properties?: Fmt.ArgumentList;
  notation?: Fmt.Expression;
  abbreviations?: Fmt.Expression[];
  definitionNotation?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let propertiesRaw = argumentList.getOptionalValue('properties', 0);
    if (propertiesRaw !== undefined) {
      if (propertiesRaw instanceof Fmt.CompoundExpression) {
        this.properties = propertiesRaw.arguments;
      } else {
        throw new Error('properties: Compound expression expected');
      }
    }
    this.notation = argumentList.getOptionalValue('notation', 1);
    let abbreviationsRaw = argumentList.getOptionalValue('abbreviations', 2);
    if (abbreviationsRaw !== undefined) {
      if (abbreviationsRaw instanceof Fmt.ArrayExpression) {
        this.abbreviations = abbreviationsRaw.items;
      } else {
        throw new Error('abbreviations: Array expression expected');
      }
    }
    this.definitionNotation = argumentList.getOptionalValue('definitionNotation', 3);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.properties !== undefined) {
      let propertiesExpr = new Fmt.CompoundExpression;
      propertiesExpr.arguments = this.properties;
      argumentList.add(propertiesExpr, 'properties', true);
    }
    if (this.notation !== undefined) {
      argumentList.add(this.notation, 'notation', true);
    }
    if (this.abbreviations !== undefined) {
      let abbreviationsExpr = new Fmt.ArrayExpression;
      abbreviationsExpr.items = [];
      for (let item of this.abbreviations) {
        abbreviationsExpr.items.push(item);
      }
      argumentList.add(abbreviationsExpr, 'abbreviations', true);
    }
    if (this.definitionNotation !== undefined) {
      argumentList.add(this.definitionNotation, 'definitionNotation', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Definition {
    let result = new ObjectContents_Definition;
    this.substituteExpression(undefined, result, replacedParameters);
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
      for (let item of this.abbreviations) {
        item.traverse(fn);
      }
    }
    if (this.definitionNotation) {
      this.definitionNotation.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Definition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.properties) {
      result.properties = Object.create(Fmt.ArgumentList.prototype);
      if (this.properties.substituteExpression(fn, result.properties!, replacedParameters)) {
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
      for (let item of this.abbreviations) {
        let newItem = item.substitute(fn, replacedParameters);
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
        let leftItem = this.abbreviations[i];
        let rightItem = objectContents.abbreviations[i];
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
  embedding?: ObjectContents_Embedding;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let embeddingRaw = argumentList.getOptionalValue('embedding', 4);
    if (embeddingRaw !== undefined) {
      if (embeddingRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Embedding;
        newItem.fromCompoundExpression(embeddingRaw, reportFn);
        this.embedding = newItem;
        reportFn?.(embeddingRaw, newItem);
      } else {
        throw new Error('embedding: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    if (this.embedding !== undefined) {
      let embeddingExpr = new Fmt.CompoundExpression;
      this.embedding.toCompoundExpression(embeddingExpr, true, reportFn);
      argumentList.add(embeddingExpr, 'embedding', true);
      reportFn?.(embeddingExpr, this.embedding);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Construction {
    let result = new ObjectContents_Construction;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.embedding) {
      this.embedding.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Construction, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.embedding) {
      result.embedding = new ObjectContents_Embedding;
      if (this.embedding.substituteExpression(fn, result.embedding!, replacedParameters)) {
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
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_Construction extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Construction';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_Construction;
  }
}

export class ObjectContents_Embedding extends Fmt.ObjectContents {
  parameter: Fmt.Parameter;
  target: Fmt.Expression;
  full?: Fmt.Expression;
  wellDefinednessProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.target = argumentList.getValue('target', 1);
    this.full = argumentList.getOptionalValue('full', 2);
    let wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 3);
    if (wellDefinednessProofRaw !== undefined) {
      if (wellDefinednessProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(wellDefinednessProofRaw, reportFn);
        this.wellDefinednessProof = newItem;
        reportFn?.(wellDefinednessProofRaw, newItem);
      } else {
        throw new Error('wellDefinednessProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, outputAllNames ? 'parameter' : undefined, false);
    argumentList.add(this.target, outputAllNames ? 'target' : undefined, false);
    if (this.full !== undefined) {
      argumentList.add(this.full, 'full', true);
    }
    if (this.wellDefinednessProof !== undefined) {
      let wellDefinednessProofExpr = new Fmt.CompoundExpression;
      this.wellDefinednessProof.toCompoundExpression(wellDefinednessProofExpr, true, reportFn);
      argumentList.add(wellDefinednessProofExpr, 'wellDefinednessProof', true);
      reportFn?.(wellDefinednessProofExpr, this.wellDefinednessProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Embedding {
    let result = new ObjectContents_Embedding;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Embedding, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.parameter) {
      result.parameter = this.parameter.substituteExpression(fn, replacedParameters);
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
      result.wellDefinednessProof = new ObjectContents_Proof;
      if (this.wellDefinednessProof.substituteExpression(fn, result.wellDefinednessProof!, replacedParameters)) {
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

export class ObjectContents_Constructor extends ObjectContents_Definition {
  equalityDefinition?: ObjectContents_EqualityDefinition;
  rewrite?: ObjectContents_RewriteDefinition;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let equalityDefinitionRaw = argumentList.getOptionalValue('equalityDefinition', 4);
    if (equalityDefinitionRaw !== undefined) {
      if (equalityDefinitionRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_EqualityDefinition;
        newItem.fromCompoundExpression(equalityDefinitionRaw, reportFn);
        this.equalityDefinition = newItem;
        reportFn?.(equalityDefinitionRaw, newItem);
      } else {
        throw new Error('equalityDefinition: Compound expression expected');
      }
    }
    let rewriteRaw = argumentList.getOptionalValue('rewrite', 5);
    if (rewriteRaw !== undefined) {
      if (rewriteRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_RewriteDefinition;
        newItem.fromCompoundExpression(rewriteRaw, reportFn);
        this.rewrite = newItem;
        reportFn?.(rewriteRaw, newItem);
      } else {
        throw new Error('rewrite: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    if (this.equalityDefinition !== undefined) {
      let equalityDefinitionExpr = new Fmt.CompoundExpression;
      this.equalityDefinition.toCompoundExpression(equalityDefinitionExpr, true, reportFn);
      argumentList.add(equalityDefinitionExpr, 'equalityDefinition', true);
      reportFn?.(equalityDefinitionExpr, this.equalityDefinition);
    }
    if (this.rewrite !== undefined) {
      let rewriteExpr = new Fmt.CompoundExpression;
      this.rewrite.toCompoundExpression(rewriteExpr, true, reportFn);
      argumentList.add(rewriteExpr, 'rewrite', true);
      reportFn?.(rewriteExpr, this.rewrite);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Constructor {
    let result = new ObjectContents_Constructor;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Constructor, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.equalityDefinition) {
      result.equalityDefinition = new ObjectContents_EqualityDefinition;
      if (this.equalityDefinition.substituteExpression(fn, result.equalityDefinition!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.rewrite) {
      result.rewrite = new ObjectContents_RewriteDefinition;
      if (this.rewrite.substituteExpression(fn, result.rewrite!, replacedParameters)) {
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_Constructor;
  }
}

export class ObjectContents_EqualityDefinition extends Fmt.ObjectContents {
  leftParameters: Fmt.ParameterList;
  rightParameters: Fmt.ParameterList;
  definition: Fmt.Expression[];
  equivalenceProofs?: ObjectContents_Proof[];
  reflexivityProof?: ObjectContents_Proof;
  symmetryProof?: ObjectContents_Proof;
  transitivityProof?: ObjectContents_Proof;
  isomorphic?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let leftParametersRaw = argumentList.getValue('leftParameters', 0);
    if (leftParametersRaw instanceof Fmt.ParameterExpression) {
      this.leftParameters = leftParametersRaw.parameters;
    } else {
      throw new Error('leftParameters: Parameter expression expected');
    }
    let rightParametersRaw = argumentList.getValue('rightParameters', 1);
    if (rightParametersRaw instanceof Fmt.ParameterExpression) {
      this.rightParameters = rightParametersRaw.parameters;
    } else {
      throw new Error('rightParameters: Parameter expression expected');
    }
    let definitionRaw = argumentList.getValue('definition', 2);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 3);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item, reportFn);
            this.equivalenceProofs.push(newItem);
            reportFn?.(item, newItem);
          } else {
            throw new Error('equivalenceProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
    let reflexivityProofRaw = argumentList.getOptionalValue('reflexivityProof', 4);
    if (reflexivityProofRaw !== undefined) {
      if (reflexivityProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(reflexivityProofRaw, reportFn);
        this.reflexivityProof = newItem;
        reportFn?.(reflexivityProofRaw, newItem);
      } else {
        throw new Error('reflexivityProof: Compound expression expected');
      }
    }
    let symmetryProofRaw = argumentList.getOptionalValue('symmetryProof', 5);
    if (symmetryProofRaw !== undefined) {
      if (symmetryProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(symmetryProofRaw, reportFn);
        this.symmetryProof = newItem;
        reportFn?.(symmetryProofRaw, newItem);
      } else {
        throw new Error('symmetryProof: Compound expression expected');
      }
    }
    let transitivityProofRaw = argumentList.getOptionalValue('transitivityProof', 6);
    if (transitivityProofRaw !== undefined) {
      if (transitivityProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(transitivityProofRaw, reportFn);
        this.transitivityProof = newItem;
        reportFn?.(transitivityProofRaw, newItem);
      } else {
        throw new Error('transitivityProof: Compound expression expected');
      }
    }
    this.isomorphic = argumentList.getOptionalValue('isomorphic', 7);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let leftParametersExpr = new Fmt.ParameterExpression;
    leftParametersExpr.parameters = this.leftParameters;
    argumentList.add(leftParametersExpr, outputAllNames ? 'leftParameters' : undefined, false);
    let rightParametersExpr = new Fmt.ParameterExpression;
    rightParametersExpr.parameters = this.rightParameters;
    argumentList.add(rightParametersExpr, outputAllNames ? 'rightParameters' : undefined, false);
    let definitionExpr = new Fmt.ArrayExpression;
    definitionExpr.items = [];
    for (let item of this.definition) {
      definitionExpr.items.push(item);
    }
    argumentList.add(definitionExpr, outputAllNames ? 'definition' : undefined, false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem, true, reportFn);
        equivalenceProofsExpr.items.push(newItem);
        reportFn?.(newItem, item);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
    if (this.reflexivityProof !== undefined) {
      let reflexivityProofExpr = new Fmt.CompoundExpression;
      this.reflexivityProof.toCompoundExpression(reflexivityProofExpr, true, reportFn);
      argumentList.add(reflexivityProofExpr, 'reflexivityProof', true);
      reportFn?.(reflexivityProofExpr, this.reflexivityProof);
    }
    if (this.symmetryProof !== undefined) {
      let symmetryProofExpr = new Fmt.CompoundExpression;
      this.symmetryProof.toCompoundExpression(symmetryProofExpr, true, reportFn);
      argumentList.add(symmetryProofExpr, 'symmetryProof', true);
      reportFn?.(symmetryProofExpr, this.symmetryProof);
    }
    if (this.transitivityProof !== undefined) {
      let transitivityProofExpr = new Fmt.CompoundExpression;
      this.transitivityProof.toCompoundExpression(transitivityProofExpr, true, reportFn);
      argumentList.add(transitivityProofExpr, 'transitivityProof', true);
      reportFn?.(transitivityProofExpr, this.transitivityProof);
    }
    if (this.isomorphic !== undefined) {
      argumentList.add(this.isomorphic, 'isomorphic', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_EqualityDefinition {
    let result = new ObjectContents_EqualityDefinition;
    this.substituteExpression(undefined, result, replacedParameters);
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
      for (let item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (let item of this.equivalenceProofs) {
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_EqualityDefinition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.leftParameters) {
      result.leftParameters = Object.create(Fmt.ParameterList.prototype);
      if (this.leftParameters.substituteExpression(fn, result.leftParameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.rightParameters) {
      result.rightParameters = Object.create(Fmt.ParameterList.prototype);
      if (this.rightParameters.substituteExpression(fn, result.rightParameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.definition) {
      result.definition = [];
      for (let item of this.definition) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.equivalenceProofs.push(newItem);
      }
    }
    if (this.reflexivityProof) {
      result.reflexivityProof = new ObjectContents_Proof;
      if (this.reflexivityProof.substituteExpression(fn, result.reflexivityProof!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.symmetryProof) {
      result.symmetryProof = new ObjectContents_Proof;
      if (this.symmetryProof.substituteExpression(fn, result.symmetryProof!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.transitivityProof) {
      result.transitivityProof = new ObjectContents_Proof;
      if (this.transitivityProof.substituteExpression(fn, result.transitivityProof!, replacedParameters)) {
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

  isEquivalentTo(objectContents: ObjectContents_EqualityDefinition, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
        let leftItem = this.definition[i];
        let rightItem = objectContents.definition[i];
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
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
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

export class ObjectContents_RewriteDefinition extends Fmt.ObjectContents {
  value: Fmt.Expression;
  theorem?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.value = argumentList.getValue('value', 0);
    this.theorem = argumentList.getOptionalValue('theorem', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.value, outputAllNames ? 'value' : undefined, false);
    if (this.theorem !== undefined) {
      argumentList.add(this.theorem, 'theorem', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_RewriteDefinition {
    let result = new ObjectContents_RewriteDefinition;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_RewriteDefinition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_RewriteDefinition, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
  definition: Fmt.Expression[];
  equalityProofs?: ObjectContents_Proof[];
  setRestriction?: Fmt.Expression;
  setRestrictionProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let definitionRaw = argumentList.getValue('definition', 4);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    let equalityProofsRaw = argumentList.getOptionalValue('equalityProofs', 5);
    if (equalityProofsRaw !== undefined) {
      if (equalityProofsRaw instanceof Fmt.ArrayExpression) {
        this.equalityProofs = [];
        for (let item of equalityProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item, reportFn);
            this.equalityProofs.push(newItem);
            reportFn?.(item, newItem);
          } else {
            throw new Error('equalityProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equalityProofs: Array expression expected');
      }
    }
    this.setRestriction = argumentList.getOptionalValue('setRestriction', 6);
    let setRestrictionProofRaw = argumentList.getOptionalValue('setRestrictionProof', 7);
    if (setRestrictionProofRaw !== undefined) {
      if (setRestrictionProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(setRestrictionProofRaw, reportFn);
        this.setRestrictionProof = newItem;
        reportFn?.(setRestrictionProofRaw, newItem);
      } else {
        throw new Error('setRestrictionProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    let definitionExpr = new Fmt.ArrayExpression;
    definitionExpr.items = [];
    for (let item of this.definition) {
      definitionExpr.items.push(item);
    }
    argumentList.add(definitionExpr, outputAllNames ? 'definition' : undefined, false);
    if (this.equalityProofs !== undefined) {
      let equalityProofsExpr = new Fmt.ArrayExpression;
      equalityProofsExpr.items = [];
      for (let item of this.equalityProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem, true, reportFn);
        equalityProofsExpr.items.push(newItem);
        reportFn?.(newItem, item);
      }
      argumentList.add(equalityProofsExpr, 'equalityProofs', true);
    }
    if (this.setRestriction !== undefined) {
      argumentList.add(this.setRestriction, 'setRestriction', true);
    }
    if (this.setRestrictionProof !== undefined) {
      let setRestrictionProofExpr = new Fmt.CompoundExpression;
      this.setRestrictionProof.toCompoundExpression(setRestrictionProofExpr, true, reportFn);
      argumentList.add(setRestrictionProofExpr, 'setRestrictionProof', true);
      reportFn?.(setRestrictionProofExpr, this.setRestrictionProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SetOperator {
    let result = new ObjectContents_SetOperator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definition) {
      for (let item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equalityProofs) {
      for (let item of this.equalityProofs) {
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_SetOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = [];
      for (let item of this.definition) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equalityProofs) {
      result.equalityProofs = [];
      for (let item of this.equalityProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
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
      result.setRestrictionProof = new ObjectContents_Proof;
      if (this.setRestrictionProof.substituteExpression(fn, result.setRestrictionProof!, replacedParameters)) {
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
        let leftItem = this.definition[i];
        let rightItem = objectContents.definition[i];
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
        let leftItem = this.equalityProofs[i];
        let rightItem = objectContents.equalityProofs[i];
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_SetOperator;
  }
}

export class ObjectContents_Operator extends ObjectContents_Definition {
  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Operator {
    let result = new ObjectContents_Operator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Operator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
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
  definition: Fmt.Expression[];
  equalityProofs?: ObjectContents_Proof[];
  setRestriction?: Fmt.Expression;
  setRestrictionProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let definitionRaw = argumentList.getValue('definition', 4);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    let equalityProofsRaw = argumentList.getOptionalValue('equalityProofs', 5);
    if (equalityProofsRaw !== undefined) {
      if (equalityProofsRaw instanceof Fmt.ArrayExpression) {
        this.equalityProofs = [];
        for (let item of equalityProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item, reportFn);
            this.equalityProofs.push(newItem);
            reportFn?.(item, newItem);
          } else {
            throw new Error('equalityProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equalityProofs: Array expression expected');
      }
    }
    this.setRestriction = argumentList.getOptionalValue('setRestriction', 6);
    let setRestrictionProofRaw = argumentList.getOptionalValue('setRestrictionProof', 7);
    if (setRestrictionProofRaw !== undefined) {
      if (setRestrictionProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(setRestrictionProofRaw, reportFn);
        this.setRestrictionProof = newItem;
        reportFn?.(setRestrictionProofRaw, newItem);
      } else {
        throw new Error('setRestrictionProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    let definitionExpr = new Fmt.ArrayExpression;
    definitionExpr.items = [];
    for (let item of this.definition) {
      definitionExpr.items.push(item);
    }
    argumentList.add(definitionExpr, outputAllNames ? 'definition' : undefined, false);
    if (this.equalityProofs !== undefined) {
      let equalityProofsExpr = new Fmt.ArrayExpression;
      equalityProofsExpr.items = [];
      for (let item of this.equalityProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem, true, reportFn);
        equalityProofsExpr.items.push(newItem);
        reportFn?.(newItem, item);
      }
      argumentList.add(equalityProofsExpr, 'equalityProofs', true);
    }
    if (this.setRestriction !== undefined) {
      argumentList.add(this.setRestriction, 'setRestriction', true);
    }
    if (this.setRestrictionProof !== undefined) {
      let setRestrictionProofExpr = new Fmt.CompoundExpression;
      this.setRestrictionProof.toCompoundExpression(setRestrictionProofExpr, true, reportFn);
      argumentList.add(setRestrictionProofExpr, 'setRestrictionProof', true);
      reportFn?.(setRestrictionProofExpr, this.setRestrictionProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ExplicitOperator {
    let result = new ObjectContents_ExplicitOperator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definition) {
      for (let item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equalityProofs) {
      for (let item of this.equalityProofs) {
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ExplicitOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = [];
      for (let item of this.definition) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equalityProofs) {
      result.equalityProofs = [];
      for (let item of this.equalityProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
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
      result.setRestrictionProof = new ObjectContents_Proof;
      if (this.setRestrictionProof.substituteExpression(fn, result.setRestrictionProof!, replacedParameters)) {
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
        let leftItem = this.definition[i];
        let rightItem = objectContents.definition[i];
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
        let leftItem = this.equalityProofs[i];
        let rightItem = objectContents.equalityProofs[i];
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_ExplicitOperator;
  }
}

export class ObjectContents_ImplicitOperator extends ObjectContents_Operator {
  parameter: Fmt.Parameter;
  definition: Fmt.Expression[];
  equivalenceProofs?: ObjectContents_Proof[];
  wellDefinednessProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let parameterRaw = argumentList.getValue('parameter', 4);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    let definitionRaw = argumentList.getValue('definition', 5);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 6);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item, reportFn);
            this.equivalenceProofs.push(newItem);
            reportFn?.(item, newItem);
          } else {
            throw new Error('equivalenceProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
    let wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 7);
    if (wellDefinednessProofRaw !== undefined) {
      if (wellDefinednessProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(wellDefinednessProofRaw, reportFn);
        this.wellDefinednessProof = newItem;
        reportFn?.(wellDefinednessProofRaw, newItem);
      } else {
        throw new Error('wellDefinednessProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, outputAllNames ? 'parameter' : undefined, false);
    let definitionExpr = new Fmt.ArrayExpression;
    definitionExpr.items = [];
    for (let item of this.definition) {
      definitionExpr.items.push(item);
    }
    argumentList.add(definitionExpr, outputAllNames ? 'definition' : undefined, false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem, true, reportFn);
        equivalenceProofsExpr.items.push(newItem);
        reportFn?.(newItem, item);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
    if (this.wellDefinednessProof !== undefined) {
      let wellDefinednessProofExpr = new Fmt.CompoundExpression;
      this.wellDefinednessProof.toCompoundExpression(wellDefinednessProofExpr, true, reportFn);
      argumentList.add(wellDefinednessProofExpr, 'wellDefinednessProof', true);
      reportFn?.(wellDefinednessProofExpr, this.wellDefinednessProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ImplicitOperator {
    let result = new ObjectContents_ImplicitOperator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.parameter) {
      this.parameter.traverse(fn);
    }
    if (this.definition) {
      for (let item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (let item of this.equivalenceProofs) {
        item.traverse(fn);
      }
    }
    if (this.wellDefinednessProof) {
      this.wellDefinednessProof.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ImplicitOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.parameter) {
      result.parameter = this.parameter.substituteExpression(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.definition) {
      result.definition = [];
      for (let item of this.definition) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.equivalenceProofs.push(newItem);
      }
    }
    if (this.wellDefinednessProof) {
      result.wellDefinednessProof = new ObjectContents_Proof;
      if (this.wellDefinednessProof.substituteExpression(fn, result.wellDefinednessProof!, replacedParameters)) {
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
        let leftItem = this.definition[i];
        let rightItem = objectContents.definition[i];
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
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_ImplicitOperator;
  }
}

export class ObjectContents_MacroOperator extends ObjectContents_Operator {
  variables?: Fmt.ParameterList;
  references?: Fmt.ArgumentList;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let variablesRaw = argumentList.getOptionalValue('variables', 4);
    if (variablesRaw !== undefined) {
      if (variablesRaw instanceof Fmt.ParameterExpression) {
        this.variables = variablesRaw.parameters;
      } else {
        throw new Error('variables: Parameter expression expected');
      }
    }
    let referencesRaw = argumentList.getOptionalValue('references', 5);
    if (referencesRaw !== undefined) {
      if (referencesRaw instanceof Fmt.CompoundExpression) {
        this.references = referencesRaw.arguments;
      } else {
        throw new Error('references: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    if (this.variables !== undefined) {
      let variablesExpr = new Fmt.ParameterExpression;
      variablesExpr.parameters = this.variables;
      argumentList.add(variablesExpr, 'variables', true);
    }
    if (this.references !== undefined) {
      let referencesExpr = new Fmt.CompoundExpression;
      referencesExpr.arguments = this.references;
      argumentList.add(referencesExpr, 'references', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_MacroOperator {
    let result = new ObjectContents_MacroOperator;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_MacroOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.variables) {
      result.variables = Object.create(Fmt.ParameterList.prototype);
      if (this.variables.substituteExpression(fn, result.variables!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.references) {
      result.references = Object.create(Fmt.ArgumentList.prototype);
      if (this.references.substituteExpression(fn, result.references!, replacedParameters)) {
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_MacroOperator;
  }
}

export class ObjectContents_Predicate extends ObjectContents_Definition {
  definition: Fmt.Expression[];
  equivalenceProofs?: ObjectContents_Proof[];

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let definitionRaw = argumentList.getValue('definition', 4);
    if (definitionRaw instanceof Fmt.ArrayExpression) {
      this.definition = definitionRaw.items;
    } else {
      throw new Error('definition: Array expression expected');
    }
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 5);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item, reportFn);
            this.equivalenceProofs.push(newItem);
            reportFn?.(item, newItem);
          } else {
            throw new Error('equivalenceProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    let definitionExpr = new Fmt.ArrayExpression;
    definitionExpr.items = [];
    for (let item of this.definition) {
      definitionExpr.items.push(item);
    }
    argumentList.add(definitionExpr, outputAllNames ? 'definition' : undefined, false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem, true, reportFn);
        equivalenceProofsExpr.items.push(newItem);
        reportFn?.(newItem, item);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Predicate {
    let result = new ObjectContents_Predicate;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definition) {
      for (let item of this.definition) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (let item of this.equivalenceProofs) {
        item.traverse(fn);
      }
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Predicate, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = [];
      for (let item of this.definition) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definition.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
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
        let leftItem = this.definition[i];
        let rightItem = objectContents.definition[i];
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
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_Predicate;
  }
}

export class ObjectContents_StandardTheorem extends Fmt.ObjectContents {
  claim: Fmt.Expression;
  proofs?: ObjectContents_Proof[];

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.claim = argumentList.getValue('claim', 0);
    let proofsRaw = argumentList.getOptionalValue('proofs', 1);
    if (proofsRaw !== undefined) {
      if (proofsRaw instanceof Fmt.ArrayExpression) {
        this.proofs = [];
        for (let item of proofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item, reportFn);
            this.proofs.push(newItem);
            reportFn?.(item, newItem);
          } else {
            throw new Error('proofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('proofs: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.claim, outputAllNames ? 'claim' : undefined, false);
    if (this.proofs !== undefined) {
      let proofsExpr = new Fmt.ArrayExpression;
      proofsExpr.items = [];
      for (let item of this.proofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem, true, reportFn);
        proofsExpr.items.push(newItem);
        reportFn?.(newItem, item);
      }
      argumentList.add(proofsExpr, 'proofs', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_StandardTheorem {
    let result = new ObjectContents_StandardTheorem;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.claim) {
      this.claim.traverse(fn);
    }
    if (this.proofs) {
      for (let item of this.proofs) {
        item.traverse(fn);
      }
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_StandardTheorem, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.claim) {
      result.claim = this.claim.substitute(fn, replacedParameters);
      if (result.claim !== this.claim) {
        changed = true;
      }
    }
    if (this.proofs) {
      result.proofs = [];
      for (let item of this.proofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
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
        let leftItem = this.proofs[i];
        let rightItem = objectContents.proofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_StandardTheorem extends Fmt.MetaRefExpression {
  getName(): string {
    return 'StandardTheorem';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_StandardTheorem;
  }
}

export class ObjectContents_EquivalenceTheorem extends Fmt.ObjectContents {
  conditions: Fmt.Expression[];
  equivalenceProofs?: ObjectContents_Proof[];

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let conditionsRaw = argumentList.getValue('conditions', 0);
    if (conditionsRaw instanceof Fmt.ArrayExpression) {
      this.conditions = conditionsRaw.items;
    } else {
      throw new Error('conditions: Array expression expected');
    }
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 1);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item, reportFn);
            this.equivalenceProofs.push(newItem);
            reportFn?.(item, newItem);
          } else {
            throw new Error('equivalenceProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let conditionsExpr = new Fmt.ArrayExpression;
    conditionsExpr.items = [];
    for (let item of this.conditions) {
      conditionsExpr.items.push(item);
    }
    argumentList.add(conditionsExpr, outputAllNames ? 'conditions' : undefined, false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem, true, reportFn);
        equivalenceProofsExpr.items.push(newItem);
        reportFn?.(newItem, item);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_EquivalenceTheorem {
    let result = new ObjectContents_EquivalenceTheorem;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.conditions) {
      for (let item of this.conditions) {
        item.traverse(fn);
      }
    }
    if (this.equivalenceProofs) {
      for (let item of this.equivalenceProofs) {
        item.traverse(fn);
      }
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_EquivalenceTheorem, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.conditions) {
      result.conditions = [];
      for (let item of this.conditions) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.conditions.push(newItem);
      }
    }
    if (this.equivalenceProofs) {
      result.equivalenceProofs = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
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
        let leftItem = this.conditions[i];
        let rightItem = objectContents.conditions[i];
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
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_EquivalenceTheorem extends Fmt.MetaRefExpression {
  getName(): string {
    return 'EquivalenceTheorem';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
    return new ObjectContents_EquivalenceTheorem;
  }
}

export class MetaRefExpression_Bool extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Bool';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
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
  auto?: Fmt.Expression;

  getName(): string {
    return 'Prop';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.auto = argumentList.getOptionalValue('auto', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Prop;
    let changed = false;
    if (this.auto) {
      result.auto = this.auto.substitute(fn, replacedParameters);
      if (result.auto !== this.auto) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  auto?: Fmt.Expression;
  embedSubsets?: Fmt.Expression;

  getName(): string {
    return 'Set';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.auto = argumentList.getOptionalValue('auto', 0);
    this.embedSubsets = argumentList.getOptionalValue('embedSubsets', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
    if (this.embedSubsets !== undefined) {
      argumentList.add(this.embedSubsets, 'embedSubsets', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Set;
    let changed = false;
    if (this.auto) {
      result.auto = this.auto.substitute(fn, replacedParameters);
      if (result.auto !== this.auto) {
        changed = true;
      }
    }
    if (this.embedSubsets) {
      result.embedSubsets = this.embedSubsets.substitute(fn, replacedParameters);
      if (result.embedSubsets !== this.embedSubsets) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  superset: Fmt.Expression;
  auto?: Fmt.Expression;
  embedSubsets?: Fmt.Expression;

  getName(): string {
    return 'Subset';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.superset = argumentList.getValue('superset', 0);
    this.auto = argumentList.getOptionalValue('auto', 1);
    this.embedSubsets = argumentList.getOptionalValue('embedSubsets', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.superset, undefined, false);
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
    if (this.embedSubsets !== undefined) {
      argumentList.add(this.embedSubsets, 'embedSubsets', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Subset;
    let changed = false;
    if (this.superset) {
      result.superset = this.superset.substitute(fn, replacedParameters);
      if (result.superset !== this.superset) {
        changed = true;
      }
    }
    if (this.auto) {
      result.auto = this.auto.substitute(fn, replacedParameters);
      if (result.auto !== this.auto) {
        changed = true;
      }
    }
    if (this.embedSubsets) {
      result.embedSubsets = this.embedSubsets.substitute(fn, replacedParameters);
      if (result.embedSubsets !== this.embedSubsets) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  _set: Fmt.Expression;
  auto?: Fmt.Expression;

  getName(): string {
    return 'Element';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
    this.auto = argumentList.getOptionalValue('auto', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this._set, undefined, false);
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Element;
    let changed = false;
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    if (this.auto) {
      result.auto = this.auto.substitute(fn, replacedParameters);
      if (result.auto !== this.auto) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  formula: Fmt.Expression;

  getName(): string {
    return 'Constraint';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Constraint;
    let changed = false;
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  sourceParameters: Fmt.ParameterList;
  targetParameters: Fmt.ParameterList;

  getName(): string {
    return 'Binder';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let sourceParametersRaw = argumentList.getValue('sourceParameters', 0);
    if (sourceParametersRaw instanceof Fmt.ParameterExpression) {
      this.sourceParameters = sourceParametersRaw.parameters;
    } else {
      throw new Error('sourceParameters: Parameter expression expected');
    }
    let targetParametersRaw = argumentList.getValue('targetParameters', 1);
    if (targetParametersRaw instanceof Fmt.ParameterExpression) {
      this.targetParameters = targetParametersRaw.parameters;
    } else {
      throw new Error('targetParameters: Parameter expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let sourceParametersExpr = new Fmt.ParameterExpression;
    sourceParametersExpr.parameters = this.sourceParameters;
    argumentList.add(sourceParametersExpr, undefined, false);
    let targetParametersExpr = new Fmt.ParameterExpression;
    targetParametersExpr.parameters = this.targetParameters;
    argumentList.add(targetParametersExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Binder;
    let changed = false;
    if (this.sourceParameters) {
      result.sourceParameters = Object.create(Fmt.ParameterList.prototype);
      if (this.sourceParameters.substituteExpression(fn, result.sourceParameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.targetParameters) {
      result.targetParameters = Object.create(Fmt.ParameterList.prototype);
      if (this.targetParameters.substituteExpression(fn, result.targetParameters!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  _set: Fmt.Expression;

  getName(): string {
    return 'SetDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this._set, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_SetDef;
    let changed = false;
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  element: Fmt.Expression;

  getName(): string {
    return 'Def';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.element = argumentList.getValue('element', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.element, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Def;
    let changed = false;
    if (this.element) {
      result.element = this.element.substitute(fn, replacedParameters);
      if (result.element !== this.element) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  formula: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.formula, outputAllNames ? 'formula' : undefined, false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_PropArg {
    let result = new ObjectContents_PropArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.formula) {
      this.formula.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_PropArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
  _set: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this._set, outputAllNames ? 'set' : undefined, false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SetArg {
    let result = new ObjectContents_SetArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this._set) {
      this._set.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_SetArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
  _set: Fmt.Expression;
  subsetProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._set = argumentList.getValue('set', 0);
    let subsetProofRaw = argumentList.getOptionalValue('subsetProof', 1);
    if (subsetProofRaw !== undefined) {
      if (subsetProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(subsetProofRaw, reportFn);
        this.subsetProof = newItem;
        reportFn?.(subsetProofRaw, newItem);
      } else {
        throw new Error('subsetProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this._set, outputAllNames ? 'set' : undefined, false);
    if (this.subsetProof !== undefined) {
      let subsetProofExpr = new Fmt.CompoundExpression;
      this.subsetProof.toCompoundExpression(subsetProofExpr, true, reportFn);
      argumentList.add(subsetProofExpr, 'subsetProof', true);
      reportFn?.(subsetProofExpr, this.subsetProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SubsetArg {
    let result = new ObjectContents_SubsetArg;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_SubsetArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    if (this.subsetProof) {
      result.subsetProof = new ObjectContents_Proof;
      if (this.subsetProof.substituteExpression(fn, result.subsetProof!, replacedParameters)) {
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
  element: Fmt.Expression;
  elementProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.element = argumentList.getValue('element', 0);
    let elementProofRaw = argumentList.getOptionalValue('elementProof', 1);
    if (elementProofRaw !== undefined) {
      if (elementProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(elementProofRaw, reportFn);
        this.elementProof = newItem;
        reportFn?.(elementProofRaw, newItem);
      } else {
        throw new Error('elementProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.element, outputAllNames ? 'element' : undefined, false);
    if (this.elementProof !== undefined) {
      let elementProofExpr = new Fmt.CompoundExpression;
      this.elementProof.toCompoundExpression(elementProofExpr, true, reportFn);
      argumentList.add(elementProofExpr, 'elementProof', true);
      reportFn?.(elementProofExpr, this.elementProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ElementArg {
    let result = new ObjectContents_ElementArg;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ElementArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.element) {
      result.element = this.element.substitute(fn, replacedParameters);
      if (result.element !== this.element) {
        changed = true;
      }
    }
    if (this.elementProof) {
      result.elementProof = new ObjectContents_Proof;
      if (this.elementProof.substituteExpression(fn, result.elementProof!, replacedParameters)) {
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
  proof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let proofRaw = argumentList.getOptionalValue('proof', 0);
    if (proofRaw !== undefined) {
      if (proofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(proofRaw, reportFn);
        this.proof = newItem;
        reportFn?.(proofRaw, newItem);
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr, true, reportFn);
      argumentList.add(proofExpr, 'proof', true);
      reportFn?.(proofExpr, this.proof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ConstraintArg {
    let result = new ObjectContents_ConstraintArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.proof) {
      this.proof.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ConstraintArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
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
  sourceParameters: Fmt.ParameterList;
  targetArguments: Fmt.ArgumentList;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let sourceParametersRaw = argumentList.getValue('sourceParameters', 0);
    if (sourceParametersRaw instanceof Fmt.ParameterExpression) {
      this.sourceParameters = sourceParametersRaw.parameters;
    } else {
      throw new Error('sourceParameters: Parameter expression expected');
    }
    let targetArgumentsRaw = argumentList.getValue('targetArguments', 1);
    if (targetArgumentsRaw instanceof Fmt.CompoundExpression) {
      this.targetArguments = targetArgumentsRaw.arguments;
    } else {
      throw new Error('targetArguments: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let sourceParametersExpr = new Fmt.ParameterExpression;
    sourceParametersExpr.parameters = this.sourceParameters;
    argumentList.add(sourceParametersExpr, outputAllNames ? 'sourceParameters' : undefined, false);
    let targetArgumentsExpr = new Fmt.CompoundExpression;
    targetArgumentsExpr.arguments = this.targetArguments;
    argumentList.add(targetArgumentsExpr, outputAllNames ? 'targetArguments' : undefined, false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_BinderArg {
    let result = new ObjectContents_BinderArg;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_BinderArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.sourceParameters) {
      result.sourceParameters = Object.create(Fmt.ParameterList.prototype);
      if (this.sourceParameters.substituteExpression(fn, result.sourceParameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.targetArguments) {
      result.targetArguments = Object.create(Fmt.ArgumentList.prototype);
      if (this.targetArguments.substituteExpression(fn, result.targetArguments!, replacedParameters)) {
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

  getName(): string {
    return 'enumeration';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    if (this.terms) {
      this.terms = undefined;
    }
    let index = 0;
    for (;;) {
      let termsRaw = argumentList.getOptionalValue(undefined, index);
      if (termsRaw === undefined) {
        break;
      }
      if (!this.terms) {
        this.terms = [];
      }
      this.terms!.push(termsRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.terms !== undefined) {
      for (let termsArg of this.terms) {
        argumentList.add(termsArg, undefined, true);
      }
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_enumeration;
    let changed = false;
    if (this.terms) {
      result.terms = [];
      for (let item of this.terms) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.terms.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.terms[i];
        let rightItem = expression.terms[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_subset extends Fmt.MetaRefExpression {
  parameter: Fmt.Parameter;
  formula: Fmt.Expression;

  getName(): string {
    return 'subset';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.formula = argumentList.getValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, undefined, false);
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_subset;
    let changed = false;
    if (this.parameter) {
      result.parameter = this.parameter.substituteExpression(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  parameters: Fmt.ParameterList;
  term: Fmt.Expression;

  getName(): string {
    return 'extendedSubset';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.term = argumentList.getValue('term', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters = this.parameters;
    argumentList.add(parametersExpr, undefined, false);
    argumentList.add(this.term, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_extendedSubset;
    let changed = false;
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  term: Fmt.Expression;
  construction: Fmt.Expression;
  cases: ObjectContents_StructuralCase[];

  getName(): string {
    return 'setStructuralCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item, reportFn);
          this.cases.push(newItem);
          reportFn?.(item, newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem, true, reportFn);
      casesExpr.items.push(newItem);
      reportFn?.(newItem, item);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_setStructuralCases;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    if (this.construction) {
      result.construction = this.construction.substitute(fn, replacedParameters);
      if (result.construction !== this.construction) {
        changed = true;
      }
    }
    if (this.cases) {
      result.cases = [];
      for (let item of this.cases) {
        let newItem = new ObjectContents_StructuralCase;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.cases.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_setAssociative extends Fmt.MetaRefExpression {
  term: Fmt.Expression;

  getName(): string {
    return 'setAssociative';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_setAssociative;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  cases: ObjectContents_Case[];
  totalityProof?: ObjectContents_Proof;

  getName(): string {
    return 'cases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let casesRaw = argumentList.getValue('cases', 0);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_Case;
          newItem.fromCompoundExpression(item, reportFn);
          this.cases.push(newItem);
          reportFn?.(item, newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
    let totalityProofRaw = argumentList.getOptionalValue('totalityProof', 1);
    if (totalityProofRaw !== undefined) {
      if (totalityProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(totalityProofRaw, reportFn);
        this.totalityProof = newItem;
        reportFn?.(totalityProofRaw, newItem);
      } else {
        throw new Error('totalityProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem, true, reportFn);
      casesExpr.items.push(newItem);
      reportFn?.(newItem, item);
    }
    argumentList.add(casesExpr, undefined, false);
    if (this.totalityProof !== undefined) {
      let totalityProofExpr = new Fmt.CompoundExpression;
      this.totalityProof.toCompoundExpression(totalityProofExpr, true, reportFn);
      argumentList.add(totalityProofExpr, 'totalityProof', true);
      reportFn?.(totalityProofExpr, this.totalityProof);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_cases;
    let changed = false;
    if (this.cases) {
      result.cases = [];
      for (let item of this.cases) {
        let newItem = new ObjectContents_Case;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.cases.push(newItem);
      }
    }
    if (this.totalityProof) {
      result.totalityProof = new ObjectContents_Proof;
      if (this.totalityProof.substituteExpression(fn, result.totalityProof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
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
  term: Fmt.Expression;
  construction: Fmt.Expression;
  cases: ObjectContents_StructuralCase[];

  getName(): string {
    return 'structuralCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item, reportFn);
          this.cases.push(newItem);
          reportFn?.(item, newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem, true, reportFn);
      casesExpr.items.push(newItem);
      reportFn?.(newItem, item);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_structuralCases;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    if (this.construction) {
      result.construction = this.construction.substitute(fn, replacedParameters);
      if (result.construction !== this.construction) {
        changed = true;
      }
    }
    if (this.cases) {
      result.cases = [];
      for (let item of this.cases) {
        let newItem = new ObjectContents_StructuralCase;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.cases.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_asElementOf extends Fmt.MetaRefExpression {
  term: Fmt.Expression;
  _set: Fmt.Expression;
  proof?: ObjectContents_Proof;

  getName(): string {
    return 'asElementOf';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this._set = argumentList.getValue('set', 1);
    let proofRaw = argumentList.getOptionalValue('proof', 2);
    if (proofRaw !== undefined) {
      if (proofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(proofRaw, reportFn);
        this.proof = newItem;
        reportFn?.(proofRaw, newItem);
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this._set, undefined, false);
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr, true, reportFn);
      argumentList.add(proofExpr, 'proof', true);
      reportFn?.(proofExpr, this.proof);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_asElementOf;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  term: Fmt.Expression;

  getName(): string {
    return 'associative';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_associative;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  formula: Fmt.Expression;

  getName(): string {
    return 'not';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_not;
    let changed = false;
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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

  getName(): string {
    return 'and';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    if (this.formulas) {
      this.formulas = undefined;
    }
    let index = 0;
    for (;;) {
      let formulasRaw = argumentList.getOptionalValue(undefined, index);
      if (formulasRaw === undefined) {
        break;
      }
      if (!this.formulas) {
        this.formulas = [];
      }
      this.formulas!.push(formulasRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.formulas !== undefined) {
      for (let formulasArg of this.formulas) {
        argumentList.add(formulasArg, undefined, true);
      }
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_and;
    let changed = false;
    if (this.formulas) {
      result.formulas = [];
      for (let item of this.formulas) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.formulas.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.formulas[i];
        let rightItem = expression.formulas[i];
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

  getName(): string {
    return 'or';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    if (this.formulas) {
      this.formulas = undefined;
    }
    let index = 0;
    for (;;) {
      let formulasRaw = argumentList.getOptionalValue(undefined, index);
      if (formulasRaw === undefined) {
        break;
      }
      if (!this.formulas) {
        this.formulas = [];
      }
      this.formulas!.push(formulasRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.formulas !== undefined) {
      for (let formulasArg of this.formulas) {
        argumentList.add(formulasArg, undefined, true);
      }
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_or;
    let changed = false;
    if (this.formulas) {
      result.formulas = [];
      for (let item of this.formulas) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.formulas.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.formulas[i];
        let rightItem = expression.formulas[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_equiv extends Fmt.MetaRefExpression {
  left: Fmt.Expression;
  right: Fmt.Expression;

  getName(): string {
    return 'equiv';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.left = argumentList.getValue('left', 0);
    this.right = argumentList.getValue('right', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.left, undefined, false);
    argumentList.add(this.right, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_equiv;
    let changed = false;
    if (this.left) {
      result.left = this.left.substitute(fn, replacedParameters);
      if (result.left !== this.left) {
        changed = true;
      }
    }
    if (this.right) {
      result.right = this.right.substitute(fn, replacedParameters);
      if (result.right !== this.right) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_equiv)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.left, expression.left, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.right, expression.right, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_forall extends Fmt.MetaRefExpression {
  parameters: Fmt.ParameterList;
  formula: Fmt.Expression;

  getName(): string {
    return 'forall';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters = this.parameters;
    argumentList.add(parametersExpr, undefined, false);
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_forall;
    let changed = false;
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  parameters: Fmt.ParameterList;
  formula?: Fmt.Expression;

  getName(): string {
    return 'exists';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getOptionalValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters = this.parameters;
    argumentList.add(parametersExpr, undefined, false);
    if (this.formula !== undefined) {
      argumentList.add(this.formula, 'formula', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_exists;
    let changed = false;
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  parameters: Fmt.ParameterList;
  formula?: Fmt.Expression;

  getName(): string {
    return 'existsUnique';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getOptionalValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters = this.parameters;
    argumentList.add(parametersExpr, undefined, false);
    if (this.formula !== undefined) {
      argumentList.add(this.formula, 'formula', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_existsUnique;
    let changed = false;
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  element: Fmt.Expression;
  _set: Fmt.Expression;

  getName(): string {
    return 'in';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.element = argumentList.getValue('element', 0);
    this._set = argumentList.getValue('set', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.element, undefined, false);
    argumentList.add(this._set, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_in;
    let changed = false;
    if (this.element) {
      result.element = this.element.substitute(fn, replacedParameters);
      if (result.element !== this.element) {
        changed = true;
      }
    }
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  subset: Fmt.Expression;
  superset: Fmt.Expression;

  getName(): string {
    return 'sub';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.subset = argumentList.getValue('subset', 0);
    this.superset = argumentList.getValue('superset', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.subset, undefined, false);
    argumentList.add(this.superset, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_sub;
    let changed = false;
    if (this.subset) {
      result.subset = this.subset.substitute(fn, replacedParameters);
      if (result.subset !== this.subset) {
        changed = true;
      }
    }
    if (this.superset) {
      result.superset = this.superset.substitute(fn, replacedParameters);
      if (result.superset !== this.superset) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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

  getName(): string {
    return 'setEquals';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.terms = [];
    let index = 0;
    for (;;) {
      let termsRaw = argumentList.getOptionalValue(undefined, index);
      if (termsRaw === undefined) {
        break;
      }
      this.terms!.push(termsRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    for (let termsArg of this.terms) {
      argumentList.add(termsArg, undefined, true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_setEquals;
    let changed = false;
    if (this.terms) {
      result.terms = [];
      for (let item of this.terms) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.terms.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.terms[i];
        let rightItem = expression.terms[i];
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

  getName(): string {
    return 'equals';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.terms = [];
    let index = 0;
    for (;;) {
      let termsRaw = argumentList.getOptionalValue(undefined, index);
      if (termsRaw === undefined) {
        break;
      }
      this.terms!.push(termsRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    for (let termsArg of this.terms) {
      argumentList.add(termsArg, undefined, true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_equals;
    let changed = false;
    if (this.terms) {
      result.terms = [];
      for (let item of this.terms) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.terms.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.terms[i];
        let rightItem = expression.terms[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_structural extends Fmt.MetaRefExpression {
  term: Fmt.Expression;
  construction: Fmt.Expression;
  cases: ObjectContents_StructuralCase[];

  getName(): string {
    return 'structural';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item, reportFn);
          this.cases.push(newItem);
          reportFn?.(item, newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem, true, reportFn);
      casesExpr.items.push(newItem);
      reportFn?.(newItem, item);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_structural;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    if (this.construction) {
      result.construction = this.construction.substitute(fn, replacedParameters);
      if (result.construction !== this.construction) {
        changed = true;
      }
    }
    if (this.cases) {
      result.cases = [];
      for (let item of this.cases) {
        let newItem = new ObjectContents_StructuralCase;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.cases.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class ObjectContents_Proof extends Fmt.ObjectContents {
  _from?: Fmt.BN;
  _to?: Fmt.BN;
  parameters?: Fmt.ParameterList;
  goal?: Fmt.Expression;
  steps: Fmt.ParameterList;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let fromRaw = argumentList.getOptionalValue('from', 0);
    if (fromRaw !== undefined) {
      if (fromRaw instanceof Fmt.IntegerExpression) {
        this._from = fromRaw.value;
      } else {
        throw new Error('from: Integer expected');
      }
    }
    let toRaw = argumentList.getOptionalValue('to', 1);
    if (toRaw !== undefined) {
      if (toRaw instanceof Fmt.IntegerExpression) {
        this._to = toRaw.value;
      } else {
        throw new Error('to: Integer expected');
      }
    }
    let parametersRaw = argumentList.getOptionalValue('parameters', 2);
    if (parametersRaw !== undefined) {
      if (parametersRaw instanceof Fmt.ParameterExpression) {
        this.parameters = parametersRaw.parameters;
      } else {
        throw new Error('parameters: Parameter expression expected');
      }
    }
    this.goal = argumentList.getOptionalValue('goal', 3);
    let stepsRaw = argumentList.getValue('steps', 4);
    if (stepsRaw instanceof Fmt.ParameterExpression) {
      this.steps = stepsRaw.parameters;
    } else {
      throw new Error('steps: Parameter expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this._from !== undefined) {
      let fromExpr = new Fmt.IntegerExpression;
      fromExpr.value = this._from;
      argumentList.add(fromExpr, 'from', true);
    }
    if (this._to !== undefined) {
      let toExpr = new Fmt.IntegerExpression;
      toExpr.value = this._to;
      argumentList.add(toExpr, 'to', true);
    }
    if (this.parameters !== undefined) {
      let parametersExpr = new Fmt.ParameterExpression;
      parametersExpr.parameters = this.parameters;
      argumentList.add(parametersExpr, 'parameters', true);
    }
    if (this.goal !== undefined) {
      argumentList.add(this.goal, 'goal', true);
    }
    let stepsExpr = new Fmt.ParameterExpression;
    stepsExpr.parameters = this.steps;
    argumentList.add(stepsExpr, 'steps', false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Proof {
    let result = new ObjectContents_Proof;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Proof, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    result._from = this._from;
    result._to = this._to;
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
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
      result.steps = Object.create(Fmt.ParameterList.prototype);
      if (this.steps.substituteExpression(fn, result.steps!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Proof, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this._from !== undefined || objectContents._from !== undefined) {
      if (this._from === undefined || objectContents._from === undefined || !this._from.eq(objectContents._from)) {
        return false;
      }
    }
    if (this._to !== undefined || objectContents._to !== undefined) {
      if (this._to === undefined || objectContents._to === undefined || !this._to.eq(objectContents._to)) {
        return false;
      }
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
  variable: Fmt.Expression;
  index?: Fmt.BN;

  getName(): string {
    return 'Consider';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.variable = argumentList.getValue('variable', 0);
    let indexRaw = argumentList.getOptionalValue('index', 1);
    if (indexRaw !== undefined) {
      if (indexRaw instanceof Fmt.IntegerExpression) {
        this.index = indexRaw.value;
      } else {
        throw new Error('index: Integer expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.variable, undefined, false);
    if (this.index !== undefined) {
      let indexExpr = new Fmt.IntegerExpression;
      indexExpr.value = this.index;
      argumentList.add(indexExpr, 'index', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Consider;
    let changed = false;
    if (this.variable) {
      result.variable = this.variable.substitute(fn, replacedParameters);
      if (result.variable !== this.variable) {
        changed = true;
      }
    }
    result.index = this.index;
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Consider)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.variable, expression.variable, fn, replacedParameters)) {
      return false;
    }
    if (this.index !== undefined || expression.index !== undefined) {
      if (this.index === undefined || expression.index === undefined || !this.index.eq(expression.index)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_State extends Fmt.MetaRefExpression {
  statement: Fmt.Expression;
  proof?: ObjectContents_Proof;

  getName(): string {
    return 'State';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.statement = argumentList.getValue('statement', 0);
    let proofRaw = argumentList.getOptionalValue('proof', 1);
    if (proofRaw !== undefined) {
      if (proofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(proofRaw, reportFn);
        this.proof = newItem;
        reportFn?.(proofRaw, newItem);
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.statement, undefined, false);
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr, true, reportFn);
      argumentList.add(proofExpr, 'proof', true);
      reportFn?.(proofExpr, this.proof);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_State;
    let changed = false;
    if (this.statement) {
      result.statement = this.statement.substitute(fn, replacedParameters);
      if (result.statement !== this.statement) {
        changed = true;
      }
    }
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  side?: Fmt.BN;
  result: Fmt.Expression;

  getName(): string {
    return 'UseDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    this.result = argumentList.getValue('result', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      let sideExpr = new Fmt.IntegerExpression;
      sideExpr.value = this.side;
      argumentList.add(sideExpr, 'side', true);
    }
    argumentList.add(this.result, 'result', false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UseDef;
    let changed = false;
    result.side = this.side;
    if (this.result) {
      result.result = this.result.substitute(fn, replacedParameters);
      if (result.result !== this.result) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseDef)) {
      return false;
    }
    if (this.side !== undefined || expression.side !== undefined) {
      if (this.side === undefined || expression.side === undefined || !this.side.eq(expression.side)) {
        return false;
      }
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UseCases extends Fmt.MetaRefExpression {
  side?: Fmt.BN;
  caseProofs: ObjectContents_Proof[];

  getName(): string {
    return 'UseCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    let caseProofsRaw = argumentList.getValue('caseProofs', 1);
    if (caseProofsRaw instanceof Fmt.ArrayExpression) {
      this.caseProofs = [];
      for (let item of caseProofsRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_Proof;
          newItem.fromCompoundExpression(item, reportFn);
          this.caseProofs.push(newItem);
          reportFn?.(item, newItem);
        } else {
          throw new Error('caseProofs: Compound expression expected');
        }
      }
    } else {
      throw new Error('caseProofs: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      let sideExpr = new Fmt.IntegerExpression;
      sideExpr.value = this.side;
      argumentList.add(sideExpr, 'side', true);
    }
    let caseProofsExpr = new Fmt.ArrayExpression;
    caseProofsExpr.items = [];
    for (let item of this.caseProofs) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem, true, reportFn);
      caseProofsExpr.items.push(newItem);
      reportFn?.(newItem, item);
    }
    argumentList.add(caseProofsExpr, 'caseProofs', false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UseCases;
    let changed = false;
    result.side = this.side;
    if (this.caseProofs) {
      result.caseProofs = [];
      for (let item of this.caseProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.caseProofs.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseCases)) {
      return false;
    }
    if (this.side !== undefined || expression.side !== undefined) {
      if (this.side === undefined || expression.side === undefined || !this.side.eq(expression.side)) {
        return false;
      }
    }
    if (this.caseProofs || expression.caseProofs) {
      if (!this.caseProofs || !expression.caseProofs || this.caseProofs.length !== expression.caseProofs.length) {
        return false;
      }
      for (let i = 0; i < this.caseProofs.length; i++) {
        let leftItem = this.caseProofs[i];
        let rightItem = expression.caseProofs[i];
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

  getName(): string {
    return 'UseForAll';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let argumentsRaw = argumentList.getValue('arguments', 0);
    if (argumentsRaw instanceof Fmt.CompoundExpression) {
      this.arguments = argumentsRaw.arguments;
    } else {
      throw new Error('arguments: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let argumentsExpr = new Fmt.CompoundExpression;
    argumentsExpr.arguments = this.arguments;
    argumentList.add(argumentsExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UseForAll;
    let changed = false;
    if (this.arguments) {
      result.arguments = Object.create(Fmt.ArgumentList.prototype);
      if (this.arguments.substituteExpression(fn, result.arguments!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  parameters: Fmt.ParameterList;

  getName(): string {
    return 'UseExists';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters = this.parameters;
    argumentList.add(parametersExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UseExists;
    let changed = false;
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  source: Fmt.Parameter;
  sourceSide: Fmt.BN;
  result: Fmt.Expression;

  getName(): string {
    return 'Substitute';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let sourceRaw = argumentList.getValue('source', 0);
    if (sourceRaw instanceof Fmt.ParameterExpression && sourceRaw.parameters.length === 1) {
      this.source = sourceRaw.parameters[0];
    } else {
      throw new Error('source: Parameter expression with single parameter expected');
    }
    let sourceSideRaw = argumentList.getValue('sourceSide', 1);
    if (sourceSideRaw instanceof Fmt.IntegerExpression) {
      this.sourceSide = sourceSideRaw.value;
    } else {
      throw new Error('sourceSide: Integer expected');
    }
    this.result = argumentList.getValue('result', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let sourceExpr = new Fmt.ParameterExpression;
    sourceExpr.parameters.push(this.source);
    argumentList.add(sourceExpr, undefined, false);
    let sourceSideExpr = new Fmt.IntegerExpression;
    sourceSideExpr.value = this.sourceSide;
    argumentList.add(sourceSideExpr, undefined, false);
    argumentList.add(this.result, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Substitute;
    let changed = false;
    if (this.source) {
      result.source = this.source.substituteExpression(fn, replacedParameters);
      if (result.source !== this.source) {
        changed = true;
      }
    }
    result.sourceSide = this.sourceSide;
    if (this.result) {
      result.result = this.result.substitute(fn, replacedParameters);
      if (result.result !== this.result) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Substitute)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.source, expression.source, fn, replacedParameters)) {
      return false;
    }
    if (this.sourceSide !== undefined || expression.sourceSide !== undefined) {
      if (this.sourceSide === undefined || expression.sourceSide === undefined || !this.sourceSide.eq(expression.sourceSide)) {
        return false;
      }
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UnfoldDef extends Fmt.MetaRefExpression {
  result: Fmt.Expression;

  getName(): string {
    return 'UnfoldDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.result = argumentList.getValue('result', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.result, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UnfoldDef;
    let changed = false;
    if (this.result) {
      result.result = this.result.substitute(fn, replacedParameters);
      if (result.result !== this.result) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UnfoldDef)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_UseTheorem extends Fmt.MetaRefExpression {
  theorem: Fmt.Expression;
  result: Fmt.Expression;

  getName(): string {
    return 'UseTheorem';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.theorem = argumentList.getValue('theorem', 0);
    this.result = argumentList.getValue('result', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.theorem, undefined, false);
    argumentList.add(this.result, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UseTheorem;
    let changed = false;
    if (this.theorem) {
      result.theorem = this.theorem.substitute(fn, replacedParameters);
      if (result.theorem !== this.theorem) {
        changed = true;
      }
    }
    if (this.result) {
      result.result = this.result.substitute(fn, replacedParameters);
      if (result.result !== this.result) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseTheorem)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.theorem, expression.theorem, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.result, expression.result, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveDef extends Fmt.MetaRefExpression {
  side?: Fmt.BN;
  proof?: ObjectContents_Proof;

  getName(): string {
    return 'ProveDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    let proofRaw = argumentList.getOptionalValue('proof', 1);
    if (proofRaw !== undefined) {
      if (proofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(proofRaw, reportFn);
        this.proof = newItem;
        reportFn?.(proofRaw, newItem);
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      let sideExpr = new Fmt.IntegerExpression;
      sideExpr.value = this.side;
      argumentList.add(sideExpr, 'side', true);
    }
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr, true, reportFn);
      argumentList.add(proofExpr, 'proof', true);
      reportFn?.(proofExpr, this.proof);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveDef;
    let changed = false;
    result.side = this.side;
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveDef)) {
      return false;
    }
    if (this.side !== undefined || expression.side !== undefined) {
      if (this.side === undefined || expression.side === undefined || !this.side.eq(expression.side)) {
        return false;
      }
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveNeg extends Fmt.MetaRefExpression {
  proof: ObjectContents_Proof;

  getName(): string {
    return 'ProveNeg';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let proofRaw = argumentList.getValue('proof', 0);
    if (proofRaw instanceof Fmt.CompoundExpression) {
      let newItem = new ObjectContents_Proof;
      newItem.fromCompoundExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    } else {
      throw new Error('proof: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let proofExpr = new Fmt.CompoundExpression;
    this.proof.toCompoundExpression(proofExpr, true, reportFn);
    argumentList.add(proofExpr, undefined, false);
    reportFn?.(proofExpr, this.proof);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveNeg;
    let changed = false;
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveNeg)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.proof, expression.proof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveForAll extends Fmt.MetaRefExpression {
  proof: ObjectContents_Proof;

  getName(): string {
    return 'ProveForAll';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let proofRaw = argumentList.getValue('proof', 0);
    if (proofRaw instanceof Fmt.CompoundExpression) {
      let newItem = new ObjectContents_Proof;
      newItem.fromCompoundExpression(proofRaw, reportFn);
      this.proof = newItem;
      reportFn?.(proofRaw, newItem);
    } else {
      throw new Error('proof: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let proofExpr = new Fmt.CompoundExpression;
    this.proof.toCompoundExpression(proofExpr, true, reportFn);
    argumentList.add(proofExpr, undefined, false);
    reportFn?.(proofExpr, this.proof);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveForAll;
    let changed = false;
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
  proof?: ObjectContents_Proof;

  getName(): string {
    return 'ProveExists';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let argumentsRaw = argumentList.getValue('arguments', 0);
    if (argumentsRaw instanceof Fmt.CompoundExpression) {
      this.arguments = argumentsRaw.arguments;
    } else {
      throw new Error('arguments: Compound expression expected');
    }
    let proofRaw = argumentList.getOptionalValue('proof', 1);
    if (proofRaw !== undefined) {
      if (proofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(proofRaw, reportFn);
        this.proof = newItem;
        reportFn?.(proofRaw, newItem);
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let argumentsExpr = new Fmt.CompoundExpression;
    argumentsExpr.arguments = this.arguments;
    argumentList.add(argumentsExpr, undefined, false);
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr, true, reportFn);
      argumentList.add(proofExpr, 'proof', true);
      reportFn?.(proofExpr, this.proof);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveExists;
    let changed = false;
    if (this.arguments) {
      result.arguments = Object.create(Fmt.ArgumentList.prototype);
      if (this.arguments.substituteExpression(fn, result.arguments!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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

export class MetaRefExpression_ProveSetEquals extends Fmt.MetaRefExpression {
  subsetProof?: ObjectContents_Proof;
  supersetProof?: ObjectContents_Proof;

  getName(): string {
    return 'ProveSetEquals';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let subsetProofRaw = argumentList.getOptionalValue('subsetProof', 0);
    if (subsetProofRaw !== undefined) {
      if (subsetProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(subsetProofRaw, reportFn);
        this.subsetProof = newItem;
        reportFn?.(subsetProofRaw, newItem);
      } else {
        throw new Error('subsetProof: Compound expression expected');
      }
    }
    let supersetProofRaw = argumentList.getOptionalValue('supersetProof', 1);
    if (supersetProofRaw !== undefined) {
      if (supersetProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(supersetProofRaw, reportFn);
        this.supersetProof = newItem;
        reportFn?.(supersetProofRaw, newItem);
      } else {
        throw new Error('supersetProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.subsetProof !== undefined) {
      let subsetProofExpr = new Fmt.CompoundExpression;
      this.subsetProof.toCompoundExpression(subsetProofExpr, true, reportFn);
      argumentList.add(subsetProofExpr, 'subsetProof', true);
      reportFn?.(subsetProofExpr, this.subsetProof);
    }
    if (this.supersetProof !== undefined) {
      let supersetProofExpr = new Fmt.CompoundExpression;
      this.supersetProof.toCompoundExpression(supersetProofExpr, true, reportFn);
      argumentList.add(supersetProofExpr, 'supersetProof', true);
      reportFn?.(supersetProofExpr, this.supersetProof);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveSetEquals;
    let changed = false;
    if (this.subsetProof) {
      result.subsetProof = new ObjectContents_Proof;
      if (this.subsetProof.substituteExpression(fn, result.subsetProof!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.supersetProof) {
      result.supersetProof = new ObjectContents_Proof;
      if (this.supersetProof.substituteExpression(fn, result.supersetProof!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveSetEquals)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.subsetProof, expression.subsetProof, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.supersetProof, expression.supersetProof, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ProveCases extends Fmt.MetaRefExpression {
  side?: Fmt.BN;
  caseProofs: ObjectContents_Proof[];

  getName(): string {
    return 'ProveCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let sideRaw = argumentList.getOptionalValue('side', 0);
    if (sideRaw !== undefined) {
      if (sideRaw instanceof Fmt.IntegerExpression) {
        this.side = sideRaw.value;
      } else {
        throw new Error('side: Integer expected');
      }
    }
    let caseProofsRaw = argumentList.getValue('caseProofs', 1);
    if (caseProofsRaw instanceof Fmt.ArrayExpression) {
      this.caseProofs = [];
      for (let item of caseProofsRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_Proof;
          newItem.fromCompoundExpression(item, reportFn);
          this.caseProofs.push(newItem);
          reportFn?.(item, newItem);
        } else {
          throw new Error('caseProofs: Compound expression expected');
        }
      }
    } else {
      throw new Error('caseProofs: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      let sideExpr = new Fmt.IntegerExpression;
      sideExpr.value = this.side;
      argumentList.add(sideExpr, 'side', true);
    }
    let caseProofsExpr = new Fmt.ArrayExpression;
    caseProofsExpr.items = [];
    for (let item of this.caseProofs) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem, true, reportFn);
      caseProofsExpr.items.push(newItem);
      reportFn?.(newItem, item);
    }
    argumentList.add(caseProofsExpr, 'caseProofs', false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveCases;
    let changed = false;
    result.side = this.side;
    if (this.caseProofs) {
      result.caseProofs = [];
      for (let item of this.caseProofs) {
        let newItem = new ObjectContents_Proof;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.caseProofs.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveCases)) {
      return false;
    }
    if (this.side !== undefined || expression.side !== undefined) {
      if (this.side === undefined || expression.side === undefined || !this.side.eq(expression.side)) {
        return false;
      }
    }
    if (this.caseProofs || expression.caseProofs) {
      if (!this.caseProofs || !expression.caseProofs || this.caseProofs.length !== expression.caseProofs.length) {
        return false;
      }
      for (let i = 0; i < this.caseProofs.length; i++) {
        let leftItem = this.caseProofs[i];
        let rightItem = expression.caseProofs[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveByInduction extends Fmt.MetaRefExpression {
  term: Fmt.Expression;
  construction: Fmt.Expression;
  cases: ObjectContents_StructuralCase[];

  getName(): string {
    return 'ProveByInduction';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item, reportFn);
          this.cases.push(newItem);
          reportFn?.(item, newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem, true, reportFn);
      casesExpr.items.push(newItem);
      reportFn?.(newItem, item);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveByInduction;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    if (this.construction) {
      result.construction = this.construction.substitute(fn, replacedParameters);
      if (result.construction !== this.construction) {
        changed = true;
      }
    }
    if (this.cases) {
      result.cases = [];
      for (let item of this.cases) {
        let newItem = new ObjectContents_StructuralCase;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.cases.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
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
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class ObjectContents_Case extends Fmt.ObjectContents {
  formula: Fmt.Expression;
  value: Fmt.Expression;
  exclusivityProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.formula = argumentList.getValue('formula', 0);
    this.value = argumentList.getValue('value', 1);
    let exclusivityProofRaw = argumentList.getOptionalValue('exclusivityProof', 2);
    if (exclusivityProofRaw !== undefined) {
      if (exclusivityProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(exclusivityProofRaw, reportFn);
        this.exclusivityProof = newItem;
        reportFn?.(exclusivityProofRaw, newItem);
      } else {
        throw new Error('exclusivityProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this.formula, outputAllNames ? 'formula' : undefined, false);
    argumentList.add(this.value, outputAllNames ? 'value' : undefined, false);
    if (this.exclusivityProof !== undefined) {
      let exclusivityProofExpr = new Fmt.CompoundExpression;
      this.exclusivityProof.toCompoundExpression(exclusivityProofExpr, true, reportFn);
      argumentList.add(exclusivityProofExpr, 'exclusivityProof', true);
      reportFn?.(exclusivityProofExpr, this.exclusivityProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Case {
    let result = new ObjectContents_Case;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_Case, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
      result.exclusivityProof = new ObjectContents_Proof;
      if (this.exclusivityProof.substituteExpression(fn, result.exclusivityProof!, replacedParameters)) {
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
  _constructor: Fmt.Expression;
  parameters?: Fmt.ParameterList;
  value: Fmt.Expression;
  rewrite?: Fmt.Expression;
  wellDefinednessProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this._constructor = argumentList.getValue('constructor', 0);
    let parametersRaw = argumentList.getOptionalValue('parameters', 1);
    if (parametersRaw !== undefined) {
      if (parametersRaw instanceof Fmt.ParameterExpression) {
        this.parameters = parametersRaw.parameters;
      } else {
        throw new Error('parameters: Parameter expression expected');
      }
    }
    this.value = argumentList.getValue('value', 2);
    this.rewrite = argumentList.getOptionalValue('rewrite', 3);
    let wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 4);
    if (wellDefinednessProofRaw !== undefined) {
      if (wellDefinednessProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(wellDefinednessProofRaw, reportFn);
        this.wellDefinednessProof = newItem;
        reportFn?.(wellDefinednessProofRaw, newItem);
      } else {
        throw new Error('wellDefinednessProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    argumentList.add(this._constructor, outputAllNames ? 'constructor' : undefined, false);
    if (this.parameters !== undefined) {
      let parametersExpr = new Fmt.ParameterExpression;
      parametersExpr.parameters = this.parameters;
      argumentList.add(parametersExpr, 'parameters', true);
    }
    argumentList.add(this.value, 'value', false);
    if (this.rewrite !== undefined) {
      argumentList.add(this.rewrite, 'rewrite', true);
    }
    if (this.wellDefinednessProof !== undefined) {
      let wellDefinednessProofExpr = new Fmt.CompoundExpression;
      this.wellDefinednessProof.toCompoundExpression(wellDefinednessProofExpr, true, reportFn);
      argumentList.add(wellDefinednessProofExpr, 'wellDefinednessProof', true);
      reportFn?.(wellDefinednessProofExpr, this.wellDefinednessProof);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_StructuralCase {
    let result = new ObjectContents_StructuralCase;
    this.substituteExpression(undefined, result, replacedParameters);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_StructuralCase, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this._constructor) {
      result._constructor = this._constructor.substitute(fn, replacedParameters);
      if (result._constructor !== this._constructor) {
        changed = true;
      }
    }
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
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
      result.wellDefinednessProof = new ObjectContents_Proof;
      if (this.wellDefinednessProof.substituteExpression(fn, result.wellDefinednessProof!, replacedParameters)) {
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
  constructor(public objectContentsClass: {new(): Fmt.ObjectContents}, parentContext: Ctx.Context) {
    super(parentContext);
  }
}

const definitionTypes: Fmt.MetaDefinitionList = {'Construction': MetaRefExpression_Construction, 'SetOperator': MetaRefExpression_SetOperator, 'ExplicitOperator': MetaRefExpression_ExplicitOperator, 'ImplicitOperator': MetaRefExpression_ImplicitOperator, 'MacroOperator': MetaRefExpression_MacroOperator, 'Predicate': MetaRefExpression_Predicate, 'StandardTheorem': MetaRefExpression_StandardTheorem, 'EquivalenceTheorem': MetaRefExpression_EquivalenceTheorem};
const expressionTypes: Fmt.MetaDefinitionList = {'Bool': MetaRefExpression_Bool, 'Nat': MetaRefExpression_Nat, 'Prop': MetaRefExpression_Prop, 'Set': MetaRefExpression_Set, 'Subset': MetaRefExpression_Subset, 'Element': MetaRefExpression_Element, 'Constraint': MetaRefExpression_Constraint, 'Binder': MetaRefExpression_Binder, 'SetDef': MetaRefExpression_SetDef, 'Def': MetaRefExpression_Def, 'Consider': MetaRefExpression_Consider, 'State': MetaRefExpression_State, 'UseDef': MetaRefExpression_UseDef, 'UseCases': MetaRefExpression_UseCases, 'UseForAll': MetaRefExpression_UseForAll, 'UseExists': MetaRefExpression_UseExists, 'Substitute': MetaRefExpression_Substitute, 'UnfoldDef': MetaRefExpression_UnfoldDef, 'UseTheorem': MetaRefExpression_UseTheorem, 'ProveDef': MetaRefExpression_ProveDef, 'ProveNeg': MetaRefExpression_ProveNeg, 'ProveForAll': MetaRefExpression_ProveForAll, 'ProveExists': MetaRefExpression_ProveExists, 'ProveSetEquals': MetaRefExpression_ProveSetEquals, 'ProveCases': MetaRefExpression_ProveCases, 'ProveByInduction': MetaRefExpression_ProveByInduction};
const functions: Fmt.MetaDefinitionList = {'true': MetaRefExpression_true, 'false': MetaRefExpression_false, 'enumeration': MetaRefExpression_enumeration, 'subset': MetaRefExpression_subset, 'extendedSubset': MetaRefExpression_extendedSubset, 'setStructuralCases': MetaRefExpression_setStructuralCases, 'setAssociative': MetaRefExpression_setAssociative, 'cases': MetaRefExpression_cases, 'structuralCases': MetaRefExpression_structuralCases, 'asElementOf': MetaRefExpression_asElementOf, 'associative': MetaRefExpression_associative, 'not': MetaRefExpression_not, 'and': MetaRefExpression_and, 'or': MetaRefExpression_or, 'equiv': MetaRefExpression_equiv, 'forall': MetaRefExpression_forall, 'exists': MetaRefExpression_exists, 'existsUnique': MetaRefExpression_existsUnique, 'in': MetaRefExpression_in, 'sub': MetaRefExpression_sub, 'setEquals': MetaRefExpression_setEquals, 'equals': MetaRefExpression_equals, 'structural': MetaRefExpression_structural, '': Fmt.GenericMetaRefExpression};

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
    let parent = previousContext.parentObject;
    if (parent instanceof Fmt.Definition) {
      let type = parent.type;
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
    let parent = context.parentObject;
    if (parent instanceof Fmt.Definition) {
      let type = parent.type;
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
            context = new ArgumentTypeContext(ObjectContents_EqualityDefinition, context);
          }
          if (argument.name === 'rewrite' || (argument.name === undefined && argumentIndex === 5)) {
            context = new ArgumentTypeContext(ObjectContents_RewriteDefinition, context);
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
            let parameterValue = previousArguments.getOptionalValue('parameter', 0);
            if (parameterValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(parameterValue.parameters, context);
            }
          }
          if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 6)) {
            let parameterValue = previousArguments.getOptionalValue('parameter', 0);
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
            let variablesValue = previousArguments.getOptionalValue('variables', 0);
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
              let parameterValue = previousArguments.getOptionalValue('parameter', 0);
              if (parameterValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parameterValue.parameters, context);
              }
            }
            if (argument.name === 'wellDefinednessProof' || (argument.name === undefined && argumentIndex === 3)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_EqualityDefinition) {
            if (argument.name === 'definition' || (argument.name === undefined && argumentIndex === 2)) {
              let leftParametersValue = previousArguments.getOptionalValue('leftParameters', 0);
              if (leftParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(leftParametersValue.parameters, context);
              }
              let rightParametersValue = previousArguments.getOptionalValue('rightParameters', 1);
              if (rightParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(rightParametersValue.parameters, context);
              }
            }
            if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 3)) {
              let leftParametersValue = previousArguments.getOptionalValue('leftParameters', 0);
              if (leftParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(leftParametersValue.parameters, context);
              }
              let rightParametersValue = previousArguments.getOptionalValue('rightParameters', 1);
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
              let sourceParametersValue = previousArguments.getOptionalValue('sourceParameters', 0);
              if (sourceParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(sourceParametersValue.parameters, context);
              }
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_Proof) {
            if (argument.name === 'goal' || (argument.name === undefined && argumentIndex === 3)) {
              let parametersValue = previousArguments.getOptionalValue('parameters', 2);
              if (parametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parametersValue.parameters, context);
              }
            }
            if (argument.name === 'steps' || (argument.name === undefined && argumentIndex === 4)) {
              let parametersValue = previousArguments.getOptionalValue('parameters', 2);
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
              let parametersValue = previousArguments.getOptionalValue('parameters', 1);
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
          let sourceParametersValue = previousArguments.getOptionalValue('sourceParameters', 0);
          if (sourceParametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(sourceParametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_subset) {
        if (argument.name === 'formula' || (argument.name === undefined && argumentIndex === 1)) {
          let parameterValue = previousArguments.getOptionalValue('parameter', 0);
          if (parameterValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parameterValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_extendedSubset) {
        if (argument.name === 'term' || (argument.name === undefined && argumentIndex === 1)) {
          let parametersValue = previousArguments.getOptionalValue('parameters', 0);
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
          let parametersValue = previousArguments.getOptionalValue('parameters', 0);
          if (parametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_exists) {
        if (argument.name === 'formula' || (argument.name === undefined && argumentIndex === 1)) {
          let parametersValue = previousArguments.getOptionalValue('parameters', 0);
          if (parametersValue instanceof Fmt.ParameterExpression) {
            context = this.getParameterListContext(parametersValue.parameters, context);
          }
        }
      }
      if (parent instanceof MetaRefExpression_existsUnique) {
        if (argument.name === 'formula' || (argument.name === undefined && argumentIndex === 1)) {
          let parametersValue = previousArguments.getOptionalValue('parameters', 0);
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
      if (parent instanceof MetaRefExpression_ProveNeg) {
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
      if (parent instanceof MetaRefExpression_ProveSetEquals) {
        if (argument.name === 'subsetProof' || (argument.name === undefined && argumentIndex === 0)) {
          context = new ArgumentTypeContext(ObjectContents_Proof, context);
        }
        if (argument.name === 'supersetProof' || (argument.name === undefined && argumentIndex === 1)) {
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
