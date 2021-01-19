// Generated from data/format/meta.slate by generateMetaDeclarations.ts.

import * as Fmt from './format';
import * as Ctx from './context';
import * as Meta from './metaModel';

/* eslint-disable no-shadow */

export class ObjectContents_MetaModel extends Fmt.ObjectContents {
  constructor(public definitionTypes: Fmt.Expression[], public expressionTypes?: Fmt.Expression[], public functions?: Fmt.Expression[], public lookup?: Fmt.Expression) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_MetaModel {
    const result: ObjectContents_MetaModel = Object.create(ObjectContents_MetaModel.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    const definitionTypesRaw = argumentList.getValue('definitionTypes', 0);
    if (definitionTypesRaw instanceof Fmt.ArrayExpression) {
      this.definitionTypes = definitionTypesRaw.items;
    } else {
      throw new Error('definitionTypes: Array expression expected');
    }
    const expressionTypesRaw = argumentList.getOptionalValue('expressionTypes', 1);
    if (expressionTypesRaw !== undefined) {
      if (expressionTypesRaw instanceof Fmt.ArrayExpression) {
        this.expressionTypes = expressionTypesRaw.items;
      } else {
        throw new Error('expressionTypes: Array expression expected');
      }
    }
    const functionsRaw = argumentList.getOptionalValue('functions', 2);
    if (functionsRaw !== undefined) {
      if (functionsRaw instanceof Fmt.ArrayExpression) {
        this.functions = functionsRaw.items;
      } else {
        throw new Error('functions: Array expression expected');
      }
    }
    this.lookup = argumentList.getOptionalValue('lookup', 3);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    const definitionTypesExprItems: Fmt.Expression[] = [];
    for (const item of this.definitionTypes) {
      definitionTypesExprItems.push(item);
    }
    const definitionTypesExpr = new Fmt.ArrayExpression(definitionTypesExprItems);
    argumentList.push(new Fmt.Argument(outputAllNames ? 'definitionTypes' : undefined, definitionTypesExpr, false));
    if (this.expressionTypes !== undefined) {
      const expressionTypesExprItems: Fmt.Expression[] = [];
      for (const item of this.expressionTypes) {
        expressionTypesExprItems.push(item);
      }
      const expressionTypesExpr = new Fmt.ArrayExpression(expressionTypesExprItems);
      argumentList.push(new Fmt.Argument('expressionTypes', expressionTypesExpr, true));
    }
    if (this.functions !== undefined) {
      const functionsExprItems: Fmt.Expression[] = [];
      for (const item of this.functions) {
        functionsExprItems.push(item);
      }
      const functionsExpr = new Fmt.ArrayExpression(functionsExprItems);
      argumentList.push(new Fmt.Argument('functions', functionsExpr, true));
    }
    if (this.lookup !== undefined) {
      argumentList.push(new Fmt.Argument('lookup', this.lookup, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_MetaModel {
    const result: ObjectContents_MetaModel = Object.create(ObjectContents_MetaModel.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_MetaModel {
    const result: ObjectContents_MetaModel = Object.create(ObjectContents_MetaModel.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.definitionTypes) {
      for (const item of this.definitionTypes) {
        item.traverse(fn);
      }
    }
    if (this.expressionTypes) {
      for (const item of this.expressionTypes) {
        item.traverse(fn);
      }
    }
    if (this.functions) {
      for (const item of this.functions) {
        item.traverse(fn);
      }
    }
    if (this.lookup) {
      this.lookup.traverse(fn);
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_MetaModel, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.definitionTypes) {
      result.definitionTypes = [];
      for (const item of this.definitionTypes) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.definitionTypes.push(newItem);
      }
    }
    if (this.expressionTypes) {
      result.expressionTypes = [];
      for (const item of this.expressionTypes) {
        const newItem = item.substitute(fn, replacedParameters);
        if (newItem !== item) {
          changed = true;
        }
        result.expressionTypes.push(newItem);
      }
    }
    if (this.functions) {
      result.functions = [];
      for (const item of this.functions) {
        const newItem = item.substitute(fn, replacedParameters);
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
        const leftItem = this.definitionTypes[i];
        const rightItem = objectContents.definitionTypes[i];
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
        const leftItem = this.expressionTypes[i];
        const rightItem = objectContents.expressionTypes[i];
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
        const leftItem = this.functions[i];
        const rightItem = objectContents.functions[i];
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

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
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
    return Object.create(ObjectContents_MetaModel.prototype);
  }
}

export class ObjectContents_DefinedType extends Fmt.ObjectContents {
  constructor(public superType?: Fmt.Expression, public members?: Fmt.ParameterList, public exports?: Fmt.Expression[]) {
    super();
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_DefinedType {
    const result: ObjectContents_DefinedType = Object.create(ObjectContents_DefinedType.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.superType = argumentList.getOptionalValue('superType', 0);
    const membersRaw = argumentList.getOptionalValue('members', 1);
    if (membersRaw !== undefined) {
      if (membersRaw instanceof Fmt.ParameterExpression) {
        this.members = membersRaw.parameters;
      } else {
        throw new Error('members: Parameter expression expected');
      }
    }
    const exportsRaw = argumentList.getOptionalValue('exports', 2);
    if (exportsRaw !== undefined) {
      if (exportsRaw instanceof Fmt.ArrayExpression) {
        this.exports = exportsRaw.items;
      } else {
        throw new Error('exports: Array expression expected');
      }
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.superType !== undefined) {
      argumentList.push(new Fmt.Argument('superType', this.superType, true));
    }
    if (this.members !== undefined) {
      const membersExpr = new Fmt.ParameterExpression(this.members);
      argumentList.push(new Fmt.Argument('members', membersExpr, true));
    }
    if (this.exports !== undefined) {
      const exportsExprItems: Fmt.Expression[] = [];
      for (const item of this.exports) {
        exportsExprItems.push(item);
      }
      const exportsExpr = new Fmt.ArrayExpression(exportsExprItems);
      argumentList.push(new Fmt.Argument('exports', exportsExpr, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_DefinedType {
    const result: ObjectContents_DefinedType = Object.create(ObjectContents_DefinedType.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_DefinedType {
    const result: ObjectContents_DefinedType = Object.create(ObjectContents_DefinedType.prototype);
    this.substitute(undefined, result, replacedParameters);
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
      for (const item of this.exports) {
        item.traverse(fn);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_DefinedType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.superType) {
      result.superType = this.superType.substitute(fn, replacedParameters);
      if (result.superType !== this.superType) {
        changed = true;
      }
    }
    if (this.members) {
      result.members = this.members.substitute(fn, replacedParameters);
      if (result.members !== this.members) {
        changed = true;
      }
    }
    if (this.exports) {
      result.exports = [];
      for (const item of this.exports) {
        const newItem = item.substitute(fn, replacedParameters);
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
        const leftItem = this.exports[i];
        const rightItem = objectContents.exports[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return true;
  }
}

export class ObjectContents_DefinitionType extends ObjectContents_DefinedType {
  constructor(superType?: Fmt.Expression, members?: Fmt.ParameterList, exports?: Fmt.Expression[], public innerDefinitionTypes?: Fmt.Expression[]) {
    super(superType, members, exports);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_DefinitionType {
    const result: ObjectContents_DefinitionType = Object.create(ObjectContents_DefinitionType.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    const innerDefinitionTypesRaw = argumentList.getOptionalValue('innerDefinitionTypes', 3);
    if (innerDefinitionTypesRaw !== undefined) {
      if (innerDefinitionTypesRaw instanceof Fmt.ArrayExpression) {
        this.innerDefinitionTypes = innerDefinitionTypesRaw.items;
      } else {
        throw new Error('innerDefinitionTypes: Array expression expected');
      }
    }
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    if (this.innerDefinitionTypes !== undefined) {
      const innerDefinitionTypesExprItems: Fmt.Expression[] = [];
      for (const item of this.innerDefinitionTypes) {
        innerDefinitionTypesExprItems.push(item);
      }
      const innerDefinitionTypesExpr = new Fmt.ArrayExpression(innerDefinitionTypesExprItems);
      argumentList.push(new Fmt.Argument('innerDefinitionTypes', innerDefinitionTypesExpr, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_DefinitionType {
    const result: ObjectContents_DefinitionType = Object.create(ObjectContents_DefinitionType.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_DefinitionType {
    const result: ObjectContents_DefinitionType = Object.create(ObjectContents_DefinitionType.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
    if (this.innerDefinitionTypes) {
      for (const item of this.innerDefinitionTypes) {
        item.traverse(fn);
      }
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_DefinitionType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
    if (this.innerDefinitionTypes) {
      result.innerDefinitionTypes = [];
      for (const item of this.innerDefinitionTypes) {
        const newItem = item.substitute(fn, replacedParameters);
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
        const leftItem = this.innerDefinitionTypes[i];
        const rightItem = objectContents.innerDefinitionTypes[i];
        if (!Fmt.areObjectsEquivalent(leftItem, rightItem, fn, replacedParameters)) {
          return false;
        }
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_DefinitionType extends Fmt.MetaRefExpression {
  constructor(public resultType?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'DefinitionType';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.resultType = argumentList.getOptionalValue('resultType', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.resultType !== undefined) {
      argumentList.push(new Fmt.Argument('resultType', this.resultType, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let resultTypeResult: Fmt.Expression | undefined = undefined;
    if (this.resultType) {
      resultTypeResult = this.resultType.substitute(fn, replacedParameters);
      if (resultTypeResult !== this.resultType) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_DefinitionType(resultTypeResult);
    return fn ? fn(result) : result;
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
    return Object.create(ObjectContents_DefinitionType.prototype);
  }
}

export class ObjectContents_ExpressionType extends ObjectContents_DefinedType {
  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ExpressionType {
    const result: ObjectContents_ExpressionType = Object.create(ObjectContents_ExpressionType.prototype);
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

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ExpressionType {
    const result: ObjectContents_ExpressionType = Object.create(ObjectContents_ExpressionType.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ExpressionType {
    const result: ObjectContents_ExpressionType = Object.create(ObjectContents_ExpressionType.prototype);
    this.substitute(undefined, result, replacedParameters);
    return result;
  }

  traverse(fn: Fmt.ExpressionTraversalFn): void {
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ExpressionType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    const changed = super.substitute(fn, result, replacedParameters);
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

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
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
    return Object.create(ObjectContents_ExpressionType.prototype);
  }
}

export class ObjectContents_ParameterType extends ObjectContents_ExpressionType {
  constructor(superType?: Fmt.Expression, members?: Fmt.ParameterList, exports?: Fmt.Expression[], public optional?: Fmt.Expression, public argumentType?: Fmt.Expression, public canOmit?: Fmt.Expression) {
    super(superType, members, exports);
  }

  static createFromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): ObjectContents_ParameterType {
    const result: ObjectContents_ParameterType = Object.create(ObjectContents_ParameterType.prototype);
    result.fromArgumentList(argumentList, reportFn);
    return result;
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    super.fromArgumentList(argumentList, reportFn);
    this.optional = argumentList.getOptionalValue('optional', 3);
    this.argumentType = argumentList.getOptionalValue('argumentType', 4);
    this.canOmit = argumentList.getOptionalValue('canOmit', 5);
  }

  toArgumentList(outputAllNames: boolean, reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = super.toArgumentList(outputAllNames, reportFn);
    if (this.optional !== undefined) {
      argumentList.push(new Fmt.Argument('optional', this.optional, true));
    }
    if (this.argumentType !== undefined) {
      argumentList.push(new Fmt.Argument('argumentType', this.argumentType, true));
    }
    if (this.canOmit !== undefined) {
      argumentList.push(new Fmt.Argument('canOmit', this.canOmit, true));
    }
    return argumentList;
  }

  static createFromExpression(expression: Fmt.Expression, reportFn?: Fmt.ReportConversionFn): ObjectContents_ParameterType {
    const result: ObjectContents_ParameterType = Object.create(ObjectContents_ParameterType.prototype);
    result.fromExpression(expression, reportFn);
    return result;
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ParameterType {
    const result: ObjectContents_ParameterType = Object.create(ObjectContents_ParameterType.prototype);
    this.substitute(undefined, result, replacedParameters);
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

  substitute(fn: Fmt.ExpressionSubstitutionFn | undefined, result: ObjectContents_ParameterType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substitute(fn, result, replacedParameters);
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
  constructor(public variableType?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'ParameterType';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.variableType = argumentList.getOptionalValue('variableType', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.variableType !== undefined) {
      argumentList.push(new Fmt.Argument('variableType', this.variableType, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let variableTypeResult: Fmt.Expression | undefined = undefined;
    if (this.variableType) {
      variableTypeResult = this.variableType.substitute(fn, replacedParameters);
      if (variableTypeResult !== this.variableType) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_ParameterType(variableTypeResult);
    return fn ? fn(result) : result;
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
    return Object.create(ObjectContents_ParameterType.prototype);
  }
}

export class MetaRefExpression_Any extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Any';
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

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
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

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
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

export class MetaRefExpression_Int extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Int';
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

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
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

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
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
  constructor(public type?: Fmt.Expression) {
    super();
  }

  getName(): string {
    return 'SingleParameter';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList, reportFn?: Fmt.ReportConversionFn): void {
    this.type = argumentList.getOptionalValue('type', 0);
  }

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    if (this.type !== undefined) {
      argumentList.push(new Fmt.Argument('type', this.type, true));
    }
    return argumentList;
  }

  substitute(fn?: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let changed = false;
    let typeResult: Fmt.Expression | undefined = undefined;
    if (this.type) {
      typeResult = this.type.substitute(fn, replacedParameters);
      if (typeResult !== this.type) {
        changed = true;
      }
    }
    if (fn && !changed) {
      return fn(this);
    }
    const result = new MetaRefExpression_SingleParameter(typeResult);
    return fn ? fn(result) : result;
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

  toArgumentList(reportFn?: Fmt.ReportConversionFn): Fmt.ArgumentList {
    const argumentList = new Fmt.ArgumentList;
    return argumentList;
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
  constructor(public objectContentsClass: Function, parentContext: Ctx.Context) {
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
    const parent = previousContext.parentObject;
    if (parent instanceof Fmt.Definition) {
      const type = parent.type;
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
    const parent = context.parentObject;
    if (parent instanceof Fmt.Definition) {
      const type = parent.type;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_DefinitionType) {
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            const membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
        }
        if (type instanceof MetaRefExpression_ExpressionType) {
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            const membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
        }
        if (type instanceof MetaRefExpression_ParameterType) {
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            const membersValue = previousArguments.getOptionalValue('members', 1);
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
