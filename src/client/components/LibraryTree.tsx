import * as React from 'react';
import './LibraryTree.css';
import * as Fmt from '../../shared/format/format';
import * as FmtUtils from '../../shared/format/utils';
import * as FmtLibrary from '../../shared/logics/library';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryDefinitionState } from '../../shared/data/libraryDataProvider';
import * as Logic from '../../shared/logics/logic';
import Expression, { ExpressionInteractionHandler } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';
import { ButtonType, getButtonIcon, getButtonIconContents, getSectionIcon, getSectionIconContents, getDefinitionIcon, getDefinitionIconContents, getInsertIcon } from '../utils/icons';
import Button from './Button';

const Loading = require('react-loading-animation');
const ToolTip = require('react-portal-tooltip').default;

export type OnFilter = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => CachedPromise<boolean>;
export type OnItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => void;
export type OnInsertButtonClicked = (libraryDataProvider: LibraryDataProvider, section: LibraryDefinition, definitionType: Logic.LogicDefinitionTypeDescription | undefined) => void;

interface LibraryTreeProps {
  libraryDataProvider: LibraryDataProvider;
  templates?: Fmt.File;
  parentScrollPane: HTMLElement | null;
  onFilter?: OnFilter;
  selectedItemPath?: Fmt.Path;
  interactionHandler?: ExpressionInteractionHandler;
  onItemClicked?: OnItemClicked;
  onInsertButtonClicked?: OnInsertButtonClicked;
}

function LibraryTree(props: LibraryTreeProps): React.ReactElement {
  let innerProps: InnerLibraryTreeProps = {
    ...props,
    sectionPromise: props.libraryDataProvider.fetchLocalSection(),
    itemNumber: [],
    indent: 0,
  };
  return (
    <div className={'tree'}>
      {InnerLibraryTreeItems(innerProps)}
    </div>
  );
}

export interface LibraryItemListEntry {
  libraryDataProvider: LibraryDataProvider;
  libraryDefinition: LibraryDefinition;
  absolutePath: Fmt.Path;
  localPath: Fmt.Path;
  itemInfo: LibraryItemInfo;
}

interface LibraryItemListProps extends LibraryTreeProps {
  items: LibraryItemListEntry[];
}

export function LibraryItemList(props: LibraryItemListProps): React.ReactElement {
  return (
    <div className={'tree'}>
      {props.items.map((entry: LibraryItemListEntry, index: number) => {
        let selected = FmtUtils.arePathsEqual(entry.absolutePath, props.selectedItemPath);
        return <LibraryTreeItem libraryDataProvider={entry.libraryDataProvider} libraryDefinition={entry.libraryDefinition} isSubsection={false} path={entry.localPath} itemInfo={entry.itemInfo} templates={props.templates} parentScrollPane={props.parentScrollPane} onFilter={props.onFilter} selected={selected} interactionHandler={props.interactionHandler} onItemClicked={props.onItemClicked} key={entry.absolutePath.toString()} indent={1}/>;
      })}
    </div>
  );
}

interface InnerLibraryTreeProps extends LibraryTreeProps {
  sectionPromise?: CachedPromise<LibraryDefinition>;
  libraryDefinition?: LibraryDefinition;
  innerDefinitions?: Fmt.Definition[];
  itemNumber: number[];
  indent: number;
}

