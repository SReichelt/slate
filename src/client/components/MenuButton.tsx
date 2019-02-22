import * as React from 'react';
import './Button.css';
import './MenuButton.css';

interface MenuButtonProps {
  toolTipText?: string;
  enabled?: boolean;
  menu: React.ReactNode;
}

interface MenuButtonState {
  hovered: boolean;
}

class MenuButton extends React.Component<MenuButtonProps, MenuButtonState> {
  constructor(props: MenuButtonProps) {
    super(props);
    this.state = {
      hovered: false
    };
  }
  
  render(): React.ReactNode {
    let className = 'button menu-button';
    let onMouseEnter = undefined;
    let onMouseLeave = undefined;
    if (this.props.enabled === undefined || this.props.enabled) {
      className += ' hoverable';
      onMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
        this.setState({hovered: true});
      };
      onMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
        this.setState({hovered: false});
      };
    } else {
      className += ' disabled';
    }
    let children = this.props.children;
    if (this.state.hovered) {
      let menu = (
        <div className="menu-button-popup" key="Menu">
          {this.props.menu}
        </div>
      );
      children = [children, menu];
    }
    return (
      <div className={className} title={this.props.toolTipText} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </div>
    );
  }
}

export default MenuButton;
