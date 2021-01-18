import * as React from 'react';

import './TutorialContents.css';

import { StaticTutorialState, DynamicTutorialState } from './Tutorial';
import StartPage from './StartPage';
import Button, { ButtonProps } from '../components/Button';
import MenuButton from '../components/MenuButton';
import LibraryTree, { LibraryItemList, SearchInput, SearchInputProps, InnerLibraryTreeItems, LibraryTreeItem, LibraryTreeItemProps, LibraryTreeInsertionItem } from '../components/LibraryTree';
import StandardDialog from '../components/StandardDialog';
import InsertDialog, { InsertDialogProps } from '../components/InsertDialog';
import LibraryItem from '../components/LibraryItem';
import Expression from '../components/Expression';
import ExpressionMenu, { ExpressionMenuRow, ExpressionMenuRowProps, ExpressionMenuItem, ExpressionMenuItemProps, ExpressionMenuTextInput, ExpressionMenuTextInputProps } from '../components/ExpressionMenu';
import ExpressionDialog, { ExpressionDialogProps, ExpressionDialogItem } from '../components/ExpressionDialog';
import UnicodeTextInput from '../components/UnicodeTextInput';
import { SubSup } from '../components/rendering/SubSup';
import DocLink, { OnDocLinkClicked } from './DocLink';
import { PromiseHelper } from '../components/PromiseHelper';

import { ButtonType, getButtonIcon } from '../utils/icons';
import config from '../utils/config';

import * as Fmt from 'slate-shared/format/format';
import * as FmtHLM from 'slate-shared/logics/hlm/meta';
import * as Logic from 'slate-shared/logics/logic';
import * as Menu from 'slate-shared/notation/menu';
import { LibraryDefinition, LibraryDefinitionState } from 'slate-shared/data/libraryDataAccessor';
import { HLMExpressionType } from 'slate-shared/logics/hlm/types';
import CachedPromise from 'slate-shared/data/cachedPromise';


export type TutorialStateTransitionFn = (oldTutorialState: DynamicTutorialState | undefined) => DynamicTutorialState | undefined;
export type ChangeTutorialStateFn = (stateTransitionFn: TutorialStateTransitionFn) => void;
export type ReplaceDefinitionContentsFn = (definition: Fmt.Definition) => void;

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

function createDummyEvent(target: HTMLElement): any {
  return {
    type: 'dummy',
    target: target,
    currentTarget: target,
    button: 0,
    stopPropagation() {},
    preventDefault() {}
  };
}

const defaultDelay = 200;

class TutorialStates {
  private operator?: LibraryDefinition;
  private theorem?: LibraryDefinition;

