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

var request = require('superagent');
// TODO: URIjs is big, find smaller alternative
var URI = require('URIjs');
var objectAssign = require('object-assign');
var jwt = require('jsonwebtoken');
var jwku = require('jwks-utils');
var pem = require('rsa-pem-from-mod-exp');
var crypto = require('crypto');
var clientSecret = require('oada-client-secret');

var core = {};

var options = {};
var stuff = {};

core.init = function(opts) {
    objectAssign(options, opts);
};

function storeState(stateObj, callback) {
    // Make sure neither or both state storing functions are overridden
    if (core.retrieveState !== retrieveState) {
        return callback(
            new Error('Overrode retrieveState but not storeState!'));
    }

    // Cryptographically secure random bytes
    var stateTok = crypto.randomBytes(16);

    // Make it base64URL
    stateTok = stateTok.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    // Rembmer stuff
    stuff[stateTok] = stateObj;

    return callback(null, stateTok);
}

function retrieveState(stateTok, callback) {
    // Make sure neither or both state storing functions are overridden
    if (core.storeState !== storeState) {
        return callback(
            new Error('Overrode storeState but not retrieveState!'));
    }

    // Retrie stored state
    var stateObj = stuff[stateTok];

    // Only use each state once
    delete stuff[stateTok];

    return callback(null, stateObj);
}

// These can be replaced with to change how state is stored
// TODO: Should these be exposed somehow for browser and/or middleware?
core.storeState = storeState;
core.retrieveState = retrieveState;

function authorize(domain, configuration, parameters, redirect, callback) {
    var params = objectAssign({}, options, parameters);
    var key = params.privateKey;

    // Assume key is PEM ecnoded
    if (key) { key.kty = key.kty || 'PEM'; }
    delete params.privateKey;

    // Should I be passing the error to both?
    var errCallback = combineCallbacks(redirect, callback);

    var req =
        request.get('https://' + domain + '/.well-known/' + configuration);
    if (req.buffer) { req.buffer(); }
    req.end(function(err, resp) {
        var e = err || resp.error;
        if (e) { return errCallback(e); }

        try {
            var conf = JSON.parse(resp.text);
            // Stuff to remember for when redirect is received
            var stateObj = {
                key: key,
                domain: domain,
                conf: conf,
                callback: callback,
                options: params,
            };

            core.storeState(stateObj, function(err, stateTok) {
                // Construct authorization redirect
                var uri = new URI(conf['authorization_endpoint']);
                uri.addQuery({state: stateTok}).addQuery(params);
                // Do not send client_secret here
                uri.removeQuery('client_secret');

                // Redirect the user to constructed uri
                return redirect(err, uri && uri.toString());
            });
        } catch (err) {
            return errCallback(err);
        }
    });
}

core.getIDToken = function getIDToken(domain, opts, redirect, cb) {
    var configuration = 'openid-configuration';
    var params = objectAssign({scope: ''}, opts);

    // Make sure we have openid scope
    if (params.scope.split(' ').indexOf('openid') === -1) {
        params.scope += ' openid';
    }

    // Add nonce
    params.nonce = crypto.randomBytes(12)
        .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

    authorize(domain, configuration, params, redirect, cb);
};

core.getAccessToken = function getAccessToken(domain, opts, redirect, cb) {
    var configuration = 'oada-configuration';
    var params = objectAssign({scope: ''}, opts);

    authorize(domain, configuration, params, redirect, cb);
};

function combineCallbacks() {
    var callbacks = arguments;

    return function callback(err, result) {
        for (var i = 0; i < callbacks.length; i++) {
            if (typeof callbacks[i] === 'function') {
                callbacks[i](err, result);
            }
        }
    };
}

// TODO: Check issuer
function verifyIDToken(state, params, callback) {
    if (!params || !params['id_token']) {
        return callback(null, params);
    }

    // This makes it work in IE
    var parameters = objectAssign({}, params);

    var req = request.get(state.conf['jwks_uri']);
    if (req.buffer) { req.buffer(); }
    req.end(function(err, resp) {
        var e = err || resp.error;
        if (e) { return callback(e, parameters); }

        try {
            var jwks;
            try {
                jwks = JSON.parse(resp.text);
                if (!jwku.isJWKset(jwks)) { throw new Error(); }
            } catch (err) {
                // Give a better error than what JSON.parse throws
                throw new Error('Could not parse JWKs URI');
            }

            var jwk = jwku.jwkForSignature(parameters['id_token'], jwks);
            if (!jwk) {
                throw new Error('Provided JWKs did not contain ' +
                        'the JWK for this JWS');
            }
            var key = pem(jwk.n, jwk.e);

            jwt.verify(parameters['id_token'], key, function(err, token) {
                if (!err) {
                    // Check nonce
                    if (state.options.nonce === token.nonce) {
                        parameters['id_token'] = token;
                    } else {
                        err = new Error('Nonces did not match');
                    }
                }

                return callback(err, parameters);
            });
        } catch (err) {
            return callback(err, parameters);
        }
    });
}

function exchangeCode(state, parameters, callback) {
    if (!parameters['code']) {
        return verifyIDToken(state, parameters, callback);
    }

    // Use the provided client_secret, else generate one as per OADA
    var secret = state.options['client_secret'] ||
        clientSecret.generate(
            state.key,
            state.options['client_id'],
            state.conf['token_endpoint'],
            parameters.code);

    var params = {
        'grant_type': 'authorization_code',
        'redirect_uri': state.options['redirect_uri'],
        'client_secret': secret,
        'client_id': state.options['client_id'],
        'code': parameters.code,
    };

    request.post(state.conf['token_endpoint'])
        .type('form')
        .send(params)
        .end(function(err, resp) {
            var e = err || resp.error;
            if (e) { return callback(e); }

            var token;
            try {
                token = JSON.parse(resp.text);
            } catch (err) {
                return callback(err);
            }

            verifyIDToken(state, token, callback);
        });
}

// TODO: Should I be able to register callbacks in two places?
core.handleRedirect = function handleRedirect(parameters, callback) {
    var stateTok = parameters.state;

    core.retrieveState(stateTok, function(err, stateObj) {
        var cb = combineCallbacks(stateObj && stateObj.callback, callback);

        if (stateObj) {
            exchangeCode(stateObj, parameters, cb);
        } else {
            cb('Spurrious redirect received', parameters);
        }
    });
};

module.exports = core;
