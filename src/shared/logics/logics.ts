import * as Logic from './logic';
import { HLM } from './hlm/hlm';

export const hlm = new HLM;

export const logics: Logic.Logic[] = [hlm];

export function findLogic(name: string): Logic.Logic | undefined {
  return logics.find((value: Logic.Logic) => value.name === name);
}