  constructor(private onChangeTutorialState: ChangeTutorialStateFn, private onReplaceDefinitionContents: ReplaceDefinitionContentsFn, private onDocLinkClicked: OnDocLinkClicked, private withTouchWarning: boolean, private runAutomatically: boolean = false) {}

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
            manipulateProps: (props: SearchInputProps) => ({
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
                      condition: (component: LibraryTreeItem) => !component.state.opened
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
                              contents: (component: LibraryTreeItem) => (
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
                                      condition: (component: MenuButton) => !component.state.menuOpen
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
                                        manipulateProps: (props: ButtonProps) => ({
                                          ...props,
                                          onClick: inject(props.onClick!, () => this.changeState(this.insertOperator_dialog_name))
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
                  contents: (
                    <div>
                      <p>Enter a name like "my definition", then hit Enter.</p>
                      <p>Among other things, this will be the file name of the new item, so only certain characters are allowed.<br/>Moreover, the naming convention for operators requires the name to start with a lowercase letter.</p>
                    </div>
                  ),
                  position: 'top',
                  index: 0
                },
                elementAction: this.automateTextInput('my definition')
              }
            ]
          }
        ],
        componentAction: (component: InsertDialog) => {
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
        manipulateProps: (props: InsertDialogProps) => ({
          ...props,
          onOK: inject(props.onOK, (result: CachedPromise<LibraryDefinition | undefined>) => result.then((libraryDefinition: LibraryDefinition | undefined) => {
            if (libraryDefinition) {
              this.operator = libraryDefinition;
              this.changeState(this.insertOperator_libraryItemListHint, libraryDefinition);
            }
          }))
        })
      }
    ]
  };

  private insertOperator_libraryItemListHint: StaticTutorialState = {
    manipulationEntries: [
      {
        type: LibraryItemList,
        children: [
          {
            type: 'div',
            toolTip: {
              contents: (
                <div>
                  <p>This is the list of unsubmitted changes. While editing an item, you can browse the library and then return to the edited item by clicking on it.</p>
                  <div className={'tutorial-tooltip-button-row'}>
                    <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.insertOperatorParameters_ST)}>
                      {getButtonIcon(ButtonType.OK)} Continue
                    </Button>
                  </div>
                </div>
              ),
              position: 'bottom',
              index: 0
            },
            elementAction: () => {
              if (this.runAutomatically) {
                this.changeState(this.insertOperatorParameters_ST);
              }
            }
          }
        ]
      }
    ]
  };

  // Insert parameters S and T.

  private insertOperatorParameters_ST: StaticTutorialState = {
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
                          condition: (component: Expression) => !component.state.openMenu
                        },
                        children: [
                          {
                            type: PromiseHelper,
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
                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
          }
        ]
      }
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.addSetParameter(definition, 'S');
    }
  };

  private insertOperatorParameters_ST_names: StaticTutorialState = {
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
                                type: UnicodeTextInput,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters.length >= 2) {
            this.changeState(this.insertOperatorParameters_f);
          }
        })
      }
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.addParameterToGroup(definition, 'T');
    }
  };

  // Insert parameter f.

  private insertOperatorParameters_f: StaticTutorialState = {
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
                              condition: (component: Expression) => !component.state.openMenu
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
                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.addElementParameter(definition, 'x');
    }
  };

  private insertOperatorParameters_f_name: StaticTutorialState = {
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
                                    type: UnicodeTextInput,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[2].name === 'f') {
            this.changeState(this.insertOperatorParameters_f_set);
          }
        })
      }
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.changeParameterName(definition, 'f');
    }
  };

  private insertOperatorParameters_f_set: StaticTutorialState = {
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
                                  condition: (component: Expression) => !(component.state.openMenu || component.state.openDialog)
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
                                        manipulateProps: (props: ExpressionMenuRowProps) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, (result: void, action: Menu.ExpressionMenuAction) => {
                                            if (action instanceof Menu.ImmediateExpressionMenuAction) {
                                              this.changeState(this.insertOperatorParameters_f_set_arg1);
                                            }
                                          })
                                        })
                                      }
                                    ]
                                  },
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
                                                    refConstraint: (refComponents) => !(refComponents.length > 0 && refComponents[0]?.props.selected),
                                                    toolTip: {
                                                      contents: <p>This tree shows only the definitions in the library that can be used at the given location.</p>,
                                                      position: 'top',
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
                                                                        componentAction: (component: LibraryTreeItem) => this.changeAdditionalStateData(() => component.props.selected)
                                                                      }
                                                                    ]
                                                                  }
                                                                ]
                                                              }
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
                                            elementAction: this.automateClick()
                                          }
                                        ]
                                      }
                                    ],
                                    manipulateProps: (props: ExpressionDialogProps) => ({
                                      ...props,
                                      onOK: inject(props.onOK, () => this.changeState(this.insertOperatorParameters_f_set_arg1))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('f');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      type._set = this.createDefinitionRefExpression(['Functions'], [[
        this.createSetArg('X'),
        this.createSetArg('Y')
      ]]);
    }
  };

  private insertOperatorParameters_f_set_arg1: StaticTutorialState = {
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
                                      condition: (component: Expression) => !component.state.openMenu
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
                                                    manipulateProps: (props: ExpressionMenuItemProps) => ({
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('f');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      let functions = type._set as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'S');
      this.setArgValue(functions.path.arguments, 'X', variableRef);
    }
  };

  private insertOperatorParameters_f_set_arg2: StaticTutorialState = {
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
                                      condition: (component: Expression) => !component.state.openMenu
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
                                                    manipulateProps: (props: ExpressionMenuItemProps) => ({
                                                      ...props,
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_g))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('f');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      let functions = type._set as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'T');
      this.setArgValue(functions.path.arguments, 'Y', variableRef);
    }
  };

  // Insert parameter g.

  private insertOperatorParameters_g: StaticTutorialState = {
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
                              contents: <p>Add another function. (This will be a function from S to S.)</p>,
                              position: 'bottom',
                              index: 0,
                              condition: (component: Expression) => !component.state.openMenu
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
                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.addElementParameter(definition, 'x');
    }
  };

  private insertOperatorParameters_g_name: StaticTutorialState = {
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
                                    type: UnicodeTextInput,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[3].name === 'g') {
            this.changeState(this.insertOperatorParameters_g_set);
          }
        })
      }
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.changeParameterName(definition, 'g');
    }
  };

  private insertOperatorParameters_g_set: StaticTutorialState = {
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
                                  condition: (component: Expression) => !component.state.openMenu
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
                                        manipulateProps: (props: ExpressionMenuRowProps) => ({
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('g');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      type._set = this.createDefinitionRefExpression(['Functions'], [[
        this.createSetArg('X'),
        this.createSetArg('Y')
      ]]);
    }
  };

  private insertOperatorParameters_g_set_arg1: StaticTutorialState = {
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
                                      contents: <p>Select S here. <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.skipStates([this.insertOperatorParameters_g_set_arg1, this.insertOperatorParameters_g_set_arg2], this.insertOperatorParameters_n)}>Skip</Button></p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component: Expression) => !component.state.openMenu
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
                                                    manipulateProps: (props: ExpressionMenuItemProps) => ({
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('g');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      let functions = type._set as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'S');
      this.setArgValue(functions.path.arguments, 'X', variableRef);
    }
  };

  private insertOperatorParameters_g_set_arg2: StaticTutorialState = {
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
                                      condition: (component: Expression) => !component.state.openMenu
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
                                                    manipulateProps: (props: ExpressionMenuItemProps) => ({
                                                      ...props,
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertOperatorParameters_n))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('g');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      let functions = type._set as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'S');
      this.setArgValue(functions.path.arguments, 'Y', variableRef);
    }
  };

  // Insert parameter n.

  private insertOperatorParameters_n: StaticTutorialState = {
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
                              condition: (component: Expression) => !component.state.openMenu
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
                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.addElementParameter(definition, 'x');
    }
  };

  private insertOperatorParameters_n_name: StaticTutorialState = {
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
                                    type: UnicodeTextInput,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[4].name === 'n') {
            this.changeState(this.insertOperatorParameters_n_set);
          }
        })
      }
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.changeParameterName(definition, 'n');
    }
  };

  private insertOperatorParameters_n_set: StaticTutorialState = {
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
                                  condition: (component: Expression) => !(component.state.openMenu || component.state.openDialog)
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
                                        ]
                                      }
                                    ]
                                  },
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
                                                    refConstraint: (refComponents) => !(refComponents.length > 0 && refComponents[0]?.props.selected),
                                                    toolTip: {
                                                      contents: <p>Type "natural numbers" here, which will further filter the tree.</p>,
                                                      position: 'bottom',
                                                      index: 0,
                                                      condition: (component, tutorialState) => (tutorialState.additionalStateData === undefined)
                                                    },
                                                    manipulateProps: (props: SearchInputProps) => ({
                                                      ...props,
                                                      onSearch: inject(props.onSearch, () => this.changeAdditionalStateData(() => false))
                                                    }),
                                                    elementAction: this.automateTextInput('natural numbers')
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
                                                                                          index: 1,
                                                                                          condition: (component, tutorialState) => (tutorialState.additionalStateData !== undefined)
                                                                                        }
                                                                                      }
                                                                                    ],
                                                                                    elementAction: this.automateClick()
                                                                                  }
                                                                                ],
                                                                                componentAction: (component: LibraryTreeItem) => this.changeAdditionalStateData((oldAdditionalStateData) => (oldAdditionalStateData !== undefined || component.props.selected ? component.props.selected : undefined))
                                                                              }
                                                                            ]
                                                                          }
                                                                        ]
                                                                      }
                                                                    ]
                                                                  }
                                                                ]
                                                              }
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
                                            elementAction: this.automateClick()
                                          }
                                        ]
                                      }
                                    ],
                                    manipulateProps: (props: ExpressionDialogProps) => ({
                                      ...props,
                                      onOK: inject(props.onOK, () => this.changeState(this.fillOperatorDefinition_composition))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('n');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      type._set = this.createDefinitionRefExpression(['..', 'Numbers', 'Natural', 'Natural numbers'], [[]]);
    }
  };

  // Insert composition term.

  private fillOperatorDefinition_composition: StaticTutorialState = {
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
                        key: 0,
                        children: [
                          {
                            type: 'span',
                            key: 1,
                            children: [
                              {
                                type: Expression,
                                toolTip: {
                                  contents: (
                                    <div>
                                      <p>Now we need to fill our new definition.</p>
                                      <p>In general, expressions in Slate are entered hierarchically. So we need to consider the outermost symbol, which in our case will be function composition.</p>
                                    </div>
                                  ),
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component: Expression) => !(component.state.openMenu || component.state.openDialog)
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
                                        manipulateProps: (props: ExpressionMenuRowProps) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, (result: void, action: Menu.ExpressionMenuAction) => {
                                            if (action instanceof Menu.ImmediateExpressionMenuAction) {
                                              this.changeState(this.fillOperatorDefinition_composition_arg1);
                                            }
                                          })
                                        })
                                      }
                                    ]
                                  },
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
                                                    refConstraint: (refComponents) => !(refComponents.length > 0 && refComponents[0]?.props.selected),
                                                    toolTip: {
                                                      contents: <p>Type "composition".</p>,
                                                      position: 'bottom',
                                                      index: 0,
                                                      condition: (component, tutorialState) => (tutorialState.additionalStateData === undefined)
                                                    },
                                                    manipulateProps: (props: SearchInputProps) => ({
                                                      ...props,
                                                      onSearch: inject(props.onSearch, () => this.changeAdditionalStateData(() => false))
                                                    }),
                                                    elementAction: this.automateTextInput('composition')
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
                                                                                  index: 1,
                                                                                  condition: (component, tutorialState) => (tutorialState.additionalStateData !== undefined)
                                                                                }
                                                                              }
                                                                            ],
                                                                            elementAction: this.automateClick()
                                                                          }
                                                                        ],
                                                                        componentAction: (component: LibraryTreeItem) => this.changeAdditionalStateData((oldAdditionalStateData) => (oldAdditionalStateData !== undefined || component.props.selected ? component.props.selected : undefined))
                                                                      }
                                                                    ]
                                                                  }
                                                                ]
                                                              }
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
                                            elementAction: this.automateClick()
                                          }
                                        ]
                                      }
                                    ],
                                    manipulateProps: (props: ExpressionDialogProps) => ({
                                      ...props,
                                      onOK: inject(props.onOK, () => this.changeState(this.fillOperatorDefinition_composition_arg1))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_ExplicitOperator;
      contents.definition[0] = this.createDefinitionRefExpression(['composition'], [[
        this.createSetArg('X'),
        this.createSetArg('Y'),
        this.createSetArg('Z'),
        this.createElementArg('f'),
        this.createElementArg('g')
      ]]);
    }
  };

  // Select f.

  private fillOperatorDefinition_composition_arg1: StaticTutorialState = {
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
                                      condition: (component: Expression) => !component.state.openMenu
                                    },
                                    componentAction: (component: Expression) => {
                                      (component as Expression).disableWindowClickListener();
                                      this.changeAdditionalStateData(() => component.state.openMenu);
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
                                                    manipulateProps: (props: ExpressionMenuItemProps) => ({
                                                      ...props,
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillOperatorDefinition_composition_arg2))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_ExplicitOperator;
      let composition = contents.definition[0] as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'f');
      this.setArgValue(composition.path.arguments, 'g', variableRef);
    }
  };

  // Select g.

  private fillOperatorDefinition_composition_arg2: StaticTutorialState = {
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
                                      condition: (component: Expression) => !component.state.openMenu
                                    },
                                    componentAction: (component: Expression) => this.changeAdditionalStateData(() => component.state.openMenu),
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
                                                    manipulateProps: (props: ExpressionMenuItemProps) => ({
                                                      ...props,
                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillOperatorDefinition_composition_arg2_reselection))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_ExplicitOperator;
      let composition = contents.definition[0] as Fmt.DefinitionRefExpression;
      let variableRef1 = this.createVariableRefExpression(definition, 'g');
      this.setArgValue(composition.path.arguments, 'f', variableRef1);
      let variableRef2 = this.createVariableRefExpression(definition, 'S');
      this.setArgValue(composition.path.arguments, 'X', variableRef2);
      let variableRef3 = this.createVariableRefExpression(definition, 'S');
      this.setArgValue(composition.path.arguments, 'Y', variableRef3);
      let variableRef4 = this.createVariableRefExpression(definition, 'T');
      this.setArgValue(composition.path.arguments, 'Z', variableRef4);
    }
  };

  private fillOperatorDefinition_composition_arg2_reselection: StaticTutorialState = {
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
                                      condition: (component: Expression) => !(component.state.openMenu || component.state.openDialog)
                                    },
                                    componentAction: (component: Expression) => this.changeAdditionalStateData((oldAdditionalStateData) => component.state.openMenu ? null : oldAdditionalStateData === null ? undefined : oldAdditionalStateData),
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
                                            manipulateProps: (props: ExpressionMenuRowProps) => ({
                                              ...props,
                                              onItemClicked: inject(props.onItemClicked, (result: void, action: Menu.ExpressionMenuAction) => {
                                                if (action instanceof Menu.ImmediateExpressionMenuAction) {
                                                  this.changeState(this.fillOperatorDefinition_composition_arg2_arg2);
                                                }
                                              })
                                            })
                                          }
                                        ]
                                      },
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
                                                        refConstraint: (refComponents) => !(refComponents.length > 0 && refComponents[0]?.props.selected),
                                                        toolTip: {
                                                          contents: <p>Type "power".</p>,
                                                          position: 'bottom',
                                                          index: 0,
                                                          condition: (component, tutorialState) => (tutorialState.additionalStateData === undefined)
                                                        },
                                                        manipulateProps: (props: SearchInputProps) => ({
                                                          ...props,
                                                          onSearch: inject(props.onSearch, () => this.changeAdditionalStateData(() => false))
                                                        }),
                                                        elementAction: this.automateTextInput('power')
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
                                                                                      index: 1,
                                                                                      condition: (component, tutorialState) => (tutorialState.additionalStateData !== undefined)
                                                                                    }
                                                                                  }
                                                                                ],
                                                                                elementAction: this.automateClick()
                                                                              }
                                                                            ],
                                                                            componentAction: (component: LibraryTreeItem) => this.changeAdditionalStateData((oldAdditionalStateData) => (oldAdditionalStateData !== undefined || component.props.selected ? component.props.selected : undefined))
                                                                          }
                                                                        ]
                                                                      }
                                                                    ]
                                                                  }
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
                                                elementAction: this.automateClick()
                                              }
                                            ]
                                          }
                                        ],
                                        manipulateProps: (props: ExpressionDialogProps) => ({
                                          ...props,
                                          onOK: inject(props.onOK, () => this.changeState(this.fillOperatorDefinition_composition_arg2_arg2))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_ExplicitOperator;
      let composition = contents.definition[0] as Fmt.DefinitionRefExpression;
      let power = this.createDefinitionRefExpression(['power to natural number'], [[
        this.createSetArg('X'),
        this.createElementArg('f'),
        this.createElementArg('n')
      ]]);
      let variableRef1 = this.createVariableRefExpression(definition, 'g');
      this.setArgValue(power.path.arguments, 'f', variableRef1);
      let variableRef2 = this.createVariableRefExpression(definition, 'S');
      this.setArgValue(power.path.arguments, 'X', variableRef2);
      this.setArgValue(composition.path.arguments, 'f', power);
    }
  };

  // Select n.

  private fillOperatorDefinition_composition_arg2_arg2: StaticTutorialState = {
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
                                          condition: (component: Expression) => !component.state.openMenu
                                        },
                                        componentAction: (component: Expression) => this.changeAdditionalStateData(() => component.state.openMenu),
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
                                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
                                                          ...props,
                                                          // TODO demonstrate how to enter an alternative definition (skippable)
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_ExplicitOperator;
      let composition = contents.definition[0] as Fmt.DefinitionRefExpression;
      let power = this.getElementArgValue(composition.path.arguments, 'f') as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'n');
      this.setArgValue(power.path.arguments, 'n', variableRef);
    }
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
                                      condition: (component: Expression) => !component.state.openMenu
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
                                                    manipulateProps: (props: ExpressionMenuRowProps) => ({
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
                                                          condition: (component: Expression) => !component.state.openMenu
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
                                                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
                                                          condition: (component: Expression) => !component.state.openMenu
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
                                                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
                                                          condition: (component: Expression) => !component.state.openMenu
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
                                                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
                                                          contents: <p>Enter the text "my" here, so you will recognize the definition more easily.</p>,
                                                          position: 'bottom',
                                                          index: 0,
                                                          condition: (component: Expression) => !component.state.openMenu
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
                                                                    manipulateProps: (props: ExpressionMenuTextInputProps) => ({
                                                                      ...props,
                                                                      onItemClicked: inject(props.onItemClicked, () => this.changeState(this.selectOperatorNotation_dialog_ok))
                                                                    }),
                                                                    children: [
                                                                      {
                                                                        type: UnicodeTextInput,
                                                                        children: [
                                                                          {
                                                                            type: 'input',
                                                                            elementAction: this.automateTextInput('my', true)
                                                                          }
                                                                        ]
                                                                      }
                                                                    ]
                                                                  }
                                                                ]
                                                              }
                                                            ]
                                                          }
                                                        ]
                                                      }
                                                    ]
                                                  }
                                                ]
                                              }
                                            ]
                                          }
                                        ]
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
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
                                                elementAction: this.automateClick()
                                              }
                                            ]
                                          }
                                        ],
                                        manipulateProps: (props: ExpressionDialogProps) => ({
                                          ...props,
                                          onOK: inject(props.onOK, () => this.changeState(this.submitOperator))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param1 = definition.parameters.getParameter('S');
      let paramType1 = param1.type as FmtHLM.MetaRefExpression_Set;
      paramType1.auto = new FmtHLM.MetaRefExpression_true;
      let param2 = definition.parameters.getParameter('T');
      let paramType2 = param2.type as FmtHLM.MetaRefExpression_Set;
      paramType2.auto = new FmtHLM.MetaRefExpression_true;
      let contents = definition.contents as FmtHLM.ObjectContents_ExplicitOperator;
      let body = this.createVariableRefExpression(definition, 'g');
      let sup = this.createVariableRefExpression(definition, 'n');
      let preSub = this.createVariableRefExpression(definition, 'f');
      let preSup = new Fmt.StringExpression('my');
      contents.notation = this.createDefinitionRefExpression(['SubSup'], [[
        new Fmt.Argument('body', body),
        new Fmt.Argument('sup', sup),
        new Fmt.Argument('preSub', preSub),
        new Fmt.Argument('preSup', preSup)
      ]]);
    }
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
                                <div className={'scrollable-tooltip'}>
                                  <p>Finally, you should add some documentation, including references to external material.</p>
                                  <p>At a minimum, please fill the given list of default references where applicable. Links to the corresponding definition/theorem in other theorem provers may become especially valuable in the future.</p>
                                  <p>For convenience, you can click on the "Search" button in the editor toolbar to search for a given term in all default references, either one by one or (if your browser allows it) all at once.</p>
                                  <p>However, in tutorial mode, you can skip this and just hit "Submit".</p>
                                </div>
                              ),
                              position: 'top',
                              index: 0,
                              condition: (component: Expression) => !component.state.openDialog
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
            manipulateProps: (props: ButtonProps) => ({
              ...props,
              onClick: inject(props.onClick!, () => this.changeState(this.openOperatorSourceCodeView, null))
            }),
            elementAction: this.automateClick()
          }
        ]
      }
    ]
  };

  // View source.

  private openOperatorSourceCodeView: StaticTutorialState = {
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
                  <p>As you have seen, it is possible to create formal mathematical content without editing any source code.</p>
                  <p>However, if you are interested, you can click "View Source" to see the exact details of what you have created. <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.insertTheorem_menu)}>Skip</Button></p>
                </div>
              ),
              position: 'top',
              arrow: 'right',
              index: 0
            },
            manipulateProps: (props: ButtonProps) => ({
              ...props,
              onClick: inject(props.onClick!, () => this.changeState(props.selected ? this.insertTheorem_menu : this.closeOperatorSourceCodeView))
            }),
            elementAction: this.automateClick()
          }
        ]
      }
    ]
  };

  private closeOperatorSourceCodeView: StaticTutorialState = {
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
                  <p>If you would like to see how the source code is built up during the next steps of the tutorial, you can leave this view open and click "Continue". Otherwise, please close it again.</p>
                  <p>For more information about the file format, <DocLink href="docs/format/format" onDocLinkClicked={this.onDocLinkClicked}>see here</DocLink>.</p>
                  <div className={'tutorial-tooltip-button-row'}>
                    <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.insertTheorem_menu)}>
                      {getButtonIcon(ButtonType.OK)} Continue
                    </Button>
                  </div>
                </div>
              ),
              position: 'top',
              arrow: 'right',
              index: 0
            },
            manipulateProps: (props: ButtonProps) => ({
              ...props,
              onClick: inject(props.onClick!, () => this.changeState(this.insertTheorem_menu))
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
                      condition: (component: LibraryTreeItem) => !component.state.opened
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
                              contents: (component: LibraryTreeItem) => component.state.opened ? <p>Scroll down again.</p> : <p>Open this section.</p>,
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
                                      condition: (component: MenuButton) => !component.state.menuOpen
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
                                        manipulateProps: (props: ButtonProps) => ({
                                          ...props,
                                          onClick: inject(props.onClick!, () => this.changeState(this.insertTheorem_dialog_name))
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
        componentAction: (component: InsertDialog) => {
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
        manipulateProps: (props: InsertDialogProps) => ({
          ...props,
          onOK: inject(props.onOK, (result: CachedPromise<LibraryDefinition | undefined>) => result.then((libraryDefinition: LibraryDefinition | undefined) => {
            if (libraryDefinition) {
              this.theorem = libraryDefinition;
              this.changeState(this.insertTheoremParameters_phi, libraryDefinition);
            }
          }))
        })
      }
    ]
  };

  // Insert parameter φ.

  private insertTheoremParameters_phi: StaticTutorialState = {
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
                          condition: (component: Expression) => !component.state.openMenu
                        },
                        children: [
                          {
                            type: PromiseHelper,
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
                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_phi_name))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.addElementParameter(definition, 'x');
    }
  };

  private insertTheoremParameters_phi_name: StaticTutorialState = {
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
                                    type: UnicodeTextInput,
                                    children: [
                                      {
                                        type: 'input',
                                        elementAction: this.automateTextInput('\\varphi', true)
                                      }
                                    ],
                                    toolTip: {
                                      contents: <p>Name this parameter "φ" by typing "\varphi".</p>,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[0].name === 'φ') {
            this.changeState(this.insertTheoremParameters_phi_set);
          }
        })
      }
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.changeParameterName(definition, 'φ');
    }
  };

  private insertTheoremParameters_phi_set: StaticTutorialState = {
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
                                  contents: <p>Select the set of functions, which should be in the list of recently used definitions. <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.skipStates([this.insertTheoremParameters_phi_set, this.insertTheoremParameters_phi_set_arg1, this.insertTheoremParameters_phi_set_arg2], this.insertTheoremParameters_n)}>Skip</Button></p>,
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component: Expression) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
                                children: [
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 2,
                                        manipulateProps: (props: ExpressionMenuRowProps) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_phi_set_arg1))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('φ');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      type._set = this.createDefinitionRefExpression(['Functions'], [[
        this.createSetArg('X'),
        this.createSetArg('Y')
      ]]);
    }
  };

  private insertTheoremParameters_phi_set_arg1: StaticTutorialState = {
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
                                      contents: <p>Select the set of natural numbers, which should also be in the list of recently used definitions. <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.skipStates([this.insertTheoremParameters_phi_set_arg1, this.insertTheoremParameters_phi_set_arg2], this.insertTheoremParameters_n)}>Skip</Button></p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component: Expression) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
                                    children: [
                                      {
                                        type: ExpressionMenu,
                                        children: [
                                          {
                                            type: ExpressionMenuRow,
                                            key: 4,
                                            manipulateProps: (props: ExpressionMenuRowProps) => ({
                                              ...props,
                                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_phi_set_arg2))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('φ');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      let functions = type._set as Fmt.DefinitionRefExpression;
      let naturalNumbers = this.createDefinitionRefExpression(['..', 'Numbers', 'Natural', 'Natural numbers'], [[]]);
      this.setArgValue(functions.path.arguments, 'X', naturalNumbers);
    }
  };

  private insertTheoremParameters_phi_set_arg2: StaticTutorialState = {
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
                                      contents: <p>Same here. <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.skipStates([this.insertTheoremParameters_phi_set_arg2], this.insertTheoremParameters_n)}>Skip</Button></p>,
                                      position: 'bottom',
                                      index: 0,
                                      condition: (component: Expression) => !component.state.openMenu
                                    },
                                    elementAction: this.automateClick(),
                                    children: [
                                      {
                                        type: ExpressionMenu,
                                        children: [
                                          {
                                            type: ExpressionMenuRow,
                                            key: 4,
                                            manipulateProps: (props: ExpressionMenuRowProps) => ({
                                              ...props,
                                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.insertTheoremParameters_n))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('φ');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      let functions = type._set as Fmt.DefinitionRefExpression;
      let naturalNumbers = this.createDefinitionRefExpression(['..', 'Numbers', 'Natural', 'Natural numbers'], [[]]);
      this.setArgValue(functions.path.arguments, 'Y', naturalNumbers);
    }
  };

  // Insert parameter n.

  private insertTheoremParameters_n: StaticTutorialState = {
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
                              contents: <p>Insert a natural number "n". <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.skipStates([this.insertTheoremParameters_n, this.insertTheoremParameters_n_name, this.insertTheoremParameters_n_set], this.fillTheoremClaim_equality)}>Skip</Button></p>,
                              position: 'bottom',
                              index: 0,
                              condition: (component: Expression) => !component.state.openMenu
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
                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.addElementParameter(definition, 'x');
    }
  };

  private insertTheoremParameters_n_name: StaticTutorialState = {
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
                                    type: UnicodeTextInput,
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
            ]
          }
        ],
        componentAction: createContentAction((definition: Fmt.Definition) => {
          if (definition.parameters[1].name === 'n') {
            this.changeState(this.insertTheoremParameters_n_set);
          }
        })
      }
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      this.changeParameterName(definition, 'n');
    }
  };

  private insertTheoremParameters_n_set: StaticTutorialState = {
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
                                  condition: (component: Expression) => !component.state.openMenu
                                },
                                elementAction: this.automateClick(),
                                children: [
                                  {
                                    type: ExpressionMenu,
                                    children: [
                                      {
                                        type: ExpressionMenuRow,
                                        key: 2,
                                        manipulateProps: (props: ExpressionMenuRowProps) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let param = definition.parameters.getParameter('n');
      let type = param.type as FmtHLM.MetaRefExpression_Element;
      type._set = this.createDefinitionRefExpression(['..', 'Numbers', 'Natural', 'Natural numbers'], [[]]);
    }
  };

  // Insert equality.

  private fillTheoremClaim_equality: StaticTutorialState = {
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
                    toolTip: {
                      contents: <p>Now we need to state the claim of the theorem, which will be an equality.</p>,
                      position: 'bottom',
                      index: 0,
                      condition: (component: Expression) => !component.state.openMenu
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
                            manipulateProps: (props: ExpressionMenuRowProps) => ({
                              ...props,
                              onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg1))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_StandardTheorem;
      contents.claim = new FmtHLM.MetaRefExpression_equals(new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm), new Fmt.PlaceholderExpression(HLMExpressionType.ElementTerm));
    }
  };

  // Select "my definition".

  private fillTheoremClaim_equality_arg1: StaticTutorialState = {
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
                          contents: <p>Here, please select the definition you just created, which should be the first or second item in the list of recently used definitions.</p>,
                          position: 'bottom',
                          index: 0,
                          condition: (component: Expression) => !component.state.openMenu
                        },
                        elementAction: this.automateClick(),
                        children: [
                          {
                            type: ExpressionMenu,
                            children: [
                              {
                                type: ExpressionMenuRow,
                                key: 2,
                                manipulateProps: (props: ExpressionMenuRowProps) => ({
                                  ...props,
                                  onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg1_arg1))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_StandardTheorem;
      let equality = contents.claim as FmtHLM.MetaRefExpression_equals;
      equality.terms[0] = this.createDefinitionRefExpression([this.operator!.definition.name], [[
        this.createSetArg('S'),
        this.createSetArg('T'),
        this.createElementArg('f'),
        this.createElementArg('g'),
        this.createElementArg('n')
      ]]);
    }
  };

  // Select φ.

  private fillTheoremClaim_equality_arg1_arg1: StaticTutorialState = {
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
                            type: SubSup,
                            children: [
                              {
                                type: Expression,
                                key: 'preSub',
                                toolTip: {
                                  contents: <p>Select φ here.</p>,
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component: Expression) => !component.state.openMenu
                                },
                                componentAction: (component: Expression) => this.changeAdditionalStateData(() => component.state.openMenu),
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
                                                manipulateProps: (props: ExpressionMenuItemProps) => ({
                                                  ...props,
                                                  onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg1_arg2))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_StandardTheorem;
      let equality = contents.claim as FmtHLM.MetaRefExpression_equals;
      let operator = equality.terms[0] as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'φ');
      this.setArgValue(operator.path.arguments, 'f', variableRef);
    }
  };

  // Select identity function.

  private fillTheoremClaim_equality_arg1_arg2: StaticTutorialState = {
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
                            type: SubSup,
                            children: [
                              {
                                type: Expression,
                                key: 'body',
                                toolTip: {
                                  contents: <p>Here, please select the identity function, which is a definition in the library.</p>,
                                  position: 'bottom',
                                  index: 0,
                                  condition: (component: Expression) => !(component.state.openMenu || component.state.openDialog)
                                },
                                componentAction: (component: Expression) => this.changeAdditionalStateData((oldAdditionalStateData) => component.state.openMenu ? null : oldAdditionalStateData === null ? undefined : oldAdditionalStateData),
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
                                        manipulateProps: (props: ExpressionMenuRowProps) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, (result: void, action: Menu.ExpressionMenuAction) => {
                                            if (action instanceof Menu.ImmediateExpressionMenuAction) {
                                              this.changeState(this.fillTheoremClaim_equality_arg1_arg3);
                                            } else {
                                              this.changeAdditionalStateData(() => undefined);
                                            }
                                          })
                                        })
                                      }
                                    ]
                                  },
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
                                                    refConstraint: (refComponents) => !(refComponents.length > 0 && refComponents[0]?.props.selected),
                                                    toolTip: {
                                                      contents: <p>Type "identity".</p>,
                                                      position: 'bottom',
                                                      index: 0,
                                                      condition: (component, tutorialState) => (tutorialState.additionalStateData === undefined)
                                                    },
                                                    manipulateProps: (props: SearchInputProps) => ({
                                                      ...props,
                                                      onSearch: inject(props.onSearch, () => this.changeAdditionalStateData(() => false))
                                                    }),
                                                    elementAction: this.automateTextInput('identity')
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
                                                                        componentAction: (component: LibraryTreeItem) => this.changeAdditionalStateData((oldAdditionalStateData) => (oldAdditionalStateData !== undefined || component.props.selected ? component.props.selected : undefined))
                                                                      }
                                                                    ]
                                                                  }
                                                                ]
                                                              }
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
                                            elementAction: this.automateClick()
                                          }
                                        ]
                                      }
                                    ],
                                    manipulateProps: (props: ExpressionDialogProps) => ({
                                      ...props,
                                      onOK: inject(props.onOK, () => this.changeState(this.fillTheoremClaim_equality_arg1_arg3))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_StandardTheorem;
      let equality = contents.claim as FmtHLM.MetaRefExpression_equals;
      let operator = equality.terms[0] as Fmt.DefinitionRefExpression;
      let identity = this.createDefinitionRefExpression(['identity'], [[
        this.createSetArg('X')
      ]]);
      let naturalNumbers = this.createDefinitionRefExpression(['..', 'Numbers', 'Natural', 'Natural numbers'], [[]]);
      this.setArgValue(identity.path.arguments, 'X', naturalNumbers);
      this.setArgValue(operator.path.arguments, 'g', identity);
    }
  };

  // Select n.

  private fillTheoremClaim_equality_arg1_arg3: StaticTutorialState = {
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
                            type: SubSup,
                            children: [
                              {
                                type: Expression,
                                key: 'body',
                                toolTip: {
                                  contents: <p>Note how Slate automatically figured out that this can only be the identity function on the natural numbers. Moreover, parentheses are displayed wherever the notation would cause ambiguities.</p>,
                                  position: 'top',
                                  index: 0,
                                  condition: (component: Expression) => !component.state.openMenu
                                }
                              },
                              {
                                type: Expression,
                                key: 'sup',
                                toolTip: {
                                  contents: <p>Select n here.</p>,
                                  position: 'bottom',
                                  index: 1,
                                  condition: (component: Expression) => !component.state.openMenu
                                },
                                componentAction: (component: Expression) => this.changeAdditionalStateData(() => component.state.openMenu),
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
                                                manipulateProps: (props: ExpressionMenuItemProps) => ({
                                                  ...props,
                                                  onItemClicked: inject(props.onItemClicked, () => this.changeState(this.fillTheoremClaim_equality_arg2))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_StandardTheorem;
      let equality = contents.claim as FmtHLM.MetaRefExpression_equals;
      let operator = equality.terms[0] as Fmt.DefinitionRefExpression;
      let variableRef = this.createVariableRefExpression(definition, 'n');
      this.setArgValue(operator.path.arguments, 'n', variableRef);
    }
  };

  // Select φ on the right side.

  private fillTheoremClaim_equality_arg2: StaticTutorialState = {
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
                          contents: <p>Select φ here.</p>,
                          position: 'bottom',
                          index: 0,
                          condition: (component: Expression) => !component.state.openMenu
                        },
                        componentAction: (component: Expression) => this.changeAdditionalStateData(() => component.state.openMenu),
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
                                        manipulateProps: (props: ExpressionMenuItemProps) => ({
                                          ...props,
                                          onItemClicked: inject(props.onItemClicked, () => this.changeState(this.openTheoremSourceCodeView))
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
    ],
    applyExpectedChange: (definition: Fmt.Definition) => {
      let contents = definition.contents as FmtHLM.ObjectContents_StandardTheorem;
      let equality = contents.claim as FmtHLM.MetaRefExpression_equals;
      equality.terms[1] = this.createVariableRefExpression(definition, 'φ');
      let operator = equality.terms[0] as Fmt.DefinitionRefExpression;
      let naturalNumbers1 = this.createDefinitionRefExpression(['..', 'Numbers', 'Natural', 'Natural numbers'], [[]]);
      this.setArgValue(operator.path.arguments, 'S', naturalNumbers1);
      let naturalNumbers2 = this.createDefinitionRefExpression(['..', 'Numbers', 'Natural', 'Natural numbers'], [[]]);
      this.setArgValue(operator.path.arguments, 'T', naturalNumbers2);
    }
  };

  // View source to see inferred arguments.

  private openTheoremSourceCodeView: StaticTutorialState = {
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
                  <p>By the way, what about the parameters S and T? To see that they have been inferred automatically, you can take a look at the source code. <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.insertProof)}>Skip</Button></p>
                </div>
              ),
              position: 'top',
              arrow: 'right',
              index: 0
            },
            manipulateProps: (props: ButtonProps) => ({
              ...props,
              onClick: inject(props.onClick!, () => this.changeState(props.selected ? this.insertProof : this.closeTheoremSourceCodeView))
            }),
            elementAction: this.automateClick()
          }
        ]
      }
    ]
  };

  private closeTheoremSourceCodeView: StaticTutorialState = {
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
              arrow: 'right',
              index: 0
            },
            manipulateProps: (props: ButtonProps) => ({
              ...props,
              onClick: inject(props.onClick!, () => this.changeState(this.insertProof))
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
            manipulateProps: (props: ButtonProps) => ({
              ...props,
              onClick: inject(props.onClick!, () => this.changeState(this.checkDefinition, null))
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
        constraint: createLibraryDefinitionConstraint((libraryDefinition) => (libraryDefinition === this.theorem)),
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
                        children: [
                          {
                            type: PromiseHelper,
                            children: [
                              {
                                type: 'a',
                                elementAction: this.automateClick()
                              },
                              {
                                type: 'span',
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
      },
      {
        type: LibraryItem,
        constraint: createLibraryDefinitionConstraint((libraryDefinition) => (libraryDefinition === this.operator)),
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
                          <p>Note that since the user interface is not finished yet, not everything will work as expected. As a workaround, please try out the <a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate" target="_blank">Visual Studio Code extension</a>, where you can always switch to the text editor as a fallback.</p>
                          <div className={'tutorial-tooltip-button-row'}>
                            <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.experiment, null)}>
                              Continue in tutorial mode
                            </Button>
                            <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(undefined, null)}>
                              {getButtonIcon(ButtonType.Close)} Exit tutorial
                            </Button>
                          </div>
                        </div>
                      ),
                      position: 'bottom',
                      index: 0
                    },
                    elementAction: () => {
                      if (this.runAutomatically) {
                        this.changeState(undefined, null);
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
  };

  private experiment: StaticTutorialState = {};

  start() {
    this.changeState(this.introduction, null);
  }

  private changeState(staticState: StaticTutorialState | undefined, newEditedDefinition?: LibraryDefinition | null): void {
    if (staticState) {
      let stateTransitionFn = (oldTutorialState: DynamicTutorialState | undefined) => {
        let result: DynamicTutorialState = {
          ...oldTutorialState,
          staticState: staticState,
          refComponents: [],
          additionalStateData: undefined,
          checkPreconditions: this.checkPreconditions
        };
        let oldStaticState = oldTutorialState?.staticState;
        if (oldStaticState !== staticState) {
          if (result.editedDefinition && result.initialDefinitionContents && oldStaticState?.applyExpectedChange) {
            let expectedContents = result.initialDefinitionContents.clone();
            oldStaticState.applyExpectedChange(expectedContents, staticState);
            let actualContents = result.editedDefinition.definition;
            if (actualContents.toString() === expectedContents.toString()) {
              result.initialDefinitionContents = expectedContents;
              result.initialDefinitionContentsState = result;
            } else if (oldTutorialState) {
              return this.getRevertUnexpectedChangeState(oldTutorialState);
            }
          }
        }
        if (newEditedDefinition !== undefined) {
          if (newEditedDefinition) {
            result.editedDefinition = newEditedDefinition;
            result.initialDefinitionContents = newEditedDefinition.definition.clone();
            result.initialDefinitionContentsState = result;
          } else {
            result.editedDefinition = undefined;
            result.initialDefinitionContents = undefined;
            result.initialDefinitionContentsState = undefined;
          }
        }
        return result;
      };
      this.onChangeTutorialState(stateTransitionFn);
    } else {
      this.onChangeTutorialState(() => undefined);
    }
  }

  private changeAdditionalStateData(changeData: (oldAdditionalStateData: any) => any): void {
    let stateTransitionFn = (oldTutorialState: DynamicTutorialState | undefined): DynamicTutorialState | undefined => {
      if (oldTutorialState) {
        let oldAdditionalStateData = oldTutorialState.additionalStateData;
        let newAdditionalStateData = changeData(oldAdditionalStateData);
        if (newAdditionalStateData !== oldAdditionalStateData) {
          return {
            ...oldTutorialState,
            additionalStateData: newAdditionalStateData
          };
        }
      }
      return oldTutorialState;
    };
    this.onChangeTutorialState(stateTransitionFn);
  }

  private checkPreconditions = (tutorialState: DynamicTutorialState, currentEditedDefinition: LibraryDefinition | undefined): DynamicTutorialState | undefined => {
    let editedDefinition = tutorialState.editedDefinition;
    if (editedDefinition) {
      if (currentEditedDefinition !== editedDefinition) {
        return this.getReturnToDefinitionState(editedDefinition);
      } else if (tutorialState.initialDefinitionContents) {
        let contentsAsString = editedDefinition.definition.toString();
        if (contentsAsString === tutorialState.initialDefinitionContents.toString()) {
          return undefined;
        }
        if (tutorialState.staticState.applyExpectedChange) {
          let finalContents = tutorialState.initialDefinitionContents.clone();
          tutorialState.staticState.applyExpectedChange(finalContents);
          if (contentsAsString === finalContents.toString()) {
            return undefined;
          }
        }
        return this.getRevertUnexpectedChangeState(tutorialState);
      }
    }
    return undefined;
  };

  private getReturnToDefinitionState(editedDefinition: LibraryDefinition): DynamicTutorialState {
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
      },
      refComponents: [],
      testFailure: new Error('Unexpectedly left definition')
    };
  }

  private getRevertUnexpectedChangeState(tutorialState: DynamicTutorialState): DynamicTutorialState {
    return {
      staticState: this.revertUnexpectedChange,
      refComponents: [],
      editedDefinition: tutorialState.editedDefinition,
      initialDefinitionContents: tutorialState.initialDefinitionContents,
      initialDefinitionContentsState: tutorialState.initialDefinitionContentsState,
      testFailure: new Error('Definition contents do not match expectation')
    };
  }

  private revertUnexpectedChange: StaticTutorialState = {
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
                toolTip: {
                  contents: (
                    <div className={'large-tooltip'}>
                      <p>You have entered something unexpected. To continue the tutorial, this change must be reverted.</p>
                      <div className={'tutorial-tooltip-button-row'}>
                        <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.revertChanges()}>
                          Revert change
                        </Button>
                        <Button className={'tutorial-tooltip-button standalone'} onClick={() => this.changeState(this.experiment, null)}>
                          Continue experimenting
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
  };

  private revertChanges(): void {
    let stateTransitionFn = (currentState: DynamicTutorialState | undefined) => {
      if (!currentState) {
        return undefined;
      }
      if (currentState.initialDefinitionContents) {
        this.onReplaceDefinitionContents(currentState.initialDefinitionContents);
      }
      return currentState.initialDefinitionContentsState;
    };
    this.onChangeTutorialState(stateTransitionFn);
  }

  private skipStates(skippedStates: StaticTutorialState[], targetState: StaticTutorialState): void {
    let stateTransitionFn = (oldTutorialState: DynamicTutorialState | undefined) => {
      if (!oldTutorialState) {
        return undefined;
      }
      if (oldTutorialState.initialDefinitionContents) {
        let definitionContents = oldTutorialState.initialDefinitionContents.clone();
        for (let skippedState of skippedStates) {
          skippedState.applyExpectedChange?.(definitionContents, targetState);
        }
        this.onReplaceDefinitionContents(definitionContents);
        let result: DynamicTutorialState = {
          ...oldTutorialState,
          staticState: targetState,
          refComponents: [],
          initialDefinitionContents: definitionContents,
          additionalStateData: undefined,
          checkPreconditions: this.checkPreconditions
        };
        result.initialDefinitionContentsState = result;
        return result;
      }
      return undefined;
    };
    this.onChangeTutorialState(stateTransitionFn);
  }

  private automateClick(delay: number = defaultDelay) {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done) {
        let clickableElement = this.findClickableReactElement(reactElement);
        if (clickableElement) {
          let props = clickableElement.props;
          if (props) {
            done = true;
            let simulateClick = () => {
              if (props.onMouseDown) {
                let mouseDownEvent = createDummyEvent(htmlElement);
                props.onMouseDown(mouseDownEvent);
              }
              if (props.onMouseUp) {
                let mouseUpEvent = createDummyEvent(htmlElement);
                props.onMouseUp(mouseUpEvent);
              }
              if (props.onClick) {
                let clickEvent = createDummyEvent(htmlElement);
                props.onClick(clickEvent);
              }
            };
            setTimeout(simulateClick, delay);
          }
        }
      }
    };
  }

  private findClickableReactElement(reactElement: React.ReactElement): React.ReactElement | undefined {
    for (;;) {
      if (typeof reactElement.type === 'string' && (reactElement.props.onMouseDown || reactElement.props.onMouseUp || reactElement.props.onClick)) {
        return reactElement;
      }
      let childNode = reactElement.props.children;
      if (!childNode) {
        return undefined;
      }
      while (Array.isArray(childNode)) {
        if (!childNode.length) {
          return undefined;
        }
        childNode = childNode[0];
      }
      if (typeof childNode !== 'object') {
        return undefined;
      }
      reactElement = childNode;
    }
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

  private automateTextInput(text: string, pressEnter: boolean = false, delay: number = defaultDelay) {
    let done = false;
    return (reactElement: React.ReactElement, htmlElement: HTMLElement) => {
      if (this.runAutomatically && !done && htmlElement instanceof HTMLInputElement) {
        done = true;
        let simulateTextInput = () => {
          htmlElement.value = text;
          if (reactElement.props.onChange) {
            reactElement.props.onChange(createDummyEvent(htmlElement));
          }
          if (pressEnter && reactElement.props.onKeyPress) {
            let enterKeyEvent = createDummyEvent(htmlElement);
            enterKeyEvent.key = 'Enter';
            reactElement.props.onKeyPress(enterKeyEvent);
          }
        };
        setTimeout(simulateTextInput, delay);
      }
    };
  }

  private addParameter(definition: Fmt.Definition, name: string, type: Fmt.Expression): void {
    definition.parameters.push(new Fmt.Parameter(name, type));
  }

  private addSetParameter(definition: Fmt.Definition, name: string): void {
    let type = new FmtHLM.MetaRefExpression_Set;
    this.addParameter(definition, name, type);
  }

  private addSubsetParameter(definition: Fmt.Definition, name: string): void {
    let superset = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    let type = new FmtHLM.MetaRefExpression_Subset(superset);
    this.addParameter(definition, name, type);
  }

  private addElementParameter(definition: Fmt.Definition, name: string): void {
    let set = new Fmt.PlaceholderExpression(HLMExpressionType.SetTerm);
    let type = new FmtHLM.MetaRefExpression_Element(set);
    this.addParameter(definition, name, type);
  }

  private addParameterToGroup(definition: Fmt.Definition, name: string): void {
    this.addParameter(definition, name, definition.parameters[definition.parameters.length - 1].type);
  }

  private changeParameterName(definition: Fmt.Definition, name: string): void {
    if (definition.parameters.length) {
      definition.parameters[definition.parameters.length - 1].name = name;
    }
  }

  private createVariableRefExpression(definition: Fmt.Definition, name: string): Fmt.VariableRefExpression {
    let variable = definition.parameters.getParameter(name);
    return new Fmt.VariableRefExpression(variable);
  }

  private createDefinitionRefExpression(path: string[], args: Fmt.Argument[][]): Fmt.DefinitionRefExpression {
    let parentPath: Fmt.PathItem | undefined = undefined;
    for (let pathIndex = 0; pathIndex < path.length - args.length; pathIndex++) {
      let pathComponent = path[pathIndex];
      let pathItem: Fmt.PathItem;
      if (pathComponent === '.') {
        pathItem = new Fmt.IdentityPathItem;
      } else if (pathComponent === '..') {
        pathItem = new Fmt.ParentPathItem;
      } else {
        pathItem = new Fmt.NamedPathItem(pathComponent);
      }
      pathItem.parentPath = parentPath;
      parentPath = pathItem;
    }
    for (let argIndex = 0; argIndex < args.length; argIndex++) {
      let pathIndex = path.length - args.length + argIndex;
      let pathItem = new Fmt.Path(path[pathIndex]);
      pathItem.arguments.push(...args[argIndex]);
      pathItem.parentPath = parentPath;
      parentPath = pathItem;
    }
    return new Fmt.DefinitionRefExpression(parentPath as Fmt.Path);
  }

  private createPlaceholderArg(name: string, expressionType: HLMExpressionType): Fmt.Argument {
    return new Fmt.Argument(name, new Fmt.PlaceholderExpression(expressionType));
  }

  private createSetArg(name: string): Fmt.Argument {
    return this.createPlaceholderArg(name, HLMExpressionType.SetTerm);
  }

  private createElementArg(name: string): Fmt.Argument {
    return this.createPlaceholderArg(name, HLMExpressionType.ElementTerm);
  }

  private getSetArgValue(argumentList: Fmt.ArgumentList, name: string): Fmt.Expression {
    let valueExpression = argumentList.getValue(name);
    let contents = FmtHLM.ObjectContents_SetArg.createFromExpression(valueExpression);
    return contents._set;
  }

  private getSubsetArgValue(argumentList: Fmt.ArgumentList, name: string): Fmt.Expression {
    let valueExpression = argumentList.getValue(name);
    let contents = FmtHLM.ObjectContents_SubsetArg.createFromExpression(valueExpression);
    return contents._set;
  }

  private getElementArgValue(argumentList: Fmt.ArgumentList, name: string): Fmt.Expression {
    let valueExpression = argumentList.getValue(name);
    let contents = FmtHLM.ObjectContents_ElementArg.createFromExpression(valueExpression);
    return contents.element;
  }

  private setArgValue(argumentList: Fmt.ArgumentList, name: string, value: Fmt.Expression): void {
    argumentList.setValue(name, undefined, value);
  }
}

export function startTutorial(onChangeTutorialState: ChangeTutorialStateFn, onReplaceDefinitionContents: ReplaceDefinitionContentsFn, onDocLinkClicked: OnDocLinkClicked, withTouchWarning: boolean, runAutomatically: boolean = false): void {
  let tutorialStates = new TutorialStates(onChangeTutorialState, onReplaceDefinitionContents, onDocLinkClicked, withTouchWarning, runAutomatically);
  tutorialStates.start();
}
