const path = require('path');
const webpack = require('webpack');
const version = require('../../package.json').version;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const OpenBrowserPlugin = require('open-browser-webpack-plugin');

const config = require('../server/config');
const projectRoot = path.join(__dirname, '..', '..');

const plugins = [
  new HtmlWebpackPlugin({
    title: 'Slate',
    favicon: 'slate.png',
    filename: 'index.html',
    template: 'index.ejs'
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
    filename: `[name]-${version}-bundle.js`,
    publicPath: '/public/'
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all"
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
