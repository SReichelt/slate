const { replacements } = require('unicodeit/ts_dist/js/data');

interface LatexInputSuggestion {
  latexCode: string;
  unicodeCharacters: string;
}

const MAX_SUGGESTIONS = 10;

export function getLatexInputSuggestions(current: string): LatexInputSuggestion[] {
  return (replacements as [string, string][])
    .filter(([latexCode]) => latexCode.startsWith(current))
    .slice(0, MAX_SUGGESTIONS)
    .map(([latexCode, unicodeCharacters]) => ({ latexCode, unicodeCharacters }));
}