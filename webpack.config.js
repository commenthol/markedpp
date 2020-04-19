/**
 * Run with `npm run webpack`
 */

const path = require('path')
// const webpack = require('webpack')
const { createVariants } = require('parallel-webpack')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const rimraf = require('rimraf').sync

const doAnalyze = process.env.npm_lifecycle_event === 'webpack:analyze'

const isProd = true

const variants = doAnalyze
  ? {
    target: [
      ['commonjs']
    ]
  }
  : {
    minified: isProd ? [true] : [false],
    target: [
      ['umd', 'markedpp']
    ]
  }

rimraf('./dist')

function createConfig (options) {
  const plugins = [
  ]
  if (doAnalyze) {
    plugins.push(new BundleAnalyzerPlugin())
  }

  return {
    mode: isProd ? 'production' : 'development',
    devtool: 'sourcemap',
    entry: {
      markedpp: [
        // '@babel/polyfill',
        './src/browser.js'
      ]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: options.target[1] +
                (options.minified ? '.min' : '') +
                '.js',
      library: 'markedpp',
      libraryTarget: options.target[0]
    },
    resolve: {
      // mainFields: ['browser', 'main', 'module']
    },
    optimization: {
      minimize: options.minified
    },
    module: {
      rules: [{
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }]
    },
    plugins
  }
}

module.exports = createVariants(variants, createConfig)
