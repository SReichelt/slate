import * as React from 'react';
import './App.css';
import SplitPane from 'react-split-pane';
import LibraryTree from './components/LibraryTree';
import LibraryItem from './components/LibraryItem';
import SourceCodeView from './components/SourceCodeView';
import ToggleButton from './components/ToggleButton';
import CachedPromise from '../shared/data/cachedPromise';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtLibrary from '../shared/format/library';
import * as FmtDisplay from '../shared/display/meta';
import { FileAccessor, FileContents } from '../shared/data/fileAccessor';
import { WebFileAccessor } from './data/webFileAccessor';
import { LibraryDataProvider, LibraryItemInfo } from '../shared/data/libraryDataProvider';
import * as Logic from '../shared/logics/logic';
import * as Logics from '../shared/logics/logics';

interface AppProps {
}

interface SelectionState {
  selectedItemPath?: Fmt.Path;
  selectedItemProvider?: LibraryDataProvider;
  selectedItemDefinition?: CachedPromise<Fmt.Definition>;
  selectedItemInfo?: CachedPromise<LibraryItemInfo>;
}

interface AppState extends SelectionState {
  width: number;
  height: number;
  error?: string;
  templates?: Fmt.File;
  extraContentsVisible: boolean;
}

class App extends React.Component<AppProps, AppState> {
  private logic: Logic.Logic;
  private fileAccessor: FileAccessor;
  private libraryDataProvider: LibraryDataProvider;
  private library: CachedPromise<Fmt.Definition>;
  private treePaneNode: HTMLElement | null = null;

  constructor(props: AppProps) {
    super(props);

    this.logic = Logics.hlm;
    this.fileAccessor = new WebFileAccessor;
    this.libraryDataProvider = new LibraryDataProvider(this.logic, this.fileAccessor, '/libraries/hlm', undefined, 'Library');

    this.library = this.libraryDataProvider.fetchLocalSection();

    let state: AppState = {
      width: window.innerWidth,
      height: window.innerHeight,
      extraContentsVisible: false
    };
    this.updateSelectionState(state);
    this.state = state;
  }

  private updateSelectionState(state: SelectionState): boolean {
    let path = this.libraryDataProvider.uriToPath(location.pathname);
    if (path) {
      this.fillSelectionState(state, path);
      return true;
    }
    return false;
  }

  private fillSelectionState(state: SelectionState, path: Fmt.Path): void {
    state.selectedItemPath = path;
    state.selectedItemProvider = this.libraryDataProvider.getProviderForSection(path.parentPath);
    state.selectedItemDefinition = state.selectedItemProvider.fetchLocalItem(path.name);
    state.selectedItemInfo = state.selectedItemProvider.getLocalItemInfo(path.name);
  }

  componentDidMount(): void {
    window.onpopstate = () => {
      let state: SelectionState = {};
      if (this.updateSelectionState(state)) {
        this.setState(state);
      }
    };

    window.onresize = () => {
      this.setState({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    let templateUri = '/display/templates.hlm';
    this.fileAccessor.readFile(templateUri)
      .then((contents: FileContents) => {
        let templates = FmtReader.readString(contents.text, templateUri, FmtDisplay.getMetaModel);
        contents.close();
        this.setState({templates: templates});
      })
      .catch((error) => {
        this.setState({error: error.message});
        console.error(error);
      });
  }

  componentWillUnmount(): void {
    window.onresize = null;
    window.onpopstate = null;
  }

  render(): any {
    if (this.state.error) {
      return <div className={'error'}>Error: {this.state.error}</div>;
    }

    let mainContents: any = undefined;
    let extraContents: any = undefined;
    if (this.state.templates && this.state.selectedItemProvider && this.state.selectedItemDefinition) {
      mainContents = <LibraryItem libraryDataProvider={this.state.selectedItemProvider} definition={this.state.selectedItemDefinition} itemInfo={this.state.selectedItemInfo} templates={this.state.templates} interactive={true} includeLabel={true} includeExtras={true} includeProofs={true} includeRemarks={true} onLinkClicked={this.linkClicked}/>;
      extraContents = <SourceCodeView libraryDataProvider={this.state.selectedItemProvider} definition={this.state.selectedItemDefinition}/>;
    } else {
      mainContents = 'Please select an item from the tree.';
    }

    let verticalWindow = this.state.height > this.state.width;
    let windowSize = verticalWindow ? this.state.height : this.state.width;
    let defaultItemHeight = verticalWindow ? this.state.height / 3 : this.state.height / 2;

    let contentsPane = (
      <div className={'bottom-toolbar-container'}>
        <div className={'app-pane'}>
          <div className={'app-contents'}>
            {mainContents}
          </div>
        </div>
        <div className={'bottom-toolbar'}>
          <ToggleButton selected={this.state.extraContentsVisible} onToggle={(selected: boolean) => this.setState({extraContentsVisible: selected})}>
            <div>{'{⋯}'}</div>
          </ToggleButton>
        </div>
      </div>
    );
    if (extraContents && this.state.extraContentsVisible) {
      contentsPane = (
        <SplitPane split={'horizontal'} defaultSize={defaultItemHeight}>
          {contentsPane}
          <div className={'app-pane'}>
            <div className={'app-contents'}>
              {extraContents}
            </div>
          </div>
        </SplitPane>
      );
    }

    return (
      <div className={'app'}>
        <SplitPane split={verticalWindow ? 'horizontal' : 'vertical'} minSize={windowSize / 5} maxSize={windowSize * 4 / 5} defaultSize={windowSize / 3}>
          <div className={'app-pane'} ref={(htmlNode) => (this.treePaneNode = htmlNode)}>
            <div className={'app-tree'}>
              <LibraryTree libraryDataProvider={this.libraryDataProvider} section={this.library} itemNumber={[]} templates={this.state.templates} parentScrollPane={this.treePaneNode} isLast={true} selectedItemPath={this.state.selectedItemPath} onItemClicked={this.treeItemClicked}/>
            </div>
          </div>
          {contentsPane}
        </SplitPane>
      </div>
    );
  }

  private treeItemClicked = (item: FmtLibrary.MetaRefExpression_item, libraryDataProvider: LibraryDataProvider, path: Fmt.Path, definitionPromise: CachedPromise<Fmt.Definition>, itemInfo: LibraryItemInfo): void => {
    this.setState({
      selectedItemPath: libraryDataProvider.getAbsolutePath(path),
      selectedItemProvider: libraryDataProvider,
      selectedItemDefinition: definitionPromise,
      selectedItemInfo: CachedPromise.resolve(itemInfo)
    });

    let uri = libraryDataProvider.pathToURI(path);
    history.pushState(null, 'HLM', uri);
  }

  private linkClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path) => {
    let state: SelectionState = {};
    this.fillSelectionState(state, libraryDataProvider.getAbsolutePath(path));
    this.setState(state);

    let uri = libraryDataProvider.pathToURI(path);
    history.pushState(null, 'HLM', uri);
  }
}

export default App;
