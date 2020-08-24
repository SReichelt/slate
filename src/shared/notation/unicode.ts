export interface UnicodeConverter {
  outputText(text: string, style?: string): void;
  outputLineBreak(): void;
  outputExtraSpace(standalone: boolean): void;
}

export interface UnicodeConversionOptions {
  convertStandardCharacters: boolean;
  shrinkMathSpaces: boolean;
}

export function convertUnicode(text: string, renderer: UnicodeConverter, options: UnicodeConversionOptions): void {
  let curText = '';
  let curStyle: string | undefined = undefined;
  let flush = () => {
    if (curText) {
      renderer.outputText(curText, curStyle);
      curText = '';
    }
    curStyle = undefined;
  };
  let setStyle = (style: string | undefined) => {
    if (curStyle !== style) {
      flush();
      curStyle = style;
    }
  };
  for (let c of text) {
    switch (c) {
    case '\r':
      break;
    case '\n':
      flush();
      renderer.outputLineBreak();
      break;
    case ' ':
      if (curText) {
        if (curText.endsWith(' ')) {
          curText = curText.substring(0, curText.length - 1);
          flush();
          renderer.outputExtraSpace(false);
        }
        curText += c;
      } else {
        renderer.outputExtraSpace(true);
      }
      break;
    case '\'':
      // Output as standalone symbol because it needs special handling.
      flush();
      renderer.outputText(c);
      break;
    default:
      let cp = c.codePointAt(0)!;
      if (options.convertStandardCharacters) {
        let standardCharacter = getStandardCharacter(cp);
        if (standardCharacter) {
          setStyle(standardCharacter[1]);
          curText += standardCharacter[0];
          break;
        }
      }
      if (cp >= 0x1d400 && cp < 0x1d434) {
        setStyle('bold');
        curText += convertLatinMathToRegular(cp - 0x1d400);
      } else if ((cp >= 0x1d6a8 && cp < 0x1d6e2) || (cp >= 0x1d7ca && cp < 0x1d7cc)) {
        setStyle('bold');
        curText += convertGreekMathToRegular(cp - 0x1d6a8);
      } else if (cp >= 0x1d7ce && cp < 0x1d7d8) {
        setStyle('bold');
        curText += convertDigitMathToRegular(cp - 0x1d7ce);
      } else if ((cp >= 0x1d434 && cp < 0x1d468) || cp === 0x210e) {
        setStyle('italic');
        switch (cp) {
        case 0x210e:
          curText += 'h';
          break;
        default:
          curText += convertLatinMathToRegular(cp - 0x1d434);
        }
      } else if (cp >= 0x1d6e2 && cp < 0x1d71c) {
        setStyle('italic');
        curText += convertGreekMathToRegular(cp - 0x1d6e2);
      } else if (cp >= 0x1d468 && cp < 0x1d49c) {
        setStyle('bold italic');
        curText += convertLatinMathToRegular(cp - 0x1d468);
      } else if (cp >= 0x1d71c && cp < 0x1d756) {
        setStyle('bold italic');
        curText += convertGreekMathToRegular(cp - 0x1d71c);
      } else if (cp >= 0x1d5a0 && cp < 0x1d5d4) {
        setStyle('sans');
        curText += convertLatinMathToRegular(cp - 0x1d5a0);
      } else if (cp >= 0x1d7e2 && cp < 0x1d7ec) {
        setStyle('sans');
        curText += convertDigitMathToRegular(cp - 0x1d7e2);
      } else if (cp >= 0x1d5d4 && cp < 0x1d608) {
        setStyle('sans bold');
        curText += convertLatinMathToRegular(cp - 0x1d5d4);
      } else if (cp >= 0x1d756 && cp < 0x1d790) {
        setStyle('sans bold');
        curText += convertGreekMathToRegular(cp - 0x1d756);
      } else if (cp >= 0x1d7ec && cp < 0x1d7f6) {
        setStyle('sans bold');
        curText += convertDigitMathToRegular(cp - 0x1d7ec);
      } else if (cp >= 0x1d608 && cp < 0x1d63c) {
        setStyle('sans italic');
        curText += convertLatinMathToRegular(cp - 0x1d608);
      } else if (cp >= 0x1d63c && cp < 0x1d670) {
        setStyle('sans bold italic');
        curText += convertLatinMathToRegular(cp - 0x1d63c);
      } else if (cp >= 0x1d790 && cp < 0x1d7ca) {
        setStyle('sans bold italic');
        curText += convertGreekMathToRegular(cp - 0x1d790);
      } else if (cp >= 0x1d49c && cp < 0x1d504) {
        setStyle('calligraphic');
        curText += convertLatinMathToRegular(cp < 0x1d4d0 ? cp - 0x1d49c : cp - 0x1d4d0);
      } else if (cp >= 0x1d504 && cp < 0x1d538) {
        setStyle('fraktur');
        curText += convertLatinMathToRegular(cp - 0x1d504);
      } else if (cp >= 0x1d538 && cp < 0x1d56c) {
        setStyle('double-struck');
        curText += convertLatinMathToRegular(cp - 0x1d538);
      } else if (cp >= 0x1d56c && cp < 0x1d5a0) {
        setStyle('fraktur bold');
        curText += convertLatinMathToRegular(cp - 0x1d56c);
      } else if (cp >= 0x1d7d8 && cp < 0x1d7e2) {
        setStyle('double-struck');
        curText += convertDigitMathToRegular(cp - 0x1d7d8);
      } else if (cp >= 0x1d670 && cp < 0x1d6a4) {
        setStyle('monospace');
        curText += convertLatinMathToRegular(cp - 0x1d670);
      } else if (cp >= 0x1d7f6 && cp < 0x1d800) {
        setStyle('monospace');
        curText += convertDigitMathToRegular(cp - 0x1d7f6);
      } else {
        if (curStyle) {
          flush();
        }
        if (options.shrinkMathSpaces) {
          c = shrinkMathSpace(c);
        }
        curText += c;
      }
    }
  }
  flush();
}

