import * as QueryString from 'query-string';
import { fetchText } from '../utils/fetch';

export function getGitHubClientID(): Promise<string> {
  return fetchText('/github-auth/client-id');
}

export function getGitHubLoginURI(clientID: string, baseURI: string, path: string): string {
  let redirectURI = baseURI;
  if (path) {
    redirectURI += '?path=' + encodeURI(path);
  }
  return `https://github.com/login/oauth/authorize?client_id=${clientID}&scope=read:user%20public_repo&redirect_uri=${encodeURI(redirectURI)}`;
}

export interface GitHubQueryStringResult {
  path?: string;
  token?: Promise<string>;
}

export function parseGitHubQueryString(query: string): GitHubQueryStringResult {
  let result: GitHubQueryStringResult = {};
  if (query) {
    let parsedQuery = QueryString.parse(query);
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

function runGitHubRequest(request: any, accessToken: string): Promise<any> {
  let options: RequestInit = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  };
  return fetch(`https://api.github.com/graphql?${accessToken}`, options)
    .then((response) => response.json());
}

export interface GitHubUserInfo {
  login?: string;
  avatarUrl?: string;
}

export function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
  let request = {
    query: 'query { viewer { login avatarUrl } }'
  };
  return runGitHubRequest(request, accessToken)
    .then((result) => result.data.viewer);
}
