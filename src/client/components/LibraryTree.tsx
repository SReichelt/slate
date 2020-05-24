import * as React from 'react';
import './LibraryTree.css';
import * as Fmt from '../../shared/format/format';
import * as FmtUtils from '../../shared/format/utils';
import * as FmtLibrary from '../../shared/logics/library';
import { LibraryDataProvider, LibraryDefinition, LibraryItemInfo, LibraryDefinitionState, LibraryItemNumber } from '../../shared/data/libraryDataProvider';
import * as Logic from '../../shared/logics/logic';
import ScrollPane from './ScrollPane';
import Expression, { ExpressionInteractionHandler } from './Expression';
import ExpressionToolTip from './ExpressionToolTip';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';
import { ButtonType, getButtonIcon, getSectionIcon, getDefinitionIcon } from '../utils/icons';
import Button from './Button';
import MenuButton from './MenuButton';
import scrollIntoView from 'scroll-into-view-if-needed';

const Loading = require('react-loading-animation');

export type OnFilter = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinition: LibraryDefinition, definition: Fmt.Definition) => CachedPromise<boolean>;
export type OnItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, libraryDefinitionPromise: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo) => void;
export type OnInsertButtonClicked = (libraryDataProvider: LibraryDataProvider, section: LibraryDefinition, definitionType: Logic.LogicDefinitionTypeDescription | undefined) => void;

interface SearchInputProps {
  onSearch: (searchText: string) => void;
  autoFocus?: boolean;
}

export class SearchInput extends React.Component<SearchInputProps> {
  private searchInputNode: HTMLInputElement | null = null;
  private focusTimer: any;
  private searchTimer: any;

  componentDidMount(): void {
    // Work around a bug in react-responsive-modal (I think) which breaks the autoFocus attribute on (our?) inputs.
    if (this.searchInputNode && this.props.autoFocus) {
      let focusNode = () => {
        this.searchInputNode?.focus();
      };
      this.focusTimer = setTimeout(focusNode, 100);
    }
  }

  componentWillUnmount(): void {
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
    }
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
    }
  }

  render(): React.ReactNode {
    return <input className={'tree-search-input'} type={'search'} placeholder={'Search...'} onChange={this.onChangeSearchText} autoFocus={this.props.autoFocus} ref={(node) => (this.searchInputNode = node)}/>;
  }

  private onChangeSearchText = (event: React.ChangeEvent<HTMLInputElement>) => {
    let searchText = event.target.value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.props.onSearch(searchText), 20);
  };
}

interface ScrollPaneReference {
  htmlNode: HTMLElement | null;
}

interface LibraryTreeProps {
  libraryDataProvider: LibraryDataProvider;
  templates?: Fmt.File;
  onFilter?: OnFilter;
  selectedItemPath?: Fmt.Path;
  interactionHandler?: ExpressionInteractionHandler;
  onItemClicked?: OnItemClicked;
  onInsertButtonClicked?: OnInsertButtonClicked;
  autoFocusSearchInput?: boolean;
}

interface LibraryTreeState {
  searchWords: string[];
}

class LibraryTree extends React.Component<LibraryTreeProps, LibraryTreeState> {
  private scrollPaneReference: ScrollPaneReference = {htmlNode: null};

  constructor(props: LibraryTreeProps) {
    super(props);

    this.state = {
      searchWords: []
    };
  }

