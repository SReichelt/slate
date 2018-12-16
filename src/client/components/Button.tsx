import * as React from 'react';
import './Button.css';

interface ButtonProps {
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
  
  render(): any {
    let className = 'button';
    let onClick = undefined;
    let onMouseDown = undefined;
    let onMouseUp = undefined;
    let onMouseLeave = undefined;
    if (this.props.enabled === undefined || this.props.enabled) {
      className += ' hoverable';
      onClick = this.props.onClick;
      onMouseDown = () => this.setState({pressed: true});
      onMouseUp = () => this.setState({pressed: false});
      onMouseLeave = () => this.setState({pressed: false});
    } else {
      className += ' disabled';
    }
    if (this.state.pressed) {
      className += ' pressed';
    }
    if (this.props.selected) {
      className += ' selected';
    }
    return <div className={className} title={this.props.toolTipText} onClick={onClick} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>{this.props.children}</div>;
  }
}

export default Button;
