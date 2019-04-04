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
var fs = require('fs')
var path = require('path')
var async = require('asyncc')

/**
 * Wrapper to hand over Lexer and other required functions
 * @param {Lexer} Lexer - lexer
 * @param {Function} merge - merge function
 * @return {Function} ppInclude
 */
function ppIncludeWrap (Lexer, merge) {
  /**
   * Include and Lex files
   * @param {Array} tokens - array of tokens
   * @param {Object} options - options to overwrite
   * @param {String} options.dirname - base directory from where to search files to include (If not specified then current working directory is used)
   * @param {Function} callback - `function(err, tokens)`
   */
  function ppInclude (tokens, options, callback) {
    var dirname = options.dirname || process.cwd()
    var lexed = {}
    var _options = merge({}, options)
    _options.tags = false

    // ppInclude is used to detect recursions
    if (!_options.ppInclude) { _options.ppInclude = {} }

    async.eachLimit(5, tokens, function (token, done) {
      if (token.type === 'ppinclude' &&
        typeof token.text === 'string' &&
        !_options.ppInclude[token.text]) {
        var file = path.resolve(path.join(dirname, token.text))
        fs.readFile(file, 'utf8', function (err, src) {
          _options.ppInclude[token.text] = 1
          _options.dirname = path.dirname(file)
          if (err) {
            console.error('Error: ' + err.message)
            return done()
          }
          var lexer = new Lexer(_options)
          var sep = '\n' + token.indent
          src = token.indent + src.split('\n').join(sep)
          if (src.substr(0 - sep.length) === sep) {
            src = src.substr(0, src.length - sep.length + 1)
          }
          ppInclude(lexer.lex(src), _options, function (err, ntokens) {
            if (err) {
              console.error('Error: ' + err.message)
            }
            lexed[token.text] = ntokens
            done()
          })
        })
      } else {
        done()
      }
    },
    function (/* err */) {
      var _tokens = []

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
            _tokens.push(merge({}, token)) // clone tokens!
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
      callback(null, _tokens)
    })
  }

  return ppInclude
}

module.exports = ppIncludeWrap
