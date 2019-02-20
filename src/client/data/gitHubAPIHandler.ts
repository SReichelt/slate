import * as queryString from 'query-string';
import * as utf8 from 'utf8';
import { fetchText } from '../utils/fetch';

export function getClientID(): Promise<string> {
  return fetchText('/github-auth/client-id');
}

export function getLoginURL(clientID: string, baseURL: string, path: string): string {
  let redirectURL = baseURL;
  if (path && path !== '/') {
    redirectURL += '?path=' + encodeURI(path);
  }
  return `https://github.com/login/oauth/authorize?client_id=${clientID}&scope=public_repo&redirect_uri=${encodeURI(redirectURL)}`;
}

export interface Repository {
  owner: string;
  name: string;
  branch: string;
  isFork?: boolean;
}

export function getInfoURL(repository: Repository, path: string): string {
  return `https://github.com/${repository.owner}/${repository.name}/blob/${repository.branch}${path}`;
}

export function getDownloadURL(repository: Repository, path: string): string {
  return `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${repository.branch}${path}`;
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
      result.token = fetchText(`/github-auth/auth?code=${code}`);
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

export class APIAccess {
  constructor(private accessToken: string) {}

  private async runRequest(method: string, path: string, request: any): Promise<any> {
    let url = `https://api.github.com${path}?${this.accessToken}`;
    let options: RequestInit = {
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    };
    if (method === 'GET' || method === 'HEAD') {
      for (let key of Object.keys(request)) {
        url += `&${encodeURI(key)}=${encodeURI(request[key])}`;
      }
    } else {
      options.body = JSON.stringify(request);
    }
    let response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP error ${response.status} (${response.statusText})`);
    }
    return response.json();
  }

  private runGraphQLRequest(request: any): Promise<any> {
    return this.runRequest('POST', '/graphql', request);
  }

  async getUserInfo(repositories: Repository[]): Promise<UserInfo> {
    let repositoryQueries = '';
    repositories.forEach((repository, index) => {
      repositoryQueries += `repo${index}: repository(name: "${repository.name}") { nameWithOwner parent { nameWithOwner } } `;
    });
    let request = {
      query: `query { viewer { login avatarUrl ${repositoryQueries}} }`
    };
    let result = await this.runGraphQLRequest(request);
    let viewer = result.data.viewer;
    repositories.forEach((repository, index) => {
      let repo = viewer[`repo${index}`];
      if (repo) {
        let upstreamNameWithOwner = `${repository.owner}/${repository.name}`;
        if (repo.nameWithOwner !== upstreamNameWithOwner) {
          if (!repo.parent || repo.parent.nameWithOwner !== upstreamNameWithOwner) {
            throw new Error(`Repository ${repo.nameWithOwner} was not forked from ${upstreamNameWithOwner}`);
          }
          repository.owner = viewer.login;
          repository.isFork = true;
        }
      }
    });
    return viewer;
  }

  async readFile(repository: Repository, path: string): Promise<string> {
    let apiPath = `/repos/${repository.owner}/${repository.name}/contents${path}`;
    let parameters = {
      ref: repository.branch
    };
    let result = await this.runRequest('GET', apiPath, parameters);
    return utf8.decode(atob(result.content));
  }

  async updateFile(repository: Repository, path: string, text: string): Promise<void> {
    let apiPath = `/repos/${repository.owner}/${repository.name}/contents${path}`;
    let getParameters = {
      ref: repository.branch
    };
    let getResult = await this.runRequest('GET', apiPath, getParameters);
    let putParameters = {
      message: 'Contribution via web app',
      content: btoa(utf8.encode(text)),
      branch: repository.branch,
      sha: getResult.sha
    };
    let putResult = await this.runRequest('PUT', apiPath, putParameters);
    if (putResult.content.sha !== getResult.sha) {
      let checkResult;
      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        checkResult = await this.runRequest('GET', apiPath, getParameters);
      } while (checkResult.sha === getResult.sha);
    }
    return putResult;
  }
}
