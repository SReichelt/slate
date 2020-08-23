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
const additionalHeadElementsLoadingScreen = `
<style>
  .loading-screen {
    text-align: center;
  }
  .loading-screen-welcome {
    margin-top: 3em;
    margin-bottom: 3em;
  }
  .loading-screen-title {
    display: block;
    font-size: 300%;
  }
  .loading-screen-loading {
    margin-bottom: 2em;
  }
  .preload-font {
    visibility: hidden;
  }
  .preload-font-regular {
    font-family: 'TeX';
  }
  .preload-font-bold {
    font-family: 'TeX';
    font-weight: bold;
  }
  .preload-font-var {
    font-family: 'TeX-Var';
    font-style: italic;
  }
  .preload-font-sans {
    font-family: 'TeX-Sans';
  }
  .preload-font-calligraphic {
    font-family: 'TeX-Calligraphic';
  }
  .preload-font-large {
    font-family: 'TeX-Large';
  }
</style>
`;
const additionalHeadElementsEmbedded = `
<base href="<%= baseURL %>" />
<meta http-equiv="Content-Security-Policy" content="default-src <%= cspSource %>; style-src <%= cspSource %> 'unsafe-inline';" />
<link href="theme-vscode.css" rel="stylesheet" />
`;
const initialContentDefault = `
<div class="loading-screen">
  <p class="loading-screen-welcome">Welcome to the <span class="loading-screen-title">Slate</span> web-based interactive theorem prover.</p>
  <p class="loading-screen-loading">Loading...</p>
  <p class="preload-font"><span class="preload-font-regular"><span class="preload-font-calligraphic">P</span>rel∅ading</span> <span class="preload-font-var">font</span><span class="preload-font-bold">.</span><span class="preload-font-sans">.</span><span class="preload-font-large">.</span></p>
</div>
`;
const initialContentStatic = '<%= content %>';
const initialContentEmbedded = `
<div class="loading-screen">
  <p class="loading-screen-loading">Loading...</p>
  <p class="preload-font"><span class="preload-font-regular"><span class="preload-font-calligraphic">P</span>rel∅ading</span> <span class="preload-font-var">font</span><span class="preload-font-bold">.</span><span class="preload-font-sans">.</span><span class="preload-font-large">.</span></p>
</div>
`;

/**@type {webpack.Plugin[]}*/
const plugins = [
  new HtmlWebpackPlugin({
    title: 'Slate',
    favicon: 'slate.png',
    filename: 'index.html',
    template: 'index.ejs',
    'additionalHeadElements': additionalHeadElementsDefault + additionalHeadElementsLoadingScreen,
    'initialContent': initialContentDefault
  }),
  new HtmlWebpackPlugin({
    title: 'Slate',
    favicon: 'slate.png',
    filename: 'download/static/template.ejs',
    template: 'index.ejs',
    'additionalHeadElements': additionalHeadElementsDefault,
    'initialContent': initialContentStatic
  }),
  new HtmlWebpackPlugin({
    title: 'Slate',
    filename: 'embedded.ejs',
    template: 'index.ejs',
    'additionalHeadElements': additionalHeadElementsEmbedded + additionalHeadElementsLoadingScreen,
    'initialContent': initialContentEmbedded
  }),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: 'theme-*.css'
      },
      {
        from: 'fonts.css'
      }
    ]
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
