import * as Logic from '../../shared/logics/logic';
import { LibraryItemInfo } from '../../shared/data/libraryDataAccessor';
import * as React from 'react';

export enum ButtonType {
  OK,
  Save,
  Submit,
  Cancel,
  Edit,
  OpenInVSCode,
  ViewInGitHub,
  ViewSource,
  LogIn,
  LogOut,
  RightArrow,
  DownArrow,
  Insert,
  Remove
}

function getVSCodeLogo(enabled: boolean = true): React.ReactNode {
  return (
    <svg height="1em" width="1em" viewBox="0 0 260 260" key="VSCodeLogo">
      <path d="M 195.47461 -0.005859375 L 195.47461 223.29688 L 0.49609375 194.33789 L 195.47461 259.99219 L 260.47461 232.95312 L 260.47461 31.064453 L 260.49609 31.054688 L 260.47461 31.011719 L 260.47461 27.035156 L 195.47461 -0.005859375 z" fill={enabled ? '#007acc' : 'gray'}/>
      <path d="M 127.24219 38.037109 L 67.521484 97.070312 L 31.566406 69.992188 L 16.748047 74.941406 L 53.328125 111.10156 L 16.748047 147.25977 L 31.566406 152.21094 L 67.521484 125.13086 L 67.523438 125.13086 L 127.24023 184.16016 L 163.00781 168.96289 L 163.00781 53.234375 L 127.24219 38.037109 z M 127.24023 80.158203 L 127.24023 142.03711 L 86.154297 111.09766 L 127.24023 80.158203 z" fill={enabled ? '#007acc' : 'gray'}/>
    </svg>
  );
}

function getGitHubLogo(enabled: boolean = true): React.ReactNode {
  return (
    <svg height="1em" width="1em" viewBox="0 0 16 16" key="GitHubLogo">
      <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" fill={enabled ? 'black' : 'gray'}/>
    </svg>
  );
}

export function getButtonIconContents(buttonType: ButtonType, enabled: boolean = true): React.ReactNodeArray {
  switch (buttonType) {
  case ButtonType.Submit:
    return [
      <path d="M -5 0 L -7 5 L 7 0 L -7 -5 z" fill={'none'} stroke={enabled ? 'green' : 'gray'} strokeWidth="1" key="border"/>,
      <path d="M -5 0 L 7 0" fill={'none'} stroke={enabled ? 'green' : 'gray'} strokeWidth="0.75" key="middle"/>
    ];
  case ButtonType.Edit:
    return [
      <path d="M -7 7 L -6 4 L 5 -7 L 7 -5 L -4 6 z" fill={enabled ? 'red' : 'none'} stroke={enabled ? 'black' : 'gray'} strokeWidth="1" key="shaft"/>,
      <path d="M -6 4 L -4 6" stroke={enabled ? 'black' : 'gray'} strokeWidth="1" key="tip"/>
    ];
  case ButtonType.ViewSource:
    return [
      <path d="M -4 -6 Q -6 -6 -6 -4 L -6 -2 Q -6 0 -8 0 Q -6 0 -6 2 L -6 4 Q -6 6 -4 6" fill={'none'} stroke={enabled ? 'black' : 'gray'} strokeWidth="1" key="left"/>,
      <circle cx="-3" cy="0" r="0.75" fill={enabled ? 'black' : 'gray'} stroke="none" key="dot1"/>,
      <circle cx="0" cy="0" r="0.75" fill={enabled ? 'black' : 'gray'} stroke="none" key="dot2"/>,
      <circle cx="3" cy="0" r="0.75" fill={enabled ? 'black' : 'gray'} stroke="none" key="dot3"/>,
      <path d="M 4 -6 Q 6 -6 6 -4 L 6 -2 Q 6 0 8 0 Q 6 0 6 2 L 6 4 Q 6 6 4 6" fill={'none'} stroke={enabled ? 'black' : 'gray'} strokeWidth="1" key="right"/>
    ];
  case ButtonType.RightArrow:
    return [
      <path d="M -4 -6 L 4 0 L -4 6 z" fill={'none'} stroke={enabled ? 'black' : 'gray'} strokeWidth="1" key="arrow"/>
    ];
  case ButtonType.DownArrow:
    return [
      <path d="M -6 -4 L 0 4 L 6 -4 z" fill={'gray'} stroke={enabled ? 'black' : 'gray'} strokeWidth="1" key="arrow"/>
    ];
  case ButtonType.Insert:
    return [
      <path d="M -1 -7 L 1 -7 L 1 -1 L 7 -1 L 7 1 L 1 1 L 1 7 L -1 7 L -1 1 L -7 1 L -7 -1 L -1 -1 z" fill={enabled ? 'lime' : 'none'} stroke={enabled ? 'darkgreen' : 'gray'} strokeWidth="0.5" key="cross"/>
    ];
  case ButtonType.Remove:
    return [
      <rect x="-7" y="-7" width="14" height="14" rx="2" ry="2" fill={enabled ? 'red' : 'none'} stroke={enabled ? 'maroon' : 'gray'} strokeWidth="0.5" key="frame"/>,
      <line x1="-4" y1="-4" x2="4" y2="4" stroke={enabled ? 'white' : 'gray'} strokeWidth="2" key="cross1"/>,
      <line x1="-4" y1="4" x2="4" y2="-4" stroke={enabled ? 'white' : 'gray'} strokeWidth="2" key="cross2"/>
    ];
  default:
    return [];
  }
}

