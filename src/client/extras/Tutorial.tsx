import * as React from 'react';
import { ReactElementManipulator, traverseReactComponents } from '../utils/traverse';
import { PermanentToolTip, ToolTipPosition } from '../components/ExpressionToolTip';

export interface TutorialToolTip {
  contents: React.ReactNode;
  position: ToolTipPosition;
  index: number;
}

export interface TutorialManipulationEntry {
  type?: any;
  key?: any;
  constraint?: (props: any) => boolean;
  children?: TutorialManipulationEntry[];
  toolTip?: TutorialToolTip;
  manipulateProps?: (props: any) => any;
  componentAction?: (component: React.Component<any, any>) => void;
  elementAction?: (reactElement: React.ReactElement, htmlElement: HTMLElement) => void;
}

type NodeManipulationFn = (node: React.ReactNode) => React.ReactNode;

function applyTutorialManipulationEntries(node: React.ReactNode, entries: TutorialManipulationEntry[], indent: string = ''): React.ReactNode {
  let visitor = (element: React.ReactElement) => {
    for (let entry of entries) {
      if ((entry.type === undefined || element.type === entry.type)
          && (entry.key === undefined || element.key === entry.key || element.key === entry.key.toString())
          && (entry.constraint === undefined || entry.constraint(element.props))) {
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
        return createTutorialManipulator(entry, indent + '  ');
      }
    }
    return undefined;
  };
  return traverseReactComponents(node, visitor);
}

function createTutorialManipulator(entry: TutorialManipulationEntry, indent: string): ReactElementManipulator {
  let traverseChildren: NodeManipulationFn | undefined = undefined;
  if (entry.children && entry.children.length) {
    let children = entry.children;
    traverseChildren = (node: React.ReactNode) => applyTutorialManipulationEntries(node, children, indent);
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
    manipulateContents = (node: React.ReactNode) => {
      if (traverseChildren) {
        node = traverseChildren(node);
      }
      let toolTipElement = <PermanentToolTip active={toolTip.contents !== null} parent={toolTipParent} position={toolTip.position} group={`tutorial-${toolTip.index}`} refreshInterval={100} getContents={() => toolTip.contents} key="tutorial-tooltip"/>;
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
  manipulationEntries: TutorialManipulationEntry[];
}

export function addTutorial(node: React.ReactNode, tutorialState: TutorialState): React.ReactNode {
  return applyTutorialManipulationEntries(node, tutorialState.manipulationEntries);
}
