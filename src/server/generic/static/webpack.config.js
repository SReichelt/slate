//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

const projectRoot = path.join(__dirname, '..', '..', '..', '..');

/**@type {webpack.Configuration}*/
const baseConfig = {
    target: 'node',
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

const baseOutput = {
    path: path.join(projectRoot, 'dist', 'public', 'download', 'static')
};

/**@type {webpack.Configuration[]}*/
module.exports = [
    {
        ...baseConfig,
        output: {
            ...baseOutput,
            filename: 'buildPreload.js'
        },
        entry: './buildPreload'
    },
    {
        ...baseConfig,
        output: {
            ...baseOutput,
            filename: 'buildStatic.js'
        },
        entry: './buildStatic'
    }
];
