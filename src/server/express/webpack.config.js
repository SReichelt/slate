//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

const projectRoot = path.join(__dirname, '..', '..', '..');

/**@type {webpack.Configuration}*/
module.exports = {
    target: 'node',
    output: {
        path: path.join(projectRoot, 'dist', 'server'),
        filename: 'server.js'
    },
    entry: './server',
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    watchOptions: {
        ignored: /node_modules/
    }
};
