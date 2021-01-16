import * as Logic from '../logic';
import * as Fmt from '../../format/format';
import * as Ctx from '../../format/context';
import * as FmtHLM from './meta';
import { HLMExpressionType } from './types';
import { HLMChecker } from './checker';
import { HLMDisplay } from './display';

const hlmDefinitionTypes: Logic.LogicDefinitionTypeDescription[] = [
  {
    definitionType: Logic.LogicDefinitionType.Operator,
    name: 'Operator',
    createTypeExpression: (): Fmt.Expression => new FmtHLM.MetaRefExpression_ExplicitOperator,
    createObjectContents: (): Fmt.ObjectContents => new FmtHLM.ObjectContents_ExplicitOperator(undefined, undefined, undefined, undefined, [new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm)])
  },
  {
    definitionType: Logic.LogicDefinitionType.SetOperator,
    name: 'Set Operator',
    createTypeExpression: (): Fmt.Expression => new FmtHLM.MetaRefExpression_SetOperator,
    createObjectContents: (): Fmt.ObjectContents => new FmtHLM.ObjectContents_SetOperator(undefined, undefined, undefined, undefined, [new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm)])
  },
  {
    definitionType: Logic.LogicDefinitionType.Construction,
    name: 'Construction',
    createTypeExpression: (): Fmt.Expression => new FmtHLM.MetaRefExpression_Construction,
    createObjectContents: (): Fmt.ObjectContents => new FmtHLM.ObjectContents_Construction
  },
  {
    definitionType: Logic.LogicDefinitionType.Predicate,
    name: 'Predicate',
    createTypeExpression: (): Fmt.Expression => new FmtHLM.MetaRefExpression_Predicate,
    createObjectContents: (): Fmt.ObjectContents => new FmtHLM.ObjectContents_Predicate(undefined, undefined, undefined, undefined, [new Fmt.PlaceholderExpression(HLMExpressionType.Formula)])
  },
  {
    definitionType: Logic.LogicDefinitionType.Theorem,
    name: 'Theorem',
    createTypeExpression: (): Fmt.Expression => new FmtHLM.MetaRefExpression_StandardTheorem,
    createObjectContents: (): Fmt.ObjectContents => new FmtHLM.ObjectContents_StandardTheorem(new Fmt.PlaceholderExpression(HLMExpressionType.Formula))
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
