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

const plugins = [
  new HtmlWebpackPlugin({
    title: 'Slate',
    favicon: 'slate.png',
    filename: 'index.html',
    template: 'index.ejs',
    'additionalHeadElements': additionalHeadElementsDefault
  }),
  new HtmlWebpackPlugin({
    title: 'Slate',
    filename: 'embedded.ejs',
    template: 'index.ejs',
    'additionalHeadElements': additionalHeadElementsEmbedded
  }),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: 'theme-*.css'
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
