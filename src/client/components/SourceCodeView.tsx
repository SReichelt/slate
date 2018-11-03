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

function SourceCodeView(props: SourceCodeViewProps): any {
  let render = props.definition.then((definition: Fmt.Definition) => {
    let stream = new SourceCodeDisplay.SourceCodeStream;
    let writer = new FmtWriter.Writer(stream);
    let indent = {
      indent: '',
      outerIndent: ''
    };
    writer.writeDefinition(definition, indent);
    return <Expression expression={stream.result} interactionHandler={props.interactionHandler} tooltipPosition="top"/>;
  });

  return renderPromise(render);
}

export default SourceCodeView;
