import * as React from 'react';

import { RenderedContents, wrapRenderedContents } from './utils';

import './Radical.css';


interface RadicalProps {
  radicand: React.ReactNode;
  degree: React.ReactNode;
}

export function renderRadical(props: RadicalProps): RenderedContents {
  return {
    contents: (
      <span className={'radical-row'}>
        <span className={'radical-degree-col'}>
          <span className={'radical-degree-table'}>
            <span className={'radical-degree-top-row'}>
              <span className={'radical-degree'}>
                {props.degree}
              </span>
            </span>
            <span className={'radical-degree-bottom-row'}>
              <span className={'radical-degree-bottom-cell'}>
                <svg viewBox="0 0 1 1" preserveAspectRatio="xMaxYMax">
                  <line x1="0.1" y1="0.35" x2="0.4" y2="0.1" stroke="var(--foreground-color)" strokeWidth="0.08" strokeLinecap="square"/>
                  <line x1="0.45" y1="0.15" x2="1.05" y2="1" stroke="var(--foreground-color)" strokeWidth="0.2" strokeLinecap="square"/>
                </svg>
              </span>
            </span>
          </span>
        </span>
        <span className={'radical-diagonal'}>
          <svg viewBox="0 0 1 1" preserveAspectRatio="none">
            <line x1="0" y1="0.965" x2="1.025" y2="0.05" stroke="var(--foreground-color)" strokeWidth="0.1" strokeLinecap="square"/>
          </svg>
        </span>
        <span className={'radical-radicand'}>
          {props.radicand}
        </span>
      </span>
    ),
    innerClassName: 'radical'
  };
}

export function Radical(props: RadicalProps): React.ReactElement {
  return wrapRenderedContents(renderRadical(props));
}
