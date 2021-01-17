import type { RequestInfo, RequestInit, Response } from 'node-fetch';

export { RequestInfo, RequestInit, Response };

export default class FetchHelper {
  constructor(public fetch: (url: RequestInfo, init?: RequestInit) => Promise<Response>) {}

  fetchAny(input: RequestInfo, init?: RequestInit): Promise<Response> {
    return this.fetch(input, init).then((response: Response) => {
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

  fetchVoid(input: RequestInfo, init?: RequestInit): Promise<void> {
    return this.fetchAny(input, init).then(() => {});
  }

  fetchText(input: RequestInfo, init?: RequestInit): Promise<string> {
    return this.fetchAny(input, init).then((response: Response) => response.text());
  }

  fetchJSON(input: RequestInfo, init?: RequestInit): Promise<any> {
    if (!init) {
      init = {
        headers: {
          'Accept': 'application/json'
        }
      };
    }
    return this.fetchAny(input, init).then((response: Response) => response.json());
  }
}
