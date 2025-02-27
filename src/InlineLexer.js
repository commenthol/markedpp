import { inline } from './rules.js'
import { defaults } from './defaults.js'

/**
 * Inline Lexer
 * @constructor
 */
export function InlineLexer (options) {
  this.tokens = []
  this.options = options || defaults
  this.rules = inline
  if (this.options.gfm) {
    Object.assign(this.rules, inline.opts.gfm)
  }
  if (this.options.breaks) {
    Object.assign(this.rules, inline.opts.gfm, inline.opts.breaks)
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
  const inline = new InlineLexer(options)
  return inline.lex(src)
}

/**
 * Lexing
 */
InlineLexer.prototype.lex = function (src) {
  let cap

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
        type: cap[1] ? 'image' : 'link',
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
        type: cap[1] ? 'refimage' : 'reflink',
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
        type: cap[1] ? 'noimage' : 'nolink',
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
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
    }
  }

  return this.tokens
}
