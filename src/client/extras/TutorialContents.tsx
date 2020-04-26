import * as React from 'react';
import './TutorialContents.css';
import { TutorialState } from './Tutorial';
import { ButtonType, getButtonIcon } from '../utils/icons';
import config from '../utils/config';

import * as Fmt from '../../shared/format/format';
import * as Logic from '../../shared/logics/logic';

import StartPage from './StartPage';
import Button from '../components/Button';
import MenuButton from '../components/MenuButton';
import LibraryTree, { SearchInput, InnerLibraryTreeItems, LibraryTreeItem, LibraryTreeInsertionItem } from '../components/LibraryTree';
import StandardDialog from '../components/StandardDialog';
import InsertDialog from '../components/InsertDialog';
import LibraryItem from '../components/LibraryItem';
import Expression from '../components/Expression';
import ExpressionMenu, { ExpressionMenuRow, ExpressionMenuItem } from '../components/ExpressionMenu';

type TutorialStateFn = (newTutorialState: TutorialState | undefined) => void;

function inject(fn: (...args: any) => any, action: () => void) {
  return (...args: any) => {
    action();
    return fn(...args);
  };
}

function createContentAction(action: (definition: Fmt.Definition) => void): (component: React.Component<any, any>) => void {
  return (component) => action(component.props.definition.definition);
}

function createDummyEvent(target: HTMLElement) {
  return {
    target: target,
    button: 0,
    stopPropagation() {},
    preventDefault() {}
  };
}

class TutorialStates {
  constructor(private changeState: TutorialStateFn, private withTouchWarning: boolean, private runAutomatically: boolean = false) {}

