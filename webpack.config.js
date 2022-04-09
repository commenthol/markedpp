/**
 * Run with `npm run webpack`
 */

const path = require('path')
const rimraf = require('rimraf').sync

rimraf('./dist')

module.exports = [
  {
    mode: 'production',
    devtool: 'source-map',
    entry: { markedpp: ['./src/browser.js'] },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'markedpp.min.js',
      library: 'markedpp',
      libraryTarget: 'umd' // 'commonjs'
    },
    resolve: {},
    optimization: { minimize: true },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: { presets: ['@babel/preset-env'] }
          }
        }
      ]
    },
    plugins: []
  }
]