function renderLibraryTreeItems(props: InnerLibraryTreeProps, items: (Fmt.Expression | Fmt.Definition)[], section: LibraryDefinition | undefined): React.ReactElement {
  let parentPath: Fmt.Path | undefined = undefined;
  if (props.libraryDefinition) {
    parentPath = new Fmt.Path;
    parentPath.name = props.libraryDefinition.definition.name;
  }

  let selectedItemPathHead: Fmt.NamedPathItem | undefined = undefined;
  let selectedItemPathTail: Fmt.Path | undefined = undefined;
  if (props.selectedItemPath) {
    if (props.selectedItemPath.parentPath) {
      let item: Fmt.PathItem | undefined = props.selectedItemPath;
      selectedItemPathTail = new Fmt.Path;
      selectedItemPathTail.name = props.selectedItemPath.name;
      selectedItemPathHead = selectedItemPathTail;
      for (item = item.parentPath; item instanceof Fmt.NamedPathItem; item = item.parentPath) {
        let itemCopy = new Fmt.NamedPathItem;
        itemCopy.name = item.name;
        if (item.parentPath) {
          selectedItemPathHead.parentPath = itemCopy;
        }
        selectedItemPathHead = itemCopy;
      }
    } else {
      selectedItemPathHead = props.selectedItemPath;
    }
  }

  let index = 0;
  let treeItems: React.ReactNodeArray = [];
  for (let item of items) {
    if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection || item instanceof Fmt.Definition) {
      let isSubsection = item instanceof FmtLibrary.MetaRefExpression_subsection;
      let path: Fmt.Path;
      if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
        path = (item.ref as Fmt.DefinitionRefExpression).path;
      } else {
        path = new Fmt.Path;
        path.name = item.name;
        path.parentPath = parentPath;
      }
      let selected = false;
      let selectedChildPath: Fmt.Path | undefined = undefined;
      if (selectedItemPathHead && path.name === selectedItemPathHead.name) {
        if (selectedItemPathTail) {
          selectedChildPath = selectedItemPathTail;
        } else {
          selected = true;
        }
      }
      let itemInfo: LibraryItemInfo = {
        itemNumber: [...props.itemNumber, index + 1],
        type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
        title: item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection ? item.title : undefined
      };
      treeItems.push(<LibraryTreeItem libraryDataProvider={props.libraryDataProvider} libraryDefinition={props.libraryDefinition} isSubsection={isSubsection} path={path} itemInfo={itemInfo} templates={props.templates} parentScrollPane={props.parentScrollPane} onFilter={props.onFilter} selected={selected} selectedChildPath={selectedChildPath} interactionHandler={props.interactionHandler} onItemClicked={props.onItemClicked} onInsertButtonClicked={props.onInsertButtonClicked} key={path.name} indent={props.indent}/>);
    }
    index++;
  }

  if (section && props.onInsertButtonClicked) {
    treeItems.push(<LibraryTreeInsertionItem libraryDataProvider={props.libraryDataProvider} parentScrollPane={props.parentScrollPane} section={section} onInsertButtonClicked={props.onInsertButtonClicked} key={'<insert>'} indent={props.indent}/>);
  }

  return <>{treeItems}</>;
}

function InnerLibraryTreeItems(props: InnerLibraryTreeProps): React.ReactElement | null {
  if (props.sectionPromise) {
    let render = props.sectionPromise.then((section: LibraryDefinition) => {
      if (section.definition.contents instanceof FmtLibrary.ObjectContents_Section) {
        return renderLibraryTreeItems(props, section.definition.contents.items, section);
      } else {
        return <div className={'tree-item error'}>Error: Invalid section content type</div>;
      }
    });
    return renderPromise(render);
  } else if (props.innerDefinitions) {
    return renderLibraryTreeItems(props, props.innerDefinitions, undefined);
  } else {
    return null;
  }
}

interface VisibilityResult {
  visible: CachedPromise<boolean>;
  selectable: CachedPromise<boolean>;
}

function checkVisibility(libraryDataProvider: LibraryDataProvider, path: Fmt.Path, isSubsection: boolean, libraryDefinition: LibraryDefinition, definition: Fmt.Definition, onFilter: OnFilter): VisibilityResult {
  if (isSubsection) {
    let innerLibraryDataProvider = libraryDataProvider.getProviderForSection(path);
    let resultPromise = CachedPromise.resolve(false);
    if (definition.contents instanceof FmtLibrary.ObjectContents_Section) {
      for (let item of definition.contents.items) {
        resultPromise = resultPromise.then((currentResult: boolean) => {
          if (currentResult) {
            return true;
          } else {
            if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
              let itemIsSubsection = item instanceof FmtLibrary.MetaRefExpression_subsection;
              let itemPath = (item.ref as Fmt.DefinitionRefExpression).path;
              let itemDefinitionPromise: CachedPromise<LibraryDefinition>;
              if (itemIsSubsection) {
                itemDefinitionPromise = innerLibraryDataProvider.fetchSubsection(itemPath, undefined, false);
              } else {
                itemDefinitionPromise = innerLibraryDataProvider.fetchItem(itemPath, false);
              }
              return itemDefinitionPromise.then((itemDefinition: LibraryDefinition) => checkVisibility(innerLibraryDataProvider, itemPath, itemIsSubsection, itemDefinition, itemDefinition.definition, onFilter).visible);
            } else {
              return false;
            }
          }
        });
      }
    }
    return {
      visible: resultPromise,
      selectable: CachedPromise.resolve(false)
    };
  } else {
    let ownResultPromise = onFilter(libraryDataProvider, path, libraryDefinition, definition);
    let resultPromise = ownResultPromise;
    for (let innerDefinition of definition.innerDefinitions) {
      resultPromise = resultPromise.then((currentResult: boolean) => {
        if (currentResult) {
          return true;
        } else {
          let innerPath = new Fmt.Path;
          innerPath.name = innerDefinition.name;
          innerPath.parentPath = path;
          return checkVisibility(libraryDataProvider, innerPath, false, libraryDefinition, innerDefinition, onFilter).visible;
        }
      });
    }
    return {
      visible: resultPromise,
      selectable: ownResultPromise
    };
  }
}