  render(): React.ReactNode {
    let sectionPromise = this.props.libraryDataProvider.fetchLocalSection();
    return (
      <div className={'tree-container'}>
        <div className={'tree-search-area'}>
          <SearchInput onSearch={this.onSearch} autoFocus={this.props.autoFocusSearchInput}/>
        </div>
        <div className={'tree-area'}>
          <ScrollPane onRef={(htmlNode) => (this.scrollPaneReference.htmlNode = htmlNode)}>
            <div className={'tree'}>
              <div className={'tree-contents'}>
                <InnerLibraryTreeItems libraryDataProvider={this.props.libraryDataProvider} templates={this.props.templates} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedItemPath} interactionHandler={this.props.interactionHandler} onItemClicked={this.props.onItemClicked} onInsertButtonClicked={this.props.onInsertButtonClicked} parentScrollPane={this.scrollPaneReference} sectionPromise={sectionPromise} itemNumber={[]} indent={0} searchWords={this.state.searchWords} key={this.props.libraryDataProvider.getSectionChangeCounter()}/>
              </div>
            </div>
          </ScrollPane>
        </div>
      </div>
    );
  }

  private onSearch = (searchText: string) => {
    let searchWords = searchText.toLowerCase().split(' ').filter((word: string) => (word.length > 2));
    if (!areSearchWordsEqual(this.state.searchWords, searchWords)) {
      this.setState({searchWords: searchWords});
    }
  };
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

export class LibraryItemList extends React.Component<LibraryItemListProps> {
  private scrollPaneReference: ScrollPaneReference = {htmlNode: null};

  render(): React.ReactNode {
    return (
      <ScrollPane onRef={(htmlNode) => (this.scrollPaneReference.htmlNode = htmlNode)}>
        <div className={'tree'}>
          <div className={'tree-contents'}>
            {this.props.items.map((entry: LibraryItemListEntry) => {
              let selected = FmtUtils.arePathsEqual(entry.absolutePath, this.props.selectedItemPath);
              return <LibraryTreeItem libraryDataProvider={entry.libraryDataProvider} libraryDefinition={entry.libraryDefinition} isSubsection={false} path={entry.localPath} itemInfo={entry.itemInfo} templates={this.props.templates} parentScrollPane={this.scrollPaneReference} searchWords={[]} onFilter={this.props.onFilter} autoOpen={false} selected={selected} interactionHandler={this.props.interactionHandler} onItemClicked={this.props.onItemClicked} key={entry.absolutePath.toString()} indent={1}/>;
            })}
          </div>
        </div>
      </ScrollPane>
    );
  }
}

interface InnerLibraryTreeProps extends LibraryTreeProps {
  parentScrollPane: ScrollPaneReference;
  sectionPromise?: CachedPromise<LibraryDefinition>;
  libraryDefinition?: LibraryDefinition;
  innerDefinitions?: Fmt.Definition[];
  itemNumber: LibraryItemNumber;
  indent: number;
  searchWords: string[];
}

function areSearchWordsEqual(searchWords1: string[], searchWords2: string[]): boolean {
  if (searchWords1 === searchWords2) {
    return true;
  }
  if (searchWords1.length !== searchWords2.length) {
    return false;
  }
  return searchWords1.every((word, index) => word === searchWords2[index]);
}

function containsSearchWord(word: string, texts: (string | undefined)[]): boolean {
  for (let text of texts) {
    if (text && text.toLowerCase().indexOf(word) >= 0) {
      return true;
    }
  }
  return false;
}

function filterSearchWords(searchWords: string[], texts: (string | undefined)[]): string[] {
  for (let index = searchWords.length - 1; index >= 0; index--) {
    if (containsSearchWord(searchWords[index], texts)) {
      searchWords = searchWords.slice(0, index).concat(searchWords.slice(index + 1));
    }
  }
  return searchWords;
}

