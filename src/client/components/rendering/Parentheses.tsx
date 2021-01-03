import * as React from 'react';
import clsx from 'clsx';

import './Parentheses.css';


function renderTextParentheses(className: string, body: React.ReactNode, lineHeight: number, openParen: string, closeParen: string): React.ReactElement {
  let parenClassName = `${className}-text`;
  let heightClassName = 'height';
  for (let i = 1; i <= lineHeight; i++) {
    heightClassName = clsx(heightClassName, `height-${i}`);
  }
  return (
    <>
      <span className={parenClassName} key="open"><span className={heightClassName}>{openParen}</span></span>
      {body}
      <span className={parenClassName} key="close"><span className={heightClassName}>{closeParen}</span></span>
    </>
  );
}

function renderLargeParentheses(className: string, body: React.ReactNode): React.ReactElement {
  return <span className={clsx('paren-large', className)}>{body}</span>;
}

function renderSimpleParentheses(className: string, body: React.ReactNode, lineHeight: number, openParen: string, closeParen: string): React.ReactElement {
  if (lineHeight) {
    return renderTextParentheses(className, body, lineHeight, openParen, closeParen);
  } else {
    return renderLargeParentheses(className, body);
  }
}

type TableBasedParenthesisContents = (() => React.ReactNode) | '∣' | undefined;

function renderTableBasedParentheses(className: string, body: React.ReactNode, lineHeight: number, openParen: string, closeParen: string, left: TableBasedParenthesisContents, right: TableBasedParenthesisContents): React.ReactElement {
  if (lineHeight) {
    return renderTextParentheses(className, body, lineHeight, openParen, closeParen);
  } else {
    let bodyClassName = clsx('paren-table-cell', 'paren-table-body', left === '∣' && 'paren-left-hairline', right === '∣' && 'paren-right-hairline');
    return renderLargeParentheses(
      clsx('paren-table', className),
      <span className={'paren-table-row'}>
        {left !== undefined && left !== '∣' ? <span className={clsx('paren-table-cell', `${className}-left`)}>{left()}</span> : null}
        <span className={bodyClassName}>{body}</span>
        {right !== undefined && right !== '∣' ? <span className={clsx('paren-table-cell', `${className}-right`)}>{right()}</span> : null}
      </span>
    );
  }
}

interface BaseParensProps {
  lineHeight: number;
}

export function RoundParens(props: React.PropsWithChildren<BaseParensProps>): React.ReactElement {
  return renderTableBasedParentheses(
    'paren-round',
    props.children,
    props.lineHeight,
    '(',
    ')',
    () => (
      <svg viewBox="0 -5.5 1 11" preserveAspectRatio="none">
        <path d="M 1 -5 C -0.25 -4 -0.25 4 1 5 C 0 3 0 -3 1 -5 Z" fill="var(--foreground-color)"/>
      </svg>
    ),
    () => (
      <svg viewBox="0 -5.5 1 11" preserveAspectRatio="none">
        <path d="M 0 -5 C 1.25 -4 1.25 4 0 5 C 1 3 1 -3 0 -5 Z" fill="var(--foreground-color)"/>
      </svg>
    )
  );
}

export function FlatParens(props: React.PropsWithChildren<BaseParensProps>): React.ReactElement {
  return renderSimpleParentheses(
    'paren-flat',
    props.children,
    props.lineHeight,
    '∣',
    '∣'
  );
}

export function SquareParens(props: React.PropsWithChildren<BaseParensProps>): React.ReactElement {
  return renderTableBasedParentheses(
    'paren-square',
    props.children,
    props.lineHeight,
    '[',
    ']',
    () => null,
    () => null
  );
}

interface CurlyParensProps extends BaseParensProps {
  left: '{' | '∣' | undefined;
  right: '}' | '∣' | undefined;
}

export function CurlyParens(props: React.PropsWithChildren<CurlyParensProps>): React.ReactElement {
  return renderTableBasedParentheses(
    'paren-curly',
    props.children,
    props.lineHeight,
    props.left ?? '',
    props.right ?? '',
    props.left === '{' ? () => (
      <svg viewBox="0 -5 1 10" preserveAspectRatio="none">
        <path d="M 1 -5 Q 0.4 -5 0.4 -3.5 L 0.4 -2 Q 0.4 0 0 0 Q 0.4 0 0.4 2 L 0.4 3.5 Q 0.4 5 1 5 Q 0.55 5 0.55 3 L 0.55 1.5 Q 0.55 -0.2 0 0 Q 0.55 0.2 0.55 -1.5 L 0.55 -3 Q 0.55 -5 1 -5 Z" fill="var(--foreground-color)"/>
      </svg>
    ) : props.left,
    props.right === '}' ? () => (
      <svg viewBox="0 -5 1 10" preserveAspectRatio="none">
        <path d="M 0 -5 Q 0.6 -5 0.6 -3.5 L 0.6 -2 Q 0.6 0 1 0 Q 0.6 0 0.6 2 L 0.6 3.5 Q 0.6 5 0 5 Q 0.45 5 0.45 3 L 0.45 1.5 Q 0.45 -0.2 1 0 Q 0.45 0.2 0.45 -1.5 L 0.45 -3 Q 0.45 -5 0 -5 Z" fill="var(--foreground-color)"/>
      </svg>
    ) : props.right
  );
}

export function AngleParens(props: React.PropsWithChildren<BaseParensProps>): React.ReactElement {
  return renderTableBasedParentheses(
    'paren-angle',
    props.children,
    props.lineHeight,
    '⟨',
    '⟩',
    () => (
      <svg viewBox="0 0 1 1" preserveAspectRatio="none">
        <path d="M 0.9 0 L 0.1 0.5 L 0.9 1" y2="0" stroke="var(--foreground-color)" strokeWidth="0.1" strokeLinecap="square" fill="transparent"/>
      </svg>
    ),
    () => (
      <svg viewBox="0 0 1 1" preserveAspectRatio="none">
        <path d="M 0.1 0 L 0.9 0.5 L 0.1 1" y2="0" stroke="var(--foreground-color)" strokeWidth="0.1" strokeLinecap="square" fill="transparent"/>
      </svg>
    )
  );
}
