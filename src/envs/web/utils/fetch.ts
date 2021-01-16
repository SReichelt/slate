import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';

declare const window: any | undefined;
const doFetch = typeof window !== 'undefined' ? window.fetch : fetch;

export function fetchAny(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return doFetch(input, init).then((response: Response) => {
    if (response.ok) {
      return response;
    } else {
      let message = `Received HTTP error ${response.status}`;
      if (response.statusText) {
        message += ` (${response.statusText})`;
      }
      return Promise.reject(new Error(message));
    }
  });
}

export function fetchVoid(input: RequestInfo, init?: RequestInit): Promise<void> {
  return fetchAny(input, init).then(() => {});
}

export function fetchText(input: RequestInfo, init?: RequestInit): Promise<string> {
  return fetchAny(input, init).then((response: Response) => response.text());
}

export function fetchJSON(input: RequestInfo, init?: RequestInit): Promise<any> {
  if (!init) {
    init = {
      headers: {
        'Accept': 'application/json'
      }
    };
  }
  return fetchAny(input, init).then((response: Response) => response.json());
}
