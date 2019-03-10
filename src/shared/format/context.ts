import * as Fmt from './format';
import { MetaModel } from './metaModel';

export abstract class Context {
  constructor(public metaModel: MetaModel, public parentObject?: Object) {}

  abstract getVariables(): Fmt.Parameter[];
  abstract getVariable(name: string): Fmt.Parameter;
}

export class EmptyContext extends Context {
  getVariables(): Fmt.Parameter[] {
    return [];
  }

  getVariable(name: string): Fmt.Parameter {
    throw new Error(`Variable "${name}" not found`);
  }
}

export class DerivedContext extends Context {
  constructor(public parentContext: Context) {
    super(parentContext.metaModel, parentContext.parentObject);
  }

  getVariables(): Fmt.Parameter[] {
    return this.parentContext.getVariables();
  }

  getVariable(name: string): Fmt.Parameter {
    return this.parentContext.getVariable(name);
  }
}

export class ParentInfoContext extends DerivedContext {
  constructor(parentObject: Object, parentContext: Context) {
    super(parentContext);
    this.parentObject = parentObject;
  }
}

export class ParameterContext extends DerivedContext {
  constructor(public parameter: Fmt.Parameter, parentContext: Context) {
    super(parentContext);
  }

  getVariables(): Fmt.Parameter[] {
    return this.parentContext.getVariables().concat(this.parameter);
  }

  getVariable(name: string): Fmt.Parameter {
    if (this.parameter.name === name) {
      return this.parameter;
    }
    return this.parentContext.getVariable(name);
  }
}

export class DummyContext extends Context {
  getVariables(): Fmt.Parameter[] {
    return [];
  }

  getVariable(name: string): Fmt.Parameter {
    let param = new Fmt.Parameter;
    param.name = name;
    return param;
  }
}
