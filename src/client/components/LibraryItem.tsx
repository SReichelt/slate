import * as React from 'react';
import * as Fmt from '../../shared/format/format';
import * as Display from '../../shared/display/display';
import { LibraryDataProvider, LibraryItemInfo } from '../../shared/data/libraryDataProvider';
import Expression, { ExpressionInteractionHandler } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';

export interface LibraryItemProps {
  libraryDataProvider: LibraryDataProvider;
  definition: CachedPromise<Fmt.Definition>;
  templates: Fmt.File;
  itemInfo?: CachedPromise<LibraryItemInfo>;
  includeLabel: boolean;
  includeExtras: boolean;
  includeProofs: boolean;
  includeRemarks: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

function LibraryItem(props: LibraryItemProps): any {
  let logic = props.libraryDataProvider.logic;
  let logicDisplay = logic.getDisplay();
  let renderer = logicDisplay.getRenderer(props.libraryDataProvider, props.templates);

  let render = props.definition.then((definition: Fmt.Definition) => {
    let expression = renderer.renderDefinition(definition, props.itemInfo, props.includeLabel, props.includeExtras, props.includeProofs, props.includeRemarks);
    if (expression) {
      return <Expression expression={expression} interactionHandler={props.interactionHandler}/>;
    } else {
      return null;
    }
  });

  return renderPromise(render);
}

export default LibraryItem;
