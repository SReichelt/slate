import * as Fmt from './format';
import { MetaModel } from './metaModel';

export abstract class Context {
  constructor(public metaModel: MetaModel, public parentObject?: Object) {}

  abstract getVariables(): VariableInfo[];
  abstract getVariable(name: string): VariableInfo;
}

export class EmptyContext extends Context {
  getVariables(): VariableInfo[] {
    return [];
  }

  getVariable(name: string): VariableInfo {
    throw new Error(`Variable "${name}" not found`);
  }
}

export class DerivedContext extends Context {
  constructor(public parentContext: Context) {
    super(parentContext.metaModel, parentContext.parentObject);
  }

  getVariables(): VariableInfo[] {
    return this.parentContext.getVariables();
  }

  getVariable(name: string): VariableInfo {
    return this.parentContext.getVariable(name);
  }
}

export class ParentInfoContext extends DerivedContext {
  constructor(parentObject: Object, parentContext: Context) {
    super(parentContext);
    this.parentObject = parentObject;
  }
}

export class ParameterContext extends DerivedContext implements VariableInfo {
  constructor(public parameter: Fmt.Parameter, parentContext: Context, public indexParameterLists?: Fmt.ParameterList[]) {
    super(parentContext);
  }

  getVariables(): VariableInfo[] {
    return this.parentContext.getVariables().concat(this);
  }

  getVariable(name: string): VariableInfo {
    if (this.parameter.name === name) {
      return this;
    }
    return this.parentContext.getVariable(name);
  }
}

export class DummyContext extends Context {
  getVariables(): VariableInfo[] {
    return [];
  }

  getVariable(name: string): VariableInfo {
    return {parameter: new Fmt.Parameter(name, new Fmt.PlaceholderExpression(undefined))};
  }
}

export interface VariableInfo {
  parameter: Fmt.Parameter;
  indexParameterLists?: Fmt.ParameterList[];
}
