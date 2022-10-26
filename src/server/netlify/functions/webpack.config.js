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
                use: 'ts-loader'
            }
        ]
    },
    plugins: [
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1
        })
    ],
    watchOptions: {
        ignored: /node_modules/
    }
};

const baseOutput = {
    path: path.join(projectRoot, 'dist', 'functions'),
    libraryTarget: 'umd'
};

/**@type {webpack.Configuration[]}*/
module.exports = [
    {
        ...baseConfig,
        output: {
            ...baseOutput,
            filename: 'auth-info.js'
        },
        entry: './authInfoFunction'
    },
    {
        ...baseConfig,
        output: {
            ...baseOutput,
            filename: 'auth.js'
        },
        entry: './authFunction'
    },
    {
        ...baseConfig,
        output: {
            ...baseOutput,
            filename: 'submit.js'
        },
        entry: './submitFunction'
    }
];
