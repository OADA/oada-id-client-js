'use strict';

var objectAssign = require('object-assign');
var core = require('./core');

var middleware = {};

// TODO: I am not sure having a callback is very middleware...
middleware.getIDToken = function(domain, options) {
    var params = objectAssign({},
            {
                'response_type': 'code'
            }, options);

    return function(req, res, next) {
        var dom = req.param('domain') || domain;

        core.getIDToken(dom, params, function(err, uri) {
            if (err) { return next(err); }

            return res.redirect(302, uri);
        });
    };
};

middleware.getAccessToken = function(domain, options) {
    var params = objectAssign({},
            {
                'response_type': 'code'
            }, options);

    return function(req, res, next) {
        var dom = req.param('domain') || domain;

        core.getAccessToken(dom, params, function(err, uri) {
            if (err) { return next(err); }

            return res.redirect(302, uri);
        });
    };
};

middleware.handleRedirect = function() {
    return function(req, res, next) {
        core.handleRedirect(req.query, function(err, token) {
            if (err) { return next(err); }

            req.token = token;
            next();
        });
    };
};

module.exports = middleware;
