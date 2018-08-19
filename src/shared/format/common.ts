export function isWhitespaceCharacter(c: string): boolean {
  return (
    c === ' '
    || c === '\t'
    || c === '\r'
    || c === '\n'
  );
}

export function isSpecialCharacter(c: string): boolean {
  return (
    isWhitespaceCharacter(c)
    || c === '"'
    || c === '\''
    || c === '$'
    || c === '%'
    || c === '#'
    || c === '&'
    || c === '|'
    || c === '?'
    || c === '!'
    || c === '('
    || c === ')'
    || c === '['
    || c === ']'
    || c === '{'
    || c === '}'
    || c === '.'
    || c === ','
    || c === ':'
    || c === '='
    || c === '+'
    || c === '-'
    || c === '*'
    || c === '/'
  );
}

export function isNumericalCharacter(c: string): boolean {
  return (
    c === '0'
    || c === '1'
    || c === '2'
    || c === '3'
    || c === '4'
    || c === '5'
    || c === '6'
    || c === '7'
    || c === '8'
    || c === '9'
  );
}

export function translateMemberName(name: string): string {
  switch (name) {
  case 'break':
  case 'case':
  case 'catch':
  case 'const':
  case 'continue':
  case 'default':
  case 'delete':
  case 'do':
  case 'each':
  case 'else':
  case 'false':
  case 'finally':
  case 'for':
  case 'function':
  case 'get':
  case 'if':
  case 'Infinity':
  case 'instanceof':
  case 'let':
  case 'NaN':
  case 'new':
  case 'null':
  case 'return':
  case 'set':
  case 'switch':
  case 'this':
  case 'throw':
  case 'true':
  case 'try':
  case 'typeof':
  case 'undefined':
  case 'var':
  case 'void':
  case 'while':
  case 'with':
  case 'yield':
  case 'prototype':
  case 'class':
  case 'interface':
  case 'abstract':
  case 'extends':
  case 'implements':
  case 'boolean':
  case 'string':
  case 'number':
  case 'any':
  case 'import':
  case 'export':
  case 'as':
  case 'is':
  case 'from':
  case 'to':
  case 'of':
  case 'public':
  case 'private':
  case 'static':
  case 'readonly':
  case 'constructor':
  case 'super':
  case 'never':
  case 'override':
    return '_' + name;
  default:
    return name;
  }
}
