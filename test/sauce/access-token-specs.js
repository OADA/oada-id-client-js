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

// Make it work on TravisCI
if (process.env.TRAVIS) {
    desired['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
    desired.build = process.env.TRAVIS_JOB_NUMBER + '-' +
        process.env.TRAVIS_REPO_SLUG;
    if (process.env.TRAVIS_PULL_REQUEST !== 'false') {
        desired.tags.push('pull request');
        desired.tags.push('pull request:' + process.env.TRAVIS_PULL_REQUEST);
    }
}

var browser = wd.remote('ondemand.saucelabs.com', 80, username, accessKey);

// optional extra logging
if (process.env.VERBOSE) {
    browser.on('status', function(info) {
        console.log(info.cyan);
    });
    browser.on('command', function(eventType, command, response) {
        console.log(' > ' + eventType.cyan, command, (response || '').grey);
    });
    browser.on('http', function(meth, path, data) {
        console.log(' > ' + meth.magenta, path, (data || '').grey);
    });
}

describe('get access token (' + desired.browserName + ')', function() {
    var allPassed = true;

    before(function(done) {
        this.timeout(10 * timeout); // Sacuelabs can have a line
        browser.init(desired, done);
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

    it('should load test page', function(done) {
        browser.get('http://localhost:3007/', function() {
            browser.title(function(err, title) {
                expect(title).to.equal('In Browser Usage Example Page');
                done();
            });
        });
    });

    it('should try to get access token', function(done) {
        browser.elementByXPath('//body/button[2]', function(err, el) {
            expect(el).to.be.ok;
            el.click(done);
        });
    });

    it('should open popup', function(done) {
        browser.waitFor({
            asserter: new wd.Asserter(function(browser, cb) {
                browser.windowHandles(function(err, handles) {
                    return cb(err, handles.length === 2);
                });
            }),
            timeout: timeout
        }, done);
    });

    it('should switch to popup', function(done) {
        browser.windowHandles(function(err, handles) {
            expect(handles[1]).to.be.ok;
            browser.window(handles[1], done);
        });
    });

    it('should use username andy', function(done) {
        browser.waitForElementByName(
                'username',
                timeout,
                function(err, el) {
                    expect(el).to.be.ok;
                    el.clear(function(err) {
                        expect(err).to.be.not.ok;
                        el.type('andy', done);
                    });
                }
        );
    });

    it('should use password pass', function(done) {
        browser.waitForElementByName(
                'password',
                timeout,
                function(err, el) {
                    expect(el).to.be.ok;
                    el.clear(function(err) {
                        expect(err).to.be.not.ok;
                        el.type('pass', done);
                    });
                }
        );
    });

    it('should click submit', function(done) {
        browser.waitForElementByXPath(
                '//input[@type="submit"]',
                timeout,
                function(err, el) {
                    expect(el).to.be.ok;
                    el.click(done);
                }
        );
    });

    it('should allow the scope(s)', function(done) {
        browser.waitForElementById(
                'allow',
                timeout,
                function(err, el) {
                    expect(el).to.be.ok;
                    el.click(done);
                }
        );
    });

    it('should switch from popup', function(done) {
        browser.windowHandles(function(err, handles) {
            expect(handles[0]).to.be.ok;
            browser.window(handles[0], done);
        });
    });

    it('should receive token', function(done) {
        browser.waitForElementById(
                'token',
                new wd.Asserter(function(el, cb) {
                    el.text(function(err, text) {
                        return cb(err, text.length > 0);
                    });
                }),
                timeout,
                done
        );
    });

    it('should close popup', function(done) {
        browser.windowHandles(function(err, handles) {
            expect(handles).to.have.length(1);
            done();
        });
    });
});
