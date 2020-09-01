// Generated from data/format/meta.slate by generateMetaDeclarations.ts.

import * as Fmt from './format';
import * as Ctx from './context';
import * as Meta from './metaModel';

export class ObjectContents_MetaModel extends Fmt.ObjectContents {
  definitionTypes: Fmt.Expression[];
  expressionTypes?: Fmt.Expression[];
  functions?: Fmt.Expression[];
  lookup?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    let definitionTypesRaw = argumentList.getValue('definitionTypes', 0);
    if (definitionTypesRaw instanceof Fmt.ArrayExpression) {
      this.definitionTypes = definitionTypesRaw.items;
    } else {
      throw new Error('definitionTypes: Array expression expected');
    }
    let expressionTypesRaw = argumentList.getOptionalValue('expressionTypes', 1);
    if (expressionTypesRaw !== undefined) {
      if (expressionTypesRaw instanceof Fmt.ArrayExpression) {
        this.expressionTypes = expressionTypesRaw.items;
      } else {
        throw new Error('expressionTypes: Array expression expected');
      }
    }
    let functionsRaw = argumentList.getOptionalValue('functions', 2);
    if (functionsRaw !== undefined) {
      if (functionsRaw instanceof Fmt.ArrayExpression) {
        this.functions = functionsRaw.items;
      } else {
        throw new Error('functions: Array expression expected');
      }
    }
    this.lookup = argumentList.getOptionalValue('lookup', 3);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    let definitionTypesExprItems: Fmt.Expression[] = [];
    for (let item of this.definitionTypes) {
      definitionTypesExprItems.push(item);
    }
    let definitionTypesExpr = new Fmt.ArrayExpression(definitionTypesExprItems);
    argumentList.add(definitionTypesExpr, outputAllNames ? 'definitionTypes' : undefined, false);
    if (this.expressionTypes !== undefined) {
      let expressionTypesExprItems: Fmt.Expression[] = [];
      for (let item of this.expressionTypes) {
        expressionTypesExprItems.push(item);
      }
      let expressionTypesExpr = new Fmt.ArrayExpression(expressionTypesExprItems);
      argumentList.add(expressionTypesExpr, 'expressionTypes', true);
    }
    if (this.functions !== undefined) {
      let functionsExprItems: Fmt.Expression[] = [];
      for (let item of this.functions) {
        functionsExprItems.push(item);
      }
      let functionsExpr = new Fmt.ArrayExpression(functionsExprItems);
      argumentList.add(functionsExpr, 'functions', true);
    }
    if (this.lookup !== undefined) {
      argumentList.add(this.lookup, 'lookup', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_MetaModel {
    let result = new ObjectContents_MetaModel;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definitionTypes) {
      for (let item of this.definitionTypes) {
        item.traverse(fn);
      }
    }
    if (this.expressionTypes) {
      for (let item of this.expressionTypes) {
        item.traverse(fn);
      }
    }
    if (this.functions) {
      for (let item of this.functions) {
        item.traverse(fn);
      }
    }
    if (this.lookup) {
      this.lookup.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_MetaModel, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.definitionTypes) {
      result.definitionTypes = [];
      for (let item of this.definitionTypes) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definitionTypes.push(newItem);
      }
    }
    if (this.expressionTypes) {
      result.expressionTypes = [];
      for (let item of this.expressionTypes) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.expressionTypes.push(newItem);
      }
    }
    if (this.functions) {
      result.functions = [];
      for (let item of this.functions) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.functions.push(newItem);
      }
    }
    if (this.lookup) {
      result.lookup = this.lookup.substitute(fn, replacedParameters);
      if (result.lookup !== this.lookup) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_MetaModel, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definitionTypes || objectContents.definitionTypes) {
      if (!this.definitionTypes || !objectContents.definitionTypes || this.definitionTypes.length !== objectContents.definitionTypes.length) {
        return false;
      }
      for (let i = 0; i < this.definitionTypes.length; i++) {
        let leftItem = this.definitionTypes[i];
        let rightItem = objectContents.definitionTypes[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.expressionTypes || objectContents.expressionTypes) {
      if (!this.expressionTypes || !objectContents.expressionTypes || this.expressionTypes.length !== objectContents.expressionTypes.length) {
        return false;
      }
      for (let i = 0; i < this.expressionTypes.length; i++) {
        let leftItem = this.expressionTypes[i];
        let rightItem = objectContents.expressionTypes[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (this.functions || objectContents.functions) {
      if (!this.functions || !objectContents.functions || this.functions.length !== objectContents.functions.length) {
        return false;
      }
      for (let i = 0; i < this.functions.length; i++) {
        let leftItem = this.functions[i];
        let rightItem = objectContents.functions[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    if (!Fmt.areObjectsEquivalent(this.lookup, objectContents.lookup, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_MetaModel extends Fmt.MetaRefExpression {
  getName(): string {
    return 'MetaModel';
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
      return new MetaRefExpression_MetaModel;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_MetaModel)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_MetaModel;
  }
}

export class ObjectContents_DefinedType extends Fmt.ObjectContents {
  superType?: Fmt.Expression;
  members?: Fmt.ParameterList;
  exports?: Fmt.Expression[];

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.superType = argumentList.getOptionalValue('superType', 0);
    let membersRaw = argumentList.getOptionalValue('members', 1);
    if (membersRaw !== undefined) {
      if (membersRaw instanceof Fmt.ParameterExpression) {
        this.members = membersRaw.parameters;
      } else {
        throw new Error('members: Parameter expression expected');
      }
    }
    let exportsRaw = argumentList.getOptionalValue('exports', 2);
    if (exportsRaw !== undefined) {
      if (exportsRaw instanceof Fmt.ArrayExpression) {
        this.exports = exportsRaw.items;
      } else {
        throw new Error('exports: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.superType !== undefined) {
      argumentList.add(this.superType, 'superType', true);
    }
    if (this.members !== undefined) {
      let membersExpr = new Fmt.ParameterExpression(this.members);
      argumentList.add(membersExpr, 'members', true);
    }
    if (this.exports !== undefined) {
      let exportsExprItems: Fmt.Expression[] = [];
      for (let item of this.exports) {
        exportsExprItems.push(item);
      }
      let exportsExpr = new Fmt.ArrayExpression(exportsExprItems);
      argumentList.add(exportsExpr, 'exports', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_DefinedType {
    let result = new ObjectContents_DefinedType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.superType) {
      this.superType.traverse(fn);
    }
    if (this.members) {
      this.members.traverse(fn);
    }
    if (this.exports) {
      for (let item of this.exports) {
        item.traverse(fn);
      }
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_DefinedType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.superType) {
      result.superType = this.superType.substitute(fn, replacedParameters);
      if (result.superType !== this.superType) {
        changed = true;
      }
    }
    if (this.members) {
      result.members = new Fmt.ParameterList;
      if (this.members.substituteExpression(fn, result.members!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.exports) {
      result.exports = [];
      for (let item of this.exports) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.exports.push(newItem);
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_DefinedType, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.superType, objectContents.superType, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.members, objectContents.members, fn, replacedParameters)) {
      return false;
    }
    if (this.exports || objectContents.exports) {
      if (!this.exports || !objectContents.exports || this.exports.length !== objectContents.exports.length) {
        return false;
      }
      for (let i = 0; i < this.exports.length; i++) {
        let leftItem = this.exports[i];
        let rightItem = objectContents.exports[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class ObjectContents_DefinitionType extends ObjectContents_DefinedType {
  innerDefinitionTypes?: Fmt.Expression[];

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    let innerDefinitionTypesRaw = argumentList.getOptionalValue('innerDefinitionTypes', 3);
    if (innerDefinitionTypesRaw !== undefined) {
      if (innerDefinitionTypesRaw instanceof Fmt.ArrayExpression) {
        this.innerDefinitionTypes = innerDefinitionTypesRaw.items;
      } else {
        throw new Error('innerDefinitionTypes: Array expression expected');
      }
    }
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    if (this.innerDefinitionTypes !== undefined) {
      let innerDefinitionTypesExprItems: Fmt.Expression[] = [];
      for (let item of this.innerDefinitionTypes) {
        innerDefinitionTypesExprItems.push(item);
      }
      let innerDefinitionTypesExpr = new Fmt.ArrayExpression(innerDefinitionTypesExprItems);
      argumentList.add(innerDefinitionTypesExpr, 'innerDefinitionTypes', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_DefinitionType {
    let result = new ObjectContents_DefinitionType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.innerDefinitionTypes) {
      for (let item of this.innerDefinitionTypes) {
        item.traverse(fn);
      }
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_DefinitionType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.innerDefinitionTypes) {
      result.innerDefinitionTypes = [];
      for (let item of this.innerDefinitionTypes) {
        let newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.innerDefinitionTypes.push(newItem);
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_DefinitionType, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.innerDefinitionTypes || objectContents.innerDefinitionTypes) {
      if (!this.innerDefinitionTypes || !objectContents.innerDefinitionTypes || this.innerDefinitionTypes.length !== objectContents.innerDefinitionTypes.length) {
        return false;
      }
      for (let i = 0; i < this.innerDefinitionTypes.length; i++) {
        let leftItem = this.innerDefinitionTypes[i];
        let rightItem = objectContents.innerDefinitionTypes[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_DefinitionType extends Fmt.MetaRefExpression {
  resultType?: Fmt.Expression;

  getName(): string {
    return 'DefinitionType';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.resultType = argumentList.getOptionalValue('resultType', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.resultType !== undefined) {
      argumentList.add(this.resultType, 'resultType', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_DefinitionType;
    let changed = false;
    if (this.resultType) {
      result.resultType = this.resultType.substitute(fn, replacedParameters);
      if (result.resultType !== this.resultType) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_DefinitionType)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.resultType, expression.resultType, fn, replacedParameters)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_DefinitionType;
  }
}

export class ObjectContents_ExpressionType extends ObjectContents_DefinedType {
  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ExpressionType {
    let result = new ObjectContents_ExpressionType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ExpressionType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ExpressionType, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_ExpressionType extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ExpressionType';
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
      return new MetaRefExpression_ExpressionType;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ExpressionType)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_ExpressionType;
  }
}

export class ObjectContents_ParameterType extends ObjectContents_ExpressionType {
  optional?: Fmt.Expression;
  argumentType?: Fmt.Expression;
  canOmit?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    this.optional = argumentList.getOptionalValue('optional', 3);
    this.argumentType = argumentList.getOptionalValue('argumentType', 4);
    this.canOmit = argumentList.getOptionalValue('canOmit', 5);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): void {
    super.toArgumentList(argumentList, outputAllNames, reportFn);
    if (this.optional !== undefined) {
      argumentList.add(this.optional, 'optional', true);
    }
    if (this.argumentType !== undefined) {
      argumentList.add(this.argumentType, 'argumentType', true);
    }
    if (this.canOmit !== undefined) {
      argumentList.add(this.canOmit, 'canOmit', true);
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ParameterType {
    let result = new ObjectContents_ParameterType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.optional) {
      this.optional.traverse(fn);
    }
    if (this.argumentType) {
      this.argumentType.traverse(fn);
    }
    if (this.canOmit) {
      this.canOmit.traverse(fn);
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ParameterType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.optional) {
      result.optional = this.optional.substitute(fn, replacedParameters);
      if (result.optional !== this.optional) {
        changed = true;
      }
    }
    if (this.argumentType) {
      result.argumentType = this.argumentType.substitute(fn, replacedParameters);
      if (result.argumentType !== this.argumentType) {
        changed = true;
      }
    }
    if (this.canOmit) {
      result.canOmit = this.canOmit.substitute(fn, replacedParameters);
      if (result.canOmit !== this.canOmit) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ParameterType, fn?: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (!Fmt.areObjectsEquivalent(this.optional, objectContents.optional, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.argumentType, objectContents.argumentType, fn, replacedParameters)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.canOmit, objectContents.canOmit, fn, replacedParameters)) {
      return false;
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_ParameterType extends Fmt.MetaRefExpression {
  variableType?: Fmt.Expression;

  getName(): string {
    return 'ParameterType';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.variableType = argumentList.getOptionalValue('variableType', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.variableType !== undefined) {
      argumentList.add(this.variableType, 'variableType', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_ParameterType;
    let changed = false;
    if (this.variableType) {
      result.variableType = this.variableType.substitute(fn, replacedParameters);
      if (result.variableType !== this.variableType) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ParameterType)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.variableType, expression.variableType, fn, replacedParameters)) {
      return false;
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_ParameterType;
  }
}

export class MetaRefExpression_Any extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Any';
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
      return new MetaRefExpression_Any;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Any)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_self extends Fmt.MetaRefExpression {
  getName(): string {
    return 'self';
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
      return new MetaRefExpression_self;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_self)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_Type extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Type';
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
      return new MetaRefExpression_Type;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Type)) {
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

export class MetaRefExpression_Int extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Int';
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
      return new MetaRefExpression_Int;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_Int)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_String extends Fmt.MetaRefExpression {
  getName(): string {
    return 'String';
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
      return new MetaRefExpression_String;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_String)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ParameterList extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ParameterList';
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
      return new MetaRefExpression_ParameterList;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ParameterList)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_SingleParameter extends Fmt.MetaRefExpression {
  type?: Fmt.Expression;

  getName(): string {
    return 'SingleParameter';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.type = argumentList.getOptionalValue('type', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    argumentList.length = 0;
    if (this.type !== undefined) {
      argumentList.add(this.type, 'type', true);
    }
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_SingleParameter;
    let changed = false;
    if (this.type) {
      result.type = this.type.substitute(fn, replacedParameters);
      if (result.type !== this.type) {
        changed = true;
      }
    }
    return this.getSubstitutionResult(fn, result, changed);
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_SingleParameter)) {
      return false;
    }
    if (!Fmt.areObjectsEquivalent(this.type, expression.type, fn, replacedParameters)) {
      return false;
    }
    return true;
  }
}

export class MetaRefExpression_ArgumentList extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ArgumentList';
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
      return new MetaRefExpression_ArgumentList;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn | undefined, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ArgumentList)) {
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

const definitionTypes: Fmt.MetaDefinitionList = {'MetaModel': MetaRefExpression_MetaModel, 'DefinitionType': MetaRefExpression_DefinitionType, 'ExpressionType': MetaRefExpression_ExpressionType, 'ParameterType': MetaRefExpression_ParameterType, 'Any': MetaRefExpression_Any, 'Type': MetaRefExpression_Type, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'ParameterList': MetaRefExpression_ParameterList, 'SingleParameter': MetaRefExpression_SingleParameter, 'ArgumentList': MetaRefExpression_ArgumentList, '': null};
const expressionTypes: Fmt.MetaDefinitionList = {'Any': MetaRefExpression_Any, 'Type': MetaRefExpression_Type, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'ParameterList': MetaRefExpression_ParameterList, 'SingleParameter': MetaRefExpression_SingleParameter, 'ArgumentList': MetaRefExpression_ArgumentList, '': null};
const functions: Fmt.MetaDefinitionList = {'Any': MetaRefExpression_Any, 'self': MetaRefExpression_self, 'true': MetaRefExpression_true, 'false': MetaRefExpression_false, '': null};

export class MetaModel extends Meta.MetaModel {
  constructor() {
    super('meta',
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
        if (type instanceof MetaRefExpression_MetaModel
            || type instanceof MetaRefExpression_DefinitionType
            || type instanceof MetaRefExpression_ExpressionType
            || type instanceof MetaRefExpression_ParameterType) {
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
        if (type instanceof MetaRefExpression_DefinitionType) {
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            let membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
        }
        if (type instanceof MetaRefExpression_ExpressionType) {
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            let membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
        }
        if (type instanceof MetaRefExpression_ParameterType) {
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            let membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
        }
      }
    }
    if (parent instanceof Fmt.CompoundExpression) {
      for (let currentContext = context; currentContext instanceof Ctx.DerivedContext; currentContext = currentContext.parentContext) {
        if (currentContext instanceof ArgumentTypeContext) {
          break;
        } else if (currentContext.parentObject !== parent && !(currentContext.parentObject instanceof Fmt.ArrayExpression)) {
          break;
        }
      }
    }
    return context;
  }
}

export const metaModel = new MetaModel;

export function getMetaModel(path?: Fmt.Path): MetaModel {
  if (path && path.name !== 'meta') {
    throw new Error('File of type "meta" expected');
  }
  return metaModel;
}