let previewContents: React.ReactNode = null;

interface LibraryTreeItemBaseProps {
  libraryDataProvider: LibraryDataProvider;
  parentScrollPane: HTMLElement | null;
  indent: number;
}

interface LibraryTreeItemProps extends LibraryTreeItemBaseProps {
  libraryDefinition?: LibraryDefinition;
  isSubsection: boolean;
  path: Fmt.Path;
  itemInfo: LibraryItemInfo;
  templates?: Fmt.File;
  onFilter?: OnFilter;
  selected: boolean;
  selectedChildPath?: Fmt.Path;
  interactionHandler?: ExpressionInteractionHandler;
  onItemClicked?: OnItemClicked;
  onInsertButtonClicked?: OnInsertButtonClicked;
}

interface LibraryTreeItemState {
  definition?: Fmt.Definition;
  clickable: boolean;
  filtering: boolean;
  filtered: boolean;
  opened: boolean;
  showPreview: boolean;
}

abstract class LibraryTreeItemBase<PropType extends LibraryTreeItemBaseProps, StateType> extends React.Component<PropType, StateType> {
  protected htmlNode: HTMLElement | null = null;

  protected scrollIntoView = (): void => {
    if (this.htmlNode) {
      this.htmlNode.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  protected getTreeItemContents(icon: React.ReactNode, specialIcon: React.ReactNode, display: React.ReactNode): React.ReactNode {
    let columns: React.ReactNodeArray = [
      <div className={'tree-item-display'} key="display">{display}</div>
    ];
    if (specialIcon && !this.props.indent) {
      icon = specialIcon;
    }
    if (icon) {
      columns.unshift(<div className={'tree-item-icon'} key="icon">{icon}</div>);
    }
    for (let i = this.props.indent - 1; i >= 0; i--) {
      columns.unshift(<div className={'tree-item-indent'} key={i}>{i === 0 ? specialIcon : undefined}</div>);
    }
    return (
      <div className={'tree-item-contents'}>
        <div className={'tree-item-contents-row'}>
          {columns}
        </div>
      </div>
    );
  }

  // Calculate visible dimensions for tooltip.
  getBoundingClientRect(): ClientRect {
    if (this.props.parentScrollPane && this.htmlNode) {
      let parentRect = this.props.parentScrollPane.getBoundingClientRect();
      let itemRect = this.htmlNode.getBoundingClientRect();
      if (parentRect.width > 0) {
        return {
          left: parentRect.left,
          right: parentRect.right,
          width: parentRect.width,
          top: itemRect.top,
          bottom: itemRect.bottom,
          height: itemRect.height
        };
      } else if (itemRect.width > 0) {
        return itemRect;
      }
    }
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

class LibraryTreeItem extends LibraryTreeItemBase<LibraryTreeItemProps, LibraryTreeItemState> {
  private libraryDefinitionPromise?: CachedPromise<LibraryDefinition>;
  private clicked: boolean = false;
  private hovered: boolean = false;
  private refreshTooltip: boolean = false;
  private updateTimer: any;

  constructor(props: LibraryTreeItemProps) {
    super(props);

    this.state = {
      clickable: true,
      opened: false,
      filtering: false,
      filtered: false,
      showPreview: false
    };
  }

  componentDidMount(): void {
    if (this.props.parentScrollPane) {
      this.props.parentScrollPane.addEventListener('scroll', this.onScroll);
    }
    this.updateItem(this.props);
    this.updateSelection(this.props);
    if (this.props.interactionHandler && this.props.selected) {
      this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    if (this.props.parentScrollPane) {
      this.props.parentScrollPane.removeEventListener('scroll', this.onScroll);
    }
    this.libraryDefinitionPromise = undefined;
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }
    if (this.props.interactionHandler && this.props.selected) {
      this.props.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentDidUpdate(prevProps: LibraryTreeItemProps): void {
    if (this.props.parentScrollPane !== prevProps.parentScrollPane) {
      if (prevProps.parentScrollPane) {
        prevProps.parentScrollPane.removeEventListener('scroll', this.onScroll);
      }
      if (this.props.parentScrollPane) {
        this.props.parentScrollPane.addEventListener('scroll', this.onScroll);
      }
    }
    if (this.props.isSubsection !== prevProps.isSubsection
        || this.props.libraryDefinition !== prevProps.libraryDefinition
        || (!this.props.isSubsection && !this.props.libraryDefinition && this.libraryDefinitionPromise && !this.props.libraryDataProvider.isItemUpToDate(this.props.path, this.libraryDefinitionPromise))) {
      this.updateItem(this.props);
    }
    if (this.props.selected !== prevProps.selected
        || !FmtUtils.arePathsEqual(this.props.selectedChildPath, prevProps.selectedChildPath)) {
      this.updateSelection(this.props);
    }
    if (this.props.interactionHandler !== prevProps.interactionHandler || this.props.selected !== prevProps.selected) {
      if (prevProps.interactionHandler && prevProps.selected) {
        prevProps.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
      }
      if (this.props.interactionHandler && this.props.selected) {
        this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
      }
    }
  }

  private updateItem(props: LibraryTreeItemProps): void {
    this.setState({
      clickable: props.isSubsection || props.onFilter === undefined,
      filtering: props.onFilter !== undefined,
      filtered: false,
      opened: false
    });

    if (props.libraryDefinition) {
      this.libraryDefinitionPromise = CachedPromise.resolve(props.libraryDefinition);
      let definition = props.path.parentPath instanceof Fmt.Path ? props.libraryDefinition.definition.innerDefinitions.getDefinition(props.path.name) : props.libraryDefinition.definition;
      this.setState({definition: definition});
      if (props.onFilter) {
        let visibilityResult = checkVisibility(props.libraryDataProvider, props.path, props.isSubsection, props.libraryDefinition, definition, props.onFilter);
        visibilityResult.visible.then((visible: boolean) => {
          this.setState({
            filtering: false,
            filtered: !visible
          });
        });
        visibilityResult.selectable.then((selectable: boolean) => {
          this.setState({
            clickable: selectable
          });
        });
      }
    } else {
      let libraryDefinitionPromise: CachedPromise<LibraryDefinition> | undefined = undefined;
      if (props.isSubsection) {
        libraryDefinitionPromise = props.libraryDataProvider.fetchSubsection(props.path);
      } else {
        libraryDefinitionPromise = props.libraryDataProvider.fetchItem(props.path);
      }
      this.libraryDefinitionPromise = libraryDefinitionPromise;

      if (libraryDefinitionPromise) {
        libraryDefinitionPromise
          .then((libraryDefinition: LibraryDefinition) => {
            if (this.libraryDefinitionPromise === libraryDefinitionPromise) {
              this.setState({definition: libraryDefinition.definition});
              if (props.isSubsection && libraryDefinition.state === LibraryDefinitionState.EditingNew) {
                this.setState({opened: true});
              }
              if (props.onFilter) {
                let visibilityResult = checkVisibility(props.libraryDataProvider, props.path, props.isSubsection, libraryDefinition, libraryDefinition.definition, props.onFilter);
                visibilityResult.visible.then((visible: boolean) => {
                  if (this.libraryDefinitionPromise === libraryDefinitionPromise) {
                    this.setState({
                      filtering: false,
                      filtered: !visible
                    });
                  }
                });
                if (!props.isSubsection) {
                  visibilityResult.selectable.then((selectable: boolean) => {
                    if (this.libraryDefinitionPromise === libraryDefinitionPromise) {
                      this.setState({
                        clickable: selectable
                      });
                    }
                  });
                }
              }
            }
          })
          .catch((error) => {
            console.error(error);
          });
      }
    }

    this.clicked = false;
  }

  private updateSelection(props: LibraryTreeItemProps): void {
    if (props.selectedChildPath && !this.clicked) {
      this.setState({opened: true});
    } else if (props.selected && !this.clicked) {
      setTimeout(this.scrollIntoView, 100);
    } else {
      this.clicked = false;
    }
  }

  render(): React.ReactNode {
    if (this.state.filtered) {
      return null;
    }
    let className = 'tree-item hoverable';
    let contents: React.ReactNode = null;
    let icon: React.ReactNode = '\u2001';
    let display: React.ReactNode = this.props.itemInfo ? this.props.itemInfo.title : null;
    if (this.props.isSubsection) {
      icon = getSectionIcon(this.state.opened, this.props.selectedChildPath !== undefined);
      if (this.state.opened) {
        if (this.libraryDefinitionPromise) {
          contents = <InnerLibraryTreeItems libraryDataProvider={this.props.libraryDataProvider.getProviderForSection(this.props.path, this.props.itemInfo.itemNumber)} sectionPromise={this.libraryDefinitionPromise} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} interactionHandler={this.props.interactionHandler} onItemClicked={this.props.onItemClicked} onInsertButtonClicked={this.props.onInsertButtonClicked} indent={this.props.indent + 1} key="inner"/>;
        }
      }
    } else {
      let definition = this.state.definition;
      if (definition && this.props.onFilter && this.libraryDefinitionPromise) {
        if (definition.innerDefinitions.length) {
          contents = <InnerLibraryTreeItems libraryDataProvider={this.props.libraryDataProvider} libraryDefinition={this.libraryDefinitionPromise.getImmediateResult()} innerDefinitions={definition.innerDefinitions} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} interactionHandler={this.props.interactionHandler} onItemClicked={this.props.onItemClicked} indent={this.props.indent + 1} key="inner"/>;
        }
      }
      if (definition) {
        let logic = this.props.libraryDataProvider.logic;
        let logicDisplay = logic.getDisplay();
        let definitionType = logicDisplay.getDefinitionType(definition);
        let definitionIcon = getDefinitionIcon(definitionType, this.props.itemInfo);
        icon = <span>{definitionIcon}{icon}</span>;
        if (this.props.templates) {
          let outerDefinition = this.props.libraryDefinition ? this.props.libraryDefinition.definition : definition;
          let rendererOptions: Logic.LogicRendererOptions = {
            includeProofs: false,
            maxListLength: 10
          };
          let renderer = logicDisplay.getDefinitionRenderer(outerDefinition, this.props.libraryDataProvider, this.props.templates, rendererOptions);
          let summary = renderer.renderDefinitionSummary(definition);
          if (summary) {
            let summaryExpression = <Expression expression={summary} key="summary"/>;
            if (display) {
              display = [display, ': ', summaryExpression];
            } else {
              display = summaryExpression;
            }
          }
          if (this.refreshTooltip) {
            this.refreshTooltip = false;
          } else if (display && this.props.parentScrollPane && !this.props.selected) {
            let showPreview = false;
            if (this.state.showPreview) {
              rendererOptions.maxListLength = 20;
              let renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
                includeLabel: false,
                includeExtras: true,
                includeRemarks: false
              };
              let renderedDefinition = renderer.renderDefinition(undefined, renderedDefinitionOptions);
              if (renderedDefinition) {
                previewContents = <Expression expression={renderedDefinition}/>;
                showPreview = true;
              }
            }
            let previewStyle = {
              style: {'background': '#fff8c0'},
              arrowStyle: {'color': '#fff8c0'}
            };
            let preview = (
              <ToolTip active={showPreview} position="right" arrow="center" parent={this} style={previewStyle} key="preview">
                <div className={'preview'}>{previewContents}</div>
              </ToolTip>
            );
            display = [display, preview];
          }
        }
      }
      if (this.props.selected) {
        className += ' selected';
      }
    }
    if (!display) {
      display = this.props.path.name;
    }
    if (this.props.itemInfo && this.props.itemInfo.type === 'lemma') {
      display = <span className={'tree-item-minor'} key="minor">{display}</span>;
    }
    let specialIcon: React.ReactNode = null;
    if (this.state.filtering) {
      specialIcon = <Loading width={'1em'} height={'1em'}/>;
    } else if (this.libraryDefinitionPromise && !this.props.isSubsection) {
      let libraryDefinition = this.libraryDefinitionPromise.getImmediateResult();
      if (libraryDefinition) {
        switch (libraryDefinition.state) {
        case LibraryDefinitionState.Editing:
          specialIcon = getButtonIcon(ButtonType.Edit);
          break;
        case LibraryDefinitionState.EditingNew:
          specialIcon = getInsertIcon(getButtonIconContents(ButtonType.Edit));
          break;
        case LibraryDefinitionState.Submitting:
          specialIcon = <Loading width={'1em'} height={'1em'}/>;
          break;
        }
      }
    }
    let treeItemContents = this.getTreeItemContents(icon, specialIcon, display);
    let treeItem: React.ReactNode;
    if (this.state.clickable) {
      let href = this.props.libraryDataProvider.pathToURI(FmtUtils.getOuterPath(this.props.path));
      treeItem = (
        <a className={className} href={href} onClick={this.itemClicked} onMouseEnter={this.mouseEntered} onMouseLeave={this.mouseLeft} ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          {treeItemContents}
        </a>
      );
    } else {
      treeItem = (
        <div className={className} onMouseEnter={this.mouseEntered} onMouseLeave={this.mouseLeft} ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          {treeItemContents}
        </div>
      );
    }
    let result: React.ReactNode = <div className={'tree-item-row'} key="item">{treeItem}</div>;
    if (contents) {
      result = [result, contents];
    }
    return result;
  }

  private itemClicked = (event: React.MouseEvent<HTMLElement, MouseEvent>): void => {
    if (event.button < 1 || this.props.isSubsection) {
      event.preventDefault();
      this.clicked = true;
      if (this.props.isSubsection) {
        this.setState((prevState) => ({opened: !prevState.opened}));
      } else if (this.props.onItemClicked && this.libraryDefinitionPromise) {
        this.props.onItemClicked(this.props.libraryDataProvider, this.props.path, this.libraryDefinitionPromise, this.props.itemInfo);
      }
    }
  }

  private mouseEntered = (): void => {
    this.hovered = true;
    let show = () => {
      if (this.hovered) {
        this.setState({showPreview: true});
      }
    };
    setTimeout(show, 250);
  }

  private mouseLeft = (): void => {
    this.hovered = false;
    this.setState({showPreview: false});
  }

  private onScroll = () => {
    if (this.state.showPreview) {
      this.refreshTooltip = true;
      this.setState({showPreview: false});
    }
  }

  private onExpressionChanged = () => {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    this.updateTimer = setTimeout(() => this.forceUpdate(), 200);
  }
}

interface LibraryTreeInsertionItemProps extends LibraryTreeItemBaseProps {
  section: LibraryDefinition;
  onInsertButtonClicked: OnInsertButtonClicked;
}

interface LibraryTreeInsertionItemState {
}

class LibraryTreeInsertionItem extends LibraryTreeItemBase<LibraryTreeInsertionItemProps, LibraryTreeInsertionItemState> {
  constructor(props: LibraryTreeInsertionItemProps) {
    super(props);

    this.state = {};
  }

  render(): React.ReactNode {
    let definitionButtons: React.ReactNodeArray = this.props.libraryDataProvider.logic.topLevelDefinitionTypes.map((definitionType: Logic.LogicDefinitionTypeDescription) => {
      let toolTipText = `New ${definitionType.name}`;
      let onClick = () => this.props.onInsertButtonClicked(this.props.libraryDataProvider, this.props.section, definitionType);
      return (
        <Button className={'standalone'} toolTipText={toolTipText} onClick={onClick} key={definitionType.definitionType}>
          {getInsertIcon(getDefinitionIconContents(definitionType.definitionType))}
        </Button>
      );
    });
    let buttonRow = (
      <div className={'tree-item-insert-buttons'}>
        <Button className={'standalone'} toolTipText={'New Section'} onClick={() => this.props.onInsertButtonClicked(this.props.libraryDataProvider, this.props.section, undefined)} key={'section'}>
          {getInsertIcon(getSectionIconContents(false))}
        </Button>
        {definitionButtons}
      </div>
    );
    let treeItemContents = this.getTreeItemContents(undefined, undefined, buttonRow);
    return (
      <div className={'tree-item-row'} key="item">
        <div className={'tree-item'} ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          {treeItemContents}
        </div>
      </div>
    );
  }
}

export default LibraryTree;
