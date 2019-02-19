import * as queryString from 'query-string';
import * as utf8 from 'utf8';
import { fetchAny, fetchText } from '../utils/fetch';

export function getClientID(): Promise<string> {
  return fetchText('/github-auth/client-id');
}

export function getLoginURI(clientID: string, baseURI: string, path: string): string {
  let redirectURI = baseURI;
  if (path && path !== '/') {
    redirectURI += '?path=' + encodeURI(path);
  }
  return `https://github.com/login/oauth/authorize?client_id=${clientID}&scope=read:user%20public_repo&redirect_uri=${encodeURI(redirectURI)}`;
}

export interface Repository {
  owner: string;
  repository: string;
  branch: string;
  isFork?: boolean;
}

export function getDownloadURI(repository: Repository, path: string): string {
  return `https://raw.githubusercontent.com/${repository.owner}/${repository.repository}/${repository.branch}${path}`;
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
    let uri = `https://api.github.com${path}?${this.accessToken}`;
    let options: RequestInit = {
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    };
    if (method === 'GET' || method === 'HEAD') {
      for (let key of Object.keys(request)) {
        uri += `&${key}=${request[key]}`;
      }
    } else {
      options.body = JSON.stringify(request);
    }
    let response = await fetch(uri, options);
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP error ${response.status} (${response.statusText})`);
    }
    return response.json();
  }

  private runGraphQLRequest(request: any): Promise<any> {
    return this.runRequest('POST', '/graphql', request);
  }

  async getUserInfo(): Promise<UserInfo> {
    let request = {
      query: 'query { viewer { login avatarUrl } }'
    };
    let result = await this.runGraphQLRequest(request);
    return result.data.viewer;
  }

  async checkRepository(repository: string): Promise<boolean> {
    let request = {
      query: `query { viewer { repository(name: "${repository}") { name } } }`
    };
    let result = await this.runGraphQLRequest(request);
    return !!result.data.viewer.repository;
  }

  async updateFile(repository: Repository, path: string, text: string): Promise<void> {
    let apiPath = `/repos/${repository.owner}/${repository.repository}/contents${path}`;
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
    let checkResult;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      checkResult = await this.runRequest('GET', apiPath, getParameters);
    } while (checkResult.sha === getResult.sha && checkResult.sha !== putResult.content.sha);
    return putResult;
  }
}