export function getButtonIcon(buttonType: ButtonType, enabled: boolean = true): React.ReactNode {
  switch (buttonType) {
  case ButtonType.OK:
  case ButtonType.Save:
    return <span className="ok">✓</span>;
  case ButtonType.Cancel:
    return <span className="cancel">✗</span>;
  case ButtonType.OpenInVSCode:
    return getVSCodeLogo(enabled);
  case ButtonType.ViewInGitHub:
    return getGitHubLogo(enabled);
  case ButtonType.LogIn:
    return [
      getGitHubLogo(enabled),
      ' ',
      'Log in'
    ];
  case ButtonType.LogOut:
    return [
      getGitHubLogo(enabled),
      ' ',
      'Log out'
    ];
  default:
    return (
      <svg height="1em" width="1em" viewBox="-8 -8 16 16">
        {getButtonIconContents(buttonType, enabled)}
      </svg>
    );
  }
}

export function getDefinitionIconContents(definitionType: Logic.LogicDefinitionType, itemInfo?: LibraryItemInfo): React.ReactNodeArray {
  switch (definitionType) {
  case Logic.LogicDefinitionType.Construction:
    return [
      <circle cx="0" cy="0" r="7" fill="green" stroke="black" strokeWidth="0.5" key="circle"/>,
      <rect x="-3" y="-3" width="6" height="6" fill="red" stroke="white" strokeWidth="0.5" key="rect"/>
    ];
  case Logic.LogicDefinitionType.SetOperator:
    return [
      <circle cx="0" cy="0" r="7" fill="green" stroke="black" strokeWidth="0.5" key="circle"/>
    ];
  case Logic.LogicDefinitionType.Operator:
  case Logic.LogicDefinitionType.Constructor:
    return [
      <rect x="-4" y="-4" width="8" height="8" fill="red" stroke="black" strokeWidth="0.5" key="rect"/>
    ];
  case Logic.LogicDefinitionType.Predicate:
    return [
      <rect x="-5" y="-5" width="10" height="10" fill="blue" stroke="black" strokeWidth="0.5" transform="rotate(45)" key="rect"/>
    ];
  case Logic.LogicDefinitionType.Theorem:
    let result: React.ReactNodeArray;
    if (itemInfo && (itemInfo.type === 'lemma' || itemInfo.type === 'corollary' || itemInfo.type === 'example')) {
      result = [
        <circle cx="0" cy="-1.5" r="3.5" fill="yellow" stroke="black" strokeWidth="0.5" key="circle"/>,
        <rect x="-1.25" y="2" width="2.5" height="2.5" fill="gray" stroke="black" strokeWidth="0.5" key="rect"/>
      ];
    } else {
      result = [
        <circle cx="0" cy="-2" r="5" fill="yellow" stroke="black" strokeWidth="0.5" key="circle"/>,
        <rect x="-1.7" y="2.7" width="3.4" height="4" fill="gray" stroke="black" strokeWidth="0.5" key="rect"/>
      ];
      if (itemInfo && itemInfo.type === 'theorem') {
        result.unshift(<line x1="-7" y1="-6" x2="7" y2="2" stroke="gray" strokeWidth="0.5" key="line1"/>);
        result.unshift(<line x1="-8" y1="-2" x2="8" y2="-2" stroke="gray" strokeWidth="0.5" key="line2"/>);
        result.unshift(<line x1="-7" y1="2" x2="7" y2="-6" stroke="gray" strokeWidth="0.5" key="line3"/>);
      }
    }
    return result;
  default:
    return [];
  }
}

export function getDefinitionIcon(definitionType: Logic.LogicDefinitionType, itemInfo?: LibraryItemInfo): React.ReactNode {
  return (
    <svg height="1em" width="1em" viewBox="-8 -8 16 16">
      {getDefinitionIconContents(definitionType, itemInfo)}
    </svg>
  );
}

export function getInsertIcon(originalIconContents: React.ReactNodeArray, enabled: boolean = true): React.ReactNode {
  return (
    <svg height="1em" width="1em" viewBox="-8 -8 16 16">
      {originalIconContents}
      <line x1="1" y1="-4" x2="7" y2="-4" stroke="darkgreen" strokeWidth="6" opacity="75%" key="insert-background1"/>
      <line x1="4" y1="-1" x2="4" y2="-7" stroke="darkgreen" strokeWidth="6" opacity="75%" key="insert-background2"/>
      <line x1="2" y1="-2" x2="6" y2="-6" stroke="darkgreen" strokeWidth="6" opacity="75%" key="insert-background3"/>
      <line x1="2" y1="-6" x2="6" y2="-2" stroke="darkgreen" strokeWidth="6" opacity="75%" key="insert-background4"/>
      <line x1="1" y1="-4" x2="7" y2="-4" stroke={enabled ? 'lime' : 'gray'} strokeWidth="1" key="insert-line1"/>
      <line x1="4" y1="-1" x2="4" y2="-7" stroke={enabled ? 'lime' : 'gray'} strokeWidth="1" key="insert-line2"/>
      <line x1="2" y1="-2" x2="6" y2="-6" stroke={enabled ? 'lime' : 'gray'} strokeWidth="1" key="insert-line3"/>
      <line x1="2" y1="-6" x2="6" y2="-2" stroke={enabled ? 'lime' : 'gray'} strokeWidth="1" key="insert-line4"/>
    </svg>
  );
}
