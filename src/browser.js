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

// TODO: URIjs is:ta big, find smaller alternative
var URI = require('urijs')
var objectAssign = require('object-assign')
var core = require('./core.js')

var browser = {}

browser.init = core.init

function popUpRedirect (authFun, opts) {
  return function (domain, options, callback) {
    var params = objectAssign({ display: 'popup' }, opts, options)

    // TODO: Do this differently
    window._oadaIdClientPopUpFunction = core.handleRedirect

    authFun(
      domain,
      params,
      function redirect (err, uri) {
        if (err) {
          console.log('Failed to do learn auth endpoint for domain ', domain);
          // Finish the flow 
          core.handleRedirect({ error: 'Failed to learn auth endpoint' });
          return null;
        } // TODO: Do something with err?
        var win = window.open(
          uri,
          '_blank',
          'width=500,height=400,status,resizable,scrollbars=yes'
        )
      },
      callback
    )
  }
}

browser.getIDToken = popUpRedirect(core.getIDToken, {})

browser.getAccessToken = popUpRedirect(core.getAccessToken, {})

browser.handleRedirect = function () {
  var uri = new URI(window.location)
  var params = uri.query(uri.fragment()).query(true)

  window.opener._oadaIdClientPopUpFunction(params)
  window.close()
}

module.exports = browser
