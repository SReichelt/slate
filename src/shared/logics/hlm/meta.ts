// Generated from data/logics/hlm.slate by generateMetaDeclarations.ts.
// tslint:disable:class-name
// tslint:disable:variable-name

import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as Meta from '../../format/metaModel';
import * as FmtDisplay from '../../display/meta';

export class ObjectContents_Definition extends Fmt.ObjectContents {
  properties?: ObjectContents_Property[];
  display?: Fmt.Expression;
  definitionDisplay?: ObjectContents_DefinitionDisplay;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let propertiesRaw = argumentList.getOptionalValue('properties', 0);
    if (propertiesRaw !== undefined) {
      if (propertiesRaw instanceof Fmt.ArrayExpression) {
        this.properties = [];
        for (let item of propertiesRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Property;
            newItem.fromCompoundExpression(item);
            this.properties.push(newItem);
          } else {
            throw new Error('properties: Compound expression expected');
          }
        }
      } else {
        throw new Error('properties: Array expression expected');
      }
    }
    this.display = argumentList.getOptionalValue('display', 1);
    let definitionDisplayRaw = argumentList.getOptionalValue('definitionDisplay', 2);
    if (definitionDisplayRaw !== undefined) {
      if (definitionDisplayRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_DefinitionDisplay;
        newItem.fromCompoundExpression(definitionDisplayRaw);
        this.definitionDisplay = newItem;
      } else {
        throw new Error('definitionDisplay: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.properties !== undefined) {
      let propertiesExpr = new Fmt.ArrayExpression;
      propertiesExpr.items = [];
      for (let item of this.properties) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        propertiesExpr.items.push(newItem);
      }
      argumentList.add(propertiesExpr, 'properties', true);
    }
    if (this.display !== undefined) {
      argumentList.add(this.display, 'display', true);
    }
    if (this.definitionDisplay !== undefined) {
      let definitionDisplayExpr = new Fmt.CompoundExpression;
      this.definitionDisplay.toCompoundExpression(definitionDisplayExpr);
      argumentList.add(definitionDisplayExpr, 'definitionDisplay', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Definition {
    let result = new ObjectContents_Definition;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Definition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.properties) {
      result.properties = [];
      for (let item of this.properties) {
        let newItem = new ObjectContents_Property;
        if (item.substituteExpression(fn, newItem!, replacedParameters)) {
          changed = true;
        }
        result.properties.push(newItem);
      }
    }
    if (this.display) {
      result.display = this.display.substitute(fn, replacedParameters);
      if (result.display !== this.display) {
        changed = true;
      }
    }
    if (this.definitionDisplay) {
      result.definitionDisplay = new ObjectContents_DefinitionDisplay;
      if (this.definitionDisplay.substituteExpression(fn, result.definitionDisplay!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Definition, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.properties || objectContents.properties) {
      if (!this.properties || !objectContents.properties || this.properties.length !== objectContents.properties.length) {
        return false;
      }
      for (let i = 0; i < this.properties.length; i++) {
        let leftItem = this.properties[i];
        let rightItem = objectContents.properties[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    if (this.display || objectContents.display) {
      if (!this.display || !objectContents.display || !this.display.isEquivalentTo(objectContents.display, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.definitionDisplay || objectContents.definitionDisplay) {
      if (!this.definitionDisplay || !objectContents.definitionDisplay || !this.definitionDisplay.isEquivalentTo(objectContents.definitionDisplay, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_DefinitionDisplay extends Fmt.ObjectContents {
  parameter: Fmt.Parameter;
  display?: Fmt.Expression;
  singularName?: Fmt.Expression;
  pluralName?: Fmt.Expression;
  nameOptional?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.display = argumentList.getOptionalValue('display', 1);
    this.singularName = argumentList.getOptionalValue('singularName', 2);
    this.pluralName = argumentList.getOptionalValue('pluralName', 3);
    this.nameOptional = argumentList.getOptionalValue('nameOptional', 4);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, 'parameter', false);
    if (this.display !== undefined) {
      argumentList.add(this.display, 'display', true);
    }
    if (this.singularName !== undefined) {
      argumentList.add(this.singularName, 'singularName', true);
    }
    if (this.pluralName !== undefined) {
      argumentList.add(this.pluralName, 'pluralName', true);
    }
    if (this.nameOptional !== undefined) {
      argumentList.add(this.nameOptional, 'nameOptional', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_DefinitionDisplay {
    let result = new ObjectContents_DefinitionDisplay;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_DefinitionDisplay, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.parameter) {
      result.parameter = this.parameter.substituteExpression(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.display) {
      result.display = this.display.substitute(fn, replacedParameters);
      if (result.display !== this.display) {
        changed = true;
      }
    }
    if (this.singularName) {
      result.singularName = this.singularName.substitute(fn, replacedParameters);
      if (result.singularName !== this.singularName) {
        changed = true;
      }
    }
    if (this.pluralName) {
      result.pluralName = this.pluralName.substitute(fn, replacedParameters);
      if (result.pluralName !== this.pluralName) {
        changed = true;
      }
    }
    if (this.nameOptional) {
      result.nameOptional = this.nameOptional.substitute(fn, replacedParameters);
      if (result.nameOptional !== this.nameOptional) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_DefinitionDisplay, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.parameter || objectContents.parameter) {
      if (!this.parameter || !objectContents.parameter || !this.parameter.isEquivalentTo(objectContents.parameter, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.display || objectContents.display) {
      if (!this.display || !objectContents.display || !this.display.isEquivalentTo(objectContents.display, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.singularName || objectContents.singularName) {
      if (!this.singularName || !objectContents.singularName || !this.singularName.isEquivalentTo(objectContents.singularName, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.pluralName || objectContents.pluralName) {
      if (!this.pluralName || !objectContents.pluralName || !this.pluralName.isEquivalentTo(objectContents.pluralName, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.nameOptional || objectContents.nameOptional) {
      if (!this.nameOptional || !objectContents.nameOptional || !this.nameOptional.isEquivalentTo(objectContents.nameOptional, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_Construction extends ObjectContents_Definition {
  embedding?: ObjectContents_Embedding;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    let embeddingRaw = argumentList.getOptionalValue('embedding', 3);
    if (embeddingRaw !== undefined) {
      if (embeddingRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Embedding;
        newItem.fromCompoundExpression(embeddingRaw);
        this.embedding = newItem;
      } else {
        throw new Error('embedding: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    if (this.embedding !== undefined) {
      let embeddingExpr = new Fmt.CompoundExpression;
      this.embedding.toCompoundExpression(embeddingExpr);
      argumentList.add(embeddingExpr, 'embedding', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Construction {
    let result = new ObjectContents_Construction;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Construction, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.embedding) {
      result.embedding = new ObjectContents_Embedding;
      if (this.embedding.substituteExpression(fn, result.embedding!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Construction, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.embedding || objectContents.embedding) {
      if (!this.embedding || !objectContents.embedding || !this.embedding.isEquivalentTo(objectContents.embedding, fn, replacedParameters)) {
        return false;
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_Construction extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Construction';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Construction;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  wellDefinednessProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.target = argumentList.getValue('target', 1);
    let wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 2);
    if (wellDefinednessProofRaw !== undefined) {
      if (wellDefinednessProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(wellDefinednessProofRaw);
        this.wellDefinednessProof = newItem;
      } else {
        throw new Error('wellDefinednessProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, 'parameter', false);
    argumentList.add(this.target, 'target', false);
    if (this.wellDefinednessProof !== undefined) {
      let wellDefinednessProofExpr = new Fmt.CompoundExpression;
      this.wellDefinednessProof.toCompoundExpression(wellDefinednessProofExpr);
      argumentList.add(wellDefinednessProofExpr, 'wellDefinednessProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Embedding {
    let result = new ObjectContents_Embedding;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Embedding, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
    if (this.wellDefinednessProof) {
      result.wellDefinednessProof = new ObjectContents_Proof;
      if (this.wellDefinednessProof.substituteExpression(fn, result.wellDefinednessProof!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Embedding, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.parameter || objectContents.parameter) {
      if (!this.parameter || !objectContents.parameter || !this.parameter.isEquivalentTo(objectContents.parameter, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.target || objectContents.target) {
      if (!this.target || !objectContents.target || !this.target.isEquivalentTo(objectContents.target, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.wellDefinednessProof || objectContents.wellDefinednessProof) {
      if (!this.wellDefinednessProof || !objectContents.wellDefinednessProof || !this.wellDefinednessProof.isEquivalentTo(objectContents.wellDefinednessProof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_Constructor extends ObjectContents_Definition {
  equalityDefinition?: ObjectContents_EqualityDefinition;
  rewrite?: ObjectContents_RewriteDefinition;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    let equalityDefinitionRaw = argumentList.getOptionalValue('equalityDefinition', 3);
    if (equalityDefinitionRaw !== undefined) {
      if (equalityDefinitionRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_EqualityDefinition;
        newItem.fromCompoundExpression(equalityDefinitionRaw);
        this.equalityDefinition = newItem;
      } else {
        throw new Error('equalityDefinition: Compound expression expected');
      }
    }
    let rewriteRaw = argumentList.getOptionalValue('rewrite', 4);
    if (rewriteRaw !== undefined) {
      if (rewriteRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_RewriteDefinition;
        newItem.fromCompoundExpression(rewriteRaw);
        this.rewrite = newItem;
      } else {
        throw new Error('rewrite: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    if (this.equalityDefinition !== undefined) {
      let equalityDefinitionExpr = new Fmt.CompoundExpression;
      this.equalityDefinition.toCompoundExpression(equalityDefinitionExpr);
      argumentList.add(equalityDefinitionExpr, 'equalityDefinition', true);
    }
    if (this.rewrite !== undefined) {
      let rewriteExpr = new Fmt.CompoundExpression;
      this.rewrite.toCompoundExpression(rewriteExpr);
      argumentList.add(rewriteExpr, 'rewrite', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Constructor {
    let result = new ObjectContents_Constructor;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Constructor, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_Constructor, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.equalityDefinition || objectContents.equalityDefinition) {
      if (!this.equalityDefinition || !objectContents.equalityDefinition || !this.equalityDefinition.isEquivalentTo(objectContents.equalityDefinition, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.rewrite || objectContents.rewrite) {
      if (!this.rewrite || !objectContents.rewrite || !this.rewrite.isEquivalentTo(objectContents.rewrite, fn, replacedParameters)) {
        return false;
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_Constructor extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Constructor';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Constructor;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  definition: Fmt.Expression;
  equivalenceProofs?: ObjectContents_Proof[];
  reflexivityProof?: ObjectContents_Proof;
  symmetryProof?: ObjectContents_Proof;
  transitivityProof?: ObjectContents_Proof;
  isomorphic?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
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
    this.definition = argumentList.getValue('definition', 2);
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 3);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item);
            this.equivalenceProofs.push(newItem);
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
        newItem.fromCompoundExpression(reflexivityProofRaw);
        this.reflexivityProof = newItem;
      } else {
        throw new Error('reflexivityProof: Compound expression expected');
      }
    }
    let symmetryProofRaw = argumentList.getOptionalValue('symmetryProof', 5);
    if (symmetryProofRaw !== undefined) {
      if (symmetryProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(symmetryProofRaw);
        this.symmetryProof = newItem;
      } else {
        throw new Error('symmetryProof: Compound expression expected');
      }
    }
    let transitivityProofRaw = argumentList.getOptionalValue('transitivityProof', 6);
    if (transitivityProofRaw !== undefined) {
      if (transitivityProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(transitivityProofRaw);
        this.transitivityProof = newItem;
      } else {
        throw new Error('transitivityProof: Compound expression expected');
      }
    }
    this.isomorphic = argumentList.getOptionalValue('isomorphic', 7);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let leftParametersExpr = new Fmt.ParameterExpression;
    leftParametersExpr.parameters.push(...this.leftParameters);
    argumentList.add(leftParametersExpr, 'leftParameters', false);
    let rightParametersExpr = new Fmt.ParameterExpression;
    rightParametersExpr.parameters.push(...this.rightParameters);
    argumentList.add(rightParametersExpr, 'rightParameters', false);
    argumentList.add(this.definition, 'definition', false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        equivalenceProofsExpr.items.push(newItem);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
    if (this.reflexivityProof !== undefined) {
      let reflexivityProofExpr = new Fmt.CompoundExpression;
      this.reflexivityProof.toCompoundExpression(reflexivityProofExpr);
      argumentList.add(reflexivityProofExpr, 'reflexivityProof', true);
    }
    if (this.symmetryProof !== undefined) {
      let symmetryProofExpr = new Fmt.CompoundExpression;
      this.symmetryProof.toCompoundExpression(symmetryProofExpr);
      argumentList.add(symmetryProofExpr, 'symmetryProof', true);
    }
    if (this.transitivityProof !== undefined) {
      let transitivityProofExpr = new Fmt.CompoundExpression;
      this.transitivityProof.toCompoundExpression(transitivityProofExpr);
      argumentList.add(transitivityProofExpr, 'transitivityProof', true);
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

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_EqualityDefinition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
      result.definition = this.definition.substitute(fn, replacedParameters);
      if (result.definition !== this.definition) {
        changed = true;
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

  isEquivalentTo(objectContents: ObjectContents_EqualityDefinition, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.leftParameters || objectContents.leftParameters) {
      if (!this.leftParameters || !objectContents.leftParameters || !this.leftParameters.isEquivalentTo(objectContents.leftParameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.rightParameters || objectContents.rightParameters) {
      if (!this.rightParameters || !objectContents.rightParameters || !this.rightParameters.isEquivalentTo(objectContents.rightParameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || !this.definition.isEquivalentTo(objectContents.definition, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    if (this.reflexivityProof || objectContents.reflexivityProof) {
      if (!this.reflexivityProof || !objectContents.reflexivityProof || !this.reflexivityProof.isEquivalentTo(objectContents.reflexivityProof, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.symmetryProof || objectContents.symmetryProof) {
      if (!this.symmetryProof || !objectContents.symmetryProof || !this.symmetryProof.isEquivalentTo(objectContents.symmetryProof, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.transitivityProof || objectContents.transitivityProof) {
      if (!this.transitivityProof || !objectContents.transitivityProof || !this.transitivityProof.isEquivalentTo(objectContents.transitivityProof, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.isomorphic || objectContents.isomorphic) {
      if (!this.isomorphic || !objectContents.isomorphic || !this.isomorphic.isEquivalentTo(objectContents.isomorphic, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_RewriteDefinition extends Fmt.ObjectContents {
  value: Fmt.Expression;
  theorem?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.value = argumentList.getValue('value', 0);
    this.theorem = argumentList.getOptionalValue('theorem', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.value, 'value', false);
    if (this.theorem !== undefined) {
      argumentList.add(this.theorem, 'theorem', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_RewriteDefinition {
    let result = new ObjectContents_RewriteDefinition;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_RewriteDefinition, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_RewriteDefinition, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.value || objectContents.value) {
      if (!this.value || !objectContents.value || !this.value.isEquivalentTo(objectContents.value, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.theorem || objectContents.theorem) {
      if (!this.theorem || !objectContents.theorem || !this.theorem.isEquivalentTo(objectContents.theorem, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_SetOperator extends ObjectContents_Definition {
  definition: Fmt.Expression;
  equalityProofs?: ObjectContents_Proof[];
  setRestriction?: Fmt.Expression;
  setRestrictionProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.definition = argumentList.getValue('definition', 3);
    let equalityProofsRaw = argumentList.getOptionalValue('equalityProofs', 4);
    if (equalityProofsRaw !== undefined) {
      if (equalityProofsRaw instanceof Fmt.ArrayExpression) {
        this.equalityProofs = [];
        for (let item of equalityProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item);
            this.equalityProofs.push(newItem);
          } else {
            throw new Error('equalityProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equalityProofs: Array expression expected');
      }
    }
    this.setRestriction = argumentList.getOptionalValue('setRestriction', 5);
    let setRestrictionProofRaw = argumentList.getOptionalValue('setRestrictionProof', 6);
    if (setRestrictionProofRaw !== undefined) {
      if (setRestrictionProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(setRestrictionProofRaw);
        this.setRestrictionProof = newItem;
      } else {
        throw new Error('setRestrictionProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    argumentList.add(this.definition, 'definition', false);
    if (this.equalityProofs !== undefined) {
      let equalityProofsExpr = new Fmt.ArrayExpression;
      equalityProofsExpr.items = [];
      for (let item of this.equalityProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        equalityProofsExpr.items.push(newItem);
      }
      argumentList.add(equalityProofsExpr, 'equalityProofs', true);
    }
    if (this.setRestriction !== undefined) {
      argumentList.add(this.setRestriction, 'setRestriction', true);
    }
    if (this.setRestrictionProof !== undefined) {
      let setRestrictionProofExpr = new Fmt.CompoundExpression;
      this.setRestrictionProof.toCompoundExpression(setRestrictionProofExpr);
      argumentList.add(setRestrictionProofExpr, 'setRestrictionProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SetOperator {
    let result = new ObjectContents_SetOperator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_SetOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = this.definition.substitute(fn, replacedParameters);
      if (result.definition !== this.definition) {
        changed = true;
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

  isEquivalentTo(objectContents: ObjectContents_SetOperator, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || !this.definition.isEquivalentTo(objectContents.definition, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.equalityProofs || objectContents.equalityProofs) {
      if (!this.equalityProofs || !objectContents.equalityProofs || this.equalityProofs.length !== objectContents.equalityProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equalityProofs.length; i++) {
        let leftItem = this.equalityProofs[i];
        let rightItem = objectContents.equalityProofs[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    if (this.setRestriction || objectContents.setRestriction) {
      if (!this.setRestriction || !objectContents.setRestriction || !this.setRestriction.isEquivalentTo(objectContents.setRestriction, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.setRestrictionProof || objectContents.setRestrictionProof) {
      if (!this.setRestrictionProof || !objectContents.setRestrictionProof || !this.setRestrictionProof.isEquivalentTo(objectContents.setRestrictionProof, fn, replacedParameters)) {
        return false;
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_SetOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'SetOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_SetOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Operator {
    let result = new ObjectContents_Operator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Operator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Operator, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class ObjectContents_ExplicitOperator extends ObjectContents_Operator {
  definition: Fmt.Expression;
  equalityProofs?: ObjectContents_Proof[];
  setRestriction?: Fmt.Expression;
  setRestrictionProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.definition = argumentList.getValue('definition', 3);
    let equalityProofsRaw = argumentList.getOptionalValue('equalityProofs', 4);
    if (equalityProofsRaw !== undefined) {
      if (equalityProofsRaw instanceof Fmt.ArrayExpression) {
        this.equalityProofs = [];
        for (let item of equalityProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item);
            this.equalityProofs.push(newItem);
          } else {
            throw new Error('equalityProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equalityProofs: Array expression expected');
      }
    }
    this.setRestriction = argumentList.getOptionalValue('setRestriction', 5);
    let setRestrictionProofRaw = argumentList.getOptionalValue('setRestrictionProof', 6);
    if (setRestrictionProofRaw !== undefined) {
      if (setRestrictionProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(setRestrictionProofRaw);
        this.setRestrictionProof = newItem;
      } else {
        throw new Error('setRestrictionProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    argumentList.add(this.definition, 'definition', false);
    if (this.equalityProofs !== undefined) {
      let equalityProofsExpr = new Fmt.ArrayExpression;
      equalityProofsExpr.items = [];
      for (let item of this.equalityProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        equalityProofsExpr.items.push(newItem);
      }
      argumentList.add(equalityProofsExpr, 'equalityProofs', true);
    }
    if (this.setRestriction !== undefined) {
      argumentList.add(this.setRestriction, 'setRestriction', true);
    }
    if (this.setRestrictionProof !== undefined) {
      let setRestrictionProofExpr = new Fmt.CompoundExpression;
      this.setRestrictionProof.toCompoundExpression(setRestrictionProofExpr);
      argumentList.add(setRestrictionProofExpr, 'setRestrictionProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ExplicitOperator {
    let result = new ObjectContents_ExplicitOperator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ExplicitOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = this.definition.substitute(fn, replacedParameters);
      if (result.definition !== this.definition) {
        changed = true;
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

  isEquivalentTo(objectContents: ObjectContents_ExplicitOperator, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || !this.definition.isEquivalentTo(objectContents.definition, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.equalityProofs || objectContents.equalityProofs) {
      if (!this.equalityProofs || !objectContents.equalityProofs || this.equalityProofs.length !== objectContents.equalityProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equalityProofs.length; i++) {
        let leftItem = this.equalityProofs[i];
        let rightItem = objectContents.equalityProofs[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    if (this.setRestriction || objectContents.setRestriction) {
      if (!this.setRestriction || !objectContents.setRestriction || !this.setRestriction.isEquivalentTo(objectContents.setRestriction, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.setRestrictionProof || objectContents.setRestrictionProof) {
      if (!this.setRestrictionProof || !objectContents.setRestrictionProof || !this.setRestrictionProof.isEquivalentTo(objectContents.setRestrictionProof, fn, replacedParameters)) {
        return false;
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_ExplicitOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ExplicitOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_ExplicitOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  definition: Fmt.Expression;
  equivalenceProofs?: ObjectContents_Proof[];
  wellDefinednessProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    let parameterRaw = argumentList.getValue('parameter', 3);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.definition = argumentList.getValue('definition', 4);
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 5);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item);
            this.equivalenceProofs.push(newItem);
          } else {
            throw new Error('equivalenceProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
    let wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 6);
    if (wellDefinednessProofRaw !== undefined) {
      if (wellDefinednessProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(wellDefinednessProofRaw);
        this.wellDefinednessProof = newItem;
      } else {
        throw new Error('wellDefinednessProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, 'parameter', false);
    argumentList.add(this.definition, 'definition', false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        equivalenceProofsExpr.items.push(newItem);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
    if (this.wellDefinednessProof !== undefined) {
      let wellDefinednessProofExpr = new Fmt.CompoundExpression;
      this.wellDefinednessProof.toCompoundExpression(wellDefinednessProofExpr);
      argumentList.add(wellDefinednessProofExpr, 'wellDefinednessProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ImplicitOperator {
    let result = new ObjectContents_ImplicitOperator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ImplicitOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.parameter) {
      result.parameter = this.parameter.substituteExpression(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.definition) {
      result.definition = this.definition.substitute(fn, replacedParameters);
      if (result.definition !== this.definition) {
        changed = true;
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

  isEquivalentTo(objectContents: ObjectContents_ImplicitOperator, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.parameter || objectContents.parameter) {
      if (!this.parameter || !objectContents.parameter || !this.parameter.isEquivalentTo(objectContents.parameter, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || !this.definition.isEquivalentTo(objectContents.definition, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    if (this.wellDefinednessProof || objectContents.wellDefinednessProof) {
      if (!this.wellDefinednessProof || !objectContents.wellDefinednessProof || !this.wellDefinednessProof.isEquivalentTo(objectContents.wellDefinednessProof, fn, replacedParameters)) {
        return false;
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_ImplicitOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ImplicitOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_ImplicitOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_MacroOperator {
    let result = new ObjectContents_MacroOperator;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_MacroOperator, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_MacroOperator, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_MacroOperator extends Fmt.MetaRefExpression {
  getName(): string {
    return 'MacroOperator';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_MacroOperator;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  definition: Fmt.Expression;
  equivalenceProofs?: ObjectContents_Proof[];

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.definition = argumentList.getValue('definition', 3);
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 4);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item);
            this.equivalenceProofs.push(newItem);
          } else {
            throw new Error('equivalenceProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    argumentList.add(this.definition, 'definition', false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        equivalenceProofsExpr.items.push(newItem);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Predicate {
    let result = new ObjectContents_Predicate;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Predicate, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.definition) {
      result.definition = this.definition.substitute(fn, replacedParameters);
      if (result.definition !== this.definition) {
        changed = true;
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

  isEquivalentTo(objectContents: ObjectContents_Predicate, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definition || objectContents.definition) {
      if (!this.definition || !objectContents.definition || !this.definition.isEquivalentTo(objectContents.definition, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Predicate;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.claim = argumentList.getValue('claim', 0);
    let proofsRaw = argumentList.getOptionalValue('proofs', 1);
    if (proofsRaw !== undefined) {
      if (proofsRaw instanceof Fmt.ArrayExpression) {
        this.proofs = [];
        for (let item of proofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item);
            this.proofs.push(newItem);
          } else {
            throw new Error('proofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('proofs: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.claim, 'claim', false);
    if (this.proofs !== undefined) {
      let proofsExpr = new Fmt.ArrayExpression;
      proofsExpr.items = [];
      for (let item of this.proofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        proofsExpr.items.push(newItem);
      }
      argumentList.add(proofsExpr, 'proofs', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_StandardTheorem {
    let result = new ObjectContents_StandardTheorem;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_StandardTheorem, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_StandardTheorem, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.claim || objectContents.claim) {
      if (!this.claim || !objectContents.claim || !this.claim.isEquivalentTo(objectContents.claim, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.proofs || objectContents.proofs) {
      if (!this.proofs || !objectContents.proofs || this.proofs.length !== objectContents.proofs.length) {
        return false;
      }
      for (let i = 0; i < this.proofs.length; i++) {
        let leftItem = this.proofs[i];
        let rightItem = objectContents.proofs[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_StandardTheorem;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  conditions: Fmt.Expression;
  equivalenceProofs?: ObjectContents_Proof[];

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.conditions = argumentList.getValue('conditions', 0);
    let equivalenceProofsRaw = argumentList.getOptionalValue('equivalenceProofs', 1);
    if (equivalenceProofsRaw !== undefined) {
      if (equivalenceProofsRaw instanceof Fmt.ArrayExpression) {
        this.equivalenceProofs = [];
        for (let item of equivalenceProofsRaw.items) {
          if (item instanceof Fmt.CompoundExpression) {
            let newItem = new ObjectContents_Proof;
            newItem.fromCompoundExpression(item);
            this.equivalenceProofs.push(newItem);
          } else {
            throw new Error('equivalenceProofs: Compound expression expected');
          }
        }
      } else {
        throw new Error('equivalenceProofs: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.conditions, 'conditions', false);
    if (this.equivalenceProofs !== undefined) {
      let equivalenceProofsExpr = new Fmt.ArrayExpression;
      equivalenceProofsExpr.items = [];
      for (let item of this.equivalenceProofs) {
        let newItem = new Fmt.CompoundExpression;
        item.toCompoundExpression(newItem);
        equivalenceProofsExpr.items.push(newItem);
      }
      argumentList.add(equivalenceProofsExpr, 'equivalenceProofs', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_EquivalenceTheorem {
    let result = new ObjectContents_EquivalenceTheorem;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_EquivalenceTheorem, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.conditions) {
      result.conditions = this.conditions.substitute(fn, replacedParameters);
      if (result.conditions !== this.conditions) {
        changed = true;
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

  isEquivalentTo(objectContents: ObjectContents_EquivalenceTheorem, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.conditions || objectContents.conditions) {
      if (!this.conditions || !objectContents.conditions || !this.conditions.isEquivalentTo(objectContents.conditions, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.equivalenceProofs || objectContents.equivalenceProofs) {
      if (!this.equivalenceProofs || !objectContents.equivalenceProofs || this.equivalenceProofs.length !== objectContents.equivalenceProofs.length) {
        return false;
      }
      for (let i = 0; i < this.equivalenceProofs.length; i++) {
        let leftItem = this.equivalenceProofs[i];
        let rightItem = objectContents.equivalenceProofs[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_EquivalenceTheorem;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_EquivalenceTheorem)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_EquivalenceTheorem;
  }
}

export class ObjectContents_Property extends Fmt.ObjectContents {
  property: string;
  theorem?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let propertyRaw = argumentList.getValue('property', 0);
    if (propertyRaw instanceof Fmt.StringExpression) {
      this.property = propertyRaw.value;
    } else {
      throw new Error('property: String expected');
    }
    this.theorem = argumentList.getOptionalValue('theorem', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let propertyExpr = new Fmt.StringExpression;
    propertyExpr.value = this.property;
    argumentList.add(propertyExpr, 'property', false);
    if (this.theorem !== undefined) {
      argumentList.add(this.theorem, 'theorem', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Property {
    let result = new ObjectContents_Property;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Property, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    result.property = this.property;
    if (this.theorem) {
      result.theorem = this.theorem.substitute(fn, replacedParameters);
      if (result.theorem !== this.theorem) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Property, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.property !== objectContents.property) {
      return false;
    }
    if (this.theorem || objectContents.theorem) {
      if (!this.theorem || !objectContents.theorem || !this.theorem.isEquivalentTo(objectContents.theorem, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_Bool extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Bool';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Bool;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_true;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_false;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Nat;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Nat)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Expr extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Expr';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Expr;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Expr)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ParameterList extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ParameterList';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_ParameterList;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ParameterList)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_DefinitionRef extends Fmt.MetaRefExpression {
  getName(): string {
    return 'DefinitionRef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_DefinitionRef;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_DefinitionRef)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_left extends Fmt.MetaRefExpression {
  getName(): string {
    return 'left';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_left;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_left)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_right extends Fmt.MetaRefExpression {
  getName(): string {
    return 'right';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_right;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_right)) {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.auto = argumentList.getOptionalValue('auto', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Prop)) {
      return false;
    }
    if (this.auto || expression.auto) {
      if (!this.auto || !expression.auto || !this.auto.isEquivalentTo(expression.auto, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.auto = argumentList.getOptionalValue('auto', 0);
    this.embedSubsets = argumentList.getOptionalValue('embedSubsets', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
    if (this.embedSubsets !== undefined) {
      argumentList.add(this.embedSubsets, 'embedSubsets', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Set)) {
      return false;
    }
    if (this.auto || expression.auto) {
      if (!this.auto || !expression.auto || !this.auto.isEquivalentTo(expression.auto, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.embedSubsets || expression.embedSubsets) {
      if (!this.embedSubsets || !expression.embedSubsets || !this.embedSubsets.isEquivalentTo(expression.embedSubsets, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.superset = argumentList.getValue('superset', 0);
    this.auto = argumentList.getOptionalValue('auto', 1);
    this.embedSubsets = argumentList.getOptionalValue('embedSubsets', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.superset, undefined, false);
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
    if (this.embedSubsets !== undefined) {
      argumentList.add(this.embedSubsets, 'embedSubsets', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Subset)) {
      return false;
    }
    if (this.superset || expression.superset) {
      if (!this.superset || !expression.superset || !this.superset.isEquivalentTo(expression.superset, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.auto || expression.auto) {
      if (!this.auto || !expression.auto || !this.auto.isEquivalentTo(expression.auto, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.embedSubsets || expression.embedSubsets) {
      if (!this.embedSubsets || !expression.embedSubsets || !this.embedSubsets.isEquivalentTo(expression.embedSubsets, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this._set = argumentList.getValue('set', 0);
    this.auto = argumentList.getOptionalValue('auto', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this._set, undefined, false);
    if (this.auto !== undefined) {
      argumentList.add(this.auto, 'auto', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Element)) {
      return false;
    }
    if (this._set || expression._set) {
      if (!this._set || !expression._set || !this._set.isEquivalentTo(expression._set, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.auto || expression.auto) {
      if (!this.auto || !expression.auto || !this.auto.isEquivalentTo(expression.auto, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_Constraint extends Fmt.MetaRefExpression {
  formula: Fmt.Expression;

  getName(): string {
    return 'Constraint';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Constraint)) {
      return false;
    }
    if (this.formula || expression.formula) {
      if (!this.formula || !expression.formula || !this.formula.isEquivalentTo(expression.formula, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_Binding extends Fmt.MetaRefExpression {
  _set: Fmt.Expression;
  parameters: Fmt.ParameterList;

  getName(): string {
    return 'Binding';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this._set = argumentList.getValue('set', 0);
    let parametersRaw = argumentList.getValue('parameters', 1);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this._set, undefined, false);
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters.push(...this.parameters);
    argumentList.add(parametersExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Binding;
    let changed = false;
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    if (this.parameters) {
      result.parameters = Object.create(Fmt.ParameterList.prototype);
      if (this.parameters.substituteExpression(fn, result.parameters!, replacedParameters)) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Binding)) {
      return false;
    }
    if (this._set || expression._set) {
      if (!this._set || !expression._set || !this._set.isEquivalentTo(expression._set, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.parameters || expression.parameters) {
      if (!this.parameters || !expression.parameters || !this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_SetDef extends Fmt.MetaRefExpression {
  _set: Fmt.Expression;

  getName(): string {
    return 'SetDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this._set = argumentList.getValue('set', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this._set, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_SetDef)) {
      return false;
    }
    if (this._set || expression._set) {
      if (!this._set || !expression._set || !this._set.isEquivalentTo(expression._set, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_Def extends Fmt.MetaRefExpression {
  element: Fmt.Expression;

  getName(): string {
    return 'Def';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.element = argumentList.getValue('element', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.element, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Def)) {
      return false;
    }
    if (this.element || expression.element) {
      if (!this.element || !expression.element || !this.element.isEquivalentTo(expression.element, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_PropArg extends Fmt.ObjectContents {
  formula: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.formula, 'formula', false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_PropArg {
    let result = new ObjectContents_PropArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_PropArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.formula) {
      result.formula = this.formula.substitute(fn, replacedParameters);
      if (result.formula !== this.formula) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_PropArg, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.formula || objectContents.formula) {
      if (!this.formula || !objectContents.formula || !this.formula.isEquivalentTo(objectContents.formula, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_SetArg extends Fmt.ObjectContents {
  _set: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this._set = argumentList.getValue('set', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this._set, 'set', false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SetArg {
    let result = new ObjectContents_SetArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_SetArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this._set) {
      result._set = this._set.substitute(fn, replacedParameters);
      if (result._set !== this._set) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_SetArg, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this._set || objectContents._set) {
      if (!this._set || !objectContents._set || !this._set.isEquivalentTo(objectContents._set, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_SubsetArg extends Fmt.ObjectContents {
  _set: Fmt.Expression;
  subsetProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this._set = argumentList.getValue('set', 0);
    let subsetProofRaw = argumentList.getOptionalValue('subsetProof', 1);
    if (subsetProofRaw !== undefined) {
      if (subsetProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(subsetProofRaw);
        this.subsetProof = newItem;
      } else {
        throw new Error('subsetProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this._set, 'set', false);
    if (this.subsetProof !== undefined) {
      let subsetProofExpr = new Fmt.CompoundExpression;
      this.subsetProof.toCompoundExpression(subsetProofExpr);
      argumentList.add(subsetProofExpr, 'subsetProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_SubsetArg {
    let result = new ObjectContents_SubsetArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_SubsetArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_SubsetArg, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this._set || objectContents._set) {
      if (!this._set || !objectContents._set || !this._set.isEquivalentTo(objectContents._set, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.subsetProof || objectContents.subsetProof) {
      if (!this.subsetProof || !objectContents.subsetProof || !this.subsetProof.isEquivalentTo(objectContents.subsetProof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_ElementArg extends Fmt.ObjectContents {
  element: Fmt.Expression;
  elementProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.element = argumentList.getValue('element', 0);
    let elementProofRaw = argumentList.getOptionalValue('elementProof', 1);
    if (elementProofRaw !== undefined) {
      if (elementProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(elementProofRaw);
        this.elementProof = newItem;
      } else {
        throw new Error('elementProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.element, 'element', false);
    if (this.elementProof !== undefined) {
      let elementProofExpr = new Fmt.CompoundExpression;
      this.elementProof.toCompoundExpression(elementProofExpr);
      argumentList.add(elementProofExpr, 'elementProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ElementArg {
    let result = new ObjectContents_ElementArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ElementArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_ElementArg, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.element || objectContents.element) {
      if (!this.element || !objectContents.element || !this.element.isEquivalentTo(objectContents.element, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.elementProof || objectContents.elementProof) {
      if (!this.elementProof || !objectContents.elementProof || !this.elementProof.isEquivalentTo(objectContents.elementProof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_ConstraintArg extends Fmt.ObjectContents {
  proof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let proofRaw = argumentList.getOptionalValue('proof', 0);
    if (proofRaw !== undefined) {
      if (proofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(proofRaw);
        this.proof = newItem;
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr);
      argumentList.add(proofExpr, 'proof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ConstraintArg {
    let result = new ObjectContents_ConstraintArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ConstraintArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.proof) {
      result.proof = new ObjectContents_Proof;
      if (this.proof.substituteExpression(fn, result.proof!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ConstraintArg, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.proof || objectContents.proof) {
      if (!this.proof || !objectContents.proof || !this.proof.isEquivalentTo(objectContents.proof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_BindingArg extends Fmt.ObjectContents {
  parameter: Fmt.Parameter;
  arguments: Fmt.ArgumentList;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    let argumentsRaw = argumentList.getValue('arguments', 1);
    if (argumentsRaw instanceof Fmt.CompoundExpression) {
      this.arguments = argumentsRaw.arguments;
    } else {
      throw new Error('arguments: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, 'parameter', false);
    let argumentsExpr = new Fmt.CompoundExpression;
    argumentsExpr.arguments = this.arguments;
    argumentList.add(argumentsExpr, 'arguments', false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_BindingArg {
    let result = new ObjectContents_BindingArg;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_BindingArg, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.parameter) {
      result.parameter = this.parameter.substituteExpression(fn, replacedParameters);
      if (result.parameter !== this.parameter) {
        changed = true;
      }
    }
    if (this.arguments) {
      result.arguments = Object.create(Fmt.ArgumentList.prototype);
      if (this.arguments.substituteExpression(fn, result.arguments!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_BindingArg, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.parameter || objectContents.parameter) {
      if (!this.parameter || !objectContents.parameter || !this.parameter.isEquivalentTo(objectContents.parameter, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.arguments || objectContents.arguments) {
      if (!this.arguments || !objectContents.arguments || !this.arguments.isEquivalentTo(objectContents.arguments, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_empty extends Fmt.MetaRefExpression {
  getName(): string {
    return 'empty';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_empty;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_empty)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_previous extends Fmt.MetaRefExpression {
  getName(): string {
    return 'previous';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_previous;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_previous)) {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
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

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.terms !== undefined) {
      for (let termsArg of this.terms) {
        argumentList.add(termsArg, undefined, true);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parameterRaw = argumentList.getValue('parameter', 0);
    if (parameterRaw instanceof Fmt.ParameterExpression && parameterRaw.parameters.length === 1) {
      this.parameter = parameterRaw.parameters[0];
    } else {
      throw new Error('parameter: Parameter expression with single parameter expected');
    }
    this.formula = argumentList.getValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parameterExpr = new Fmt.ParameterExpression;
    parameterExpr.parameters.push(this.parameter);
    argumentList.add(parameterExpr, undefined, false);
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_subset)) {
      return false;
    }
    if (this.parameter || expression.parameter) {
      if (!this.parameter || !expression.parameter || !this.parameter.isEquivalentTo(expression.parameter, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.formula || expression.formula) {
      if (!this.formula || !expression.formula || !this.formula.isEquivalentTo(expression.formula, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.term = argumentList.getValue('term', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters.push(...this.parameters);
    argumentList.add(parametersExpr, undefined, false);
    argumentList.add(this.term, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_extendedSubset)) {
      return false;
    }
    if (this.parameters || expression.parameters) {
      if (!this.parameters || !expression.parameters || !this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.term || expression.term) {
      if (!this.term || !expression.term || !this.term.isEquivalentTo(expression.term, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item);
          this.cases.push(newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem);
      casesExpr.items.push(newItem);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_setStructuralCases)) {
      return false;
    }
    if (this.term || expression.term) {
      if (!this.term || !expression.term || !this.term.isEquivalentTo(expression.term, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.construction || expression.construction) {
      if (!this.construction || !expression.construction || !this.construction.isEquivalentTo(expression.construction, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_cases extends Fmt.MetaRefExpression {
  cases: ObjectContents_Case[];

  getName(): string {
    return 'cases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let casesRaw = argumentList.getValue('cases', 0);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_Case;
          newItem.fromCompoundExpression(item);
          this.cases.push(newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem);
      casesExpr.items.push(newItem);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item);
          this.cases.push(newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem);
      casesExpr.items.push(newItem);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_structuralCases)) {
      return false;
    }
    if (this.term || expression.term) {
      if (!this.term || !expression.term || !this.term.isEquivalentTo(expression.term, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.construction || expression.construction) {
      if (!this.construction || !expression.construction || !this.construction.isEquivalentTo(expression.construction, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_not extends Fmt.MetaRefExpression {
  formula: Fmt.Expression;

  getName(): string {
    return 'not';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.formula = argumentList.getValue('formula', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_not)) {
      return false;
    }
    if (this.formula || expression.formula) {
      if (!this.formula || !expression.formula || !this.formula.isEquivalentTo(expression.formula, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_and extends Fmt.MetaRefExpression {
  formulae?: Fmt.Expression[];

  getName(): string {
    return 'and';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    if (this.formulae) {
      this.formulae = undefined;
    }
    let index = 0;
    for (;;) {
      let formulaeRaw = argumentList.getOptionalValue(undefined, index);
      if (formulaeRaw === undefined) {
        break;
      }
      if (!this.formulae) {
        this.formulae = [];
      }
      this.formulae!.push(formulaeRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.formulae !== undefined) {
      for (let formulaeArg of this.formulae) {
        argumentList.add(formulaeArg, undefined, true);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_and;
    let changed = false;
    if (this.formulae) {
      result.formulae = [];
      for (let item of this.formulae) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.formulae.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_and)) {
      return false;
    }
    if (this.formulae || expression.formulae) {
      if (!this.formulae || !expression.formulae || this.formulae.length !== expression.formulae.length) {
        return false;
      }
      for (let i = 0; i < this.formulae.length; i++) {
        let leftItem = this.formulae[i];
        let rightItem = expression.formulae[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

export class MetaRefExpression_or extends Fmt.MetaRefExpression {
  formulae?: Fmt.Expression[];

  getName(): string {
    return 'or';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    if (this.formulae) {
      this.formulae = undefined;
    }
    let index = 0;
    for (;;) {
      let formulaeRaw = argumentList.getOptionalValue(undefined, index);
      if (formulaeRaw === undefined) {
        break;
      }
      if (!this.formulae) {
        this.formulae = [];
      }
      this.formulae!.push(formulaeRaw);
      index++;
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.formulae !== undefined) {
      for (let formulaeArg of this.formulae) {
        argumentList.add(formulaeArg, undefined, true);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_or;
    let changed = false;
    if (this.formulae) {
      result.formulae = [];
      for (let item of this.formulae) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.formulae.push(newItem);
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_or)) {
      return false;
    }
    if (this.formulae || expression.formulae) {
      if (!this.formulae || !expression.formulae || this.formulae.length !== expression.formulae.length) {
        return false;
      }
      for (let i = 0; i < this.formulae.length; i++) {
        let leftItem = this.formulae[i];
        let rightItem = expression.formulae[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.left = argumentList.getValue('left', 0);
    this.right = argumentList.getValue('right', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.left, undefined, false);
    argumentList.add(this.right, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_equiv)) {
      return false;
    }
    if (this.left || expression.left) {
      if (!this.left || !expression.left || !this.left.isEquivalentTo(expression.left, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.right || expression.right) {
      if (!this.right || !expression.right || !this.right.isEquivalentTo(expression.right, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters.push(...this.parameters);
    argumentList.add(parametersExpr, undefined, false);
    argumentList.add(this.formula, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_forall)) {
      return false;
    }
    if (this.parameters || expression.parameters) {
      if (!this.parameters || !expression.parameters || !this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.formula || expression.formula) {
      if (!this.formula || !expression.formula || !this.formula.isEquivalentTo(expression.formula, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getOptionalValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters.push(...this.parameters);
    argumentList.add(parametersExpr, undefined, false);
    if (this.formula !== undefined) {
      argumentList.add(this.formula, 'formula', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_exists)) {
      return false;
    }
    if (this.parameters || expression.parameters) {
      if (!this.parameters || !expression.parameters || !this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.formula || expression.formula) {
      if (!this.formula || !expression.formula || !this.formula.isEquivalentTo(expression.formula, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
    this.formula = argumentList.getOptionalValue('formula', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters.push(...this.parameters);
    argumentList.add(parametersExpr, undefined, false);
    if (this.formula !== undefined) {
      argumentList.add(this.formula, 'formula', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_existsUnique)) {
      return false;
    }
    if (this.parameters || expression.parameters) {
      if (!this.parameters || !expression.parameters || !this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.formula || expression.formula) {
      if (!this.formula || !expression.formula || !this.formula.isEquivalentTo(expression.formula, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.element = argumentList.getValue('element', 0);
    this._set = argumentList.getValue('set', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.element, undefined, false);
    argumentList.add(this._set, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_in)) {
      return false;
    }
    if (this.element || expression.element) {
      if (!this.element || !expression.element || !this.element.isEquivalentTo(expression.element, fn, replacedParameters)) {
        return false;
      }
    }
    if (this._set || expression._set) {
      if (!this._set || !expression._set || !this._set.isEquivalentTo(expression._set, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.subset = argumentList.getValue('subset', 0);
    this.superset = argumentList.getValue('superset', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.subset, undefined, false);
    argumentList.add(this.superset, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_sub)) {
      return false;
    }
    if (this.subset || expression.subset) {
      if (!this.subset || !expression.subset || !this.subset.isEquivalentTo(expression.subset, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.superset || expression.superset) {
      if (!this.superset || !expression.superset || !this.superset.isEquivalentTo(expression.superset, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_setEquals extends Fmt.MetaRefExpression {
  left: Fmt.Expression;
  right: Fmt.Expression;

  getName(): string {
    return 'setEquals';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.left = argumentList.getValue('left', 0);
    this.right = argumentList.getValue('right', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.left, undefined, false);
    argumentList.add(this.right, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_setEquals;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_setEquals)) {
      return false;
    }
    if (this.left || expression.left) {
      if (!this.left || !expression.left || !this.left.isEquivalentTo(expression.left, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.right || expression.right) {
      if (!this.right || !expression.right || !this.right.isEquivalentTo(expression.right, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_equals extends Fmt.MetaRefExpression {
  left: Fmt.Expression;
  right: Fmt.Expression;

  getName(): string {
    return 'equals';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.left = argumentList.getValue('left', 0);
    this.right = argumentList.getValue('right', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.left, undefined, false);
    argumentList.add(this.right, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_equals;
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_equals)) {
      return false;
    }
    if (this.left || expression.left) {
      if (!this.left || !expression.left || !this.left.isEquivalentTo(expression.left, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.right || expression.right) {
      if (!this.right || !expression.right || !this.right.isEquivalentTo(expression.right, fn, replacedParameters)) {
        return false;
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item);
          this.cases.push(newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem);
      casesExpr.items.push(newItem);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_structural)) {
      return false;
    }
    if (this.term || expression.term) {
      if (!this.term || !expression.term || !this.term.isEquivalentTo(expression.term, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.construction || expression.construction) {
      if (!this.construction || !expression.construction || !this.construction.isEquivalentTo(expression.construction, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

export class ObjectContents_Case extends Fmt.ObjectContents {
  formula: Fmt.Expression;
  value: Fmt.Expression;
  wellDefinednessProof?: ObjectContents_Proof;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.formula = argumentList.getValue('formula', 0);
    this.value = argumentList.getValue('value', 1);
    let wellDefinednessProofRaw = argumentList.getOptionalValue('wellDefinednessProof', 2);
    if (wellDefinednessProofRaw !== undefined) {
      if (wellDefinednessProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(wellDefinednessProofRaw);
        this.wellDefinednessProof = newItem;
      } else {
        throw new Error('wellDefinednessProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.formula, 'formula', false);
    argumentList.add(this.value, 'value', false);
    if (this.wellDefinednessProof !== undefined) {
      let wellDefinednessProofExpr = new Fmt.CompoundExpression;
      this.wellDefinednessProof.toCompoundExpression(wellDefinednessProofExpr);
      argumentList.add(wellDefinednessProofExpr, 'wellDefinednessProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Case {
    let result = new ObjectContents_Case;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Case, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
    if (this.wellDefinednessProof) {
      result.wellDefinednessProof = new ObjectContents_Proof;
      if (this.wellDefinednessProof.substituteExpression(fn, result.wellDefinednessProof!, replacedParameters)) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_Case, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.formula || objectContents.formula) {
      if (!this.formula || !objectContents.formula || !this.formula.isEquivalentTo(objectContents.formula, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.value || objectContents.value) {
      if (!this.value || !objectContents.value || !this.value.isEquivalentTo(objectContents.value, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.wellDefinednessProof || objectContents.wellDefinednessProof) {
      if (!this.wellDefinednessProof || !objectContents.wellDefinednessProof || !this.wellDefinednessProof.isEquivalentTo(objectContents.wellDefinednessProof, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
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
        newItem.fromCompoundExpression(wellDefinednessProofRaw);
        this.wellDefinednessProof = newItem;
      } else {
        throw new Error('wellDefinednessProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this._constructor, 'constructor', false);
    if (this.parameters !== undefined) {
      let parametersExpr = new Fmt.ParameterExpression;
      parametersExpr.parameters.push(...this.parameters);
      argumentList.add(parametersExpr, 'parameters', true);
    }
    argumentList.add(this.value, 'value', false);
    if (this.rewrite !== undefined) {
      argumentList.add(this.rewrite, 'rewrite', true);
    }
    if (this.wellDefinednessProof !== undefined) {
      let wellDefinednessProofExpr = new Fmt.CompoundExpression;
      this.wellDefinednessProof.toCompoundExpression(wellDefinednessProofExpr);
      argumentList.add(wellDefinednessProofExpr, 'wellDefinednessProof', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_StructuralCase {
    let result = new ObjectContents_StructuralCase;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_StructuralCase, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_StructuralCase, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this._constructor || objectContents._constructor) {
      if (!this._constructor || !objectContents._constructor || !this._constructor.isEquivalentTo(objectContents._constructor, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.parameters || objectContents.parameters) {
      if (!this.parameters || !objectContents.parameters || !this.parameters.isEquivalentTo(objectContents.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.value || objectContents.value) {
      if (!this.value || !objectContents.value || !this.value.isEquivalentTo(objectContents.value, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.rewrite || objectContents.rewrite) {
      if (!this.rewrite || !objectContents.rewrite || !this.rewrite.isEquivalentTo(objectContents.rewrite, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.wellDefinednessProof || objectContents.wellDefinednessProof) {
      if (!this.wellDefinednessProof || !objectContents.wellDefinednessProof || !this.wellDefinednessProof.isEquivalentTo(objectContents.wellDefinednessProof, fn, replacedParameters)) {
        return false;
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
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

  toArgumentList(argumentList: Fmt.ArgumentList): void {
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
      parametersExpr.parameters.push(...this.parameters);
      argumentList.add(parametersExpr, 'parameters', true);
    }
    if (this.goal !== undefined) {
      argumentList.add(this.goal, 'goal', true);
    }
    let stepsExpr = new Fmt.ParameterExpression;
    stepsExpr.parameters.push(...this.steps);
    argumentList.add(stepsExpr, 'steps', false);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_Proof {
    let result = new ObjectContents_Proof;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Proof, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  isEquivalentTo(objectContents: ObjectContents_Proof, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
    if (this.parameters || objectContents.parameters) {
      if (!this.parameters || !objectContents.parameters || !this.parameters.isEquivalentTo(objectContents.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.goal || objectContents.goal) {
      if (!this.goal || !objectContents.goal || !this.goal.isEquivalentTo(objectContents.goal, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.steps || objectContents.steps) {
      if (!this.steps || !objectContents.steps || !this.steps.isEquivalentTo(objectContents.steps, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
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

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.variable, undefined, false);
    if (this.index !== undefined) {
      let indexExpr = new Fmt.IntegerExpression;
      indexExpr.value = this.index;
      argumentList.add(indexExpr, 'index', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Consider)) {
      return false;
    }
    if (this.variable || expression.variable) {
      if (!this.variable || !expression.variable || !this.variable.isEquivalentTo(expression.variable, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.statement = argumentList.getValue('statement', 0);
    let proofRaw = argumentList.getOptionalValue('proof', 1);
    if (proofRaw !== undefined) {
      if (proofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(proofRaw);
        this.proof = newItem;
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.statement, undefined, false);
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr);
      argumentList.add(proofExpr, 'proof', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_State)) {
      return false;
    }
    if (this.statement || expression.statement) {
      if (!this.statement || !expression.statement || !this.statement.isEquivalentTo(expression.statement, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.proof || expression.proof) {
      if (!this.proof || !expression.proof || !this.proof.isEquivalentTo(expression.proof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_UseDef extends Fmt.MetaRefExpression {
  side?: Fmt.Expression;
  result: Fmt.Expression;

  getName(): string {
    return 'UseDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.side = argumentList.getOptionalValue('side', 0);
    this.result = argumentList.getValue('result', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      argumentList.add(this.side, 'side', true);
    }
    argumentList.add(this.result, 'result', false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UseDef;
    let changed = false;
    if (this.side) {
      result.side = this.side.substitute(fn, replacedParameters);
      if (result.side !== this.side) {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseDef)) {
      return false;
    }
    if (this.side || expression.side) {
      if (!this.side || !expression.side || !this.side.isEquivalentTo(expression.side, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.result || expression.result) {
      if (!this.result || !expression.result || !this.result.isEquivalentTo(expression.result, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_UseCases extends Fmt.MetaRefExpression {
  side?: Fmt.Expression;
  caseProofs: ObjectContents_Proof[];

  getName(): string {
    return 'UseCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.side = argumentList.getOptionalValue('side', 0);
    let caseProofsRaw = argumentList.getValue('caseProofs', 1);
    if (caseProofsRaw instanceof Fmt.ArrayExpression) {
      this.caseProofs = [];
      for (let item of caseProofsRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_Proof;
          newItem.fromCompoundExpression(item);
          this.caseProofs.push(newItem);
        } else {
          throw new Error('caseProofs: Compound expression expected');
        }
      }
    } else {
      throw new Error('caseProofs: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      argumentList.add(this.side, 'side', true);
    }
    let caseProofsExpr = new Fmt.ArrayExpression;
    caseProofsExpr.items = [];
    for (let item of this.caseProofs) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem);
      caseProofsExpr.items.push(newItem);
    }
    argumentList.add(caseProofsExpr, 'caseProofs', false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_UseCases;
    let changed = false;
    if (this.side) {
      result.side = this.side.substitute(fn, replacedParameters);
      if (result.side !== this.side) {
        changed = true;
      }
    }
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseCases)) {
      return false;
    }
    if (this.side || expression.side) {
      if (!this.side || !expression.side || !this.side.isEquivalentTo(expression.side, fn, replacedParameters)) {
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
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let argumentsRaw = argumentList.getValue('arguments', 0);
    if (argumentsRaw instanceof Fmt.CompoundExpression) {
      this.arguments = argumentsRaw.arguments;
    } else {
      throw new Error('arguments: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let argumentsExpr = new Fmt.CompoundExpression;
    argumentsExpr.arguments = this.arguments;
    argumentList.add(argumentsExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseForAll)) {
      return false;
    }
    if (this.arguments || expression.arguments) {
      if (!this.arguments || !expression.arguments || !this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_UseExists extends Fmt.MetaRefExpression {
  parameters: Fmt.ParameterList;

  getName(): string {
    return 'UseExists';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let parametersRaw = argumentList.getValue('parameters', 0);
    if (parametersRaw instanceof Fmt.ParameterExpression) {
      this.parameters = parametersRaw.parameters;
    } else {
      throw new Error('parameters: Parameter expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let parametersExpr = new Fmt.ParameterExpression;
    parametersExpr.parameters.push(...this.parameters);
    argumentList.add(parametersExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseExists)) {
      return false;
    }
    if (this.parameters || expression.parameters) {
      if (!this.parameters || !expression.parameters || !this.parameters.isEquivalentTo(expression.parameters, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_Embed extends Fmt.MetaRefExpression {
  construction: Fmt.Expression;
  input: Fmt.Expression;
  output: Fmt.Expression;

  getName(): string {
    return 'Embed';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.construction = argumentList.getValue('construction', 0);
    this.input = argumentList.getValue('input', 1);
    this.output = argumentList.getValue('output', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.construction, undefined, false);
    argumentList.add(this.input, undefined, false);
    argumentList.add(this.output, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Embed;
    let changed = false;
    if (this.construction) {
      result.construction = this.construction.substitute(fn, replacedParameters);
      if (result.construction !== this.construction) {
        changed = true;
      }
    }
    if (this.input) {
      result.input = this.input.substitute(fn, replacedParameters);
      if (result.input !== this.input) {
        changed = true;
      }
    }
    if (this.output) {
      result.output = this.output.substitute(fn, replacedParameters);
      if (result.output !== this.output) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Embed)) {
      return false;
    }
    if (this.construction || expression.construction) {
      if (!this.construction || !expression.construction || !this.construction.isEquivalentTo(expression.construction, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.input || expression.input) {
      if (!this.input || !expression.input || !this.input.isEquivalentTo(expression.input, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.output || expression.output) {
      if (!this.output || !expression.output || !this.output.isEquivalentTo(expression.output, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_SetExtend extends Fmt.MetaRefExpression {
  term: Fmt.Expression;

  getName(): string {
    return 'SetExtend';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.term = argumentList.getValue('term', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_SetExtend;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_SetExtend)) {
      return false;
    }
    if (this.term || expression.term) {
      if (!this.term || !expression.term || !this.term.isEquivalentTo(expression.term, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_Extend extends Fmt.MetaRefExpression {
  term: Fmt.Expression;

  getName(): string {
    return 'Extend';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.term = argumentList.getValue('term', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Extend;
    let changed = false;
    if (this.term) {
      result.term = this.term.substitute(fn, replacedParameters);
      if (result.term !== this.term) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Extend)) {
      return false;
    }
    if (this.term || expression.term) {
      if (!this.term || !expression.term || !this.term.isEquivalentTo(expression.term, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_Substitute extends Fmt.MetaRefExpression {
  source: Fmt.Parameter;
  sourceSide: Fmt.Expression;
  result: Fmt.Expression;

  getName(): string {
    return 'Substitute';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let sourceRaw = argumentList.getValue('source', 0);
    if (sourceRaw instanceof Fmt.ParameterExpression && sourceRaw.parameters.length === 1) {
      this.source = sourceRaw.parameters[0];
    } else {
      throw new Error('source: Parameter expression with single parameter expected');
    }
    this.sourceSide = argumentList.getValue('sourceSide', 1);
    this.result = argumentList.getValue('result', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let sourceExpr = new Fmt.ParameterExpression;
    sourceExpr.parameters.push(this.source);
    argumentList.add(sourceExpr, undefined, false);
    argumentList.add(this.sourceSide, undefined, false);
    argumentList.add(this.result, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_Substitute;
    let changed = false;
    if (this.source) {
      result.source = this.source.substituteExpression(fn, replacedParameters);
      if (result.source !== this.source) {
        changed = true;
      }
    }
    if (this.sourceSide) {
      result.sourceSide = this.sourceSide.substitute(fn, replacedParameters);
      if (result.sourceSide !== this.sourceSide) {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Substitute)) {
      return false;
    }
    if (this.source || expression.source) {
      if (!this.source || !expression.source || !this.source.isEquivalentTo(expression.source, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.sourceSide || expression.sourceSide) {
      if (!this.sourceSide || !expression.sourceSide || !this.sourceSide.isEquivalentTo(expression.sourceSide, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.result || expression.result) {
      if (!this.result || !expression.result || !this.result.isEquivalentTo(expression.result, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_ResolveDef extends Fmt.MetaRefExpression {
  result: Fmt.Expression;

  getName(): string {
    return 'ResolveDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.result = argumentList.getValue('result', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.result, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ResolveDef;
    let changed = false;
    if (this.result) {
      result.result = this.result.substitute(fn, replacedParameters);
      if (result.result !== this.result) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ResolveDef)) {
      return false;
    }
    if (this.result || expression.result) {
      if (!this.result || !expression.result || !this.result.isEquivalentTo(expression.result, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.theorem = argumentList.getValue('theorem', 0);
    this.result = argumentList.getValue('result', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.theorem, undefined, false);
    argumentList.add(this.result, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_UseTheorem)) {
      return false;
    }
    if (this.theorem || expression.theorem) {
      if (!this.theorem || !expression.theorem || !this.theorem.isEquivalentTo(expression.theorem, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.result || expression.result) {
      if (!this.result || !expression.result || !this.result.isEquivalentTo(expression.result, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveDef extends Fmt.MetaRefExpression {
  side?: Fmt.Expression;
  proof: ObjectContents_Proof;

  getName(): string {
    return 'ProveDef';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.side = argumentList.getOptionalValue('side', 0);
    let proofRaw = argumentList.getValue('proof', 1);
    if (proofRaw instanceof Fmt.CompoundExpression) {
      let newItem = new ObjectContents_Proof;
      newItem.fromCompoundExpression(proofRaw);
      this.proof = newItem;
    } else {
      throw new Error('proof: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      argumentList.add(this.side, 'side', true);
    }
    let proofExpr = new Fmt.CompoundExpression;
    this.proof.toCompoundExpression(proofExpr);
    argumentList.add(proofExpr, 'proof', false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveDef;
    let changed = false;
    if (this.side) {
      result.side = this.side.substitute(fn, replacedParameters);
      if (result.side !== this.side) {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveDef)) {
      return false;
    }
    if (this.side || expression.side) {
      if (!this.side || !expression.side || !this.side.isEquivalentTo(expression.side, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.proof || expression.proof) {
      if (!this.proof || !expression.proof || !this.proof.isEquivalentTo(expression.proof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveNeg extends Fmt.MetaRefExpression {
  proof: ObjectContents_Proof;

  getName(): string {
    return 'ProveNeg';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let proofRaw = argumentList.getValue('proof', 0);
    if (proofRaw instanceof Fmt.CompoundExpression) {
      let newItem = new ObjectContents_Proof;
      newItem.fromCompoundExpression(proofRaw);
      this.proof = newItem;
    } else {
      throw new Error('proof: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let proofExpr = new Fmt.CompoundExpression;
    this.proof.toCompoundExpression(proofExpr);
    argumentList.add(proofExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveNeg)) {
      return false;
    }
    if (this.proof || expression.proof) {
      if (!this.proof || !expression.proof || !this.proof.isEquivalentTo(expression.proof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveForAll extends Fmt.MetaRefExpression {
  proof: ObjectContents_Proof;

  getName(): string {
    return 'ProveForAll';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let proofRaw = argumentList.getValue('proof', 0);
    if (proofRaw instanceof Fmt.CompoundExpression) {
      let newItem = new ObjectContents_Proof;
      newItem.fromCompoundExpression(proofRaw);
      this.proof = newItem;
    } else {
      throw new Error('proof: Compound expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let proofExpr = new Fmt.CompoundExpression;
    this.proof.toCompoundExpression(proofExpr);
    argumentList.add(proofExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveForAll)) {
      return false;
    }
    if (this.proof || expression.proof) {
      if (!this.proof || !expression.proof || !this.proof.isEquivalentTo(expression.proof, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
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
        newItem.fromCompoundExpression(proofRaw);
        this.proof = newItem;
      } else {
        throw new Error('proof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    let argumentsExpr = new Fmt.CompoundExpression;
    argumentsExpr.arguments = this.arguments;
    argumentList.add(argumentsExpr, undefined, false);
    if (this.proof !== undefined) {
      let proofExpr = new Fmt.CompoundExpression;
      this.proof.toCompoundExpression(proofExpr);
      argumentList.add(proofExpr, 'proof', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveExists)) {
      return false;
    }
    if (this.arguments || expression.arguments) {
      if (!this.arguments || !expression.arguments || !this.arguments.isEquivalentTo(expression.arguments, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.proof || expression.proof) {
      if (!this.proof || !expression.proof || !this.proof.isEquivalentTo(expression.proof, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    let subsetProofRaw = argumentList.getOptionalValue('subsetProof', 0);
    if (subsetProofRaw !== undefined) {
      if (subsetProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(subsetProofRaw);
        this.subsetProof = newItem;
      } else {
        throw new Error('subsetProof: Compound expression expected');
      }
    }
    let supersetProofRaw = argumentList.getOptionalValue('supersetProof', 1);
    if (supersetProofRaw !== undefined) {
      if (supersetProofRaw instanceof Fmt.CompoundExpression) {
        let newItem = new ObjectContents_Proof;
        newItem.fromCompoundExpression(supersetProofRaw);
        this.supersetProof = newItem;
      } else {
        throw new Error('supersetProof: Compound expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.subsetProof !== undefined) {
      let subsetProofExpr = new Fmt.CompoundExpression;
      this.subsetProof.toCompoundExpression(subsetProofExpr);
      argumentList.add(subsetProofExpr, 'subsetProof', true);
    }
    if (this.supersetProof !== undefined) {
      let supersetProofExpr = new Fmt.CompoundExpression;
      this.supersetProof.toCompoundExpression(supersetProofExpr);
      argumentList.add(supersetProofExpr, 'supersetProof', true);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveSetEquals)) {
      return false;
    }
    if (this.subsetProof || expression.subsetProof) {
      if (!this.subsetProof || !expression.subsetProof || !this.subsetProof.isEquivalentTo(expression.subsetProof, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.supersetProof || expression.supersetProof) {
      if (!this.supersetProof || !expression.supersetProof || !this.supersetProof.isEquivalentTo(expression.supersetProof, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_ProveCases extends Fmt.MetaRefExpression {
  side?: Fmt.Expression;
  caseProofs: ObjectContents_Proof[];

  getName(): string {
    return 'ProveCases';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.side = argumentList.getOptionalValue('side', 0);
    let caseProofsRaw = argumentList.getValue('caseProofs', 1);
    if (caseProofsRaw instanceof Fmt.ArrayExpression) {
      this.caseProofs = [];
      for (let item of caseProofsRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_Proof;
          newItem.fromCompoundExpression(item);
          this.caseProofs.push(newItem);
        } else {
          throw new Error('caseProofs: Compound expression expected');
        }
      }
    } else {
      throw new Error('caseProofs: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.side !== undefined) {
      argumentList.add(this.side, 'side', true);
    }
    let caseProofsExpr = new Fmt.ArrayExpression;
    caseProofsExpr.items = [];
    for (let item of this.caseProofs) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem);
      caseProofsExpr.items.push(newItem);
    }
    argumentList.add(caseProofsExpr, 'caseProofs', false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ProveCases;
    let changed = false;
    if (this.side) {
      result.side = this.side.substitute(fn, replacedParameters);
      if (result.side !== this.side) {
        changed = true;
      }
    }
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveCases)) {
      return false;
    }
    if (this.side || expression.side) {
      if (!this.side || !expression.side || !this.side.isEquivalentTo(expression.side, fn, replacedParameters)) {
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
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.term = argumentList.getValue('term', 0);
    this.construction = argumentList.getValue('construction', 1);
    let casesRaw = argumentList.getValue('cases', 2);
    if (casesRaw instanceof Fmt.ArrayExpression) {
      this.cases = [];
      for (let item of casesRaw.items) {
        if (item instanceof Fmt.CompoundExpression) {
          let newItem = new ObjectContents_StructuralCase;
          newItem.fromCompoundExpression(item);
          this.cases.push(newItem);
        } else {
          throw new Error('cases: Compound expression expected');
        }
      }
    } else {
      throw new Error('cases: Array expression expected');
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.term, undefined, false);
    argumentList.add(this.construction, undefined, false);
    let casesExpr = new Fmt.ArrayExpression;
    casesExpr.items = [];
    for (let item of this.cases) {
      let newItem = new Fmt.CompoundExpression;
      item.toCompoundExpression(newItem);
      casesExpr.items.push(newItem);
    }
    argumentList.add(casesExpr, undefined, false);
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ProveByInduction)) {
      return false;
    }
    if (this.term || expression.term) {
      if (!this.term || !expression.term || !this.term.isEquivalentTo(expression.term, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.construction || expression.construction) {
      if (!this.construction || !expression.construction || !this.construction.isEquivalentTo(expression.construction, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.cases || expression.cases) {
      if (!this.cases || !expression.cases || this.cases.length !== expression.cases.length) {
        return false;
      }
      for (let i = 0; i < this.cases.length; i++) {
        let leftItem = this.cases[i];
        let rightItem = expression.cases[i];
        if (leftItem || rightItem) {
          if (!leftItem || !rightItem || !leftItem.isEquivalentTo(rightItem, fn, replacedParameters)) {
            return false;
          }
        }
      }
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
const expressionTypes: Fmt.MetaDefinitionList = {'Expr': MetaRefExpression_Expr, 'Bool': MetaRefExpression_Bool, 'Nat': MetaRefExpression_Nat, 'ParameterList': MetaRefExpression_ParameterList, 'DefinitionRef': MetaRefExpression_DefinitionRef, 'Prop': MetaRefExpression_Prop, 'Set': MetaRefExpression_Set, 'Subset': MetaRefExpression_Subset, 'Element': MetaRefExpression_Element, 'Constraint': MetaRefExpression_Constraint, 'Binding': MetaRefExpression_Binding, 'SetDef': MetaRefExpression_SetDef, 'Def': MetaRefExpression_Def, 'Consider': MetaRefExpression_Consider, 'State': MetaRefExpression_State, 'UseDef': MetaRefExpression_UseDef, 'UseCases': MetaRefExpression_UseCases, 'UseForAll': MetaRefExpression_UseForAll, 'UseExists': MetaRefExpression_UseExists, 'Embed': MetaRefExpression_Embed, 'SetExtend': MetaRefExpression_SetExtend, 'Extend': MetaRefExpression_Extend, 'Substitute': MetaRefExpression_Substitute, 'ResolveDef': MetaRefExpression_ResolveDef, 'UseTheorem': MetaRefExpression_UseTheorem, 'ProveDef': MetaRefExpression_ProveDef, 'ProveNeg': MetaRefExpression_ProveNeg, 'ProveForAll': MetaRefExpression_ProveForAll, 'ProveExists': MetaRefExpression_ProveExists, 'ProveSetEquals': MetaRefExpression_ProveSetEquals, 'ProveCases': MetaRefExpression_ProveCases, 'ProveByInduction': MetaRefExpression_ProveByInduction};
const functions: Fmt.MetaDefinitionList = {'true': MetaRefExpression_true, 'false': MetaRefExpression_false, 'left': MetaRefExpression_left, 'right': MetaRefExpression_right, 'empty': MetaRefExpression_empty, 'previous': MetaRefExpression_previous, 'enumeration': MetaRefExpression_enumeration, 'subset': MetaRefExpression_subset, 'extendedSubset': MetaRefExpression_extendedSubset, 'setStructuralCases': MetaRefExpression_setStructuralCases, 'cases': MetaRefExpression_cases, 'structuralCases': MetaRefExpression_structuralCases, 'not': MetaRefExpression_not, 'and': MetaRefExpression_and, 'or': MetaRefExpression_or, 'equiv': MetaRefExpression_equiv, 'forall': MetaRefExpression_forall, 'exists': MetaRefExpression_exists, 'existsUnique': MetaRefExpression_existsUnique, 'in': MetaRefExpression_in, 'sub': MetaRefExpression_sub, 'setEquals': MetaRefExpression_setEquals, 'equals': MetaRefExpression_equals, 'structural': MetaRefExpression_structural, '': Fmt.GenericMetaRefExpression};

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
      let type = parent.type.expression;
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
      let type = parent.type.expression;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_Construction) {
          if (argument.name === 'properties' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_Property, context);
          }
          if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtDisplay.metaModel;
          }
          if (argument.name === 'definitionDisplay' || (argument.name === undefined && argumentIndex === 2)) {
            context = new ArgumentTypeContext(ObjectContents_DefinitionDisplay, context);
          }
          if (argument.name === 'embedding' || (argument.name === undefined && argumentIndex === 3)) {
            context = new ArgumentTypeContext(ObjectContents_Embedding, context);
          }
        }
        if (type instanceof MetaRefExpression_Constructor) {
          if (argument.name === 'properties' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_Property, context);
          }
          if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtDisplay.metaModel;
          }
          if (argument.name === 'definitionDisplay' || (argument.name === undefined && argumentIndex === 2)) {
            context = new ArgumentTypeContext(ObjectContents_DefinitionDisplay, context);
          }
          if (argument.name === 'equalityDefinition' || (argument.name === undefined && argumentIndex === 3)) {
            for (; context instanceof Ctx.DerivedContext; context = context.parentContext) {
              if (context instanceof DefinitionContentsContext && context.definition.type.expression instanceof MetaRefExpression_Construction) {
                break;
              }
              if (context instanceof ArgumentTypeContext && context.objectContentsClass === ObjectContents_Construction) {
                break;
              }
            }
            context = new ArgumentTypeContext(ObjectContents_EqualityDefinition, context);
          }
          if (argument.name === 'rewrite' || (argument.name === undefined && argumentIndex === 4)) {
            context = new ArgumentTypeContext(ObjectContents_RewriteDefinition, context);
          }
        }
        if (type instanceof MetaRefExpression_SetOperator) {
          if (argument.name === 'properties' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_Property, context);
          }
          if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtDisplay.metaModel;
          }
          if (argument.name === 'definitionDisplay' || (argument.name === undefined && argumentIndex === 2)) {
            context = new ArgumentTypeContext(ObjectContents_DefinitionDisplay, context);
          }
          if (argument.name === 'equalityProofs' || (argument.name === undefined && argumentIndex === 4)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
          if (argument.name === 'setRestrictionProof' || (argument.name === undefined && argumentIndex === 6)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_ExplicitOperator) {
          if (argument.name === 'properties' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_Property, context);
          }
          if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtDisplay.metaModel;
          }
          if (argument.name === 'definitionDisplay' || (argument.name === undefined && argumentIndex === 2)) {
            context = new ArgumentTypeContext(ObjectContents_DefinitionDisplay, context);
          }
          if (argument.name === 'equalityProofs' || (argument.name === undefined && argumentIndex === 4)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
          if (argument.name === 'setRestrictionProof' || (argument.name === undefined && argumentIndex === 6)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_ImplicitOperator) {
          if (argument.name === 'properties' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_Property, context);
          }
          if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtDisplay.metaModel;
          }
          if (argument.name === 'definitionDisplay' || (argument.name === undefined && argumentIndex === 2)) {
            context = new ArgumentTypeContext(ObjectContents_DefinitionDisplay, context);
          }
          if (argument.name === 'definition' || (argument.name === undefined && argumentIndex === 4)) {
            let parameterValue = previousArguments.getOptionalValue('parameter', 0);
            if (parameterValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(parameterValue.parameters, context);
            }
          }
          if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 5)) {
            let parameterValue = previousArguments.getOptionalValue('parameter', 0);
            if (parameterValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(parameterValue.parameters, context);
            }
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
          if (argument.name === 'wellDefinednessProof' || (argument.name === undefined && argumentIndex === 6)) {
            context = new ArgumentTypeContext(ObjectContents_Proof, context);
          }
        }
        if (type instanceof MetaRefExpression_MacroOperator) {
          if (argument.name === 'properties' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_Property, context);
          }
          if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtDisplay.metaModel;
          }
          if (argument.name === 'definitionDisplay' || (argument.name === undefined && argumentIndex === 2)) {
            context = new ArgumentTypeContext(ObjectContents_DefinitionDisplay, context);
          }
        }
        if (type instanceof MetaRefExpression_Predicate) {
          if (argument.name === 'properties' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_Property, context);
          }
          if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
            context = new Ctx.DerivedContext(context);
            context.metaModel = FmtDisplay.metaModel;
          }
          if (argument.name === 'definitionDisplay' || (argument.name === undefined && argumentIndex === 2)) {
            context = new ArgumentTypeContext(ObjectContents_DefinitionDisplay, context);
          }
          if (argument.name === 'equivalenceProofs' || (argument.name === undefined && argumentIndex === 4)) {
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
          if (currentContext.objectContentsClass === ObjectContents_DefinitionDisplay) {
            if (argument.name === 'display' || (argument.name === undefined && argumentIndex === 1)) {
              let parameterValue = previousArguments.getOptionalValue('parameter', 0);
              if (parameterValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parameterValue.parameters, context);
              }
              context = new Ctx.DerivedContext(context);
              context.metaModel = FmtDisplay.metaModel;
            }
            if (argument.name === 'singularName' || (argument.name === undefined && argumentIndex === 2)) {
              context = new Ctx.DerivedContext(context);
              context.metaModel = FmtDisplay.metaModel;
            }
            if (argument.name === 'pluralName' || (argument.name === undefined && argumentIndex === 3)) {
              context = new Ctx.DerivedContext(context);
              context.metaModel = FmtDisplay.metaModel;
            }
            if (argument.name === 'nameOptional' || (argument.name === undefined && argumentIndex === 4)) {
              context = new Ctx.DerivedContext(context);
              context.metaModel = FmtDisplay.metaModel;
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_Embedding) {
            if (argument.name === 'target' || (argument.name === undefined && argumentIndex === 1)) {
              let parameterValue = previousArguments.getOptionalValue('parameter', 0);
              if (parameterValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parameterValue.parameters, context);
              }
            }
            if (argument.name === 'wellDefinednessProof' || (argument.name === undefined && argumentIndex === 2)) {
              context = new ArgumentTypeContext(ObjectContents_Proof, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_EqualityDefinition) {
            if (argument.name === 'rightParameters' || (argument.name === undefined && argumentIndex === 1)) {
              let leftParametersValue = previousArguments.getOptionalValue('leftParameters', 0);
              if (leftParametersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(leftParametersValue.parameters, context);
              }
            }
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
          if (currentContext.objectContentsClass === ObjectContents_BindingArg) {
            if (argument.name === 'arguments' || (argument.name === undefined && argumentIndex === 1)) {
              let parameterValue = previousArguments.getOptionalValue('parameter', 0);
              if (parameterValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(parameterValue.parameters, context);
              }
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_Case) {
            if (argument.name === 'wellDefinednessProof' || (argument.name === undefined && argumentIndex === 2)) {
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
          break;
        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    if (parent instanceof Fmt.MetaRefExpression) {
      if (parent instanceof MetaRefExpression_Binding) {
        if (argument.name === 'parameters' || (argument.name === undefined && argumentIndex === 1)) {
          for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {
            if (currentContext instanceof ParameterTypeContext) {
              context = new Ctx.ParameterContext(currentContext.parameter, context);
              break;
            }
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
      }
      if (parent instanceof MetaRefExpression_structuralCases) {
        if (argument.name === 'cases' || (argument.name === undefined && argumentIndex === 2)) {
          context = new ArgumentTypeContext(ObjectContents_StructuralCase, context);
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

  protected getExports(expression: Fmt.Expression, parentContext: Ctx.Context): Ctx.Context {
    let context = parentContext;
    if (expression instanceof MetaRefExpression_Binding) {
      context = this.getParameterListContext(expression.parameters, context);
    }
    if (expression instanceof MetaRefExpression_UseExists) {
      context = this.getParameterListContext(expression.parameters, context);
    }
    return context;
  }
}

export const metaModel = new MetaModel;

export function getMetaModel(path: Fmt.Path): MetaModel {
  if (path.name !== 'hlm') {
    throw new Error('File of type "hlm" expected');
  }
  return metaModel;
}
