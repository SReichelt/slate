import * as React from 'react';

import './SubSup.css';


interface SubSupProps {
  sub: React.ReactNode;
  sup: React.ReactNode;
  preSub: React.ReactNode;
  preSup: React.ReactNode;
  lineHeight: number;
}

export function SubSup(props: React.PropsWithChildren<SubSupProps>): React.ReactElement {
  let empty = <span className={'subsup-empty'} key="empty"/>;
  let rightSub = null;
  let rightSup = null;
  if (props.sub) {
    rightSub = <span className={'subsup-right-sub'} key="sub">{props.sub}</span>;
  }
  if (props.sup) {
    rightSup = <span className={'subsup-right-sup'} key="sup">{props.sup}</span>;
  }
  let leftSub = null;
  let leftSup = null;
  if (props.preSub) {
    leftSub = <span className={'subsup-left-sub'} key="sub">{props.preSub}</span>;
  }
  if (props.preSup) {
    leftSup = <span className={'subsup-left-sup'} key="sup">{props.preSup}</span>;
  }
  if (props.lineHeight) {
    return (
      <>
        {(leftSup || leftSub) ? (
          <span className={'subsup'} key="left">
            <span className={'subsup-sup-row'} key="sup">
              {leftSup ?? empty}
            </span>
            <span className={'subsup-sub-row'} key="sub">
              {leftSub ?? empty}
            </span>
          </span>
        ) : null}
        {props.children}
        {(rightSup || rightSub) ? (
          <span className={'subsup'} key="right">
            <span className={'subsup-sup-row'} key="sup">
              {rightSup ?? empty}
            </span>
            <span className={'subsup-sub-row'} key="sub">
              {rightSub ?? empty}
            </span>
          </span>
        ) : null}
      </>
    );
  } else {
    return (
      <span className={'subsup subsup-full'}>
        <span className={'subsup-sup-row subsup-full-row'} key="sup">
          {(leftSup || leftSub) ? (leftSup ?? empty) : null}
          <span className={'subsup-empty'} key="middle"/>
          {(rightSup || rightSub) ? (rightSup ?? empty) : null}
        </span>
        <span className={'subsup-body-row'} key="body">
          {(leftSup || leftSub) ? empty : null}
          <span className={'subsup-body'} key="middle">
            {props.children}
          </span>
          {(rightSup || rightSub) ? empty : null}
        </span>
        <span className={'subsup-sub-row subsup-full-row'} key="sub">
          {(leftSup || leftSub) ? (leftSub ?? empty) : null}
          <span className={'subsup-empty'} key="middle"/>
          {(rightSup || rightSub) ? (rightSub ?? empty) : null}
        </span>
      </span>
    );
  }
}
