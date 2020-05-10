import * as React from 'react';
import './TutorialContents.css';
import { TutorialState } from './Tutorial';
import { ButtonType, getButtonIcon } from '../utils/icons';
import config from '../utils/config';

import * as Fmt from '../../shared/format/format';
import * as FmtHLM from '../../shared/logics/hlm/meta';
import * as Logic from '../../shared/logics/logic';
import * as Menu from '../../shared/display/menu';

import StartPage from './StartPage';
import Button from '../components/Button';
import MenuButton from '../components/MenuButton';
import LibraryTree, { SearchInput, InnerLibraryTreeItems, LibraryTreeItem, LibraryTreeInsertionItem } from '../components/LibraryTree';
import StandardDialog from '../components/StandardDialog';
import InsertDialog from '../components/InsertDialog';
import LibraryItem from '../components/LibraryItem';
import Expression from '../components/Expression';
import ExpressionMenu, { ExpressionMenuRow, ExpressionMenuItem } from '../components/ExpressionMenu';
import ExpressionDialog, { ExpressionDialogItem } from '../components/ExpressionDialog';

type TutorialStateFn = (newTutorialState: TutorialState | undefined) => void;

function inject(fn: (...args: any) => any, action: (...args: any) => void) {
  return (...args: any) => {
    let result = fn(...args);
    action(...args);
    return result;
  };
}

