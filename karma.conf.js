/**
 * @license
 * Copyright 2014-2022 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable unicorn/prevent-abbreviations, import/no-commonjs, unicorn/prefer-module */

const puppeteer = require('puppeteer');

process.env.CHROME_BIN = puppeteer.executablePath();

const Rewire = require('rewire-webpack-plugin');
const { mode, entry, output, ...webpack } = require('./webpack.config');

webpack.plugins = [new Rewire()].concat(webpack.plugins ?? []);
module.exports = function (config) {
  config.set({
    basePath: '',
    plugins: [
      'karma-webpack',
      'karma-mocha',
      'karma-mocha-reporter',
      'karma-firefox-launcher',
      'karma-chrome-launcher',
      'karma-vivaldi-launcher',
    ],
    frameworks: ['mocha', 'webpack'],
    files: ['test/**/*.test.ts'],
    exclude: [],
    preprocessors: {
      'test/**/*.test.ts': ['webpack'],
    },
    karmaTypescriptConfig: {
      bundlerOptions: {
        validateSyntax: false,
      },
      tsconfig: 'test/tsconfig.json',
    },
    webpack,
    coverageReporter: {
      type: 'lcov',
      dir: 'coverage/',
      subdir: '.',
    },
    reporters: ['mocha'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeHeadless'],
    singleRun: true,
  });
};
