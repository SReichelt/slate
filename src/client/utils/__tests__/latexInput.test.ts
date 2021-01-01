import { getLatexInputSuggestions, replaceLatexCode, replaceLatexCodeIfUnambiguous } from '../latexInput';

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

describe('replaceLatexCode', () => {
  it('replaces inputs which match a suggestion exactly', () => {
    expect(replaceLatexCode('\\l')).toEqual('ł');
  });

  it('replaces inputs for which a unique suggestion with that input as prefix exists', () => {
    expect(replaceLatexCode('\\alph')).toEqual('α');
  });
});

describe('replaceLatexCodeIfUnambiguous', () => {
  it('replaces complete inputs for which a unique suggestion with that input as prefix exists', () => {
    expect(replaceLatexCodeIfUnambiguous('\\alpha')).toEqual('α');
  });

  it('doesn\'t replace complete inputs for which multiple suggestions with that input as prefix exist', () => {
    expect(replaceLatexCodeIfUnambiguous('\\l')).toEqual('\\l'); // because '\\l' is also a prefix of '\\lambda' and others
  });

  it('doesn\'t replace incomplete inputs even if a unique suggestion with that input as prefix exists', () => {
    expect(replaceLatexCodeIfUnambiguous('\\alph')).toEqual('\\alph');
  });
});