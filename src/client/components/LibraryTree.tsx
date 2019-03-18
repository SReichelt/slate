import * as React from 'react';
import './LibraryTree.css';
import * as Fmt from '../../shared/format/format';
import * as FmtUtils from '../../shared/format/utils';
import * as FmtLibrary from '../../shared/logics/library';
import { LibraryDataProvider, LibraryItemInfo } from '../../shared/data/libraryDataProvider';
import Expression from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';
import { ButtonType, getButtonIcon, getDefinitionIcon } from '../utils/icons';

const ToolTip = require('react-portal-tooltip').default;

export type OnFilter = (definition: Fmt.Definition) => boolean;
export type OnItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, definitionPromise?: CachedPromise<Fmt.Definition>, itemInfo?: LibraryItemInfo) => void;

let previewContents: React.ReactNode = null;

interface LibraryTreeItemProps {
  libraryDataProvider: LibraryDataProvider;
  outerDefinition?: Fmt.Definition;
  isSubsection: boolean;
  path: Fmt.Path;
  itemInfo: LibraryItemInfo;
  templates?: Fmt.File;
  parentScrollPane: HTMLElement | null;
  isSingle: boolean;
  isLast: boolean;
  onFilter?: OnFilter;
  selected: boolean;
  selectedChildPath?: Fmt.Path;
  onItemClicked?: OnItemClicked;
}

interface LibraryTreeItemState {
  definition?: Fmt.Definition;
  opened: boolean;
  showPreview: boolean;
}

class LibraryTreeItem extends React.Component<LibraryTreeItemProps, LibraryTreeItemState> {
  private definitionPromise?: CachedPromise<Fmt.Definition>;
  private htmlNode: HTMLElement | null = null;
  private clicked: boolean = false;
  private hovered: boolean = false;
  private refreshTooltip: boolean = false;

  constructor(props: LibraryTreeItemProps) {
    super(props);

    this.state = {
      opened: false,
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
        || props.outerDefinition !== this.props.outerDefinition
        || (!props.isSubsection && this.definitionPromise && !props.libraryDataProvider.isItemUpToDate(props.path, this.definitionPromise))) {
      this.updateItem(props);
    }
    if (!FmtUtils.arePathsEqual(props.selectedChildPath, this.props.selectedChildPath)) {
      this.updateSelection(props);
    }
  }

