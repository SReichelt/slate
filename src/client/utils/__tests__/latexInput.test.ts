import { getLatexInputSuggestions, replaceLatexCodeOrPrefix, replaceExactLatexCodeOnly } from '../latexInput';

describe('getLatexInputSuggestions', () => {
  it('returns replacements which start with current input', () => {
    expect(getLatexInputSuggestions('\\al')).toEqual([
      { latexCode: '\\aleph', unicodeCharacters: 'ℵ' },
      { latexCode: '\\alpha', unicodeCharacters: 'α' }
    ]);
  });

  it('returns curated list of 10 examples on input "\\"', () => {
    expect(getLatexInputSuggestions('\\').map(({ unicodeCharacters }) => unicodeCharacters)).toEqual([
      'ã',
      'ā',
      'ⅈ',
      'ℳ',
      'Č',
      'α',
      'ℵ',
      'ℏ',
      '≃',
      '⊗'
    ]);
  });
});

describe('replaceLatexCodeOrPrefix', () => {
  it('replaces inputs which match a suggestion exactly', () => {
    expect(replaceLatexCodeOrPrefix('\\l')).toEqual('ł');
  });

  it('replaces inputs for which a unique suggestion with that input as prefix exists', () => {
    expect(replaceLatexCodeOrPrefix('\\alph')).toEqual('α');
  });

  it('replaces inputs with their first suggestion if more than one suggestion exists', () => {
    expect(replaceLatexCodeOrPrefix('\\al')).toEqual('ℵ');
  });

  it('replaces backslash with first item of curated list', () => {
    expect(replaceLatexCodeOrPrefix('\\')).toEqual('ã');
  });
});

describe('replaceExactLatexCodeOnly', () => {
  it('replaces complete inputs for which a unique suggestion with that input as prefix exists', () => {
    expect(replaceExactLatexCodeOnly('\\alpha')).toEqual('α');
  });

  it('doesn\'t replace complete inputs for which multiple suggestions with that input as prefix exist', () => {
    expect(replaceExactLatexCodeOnly('\\l')).toEqual('\\l'); // because '\\l' is also a prefix of '\\lambda' and others
  });

  it('doesn\'t replace incomplete inputs even if a unique suggestion with that input as prefix exists', () => {
    expect(replaceExactLatexCodeOnly('\\alph')).toEqual('\\alph');
  });
});
