import * as Logic from '../logic';
import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as FmtHLM from './meta';
import { HLMChecker } from './checker';
import { HLMDisplay } from './display';

const hlmDefinitionTypes: Logic.LogicDefinitionTypeDescription[] = [
  {
    definitionType: Logic.LogicDefinitionType.Operator,
    name: 'Operator',
    createTypeExpression: () => new FmtHLM.MetaRefExpression_ExplicitOperator,
    createObjectContents: () => new FmtHLM.ObjectContents_ExplicitOperator(undefined, undefined, undefined, undefined, [new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm)])
  },
  {
    definitionType: Logic.LogicDefinitionType.SetOperator,
    name: 'Set Operator',
    createTypeExpression: () => new FmtHLM.MetaRefExpression_SetOperator,
    createObjectContents: () => new FmtHLM.ObjectContents_SetOperator(undefined, undefined, undefined, undefined, [new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm)])
  },
  {
    definitionType: Logic.LogicDefinitionType.Construction,
    name: 'Construction',
    createTypeExpression: () => new FmtHLM.MetaRefExpression_Construction,
    createObjectContents: () => new FmtHLM.ObjectContents_Construction
  },
  {
    definitionType: Logic.LogicDefinitionType.Predicate,
    name: 'Predicate',
    createTypeExpression: () => new FmtHLM.MetaRefExpression_Predicate,
    createObjectContents: () => new FmtHLM.ObjectContents_Predicate(undefined, undefined, undefined, undefined, [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)])
  },
  {
    definitionType: Logic.LogicDefinitionType.Theorem,
    name: 'Theorem',
    createTypeExpression: () => new FmtHLM.MetaRefExpression_StandardTheorem,
    createObjectContents: () => new FmtHLM.ObjectContents_StandardTheorem(new Fmt.PlaceholderExpression(HLMExpressionType.Formula))
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

export enum HLMExpressionType {
  SetTerm = Logic.LogicDefinitionType.SetOperator,
  ElementTerm = Logic.LogicDefinitionType.Operator,
  Formula = Logic.LogicDefinitionType.Predicate
}
