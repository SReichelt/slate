import * as React from 'react';
import * as Fmt from '../../shared/format/format';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryDefinitionState } from '../../shared/data/libraryDataProvider';
import * as Logic from '../../shared/logics/logic';
import Expression, { ExpressionInteractionHandler } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';

export interface LibraryItemProps {
  libraryDataProvider: LibraryDataProvider;
  definition: LibraryDefinition;
  templates: Fmt.File;
  itemInfo?: CachedPromise<LibraryItemInfo>;
  options: Logic.FullRenderedDefinitionOptions;
  interactionHandler?: ExpressionInteractionHandler;
}

interface LibraryItemState {
  definitionState: LibraryDefinitionState;
  renderer: Logic.LogicRenderer;
}

class LibraryItem extends React.Component<LibraryItemProps, LibraryItemState> {
  constructor(props: LibraryItemProps) {
    super(props);

    this.state = {
      definitionState: props.definition.state,
      renderer: this.createRenderer(props)
    };
  }

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
    if (this.props.libraryDataProvider !== prevProps.libraryDataProvider
        || this.props.definition !== prevProps.definition
        || this.props.definition.state !== this.state.definitionState
        || this.props.templates !== prevProps.templates
        || Object.keys(this.props).some((key: string) => (this.props as any)[key] !== (prevProps as any)[key])) {
      this.setState({
        definitionState: this.props.definition.state,
        renderer: this.createRenderer(this.props)
      });
    }
    if (this.props.interactionHandler !== prevProps.interactionHandler) {
      if (prevProps.interactionHandler) {
        prevProps.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
      }
      if (this.props.interactionHandler) {
        this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
      }
    }
  }

  render(): React.ReactNode {
    let expression = this.state.renderer.renderDefinition(this.props.itemInfo, this.props.options);
    if (expression) {
      return <Expression expression={expression} interactionHandler={this.props.interactionHandler}/>;
    } else {
      return null;
    }
  }

  private createRenderer(props: LibraryItemProps): Logic.LogicRenderer {
    let logic = props.libraryDataProvider.logic;
    let logicDisplay = logic.getDisplay();
    let editing = props.definition.state === LibraryDefinitionState.Editing || props.definition.state === LibraryDefinitionState.EditingNew;
    return logicDisplay.getDefinitionEditor(props.definition.definition, props.libraryDataProvider, props.templates, props.options, editing);
  }

  private onExpressionChanged = (editorUpdateRequired: boolean) => {
    if (editorUpdateRequired) {
      let onAutoFilled = () => {
        if (this.props.interactionHandler) {
          this.props.interactionHandler.expressionChanged(true);
        }
      };
      this.state.renderer.updateEditorState(onAutoFilled).then(() => this.forceUpdate());
    }
  }
}

export default LibraryItem;
