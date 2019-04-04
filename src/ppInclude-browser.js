/* globals XMLHttpRequest,location */

const {
  merge
} = require('./utils')

/*
 * code from <https://github.com/joyent/node/blob/master/lib/path.js>
 * @credits Joyent
 */
const path = {
  normalizeArray: function (parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i]
      if (last === '.') {
        parts.splice(i, 1)
      } else if (last === '..') {
        parts.splice(i, 1)
        up++
      } else if (up) {
        parts.splice(i, 1)
        up--
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..')
      }
    }

    return parts
  },
  resolve: function () {
    var resolvedPath = ''
    var resolvedAbsolute = false

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? arguments[i] : '/'

      // Skip empty and invalid entries
      if (!path) {
        continue
      }

      resolvedPath = path + '/' + resolvedPath
      resolvedAbsolute = path.charAt(0) === '/'
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = this.normalizeArray(resolvedPath.split('/').filter(function (p) {
      return !!p
    }), !resolvedAbsolute).join('/')

    return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.'
  },
  splitPathRe: /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/,
  splitPath: function (filename) {
    return this.splitPathRe.exec(filename).slice(1)
  },
  dirname: function (path) {
    var result = this.splitPath(path)
    var root = result[0]
    var dir = result[1]

    if (!root && !dir) {
      // No dirname whatsoever
      return '.'
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1)
    }

    return root + dir
  },
  join: function () {
    return Array.prototype.slice.call(arguments).join('/')
  }
}

/*
 * code from <https://github.com/caolan/async.git>
 * @credits Caolan McMahon
 */
const async = {
  _eachLimit: function (limit) {
    return function (arr, iterator, callback) {
      callback = callback || function () {}
      if (!arr.length || limit <= 0) {
        return callback()
      }
      var completed = 0
      var started = 0
      var running = 0;

      (function replenish () {
        if (completed >= arr.length) {
          return callback()
        }

        while (running < limit && started < arr.length) {
          started += 1
          running += 1
          iterator(arr[started - 1], function (err) {
            if (err) {
              callback(err)
              callback = function () {}
            } else {
              completed += 1
              running -= 1
              if (completed >= arr.length) {
                callback()
              } else {
                replenish()
              }
            }
          }) // jshint ignore:line
        }
      })()
    }
  },
  eachLimit: function (arr, limit, iterator, callback) {
    var fn = this._eachLimit(limit)
    fn(arr, iterator, callback)
  }
}

/*
 * XHR Request
 * adapted code from <https://github.com/xui/xui/blob/master/src/js/xhr.js>
 * @credits Brian LeRoux, Brock Whitten, Rob Ellis
 */
function xhr (url, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = null
  }
  var o = options || {}
  var req = new XMLHttpRequest()
  var method = o.method || 'get'
  var params = o.data || null
  var key

  req.queryString = params
  req.open(method, url, true)
  req.setRequestHeader('X-Requested-With', 'XMLHttpRequest')

  if (method.toLowerCase() === 'post') {
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
  }

  for (key in o.headers) {
    if (o.headers.hasOwnProperty(key)) {
      req.setRequestHeader(key, o.headers[key])
    }
  }

  function stateChange () {
    if (req.readyState === 4) {
      if ((/^[20]/).test(req.status)) {
        callback(null, req.responseText)
      } else if ((/^[45]/).test(req.status)) {
        callback(new Error(req.status))
      }
    }
  }

  req.onreadystatechange = stateChange

  try {
    req.send(params)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Error: Resolving URL ' + url)
    callback(e)
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
  var dirname = options.dirname || path.dirname(location.pathname)
  var lexed = {}
  var _options = merge({}, options)
  _options.tags = false

  // ppInclude is used to detect recursions
  if (!_options.ppInclude) {
    _options.ppInclude = {}
  }

  async.eachLimit(tokens, 5, function (token, done) {
    if (token.type === 'ppinclude' &&
        typeof token.text === 'string' &&
        !_options.ppInclude[token.text]) {
      var path_ = path.resolve(path.join(dirname, token.text))
      var url = location.protocol + '//' + location.host + path_

      xhr(url, function (err, src) {
        _options.ppInclude[token.text] = 1
        _options.dirname = path.dirname(path_)
        if (err) {
          // eslint-disable-next-line no-console
          console.log('Error: ' + err.message)
          return done()
        }
        var lexer = new Lexer(_options)
        var sep = '\n' + token.indent
        src = token.indent + src.split('\n').join(sep)
        if (src.substr(0 - sep.length) === sep) {
          src = src.substr(0, src.length - sep.length + 1)
        }
        ppInclude(lexer.lex(src), Lexer, _options, function (err, ntokens) {
          if (err) {
            // TODO
          }
          lexed[token.text] = ntokens
          done()
        })
      })
    } else {
      done()
    }
  },
  function () {
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

module.exports = ppInclude
