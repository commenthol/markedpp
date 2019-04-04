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

/* eslint-disable func-call-spacing, no-unexpected-multiline */
/* globals XMLHttpRequest,location,define */

(function (ctx) {
  'use strict'

  /*
 * default values
 */
  var defaults = {
    gfm: true, // consider gfm fences
    include: true, // enable !includes
    toc: true, // enable !toc
    numberedheadings: true, // enable !numberedheadings
    ref: true, // enable !ref

    breaks: true, // render <br> tags for Table of Contents with numbered style
    tags: true, // render pre-proc tags <!-- !command -->
    level: 3, // default level for !toc and !numberheadings
    minlevel: 1, // default minlevel for !toc and !numberheadings

    autonumber: true, // renumber lists
    autoid: true, // update identifiers on headings automatically
    githubid: false // use github convention for heading auto identifiers
  }

  /*
 * Helpers
 */

  function isNodeJs () {
    return (
      typeof process !== 'undefined' &&
    typeof module !== 'undefined' &&
    module.exports &&
    !process.browser // allows usage with webpack
    )
  }

  function replace (regex, opt) {
    regex = regex.source
    opt = opt || ''
    return function self (name, val) {
      if (!name) return new RegExp(regex, opt)
      val = val.source || val
      val = val.replace(/(^|[^[])\^/g, '$1')
      regex = regex.replace(name, val)
      return self
    }
  }

  function noop () {}
  noop.exec = noop

  function merge (obj) {
    var i = 1
    var target
    var key

    for (; i < arguments.length; i++) {
      target = arguments[i]
      for (key in target) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
          obj[key] = target[key]
        }
      }
    }

    return obj
  }

  function int (str, undef) {
    var num = parseInt(str, 10)
    if (isNaN(num)) {
      if (undef === true) { return } else { return str }
    }
    return num
  }

  function repeat (str, times) {
    times = times || 1
    var ret = ''
    for (var i = 0; i < times; i++) {
      ret += str
    }
    return ret
  }

  /*
 * code from <https://github.com/joyent/node/blob/master/lib/path.js>
 * @credits Joyent
 */
  var path = {
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
  var async = {
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
      console.log('Error: Resolving URL ' + url)
      callback(e)
    }
  }

  var ppInclude

  if (isNodeJs()) {
    ppInclude = require('./ppinclude')(Lexer, merge)
  } else {
    /**
   * Include and Lex files
   * @param {Array} tokens - array of tokens
   * @param {Object} options - options to overwrite
   * @param {String} options.dirname - base directory from where to search files to include (If not specified then current working directory is used)
   * @param {Function} callback - `function(err, tokens)`
   */
    ppInclude = function (tokens, options, callback) {
      var dirname = options.dirname || path.dirname(location.pathname)
      var lexed = {}
      var _options = merge({}, options)
      _options.tags = false

      // ppInclude is used to detect recursions
      if (!_options.ppInclude) { _options.ppInclude = {} }

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
              console.log('Error: ' + err.message)
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
  }

  /*
   * block lexer rules
   */
  var block = {
    newline: /^\n+/,
    code: /^( {4}[^\n]+\n*)+/,
    fences: noop,
    hr: /^( *[-*_]){3,} *(?:\n+|$)/,
    heading: /^headingid *(#{1,6}) *([^\n]+?) *#* *(?:\n|$)/,
    lheading: /^headingid([^\n]+)\n *(=|-){2,} *(?:\n|$)/,
    headingid: /(?: *<a name="([^"]+)" *(?:\/>|> *<\/a>|>) *\n)?/,
    blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*)+(?:\n|$)/,
    list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n?|\s*$)/,
    html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n|$)/,
    table: noop,
    // ~ paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|list|tag|def))+)\n*/, // TODO - ok according to commonmark
    paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
    text: /^[^\n]+/,
    // ----
    ppinclude: noop,
    ppnumberedheadings: noop,
    pptoc: noop,
    ppref: noop
  }

  // join the rules
  block.bullet = /(?:[*+-]|\d+\.)/
  block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/
  block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ()

  block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
  ('def', '\\n+(?=' + block.def.source + ')')
  ()

  block.blockquote = replace(block.blockquote)
  ('def', block.def)
  ()

  block.heading = replace(block.heading)
  ('headingid', block.headingid)
  ()
  block.lheading = replace(block.lheading)
  ('headingid', block.headingid)
  ()

  // list of allowed tags - TODO
  // ~ block._tag = '(?!(?:' +
  // ~ 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' +
  // ~ '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' +
  // ~ '|span|br|wbr|ins|del|img|x-[a-z]+)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

  // allow all tags
  block._tag = '(?!(?:[A-Za-z][A-Za-z-]*)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b'

  block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ()

  block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  // ~ ('list', block.list) // TODO - ok according to commonmark
  ('tag', '<' + block._tag)
  ('def', block.def)
  ()

  block.opts = {}

  block.opts.gfm = {
    fences: /^( *)(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\2 *(?:\n|$)/
  }

  /*
   * preprocessor rules
   */
  var preproc = {
    _ppopts_: / ?(?:\(([^)]+)\))?/,

    ppinclude: /^( *)(?:!(?:include)_ppopts_|_ppinclude_|_ppincludeCompat_) *(?:\n|$)/,
    _ppinclude_: /<!-- *include_ppopts_ *-->(?:(?!<!-- *\/include * -->)[^])*<!-- *\/include * -->/,
    _ppincludeCompat_: /!INCLUDE "([^"]+)"/,

    ppnumberedheadings: /^ *(?:!(?:numberedheadings)_ppopts_|_ppnumberedheadings_) *(?:\n+|$)/,
    _ppnumberedheadings_: /<!-- !*numberedheadings_ppopts_ *-->/,

    pptoc: /^(?:!(?:toc)_ppopts_|_pptoc_|_pptocCompat1_|_pptocCompat2_|_pptocCompat3_) *(?:\n+|$)/,
    _pptoc_: /<!-- *!toc_ppopts_ *-->(?:(?!<!-- *toc! * -->)[^])*<!-- *toc! * -->/,
    _pptocCompat1_: /!TOC/,
    _pptocCompat2_: /<!-- *toc *-->(?:(?!<!-- *(?:\/toc|toc stop) * -->)[^])*<!-- *(?:\/toc|toc stop) * -->/, // marked-toc, markdown-pp syntax
    _pptocCompat3_: /<!-- *toc *-->/,

    ppref: /^(?:!(?:ref)|_ppref_|_pprefCompat1_|_pprefCompat2_) *(?:\n|$)/,
    _ppref_: /<!-- *!ref *-->(?:(?!<!-- *ref! * -->)[^])*<!-- *ref! * -->/,
    _pprefCompat1_: /!REF/,
    _pprefCompat2_: /<!-- *ref *-->(?:(?!<!-- *\/ref * -->)[^])*<!-- \/ref * -->/
  }

  preproc.ppinclude = replace(preproc.ppinclude)
  ('_ppinclude_', preproc._ppinclude_)
  ('_ppincludeCompat_', preproc._ppincludeCompat_)
  ('_ppopts_', preproc._ppopts_)
  ('_ppopts_', preproc._ppopts_)
  ()
  preproc.ppnumberedheadings = replace(preproc.ppnumberedheadings)
  ('_ppnumberedheadings_', preproc._ppnumberedheadings_)
  ('_ppopts_', preproc._ppopts_)
  ('_ppopts_', preproc._ppopts_)
  ()
  preproc.pptoc = replace(preproc.pptoc)
  ('_pptoc_', preproc._pptoc_)
  ('_ppopts_', preproc._ppopts_)
  ('_ppopts_', preproc._ppopts_)
  ('_pptocCompat1_', preproc._pptocCompat1_)
  ('_pptocCompat2_', preproc._pptocCompat2_)
  ('_pptocCompat3_', preproc._pptocCompat3_)
  ()
  preproc.ppref = replace(preproc.ppref)
  ('_ppref_', preproc._ppref_)
  ('_pprefCompat1_', preproc._pprefCompat1_)
  ('_pprefCompat2_', preproc._pprefCompat2_)
  ()

  block.opts.include = {
    ppinclude: preproc.ppinclude
  }
  block.opts.numberedheadings = {
    ppnumberedheadings: preproc.ppnumberedheadings
  }
  block.opts.toc = {
    pptoc: preproc.pptoc
  }
  block.opts.ref = {
    ppref: preproc.ppref
  }

  // ~ if (typeof require !== "undefined" && require.main === module) console.log(block); // TODO - debugging

  /**
   * Lexer
   * @constructor
   * @param {Object} options - overwrites default options
   */
  function Lexer (options) {
    this.tokens = []
    this.options = options || defaults
    this.rules = block
    if (this.options.gfm) {
      merge(this.rules, block.opts.gfm)
    }
    if (this.options.include) {
      merge(this.rules, block.opts.include)
    }
    if (this.options.numberedheadings) {
      merge(this.rules, block.opts.numberedheadings)
    }
    if (this.options.toc) {
      merge(this.rules, block.opts.toc)
    }
    if (this.options.ref) {
      merge(this.rules, block.opts.ref)
    }
  }

  /**
 * Preprocessing
 * @param {String} src - markdown source
 * @return {Object} token
 */
  Lexer.prototype.lex = function (src) {
    src = src
      .replace(/\r\n|\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\u00a0/g, ' ')
      .replace(/\u2424/g, '\n')

    // ~ src = src.replace(/\n/g, '↩\n').replace(/ /g, '·') // TODO - debugging
    return this.token(src, true)
  }

  /**
 * Lexing
 * @param {String} src - markdown source
 * @param {Boolean} top -
 * @return {Array} - array of tokens
 */
  Lexer.prototype.token = function (src, top) {
    var cap,
      bull,
      next,
      l,
      b,
      i,
      item,
      space,
      loose,
      bq,
      tmp,
      opts

    while (src) {
      // newline
      if ((cap = this.rules.newline.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'space',
          text: cap[0]
        })
      }
      // ppinclude
      if ((cap = this.rules.ppinclude.exec(src))) {
        src = src.substring(cap[0].length)
        tmp = cap[2] || cap[3] || cap[4]
        opts = Lexer.splitOpts(tmp)
        tmp = tmp.replace(/ *(?:[a-z]+=[a-z0-9-]+)/, '').replace(/\\ /g, ' ')
        this.tokens.push({
          type: 'ppinclude',
          text: tmp,
          indent: opts.indent ? repeat(' ', opts.indent) : cap[1],
          lang: opts.lang
        })
        continue
      }
      // code
      if ((cap = this.rules.code.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'code',
          text: cap[0]
        })
        continue
      }
      // fences (gfm)
      if ((cap = this.rules.fences.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'fences',
          indent: cap[1],
          fences: cap[2],
          lang: cap[3],
          text: cap[4]
        })
        continue
      }
      /*
     * heading
     * cap[1] - headingid from <a name="">
     * cap[2] - heading char
     * cap[3] - heading text
     */
      if ((cap = this.rules.heading.exec(src))) {
        src = src.substring(cap[0].length)
        tmp = new InlineLexer(this.options)
        this.tokens.push({
          type: 'heading',
          depth: cap[2].length,
          text: cap[3],
          raw: cap[3],
          autoid: null,
          anchor: cap[1],
          inline: tmp.lex(cap[3])
        })
        continue
      }
      /*
     * lheading
     * cap[1] - headingid from <a name="">
     * cap[2] - heading char
     * cap[3] - heading text
     */
      if ((cap = this.rules.lheading.exec(src))) {
        src = src.substring(cap[0].length)
        tmp = new InlineLexer(this.options)
        this.tokens.push({
          type: 'heading',
          depth: cap[3] === '=' ? 1 : 2,
          text: cap[2],
          raw: cap[2],
          autoid: null,
          anchor: cap[1],
          inline: tmp.lex(cap[2])
        })
        continue
      }
      // hr
      if ((cap = this.rules.hr.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'hr',
          text: cap[0]
        })
        continue
      }
      // blockquote
      if ((cap = this.rules.blockquote.exec(src))) {
        src = src.substring(cap[0].length)

        this.tokens.push({
          type: 'blockquote_start'
        })

        cap = cap[0].replace(/^ *> ?/gm, '')

        // Pass `top` to keep the current
        // "toplevel" state. This is exactly
        // how markdown.pl works.
        this.token(cap, top)

        this.tokens.push({
          type: 'blockquote_end'
        })

        continue
      }
      // list -
      if ((cap = this.rules.list.exec(src))) {
        src = src.substring(cap[0].length)
        bull = cap[2]

        this.tokens.push({
          type: 'list_start',
          ordered: bull.length > 1,
          start: int(bull, true)
        })

        // Get each top-level item.
        cap = cap[0].match(this.rules.item)

        next = false
        l = cap.length
        i = 0

        for (; i < l; i++) {
          item = cap[i]
          bull = this.rules.bullet.exec(item)[0]

          // Remove the list item's bullet
          // so it is seen as the next token.
          space = item.length
          item = item.replace(/^ *([*+-]|\d+\.) +/, '')

          // Outdent whatever the
          // list item contains. Hacky.
          if (~item.indexOf('\n ')) {
            space -= item.length
            item = !this.options.pedantic
              ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
              : item.replace(/^ {1,4}/gm, '')
          }

          // Determine whether the next list item belongs here.
          // Backpedal if it does not belong in this list.
          if (this.options.smartLists && i !== l - 1) {
            b = this.rules.bullet.exec(cap[i + 1])[0]
            if (bull !== b && !(bull.length > 1 && b.length > 1)) {
              src = cap.slice(i + 1).join('\n') + src
              i = l - 1
            }
          }

          // Determine whether item is loose or not.
          // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
          // for discount behavior.
          loose = next || /\n\n(?!\s*$)/.test(item)
          if (i !== l - 1) {
            next = item.charAt(item.length - 1) === '\n'
            if (!loose) loose = next
          }

          this.tokens.push({
            type: loose
              ? 'loose_item_start'
              : 'list_item_start',
            text: bull
          })

          // Recurse.
          this.token(item, false, bq)

          this.tokens.push({
            type: 'list_item_end'
          })
        }

        this.tokens.push({
          type: 'list_end'
        })

        continue
      }
      // ppnumberedheadings
      if ((cap = this.rules.ppnumberedheadings.exec(src))) {
        src = src.substring(cap[0].length)
        opts = Lexer.splitOpts(cap[1] || cap[2])
        if (typeof opts.omit === 'string') {
          opts.omit = [ opts.omit ]
        }
        this.options.numberedHeadings = true
        this.tokens.push({
          type: 'ppnumberedheadings',
          level: Lexer.range(opts.level, defaults.minlevel, 6, defaults.level),
          minlevel: Lexer.range(opts.minlevel, defaults.minlevel, 6),
          skip: opts.skip,
          start: opts.start,
          omit: opts.omit
        })
        continue
      }
      // pptoc
      if ((cap = this.rules.pptoc.exec(src))) {
        src = src.substring(cap[0].length)
        opts = Lexer.splitOpts(cap[1] || cap[2])
        if (typeof opts.omit === 'string') {
          opts.omit = [ opts.omit ]
        }
        this.tokens.push({
          type: 'pptoc',
          level: Lexer.range(opts.level, defaults.minlevel, 6, defaults.level),
          minlevel: Lexer.range(opts.minlevel, defaults.minlevel, 6),
          numbered: opts.numbered,
          omit: opts.omit
        })
        continue
      }
      // ppref
      if ((cap = this.rules.ppref.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'ppref'
        })
        continue
      }
      // html
      if ((cap = this.rules.html.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'html',
          pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
          text: cap[0]
        })
        continue
      }
      // def
      if (top && (cap = this.rules.def.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'def',
          ref: cap[1],
          href: cap[2],
          title: cap[3]
        })
        continue
      }
      // top-level paragraph
      if (top && ((cap = this.rules.paragraph.exec(src)))) {
        src = src.substring(cap[1].length)
        tmp = new InlineLexer(this.options)
        this.tokens.push({
          type: 'paragraph',
          text: cap[1],
          inline: tmp.lex(cap[1])
        })
        continue
      }
      // text
      if ((cap = this.rules.text.exec(src))) {
        // Top-level should never reach here.
        src = src.substring(cap[0].length)
        tmp = new InlineLexer(this.options)
        this.tokens.push({
          type: 'text',
          text: cap[0], // Todo run InlineLexer
          inline: tmp.lex(cap[0])
        })
        continue
      }
      // no match
      if (src) {
        // ~ console.log('-->', src); // TODO - debugging
        throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
      }
    }

    return this.tokens
  }

  /**
 * Expose Block Rules
 */
  Lexer.rules = block

  /**
 * Static Lex Method
 * @param {String} src - markdown source
 * @param {Object} options - options to overwrite
 * @param {Function} callback - `function(err, tokens)`
 */
  Lexer.lex = function (src, options, callback) {
    var lexer = new Lexer(options)
    var tokens = lexer.lex(src) // returns the lexed tokens
    ppInclude(tokens, options, function (err, tokens) {
      callback(err, tokens, options)
    })
  }

  /**
 * Split preproc command options
 * @param {String} str - string to split into key-value pairs
 */
  Lexer.splitOpts = function (str) {
    var opts = {}
    var sep
    var tmp = ''
    var KEY = /^(.+)$/
    var KEYVALUE = /^([a-z0-9]+)=(.*)$/
    var KEYVALUES = /^([a-z0-9]+)=(["'])(.*?)\2$/;

    (str || '').split(' ').forEach(function (s) {
      if (/\\$|^["'].*[^"']$/.test(s) || (sep && !sep.test(s))) {
        tmp += s + ' '
        return
      }
      if (/=(["']).*[^"']$/.test(s)) {
        sep = s.replace(/^.*=(["']).*[^"']$/, '$1')
        sep = new RegExp(sep + '$')
        tmp += s + ' '
        return
      }
      if (tmp) {
        s = tmp + s
        tmp = ''
        sep = undefined
      }
      if (KEYVALUES.test(s)) {
        s.replace(KEYVALUES, function (m, key, x, value) {
          opts[key] = value.split(';')
          opts[key] = opts[key].map(function (value) {
            if (/^\d+$/.test(value)) {
              var tmp = parseInt(value, 10)
              if (!isNaN(tmp)) {
                value = tmp
              }
            }
            return value
          })
          if (opts[key].length === 1) {
            opts[key] = opts[key][0]
          }
        })
      } else if (KEYVALUE.test(s)) {
        s.replace(KEYVALUE, function (m, key, value) {
          var tmp = parseInt(value, 10)
          if (!isNaN(tmp)) {
            value = tmp
          }
          opts[key] = value
        })
      } else if (KEY.test(s)) {
        s = s.replace(/\\ /g, ' ').replace(/^(["'])([^\1]+)\1$/, '$2')
        if (/^!(.*)$/.test(s)) {
          s = s.replace(/^!(.*)$/, '$1')
          opts[s] = false
        } else {
          opts[s] = true
        }
      }
    })

    return opts
  }

  /**
 * Limit the range of input value `val`
 * @param {Number} val - value to check
 * @param {Number} min - min allowed value
 * @param {Number} max - max allowed value
 * @param {Number|undefined} def - default value - if val === def then `undefined` is returned
 * @return {Number} ranged val
 */
  Lexer.range = function (val, min, max, def) {
    if (val < min) {
      return min
    } else if (val > max) {
      return max
    } else {
      if (def && val === def) {
        return undefined
      }
      return val
    }
  }

  /*
   * inline lexer rules
   */
  var inline = {
    escape: /^\\([\\`*{}[\]()#+\-.!_>])/,
    autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
    url: noop,
    tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
    link: /^(!)?\[(inside)\]\(href\)/,
    reflink: /^(!)?\[(inside)\]\s*\[([^\]]*)\]/,
    nolink: /^(!)?\[((?:\[[^\]]*\]|[^[\]])*)\]/,
    strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
    em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
    code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
    br: /^ {2,}\n(?!\s*$)/,
    del: noop,
    text: /^[\s\S]+?(?=[\\<![_*`]| {2,}\n|$)/,
    _inside: /(?:\[[^\]]*\]|[^[\]]|\](?=[^[]*\]))*/,
    _href: /\s*<?([\s\S]*?)>?(?:\s+(['"][\s\S]*?['"]))?\s*/
  }

  inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ()

  inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ()

  inline.opts = {}

  inline.opts.gfm = {
    escape: replace(inline.escape)('])', '~|])')(),
    url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
    del: /^~~(?=\S)([\s\S]*?\S)~~/,
    text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
  }

  inline.opts.breaks = {
    br: replace(inline.br)('{2,}', '*')(),
    text: replace(inline.opts.gfm.text)('{2,}', '*')()
  }

  /**
 * Inline Lexer
 * @constructor
 */
  function InlineLexer (options) {
    this.tokens = []
    this.options = options || defaults
    this.rules = inline
    if (this.options.gfm) {
      merge(this.rules, inline.opts.gfm)
    }
    if (this.options.breaks) {
      merge(this.rules, inline.opts.gfm, inline.opts.breaks)
    }
  }

  /**
 * Expose Inline Rules
 */
  InlineLexer.rules = inline

  /**
 * Static Lexing
 */
  InlineLexer.lex = function (src, options) {
    var inline = new InlineLexer(options)
    return inline.lex(src)
  }

  /**
 * Lexing
 */
  InlineLexer.prototype.lex = function (src) {
    var cap

    while (src) {
      // escape
      if ((cap = this.rules.escape.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'escape',
          text: cap[1]
        })
        continue
      }
      // url (gfm)
      if (!this.inLink && (cap = this.rules.url.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'url',
          text: cap[1]
        })
        continue
      }
      // tag
      if ((cap = this.rules.tag.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'tag',
          text: cap[0]
        })
        continue
      }
      // link
      if ((cap = this.rules.link.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: (cap[1] ? 'image' : 'link'),
          raw: cap[0],
          text: cap[2],
          href: cap[3],
          title: cap[4]
        })
        continue
      }
      // reflink
      if ((cap = this.rules.reflink.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: (cap[1] ? 'refimage' : 'reflink'),
          raw: cap[0],
          text: cap[2],
          ref: cap[3]
        })
        continue
      }
      // nolink
      if ((cap = this.rules.nolink.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: (cap[1] ? 'noimage' : 'nolink'),
          raw: cap[0],
          text: cap[2]
        })
        continue
      }
      // strong
      if ((cap = this.rules.strong.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'strong',
          text: cap[2] || cap[1],
          char: /^(..)/.exec(cap[0])[0]
        })
        continue
      }
      // em
      if ((cap = this.rules.em.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'em',
          text: cap[2] || cap[1],
          char: /^(.)/.exec(cap[0])[0]
        })
        continue
      }
      // code
      if ((cap = this.rules.code.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'code',
          text: cap[0]
        })
        continue
      }
      // br
      if ((cap = this.rules.br.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'br',
          text: cap[0]
        })
        continue
      }
      // del (gfm)
      if ((cap = this.rules.del.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'del',
          text: cap[1]
        })
        continue
      }
      // text
      if ((cap = this.rules.text.exec(src))) {
        src = src.substring(cap[0].length)
        this.tokens.push({
          type: 'text',
          text: cap[0]
        })
        continue
      }
      // no match
      if (src) {
        throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0))
      }
    }

    return this.tokens
  }

  /**
 * Number headings
 * @constructor
 * @api private
 */
  function Numbering (init) {
    this._ = [0, 0, 0, 0, 0, 0, 0]
    this.last = 1
    this._[1] = (init ? init - 1 : 0)
  }

  /**
 * Reset number array per level
 * @param {Number} level
 */
  Numbering.prototype.reset = function (level) {
    for (var i = level + 1; i < this._.length; i++) {
      this._[i] = 0
    }
  }

  /**
 * Generate output value for number
 * @param {Number} level
 * @return {String} number
 */
  Numbering.prototype.val = function (level) {
    var i
    var out = this._[1]

    for (i = 2; i <= level; i++) {
      out += '.' + this._[i]
    }
    return out + '\\.'
  }

  /**
 * Count up per level
 * @param {Number} level
 * @return {String} number
 */
  Numbering.prototype.count = function (level) {
    if (level <= 6) {
      if (this.last > level) {
        this.reset(level)
      }
      this._[level] += 1
      this.last = level
      return this.val(level)
    }
  }

  /**
 * Renderer
 * @constructor
 * @param {Object} options
 */
  function Renderer (options) {
    this.options = options || {}
  }

  /// / ---- block level

  /**
 * Render heading as markdown
 * @param {String} text - Heading text
 * @param {Number} level - Heading level
 * @param {String} raw - Raw heading text (without numbers)
 * @return {String} rendered output
 */
  Renderer.prototype.heading = function (text, level, raw, number, autoid, anchor) {
    var atx = ''
    if (anchor) {
      atx += '<a name="' + anchor + '"></a>\n'
    }
    atx += '########'.substring(0, level)
    return atx + ' ' + text + '\n'
  }

  /**
 * Render text
 * @param {String} text - text
 * @return {String} rendered output
 */
  Renderer.prototype.paragraph = function (text) {
    return text // TODO
  }

  /**
 * Render newline `<br>`
 * @param {String} text - text
 * @return {String} rendered output
 */
  Renderer.prototype.newline = function (text) {
    return text
  }

  /**
 * Renders a blockquote
 * @param {String} body - body of blockquote
 * @return {String} rendered output
 */
  Renderer.prototype.blockquote = function (body) {
    // ~ return body.replace(/\n/gm, '\n> ');
    return body.replace(/\n$/, '').replace(/^/gm, '> ') + '\n'
  }

  /**
 * Renders a list
 * @param {String} body - body of list
 * @return {String} rendered output
 */
  Renderer.prototype.list = function (body/*, ordered */) {
    return body.replace(/\n$/, '')
  }

  /**
 * Renders a listitem
 * @param {String} bullet - bullet char
 * @param {String} text - text of listitem
 * @return {String} rendered output
 */
  Renderer.prototype.listitem = function (bullet, text) {
    var i; var indent = ''
    bullet += ' '
    for (i = 0; i < bullet.length; i++) {
      indent += ' '
    }
    return bullet + text.replace(/\n(?!\n|$)/gm, '\n' + indent) + '\n'
  }

  /**
 * Render fenced code blocks
 * @param {String} code - code block
 * @param {String} lang - language of code block
 * @return {String} rendered output
 */
  Renderer.prototype.fences = function (code, lang, indent, fences) {
    return this.fence(lang, indent, fences) + code + '\n' + this.fence('', indent, fences)
  }

  /**
 * Render a single reference as markdown
 * @param {String} ref - reference name
 * @param {String} href - URL of reference
 * @param {String} title - Title of reference
 * @return {String} rendered output
 */
  Renderer.prototype.reference = function (ref, href, title) {
    return '[' + ref + ']: ' + href + (title ? ' "' + title + '"' : '') + '\n'
  }

  /**
 * Render a ppinclude which could not be resolved
 * @param {String} text - text
 * @param {String} indent - indent as whitespaces string
 * @param {String} lang - language of included file
 * @return {String} rendered output
 */
  Renderer.prototype.include = function (text, indent, lang) {
    return indent + '!include (' + text + (lang ? ' lang=' + lang : '') + ')\n'
  }

  /**
 * Render GFM fences
 * @param {String} lang - language of fences block
 * @return rendered output
 */
  Renderer.prototype.fence = function (lang, indent, fences) {
    fences = fences || '```'
    indent = indent || ''
    return indent + fences + (lang || '') + '\n'
  }

  /**
 * Render codeblock
 * @param {String} text - text
 * @return rendered output
 */
  Renderer.prototype.codeblock = function (text) {
    return text
  }
  /**
 * Render html
 * @param {String} text - text
 * @return rendered output
 */
  Renderer.prototype.html = function (text) {
    return text
  }
  /**
 * Render horizontal ruler
 * @param {String} text - text
 * @return rendered output
 */
  Renderer.prototype.hr = function (text) {
    return text
  }

  /// / ---- inline level

  Renderer.prototype.escape = function (text) {
    return '\\' + text
  }
  Renderer.prototype.url = function (text) {
    return text
  }
  Renderer.prototype.tag = function (text) {
    return text
  }
  Renderer.prototype.link = function (text, label, href, title) {
    return '[' + label + '](' + href + (title ? ' ' + title : '') + ')'
  }
  Renderer.prototype.reflink = function (text, label, ref) {
    return '[' + label + '][' + ref + ']'
  }
  Renderer.prototype.nolink = function (text, label) {
    return '[' + label + ']'
  }
  Renderer.prototype.image = function (text, label, href, title) {
    return '!' + this.link(text, label, href, title)
  }
  Renderer.prototype.refimage = function (text, label, ref) {
    return '!' + this.reflink(text, label, ref)
  }
  Renderer.prototype.noimage = function (text, label) {
    return '!' + this.nolink(text, label)
  }
  Renderer.prototype.strong = function (text, chars) {
    return chars + text + chars
  }
  Renderer.prototype.em = function (text, char) {
    return char + text + char
  }
  Renderer.prototype.del = function (text) {
    return '~~' + text + '~~'
  }
  Renderer.prototype.text = function (text) {
    return text
  }
  Renderer.prototype.br = function (text) {
    return text
  }
  Renderer.prototype.code = function (text) {
    return text
  }

  /**
   * Sorter to sort reference by title
   * @api private
   */
  Renderer.sortByTitle = function (a, b) {
    var _a = a.title.toLowerCase()
    var _b = b.title.toLowerCase()

    if (_a > _b) {
      return 1
    } else if (_a < _b) {
      return -1
    } else {
      return 0
    }
  }

  /**
   * Render all references
   * @param {Array} refs : Array of Objects `{ ref: {String}, href: {String}, title: {String} }`
   * @return {String} rendered output
   */
  Renderer.prototype.references = function (refs) {
    var out = []

    refs.map(function (ref) {
      if (!ref.title) {
        ref.title = ref.ref
      }
      return ref
    }).sort(Renderer.sortByTitle)
      .forEach(function (ref) {
        out.push('* [' + ref.title + '][' + ref.ref + ']')
      })
    if (this.options.tags) {
      return '<!-- !ref -->\n\n' + out.join('\n') + '\n\n<!-- ref! -->\n'
    } else {
      return out.join('\n') + '\n'
    }
  }

  /**
   * Render table of contents
   * @param {Array} toc - Array of Objects of type:
   * ```
   * { text: {String},
   *   depth: {Number}
   * }
   * ```
   * @param {Object} options - options
   * @param {Number} options.depth - show TOC up to depth
   * @param {Boolean} options.numbered - if true display numbered instead of bullet list
   * @return {String} rendered output
   */
  Renderer.prototype.tableOfContents = function (toc, options) {
    var self = this
    var omitlevel
    var out = []
    var opts = this.joinOpts({
      level: options.level,
      minlevel: options.minlevel,
      numbered: options.numbered,
      omit: options.omit
    })
    var numbering = new Numbering()
    var br = (this.options.breaks ? ' <br>' : '')
    var level = options.level || defaults.level // standard depth of TOC
    var minlevel = options.minlevel || defaults.minlevel //

    out = toc.filter(function (t) {
      if (t.depth <= level && t.depth >= minlevel) {
        return true
      }
      return false
    }).map(function (t) {
      if (!self.options.numberedHeadings && options.numbered) {
        t.number = numbering.count(t.depth - minlevel + 1)
      }
      return t
    }).filter(function (t) {
      if (options.omit) {
        if (omitlevel) { // omit the branch below as well...
          if (t.depth > omitlevel) {
            return false
          } else {
            omitlevel = undefined // reset
          }
        }
        return !options.omit.some(function (tt) {
          if (tt === t.raw) {
            omitlevel = t.depth
            return true
          }
          return false
        })
      }
      return true
    }).map(function (t) {
      if (options.numbered) {
        // render numbered list
        if (self.options.numberedHeadings) {
          return (t.number ? t.number + ' ' : '') +
          '[' + self.sanitizeHeadings(t.raw) + '](' + t.autoid + ')' + br
        } else {
          return t.number +
          ' [' + self.sanitizeHeadings(t.text) + '](' + t.autoid + ')' + br
        }
      } else {
        // render bullet list
        var space = ''
        for (var i = 1; i < (t.depth - minlevel + 1 || 1); i++) {
          space += '  '
        }
        return space + '* [' +
        self.sanitizeHeadings(t.text) + '](' + t.autoid + ')'
      }
    })

    if (this.options.tags) {
      return '<!-- !toc ' + opts + '-->\n\n' + out.join('\n') + '\n\n<!-- toc! -->\n\n'
    } else {
      return out.join('\n') + '\n\n'
    }
  }

  /**
   * Render numberedheadings command
   * @param {Number} maxLevel
   * @param {Number} minLevel
   * @return {String} rendered output
   */
  Renderer.prototype.numberedHeadings = function (maxLevel, minLevel, skip, start, omit) {
    var opts = this.joinOpts({
      level: maxLevel,
      minlevel: minLevel,
      skip: skip,
      start: start,
      omit: omit
    })
    if (this.options.tags) {
      return '<!-- !numberedheadings ' + opts + '-->\n\n'
    }
    return ''
  }

  Renderer.prototype.joinOpts = function (obj) {
    var key
    var val
    var tmp = []
    for (key in obj) {
      val = obj[key]
      if (val === true) {
        tmp.push(key)
      } else if (val !== undefined) {
        if (Array.isArray(val)) {
          val = '"' + val.join(';') + '"'
        }
        tmp.push(key + '=' + val)
      }
    }
    if (tmp.length > 0) {
      return '(' + tmp.join(' ') + ') '
    } else {
      return ''
    }
  }

  Renderer.prototype.sanitizeHeadings = function (heading) {
    return heading.replace(/\[([^\]]*)\]\s*(?:\[[^\]]*\]|\([^)]*\))/g, '$1')
  }

  /**
   * Parser
   * @constructor
   * @param {Object} options
   * @param {Object} options.renderer - Custom renderer
   */
  function Parser (options) {
    this.tokens = []
    this.token = null
    this.count = -1
    this.indent = []
    this.options = options || defaults
    this.options.renderer = this.options.renderer || new Renderer() // jshint ignore:line
    this.renderer = this.options.renderer
    this.renderer.options = this.options
  }

  /**
   * Parse Loop
   * @param {Array} tokens - Array of {Object} tokens:
   * ```
   * { type: {String} token type,
   *   ...: {*} other values
   * }
   * ```
   * @return {String} parsed output
   */
  Parser.prototype.parse = function (tokens) {
    this.tokens = tokens

    this.updateAutoIdentifier()

    var out = ''
    while (this.next()) {
      out += this.tok()
    }

    return out
  }

  /**
   * Next Token
   */
  Parser.prototype.next = function () {
    this.token = this.tokens[this.count += 1]
    return this.token
  }

  /**
   * Preview Next Token
   */
  Parser.prototype.peek = function () {
    return this.tokens[this.count + 1] || 0
  }

  /**
   * Parse references
   */
  Parser.prototype.references = function () {
    var i
    var refs = []
    var uniq = { title: {}, ref: {} }

    this.tokens.forEach(function (token) {
      if (token.type === 'def' && !/^#/.test(token.href)) {
        if (token.title) {
          uniq.title[token.ref] = token.title
        } else {
          uniq.ref[token.ref] = token.ref
        }
      }
    })

    for (i in uniq.title) {
      refs.push({
        ref: i,
        title: uniq.title[i]
      })
    }
    for (i in uniq.ref) {
      if (!uniq.title[i]) {
        refs.push({
          ref: i,
          title: i
        })
      }
    }

    return refs
  }

  /**
   * Parse Table of Contents
   */
  Parser.prototype.tableOfContents = function () {
    return this.tokens.filter(function (token) {
      if (token.type === 'heading') {
        return true
      }
      return false
    })
  }

  /**
   * Generate a internal reference id (method used by marked)
   *
   * @api private
   * @param {Object} token - parsed token
   * @param {Object} opts - options
   * @param {Boolean} opts.raw - if true use `token.raw` for id generation othewise `token.text` is used
   * @return {String} id
   */
  Parser.prototype.headingAutoId = function (token, opts) {
    opts = opts || { raw: false }
    var id = (!opts.raw ? token.text : token.raw || '').replace(/^#/, '')

    if (token.anchor) {
      return '#' + token.anchor
    }

    if (this.options.githubid) {
      // from https://github.com/thlorenz/anchor-markdown-header
      id = id.replace(/ /g, '-')
        .replace(/%([abcdef]|\d){2,2}/ig, '') // escape codes
        .replace(/[/?:[\]`.,()*"';{}+<>&]/g, '') // single chars that are removed
        .toLowerCase()
    } else {
      // marked
      id = id
        .replace(/[^\w]+/g, '-')
        .toLowerCase()
    }
    return '#' + id
  }

  /**
   * Update Auto Identifiers
   */
  Parser.prototype.updateAutoIdentifier = function () {
    var self = this
    var headings = {}

    // sanitize the id before lookup
    function prep (id) {
      id = id.replace(/(?:%20|\+)/g, ' ')
      id = self.headingAutoId({ text: id })
      return id
    }

    // obtain headings ids
    this.tokens = this.tokens.map(function (token) {
      var id,
        raw

      if (token.type === 'heading') {
        id = self.headingAutoId(token)
        raw = self.headingAutoId(token, { raw: true })
        headings[raw] = id
        headings[id] = id
        token.autoid = id
      }
      return token
    })

    this.tokens = this.tokens.map(function (token) {
      var id
      if (token.inline) {
        token.inline = token.inline.map(function (token) {
          switch (token.type) {
            case 'link':
            case 'image': {
              id = prep(token.href)
              if (headings[id]) {
                token.href = headings[id]
              }
              break
            }
          }
          return token
        })
      } else {
        switch (token.type) {
          case 'def': {
            if (token.href && token.href.indexOf('#') === 0) {
              id = prep(token.href)
              if (headings[id]) {
                token.href = headings[id]
              }
              break
            }
          }
        }
      }
      return token
    })
  }

  /**
   * Prepare headings text if numberedheadings option is set
   * updates all tokens containing headings
   * @param {Number} maxLevel
   * @param {Number} minLevel
   */
  Parser.prototype.numberedHeadings = function (maxLevel, minLevel, skip, start, omit) {
    var REMOVENUMBER = /^([0-9]+\\?\.)+ +/
    var omitMatch = {}
    var skipFlag = false
    var numbering = new Numbering(start)

    skip = skip || 0;

    (omit || []).forEach(function (key) {
      omitMatch[key] = true
    })

    maxLevel = maxLevel || defaults.level
    minLevel = minLevel || defaults.minlevel

    this.tokens = this.tokens.map(function (token) {
      if (token.type === 'heading') {
        token.text = token.text.replace(REMOVENUMBER, '')
        token.raw = token.raw.replace(REMOVENUMBER, '')

        if (token.depth === minLevel) {
          if (skip > 0) {
            skip -= 1
            skipFlag = true
          } else if (skip === 0) {
            skipFlag = false
          }
        }

        if (!skipFlag && !omitMatch[token.raw] && token.depth <= maxLevel && token.depth >= minLevel) {
          token.number = numbering.count(token.depth - minLevel + 1)
          token.text = token.number + ' ' + token.text
        }
      }
      return token
    })
  }

  /**
   * Parse Current Token
   */
  Parser.prototype.tok = function (options) {
    var obj
    var body
    var bullet
    var start
    var ordered
    var self = this
    options = options || {}

    switch (this.token.type) {
      case 'space': {
        return this.renderer.newline(this.token.text)
      }
      case 'code': {
        return this.renderer.codeblock(this.token.text)
      }
      case 'hr': {
        return this.renderer.hr(this.token.text)
      }
      case 'html': {
        return this.renderer.html(this.token.text)
      }
      case 'paragraph': {
        body = '';
        (this.token.inline || []).forEach(function (token) {
          body += self.inlinetok(token)
        })
        return this.renderer.paragraph(body)
      }
      case 'text': {
        body = '';
        (this.token.inline || []).forEach(function (token) {
          body += self.inlinetok(token)
        })
        return this.renderer.text(body)
      }
      case 'heading': {
        return this.renderer.heading(
          this.token.text,
          this.token.depth,
          this.token.raw,
          this.token.number,
          this.token.autoid,
          this.token.anchor)
      }
      case 'fences': {
        return this.renderer.fences(
          this.token.text,
          this.token.lang,
          this.token.indent,
          this.token.fences
        )
      }
      case 'def': {
        return this.renderer.reference(this.token.ref,
          this.token.href, this.token.title)
      }
      case 'blockquote_start': {
        body = ''

        while (this.next().type !== 'blockquote_end') {
          body += this.tok()
        }

        return this.renderer.blockquote(body)
      }
      case 'list_start': {
        body = ''
        ordered = this.token.ordered
        start = this.token.start

        while (this.next().type !== 'list_end') {
          if (this.options.autonumber && ordered) {
            obj = { start: start++ }
          }
          body += this.tok(obj)
        }

        return this.renderer.list(body, ordered)
      }
      case 'list_item_start': {
        body = ''
        bullet = this.token.text
        if (options.start) {
          bullet = options.start + '.'
        }
        while (this.next().type !== 'list_item_end') {
          body += this.tok()
        }

        return this.renderer.listitem(bullet, body)
      }
      case 'loose_item_start': {
        body = ''
        bullet = this.token.text
        if (options.start) {
          bullet = options.start + '.'
        }

        while (this.next().type !== 'list_item_end') {
          body += this.tok()
        }

        return this.renderer.listitem(bullet, body)
      }
      case 'ppnumberedheadings': {
        this.options.numberedHeadings = true
        this.numberedHeadings(
          this.token.level,
          this.token.minlevel,
          this.token.skip,
          this.token.start,
          this.token.omit
        )
        this.updateAutoIdentifier()
        return this.renderer.numberedHeadings(
          this.token.level,
          this.token.minlevel,
          this.token.skip,
          this.token.start,
          this.token.omit
        )
      }
      case 'ppref': {
        return this.renderer.references(this.references())
      }
      case 'ppinclude_start': {
        body = ''
        if (this.token.tags) {
          var indent = this.token.indent.replace('\t', '    ').length
          body += '<!-- include (' + this.token.text.replace(/ /g, '\\ ') +
          (this.token.lang ? ' lang=' + this.token.lang : '') +
          (indent ? ' indent=' + indent.toString() : '') +
          ') -->\n'
        }
        if (typeof this.token.lang === 'string') {
          body += this.renderer.fence(this.token.lang)
        }
        return body
      }
      case 'ppinclude_end': {
        body = ''
        if (typeof this.token.lang === 'string') {
          body += this.renderer.fence()
        }
        if (this.token.tags) {
          body += '<!-- /include -->\n'
        }
        return body
      }
      case 'ppinclude': {
        return this.renderer.include(this.token.text, this.token.indent, this.token.lang)
      }
      case 'pptoc': {
        return this.renderer.tableOfContents(
          this.tableOfContents(),
          this.token)
      }
      default: {
        return '<!-- ' + JSON.stringify(this.token) + ' -->\n'
      }
    }
  }

  /**
   * Parse inline tokens
   */
  Parser.prototype.inlinetok = function (token) {
    switch (token.type) {
      case 'escape': {
        return this.renderer.escape(token.text)
      }
      case 'url': {
        return this.renderer.url(token.text)
      }
      case 'tag': {
        return this.renderer.tag(token.text)
      }
      case 'link': {
        return this.renderer.link(token.raw, token.text, token.href, token.title)
      }
      case 'reflink': {
        return this.renderer.reflink(token.raw, token.text, token.ref)
      }
      case 'nolink': {
        return this.renderer.nolink(token.raw, token.text)
      }
      case 'image': {
        return this.renderer.image(token.raw, token.text, token.href, token.title)
      }
      case 'refimage': {
        return this.renderer.refimage(token.raw, token.text, token.ref)
      }
      case 'noimage': {
        return this.renderer.noimage(token.raw, token.text)
      }
      case 'strong': {
        return this.renderer.strong(token.text, token.char)
      }
      case 'em': {
        return this.renderer.em(token.text, token.char)
      }
      case 'text': {
        return this.renderer.text(token.text)
      }
      case 'code': {
        return this.renderer.code(token.text)
      }
      case 'br': {
        return this.renderer.br(token.text)
      }
      case 'del': {
        return this.renderer.del(token.text)
      }
      default: {
        return '<!-- ' + JSON.stringify(this.token) + ' -->\n'
      }
    }
  }

  /**
   * Static Parse Method
   * @param {Array} toc - Array of Objects of type:
   * ```
   * { text: {String} Name of Heading,
   *   depth: {Number} Level of Heading,
   *   raw: {String} Raw Name of Heading
   * }
   * ```
   * @param {Object} options - options
   * @return {String} preprocessed markdown
   */
  Parser.parse = function (tokens, options) {
    var parser = new Parser(options)
    return parser.parse(tokens)
  }

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

    Lexer.lex(src, options, function (err, tokens) {
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

  // Node.js
  if (isNodeJs()) {
    module.exports = markedpp
  } else if (typeof define !== 'undefined' && define.amd) {
    // AMD / RequireJS
    define([], function () {
      return markedpp
    })
  } else if (typeof ctx.Window !== 'undefined' && !ctx[markedpp]) {
    // included in browser via <script> tag
    ctx.markedpp = markedpp
  }
}(this))
