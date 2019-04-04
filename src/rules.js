/* eslint-disable func-call-spacing, no-unexpected-multiline */

function noop () {}
noop.exec = noop

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

module.exports = {
  block,
  inline
}

// if (typeof require !== "undefined" && require.main === module) console.log(block); // TODO - debugging
