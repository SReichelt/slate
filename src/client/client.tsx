import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Alert from 'react-alert';
import { getAlertTemplate } from './components/Message';
import App from './App';

let root = (
  <Alert.Provider template={getAlertTemplate} position="top right" offset="20pt">
    <App/>
  </Alert.Provider>
);
ReactDOM.render(root, document.getElementById('app'));
