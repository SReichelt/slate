import * as React from 'react';
import './App.css';
import SplitPane from 'react-split-pane';
import { withAlert, InjectedAlertProp } from 'react-alert';
import StartPage from './components/StartPage';
import LibraryTree from './components/LibraryTree';
import LibraryItem from './components/LibraryItem';
import SourceCodeView from './components/SourceCodeView';
import Button from './components/Button';
import MenuButton from './components/MenuButton';
import { LibraryItemInteractionHandler } from './components/InteractionHandler';
import renderPromise from './components/PromiseHelper';
import CachedPromise from '../shared/data/cachedPromise';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtLibrary from '../shared/logics/library';
import * as FmtDisplay from '../shared/display/meta';
import { ButtonType, getButtonIcon } from './utils/icons';
import { FileAccessor, FileContents, WriteFileResult } from '../shared/data/fileAccessor';
import { WebFileAccessor, WebWriteFileResult } from './data/webFileAccessor';
import { GitHubFileAccessor, GitHubConfig, GitHubWriteFileResult } from './data/gitHubFileAccessor';
import * as GitHub from './data/gitHubAPIHandler';
import { LibraryDataProvider, LibraryItemInfo } from '../shared/data/libraryDataProvider';
import * as Logic from '../shared/logics/logic';
import * as Logics from '../shared/logics/logics';
import Message from './components/Message';

const Loading = require('react-loading-animation');

const Libraries = require('../../data/libraries/libraries.json');

const librariesURIPrefix = '/libraries/';

interface AppProps {
  alert: InjectedAlertProp;
}

interface SelectionState {
  selectedItemRepository?: GitHub.Repository;
  selectedItemPath?: Fmt.Path;
  selectedItemProvider?: LibraryDataProvider;
  selectedItemDefinition?: CachedPromise<Fmt.Definition>;
  selectedItemInfo?: CachedPromise<LibraryItemInfo>;
  interactionHandler?: LibraryItemInteractionHandler;
  editedDefinition?: Fmt.Definition;
  submitting: boolean;
}

interface GitHubState {
  gitHubClientID?: string;
  gitHubUserInfo?: CachedPromise<GitHub.UserInfo>;
}

interface AppState extends SelectionState, GitHubState {
  verticalLayout: boolean;
  error?: string;
  templates?: Fmt.File;
  rootInteractionHandler?: LibraryItemInteractionHandler;
  extraContentsVisible: boolean;
}

class App extends React.Component<AppProps, AppState> {
  private runningLocally: boolean;
  private gitHubConfig?: GitHubConfig;
  private fileAccessor: FileAccessor;
  private logic: Logic.Logic;
  private libraryDataProvider: LibraryDataProvider;
  private treePaneNode: HTMLElement | null = null;
  private mainContentsPaneNode: HTMLElement | null = null;
  private extraContentsPaneNode: HTMLElement | null = null;

