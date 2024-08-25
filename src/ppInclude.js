'use strict'

/**
 * markedpp
 *
 * Include files on node.js
 *
 * @copyright 2014 commenthol
 * @licence MIT
 */

/**
 * Module dependencies
 */
const fs = require('fs')
const path = require('path')
const async = require('asyncc')

/* generate a unique key for partial include file names that incorporates the start/end values */
function getUniqueFileName (token) {
  return token.text + '(start=' + (token.start || '') + 'end=' + (token.end || '') + ')'
}

function partialInclude (src, start, end) {
  if (Number.isInteger(start) || Number.isInteger(end)) {
    const srcLines = src.split('\n')
    const firstLine = Number.isInteger(start) && start > 0 ? start - 1 : 0
    const lastLine = Number.isInteger(end) && end > 0 ? end : srcLines.length

    return srcLines.slice(firstLine, lastLine).join('\n') + '\n'
  } else {
    // no start/end specified, return the original src
    return src
  }
}

/**
 * Include and Lex files
 * @param {Array} tokens - array of tokens
 * @param {Object} options - options to overwrite
 * @param {String} options.dirname - base directory from where to search files to include (If not specified then current working directory is used)
 * @param {Function} callback - `function(err, tokens)`
 */
function ppInclude (tokens, Lexer, options, callback) {
  const dirname = options.dirname || process.cwd()
  const lexed = {}
  const _options = Object.assign({}, options)
  _options.tags = false

  // ppInclude is used to detect recursions
  if (!_options.ppInclude) {
    _options.ppInclude = {}
  }

  async.eachLimit(5, tokens, function (token, done) {
    const text = getUniqueFileName(token)
    if (token.type === 'ppinclude' &&
      typeof token.text === 'string' &&
      !_options.ppInclude[text]
    ) {
      const file = path.resolve(path.join(dirname, token.text))
      // eslint-disable-next-line no-console
      // console.error('readFile dirname', dirname, 'options.dirname', options.dirname, 'token.text', token.text, 'file', file)
      fs.readFile(file, 'utf8', function (err, src) {
        _options.ppInclude[text] = 1
        _options.dirname = path.dirname(file)
        if (err) {
          // eslint-disable-next-line no-console
          console.error('Error: ' + err.message)
          return done()
        }

        src = partialInclude(src, token.start, token.end)

        const lexer = new Lexer(_options)
        const sep = '\n' + token.indent
        src = token.indent + src.split('\n').join(sep)
        if (src.substr(0 - sep.length) === sep) {
          src = src.substr(0, src.length - sep.length + 1)
        }
        ppInclude(lexer.lex(src), Lexer, _options, function (err, ntokens) {
          if (err) {
            // eslint-disable-next-line no-console
            console.error('Error: ' + err.message)
          }
          // make token.text unique if include details differ
          lexed[text] = ntokens
          done()
        })
      })
    } else {
      setImmediate(done)
    }
  },
  function (/* err */) {
    const _tokens = []

    // compose the new tokens array
    tokens.forEach(function (token) {
      const text = getUniqueFileName(token)

      if (token.type === 'ppinclude' &&
          typeof token.text === 'string' &&
          lexed[text] !== undefined) {
        _tokens.push({
          type: 'ppinclude_start',
          text: token.text,
          indent: token.indent,
          lang: token.lang,
          start: token.start,
          end: token.end,
          link: token.link,
          vscode: token.vscode,
          dirname: options.dirname,
          tags: options.tags
        })
        lexed[text].forEach(function (token) {
          _tokens.push(Object.assign({}, token)) // clone tokens!
        })
        _tokens.push({
          type: 'ppinclude_end',
          text: token.text,
          indent: token.indent,
          lang: token.lang,
          start: token.start,
          end: token.end,
          link: token.link,
          vscode: token.vscode,
          dirname: options.dirname,
          tags: options.tags
        })
      } else {
        _tokens.push(token)
      }
    })
    callback(null, _tokens)
  })
}

module.exports = ppInclude
