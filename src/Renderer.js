const Numbering = require('./Numbering')
const defaults = require('./defaults')

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
  let atx = ''
  if (anchor) {
    atx += '<a name="' + anchor + '"></a>\n'
  } else if (this.options.autoid && autoid) {
    atx += '<a name="' + autoid + '"></a>\n'
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
Renderer.prototype.list = function (body /*, ordered */) {
  return body.replace(/\n$/, '')
}

/**
 * Renders a listitem
 * @param {String} bullet - bullet char
 * @param {String} text - text of listitem
 * @return {String} rendered output
 */
Renderer.prototype.listitem = function (bullet, text) {
  let indent = ''
  bullet += ' '
  for (let i = 0; i < bullet.length; i++) {
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
  const _a = a.title.toLowerCase()
  const _b = b.title.toLowerCase()

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
  const out = []

  refs.map(ref => {
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
  let omitlevel
  const opts = this.joinOpts({
    level: options.level,
    minlevel: options.minlevel,
    numbered: options.numbered,
    omit: options.omit
  })
  const numbering = new Numbering()
  const br = (this.options.breaks ? ' <br>' : '')
  const level = options.level || defaults.level // standard depth of TOC
  const minlevel = options.minlevel || defaults.minlevel //

  const renderLink = (text, autoid) => '[' + this.sanitizeHeadings(text) + '](#' + autoid + ')'

  const out = toc.filter(t => {
    if (t.depth <= level && t.depth >= minlevel) {
      return true
    }
    return false
  }).map(t => {
    if (!this.options.numberedHeadings && options.numbered) {
      t.number = numbering.count(t.depth - minlevel + 1)
    }
    return t
  }).filter(t => {
    if (options.omit) {
      if (omitlevel) { // omit the branch below as well...
        if (t.depth > omitlevel) {
          return false
        } else {
          omitlevel = undefined // reset
        }
      }
      return !options.omit.some(tt => {
        if (tt === t.raw) {
          omitlevel = t.depth
          return true
        }
        return false
      })
    }
    return true
  }).map(t => {
    if (options.numbered) {
      // render numbered list
      if (this.options.numberedHeadings) {
        return (t.number ? t.number + ' ' : '') + renderLink(t.raw, t.autoid) + br
      } else {
        return t.number + ' ' + renderLink(t.text, t.autoid) + br
      }
    } else {
      // render bullet list
      let space = ''
      for (let i = 1; i < (t.depth - minlevel + 1 || 1); i++) {
        space += '  '
      }
      return space + '* ' + renderLink(t.text, t.autoid)
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
  const opts = this.joinOpts({
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
  const tmp = []
  for (let key in obj) {
    let val = obj[key]
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

module.exports = Renderer
