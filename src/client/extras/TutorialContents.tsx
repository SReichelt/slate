import * as React from 'react';
import './TutorialContents.css';
import { StaticTutorialState, DynamicTutorialState } from './Tutorial';
import { ButtonType, getButtonIcon } from '../utils/icons';
import DocLink, { OnDocLinkClicked } from './DocLink';
import config from '../utils/config';
import { LibraryDefinition, LibraryDefinitionState } from '../../shared/data/libraryDataAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

import * as Fmt from '../../shared/format/format';
import * as FmtHLM from '../../shared/logics/hlm/meta';
import * as Logic from '../../shared/logics/logic';
import * as Menu from '../../shared/notation/menu';

import StartPage from './StartPage';
import Button from '../components/Button';
import MenuButton from '../components/MenuButton';
import LibraryTree, { LibraryItemList, SearchInput, InnerLibraryTreeItems, LibraryTreeItem, LibraryTreeItemProps, LibraryTreeInsertionItem } from '../components/LibraryTree';
import StandardDialog from '../components/StandardDialog';
import InsertDialog from '../components/InsertDialog';
import LibraryItem from '../components/LibraryItem';
import Expression from '../components/Expression';
import ExpressionMenu, { ExpressionMenuRow, ExpressionMenuItem, ExpressionMenuTextInput } from '../components/ExpressionMenu';
import ExpressionDialog, { ExpressionDialogItem } from '../components/ExpressionDialog';

export type TutorialStateTransitionFn = (oldTutorialState: DynamicTutorialState | undefined) => DynamicTutorialState | undefined;
export type ChangeTutorialStateFn = (stateTransitionFn: TutorialStateTransitionFn) => void;

function inject(fn: (...args: any) => any, action: (result: any, ...args: any) => void) {
  return (...args: any) => {
    let result = fn(...args);
    action(result, ...args);
    return result;
  };
}

function createLibraryDefinitionConstraint(constraint: (libraryDefinition: LibraryDefinition) => boolean): (props: any) => boolean {
  return (props) => constraint(props.definition);
}

function createContentConstraint(constraint: (definition: Fmt.Definition) => boolean): (props: any) => boolean {
  return createLibraryDefinitionConstraint((libraryDefinition: LibraryDefinition) => (libraryDefinition.state === LibraryDefinitionState.EditingNew && constraint(libraryDefinition.definition)));
}

function createLibraryDefinitionAction(action: (libraryDefinition: LibraryDefinition) => void): (component: React.Component<any, any>) => void {
  return (component) => action(component.props.definition);
}

function createContentAction(action: (definition: Fmt.Definition) => void): (component: React.Component<any, any>) => void {
  return createLibraryDefinitionAction((libraryDefinition: LibraryDefinition) => (libraryDefinition.state === LibraryDefinitionState.EditingNew && action(libraryDefinition.definition)));
}

function createDummyEvent(target: HTMLElement) {
  return {
    target: target,
    button: 0,
    stopPropagation() {},
    preventDefault() {}
  };
}

const defaultDelay = 200;

class TutorialStates {
  constructor(private onChangeTutorialState: ChangeTutorialStateFn, private onDocLinkClicked: OnDocLinkClicked, private withTouchWarning: boolean, private runAutomatically: boolean = false) {}

  // Introduction.