  constructor(props: AppProps) {
    super(props);

    this.runningLocally = (process.env.NODE_ENV === 'development');

    let state: AppState = {
      verticalLayout: window.innerHeight > window.innerWidth,
      submitting: false,
      extraContentsVisible: false,
    };

    let gitHubAPIAccess: CachedPromise<GitHub.APIAccess> | undefined = undefined;
    let gitHubAccessToken = window.localStorage.getItem('GitHubAccessToken');
    if (gitHubAccessToken) {
      gitHubAPIAccess = CachedPromise.resolve(new GitHub.APIAccess(gitHubAccessToken));
    }

    let selectionURI = window.location.pathname;

    let queryString = window.location.search;
    if (queryString && !gitHubAPIAccess) {
      let gitHubQueryStringResult = GitHub.parseQueryString(queryString);
      if (gitHubQueryStringResult.path) {
        selectionURI = gitHubQueryStringResult.path;
      }
      if (gitHubQueryStringResult.token) {
        let apiAccessPromise = gitHubQueryStringResult.token.then((accessToken) => {
          window.localStorage.setItem('GitHubAccessToken', accessToken);
          return new GitHub.APIAccess(accessToken);
        });
        gitHubAPIAccess = new CachedPromise<GitHub.APIAccess>(apiAccessPromise);
      }
    }

    let selectedLibraryName = 'hlm';

    if (this.runningLocally && !gitHubAPIAccess) {
      this.fileAccessor = new WebFileAccessor;
    } else {
      this.gitHubConfig = {
        targets: []
      };
      let repositories: GitHub.Repository[] = [];
      for (let libraryName of Object.keys(Libraries)) {
        let repository = Libraries[libraryName];
        this.gitHubConfig.targets.push({
          uriPrefix: librariesURIPrefix + libraryName,
          repository: repository
        });
        repositories.push(repository);
        if (libraryName === selectedLibraryName) {
          state.selectedItemRepository = repository;
        }
      }
      let gitHubConfigPromise: CachedPromise<GitHubConfig>;
      if (gitHubAPIAccess) {
        state.gitHubUserInfo = gitHubAPIAccess.then((apiAccess) => {
          this.gitHubConfig!.apiAccess = apiAccess;
          return apiAccess.getUserInfo(repositories);
        });
        gitHubConfigPromise = state.gitHubUserInfo
          .then(() => {
            let result: CachedPromise<void> = CachedPromise.resolve();
            if (this.gitHubConfig && this.gitHubConfig.apiAccess) {
              let apiAccess = this.gitHubConfig.apiAccess;
              for (let target of this.gitHubConfig.targets) {
                let repository = target.repository;
                if (repository.parentOwner && !repository.hasPullRequest) {
                  result = result
                    .then(() => apiAccess.fastForward(repository, false))
                    .then(() => void (repository.pullRequestAllowed = true))
                    .catch(() => void (repository.hasLocalChanges = true));
                }
              }
            }
            return result;
          })
          .catch(() => {})
          .then(() => this.gitHubConfig!);
      } else {
        gitHubConfigPromise = CachedPromise.resolve(this.gitHubConfig);
      }
      this.fileAccessor = new GitHubFileAccessor(gitHubConfigPromise);
    }

    this.logic = Logics.hlm;
    let selectedLibraryURI = librariesURIPrefix + selectedLibraryName;
    this.libraryDataProvider = new LibraryDataProvider(this.logic, this.fileAccessor, selectedLibraryURI, undefined, 'Library');

    this.updateSelectionState(state, selectionURI);
    this.state = state;
    let title = this.updateTitle(state);

    if (queryString) {
      window.history.pushState(null, title, selectionURI);
    }
  }

  private updateSelectionState(state: SelectionState, uri: string): boolean {
    let path = this.libraryDataProvider.uriToPath(uri);
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
    if (this.state && this.state.templates) {
      state.interactionHandler = new LibraryItemInteractionHandler(state.selectedItemProvider, this.state.templates, state.selectedItemDefinition, this.linkClicked);
    }
  }

