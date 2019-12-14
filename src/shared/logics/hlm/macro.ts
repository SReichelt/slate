import * as Macro from '../macro';
import * as Fmt from '../../format/format';
import { HLMUtils } from './utils';
import CachedPromise from '../../data/cachedPromise';

export type HLMMacro = Macro.Macro<HLMMacroInstance>;

export type HLMMacroInstance = Macro.MacroInstance<HLMMacroInvocation, HLMUtils>;

export interface HLMMacroInvocation extends Macro.MacroInvocation {
  getDeclaredSet(): CachedPromise<Fmt.Expression>;
}
