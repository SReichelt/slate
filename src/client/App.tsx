import * as React from 'react';
import SplitPane from 'react-split-pane';
import * as Alert from 'react-alert';
const Loading = require('react-loading-animation');

import './App.css';

import ScrollPane from './components/ScrollPane';
import StartPage from './extras/StartPage';
import DocPage, { markdownSuffix } from './extras/DocPage';
import { DynamicTutorialState, addTutorial } from './extras/Tutorial';
import { startTutorial, TutorialStateTransitionFn } from './extras/TutorialContents';
import LibraryTree, { LibraryItemListEntry, LibraryItemList } from './components/LibraryTree';
import LibraryItem from './components/LibraryItem';
import SourceCodeView from './components/SourceCodeView';
import Button from './components/Button';
import MenuButton from './components/MenuButton';
import Message, { getAlertTemplate } from './components/Message';
import InsertDialog from './components/InsertDialog';
import { LibraryItemInteractionHandler } from './components/InteractionHandler';
import { renderPromise } from './components/PromiseHelper';

import config from './utils/config';
import { ButtonType, getButtonIcon } from './utils/icons';

import CachedPromise from 'slate-shared/data/cachedPromise';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtNotation from 'slate-shared/notation/meta';
import * as FmtLibrary from 'slate-shared/logics/library';
import * as Dialog from 'slate-shared/notation/dialog';
import * as Embedding from 'slate-env-web-api/embedding';
import { FileAccessor, WriteFileResult, FileWatcher } from 'slate-shared/data/fileAccessor';
import { WebFileAccessor, WebWriteFileResult } from 'slate-env-web/data/webFileAccessor';
import { PreloadingWebFileAccessor } from 'slate-env-web/data/preloadingWebFileAccessor';
import { LibraryDataProvider, LibraryDefinition, LibraryDefinitionState, LibraryItemInfo, LibraryDataProviderOptions, LibraryItemNumber } from 'slate-shared/data/libraryDataProvider';
import { fileExtension } from 'slate-shared/data/constants';
import { MRUList } from 'slate-shared/data/mostRecentlyUsedList';
import * as Logic from 'slate-shared/logics/logic';
import * as Logics from 'slate-shared/logics/logics';

import { fetchHelper } from './utils/fetchHelper';
import { GitHubFileAccessor, GitHubWriteFileResult, GitHubRepositoryAccess } from './data/gitHubFileAccessor';
import { VSCodeExtensionFileAccessor } from './data/vscodeExtensionFileAccessor';
import * as GitHub from './data/gitHubAPIHandler';


interface Libraries {
  [libraryName: string]: GitHub.Repository;
}
const libraries: Libraries = require('../../data/libraries/libraries.json');

const docsURIPrefix = 'docs/';
const dataURIPrefix = 'data/';
const preloadURIPrefix = 'preload/';
const librariesURIPrefix = 'libraries/';

const sourceCodeURLPrefix = `${config.projectRepositoryURL}/tree/master/`;

const appName = 'Slate';
const selectedLibraryName = 'hlm';

export interface AppTest {
  onSucceeded: () => void;
  onFailed: (error: Error) => void;
}

export interface AppTestProps {
  tutorialTest?: AppTest;
}

export interface AppProps extends AppTestProps {
  fileAccessor?: FileAccessor;
}

interface AppPropsWithAlert extends AppProps {
  alert: Alert.AlertManager;
}

interface SelectionState {
  selectedDocURI?: string;
  selectedItemRepository?: GitHub.Repository;
  selectedItemAbsolutePath?: Fmt.Path;
  selectedItemProvider?: LibraryDataProvider;
  selectedItemLocalPath?: Fmt.Path;
  selectedItemDefinition?: CachedPromise<LibraryDefinition | undefined>;
  selectedItemInfo?: CachedPromise<LibraryItemInfo>;
  interactionHandler?: LibraryItemInteractionHandler;
}

interface GitHubState {
  gitHubAuthInfo?: GitHub.AuthInfo;
  gitHubUserInfo?: CachedPromise<GitHub.UserInfo>;
}

interface AppState extends SelectionState, GitHubState {
  verticalLayout: boolean;
  navigationPaneVisible: boolean;
  extraContentsVisible: boolean;
  error?: string;
  templates?: Fmt.File;
  editedDefinitions: LibraryItemListEntry[];
  showStartPage: boolean;
  tutorialState?: DynamicTutorialState;
  insertDialog?: Dialog.InsertDialog;
}

class App extends React.Component<AppPropsWithAlert, AppState> {
  private static readonly gitHubAccessTokenStorageIdentifier = 'github_access_token';

  private static readonly renderedDefinitionOptions: Logic.FullRenderedDefinitionOptions = {
    includeProofs: true,
    includeLabel: true,
    includeExtras: true,
    includeRemarks: true
  };

  private mounted: boolean = false;
  private fileAccessor: FileAccessor;
  private libraryDataProvider: LibraryDataProvider;
  private templateFileWatcher?: FileWatcher;
  private mruList = new MRUList;
  private gitHubRepositoryAccess?: GitHubRepositoryAccess;

