const { replacements } = require('unicodeit/ts_dist/js/data');

interface LatexInputReplacement {
  latexCode: string;
  unicodeCharacters: string;
}

const MAX_SUGGESTIONS = 10;

const allReplacements: LatexInputReplacement[] =
  (replacements as [string, string][])
    .map(([latexCode, unicodeCharacters]) => ({ latexCode, unicodeCharacters }));

export function getLatexInputSuggestions(current: string): LatexInputReplacement[] {
  return allReplacements
    .filter(({ latexCode }) => latexCode.startsWith(current))
    .slice(0, MAX_SUGGESTIONS);
}

export function replaceLatexCode(current: string): string {
  let exactReplacement = allReplacements.find(({ latexCode }) => latexCode === current);
  return exactReplacement !== undefined ? exactReplacement.unicodeCharacters : current;
}

export function replaceLatexCodeIfUnambigous(current: string): string {
  let firstMatch: LatexInputReplacement | undefined = undefined;
  for (let replacement of allReplacements) {
    if (replacement.latexCode.startsWith(current)) {
      if (firstMatch !== undefined) {
        return current; // ambigous
      } else {
        firstMatch = replacement;
      }
    }
  }
  return firstMatch !== undefined ? firstMatch.unicodeCharacters : current;
}