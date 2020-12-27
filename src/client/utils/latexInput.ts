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
  if (allReplacements.some(({ latexCode }) => latexCode.startsWith(current) && latexCode !== current)) {
    // unfinished and/or unambigous
    return current;
  }
  return replaceLatexCode(current);
}