'use strict'
const open = require('open')
const isWsl = require('is-wsl')
const http = require('http')
const fs = require('fs')
const url = require('url')
const path = require('path')
const Promise = require('bluebird')

function hostLogin (domain, options) {
  return new Promise(function (resolve) {
    var server = http
      .createServer(function (req, res) {
        if (/favicon/.test(req.url)) {
          res.statusCode = 404
          res.statusMessage = 'Not found'
          res.end()
          return
        }

        if (/^\/somefile/.test(req.url)) {
          var urlObj = url.parse(req.url, true)
          server.close()
          return resolve({ access_token: urlObj.query.access_token })
        }
        var f = req.url.split('?')[0]
        var file = path.join(__dirname, '/public/' + f)
        res.writeHead(200, {
          'Content-Length': fs.statSync(file).size
        })
        var readStream = fs.createReadStream(file)
        readStream.pipe(res)
      })
      .listen(8000, function () {
        open(
          'http://localhost:8000/index.html?domain=' +
            JSON.stringify(domain) +
            '&options=' +
            JSON.stringify(options),
          {
            url: true,
            // Hack to make open work in WSL
            app: isWsl && 'wslview'
          }
        )
      })
  })
}

module.exports = hostLogin
