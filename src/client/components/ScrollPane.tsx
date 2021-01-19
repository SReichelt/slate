import * as React from 'react';

import './ScrollPane.css';


interface ScrollPaneProps {
  object?: Object;
  onRef?: (htmlNode: HTMLElement | null) => void;
}

class ScrollPane extends React.Component<ScrollPaneProps> {
  private scrollPaneNode: HTMLElement | null = null;

  componentDidUpdate(prevProps: ScrollPaneProps): void {
    if (this.props.object !== prevProps.object && this.scrollPaneNode && this.scrollPaneNode.scrollTo) {
      this.scrollPaneNode.scrollTo({left: 0, top: 0, behavior: 'auto'});
    }
  }

  render(): React.ReactNode {
    const ref = (htmlNode: HTMLElement | null) => {
      this.scrollPaneNode = htmlNode;
      if (this.props.onRef) {
        this.props.onRef(htmlNode);
      }
    };
    return (
      <div className={'scroll-pane'} ref={ref}>
        {this.props.children}
      </div>
    );
  }
}

export default ScrollPane;
