import * as React from 'react';
import * as ReactDOM from 'react-dom';

import config from '../utils/config';
import { PhysicalFileAccessor } from '../../fs/data/physicalFileAccessor';

import App from '../App';


export async function runClientTest(runTest: () => Promise<void>): Promise<void> {
  config.runningLocally = config.embedded = true;

  let container = document.createElement('div');
  document.body.appendChild(container);
  let fileAccessor = new PhysicalFileAccessor;
  ReactDOM.render(<App fileAccessor={fileAccessor}/>, container);

  await runTest();

  ReactDOM.unmountComponentAtNode(container);
  container.remove();
}
