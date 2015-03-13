'use strict';

var expect = require('chai').expect;
var wd = require('wd');
require('colors');
var async = require('async');

var timeout = 60000;

// checking sauce credential
if (!process.env.SAUCE_USERNAME || !process.env.SAUCE_ACCESS_KEY) {
    console.warn(
        '\nPlease configure your sauce credential:\n\n' +
        'export SAUCE_USERNAME=<SAUCE_USERNAME>\n' +
        'export SAUCE_ACCESS_KEY=<SAUCE_ACCESS_KEY>\n\n'
    );
    throw new Error('Missing sauce credentials');
}

// http configuration, not needed for simple runs
wd.configureHttp({
    timeout: timeout,
    retryDelay: 15000,
    retries: 5
});

var username = process.env.SAUCE_USERNAME;
var accessKey = process.env.SAUCE_ACCESS_KEY;

var desired = {
    browserName: process.env.BROWSER || 'chrome',
    version: process.env.VERSION,
    platform: process.env.PLATFORM
};
desired.handle = 'test in ' + desired.browserName;
desired.tags = ['oada'];

var nameSuffix = '';

// Make it work on TravisCI
if (process.env.TRAVIS) {
    desired['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
    desired.build = process.env.TRAVIS_BUILD_NUMBER;
    nameSuffix = ' [' + process.env.TRAVIS_JOB_NUMBER + ']';
    if (process.env.TRAVIS_PULL_REQUEST !== 'false') {
        desired.tags.push('pull request');
        desired.tags.push('pull request:' + process.env.TRAVIS_PULL_REQUEST);
    }
}

describe(desired.browserName + ' ' + desired.version, function() {
    this.timeout(10 * timeout);
    var browser;

    beforeEach(function(done) {
        desired.name = this.currentTest.title + nameSuffix;
        browser = wd.remote(
                'ondemand.saucelabs.com',
                80,
                username,
                accessKey
        );
        if (process.env.VERBOSE) {
            // optional extra logging
            browser.on('status', function(info) {
                console.log(info.cyan);
            });
            browser.on('command', function(eventType, command, response) {
                console.log(
                        ' > ' + eventType.cyan,
                        command,
                        (response || '').grey
                );
            });
            browser.on('http', function(meth, path, data) {
                console.log(' > ' + meth.magenta, path, (data || '').grey);
            });
        }
        browser.init(desired, done);
    });

    afterEach(function(done) {
        browser.quit(function() {
            browser.sauceJobStatus(this.currentTest.state === 'passed',  done);
        }.bind(this));
    });

    describe('browser side client', function() {
        beforeEach(function(done) {
            browser.get('http://localhost:3007/', function() {
                browser.title(function(err, title) {
                    expect(err).to.be.not.ok;
                    expect(title).to.equal('In Browser Usage Example Page');
                    done();
                });
            });
        });
        ['access', 'id'].map(function(tokType) {
            it('should get ' + tokType + ' token', function(done) {
                async.series([
                    function(done) {
                        browser.elementById('get_' + tokType,
                            function(err, el) {
                                expect(err).to.be.not.ok;
                                expect(el).to.be.ok;
                                el.click(done);
                            }
                        );
                    },
                    function(done) {
                        browser.waitFor(
                            new wd.Asserter(function(browser, cb) {
                                browser.windowHandles(function(err, handles) {
                                    expect(err).to.be.not.ok;
                                    return cb(err, handles.length === 2);
                                });
                            }),
                            timeout,
                            done
                        );
                    },
                    function(done) {
                        browser.windowHandles(function(err, handles) {
                            expect(err).to.be.not.ok;
                            expect(handles[1]).to.be.ok;
                            browser.window(handles[1], done);
                        });
                    },
                    function(done) {
                        browser.waitForElementByName(
                            'username',
                            timeout,
                            function(err, el) {
                                expect(err).to.be.not.ok;
                                expect(el).to.be.ok;
                                el.clear(function(err) {
                                    expect(err).to.be.not.ok;
                                    el.type('andy', done);
                                });
                            }
                        );
                    },
                    function(done) {
                        browser.waitForElementByName(
                            'password',
                            timeout,
                            function(err, el) {
                                expect(err).to.be.not.ok;
                                expect(el).to.be.ok;
                                el.clear(function(err) {
                                    expect(err).to.be.not.ok;
                                    el.type('pass', done);
                                });
                            }
                        );
                    },
                    function(done) {
                        browser.waitForElementByXPath(
                            '//input[@type="submit"]',
                            timeout,
                            function(err, el) {
                                expect(err).to.be.not.ok;
                                expect(el).to.be.ok;
                                el.click(done);
                            }
                        );
                    },
                    function(done) {
                        browser.waitForElementById(
                            'allow',
                            timeout,
                            function(err, el) {
                                expect(err).to.be.not.ok;
                                expect(el).to.be.ok;
                                el.click(done);
                            }
                        );
                    },
                    function(done) {
                        browser.windowHandles(function(err, handles) {
                            expect(err).to.be.not.ok;
                            expect(handles[0]).to.be.ok;
                            browser.window(handles[0], done);
                        });
                    },
                    function(done) {
                        browser.waitFor(
                            new wd.Asserter(function(browser, cb) {
                                browser.windowHandles(function(err, handles) {
                                    expect(err).to.be.not.ok;
                                    return cb(err, handles.length === 1);
                                });
                            }),
                            timeout,
                            done
                        );
                    },
                    function(done) {
                        browser.waitForElementById(
                            'token',
                            new wd.Asserter(function(el, cb) {
                                el.text(function(err, text) {
                                    expect(err).to.be.not.ok;
                                    return cb(err, text.length > 0);
                                });
                            }),
                            timeout,
                            done
                        );
                    },
                    /*
                    function(done) {
                        browser.windowHandles(function(err, handles) {
                            expect(err).to.be.not.ok;
                            expect(handles).to.have.length(1);
                            done();
                        });
                    }
                    */
                ], done);
            });
        });
    });
});
