import * as React from 'react';

import { RenderedContents, wrapRenderedContents } from './utils';

import './Fraction.css';


interface FractionProps {
  numerator: React.ReactNode;
  denominator: React.ReactNode;
}

export function renderFraction(props: FractionProps): RenderedContents {
  return {
    contents: [
      <span className={'fraction-numerator-row'} key="numerator">
        <span className={'fraction-numerator'}>
          {props.numerator}
        </span>
      </span>,
      <span className={'fraction-denominator-row'} key="denominator">
        <span className={'fraction-denominator'}>
          {props.denominator}
        </span>
      </span>
    ],
    innerClassName: 'fraction'
  };
}

export function Fraction(props: FractionProps): React.ReactElement {
  return wrapRenderedContents(renderFraction(props));
}
