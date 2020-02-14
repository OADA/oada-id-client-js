/* Copyright 2014 Open Ag Data Alliance
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

require('./test/setup.js')

const Rewire = require('rewire-webpack-plugin')
const webpack = require('./webpack.config')[0]
const args = require('yargs').argv

webpack.plugins = [new Rewire()].concat(webpack.plugins || [])
module.exports = function (config) {
  const reporters = ['mocha']
  const preprocessors = {
    'test/**/*.test.js': ['webpack']
  }

  if (args.cover) {
    reporters.push('coverage')
    preprocessors['src/browser.js'] = ['webpack', 'coverage']
  }

  config.set({
    basePath: '',

    frameworks: ['mocha'],

    files: ['src/browser.js', 'test/**/*.test.js'],

    exclude: [],

    preprocessors,

    webpack,

    reporters: reporters,

    coverageReporter: {
      type: 'lcov',
      dir: 'coverage/',
      subdir: '.'
    },

    port: 9876,

    colors: true,

    logLevel: config.LOG_INFO,

    autoWatch: true,

    // browsers: ['vivaldi'],
    customLaunchers: {
      vivaldi: {
        base: 'Vivaldi',
        flags: ['--allow-insecure-localhost']
      },
      chrome: {
        base: 'ChromeHeadless',
        flags: ['--allow-insecure-localhost', '--disable-gpu']
      },
      firefox: {
        base: 'Firefox',
        flags: ['-headless']
      }
    },

    singleRun: true
  })
}
