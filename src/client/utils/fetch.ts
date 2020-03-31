export async function fetchAny(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let response = await window.fetch(input, init);
  if (!response.ok) {
    throw new Error(`Received HTTP error ${response.status} (${response.statusText})`);
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
  let response = await fetchAny(input, init);
  return await response.json();
}
