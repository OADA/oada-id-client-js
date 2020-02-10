/* Copyright 2014 Open Ag Data Alliance
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

'use strict'

module.exports = function (grunt) {
  // This automatically loads grunt tasks from node_modules
  require('load-grunt-tasks')(grunt)
  // This installs timers so you can monitor how log each step takes
  require('time-grunt')(grunt)

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    // grunt-contrib-watch
    watch: {
      build: {
        // only rebuild when our core when our app changes
        files: ['src/**/*.js'],
        tasks: ['browserify']
      },
      concat: {
        // automatically reconcatenate
        files: ['tmp/*browserify.js'],
        tasks: ['concat']
      }
      // livereload: {
      //     files: ['dist/**/*', 'examples/**/*', 'src/**/*'],
      //     options: {
      //         livereload: true,
      //     },
      // },
    },
    // grunt-browserify
    browserify: {
      // The main browserify build
      main: {
        files: {
          // Build from the main entry point into a temp folder
          'dist/main.browserify.js': ['src/browser.js']
        },
        options: {
          browserifyOptions: {
            standalone: 'oadaIdClient'
          },
          external: []
        }
      },
      // The minified main browserify build
      mainMin: {
        files: {
          // Build from the main entry point into a temp folder
          'dist/main.browserify.min.js': ['src/browser.js']
        },
        options: {
          transform: [['uglifyify', { global: true }]],
          browserifyOptions: {
            standalone: 'oadaIdClient'
          },
          external: []
        }
      }
    },
    // grunt-express
    express: {
      livereloadServer: {
        options: {
          server: './examples/server-client/server-client.js',
          bases: [
            './dist/',
            './examples/server-client/',
            './examples/browser-client/'
          ],
          port: grunt.option('port') || 3007,
          livereload: true,
          serverreload: true
        }
      }
    }
  })

  // Default task.    Build, start the server, and watch files for changes
  grunt.registerTask('default', ['build', 'watch'])
  // Build task.    Compile templates, browserify, and concat
  grunt.registerTask('build', 'Create distribution versions', ['browserify'])

  // Run the examples of using the library
  grunt.registerTask('demo', 'Run the usage examples', ['express'])
}
