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

import EventEmitter, { once } from 'events';

import { RSA_JWK, jwk2pem } from 'pem-jwk';
import request from 'superagent';
// FIXME: URIjs is big, find smaller alternative
import URI from 'urijs';
import crypto from 'crypto';
import { verify } from 'jsonwebtoken';

import type Metadata from '@oada/types/oauth-dyn-reg/metadata.js';
import type OADAConfiguration from '@oada/types/oada/oada-configuration/v1.js';
import type RegistrationData from '@oada/types/oauth-dyn-reg/response.js';
import { generate } from 'jwt-bearer-client-auth';
import { jwksUtils as jwku } from '@oada/certs';

// FIXME: This nonsense is so the tests can use rewire to stub it...
// eslint-disable-next-line @typescript-eslint/no-require-imports
import dynReg = require('oauth-dyn-reg');
// eslint-disable-next-line prefer-const
let { default: register } = dynReg;

export interface QueryParameters {
  id_token?:
    | string
    | {
        iss: string;
        sub: string;
        aud: string;
      };
  code?: string;
  state?: string;
  redirect_uri?: string;
  nonce?: string;
}

export interface Options {
  metadata: Metadata | string;
  scope?: string | readonly string[];
  params?: QueryParameters;
  privateKey?: jwku.JWK;
  redirect?: string;
  display?: string;
}

/**
 * @todo merge this into `@oada/types`
 */
export interface Configuration extends OADAConfiguration {
  jwks_uri: string;
  issuer: string;
}

export interface State {
  key?: jwku.JWK;
  domain: string;
  conf: Configuration;
  options: RegistrationData;
  query: QueryParameters;
}

/**
 * A callback for redirecting the user for the OAuth flow(s)
 */
export type Redirect = (uri: string) => void | PromiseLike<void>;

const stuff: Map<string, State> = new Map();

async function storeState(stateObject: State) {
  // Make sure neither or both state storing functions are overridden
  if (state.retrieveState !== retrieveState) {
    throw new Error('Overrode retrieveState but not storeState!');
  }

  // Cryptographically secure random bytes
  const stateTok = crypto
    .randomBytes(16)
    // Make it base64URL
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Remember stuff
  stuff.set(stateTok, stateObject);

  return stateTok;
}

async function retrieveState(stateTok: string) {
  // Make sure neither or both state storing functions are overridden
  if (state.storeState !== storeState) {
    throw new Error('Overrode storeState but not retrieveState!');
  }

  // Retrieve stored state
  const stateObject = stuff.get(stateTok);
  // Only use each state once
  stuff.delete(stateTok);
  return stateObject;
}

// These can be replaced with to change how state is stored
// ???: Should these be exposed somehow for browser and/or middleware?
export const state = {
  storeState,
  retrieveState,
};

const emitter = new EventEmitter();

function isArray(value: unknown): value is unknown[] | readonly unknown[] {
  return Array.isArray(value);
}

async function authorize(
  domain: string,
  configuration: string,
  options: Options,
  redirectCB: Redirect
) {
  // Get stuff from options object
  const { privateKey: key, metadata, params, scope, redirect } = options;
  const query = {
    ...params,
    // Deepcode ignore ArrayMethodOnNonArray: It really is an array
    scope: isArray(scope) ? scope.join(' ') : scope,
  };
  // Assume key is PEM encoded
  if (key) {
    key.kty = key.kty ?? 'PEM';
  }

  const configRequest = request.get(new URL(configuration, domain).toString());
  if (configRequest.buffer) {
    void configRequest.buffer();
  }

  const configResp = await configRequest;
  if (configResp.error) {
    throw configResp.error;
  }

  const config = JSON.parse(configResp.text) as Configuration;

  const registration = await register(metadata, config.registration_endpoint);

  // Is this a good way to pick?
  query.redirect_uri = redirect ?? registration.redirect_uris?.[0];

  // Stuff to remember for when redirect is received
  const stateTok = await state.storeState({
    key,
    domain,
    conf: config,
    options: registration,
    query,
  });

  // Construct authorization redirect
  const uri = new URI(config.authorization_endpoint)
    .addQuery({ state: stateTok })
    .addQuery(query)
    .addQuery({ client_id: registration.client_id })
    // Do not send client_secret here
    .removeQuery('client_secret');

  const response = once(emitter, stateTok) as Promise<[QueryParameters]>;
  // Redirect the user to constructed uri
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  await redirectCB(uri.toString());

  const [tok] = await response;
  return tok;
}

