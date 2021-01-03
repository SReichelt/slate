import * as Fmt from '../format/format';
import * as Logic from './logic';

export function getExpectedDiagnostics(definition: Fmt.Definition): Logic.LogicCheckDiagnostic[] {
  let result: Logic.LogicCheckDiagnostic[] = [];
  if (definition.documentation) {
    for (let item of definition.documentation.items) {
      let severity: Logic.DiagnosticSeverity;
      switch (item.kind) {
      case 'expectedError':
        severity = Logic.DiagnosticSeverity.Error;
        break;
      case 'expectedWarning':
        severity = Logic.DiagnosticSeverity.Warning;
        break;
      default:
        continue;
      }
      result.push({
        object: definition.name, // dummy
        severity: severity,
        message: item.text
      });
    }
  }
  return result;
}

export function adaptDiagnosticsForComparison(diagnostics: Logic.LogicCheckDiagnostic[], definition: Fmt.Definition): Logic.LogicCheckDiagnostic[] {
  for (let diagnostic of diagnostics) {
    diagnostic.object = definition.name; // see above
  }
  return diagnostics;
}
