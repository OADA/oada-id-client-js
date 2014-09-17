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
var jws = require('jws');
var pem = require('rsa-pem-from-mod-exp');
var crypto = require('crypto');

var core = {};

var options = {};
var stuff = {};

core.init = function(opts) {
    objectAssign(options, opts);
};

function storeState(stateObj, callback) {
    // Make sure neither or both state storing functions are overridden
    if (core.retrieveState != retrieveState) {
        callback('Overrode retrieveState but not storeState!');
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
    if (core.storeState != storeState) {
        callback('Overrode storeState but not retrieveState!');
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

    delete params['client_secret'];
    delete params.privateKey;

    // TODO: HTTPS
    var req = request.get('http://' + domain + '/.well-known/' + configuration);
    if (req.buffer) { req.buffer(); }
    req.end(function(err, resp) {
        if (err) { return redirect(err); }

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

                // Redirect the user to constructed uri
                return redirect(err, uri && uri.toString());
            });
        } catch (err) {
            // Should I be passing the error to both?
            return combineCallbacks(redirect, callback)(err);
        }
    });
}

core.getIDToken = function getIDToken(domain, opts, redirect, cb) {
    var configuration = 'openid-configuration';
    var params = objectAssign({}, opts,
            {
                // TODO: Merge scopes instead of overwriting them???
                scope: 'openid profile',
            });

    authorize(domain, configuration, params, redirect, cb);
};

core.getAccessToken = function getAccessToken(domain, opts, redirect, cb) {
    var configuration = 'oada-configuration';

    authorize(domain, configuration, opts, redirect, cb);
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
function verifyIDToken(state, parameters, callback) {
    if (!parameters || !parameters['id_token']) {
        return callback(null, parameters);
    }

    var decodedToken = jws.decode(parameters['id_token']);

    var req = request.get(state.conf['jwks_uri']);
    if (req.buffer) { req.buffer(); }
    req.end(function(err, resp) {
        if (err) { return callback(err); }

        var jwks = JSON.parse(resp.text);
        var jwk;

        console.log('token'); console.dir(decodedToken);
        console.log('jwks'); console.dir(jwks);

        for (var i = 0; i < jwks.keys.length; i++) {
            if (jwks.keys[i].kid === decodedToken.header.kid) {
                jwk = jwks.keys[i];
                break;
            }
        }

        var pemKey = pem(jwk.n, jwk.e);

        jwt.verify(parameters['id_token'], pemKey, function(err, token) {
            parameters['id_token'] = token;

            callback(err, parameters);
        });
    });
}

function generateClientSecret(key, issuer, audience, accessCode) {
    var sec = {
        ac: accessCode,
    };
    var options = {
        algorithm: 'RS256',
        audience: audience,
        issuer: issuer,
        headers: {
            kid: key.kid,
        },
    };

    return jwt.sign(sec, key.pem, options);
}

function exchangeCode(state, parameters, callback) {
    if (!parameters['code']) {
        return verifyIDToken(state, parameters, callback);
    }

    var params = {
        'grant_type': 'authorization_code',
        'redirect_uri': state.options['redirect_uri'],
        'client_secret': generateClientSecret(
                state.key,
                state.options['client_id'],
                state.conf['token_endpoint'],
                parameters.code),
        'client_id': state.options['client_id'],
        'code': parameters.code,
    };

    console.log(params);

    request.post(state.conf['token_endpoint'])
        .type('form')
        .send(params)
        .end(function(err, resp) {
            if (err) { return callback(err); }

            if (!resp.ok) { return callback('Token request failed'); }

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
