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

/*
 * Express server to test the server client part of the library
 */
'use strict';

var fs = require('fs');
var express = require('express');
var app = express();
var login = require('../../').middleware;

var pem = fs.readFileSync(__dirname + '/privkey.pem');
var kid = 'ad8alkjca38afvudsZA';
var key = {pem:pem, kid:kid};

var options = {
    //'client_id': 'jf93caauf3uzud7f308faesf3@identity.oada-dev.com',
    'redirect_uri': 'http://vip1.ecn.purdue.edu:3000/redirect',
    scope: 'bookmarks.machines.harvesters',
    prompt: 'consent',
    privateKey: key,
};

app.use('/who',
    login.getIDToken('identity.oada-dev.com', options));

app.use('/get',
    login.getAccessToken('identity.oada-dev.com', options));

app.use('/redirect', login.handleRedirect());
app.use('/redirect', function(req, res) {
    res.json(req.token);
});

if (require.main === module) {
    app.listen(3000);
}

module.exports = app;
