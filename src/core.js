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

var core = {};

var options = {};
var stuff = {};

core.init = function(opts) {
    objectAssign(options, opts);
};

function authorize(domain, configuration, parameters, redirect, callback) {
    var params = objectAssign({}, options, parameters);

    // TODO: HTTPS
    var req = request.get('http://' + domain + '/.well-known/' + configuration);
    if (req.buffer) { req.buffer(); }
    req.end(function(err, resp) {
        if (err) { return redirect(err); }

        var uri;
        try {
            var conf = JSON.parse(resp.text);

            var state = Math.random();
            stuff[state] = {
                conf: conf,
                callback: callback,
                options: params,
            };

            uri = new URI(conf['authorization_endpoint']);
            uri.addQuery({state: state}).addQuery(params);

            // Do not send client secret here
            uri.removeQuery('client_secret');
        } catch (err) {}

        return redirect(err, uri && uri.toString());
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

    return function callback(err, token) {
        for (var i = 0; i < callbacks.length; i++) {
            if (typeof callbacks[i] === 'function') {
                callbacks[i](err, token);
            }
        }
    };
}

function verifyIDToken(state, parameters, callback) {
    if (!parameters['id_token']) {
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

function exchangeCode(state, parameters, callback) {
    if (!parameters['code']) {
        return verifyIDToken(state, parameters, callback);
    }

    var params = {
        'grant_type': 'authorization_code',
        'redirect_uri': state.options['redirect_uri'],
        'client_secret': state.options['client_secret'],
        'client_id': state.options['client_id'],
        'code': parameters.code,
    };

    console.log(parameters);

    request.post(state.conf['token_endpoint'])
        .type('form')
        .send(params)
        .end(function(err, resp) {
            var token;

            if (!err) {
                try {
                    token = JSON.parse(resp.text);
                } catch (err) {
                    callback(err);
                }
            }

            console.log(token);

            verifyIDToken(state, token, callback);
        });
}

// TODO: Should I be able to register callbacks in two places?
core.handleRedirect = function handleRedirect(parameters, callback) {
    // TODO: Keep this stuff somewhere better
    var state = stuff[parameters.state];
    delete stuff[parameters.state];

    var cb = combineCallbacks(state && state.callback, callback);

    if (state) {
        exchangeCode(state, parameters, cb);
    } else {
        var err = 'Spurrious redirect received';

        cb(err, parameters);
    }
};

module.exports = core;
