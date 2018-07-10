const opn = require('opn');
const http = require('http');
const fs = require('fs');
const url = require('url');
const path = require('path');

function hostLogin(domain, options) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {

            if (/^\/somefile/.test(req.url)) {
                var urlObj = url.parse(req.url, true)
                server.close();
                return resolve({access_token: urlObj.query.access_token})
            }

            let f = req.url.split('?')[0];
            let file = path.join(__dirname, '/public/'+f);
            res.writeHead(200, {
                'Content-Length': fs.statSync(file).size
            });
            var readStream = fs.createReadStream(file);
            readStream.pipe(res);

        }).listen(8000, () => {
            opn(`http://localhost:8000/index.html?domain=${JSON.stringify(domain)}&options=${JSON.stringify(options)}`)
        })
    });
}

module.exports = hostLogin;
