import * as Fmt from '../../format/format';
import * as FmtHLM from './meta';
import * as Logic from '../logic';
import CachedPromise from '../../data/cachedPromise';

export class HLMChecker implements Logic.LogicChecker {
  checkDefinition(definition: Fmt.Definition): CachedPromise<Logic.LogicCheckResult> {
    let result: Logic.LogicCheckResult = {diagnostics: []};
    return CachedPromise.resolve(result);
  }
}
