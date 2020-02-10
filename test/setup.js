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

'use strict'

var express = require('express')
var cors = require('cors')
var bodyParser = require('body-parser')
var https = require('https')
var fs = require('fs')
var URI = require('urijs')
var jwt = require('jsonwebtoken')

var configuration = require('./configuration.json')
var token = require('./token.json')
var idToken = require('./id_token.json')

var app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/.well-known/*', function (req, res) {
  res.status(200).json(configuration)
})

app.post(URI(configuration['token_endpoint']).path(), function (req, res) {
  if (
    req.body['grant_type'] === 'authorization_code' &&
    req.body['redirect_uri'] &&
    req.body['client_id']
  ) {
    switch (req.body.code) {
      case 'token':
        res.json(token)
        break

      case 'id_token':
        idToken.nonce = req.body.nonce
        res.json({
          id_token: jwt.sign(idToken, '', { algorithm: 'none' })
        })
        break
    }
  }
})

var options = {
  key: fs.readFileSync('./test/server.key', 'utf8'),
  cert: fs.readFileSync('./test/server.crt', 'utf8'),
  ca: fs.readFileSync('./test/ca.crt', 'utf8'),
  requestCrt: true,
  rejectUnauthorized: false
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
https.createServer(options, app).listen(3000)