  private updateItem(props: LibraryTreeItemProps): void {
    let autoOpen = props.isSubsection && props.isSingle;
    this.setState({opened: autoOpen});

    if (props.outerDefinition) {
      let definition = props.outerDefinition.innerDefinitions.getDefinition(props.path.name);
      this.setState({definition: definition});
    } else {
      let definitionPromise: CachedPromise<Fmt.Definition> | undefined = undefined;
      if (props.isSubsection) {
        definitionPromise = props.libraryDataProvider.fetchSubsection(props.path);
      } else {
        definitionPromise = props.libraryDataProvider.fetchItem(props.path);
      }
      this.definitionPromise = definitionPromise;

      if (definitionPromise) {
        definitionPromise
          .then((definition: Fmt.Definition) => {
            if (this.definitionPromise === definitionPromise) {
              this.setState({definition: definition});
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
      if (props.isSubsection) {
        this.setState({opened: true});
      } else {
        setTimeout(this.scrollIntoView, 100);
      }
    } else {
      this.clicked = false;
    }
  }

  componentWillUnmount(): void {
    if (this.props.parentScrollPane) {
      this.props.parentScrollPane.removeEventListener('scroll', this.onScroll);
    }
    this.definitionPromise = undefined;
  }

  render(): React.ReactNode {
    let className = 'tree-item hoverable';
    let contents: React.ReactNode = null;
    let icon: React.ReactNode = '\u2001';
    let display: React.ReactNode = this.props.itemInfo ? this.props.itemInfo.title : undefined;
    let clickable = true;
    if (this.props.isSubsection) {
      if (this.state.opened) {
        icon = getButtonIcon(ButtonType.DownArrow);
        if (this.definitionPromise) {
          contents = <InnerLibraryTree libraryDataProvider={this.props.libraryDataProvider.getProviderForSection(this.props.path, this.props.itemInfo.itemNumber)} section={this.definitionPromise} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} isLast={this.props.isLast} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} onItemClicked={this.props.onItemClicked}/>;
        }
      } else {
        icon = getButtonIcon(ButtonType.RightArrow);
      }
    } else {
      let definition = this.state.definition;
      if (this.props.onFilter) {
        if (!definition) {
          return null;
        }
        let innerDefinitions: Fmt.Definition[] = [];
        if (definition.innerDefinitions.length) {
          for (let innerDefinition of definition.innerDefinitions) {
            if (this.props.onFilter(innerDefinition)) {
              innerDefinitions.push(innerDefinition);
            }
          }
        }
        if (!this.props.onFilter(definition)) {
          if (!innerDefinitions.length) {
            return null;
          }
          clickable = false;
          contents = <InnerLibraryTree libraryDataProvider={this.props.libraryDataProvider} outerDefinition={definition} innerDefinitions={innerDefinitions} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} isLast={this.props.isLast} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedChildPath} onItemClicked={this.props.onItemClicked}/>;
        }
      }
      if (definition) {
        let logic = this.props.libraryDataProvider.logic;
        let logicDisplay = logic.getDisplay();
        let definitionType = logicDisplay.getDefinitionType(definition);
        let definitionIcon = getDefinitionIcon(definitionType, this.props.itemInfo);
        icon = <span>{definitionIcon}{icon}</span>;
        if (this.props.templates) {
          let outerDefinition = this.props.outerDefinition || definition;
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
    let result: React.ReactNode = [
      <div className={'tree-item-icon'} key="icon">{icon}</div>,
      <div className={'tree-item-display'} key="display">{display}</div>
    ];
    if (clickable) {
      let href = this.props.libraryDataProvider.pathToURI(FmtUtils.getOuterPath(this.props.path));
      result = (
        <a className={className} href={href} onClick={this.itemClicked} onMouseEnter={this.mouseEntered} onMouseLeave={this.mouseLeft} key="display" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          {result}
        </a>
      );
    } else {
      result = (
        <div className={className} onMouseEnter={this.mouseEntered} onMouseLeave={this.mouseLeft} key="display" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
          {result}
        </div>
      );
    }
    if (contents) {
      let contentsRow = (
        <div className={'tree-item-contents'} key="contents">
          <div className={'tree-item-icon'}/>
          <div className={'tree-item-content-display'}>{contents}</div>
        </div>
      );
      result = [result, contentsRow];
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
      } else if (this.props.onItemClicked) {
        this.props.onItemClicked(this.props.libraryDataProvider, this.props.path, this.definitionPromise, this.props.itemInfo);
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
  section?: CachedPromise<Fmt.Definition>;
  outerDefinition?: Fmt.Definition;
  innerDefinitions?: Fmt.Definition[];
  itemNumber: number[];
  isLast: boolean;
}

function renderLibraryTree(props: InnerLibraryTreeProps, items: (Fmt.Expression | Fmt.Definition)[]) {
  let parentPath: Fmt.Path | undefined = undefined;
  if (props.outerDefinition) {
    parentPath = new Fmt.Path;
    parentPath.name = props.outerDefinition.name;
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

  return (
    <div className={'tree'}>
      {items.map((item: Fmt.Expression | Fmt.Definition, index: number) => {
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
          let first = index === 0;
          let last = index === items.length - 1;
          let itemInfo: LibraryItemInfo = {
            itemNumber: [...props.itemNumber, index + 1],
            type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
            title: item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection ? item.title : undefined
          };
          return <LibraryTreeItem libraryDataProvider={props.libraryDataProvider} outerDefinition={props.outerDefinition} isSubsection={isSubsection} path={path} itemInfo={itemInfo} templates={props.templates} parentScrollPane={props.parentScrollPane} isSingle={first && last} isLast={props.isLast && last} onFilter={props.onFilter} selected={selected} selectedChildPath={selectedChildPath} onItemClicked={props.onItemClicked} key={path.name}/>;
        } else {
          return null;
        }
      })}
    </div>
  );
}

function InnerLibraryTree(props: InnerLibraryTreeProps) {
  if (props.section) {
    let render = props.section.then((section: Fmt.Definition) => {
      if (section.contents instanceof FmtLibrary.ObjectContents_Section) {
        let items = section.contents.items as Fmt.ArrayExpression;
        return renderLibraryTree(props, items.items);
      } else {
        return <div className={'error'}>Error: Invalid section content type</div>;
      }
    });
    return renderPromise(render);
  } else if (props.innerDefinitions) {
    return renderLibraryTree(props, props.innerDefinitions);
  } else {
    return null;
  }
}

function LibraryTree(props: LibraryTreeProps) {
  let innerProps: InnerLibraryTreeProps = {
    ...props,
    section: props.libraryDataProvider.fetchLocalSection(),
    itemNumber: [],
    isLast: true
  };
  return InnerLibraryTree(innerProps);
}

export default LibraryTree;
