import * as Logic from '../logic';
import * as FmtHLM from './meta';
import { HLMDisplay } from './display';

export class HLM implements Logic.Logic {
  private display = new HLMDisplay;

  name = FmtHLM.metaModel.name;
  getMetaModel = FmtHLM.getMetaModel;
  getDisplay(): HLMDisplay { return this.display; }
}
