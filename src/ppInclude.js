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
const { geturl } = require("plantuml-api");

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
    if (token.type === 'ppinclude' &&
      typeof token.text === 'string' &&
      !_options.ppInclude[token.text]
    ) {
      const file = path.resolve(path.join(dirname, token.text))
      fs.readFile(file, 'utf8', function (err, src) {
        _options.ppInclude[token.text] = 1
        _options.dirname = path.dirname(file)
        if (err) {
          // eslint-disable-next-line no-console
          console.error('Error: ' + err.message)
          return done()
        }
        // If the include is a PlantUML file,
        // generate a link to build the UML
        // image and add it to the document.
        if (file.includes(".puml")) {
           const exists = fs.existsSync(file);

          if (exists) {
            const puml = fs.readFileSync(file, 'utf8').toString();

            const link = geturl(puml, "svg");

            return done(null, `![Plant UML](${link})\n`);
          }
          else {
            return done(new Error(`Couldn't find: ${file}`));
          }
        } else {
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
            lexed[token.text] = ntokens
            done()
          })
        }
      })
    } else {
      setImmediate(done)
    }
  },
  function (/* err */) {
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
    callback(null, _tokens)
  })
}

module.exports = ppInclude
