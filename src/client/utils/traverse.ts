import * as React from 'react';

export interface ReactElementManipulator {
  manipulateProps?(props: any): any;
  manipulateContents?(node: React.ReactNode, component: React.Component<any, any> | undefined): React.ReactNode;
  componentAction?(component: React.Component<any, any>): void;
  elementAction?(reactElement: React.ReactElement, htmlElement: HTMLElement): void;
}

export type ReactElementVisitor = (element: React.ReactElement) => ReactElementManipulator | undefined;

function assignProps(props: any, nodeObject: any, fallbackKey: number | undefined, additionalRef?: (ref: any) => void): void {
  if (nodeObject.key !== null) {
    props.key = nodeObject.key;
  } else if (fallbackKey !== undefined) {
    props.key = fallbackKey;
  }
  let origRef = nodeObject.ref;
  if (additionalRef) {
    props.ref = (ref: any) => {
      additionalRef(ref);
      if (origRef) {
        return origRef(ref);
      }
    };
  } else if (origRef !== null) {
    props.ref = origRef;
  }
}

function getManipulatedProps(nodeObject: any, fallbackKey: number | undefined, isComponent: boolean, manipulator?: ReactElementManipulator): any {
  let props = nodeObject.props;
  if (manipulator && manipulator.manipulateProps) {
    props = manipulator.manipulateProps(props);
  }
  if (nodeObject.key === null && nodeObject.ref === null && fallbackKey === undefined && !manipulator?.manipulateContents && !manipulator?.componentAction && !manipulator?.elementAction) {
    return props;
  }
  let result = {...props};
  let additionalRef = undefined;
  if (manipulator?.elementAction && !isComponent) {
    additionalRef = (ref: any) => {
      if (ref !== null) {
        manipulator.elementAction!(nodeObject, ref);
      }
    };
  }
  assignProps(result, nodeObject, fallbackKey, additionalRef);
  if (isComponent) {
    if (manipulator?.manipulateContents) {
      result._manipulateContents = manipulator.manipulateContents;
    }
    if (manipulator?.componentAction) {
      result._componentAction = manipulator.componentAction;
    }
    if (manipulator?.elementAction) {
      result._elementAction = manipulator.elementAction;
    }
  }
  return result;
}

function attachElementAction(nodeObject: any, elementAction: (reactElement: React.ReactElement, htmlElement: HTMLElement) => void): any {
  if (nodeObject.type === undefined || nodeObject.props === undefined) {
    throw new Error('Cannot attach element action to non-element node');
  }
  let newContentProps = {...nodeObject.props};
  let additionalRef = (ref: any) => {
    if (ref !== null) {
      elementAction(nodeObject, ref);
    }
  };
  assignProps(newContentProps, nodeObject, undefined, additionalRef);
  return React.createElement(nodeObject.type, newContentProps);
}

let wrappedClassComponents = new Map<any, any>();
let wrappedFunctionComponents = new Map<any, any>();

function getManipulatedContents(contents: any, props: any, component: React.Component<any, any> | undefined): any {
  if (props._manipulateContents) {
    contents = props._manipulateContents(contents, component);
  }
  if (props._elementAction) {
    contents = attachElementAction(contents, props._elementAction);
  }
  return contents;
}

function getWrappedClassComponent(type: any): any {
  let result = wrappedClassComponents.get(type);
  if (!result) {
    result = class extends type {
      static displayName = type.displayName || type.name;
      static propTypes = type.propTypes;
      private actionTimer: any;
      componentWillUnmount(): void {
        if (this.actionTimer) {
          clearTimeout(this.actionTimer);
        }
        super.componentWillUnmount?.();
      }
      render(): React.ReactNode {
        let contents = super.render();
        contents = getManipulatedContents(contents, this.props, this as any);
        if (this.props._componentAction) {
          if (this.actionTimer) {
            clearTimeout(this.actionTimer);
          }
          this.actionTimer = setTimeout(() => this.props._componentAction?.(this), 0);
        }
        return contents;
      }
    };
    wrappedClassComponents.set(type, result);
  }
  return result;
}

function getWrappedFunctionComponent(type: any): any {
  let result = wrappedFunctionComponents.get(type);
  if (!result) {
    result = class extends React.Component<any> {
      static displayName = type.displayName || type.name;
      static propTypes = type.propTypes;
      private actionTimer: any;
      componentWillUnmount(): void {
        if (this.actionTimer) {
          clearTimeout(this.actionTimer);
        }
      }
      render(): React.ReactNode {
        let contents = type(this.props);
        contents = getManipulatedContents(contents, this.props, this);
        if (this.props._componentAction) {
          if (this.actionTimer) {
            clearTimeout(this.actionTimer);
          }
          this.actionTimer = setTimeout(() => this.props._componentAction?.(this), 0);
        }
        return contents;
      }
    };
    wrappedFunctionComponents.set(type, result);
  }
  return result;
}

export function traverseReactComponents(node: React.ReactNode, visitor: ReactElementVisitor, fallbackKey?: number): React.ReactNode {
  if (node !== null && typeof node === 'object') {
    if (Array.isArray(node)) {
      return node.map((item: React.ReactNode, index: number) => traverseReactComponents(item, visitor, index));
    }

    let nodeObject: any = node;
    let type = nodeObject.type;

    if (typeof type !== 'undefined') {
      let isComponent = false;

      let manipulator = visitor(nodeObject);

      if (typeof type.prototype !== 'undefined' && typeof type.prototype.render === 'function') {
        isComponent = true;
        if (manipulator) {
          if (manipulator.manipulateContents || manipulator.componentAction || manipulator?.elementAction) {
            type = getWrappedClassComponent(type);
          }
          return React.createElement(type, getManipulatedProps(nodeObject, fallbackKey, true, manipulator));
        }
      } else if (typeof type === 'function') {
        isComponent = true;
        if (manipulator) {
          if (manipulator.manipulateContents || manipulator.componentAction || manipulator?.elementAction) {
            type = getWrappedFunctionComponent(type);
          }
          return React.createElement(type, getManipulatedProps(nodeObject, fallbackKey, true, manipulator));
        }
      } else if (manipulator) {
        if (manipulator.componentAction) {
          throw new Error('Trying to attach component action to non-component node');
        }
        if (manipulator.manipulateContents) {
          nodeObject = manipulator.manipulateContents(node, undefined);
          if (manipulator.manipulateProps) {
            let newProps = manipulator.manipulateProps(nodeObject.props);
            nodeObject = React.createElement(nodeObject.type, newProps);
          }
          if (manipulator.elementAction) {
            nodeObject = attachElementAction(nodeObject, manipulator.elementAction);
          }
          return nodeObject;
        }
      }

      if (manipulator?.manipulateProps || manipulator?.elementAction || nodeObject.props?.children) {
        let newProps = {
          ...getManipulatedProps(nodeObject, fallbackKey, isComponent, manipulator),
          children: traverseReactComponents(nodeObject.props.children, visitor)
        };
        return React.createElement(type, newProps);
      }
    }
  }
  return node;
}
