import * as React from 'react';
import { ReactElementManipulator, traverseReactComponents } from '../utils/traverse';
import { PermanentToolTip, ToolTipPosition } from '../components/ExpressionToolTip';

export interface TutorialToolTip {
  contents: React.ReactElement | ((component: React.Component<any, any>) => React.ReactNode) | null;
  position: ToolTipPosition;
  index: number;
  condition?: (component: React.Component<any, any>) => boolean;
}

export interface TutorialManipulationEntry {
  type?: any;
  key?: string | number;
  className?: string;
  constraint?: (props: any) => boolean;
  refConstraint?: (refComponents: (React.Component<any, any> | undefined)[]) => boolean;
  refIndex?: number;
  children?: TutorialManipulationEntry[];
  toolTip?: TutorialToolTip;
  manipulateProps?: (props: any) => any;
  componentAction?: (component: React.Component<any, any>) => void;
  elementAction?: (reactElement: React.ReactElement, htmlElement: HTMLElement) => void;
}

function applyTutorialManipulationEntries(tutorialState: TutorialState, node: React.ReactNode, parentComponent: React.Component<any, any> | undefined, entries: TutorialManipulationEntry[], indent: string = ''): React.ReactNode {
  let visitor = (element: React.ReactElement) => {
    for (let entry of entries) {
      if ((entry.type === undefined || element.type === entry.type)
          && (entry.key === undefined || element.key === entry.key || element.key === entry.key.toString())
          && (entry.className === undefined || element.props.className.split(' ').indexOf(entry.className) >= 0)
          && (entry.constraint === undefined || entry.constraint(element.props))
          && (entry.refConstraint === undefined || (tutorialState.refComponents && entry.refConstraint(tutorialState.refComponents)))) {
        let entryName = '?';
        if (entry.type !== undefined) {
          if (typeof entry.type === 'string') {
            entryName = entry.type;
          } else if (typeof entry.type.name === 'string') {
            entryName = entry.type.name;
          }
        }
        if (entry.key !== undefined) {
          entryName = `${entryName} key="${entry.key}"`;
        }
        console.log(`${indent}Found ${entryName}.`);
        return createTutorialManipulator(tutorialState, parentComponent, entry, indent + '  ');
      }
    }
    return undefined;
  };
  return traverseReactComponents(node, visitor);
}

type NodeManipulationFn = (node: React.ReactNode, component: React.Component<any, any> | undefined) => React.ReactNode;

function createTutorialManipulator(tutorialState: TutorialState, parentComponent: React.Component<any, any> | undefined, entry: TutorialManipulationEntry, indent: string): ReactElementManipulator {
  let applyRef: NodeManipulationFn | undefined = undefined;
  if (entry.refIndex !== undefined) {
    let refIndex = entry.refIndex;
    applyRef = (node: React.ReactNode, component: React.Component<any, any> | undefined) => {
      if (!tutorialState.refComponents) {
        tutorialState.refComponents = [];
      }
      for (let index = tutorialState.refComponents.length; index < refIndex; index++) {
        tutorialState.refComponents.push(undefined);
      }
      tutorialState.refComponents[refIndex] = component;
      return node;
    };
  }

  let traverseChildren = applyRef;
  if (entry.children && entry.children.length) {
    let children = entry.children;
    traverseChildren = (node: React.ReactNode, component: React.Component<any, any> | undefined) => {
      if (applyRef) {
        node = applyRef(node, component);
      }
      return applyTutorialManipulationEntries(tutorialState, node, component ?? parentComponent, children, indent);
    };
  }

  let manipulateContents = traverseChildren;
  let elementAction = entry.elementAction;
  if (entry.toolTip) {
    let toolTip = entry.toolTip;
    let parentNode: HTMLElement | null = null;
    let toolTipParent = {
      getBoundingClientRect(): ClientRect {
        if (parentNode) {
          return parentNode.getBoundingClientRect();
        } else {
          return {
            left: 0,
            right: 0,
            width: 0,
            top: 0,
            bottom: 0,
            height: 0
          };
        }
      }
    };
    manipulateContents = (node: React.ReactNode, component: React.Component<any, any> | undefined) => {
      if (traverseChildren) {
        node = traverseChildren(node, component);
      }
      let toolTipElement: React.ReactNode = null;
      let currentComponent = component ?? parentComponent;
      if (!toolTip.condition || (currentComponent && toolTip.condition(currentComponent))) {
        let getContents = () => {
          if (typeof toolTip.contents === 'function' && typeof (toolTip.contents as any).type === 'undefined') {
            if (currentComponent) {
              return (toolTip.contents as any)(currentComponent);
            } else {
              return null;
            }
          } else {
            return toolTip.contents;
          }
        };
        toolTipElement = <PermanentToolTip active={toolTip.contents !== null} parent={toolTipParent} position={toolTip.position} group={`tutorial-${toolTip.index}`} refreshInterval={100} getContents={getContents} key="tutorial-tooltip"/>;
      }
      let ref = (refNode: HTMLElement | null) => {
        parentNode = refNode;
        if (entry.elementAction && refNode) {
          entry.elementAction(node as any, refNode);
        }
      };
      let outerRef = undefined;
      if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
        let nodeObject: any = node;
        let combinedRef = ref;
        if (nodeObject.ref) {
          combinedRef = (refNode: HTMLElement | null) => {
            ref(refNode);
            return nodeObject.ref(refNode);
          };
        }
        let children = nodeObject.props.children;
        let canAttachToChildren = (typeof nodeObject.type === 'string' && children !== undefined);
        if (canAttachToChildren) {
          if (Array.isArray(children)) {
            children = children.concat(toolTipElement);
          } else {
            children = [children, toolTipElement];
          }
        }
        let newProps = {
          ...nodeObject.props,
          key: nodeObject.key,
          ref: combinedRef,
          children: children
        };
        node = React.createElement(nodeObject.type, newProps);
        if (canAttachToChildren) {
          return node;
        }
      } else {
        outerRef = ref;
      }
      return (
        <span ref={outerRef}>
          {node}
          {toolTipElement}
        </span>
      );
    };
    elementAction = undefined;
  }

  return {
    manipulateProps: entry.manipulateProps,
    manipulateContents: manipulateContents,
    componentAction: entry.componentAction,
    elementAction: elementAction
  };
}

export interface TutorialState {
  manipulationEntries?: TutorialManipulationEntry[];
  refComponents?: (React.Component<any, any> | undefined)[];
}

export function addTutorial(node: React.ReactNode, tutorialState: TutorialState): React.ReactNode {
  if (tutorialState.manipulationEntries) {
    return applyTutorialManipulationEntries(tutorialState, node, undefined, tutorialState.manipulationEntries);
  } else {
    return node;
  }
}
