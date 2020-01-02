import * as React from 'react';
import './LibraryTree.css';
import * as Fmt from '../../shared/format/format';
import * as FmtUtils from '../../shared/format/utils';
import * as FmtLibrary from '../../shared/logics/library';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryDefinitionState } from '../../shared/data/libraryDataProvider';
import Expression from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';
import { ButtonType, getButtonIcon, getDefinitionIcon } from '../utils/icons';

const Loading = require('react-loading-animation');
const ToolTip = require('react-portal-tooltip').default;

export type OnFilter = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => CachedPromise<boolean>;
export type OnItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => void;

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

interface LibraryTreeItemProps {
  libraryDataProvider: LibraryDataProvider;
  libraryDefinition?: LibraryDefinition;
  isSubsection: boolean;
  path: Fmt.Path;
  itemInfo: LibraryItemInfo;
  templates?: Fmt.File;
  parentScrollPane: HTMLElement | null;
  isLast: boolean;
  onFilter?: OnFilter;
  selected: boolean;
  selectedChildPath?: Fmt.Path;
  onItemClicked?: OnItemClicked;
  indent: number;
}

interface LibraryTreeItemState {
  definition?: Fmt.Definition;
  clickable: boolean;
  filtering: boolean;
  filtered: boolean;
  opened: boolean;
  showPreview: boolean;
}

