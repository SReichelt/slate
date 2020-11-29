import * as React from 'react';

import Expression from './Expression';
import { LibraryItemBase } from './LibraryItem';

import * as FmtWriter from '../../shared/format/write';
import * as SourceCodeDisplay from '../../shared/notation/sourceCodeDisplay';


class SourceCodeView extends LibraryItemBase {
  private timer: any;

  render(): React.ReactNode {
    let renderer = this.getRenderer();
    let stream = new SourceCodeDisplay.SourceCodeStream(renderer);
    let writer = new FmtWriter.Writer(stream, true);
    let indent: FmtWriter.IndentInfo = {
      indent: '',
      outerIndent: ''
    };
    writer.writeFile(this.props.definition.file, indent);
    return <Expression expression={stream.result} interactionHandler={this.props.interactionHandler} toolTipPosition="top"/>;
  }

  protected onExpressionChanged = (): void => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    let update = () => {
      let renderer = this.getRenderer();
      if (renderer) {
        renderer.updateEditorState().then(() => this.forceUpdate());
      } else {
        this.forceUpdate();
      }
    };
    this.timer = setTimeout(update, 500);
  };
}

export default SourceCodeView;
