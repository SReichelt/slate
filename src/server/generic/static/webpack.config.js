//@ts-check

'use strict';

const webpack = require('webpack');

/**@type {webpack.Configuration}*/
module.exports = {
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
