import { replacements } from 'unicodeit/ts_dist/js/data';

interface LatexInputReplacement {
  latexCode: string;
  unicodeCharacters: string;
}

const MAX_SUGGESTIONS = 10;

const allReplacements: LatexInputReplacement[] =
  (replacements as [string, string][])
    .map(([latexCode, unicodeCharacters]) => ({ latexCode, unicodeCharacters }))
    .sort((a, b) => a.latexCode.localeCompare(b.latexCode, 'en'));

export function getLatexInputSuggestions(current: string): LatexInputReplacement[] {
  return allReplacements
    .filter(({ latexCode }) => latexCode.startsWith(current))
    .slice(0, MAX_SUGGESTIONS);
}

export function replaceLatexCode(current: string): string {
  let exactReplacement = allReplacements.find(({ latexCode }) => latexCode === current);
  return exactReplacement !== undefined ? exactReplacement.unicodeCharacters : current;
}

export function replaceLatexCodeIfUnambiguous(current: string): string {
  let firstMatch: LatexInputReplacement | undefined = undefined;
  for (let replacement of allReplacements) {
    if (replacement.latexCode.startsWith(current)) {
      if (firstMatch !== undefined) {
        return current; // ambiguous
      } else {
        firstMatch = replacement;
      }
    }
  }
  return firstMatch !== undefined ? firstMatch.unicodeCharacters : current;
}
