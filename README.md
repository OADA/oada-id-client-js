[![Build Status](https://travis-ci.org/OADA/oada-id-client-js.svg?branch=master)](https://travis-ci.org/OADA/oada-id-client-js)
[![Coverage Status](https://coveralls.io/repos/OADA/oada-id-client-js/badge.svg?branch=master)](https://coveralls.io/r/OADA/oada-id-client-js?branch=master)
[![Dependency Status](https://david-dm.org/oada/oada-id-client-js.svg)](https://david-dm.org/oada/oada-id-client-js)
[![License](http://img.shields.io/:license-Apache%202.0-green.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)

oada-id-client
==============

JavaScript client library for OADA identity.
Can be used both in NodeJS and in the browser.

Getting Started
---------------

### Installation ###
The library is not yet published with `npm`,
but it can be installed from the GitHub repo.
```sh
$ npm install OADA/oada-id-client-js
```

### Browser Code Generation ###
The code to use in the browser can be generated with the following command:
```sh
$ npm run bundle
```
This will create the file `dist/bundle.js`.

Examples
--------
* [On Server Example][]
* [In Browser Example][]

Connect Style "Middleware" Wrapper Usage
----------------------------------------
Version of the library functions which wrap the core functionality
for use as connect style "middleware".
This can be used in a NodeJS server using a compatible web development
framework, such as express.

For a working example of using this wrapper, see the [on server example][].


### getIDToken(domain, options) ###
Middleware for generating an ID token request against an OADA identity
provider.

#### Parameters ####
`domain` string of domain with which to log in the user.
The value passed to the function can be overridden by a query or form
parameter with a name of `domain`.

`options` object containing at least the following properties:
* [`metadata`][] object containg client metadata,
  or string of a [`software_statement`][] JWT
* `privateKey`
  * `pem` string or buffer containing your client's PEM encoded private RSA
    key
  * [`kid`][] string containing the key ID parameter,
    for finding the corresponding public key where your client is registered
* `params` [Optional OpenID Connect parameters][oidparams] placed in `params` as
  string properties will be used (e.g. `display`, `prompt`, `login_hint`)

#### Usage Example ####
```javascript
var options = {
    metadata: { /* See spec linked above */ },
    privateKey: {
        pem: fs.readFileSync('/path/to/key.pem'),
        kid: 'key_id_corresponding_to_pem',
    },
};

app.use('/getIdToken',
    oadaIdClient.getIDToken('some.oada-identity-provider.com', options));
```

### getAccessToken(domain, options) ###
Middleware for generating an access token request against an OADA compliant
API.

#### Parameters ####
`domain` string of domain from which to get an OADA API access token.
The value passed to the function can be overridden by a query or form
parameter with a name of `domain`.

`options` object containing at least the following properties:
* [`metadata`][] object containg client metadata,
  or string of a [`software_statement`][] JWT
* `privateKey`
  * `pem` string or buffer containing your client's PEM encoded private RSA
    key
  * [`kid`][] string containing the key ID parameter,
    for finding the corresponding public key where your client is registered
* [`scope`][] space separated string of OAuth scopes for the request access
  token to have.
* `params` [Optional OpenID Connect parameters][oidparams] placed in `params` as
  string properties will be used (e.g. `display`, `prompt`, `login_hint`)

#### Usage Example ####
```javascript
var options = {
    metadata: { /* See spec linked above */ },
    privateKey: {
        pem: fs.readFileSync('/path/to/key.pem'),
        kid: 'key_id_corresponding_to_pem',
    },
    scope: 'some.oada.defined.scope',
};

app.use('/getAccessToken',
    oadaIdClient.getAccessToken('some.oada-cloud-provider.com', options));
```

### handleRedirect() ###
Middleware for handling redirects from `getIDToken` or `getAccessToken`
middlewares.
In most case you will apply this middleware in two locations,
one to receive `getIDToken` redirects and
another to receive `getAccessToken` redirects.

#### Usage Example ####
```javascript
// Handle ID token redirects
app.use('/url/referenced/by/getIDToken/redirect_uri',
    oadaIdClient.handleRedirect());
app.use('/url/referenced/by/getIDToken/redirect_uri',
    function (req, res, next) {
        // ID token is in req.token
        console.dir(req.token);
    });

// Handle access token redirects
app.use('/url/referenced/by/getAccessToken/redirect_uri',
    oadaIdClient.handleRedirect());
app.use('/url/referenced/by/getAccessToken/redirect_uri',
    function (req, res, next) {
        // Access token is in req.token
        console.dir(req.token);
    });
```

Browser Wrapper Usage
---------------------
Version of the library functions which wrap the core functionality
for easy use in the browser.

For a working example of using this wrapper, see the [in browser example][].

### getIDToken(domain, options, callback) ###
Asynchronous function for generating an ID token request against
an OADA identity provider.

#### Parameters ####
`domain` string of domain with which to log in the user.

`options` object containing at least the following properties:
* [`metadata`][] object containg client metadata,
  or string of a [`software_statement`][] JWT
* `params` [Optional OpenID Connect parameters][oidparams] placed in `params` as
  string properties will be used (e.g. `display`, `prompt`, `login_hint`)

[Optional OpenID Connect parameters][oidparams] placed in options as
string properties will be used (e.g. `display`, `prompt`, `login_hint`).

`callback` function of the form `function(err, idToken)`.

#### Usage Example ####
```javascript
var options = {
    metadata: { /* See spec linked above */ }
};

var domain; // Set domain based on text box, dropdown, etc.

oadaIdClient.getIDToken(domain, options, function(err, idToken) {
    if (err) { return console.dir(err); } // Soemthing went wrong

    console.dir(idToken);
});
```

### getAccessToken(domain, options, callback) ###
Asynchronous function for generating an access token request against an
OADA compliant API.

#### Parameters ####
`domain` string of domain from which to get an OADA API access token.
The value passed to the function can be overridden by a query or form
parameter with a name of `domain`.

`options` object containing at least the following properties:
* [`metadata`][] object containg client metadata,
  or string of a [`software_statement`][] JWT
* [`scope`][] space separated string of OAuth scopes for the request access
  token to have.
* `params` [Optional OpenID Connect parameters][oidparams] placed in `params` as
  string properties will be used (e.g. `display`, `prompt`, `login_hint`)

`callback` function of the form `function(err, accessToken)`.

#### Usage Example ####
```javascript
var options = {
    metadata: { /* See spec linked above */ },
    scope: 'some.oada.defined.scope',
};

var domain; // Set domain based on text box, dropdown, etc.

oadaIdClient.getAccessToken(domain, options, function(err, accessToken) {
    if (err) { return console.dir(err); } // Soemthing went wrong

    console.dir(accessToken);
});
```

### handleRedirect() ###
Function for handling redirects generated by
`getIDToken` or `getAccessToken` function.
Simply needs to be called by the page served from the URL corresponding to
[`redirect_uri`][].

#### Usage Example ####
```html
<!-- Page served at redirect_uri for getIDToken and/or getAccessToken -->
<html>
<head>
    <script src="path/to/library/browser/code.js"></script>
    <script>oadaIdClient.handleRedirect();</script>
</head>
</html>
```

Base Library Usage
------------------
Not yet documented.

References
----------
[on server example]: examples/server-client/
[in browser example]: examples/browser-client/
1. [OpenID Connect Core 1.0](http://openid.net/specs/openid-connect-core-1_0.html)
[oidparams]: http://openid.net/specs/openid-connect-core-1_0.html#AuthRequest "OpenID Connect Core 1.0 Section 3.1.2.1"
1. [OAuth 2.0 Authorization Framework](http://tools.ietf.org/html/rfc6749 "RFC6749")
[`client_id`]: http://tools.ietf.org/html/rfc6749#section-2.2 "RFC6794 Section 2.2"
[`redirect_uri`]: http://tools.ietf.org/html/rfc6749#section-3.1.2 "RFC6794 Section 3.1.2"
[`scope`]: http://tools.ietf.org/html/rfc6749#section-3.3 "RFC6794 Section 3.3"
1. [JSON Web Key (JWK) Draft 31](https://tools.ietf.org/html/draft-ietf-jose-json-web-key-31)
[`kid`]: https://tools.ietf.org/html/draft-ietf-jose-json-web-key-31#section-4.5 "JWK Section 4.5"
1. [OAuth 2.0 Dynamic Client Registration Protocol](https://tools.ietf.org/html/draft-ietf-oauth-dyn-reg)
[`metadata`]: https://tools.ietf.org/html/draft-ietf-oauth-dyn-reg#section-2 "oauth-dyn-reg Section 2"
[`software_statement`]: https://tools.ietf.org/html/draft-ietf-oauth-dyn-reg#section-2.3 "oauth-dyn-reg Section 2.3"