function convertLatinMathToRegular(cpOffset: number): string {
  return String.fromCodePoint(cpOffset < 0x1a ? cpOffset + 0x41 :
                                                cpOffset - 0x1a + 0x61);
}

function convertGreekMathToRegular(cpOffset: number): string {
  return String.fromCodePoint(cpOffset === 0x11  ? 0x3f4 :
                              cpOffset < 0x19    ? cpOffset + 0x391 :
                              cpOffset === 0x19  ? 0x2207 :
                              cpOffset < 0x33    ? cpOffset - 0x1a + 0x3b1 :
                              cpOffset === 0x33  ? 0x2202 :
                              cpOffset === 0x34  ? 0x3f5 :
                              cpOffset === 0x35  ? 0x3f0 :
                              cpOffset === 0x36  ? 0x3d5 :
                              cpOffset === 0x37  ? 0x3f1 :
                              cpOffset === 0x38  ? 0x3d6 :
                              cpOffset === 0x122 ? 0x3dc :
                              cpOffset === 0x123 ? 0x3dd :
                              0);
}

function convertDigitMathToRegular(cpOffset: number): string {
  return String.fromCodePoint(cpOffset + 0x30);
}

function getStandardCharacter(cp: number): [string, string] | undefined {
  switch (cp) {
  case 0x212c:
    return ['B', 'calligraphic'];
  case 0x2130:
    return ['E', 'calligraphic'];
  case 0x2131:
    return ['F', 'calligraphic'];
  case 0x210b:
    return ['H', 'calligraphic'];
  case 0x2110:
    return ['I', 'calligraphic'];
  case 0x2112:
    return ['L', 'calligraphic'];
  case 0x2133:
    return ['M', 'calligraphic'];
  case 0x211b:
    return ['R', 'calligraphic'];
  case 0x212f:
    return ['e', 'calligraphic'];
  case 0x210a:
    return ['g', 'calligraphic'];
  case 0x2134:
    return ['o', 'calligraphic'];
  case 0x212d:
    return ['C', 'fraktur'];
  case 0x210c:
    return ['H', 'fraktur'];
  case 0x2111:
    return ['I', 'fraktur'];
  case 0x211c:
    return ['R', 'fraktur'];
  case 0x2128:
    return ['Z', 'fraktur'];
  case 0x2102:
    return ['C', 'double-struck'];
  case 0x210d:
    return ['H', 'double-struck'];
  case 0x2115:
    return ['N', 'double-struck'];
  case 0x2119:
    return ['P', 'double-struck'];
  case 0x211a:
    return ['Q', 'double-struck'];
  case 0x211d:
    return ['R', 'double-struck'];
  case 0x2124:
    return ['Z', 'double-struck'];
  default:
    return undefined;
  }
}

export function shrinkMathSpace(c: string): string {
  switch (c) {
  case '\u2002':
    return '\u2005';
  case '\u2003':
    return '\u2002';
  case '\u2004':
    return '\u2006';
  case '\u2005':
    return '\u200a';
  case '\u2006':
  case '\u2009':
  case '\u200a':
  case '\u205f':
    return '';
  default:
    return c;
  }
}

export function shrinkMathSpaces(text: string): string {
  let result = '';
  for (let c of text) {
    result += shrinkMathSpace(c);
  }
  return result;
}

export function useItalicsForVariable(text: string): boolean {
  while (text.endsWith('\'')) {
    text = text.substring(0, text.length - 1);
  }
  if (text.length === 1) {
    let cp = text.charCodeAt(0)!;
    return ((cp >= 0x41 && cp < 0x5b)
            || (cp >= 0x61 && cp < 0x7b)
            || (cp >= 0xc0 && cp < 0x2b0)
            || (cp >= 0x370 && cp < 0x2000));
  } else {
    return false;
  }
}
