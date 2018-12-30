import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Alert from 'react-alert';
import App from './App';

const AlertTemplate = require('react-alert-template-basic').default;
function getAlertTemplate(ref: any) {
  ref.style['textTransform'] = 'initial';
  return AlertTemplate(ref);
}

let root = (
  <Alert.Provider template={getAlertTemplate} position="top right" offset="20pt">
    <App/>
  </Alert.Provider>
);
ReactDOM.render(root, document.getElementById('app'));
