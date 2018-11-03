import * as React from 'react';
import './Button.css';

interface ToggleButtonProps {
  enabled: boolean;
  selected: boolean;
  onToggle: (selected: boolean) => void;
}

class ToggleButton extends React.Component<ToggleButtonProps> {
  constructor(props: ToggleButtonProps) {
    super(props);
  }

  render(): any {
    let className = 'button';
    if (this.props.enabled) {
      className += ' hoverable';
    }
    if (this.props.selected) {
      className += ' selected';
    }
    return <div className={className} onClick={() => this.props.enabled && this.props.onToggle(!this.props.selected)}>{this.props.children}</div>;
  }
}

export default ToggleButton;