function renderLibraryTreeItems(props: InnerLibraryTreeProps, items: (Fmt.Expression | Fmt.Definition)[], section: LibraryDefinition | undefined, visibleItems: Set<LibraryTreeItem> | undefined): React.ReactElement {
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
      let title = item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection ? item.title : undefined;
      let autoOpen = false;
      let searchWords = props.searchWords;
      if (searchWords.length) {
        searchWords = filterSearchWords(searchWords, [path.name, title]);
        if (isSubsection) {
          if (!searchWords.length) {
            autoOpen = true;
          }
        } else {
          if (searchWords.length) {
            continue;
          }
        }
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
      let itemInfo: LibraryItemInfo | undefined = undefined;
      if (selected && !isSubsection && !(path.parentPath instanceof Fmt.Path)) {
        itemInfo = props.libraryDataProvider.getItemInfo(path).getImmediateResult();
      }
      if (!itemInfo) {
        itemInfo = {
          itemNumber: [...props.itemNumber, index + 1],
          type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
          title: title
        };
      }
      treeItems.push(<LibraryTreeItem libraryDataProvider={props.libraryDataProvider} libraryDefinition={props.libraryDefinition} isSubsection={isSubsection} path={path} itemInfo={itemInfo} templates={props.templates} parentScrollPane={props.parentScrollPane} searchWords={searchWords} onFilter={props.onFilter} autoOpen={autoOpen} selected={selected} selectedChildPath={selectedChildPath} interactionHandler={props.interactionHandler} onItemClicked={props.onItemClicked} onInsertButtonClicked={props.onInsertButtonClicked} key={path.name} indent={props.indent} visibleSiblings={visibleItems}/>);
    }
    index++;
  }

  if (section && props.onInsertButtonClicked && !props.searchWords.length) {
    treeItems.push(<LibraryTreeInsertionItem libraryDataProvider={props.libraryDataProvider} parentScrollPane={props.parentScrollPane} section={section} onInsertButtonClicked={props.onInsertButtonClicked} key="<insert>" indent={props.indent}/>);
  }

  return <>{treeItems}</>;
}

export class InnerLibraryTreeItems extends React.Component<InnerLibraryTreeProps> {
  private visibleItems?: Set<LibraryTreeItem>;

  render(): React.ReactNode {
    if (this.props.searchWords.length) {
      if (!this.visibleItems) {
        this.visibleItems = new Set<LibraryTreeItem>();
      }
    } else {
      if (this.visibleItems) {
        this.visibleItems = undefined;
      }
    }
    if (this.props.sectionPromise) {
      let render = this.props.sectionPromise.then((section: LibraryDefinition) => {
        if (section.definition.contents instanceof FmtLibrary.ObjectContents_Section) {
          return renderLibraryTreeItems(this.props, section.definition.contents.items, section, this.visibleItems);
        } else {
          return <div className={'tree-item error'}>Error: Invalid section content type</div>;
        }
      });
      return renderPromise(render);
    } else if (this.props.innerDefinitions) {
      return renderLibraryTreeItems(this.props, this.props.innerDefinitions, undefined, this.visibleItems);
    } else {
      return null;
    }
  }
}

interface VisibilityResult {
  visible: CachedPromise<boolean>;
  selectable: CachedPromise<boolean>;
}

function checkVisibility(libraryDataProvider: LibraryDataProvider, path: Fmt.Path, isSubsection: boolean, libraryDefinition: LibraryDefinition, definition: Fmt.Definition, searchWords: string[], onFilter: OnFilter | undefined): VisibilityResult {
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
              let title = item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection ? item.title : undefined;
              let filteredSearchWords = filterSearchWords(searchWords, [itemPath.name, title]);
              let itemDefinitionPromise: CachedPromise<LibraryDefinition>;
              if (itemIsSubsection) {
                itemDefinitionPromise = innerLibraryDataProvider.fetchSubsection(itemPath, undefined, false);
              } else if (filteredSearchWords.length) {
                return false;
              } else if (onFilter) {
                itemDefinitionPromise = innerLibraryDataProvider.fetchItem(itemPath, false, false);
              } else {
                return true;
              }
              return itemDefinitionPromise.then((itemDefinition: LibraryDefinition) => checkVisibility(innerLibraryDataProvider, itemPath, itemIsSubsection, itemDefinition, itemDefinition.definition, filteredSearchWords, onFilter).visible);
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
  } else if (onFilter) {
    let asyncPromise = new Promise((resolve) => setTimeout(resolve, 0));
    let ensureDelayPromise = new CachedPromise(asyncPromise.then(() => false));
    let ownResultPromise = ensureDelayPromise.then(() =>
      onFilter(libraryDataProvider, path, libraryDefinition, definition));
    let resultPromise = ownResultPromise;
    for (let innerDefinition of definition.innerDefinitions) {
      resultPromise = resultPromise.then((currentResult: boolean) => {
        if (currentResult) {
          return true;
        } else {
          let innerPath = new Fmt.Path;
          innerPath.name = innerDefinition.name;
          innerPath.parentPath = path;
          return checkVisibility(libraryDataProvider, innerPath, false, libraryDefinition, innerDefinition, searchWords, onFilter).visible;
        }
      });
    }
    return {
      visible: resultPromise,
      selectable: ownResultPromise
    };
  } else {
    return {
      visible: CachedPromise.resolve(true),
      selectable: CachedPromise.resolve(true)
    };
  }
}

