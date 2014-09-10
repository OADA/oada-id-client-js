/*jshint browser: true*/
'use strict';

// TODO: URIjs is:ta big, find smaller alternative
var URI = require('URIjs');
var objectAssign = require('object-assign');
var core = require('./core.js');

var browser = {};

browser.init = core.init;

function popUpRedirect(authFun, opts) {
    return function(domain, options, callback) {
        var params = objectAssign({display: 'popup'}, opts, options);
        var win = window.open('', '_blank', 'width=500,height=400');

        // TODO: Do this differently
        window._oadaIdClientPopUpFunction = core.handleRedirect;

        authFun(domain, params, function redirect(err, uri) {
            if (err) { throw err; }

            win.location.assign(uri);
        }, callback);
    };
}

browser.getIDToken =
    popUpRedirect(core.getIDToken, {'response_type': 'id_token'});

browser.getAccessToken =
    popUpRedirect(core.getAccessToken, {'response_type': 'token'});

browser.handleRedirect = function() {
    var uri = new URI(window.location);
    var params = uri.query(uri.fragment()).query(true);

    window.opener._oadaIdClientPopUpFunction(params);
    window.close();
};

module.exports = browser;
