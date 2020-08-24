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
<div id="static-nav">
  <p>Slate is a project to build a web-based <a href="https://en.wikipedia.org/wiki/Proof_assistant">interactive theorem prover</a> with a focus on abstract mathematics. It is optimized for being easy to learn.</p>
  <p>Running Slate in your browser requires that JavaScript is enabled.</p>
  <p>Otherwise, please follow these links:</p>
  <ul>
    <li><p><a href="libraries/hlm">HLM Library</a> (statically rendered)</p></li>
    <li><p><a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate">Slate Extension</a> for Microsoft Visual Studio Code</p></li>
  </ul>
</div>
<script src="js/remove-static-nav.js"></script>
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
    filename: 'static.ejs',
    template: 'static.ejs',
    'additionalHeadElements': additionalHeadElementsDefault,
    'canonicalURL': '<%= canonicalURL %>',
    'content': '<%= content %>'
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
    filename: `js/[name]-${version}-bundle.js`
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        'vendors': {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        },
        'vendors-react': {
          test: /[\\/]node_modules[\\/]react/,
          name: 'vendors-react',
          chunks: 'all'
        },
        'extras': {
          test: /[\\/]extras[\\/]/,
          name: 'extras',
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
