/**
 * @license
 * Copyright 2014-2022 Open Ag Data Alliance
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
import fs = require('fs');
import { once } from 'events';

import URI from 'urijs';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import https from 'https';
import jwt from 'jsonwebtoken';

import config from './configuration';
import idToken from './id_token';
import token from './token.json';

// Deepcode ignore InsecureTLSConnection/test: This is a test server
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const configuration = config('https://localhost');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/.well-known/*', async (_, response) => {
  response.status(200).json(config(await uri));
});

app.post(
  new URI(configuration.token_endpoint).path(),
  async (request, response) => {
    if (
      request.body.grant_type === 'authorization_code' &&
      request.body.redirect_uri &&
      request.body.client_id
    ) {
      switch (request.body.code) {
        case 'token':
          response.json(token);
          break;

        case 'id_token': {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          const id_token = {
            ...idToken(await uri),
            nonce: request.body.nonce as string,
          };
          response.json({
            // Deepcode ignore HardcodedSecret/test: This is a test file
            id_token: jwt.sign(id_token, '', { algorithm: 'none' }),
          });
          break;
        }

        default:
          response.status(400).send();
      }
    }
  }
);

const options = {
  // eslint-disable-next-line unicorn/prefer-module, prefer-template, security/detect-non-literal-fs-filename
  key: fs.readFileSync(__dirname + '/server.key', 'utf8'),
  // eslint-disable-next-line unicorn/prefer-module, prefer-template, security/detect-non-literal-fs-filename
  cert: fs.readFileSync(__dirname + '/server.crt', 'utf8'),
  // eslint-disable-next-line unicorn/prefer-module, prefer-template, security/detect-non-literal-fs-filename
  ca: fs.readFileSync(__dirname + '/ca.crt', 'utf8'),
  requestCrt: true,
  rejectUnauthorized: false,
};

const server = https.createServer(options, app).listen();
// eslint-disable-next-line github/no-then
const uri = once(server, 'listening').then(() => {
  const address = server.address();
  if (!address) {
    throw new Error('No address');
  }

  return typeof address === 'string'
    ? address
    : `https://localhost:${address.port}`;
});
export default uri;
