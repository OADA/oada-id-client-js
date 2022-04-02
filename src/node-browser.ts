/**
 * @license
 * Copyright 2022 Open Ag Data Alliance
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

/* eslint-disable @typescript-eslint/naming-convention */

import { URL } from 'url';
import fs from 'fs';
import http from 'http';
import { once } from 'events';
import path from 'path';

import open, { App } from 'open';
import isWsl from 'is-wsl';

import { jwksUtils, sign } from '@oada/certs';

import {
  Metadata,
  Options,
  getAccessToken as coreGetAccessToken,
  handleRedirect,
  getIDToken as coreGetIDToken,
} from './core.js';

// TODO: Probably remove this once I am sure things work
function getPrivateKey() {
  const pem = fs
    // eslint-disable-next-line unicorn/prefer-module
    .readFileSync(path.join(__dirname, '..', 'test', 'server.key'))
    .toString();
  return { kty: 'PEM', pem } as const;
}

async function genMetadata<M extends Partial<Metadata>>(
  privateKey: string | jwksUtils.JWK,
  {
    client_name = '@oada/id-client',
    contacts = ['@oada/id-client'],
    ...rest
  }: M = {} as M
) {
  const metadata = {
    token_endpoint_auth_method:
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    grant_types: ['code'] as [string],
    response_types: ['token', 'id_token', 'id_token token'] as [
      string,
      ...string[]
    ],
    ...rest,
    client_name,
    contacts,
  };
  const jwt = await sign(metadata, privateKey);
  return {
    ...metadata,
    software_statement: jwt,
  };
}

/**
 * Opens the default browser to run the OAuth flow to get a token from node
 *
 * @todo Have the local server create https certs
 */
function nodeify(method: typeof coreGetAccessToken | typeof coreGetIDToken) {
  return async (
    domain: string,
    {
      port = 0,
      metadata,
      privateKey = getPrivateKey(),
      ...options
    }: Partial<Options & { port: number }> = {}
  ) => {
    // eslint-disable-next-line no-secrets/no-secrets
    // Deepcode ignore NoRateLimitingForExpensiveWebOperation: Server is internal only
    const server = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url!);
        const query = Object.fromEntries(url.searchParams.entries());
        await handleRedirect(query);
      } catch (error: unknown) {
        response.statusCode = 400;
        throw error;
      } finally {
        // TODO: Make page close now
        response.end();
      }
    });
    const closed = once(server, 'close');

    try {
      const listening = once(server, 'listening');
      server.listen(port);
      await listening;
      const address = server.address();
      if (!address) {
        throw new Error('Server address is undefined');
      }

      // Find base URI of our server
      const uri =
        typeof address === 'string'
          ? address
          : `http://localhost:${address.port}`;

      const redirect = new URL('/redirect', uri).toString();
      const meta =
        metadata ??
        (await genMetadata(privateKey, {
          redirect_uris: [redirect],
        }));
      return await method(
        domain,
        {
          ...options,
          privateKey,
          metadata: meta,
          redirect,
        },
        async (redirect) => {
          await open(redirect, {
            // @ts-expect-error This is a secrept parameter
            url: true,
            // Hack to make open work in WSL
            app: isWsl ? ('wslview' as unknown as App) : undefined,
          });
        }
      );
    } finally {
      // Ensure server is always closed
      server.close();
      await closed;
    }
  };
}

export const getAccessToken = nodeify(coreGetAccessToken);

export const getIDToken = nodeify(coreGetIDToken);
