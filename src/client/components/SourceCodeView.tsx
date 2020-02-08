import * as React from 'react';
import * as FmtWriter from '../../shared/format/write';
import * as SourceCodeDisplay from '../../shared/display/sourceCodeDisplay';
import { LibraryDefinition } from '../../shared/data/libraryDataAccessor';
import Expression, { ExpressionInteractionHandler } from './Expression';

interface SourceCodeViewProps {
  definition: LibraryDefinition;
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

  componentDidUpdate(prevProps: SourceCodeViewProps): void {
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
    let stream = new SourceCodeDisplay.SourceCodeStream;
    let writer = new FmtWriter.Writer(stream, true);
    let indent = {
      indent: '',
      outerIndent: ''
    };
    writer.writeDefinition(this.props.definition.definition, indent);
    return <Expression expression={stream.result} interactionHandler={this.props.interactionHandler} tooltipPosition="top"/>;
  }

  private onExpressionChanged = () => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.forceUpdate(), 500);
  }
}

export default SourceCodeView;
