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

/**
 * Express middlewares for @oada/id-client
 *
 * @packageDocumentation
 */

import type express from 'express';

import {
  Options,
  getAccessToken as coreGetAccessToken,
  getIDToken as coreGetIDToken,
  handleRedirect as coreHandleRedirect,
} from './core.js';

// Add our stuff to the request interface?
import type { IncomingMessage } from 'http';
import type { ParsedQs } from 'qs';
export type Token = Resolves<ReturnType<typeof coreHandleRedirect>>;
declare module 'express-serve-static-core' {
  export interface Request<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    P = ParamsDictionary,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, unicorn/prevent-abbreviations, @typescript-eslint/no-explicit-any
    ResBody = any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, unicorn/prevent-abbreviations, @typescript-eslint/no-explicit-any
    ReqBody = any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, unicorn/prevent-abbreviations
    ReqQuery = ParsedQs,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    Locals extends Record<string, any> = Record<string, any>
  > extends IncomingMessage {
    token?: Token;
  }
}

type Resolves<T> = T extends Promise<infer V> ? V : T;

function middlewareify(
  method: typeof coreGetAccessToken | typeof coreGetIDToken
) {
  return ({
      domain,
      options,
    }: {
      domain?: string;
      options: Options;
    }): express.RequestHandler =>
    async (request, response) => {
      await method(
        request.param('domain') ?? domain,
        { ...options, scope: request.param('scope') ?? options.scope },
        (uri) => {
          response.redirect(uri);
        }
      );
    };
}

/**
 * Create a middleware for handling an ID token endpoint
 * @param domain
 * @param options
 * @returns Express middleware
 */
export const getIDToken = middlewareify(coreGetIDToken);

/**
 * Create a middleware for handling an access token endpoint
 * @param domain
 * @param options
 * @returns Express middleware
 */
export const getAccessToken = middlewareify(coreGetAccessToken);

/**
 * Middleware for handling redirects after OAuth flow
 */
export const handleRedirect: express.RequestHandler = async (request) => {
  const token = await coreHandleRedirect(request.query);
  if (token) {
    request.token = token;
  }
};
