/* globals XMLHttpRequest,location */

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

/*
 * code from <https://github.com/joyent/node/blob/master/lib/path.js>
 * @credits Joyent
 */
const path = {
  normalizeArray: function (parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    let up = 0
    for (let i = parts.length - 1; i >= 0; i--) {
      const last = parts[i]
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
    let resolvedPath = ''
    let resolvedAbsolute = false

    for (let i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      const path = (i >= 0) ? arguments[i] : '/'

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
    const result = this.splitPath(path)
    const root = result[0]
    let dir = result[1]

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
      let completed = 0
      let started = 0
      let running = 0;

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
    const fn = this._eachLimit(limit)
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
  const o = options || {}
  const req = new XMLHttpRequest()
  const method = o.method || 'get'
  const params = o.data || null

  req.queryString = params
  req.open(method, url, true)
  req.setRequestHeader('X-Requested-With', 'XMLHttpRequest')

  if (method.toLowerCase() === 'post') {
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
  }

  for (const key in o.headers) {
    if (Object.prototype.hasOwnProperty.call(o.headers, key)) {
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
  const dirname = options.dirname || path.dirname(location.pathname)
  const lexed = {}
  const _options = Object.assign({}, options)
  _options.tags = false

  // ppInclude is used to detect recursions
  if (!_options.ppInclude) {
    _options.ppInclude = {}
  }

  async.eachLimit(tokens, 5, function (token, done) {
    const text = getUniqueFileName(token)
    if (token.type === 'ppinclude' &&
        typeof token.text === 'string' &&
        !_options.ppInclude[text]) {
      const path_ = path.resolve(path.join(dirname, token.text))
      const url = location.protocol + '//' + location.host + path_

      xhr(url, function (err, src) {
        _options.ppInclude[text] = 1
        _options.dirname = path.dirname(path_)
        if (err) {
          // eslint-disable-next-line no-console
          console.log('Error: ' + err.message)
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
            // TODO
          }
          // make token.text unique if include details differ
          lexed[text] = ntokens
          done()
        })
      })
    } else {
      done()
    }
  },
  function () {
    const _tokens = []

    // compose the new tokens array
    tokens.forEach(function (token) {
      const text = getUniqueFileName(token)
      const dirname = options.dirname || ''
      const vscodefile = token.vscode ? path.resolve(path.join(dirname, token.text)) : undefined

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
          vscodefile,
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
          vscodefile,
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
