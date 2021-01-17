import * as queryString from 'query-string';
import * as utf8 from 'utf8';

import { fetchHelper } from '../utils/fetchHelper';

import { AuthInfo } from 'slate-env-web-api/auth';


export { AuthInfo };

export function getAuthInfo(): Promise<AuthInfo> {
  return fetchHelper.fetchJSON('github-auth/info');
}

export function getLoginURL(authInfo: AuthInfo, location: Location): string {
  let redirectURL = authInfo.redirectURL ?? (location.protocol + '//' + location.host + '/');
  if (location.pathname) {
    redirectURL += '?path=' + encodeURI(location.pathname);
  }
  return `https://github.com/login/oauth/authorize?client_id=${authInfo.clientID}&scope=public_repo&redirect_uri=${encodeURI(redirectURL)}`;
}

export interface Repository {
  owner: string;
  name: string;
  branch: string;
  parentOwner?: string;
  hasWriteAccess?: boolean;
  hasLocalChanges?: boolean;
  pullRequestAllowed?: boolean;
  hasPullRequest?: boolean;
}

export function getRepositoryURL(repository: Repository): string {
  return `https://github.com/${repository.owner}/${repository.name}/tree/${repository.branch}`;
}

export function getInfoURL(repository: Repository, path: string): string {
  return `https://github.com/${repository.owner}/${repository.name}/blob/${repository.branch}/${path}`;
}

export function getDownloadURL(repository: Repository, path: string): string {
  let owner = repository.owner;
  if (repository.parentOwner && !repository.hasLocalChanges) {
    // If the repository has just been fast-forwarded, serve content from the parent repository instead.
    // Since raw.githubusercontent.com does not update immediately, we might receive outdated files otherwise.
    owner = repository.parentOwner;
  }
  return `https://raw.githubusercontent.com/${owner}/${repository.name}/${repository.branch}/${path}`;
}

export interface QueryStringResult {
  path?: string;
  token?: Promise<string>;
}

export function parseQueryString(query: string): QueryStringResult {
  let result: QueryStringResult = {};
  if (query) {
    let parsedQuery = queryString.parse(query);
    let code = parsedQuery['code'];
    if (typeof code === 'string') {
      result.token = fetchHelper.fetchJSON(`github-auth/auth?code=${code}`)
        .then((response) => response['access_token']);
    }
    let path = parsedQuery['path'];
    if (typeof path === 'string') {
      result.path = path;
    }
  }
  return result;
}

export interface UserInfo {
  login?: string;
  avatarUrl?: string;
}

export enum PullRequestState {
  Created,
  Updated
}

function quote(s: string) {
  return `"${s.split('"').join('\\"')}"`;
}

export class APIAccess {
  constructor(private accessToken: string) {}