function createContentConstraint(constraint: (definition: Fmt.Definition) => boolean): (props: any) => boolean {
  return (props) => constraint(props.definition.definition);
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

  private automateClick(delay: number = 200) {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done) {
        done = true;
        while (reactElement.props && reactElement.props.children && !reactElement.props.onMouseDown && !reactElement.props.onMouseUp && !reactElement.props.onClick) {
          if (Array.isArray(reactElement.props.children)) {
            if (reactElement.props.children.length) {
              reactElement = reactElement.props.children[0];
            } else {
              break;
            }
          } else {
            reactElement = reactElement.props.children;
          }
        }
        if (reactElement.props) {
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
          setTimeout(simulateClick, delay);
        }
      }
    };
  }

  private automateTextInput(text: string, delay: number = 200) {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done && htmlElement instanceof HTMLInputElement) {
        done = true;
        let simulateTextInput = () => {
          htmlElement.value = text;
          reactElement.props.onChange(createDummyEvent(htmlElement));
        };
        setTimeout(simulateTextInput, delay);
      }
    };
  }

  // Introduction.

  introduction: TutorialState = {
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
                    <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.searchFunctions_enterSearchText)}>
                      {getButtonIcon(ButtonType.OK)} Start
                    </Button>
                    {config.development ? (
                       <Button className={'tutorial-tooltip-button standalone'} onClick={() => { this.runAutomatically = true; this.changeState(this.searchFunctions_enterSearchText); }}>
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

  // Search for "Functions".

  searchFunctions_enterSearchText: TutorialState = {
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
              onSearch: inject(props.onSearch, () => this.changeState(this.searchFunctions_openEssentials))
            }),
            elementAction: this.automateTextInput('functions')
          }
        ]
      }
    ]
  };

  searchFunctions_openEssentials: TutorialState = {
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
                    this.changeState(this.searchFunctions_openFunctions);
                  }
                }
              }
            ]
          }
        ]
      }
    ]
  };

  searchFunctions_openFunctions: TutorialState = {
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
                            this.changeState(this.insertOperator_openInsertMenu);
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

  insertOperator_openInsertMenu: TutorialState = {
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
                                        this.changeState(this.insertOperator_menu_newOperator);
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

  // Insert operator.

  insertOperator_menu_newOperator: TutorialState = {
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
                                          onClick: inject(props.onClick, () => this.changeState(this.insertOperator_dialog_enterName))
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

  insertOperator_dialog_enterName: TutorialState = {
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
            this.changeState(this.insertOperator_dialog_ok);
          }
        }
      }
    ]
  };

  insertOperator_dialog_ok: TutorialState = {
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
          onOK: inject(props.onOK, () => this.changeState(this.insertOperatorParameters_ST_openInsertMenu))
        })
      }
    ]
  };

  // Insert parameters S and T.

  insertOperatorParameters_ST_openInsertMenu: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 0)),
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
                            this.changeState(this.insertOperatorParameters_ST_menu_set);
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

  insertOperatorParameters_ST_menu_set: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 0)),
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
                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_ST_enterNames))
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

  insertOperatorParameters_ST_enterNames: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 1
                                                             && definition.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Set)),
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
                                elementAction: this.automateTextInput('S,')
                              }
                            ],
                            toolTip: {
                              contents: <p>Type "S,T" to insert two parameters at once.</p>,
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
          if (definition.parameters.length >= 2) {
            this.changeState(this.insertOperatorParameters_f_openInsertMenu);
          }
        })
      }
    ]
  };

  // Insert parameter f.

  insertOperatorParameters_f_openInsertMenu: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 2
                                                             && definition.parameters[0].name === 'S'
                                                             && definition.parameters[1].name === 'T')),
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
                                this.changeState(this.insertOperatorParameters_f_menu_element);
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

  insertOperatorParameters_f_menu_element: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 2)),
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
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_f_enterName))
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

  insertOperatorParameters_f_enterName: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
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
                                type: Expression,
                                key: 0,
                                children: [
                                  {
                                    type: 'input',
                                    elementAction: this.automateTextInput('f')
                                  }
                                ],
                                toolTip: {
                                  contents: <p>Name this parameter "f".</p>,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[2].name === 'f') {
            this.changeState(this.insertOperatorParameters_f_set_openPlaceholderMenu);
          }
        })
      }
    ]
  };

  insertOperatorParameters_f_set_openPlaceholderMenu: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
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
                                // Keep tooltip at name input; otherwise the name input will be recreated while typing.
                                type: Expression,
                                key: 0,
                                toolTip: {
                                  contents: null,
                                  position: 'bottom',
                                  index: 0
                                }
                              },
                              {
                                type: Expression,
                                key: 4,
                                toolTip: {
                                  contents: <p>We need to fill this placeholder.</p>,
                                  position: 'bottom',
                                  index: 1
                                },
                                componentAction: (component) => {
                                  if (component.state.openMenu) {
                                    this.changeState(this.insertOperatorParameters_f_set_menu_definition);
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
  };

  insertOperatorParameters_f_set_menu_definition: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3)),
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 2,
                                        children: [
                                          {
                                            type: 'div',
                                            key: 'title',
                                            toolTip: {
                                              contents: <p>Click here to select a definition from the library.</p>,
                                              position: 'left',
                                              index: 1
                                            },
                                            elementAction: this.automateClick()
                                          }
                                        ],
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, (action: Menu.ExpressionMenuAction) => {
                                            this.changeState(action instanceof Menu.DialogExpressionMenuAction
                                                              ? this.insertOperatorParameters_f_set_dialog_selectFunctions
                                                              : this.insertOperatorParameters_f_set_arg_S);
                                          })
                                        })
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

  insertOperatorParameters_f_set_dialog_selectFunctions: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3)),
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: ExpressionDialogItem,
                                        key: 0,
                                        children: [
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
                                                                    type: LibraryTreeItem,
                                                                    key: 'Functions',
                                                                    children: [
                                                                      {
                                                                        key: 'item',
                                                                        children: [
                                                                          {
                                                                            key: 'display-span',
                                                                            toolTip: {
                                                                              contents: <p>Click here to select the set of functions.</p>,
                                                                              position: 'right',
                                                                              index: 1
                                                                            }
                                                                          }
                                                                        ],
                                                                        elementAction: this.automateClick()
                                                                      }
                                                                    ],
                                                                    componentAction: (component) => {
                                                                      if (component.props.selected) {
                                                                        this.changeState(this.insertOperatorParameters_f_set_dialog_ok);
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
                                              }
                                            ],
                                            toolTip: {
                                              contents: <p>This tree shows only the definitions in the library that can be used at the given location.</p>,
                                              position: 'top',
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

  insertOperatorParameters_f_set_dialog_ok: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3)),
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: StandardDialog,
                                        children: [
                                          {
                                            type: Button,
                                            key: 'ok',
                                            toolTip: {
                                              contents: <p>Click here.</p>,
                                              position: 'top',
                                              index: 0
                                            },
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onClick: inject(props.onClick, () => this.changeState(this.insertOperatorParameters_f_set_arg_S))
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
      }
    ]
  };

  insertOperatorParameters_f_set_arg_S: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[2].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[2].type.expression._set.path.name === 'Functions')),
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    toolTip: {
                                      contents: <p>Select S here.</p>,
                                      position: 'bottom',
                                      index: 0
                                    },
                                    componentAction: (component) => {
                                      if (component.state.openMenu) {
                                        this.changeState(this.insertOperatorParameters_f_set_arg_S_menu_variable);
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

  insertOperatorParameters_f_set_arg_S_menu_variable: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[2].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[2].type.expression._set.path.name === 'Functions')),
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    children: [
                                      {
                                        type: ExpressionMenu,
                                        children: [
                                          {
                                            type: ExpressionMenuRow,
                                            key: 0,
                                            children: [
                                              {
                                                type: ExpressionMenuRow,
                                                children: [
                                                  {
                                                    type: ExpressionMenuItem,
                                                    key: 0,
                                                    manipulateProps: (props) => ({
                                                      ...props,
                                                      onItemClicked: inject(props.onItemClicked, () => {
                                                        this.changeState(this.insertOperatorParameters_f_set_arg_T);
                                                      })
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
              }
            ]
          }
        ]
      }
    ]
  };

  insertOperatorParameters_f_set_arg_T: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[2].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[2].type.expression._set.path.name === 'Functions')),
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: Expression,
                                    key: 4,
                                    toolTip: {
                                      contents: <p>Select T here.</p>,
                                      position: 'bottom',
                                      index: 0
                                    },
                                    componentAction: (component) => {
                                      if (component.state.openMenu) {
                                        this.changeState(this.insertOperatorParameters_f_set_arg_T_menu_variable);
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

  insertOperatorParameters_f_set_arg_T_menu_variable: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[2].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[2].type.expression._set.path.name === 'Functions')),
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: Expression,
                                    key: 4,
                                    children: [
                                      {
                                        type: ExpressionMenu,
                                        children: [
                                          {
                                            type: ExpressionMenuRow,
                                            key: 0,
                                            children: [
                                              {
                                                type: ExpressionMenuRow,
                                                children: [
                                                  {
                                                    type: ExpressionMenuItem,
                                                    key: 1,
                                                    manipulateProps: (props) => ({
                                                      ...props,
                                                      onItemClicked: inject(props.onItemClicked, () => {
                                                        this.changeState(this.insertOperatorParameters_n_openInsertMenu);
                                                      })
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
              }
            ]
          }
        ]
      }
    ]
  };

  // Insert parameter n.

  insertOperatorParameters_n_openInsertMenu: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3)),
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
                            key: 9,
                            toolTip: {
                              contents: <p>Our last parameter will be a natural number.</p>,
                              position: 'bottom',
                              index: 0
                            },
                            componentAction: (component) => {
                              if (component.state.openMenu) {
                                this.changeState(this.insertOperatorParameters_n_menu_element);
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

  insertOperatorParameters_n_menu_element: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3)),
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
                            key: 9,
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
                                          contents: <p>Click here.</p>,
                                          position: 'right',
                                          index: 1
                                        },
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_n_enterName))
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

  insertOperatorParameters_n_enterName: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4
                                                             && definition.parameters[3].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
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
                            key: 9,
                            children: [
                              {
                                type: Expression,
                                key: 0,
                                children: [
                                  {
                                    type: 'input',
                                    elementAction: this.automateTextInput('n')
                                  }
                                ],
                                toolTip: {
                                  contents: <p>Name this parameter "n".</p>,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[3].name === 'n') {
            this.changeState(this.insertOperatorParameters_n_set_openPlaceholderMenu);
          }
        })
      }
    ]
  };

  insertOperatorParameters_n_set_openPlaceholderMenu: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4
                                                             && definition.parameters[3].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
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
                            key: 9,
                            children: [
                              {
                                // Keep tooltip at name input; otherwise the name input will be recreated while typing.
                                type: Expression,
                                key: 0,
                                toolTip: {
                                  contents: null,
                                  position: 'bottom',
                                  index: 0
                                }
                              },
                              {
                                type: Expression,
                                key: 4,
                                toolTip: {
                                  contents: <p>Click here.</p>,
                                  position: 'bottom',
                                  index: 1
                                },
                                componentAction: (component) => {
                                  if (component.state.openMenu) {
                                    this.changeState(this.insertOperatorParameters_n_set_menu_definition);
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
  };

  insertOperatorParameters_n_set_menu_definition: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4)),
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
                            key: 9,
                            children: [
                              {
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 2,
                                        children: [
                                          {
                                            type: 'div',
                                            key: 'title',
                                            toolTip: {
                                              contents: <p>Click here to search for the set of natural numbers.</p>,
                                              position: 'left',
                                              index: 1
                                            },
                                            elementAction: this.automateClick()
                                          }
                                        ],
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_n_set_dialog_searchNaturalNumbers))
                                        })
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

  insertOperatorParameters_n_set_dialog_searchNaturalNumbers: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4)),
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
                            key: 9,
                            children: [
                              {
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: ExpressionDialogItem,
                                        key: 0,
                                        children: [
                                          {
                                            type: LibraryTree,
                                            children: [
                                              {
                                                type: SearchInput,
                                                toolTip: {
                                                  contents: <p>Type "natural numbers" here, which will further filter the tree.</p>,
                                                  position: 'bottom',
                                                  index: 0
                                                },
                                                manipulateProps: (props) => ({
                                                  ...props,
                                                  onSearch: inject(props.onSearch, () => this.changeState(this.insertOperatorParameters_n_set_dialog_selectNaturalNumbers))
                                                }),
                                                elementAction: this.automateTextInput('natural numbers')
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
          }
        ]
      }
    ]
  };

  insertOperatorParameters_n_set_dialog_selectNaturalNumbers: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4)),
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
                            key: 9,
                            children: [
                              {
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: ExpressionDialogItem,
                                        key: 0,
                                        children: [
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
                                                            key: 'Numbers',
                                                            children: [
                                                              {
                                                                type: InnerLibraryTreeItems,
                                                                children: [
                                                                  {
                                                                    type: LibraryTreeItem,
                                                                    key: 'Natural',
                                                                    children: [
                                                                      {
                                                                        type: InnerLibraryTreeItems,
                                                                        children: [
                                                                          {
                                                                            type: LibraryTreeItem,
                                                                            key: 'Natural numbers',
                                                                            children: [
                                                                              {
                                                                                key: 'item',
                                                                                children: [
                                                                                  {
                                                                                    key: 'display-span',
                                                                                    toolTip: {
                                                                                      contents: <p>Click here to select the set of natural numbers.</p>,
                                                                                      position: 'right',
                                                                                      index: 1
                                                                                    }
                                                                                  }
                                                                                ],
                                                                                elementAction: this.automateClick()
                                                                              }
                                                                            ],
                                                                            componentAction: (component) => {
                                                                              if (component.props.selected) {
                                                                                this.changeState(this.insertOperatorParameters_n_set_dialog_ok);
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
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  insertOperatorParameters_n_set_dialog_ok: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4)),
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
                            key: 9,
                            children: [
                              {
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: StandardDialog,
                                        children: [
                                          {
                                            type: Button,
                                            key: 'ok',
                                            toolTip: {
                                              contents: <p>Click here.</p>,
                                              position: 'top',
                                              index: 0
                                            },
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onClick: inject(props.onClick, () => this.changeState(this.fillOperatorDefinition_composition_openPlaceholderMenu))
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
      }
    ]
  };

  // Insert composition term.

  fillOperatorDefinition_composition_openPlaceholderMenu: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                toolTip: {
                                  contents: <p>Now we need to fill our new definition.<br/>In general, expressions in Slate are entered hierarchically. So we need to think about the outermost symbol, which in our case will be function composition.</p>,
                                  position: 'bottom',
                                  index: 0
                                },
                                componentAction: (component) => {
                                  if (component.state.openMenu) {
                                    this.changeState(this.fillOperatorDefinition_composition_menu_definition);
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
  };

  fillOperatorDefinition_composition_menu_definition: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 2,
                                        children: [
                                          {
                                            type: 'div',
                                            key: 'title',
                                            toolTip: {
                                              contents: <p>Click here to search for the definition of function composition.</p>,
                                              position: 'left',
                                              index: 1
                                            },
                                            elementAction: this.automateClick()
                                          }
                                        ],
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillOperatorDefinition_composition_dialog_searchFunctionComposition))
                                        })
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

  fillOperatorDefinition_composition_dialog_searchFunctionComposition: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: ExpressionDialogItem,
                                        key: 0,
                                        children: [
                                          {
                                            type: LibraryTree,
                                            children: [
                                              {
                                                type: SearchInput,
                                                toolTip: {
                                                  contents: <p>Type "composition".</p>,
                                                  position: 'bottom',
                                                  index: 0
                                                },
                                                manipulateProps: (props) => ({
                                                  ...props,
                                                  onSearch: inject(props.onSearch, () => this.changeState(this.fillOperatorDefinition_composition_dialog_selectFunctionComposition))
                                                }),
                                                elementAction: this.automateTextInput('composition')
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
          }
        ]
      }
    ]
  };

  fillOperatorDefinition_composition_dialog_selectFunctionComposition: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: ExpressionDialogItem,
                                        key: 0,
                                        children: [
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
                                                                type: InnerLibraryTreeItems,
                                                                children: [
                                                                  {
                                                                    type: LibraryTreeItem,
                                                                    key: 'composition',
                                                                    children: [
                                                                      {
                                                                        key: 'item',
                                                                        children: [
                                                                          {
                                                                            key: 'display-span',
                                                                            toolTip: {
                                                                              contents: <p>Click here.<br/>If you are unsure whether a given item is the correct one, you can hover over it to see its definition.<br/>Moreover, you can browse the library at any time without losing your unsubmitted input.</p>,
                                                                              position: 'right',
                                                                              index: 1
                                                                            }
                                                                          }
                                                                        ],
                                                                        elementAction: this.automateClick()
                                                                      }
                                                                    ],
                                                                    componentAction: (component) => {
                                                                      if (component.props.selected) {
                                                                        this.changeState(this.fillOperatorDefinition_composition_dialog_ok);
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
          }
        ]
      }
    ]
  };

  fillOperatorDefinition_composition_dialog_ok: TutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: ExpressionDialog,
                                    children: [
                                      {
                                        type: StandardDialog,
                                        children: [
                                          {
                                            type: Button,
                                            key: 'ok',
                                            toolTip: {
                                              contents: <p>Click here.</p>,
                                              position: 'top',
                                              index: 0
                                            },
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onClick: inject(props.onClick, () => this.changeState(this.tutorialCompleted))
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
      }
    ]
  };

  // The end.

  tutorialCompleted: TutorialState = {
    manipulationEntries: [
      {
        type: 'div',
        key: 'toolbar',
        toolTip: {
          contents: (
            <div className={'large-tooltip'}>
              <p>Thank you for following the tutorial.</p>
              <p>As you have seen, Slate is designed to be learned intuitively, by exploring the user interface. As a next step, we recommend taking a look at the contents of the library and making small contributions.</p>
              <p>If you would like to experiment a little without submitting your changes, you can continue in tutorial mode for a while.</p>
              <p>Note that since the user interface is not finished yet, not everything will work as expected. As a workaround, you may want to switch to the <a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate" target="_blank">Visual Studio Code extension</a>.</p>
              <div className={'tutorial-tooltip-button-row'}>
                <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.experiment)}>
                  Continue in tutorial mode
                </Button>
                <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(undefined)}>
                  {getButtonIcon(ButtonType.Close)} Exit tutorial
                </Button>
              </div>
            </div>
          ),
          position: 'top',
          index: 0
        }
      }
    ]
  };

  experiment: TutorialState = {
    manipulationEntries: []
  };
}

export function startTutorial(onChangeTutorialState: TutorialStateFn, withTouchWarning: boolean): void {
  let tutorialStates = new TutorialStates(onChangeTutorialState, withTouchWarning);
  onChangeTutorialState(tutorialStates.introduction);
}
