import * as React from 'react';
import * as Fmt from '../../shared/format/format';
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
  editing: boolean;
  interactionHandler?: ExpressionInteractionHandler;
}

export function renderLibraryItem(props: LibraryItemProps): any {
  let logic = props.libraryDataProvider.logic;
  let logicDisplay = logic.getDisplay();

  let render = props.definition.then((definition: Fmt.Definition) => {
    let renderer = logicDisplay.getDefinitionRenderer(definition, props.libraryDataProvider, props.templates, props.editing);
    let expression = renderer.renderDefinition(props.itemInfo, props.includeLabel, props.includeExtras, props.includeProofs, props.includeRemarks);
    if (expression) {
      return <Expression expression={expression} interactionHandler={props.interactionHandler}/>;
    } else {
      return null;
    }
  });

  return renderPromise(render);
}

class LibraryItem extends React.Component<LibraryItemProps> {
  componentDidMount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerExpressionChangeHandler(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterExpressionChangeHandler(this.onExpressionChanged);
    }
  }

  componentWillReceiveProps(props: LibraryItemProps): void {
    if (props.interactionHandler !== this.props.interactionHandler) {
      if (this.props.interactionHandler) {
        this.props.interactionHandler.unregisterExpressionChangeHandler(this.onExpressionChanged);
      }
      if (props.interactionHandler) {
        props.interactionHandler.registerExpressionChangeHandler(this.onExpressionChanged);
      }
    }
  }

  render(): any {
    return renderLibraryItem(this.props);
  }

  private onExpressionChanged = (editorUpdateRequired: boolean) => {
    if (editorUpdateRequired) {
      this.forceUpdate();
    }
  }
}

export default LibraryItem;
