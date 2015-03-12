'use strict';

var expect = require('chai').expect;
var wd = require('wd');
require('colors');

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

var desired = JSON.parse(process.env.DESIRED || '{"browserName": "chrome"}');
desired.handle = 'test in ' + desired.browserName;
desired.tags = ['oada'];
desired.name = 'Access Token';

// Make it work on TravisCI
if (process.env.TRAVIS) {
    desired['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
    desired.build = process.env.TRAVIS_BUILD_NUMBER;
    desired.name += ' [' + process.env.TRAVIS_JOB_NUMBER + ']';
    if (process.env.TRAVIS_PULL_REQUEST !== 'false') {
        desired.tags.push('pull request');
        desired.tags.push('pull request:' + process.env.TRAVIS_PULL_REQUEST);
    }
}

describe(desired.browserName, function() {
    this.timeout(10 * timeout); // Sacuelabs can have a line
    var allPassed = true;
    var browser;

    before(function(done) {
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

    beforeEach(function(done) {
        browser.deleteAllCookies(function(err) {
            expect(err).to.be.not.ok;
            browser.clearLocalStorage(done);
        });
    });

    afterEach(function(done) {
        allPassed = allPassed && (this.currentTest.state === 'passed');
        done();
    });

    after(function(done) {
        browser.quit(function() {
            browser.sauceJobStatus(allPassed, done);
        });
    });

    ['access', 'id'].map(function(tokType) {
        describe('get ' + tokType + ' token', function() {

            before(function(done) {
                browser.get('http://localhost:3007/', function() {
                    browser.title(function(err, title) {
                        expect(err).to.be.not.ok;
                        expect(title).to.equal('In Browser Usage Example Page');
                        done();
                    });
                });
            });

            it('should open login/auth popup', function(done) {
                browser.elementById('get_' + tokType, function(err, el) {
                    expect(err).to.be.not.ok;
                    expect(el).to.be.ok;
                    el.click(function(err) {
                        expect(err).to.be.not.ok;
                        browser.waitFor({
                            asserter: new wd.Asserter(function(browser, cb) {
                                browser.windowHandles(function(err, handles) {
                                    expect(err).to.be.not.ok;
                                    return cb(err, handles.length === 2);
                                });
                            }),
                            timeout: timeout
                        }, done);
                    });
                });
            });

            describe('approval', function() {
                before(function(done) {
                    browser.windowHandles(function(err, handles) {
                        expect(err).to.be.not.ok;
                        expect(handles[1]).to.be.ok;
                        browser.window(handles[1], done);
                    });
                });

                before(function(done) {
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
                });

                before(function(done) {
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
                });

                before(function(done) {
                    browser.waitForElementByXPath(
                            '//input[@type="submit"]',
                            timeout,
                            function(err, el) {
                                expect(err).to.be.not.ok;
                                expect(el).to.be.ok;
                                el.click(done);
                            }
                    );
                });

                // Parameters are set to always need consent,
                // even if not first time
                it('should ask for consent', function(done) {
                    browser.waitForElementById(
                            'allow',
                            timeout,
                            done
                    );
                });

                after(function(done) {
                    browser.elementById('allow', function(err, el) {
                        expect(err).to.be.not.ok;
                        expect(el).to.be.ok;
                        el.click(done);
                    });
                });

                after(function(done) {
                    browser.windowHandles(function(err, handles) {
                        expect(err).to.be.not.ok;
                        expect(handles[0]).to.be.ok;
                        browser.window(handles[0], done);
                    });
                });
            });

            it('should receive token', function(done) {
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
            });

            it('should close popup', function(done) {
                browser.windowHandles(function(err, handles) {
                    expect(err).to.be.not.ok;
                    expect(handles).to.have.length(1);
                    done();
                });
            });
        });
    });
});
