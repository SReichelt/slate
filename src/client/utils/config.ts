export interface VSCodeAPI {
  postMessage(message: any): void;
}

declare const acquireVsCodeApi: (() => VSCodeAPI) | undefined;

export class Config {
  development: boolean;
  embedded: boolean;
  testing: boolean = false;
  runningLocally: boolean;
  useMarkdownEditor: boolean;
  vsCodeAPI?: VSCodeAPI;
  projectRepositoryURL: string;

  constructor() {
    this.vsCodeAPI = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi!() : undefined;
    this.development = (process.env.NODE_ENV === 'development');
    this.embedded = this.vsCodeAPI !== undefined;
    this.runningLocally = this.development || this.embedded;
    // EasyMDE currently doesn't work correctly on Android, so don't use it if we have a touch device.
    this.useMarkdownEditor = !('ontouchstart' in window);
    this.projectRepositoryURL = 'https://github.com/SReichelt/slate';
  }
}

const config = new Config;

export default config;