class LibraryTreeItem extends React.Component<LibraryTreeItemProps, LibraryTreeItemState> {
  private libraryDefinitionPromise?: CachedPromise<LibraryDefinition>;
  private htmlNode: HTMLElement | null = null;
  private clicked: boolean = false;
  private hovered: boolean = false;
  private refreshTooltip: boolean = false;

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
  }

  componentWillReceiveProps(props: LibraryTreeItemProps): void {
    if (props.parentScrollPane !== this.props.parentScrollPane) {
      if (this.props.parentScrollPane) {
        this.props.parentScrollPane.removeEventListener('scroll', this.onScroll);
      }
      if (props.parentScrollPane) {
        props.parentScrollPane.addEventListener('scroll', this.onScroll);
      }
    }
    if (props.isSubsection !== this.props.isSubsection
        || props.libraryDefinition !== this.props.libraryDefinition
        || (!props.isSubsection && this.libraryDefinitionPromise && !props.libraryDataProvider.isItemUpToDate(props.path, this.libraryDefinitionPromise))) {
      this.updateItem(props);
    }
    if (props.selected !== this.props.selected
        || !FmtUtils.arePathsEqual(props.selectedChildPath, this.props.selectedChildPath)) {
      this.updateSelection(props);
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
      let definition = props.libraryDefinition.definition.innerDefinitions.getDefinition(props.path.name);
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

  componentWillUnmount(): void {
    if (this.props.parentScrollPane) {
      this.props.parentScrollPane.removeEventListener('scroll', this.onScroll);
    }
    this.libraryDefinitionPromise = undefined;
  }

  render(): React.ReactNode {
    if (this.state.filtered) {
      return null;
    }
    let className = 'tree-item hoverable';
    let contents: React.ReactNode = null;
    let icon: React.ReactNode = '\u2001';
    let display: React.ReactNode = this.props.itemInfo ? this.props.itemInfo.title : undefined;
    if (this.props.isSubsection) {
      if (this.state.opened) {
        icon = getButtonIcon(ButtonType.DownArrow);
        if (this.libraryDefinitionPromise) {
          contents = <InnerLibraryTreeItems libraryDataProvider={this.props.libraryDataProvider.getProviderForSection(this.props.path, this.props.itemInfo.itemNumber)} sectionPromise={this.libraryDefinitionPromise} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} isLast={this.props.isLast} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} onItemClicked={this.props.onItemClicked} indent={this.props.indent + 1} key="inner"/>;
        }
      } else {
        icon = getButtonIcon(ButtonType.RightArrow);
      }
    } else {
      let definition = this.state.definition;
      if (definition && this.props.onFilter && this.libraryDefinitionPromise) {
        if (definition.innerDefinitions.length) {
          contents = <InnerLibraryTreeItems libraryDataProvider={this.props.libraryDataProvider} libraryDefinition={this.libraryDefinitionPromise.getImmediateResult()} innerDefinitions={definition.innerDefinitions} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} isLast={this.props.isLast} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} onItemClicked={this.props.onItemClicked} indent={this.props.indent + 1} key="inner"/>;
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
          let renderer = logicDisplay.getDefinitionRenderer(outerDefinition, false, this.props.libraryDataProvider, this.props.templates);
          let summary = renderer.renderDefinitionSummary(definition);
          if (summary) {
            let summaryExpression = <Expression expression={summary} key="summary"/>;
            if (display === undefined) {
              display = summaryExpression;
            } else {
              display = [display, ': ', summaryExpression];
            }
          }
          if (this.refreshTooltip) {
            this.refreshTooltip = false;
          } else if (display !== undefined && this.props.parentScrollPane && !this.props.selected) {
            let showPreview = false;
            if (this.state.showPreview) {
              let renderedDefinition = renderer.renderDefinition(undefined, false, true, false);
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
    if (display === undefined) {
      display = this.props.path.name;
    }
    if (this.props.itemInfo && this.props.itemInfo.type === 'lemma') {
      display = <span className={'tree-item-minor'} key="minor">{display}</span>;
    }
    let specialIcon = undefined;
    if (this.state.filtering) {
      specialIcon = <Loading width={'1em'} height={'1em'}/>;
    } else if (this.libraryDefinitionPromise) {
      let libraryDefinition = this.libraryDefinitionPromise.getImmediateResult();
      if (libraryDefinition) {
        switch (libraryDefinition.state) {
        case LibraryDefinitionState.Editing:
          specialIcon = getButtonIcon(ButtonType.Edit);
          break;
        case LibraryDefinitionState.Submitting:
          specialIcon = <Loading width={'1em'} height={'1em'}/>;
          break;
        }
      }
    }
    if (specialIcon && !this.props.indent) {
      icon = specialIcon;
    }
    let columns: React.ReactNodeArray = [
      <div className={'tree-item-icon'} key="icon">{icon}</div>,
      <div className={'tree-item-display'} key="display">{display}</div>
    ];
    for (let i = this.props.indent - 1; i >= 0; i--) {
      columns.unshift(<div className={'tree-item-indent'} key={i}>{i === 0 ? specialIcon : undefined}</div>);
    }
    let treeItemContents = (
      <div className={'tree-item-contents'}>
        <div className={'tree-item-contents-row'}>
          {columns}
        </div>
      </div>
    );
    let treeItem: React.ReactNode;
    if (this.state.clickable) {
      let href = this.props.libraryDataProvider.pathToURI(FmtUtils.getOuterPath(this.props.path));
      treeItem = (
        <a className={className} href={href} onClick={this.itemClicked} onMouseEnter={this.mouseEntered} onMouseLeave={this.mouseLeft} key="display" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          {treeItemContents}
        </a>
      );
    } else {
      treeItem = (
        <div className={className} onMouseEnter={this.mouseEntered} onMouseLeave={this.mouseLeft} key="display" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
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
        if (this.props.isLast && !this.state.opened) {
          setTimeout(this.scrollIntoView, 100);
        }
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

  private scrollIntoView = (): void => {
    if (this.htmlNode) {
      this.htmlNode.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  // Calculate visible dimensions for tooltip.
  getBoundingClientRect(): ClientRect {
    if (this.props.parentScrollPane && this.htmlNode) {
      let parentRect = this.props.parentScrollPane.getBoundingClientRect();
      let itemRect = this.htmlNode.getBoundingClientRect();
      return {
        left: parentRect.left,
        right: parentRect.right,
        width: parentRect.width,
        top: itemRect.top,
        bottom: itemRect.bottom,
        height: itemRect.height
      };
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

  private onScroll = () => {
    if (this.state.showPreview) {
      this.refreshTooltip = true;
      this.setState({showPreview: false});
    }
  }
}

interface LibraryTreeProps {
  libraryDataProvider: LibraryDataProvider;
  templates?: Fmt.File;
  parentScrollPane: HTMLElement | null;
  onFilter?: OnFilter;
  selectedItemPath?: Fmt.Path;
  onItemClicked?: OnItemClicked;
}

interface InnerLibraryTreeProps extends LibraryTreeProps {
  sectionPromise?: CachedPromise<LibraryDefinition>;
  libraryDefinition?: LibraryDefinition;
  innerDefinitions?: Fmt.Definition[];
  itemNumber: number[];
  indent: number;
  isLast: boolean;
}

function renderLibraryTreeItems(props: InnerLibraryTreeProps, items: (Fmt.Expression | Fmt.Definition)[]) {
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
      let last = index === items.length - 1;
      let itemInfo: LibraryItemInfo = {
        itemNumber: [...props.itemNumber, index + 1],
        type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
        title: item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection ? item.title : undefined
      };
      treeItems.push(<LibraryTreeItem libraryDataProvider={props.libraryDataProvider} libraryDefinition={props.libraryDefinition} isSubsection={isSubsection} path={path} itemInfo={itemInfo} templates={props.templates} parentScrollPane={props.parentScrollPane} isLast={props.isLast && last} onFilter={props.onFilter} selected={selected} selectedChildPath={selectedChildPath} onItemClicked={props.onItemClicked} key={path.name} indent={props.indent}/>);
    }
    index++;
  }

  return <>{treeItems}</>;
}

function InnerLibraryTreeItems(props: InnerLibraryTreeProps) {
  if (props.sectionPromise) {
    let render = props.sectionPromise.then((section: LibraryDefinition) => {
      if (section.definition.contents instanceof FmtLibrary.ObjectContents_Section) {
        return renderLibraryTreeItems(props, section.definition.contents.items);
      } else {
        return <div className={'tree-item error'}>Error: Invalid section content type</div>;
      }
    });
    return renderPromise(render);
  } else if (props.innerDefinitions) {
    return renderLibraryTreeItems(props, props.innerDefinitions);
  } else {
    return null;
  }
}

function LibraryTree(props: LibraryTreeProps) {
  let innerProps: InnerLibraryTreeProps = {
    ...props,
    sectionPromise: props.libraryDataProvider.fetchLocalSection(),
    itemNumber: [],
    indent: 0,
    isLast: true
  };
  let treeItems = InnerLibraryTreeItems(innerProps);
  return (
    <div className={'tree'}>
      {treeItems}
    </div>
  );
}

export default LibraryTree;
