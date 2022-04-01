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

import EventEmitter, { once } from 'events';
import { URL } from 'url';
import fs from 'fs';
import http from 'http';
import path from 'path';

import open, { App } from 'open';
import isWsl from 'is-wsl';

import * as core from './core.js';

/**
 * Opens a browser to get an access_token from node
 *
 * @todo Have the local server create https certs
 */
export default async function hostLogin(
  domain: string,
  // ???: What is this?
  options: Record<string, unknown>
) {
  const emitter = new EventEmitter();
  // eslint-disable-next-line no-secrets/no-secrets
  // Deepcode ignore NoRateLimitingForExpensiveWebOperation: Server is internal only
  const server = http.createServer((request, response) => {
    if (request.url?.includes('favicon')) {
      response.statusCode = 404;
      response.statusMessage = 'Not found';
      response.end();
      return;
    }

    if (request.url?.startsWith('/somefile')) {
      const urlObject = new URL(request.url);
      server.close();
      emitter.emit('token', {
        access_token: urlObject.searchParams.get('access_token'),
      });
      return;
    }

    const f = request.url?.split('?')[0] ?? '';
    // eslint-disable-next-line unicorn/prefer-module
    const file = path.join(__dirname, 'public', f);
    response.writeHead(200, {
      'Content-Length': fs.statSync(file).size,
    });
    const readStream = fs.createReadStream(file);
    readStream.pipe(response);
  });

  const closed = once(server, 'close');
  let serverUri: string;
  try {
    const token = once(emitter, 'token') as Promise<[{ access_token: string }]>;

    const listening = once(server, 'listening');
    server.listen();
    await listening;
    const address = server.address();
    if (!address) {
      throw new Error('Server address is undefined');
    }

    serverUri =
      typeof address === 'string'
        ? address
        : `http://localhost:${address.port}`;
    await open(
      `${serverUri}/index.html?domain=${JSON.stringify(
        domain
      )}&options=${JSON.stringify(options)}`,
      {
        // @ts-expect-error This is a secrept parameter
        url: true,
        // Hack to make open work in WSL
        app: isWsl ? ('wslview' as unknown as App) : undefined,
      }
    );

    const [accessToken] = await token;
    return accessToken;
  } finally {
    // Ensure server is always closed
    server.close();
    await closed;
  }
}