  private submitRequest(method: string, path: string, request: any = {}): Promise<Response> {
    let url = `https://api.github.com/${path}`;
    let options: RequestInit = {
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `token ${this.accessToken}`
      }
    };
    if (method === 'GET' || method === 'HEAD') {
      let delimiter = '?';
      for (let key of Object.keys(request)) {
        url += `${delimiter}${encodeURI(key)}=${encodeURI(request[key])}`;
        delimiter = '&';
      }
    } else {
      options.body = JSON.stringify(request);
    }
    return fetch(url, options);
  }

  private async runRequest(method: string, path: string, request: any = {}): Promise<any> {
    let response = await this.submitRequest(method, path, request);
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP error ${response.status} (${response.statusText})`);
    }
    return response.json();
  }

  private runGraphQLRequest(request: any): Promise<any> {
    return this.runRequest('POST', 'graphql', request);
  }

  async getUserInfo(repositories: Repository[]): Promise<UserInfo> {
    let viewerQuery = ' login avatarUrl ';
    repositories.forEach((repository, index) => {
      viewerQuery += `forkedRepo${index}: repository(name: ${quote(repository.name)}) { nameWithOwner parent { nameWithOwner } ref(qualifiedName: ${quote(`refs/heads/${repository.branch}`)}) { associatedPullRequests(states: OPEN) { totalCount } } } `;
    });
    let query = ` viewer {${viewerQuery}} `;
    repositories.forEach((repository, index) => {
      query += `upstreamRepo${index}: repository(owner: ${quote(repository.owner)}, name: ${quote(repository.name)}) { viewerPermission } `;
    });
    let request = {
      query: `query {${query}}`
    };
    let result = await this.runGraphQLRequest(request);
    let data = result.data;
    let viewer = data.viewer;
    repositories.forEach((repository, index) => {
      let forkedRepo = viewer[`forkedRepo${index}`];
      if (forkedRepo) {
        let upstreamNameWithOwner = `${repository.owner}/${repository.name}`;
        if (forkedRepo.nameWithOwner !== upstreamNameWithOwner) {
          if (!forkedRepo.parent || forkedRepo.parent.nameWithOwner !== upstreamNameWithOwner) {
            throw new Error(`Repository ${forkedRepo.nameWithOwner} was not forked from ${upstreamNameWithOwner}`);
          }
          repository.parentOwner = repository.owner;
          repository.owner = viewer.login;
          repository.hasWriteAccess = true;
          if (forkedRepo.ref && forkedRepo.ref.associatedPullRequests && forkedRepo.ref.associatedPullRequests.totalCount) {
            repository.hasLocalChanges = true;
            repository.pullRequestAllowed = true;
            repository.hasPullRequest = true;
          }
        }
      }
      let upstreamRepo = data[`upstreamRepo${index}`];
      if (upstreamRepo && (upstreamRepo.viewerPermission === 'WRITE' || upstreamRepo.viewerPermission === 'ADMIN')) {
        repository.hasWriteAccess = true;
      }
    });
    return viewer;
  }

  async fastForward(repository: Repository, force: boolean): Promise<void> {
    if (!repository.parentOwner) {
      throw new Error('Cannot synchronize a repository that is not a fork');
    }

    let forkPath = `repos/${repository.owner}/${repository.name}/git/refs/heads/${repository.branch}`;
    let getResult = await this.runRequest('GET', forkPath);

    let upstreamPath = `repos/${repository.parentOwner}/${repository.name}/git/refs/heads/${repository.branch}`;
    let getUpstreamResult = await this.runRequest('GET', upstreamPath);

    if (getResult.object.sha === getUpstreamResult.object.sha) {
      return;
    }

    let patchParameters = {
      sha: getUpstreamResult.object.sha,
      force: force
    };
    await this.runRequest('PATCH', forkPath, patchParameters);
  }

  async readFile(repository: Repository, path: string): Promise<string> {
    let apiPath = `repos/${repository.owner}/${repository.name}/contents/${path}`;
    let parameters = {
      ref: repository.branch
    };
    let result = await this.runRequest('GET', apiPath, parameters);
    return utf8.decode(atob(result.content));
  }

  async writeFile(repository: Repository, path: string, contents: string, createNew: boolean, isPartOfGroup: boolean): Promise<PullRequestState | undefined> {
    await this.ensureWriteAccess(repository);

    let apiPath = `repos/${repository.owner}/${repository.name}/contents/${path}`;
    let getParameters = {
      ref: repository.branch
    };
    let originalSHA = undefined;
    if (!createNew) {
      let getResult = await this.runRequest('GET', apiPath, getParameters);
      originalSHA = getResult.sha;
    }

    let putParameters = {
      message: 'Contribution via web app',
      content: btoa(utf8.encode(contents)),
      branch: repository.branch,
      sha: originalSHA
    };
    let putResult = await this.runRequest('PUT', apiPath, putParameters);

    repository.hasLocalChanges = true;

    if (originalSHA) {
      if (putResult.content.sha !== originalSHA) {
        let checkResult;
        do {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          checkResult = await this.runRequest('GET', apiPath, getParameters);
        } while (checkResult.sha === originalSHA);
      }
    } else {
      let checkResult = await this.runRequest('GET', apiPath, getParameters);
      while (checkResult.sha !== putResult.content.sha) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        checkResult = await this.runRequest('GET', apiPath, getParameters);
      }
    }

    if (isPartOfGroup) {
      return undefined;
    } else {
      return await this.createPullRequest(repository, putParameters.message);
    }
  }

  async ensureWriteAccess(repository: Repository): Promise<void> {
    if (!repository.hasWriteAccess) {
      let forkPath = `repos/${repository.owner}/${repository.name}/forks`;
      await this.runRequest('POST', forkPath);
      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await this.getUserInfo([repository]);
      } while (!repository.hasWriteAccess);
      repository.pullRequestAllowed = true;
    }
  }

  private async createPullRequest(repository: Repository, title: string): Promise<PullRequestState | undefined> {
    if (repository.parentOwner && repository.pullRequestAllowed) {
      let pullRequestPath = `repos/${repository.parentOwner}/${repository.name}/pulls`;
      let pullRequestParameters = {
        title: title,
        head: `${repository.owner}:${repository.branch}`,
        base: repository.branch,
        maintainer_can_modify: true
      };
      let pullRequestResponse = await this.submitRequest('POST', pullRequestPath, pullRequestParameters);
      if (!pullRequestResponse.ok && pullRequestResponse.status !== 422) {
        throw new Error(`Submission of pull request failed with HTTP error ${pullRequestResponse.status} (${pullRequestResponse.statusText})`);
      }
      repository.hasPullRequest = true;
      return pullRequestResponse.ok ? PullRequestState.Created : PullRequestState.Updated;
    }

    return undefined;
  }
}
