const path = require('path');

module.exports = ['dist', 'src/public'].map((dir) => ({
  entry: './src/browser.js',
  target: 'web',
  mode: 'production',
  resolve: {
    fallback: {
      util: require.resolve('util/'),
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify'),
    },
  },
  output: {
    path: path.resolve(__dirname, dir),
    filename: 'bundle.js',
    library: 'oadaIdClient',
  },
}));
