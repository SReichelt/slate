import * as Logic from './logic';
import { HLM } from './hlm/hlm';

export const hlm = new HLM;

export const logics = new Map<string, Logic.Logic>([['hlm', hlm]]);
