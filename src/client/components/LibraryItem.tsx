import * as React from 'react';

import './LibraryItem.css';

import Expression, { ExpressionInteractionHandler } from './Expression';

import * as Fmt from 'slate-shared/format/format';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryDefinitionState } from 'slate-shared/data/libraryDataProvider';
import { MRUList } from 'slate-shared/data/mostRecentlyUsedList';
import * as Logic from 'slate-shared/logics/logic';
import CachedPromise from 'slate-shared/data/cachedPromise';


export interface LibraryItemProps {
  libraryDataProvider?: LibraryDataProvider;
  definition: LibraryDefinition;
  templates?: Fmt.File;
  itemInfo?: CachedPromise<LibraryItemInfo>;
  options: Logic.FullRenderedDefinitionOptions;
  interactionHandler?: ExpressionInteractionHandler;
  mruList: MRUList;
}

export abstract class LibraryItemBase extends React.Component<LibraryItemProps> {
  renderer?: Logic.LogicRenderer;
  rendererProps?: React.PropsWithChildren<LibraryItemProps>;
  rendererDefinitionState?: LibraryDefinitionState;
  rendererDefinition?: Fmt.Definition;
  definitionChangeCounter = 0;

  componentDidMount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentDidUpdate(prevProps: LibraryItemProps): void {
    if (this.props.interactionHandler !== prevProps.interactionHandler) {
      if (prevProps.interactionHandler) {
        prevProps.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
      }
    }
  }

  private createRenderer(props: LibraryItemProps): Logic.LogicRenderer | undefined {
    if (props.libraryDataProvider && props.templates) {
      const logic = props.libraryDataProvider.logic;
      const logicNotation = logic.getDisplay();
      const editing = props.definition.state === LibraryDefinitionState.Editing || props.definition.state === LibraryDefinitionState.EditingNew;
      return logicNotation.getDefinitionEditor(props.definition.definition, props.libraryDataProvider, props.templates, props.options, editing, props.mruList);
    } else {
      return undefined;
    }
  }

  protected getRenderer(): Logic.LogicRenderer | undefined {
    if (!this.rendererProps
        || this.props.libraryDataProvider !== this.rendererProps.libraryDataProvider
        || this.props.definition !== this.rendererProps.definition
        || this.props.definition.state !== this.rendererDefinitionState
        || this.props.definition.definition !== this.rendererDefinition
        || this.props.templates !== this.rendererProps.templates
        || this.props.options !== this.rendererProps.options
        || this.props.mruList !== this.rendererProps.mruList) {
      this.renderer = this.createRenderer(this.props);
      this.rendererProps = {...this.props};
      this.rendererDefinitionState = this.props.definition.state;
      this.rendererDefinition = this.props.definition.definition;
      this.definitionChangeCounter++;
    }
    return this.renderer;
  }

  protected abstract onExpressionChanged: (editorUpdateRequired: boolean) => void;
}

class LibraryItem extends LibraryItemBase {
  render(): React.ReactNode {
    const renderer = this.getRenderer();
    if (renderer) {
      const expression = renderer.renderDefinition(this.props.itemInfo, this.props.options);
      if (expression) {
        return (
          <div className="library-item">
            <Expression expression={expression} interactionHandler={this.props.interactionHandler} key={this.definitionChangeCounter}/>
          </div>
        );
      }
    }
    return null;
  }

  protected onExpressionChanged = (editorUpdateRequired: boolean): void => {
    if (editorUpdateRequired) {
      const onAutoFilled = () => {
        if (this.props.interactionHandler) {
          this.props.interactionHandler.expressionChanged(true);
        }
      };
      const renderer = this.getRenderer();
      if (renderer) {
        renderer.updateEditorState(onAutoFilled).then(() => this.forceUpdate());
      }
    }
  };
}

export default LibraryItem;
