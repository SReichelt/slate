import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import { HLMRenderer } from './renderer';
import { HLMEditHandler } from './editHandler';
import { LibraryDataAccessor } from '../../data/libraryDataAccessor';

export class HLMDisplay implements Logic.LogicDisplay {
  getDefinitionType(definition: Fmt.Definition): Logic.LogicDefinitionType {
    let type = definition.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Construction) {
      return Logic.LogicDefinitionType.Construction;
    } else if (type instanceof FmtHLM.MetaRefExpression_Constructor) {
      return Logic.LogicDefinitionType.Constructor;
    } else if (type instanceof FmtHLM.MetaRefExpression_SetOperator) {
      return Logic.LogicDefinitionType.SetOperator;
    } else if (type instanceof FmtHLM.MetaRefExpression_ExplicitOperator || type instanceof FmtHLM.MetaRefExpression_ImplicitOperator || type instanceof FmtHLM.MetaRefExpression_MacroOperator) {
      return Logic.LogicDefinitionType.Operator;
    } else if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
      return Logic.LogicDefinitionType.Predicate;
    } else if (type instanceof FmtHLM.MetaRefExpression_StandardTheorem || type instanceof FmtHLM.MetaRefExpression_EquivalenceTheorem) {
      return Logic.LogicDefinitionType.Theorem;
    } else {
      return Logic.LogicDefinitionType.Unknown;
    }
  }

  getDefinitionRenderer(definition: Fmt.Definition, includeProofs: boolean, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File, editing: boolean): Logic.LogicRenderer {
    let editHandler = editing ? new HLMEditHandler(definition, libraryDataAccessor, templates) : undefined;
    return new HLMRenderer(definition, includeProofs, libraryDataAccessor, templates, editHandler);
  }
}
