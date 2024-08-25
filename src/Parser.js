const path = require('path')
const InlineLexer = require('./InlineLexer')
const Renderer = require('./Renderer')
const Numbering = require('./Numbering')
const defaults = require('./defaults')
const Anchor = require('./Anchor')
const { MODE } = require('./anchorSlugger')
MODE.UNIFIED = 'unified'

const REMOVENUMBER = /^([0-9]+\\?\.)+ +/

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

  this.anchorMode = [
    MODE.GHOST,
    MODE.BITBUCKET,
    MODE.GITLAB,
    MODE.GITHUB,
    MODE.PANDOC,
    MODE.UNIFIED,
    MODE.MARKDOWNIT,
    MODE.MARKED
  ].map(k => this.options[k] && k).filter(k => k)[0]
  if (this.anchorMode === MODE.UNIFIED) {
    this.anchorMode = MODE.GITHUB
  } this._anchors = new Anchor(this.anchorMode)
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

  let out = ''
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
  const refs = []
  const uniq = {
    title: {},
    ref: {}
  }

  this.tokens.forEach(function (token) {
    if (token.type === 'def' && !/^#/.test(token.href)) {
      if (token.title) {
        uniq.title[token.ref] = token.title
      } else {
        uniq.ref[token.ref] = token.ref
      }
    }
  })

  for (const i in uniq.title) {
    refs.push({
      ref: i,
      title: uniq.title[i]
    })
  }
  for (const i in uniq.ref) {
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
  return this.tokens.filter(token => {
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
  opts = opts || {
    raw: false
  }

  const inlineText = getInlineAnchorText(token, this.anchorMode)
  const header = (
    opts.raw
      ? token.raw
      : inlineText || token.text
  ).replace(/^#/, '')
  // increment header regardless if previous anchor was applied
  const id = this._anchors.get(header, opts.inc)

  if (token.anchor) {
    return token.anchor
  }

  return id
}

/**
 * Update Auto Identifiers
 */
Parser.prototype.updateAutoIdentifier = function () {
  const self = this
  const headings = {}
  this._anchors = new Anchor(this.anchorMode)

  // sanitize the id before lookup
  function prep (id) {
    id = id.replace(/(?:%20|\+)/g, ' ')
    id = self.headingAutoId({ text: id })
    return id
  }

  // obtain headings ids
  this.tokens = this.tokens.map(token => {
    if (token.type === 'heading') {
      const raw = this.headingAutoId(token, { raw: true }) // needs to come first because of counter increment
      const id = this.headingAutoId(token, { inc: true })
      headings[raw] = '#' + id
      headings[id] = '#' + id
      token.autoid = id
    }
    return token
  })

  this.tokens = this.tokens.map(function (token) {
    let id
    if (token.inline) {
      token.inline = token.inline.map(token => {
        switch (token.type) {
          case 'link':
          case 'image':
          {
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
        case 'def':
        {
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
Parser.prototype.numberedHeadings = function (maxLevel, minLevel, skip, start, omit, skipEscaping) {
  const omitMatch = {}
  let skipFlag = false
  const numbering = new Numbering(start, skipEscaping)

  skip = skip || 0

  ;(omit || []).forEach(function (key) {
    omitMatch[key] = true
  })

  maxLevel = maxLevel || defaults.level
  minLevel = minLevel || defaults.minlevel

  this.tokens = this.tokens.map(token => {
    if (token.type === 'heading') {
      token.text = token.text.replace(REMOVENUMBER, '')
      const tmp = token.raw.replace(REMOVENUMBER, '')
      if (tmp !== token.raw && token.inline) {
        // need to re-lex the inline tokens
        token.inline = new InlineLexer(this.options).lex(tmp)
      }
      token.raw = tmp

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
        const text = token.number + ' '
        token.text = text + token.text
        if (token.inline) {
          token.inline.unshift({ type: 'text', text })
        }
      }
    }
    return token
  })
}

/**
 * Parse Current Token
 */
Parser.prototype.tok = function (options) {
  options = options || {}

  switch (this.token.type) {
    case 'space':
    {
      return this.renderer.newline(this.token.text)
    }
    case 'code':
    {
      return this.renderer.codeblock(this.token.text)
    }
    case 'hr':
    {
      return this.renderer.hr(this.token.text)
    }
    case 'html':
    {
      return this.renderer.html(this.token.text)
    }
    case 'paragraph':
    {
      let body = ''
      ;(this.token.inline || []).forEach(token => {
        body += this.inlinetok(token)
      })
      return this.renderer.paragraph(body)
    }
    case 'text':
    {
      let body = ''
      ;(this.token.inline || []).forEach(token => {
        body += this.inlinetok(token)
      })
      return this.renderer.text(body)
    }
    case 'heading':
    {
      return this.renderer.heading(
        this.token.text,
        this.token.depth,
        this.token.raw,
        this.token.number,
        this.token.autoid,
        this.token.anchor)
    }
    case 'fences':
    {
      return this.renderer.fences(
        this.token.text,
        this.token.lang,
        this.token.indent,
        this.token.fences
      )
    }
    case 'def':
    {
      return this.renderer.reference(this.token.ref,
        this.token.href, this.token.title)
    }
    case 'blockquote_start':
    {
      let body = ''

      while (this.next().type !== 'blockquote_end') {
        body += this.tok()
      }

      return this.renderer.blockquote(body)
    }
    case 'list_start':
    {
      let obj
      let body = ''
      const ordered = this.token.ordered
      let start = this.token.start

      while (this.next().type !== 'list_end') {
        if (this.options.autonumber && ordered) {
          obj = {
            start: start++
          }
        }
        body += this.tok(obj)
      }

      return this.renderer.list(body, ordered)
    }
    case 'list_item_start':
    {
      let body = ''
      let bullet = this.token.text
      if (options.start) {
        bullet = options.start + '.'
      }
      while (this.next().type !== 'list_item_end') {
        body += this.tok()
      }

      return this.renderer.listitem(bullet, body)
    }
    case 'loose_item_start':
    {
      let body = ''
      let bullet = this.token.text
      if (options.start) {
        bullet = options.start + '.'
      }

      while (this.next().type !== 'list_item_end') {
        body += this.tok()
      }

      return this.renderer.listitem(bullet, body)
    }
    case 'ppnumberedheadings':
    {
      this.options.numberedHeadings = true
      this.numberedHeadings(
        this.token.level,
        this.token.minlevel,
        this.token.skip,
        this.token.start,
        this.token.omit,
        this.token.skipEscaping
      )
      this.updateAutoIdentifier()
      return this.renderer.numberedHeadings(
        this.token.level,
        this.token.minlevel,
        this.token.skip,
        this.token.start,
        this.token.omit,
        this.token.skipEscaping
      )
    }
    case 'ppref':
    {
      return this.renderer.references(this.references())
    }
    case 'ppinclude_start':
    {
      let body = ''
      if (this.token.tags) {
        const indent = this.token.indent.replace('\t', '    ').length
        body += '<!-- include (' + this.token.text.replace(/ /g, '\\ ') +
            (this.token.lang ? ' lang=' + this.token.lang : '') +
            (indent ? ' indent=' + indent.toString() : '') +
            (this.token.start ? ' start=' + this.token.start : '') +
            (this.token.end ? ' end=' + this.token.end : '') +
            ') -->\n'
      }
      if (typeof this.token.lang === 'string') {
        body += this.renderer.fence(this.token.lang)
      }
      return body
    }
    case 'ppinclude_end':
    {
      let body = ''
      if (typeof this.token.lang === 'string') {
        body += this.renderer.fence()
      }
      if (this.token.tags) {
        body += '<!-- /include -->\n'
      }
      if (this.token.link) {
        body += this.renderer.link(this.token.raw, this.token.link, this.token.text) + '\n'
      }
      if (this.token.vscode) {
        const dirname = this.token.dirname || process.cwd()
        const file = path.resolve(path.join(dirname, this.token.text))

        /* vscode url format is an absolute path with a file:// scheme */
        const uri = 'vscode://file/' + file + (this.token.start ? ':' + this.token.start + ':1' : '')
        body += this.renderer.link(this.token.raw, this.token.vscode, uri) + '\n'
      }
      return body
    }
    case 'ppinclude':
    {
      return this.renderer.include(this.token.text, this.token.indent, this.token.lang)
    }
    case 'pptoc':
    {
      return this.renderer.tableOfContents(
        this.tableOfContents(),
        this.token)
    }
    default:
    {
      return '<!-- ' + JSON.stringify(this.token) + ' -->\n'
    }
  }
}

/**
 * Parse inline tokens
 */
Parser.prototype.inlinetok = function (token) {
  switch (token.type) {
    case 'escape':
    {
      return this.renderer.escape(token.text)
    }
    case 'url':
    {
      return this.renderer.url(token.text)
    }
    case 'tag':
    {
      return this.renderer.tag(token.text)
    }
    case 'link':
    {
      return this.renderer.link(token.raw, token.text, token.href, token.title)
    }
    case 'reflink':
    {
      return this.renderer.reflink(token.raw, token.text, token.ref)
    }
    case 'nolink':
    {
      return this.renderer.nolink(token.raw, token.text)
    }
    case 'image':
    {
      return this.renderer.image(token.raw, token.text, token.href, token.title)
    }
    case 'refimage':
    {
      return this.renderer.refimage(token.raw, token.text, token.ref)
    }
    case 'noimage':
    {
      return this.renderer.noimage(token.raw, token.text)
    }
    case 'strong':
    {
      return this.renderer.strong(token.text, token.char)
    }
    case 'em':
    {
      return this.renderer.em(token.text, token.char)
    }
    case 'text':
    {
      return this.renderer.text(token.text)
    }
    case 'code':
    {
      return this.renderer.code(token.text)
    }
    case 'br':
    {
      return this.renderer.br(token.text)
    }
    case 'del':
    {
      return this.renderer.del(token.text)
    }
    default:
    {
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
  const parser = new Parser(options)
  return parser.parse(tokens)
}

/**
 * @api private
 */
function getInlineAnchorText (token, mode) {
  if (token.inline) {
    let text = token.inline.map(token => {
      let text = token.text

      // sanitation for different anchor modes
      if (mode === MODE.MARKDOWNIT && token.type === 'code') {
        text = text.replace(/`/g, '')
      } else if ([MODE.GITHUB, MODE.GITLAB, MODE.PANDOC].includes(mode) && token.type === 'tag') {
        text = ''
      } else if (mode === MODE.BITBUCKET && token.type === 'escape') {
        text = '\\' + text
      }

      return text
    }).join('')

    if (mode === MODE.PANDOC) { // no numbering!
      text = text.replace(REMOVENUMBER, '')
    }
    return text
  }
}

module.exports = Parser
