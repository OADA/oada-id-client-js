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

var jws = require('jws');
var jsrsasign = require('jsrsasign');
var jsjws = jsrsasign.jws;
// Fix it?
jsjws.JWS.prototype.isSafeJSONString = jsjws.JWS.isSafeJSONString;

jws.sign = function() {
    throw new Error('JWS signing not supported in browser');
};

jws.verify = function(signature, secretOrKey) {
    console.dir(secretOrKey);
    switch (secretOrKey && secretOrKey.kty) {
        case 'PEM':
            return (new jsjws.JWS()).verifyJWSByKey(signature, secretOrKey);
        case 'RSA':
            var hN = jsrsasign.b64utohex(secretOrKey.n);
            var hE = jsrsasign.b64utohex(secretOrKey.e);
            return (new jsjws.JWS()).verifyJWSByNE(signature, hN, hE);
        default:
            throw new TypeError('Unknown JWK Key Type');
    }
};

module.exports = jws;
