import * as Fmt from '../../../format/format';
import * as FmtHLM from '../meta';
import * as Logic from '../../logic';
import { LibraryDataAccessor } from '../../../data/libraryDataAccessor';
import { HLMUtils } from '../utils';
import * as HLMMacro from '../macro';
import CachedPromise from '../../../data/cachedPromise';

export class NumberMacro implements HLMMacro.HLMMacro {
  name = 'number';

  instantiate(libraryDataAccessor: LibraryDataAccessor, definition: Fmt.Definition): NumberMacroInstance {
    let valueParam = definition.parameters.getParameter('value');
    let contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    let references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    let naturalNumbers = references.getValue('Natural numbers');
    return new NumberMacroInstance(definition, valueParam, naturalNumbers);
  }
}

class NumberMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private valueParam: Fmt.Parameter, private naturalNumbers: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression): NumberMacroInvocation {
    let value = expression.path.arguments.getValue(this.valueParam.name) as Fmt.IntegerExpression;
    let naturalNumbersRef = utils.substitutePath(this.naturalNumbers, expression.path, [this.definition]) as Fmt.DefinitionRefExpression;
    return new NumberMacroInvocation(utils, expression, this.valueParam, value.value, naturalNumbersRef);
  }
}

class NumberMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(private utils: HLMUtils, public expression: Fmt.DefinitionRefExpression, private valueParam: Fmt.Parameter, private value: Fmt.BN, private naturalNumbersRef: Fmt.DefinitionRefExpression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    let result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.naturalNumbersRef);
  }

  unfold(): CachedPromise<Fmt.Expression[]> {
    return this.utils.getDefinition(this.naturalNumbersRef.path).then((definition: Fmt.Definition) => {
      if (definition.innerDefinitions.length === 2 && definition.innerDefinitions[0].parameters.length === 0 && definition.innerDefinitions[1].parameters.length === 1) {
        let path = new Fmt.Path;
        path.parentPath = this.naturalNumbersRef.path;
        if (this.value.isZero()) {
          path.name = definition.innerDefinitions[0].name;
        } else {
          let predecessor = this.expression.clone() as Fmt.DefinitionRefExpression;
          let predecessorValue = predecessor.path.arguments.getValue(this.valueParam.name) as Fmt.IntegerExpression;
          predecessorValue.value = this.value.subn(1);
          path.name = definition.innerDefinitions[1].name;
          path.arguments.add(predecessor, definition.innerDefinitions[1].parameters[0].name);
        }
        let result = new Fmt.DefinitionRefExpression;
        result.path = path;
        return [result];
      } else {
        return [];
      }
    });
  }
}
