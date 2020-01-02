import * as React from 'react';
import * as FmtWriter from '../../shared/format/write';
import * as SourceCodeDisplay from '../../shared/display/sourceCodeDisplay';
import { LibraryDefinition } from '../../shared/data/libraryDataAccessor';
import Expression, { ExpressionInteractionHandler } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';

interface SourceCodeViewProps {
  definition: CachedPromise<LibraryDefinition>;
  interactionHandler?: ExpressionInteractionHandler;
}

class SourceCodeView extends React.Component<SourceCodeViewProps> {
  private timer: any;

  componentDidMount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentWillReceiveProps(props: SourceCodeViewProps): void {
    if (props.interactionHandler !== this.props.interactionHandler) {
      if (this.props.interactionHandler) {
        this.props.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
      }
      if (props.interactionHandler) {
        props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
      }
    }
  }

  render(): React.ReactNode {
    let render = this.props.definition.then((definition: LibraryDefinition) => {
      let stream = new SourceCodeDisplay.SourceCodeStream;
      let writer = new FmtWriter.Writer(stream);
      let indent = {
        indent: '',
        outerIndent: ''
      };
      writer.writeDefinition(definition.definition, indent);
      return <Expression expression={stream.result} interactionHandler={this.props.interactionHandler} tooltipPosition="top"/>;
    });

    return renderPromise(render);
  }

  private onExpressionChanged = () => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.forceUpdate(), 500);
  }
}

export default SourceCodeView;
