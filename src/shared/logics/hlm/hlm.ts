import * as Logic from '../logic';
import * as Ctx from '../../format/context';
import * as FmtHLM from './meta';
import { HLMChecker } from './checker';
import { HLMDisplay } from './display';

const hlmDefinitionTypes: Logic.LogicDefinitionTypeDescription[] = [
  {
    definitionType: Logic.LogicDefinitionType.Operator,
    name: 'Operator'
  },
  {
    definitionType: Logic.LogicDefinitionType.SetOperator,
    name: 'Set operator'
  },
  {
    definitionType: Logic.LogicDefinitionType.Construction,
    name: 'Construction'
  },
  {
    definitionType: Logic.LogicDefinitionType.Predicate,
    name: 'Predicate'
  },
  {
    definitionType: Logic.LogicDefinitionType.Theorem,
    name: 'Theorem'
  }
];

export class HLM implements Logic.Logic {
  private checker = new HLMChecker;
  private display = new HLMDisplay;

  name = FmtHLM.metaModel.name;
  topLevelDefinitionTypes = hlmDefinitionTypes;
  getMetaModel = FmtHLM.getMetaModel;
  getRootContext(): Ctx.Context { return FmtHLM.metaModel.getRootContext(); }
  getChecker(): HLMChecker { return this.checker; }
  getDisplay(): HLMDisplay { return this.display; }
}

export enum HLMTermType {
  SetTerm = Logic.LogicDefinitionType.SetOperator,
  ElementTerm = Logic.LogicDefinitionType.Operator,
  Formula = Logic.LogicDefinitionType.Predicate
}