interface LibraryTreeItemBaseProps {
  libraryDataProvider: LibraryDataProvider;
  parentScrollPane: ScrollPaneReference;
  indent: number;
}

interface LibraryTreeItemProps extends LibraryTreeItemBaseProps {
  libraryDefinition?: LibraryDefinition;
  isSubsection: boolean;
  path: Fmt.Path;
  itemInfo: LibraryItemInfo;
  templates?: Fmt.File;
  searchWords: string[];
  onFilter?: OnFilter;
  autoOpen: boolean;
  selected: boolean;
  selectedChildPath?: Fmt.Path;
  interactionHandler?: ExpressionInteractionHandler;
  onItemClicked?: OnItemClicked;
  onInsertButtonClicked?: OnInsertButtonClicked;
  visibleSiblings?: Set<LibraryTreeItem>;
}

interface LibraryTreeItemState {
  definition?: Fmt.Definition;
  clickable: boolean;
  filtering: boolean;
  filtered: boolean;
  opened: boolean;
  showToolTip: boolean;
}

abstract class LibraryTreeItemBase<PropType extends LibraryTreeItemBaseProps, StateType = {}> extends React.Component<PropType, StateType> {
  protected htmlNode: HTMLElement | null = null;

  protected scrollIntoView = (): void => {
    if (this.htmlNode) {
      scrollIntoView(this.htmlNode, {
        scrollMode: 'if-needed',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  };

  protected getTreeItemContents(icon: React.ReactNode, specialIcon: React.ReactNode, display: React.ReactNode): React.ReactNode {
    let columns: React.ReactNodeArray = [
      <div className={'tree-item-display'} key="display">
        <span key="display-span">{display}</span>
      </div>
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
    if (this.props.parentScrollPane.htmlNode && this.htmlNode) {
      let parentRect = this.props.parentScrollPane.htmlNode.getBoundingClientRect();
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

export class LibraryTreeItem extends LibraryTreeItemBase<LibraryTreeItemProps, LibraryTreeItemState> {
  private static readonly renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
    includeLabel: false,
    includeExtras: true,
    includeRemarks: false
  };

  private libraryDefinitionPromise?: CachedPromise<LibraryDefinition>;
  private clicked: boolean = false;
  private refreshToolTip: boolean = false;
  private updateTimer: any;
  private scrollTimer: any;
  private siblingsTimer: any;

  constructor(props: LibraryTreeItemProps) {
    super(props);

    this.state = {
      clickable: true,
      opened: false,
      filtering: false,
      filtered: false,
      showToolTip: false
    };
  }

  componentDidMount(): void {
    this.props.visibleSiblings?.add(this);
    this.props.parentScrollPane.htmlNode?.addEventListener('scroll', this.onScroll);
    this.updateItem(this.props);
    this.updateSelection(this.props);
    if (this.props.interactionHandler && this.props.selected) {
      this.props.interactionHandler.registerExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentWillUnmount(): void {
    this.props.visibleSiblings?.delete(this);
    this.props.parentScrollPane.htmlNode?.removeEventListener('scroll', this.onScroll);
    this.libraryDefinitionPromise = undefined;
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = undefined;
    }
    if (this.siblingsTimer) {
      clearTimeout(this.siblingsTimer);
      this.siblingsTimer = undefined;
    }
    if (this.props.interactionHandler && this.props.selected) {
      this.props.interactionHandler.unregisterExpressionChangeListener(this.onExpressionChanged);
    }
  }

  componentDidUpdate(prevProps: LibraryTreeItemProps): void {
    if (this.props.visibleSiblings !== prevProps.visibleSiblings) {
      prevProps.visibleSiblings?.delete(this);
      if (!this.state.filtered) {
        this.props.visibleSiblings?.add(this);
      }
    }
    if (this.props.parentScrollPane !== prevProps.parentScrollPane) {
      prevProps.parentScrollPane.htmlNode?.removeEventListener('scroll', this.onScroll);
      this.props.parentScrollPane.htmlNode?.addEventListener('scroll', this.onScroll);
    }
    if (this.props.isSubsection !== prevProps.isSubsection
        || this.props.libraryDefinition !== prevProps.libraryDefinition
        || (!this.props.isSubsection && !this.props.libraryDefinition && this.libraryDefinitionPromise && !this.props.libraryDataProvider.isItemUpToDate(this.props.path, this.libraryDefinitionPromise))) {
      this.updateItem(this.props);
    } else if (this.props.onFilter !== prevProps.onFilter
               || !areSearchWordsEqual(this.props.searchWords, prevProps.searchWords)) {
      this.updateFilter(this.props);
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
    if (this.props.autoOpen && !this.state.opened) {
      this.setState({opened: true});
    }
  }

  private updateItem(props: LibraryTreeItemProps): void {
    if (this.state.opened && !props.autoOpen) {
      this.setState({opened: false});
    }

    let needsFiltering = this.initializeFilterState(props);

    if (props.libraryDefinition) {
      this.libraryDefinitionPromise = CachedPromise.resolve(props.libraryDefinition);
      let definition = props.path.parentPath instanceof Fmt.Path ? props.libraryDefinition.definition.innerDefinitions.getDefinition(props.path.name) : props.libraryDefinition.definition;
      this.setState({definition: definition});
      if (needsFiltering) {
        this.triggerFilterStateUpdate(props, props.libraryDefinition, definition);
      }
    } else {
      let prefetchContents = !needsFiltering;  // Avoid re-filtering due to arrival of prefetched contents.
      if (props.isSubsection) {
        this.libraryDefinitionPromise = props.libraryDataProvider.fetchSubsection(props.path, props.itemInfo.itemNumber, prefetchContents);
      } else {
        this.libraryDefinitionPromise = props.libraryDataProvider.fetchItem(props.path, false, prefetchContents);
      }
      let libraryDefinitionPromise = this.libraryDefinitionPromise;
      libraryDefinitionPromise
        .then((libraryDefinition: LibraryDefinition) => {
          if (this.libraryDefinitionPromise === libraryDefinitionPromise) {
            this.setState({definition: libraryDefinition.definition});
            if (props.isSubsection && libraryDefinition.state === LibraryDefinitionState.EditingNew) {
              this.setState({opened: true});
            }
            if (needsFiltering) {
              this.triggerFilterStateUpdate(props, libraryDefinition, libraryDefinition.definition);
            }
          }
        })
        .catch((error) => {
          console.error(error);
        });
    }

    this.clicked = false;
  }

  private initializeFilterState(props: LibraryTreeItemProps): boolean {
    if (props.visibleSiblings) {
      props.visibleSiblings.add(this);
    }
    let needsFiltering = props.onFilter !== undefined || (props.isSubsection && props.searchWords.length > 0);
    let clickable = props.isSubsection || !needsFiltering;
    if (this.state.clickable !== clickable || this.state.filtering !== needsFiltering || this.state.filtered) {
      this.setState({
        clickable: clickable,
        filtering: needsFiltering,
        filtered: needsFiltering && !props.isSubsection
      });
    }
    return needsFiltering;
  }

  private updateFilter(props: LibraryTreeItemProps): void {
    if (this.initializeFilterState(props)) {
      if (props.libraryDefinition) {
        if (this.state.definition) {
          this.triggerFilterStateUpdate(props, props.libraryDefinition, this.state.definition);
        }
      } else {
        let libraryDefinitionPromise = this.libraryDefinitionPromise;
        if (libraryDefinitionPromise) {
          libraryDefinitionPromise
            .then((libraryDefinition: LibraryDefinition) => {
              if (this.libraryDefinitionPromise === libraryDefinitionPromise && areSearchWordsEqual(this.props.searchWords, props.searchWords) && this.props.onFilter === props.onFilter) {
                this.triggerFilterStateUpdate(props, libraryDefinition, libraryDefinition.definition);
              }
            })
            .catch((error) => {
              console.error(error);
            });
        }
      }
    }
  }

  private triggerFilterStateUpdate(props: LibraryTreeItemProps, libraryDefinition: LibraryDefinition, definition: Fmt.Definition): void {
    let libraryDefinitionPromise = this.libraryDefinitionPromise;
    let visibilityResult = checkVisibility(props.libraryDataProvider, props.path, props.isSubsection, libraryDefinition, definition, props.searchWords, props.onFilter);
    visibilityResult.visible.then((visible: boolean) => {
      if (this.libraryDefinitionPromise === libraryDefinitionPromise && areSearchWordsEqual(this.props.searchWords, props.searchWords) && this.props.onFilter === props.onFilter) {
        this.setState({
          filtering: false,
          filtered: !visible
        });
        if (props.visibleSiblings) {
          if (!visible) {
            props.visibleSiblings.delete(this);
          }
          this.checkVisibleSiblings(props.visibleSiblings);
        }
      }
    });
    if (!props.isSubsection) {
      visibilityResult.selectable.then((selectable: boolean) => {
        if (this.libraryDefinitionPromise === libraryDefinitionPromise && areSearchWordsEqual(this.props.searchWords, props.searchWords) && this.props.onFilter === props.onFilter) {
          this.setState({
            clickable: selectable
          });
        }
      });
    }
  }

  private updateSelection(props: LibraryTreeItemProps): void {
    if (props.selectedChildPath && !this.clicked) {
      this.setState({opened: true});
    } else if (props.selected && !this.clicked) {
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
      }
      this.scrollTimer = setTimeout(this.scrollIntoView, 100);
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
          let innerLibraryDataProvider = this.props.libraryDataProvider.getProviderForSection(this.props.path, this.props.itemInfo.itemNumber);
          contents = <InnerLibraryTreeItems libraryDataProvider={innerLibraryDataProvider} sectionPromise={this.libraryDefinitionPromise} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} searchWords={this.props.searchWords} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} interactionHandler={this.props.interactionHandler} onItemClicked={this.props.onItemClicked} onInsertButtonClicked={this.props.onInsertButtonClicked} indent={this.props.indent + 1} key={`inner-${innerLibraryDataProvider.getSectionChangeCounter()}`}/>;
        }
      }
    } else {
      let definition = this.state.definition;
      if (definition && this.props.onFilter && this.libraryDefinitionPromise) {
        if (definition.innerDefinitions.length) {
          contents = <InnerLibraryTreeItems libraryDataProvider={this.props.libraryDataProvider} libraryDefinition={this.libraryDefinitionPromise.getImmediateResult()} innerDefinitions={definition.innerDefinitions} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} searchWords={this.props.searchWords} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} interactionHandler={this.props.interactionHandler} onItemClicked={this.props.onItemClicked} indent={this.props.indent + 1} key="inner"/>;
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
          if (this.refreshToolTip) {
            this.refreshToolTip = false;
          } else if (display && this.props.parentScrollPane.htmlNode) {
            let getToolTipContents = () => {
              rendererOptions.maxListLength = 20;
              let renderedDefinition = renderer.renderDefinition(undefined, LibraryTreeItem.renderedDefinitionOptions);
              if (renderedDefinition) {
                return <Expression expression={renderedDefinition}/>;
              }
              return null;
            };
            let toolTip = <ExpressionToolTip active={this.state.showToolTip} position="right" parent={this} getContents={getToolTipContents} delay={250} key="tooltip"/>;
            display = [display, toolTip];
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
          specialIcon = getButtonIcon(ButtonType.Insert);
          break;
        case LibraryDefinitionState.Submitting:
          specialIcon = <Loading width={'1em'} height={'1em'}/>;
          break;
        }
      }
    }
    let treeItemContents = this.getTreeItemContents(icon, specialIcon, display);
    let treeItem: React.ReactNode;
    let mouseEntered = () => this.setState({showToolTip: true});
    let mouseLeft = () => this.setState({showToolTip: false});
    if (this.state.clickable) {
      let href = this.props.libraryDataProvider.pathToURI(FmtUtils.getOuterPath(this.props.path));
      treeItem = (
        <a className={className} href={href} onClick={this.itemClicked} onMouseEnter={mouseEntered} onMouseLeave={mouseLeft} ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          {treeItemContents}
        </a>
      );
    } else {
      treeItem = (
        <div className={className} onMouseEnter={mouseEntered} onMouseLeave={mouseLeft} ref={(htmlNode) => (this.htmlNode = htmlNode)}>
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
      if (this.state.showToolTip) {
        this.refreshToolTip = true;
        this.setState({showToolTip: false});
      }
    }
  };

  private onScroll = () => {
    if (this.state.showToolTip) {
      this.refreshToolTip = true;
      this.setState({showToolTip: false});
    }
  };

  private onExpressionChanged = () => {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    this.updateTimer = setTimeout(() => this.forceUpdate(), 200);
  };

  private checkVisibleSiblings(visibleSiblings: Set<LibraryTreeItem>): void {
    let check = () => {
      if (visibleSiblings.size <= 2) {
        for (let item of visibleSiblings) {
          if (item.props.isSubsection && !item.state.opened && !item.state.filtering) {
            item.setState({opened: true});
          }
        }
      }
    };
    if (this.siblingsTimer) {
      clearTimeout(this.siblingsTimer);
    }
    this.siblingsTimer = setTimeout(check, 10);
  }
}

interface LibraryTreeInsertionItemProps extends LibraryTreeItemBaseProps {
  section: LibraryDefinition;
  onInsertButtonClicked: OnInsertButtonClicked;
}

export class LibraryTreeInsertionItem extends LibraryTreeItemBase<LibraryTreeInsertionItemProps> {
  constructor(props: LibraryTreeInsertionItemProps) {
    super(props);
    this.state = {};
  }

  render(): React.ReactNode {
    let menuItems: React.ReactNodeArray = this.props.libraryDataProvider.logic.topLevelDefinitionTypes.map((definitionType: Logic.LogicDefinitionTypeDescription) => {
      let onClick = () => this.props.onInsertButtonClicked(this.props.libraryDataProvider, this.props.section, definitionType);
      return (
        <Button isMenuItem={true} onClick={onClick} key={definitionType.definitionType}>
          {[getDefinitionIcon(definitionType.definitionType), ' ', `New ${definitionType.name.toLowerCase()}...`]}
        </Button>
      );
    });
    {
      let onClick = () => this.props.onInsertButtonClicked(this.props.libraryDataProvider, this.props.section, undefined);
      menuItems.unshift(
        <Button isMenuItem={true} onClick={onClick} key="section">
          {[getSectionIcon(false), ' ', 'New section...']}
        </Button>
      );
    }
    let insertButton = (
      <MenuButton className={'tree-item-insert-button standalone'} menuClassName={'open-menu'} toolTipText={'Add new item'} menu={menuItems} key="insert-button">
        {getButtonIcon(ButtonType.Insert)}
      </MenuButton>
    );
    let treeItemContents = this.getTreeItemContents(undefined, undefined, insertButton);
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
