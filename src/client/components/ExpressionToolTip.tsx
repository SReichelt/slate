import * as React from 'react';
import clsx from 'clsx';
const ToolTip = require('react-portal-tooltip').default;

import './ExpressionToolTip.css';


export type ToolTipPosition = 'left' | 'top' | 'right' | 'bottom';
export type ToolTipArrow = 'center' | 'left' | 'top' | 'right' | 'bottom';

export interface ToolTipParentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ToolTipParent {
  getBoundingClientRect(): ToolTipParentRect;
}

interface ToolTipProps {
  active: boolean;
  parent: ToolTipParent;
  position: ToolTipPosition;
  arrow?: ToolTipArrow;
  getContents: () => React.ReactNode;
}

interface ExpressionToolTipProps extends ToolTipProps {
  delay?: number;
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
        const show = () => this.setState((prevState) => (prevState.visible ? null : {visible: true}));
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

  componentWillUnmount(): void {
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
      const contents = this.props.getContents();
      if (contents) {
        ExpressionToolTip.currentContents = contents;
        ExpressionToolTip.currentContentsOwner = this;
        visible = true;
      }
    }
    return (
      <ToolTip active={visible} parent={this.props.parent} position={this.props.position} arrow={this.props.arrow ?? 'center'} style={ExpressionToolTip.toolTipStyle} useHover={false}>
        <div className={'tooltip preview'}>{ExpressionToolTip.currentContents}</div>
      </ToolTip>
    );
  }
}

interface PermanentToolTipProps extends ToolTipProps {
  group: string;
  refreshInterval?: number;
}

export class PermanentToolTip extends React.Component<PermanentToolTipProps> {
  private contents: React.ReactNode = null;
  private refreshTimer: any;

  private static readonly toolTipStyle = {
    style: {'color': 'var(--permanent-tooltip-foreground-color)', 'backgroundColor': 'var(--permanent-tooltip-background-color)'},
    arrowStyle: {'color': 'var(--permanent-tooltip-background-color)'}
  };

  componentDidMount(): void {
    this.updateTimer();
  }

  componentDidUpdate(prevProps: PermanentToolTipProps): void {
    if (this.props.refreshInterval !== prevProps.refreshInterval) {
      this.updateTimer();
    }
  }

  private updateTimer(): void {
    this.stopTimer();
    if (this.props.refreshInterval) {
      const refresh = () => {
        this.forceUpdate();
      };
      this.refreshTimer = setInterval(refresh, this.props.refreshInterval);
    }
  }

  componentWillUnmount(): void {
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  render(): React.ReactNode {
    if (this.props.active) {
      this.contents = this.props.getContents();
    }
    const className = clsx('tooltip permanent', {
      'fixed-width': this.props.arrow
    });
    return (
      <ToolTip active={this.props.active} parent={this.props.parent} position={this.props.position} arrow={this.props.arrow ?? 'center'} group={this.props.group} style={PermanentToolTip.toolTipStyle} useHover={false}>
        <div className={className}>{this.contents}</div>
      </ToolTip>
    );
  }
}

export default ExpressionToolTip;
