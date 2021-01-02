import * as React from 'react';

// Most of the elements we use don't actually have any default behavior of their own,
// but their parent elements might have some behavior (default or implemented by us)
// that we need to prevent.
// In most cases, stopPropagation would probably be sufficient for that. However,
// there is at least one case where preventDefault is crucial: The default behavior
// of touch events is a conversion to mouse events, so when we explicitly handle a
// touch event, we definitely do need to call preventDefault. Similarly but less
// importantly, when we handle a mouse down/up event, we usually want to prevent the
// conversion to a click event.
export function disableDefaultBehavior(event: React.SyntheticEvent<HTMLElement>): void {
  event.stopPropagation();
  event.preventDefault();
}

// Like disableDefaultBehavior, but keeps (actually, replicates) the default behavior
// that mousedown/touchstart events blur other elements.
export function disableOwnDefaultBehavior(event: React.SyntheticEvent<HTMLElement>): void {
  disableDefaultBehavior(event);
  if (event.type === 'mousedown' || event.type === 'touchstart') {
    // It would be nice if we could just call event.currentTarget.focus() instead,
    // but that doesn't seem to have any effect.
    blurActiveElement();
  }
}

function blurActiveElement(): void {
  let activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.tagName !== 'BODY') {
    activeElement.blur();
  }
}

// Keep all default behavior, but don't call parent event handlers.
// This is mainly useful for touch events: We often want to keep their default
// behavior of simulating a mouse event (especially in standard controls, where we
// might not even define any handlers of our own). However, if a parent element
// contains a handler for the touch event, then that handler is called instead,
// unless we stop propagation before the handler is reached.
export function limitDefaultBehaviorToElement(event: React.SyntheticEvent<HTMLElement>): void {
  event.stopPropagation();
}
