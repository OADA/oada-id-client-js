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

/* eslint-env mocha */
'use strict'

var sinon = require('sinon')
var expect = require('chai').expect
var URI = require('urijs')
var objectAssign = require('object-assign')

var metadata = require('./metadata.json')
var configuration = require('./configuration.json')
var token = require('./token.json')
var idToken = require('./id_token.json')

describe('core.js', function () {
  var core

  before(function stubSignature () {
    sinon
      .stub(require('@oada/oada-certs').jwksutils, 'jwkForSignature')
      .yields(null, {})
    sinon.stub(require('pem-jwk'), 'jwk2pem').returns('PEM')
  })

  before(function loadModule () {
    // TODO: Figure out something less gross with rewire
    var rewire = require('rewire')
    core = rewire('../src/core.js')
  })

  before(function stubRegister () {
    var registerStub = sinon.stub()

    registerStub.yields(null, metadata)
    // Not sure how I feel about this...
    core.__set__('register', registerStub)
  })
  ;['getAccessToken', 'getIDToken'].forEach(function (method) {
    describe('#' + method, function () {
      it('should redirect to authorization endpoint', function (done) {
        core[method](
          'localhost:3000',
          {},
          function redirect (err, loc) {
            expect(err).to.be.not.ok

            var url = URI.parse(loc)
            url.query = url.fragment = undefined

            expect(URI.build(url)).to.equal(
              configuration['authorization_endpoint']
            )
            done()
          },
          null
        )
      })

      it('should use registration response client ID', function (done) {
        core[method](
          'localhost:3000',
          {},
          function redirect (err, loc) {
            expect(err).to.be.not.ok

            URI(loc).hasQuery('client_id', function (val) {
              expect(val).to.equal(metadata['client_id'])
              done()
            })
          },
          null
        )
      })

      it('should use registration response redirect URI', function (done) {
        core[method](
          'localhost:3000',
          {},
          function redirect (err, loc) {
            expect(err).to.be.not.ok

            URI(loc).hasQuery('redirect_uri', function (val) {
              expect(metadata['redirect_uris']).to.contain(val)
              done()
            })
          },
          null
        )
      })

      var extraScopes = method === 'getIDToken' ? ' + openid' : ''
      it('should send given scope(s)' + extraScopes, function (done) {
        var scopes = ['read', 'write', 'foo']
        var options = { scope: scopes.join(' ') }

        core[method](
          'localhost:3000',
          options,
          function redirect (err, loc) {
            expect(err).to.be.not.ok

            URI(loc).hasQuery('scope', function (val) {
              var vals = val.split(' ')

              scopes.forEach(function (scope) {
                expect(vals).to.include(scope)
              })
              done()
            })
          },
          null
        )
      })

      var flow = process.browser ? 'implicit' : 'code'
      var tokType = method === 'getIDToken' ? 'id_token' : 'token'
      var respType = flow === 'code' ? 'code' : tokType
      it('should use ' + flow + ' flow', function (done) {
        core[method](
          'localhost:3000',
          {},
          function redirect (err, loc) {
            expect(err).to.be.not.ok

            URI(loc).hasQuery('response_type', function (val) {
              expect(val).to.equal(respType)
              done()
            })
          },
          null
        )
      })

      describe('#handleRedirect', function () {
        var code = { code: tokType }
        var ret = method === 'getIDToken' ? idToken : token
        var resp =
          flow === 'code'
            ? code
            : method === 'getIDToken'
            ? { id_token: idToken }
            : token
        var jwtVerify

        beforeEach(function () {
          jwtVerify = sinon.stub(require('jsonwebtoken'), 'verify')
        })

        afterEach(function () {
          jwtVerify.restore()
        })

        it('should pass token to its callback', function (done) {
          core[method]('localhost:3000', {}, function (err, loc) {
            expect(err).to.be.not.ok
            var locParams = URI(loc).query(true)

            var params = objectAssign(
              {
                state: locParams.state
              },
              resp
            )

            var t = JSON.parse(
              JSON.stringify(
                objectAssign({}, ret, {
                  nonce: locParams.nonce
                })
              )
            )
            jwtVerify.yields(null, t)

            core.handleRedirect(params, function (err, tok) {
              expect(err).to.be.not.ok
              expect(tok).to.deep.equal(
                method === 'getIDToken' ? { id_token: t } : t
              )
              done()
            })
          })
        })

        it('should pass token to original callback', function (done) {
          var t
          core[method](
            'localhost:3000',
            {},
            function (err, loc) {
              expect(err).to.be.not.ok
              var locParams = URI(loc).query(true)

              var params = objectAssign(
                {
                  state: locParams.state
                },
                resp
              )

              t = JSON.parse(
                JSON.stringify(
                  objectAssign({}, ret, {
                    nonce: locParams.nonce
                  })
                )
              )
              jwtVerify.yields(null, t)

              core.handleRedirect(params)
            },
            function (err, tok) {
              expect(err).to.be.not.ok
              expect(tok).to.deep.equal(t)
              done()
            }
          )
        })
      })
    })
  })
})
