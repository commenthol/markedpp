const Renderer = require('./Renderer')
const Numbering = require('./Numbering')
const defaults = require('./defaults')
const anchor = require('./anchor')

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

  if (this.options.githubid) {
    this.options.anchor = 'github'
  }
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
  var uniq = {
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
  opts = opts || {
    raw: false
  }

  if (token.anchor) {
    return '#' + token.anchor
  }

  const _id = (!opts.raw ? token.text : token.raw || '').replace(/^#/, '')
  const id = anchor(_id, this.options.anchor)
  return id
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
    id = self.headingAutoId({
      text: id
    })
    return id
  }

  // obtain headings ids
  this.tokens = this.tokens.map(function (token) {
    var id,
      raw

    if (token.type === 'heading') {
      id = self.headingAutoId(token)
      raw = self.headingAutoId(token, {
        raw: true
      })
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
      body = '';
      (this.token.inline || []).forEach(function (token) {
        body += self.inlinetok(token)
      })
      return this.renderer.paragraph(body)
    }
    case 'text':
    {
      body = '';
      (this.token.inline || []).forEach(function (token) {
        body += self.inlinetok(token)
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
      body = ''

      while (this.next().type !== 'blockquote_end') {
        body += this.tok()
      }

      return this.renderer.blockquote(body)
    }
    case 'list_start':
    {
      body = ''
      ordered = this.token.ordered
      start = this.token.start

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
    case 'loose_item_start':
    {
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
    case 'ppnumberedheadings':
    {
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
    case 'ppref':
    {
      return this.renderer.references(this.references())
    }
    case 'ppinclude_start':
    {
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
    case 'ppinclude_end':
    {
      body = ''
      if (typeof this.token.lang === 'string') {
        body += this.renderer.fence()
      }
      if (this.token.tags) {
        body += '<!-- /include -->\n'
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
  var parser = new Parser(options)
  return parser.parse(tokens)
}

module.exports = Parser
