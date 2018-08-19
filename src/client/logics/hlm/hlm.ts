import * as Logic from '../logic';
import { HLMFormat } from '../../../shared/logics/hlm/format';
import { HLMDisplay } from './display';

export class HLM implements Logic.Logic {
  format: HLMFormat = new HLMFormat;
  display: HLMDisplay = new HLMDisplay;
}
