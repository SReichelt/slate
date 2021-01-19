import { replacements } from 'unicodeit/ts_dist/js/data';

export function isLatexInput(current: string): boolean {
  return current.startsWith('\\');
}

interface LatexInputReplacement {
  latexCode: string;
  unicodeCharacters: string;
}

const MAX_SUGGESTIONS = 10;

const allReplacements: LatexInputReplacement[] =
  (replacements as [string, string][])
    .filter(([latexCode, _]) => !latexCode.endsWith('up'))  // Recent versions of unicodeit contain e.g. '\alpha' and '\alphaup', breaking immediate conversion.
    .map(([latexCode, unicodeCharacters]) => ({ latexCode, unicodeCharacters }))
    .sort((a, b) => a.latexCode.localeCompare(b.latexCode, 'en'));

function findReplacementByLatexCode(latexCode: string): LatexInputReplacement {
  const replacement = allReplacements.find(r => r.latexCode === latexCode);
  if (replacement === undefined) {
    throw new Error(`Could not find replacement with LaTeX code ${latexCode}`);
  }
  return replacement;
}

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
// LaTeX replacement OR is a prefix of a LaTeX replacement.
export function replaceLatexCodeOrPrefix(current: string): string {
  const firstReplacement = findLatexReplacementByPrefix(current, false);
  return firstReplacement !== undefined ? firstReplacement.unicodeCharacters : current;
}

// Replaces the current input by unicode character if the current input matches a
// LaTeX replacement AND is not a prefix of another LaTeX replacement.
export function replaceExactLatexCodeOnly(current: string): string {
  const replacement = findLatexReplacementByPrefix(current, true);
  return replacement !== undefined && replacement.latexCode === current ? replacement.unicodeCharacters : current;
}

function findLatexReplacementByPrefix(current: string, uniqueOnly: boolean): LatexInputReplacement | undefined {
  const matches = getLatexInputSuggestions(current);
  if (matches.length && (matches.length === 1 || !uniqueOnly)) {
    return matches[0];
  } else {
    return undefined;
  }
}