  private automateClick() {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done) {
        done = true;
        while (reactElement.props.children && reactElement.props.children.length && !reactElement.props.onMouseDown && !reactElement.props.onMouseUp && !reactElement.props.onClick) {
          reactElement = reactElement.props.children[0];
        }
        let simulateClick = () => {
          if (reactElement.props.onMouseDown) {
            let mouseDownEvent = createDummyEvent(htmlElement);
            reactElement.props.onMouseDown(mouseDownEvent);
          }
          if (reactElement.props.onMouseUp) {
            let mouseUpEvent = createDummyEvent(htmlElement);
            reactElement.props.onMouseUp(mouseUpEvent);
          }
          if (reactElement.props.onClick) {
            let clickEvent = createDummyEvent(htmlElement);
            reactElement.props.onClick(clickEvent);
          }
        };
        setTimeout(simulateClick, 200);
      }
    };
  }

  private automateTextInput(text: string) {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done && htmlElement instanceof HTMLInputElement) {
        done = true;
        let simulateTextInput = () => {
          htmlElement.value = text;
          reactElement.props.onChange(createDummyEvent(htmlElement));
        };
        setTimeout(simulateTextInput, 200);
      }
    };
  }

  initialState: TutorialState = {
    manipulationEntries: [
      {
        type: StartPage,
        children: [
          {
            type: Button,
            key: 'tutorial-button',
            toolTip: {
              contents: (
                <div className={'large-tooltip'}>
                  <p>Welcome to the interactive tutorial.</p>
                  <p>We are going to</p>
                  <ul>
                    <li>enter a mathematical definition,</li>
                    <li>state a theorem about that definition, and</li>
                    <li>prove that theorem (<em>coming soon, stay tuned</em>).</li>
                  </ul>
                  <p>No prior experience with interactive theorem proving is required.</p>
                  {this.withTouchWarning ? <p><strong>Note:</strong> Using a mouse is recommended (though not required) because editing possibilities are easier to discover using hover effects.</p> : null}
                  <div className={'tutorial-tooltip-button-row'}>
                    <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.searchFunctionsState1)}>
                      {getButtonIcon(ButtonType.OK)} Start
                    </Button>
                    {config.development ? (
                       <Button className={'tutorial-tooltip-button standalone'} onClick={() => { this.runAutomatically = true; this.changeState(this.searchFunctionsState1); }}>
                         {getButtonIcon(ButtonType.Submit)} Run automatically
                       </Button>
                     ) : null}
                    <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(undefined)}>
                      {getButtonIcon(ButtonType.Cancel)} Cancel
                    </Button>
                  </div>
                </div>
              ),
              position: 'bottom',
              index: 0
            }
          }
        ]
      }
    ]
  };

  searchFunctionsState1: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryTree,
        children: [
          {
            type: SearchInput,
            toolTip: {
              contents: <p>Our definition and theorem will be about functions, so type "functions" here to search for a good place to add them.</p>,
              position: 'bottom',
              index: 0
            },
            manipulateProps: (props) => ({
              ...props,
              onSearch: inject(props.onSearch, () => this.changeState(this.searchFunctionsState2))
            }),
            elementAction: this.automateTextInput('functions')
          }
        ]
      }
    ]
  };

  searchFunctionsState2: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryTree,
        children: [
          {
            // Keep tooltip at search input; otherwise the search input will be recreated while typing.
            type: SearchInput,
            toolTip: {
              contents: null,
              position: 'bottom',
              index: 0
            }
          },
          {
            type: InnerLibraryTreeItems,
            children: [
              {
                type: LibraryTreeItem,
                key: 'Essentials',
                children: [
                  {
                    key: 'display-span',
                    toolTip: {
                      contents: <p>Look in here.</p>,
                      position: 'right',
                      index: 1
                    }
                  }
                ],
                componentAction: (component) => {
                  if (component.state.opened) {
                    this.changeState(this.searchFunctionsState3);
                  }
                }
              }
            ]
          }
        ]
      }
    ]
  };

  searchFunctionsState3: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryTree,
        children: [
          {
            // Keep tooltip at search input; otherwise the search input will be recreated while typing.
            type: SearchInput,
            toolTip: {
              contents: null,
              position: 'bottom',
              index: 0
            }
          },
          {
            type: InnerLibraryTreeItems,
            children: [
              {
                type: LibraryTreeItem,
                key: 'Essentials',
                children: [
                  {
                    type: InnerLibraryTreeItems,
                    children: [
                      {
                        type: LibraryTreeItem,
                        key: 'Functions',
                        children: [
                          {
                            key: 'display-span',
                            toolTip: {
                              contents: <p>This is the section we are looking for.</p>,
                              position: 'right',
                              index: 1
                            }
                          }
                        ],
                        componentAction: (component) => {
                          if (component.state.opened) {
                            this.changeState(this.searchFunctionsState4);
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  searchFunctionsState4: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryTree,
        children: [
          {
            // Keep tooltip at search input; otherwise the search input will be recreated while typing.
            type: SearchInput,
            toolTip: {
              contents: null,
              position: 'bottom',
              index: 0
            }
          },
          {
            type: InnerLibraryTreeItems,
            children: [
              {
                type: LibraryTreeItem,
                key: 'Essentials',
                children: [
                  {
                    type: InnerLibraryTreeItems,
                    children: [
                      {
                        type: LibraryTreeItem,
                        key: 'Functions',
                        children: [
                          {
                            key: 'display-span',
                            toolTip: {
                              contents: <p>This is the section we are looking for.<br/>Scroll down.</p>,
                              position: 'right',
                              index: 1
                            }
                          },
                          {
                            type: InnerLibraryTreeItems,
                            children: [
                              {
                                type: LibraryTreeInsertionItem,
                                children: [
                                  {
                                    type: MenuButton,
                                    key: 'insert-button',
                                    toolTip: {
                                      contents: <p>Click here to insert a new item.</p>,
                                      position: 'right',
                                      index: 2
                                    },
                                    componentAction: (component) => {
                                      if (component.state.menuOpen) {
                                        this.changeState(this.insertOperatorState);
                                      }
                                    },
                                    elementAction: this.automateClick()
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  insertOperatorState: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryTree,
        children: [
          {
            type: InnerLibraryTreeItems,
            children: [
              {
                type: LibraryTreeItem,
                key: 'Essentials',
                children: [
                  {
                    type: InnerLibraryTreeItems,
                    children: [
                      {
                        type: LibraryTreeItem,
                        key: 'Functions',
                        children: [
                          {
                            type: InnerLibraryTreeItems,
                            children: [
                              {
                                type: LibraryTreeInsertionItem,
                                children: [
                                  {
                                    type: MenuButton,
                                    key: 'insert-button',
                                    children: [
                                      {
                                        type: Button,
                                        key: Logic.LogicDefinitionType.Operator,
                                        toolTip: {
                                          contents: <p>We want to insert an operator, which is a certain kind of definition.</p>,
                                          position: 'right',
                                          index: 2
                                        },
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onClick: inject(props.onClick, () => this.changeState(this.insertOperatorDialogState))
                                        }),
                                        elementAction: this.automateClick()
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  insertOperatorDialogState: TutorialState = {
    manipulationEntries: [
      {
        // Keep previous library tree hierarchy so that library tree is not rebuilt.
        type: LibraryTree,
        children: [
          {
            type: InnerLibraryTreeItems,
            children: [
              {
                type: LibraryTreeItem,
                key: 'Essentials',
                children: [
                  {
                    type: InnerLibraryTreeItems,
                    children: [
                      {
                        type: LibraryTreeItem,
                        key: 'Functions'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: InsertDialog,
        children: [
          {
            type: StandardDialog,
            children: [
              {
                type: 'input',
                key: 'name',
                toolTip: {
                  contents: <p>Enter a name like "my definition".<br/>Among other things, this will be the file name of the new item, so only certain characters are allowed.<br/>Moreover, the naming convention for operators requires the name to start with a lowercase letter.</p>,
                  position: 'top',
                  index: 0
                },
                elementAction: this.automateTextInput('my definition')
              }
            ]
          }
        ],
        componentAction: (component) => {
          if (component.state.name) {
            this.changeState(this.closeInsertOperatorDialogState);
          }
        }
      }
    ]
  };

  closeInsertOperatorDialogState: TutorialState = {
    manipulationEntries: [
      {
        // Keep previous library tree hierarchy so that library tree is not rebuilt.
        type: LibraryTree,
        children: [
          {
            type: InnerLibraryTreeItems,
            children: [
              {
                type: LibraryTreeItem,
                key: 'Essentials',
                children: [
                  {
                    type: InnerLibraryTreeItems,
                    children: [
                      {
                        type: LibraryTreeItem,
                        key: 'Functions'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: InsertDialog,
        children: [
          {
            type: StandardDialog,
            children: [
              {
                // Keep tooltip at name input; otherwise the name input will be recreated while typing.
                type: 'input',
                key: 'name',
                toolTip: {
                  contents: null,
                  position: 'top',
                  index: 0
                }
              },
              {
                type: Button,
                key: 'ok',
                elementAction: this.automateClick()
              }
            ]
          }
        ],
        manipulateProps: (props) => ({
          ...props,
          onOK: inject(props.onOK, () => this.changeState(this.insertSetParameterState1))
        })
      }
    ]
  };

  insertSetParameterState1: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 0,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 2,
                        toolTip: {
                          contents: <p>Most definitions require parameters. Click here to add one.</p>,
                          position: 'bottom',
                          index: 0
                        },
                        componentAction: (component) => {
                          if (component.state.openMenu) {
                            this.changeState(this.insertSetParameterState2);
                          }
                        },
                        elementAction: this.automateClick()
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  insertSetParameterState2: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 0,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 2,
                        children: [
                          {
                            type: ExpressionMenu,
                            children: [
                              {
                                type: ExpressionMenuRow,
                                key: 2,
                                children: [
                                  {
                                    type: ExpressionMenuItem,
                                    toolTip: {
                                      contents: <p>Our definition will deal with functions between two arbitrary sets, so pick this item.</p>,
                                      position: 'right',
                                      index: 0
                                    },
                                    manipulateProps: (props) => ({
                                      ...props,
                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.nameSetParametersState))
                                    }),
                                    elementAction: this.automateClick()
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  nameSetParametersState: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 0,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 2,
                        children: [
                          {
                            type: Expression,
                            key: 1,
                            children: [
                              {
                                type: 'input',
                                elementAction: this.automateTextInput('X,')
                              }
                            ],
                            toolTip: {
                              contents: <p>Type "X,Y" to insert two parameters at once.</p>,
                              position: 'bottom',
                              index: 0
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters.length === 2) {
            this.changeState(this.insertFunctionParameterState1);
          }
        })
      }
    ]
  };

  insertFunctionParameterState1: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 0,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 2,
                        children: [
                          {
                            // Keep tooltip at name input; otherwise the name input will be recreated while typing.
                            type: Expression,
                            key: 1,
                            toolTip: {
                              contents: null,
                              position: 'bottom',
                              index: 0
                            }
                          },
                          {
                            type: Expression,
                            key: 5,
                            toolTip: {
                              contents: <p>Add another parameter, which will be a function between these two sets.</p>,
                              position: 'bottom',
                              index: 1
                            },
                            componentAction: (component) => {
                              if (component.state.openMenu) {
                                this.changeState(this.insertFunctionParameterState2);
                              }
                            },
                            elementAction: this.automateClick()
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  insertFunctionParameterState2: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 0,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 2,
                        children: [
                          {
                            type: Expression,
                            key: 5,
                            children: [
                              {
                                type: ExpressionMenu,
                                children: [
                                  {
                                    type: ExpressionMenuRow,
                                    key: 0,
                                    children: [
                                      {
                                        type: ExpressionMenuItem,
                                        toolTip: {
                                          contents: <p>The set of functions between two set is a definition in the library. Therefore, pick this item.</p>,
                                          position: 'right',
                                          index: 1
                                        },
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(undefined))
                                        }),
                                        elementAction: this.automateClick()
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

export function startTutorial(onChangeTutorialState: TutorialStateFn, withTouchWarning: boolean): void {
  let tutorialStates = new TutorialStates(onChangeTutorialState, withTouchWarning);
  onChangeTutorialState(tutorialStates.initialState);
}
