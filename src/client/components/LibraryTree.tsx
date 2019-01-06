import * as React from 'react';
import './LibraryTree.css';
import * as Fmt from '../../shared/format/format';
import * as FmtLibrary from '../../shared/format/library';
import { LibraryDataProvider, LibraryItemInfo } from '../../shared/data/libraryDataProvider';
import Expression from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';
import { ButtonType, getButtonIcon, getDefinitionIcon } from '../utils/icons';

const ToolTip = require('react-portal-tooltip').default;

type OnItemClicked = (item: FmtLibrary.MetaRefExpression_item, libraryDataProvider: LibraryDataProvider, path: Fmt.Path, definitionPromise: CachedPromise<Fmt.Definition>, itemInfo: LibraryItemInfo) => void;

let previewContents: any = null;

interface LibraryTreeItemProps {
  libraryDataProvider: LibraryDataProvider;
  item: FmtLibrary.MetaRefExpression_item | FmtLibrary.MetaRefExpression_subsection;
  path: Fmt.Path;
  itemInfo: LibraryItemInfo;
  templates?: Fmt.File;
  parentScrollPane: HTMLElement | null;
  isSingle: boolean;
  isLast: boolean;
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

  constructor(props: LibraryTreeItemProps) {
    super(props);

    this.state = {
      opened: false,
      showPreview: false
    };
  }

  componentDidMount(): void {
    this.updateItem(this.props);
    this.updateSelection(this.props);
  }

  componentWillReceiveProps(props: LibraryTreeItemProps): void {
    if (props.item !== this.props.item
        || (props.item instanceof FmtLibrary.MetaRefExpression_item && this.definitionPromise && !props.libraryDataProvider.isItemUpToDate(props.path, this.definitionPromise))) {
      this.updateItem(props);
    }
    if (!props.libraryDataProvider.arePathsEqual(props.selectedChildPath, this.props.selectedChildPath)) {
      this.updateSelection(props);
    }
  }

