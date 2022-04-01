/**
 * @license
 * Copyright 2014 Open Ag Data Alliance
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

/* eslint-env mocha */
/* eslint-disable unicorn/no-await-expression-member */

import fs from 'fs';

import URI from 'urijs';
import { expect } from 'chai';
import rewire from 'rewire';
import { stub } from 'sinon';

import jwt from 'jsonwebtoken';
import pemJWK from 'pem-jwk';

import type Metadata from '@oada/types/oada/oauth-dyn-reg/register-response/v1.js';
import { jwksUtils } from '@oada/certs';

import config from './configuration';
import idToken from './id_token';
import meta from './metadata';
import token from './token.json';

// eslint-disable-next-line import/no-namespace
import type * as dut from '../src/core';

import EventEmitter, { once } from 'events';
import uri from './setup';

// FIXME: Figure out something less gross with rewire
const core = rewire<typeof dut>('../src/core');

const privateKey = {
  kty: 'PEM',
  // eslint-disable-next-line unicorn/prefer-module, prefer-template, security/detect-non-literal-fs-filename
  pem: fs.readFileSync(__dirname + '/server.key').toString(),
} as const;

// eslint-disable-next-line github/no-then
const metadata = uri.then(meta);

stub(jwksUtils, 'jwkForSignature').resolves({ kty: 'test' });
stub(pemJWK, 'jwk2pem').returns('PEM');

const registerStub = stub();
registerStub.resolves(metadata);
// Not sure how I feel about this...
core.__set__('register', registerStub);

const options = {
  client_id: 'TEST',
  metadata: {} as unknown as Metadata,
  privateKey,
} as const;

// eslint-disable-next-line github/no-then
const configuration = uri.then(config);

for (const method of ['getAccessToken', 'getIDToken'] as const) {
  describe(`#${method}`, () => {
    it('should recdirect to authorization endpoint', async () => {
      const emitter = new EventEmitter();
      const redirected = once(emitter, 'redirect');
      const result = core[method](await uri, options, async (loc) => {
        try {
          const { query, fragment, ...url } = URI.parse(loc);

          expect(URI.build(url)).to.equal(
            (await configuration).authorization_endpoint
          );

          emitter.emit('redirect');
        } catch (cError: unknown) {
          emitter.emit('error', cError);
        }
      });
      await Promise.race([result, redirected]);
    });

    it('should use registration response client ID', async () => {
      const emitter = new EventEmitter();
      const redirected = once(emitter, 'redirect');
      const result = core[method](await uri, options, async (loc) => {
        try {
          const m = await metadata;
          new URI(loc).hasQuery('client_id', (value) => {
            expect(value).to.equal(m.client_id);
          });
          emitter.emit('redirect');
        } catch (cError: unknown) {
          emitter.emit('error', cError);
        }
      });
      await Promise.race([result, redirected]);
    });

    it('should use registration response redirect URI', async () => {
      const emitter = new EventEmitter();
      const redirected = once(emitter, 'redirect');
      const result = core[method](await uri, options, async (loc) => {
        try {
          const m = await metadata;
          new URI(loc).hasQuery('redirect_uri', (value) => {
            expect(m.redirect_uris).to.contain(value);
          });
          emitter.emit('redirect');
        } catch (cError: unknown) {
          emitter.emit('error', cError);
        }
      });
      await Promise.race([result, redirected]);
    });

    const extraScopes = method === 'getIDToken' ? ' + openid' : '';
    it(`should send given scope(s)${extraScopes}`, async () => {
      const scopes = ['read', 'write', 'foo'];
      const opt = { ...options, scope: scopes.join(' ') };
      const emitter = new EventEmitter();
      const redirected = once(emitter, 'redirect');
      const result = core[method](await uri, opt, (loc) => {
        try {
          new URI(loc).hasQuery('scope', (value: string) => {
            const values = value.split(' ');
            for (const scope of scopes) {
              expect(values).to.include(scope);
            }
          });
          emitter.emit('redirect');
        } catch (cError: unknown) {
          emitter.emit('error', cError);
        }
      });
      await Promise.race([result, redirected]);
    });

    // @ts-expect-error browser magics
    const flow = process.browser ? 'implicit' : 'code';
    const tokType = method === 'getIDToken' ? 'id_token' : 'token';
    const respType = flow === 'code' ? 'code' : tokType;
    it(`should use ${flow} flow`, async () => {
      const emitter = new EventEmitter();
      const redirected = once(emitter, 'redirect');
      const result = core[method](await uri, options, (loc) => {
        try {
          new URI(loc).hasQuery('response_type', (value) => {
            expect(value).to.equal(respType);
          });
          emitter.emit('redirect');
        } catch (cError: unknown) {
          emitter.emit('error', cError);
        }
      });
      await Promise.race([result, redirected]);
    });

    describe('#handleRedirect', () => {
      const code = { code: tokType };
      const returnValue = method === 'getIDToken' ? idToken : token;
      const resp =
        flow === 'code'
          ? code
          : method === 'getIDToken'
          ? // eslint-disable-next-line github/no-then
            uri.then((u) => ({ id_token: idToken(u) }))
          : token;

      let jwtVerify = stub(jwt, 'verify');
      jwtVerify.restore();
      beforeEach(() => {
        jwtVerify = stub(jwt, 'verify');
      });
      afterEach(() => {
        jwtVerify.restore();
      });

      it('should pass token to its callback', async () => {
        await core[method](await uri, options, async (loc) => {
          const locParameters = new URI(loc).query(true);

          const parameters = {
            state: locParameters.state as string,
            ...(await resp),
          };

          const t: unknown = JSON.parse(
            JSON.stringify({
              ...returnValue,
              nonce: locParameters.nonce as string,
            })
          );
          jwtVerify.returns(t as void);

          const tok = await core.handleRedirect(parameters);
          expect(tok).to.deep.equal(
            method === 'getIDToken' ? { id_token: t } : t
          );
        });
      });

      it('should pass token to original callback', async () => {
        let t: unknown;
        const tok = await core[method](await uri, options, async (loc) => {
          const locParameters = new URI(loc).query(true);

          const parameters = {
            key: { kty: 'TEST' },
            state: locParameters.state as string,
            ...(await resp),
          };

          t = JSON.parse(
            JSON.stringify({
              ...returnValue,
              nonce: locParameters.nonce as string,
            })
          );
          jwtVerify.returns(t as void);

          await core.handleRedirect(parameters);
        });
        expect(tok).to.deep.equal(t);
      });
    });
  });
}
