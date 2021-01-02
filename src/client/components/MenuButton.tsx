import * as React from 'react';
import clsx from 'clsx';
import scrollIntoView from 'scroll-into-view-if-needed';

import './Button.css';
import './MenuButton.css';

import { eventHandled } from '../utils/event';


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
    let enabled = (this.props.enabled === undefined || this.props.enabled);
    let className = clsx('button', 'menu-button', this.props.className, {
      'disabled': !enabled,
      'hoverable': enabled,
      'open': this.state.menuOpen
    });
    let onMouseEnter = undefined;
    let onMouseLeave = undefined;
    let onMouseDown = undefined;
    let onMouseUp = undefined;
    let onClick = undefined;
    if (enabled) {
      if (this.props.openOnHover) {
        onMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
          this.setState({menuOpen: true});
        };
        onMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
          this.setState({menuOpen: false});
        };
      } else {
        onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
          eventHandled(event);
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
          eventHandled(event);
        };
        onClick = (event: React.MouseEvent<HTMLElement>) => {
          eventHandled(event);
        };
      }
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
      let menuClassName = clsx('menu-button-popup', this.props.menuClassName, {
        'menu-button-popup-top': this.props.menuOnTop,
        'menu-button-popup-bottom': !this.props.menuOnTop
      });
      let menu = (
        <div className={menuClassName} title={''} key="menu" ref={ref}>
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
