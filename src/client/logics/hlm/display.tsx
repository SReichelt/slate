import * as Fmt from '../../../shared/format/format';
import * as FmtHLM from '../../../shared/logics/hlm/meta';
import * as Logic from '../logic';
import { HLMRenderer } from './renderer';
import { LibraryDataAccessor, LibraryItemInfo } from '../../../shared/data/libraryDataAccessor';
import * as React from 'react';

export class HLMDisplay implements Logic.LogicDisplay {
  getDefinitionIcon(definition: Fmt.Definition, itemInfo: LibraryItemInfo): any {
    let type = definition.type.expression;
    if (type instanceof FmtHLM.MetaRefExpression_Construction) {
      return (
        <svg height="1em" width="1em" viewBox="-8 -8 16 16">
          <circle cx="0" cy="0" r="7" fill="green" stroke="black" strokeWidth="1"/>
          <rect x="-4" y="-4" width="8" height="8" fill="red" stroke="black" strokeWidth="1"/>
        </svg>
      );
    } else if (type instanceof FmtHLM.MetaRefExpression_SetOperator) {
      return (
        <svg height="1em" width="1em" viewBox="-8 -8 16 16">
          <circle cx="0" cy="0" r="7" fill="green" stroke="black" strokeWidth="1"/>
        </svg>
      );
    } else if (type instanceof FmtHLM.MetaRefExpression_ExplicitOperator || type instanceof FmtHLM.MetaRefExpression_ImplicitOperator || type instanceof FmtHLM.MetaRefExpression_MacroOperator || type instanceof FmtHLM.MetaRefExpression_Constructor) {
      return (
        <svg height="1em" width="1em" viewBox="-8 -8 16 16">
          <rect x="-4" y="-4" width="8" height="8" fill="red" stroke="black" strokeWidth="1"/>
        </svg>
      );
    } else if (type instanceof FmtHLM.MetaRefExpression_Predicate) {
      return (
        <svg height="1em" width="1em" viewBox="-8 -8 16 16">
          <rect x="-5" y="-5" width="10" height="10" fill="blue" stroke="black" strokeWidth="1" transform="rotate(45)"/>
        </svg>
      );
    } else if (type instanceof FmtHLM.MetaRefExpression_StandardTheorem || type instanceof FmtHLM.MetaRefExpression_EquivalenceTheorem) {
      let viewBox = '-8 -8 16 16';
      if (itemInfo.type === 'lemma' || itemInfo.type === 'corollary' || itemInfo.type === 'example') {
        viewBox = '-10 -10 20 20';
      }
      let contents = [
        <circle cx="0" cy="-2" r="5" fill="yellow" stroke="black" strokeWidth="1" key="circle"/>,
        <rect x="-2" y="3" width="4" height="4" fill="gray" stroke="black" strokeWidth="1" key="rect"/>
      ];
      if (itemInfo.type === 'theorem') {
        contents.unshift(<line x1="-7" y1="-6" x2="7" y2="2" stroke="gray" strokeWidth="1" key="rect"/>);
        contents.unshift(<line x1="-8" y1="-2" x2="8" y2="-2" stroke="gray" strokeWidth="1" key="rect"/>);
        contents.unshift(<line x1="-7" y1="2" x2="7" y2="-6" stroke="gray" strokeWidth="1" key="rect"/>);
      }
      return (
        <svg height="1em" width="1em" viewBox={viewBox}>
          {contents}
        </svg>
      );
    } else {
      return null;
    }
  }

  getRenderer(libraryDataAccessor: LibraryDataAccessor, templates: Fmt.File): Logic.LogicRenderer {
    return new HLMRenderer(libraryDataAccessor, templates);
  }
}
