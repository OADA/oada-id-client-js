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

// Add (minimal) JWK support to JWS

'use strict';

var jws = require('jws');
// TODO: Use a better module for this
var pem = require('rsa-pem-from-mod-exp');
var objectAssign = require('object-assign');

// Decide if an object is a JWK
function isJWK(object) {
    return !!object && !!object.kty;
}

var sign = jws.sign;
jws.sign = function(options) {
    var key = options && (options.privateKey || options.secret);

    if (isJWK(key)) {
        var secret;
        switch (key.kty) {
            case 'PEM':
                secret = key.pem;
                break;
            default:
                throw new TypeError('Unknown JWK Key Type');
        }

        options = objectAssign({header: {}}, options);
        // Override algorithm with value from JWK
        options.header.alg = key.alg || options.header.alg;
        // Add Key ID to JOSE header
        options.header.kid = key.kid;
        // Put it in both?
        options.privateKey = options.secret = secret;
    }

    return sign(options);
};

var verify = jws.verify;
jws.verify = function(signature, secretOrKey) {
    if (isJWK(secretOrKey)) {
        switch (secretOrKey.kty) {
            case 'PEM':
                secretOrKey = secretOrKey.pem;
                break;
            case 'RSA':
                secretOrKey = pem(secretOrKey.n, secretOrKey.e);
                break;
            default:
                throw new TypeError('Unknown JWK Key Type');
        }
    }

    return verify(signature, secretOrKey);
};

module.exports = jws;
