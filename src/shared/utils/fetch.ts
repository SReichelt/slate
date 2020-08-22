import type { RequestInfo, RequestInit, Response } from 'node-fetch';

declare const window: any | undefined;
const fetch = typeof window !== 'undefined' && window.fetch ? window.fetch : require('node-fetch');

export async function fetchAny(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let response = await fetch(input, init);
  if (!response.ok) {
    let message = `Received HTTP error ${response.status}`;
    if (response.statusText) {
      message += ` (${response.statusText})`;
    }
    throw new Error(message);
  }
  return response;
}

export async function fetchVoid(input: RequestInfo, init?: RequestInit): Promise<void> {
  await fetchAny(input, init);
}

export async function fetchText(input: RequestInfo, init?: RequestInit): Promise<string> {
  let response = await fetchAny(input, init);
  return await response.text();
}

export async function fetchJSON(input: RequestInfo, init?: RequestInit): Promise<any> {
  if (!init) {
    init = {
      headers: {
        'Accept': 'application/json'
      }
    };
  }
  let response = await fetchAny(input, init);
  return await response.json();
}
