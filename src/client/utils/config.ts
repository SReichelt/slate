export interface VSCodeAPI {
  postMessage(message: any): void;
}

declare const acquireVsCodeApi: (() => VSCodeAPI) | undefined;

export class Config {
  development: boolean;
  embedded: boolean;
  runningLocally: boolean;
  vsCodeAPI?: VSCodeAPI;

  constructor() {
    this.vsCodeAPI = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi!() : undefined;
    this.development = (process.env.NODE_ENV === 'development');
    this.embedded = this.vsCodeAPI !== undefined;
    this.runningLocally = this.development || this.embedded;
  }
}

const config = new Config;

export default config;
