import * as React from 'react';
import './Button.css';
import './MenuButton.css';
import scrollIntoView from 'scroll-into-view-if-needed';

interface MenuButtonProps {
  className?: string;
  toolTipText?: string;
  enabled?: boolean;
  menu: React.ReactNode;
  menuOnTop?: boolean;
  menuClassName?: string;
  openOnHover?: boolean;
}

interface MenuButtonState {
  menuOpen: boolean;
}

class MenuButton extends React.Component<MenuButtonProps, MenuButtonState> {
  private windowClickListener?: () => void;
  private scrolled = false;

  constructor(props: MenuButtonProps) {
    super(props);
    this.state = {
      menuOpen: false
    };
  }

  render(): React.ReactNode {
    let className = 'button menu-button';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }
    let onMouseEnter = undefined;
    let onMouseLeave = undefined;
    let onMouseDown = undefined;
    let onMouseUp = undefined;
    let onClick = undefined;
    if (this.props.enabled === undefined || this.props.enabled) {
      className += ' hoverable';
      if (this.props.openOnHover) {
        onMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
          this.setState({menuOpen: true});
        };
        onMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
          this.setState({menuOpen: false});
        };
      } else {
        if (this.state.menuOpen) {
          className += ' open';
        }
        onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          event.preventDefault();
          if (this.state.menuOpen) {
            this.closeMenu();
          } else {
            this.openMenu();
          }
        };
        onMouseUp = (event: React.MouseEvent<HTMLElement>) => {
          if (event.defaultPrevented) {
            this.closeMenu();
          }
          event.stopPropagation();
          event.preventDefault();
        };
        onClick = (event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          event.preventDefault();
        };
      }
    } else {
      className += ' disabled';
    }
    let children = this.props.children;
    if (this.state.menuOpen) {
      let ref = (htmlNode: HTMLDivElement | null) => {
        if (htmlNode && !this.scrolled) {
          this.scrolled = true;
          scrollIntoView(htmlNode, {
            scrollMode: 'if-needed',
            block: 'end',
            inline: 'end'
          });
        }
      };
      let menuClassName = 'menu-button-popup';
      if (this.props.menuOnTop) {
        menuClassName += ' menu-button-popup-top';
      } else {
        menuClassName += ' menu-button-popup-bottom';
      }
      if (this.props.menuClassName) {
        menuClassName += ' ' + this.props.menuClassName;
      }
      let menu = (
        <div className={menuClassName} title={''} key="Menu" ref={ref}>
          {this.props.menu}
        </div>
      );
      children = [children, menu];
    }
    return (
      <div className={className} title={this.props.toolTipText} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onClick={onClick}>
        {children}
      </div>
    );
  }

  private openMenu(): void {
    this.setState({menuOpen: true});
    if (!this.windowClickListener) {
      this.windowClickListener = () => this.closeMenu();
      window.addEventListener('mousedown', this.windowClickListener);
    }
  }

  private closeMenu(): void {
    this.setState({menuOpen: false});
    if (this.windowClickListener) {
      window.removeEventListener('mousedown', this.windowClickListener);
      this.windowClickListener = undefined;
    }
    this.scrolled = false;
  }
}

export default MenuButton;
