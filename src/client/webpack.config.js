//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const version = require('../../package.json').version;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const OpenBrowserPlugin = require('open-browser-webpack-plugin');

const config = require('../server/config');
const projectRoot = path.join(__dirname, '..', '..');

const additionalHeadElementsDefault = `
<base href="/" />
<style>
  body {
    font-family: sans-serif;
  }
</style>
<link href="theme-default.css" rel="stylesheet" />
`;
const additionalHeadElementsEmbedded = `
<base href="<%= baseURL %>" />
<meta http-equiv="Content-Security-Policy" content="default-src <%= cspSource %>; style-src <%= cspSource %> 'unsafe-inline';" />
<link href="theme-vscode.css" rel="stylesheet" />
`;
const additionalContentDefault = `
<nav id="static-nav">
  <p>The Slate theorem prover is a web application that requires JavaScript.</p>
  <p>Otherwise, please follow these links:</p>
  <ul>
    <li><a href="libraries/hlm">HLM Library</a> (statically rendered)</li>
    <li><a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate">Slate Extension</a> for Microsoft Visual Studio Code</li>
  </ul>
</nav>
<script>document.getElementById("app").removeChild(document.getElementById("static-nav"));</script>
`;

/**@type {webpack.Plugin[]}*/
const plugins = [
  new CopyWebpackPlugin({
    patterns: [
      {
        from: '**/*',
        context: path.resolve(__dirname, 'public')
      }
    ]
  }),
  new HtmlWebpackPlugin({
    title: 'Slate',
    favicon: 'public/slate.png',
    filename: 'index.html',
    template: 'index.ejs',
    'additionalHeadElements': additionalHeadElementsDefault,
    'description': 'web-based interactive theorem prover',
    'additionalContent': additionalContentDefault
  }),
  new HtmlWebpackPlugin({
    title: '<%= title %>',
    favicon: 'public/slate.png',
    filename: 'download/static/template.ejs',
    template: 'static.ejs',
    'additionalHeadElements': additionalHeadElementsDefault,
    'staticContent': '<%= content %>'
  }),
  new HtmlWebpackPlugin({
    title: 'Slate',
    filename: 'embedded.ejs',
    template: 'index.ejs',
    'additionalHeadElements': additionalHeadElementsEmbedded,
    'description': 'extension for Microsoft Visual Studio Code',
    'additionalContent': ''
  })
];

if (!config.IS_PRODUCTION) {
  plugins.push(new OpenBrowserPlugin({
    url: `http://localhost:${config.SERVER_PORT}`,
    browser: 'chrome-remote-debug'
  }));
}

/**@type {webpack.Configuration}*/
module.exports = {
  mode: config.IS_PRODUCTION ? 'production' : 'development',
  devtool: config.IS_PRODUCTION ? '' : 'inline-source-map',
  entry: ['babel-polyfill', './client'],
  output: {
    path: path.join(projectRoot, 'dist', 'public'),
    filename: `[name]-${version}-bundle.js`
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'awesome-typescript-loader'
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
          }
        ]
      },
      {
        test: /.jpe?g$|.gif$|.png$|.svg$|.woff$|.woff2$|.ttf$|.eot$/,
        use: 'url-loader?limit=10000'
      }
    ]
  },
  watchOptions: {
    ignored: /node_modules/
  },
  plugins
};
