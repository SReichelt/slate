import * as Logic from '../logic';
import * as Ctx from '../../format/context';
import * as FmtHLM from './meta';
import { PlaceholderExpression } from '../generic/editHandler';
import { HLMChecker } from './checker';
import { HLMDisplay } from './display';

const hlmDefinitionTypes: Logic.LogicDefinitionTypeDescription[] = [
  {
    definitionType: Logic.LogicDefinitionType.Operator,
    name: 'Operator',
    hasTitle: true,
    createTypeExpression: () => new FmtHLM.MetaRefExpression_ExplicitOperator,
    createObjectContents: () => {
      let result = new FmtHLM.ObjectContents_ExplicitOperator;
      result.definition = [new PlaceholderExpression(HLMExpressionType.ElementTerm)];
      return result;
    }
  },
  {
    definitionType: Logic.LogicDefinitionType.SetOperator,
    name: 'Set Operator',
    hasTitle: true,
    createTypeExpression: () => new FmtHLM.MetaRefExpression_SetOperator,
    createObjectContents: () => {
      let result = new FmtHLM.ObjectContents_SetOperator;
      result.definition = [new PlaceholderExpression(HLMExpressionType.SetTerm)];
      return result;
    }
  },
  {
    definitionType: Logic.LogicDefinitionType.Construction,
    name: 'Construction',
    hasTitle: true,
    createTypeExpression: () => new FmtHLM.MetaRefExpression_Construction,
    createObjectContents: () => new FmtHLM.ObjectContents_Construction
  },
  {
    definitionType: Logic.LogicDefinitionType.Predicate,
    name: 'Predicate',
    hasTitle: true,
    types: ['Predicate', 'Conjecture', 'Axiom'],
    createTypeExpression: () => new FmtHLM.MetaRefExpression_Predicate,
    createObjectContents: () => {
      let result = new FmtHLM.ObjectContents_Predicate;
      result.definition = [new PlaceholderExpression(HLMExpressionType.Formula)];
      return result;
    }
  },
  {
    definitionType: Logic.LogicDefinitionType.Theorem,
    name: 'Theorem',
    hasTitle: true,
    types: ['Proposition', 'Lemma', 'Theorem', 'Corollary', 'Example'],
    createTypeExpression: () => new FmtHLM.MetaRefExpression_StandardTheorem,
    createObjectContents: () => {
      let result = new FmtHLM.ObjectContents_StandardTheorem;
      result.claim = new PlaceholderExpression(HLMExpressionType.Formula);
      return result;
    }
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
