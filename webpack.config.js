/**
 * @license
 * Copyright 2022 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable unicorn/prefer-module, import/no-commonjs */

const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/browser.ts',
  target: 'web',
  mode: 'production',
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, '');
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.test\.ts$/,
        use: [
          // Let tests use fs.readFileSync
          {
            loader: 'transform-loader',
            options: 'brfs',
          },
        ],
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          projectReferences: true,
          onlyCompileBundledFiles: true,
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.wasm'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      events: require.resolve('events/'),
      stream: require.resolve('stream-browserify'),
      // eslint-disable-next-line camelcase
      string_decoder: require.resolve('string_decoder/'),
      util: require.resolve('util/'),
    },
  },
  context: __dirname,
  node: {
    __dirname: true,
  },
  output: {
    path: path.resolve(__dirname),
    filename: 'bundle.js',
    library: 'oadaIdClient',
  },
};
