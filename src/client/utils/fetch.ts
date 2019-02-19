export function fetchAny(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return window.fetch(input, init)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Received HTTP error ${response.status} (${response.statusText})`);
      }
      return response;
    });
}

export function fetchVoid(input: RequestInfo, init?: RequestInit): Promise<void> {
  return fetchAny(input, init)
    .then(() => {});
}

export function fetchText(input: RequestInfo, init?: RequestInit): Promise<string> {
  return fetchAny(input, init)
    .then((response) => response.text());
}