export async function getIDToken(
  domain: string,
  options: Options,
  redirect: Redirect
) {
  const configuration = '/.well-known/openid-configuration';
  // @ts-expect-error browser magics
  const response = process.browser ? 'id_token' : 'code';
  // Make sure we have openid scope
  const parameters = {
    scope: 'openid',
    ...options,
    params: { response_type: response, ...options.params },
  };

  // Add nonce
  parameters.params.nonce = crypto
    .randomBytes(12)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const tok = await authorize(domain, configuration, parameters, redirect);

  // Return only id_token
  return tok?.id_token;
}

export async function getAccessToken(
  domain: string,
  options: Options,
  redirect: Redirect
) {
  const configuration = '/.well-known/oada-configuration';
  // @ts-expect-error browser magics
  const response = process.browser ? 'token' : 'code';
  const parameters = {
    ...options,
    params: { response_type: response, ...options.params },
  };

  return authorize(domain, configuration, parameters, redirect);
}

// TODO: Check issuer
async function verifyIDToken(tokenState: State, query: QueryParameters) {
  // This makes it work in IE...
  const parameters = { ...query };
  if (!parameters?.id_token) {
    // IDK what this is about...
    return parameters;
  }

  const jwk = (await jwku.jwkForSignature(
    parameters.id_token as string,
    tokenState.conf.jwks_uri
  )) as jwku.JWK & RSA_JWK;
  const key = jwk2pem(jwk);

  const token = verify(parameters.id_token as string, key, {
    audience: tokenState.options.client_id,
    issuer: tokenState.conf.issuer,
  });
  // Check nonce
  if (typeof token !== 'object' || tokenState.query.nonce !== token.nonce) {
    throw new Error('Nonce did not match');
  }

  return { ...parameters, id_token: token };
}

async function exchangeCode(codeState: State, query: QueryParameters) {
  if (!query.code) {
    return verifyIDToken(codeState, query);
  }

  if (!codeState.key) {
    throw new Error('No key provided, cannot perform code exchange');
  }

  const assertion = await generate({
    key: codeState.key,
    issuer: codeState.options.client_id,
    clientId: codeState.options.client_id,
    tokenEndpoint: codeState.conf.token_endpoint,
    expiresIn: 60,
    payload: { jti: query.code },
  });

  const resp = await request
    .post(codeState.conf.token_endpoint)
    .type('form')
    .send({
      grant_type: 'authorization_code',
      redirect_uri: codeState.query.redirect_uri,
      client_assertion: assertion,
      client_assertion_type:
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_id: codeState.options.client_id,
      code: query.code,
    });
  if (resp.error) {
    throw resp.error;
  }

  const token: unknown = JSON.parse(resp.text);

  return verifyIDToken(codeState, token as QueryParameters);
}

export async function handleRedirect(query: QueryParameters) {
  const { state: stateTok, ...parameters } = { ...query };
  if (!stateTok) {
    throw new Error('Spurious redirect');
  }

  const stateObject = await state.retrieveState(stateTok);
  if (!stateObject) {
    throw new Error('Spurious redirect');
  }

  const token = await exchangeCode(stateObject, parameters);
  emitter.emit(stateTok, token);
  return token;
}

export { type default as Metadata } from '@oada/types/oauth-dyn-reg/metadata.js';
