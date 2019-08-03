import * as Fmt from '../../format/format';

function collectVariableRefs(expression: Fmt.Expression, refs: Fmt.Parameter[]): void {
  if (expression instanceof Fmt.VariableRefExpression) {
    refs.push(expression.variable);
    if (expression.indices) {
      for (let item of expression.indices) {
        collectVariableRefs(item, refs);
      }
    }
  } else if (expression instanceof Fmt.ArrayExpression) {
    for (let item of expression.items) {
      collectVariableRefs(item, refs);
    }
  } else if (expression instanceof Fmt.CompoundExpression) {
    for (let arg of expression.arguments) {
      collectVariableRefs(arg.value, refs);
    }
  } else if (expression instanceof Fmt.DefinitionRefExpression) {
    for (let pathItem: Fmt.PathItem | undefined = expression.path; pathItem; pathItem = pathItem.parentPath) {
      if (pathItem instanceof Fmt.Path) {
        for (let arg of pathItem.arguments) {
          collectVariableRefs(arg.value, refs);
        }
      }
    }
  }
}

function getMatchPenalty(expression: Fmt.Expression, argumentLists?: (Fmt.ArgumentList | undefined)[]): number {
  let penalty = 0;
  if (argumentLists) {
    let refs: Fmt.Parameter[] = [];
    collectVariableRefs(expression, refs);
    if (refs.length) {
      let refIndex = 0;
      for (let argumentList of argumentLists) {
        if (argumentList) {
          for (let arg of argumentList) {
            let origRefIndex = refIndex;
            let argFound = false;
            while (refIndex < refs.length) {
              if (refs[refIndex++].name === arg.name) {
                argFound = true;
                break;
              }
            }
            if (!argFound) {
              refIndex = 0;
              while (refIndex < origRefIndex) {
                if (refs[refIndex++].name === arg.name) {
                  argFound = true;
                  penalty += origRefIndex - refIndex;
                  break;
                }
              }
            }
          }
        }
      }
    }
  }
  return penalty;
}

export function findBestMatch(items: Fmt.Expression[], argumentLists?: (Fmt.ArgumentList | undefined)[]): Fmt.Expression | undefined {
  if (items.length === 1) {
    return items[0];
  }
  let result: Fmt.Expression | undefined = undefined;
  let resultPenalty = 0;
  for (let item of items) {
    let penalty = getMatchPenalty(item, argumentLists);
    if (!result || penalty < resultPenalty) {
      result = item;
      resultPenalty = penalty;
    }
    if (!penalty) {
      break;
    }
  }
  return result;
}

export function reorderArguments(argumentList: Fmt.ArgumentList, expression: Fmt.Expression): void {
  let refs: Fmt.Parameter[] = [];
  collectVariableRefs(expression, refs);
  let lastArgIndex = argumentList.length;
  for (let refIndex = refs.length - 1; refIndex >= 0; refIndex--) {
    let ref = refs[refIndex];
    for (let argIndex = 0; argIndex < argumentList.length; argIndex++) {
      if (ref.name === argumentList[argIndex].name) {
        if (argIndex > lastArgIndex) {
          argumentList.splice(lastArgIndex, 0, ...argumentList.splice(argIndex, 1));
        } else {
          lastArgIndex = argIndex;
        }
        break;
      }
    }
  }
}
