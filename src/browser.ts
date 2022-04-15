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

// FIXME: URIjs is:ta big, find smaller alternative
import URI from 'urijs';

import {
  Options,
  getAccessToken as coreGetAccessToken,
  getIDToken as coreGetIDToken,
  handleRedirect as redirect,
} from './core';

function popUpRedirect(
  method: typeof coreGetAccessToken | typeof coreGetIDToken
) {
  return async function (domain: string, options: Options) {
    // FIXME: Do this differently
    // @ts-expect-error stuff
    window._oadaIdClientPopUpFunction = redirect;
    return method(domain, { display: 'popup', ...options }, (uri) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      window.open(
        uri,
        '_blank',
        'width=500,height=400,status,resizable,scrollbars=yes'
      );
    });
  };
}

export const getIDToken = popUpRedirect(coreGetIDToken);

export const getAccessToken = popUpRedirect(coreGetAccessToken);

export function handleRedirect() {
  const uri = new URI(window.location);
  const parameters = uri.query(uri.fragment()).query(true);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  window.opener._oadaIdClientPopUpFunction(parameters);
  window.close();
}
