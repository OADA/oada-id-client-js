'use strict';

var wd = require('wd');
require('colors');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

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
    timeout: 60000,
    retryDelay: 15000,
    retries: 5
});

var desired = JSON.parse(process.env.DESIRED || '{browserName: "chrome"}');
desired.handle = 'test in ' + desired.browserName;
desired.tags = ['oada'];

// Make it work on TravisCI
if (process.env.TRAVIS_JOB_NUMBER) {
    desired['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
}

describe('get access token (' + desired.browserName + ')', function() {
    var browser;
    var allPassed = true;

    before(function(done) {
        var username = process.env.SAUCE_USERNAME;
        var accessKey = process.env.SAUCE_ACCESS_KEY;
        browser = wd.promiseChainRemote('ondemand.saucelabs.com', 80,
            username, accessKey);
        if (process.env.VERBOSE) {
            // optional logging
            browser.on('status', function(info) {
                console.log(info.cyan);
            });
            browser.on('command', function(meth, path, data) {
                console.log(' > ' + meth.yellow, path.grey, data || '');
            });
        }
        browser
            .init(desired)
            .nodeify(done);
    });

    afterEach(function(done) {
        allPassed = allPassed && (this.currentTest.state === 'passed');
        done();
    });

    after(function(done) {
        browser
            .quit()
            .sauceJobStatus(allPassed)
            .nodeify(done);
    });

    it('should load test page', function(done) {
        browser
            .get('http://localhost:3000/')
                .then(
                    function() { browser.nodeify(done); },
                    function(err) { done(err); }
                );
    });

    it('should try to get access token', function(done) {
        browser
            .elementByXPath('//body/button[2]')
                .click()
            .nodeify(done);
    });

    it('should open popup', function(done) {
        browser
            .windowHandles()
                .should.eventually.have.length(2)
            .nodeify(done);
    });

    it('should switch to popup', function(done) {
        browser
            .windowHandles().then(function(windowHandles) {
                browser
                    .window(windowHandles[1])
                    .windowHandle()
                        .should.become(windowHandles[1])
                    .nodeify(done);
            });
    });

    it('should load login page', function(done) {
        browser
            .waitForElementByName('username')
            .waitForElementByName('password')
            .waitForElementByXPath('//input[@type="submit"]')
            .nodeify(done);
    });

    it('should login', function(done) {
        browser
            .elementByName('username')
                .type('frank')
                .getValue().should.become('frank')
            .elementByName('password')
                .type('pass')
                .getValue().should.become('pass')
            .elementByXPath('//input[@type="submit"]')
                .click()
            .nodeify(done);
    });

    it('should allow the scope(s)', function(done) {
        browser
            .waitForElementById('allow').click()
            .nodeify(done);
    });

    it('should switch from popup', function(done) {
        browser
            .windowHandles().then(function(windowHandles) {
                browser
                    .window(windowHandles[0])
                    .windowHandle()
                        .should.become(windowHandles[0])
                    .nodeify(done);
            });
    });

    it('should receive token', function(done) {
        browser
            .waitForElementById('token').text()
                .should.eventually.not.equal('')
            .nodeify(done);
    });

    it('should close popup', function(done) {
        browser
            .windowHandles()
                .should.eventually.have.length(1)
            .nodeify(done);
    });
});
