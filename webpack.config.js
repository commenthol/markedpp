/**
 * Run with `npm run webpack`
 */

const path = require('path')
const { createVariants } = require('parallel-webpack')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const rimraf = require('rimraf').sync

const doAnalyze = process.env.npm_lifecycle_event === 'webpack:analyze'

const isProd = true

const variants = doAnalyze
  ? {
      target: [['commonjs']]
    }
  : {
      minified: [false],
      target: [['umd', 'markedppninja']]
    }

rimraf('./bin')

function createConfig (options) {
  const plugins = []
  if (doAnalyze) {
    plugins.push(new BundleAnalyzerPlugin())
  }

  return {
    mode: isProd ? 'production' : 'development',
    devtool: 'sourcemap',
    entry: {
      markedppninja: [
        // '@babel/polyfill',
        './src/browser.js'
      ]
    },
    output: {
      path: path.resolve(__dirname, 'bin'),
      filename: options.target[1] + '.js',
      library: 'markedppninja',
      libraryTarget: options.target[0]
    },
    resolve: {
      // mainFields: ['browser', 'main', 'module']
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    },
    plugins
  }
}

module.exports = createVariants(variants, createConfig)
