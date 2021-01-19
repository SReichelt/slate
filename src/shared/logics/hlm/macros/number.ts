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
    const valueParam = definition.parameters.getParameter('value');
    const contents = definition.contents as FmtHLM.ObjectContents_MacroOperator;
    const references: Fmt.ArgumentList = contents.references || Object.create(Fmt.ArgumentList.prototype);
    const naturalNumbers = references.getValue('Natural numbers');
    return new NumberMacroInstance(definition, valueParam, naturalNumbers);
  }
}

class NumberMacroInstance implements HLMMacro.HLMMacroInstance {
  constructor(private definition: Fmt.Definition, private valueParam: Fmt.Parameter, private naturalNumbers: Fmt.Expression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    const result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  invoke(utils: HLMUtils, expression: Fmt.DefinitionRefExpression): NumberMacroInvocation {
    const value = expression.path.arguments.getValue(this.valueParam.name);
    const naturalNumbersRef = utils.substitutePath(this.naturalNumbers, expression.path, [this.definition]) as Fmt.DefinitionRefExpression;
    return new NumberMacroInvocation(utils, expression, this.valueParam, value, naturalNumbersRef);
  }
}

class NumberMacroInvocation implements HLMMacro.HLMMacroInvocation {
  constructor(private utils: HLMUtils, public expression: Fmt.DefinitionRefExpression, private valueParam: Fmt.Parameter, private value: Fmt.Expression, private naturalNumbersRef: Fmt.DefinitionRefExpression) {}

  check(): CachedPromise<Logic.LogicCheckDiagnostic[]> {
    const result: CachedPromise<Logic.LogicCheckDiagnostic[]> = CachedPromise.resolve([]);
    // TODO
    return result;
  }

  getDeclaredSet(): CachedPromise<Fmt.Expression> {
    return CachedPromise.resolve(this.naturalNumbersRef);
  }

  unfold(): CachedPromise<Fmt.Expression[]> {
    return this.utils.getDefinition(this.naturalNumbersRef.path).then((definition: Fmt.Definition) => {
      if (this.value instanceof Fmt.IntegerExpression && definition.innerDefinitions.length === 2 && definition.innerDefinitions[0].parameters.length === 0 && definition.innerDefinitions[1].parameters.length === 1) {
        let name: string;
        const args = new Fmt.ArgumentList;
        if (this.value.value === BigInt(0)) {
          name = definition.innerDefinitions[0].name;
        } else {
          const predecessor = this.expression.clone() as Fmt.DefinitionRefExpression;
          const predecessorValueExpression = predecessor.path.arguments.getValue(this.valueParam.name) as Fmt.IntegerExpression;
          predecessorValueExpression.value = this.value.value.valueOf() - BigInt(1);
          name = definition.innerDefinitions[1].name;
          args.push(new Fmt.Argument(definition.innerDefinitions[1].parameters[0].name, predecessor));
        }
        const path = new Fmt.Path(name, args, this.naturalNumbersRef.path);
        return [new Fmt.DefinitionRefExpression(path)];
      } else {
        return [];
      }
    });
  }
}
