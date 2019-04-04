/*!
 * markedpp
 *
 * A preprocessor for markdown files
 *
 * @copyright 2014 commenthol
 * @licence MIT
 *
 * @note Code inspired by `marked` project
 * @credits Christopher Jeffrey <https://github.com/chjj/marked>
 */

const Lexer = require('./Lexer')
const InlineLexer = require('./InlineLexer')
const Parser = require('./Parser')
const Renderer = require('./Renderer')
const { merge } = require('./utils')
const defaults = require('./defaults')

/**
 * Markdown Preprocessor
 *
 * @module markedpp
 * @param {String} src - markdown source to preprocess
 * @param {Object} options - options
 * @param {String} options.dirname - dirname of markdown source file - required to include other files
 * @param {Function} callback - callback function
 * ```
 * function({Error} err, {String} data)
 * ```
 */
function markedpp (src, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = null
  }

  options = merge({}, defaults, options || {})

  Lexer.lex(src, markedpp.ppInclude, options, function (err, tokens) {
    if (err) {
      // TODO
    }
    var out = Parser.parse(tokens, options)
    callback(null, out)
  })
}

/**
 * exports
 */
markedpp.defaults = defaults
markedpp.Lexer = Lexer
markedpp.InlineLexer = InlineLexer
markedpp.Renderer = Renderer
markedpp.Parser = Parser
markedpp.merge = merge

markedpp.setOptions = function (opt) {
  merge(defaults, opt)
  return markedpp
}

module.exports = markedpp
