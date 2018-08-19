// Generated from data/format/meta.hlm by generateMetaDeclarations.ts.
// tslint:disable:class-name
// tslint:disable:variable-name

import * as Fmt from './format';

export class ObjectContents_MetaModel extends Fmt.ObjectContents {
  definitionTypes: Fmt.Expression;
  expressionTypes?: Fmt.Expression;
  functions?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.definitionTypes = argumentList.getValue('definitionTypes', 0);
    this.expressionTypes = argumentList.getOptionalValue('expressionTypes', 1);
    this.functions = argumentList.getOptionalValue('functions', 2);
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
    return changed;
  }
}

export class MetaRefExpression_MetaModel extends Fmt.MetaRefExpression {
  static metaInnerDefinitionTypes: any = {};
  static readonly metaContents = ObjectContents_MetaModel;

  getName(): string {
    return 'MetaModel';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }
}

export class ObjectContents_DefinedType extends Fmt.ObjectContents {
  superType?: Fmt.Expression;
  members?: Fmt.ParameterList;

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
    return changed;
  }
}

export class ObjectContents_DefinitionType extends ObjectContents_DefinedType {
  innerDefinitionTypes?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.innerDefinitionTypes = argumentList.getOptionalValue('innerDefinitionTypes', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    if (this.innerDefinitionTypes !== undefined) {
      argumentList.add(this.innerDefinitionTypes, 'innerDefinitionTypes');
    }
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
}

export class MetaRefExpression_DefinitionType extends Fmt.MetaRefExpression {
  static metaInnerDefinitionTypes: any = {};
  static readonly metaContents = ObjectContents_DefinitionType;

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
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}

export class ObjectContents_ExpressionType extends ObjectContents_DefinedType {
  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ExpressionType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    return changed;
  }
}

export class MetaRefExpression_ExpressionType extends Fmt.MetaRefExpression {
  static metaInnerDefinitionTypes: any = {};
  static readonly metaContents = ObjectContents_ExpressionType;

  getName(): string {
    return 'ExpressionType';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }
}

export class ObjectContents_ParameterType extends ObjectContents_ExpressionType {
  argumentType?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.argumentType = argumentList.getOptionalValue('argumentType', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    if (this.argumentType !== undefined) {
      argumentList.add(this.argumentType, 'argumentType');
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_ParameterType, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.argumentType) {
      result.argumentType = this.argumentType.substitute(fn, replacedParameters);
      if (result.argumentType !== this.argumentType) {
        changed = true;
      }
    }
    return changed;
  }
}

export class MetaRefExpression_ParameterType extends Fmt.MetaRefExpression {
  static metaInnerDefinitionTypes: any = {};
  static readonly metaContents = ObjectContents_ParameterType;

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
    if (!changed) {
      result = this;
    }
    return fn(result);
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
}

export class MetaRefExpression_SingleParameter extends Fmt.MetaRefExpression {
  type: Fmt.Expression;

  getName(): string {
    return 'SingleParameter';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.type = argumentList.getValue('type', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.type);
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
    if (!changed) {
      result = this;
    }
    return fn(result);
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
}

export const metaDefinitions: Fmt.MetaDefinitions = {
  metaModelName: 'meta',
  definitionTypes: {'MetaModel': MetaRefExpression_MetaModel, 'DefinitionType': MetaRefExpression_DefinitionType, 'ExpressionType': MetaRefExpression_ExpressionType, 'ParameterType': MetaRefExpression_ParameterType, 'Any': MetaRefExpression_Any, 'Type': MetaRefExpression_Type, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'ParameterList': MetaRefExpression_ParameterList, 'SingleParameter': MetaRefExpression_SingleParameter, 'ArgumentList': MetaRefExpression_ArgumentList, '': Fmt.DefinitionRefExpression},
  expressionTypes: {'Any': MetaRefExpression_Any, 'Type': MetaRefExpression_Type, 'Int': MetaRefExpression_Int, 'String': MetaRefExpression_String, 'ParameterList': MetaRefExpression_ParameterList, 'SingleParameter': MetaRefExpression_SingleParameter, 'ArgumentList': MetaRefExpression_ArgumentList, '': Fmt.DefinitionRefExpression},
  functions: {'Any': MetaRefExpression_Any}
};
