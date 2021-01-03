import * as React from 'react';


export interface RenderedContents {
  contents: React.ReactNode;
  innerClassName: string;
}

export function wrapRenderedContents(renderedContents: RenderedContents): React.ReactElement {
  return <span className={renderedContents.innerClassName}>{renderedContents.contents}</span>;
}
