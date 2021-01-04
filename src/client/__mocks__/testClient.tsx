import * as React from 'react';
import * as ReactDOM from 'react-dom';

import config from '../utils/config';
import { PhysicalFileAccessor } from '../../fs/data/physicalFileAccessor';

import App, { AppTestProps } from '../App';


// Temporarily work around jest module loading incompatibility.
function fixModuleDefaultExport(moduleName: string): void {
  let module = require(moduleName);
  module.default = module;
}

export async function runClientTest(getTestProps: (callback: () => void) => AppTestProps): Promise<void> {
  fixModuleDefaultExport('clsx');
  fixModuleDefaultExport('scroll-into-view-if-needed');
  fixModuleDefaultExport('react-alert-template-basic');

  config.testing = true;
  config.runningLocally = true;
  config.useMarkdownEditor = false;

  let origSetTimeout = window.setTimeout;
  let newSetTimeout = (handler: () => void, timeout: number, ...rest: any) => origSetTimeout(handler, 0, ...rest);
  window.setTimeout = newSetTimeout as any;

  let container = document.createElement('div');
  document.body.appendChild(container);

  let fileAccessor = new PhysicalFileAccessor;

  await new Promise<void>((resolve) =>
    ReactDOM.render(<App fileAccessor={fileAccessor} {...getTestProps(resolve)}/>, container));

  ReactDOM.unmountComponentAtNode(container);
  container.remove();

  window.setTimeout = origSetTimeout;
}