  componentDidMount(): void {
    window.onpopstate = () => {
      // Explicitly set members to undefined; otherwise the back button cannot be used to return to an empty selection.
      let state: SelectionState = {
        selectedItemPath: undefined,
        selectedItemProvider: undefined,
        selectedItemDefinition: undefined,
        selectedItemInfo: undefined,
        interactionHandler: undefined,
        submitting: false
      };
      this.updateSelectionState(state, window.location.pathname);
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

    GitHub.getClientID()
      .then((clientID) => this.setState({gitHubClientID: clientID}))
      .catch(() => {});

    if (this.state.gitHubUserInfo) {
      this.state.gitHubUserInfo.catch((error) => {
        this.discardGitHubLogin();
        this.props.alert.error('GitHub login failed: ' + error.message);
      });
    }

    let templateUri = '/display/templates.slate';
    this.fileAccessor.readFile(templateUri)
      .then((contents: FileContents) => {
        let templates = FmtReader.readString(contents.text, templateUri, FmtDisplay.getMetaModel);
        contents.close();
        this.setState({
          templates: templates,
          rootInteractionHandler: new LibraryItemInteractionHandler(this.libraryDataProvider, templates, this.state.selectedItemDefinition, this.linkClicked)
        });
        if (this.state.selectedItemProvider && this.state.selectedItemDefinition) {
          this.setState({interactionHandler: new LibraryItemInteractionHandler(this.state.selectedItemProvider, templates, this.state.selectedItemDefinition, this.linkClicked)});
        }
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

  private discardGitHubLogin(): void {
    if (this.gitHubConfig) {
      this.gitHubConfig.apiAccess = undefined;
    }
    this.setState({gitHubUserInfo: undefined});
    window.localStorage.removeItem('GitHubAccessToken');
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return <div className={'error'}>Error: {this.state.error}</div>;
    }

    let mainContents: React.ReactNode = undefined;
    let extraContents: React.ReactNode = undefined;
    if (this.state.selectedItemDefinition) {
      if (this.state.templates && this.state.selectedItemProvider) {
        let definition = this.state.editedDefinition ? CachedPromise.resolve(this.state.editedDefinition) : this.state.selectedItemDefinition;
        mainContents = <LibraryItem libraryDataProvider={this.state.selectedItemProvider} definition={definition} templates={this.state.templates} itemInfo={this.state.selectedItemInfo} includeLabel={true} includeExtras={true} includeProofs={true} includeRemarks={true} editing={this.state.editedDefinition !== undefined} interactionHandler={this.state.interactionHandler} key={'LibraryItem'}/>;
        extraContents = <SourceCodeView definition={definition} interactionHandler={this.state.interactionHandler} key={'SourceCode'}/>;
        if (this.state.editedDefinition) {
          if (!this.state.gitHubUserInfo && !this.runningLocally) {
            mainContents = [<Message type={'info'} key={'Message'}>You are currently contributing anonymously. By logging in with a <a href={'https://github.com/'}>GitHub</a> account, your can submit your contribution as a pull request instead.<br/>All contributed material is assumed to be in the public domain.</Message>, mainContents];
          } else if (this.state.selectedItemRepository) {
            let repository = this.state.selectedItemRepository;
            if (!repository.hasWriteAccess) {
              mainContents = [<Message type={'info'} key={'Message'}>For your contribution, a personal fork of the <a href={GitHub.getRepositoryURL(repository)}>library repository</a> will be created on GitHub.<br/>All contributed material is assumed to be in the public domain.</Message>, mainContents];
            } else if (repository.hasLocalChanges && !repository.hasPullRequest) {
              mainContents = [<Message type={'info'} key={'Message'}>Your <a href={GitHub.getRepositoryURL(repository)}>forked library repository</a> has local changes. No pull request will be created after editing.</Message>, mainContents];
            }
          }
        }
      }
    } else {
      mainContents = <StartPage libraryDataProvider={this.libraryDataProvider} templates={this.state.templates} interactionHandler={this.state.rootInteractionHandler} onLinkClicked={this.linkClicked} key={'StartPage'}/>;
      if (this.state.selectedItemRepository) {
        let repository = this.state.selectedItemRepository;
        if (repository.hasPullRequest) {
          mainContents = [<Message type={'info'} key={'Message'}>Your pull request has not been integrated yet. Therefore you may be seeing a slightly outdated version of the library. If necessary, you can manually merge upstream changes into your <a href={GitHub.getRepositoryURL(repository)}>personal fork</a> on GitHub.</Message>, mainContents];
        } else if (repository.hasLocalChanges) {
          mainContents = [<Message type={'info'} key={'Message'}>Your <a href={GitHub.getRepositoryURL(repository)}>forked library repository</a> has local changes but no pull request. It will not be updated automatically, and no pull request will be created after making further changes. To fix this, manually create a pull request or revert your local changes on GitHub.</Message>, mainContents];
        }
      }
    }

    let windowSize = this.state.verticalLayout ? window.innerHeight : window.innerWidth;
    let defaultItemHeight = this.state.verticalLayout ? window.innerHeight / 3 : window.innerHeight / 2;

    let leftButtons: React.ReactNode[] = [];
    if (this.state.gitHubUserInfo) {
      let loginInfoPromise = this.state.gitHubUserInfo.then((userInfo: GitHub.UserInfo) => {
        let userID: React.ReactNode[] = [];
        if (userInfo.avatarUrl) {
          userID.push(<img src={userInfo.avatarUrl} key={'Avatar'}/>);
        }
        if (userInfo.login) {
          if (userID.length) {
            userID.push(' ');
          }
          userID.push(userInfo.login);
        }
        let userMenu: React.ReactNode[] = [
          (
            <Button toolTipText={'Log out (Warning: Does not sign out of GitHub.)'} onClick={this.logOutOfGitHub} key={'LogOut'}>
              {getButtonIcon(ButtonType.LogOut)}
            </Button>
          )
        ];
        return (
          <MenuButton menu={userMenu} key={'UserMenu'}>
            {userID}
          </MenuButton>
        );
      });
      leftButtons.push(renderPromise(loginInfoPromise, 'UserInfo'));
    } else if (this.state.gitHubClientID) {
      leftButtons.push(
        <Button toolTipText={'Log in with GitHub'} onClick={this.logInWithGitHub} key={'LogIn'}>
          {getButtonIcon(ButtonType.LogIn)}
        </Button>
      );
    }

    let rightButtons: React.ReactNode[] = [];
    if (this.state.selectedItemDefinition) {
      if (this.state.submitting) {
        rightButtons.push(<div className={'submitting'} key={'Submitting'}><Loading width={'1em'} height={'1em'}/></div>);
        rightButtons.push(' ');
      } else if (this.state.editedDefinition) {
        let willSubmit: boolean | undefined;
        let repository = this.state.selectedItemRepository;
        if (repository) {
          willSubmit = (repository.parentOwner && repository.pullRequestAllowed) || !repository.hasWriteAccess;
        } else {
          willSubmit = !this.runningLocally;
        }
        rightButtons.push(
          <Button toolTipText={willSubmit ? 'Submit' : 'Save'} onClick={this.submit} key={'Submit'}>
            {getButtonIcon(willSubmit ? ButtonType.Submit : ButtonType.Save)}
          </Button>
        );
        rightButtons.push(
          <Button toolTipText={'Cancel'} onClick={() => this.setState({editedDefinition: undefined})} key={'Cancel'}>
            {getButtonIcon(ButtonType.Cancel)}
          </Button>
        );
        rightButtons.push(' ');
      } else {
        rightButtons.push(
          <Button toolTipText={'Edit'} onClick={this.edit} key={'Edit'}>
            {getButtonIcon(ButtonType.Edit)}
          </Button>
        );
        if (this.runningLocally) {
          rightButtons.push(
            <Button toolTipText={'Open in Visual Studio Code'} onClick={this.openLocally} key={'OpenLocally'}>
              {getButtonIcon(ButtonType.OpenInVSCode)}
            </Button>
          );
        }
        if (this.fileAccessor instanceof GitHubFileAccessor) {
          rightButtons.push(
            <Button toolTipText={'View in GitHub'} onClick={this.openRemotely} key={'ViewInGitHub'}>
              {getButtonIcon(ButtonType.ViewInGitHub)}
            </Button>
          );
        }
      }
    }
    if (extraContents) {
      rightButtons.push(
        <Button toolTipText={'View Source'} selected={this.state.extraContentsVisible} onClick={() => this.setState((prevState) => ({extraContentsVisible: !prevState.extraContentsVisible}))} key={'ViewSource'}>
          {getButtonIcon(ButtonType.ViewSource)}
        </Button>
      );
    }

    let contentsPane = (
      <div className={'bottom-toolbar-container'}>
        <div className={'app-pane'} ref={(htmlNode) => (this.mainContentsPaneNode = htmlNode)}>
          <div className={'app-contents'}>
            {mainContents}
          </div>
        </div>
        <div className={'bottom-toolbar'}>
          <div className={'left'}>
            {leftButtons}
          </div>
          <div className={'right'}>
            {rightButtons}
          </div>
        </div>
      </div>
    );
    if (extraContents && this.state.extraContentsVisible) {
      contentsPane = (
        <SplitPane split={'horizontal'} defaultSize={defaultItemHeight}>
          {contentsPane}
          <div className={'app-pane'} ref={(htmlNode) => (this.extraContentsPaneNode = htmlNode)}>
            <div className={'app-contents'}>
              {extraContents}
            </div>
          </div>
        </SplitPane>
      );
    } else {
      this.extraContentsPaneNode = null;
    }

    return (
      <div className={'app'}>
        <SplitPane split={this.state.verticalLayout ? 'horizontal' : 'vertical'} minSize={windowSize / 5} maxSize={windowSize * 4 / 5} defaultSize={windowSize / 3}>
          <div className={'app-pane'} ref={(htmlNode) => (this.treePaneNode = htmlNode)}>
            <div className={'app-tree'}>
              <LibraryTree libraryDataProvider={this.libraryDataProvider} templates={this.state.templates} parentScrollPane={this.treePaneNode} selectedItemPath={this.state.selectedItemPath} onItemClicked={this.treeItemClicked}/>
            </div>
          </div>
          {contentsPane}
        </SplitPane>
      </div>
    );
  }

  private treeItemClicked = (item: FmtLibrary.MetaRefExpression_item, libraryDataProvider: LibraryDataProvider, path: Fmt.Path, definitionPromise: CachedPromise<Fmt.Definition>, itemInfo: LibraryItemInfo): void => {
    this.navigate({
      selectedItemPath: libraryDataProvider.getAbsolutePath(path),
      selectedItemProvider: libraryDataProvider,
      selectedItemDefinition: definitionPromise,
      selectedItemInfo: CachedPromise.resolve(itemInfo),
      interactionHandler: this.state.templates ? new LibraryItemInteractionHandler(libraryDataProvider, this.state.templates, definitionPromise, this.linkClicked) : undefined,
      editedDefinition: undefined,
      submitting: false
    });
  }

  private linkClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path): void => {
    let state: SelectionState = {
      editedDefinition: undefined,
      submitting: false
    };
    this.fillSelectionState(state, libraryDataProvider.getAbsolutePath(path));
    this.navigate(state);
  }

  private navigate(state: SelectionState): void {
    this.setState(state);
    let uri = '/';
    if (state.selectedItemPath) {
      uri = this.libraryDataProvider.pathToURI(state.selectedItemPath);
    }
    let title = this.updateTitle(state);
    window.history.pushState(null, title, uri);
    if (this.mainContentsPaneNode) {
      this.mainContentsPaneNode.scrollTo({left: 0, top: 0, behavior: 'auto'});
    }
    if (this.extraContentsPaneNode) {
      this.extraContentsPaneNode.scrollTo({left: 0, top: 0, behavior: 'auto'});
    }
  }

  private updateTitle(state: SelectionState): string {
    let appName = 'Slate';
    let title = appName;
    if (state.selectedItemPath) {
      title = `${appName}: ${state.selectedItemPath.name}`;
    }
    document.title = title;
    if (state.selectedItemInfo) {
      state.selectedItemInfo.then((info: LibraryItemInfo) => {
        if (info.title) {
          document.title = `${appName}: ${info.title}`;
        }
      });
    }
    return title;
  }

  private edit = (): void => {
    if (this.state.selectedItemDefinition) {
      this.state.selectedItemDefinition.then((definition: Fmt.Definition) => this.setState({
        editedDefinition: definition.clone()
      }));
    }
  }

  private submit = (): void => {
    let libraryDataProvider = this.state.selectedItemProvider;
    let path = this.state.selectedItemPath;
    if (this.state.editedDefinition && libraryDataProvider && path) {
      this.setState({
        selectedItemDefinition: CachedPromise.resolve(this.state.editedDefinition),
        editedDefinition: undefined,
        submitting: true
      });
      libraryDataProvider.submitLocalItem(path.name, this.state.editedDefinition)
        .then((writeFileResult: WriteFileResult) => {
          this.setState({submitting: false});
          if (writeFileResult instanceof GitHubWriteFileResult) {
            if (writeFileResult.pullRequestState !== undefined) {
              let action = writeFileResult.pullRequestState === GitHub.PullRequestState.Updated ? 'updated' : 'created';
              this.props.alert.info(`GitHub pull request ${action} successfully.`);
            }
          } else if (writeFileResult instanceof WebWriteFileResult) {
            if (!writeFileResult.writtenDirectly) {
              this.props.alert.info('Changes successfully submitted for review. You can continue to work with the changed version until the page is reloaded.');
            }
          }
        })
        .catch((error) => {
          this.setState({submitting: false});
          this.props.alert.error('Error submitting changes: ' + error.message);
        });
      this.forceUpdate();
    }
  }

  private openLocally = (): void => {
    this.openFile(true);
  }

  private openRemotely = (): void => {
    this.openFile(false);
  }

  private openFile(openLocally: boolean): void {
    let libraryDataProvider = this.state.selectedItemProvider;
    let path = this.state.selectedItemPath;
    if (libraryDataProvider && path) {
      libraryDataProvider.openLocalItem(path.name, openLocally)
        .catch((error) => {
          this.props.alert.error('Error opening file: ' + error.message);
        });
    }
  }

  private logInWithGitHub = (): void => {
    if (this.state.gitHubClientID) {
      let location = window.location;
      let protocol = location.protocol;
      let host = location.host;
      if (location.hostname !== 'localhost') {
        protocol = 'https:';
        host = location.hostname;
      }
      let baseURL = protocol + '//' + host + '/';
      location.href = GitHub.getLoginURL(this.state.gitHubClientID, baseURL, location.pathname);
    }
  }

  private logOutOfGitHub = (): void => {
    this.discardGitHubLogin();
    location.reload();
  }
}

export default withAlert(App);
