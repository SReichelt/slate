//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const config = require('../server/generic/config');
const projectRoot = path.join(__dirname, '..', '..');

function outputPlaceholder(name) {
  return `<%= ${name} %>`;
}

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
    'isStatic': false,
    'isEmbedded': false
  }),
  new HtmlWebpackPlugin({
    title: '<%= title %>',
    favicon: 'public/slate.png',
    filename: 'static.ejs',
    template: 'index.ejs',
    'isStatic': true,
    'isEmbedded': false,
    'outputPlaceholder': outputPlaceholder
  }),
  new HtmlWebpackPlugin({
    title: 'Slate',
    filename: 'embedded.ejs',
    template: 'index.ejs',
    'isStatic': false,
    'isEmbedded': true,
    'outputPlaceholder': outputPlaceholder
  })
];

/**@type {webpack.Configuration}*/
module.exports = {
  mode: config.IS_PRODUCTION ? 'production' : 'development',
  devtool: config.IS_PRODUCTION ? '' : 'inline-source-map',
  entry: ['babel-polyfill', './client'],
  output: {
    path: path.join(projectRoot, 'dist', 'public'),
    filename: `js/[name].js`
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
          chunks: 'all',
          enforce: true
        },
        'vendors-react': {
          test: /[\\/]node_modules[\\/]@?react/,
          name: 'vendors-react',
          chunks: 'all',
          enforce: true
        },
        'vendors-markdown': {
          test: /[\\/]node_modules[\\/]@?(markdown|easymde|codemirror)/,
          name: 'vendors-markdown',
          chunks: 'all',
          enforce: true
        },
        'vendors-polyfill': {
          test: /[\\/]node_modules[\\/]@?(babel|browserify|readable-stream)/,
          name: 'vendors-polyfill',
          chunks: 'all',
          enforce: true
        },
        'client': {
          test: /[\\/]src[\\/]client[\\/]/,
          name: 'client',
          chunks: 'all',
          enforce: true
        },
        'extras': {
          test: /[\\/]src[\\/]client[\\/]extras[\\/]/,
          priority: 1,
          name: 'extras',
          chunks: 'all',
          enforce: true
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
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
  performance: {
    maxAssetSize: 1000000,
    maxEntrypointSize: 10000000
  },
  watchOptions: {
    ignored: /node_modules/
  },
  plugins
};