  private introduction: StaticTutorialState = {
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
                    <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.searchFunctions)}>
                      {getButtonIcon(ButtonType.OK)} Start
                    </Button>
                    {config.development ? (
                       <Button className={'tutorial-tooltip-button standalone'} onClick={() => { this.runAutomatically = true; this.changeState(this.searchFunctions); }}>
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
            },
            elementAction: () => {
              if (this.runAutomatically) {
                this.changeState(this.searchFunctions);
              }
            }
          }
        ]
      }
    ]
  };

  // Search for "Functions".

  private searchFunctions: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryTree,
        children: [
          {
            type: SearchInput,
            toolTip: {
              contents: <p>Our definition and theorem will be about functions, so type "functions" into this search box to find good place to add them.</p>,
              position: 'bottom',
              index: 0
            },
            manipulateProps: (props) => ({
              ...props,
              onSearch: inject(props.onSearch, () => this.changeState(this.insertOperator_menu))
            }),
            elementAction: this.automateTextInput('functions')
          }
        ]
      }
    ]
  };

  // Insert Operator.

  private insertOperator_menu: StaticTutorialState = {
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
                      index: 1,
                      condition: (component) => !component.state.opened
                    }
                  },
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
                              contents: (component) => (
                                <div>
                                  <p>This is the section we are looking for.</p>
                                  {component.state.opened ? <p>Scroll down.</p> : null}
                                </div>
                              ),
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
                                      index: 2,
                                      condition: (component) => !component.state.menuOpen
                                    },
                                    elementAction: this.automateClick(),
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
                                          onClick: inject(props.onClick, () => this.changeState(this.insertOperator_dialog_name))
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

  private insertOperator_dialog_name: StaticTutorialState = {
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
                  contents: <p>Enter a name like "my definition", then hit Enter.<br/>Among other things, this will be the file name of the new item, so only certain characters are allowed.<br/>Moreover, the naming convention for operators requires the name to start with a lowercase letter.</p>,
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

  private insertOperator_dialog_ok: StaticTutorialState = {
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
          onOK: inject(props.onOK, (result: CachedPromise<LibraryDefinition | undefined>) => result.then((libraryDefinition: LibraryDefinition | undefined) => {
            if (libraryDefinition) {
              this.changeState(this.insertOperatorParameters_ST_menu, undefined, libraryDefinition);
            }
          }))
        })
      }
    ]
  };

  // Insert parameters S and T.

  private insertOperatorParameters_ST_menu: StaticTutorialState = {
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
                className: 'paragraph',
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
                          index: 0,
                          condition: (component) => !component.state.openMenu
                        },
                        elementAction: this.automateClick(),
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
                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_ST_names))
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
      },
      {
        type: LibraryItemList,
        children: [
          {
            type: 'div',
            toolTip: {
              contents: <p>This is the list of unsubmitted changes. While editing an item, you can browse the library and then return to the edited item by clicking on it.</p>,
              position: 'bottom',
              index: 1
            }
          }
        ]
      }
    ]
  };

  private insertOperatorParameters_ST_names: StaticTutorialState = {
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
                className: 'paragraph',
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
            this.changeState(this.insertOperatorParameters_f_menu);
          }
        })
      }
    ]
  };

  // Insert parameter f.

  private insertOperatorParameters_f_menu: StaticTutorialState = {
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
                className: 'paragraph',
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
                            key: 7,
                            toolTip: {
                              contents: <p>Add another parameter, which will be a function between these two sets.</p>,
                              position: 'bottom',
                              index: 1,
                              condition: (component) => !component.state.openMenu
                            },
                            elementAction: this.automateClick(),
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
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_f_name))
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

  private insertOperatorParameters_f_name: StaticTutorialState = {
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
                className: 'paragraph',
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
            this.changeState(this.insertOperatorParameters_f_set_menu);
          }
        })
      }
    ]
  };

  private insertOperatorParameters_f_set_menu: StaticTutorialState = {
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
                className: 'paragraph',
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
                                toolTip: {
                                  contents: <p>We need to fill this placeholder.</p>,
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
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
                                              index: 0
                                            },
                                            elementAction: this.automateClick()
                                          }
                                        ],
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, (result: void, action: Menu.ExpressionMenuAction) => {
                                            this.changeState(action instanceof Menu.DialogExpressionMenuAction
                                                             ? this.insertOperatorParameters_f_set_dialog
                                                             : this.insertOperatorParameters_f_set_arg1);
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

  private insertOperatorParameters_f_set_dialog: StaticTutorialState = {
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
                className: 'paragraph',
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
                                            type: ExpressionDialogItem,
                                            key: 0,
                                            children: [
                                              {
                                                type: LibraryTree,
                                                toolTip: {
                                                  contents: <p>This tree shows only the definitions in the library that can be used at the given location.</p>,
                                                  position: 'top',
                                                  index: 0
                                                },
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
                                                                        refIndex: 0,
                                                                        children: [
                                                                          {
                                                                            key: 'item',
                                                                            refConstraint: (refComponents) => (refComponents.length > 0 && !refComponents[0]?.props.selected),
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
                                                                        componentAction: (component) => this.changeState(this.insertOperatorParameters_f_set_dialog, component.props.selected)
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
                                          },
                                          {
                                            type: Button,
                                            key: 'ok',
                                            refConstraint: (refComponents) => (refComponents.length > 0 && refComponents[0]?.props.selected),
                                            toolTip: {
                                              contents: <p>Click here.</p>,
                                              position: 'top',
                                              index: 1
                                            },
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onClick: inject(props.onClick, () => this.changeState(this.insertOperatorParameters_f_set_arg1))
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

  private insertOperatorParameters_f_set_arg1: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[2].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[2].type.expression._set.path.name === 'Functions'
                                                             && definition.parameters[2].type.expression._set.path.arguments.length === 2)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                      contents: (
                                        <div>
                                          <p>Note how the "∈" symbol was replaced by a different notation. Some library definitions specify a special appearance for better readability.</p>
                                          <p>Select S here.</p>
                                        </div>
                                      ),
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
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
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_f_set_arg2))
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

  private insertOperatorParameters_f_set_arg2: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[2].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[2].type.expression._set.path.name === 'Functions'
                                                             && definition.parameters[2].type.expression._set.path.arguments.length === 2
                                                             && definition.parameters[2].type.expression._set.path.arguments[0].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[2].type.expression._set.path.arguments[0].value.arguments[0].value instanceof Fmt.VariableRefExpression
                                                             && definition.parameters[2].type.expression._set.path.arguments[0].value.arguments[0].value.variable === definition.parameters[0])),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
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
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_g_menu))
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

  // Insert parameter g.

  private insertOperatorParameters_g_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 3
                                                             && definition.parameters[2].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[2].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[2].type.expression._set.path.name === 'Functions'
                                                             && definition.parameters[2].type.expression._set.path.arguments.length === 2
                                                             && definition.parameters[2].type.expression._set.path.arguments[0].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[2].type.expression._set.path.arguments[0].value.arguments[0].value instanceof Fmt.VariableRefExpression
                                                             && definition.parameters[2].type.expression._set.path.arguments[0].value.arguments[0].value.variable === definition.parameters[0]
                                                             && definition.parameters[2].type.expression._set.path.arguments[1].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[2].type.expression._set.path.arguments[1].value.arguments[0].value instanceof Fmt.VariableRefExpression
                                                             && definition.parameters[2].type.expression._set.path.arguments[1].value.arguments[0].value.variable === definition.parameters[1]
                                                             && definition.parameters[0].name === 'S')),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 11,
                            toolTip: {
                              contents: <p>Add another function, but this will be a function from S to S.</p>,
                              position: 'bottom',
                              index: 0,
                              condition: (component) => !component.state.openMenu
                            },
                            elementAction: this.automateClick(),
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
                                          index: 0
                                        },
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_g_name))
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

  private insertOperatorParameters_g_name: StaticTutorialState = {
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
                className: 'paragraph',
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
                                    elementAction: this.automateTextInput('g')
                                  }
                                ],
                                toolTip: {
                                  contents: <p>Name this parameter "g".</p>,
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
          if (definition.parameters[3].name === 'g') {
            this.changeState(this.insertOperatorParameters_g_set_menu);
          }
        })
      }
    ]
  };

  private insertOperatorParameters_g_set_menu: StaticTutorialState = {
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
                className: 'paragraph',
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
                                toolTip: {
                                  contents: <p>Click here.</p>,
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
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
                                            key: 'content',
                                            toolTip: {
                                              contents: <p>The set of functions should appear here as the most recently used definition.</p>,
                                              position: 'bottom',
                                              index: 0
                                            },
                                            elementAction: this.automateClick()
                                          }
                                        ],
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_g_set_arg1))
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

  private insertOperatorParameters_g_set_arg1: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4
                                                             && definition.parameters[3].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[3].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[3].type.expression._set.path.name === 'Functions')),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 7,
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
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
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
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_g_set_arg2))
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

  private insertOperatorParameters_g_set_arg2: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4
                                                             && definition.parameters[3].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[3].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[3].type.expression._set.path.name === 'Functions')
                                                             && definition.parameters[3].type.expression._set.path.arguments.length === 2
                                                             && definition.parameters[3].type.expression._set.path.arguments[0].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[3].type.expression._set.path.arguments[0].value.arguments[0].value instanceof Fmt.VariableRefExpression
                                                             && definition.parameters[3].type.expression._set.path.arguments[0].value.arguments[0].value.variable === definition.parameters[0]),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 7,
                            children: [
                              {
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: Expression,
                                    key: 4,
                                    toolTip: {
                                      contents: <p>Select S here as well.</p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
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
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_n_menu))
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

  private insertOperatorParameters_n_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 4
                                                             && definition.parameters[3].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[3].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[3].type.expression._set.path.name === 'Functions')
                                                             && definition.parameters[3].type.expression._set.path.arguments.length === 2
                                                             && definition.parameters[3].type.expression._set.path.arguments[0].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[3].type.expression._set.path.arguments[0].value.arguments[0].value instanceof Fmt.VariableRefExpression
                                                             && definition.parameters[3].type.expression._set.path.arguments[0].value.arguments[0].value.variable === definition.parameters[0]
                                                             && definition.parameters[3].type.expression._set.path.arguments[1].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[3].type.expression._set.path.arguments[1].value.arguments[0].value instanceof Fmt.VariableRefExpression
                                                             && definition.parameters[3].type.expression._set.path.arguments[1].value.arguments[0].value.variable === definition.parameters[0]),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 11,
                            toolTip: {
                              contents: <p>Our last parameter will be a natural number.</p>,
                              position: 'bottom',
                              index: 0,
                              condition: (component) => !component.state.openMenu
                            },
                            elementAction: this.automateClick(),
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
                                          index: 0
                                        },
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_n_name))
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

  private insertOperatorParameters_n_name: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 5
                                                             && definition.parameters[4].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 11,
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
          if (definition.parameters[4].name === 'n') {
            this.changeState(this.insertOperatorParameters_n_set_menu);
          }
        })
      }
    ]
  };

  private insertOperatorParameters_n_set_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 5
                                                             && definition.parameters[4].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 11,
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
                                  index: 1,
                                  condition: (component) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
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
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_n_set_dialog_search))
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

  private insertOperatorParameters_n_set_dialog_search: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 5)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 11,
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
                                                      onSearch: inject(props.onSearch, () => this.changeState(this.insertOperatorParameters_n_set_dialog_select))
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
      }
    ]
  };

  private insertOperatorParameters_n_set_dialog_select: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 5)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 11,
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
                                                                                refIndex: 0,
                                                                                children: [
                                                                                  {
                                                                                    key: 'item',
                                                                                    refConstraint: (refComponents) => (refComponents.length > 0 && !refComponents[0]?.props.selected),
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
                                                                                componentAction: (component) => this.changeState(this.insertOperatorParameters_n_set_dialog_select, component.props.selected)
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
                                          },
                                          {
                                            type: Button,
                                            key: 'ok',
                                            refConstraint: (refComponents) => (refComponents.length > 0 && refComponents[0]?.props.selected),
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onClick: inject(props.onClick, () => this.changeState(this.fillOperatorDefinition_composition_menu))
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

  private fillOperatorDefinition_composition_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 5
                                                             && definition.parameters[4].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[4].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[4].type.expression._set.path.name === 'Natural numbers')),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                  contents: <p>Now we need to fill our new definition.<br/>In general, expressions in Slate are entered hierarchically. So we need to consider the outermost symbol, which in our case will be function composition.</p>,
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
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
                                              index: 0
                                            },
                                            elementAction: this.automateClick()
                                          }
                                        ],
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillOperatorDefinition_composition_dialog_search))
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

  private fillOperatorDefinition_composition_dialog_search: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
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
                                                      onSearch: inject(props.onSearch, () => this.changeState(this.fillOperatorDefinition_composition_dialog_select))
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
      }
    ]
  };

  private fillOperatorDefinition_composition_dialog_select: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
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
                                                                        refIndex: 0,
                                                                        children: [
                                                                          {
                                                                            key: 'item',
                                                                            refConstraint: (refComponents) => (refComponents.length > 0 && !refComponents[0]?.props.selected),
                                                                            children: [
                                                                              {
                                                                                key: 'display-span',
                                                                                toolTip: {
                                                                                  contents: (
                                                                                    <div>
                                                                                      <p>Click here.</p>
                                                                                      <p>If you are unsure whether a given item is the correct one, you can hover over it to see its definition.</p>
                                                                                    </div>
                                                                                  ),
                                                                                  position: 'right',
                                                                                  index: 1
                                                                                }
                                                                              }
                                                                            ],
                                                                            elementAction: this.automateClick()
                                                                          }
                                                                        ],
                                                                        componentAction: (component) => this.changeState(this.fillOperatorDefinition_composition_dialog_select, component.props.selected)
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
                                          },
                                          {
                                            type: Button,
                                            key: 'ok',
                                            refConstraint: (refComponents) => (refComponents.length > 0 && refComponents[0]?.props.selected),
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onClick: inject(props.onClick, () => this.changeState(this.fillOperatorDefinition_composition_arg1_menu))
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

  // Select f.

  private fillOperatorDefinition_composition_arg1_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    toolTip: {
                                      contents: <p>Select f here.</p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    componentAction: (component) => {
                                      (component as Expression).disableWindowClickListener();
                                      this.changeState(this.fillOperatorDefinition_composition_arg1_menu, component.state.openMenu);
                                    },
                                    elementAction: this.automateClick(),
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
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillOperatorDefinition_composition_arg2_menu))
                                                    }),
                                                    elementAction: this.automateClick()
                                                  }
                                                ],
                                                toolTip: {
                                                  contents: (
                                                    <div>
                                                      <p>Note how only f and g can be selected. This is because all input is restricted to well-typed terms.</p>
                                                      <p><DocLink href="docs/hlm/types" onDocLinkClicked={this.onDocLinkClicked}>Read more about the type system.</DocLink></p>
                                                    </div>
                                                  ),
                                                  position: 'right',
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
      }
    ]
  };

  // Select g.

  private fillOperatorDefinition_composition_arg2_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 4,
                                    toolTip: {
                                      contents: <p>Select g here.</p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    componentAction: (component) => this.changeState(this.fillOperatorDefinition_composition_arg2_menu, component.state.openMenu),
                                    elementAction: this.automateClick(),
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
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillOperatorDefinition_composition_arg2_reselectionMenu))
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

  private fillOperatorDefinition_composition_arg2_reselectionMenu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 4,
                                    toolTip: {
                                      contents: <p>It turns out we actually wanted to write "g<sup>n</sup>". This can be fixed easily by clicking here again. (But be careful to only overwrite "g" instead of the entire expression.)</p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    componentAction: (component) => this.changeState(this.fillOperatorDefinition_composition_arg2_reselectionMenu, component.state.openMenu),
                                    elementAction: this.automateClick(),
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
                                                  contents: <p>Click here to search for the definition of the power (i.e. iterated application) of a function.</p>,
                                                  position: 'left',
                                                  index: 0
                                                },
                                                elementAction: this.automateClick()
                                              }
                                            ],
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillOperatorDefinition_composition_arg2_dialog_search))
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
      }
    ]
  };

  private fillOperatorDefinition_composition_arg2_dialog_search: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 1,
                            children: [
                              {
                                type: Expression,
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
                                                type: ExpressionDialogItem,
                                                key: 0,
                                                children: [
                                                  {
                                                    type: LibraryTree,
                                                    children: [
                                                      {
                                                        type: SearchInput,
                                                        toolTip: {
                                                          contents: <p>Type "power".</p>,
                                                          position: 'bottom',
                                                          index: 0
                                                        },
                                                        manipulateProps: (props) => ({
                                                          ...props,
                                                          onSearch: inject(props.onSearch, () => this.changeState(this.fillOperatorDefinition_composition_arg2_dialog_select))
                                                        }),
                                                        elementAction: this.automateTextInput('power')
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

  private fillOperatorDefinition_composition_arg2_dialog_select: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 1,
                            children: [
                              {
                                type: Expression,
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
                                                                            key: 'power to natural number',
                                                                            refIndex: 0,
                                                                            children: [
                                                                              {
                                                                                key: 'item',
                                                                                refConstraint: (refComponents) => (refComponents.length > 0 && !refComponents[0]?.props.selected),
                                                                                children: [
                                                                                  {
                                                                                    key: 'display-span',
                                                                                    toolTip: {
                                                                                      contents: <p>Click here.<br/>In fact, the definition below would also work. View the tooltips to see the difference.</p>,
                                                                                      position: 'right',
                                                                                      index: 1
                                                                                    }
                                                                                  }
                                                                                ],
                                                                                elementAction: this.automateClick()
                                                                              }
                                                                            ],
                                                                            componentAction: (component) => this.changeState(this.fillOperatorDefinition_composition_arg2_dialog_select, component.props.selected)
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
                                              },
                                              {
                                                type: Button,
                                                key: 'ok',
                                                refConstraint: (refComponents) => (refComponents.length > 0 && refComponents[0]?.props.selected),
                                                manipulateProps: (props) => ({
                                                  ...props,
                                                  onClick: inject(props.onClick, () => this.changeState(this.fillOperatorDefinition_composition_arg2_arg2_menu))
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
  };

  // Select n.

  private fillOperatorDefinition_composition_arg2_arg2_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 4,
                                    children: [
                                      {
                                        type: Expression,
                                        key: 'sup',
                                        toolTip: {
                                          contents: <p>Select n here.</p>,
                                          position: 'bottom',
                                          index: 0,
                                          condition: (component) => !component.state.openMenu
                                        },
                                        componentAction: (component) => this.changeState(this.fillOperatorDefinition_composition_arg2_arg2_menu, component.state.openMenu),
                                        elementAction: this.automateClick(),
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
                                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.selectOperatorNotation_openMenu))
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
      }
    ]
  };

  // Select notation template.

  private selectOperatorNotation_openMenu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 0,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    toolTip: {
                                      contents: <p>Now it is time for one of the most important tasks in Slate: finding a good notation.<br/>Since no standard notation exists for our definition, we will have to invent one.</p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
                                    children: [
                                      {
                                        type: ExpressionMenu,
                                        children: [
                                          {
                                            type: ExpressionMenuRow,
                                            key: 1,
                                            children: [
                                              {
                                                type: 'div',
                                                key: 'title',
                                                toolTip: {
                                                  contents: <p>Open this menu and scroll down to "SubSup".</p>,
                                                  position: 'left',
                                                  index: 0
                                                },
                                                elementAction: this.automateHover()
                                              },
                                              {
                                                type: ExpressionMenu,
                                                children: [
                                                  {
                                                    type: ExpressionMenuRow,
                                                    key: 'SubSup',
                                                    children: [
                                                      {
                                                        type: 'div',
                                                        key: 'title',
                                                        toolTip: {
                                                          contents: <p>For simplicity, we will notate the definition as an expression with a subscript and a superscript.</p>,
                                                          position: 'left',
                                                          index: 1
                                                        },
                                                        elementAction: this.automateClick()
                                                      }
                                                    ],
                                                    manipulateProps: (props) => ({
                                                      ...props,
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.selectOperatorNotation_dialog_arg_body))
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
              }
            ]
          }
        ]
      }
    ]
  };

  private selectOperatorNotation_dialog_arg_body: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 0,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    children: [
                                      {
                                        type: ExpressionDialog,
                                        children: [
                                          {
                                            type: StandardDialog,
                                            children: [
                                              {
                                                type: ExpressionDialogItem,
                                                key: 1,
                                                children: [
                                                  {
                                                    type: 'td',
                                                    key: 'value',
                                                    children: [
                                                      {
                                                        type: Expression,
                                                        toolTip: {
                                                          contents: <p>Select g here.</p>,
                                                          position: 'bottom',
                                                          index: 0,
                                                          condition: (component) => !component.state.openMenu
                                                        },
                                                        elementAction: this.automateClick(),
                                                        children: [
                                                          {
                                                            type: ExpressionMenu,
                                                            children: [
                                                              {
                                                                type: ExpressionMenuRow,
                                                                key: 1,
                                                                children: [
                                                                  {
                                                                    type: ExpressionMenuRow,
                                                                    children: [
                                                                      {
                                                                        type: ExpressionMenuItem,
                                                                        key: 3,
                                                                        manipulateProps: (props) => ({
                                                                          ...props,
                                                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.selectOperatorNotation_dialog_arg_sup))
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

  private selectOperatorNotation_dialog_arg_sup: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 0,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    children: [
                                      {
                                        type: ExpressionDialog,
                                        children: [
                                          {
                                            type: StandardDialog,
                                            children: [
                                              {
                                                type: ExpressionDialogItem,
                                                key: 3,
                                                children: [
                                                  {
                                                    type: 'td',
                                                    key: 'value',
                                                    children: [
                                                      {
                                                        type: Expression,
                                                        toolTip: {
                                                          contents: <p>Select n here.</p>,
                                                          position: 'bottom',
                                                          index: 0,
                                                          condition: (component) => !component.state.openMenu
                                                        },
                                                        elementAction: this.automateClick(),
                                                        children: [
                                                          {
                                                            type: ExpressionMenu,
                                                            children: [
                                                              {
                                                                type: ExpressionMenuRow,
                                                                key: 1,
                                                                children: [
                                                                  {
                                                                    type: ExpressionMenuRow,
                                                                    children: [
                                                                      {
                                                                        type: ExpressionMenuItem,
                                                                        key: 4,
                                                                        manipulateProps: (props) => ({
                                                                          ...props,
                                                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.selectOperatorNotation_dialog_arg_preSub))
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

  private selectOperatorNotation_dialog_arg_preSub: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 0,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    children: [
                                      {
                                        type: ExpressionDialog,
                                        children: [
                                          {
                                            type: StandardDialog,
                                            children: [
                                              {
                                                type: ExpressionDialogItem,
                                                key: 4,
                                                children: [
                                                  {
                                                    type: 'td',
                                                    key: 'value',
                                                    children: [
                                                      {
                                                        type: Expression,
                                                        toolTip: {
                                                          contents: <p>Select f here.</p>,
                                                          position: 'bottom',
                                                          index: 0,
                                                          condition: (component) => !component.state.openMenu
                                                        },
                                                        elementAction: this.automateClick(),
                                                        children: [
                                                          {
                                                            type: ExpressionMenu,
                                                            children: [
                                                              {
                                                                type: ExpressionMenuRow,
                                                                key: 1,
                                                                children: [
                                                                  {
                                                                    type: ExpressionMenuRow,
                                                                    children: [
                                                                      {
                                                                        type: ExpressionMenuItem,
                                                                        key: 2,
                                                                        manipulateProps: (props) => ({
                                                                          ...props,
                                                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.selectOperatorNotation_dialog_arg_preSup))
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

  private selectOperatorNotation_dialog_arg_preSup: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 0,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    children: [
                                      {
                                        type: ExpressionDialog,
                                        children: [
                                          {
                                            type: StandardDialog,
                                            children: [
                                              {
                                                type: ExpressionDialogItem,
                                                key: 5,
                                                children: [
                                                  {
                                                    type: 'td',
                                                    key: 'value',
                                                    children: [
                                                      {
                                                        type: Expression,
                                                        toolTip: {
                                                          contents: <p>Enter a text like "my" here, so you will recognize the definition more easily.</p>,
                                                          position: 'bottom',
                                                          index: 0,
                                                          condition: (component) => !component.state.openMenu
                                                        },
                                                        elementAction: this.automateClick(),
                                                        children: [
                                                          {
                                                            type: ExpressionMenu,
                                                            children: [
                                                              {
                                                                type: ExpressionMenuRow,
                                                                key: 0,
                                                                children: [
                                                                  {
                                                                    type: ExpressionMenuTextInput,
                                                                    children: [
                                                                      {
                                                                        type: 'form',
                                                                        manipulateProps: (props) => ({
                                                                          ...props,
                                                                          onSubmit: inject(props.onSubmit, () => this.changeState(this.selectOperatorNotation_dialog_ok))
                                                                        }),
                                                                        elementAction: this.automateFormSubmission(2 * defaultDelay),
                                                                        children: [
                                                                          {
                                                                            type: 'input',
                                                                            elementAction: this.automateTextInput('my')
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

  private selectOperatorNotation_dialog_ok: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'span',
                        className: 'table-row',
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            className: 'table-cell',
                            key: 0,
                            children: [
                              {
                                type: Expression,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
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
                                                  contents: <p>Since S and T can be inferred automatically, we are done.<br/>After the tutorial is finished, you can go back and experiment with the notation.</p>,
                                                  position: 'bottom',
                                                  index: 0
                                                },
                                                manipulateProps: (props) => ({
                                                  ...props,
                                                  onClick: inject(props.onClick, () => this.changeState(this.submitOperator))
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
  };

  private submitOperator: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 3,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: 'div',
                        key: 'contents',
                        children: [
                          {
                            type: Expression,
                            toolTip: {
                              contents: (
                                <div>
                                  <p>Finally, you should add some documentation, including references to external material.</p>
                                  <p>At a minimum, please fill the given list of default references where applicable. Links to the corresponding definition/theorem in other theorem provers may become especially valuable in the future.</p>
                                  <p>For convenience, you can click on the "Search" button in the editor toolbar to search the default references for a given term, either one by one or (if your browser allows it) all at once. {this.withTouchWarning ? <>(Unfortunately, the markdown editor including this feature does not work on mobile devices.)</> : null}</p>
                                  <p>However, in tutorial mode, you can skip this and just hit "Submit".</p>
                                </div>
                              ),
                              position: 'top',
                              index: 0,
                              condition: (component) => !component.state.openDialog
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
      },
      {
        type: 'div',
        key: 'toolbar',
        children: [
          {
            type: Button,
            key: 'submit',
            toolTip: {
              contents: <p>Click here.</p>,
              position: 'top',
              index: 1
            },
            manipulateProps: (props) => ({
              ...props,
              onClick: inject(props.onClick, () => this.changeState(this.insertTheorem_menu, undefined, null))
            }),
            elementAction: this.automateClick()
          }
        ]
      }
    ]
  };

  // Insert theorem.

  private insertTheorem_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryTree,
        toolTip: {
          contents: <p>Next, we will state a simple theorem about our new definition. Insert it below the definition.</p>,
          position: 'right',
          index: 0
        },
        children: [
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
                      contents: <p>Open this section.</p>,
                      position: 'right',
                      index: 1,
                      condition: (component) => !component.state.opened
                    }
                  },
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
                              contents: (component) => component.state.opened ? <p>Scroll down again.</p> : <p>Open this section.</p>,
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
                                      index: 2,
                                      condition: (component) => !component.state.menuOpen
                                    },
                                    elementAction: this.automateClick(),
                                    children: [
                                      {
                                        type: Button,
                                        key: Logic.LogicDefinitionType.Theorem,
                                        toolTip: {
                                          contents: <p>Click here to insert a theorem.</p>,
                                          position: 'right',
                                          index: 2
                                        },
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onClick: inject(props.onClick, () => this.changeState(this.insertTheorem_dialog_name))
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

  private insertTheorem_dialog_name: StaticTutorialState = {
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
                  contents: <p>Enter a name, which can be a sentence like "Simple fact about my definition".</p>,
                  position: 'top',
                  index: 0
                },
                elementAction: this.automateTextInput('Simple fact about my definition')
              }
            ]
          }
        ],
        componentAction: (component) => {
          if (component.state.name) {
            this.changeState(this.insertTheorem_dialog_ok);
          }
        }
      }
    ]
  };

  private insertTheorem_dialog_ok: StaticTutorialState = {
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
          onOK: inject(props.onOK, (result: CachedPromise<LibraryDefinition | undefined>) => result.then((libraryDefinition: LibraryDefinition | undefined) => {
            if (libraryDefinition) {
              this.changeState(this.insertTheoremParameters_f_menu, undefined, libraryDefinition);
            }
          }))
        })
      }
    ]
  };

  // Insert parameter f.

  private insertTheoremParameters_f_menu: StaticTutorialState = {
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
                className: 'paragraph',
                key: 0,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 2,
                        toolTip: {
                          contents: <p>Add a parameter that is a function from the set of natural numbers to itself.</p>,
                          position: 'bottom',
                          index: 0,
                          condition: (component) => !component.state.openMenu
                        },
                        elementAction: this.automateClick(),
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
                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_f_name))
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

  private insertTheoremParameters_f_name: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 1
                                                             && definition.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
          if (definition.parameters[0].name === 'f') {
            this.changeState(this.insertTheoremParameters_f_set_menu);
          }
        })
      }
    ]
  };

  private insertTheoremParameters_f_set_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 1
                                                             && definition.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                type: Expression,
                                key: 4,
                                toolTip: {
                                  contents: <p>Select the set of functions, which should be in the list of recently used definitions.</p>,
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
                                children: [
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 2,
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_f_set_arg1))
                                        }),
                                        children: [
                                          {
                                            type: 'div',
                                            key: 'title',
                                            elementAction: this.automateHover()
                                          },
                                          {
                                            type: ExpressionMenu,
                                            children: [
                                              {
                                                type: ExpressionMenuRow,
                                                key: 1,
                                                children: [
                                                  {
                                                    type: ExpressionMenuItem,
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

  private insertTheoremParameters_f_set_arg1: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 1
                                                             && definition.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[0].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[0].type.expression._set.path.name === 'Functions'
                                                             && definition.parameters[0].type.expression._set.path.arguments.length === 2)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: Expression,
                                    key: 0,
                                    toolTip: {
                                      contents: <p>Select the set of natural numbers, which should also be in the list of recently used definitions.</p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
                                    children: [
                                      {
                                        type: ExpressionMenu,
                                        children: [
                                          {
                                            type: ExpressionMenuRow,
                                            key: 4,
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_f_set_arg2))
                                            }),
                                            children: [
                                              {
                                                type: 'div',
                                                key: 'title',
                                                elementAction: this.automateHover()
                                              },
                                              {
                                                type: ExpressionMenu,
                                                children: [
                                                  {
                                                    type: ExpressionMenuRow,
                                                    key: 1,
                                                    children: [
                                                      {
                                                        type: ExpressionMenuItem,
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
      }
    ]
  };

  private insertTheoremParameters_f_set_arg2: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 1
                                                             && definition.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[0].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[0].type.expression._set.path.name === 'Functions'
                                                             && definition.parameters[0].type.expression._set.path.arguments.length === 2
                                                             && definition.parameters[0].type.expression._set.path.arguments[0].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[0].type.expression._set.path.arguments[0].value.arguments[0].value instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[0].type.expression._set.path.arguments[0].value.arguments[0].value.path.name === 'Natural numbers')),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                type: Expression,
                                key: 4,
                                children: [
                                  {
                                    type: Expression,
                                    key: 4,
                                    toolTip: {
                                      contents: <p>Same here.</p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
                                    children: [
                                      {
                                        type: ExpressionMenu,
                                        children: [
                                          {
                                            type: ExpressionMenuRow,
                                            key: 4,
                                            manipulateProps: (props) => ({
                                              ...props,
                                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_n_menu))
                                            }),
                                            children: [
                                              {
                                                type: ExpressionMenuItem,
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
  };

  // Insert parameter n.

  private insertTheoremParameters_n_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 1
                                                             && definition.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[0].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[0].type.expression._set.path.name === 'Functions'
                                                             && definition.parameters[0].type.expression._set.path.arguments.length === 2
                                                             && definition.parameters[0].type.expression._set.path.arguments[0].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[0].type.expression._set.path.arguments[0].value.arguments[0].value instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[0].type.expression._set.path.arguments[0].value.arguments[0].value.path.name === 'Natural numbers'
                                                             && definition.parameters[0].type.expression._set.path.arguments[1].value instanceof Fmt.CompoundExpression
                                                             && definition.parameters[0].type.expression._set.path.arguments[1].value.arguments[0].value instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[0].type.expression._set.path.arguments[1].value.arguments[0].value.path.name === 'Natural numbers')),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                            key: 7,
                            toolTip: {
                              contents: <p>Insert a natural number "n".</p>,
                              position: 'bottom',
                              index: 0,
                              condition: (component) => !component.state.openMenu
                            },
                            elementAction: this.automateClick(),
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
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_n_name))
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

  private insertTheoremParameters_n_name: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 2
                                                             && definition.parameters[1].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                    elementAction: this.automateTextInput('n')
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
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[1].name === 'n') {
            this.changeState(this.insertTheoremParameters_n_set_menu);
          }
        })
      }
    ]
  };

  private insertTheoremParameters_n_set_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 2
                                                             && definition.parameters[1].type.expression instanceof FmtHLM.MetaRefExpression_Element)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
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
                                toolTip: {
                                  contents: <p>Select the set of natural numbers.</p>,
                                  position: 'bottom',
                                  index: 1,
                                  condition: (component) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
                                children: [
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 2,
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_menu))
                                        }),
                                        children: [
                                          {
                                            type: ExpressionMenuItem,
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

  // Insert equality.

  private fillTheoremClaim_equality_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createContentConstraint((definition) => (definition.parameters.length === 2
                                                             && definition.parameters[1].type.expression instanceof FmtHLM.MetaRefExpression_Element
                                                             && definition.parameters[1].type.expression._set instanceof Fmt.DefinitionRefExpression
                                                             && definition.parameters[1].type.expression._set.path.name === 'Natural numbers')),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    toolTip: {
                      contents: <p>Now we need to state the claim of the theorem, which will be an equality.</p>,
                      position: 'bottom',
                      index: 0,
                      condition: (component) => !component.state.openMenu
                    },
                    elementAction: this.automateClick(),
                    children: [
                      {
                        type: ExpressionMenu,
                        children: [
                          {
                            type: ExpressionMenuRow,
                            key: 3,
                            children: [
                              {
                                type: ExpressionMenuRow,
                                children: [
                                  {
                                    type: ExpressionMenuItem,
                                    key: 0,
                                    toolTip: {
                                      contents: <p>Click here.</p>,
                                      position: 'bottom',
                                      index: 0
                                    },
                                    elementAction: this.automateClick()
                                  }
                                ]
                              }
                            ],
                            manipulateProps: (props) => ({
                              ...props,
                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg1_menu))
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
  };

  // Select "my definition".

  private fillTheoremClaim_equality_arg1_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 0,
                        toolTip: {
                          contents: <p>Here, please select the definition you just created, which should be the second item in the list of recently used definitions.</p>,
                          position: 'bottom',
                          index: 0,
                          condition: (component) => !component.state.openMenu
                        },
                        elementAction: this.automateClick(),
                        children: [
                          {
                            type: ExpressionMenu,
                            children: [
                              {
                                type: ExpressionMenuRow,
                                key: 2,
                                manipulateProps: (props) => ({
                                  ...props,
                                  onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg1_arg1_menu))
                                }),
                                children: [
                                  {
                                    type: 'div',
                                    key: 'title',
                                    elementAction: this.automateHover()
                                  },
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 1,
                                        children: [
                                          {
                                            type: ExpressionMenuItem,
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

  // Select f.

  private fillTheoremClaim_equality_arg1_arg1_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 0,
                        children: [
                          {
                            type: Expression,
                            key: 'preSub',
                            toolTip: {
                              contents: <p>Select f here.</p>,
                              position: 'bottom',
                              index: 0,
                              condition: (component) => !component.state.openMenu
                            },
                            componentAction: (component) => this.changeState(this.fillTheoremClaim_equality_arg1_arg1_menu, component.state.openMenu),
                            elementAction: this.automateClick(),
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
                                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg1_arg2_menu))
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

  // Select identity function.

  private fillTheoremClaim_equality_arg1_arg2_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 0,
                        children: [
                          {
                            type: Expression,
                            key: 'body',
                            toolTip: {
                              contents: <p>Here, please select the identity function, which is a definition in the library.</p>,
                              position: 'bottom',
                              index: 0,
                              condition: (component) => !component.state.openMenu
                            },
                            componentAction: (component) => this.changeState(this.fillTheoremClaim_equality_arg1_arg2_menu, component.state.openMenu),
                            elementAction: this.automateClick(),
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
                                        elementAction: this.automateClick()
                                      }
                                    ],
                                    manipulateProps: (props) => ({
                                      ...props,
                                      onItemClicked: inject(props.onItemClicked, (result: void, action: Menu.ExpressionMenuAction) => {
                                        this.changeState(action instanceof Menu.DialogExpressionMenuAction
                                                         ? this.fillTheoremClaim_equality_arg1_arg2_dialog_search
                                                         : this.fillTheoremClaim_equality_arg1_arg3_menu);
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
  };

  private fillTheoremClaim_equality_arg1_arg2_dialog_search: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 0,
                        children: [
                          {
                            type: Expression,
                            key: 'body',
                            children: [
                              {
                                type: ExpressionDialog,
                                children: [
                                  {
                                    type: StandardDialog,
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
                                                  contents: <p>Type "identity".</p>,
                                                  position: 'bottom',
                                                  index: 0
                                                },
                                                manipulateProps: (props) => ({
                                                  ...props,
                                                  onSearch: inject(props.onSearch, () => this.changeState(this.fillTheoremClaim_equality_arg1_arg2_dialog_select))
                                                }),
                                                elementAction: this.automateTextInput('identity')
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

  private fillTheoremClaim_equality_arg1_arg2_dialog_select: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 0,
                        children: [
                          {
                            type: Expression,
                            key: 'body',
                            children: [
                              {
                                type: ExpressionDialog,
                                children: [
                                  {
                                    type: StandardDialog,
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
                                                                    key: 'identity',
                                                                    refIndex: 0,
                                                                    children: [
                                                                      {
                                                                        key: 'item',
                                                                        refConstraint: (refComponents) => (refComponents.length > 0 && !refComponents[0]?.props.selected),
                                                                        children: [
                                                                          {
                                                                            key: 'display-span',
                                                                            toolTip: {
                                                                              contents: <p>Click here.</p>,
                                                                              position: 'right',
                                                                              index: 1
                                                                            }
                                                                          }
                                                                        ],
                                                                        elementAction: this.automateClick()
                                                                      }
                                                                    ],
                                                                    componentAction: (component) => this.changeState(this.fillTheoremClaim_equality_arg1_arg2_dialog_select, component.props.selected)
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
                                      },
                                      {
                                        type: Button,
                                        key: 'ok',
                                        refConstraint: (refComponents) => (refComponents.length > 0 && refComponents[0]?.props.selected),
                                        manipulateProps: (props) => ({
                                          ...props,
                                          onClick: inject(props.onClick, () => this.changeState(this.fillTheoremClaim_equality_arg1_arg3_menu))
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

  // Select n.

  private fillTheoremClaim_equality_arg1_arg3_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 0,
                        children: [
                          {
                            type: Expression,
                            key: 'body',
                            toolTip: {
                              contents: <p>Note how Slate automatically figured out that this can only be the identity function on the natural numbers. Moreover, parentheses are displayed wherever the notation would cause ambiguities.</p>,
                              position: 'top',
                              index: 0,
                              condition: (component) => !component.state.openMenu
                            }
                          },
                          {
                            type: Expression,
                            key: 'sup',
                            toolTip: {
                              contents: <p>Select n here.</p>,
                              position: 'bottom',
                              index: 1,
                              condition: (component) => !component.state.openMenu
                            },
                            componentAction: (component) => this.changeState(this.fillTheoremClaim_equality_arg1_arg3_menu, component.state.openMenu),
                            elementAction: this.automateClick(),
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
                                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg2_menu))
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

  // Select f on the right side.

  private fillTheoremClaim_equality_arg2_menu: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 4,
                        toolTip: {
                          contents: <p>Select f here.</p>,
                          position: 'bottom',
                          index: 0,
                          condition: (component) => !component.state.openMenu
                        },
                        componentAction: (component) => this.changeState(this.fillTheoremClaim_equality_arg2_menu, component.state.openMenu),
                        elementAction: this.automateClick(),
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
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.openSourceCodeView))
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

  // View source to see inferred arguments.

  private openSourceCodeView: StaticTutorialState = {
    manipulationEntries: [
      {
        type: 'div',
        key: 'toolbar',
        children: [
          {
            type: Button,
            key: 'view-source',
            toolTip: {
              contents: (
                <div>
                  <p>Now you have stated your first theorem.</p>
                  <p>By the way, what about the parameters S and T? To see that they have been inferred automatically, you can take a look at the source code.</p>
                </div>
              ),
              position: 'top',
              index: 0
            },
            manipulateProps: (props) => ({
              ...props,
              onClick: inject(props.onClick, () => this.changeState(this.closeSourceCodeView))
            }),
            elementAction: this.automateClick()
          }
        ]
      }
    ]
  };

  private closeSourceCodeView: StaticTutorialState = {
    manipulationEntries: [
      {
        type: 'div',
        key: 'toolbar',
        children: [
          {
            type: Button,
            key: 'view-source',
            toolTip: {
              contents: <p>When you are done, please close the source code view again.</p>,
              position: 'top',
              index: 0
            },
            manipulateProps: (props) => ({
              ...props,
              onClick: inject(props.onClick, () => this.changeState(this.insertProof))
            }),
            elementAction: this.automateClick()
          }
        ]
      }
    ]
  };

  // Insert proof.

  private insertProof: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 2,
                children: [
                  {
                    type: Expression,
                    toolTip: {
                      contents: (
                        <div>
                          <p>Soon, you will be able to prove this theorem, but the user interface for proofs is not finished yet.</p>
                          <p>Nevertheless, you can already contribute to the library by submitting definitions and theorem statements. In fact, in the beginning, creating a well-organized library will be the biggest challenge, whereas a lot of people can add proofs in parallel later.</p>
                          <p>So for now, please "submit" the theorem without proof.</p>
                        </div>
                      ),
                      position: 'bottom',
                      index: 0
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'div',
        key: 'toolbar',
        children: [
          {
            type: Button,
            key: 'submit',
            toolTip: {
              contents: <p>Click here.</p>,
              position: 'top',
              index: 1
            },
            manipulateProps: (props) => ({
              ...props,
              onClick: inject(props.onClick, () => this.changeState(this.checkDefinition, undefined, null))
            }),
            elementAction: this.automateClick()
          }
        ]
      }
    ]
  };

  // Navigate to definition and end tutorial.

  private checkDefinition: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItem,
        constraint: createLibraryDefinitionConstraint((libraryDefinition) => (libraryDefinition.definition.type.expression instanceof FmtHLM.MetaRefExpression_StandardTheorem)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    children: [
                      {
                        type: Expression,
                        key: 0,
                        toolTip: {
                          contents: <p>A new visitor will of course not understand this theorem without looking at our definition. But navigating the library is easy. Hover over the word "my" to see a tooltip, and click there to go to the definition.</p>,
                          position: 'bottom',
                          index: 0
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
      },
      {
        type: LibraryItem,
        constraint: createLibraryDefinitionConstraint((libraryDefinition) => (libraryDefinition.definition.type.expression instanceof FmtHLM.MetaRefExpression_ExplicitOperator)),
        children: [
          {
            type: Expression,
            children: [
              {
                type: 'div',
                className: 'paragraph',
                key: 1,
                children: [
                  {
                    type: Expression,
                    toolTip: {
                      contents: (
                        <div className={'large-tooltip'}>
                          <p>Thank you for following the tutorial.</p>
                          <p>As you have seen, Slate is designed to be learned intuitively, by exploring the user interface. As a next step, we recommend taking a look at the contents of the library and making small contributions.</p>
                          <p>If you would like to experiment a little without submitting your changes, you can continue in tutorial mode for a while.</p>
                          <p>Note that since the user interface is not finished yet, not everything will work as expected. As a workaround, you may want to switch to the <a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate" target="_blank">Visual Studio Code extension</a>, where you can always switch to the text editor as a fallback.</p>
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
  };

  private experiment: StaticTutorialState = {};

  start() {
    this.changeState(this.introduction, undefined, null);
  }

  private changeState(staticState: StaticTutorialState | undefined, additionalStateData?: any, newEditedDefinition?: LibraryDefinition | null): void {
    if (staticState) {
      let stateTransitionFn = (oldTutorialState: DynamicTutorialState | undefined): DynamicTutorialState => ({
        staticState: staticState,
        refComponents: oldTutorialState?.staticState === staticState ? oldTutorialState?.refComponents : undefined,
        additionalStateData: additionalStateData,
        editedDefinition: newEditedDefinition === undefined ? oldTutorialState?.editedDefinition : newEditedDefinition ?? undefined
      });
      this.onChangeTutorialState(stateTransitionFn);
    } else {
      this.onChangeTutorialState(() => undefined);
    }
  }

  private automateClick(delay: number = defaultDelay) {
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

  private automateHover(delay: number = defaultDelay) {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done) {
        done = true;
        while (reactElement.props && reactElement.props.children && !reactElement.props.onMouseEnter) {
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
          let simulateHover = () => {
            if (reactElement.props.onMouseEnter) {
              let mouseEnterEvent = createDummyEvent(htmlElement);
              reactElement.props.onMouseEnter(mouseEnterEvent);
            }
          };
          setTimeout(simulateHover, delay);
        }
      }
    };
  }

  private automateTextInput(text: string, delay: number = defaultDelay) {
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

  private automateFormSubmission(delay: number = defaultDelay) {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done) {
        done = true;
        let simulateFormSubmission = () => {
          reactElement.props.onSubmit(createDummyEvent(htmlElement));
        };
        setTimeout(simulateFormSubmission, delay);
      }
    };
  }
}

export function startTutorial(onChangeTutorialState: ChangeTutorialStateFn, onDocLinkClicked: OnDocLinkClicked, withTouchWarning: boolean): void {
  let tutorialStates = new TutorialStates(onChangeTutorialState, onDocLinkClicked, withTouchWarning);
  tutorialStates.start();
}

export function getReturnToDefinitionState(editedDefinition: LibraryDefinition): DynamicTutorialState {
  return {
    staticState: {
      manipulationEntries: [
        {
          type: LibraryItemList,
          children: [
            {
              type: LibraryTreeItem,
              constraint: (props: LibraryTreeItemProps) => (props.libraryDefinition === editedDefinition),
              toolTip: {
                contents: <p>Select the edited definition to continue the tutorial.</p>,
                position: 'bottom',
                index: 0
              }
            }
          ]
        }
      ]
    }
  };
}
