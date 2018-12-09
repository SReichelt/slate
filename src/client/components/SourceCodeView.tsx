import * as React from 'react';
import * as Fmt from '../../shared/format/format';
import * as FmtWriter from '../../shared/format/write';
import * as SourceCodeDisplay from '../../shared/display/sourceCodeDisplay';
import Expression, { ExpressionInteractionHandler } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';

export interface SourceCodeViewProps {
  definition: CachedPromise<Fmt.Definition>;
  interactionHandler?: ExpressionInteractionHandler;
}

class SourceCodeView extends React.Component<SourceCodeViewProps> {
  private timer: any;

  componentDidMount(): void {
    if (this.props.interactionHandler) {
      this.props.interactionHandler.registerExpressionChangeHandler(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.props.interactionHandler) {
      this.props.interactionHandler.unregisterExpressionChangeHandler(this.onExpressionChanged);
    }
  }

  componentWillReceiveProps(props: SourceCodeViewProps): void {
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
    let render = this.props.definition.then((definition: Fmt.Definition) => {
      let stream = new SourceCodeDisplay.SourceCodeStream;
      let writer = new FmtWriter.Writer(stream);
      let indent = {
        indent: '',
        outerIndent: ''
      };
      writer.writeDefinition(definition, indent);
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
