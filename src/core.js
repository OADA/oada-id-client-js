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

var request = require('superagent')
// TODO: URIjs is big, find smaller alternative
var URI = require('urijs')
var objectAssign = require('object-assign')
var jwt = require('jsonwebtoken')
var jwku = require('@oada/oada-certs').jwksutils
var jwk2pem = require('pem-jwk').jwk2pem
var crypto = require('crypto')
var clientAuth = require('jwt-bearer-client-auth')
var register = require('oauth-dyn-reg')

var core = {}

var options = {}
var stuff = {}

function mergeOptions () {
  var args = Array.prototype.concat.apply([{}], arguments)
  var options

  options = objectAssign.apply(null, args)

  var argParams = args
    .filter(function (arg) {
      return arg && arg.hasOwnProperty('params')
    })
    .map(function (arg) {
      return arg.params
    })
  if (argParams.length) {
    options.params = objectAssign.apply(null, argParams)
  }

  options.scope = args
    .map(function (arg) {
      return (arg && arg.scope && arg.scope.split(' ')) || []
    })
    .reduce(function (scopes1, scopes2) {
      return scopes1.concat(scopes2)
    })
    .filter(function (scope, ind, scopes) {
      return scopes.indexOf(scope) === ind
    })
    .join(' ')

  return options
}

core.init = function (opts) {
  options = mergeOptions(options, opts)
}

function storeState (stateObj, callback) {
  // Make sure neither or both state storing functions are overridden
  if (core.retrieveState !== retrieveState) {
    return callback(new Error('Overrode retrieveState but not storeState!'))
  }

  // Cryptographically secure random bytes
  var stateTok = crypto.randomBytes(16)

  // Make it base64URL
  stateTok = stateTok
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Rembmer stuff
  stuff[stateTok] = stateObj

  return callback(null, stateTok)
}

function retrieveState (stateTok, callback) {
  // Make sure neither or both state storing functions are overridden
  if (core.storeState !== storeState) {
    return callback(new Error('Overrode storeState but not retrieveState!'))
  }

  // Retrie stored state
  var stateObj = stuff[stateTok]

  // Only use each state once
  delete stuff[stateTok]

  return callback(null, stateObj)
}

// These can be replaced with to change how state is stored
// TODO: Should these be exposed somehow for browser and/or middleware?
core.storeState = storeState
core.retrieveState = retrieveState

function authorize (domain, configuration, parameters, redirect, callback) {
  var key
  var params
  var metadata

  // Get stuff from options object
  var options = mergeOptions({}, options, parameters)
  key = options.privateKey
  params = objectAssign(options.params, { scope: options.scope })
  metadata = options.metadata

  // Assume key is PEM ecnoded
  if (key) {
    key.kty = key.kty || 'PEM'
  }

  // Should I be passing the error to both?
  var errCallback = combineCallbacks(redirect, callback)

  var req = request.get('https://' + domain + '/.well-known/' + configuration)
  if (req.buffer) {
    req.buffer()
  }
  req.end(function configurationCallback (err, resp) {
    var e = err || resp.error
    if (e) {
      return errCallback(e)
    }

    try {
      var conf = JSON.parse(resp.text)

      register(
        metadata,
        conf['registration_endpoint'],
        function registrationCallback (err, resp) {
          if (err) {
            return errCallback(err)
          }

          // Is this a good way to pick?
          params['redirect_uri'] = options.redirect || resp['redirect_uris'][0]

          // Stuff to remember for when redirect is received
          var stateObj = {
            key: key,
            domain: domain,
            conf: conf,
            callback: callback,
            options: resp,
            query: params
          }

          core.storeState(stateObj, function (err, stateTok) {
            // Construct authorization redirect
            var uri = new URI(conf['authorization_endpoint'])
            uri
              .addQuery({ state: stateTok })
              .addQuery(params)
              .addQuery({ client_id: resp['client_id'] })
            // Do not send client_secret here
            uri.removeQuery('client_secret')

            // Redirect the user to constructed uri
            return redirect(err, uri && uri.toString())
          })
        }
      )
    } catch (err) {
      return errCallback(err)
    }
  })
}

core.getIDToken = function getIDToken (domain, opts, redirect, cb) {
  var configuration = 'openid-configuration'
  var response = process.browser ? 'id_token' : 'code'
  // Make sure we have openid scope
  var params = mergeOptions(
    {
      scope: 'openid',
      params: { response_type: response }
    },
    opts
  )

  // Add nonce
  params.params.nonce = crypto
    .randomBytes(12)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  authorize(domain, configuration, params, redirect, function (err, tok) {
    // return only id_token
    return cb && cb(err, tok && tok.id_token)
  })
}

core.getAccessToken = function getAccessToken (domain, opts, redirect, cb) {
  var configuration = 'oada-configuration'
  var response = process.browser ? 'token' : 'code'
  var params = mergeOptions(
    {
      scope: '',
      params: { response_type: response }
    },
    opts
  )

  authorize(domain, configuration, params, redirect, cb)
}

function combineCallbacks () {
  var callbacks = arguments

  return function callback (err, result) {
    for (var i = 0; i < callbacks.length; i++) {
      if (typeof callbacks[i] === 'function') {
        callbacks[i](err, result)
      }
    }
  }
}

// TODO: Check issuer
function verifyIDToken (state, params, callback) {
  if (!params || !params['id_token']) {
    return callback(null, params)
  }

  // This makes it work in IE
  var parameters = objectAssign({}, params)

  return jwku.jwkForSignature(
    parameters['id_token'],
    state.conf['jwks_uri'],
    function (err, jwk) {
      if (err) {
        return callback(err)
      }
      var key = jwk2pem(jwk)

      var opts = {
        audience: state.options['client_id'],
        issuer: state.conf.issuer
      }
      jwt.verify(parameters['id_token'], key, opts, function (err, token) {
        if (!err) {
          // Check nonce
          if (state.query.nonce === token.nonce) {
            parameters['id_token'] = token
          } else {
            err = new Error('Nonces did not match')
          }
        }

        return callback(err, parameters)
      })
    }
  )
}

function exchangeCode (state, parameters, callback) {
  if (!parameters['code']) {
    return verifyIDToken(state, parameters, callback)
  }

  var assertion = clientAuth.generate(
    state.key,
    state.options['client_id'],
    state.options['client_id'],
    state.conf['token_endpoint'],
    60,
    { payload: { jti: parameters.code } }
  )

  var params = {
    grant_type: 'authorization_code',
    redirect_uri: state.query['redirect_uri'],
    client_assertion: assertion,
    client_assertion_type:
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_id: state.options['client_id'],
    code: parameters.code
  }

  request
    .post(state.conf['token_endpoint'])
    .type('form')
    .send(params)
    .end(function (err, resp) {
      var e = err || resp.error
      if (e) {
        return callback(e)
      }

      var token
      try {
        token = JSON.parse(resp.text)
      } catch (err) {
        return callback(err)
      }

      verifyIDToken(state, token, callback)
    })
}

// TODO: Should I be able to register callbacks in two places?
core.handleRedirect = function handleRedirect (params, callback) {
  var stateTok = params.state
  var parameters = objectAssign({}, params)
  delete parameters.state

  core.retrieveState(stateTok, function (err, stateObj) {
    var cb = combineCallbacks(stateObj && stateObj.callback, callback)

    if (stateObj) {
      exchangeCode(stateObj, parameters, cb)
    } else {
      cb('Spurrious redirect received', parameters)
    }
  })
}

module.exports = core
