const path = require('path');
const webpack = require('webpack');

module.exports = ['dist', 'src/public'].map((dir) => ({
  entry: './src/browser.js',
  target: 'web',
  mode: 'production',
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
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
