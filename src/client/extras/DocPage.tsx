import * as React from 'react';
import { OnDocLinkClicked } from './DocLink';
import { renderPromise } from '../components/PromiseHelper';
import { fetchText } from '../../shared/utils/fetch';
import CachedPromise from '../../shared/data/cachedPromise';

const RemarkableReactRenderer = require('remarkable-react').default;
const Remarkable = require('remarkable').Remarkable;
const linkify = require('remarkable/linkify').linkify;

interface DocPageProps {
  uri: string;
  onDocLinkClicked: OnDocLinkClicked;
}

export const markdownSuffix = '.md';

const DocPage = React.memo((props: DocPageProps) => {
  let baseUriEnd = props.uri.lastIndexOf('/');
  let baseUri = baseUriEnd >= 0 ? props.uri.substring(0, baseUriEnd + 1) : '';
  let markdownUri = `${props.uri}${markdownSuffix}`;
  let promise = fetchText(markdownUri).then((text: string) => {
    let md = new Remarkable;
    md.use(linkify);
    md.renderer = new RemarkableReactRenderer({
      components: {
        a: (linkProps: any) => {
          let href: string = linkProps.href;
          let target: string | undefined = '_blank';
          let onClick = undefined;
          if (href.indexOf(':') < 0 && baseUri) {
            href = baseUri + href;
            if (href.endsWith(markdownSuffix)) {
              href = href.substring(0, href.length - markdownSuffix.length);
              target = undefined;
              onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
                if (event.button < 1) {
                  event.preventDefault();
                  props.onDocLinkClicked(href);
                }
              };
            }
          }
          return <a {...linkProps} href={href} target={target} onClick={onClick}>{linkProps.children}</a>;
        }
      }
    });
    return md.render(text);
  });
  return renderPromise(new CachedPromise(promise));
});

export default DocPage;
