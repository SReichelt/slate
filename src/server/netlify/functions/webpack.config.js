//@ts-check

'use strict';

const webpack = require('webpack');

/**@type {webpack.Configuration}*/
module.exports = {
    target: 'node',
    output: {
        libraryTarget: 'umd'
    },
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
                        loader: 'awesome-typescript-loader'
                    }
                ]
            }
        ]
    },
    watchOptions: {
        ignored: /node_modules/
    }
};
