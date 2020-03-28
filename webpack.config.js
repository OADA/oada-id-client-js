const path = require('path')

module.exports = ['dist', 'src/public'].map(dir => ({
  entry: './src/browser.js',
  target: 'web',
  output: {
    path: path.resolve(__dirname, dir),
    filename: 'bundle.js',
    library: 'oadaIdClient'
  }
}))
