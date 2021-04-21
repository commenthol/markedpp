/* eslint-disable no-console */
'use strict'

/**
 * markedppninja
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
const { geturl } = require('plantuml-api')

/**
 * Include and Lex files
 * @param {Array} tokens - array of tokens
 * @param {Object} options - options to overwrite
 * @param {String} options.dirname - base directory from where to search files to include (If not specified then current working directory is used)
 * @param {Function} callback - `function(err, tokens)`
 */
function ppInclude (tokens, Lexer, options, callback) {
  if (!options) { throw new Error('options is nullish.') }
  if (!options.dirname) { throw new Error('options.dirname is nullish.') }
  const _options = Object.assign({}, options)
  const dirname = options.dirname
  const lexed = {}

  _options.tags = false

  // ppInclude is used to detect recursions
  if (!_options.ppInclude) {
    _options.ppInclude = {}
  }

  async.eachLimit(5, tokens, function (token, done) {
    if (token.type === 'ppinclude' &&
      typeof token.text === 'string' &&
      !_options.ppInclude[token.text]
    ) {
      try {
        if (!dirname) {
          throw new Error('dirname is undefined.')
        }
        const file = path.resolve(path.join(dirname, token.text))

        if (!fs.existsSync(file)) {
          return done()
        }

        // Async reading was causing tests to fail.
        let src = fs.readFileSync(file, 'utf8')

        _options.ppInclude[token.text] = 1
        _options.dirname = path.dirname(file)
        const lexer = new Lexer(_options)
        const sep = '\n' + token.indent

        // If the include is a PlantUML file,
        // generate a link to build the UML
        // image and add it to the document.
        if (file.includes('.puml') && src) {
          const link = geturl(src, 'svg')

          src = token.indent + `![Plant UML](${link})` + sep
        } else {
          src = token.indent + src.split('\n').join(sep)

          if (src.substr(0 - sep.length) === sep) {
            src = src.substr(0, src.length - sep.length + 1)
          }
        }

        ppInclude(lexer.lex(src), Lexer, _options, function (err, ntokens) {
          if (err) {
            // eslint-disable-next-line no-console
            console.error('ppInclude.js - Error: ' + err.message)
            console.error(err)
            done()
          } else {
            lexed[token.text] = ntokens
            done()
          }
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ppInclude.js - Error: ' + err.message)
        console.error(err)
        return done()
      }
    } else {
      setImmediate(done)
    }
  }, options,
  function (err, res) {
    const _tokens = []

    // compose the new tokens array
    tokens.forEach(function (token) {
      if (token.type === 'ppinclude' &&
          typeof token.text === 'string' &&
          lexed[token.text] !== undefined) {
        _tokens.push({
          type: 'ppinclude_start',
          text: token.text,
          indent: token.indent,
          lang: token.lang,
          tags: options.tags
        })
        lexed[token.text].forEach(function (token) {
          _tokens.push(Object.assign({}, token)) // clone tokens!
        })
        _tokens.push({
          type: 'ppinclude_end',
          indent: token.indent,
          lang: token.lang,
          tags: options.tags
        })
      } else {
        _tokens.push(token)
      }
    })
    callback(err, _tokens)
  })
}

module.exports = ppInclude
