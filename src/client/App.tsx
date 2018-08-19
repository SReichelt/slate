import * as React from 'react';
import './App.css';
import SplitPane from 'react-split-pane';
import LibraryTree from './components/LibraryTree';
import LibraryItem from './components/LibraryItem';
import CachedPromise from '../shared/data/cachedPromise';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtLibrary from '../shared/format/library';
import * as FmtDisplay from '../shared/display/meta';
import { LibraryDataProvider, LibraryItemInfo } from '../shared/data/libraryDataProvider';
import * as Logic from './logics/logic';
import { HLM } from './logics/hlm/hlm';

interface AppProps {
}

interface AppState {
  error?: string;
  templates?: Fmt.File;
  selectedItemPath?: Fmt.Path;
  selectedItemProvider?: LibraryDataProvider;
  selectedItemDefinition?: CachedPromise<Fmt.Definition>;
  selectedItemInfo?: CachedPromise<LibraryItemInfo>;
}

class App extends React.Component<AppProps, AppState> {
  private logic: Logic.Logic;
  private libraryDataProvider: LibraryDataProvider;
  private library: CachedPromise<Fmt.Definition>;
  private treePaneNode: HTMLElement | null = null;

  constructor(props: AppProps) {
    super(props);

    this.logic = new HLM;
    this.libraryDataProvider = new LibraryDataProvider(this.logic, '/libraries/hlm', undefined, 'Library');

    this.library = this.libraryDataProvider.fetchLocalSection();

    this.treeItemClicked = this.treeItemClicked.bind(this);
    this.linkClicked = this.linkClicked.bind(this);

    let state: AppState = {};
    this.updateSelectionState(state);
    this.state = state;
  }

  private updateSelectionState(state: AppState): boolean {
    let path = this.libraryDataProvider.uriToPath(location.pathname);
    if (path) {
      this.fillSelectionState(state, path);
      return true;
    }
    return false;
  }

  private fillSelectionState(state: AppState, path: Fmt.Path): void {
    state.selectedItemPath = path;
    state.selectedItemProvider = this.libraryDataProvider.getProviderForSection(path.parentPath);
    state.selectedItemDefinition = state.selectedItemProvider.fetchLocalItem(path.name);
    state.selectedItemInfo = state.selectedItemProvider.getLocalItemInfo(path.name);
  }

  componentDidMount(): void {
    onpopstate = () => {
      let state: AppState = {};
      if (this.updateSelectionState(state)) {
        this.setState(state);
      }
    };

    fetch('/display/templates.hlm')
      .then((response: Response) => FmtReader.readResponse(response, new Fmt.ContextProvider(FmtDisplay.metaDefinitions)))
      .then((templates: Fmt.File) => {
        this.setState({templates: templates});
      })
      .catch((error) => {
        this.setState({error: error.message});
        console.error(error);
      });
  }

  componentWillUnmount(): void {
    onpopstate = () => {
      // Can't do anything after unmounting.
    };
  }

  render(): any {
    if (this.state.error) {
      return <div className={'error'}>Error: {this.state.error}</div>;
    }

    let contents: any = undefined;
    if (this.state.templates && this.state.selectedItemProvider && this.state.selectedItemDefinition) {
      contents = <LibraryItem libraryDataProvider={this.state.selectedItemProvider} definition={this.state.selectedItemDefinition} itemInfo={this.state.selectedItemInfo} templates={this.state.templates} interactive={true} includeLabel={true} includeExtras={true} includeProofs={true} includeRemarks={true} onLinkClicked={this.linkClicked}/>;
    } else {
      contents = 'Please select an item from the tree.';
    }

    return (
      <div className={'app'}>
        <SplitPane split="vertical" minSize={innerWidth / 5} defaultSize={innerWidth / 3}>
          <div className={'app-pane'} ref={(htmlNode) => (this.treePaneNode = htmlNode)}>
            <div className={'app-tree'}>
              <LibraryTree libraryDataProvider={this.libraryDataProvider} section={this.library} itemNumber={[]} templates={this.state.templates} parentScrollPane={this.treePaneNode} isLast={true} selectedItemPath={this.state.selectedItemPath} onItemClicked={this.treeItemClicked}/>
            </div>
          </div>
          <div className={'app-pane'}>
            <div className={'app-contents'}>
              {contents}
            </div>
          </div>
        </SplitPane>
      </div>
    );
  }

  treeItemClicked(item: FmtLibrary.MetaRefExpression_item, libraryDataProvider: LibraryDataProvider, path: Fmt.Path, definitionPromise: CachedPromise<Fmt.Definition>, itemInfo: LibraryItemInfo): void {
    this.setState({
      selectedItemPath: libraryDataProvider.getAbsolutePath(path),
      selectedItemProvider: libraryDataProvider,
      selectedItemDefinition: definitionPromise,
      selectedItemInfo: CachedPromise.resolve(itemInfo)
    });

    let uri = libraryDataProvider.pathToURI(path);
    history.pushState(null, 'HLM', uri);
  }

  linkClicked(libraryDataProvider: LibraryDataProvider, path: Fmt.Path) {
    let state: AppState = {};
    this.fillSelectionState(state, libraryDataProvider.getAbsolutePath(path));
    this.setState(state);

    let uri = libraryDataProvider.pathToURI(path);
    history.pushState(null, 'HLM', uri);
  }
}

export default App;
