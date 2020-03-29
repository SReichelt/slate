import * as React from 'react';
import './LibraryItem.css';
import * as Fmt from '../../shared/format/format';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryDefinitionState } from '../../shared/data/libraryDataProvider';
import { MRUList } from '../../shared/data/mostRecentlyUsedList';
import * as Logic from '../../shared/logics/logic';
import Expression, { ExpressionInteractionHandler } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';

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
      let logic = props.libraryDataProvider.logic;
      let logicDisplay = logic.getDisplay();
      let editing = props.definition.state === LibraryDefinitionState.Editing || props.definition.state === LibraryDefinitionState.EditingNew;
      return logicDisplay.getDefinitionEditor(props.definition.definition, props.libraryDataProvider, props.templates, props.options, editing, props.mruList);
    } else {
      return undefined;
    }
  }

  protected getRenderer(): Logic.LogicRenderer | undefined {
    if (!this.rendererProps
        || Object.keys(this.props).some((key: string) => (this.props as any)[key] !== (this.rendererProps as any)[key])
        || this.props.definition.state !== this.rendererDefinitionState
        || this.props.definition.definition !== this.rendererDefinition) {
      this.renderer = this.createRenderer(this.props);
      this.rendererProps = {...this.props};
      this.rendererDefinitionState = this.props.definition.state;
      this.rendererDefinition = this.props.definition.definition;
    }
    return this.renderer;
  }

  protected abstract onExpressionChanged: (editorUpdateRequired: boolean) => void;
}

class LibraryItem extends LibraryItemBase {
  render(): React.ReactNode {
    let renderer = this.getRenderer();
    if (renderer) {
      let expression = renderer.renderDefinition(this.props.itemInfo, this.props.options);
      if (expression) {
        return (
          <div className="library-item">
            <Expression expression={expression} interactionHandler={this.props.interactionHandler}/>
          </div>
        );
      }
    }
    return null;
  }

  protected onExpressionChanged = (editorUpdateRequired: boolean) => {
    if (editorUpdateRequired) {
      let onAutoFilled = () => {
        if (this.props.interactionHandler) {
          this.props.interactionHandler.expressionChanged(true);
        }
      };
      let renderer = this.getRenderer();
      if (renderer) {
        renderer.updateEditorState(onAutoFilled).then(() => this.forceUpdate());
      }
    }
  }
}

export default LibraryItem;
