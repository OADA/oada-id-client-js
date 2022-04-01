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

const metadata = (uri: string) =>
  ({
    client_id: 'RUSTY_SCHAKLEFORD',
    clinet_secret: 'SSSH',
    foo: 'bar',
    redirect_uris: [`${uri}/redirect1`, `${uri}/redirect2`],
  } as const);
export default metadata;
