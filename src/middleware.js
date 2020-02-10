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

var objectAssign = require('object-assign')
var core = require('./core')

var middleware = {}

// TODO: I am not sure having a callback is very middleware...
middleware.getIDToken = function (domain, options) {
  var params = objectAssign({}, options)

  return function (req, res, next) {
    var dom = req.param('domain') || domain
    params.scope = req.param('scope') || params.scope

    core.getIDToken(dom, params, function (err, uri) {
      if (err) {
        return next(err)
      }

      return res.redirect(302, uri)
    })
  }
}

middleware.getAccessToken = function (domain, options) {
  var params = objectAssign({}, options)

  return function (req, res, next) {
    var dom = req.param('domain') || domain
    params.scope = req.param('scope') || params.scope

    core.getAccessToken(dom, params, function (err, uri) {
      if (err) {
        return next(err)
      }

      return res.redirect(302, uri)
    })
  }
}

middleware.handleRedirect = function () {
  return function (req, res, next) {
    core.handleRedirect(req.query, function (err, token) {
      if (err) {
        return next(err)
      }

      req.token = token
      next()
    })
  }
}

module.exports = middleware
