// Generated from data/format/meta.slate by generateMetaDeclarations.ts.
// tslint:disable:class-name
// tslint:disable:variable-name

import * as Fmt from './format';

export class ObjectContents_MetaModel extends Fmt.ObjectContents {
  definitionTypes: Fmt.Expression;
  expressionTypes?: Fmt.Expression;
  functions?: Fmt.Expression;
  lookup?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.definitionTypes = argumentList.getValue('definitionTypes', 0);
    this.expressionTypes = argumentList.getOptionalValue('expressionTypes', 1);
    this.functions = argumentList.getOptionalValue('functions', 2);
    this.lookup = argumentList.getOptionalValue('lookup', 3);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.definitionTypes, 'definitionTypes');
    if (this.expressionTypes !== undefined) {
      argumentList.add(this.expressionTypes, 'expressionTypes');
    }
    if (this.functions !== undefined) {
      argumentList.add(this.functions, 'functions');
    }
    if (this.lookup !== undefined) {
      argumentList.add(this.lookup, 'lookup');
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_MetaModel {
    let result = new ObjectContents_MetaModel;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_MetaModel, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.definitionTypes) {
      result.definitionTypes = this.definitionTypes.substitute(fn, replacedParameters);
      if (result.definitionTypes !== this.definitionTypes) {
        changed = true;
      }
    }
    if (this.expressionTypes) {
      result.expressionTypes = this.expressionTypes.substitute(fn, replacedParameters);
      if (result.expressionTypes !== this.expressionTypes) {
        changed = true;
      }
    }
    if (this.functions) {
      result.functions = this.functions.substitute(fn, replacedParameters);
      if (result.functions !== this.functions) {
        changed = true;
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

  isEquivalentTo(objectContents: ObjectContents_MetaModel, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.definitionTypes || objectContents.definitionTypes) {
      if (!this.definitionTypes || !objectContents.definitionTypes || !this.definitionTypes.isEquivalentTo(objectContents.definitionTypes, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.expressionTypes || objectContents.expressionTypes) {
      if (!this.expressionTypes || !objectContents.expressionTypes || !this.expressionTypes.isEquivalentTo(objectContents.expressionTypes, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.functions || objectContents.functions) {
      if (!this.functions || !objectContents.functions || !this.functions.isEquivalentTo(objectContents.functions, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.lookup || objectContents.lookup) {
      if (!this.lookup || !objectContents.lookup || !this.lookup.isEquivalentTo(objectContents.lookup, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_MetaModel extends Fmt.MetaRefExpression {
  getName(): string {
    return 'MetaModel';
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
      return new MetaRefExpression_MetaModel;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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
  exports?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.superType = argumentList.getOptionalValue('superType', 0);
    let membersRaw = argumentList.getOptionalValue('members', 1);
    if (membersRaw !== undefined) {
      if (membersRaw instanceof Fmt.ParameterExpression) {
        this.members = membersRaw.parameters;
      } else {
        throw new Error('members: Parameter expression expected');
      }
    }
    this.exports = argumentList.getOptionalValue('exports', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.superType !== undefined) {
      argumentList.add(this.superType, 'superType');
    }
    if (this.members !== undefined) {
      let membersExpr = new Fmt.ParameterExpression;
      membersExpr.parameters.push(...this.members);
      argumentList.add(membersExpr, 'members');
    }
    if (this.exports !== undefined) {
      argumentList.add(this.exports, 'exports');
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_DefinedType {
    let result = new ObjectContents_DefinedType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_DefinedType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.superType) {
      result.superType = this.superType.substitute(fn, replacedParameters);
      if (result.superType !== this.superType) {
        changed = true;
      }
    }
    if (this.members) {
      result.members = Object.create(Fmt.ParameterList.prototype);
      if (this.members.substituteExpression(fn, result.members!, replacedParameters)) {
        changed = true;
      }
    }
    if (this.exports) {
      result.exports = this.exports.substitute(fn, replacedParameters);
      if (result.exports !== this.exports) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_DefinedType, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.superType || objectContents.superType) {
      if (!this.superType || !objectContents.superType || !this.superType.isEquivalentTo(objectContents.superType, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.members || objectContents.members) {
      if (!this.members || !objectContents.members || !this.members.isEquivalentTo(objectContents.members, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.exports || objectContents.exports) {
      if (!this.exports || !objectContents.exports || !this.exports.isEquivalentTo(objectContents.exports, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class ObjectContents_DefinitionType extends ObjectContents_DefinedType {
  innerDefinitionTypes?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.innerDefinitionTypes = argumentList.getOptionalValue('innerDefinitionTypes', 3);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    if (this.innerDefinitionTypes !== undefined) {
      argumentList.add(this.innerDefinitionTypes, 'innerDefinitionTypes');
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_DefinitionType {
    let result = new ObjectContents_DefinitionType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_DefinitionType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.innerDefinitionTypes) {
      result.innerDefinitionTypes = this.innerDefinitionTypes.substitute(fn, replacedParameters);
      if (result.innerDefinitionTypes !== this.innerDefinitionTypes) {
        changed = true;
      }
    }
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_DefinitionType, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.innerDefinitionTypes || objectContents.innerDefinitionTypes) {
      if (!this.innerDefinitionTypes || !objectContents.innerDefinitionTypes || !this.innerDefinitionTypes.isEquivalentTo(objectContents.innerDefinitionTypes, fn, replacedParameters)) {
        return false;
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.resultType = argumentList.getOptionalValue('resultType', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.resultType !== undefined) {
      argumentList.add(this.resultType, 'resultType');
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_DefinitionType)) {
      return false;
    }
    if (this.resultType || expression.resultType) {
      if (!this.resultType || !expression.resultType || !this.resultType.isEquivalentTo(expression.resultType, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_DefinitionType;
  }
}

export class ObjectContents_ExpressionType extends ObjectContents_DefinedType {
  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ExpressionType {
    let result = new ObjectContents_ExpressionType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ExpressionType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ExpressionType, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_ExpressionType;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.optional = argumentList.getOptionalValue('optional', 3);
    this.argumentType = argumentList.getOptionalValue('argumentType', 4);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    if (this.optional !== undefined) {
      argumentList.add(this.optional, 'optional');
    }
    if (this.argumentType !== undefined) {
      argumentList.add(this.argumentType, 'argumentType');
    }
  }

  clone(replacedParameters: Fmt.ReplacedParameter[] = []): ObjectContents_ParameterType {
    let result = new ObjectContents_ParameterType;
    this.substituteExpression(undefined, result, replacedParameters);
    return result;
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ParameterType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
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
    return changed;
  }

  isEquivalentTo(objectContents: ObjectContents_ParameterType, fn: Fmt.ExpressionUnificationFn = undefined, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    if (this === objectContents && !replacedParameters.length) {
      return true;
    }
    if (this.optional || objectContents.optional) {
      if (!this.optional || !objectContents.optional || !this.optional.isEquivalentTo(objectContents.optional, fn, replacedParameters)) {
        return false;
      }
    }
    if (this.argumentType || objectContents.argumentType) {
      if (!this.argumentType || !objectContents.argumentType || !this.argumentType.isEquivalentTo(objectContents.argumentType, fn, replacedParameters)) {
        return false;
      }
    }
    return super.isEquivalentTo(objectContents, fn, replacedParameters);
  }
}

export class MetaRefExpression_ParameterType extends Fmt.MetaRefExpression {
  variableType?: Fmt.Expression;

  getName(): string {
    return 'ParameterType';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.variableType = argumentList.getOptionalValue('variableType', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.variableType !== undefined) {
      argumentList.add(this.variableType, 'variableType');
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ParameterType)) {
      return false;
    }
    if (this.variableType || expression.variableType) {
      if (!this.variableType || !expression.variableType || !this.variableType.isEquivalentTo(expression.variableType, fn, replacedParameters)) {
        return false;
      }
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Any;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_self;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_Type;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

export class MetaRefExpression_Int extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Int';
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
      return new MetaRefExpression_Int;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    if (fn) {
      return fn(this);
    } else {
      return new MetaRefExpression_String;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
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

export class MetaRefExpression_SingleParameter extends Fmt.MetaRefExpression {
  type?: Fmt.Expression;

  getName(): string {
    return 'SingleParameter';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.type = argumentList.getOptionalValue('type', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.type !== undefined) {
      argumentList.add(this.type, 'type');
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
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

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_SingleParameter)) {
      return false;
    }
    if (this.type || expression.type) {
      if (!this.type || !expression.type || !this.type.isEquivalentTo(expression.type, fn, replacedParameters)) {
        return false;
      }
    }
    return true;
  }
}

export class MetaRefExpression_ArgumentList extends Fmt.MetaRefExpression {
  getName(): string {
    return 'ArgumentList';
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
      return new MetaRefExpression_ArgumentList;
    }
  }

  protected matches(expression: Fmt.Expression, fn: Fmt.ExpressionUnificationFn, replacedParameters: Fmt.ReplacedParameter[]): boolean {
    if (!(expression instanceof MetaRefExpression_ArgumentList)) {
      return false;
    }
    return true;
  }
}

class DefinitionContentsContext extends Fmt.DerivedContext {
  constructor(public definition: Fmt.Definition, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

class ParameterTypeContext extends Fmt.DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

class ArgumentTypeContext extends Fmt.DerivedContext {
  constructor(public objectContentsClass: {new(): Fmt.ObjectContents}, parentContext: Fmt.Context) {
    super(parentContext);
  }
}

const definitionTypes: Fmt.MetaDefinitionList = {'MetaModel': MetaRefExpression_MetaModel, 'DefinitionType': MetaRefExpression_DefinitionType, 'ExpressionType': MetaRefExpression_ExpressionType, 'ParameterType': MetaRefExpression_ParameterType, 'Any': MetaRefExpression_Any, 'Type': MetaRefExpression_Type, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'ParameterList': MetaRefExpression_ParameterList, 'SingleParameter': MetaRefExpression_SingleParameter, 'ArgumentList': MetaRefExpression_ArgumentList, '': Fmt.GenericMetaRefExpression};
const expressionTypes: Fmt.MetaDefinitionList = {'Any': MetaRefExpression_Any, 'Type': MetaRefExpression_Type, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'ParameterList': MetaRefExpression_ParameterList, 'SingleParameter': MetaRefExpression_SingleParameter, 'ArgumentList': MetaRefExpression_ArgumentList, '': Fmt.GenericMetaRefExpression};
const functions: Fmt.MetaDefinitionList = {'Any': MetaRefExpression_Any, 'self': MetaRefExpression_self, 'true': MetaRefExpression_true, 'false': MetaRefExpression_false, '': Fmt.GenericMetaRefExpression};

export class MetaModel extends Fmt.MetaModel {
  constructor() {
    super('meta',
          new Fmt.StandardMetaDefinitionFactory(definitionTypes),
          new Fmt.StandardMetaDefinitionFactory(expressionTypes),
          new Fmt.StandardMetaDefinitionFactory(functions));
  }

  getDefinitionContentsContext(definition: Fmt.Definition, parentContext: Fmt.Context): Fmt.Context {
    return new DefinitionContentsContext(definition, super.getDefinitionContentsContext(definition, parentContext));
  }

  getParameterTypeContext(parameter: Fmt.Parameter, parentContext: Fmt.Context): Fmt.Context {
    return new ParameterTypeContext(parameter, parentContext);
  }

  getNextArgumentContext(argument: Fmt.Argument, argumentIndex: number, previousContext: Fmt.Context): Fmt.Context {
    let parent = previousContext.parentObject;
    if (parent instanceof Fmt.Definition) {
      let type = parent.type.expression;
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
      for (let currentContext = previousContext; currentContext instanceof Fmt.DerivedContext; currentContext = currentContext.parentContext) {
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

  getArgumentValueContext(argument: Fmt.Argument, argumentIndex: number, previousArguments: Fmt.ArgumentList, parentContext: Fmt.Context): Fmt.Context {
    let context = parentContext;
    let parent = context.parentObject;
    if (parent instanceof Fmt.Definition) {
      let type = parent.type.expression;
      if (type instanceof Fmt.MetaRefExpression) {
        if (type instanceof MetaRefExpression_DefinitionType) {
          if (argument.name === 'superType' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
          }
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            let membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
          if (argument.name === 'innerDefinitionTypes' || (argument.name === undefined && argumentIndex === 3)) {
            context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
          }
        }
        if (type instanceof MetaRefExpression_ExpressionType) {
          if (argument.name === 'superType' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
          }
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            let membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
        }
        if (type instanceof MetaRefExpression_ParameterType) {
          if (argument.name === 'superType' || (argument.name === undefined && argumentIndex === 0)) {
            context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
          }
          if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
            let membersValue = previousArguments.getOptionalValue('members', 1);
            if (membersValue instanceof Fmt.ParameterExpression) {
              context = this.getParameterListContext(membersValue.parameters, context);
            }
          }
          if (argument.name === 'argumentType' || (argument.name === undefined && argumentIndex === 4)) {
            context = new ArgumentTypeContext(ObjectContents_ExpressionType, context);
          }
        }
      }
    }
    if (parent instanceof Fmt.CompoundExpression) {
      for (let currentContext = context; currentContext instanceof Fmt.DerivedContext; currentContext = currentContext.parentContext) {
        if (currentContext instanceof ArgumentTypeContext) {
          if (currentContext.objectContentsClass === ObjectContents_DefinedType) {
            if (argument.name === 'superType' || (argument.name === undefined && argumentIndex === 0)) {
              context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
            }
            if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
              let membersValue = previousArguments.getOptionalValue('members', 1);
              if (membersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(membersValue.parameters, context);
              }
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_DefinitionType) {
            if (argument.name === 'superType' || (argument.name === undefined && argumentIndex === 0)) {
              context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
            }
            if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
              let membersValue = previousArguments.getOptionalValue('members', 1);
              if (membersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(membersValue.parameters, context);
              }
            }
            if (argument.name === 'innerDefinitionTypes' || (argument.name === undefined && argumentIndex === 3)) {
              context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_ExpressionType) {
            if (argument.name === 'superType' || (argument.name === undefined && argumentIndex === 0)) {
              context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
            }
            if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
              let membersValue = previousArguments.getOptionalValue('members', 1);
              if (membersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(membersValue.parameters, context);
              }
            }
          }
          if (currentContext.objectContentsClass === ObjectContents_ParameterType) {
            if (argument.name === 'superType' || (argument.name === undefined && argumentIndex === 0)) {
              context = new ArgumentTypeContext(ObjectContents_DefinedType, context);
            }
            if (argument.name === 'exports' || (argument.name === undefined && argumentIndex === 2)) {
              let membersValue = previousArguments.getOptionalValue('members', 1);
              if (membersValue instanceof Fmt.ParameterExpression) {
                context = this.getParameterListContext(membersValue.parameters, context);
              }
            }
            if (argument.name === 'argumentType' || (argument.name === undefined && argumentIndex === 4)) {
              context = new ArgumentTypeContext(ObjectContents_ExpressionType, context);
            }
          }
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

export function getMetaModel(path: Fmt.Path) {
  if (path.name !== 'meta') {
    throw new Error('File of type "meta" expected');
  }
  return metaModel;
}
