import * as Logic from '../logic';
import * as Ctx from '../../format/context';
import * as FmtHLM from './meta';
import { HLMDisplay } from './display';

export class HLM implements Logic.Logic {
  private display = new HLMDisplay;

  name = FmtHLM.metaModel.name;
  getMetaModel = FmtHLM.getMetaModel;
  getRootContext(): Ctx.Context { return FmtHLM.metaModel.getRootContext(); }
  getDisplay(): HLMDisplay { return this.display; }
}

export enum HLMTermType {
  SetTerm = Logic.LogicDefinitionType.SetOperator,
  ElementTerm = Logic.LogicDefinitionType.Operator,
  Formula = Logic.LogicDefinitionType.Predicate
}
