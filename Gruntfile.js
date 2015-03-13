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

'use strict';

var _ = require('lodash');
var desireds = require('./test/sauce/desireds');

module.exports = function(grunt) {

    // This automatically loads grunt tasks from node_modules
    require('load-grunt-tasks')(grunt);
    // This installs timers so you can monitor how log each step takes
    require('time-grunt')(grunt);

    // All the project JS files
    var jsFiles = [
        'Gruntfile.js',
        'test/**/*.js',
        'examples/**/*.js',
        'src/**/*.js',
        'index.js',
    ];
    // All the project HTML files
    var htmlFiles = [
        'examples/**/*.html',
        'index.html',
    ];

    // Project configuration.
    var gruntConfig = {
        pkg: grunt.file.readJSON('package.json'),
        // grunt-contrib-jshint
        jshint: {
            options: {
                jshintrc: true,
            },
            js: {
                src: jsFiles,
            },
            html: {
                src: htmlFiles,
                options: {
                    extensions: 'htm html',
                    extract: 'always',
                    browser: true,
                },
            },
        },
        lint5: {
            dirPath: '.',
            templates: grunt.file.expand(htmlFiles),
        },
        jscs: {
            all: {
                src: jsFiles,
                options: {
                    config: './.jscsrc',
                },
            },
        },
        // grunt-contrib-watch
        watch: {
            jsLint: {
                files: jsFiles,
                // grunt-newer is also included.
                // It will dynamically modify the jshint
                // config so only files that changed will be linted
                tasks: ['newer:jshint:js'],
            },
            htmlLint: {
                files: htmlFiles,
                // grunt-newer is also included.
                // It will dynamically modify the jshint
                // config so only files that changed will be linted
                tasks: ['newer:jshint:html'],
            },
            style: {
                files: jsFiles,
                // grunt-newer is also included.
                // It will dynamically modify the jscs
                // config so only files that changed will be linted
                tasks: ['newer:jscs:all'],
            },
            build: {
                // only rebuild when our core when our app changes
                files: ['src/**/*.js'],
                tasks: ['browserify'],
            },
            concat: {
                // automatically reconcatenate
                files: ['tmp/*browserify.js'],
                tasks: ['concat']
            },
            //livereload: {
            //    files: ['dist/**/*', 'examples/**/*', 'src/**/*'],
            //    options: {
            //        livereload: true,
            //    },
            //},
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
                    external: [
                    ],
                },
            },
            // The minified main browserify build
            mainMin: {
                files: {
                    // Build from the main entry point into a temp folder
                    'dist/main.browserify.min.js': ['src/browser.js']
                },
                options: {
                    transform: [['uglifyify', {global: true}]],
                    browserifyOptions: {
                        standalone: 'oadaIdClient'
                    },
                    external: [
                    ],
                },
            },
        },
        // grunt-express
        express: {
            livereloadServer: {
                options: {
                    server: './examples/server-client/server-client.js',
                    bases: [
                        './dist/',
                        './examples/server-client/',
                        './examples/browser-client/',
                    ],
                    port: grunt.option('port') || 3007,
                    livereload: true,
                    serverreload: true,
                },
            },
        },
        env: {
            // dynamically filled
        },
        simplemocha: {
            sauce: {
                options: {
                    timeout: 60000,
                    reporter: 'spec'
                },
                src: ['test/sauce/**/*-specs.js']
            }
        },
        concurrent: {
            options: {
                limit: 2
            },
            'test-sauce': [], // dynamically filled
        },
    };

    _(desireds).each(function(desired, key) {
        gruntConfig.env[key] = {
            DESIRED: JSON.stringify(desired)
        };
        gruntConfig.concurrent['test-sauce'].push('test:sauce:' + key);
    });
    grunt.initConfig(gruntConfig);

    // Default task.    Build, start the server, and watch files for changes
    grunt.registerTask('default', [
        'lint',
        'style',
        'build',
        'watch',
    ]);
    // Build task.    Compile templates, browserify, and concat
    grunt.registerTask('build', 'Create distribution versions',
        ['browserify']);

    grunt.registerTask('lint', 'Lint the project files', ['jshint', 'lint5']);
    grunt.registerTask('style', 'Style check the project files', ['jscs']);

    // Run the examples of using the library
    grunt.registerTask('demo', 'Run the usage examples', ['express']);

    grunt.registerTask('default', ['test:sauce:' + _(desireds).keys().first()]);
    _(desireds).each(function(desired, key) {
        grunt.registerTask('test:sauce:' + key,
            ['env:' + key, 'simplemocha:sauce']);
    });
    grunt.registerTask('test:sauce:parallel', ['concurrent:test-sauce']);
};
