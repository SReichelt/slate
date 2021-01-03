import * as React from 'react';
import clsx from 'clsx';

import { RenderedContents, wrapRenderedContents } from './utils';

import './OverUnder.css';


interface OverUnderProps {
  over: React.ReactNode;
  under: React.ReactNode;
}

export function renderOverUnder(props: React.PropsWithChildren<OverUnderProps>): RenderedContents {
  let rows: React.ReactNode[] = [
    <span className={'overunder-body-row'} key="body">
      <span className={'overunder-body'}>
        {props.children}
      </span>
    </span>,
    <span className={'overunder-under-row'} key="under">
      <span className={'overunder-under'}>
        {props.under}
      </span>
    </span>
  ];
  if (props.over) {
    rows.unshift(
      <span className={'overunder-over-row'} key="over">
        <span className={'overunder-over'}>
          {props.over}
        </span>
      </span>
    );
  }
  return {
    contents: rows,
    innerClassName: clsx('overunder', {
      'noover': !props.over,
      'nounder': !props.under
    })
  };
}

export function OverUnder(props: OverUnderProps): React.ReactElement {
  return wrapRenderedContents(renderOverUnder(props));
}
