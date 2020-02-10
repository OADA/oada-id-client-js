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
'use strict'

var fs = require('fs')
var express = require('express')
var app = express()
var login = require('../../').middleware

var pem = fs.readFileSync(__dirname + '/privkey.pem')
var kid = '1234'
var key = { pem: pem, kid: kid }

var options = {
  metadata:
    'eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsI' +
    'mtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIi' +
    'wiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly9sb2Nh' +
    'bGhvc3Q6MzAwNy9yZWRpcmVjdCJdLCJ0b2tlbl9lbmRwb2ludF9hdXRoX21ld' +
    'GhvZCI6InVybjppZXRmOnBhcmFtczpvYXV0aDpjbGllbnQtYXNzZXJ0aW9uLX' +
    'R5cGU6and0LWJlYXJlciIsImdyYW50X3R5cGVzIjpbImltcGxpY2l0Il0sInJ' +
    'lc3BvbnNlX3R5cGVzIjpbInRva2VuIiwiaWRfdG9rZW4iLCJpZF90b2tlbiB0' +
    'b2tlbiJdLCJjbGllbnRfbmFtZSI6Ik9BREEgSUQgRXhhbXBsZSBCcm93c2VyI' +
    'ENsaWVudCIsImNsaWVudF91cmkiOiJodHRwOi8vbG9jYWxob3N0OjMwMDciLC' +
    'Jjb250YWN0cyI6WyJJbmZvIDxpbmZvQG9wZW5hZy5pbz4iXSwicG9saWN5X3V' +
    'yaSI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwNy9wdWMuaHRtbCIsInRvc191cmki' +
    'OiJodHRwOi8vbG9jYWxob3N0OjMwMDcvcHVjLmh0bWwiLCJsaWNlbnNlcyI6W' +
    '3siaWQiOiJvYWRhLTEuMCIsIm5hbWUiOiJPQURBIEV4YW1wbGUgdjEuMCJ9LH' +
    'siaWQiOiJvYWRhLTIuMCIsIm5hbWUiOiJPQURBIEV4YW1wbGUgdjIuMCJ9XSw' +
    'iandrc191cmkiOiJodHRwOi8vbG9jYWxob3N0OjMwMDcvY2VydHMiLCJzb2Z0' +
    'd2FyZV9pZCI6ImQxY2Y0NjliLTg4MTAtNDYyNC1iMGY1LWM4ZTRjYWVlMWM5Z' +
    'SIsInJlZ2lzdHJhdGlvbl9wcm9pdmRlciI6Imh0dHBzOi8vaWRlbnRpdHkub2' +
    'FkYS1kZXYuY29tIiwiaWF0IjoxNDU3OTc0MjYzfQ.AGSRLggTeubCJGwBirmi' +
    'etxWTShB2CDTy9eQZFM5rNB6sKidfqkMyyJd7JlaWSiHagTP4Sacb-8J1CkjD' +
    '2Fd-mKB0CJ-QARWq_hlZDrJmjHN1q6JQv7XUZcKxr926vWliWvmGVijGUKzUW' +
    '9pQZGWW5i7y3xcgZf5Lm3fNSNks7I',
  scope: 'bookmarks.machines.harvesters',
  params: {
    prompt: 'consent'
  },
  privateKey: key
}

app.use('/who', login.getIDToken('identity.oada-dev.com', options))

app.use('/get', login.getAccessToken('identity.oada-dev.com', options))

app.use('/redirect', login.handleRedirect())
app.use('/redirect', function (req, res) {
  res.json(req.token)
})

if (require.main === module) {
  app.listen(3007)
}

module.exports = app
