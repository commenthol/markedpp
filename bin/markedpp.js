#!/usr/bin/env node

'use strict'

/**
 * Markdown Preprocessor CLI
 *
 * @copyright 2014- commenthol
 * @licence MIT
 *
 * @note Code inspired by `marked` project
 * @credits Christopher Jeffrey <https://github.com/chjj/marked>
 */

const fs = require('fs')
const path = require('path')
const markedpp = require('../src')

/**
 * Helpers
 */
function readStdin (callback) {
  const stdin = process.stdin
  let buff = ''

  stdin.setEncoding('utf8')

  stdin.on('data', function (data) {
    buff += data
  })

  stdin.on('error', function (err) {
    return callback(err)
  })

  stdin.on('end', function () {
    return callback(null, buff)
  })

  try {
    stdin.resume()
  } catch (err) {
    callback(err)
  }
}

/**
 * Main
 */
function main (argv, callback) {
  const files = []
  const options = markedpp.defaults
  let input
  let output
  let arg
  let tokens
  let opt

  function getarg () {
    let arg = argv.shift()

    if (arg.indexOf('--') === 0) {
      // e.g. --opt
      arg = arg.split('=')
      if (arg.length > 1) {
        // e.g. --opt=val
        argv.unshift(arg.slice(1).join('='))
      }
      arg = arg[0]
    } else if (arg[0] === '-') {
      if (arg.length > 2) {
        // e.g. -abc
        argv = arg.substring(1).split('').map(function (ch) {
          return '-' + ch
        }).concat(argv)
        arg = argv.shift()
      } else {
        // e.g. -a
      }
    } else {
      // e.g. foo
    }

    return arg
  }

  while (argv.length) {
    arg = getarg()
    switch (arg) {
      case '-o':
      case '--output':
        output = argv.shift()
        break
      case '-i':
      case '--input':
        input = argv.shift()
        break
      case '-t':
      case '--tokens':
        tokens = true
        break
      case '-h':
      case '--help':
        return help()
      case '--version':
        return version()
      default:
        if (arg.indexOf('--') === 0) {
          opt = arg.replace(/^--(no-)?/, '')
          if (!Object.prototype.hasOwnProperty.call(markedpp.defaults, opt)) {
            continue
          }
          if (arg.indexOf('--no-') === 0) {
            options[opt] = (typeof markedpp.defaults[opt] !== 'boolean'
              ? null
              : false)
          } else {
            options[opt] = (typeof markedpp.defaults[opt] !== 'boolean'
              ? argv.shift()
              : true)
          }
        } else {
          files.push(arg)
        }
        break
    }
  }

  function readData (callback) {
    if (!input) {
      if (files.length <= 2) {
        return readStdin(callback)
      }
      input = files.pop()
    }
    options.dirname = path.dirname(input)
    return fs.readFile(input, 'utf8', callback)
  }

  return readData(function (err, data) {
    if (err) return callback(err)

    const fn = tokens
      ? markedpp.Lexer.lex.bind(null, markedpp.ppInclude)
      : markedpp

    fn(data, options, function (err, data) {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('Error: ' + err.message)
      }

      if (tokens) {
        data = JSON.stringify(data, null, 2)
      }

      if (!output) {
        process.stdout.write(data + '\n')
        return callback()
      }

      return fs.writeFile(output, data, callback)
    })
  })
}

/**
 * Expose / Entry Point
 */
if (!module.parent) {
  process.title = 'markedpp'
  main(process.argv.slice(), function (err, code) {
    if (err) throw err
    return process.exit(code || 0)
  })
} else {
  module.exports = main
}

function version () {
  // eslint-disable-next-line no-console
  console.log('v' + require('../package.json').version)
}

function help () {
  // eslint-disable-next-line no-console
  console.log(
    fs.readFileSync(path.resolve(__dirname, '..', 'man', 'markedpp.txt'), 'utf8')
  )
}
