'use strict';
var opn = require('opn');
var http = require('http');
var fs = require('fs');
var url = require('url');
var path = require('path');
var Promise = require('bluebird');

function hostLogin(domain, options) {
    return new Promise(function(resolve) {
        var server = http.createServer(function(req, res) {

            if (/^\/somefile/.test(req.url)) {
                var urlObj = url.parse(req.url, true);
                server.close();
                return resolve({access_token: urlObj.query.access_token});
            }
            var f = req.url.split('?')[0];
            var file = path.join(__dirname, '/public/' + f);
            res.writeHead(200, {
                'Content-Length': fs.statSync(file).size
            });
            var readStream = fs.createReadStream(file);
            readStream.pipe(res);
        }).listen(8000, function() {
            opn('http://localhost:8000/index.html?domain=' + JSON.stringify(domain) + '&options=' + JSON.stringify(options));
        })
    });
}

module.exports = hostLogin;