  private updateItem(props: LibraryTreeItemProps): void {
    let autoOpen = props.item instanceof FmtLibrary.MetaRefExpression_subsection && props.isSingle;
    this.setState({opened: autoOpen});

    let definitionPromise: CachedPromise<Fmt.Definition> | undefined = undefined;
    if (props.item instanceof FmtLibrary.MetaRefExpression_item) {
      definitionPromise = props.libraryDataProvider.fetchItem(props.path);
    } else if (props.item instanceof FmtLibrary.MetaRefExpression_subsection) {
      definitionPromise = props.libraryDataProvider.fetchSubsection(props.path);
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

    this.clicked = false;
  }

  private updateSelection(props: LibraryTreeItemProps): void {
    if (props.selectedChildPath && !this.clicked) {
      if (props.item instanceof FmtLibrary.MetaRefExpression_item) {
        setTimeout(this.scrollIntoView, 100);
      } else if (props.item instanceof FmtLibrary.MetaRefExpression_subsection) {
        this.setState({opened: true});
      }
    } else {
      this.clicked = false;
    }
  }

  componentWillUnmount(): void {
    this.definitionPromise = undefined;
  }

  render(): any {
    let item = this.props.item;
    let className = 'tree-item hoverable';
    let contents: any = null;
    let icon: any = '\u2001';
    let display: any = undefined;
    if (this.props.itemInfo.title instanceof Fmt.CompoundExpression) {
      let englishTitle = this.props.itemInfo.title.arguments.getOptionalValue('en');
      if (englishTitle instanceof Fmt.StringExpression) {
        display = englishTitle.value;
      }
    }
    if (item instanceof FmtLibrary.MetaRefExpression_item) {
      if (this.state.definition) {
        let logic = this.props.libraryDataProvider.logic;
        let logicDisplay = logic.getDisplay();
        let definitionType = logicDisplay.getDefinitionType(this.state.definition);
        let definitionIcon = getDefinitionIcon(definitionType, this.props.itemInfo);
        icon = <span>{definitionIcon}{icon}</span>;
        if (this.props.templates) {
          let renderer = logicDisplay.getRenderer(this.props.libraryDataProvider, this.props.templates, false);
          if (display === undefined) {
            let summary = renderer.renderDefinitionSummary(this.state.definition);
            if (summary) {
              display = <Expression expression={summary} key="summary"/>;
            }
          }
          if (display !== undefined && this.props.parentScrollPane && !this.props.selectedChildPath) {
            let showPreview = false;
            if (this.state.showPreview) {
              let definition = renderer.renderDefinition(this.state.definition, undefined, false, true, false, false);
              if (definition) {
                previewContents = <Expression expression={definition}/>;
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
      if (this.props.selectedChildPath) {
        className += ' selected';
      }
    } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
      if (this.state.opened) {
        icon = getButtonIcon(ButtonType.DownArrow);
        if (this.definitionPromise) {
          contents = <LibraryTree libraryDataProvider={this.props.libraryDataProvider.getProviderForSection(this.props.path, this.props.itemInfo.itemNumber)} section={this.definitionPromise} itemNumber={this.props.itemInfo.itemNumber} templates={this.props.templates} parentScrollPane={this.props.parentScrollPane} isLast={this.props.isLast} selectedItemPath={this.props.selectedChildPath} onItemClicked={this.props.onItemClicked}/>;
        }
      } else {
        icon = getButtonIcon(ButtonType.RightArrow);
      }
    }
    if (display === undefined) {
      display = this.props.path.name;
    }
    let href = this.props.libraryDataProvider.pathToURI(this.props.path);
    let result: any = (
      <a className={className} href={href} onClick={this.itemClicked} onMouseEnter={this.mouseEntered} onMouseLeave={this.mouseLeft} key="display" ref={(htmlNode) => (this.htmlNode = htmlNode)}>
        <div className={'tree-item-icon'}>{icon}</div>
        <div className={'tree-item-display'}>{display}</div>
      </a>
    );
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

  private itemClicked = (event: any): void => {
    if (event.button < 1 || this.props.item instanceof FmtLibrary.MetaRefExpression_subsection) {
      event.preventDefault();
      this.clicked = true;
      if (this.props.item instanceof FmtLibrary.MetaRefExpression_subsection) {
        if (this.props.isLast && !this.state.opened) {
          setTimeout(this.scrollIntoView, 100);
        }
        this.setState((prevState) => ({opened: !prevState.opened}));
      } else if (this.props.item instanceof FmtLibrary.MetaRefExpression_item && this.props.onItemClicked && this.definitionPromise) {
        this.props.onItemClicked(this.props.item, this.props.libraryDataProvider, this.props.path, this.definitionPromise, this.props.itemInfo);
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
      this.htmlNode.scrollIntoView({block: 'nearest'});
    }
  }

  // Calculate visible dimensions for tooltip.
  getBoundingClientRect() {
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
}

interface LibraryTreeProps {
  libraryDataProvider: LibraryDataProvider;
  section: CachedPromise<Fmt.Definition>;
  itemNumber: number[];
  templates?: Fmt.File;
  parentScrollPane: HTMLElement | null;
  isLast: boolean;
  selectedItemPath?: Fmt.Path;
  onItemClicked?: OnItemClicked;
}

function LibraryTree(props: LibraryTreeProps): any {
  let render = props.section.then((section: Fmt.Definition) => {
    if (section.contents instanceof FmtLibrary.ObjectContents_Section) {
      let items = section.contents.items as Fmt.ArrayExpression;
      let selectedItemPathHead: Fmt.NamedPathItem | undefined = undefined;
      let selectedItemPathTail: Fmt.Path | undefined = undefined;
      if (props.selectedItemPath) {
        let item: Fmt.PathItem | undefined = props.selectedItemPath;
        selectedItemPathTail = new Fmt.Path;
        selectedItemPathTail.name = props.selectedItemPath.name;
        selectedItemPathHead = selectedItemPathTail;
        for (; item instanceof Fmt.NamedPathItem; item = item.parentPath) {
          let itemCopy = new Fmt.NamedPathItem;
          itemCopy.name = item.name;
          if (item.parentPath) {
            selectedItemPathHead.parentPath = itemCopy;
          }
          selectedItemPathHead = itemCopy;
        }
      }
      return (
        <div className={'tree'}>
          {items.items.map((item: Fmt.Expression, index: number) => {
            if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
              let path = (item.ref as Fmt.DefinitionRefExpression).path;
              let selectedChildPath: Fmt.Path | undefined = undefined;
              if (selectedItemPathHead && path.name === selectedItemPathHead.name) {
                selectedChildPath = selectedItemPathTail;
              }
              let first = index === 0;
              let last = index === items.items.length - 1;
              let itemInfo: LibraryItemInfo = {
                itemNumber: [...props.itemNumber, index + 1],
                type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
                title: item.title
              };
              return <LibraryTreeItem libraryDataProvider={props.libraryDataProvider} item={item} path={path} itemInfo={itemInfo} templates={props.templates} parentScrollPane={props.parentScrollPane} isSingle={first && last} isLast={props.isLast && last} selectedChildPath={selectedChildPath} onItemClicked={props.onItemClicked} key={path.name}/>;
            } else {
              return null;
            }
          })}
        </div>
      );
    } else {
      return <div className={'error'}>Error: Invalid section content type</div>;
    }
  });

  return renderPromise(render);
}

export default LibraryTree;
