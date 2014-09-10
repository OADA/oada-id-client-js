/*
 * Express server to test the server client part of the library
 */
'use strict';

var express = require('express');
var app = express();
var login = require('../../').middleware;

var options1 = {
    'client_id': '222922449179-va3k4ldqsg9aq5kmv4db8jvlijvv5s8p' +
        '.apps.googleusercontent.com',
    'client_secret': 'U4M-D5ANWgQeNDofGxfmEPZ9',
    'redirect_uri': 'http://localhost:3000/redirect',
};
var options2 = {
    'client_id': '222922449179-va3k4ldqsg9aq5kmv4db8jvlijvv5s8p' +
        '.apps.googleusercontent.com',
    'client_secret': 'U4M-D5ANWgQeNDofGxfmEPZ9',
    'redirect_uri': 'http://localhost:3000/redirect',
    scope: 'https://mail.google.com',
};

var options1vip3 = {
    'client_id': 'abc123@vip3.ecn.purdue.edu:3000',
    'client_secret': '123secret456',
    'redirect_uri': 'http://vip1.ecn.purdue.edu:3000/redirect_vip3',
    scope: 'configurations.me.machines.harvesters',
};

app.use('/who',
	login.getIDToken('vip1.ecn.purdue.edu/~awlayton', options1));

app.use('/get',
	login.getAccessToken('vip1.ecn.purdue.edu/~awlayton', options2));

app.use('/redirect', login.handleRedirect());
app.use('/redirect', function(req, res) {
    res.json(req.token);
});

app.use('/get_vip3',
        login.getAccessToken('vip3.ecn.purdue.edu:3000', options1vip3));

app.use('/redirect_vip3', login.handleRedirect());
app.use('/redirect_vip3', function(req, res) {
    res.json(req.token);
});

app.listen(3000);