  constructor(props: AppPropsWithAlert) {
    super(props);

    const libraryURI = librariesURIPrefix + selectedLibraryName;
    const libraryRepository = libraries[selectedLibraryName];

    const state: AppState = {
      verticalLayout: !config.embedded && window.innerHeight > window.innerWidth,
      navigationPaneVisible: true,
      extraContentsVisible: false,
      editedDefinitions: [],
      showStartPage: !(config.embedded || config.runningLocally) || props.tutorialTest !== undefined
    };

    let libraryFileAccessor: FileAccessor | undefined = undefined;
    let selectionURI: string | undefined = undefined;
    let queryString: string | undefined = undefined;

    if (props.fileAccessor) {
      this.fileAccessor = props.fileAccessor;
    } else if (config.vsCodeAPI) {
      const fileAccessor = new VSCodeExtensionFileAccessor;
      window.onmessage = (event: MessageEvent) => {
        const message: Embedding.ResponseMessage = event.data;
        fileAccessor.messageReceived(message);
        this.processEmbeddingResponseMessage(message);
      };
      this.fileAccessor = fileAccessor;
      state.navigationPaneVisible = false;
    } else {
      this.fileAccessor = new WebFileAccessor(fetchHelper);

      selectionURI = window.location.pathname;
      queryString = window.location.search;
      let gitHubQueryStringResult: GitHub.QueryStringResult | undefined = undefined;
      if (queryString) {
        gitHubQueryStringResult = GitHub.parseQueryString(queryString);
        if (gitHubQueryStringResult.path) {
          selectionURI = gitHubQueryStringResult.path;
        }
      }
      const gitHubAPIAccess = this.createGitHubAPIAccess(gitHubQueryStringResult?.token);

      this.gitHubRepositoryAccess = {
        repository: libraryRepository
      };

      // When running locally, preloading always returns local files. If the user has logged in to GitHub, we want to load from GitHub instead.
      // When not running locally, preloading is possible as long as there are no local modifications. (See GitHubFileAccessor.)
      if (config.runningLocally) {
        if (gitHubAPIAccess) {
          libraryFileAccessor = this.createGitHubFileAccessor(state, gitHubAPIAccess);
          state.selectedItemRepository = libraryRepository;
        } else {
          libraryFileAccessor = new PreloadingWebFileAccessor(fetchHelper, dataURIPrefix + libraryURI, preloadURIPrefix + libraryURI);
        }
      } else {
        const fallbackFileAccessor = new PreloadingWebFileAccessor(fetchHelper, dataURIPrefix + libraryURI, preloadURIPrefix + libraryURI);
        libraryFileAccessor = this.createGitHubFileAccessor(state, gitHubAPIAccess, fallbackFileAccessor);
        state.selectedItemRepository = libraryRepository;
      }
    }

    if (!libraryFileAccessor) {
      libraryFileAccessor = this.fileAccessor.createChildAccessor(dataURIPrefix + libraryURI);
    }

    const libraryDataProviderOptions: LibraryDataProviderOptions = {
      logic: Logics.hlm,
      fileAccessor: libraryFileAccessor,
      watchForChanges: !config.testing,
      enablePrefetching: !config.testing,
      checkMarkdownCode: false,
      allowPlaceholders: config.embedded,
      externalURIPrefix: libraryURI
    };
    this.libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions);

