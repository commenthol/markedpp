const InlineLexer = require('./InlineLexer')
const {
  block
} = require('./rules')
const {
  int,
  repeat
} = require('./utils')
const defaults = require('./defaults')

const KEY = /^(.+)$/
const KEYVALUE = /^([a-z0-9]+)=(.*)$/
const KEYVALUES = /^([a-z0-9]+)=(["'])(.*?)\2$/

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
    Object.assign(this.rules, block.opts.gfm)
  }
  if (this.options.include) {
    Object.assign(this.rules, block.opts.include)
  }
  if (this.options.numberedheadings) {
    Object.assign(this.rules, block.opts.numberedheadings)
  }
  if (this.options.toc) {
    Object.assign(this.rules, block.opts.toc)
  }
  if (this.options.ref) {
    Object.assign(this.rules, block.opts.ref)
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
  let cap,
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

      // remove all possible attributes: lang, indent, start, end, link, vscode
      tmp = tmp.replaceAll(/ *(?:[a-z]+="[a-zA-Z0-9- ]+")/g, '').replace(/\\ /g, ' ')
      tmp = tmp.replaceAll(/ *(?:[a-z]+=[a-z0-9-]+)/g, '').replace(/\\ /g, ' ')

      this.tokens.push({
        type: 'ppinclude',
        text: tmp,
        indent: opts.indent ? repeat(' ', opts.indent) : cap[1],
        lang: opts.lang,
        start: opts.start,
        end: opts.end,
        link: opts.link,
        vscode: opts.vscode
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
        if (this.options.smartlists && i !== l - 1) {
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
        opts.omit = [opts.omit]
      }
      this.options.numberedHeadings = true
      this.tokens.push({
        type: 'ppnumberedheadings',
        level: Lexer.range(opts.level, defaults.minlevel, 6, defaults.level),
        minlevel: Lexer.range(opts.minlevel, defaults.minlevel, 6),
        skip: opts.skip,
        start: opts.start,
        omit: opts.omit,
        skipEscaping: opts.skipEscaping
      })
      continue
    }
    // pptoc
    if ((cap = this.rules.pptoc.exec(src))) {
      src = src.substring(cap[0].length)
      opts = Lexer.splitOpts(cap[1] || cap[2])
      if (typeof opts.omit === 'string') {
        opts.omit = [opts.omit]
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
Lexer.lex = function (ppInclude, src, options, callback) {
  const lexer = new Lexer(options)
  const tokens = lexer.lex(src) // returns the lexed tokens
  if (options.include) {
    ppInclude(tokens, Lexer, options, function (err, tokens) {
      callback(err, tokens, options)
    })
  } else {
    callback(null, tokens, options)
  }
}

/**
 * Split preproc command options
 * @param {String} str - string to split into key-value pairs
 */
Lexer.splitOpts = function (str) {
  const opts = {}
  let sep
  let tmp = ''

  ;(str || '').split(' ').forEach(function (s) {
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
            const tmp = parseInt(value, 10)
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
        const tmp = parseInt(value, 10)
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

module.exports = Lexer
