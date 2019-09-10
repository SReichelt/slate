import * as Macro from '../macro';
import * as Fmt from '../../format/format';
import CachedPromise from '../../data/cachedPromise';

export type HLMMacro = Macro.Macro<HLMMacroInstance>;

export type HLMMacroInstance = Macro.MacroInstance<HLMMacroInvocation>;

export interface HLMMacroInvocation extends Macro.MacroInvocation {
  getDeclaredSet(): CachedPromise<Fmt.Expression>;
}
