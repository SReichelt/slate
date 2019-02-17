export function fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return window.fetch(input, init)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Received HTTP error ${response.status} (${response.statusText})`);
      }
      return response;
    });
}

export function fetchText(input: RequestInfo, init?: RequestInit): Promise<string> {
  return fetch(input, init)
    .then((response) => response.text());
}
