import * as React from 'react';

export function eventHandledNoBlur(event: React.SyntheticEvent<HTMLElement>): void {
  event.stopPropagation();
  event.preventDefault();
}

export function eventHandled(event: React.SyntheticEvent<HTMLElement>): void {
  event.stopPropagation();
  event.preventDefault();
  if (event.type === 'mousedown' || event.type === 'touchstart') {
    let activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement.tagName !== 'BODY') {
      activeElement.blur();
    }
  }
}
