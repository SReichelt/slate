import * as React from 'react';
import './Button.css';

interface ButtonProps {
  className?: string;
  toolTipText?: string;
  enabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

interface ButtonState {
  pressed: boolean;
}

class Button extends React.Component<ButtonProps, ButtonState> {
  constructor(props: ButtonProps) {
    super(props);
    this.state = {
      pressed: false
    };
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
          propsOnClick();
        };
      }
      onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        this.setState({pressed: true});
      };
      onMouseUp = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
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
