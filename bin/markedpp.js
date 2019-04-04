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
const chalk = require('chalk')
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
    let fn

    if (err) return callback(err)

    fn = tokens
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

function help () {
  // eslint-disable-next-line no-console
  console.log(chalk`
{bold NAME}
      markedpp - a markdown pre-processor

{bold SYNOPSIS}
      markedpp [options] <file.md>

{bold OPTIONS}
      -o, --output <outfile.md>
          Specify the filename for the processed output.
          Defaults to stdout.

      -i, --input <file.md>
          Specify the filename for markdown input.

      -t, --tokens
          Output lexed tokens as JSON array.

      --no-gfm
          Disable GFM fences.

      --no-include
          Disables \`!includes\`. No files will be included.

      --no-toc
          Disables \`!toc\`. No generation of Table-of-Contents.

      --no-numberedheadings
          Disables \`!numberedheadings\`.

      --no-ref
          Disables \`!ref\`.

      --no-breaks
          Do not render <br> tags for Table of Contents with numbered style.

      --no-tags
          Do not render pre-proc tags <!-- !command -->.

      --level <number=3>
          Change default level [1..6] for \`!toc\` and \`!numberheadings\`.
          Default is 3.

      --minlevel <number=1>
          Change default minlevel [1..6] for \`!toc\` and \`!numberheadings\`.
          Default is 1.

      --smartlists
          Adds a newline on joined bullet lists using different bullet chars.

      --no-autonumber
          Disable renumbering of ordered lists.

      --autoid
          Add named anchors on headings <a name="..."> anchors).

      --github
          Uses "github.com" compatible anchors.
          Default uses marked compatible anchors.

      --gitlab
          Uses "gitlab.com" compatible anchors.

      --bitbucket
          Uses "bitbucket.org" compatible anchors.

      --ghost
          Uses "ghost.org" compatible anchors.
  `)
}
