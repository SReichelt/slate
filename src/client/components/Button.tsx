import * as React from 'react';
import './Button.css';

const clickDelay = 500;

interface ButtonProps {
  className?: string;
  toolTipText?: string;
  enabled?: boolean;
  selected?: boolean;
  isMenuItem?: boolean;
  onClick?: () => void;
}

interface ButtonState {
  pressed: boolean;
}

class Button extends React.Component<ButtonProps, ButtonState> {
  private ready = false;

  constructor(props: ButtonProps) {
    super(props);
    this.state = {
      pressed: false
    };
  }

  componentDidMount(): void {
    this.ready = false;
    setTimeout(() => (this.ready = true), clickDelay);
  }

  render(): React.ReactNode {
    let className = 'button';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }
    let onClick = undefined;
    let onMouseDown = undefined;
    let onMouseUp = undefined;
    let onMouseLeave = undefined;
    if (this.props.enabled === undefined || this.props.enabled) {
      className += ' hoverable';
      if (this.props.onClick) {
        let propsOnClick = this.props.onClick;
        onClick = (event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          event.preventDefault();
          if (this.ready && !this.props.isMenuItem) {
            propsOnClick();
          }
        };
      }
      onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        this.setState({pressed: true});
        this.ready = true;
      };
      onMouseUp = (event: React.MouseEvent<HTMLElement>) => {
        if (this.props.isMenuItem && this.ready && this.props.onClick) {
          this.props.onClick();
        } else {
          event.stopPropagation();
        }
        event.preventDefault();
        this.setState({pressed: false});
      };
      onMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
        this.setState({pressed: false});
      };
    } else {
      className += ' disabled';
    }
    if (this.state.pressed) {
      className += ' pressed';
    }
    if (this.props.selected) {
      className += ' selected';
    }
    return (
      <div className={className} title={this.props.toolTipText} onClick={onClick} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
        {this.props.children}
      </div>
    );
  }
}

export default Button;
