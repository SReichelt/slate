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

const findReplacementByLatexCode = (latexCode: string): LatexInputReplacement => {
  const replacement = allReplacements.find(r => r.latexCode === latexCode);
  if (replacement === undefined) {
    throw new Error(`Could not find replacement with LaTeX code ${latexCode}`);
  }
  return replacement;
};

// A curated list of suggestions to display when the user types a single backslash
const initialSuggestions: LatexInputReplacement[] = [
  '\\~{a}',
  '\\={a}',
  '\\mathbb{i}',
  '\\mathcal{M}',
  '\\v{C}',
  '\\alpha',
  '\\aleph',
  '\\hbar',
  '\\simeq',
  '\\otimes'
].map(findReplacementByLatexCode);

export function getLatexInputSuggestions(current: string): LatexInputReplacement[] {
  if (current === '\\') {
    return initialSuggestions;
  }
  return allReplacements
    .filter(({ latexCode }) => latexCode.startsWith(current))
    .slice(0, MAX_SUGGESTIONS);
}

// Replaces the current input by unicode character if the current input either matches a
// LaTeX replacement OR is the prefix of a unique LaTeX replacement.
export function replaceLatexCode(current: string): string {
  let exactReplacement = allReplacements.find(({ latexCode }) => latexCode === current);
  let replacement = exactReplacement ?? findUniqueLatexReplacementByPrefix(current);
  return replacement !== undefined ? replacement.unicodeCharacters : current;
}

// Replaces the current input by unicode character if the current input either matches a
// LaTeX replacement AND is the prefix of a unique LaTeX replacement.
export function replaceLatexCodeIfUnambiguous(current: string): string {
  let replacement = findUniqueLatexReplacementByPrefix(current);
  return replacement !== undefined && replacement.latexCode === current ? replacement.unicodeCharacters : current;
}

function findUniqueLatexReplacementByPrefix(current: string): LatexInputReplacement | undefined {
  let firstMatch: LatexInputReplacement | undefined = undefined;
  for (let replacement of allReplacements) {
    if (replacement.latexCode.startsWith(current)) {
      if (firstMatch !== undefined) {
        return undefined; // ambiguous
      } else {
        firstMatch = replacement;
      }
    }
  }
  return firstMatch;
}