    if (selectionURI) {
      this.updateSelectionState(state, selectionURI);
    }
    this.state = state;
    const title = this.getTitle(state);
    if (selectionURI && queryString) {
      this.setDocumentURI(selectionURI, title);
    }
    this.setDocumentTitle(state, title);
  }

  private updateSelectionState(state: SelectionState, uri: string): boolean {
    if (uri.startsWith('/')) {
      uri = uri.substring(1);
    }
    if (uri.startsWith(docsURIPrefix)) {
      state.selectedDocURI = uri;
      return true;
    } else if (uri.startsWith(librariesURIPrefix)) {
      const path = this.libraryDataProvider.uriToPath(uri);
      if (path) {
        this.fillSelectionState(state, this.libraryDataProvider, path);
        return true;
      }
    }
    return false;
  }

  private fillSelectionState(state: SelectionState, libraryDataProvider: LibraryDataProvider, path: Fmt.Path): void {
    state.selectedDocURI = undefined;
    state.selectedItemAbsolutePath = libraryDataProvider.getAbsolutePath(path);
    if (path.parentPath) {
      libraryDataProvider = this.libraryDataProvider.getProviderForSection(state.selectedItemAbsolutePath.parentPath);
      path = libraryDataProvider.getRelativePath(state.selectedItemAbsolutePath);
    }
    state.selectedItemProvider = libraryDataProvider;
    state.selectedItemLocalPath = path;
    const isSubsectionPromise = libraryDataProvider.isSubsection(path.name);
    state.selectedItemDefinition = isSubsectionPromise.then((isSubsection: boolean) =>
      isSubsection ? undefined : libraryDataProvider.fetchLocalItem(path.name, true));
    state.selectedItemInfo = libraryDataProvider.getLocalItemInfo(path.name);
  }

  private setNewInteractionHandler(state: SelectionState): void {
    state.interactionHandler = this.createInteractionHandler(state.selectedItemProvider, this.state.templates, state.selectedItemDefinition);
  }

  private createInteractionHandler(libraryDataProvider: LibraryDataProvider | undefined, templates: Fmt.File | undefined, selectedItemDefinition: CachedPromise<LibraryDefinition | undefined> | undefined): LibraryItemInteractionHandler | undefined {
    if (libraryDataProvider && templates) {
      return new LibraryItemInteractionHandler(libraryDataProvider, templates, selectedItemDefinition, this.linkClicked);
    } else {
      return undefined;
    }
  }

  componentDidMount(): void {
    this.mounted = true;

    if (!(config.embedded || config.testing)) {
      window.onpopstate = () => {
        // Explicitly set members to undefined; otherwise the back button cannot be used to return to an empty selection.
        const state: SelectionState = {
          selectedDocURI: undefined,
          selectedItemAbsolutePath: undefined,
          selectedItemProvider: undefined,
          selectedItemLocalPath: undefined,
          selectedItemDefinition: undefined,
          selectedItemInfo: undefined,
          interactionHandler: undefined
        };
        this.updateSelectionState(state, window.location.pathname);
        this.setNewInteractionHandler(state);
        this.setState(state);
      };

      window.onresize = () => {
        if (!(this.state.interactionHandler && this.state.interactionHandler.isBlocked())) {
          if (window.innerHeight > window.innerWidth * 1.25) {
            if (!this.state.verticalLayout) {
              this.setState({verticalLayout: true});
            }
          } else if (window.innerHeight * 1.25 < window.innerWidth) {
            if (this.state.verticalLayout) {
              this.setState({verticalLayout: false});
            }
          }
        }
      };

      window.onbeforeunload = () => {
        for (const editedDefinition of this.state.editedDefinitions) {
          if (editedDefinition.libraryDefinition.modified) {
            return 'Closing Slate will discard all unsubmitted edits. Are you sure?';
          }
        }
        return null;
      };

      GitHub.getAuthInfo()
        .then((info: GitHub.AuthInfo) => this.setState({gitHubAuthInfo: info}))
        .catch(() => {});

      if (this.state.gitHubUserInfo) {
        this.state.gitHubUserInfo.catch((error) => {
          this.discardGitHubLogin();
          this.props.alert.error('GitHub login failed: ' + error.message);
        });
      }
    }

    const templateFile = this.fileAccessor.openFile('data/notation/templates' + fileExtension, false);
    const setTemplates = (contents: string) => {
      if (this.mounted) {
        const templates = FmtReader.readString(contents, templateFile.fileName, FmtNotation.getMetaModel);
        this.setState({templates: templates});
        if (this.state.selectedItemProvider && this.state.selectedItemDefinition) {
          this.setState({interactionHandler: this.createInteractionHandler(this.state.selectedItemProvider, templates, this.state.selectedItemDefinition)});
        }
      }
    };
    this.templateFileWatcher = templateFile.watch?.(setTemplates);
    templateFile.read()
      .then(setTemplates)
      .catch((error) => {
        this.setState({error: error.message});
        console.error(error);
      });

    if (this.props.tutorialTest) {
      this.startTutorial(false, true);
    }
  }

  componentWillUnmount(): void {
    window.onresize = null;
    window.onpopstate = null;
    window.onbeforeunload = null;
    window.onmessage = null;
    this.templateFileWatcher?.close();
    this.libraryDataProvider.close();
    this.mounted = false;
  }

  private createGitHubAPIAccess(tokenPromise: Promise<string> | undefined): CachedPromise<GitHub.APIAccess> | undefined {
    if (tokenPromise) {
      const apiAccessPromise = tokenPromise.then((accessToken: string) => {
        try {
          window.localStorage.setItem(App.gitHubAccessTokenStorageIdentifier, accessToken);
        } catch (error) {
          console.log(error);
        }
        return new GitHub.APIAccess(accessToken);
      });
      return new CachedPromise<GitHub.APIAccess>(apiAccessPromise);
    } else {
      try {
        const gitHubAccessToken = window.localStorage.getItem(App.gitHubAccessTokenStorageIdentifier);
        if (gitHubAccessToken) {
          return CachedPromise.resolve(new GitHub.APIAccess(gitHubAccessToken));
        }
      } catch (error) {
        console.log(error);
      }
    }
    return undefined;
  }

  private createGitHubFileAccessor(state: AppState, gitHubAPIAccessPromise: CachedPromise<GitHub.APIAccess> | undefined, fallbackFileAccessor?: FileAccessor): FileAccessor {
    const gitHubRepositoryAccess = this.gitHubRepositoryAccess!;
    let gitHubRepositoryAccessPromise: CachedPromise<GitHubRepositoryAccess>;
    if (gitHubAPIAccessPromise) {
      state.gitHubUserInfo = gitHubAPIAccessPromise.then((apiAccess: GitHub.APIAccess) => {
        gitHubRepositoryAccess.apiAccess = apiAccess;
        return apiAccess.getUserInfo([gitHubRepositoryAccess.repository]);
      });
      gitHubRepositoryAccessPromise = state.gitHubUserInfo
        .then(() => {
          const {repository, apiAccess} = gitHubRepositoryAccess;
          if (apiAccess && repository.parentOwner && !repository.hasPullRequest) {
            return apiAccess.fastForward(repository, false)
              .then(() => { repository.pullRequestAllowed = true; })
              .catch(() => { repository.hasLocalChanges = true; });
          }
          return CachedPromise.resolve();
        })
        .catch(() => {})
        .then(() => {
          this.forceUpdate();
          return gitHubRepositoryAccess;
        });
    } else {
      gitHubRepositoryAccessPromise = CachedPromise.resolve(gitHubRepositoryAccess);
    }
    return new GitHubFileAccessor(gitHubRepositoryAccessPromise, fallbackFileAccessor);
  }

  private discardGitHubLogin(): void {
    if (this.gitHubRepositoryAccess) {
      this.gitHubRepositoryAccess.apiAccess = undefined;
    }
    this.setState({gitHubUserInfo: undefined});
    try {
      window.localStorage.removeItem(App.gitHubAccessTokenStorageIdentifier);
    } catch (error) {
      console.log(error);
    }
  }

  private processEmbeddingResponseMessage(message: Embedding.ResponseMessage): void {
    switch (message.command) {
    case 'SELECT':
      {
        let showNavigation = true;
        let uri = message.uri;
        if (uri?.startsWith(dataURIPrefix)) {
          uri = uri.substring(dataURIPrefix.length);
          showNavigation = !this.navigateToURI(uri);
        }
        if (this.state.navigationPaneVisible !== showNavigation) {
          this.setState({navigationPaneVisible: showNavigation});
        }
      }
      break;
    case 'UPDATE':
      this.state.interactionHandler?.expressionChanged(true, false);
      this.forceUpdate();
      break;
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return <div className={'error'}>Error: {this.state.error}</div>;
    }

    const windowSize = this.state.verticalLayout ? window.innerHeight : window.innerWidth;
    const defaultItemHeight = this.state.verticalLayout ? window.innerHeight / 3 : window.innerHeight / 2;

    let navigationPane: React.ReactNode = null;
    if (this.state.navigationPaneVisible) {
      let editListPane = <div className={'app-pane-placeholder'} key="edit-list"/>;
      if (this.state.editedDefinitions.length) {
        editListPane = (
          <div className={'app-pane'} key="edit-list">
            <LibraryItemList libraryDataProvider={this.libraryDataProvider} items={this.state.editedDefinitions} templates={this.state.templates} selectedItemPath={this.state.selectedItemAbsolutePath} interactionHandler={this.state.interactionHandler} onItemClicked={this.treeItemClicked}/>
          </div>
        );
      }
      // TODO react to double-click in embedded mode by
      //      1. opening permanently in vscode
      //      2. hiding the navigation pane
      navigationPane = (
        <SplitPane split={'horizontal'} size={this.state.editedDefinitions.length ? undefined : 0} resizerStyle={this.state.editedDefinitions.length ? undefined : {'height': 0, 'margin': 0}} key="nav">
          {editListPane}
          <nav className={'app-pane'} key="tree">
            <LibraryTree libraryDataProvider={this.libraryDataProvider} templates={this.state.templates} selectedItemPath={this.state.selectedItemAbsolutePath} interactionHandler={this.state.interactionHandler} onItemClicked={this.treeItemClicked} onInsertButtonClicked={this.insert}/>
          </nav>
        </SplitPane>
      );
    }

    let mainContents: React.ReactNode = null;
    let extraContents: React.ReactNode = null;

    if (this.state.selectedDocURI) {
      mainContents = <DocPage uri={this.state.selectedDocURI} onDocLinkClicked={this.docLinkClicked}/>;
    } else if (this.state.selectedItemDefinition) {
      const mainContentsPromise = this.state.selectedItemDefinition.then((definition: LibraryDefinition | undefined) => {
        if (definition && this.state.selectedItemProvider && this.state.templates) {
          const editing = definition.state === LibraryDefinitionState.Editing || definition.state === LibraryDefinitionState.EditingNew;
          let itemInfo = this.state.selectedItemInfo;
          if (editing && this.state.selectedItemLocalPath) {
            // When editing, item info may change according to user input. Need to make sure to get the correct instance - the one where the changes happen.
            itemInfo = this.state.selectedItemProvider.getLocalItemInfo(this.state.selectedItemLocalPath.name);
          }
          let mainContentsResult: React.ReactNode = <LibraryItem libraryDataProvider={this.state.selectedItemProvider} definition={definition} templates={this.state.templates} itemInfo={itemInfo} options={App.renderedDefinitionOptions} interactionHandler={this.state.interactionHandler} mruList={this.mruList} key="library-item"/>;

          if (editing) {
            if (this.state.tutorialState) {
              mainContentsResult = [<Message type={'info'} key="message">You are currently in tutorial mode. No changes will be submitted. <Button className={'standalone'} onClick={this.endTutorial}>{getButtonIcon(ButtonType.Close)} Exit tutorial</Button></Message>, mainContentsResult];
            } else if (this.state.gitHubAuthInfo && !this.state.gitHubUserInfo && !config.runningLocally) {
              mainContentsResult = [<Message type={'info'} key="message">You are currently contributing anonymously. To get credit for your work, you can either log in with a <a href="https://github.com/" target="_blank">GitHub</a> account or use the <a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate" target="_blank">Visual Studio Code extension</a>.<br/>All contributed material is assumed to be in the public domain.</Message>, mainContentsResult];
            } else if (this.state.selectedItemRepository) {
              const repository = this.state.selectedItemRepository;
              if (!repository.hasWriteAccess) {
                mainContentsResult = [<Message type={'info'} key="message">For your contribution, a personal fork of the <a href={GitHub.getRepositoryURL(repository)} target="_blank">library repository</a> will be created on GitHub.<br/>All contributed material is assumed to be in the public domain.</Message>, mainContentsResult];
              } else if (repository.hasLocalChanges && !repository.hasPullRequest) {
                mainContentsResult = [<Message type={'info'} key="message">Your <a href={GitHub.getRepositoryURL(repository)} target="_blank">forked library repository</a> has local changes. No pull request will be created after editing.</Message>, mainContentsResult];
              }
            }
          }
          return mainContentsResult;
        } else {
          return null;
        }
      });
      mainContents = renderPromise(mainContentsPromise);

      if (!config.embedded) {
        if (this.state.extraContentsVisible) {
          const extraContentsPromise = this.state.selectedItemDefinition.then((definition: LibraryDefinition | undefined) => {
            if (definition) {
              return <SourceCodeView libraryDataProvider={this.state.selectedItemProvider} definition={definition} templates={this.state.templates} options={App.renderedDefinitionOptions} interactionHandler={this.state.interactionHandler} mruList={this.mruList} key="source"/>;
            } else {
              return null;
            }
          });
          extraContents = renderPromise(extraContentsPromise, 'source');
        } else {
          extraContents = <div key="source"/>;
        }
      }
    } else if (!config.embedded) {
      if (this.state.showStartPage) {
        mainContents = <StartPage isLoggedIn={this.state.gitHubUserInfo !== undefined} libraryDataProvider={this.libraryDataProvider} templates={this.state.templates} onStartTutorial={this.startTutorial} onLinkClicked={this.linkClicked} onDocLinkClicked={this.docLinkClicked} key="start-page"/>;
      } else {
        mainContents = <Button className={'standalone'} onClick={() => this.setState({showStartPage: true})} key="start-page-placeholder">Show start page</Button>;
      }

      const repository = this.state.selectedItemRepository;
      if (repository) {
        if (repository.hasPullRequest) {
          mainContents = [<Message type={'info'} key="message">Your pull request has not been accepted yet. Therefore you may be seeing a slightly outdated version of the library. If necessary, you can manually merge upstream changes into your <a href={GitHub.getRepositoryURL(repository)} target="_blank">personal fork</a> on GitHub.</Message>, mainContents];
        } else if (repository.hasLocalChanges) {
          mainContents = [<Message type={'info'} key="message">Your <a href={GitHub.getRepositoryURL(repository)} target="_blank">forked library repository</a> has local changes but no pull request. It will not be updated automatically, and no pull request will be created after making further changes. To fix this, manually create a pull request or revert your local changes on GitHub.</Message>, mainContents];
        }
      }
    }

    let contentsPane = (
      <div className={'bottom-toolbar-container'} key="main-contents-with-toolbar">
        <div className={'app-pane'}>
          <ScrollPane object={this.state.selectedItemDefinition}>
            <div className={'app-contents'} key="main-contents">
              {mainContents}
            </div>
          </ScrollPane>
        </div>
        <div className={'bottom-toolbar'} key="toolbar">
          {this.getLeftButtons()}
          {this.getRightButtons(extraContents !== null)}
        </div>
      </div>
    );
    if (extraContents && this.state.extraContentsVisible) {
      contentsPane = (
        <SplitPane split={'horizontal'} defaultSize={defaultItemHeight} key="contents">
          {contentsPane}
          <div className={'app-pane'}>
            <ScrollPane object={this.state.selectedItemDefinition}>
              <div className={'app-contents'} key="extra-contents">
                {extraContents}
              </div>
            </ScrollPane>
          </div>
        </SplitPane>
      );
    }

    let openDialog: React.ReactNode = null;
    if (this.state.insertDialog) {
      openDialog = (
        <InsertDialog dialog={this.state.insertDialog} onOK={this.finishInsert} onCancel={this.cancelInsert} key="insert-dialog"/>
      );
    }

    let result: React.ReactNode;
    if (navigationPane) {
      result = (
        <div className={'app'}>
          <SplitPane split={this.state.verticalLayout ? 'horizontal' : 'vertical'} minSize={windowSize / 5} maxSize={windowSize * 4 / 5} defaultSize={windowSize / 3} key="main">
            {navigationPane}
            {contentsPane}
          </SplitPane>
          {openDialog}
        </div>
      );
    } else {
      result = (
        <div className={'app'}>
          {contentsPane}
          {openDialog}
        </div>
      );
    }

    const tutorialState = this.state.tutorialState;
    if (tutorialState) {
      const currentEditedDefinition = this.state.selectedItemDefinition?.getImmediateResult();
      result = addTutorial(this, result, tutorialState, currentEditedDefinition);
    }

    return result;
  }

  private getLeftButtons(): React.ReactNode {
    const leftButtons: React.ReactNode[] = [];

    if (config.embedded) {
      leftButtons.push(
        <Button toolTipText={'Table of Contents'} selected={this.state.navigationPaneVisible} onClick={() => this.setState((prevState) => ({navigationPaneVisible: !prevState.navigationPaneVisible}))} key="view-source">
          {getButtonIcon(ButtonType.TableOfContents)}
        </Button>
      );
    }
    if (this.state.gitHubUserInfo) {
      const loginInfoPromise = this.state.gitHubUserInfo.then((userInfo: GitHub.UserInfo) => {
        const userID: React.ReactNode[] = [];
        if (userInfo.avatarUrl) {
          userID.push(<img src={userInfo.avatarUrl} key="avatar"/>);
        }
        if (userInfo.login) {
          if (userID.length) {
            userID.push(' ');
          }
          userID.push(userInfo.login);
        }
        const userMenu: React.ReactNode[] = [
          (
            <Button toolTipText={'Log out (Warning: Does not sign out of GitHub.)'} isMenuItem={true} onClick={this.logOutOfGitHub} key="logout">
              {getButtonIcon(ButtonType.LogOut)}
            </Button>
          )
        ];
        return (
          <MenuButton menu={userMenu} menuOnTop={true} openOnHover={true} key="user-menu">
            {userID}
          </MenuButton>
        );
      });
      leftButtons.push(renderPromise(loginInfoPromise, 'user-info'));
    } else if (this.state.gitHubAuthInfo) {
      leftButtons.push(
        <Button toolTipText={'Log in with GitHub'} onClick={this.logInWithGitHub} key="login">
          {getButtonIcon(ButtonType.LogIn)}
        </Button>
      );
    }

    return (
      <div className={'left'} key="left-buttons">
        {leftButtons}
      </div>
    );
  }

  private getRightButtons(hasExtraContents: boolean): React.ReactNode {
    let rightButtonsPromise: CachedPromise<React.ReactNode[]>;

    if (this.state.selectedDocURI) {
      const rightButtons: React.ReactNode[] = [];
      if (!config.embedded) {
        if (config.runningLocally) {
          rightButtons.push(
            <Button toolTipText={'Open in Visual Studio Code'} onClick={this.openDocPageLocally} key="open-locally">
              {getButtonIcon(ButtonType.OpenInVSCode)}
            </Button>
          );
        } else {
          rightButtons.push(
            <Button toolTipText={'View on GitHub'} onClick={this.openDocPageRemotely} key="view-on-github">
              {getButtonIcon(ButtonType.ViewOnGitHub)}
            </Button>
          );
        }
      }
      rightButtonsPromise = CachedPromise.resolve(rightButtons);
    } else if (this.state.selectedItemDefinition) {
      rightButtonsPromise = this.state.selectedItemDefinition.then((definition: LibraryDefinition | undefined) => {
        const rightButtons: React.ReactNode[] = [];
        if (definition) {
          if (definition.state === LibraryDefinitionState.Submitting) {
            rightButtons.push(<div className={'submitting'} key="submitting"><Loading width={'1em'} height={'1em'}/></div>);
            rightButtons.push(' ');
          } else if ((definition.state === LibraryDefinitionState.Editing || definition.state === LibraryDefinitionState.EditingNew)) {
            let willSubmit: boolean | undefined;
            const repository = this.state.selectedItemRepository;
            if (repository) {
              willSubmit = (repository.parentOwner && repository.pullRequestAllowed) || !repository.hasWriteAccess;
            } else {
              willSubmit = !config.runningLocally;
            }
            rightButtons.push(
              <Button toolTipText={willSubmit ? 'Submit' : 'Save'} onClick={this.submit} key="submit">
                {getButtonIcon(willSubmit ? ButtonType.Submit : ButtonType.Save)}
              </Button>,
              <Button toolTipText={'Cancel'} onClick={this.cancelEditing} key="cancel">
                {getButtonIcon(ButtonType.Cancel)}
              </Button>
            );
            rightButtons.push(' ');
          } else {
            rightButtons.push(
              <Button toolTipText={'Edit'} onClick={this.edit} key="edit">
                {getButtonIcon(ButtonType.Edit)}
              </Button>
            );
          }
          if (!config.embedded) {
            if (config.runningLocally) {
              rightButtons.push(
                <Button toolTipText={'Open in Visual Studio Code'} onClick={this.openLocally} key="open-locally">
                  {getButtonIcon(ButtonType.OpenInVSCode)}
                </Button>
              );
            }
            if (this.state.selectedItemProvider?.options.fileAccessor instanceof GitHubFileAccessor) {
              rightButtons.push(
                <Button toolTipText={'View on GitHub'} onClick={this.openRemotely} key="view-on-github">
                  {getButtonIcon(ButtonType.ViewOnGitHub)}
                </Button>
              );
            }
          }
          if (hasExtraContents) {
            rightButtons.push(
              <Button toolTipText={'View Source'} selected={this.state.extraContentsVisible} onClick={() => this.setState((prevState) => ({extraContentsVisible: !prevState.extraContentsVisible}))} key="view-source">
                {getButtonIcon(ButtonType.ViewSource)}
              </Button>
            );
          }
        }
        return rightButtons;
      });
    } else {
      rightButtonsPromise = CachedPromise.resolve([]);
    }

    return renderPromise(rightButtonsPromise.then((rightButtons: React.ReactNode[]) => (
      <div className={'right'} key="right-buttons">
        {rightButtons}
      </div>
    )));
  }

  static getDerivedStateFromError(error: any) {
    return {
      error: error.message
    };
  }

  private navigateToURI(uri: string): boolean {
    const state: SelectionState = {};
    if (this.updateSelectionState(state, uri)) {
      this.navigate(state, false);
      return true;
    } else {
      return false;
    }
  }

  private navigateToRoot(showStartPage: boolean): void {
    this.setState({showStartPage: showStartPage});
    this.navigate({
      selectedDocURI: undefined,
      selectedItemAbsolutePath: undefined,
      selectedItemProvider: undefined,
      selectedItemLocalPath: undefined,
      selectedItemDefinition: undefined,
      selectedItemInfo: undefined,
      interactionHandler: undefined
    });
  }

  private treeItemClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path, definitionPromise: CachedPromise<LibraryDefinition>, itemInfo?: LibraryItemInfo): void => {
    const definition = definitionPromise.getImmediateResult();
    if (!definition || definition.state === LibraryDefinitionState.Preloaded) {
      definitionPromise = libraryDataProvider.fetchLocalItem(path.name, true);
    }
    this.navigate({
      selectedDocURI: undefined,
      selectedItemAbsolutePath: libraryDataProvider.getAbsolutePath(path),
      selectedItemProvider: libraryDataProvider,
      selectedItemLocalPath: path,
      selectedItemDefinition: definitionPromise,
      selectedItemInfo: itemInfo ? CachedPromise.resolve(itemInfo) : undefined
    });
  };

  private linkClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path): void => {
    const state: SelectionState = {};
    this.fillSelectionState(state, libraryDataProvider, path);
    this.navigate(state);
  };

  private docLinkClicked = (uri: string): void => {
    this.navigate({
      selectedDocURI: uri,
      selectedItemAbsolutePath: undefined,
      selectedItemProvider: undefined,
      selectedItemLocalPath: undefined,
      selectedItemDefinition: undefined,
      selectedItemInfo: undefined,
      interactionHandler: undefined
    });
  };

  private navigate(state: SelectionState, notify: boolean = true): void {
    this.setNewInteractionHandler(state);
    this.setState(state);
    let uri = '/';
    if (state.selectedDocURI) {
      uri = state.selectedDocURI;
    } else {
      if (state.selectedItemAbsolutePath) {
        if (state.selectedItemDefinition?.getImmediateResult()?.state !== LibraryDefinitionState.EditingNew) {
          this.mruList.add(state.selectedItemAbsolutePath);
        }
        uri = this.libraryDataProvider.pathToURI(state.selectedItemAbsolutePath);
      }
    }
    const title = this.getTitle(state);
    if (notify) {
      if (config.embedded) {
        const libraryDataProvider = state.selectedItemProvider;
        const path = state.selectedItemLocalPath;
        if (libraryDataProvider && path) {
          libraryDataProvider.viewLocalItem(path.name, true)
            .catch(() => {});
        }
      } else {
        this.setDocumentURI(uri, title);
      }
    }
    this.setDocumentTitle(state, title);
  }

  private getTitle(state: SelectionState): string {
    let title = appName;
    if (state.selectedItemAbsolutePath) {
      title = `${appName}: ${state.selectedItemAbsolutePath.name}`;
    }
    return title;
  }

  private setDocumentTitle(state: SelectionState, title: string): void {
    this.setDocumentTitleInternal(title);
    if (state.selectedItemInfo) {
      state.selectedItemInfo.then((info: LibraryItemInfo) => {
        if (info.title) {
          this.setDocumentTitleInternal(`${appName}: ${info.title}`);
        }
      });
    }
  }

  private setDocumentTitleInternal(title: string): void {
    document.title = title;
    if (config.vsCodeAPI) {
      const message: Embedding.RequestMessage = {
        command: 'TITLE',
        text: title
      };
      config.vsCodeAPI.postMessage(message);
    }
  }

  private setDocumentURI(uri: string, title: string): void {
    try {
      window.history?.pushState?.(null, title, uri);
    } catch {}
  }

  private insert = (libraryDataProvider: LibraryDataProvider, section: LibraryDefinition, sectionItemNumber: LibraryItemNumber, definitionType: Logic.LogicDefinitionTypeDescription | undefined): void => {
    const dialog = new Dialog.InsertDialog(libraryDataProvider, definitionType, this.checkNameInUse, this.state.templates);
    dialog.section = section;
    dialog.sectionItemNumber = sectionItemNumber;
    this.setState({
      insertDialog: dialog
    });
  };

  private finishInsert = (result: Dialog.InsertDialogResult): CachedPromise<LibraryDefinition | undefined> => {
    const dialog = this.state.insertDialog;
    if (dialog && dialog.libraryDataProvider) {
      const libraryDataProvider = dialog.libraryDataProvider;
      const definitionType = dialog.definitionType;
      if (definitionType) {
        return libraryDataProvider.insertLocalItem(result.name, definitionType, result.title, undefined, result.position)
          .then((libraryDefinition: LibraryDefinition) => {
            const localPath = new Fmt.Path(result.name);
            const absolutePath = libraryDataProvider.getAbsolutePath(localPath);
            const itemInfoPromise = libraryDataProvider.getLocalItemInfo(result.name);
            this.navigate({
              selectedDocURI: undefined,
              selectedItemAbsolutePath: absolutePath,
              selectedItemProvider: libraryDataProvider,
              selectedItemLocalPath: localPath,
              selectedItemDefinition: CachedPromise.resolve(libraryDefinition),
              selectedItemInfo: itemInfoPromise
            });
            if (config.embedded) {
              this.setState({navigationPaneVisible: false});
            }
            return itemInfoPromise.then((itemInfo: LibraryItemInfo) => {
              const editedDefinition: LibraryItemListEntry = {
                libraryDataProvider: libraryDataProvider,
                libraryDefinition: libraryDefinition,
                absolutePath: absolutePath,
                localPath: localPath,
                itemInfo: itemInfo
              };
              this.setState((prevState) => ({
                editedDefinitions: prevState.editedDefinitions.concat(editedDefinition)
              }));
              this.cancelInsert();
              return libraryDefinition;
            });
          })
          .catch((error) => {
            this.props.alert.error(`Error adding ${definitionType.name.toLowerCase()}: ` + error.message);
            this.forceUpdate();
            return undefined;
          });
      } else {
        return libraryDataProvider.insertLocalSubsection(result.name, result.title || '', result.position)
          .then((libraryDefinition: LibraryDefinition) => {
            this.cancelInsert();
            return libraryDefinition;
          })
          .catch((error) => {
            this.props.alert.error('Error adding section: ' + error.message);
            this.forceUpdate();
            return undefined;
          });
      }
    } else {
      return CachedPromise.resolve(undefined);
    }
  };

  private cancelInsert = (): void => {
    this.setState({
      insertDialog: undefined
    });
  };

  private checkNameInUse = (name: string): boolean => {
    const dialog = this.state.insertDialog;
    if (dialog && dialog.section) {
      const nameLower = name.toLowerCase();
      const sectionContents = dialog.section.definition.contents as FmtLibrary.ObjectContents_Section;
      for (const item of sectionContents.items) {
        if ((item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection)
            && item.ref instanceof Fmt.DefinitionRefExpression
            && nameLower === item.ref.path.name.toLowerCase()) {
          return true;
        }
      }
    }
    return false;
  };

  private edit = (): void => {
    const libraryDataProvider = this.state.selectedItemProvider;
    const definitionPromise = this.state.selectedItemDefinition;
    const absolutePath = this.state.selectedItemAbsolutePath;
    const localPath = this.state.selectedItemLocalPath;
    const itemInfoPromise = this.state.selectedItemInfo;
    if (libraryDataProvider && definitionPromise && absolutePath && localPath && itemInfoPromise) {
      definitionPromise.then((definition: LibraryDefinition | undefined) => {
        itemInfoPromise!.then((itemInfo: LibraryItemInfo) => {
          const clonedDefinition = libraryDataProvider!.editLocalItem(definition!, itemInfo);
          const clonedDefinitionPromise = CachedPromise.resolve(clonedDefinition);
          const editedDefinition: LibraryItemListEntry = {
            libraryDataProvider: libraryDataProvider!,
            libraryDefinition: clonedDefinition,
            absolutePath: absolutePath!,
            localPath: localPath!,
            itemInfo: itemInfo
          };
          this.setState((prevState) => ({
            selectedItemDefinition: clonedDefinitionPromise,
            interactionHandler: this.createInteractionHandler(libraryDataProvider!, this.state.templates, clonedDefinitionPromise),
            editedDefinitions: prevState.editedDefinitions.concat(editedDefinition)
          }));
        });
      });
    }
  };

  private submit = (): void => {
    const libraryDataProvider = this.state.selectedItemProvider;
    const definitionPromise = this.state.selectedItemDefinition;
    const absolutePath = this.state.selectedItemAbsolutePath;
    if (libraryDataProvider && definitionPromise) {
      const definition = definitionPromise.getImmediateResult();
      if (definition) {
        if (!this.state.tutorialState && !libraryDataProvider.checkDefaultReferences(definition)) {
          this.props.alert.error('References must be adapted before submitting.');
          return;
        }
        if (this.state.tutorialState) {
          const notify = !config.runningLocally && !this.state.gitHubUserInfo;
          libraryDataProvider.submitLocalTutorialItem(definition, notify);
          this.submitted(definition, absolutePath);
        } else {
          libraryDataProvider.submitLocalItem(definition)
            .then((writeFileResult: WriteFileResult) => {
              this.submitted(definition!, absolutePath);
              if (writeFileResult instanceof GitHubWriteFileResult) {
                if (writeFileResult.pullRequestState !== undefined) {
                  const action = writeFileResult.pullRequestState === GitHub.PullRequestState.Updated ? 'updated' : 'created';
                  this.props.alert.info(`GitHub pull request ${action} successfully.`);
                }
              } else if (writeFileResult instanceof WebWriteFileResult) {
                if (!writeFileResult.writtenDirectly && !this.state.tutorialState) {
                  this.props.alert.info('Changes successfully submitted for review. You can continue to work with the changed version as long as the application remains open.');
                }
              }
            })
            .catch((error) => {
              this.props.alert.error('Error submitting changes: ' + error.message);
              this.forceUpdate();
            });
        }
        this.forceUpdate();
      }
    }
  };

  private submitted(definition: LibraryDefinition, absolutePath: Fmt.Path | undefined): void {
    this.removeEditedDefinition(definition);
    if (absolutePath) {
      this.mruList.add(absolutePath);
    }
  }

  private cancelEditing = (): void => {
    const libraryDataProvider = this.state.selectedItemProvider;
    const definitionPromise = this.state.selectedItemDefinition;
    if (libraryDataProvider && definitionPromise) {
      const definition = definitionPromise.getImmediateResult();
      if (definition) {
        libraryDataProvider.cancelEditing(definition);
        this.removeEditedDefinition(definition);
        if (definition.state === LibraryDefinitionState.EditingNew) {
          this.navigateToRoot(false);
        } else {
          const oldDefinition = libraryDataProvider.fetchLocalItem(definition!.definition.name, true);
          this.setState({selectedItemDefinition: oldDefinition});
        }
      }
    }
  };

  private removeEditedDefinition(definition: LibraryDefinition): void {
    this.setState((prevState) => {
      let editedDefinitions = prevState.editedDefinitions;
      const index = editedDefinitions.findIndex((entry: LibraryItemListEntry) => (entry.libraryDefinition === definition));
      if (index >= 0) {
        editedDefinitions = editedDefinitions.slice(0, index).concat(editedDefinitions.slice(index + 1));
      }
      return {editedDefinitions: editedDefinitions};
    });
  }

  private openLocally = (): void => {
    this.viewFile(true);
  };

  private openRemotely = (): void => {
    this.viewFile(false);
  };

  private viewFile(openLocally: boolean): void {
    const libraryDataProvider = this.state.selectedItemProvider;
    const path = this.state.selectedItemLocalPath;
    if (libraryDataProvider && path) {
      libraryDataProvider.viewLocalItem(path.name, openLocally)
        .catch((error) => {
          this.props.alert.error('Error opening file: ' + error.message);
        });
    }
  }

  private openDocPageLocally = (): void  => {
    if (this.state.selectedDocURI) {
      const uri = this.state.selectedDocURI + markdownSuffix;
      this.fileAccessor.openFile(uri, false)
        .view!(true)
        .catch((error) => {
          this.props.alert.error('Error opening file: ' + error.message);
        });
    }
  };

  private openDocPageRemotely = (): void  => {
    if (this.state.selectedDocURI) {
      const uri = this.state.selectedDocURI + markdownSuffix;
      window.open(sourceCodeURLPrefix + uri, '_blank');
    }
  };

  private logInWithGitHub = (): void => {
    if (this.state.gitHubAuthInfo) {
      window.location.href = GitHub.getLoginURL(this.state.gitHubAuthInfo, window.location);
    }
  };

  private logOutOfGitHub = (): void => {
    this.discardGitHubLogin();
    window.location.reload();
  };

  private startTutorial = (withTouchWarning: boolean, runAutomatically: boolean = false): void => {
    const onChangeTutorialState = (stateTransitionFn: TutorialStateTransitionFn): void => {
      const oldTutorialState = this.state.tutorialState;
      const newTutorialState = stateTransitionFn(oldTutorialState);
      if (newTutorialState !== oldTutorialState) {
        this.setState({tutorialState: newTutorialState});
        if (!newTutorialState) {
          this.navigateToRoot(true);
          this.props.tutorialTest?.onSucceeded();
        } else if (newTutorialState.testFailure) {
          this.props.tutorialTest?.onFailed(newTutorialState.testFailure);
        }
      }
    };
    const onReplaceDefinitionContents = (definition: Fmt.Definition) => {
      const editedDefinition = this.state.tutorialState?.editedDefinition;
      if (editedDefinition) {
        editedDefinition.definition.contents = undefined;
        const replacedParameters: Fmt.ReplacedParameter[] = [];
        editedDefinition.definition.parameters = definition.parameters.clone(replacedParameters);
        editedDefinition.definition.contents = definition.contents?.clone(replacedParameters);
        this.state.interactionHandler?.expressionChanged();
      }
      this.forceUpdate();
    };
    startTutorial(onChangeTutorialState, onReplaceDefinitionContents, this.docLinkClicked, withTouchWarning, runAutomatically);
  };

  private endTutorial = (): void => {
    this.setState({tutorialState: undefined});
  };
}

const AppWithAlert = Alert.withAlert()(App);

function WrappedApp(props: AppProps): React.ReactElement {
  return (
    <Alert.Provider template={getAlertTemplate} position="top right" offset="20pt">
      <AppWithAlert {...props}/>
    </Alert.Provider>
  );
}

export default WrappedApp;
