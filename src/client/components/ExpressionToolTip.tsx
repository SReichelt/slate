import * as React from 'react';
import './ExpressionToolTip.css';

const ToolTip = require('react-portal-tooltip').default;

export type ExpressionToolTipPosition = 'left' | 'top' | 'right' | 'bottom';

interface ExpressionToolTipParent {
  getBoundingClientRect(): ClientRect;
}

interface ExpressionToolTipProps {
  position: ExpressionToolTipPosition;
  parent: ExpressionToolTipParent;
  delay?: number;
  active: boolean;
  getContents: () => React.ReactNode;
}

interface ExpressionToolTipState {
  visible: boolean;
}

class ExpressionToolTip extends React.Component<ExpressionToolTipProps, ExpressionToolTipState> {
  private static showTimer: any;
  private static showTimerOwner?: ExpressionToolTip;
  private static currentContents: React.ReactNode = null;
  private static currentContentsOwner?: ExpressionToolTip;

  private static readonly toolTipStyle = {
    style: {'color': 'var(--tooltip-foreground-color)', 'backgroundColor': 'var(--tooltip-background-color)'},
    arrowStyle: {'color': 'var(--tooltip-background-color)'}
  };

  constructor(props: ExpressionToolTipProps) {
    super(props);

    this.state = {
      visible: false
    };
  }

  componentDidMount(): void {
    this.updateState();
  }

  componentDidUpdate(prevProps: ExpressionToolTipProps): void {
    this.updateState();
  }

  private updateState(): void {
    if (this.props.active) {
      if (!this.state.visible && ExpressionToolTip.showTimerOwner !== this) {
        if (ExpressionToolTip.showTimer) {
          clearTimeout(ExpressionToolTip.showTimer);
          ExpressionToolTip.showTimer = undefined;
          ExpressionToolTip.showTimerOwner = undefined;
        }
        let show = () => this.setState((prevState) => (prevState.visible ? null : {visible: true}));
        if (this.props.delay) {
          ExpressionToolTip.showTimer = setTimeout(show, this.props.delay);
          ExpressionToolTip.showTimerOwner = this;
        } else {
          show();
        }
      }
    } else {
      if (ExpressionToolTip.showTimerOwner === this) {
        clearTimeout(ExpressionToolTip.showTimer);
        ExpressionToolTip.showTimer = undefined;
        ExpressionToolTip.showTimerOwner = undefined;
      }
      this.setState((prevState) => (prevState.visible ? {visible: false} : null));
    }
  }

  componentWillUnmount() {
    if (ExpressionToolTip.showTimerOwner === this) {
      clearTimeout(ExpressionToolTip.showTimer);
      ExpressionToolTip.showTimer = undefined;
      ExpressionToolTip.showTimerOwner = undefined;
    }
    if (ExpressionToolTip.currentContentsOwner === this) {
      ExpressionToolTip.currentContents = undefined;
      ExpressionToolTip.currentContentsOwner = undefined;
    }
  }

  render(): React.ReactNode {
    let visible = false;
    if (this.state.visible) {
      let contents = this.props.getContents();
      if (contents) {
        ExpressionToolTip.currentContents = contents;
        ExpressionToolTip.currentContentsOwner = this;
        visible = true;
      }
    }
    return (
      <ToolTip active={visible} position={this.props.position} arrow="center" parent={this.props.parent} style={ExpressionToolTip.toolTipStyle}>
        <div className={'tooltip'}>{ExpressionToolTip.currentContents}</div>
      </ToolTip>
    );
  }
}

export default ExpressionToolTip;
