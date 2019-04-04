#!/usr/bin/env node

'use strict'

/**
 * Markdown Preprocessor CLI
 *
 * @copyright 2014 commenthol
 * @licence MIT
 *
 * @note Code inspired by `marked` project
 * @credits Christopher Jeffrey <https://github.com/chjj/marked>
 */

var fs = require('fs')
var path = require('path')
var markedpp = require('../src/markedpp')

/**
 * Helpers
 */
function readStdin (callback) {
  var stdin = process.stdin
  var buff = ''

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
  var files = []
  var options = markedpp.defaults
  var input
  var output
  var arg
  var tokens
  var opt

  function getarg () {
    var arg = argv.shift()

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
      case '--test':
        return require('../test').main(process.argv.slice())
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
        return /* help(); */ // TODO
      default:
        if (arg.indexOf('--') === 0) {
          opt = arg.replace(/^--(no-)?/, '')
          if (!markedpp.defaults.hasOwnProperty(opt)) {
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
    var fn

    if (err) return callback(err)

    fn = tokens
      ? markedpp.Lexer.lex
      : markedpp

    fn(data, options, function (err, data) {
      if (err) {
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
