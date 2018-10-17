import * as React from 'react';
import * as Fmt from '../../shared/format/format';
import * as FmtWriter from '../../shared/format/write';
import * as Display from '../../shared/display/display';
import Expression from './Expression';
import { LibraryDataProvider } from '../../shared/data/libraryDataProvider';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';

export interface SourceCodeViewProps {
  libraryDataProvider: LibraryDataProvider;
  definition: CachedPromise<Fmt.Definition>;
}

function SourceCodeView(props: SourceCodeViewProps): any {
  let render = props.definition.then((definition: Fmt.Definition) => {
    let stream = new FmtWriter.StringOutputStream;
    let writer = new FmtWriter.Writer(stream);
    let indent = {
      indent: '',
      outerIndent: ''
    };
    writer.writeDefinition(definition, indent);
    let expression = new Display.TextExpression(stream.str);
    expression.styleClasses = ['source-code'];
    return <Expression expression={expression}/>;
  });

  return renderPromise(render);
}

export default SourceCodeView;
