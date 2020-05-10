import * as React from 'react';

export type OnDocLinkClicked = (uri: string) => void;

interface DocLinkProps {
  href: string;
  onDocLinkClicked: OnDocLinkClicked;
}

function DocLink(props: React.PropsWithChildren<DocLinkProps>) {
  let onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button < 1) {
      event.preventDefault();
      props.onDocLinkClicked(props.href);
    }
  };
  return <a href={props.href} onClick={onClick}>{props.children}</a>;
}

export default DocLink;
