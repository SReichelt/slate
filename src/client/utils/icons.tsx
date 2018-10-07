import * as Logic from '../../shared/logics/logic';
import { LibraryItemInfo } from '../../shared/data/libraryDataAccessor';
import * as React from 'react';

export function getDefinitionIcon(definitionType: Logic.LogicDefinitionType, itemInfo: LibraryItemInfo): any {
  switch (definitionType) {
  case Logic.LogicDefinitionType.Construction:
    return (
      <svg height="1em" width="1em" viewBox="-8 -8 16 16">
        <circle cx="0" cy="0" r="7" fill="green" stroke="black" strokeWidth="1"/>
        <rect x="-4" y="-4" width="8" height="8" fill="red" stroke="black" strokeWidth="1"/>
      </svg>
    );
  case Logic.LogicDefinitionType.SetOperator:
    return (
      <svg height="1em" width="1em" viewBox="-8 -8 16 16">
        <circle cx="0" cy="0" r="7" fill="green" stroke="black" strokeWidth="1"/>
      </svg>
    );
  case Logic.LogicDefinitionType.Operator:
  case Logic.LogicDefinitionType.Constructor:
    return (
      <svg height="1em" width="1em" viewBox="-8 -8 16 16">
        <rect x="-4" y="-4" width="8" height="8" fill="red" stroke="black" strokeWidth="1"/>
      </svg>
    );
  case Logic.LogicDefinitionType.Predicate:
    return (
      <svg height="1em" width="1em" viewBox="-8 -8 16 16">
        <rect x="-5" y="-5" width="10" height="10" fill="blue" stroke="black" strokeWidth="1" transform="rotate(45)"/>
      </svg>
    );
  case Logic.LogicDefinitionType.Theorem:
    let viewBox = '-8 -8 16 16';
    if (itemInfo.type === 'lemma' || itemInfo.type === 'corollary' || itemInfo.type === 'example') {
      viewBox = '-10 -10 20 20';
    }
    let contents = [
      <circle cx="0" cy="-2" r="5" fill="yellow" stroke="black" strokeWidth="1" key="circle"/>,
      <rect x="-2" y="3" width="4" height="4" fill="gray" stroke="black" strokeWidth="1" key="rect"/>
    ];
    if (itemInfo.type === 'theorem') {
      contents.unshift(<line x1="-7" y1="-6" x2="7" y2="2" stroke="gray" strokeWidth="1" key="line1"/>);
      contents.unshift(<line x1="-8" y1="-2" x2="8" y2="-2" stroke="gray" strokeWidth="1" key="line2"/>);
      contents.unshift(<line x1="-7" y1="2" x2="7" y2="-6" stroke="gray" strokeWidth="1" key="line3"/>);
    }
    return (
      <svg height="1em" width="1em" viewBox={viewBox}>
        {contents}
      </svg>
    );
  default:
    return null;
  }
}
