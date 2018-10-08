import * as Logic from './logic';
import { HLM } from './hlm/hlm';

export const hlm = new HLM;

export const logics: Logic.Logic[] = [hlm];
