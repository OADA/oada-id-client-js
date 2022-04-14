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

/* eslint-disable unicorn/prefer-module */

import path from 'path';
import url from 'url';
import webpack from 'webpack';

const config: webpack.Configuration = {
  entry: './src/browser.ts',
  target: 'web',
  mode: 'production',
  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /node:/,
      (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, '');
      }
    ),
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
      util: require.resolve('util/'),
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify'),
      buffer: require.resolve('buffer/'),
      url: require.resolve('url/'),

      string_decoder: require.resolve('string_decoder/'),
      events: require.resolve('events/'),
      path: require.resolve('path-browserify'),
      assert: require.resolve('assert/'),
      os: require.resolve('os-browserify/browser'),
      module: false,
    },
  },
  context: __dirname,
  node: {
    __dirname: true,
  },
  output: {
    path: path.resolve(path.dirname(url.fileURLToPath(import.meta.url))),
    filename: 'bundle.js',
    library: 'oadaIdClient',
  },
};

export default config;
