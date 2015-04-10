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

var sinon = require('sinon');
var expect = require('chai').expect;
var URI = require('URIjs');

// TODO: Figure out something less gross with rewire
var core;
if (process.browser) {
    core = require('../src/core.js');
} else {
    var rewire = require('rewire');
    core = rewire('../src/core.js');
}

var metadata = require('./metadata.json');
var configuration = require('./configuration.json');

describe('core.js', function() {
    before(function stubRegister() {
        var registerStub = sinon.stub();

        registerStub.yields(null, metadata);
        // Not sure how I feel about this...
        core.__set__('register', registerStub);
    });

    ['getAccessToken', 'getIDToken'].forEach(function(method) {
        describe('#' + method, function() {
            it('should redirect to authorization endpoint', function(done) {
                core[method]('localhost:3000', {}, function redirect(err, loc) {
                    expect(err).to.be.not.ok;

                    var url = URI.parse(loc);
                    url.query = url.fragment = undefined;

                    expect(URI.build(url))
                        .to.equal(configuration['authorization_endpoint']);
                    done();
                }, null);
            });

            it('should use registration response client ID', function(done) {
                core[method]('localhost:3000', {}, function redirect(err, loc) {
                    expect(err).to.be.not.ok;

                    URI(loc).hasQuery('client_id', function(val) {
                        expect(val).to.equal(metadata['client_id']);
                        done();
                    });
                }, null);
            });

            it('should use registration response redirect URI', function(done) {
                core[method]('localhost:3000', {}, function redirect(err, loc) {
                    expect(err).to.be.not.ok;

                    URI(loc).hasQuery('redirect_uri', function(val) {
                        expect(metadata['redirect_uris']).to.contain(val);
                        done();
                    });
                }, null);
            });

            var extraScopes = method === 'getIDToken' ? ' + openid' : '';
            it('should send given scope(s)' + extraScopes, function(done) {
                var scopes = ['read', 'write', 'foo'];
                var options = {scope: scopes.join(' ')};

                core[method]('localhost:3000', options,
                    function redirect(err, loc) {
                        expect(err).to.be.not.ok;

                        URI(loc).hasQuery('scope', function(val) {
                            var vals = val.split(' ');

                            scopes.forEach(function(scope) {
                                expect(vals).to.include(scope);
                            });
                            done();
                        });
                    }, null);
            });
        });
    });
});
