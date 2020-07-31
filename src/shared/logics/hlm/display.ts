import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import { HLMUtils } from './utils';
import { HLMRenderUtils } from './renderUtils';
import { HLMRenderer } from './renderer';
import { HLMEditHandler } from './editHandler';
import { LibraryDataProvider, LibraryDataAccessor } from '../../data/libraryDataProvider';
import { MRUList } from '../../data/mostRecentlyUsedList';

export class HLMDisplay implements Logic.LogicDisplay {
  getDefinitionType(definition: Fmt.Definition): Logic.LogicDefinitionType {
    let type = definition.type;
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

  getDefinitionRenderer(definition: Fmt.Definition, libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File, options: Logic.LogicRendererOptions): HLMRenderer {
    let utils = new HLMUtils(definition, libraryDataAccessor, false);
    let renderUtils = new HLMRenderUtils(definition, utils, templates);
    return new HLMRenderer(definition, libraryDataAccessor, utils, renderUtils, templates, options);
  }

  getDefinitionEditor(definition: Fmt.Definition, libraryDataProvider: LibraryDataProvider, templates: Fmt.File, options: Logic.LogicRendererOptions, editing: boolean, mruList: MRUList): HLMRenderer {
    let utils = new HLMUtils(definition, libraryDataProvider, editing);
    let renderUtils = new HLMRenderUtils(definition, utils, templates);
    let editHandler = editing ? new HLMEditHandler(definition, libraryDataProvider, utils, renderUtils, templates, mruList) : undefined;
    return new HLMRenderer(definition, libraryDataProvider, utils, renderUtils, templates, options, editHandler);
  }
}
