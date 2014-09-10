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

function exchangeCode(state, parameters, callback) {
    var params = {
                'grant_type': 'authorization_code',
                'redirect_uri': state.options['redirect_uri'],
                'client_secret': state.options['client_secret'],
                'client_id': state.options['client_id'],
                code: parameters.code,
            };

    console.log(parameters);

    request.post(state.conf['token_endpoint']).type('form').send(params)
        .end(function(err, resp) {
            var token;

            if (!err) {
                try {
                    token = JSON.parse(resp.text);
                } catch (err) {}
            }

            console.log(token);

            if (state.callback) { state.callback(err, token); }
            if (callback) { callback(err, token); }
        });
}

// TODO: Should I be able to register callbacks in two places?
core.handleRedirect = function handleRedirect(parameters, callback) {
    // TODO: Keep this stuff somewhere better
    var state = stuff[parameters.state];
    delete stuff[parameters.state];

    if (state) {
        if (parameters.code) {
            exchangeCode(state, parameters, callback);
        } else {
            if (state.callback) { state.callback(null, parameters); }
            if (callback) { callback(null, parameters); }
        }
    } else {
        var err = 'Spurrious redirect received';

        if (callback) { callback(err, parameters); }
    }
};

module.exports = core;
