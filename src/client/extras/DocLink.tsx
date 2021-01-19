import * as React from 'react';

import { disableOwnDefaultBehavior } from '../utils/event';


export type OnDocLinkClicked = (uri: string) => void;

interface DocLinkProps {
  href: string;
  onDocLinkClicked: OnDocLinkClicked;
}

function DocLink(props: React.PropsWithChildren<DocLinkProps>): React.ReactElement {
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button < 1) {
      disableOwnDefaultBehavior(event);
      props.onDocLinkClicked(props.href);
    }
  };
  return <a href={props.href} onClick={onClick}>{props.children}</a>;
}

export default DocLink;
