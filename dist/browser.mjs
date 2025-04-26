/* globals XMLHttpRequest,location */

/* generate a unique key for partial include file names that incorporates the start/end values */
function getUniqueFileName (token) {
  return (
    token.text +
    '(start=' +
    (token.start || '') +
    'end=' +
    (token.end || '') +
    ')'
  )
}

function partialInclude (src, start, end) {
  if (Number.isInteger(start) || Number.isInteger(end)) {
    const srcLines = src.split('\n');
    const firstLine = Number.isInteger(start) && start > 0 ? start - 1 : 0;
    const lastLine = Number.isInteger(end) && end > 0 ? end : srcLines.length;

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
    let up = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const last = parts[i];
      if (last === '.') {
        parts.splice(i, 1);
      } else if (last === '..') {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..');
      }
    }

    return parts
  },
  resolve: function () {
    let resolvedPath = '';
    let resolvedAbsolute = false;

    for (let i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      const path = i >= 0 ? arguments[i] : '/';

      // Skip empty and invalid entries
      if (!path) {
        continue
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charAt(0) === '/';
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = this.normalizeArray(
      resolvedPath.split('/').filter(function (p) {
        return !!p
      }),
      !resolvedAbsolute
    ).join('/');

    return (resolvedAbsolute ? '/' : '') + resolvedPath || '.'
  },
  splitPathRe: /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/,
  splitPath: function (filename) {
    return this.splitPathRe.exec(filename).slice(1)
  },
  dirname: function (path) {
    const result = this.splitPath(path);
    const root = result[0];
    let dir = result[1];

    if (!root && !dir) {
      // No dirname whatsoever
      return '.'
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }

    return root + dir
  },
  join: function () {
    return Array.prototype.slice.call(arguments).join('/')
  }
};

/*
 * code from <https://github.com/caolan/async.git>
 * @credits Caolan McMahon
 */
const async = {
  _eachLimit: function (limit) {
    return function (arr, iterator, callback) {
      callback = callback || function () {};
      if (!arr.length || limit <= 0) {
        return callback()
      }
      let completed = 0;
      let started = 0;
      let running = 0

      ;(function replenish () {
        if (completed >= arr.length) {
          return callback()
        }

        while (running < limit && started < arr.length) {
          started += 1;
          running += 1;
          iterator(arr[started - 1], function (err) {
            if (err) {
              callback(err);
              callback = function () {};
            } else {
              completed += 1;
              running -= 1;
              if (completed >= arr.length) {
                callback();
              } else {
                replenish();
              }
            }
          }); // jshint ignore:line
        }
      })();
    }
  },
  eachLimit: function (arr, limit, iterator, callback) {
    const fn = this._eachLimit(limit);
    fn(arr, iterator, callback);
  }
};

/*
 * XHR Request
 * adapted code from <https://github.com/xui/xui/blob/master/src/js/xhr.js>
 * @credits Brian LeRoux, Brock Whitten, Rob Ellis
 */
function xhr (url, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  const o = options || {};
  const req = new XMLHttpRequest();
  const method = o.method || 'get';
  const params = o.data || null;

  req.queryString = params;
  req.open(method, url, true);
  req.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

  if (method.toLowerCase() === 'post') {
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  }

  for (const key in o.headers) {
    if (Object.prototype.hasOwnProperty.call(o.headers, key)) {
      req.setRequestHeader(key, o.headers[key]);
    }
  }

  function stateChange () {
    if (req.readyState === 4) {
      if (/^[20]/.test(req.status)) {
        callback(null, req.responseText);
      } else if (/^[45]/.test(req.status)) {
        callback(new Error(req.status));
      }
    }
  }

  req.onreadystatechange = stateChange;

  try {
    req.send(params);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Error: Resolving URL ' + url);
    callback(e);
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
  const dirname = options.dirname || path.dirname(location.pathname);
  const lexed = {};
  const _options = Object.assign({}, options);
  _options.tags = false;

  // ppInclude is used to detect recursions
  if (!_options.ppInclude) {
    _options.ppInclude = {};
  }

  async.eachLimit(
    tokens,
    5,
    function (token, done) {
      const text = getUniqueFileName(token);
      if (
        token.type === 'ppinclude' &&
        typeof token.text === 'string' &&
        !_options.ppInclude[text]
      ) {
        const path_ = path.resolve(path.join(dirname, token.text));
        const url = location.protocol + '//' + location.host + path_;

        xhr(url, function (err, src) {
          _options.ppInclude[text] = 1;
          _options.dirname = path.dirname(path_);
          if (err) {
            // eslint-disable-next-line no-console
            console.log('Error: ' + err.message);
            return done()
          }

          src = partialInclude(src, token.start, token.end);

          const lexer = new Lexer(_options);
          const sep = '\n' + token.indent;
          src = token.indent + src.split('\n').join(sep);
          if (src.substr(0 - sep.length) === sep) {
            src = src.substr(0, src.length - sep.length + 1);
          }
          ppInclude(lexer.lex(src), Lexer, _options, function (err, ntokens) {
            // make token.text unique if include details differ
            lexed[text] = ntokens;
            done();
          });
        });
      } else {
        done();
      }
    },
    function () {
      const _tokens = [];

      // compose the new tokens array
      tokens.forEach(function (token) {
        const text = getUniqueFileName(token);
        const dirname = options.dirname || '';
        const vscodefile = token.vscode
          ? path.resolve(path.join(dirname, token.text))
          : undefined;

        if (
          token.type === 'ppinclude' &&
          typeof token.text === 'string' &&
          lexed[text] !== undefined
        ) {
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
          });
          lexed[text].forEach(function (token) {
            _tokens.push(Object.assign({}, token)); // clone tokens!
          });
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
          });
        } else {
          _tokens.push(token);
        }
      });
      callback(null, _tokens);
    }
  );
}

/* eslint-disable func-call-spacing, no-unexpected-multiline */

function noop () {}
noop.exec = noop;

/**
 * @param {RegExp} regex
 * @param {string} [opt]
 * @returns {function}
 */
function replace (regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self (name, val) {
    if (!name) return new RegExp(regex, opt)
    val = val.source || val;
    val = val.replace(/(^|[^[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self
  }
}

/*
 * block lexer rules
 */
const block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^headingid *(#{1,6}) *([^\n]+?) *#* *(?:\n|$)/,
  lheading: /^headingid([^\n]+)\n *(=|-){2,} *(?:\n|$)/,
  headingid: /(?: *<a name="([^"]+)" *(?:\/>|> *<\/a>|>) *\n{1,2})?/,
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
};

// join the rules
block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, 'gm')(/bull/g, block.bullet)();

block.list = replace(block.list)(/bull/g, block.bullet)(
  'hr',
  '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))'
)('def', '\\n+(?=' + block.def.source + ')')();

block.blockquote = replace(block.blockquote)('def', block.def)();

block.heading = replace(block.heading)('headingid', block.headingid)();
block.lheading = replace(block.lheading)('headingid', block.headingid)();

// list of allowed tags - TODO
// ~ block._tag = '(?!(?:' +
// ~ 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' +
// ~ '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' +
// ~ '|span|br|wbr|ins|del|img|x-[a-z]+)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

// allow all tags
block._tag = '(?!(?:[A-Za-z][A-Za-z-]*)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

block.html = replace(block.html)('comment', /<!--[\s\S]*?-->/)(
  'closed',
  /<(tag)[\s\S]+?<\/\1>/
)('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)(/tag/g, block._tag)();

block.paragraph = replace(block.paragraph)('hr', block.hr)(
  'heading',
  block.heading
)('lheading', block.lheading)('blockquote', block.blockquote)(
  // ~ ('list', block.list) // TODO - ok according to commonmark
  'tag',
  '<' + block._tag
)('def', block.def)();

block.opts = {};

block.opts.gfm = {
  fences: /^( *)(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\2 *(?:\n|$)/
};

/*
 * preprocessor rules
 */
const preproc = {
  _ppopts_: / ?(?:\(([^)]+)\))?/,

  ppinclude:
    /^( *)(?:!(?:include)_ppopts_|_ppinclude_|_ppincludeCompat_) *(?:\n|$)/,
  _ppinclude_:
    /<!-- *include_ppopts_ *-->(?:(?!<!-- *\/include * -->)[^])*<!-- *\/include * -->/,
  _ppincludeCompat_: /!INCLUDE "([^"]+)"/,

  ppnumberedheadings:
    /^ *(?:!(?:numberedheadings)_ppopts_|_ppnumberedheadings_) *(?:\n+|$)/,
  _ppnumberedheadings_: /<!-- !*numberedheadings_ppopts_ *-->/,

  pptoc:
    /^(?:!(?:toc)_ppopts_|_pptoc_|_pptocCompat1_|_pptocCompat2_|_pptocCompat3_|_pptocCompat4_) *(?:\n+|$)/,
  _pptoc_:
    /<!-- *!toc_ppopts_ *-->(?:(?!<!-- *toc! * -->)[^])*<!-- *toc! * -->/,
  _pptocCompat1_: /!TOC/,
  _pptocCompat2_:
    /<!-- *toc *-->(?:(?!<!-- *(?:\/toc|toc stop) * -->)[^])*<!-- *(?:\/toc|toc stop) * -->/, // marked-toc, markdown-pp syntax
  _pptocCompat3_: /<!-- *toc *-->/,
  _pptocCompat4_: /\[\[TOC\]\]/,

  ppref: /^(?:!(?:ref)|_ppref_|_pprefCompat1_|_pprefCompat2_) *(?:\n|$)/,
  _ppref_: /<!-- *!ref *-->(?:(?!<!-- *ref! * -->)[^])*<!-- *ref! * -->/,
  _pprefCompat1_: /!REF/,
  _pprefCompat2_: /<!-- *ref *-->(?:(?!<!-- *\/ref * -->)[^])*<!-- \/ref * -->/
};

preproc.ppinclude = replace(preproc.ppinclude)(
  '_ppinclude_',
  preproc._ppinclude_
)('_ppincludeCompat_', preproc._ppincludeCompat_)('_ppopts_', preproc._ppopts_)(
  '_ppopts_',
  preproc._ppopts_
)();
preproc.ppnumberedheadings = replace(preproc.ppnumberedheadings)(
  '_ppnumberedheadings_',
  preproc._ppnumberedheadings_
)('_ppopts_', preproc._ppopts_)('_ppopts_', preproc._ppopts_)();
preproc.pptoc = replace(preproc.pptoc)('_pptoc_', preproc._pptoc_)(
  '_ppopts_',
  preproc._ppopts_
)('_ppopts_', preproc._ppopts_)('_pptocCompat1_', preproc._pptocCompat1_)(
  '_pptocCompat2_',
  preproc._pptocCompat2_
)('_pptocCompat3_', preproc._pptocCompat3_)(
  '_pptocCompat4_',
  preproc._pptocCompat4_
)();
preproc.ppref = replace(preproc.ppref)('_ppref_', preproc._ppref_)(
  '_pprefCompat1_',
  preproc._pprefCompat1_
)('_pprefCompat2_', preproc._pprefCompat2_)();

block.opts.include = {
  ppinclude: preproc.ppinclude
};
block.opts.numberedheadings = {
  ppnumberedheadings: preproc.ppnumberedheadings
};
block.opts.toc = {
  pptoc: preproc.pptoc
};
block.opts.ref = {
  ppref: preproc.ppref
};

/*
 * inline lexer rules
 */
const inline = {
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
};

inline.link = replace(inline.link)('inside', inline._inside)(
  'href',
  inline._href
)();

inline.reflink = replace(inline.reflink)('inside', inline._inside)();

inline.opts = {};

inline.opts.gfm = {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)(']|', '~]|')('|', '|https?://|')()
};

inline.opts.breaks = {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.opts.gfm.text)('{2,}', '*')()
};

// console.log(block); // TODO - debugging

/*
 * default values
 */
const defaults = {
  gfm: true, // consider gfm fences
  include: true, // enable !includes
  toc: true, // enable !toc
  numberedheadings: true, // enable !numberedheadings
  ref: true, // enable !ref

  breaks: true, // render <br> tags for Table of Contents with numbered style
  tags: true, // render pre-proc tags <!-- !command -->
  level: 3, // default level for !toc and !numberheadings
  minlevel: 1, // default minlevel for !toc and !numberheadings
  smartlists: false, // add newline on joined bullet lists using different bullet chars

  autonumber: true, // renumber lists
  autoid: false, // update identifiers on headings automatically (adds <a name=> anchors)
  // anchor mode for heading auto identifiers
  marked: true,
  markdownit: false,
  unified: false, // same as github
  pandoc: false,
  github: false,
  gitlab: false,
  bitbucket: false,
  ghost: false
};

/**
 * Inline Lexer
 * @constructor
 */
function InlineLexer (options) {
  this.tokens = [];
  this.options = options || defaults;
  this.rules = inline;
  if (this.options.gfm) {
    Object.assign(this.rules, inline.opts.gfm);
  }
  if (this.options.breaks) {
    Object.assign(this.rules, inline.opts.gfm, inline.opts.breaks);
  }
}

/**
 * Expose Inline Rules
 */
InlineLexer.rules = inline;

/**
 * Static Lexing
 */
InlineLexer.lex = function (src, options) {
  const inline = new InlineLexer(options);
  return inline.lex(src)
};

/**
 * Lexing
 */
InlineLexer.prototype.lex = function (src) {
  let cap;

  while (src) {
    // escape
    if ((cap = this.rules.escape.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'escape',
        text: cap[1]
      });
      continue
    }
    // url (gfm)
    if (!this.inLink && (cap = this.rules.url.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'url',
        text: cap[1]
      });
      continue
    }
    // tag
    if ((cap = this.rules.tag.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'tag',
        text: cap[0]
      });
      continue
    }
    // link
    if ((cap = this.rules.link.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: cap[1] ? 'image' : 'link',
        raw: cap[0],
        text: cap[2],
        href: cap[3],
        title: cap[4]
      });
      continue
    }
    // reflink
    if ((cap = this.rules.reflink.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: cap[1] ? 'refimage' : 'reflink',
        raw: cap[0],
        text: cap[2],
        ref: cap[3]
      });
      continue
    }
    // nolink
    if ((cap = this.rules.nolink.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: cap[1] ? 'noimage' : 'nolink',
        raw: cap[0],
        text: cap[2]
      });
      continue
    }
    // strong
    if ((cap = this.rules.strong.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'strong',
        text: cap[2] || cap[1],
        char: /^(..)/.exec(cap[0])[0]
      });
      continue
    }
    // em
    if ((cap = this.rules.em.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'em',
        text: cap[2] || cap[1],
        char: /^(.)/.exec(cap[0])[0]
      });
      continue
    }
    // code
    if ((cap = this.rules.code.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        text: cap[0]
      });
      continue
    }
    // br
    if ((cap = this.rules.br.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'br',
        text: cap[0]
      });
      continue
    }
    // del (gfm)
    if ((cap = this.rules.del.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'del',
        text: cap[1]
      });
      continue
    }
    // text
    if ((cap = this.rules.text.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
      continue
    }
    // no match
    if (src) {
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
    }
  }

  return this.tokens
};

/**
 * @param {string} str
 * @param {boolean} [undef]
 * @returns
 */
function int (str, undef) {
  const num = parseInt(str, 10);
  if (isNaN(num)) {
    {
      return
    }
  }
  return num
}

/**
 * @param {string} str
 * @param {number} [times=1]
 * @returns
 */
function repeat (str, times) {
  times = times || 1;
  let ret = '';
  for (let i = 0; i < times; i++) {
    ret += str;
  }
  return ret
}

const KEY = /^(.+)$/;
const KEYVALUE = /^([a-z0-9]+)=(.*)$/;
const KEYVALUES = /^([a-z0-9]+)=(["'])(.*?)\2$/;

/**
 * Lexer
 * @constructor
 * @param {Object} options - overwrites default options
 */
function Lexer (options) {
  this.tokens = [];
  this.options = options || defaults;
  this.rules = block;
  if (this.options.gfm) {
    Object.assign(this.rules, block.opts.gfm);
  }
  if (this.options.include) {
    Object.assign(this.rules, block.opts.include);
  }
  if (this.options.numberedheadings) {
    Object.assign(this.rules, block.opts.numberedheadings);
  }
  if (this.options.toc) {
    Object.assign(this.rules, block.opts.toc);
  }
  if (this.options.ref) {
    Object.assign(this.rules, block.opts.ref);
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
    .replace(/\u2424/g, '\n');

  // ~ src = src.replace(/\n/g, '↩\n').replace(/ /g, '·') // TODO - debugging
  return this.token(src, true)
};

/**
 * Lexing
 * @param {String} src - markdown source
 * @param {Boolean} top -
 * @return {Array} - array of tokens
 */
Lexer.prototype.token = function (src, top) {
  let cap, bull, next, l, b, i, item, space, loose, bq, tmp, opts;

  while (src) {
    // newline
    if ((cap = this.rules.newline.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'space',
        text: cap[0]
      });
    }
    // ppinclude
    if ((cap = this.rules.ppinclude.exec(src))) {
      src = src.substring(cap[0].length);
      tmp = cap[2] || cap[3] || cap[4];
      opts = Lexer.splitOpts(tmp);

      // remove all possible attributes: lang, indent, start, end, link, vscode
      tmp = tmp
        .replaceAll(/ *(?:[a-z]+="[a-zA-Z0-9- ]+")/g, '')
        .replace(/\\ /g, ' ');
      tmp = tmp.replaceAll(/ *(?:[a-z]+=[a-z0-9-]+)/g, '').replace(/\\ /g, ' ');

      this.tokens.push({
        type: 'ppinclude',
        text: tmp,
        indent: opts.indent ? repeat(' ', opts.indent) : cap[1],
        lang: opts.lang,
        start: opts.start,
        end: opts.end,
        link: opts.link,
        vscode: opts.vscode
      });
      continue
    }
    // code
    if ((cap = this.rules.code.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        text: cap[0]
      });
      continue
    }
    // fences (gfm)
    if ((cap = this.rules.fences.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'fences',
        indent: cap[1],
        fences: cap[2],
        lang: cap[3],
        text: cap[4]
      });
      continue
    }
    /*
     * heading
     * cap[1] - headingid from <a name="">
     * cap[2] - heading char
     * cap[3] - heading text
     */
    if ((cap = this.rules.heading.exec(src))) {
      src = src.substring(cap[0].length);
      tmp = new InlineLexer(this.options);
      this.tokens.push({
        type: 'heading',
        depth: cap[2].length,
        text: cap[3],
        raw: cap[3],
        autoid: null,
        anchor: cap[1],
        inline: tmp.lex(cap[3])
      });
      continue
    }
    /*
     * lheading
     * cap[1] - headingid from <a name="">
     * cap[2] - heading char
     * cap[3] - heading text
     */
    if ((cap = this.rules.lheading.exec(src))) {
      src = src.substring(cap[0].length);
      tmp = new InlineLexer(this.options);
      this.tokens.push({
        type: 'heading',
        depth: cap[3] === '=' ? 1 : 2,
        text: cap[2],
        raw: cap[2],
        autoid: null,
        anchor: cap[1],
        inline: tmp.lex(cap[2])
      });
      continue
    }
    // hr
    if ((cap = this.rules.hr.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'hr',
        text: cap[0]
      });
      continue
    }
    // blockquote
    if ((cap = this.rules.blockquote.exec(src))) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'blockquote_start'
      });

      cap = cap[0].replace(/^ *> ?/gm, '');

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top);

      this.tokens.push({
        type: 'blockquote_end'
      });

      continue
    }
    // list -
    if ((cap = this.rules.list.exec(src))) {
      src = src.substring(cap[0].length);
      bull = cap[2];

      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1,
        start: int(bull)
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);

      next = false;
      l = cap.length;
      i = 0;

      for (; i < l; i++) {
        item = cap[i];
        bull = this.rules.bullet.exec(item)[0];

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.) +/, '');

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartlists && i !== l - 1) {
          b = this.rules.bullet.exec(cap[i + 1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src;
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item.charAt(item.length - 1) === '\n';
          if (!loose) loose = next;
        }

        this.tokens.push({
          type: loose ? 'loose_item_start' : 'list_item_start',
          text: bull
        });

        // Recurse.
        this.token(item, false, bq);

        this.tokens.push({
          type: 'list_item_end'
        });
      }

      this.tokens.push({
        type: 'list_end'
      });

      continue
    }
    // ppnumberedheadings
    if ((cap = this.rules.ppnumberedheadings.exec(src))) {
      src = src.substring(cap[0].length);
      opts = Lexer.splitOpts(cap[1] || cap[2]);
      if (typeof opts.omit === 'string') {
        opts.omit = [opts.omit];
      }
      this.options.numberedHeadings = true;
      this.tokens.push({
        type: 'ppnumberedheadings',
        level: Lexer.range(opts.level, defaults.minlevel, 6, defaults.level),
        minlevel: Lexer.range(opts.minlevel, defaults.minlevel, 6),
        skip: opts.skip,
        start: opts.start,
        omit: opts.omit,
        skipEscaping: opts.skipEscaping
      });
      continue
    }
    // pptoc
    if ((cap = this.rules.pptoc.exec(src))) {
      src = src.substring(cap[0].length);
      opts = Lexer.splitOpts(cap[1] || cap[2]);
      if (typeof opts.omit === 'string') {
        opts.omit = [opts.omit];
      }
      this.tokens.push({
        type: 'pptoc',
        level: Lexer.range(opts.level, defaults.minlevel, 6, defaults.level),
        minlevel: Lexer.range(opts.minlevel, defaults.minlevel, 6),
        numbered: opts.numbered,
        omit: opts.omit
      });
      continue
    }
    // ppref
    if ((cap = this.rules.ppref.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'ppref'
      });
      continue
    }
    // html
    if ((cap = this.rules.html.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'html',
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: cap[0]
      });
      continue
    }
    // def
    if (top && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'def',
        ref: cap[1],
        href: cap[2],
        title: cap[3]
      });
      continue
    }
    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[1].length);
      tmp = new InlineLexer(this.options);
      this.tokens.push({
        type: 'paragraph',
        text: cap[1],
        inline: tmp.lex(cap[1])
      });
      continue
    }
    // text
    if ((cap = this.rules.text.exec(src))) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      tmp = new InlineLexer(this.options);
      this.tokens.push({
        type: 'text',
        text: cap[0], // Todo run InlineLexer
        inline: tmp.lex(cap[0])
      });
      continue
    }
    // no match
    if (src) {
      // ~ console.log('-->', src); // TODO - debugging
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
    }
  }

  return this.tokens
};

/**
 * Expose Block Rules
 */
Lexer.rules = block;

/**
 * Static Lex Method
 * @param {String} src - markdown source
 * @param {Object} options - options to overwrite
 * @param {Function} callback - `function(err, tokens)`
 */
Lexer.lex = function (ppInclude, src, options, callback) {
  const lexer = new Lexer(options);
  const tokens = lexer.lex(src); // returns the lexed tokens
  if (options.include) {
    ppInclude(tokens, Lexer, options, function (err, tokens) {
      callback(err, tokens, options);
    });
  } else {
    callback(null, tokens, options);
  }
};

/**
 * Split preproc command options
 * @param {String} str - string to split into key-value pairs
 */
Lexer.splitOpts = function (str) {
  const opts = {};
  let sep;
  let tmp = ''

  ;(str || '').split(' ').forEach(function (s) {
    if (/\\$|^["'].*[^"']$/.test(s) || (sep && !sep.test(s))) {
      tmp += s + ' ';
      return
    }
    if (/=(["']).*[^"']$/.test(s)) {
      sep = s.replace(/^.*=(["']).*[^"']$/, '$1');
      sep = new RegExp(sep + '$');
      tmp += s + ' ';
      return
    }
    if (tmp) {
      s = tmp + s;
      tmp = '';
      sep = undefined;
    }
    if (KEYVALUES.test(s)) {
      s.replace(KEYVALUES, function (m, key, x, value) {
        opts[key] = value.split(';');
        opts[key] = opts[key].map(function (value) {
          if (/^\d+$/.test(value)) {
            const tmp = parseInt(value, 10);
            if (!isNaN(tmp)) {
              value = tmp;
            }
          }
          return value
        });
        if (opts[key].length === 1) {
          opts[key] = opts[key][0];
        }
      });
    } else if (KEYVALUE.test(s)) {
      s.replace(KEYVALUE, function (m, key, value) {
        const tmp = parseInt(value, 10);
        if (!isNaN(tmp)) {
          value = tmp;
        }
        opts[key] = value;
      });
    } else if (KEY.test(s)) {
      s = s.replace(/\\ /g, ' ').replace(/^(["'])([^\1]+)\1$/, '$2');
      if (/^!(.*)$/.test(s)) {
        s = s.replace(/^!(.*)$/, '$1');
        opts[s] = false;
      } else {
        opts[s] = true;
      }
    }
  });

  return opts
};

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
};

/**
 * Number headings
 * @constructor
 * @api private
 */
function Numbering (init, skipEscaping) {
  this._ = [0, 0, 0, 0, 0, 0, 0];
  this.last = 1;
  this._[1] = init ? init - 1 : 0;
  this.skipEscaping = skipEscaping;
}

/**
 * Reset number array per level
 * @param {Number} level
 */
Numbering.prototype.reset = function (level) {
  for (let i = level + 1; i < this._.length; i++) {
    this._[i] = 0;
  }
};

/**
 * Generate output value for number
 * @param {Number} level
 * @return {String} number
 */
Numbering.prototype.val = function (level) {
  let out = this._[1];

  for (let i = 2; i <= level; i++) {
    out += '.' + this._[i];
  }
  return out + (this.skipEscaping ? '.' : '\\.')
};

/**
 * Count up per level
 * @param {Number} level
 * @return {String} number
 */
Numbering.prototype.count = function (level) {
  if (level <= 6) {
    if (this.last > level) {
      this.reset(level);
    }
    this._[level] += 1;
    this.last = level;
    return this.val(level)
  }
};

/**
 * Renderer
 * @constructor
 * @param {Object} options
 */
function Renderer (options) {
  this.options = options || {};
}

/// / ---- block level

/**
 * Render heading as markdown
 * @param {String} text - Heading text
 * @param {Number} level - Heading level
 * @param {String} raw - Raw heading text (without numbers)
 * @return {String} rendered output
 */
Renderer.prototype.heading = function (
  text,
  level,
  raw,
  number,
  autoid,
  anchor
) {
  let atx = '';
  if (anchor) {
    atx += '<a name="' + anchor + '"></a>\n\n';
  } else if (this.options.autoid && autoid) {
    atx += '<a name="' + autoid + '"></a>\n\n';
  }
  atx += '########'.substring(0, level);
  return atx + ' ' + text + '\n'
};

/**
 * Render text
 * @param {String} text - text
 * @return {String} rendered output
 */
Renderer.prototype.paragraph = function (text) {
  return text // TODO
};

/**
 * Render newline `<br>`
 * @param {String} text - text
 * @return {String} rendered output
 */
Renderer.prototype.newline = function (text) {
  return text
};

/**
 * Renders a blockquote
 * @param {String} body - body of blockquote
 * @return {String} rendered output
 */
Renderer.prototype.blockquote = function (body) {
  // ~ return body.replace(/\n/gm, '\n> ');
  return body.replace(/\n$/, '').replace(/^/gm, '> ') + '\n'
};

/**
 * Renders a list
 * @param {String} body - body of list
 * @return {String} rendered output
 */
Renderer.prototype.list = function (body /*, ordered */) {
  return body.replace(/\n$/, '')
};

/**
 * Renders a listitem
 * @param {String} bullet - bullet char
 * @param {String} text - text of listitem
 * @return {String} rendered output
 */
Renderer.prototype.listitem = function (bullet, text) {
  let indent = '';
  bullet += ' ';
  for (let i = 0; i < bullet.length; i++) {
    indent += ' ';
  }
  return bullet + text.replace(/\n(?!\n|$)/gm, '\n' + indent) + '\n'
};

/**
 * Render fenced code blocks
 * @param {String} code - code block
 * @param {String} lang - language of code block
 * @return {String} rendered output
 */
Renderer.prototype.fences = function (code, lang, indent, fences) {
  return (
    this.fence(lang, indent, fences) +
    code +
    '\n' +
    this.fence('', indent, fences)
  )
};

/**
 * Render a single reference as markdown
 * @param {String} ref - reference name
 * @param {String} href - URL of reference
 * @param {String} title - Title of reference
 * @return {String} rendered output
 */
Renderer.prototype.reference = function (ref, href, title) {
  return '[' + ref + ']: ' + href + (title ? ' "' + title + '"' : '') + '\n'
};

/**
 * Render a ppinclude which could not be resolved
 * @param {String} text - text
 * @param {String} indent - indent as whitespaces string
 * @param {String} lang - language of included file
 * @return {String} rendered output
 */
Renderer.prototype.include = function (text, indent, lang) {
  return indent + '!include (' + text + (lang ? ' lang=' + lang : '') + ')\n'
};

/**
 * Render GFM fences
 * @param {String} lang - language of fences block
 * @return rendered output
 */
Renderer.prototype.fence = function (lang, indent, fences) {
  fences = fences || '```';
  indent = indent || '';
  return indent + fences + (lang || '') + '\n'
};

/**
 * Render codeblock
 * @param {String} text - text
 * @return rendered output
 */
Renderer.prototype.codeblock = function (text) {
  return text
};
/**
 * Render html
 * @param {String} text - text
 * @return rendered output
 */
Renderer.prototype.html = function (text) {
  return text
};
/**
 * Render horizontal ruler
 * @param {String} text - text
 * @return rendered output
 */
Renderer.prototype.hr = function (text) {
  return text
};

/// / ---- inline level

Renderer.prototype.escape = function (text) {
  return '\\' + text
};
Renderer.prototype.url = function (text) {
  return text
};
Renderer.prototype.tag = function (text) {
  return text
};
Renderer.prototype.link = function (text, label, href, title) {
  return '[' + label + '](' + href + (title ? ' ' + title : '') + ')'
};
Renderer.prototype.reflink = function (text, label, ref) {
  return '[' + label + '][' + ref + ']'
};
Renderer.prototype.nolink = function (text, label) {
  return '[' + label + ']'
};
Renderer.prototype.image = function (text, label, href, title) {
  return '!' + this.link(text, label, href, title)
};
Renderer.prototype.refimage = function (text, label, ref) {
  return '!' + this.reflink(text, label, ref)
};
Renderer.prototype.noimage = function (text, label) {
  return '!' + this.nolink(text, label)
};
Renderer.prototype.strong = function (text, chars) {
  return chars + text + chars
};
Renderer.prototype.em = function (text, char) {
  return char + text + char
};
Renderer.prototype.del = function (text) {
  return '~~' + text + '~~'
};
Renderer.prototype.text = function (text) {
  return text
};
Renderer.prototype.br = function (text) {
  return text
};
Renderer.prototype.code = function (text) {
  return text
};

/**
 * Sorter to sort reference by title
 * @api private
 */
Renderer.sortByTitle = function (a, b) {
  const _a = a.title.toLowerCase();
  const _b = b.title.toLowerCase();

  if (_a > _b) {
    return 1
  } else if (_a < _b) {
    return -1
  } else {
    return 0
  }
};

/**
 * Render all references
 * @param {Array} refs : Array of Objects `{ ref: {String}, href: {String}, title: {String} }`
 * @return {String} rendered output
 */
Renderer.prototype.references = function (refs) {
  const out = [];

  refs
    .map((ref) => {
      if (!ref.title) {
        ref.title = ref.ref;
      }
      return ref
    })
    .sort(Renderer.sortByTitle)
    .forEach(function (ref) {
      out.push('* [' + ref.title + '][' + ref.ref + ']');
    });
  if (this.options.tags) {
    return '<!-- !ref -->\n\n' + out.join('\n') + '\n\n<!-- ref! -->\n'
  } else {
    return out.join('\n') + '\n'
  }
};

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
  let omitlevel;
  const opts = this.joinOpts({
    level: options.level,
    minlevel: options.minlevel,
    numbered: options.numbered,
    omit: options.omit
  });
  const numbering = new Numbering();
  const br = this.options.breaks ? ' <br>' : '';
  const level = options.level || defaults.level; // standard depth of TOC
  const minlevel = options.minlevel || defaults.minlevel; //

  const renderLink = (text, autoid) =>
    '[' + this.sanitizeHeadings(text) + '](#' + autoid + ')';

  const out = toc
    .filter((t) => {
      if (t.depth <= level && t.depth >= minlevel) {
        return true
      }
      return false
    })
    .map((t) => {
      if (!this.options.numberedHeadings && options.numbered) {
        t.number = numbering.count(t.depth - minlevel + 1);
      }
      return t
    })
    .filter((t) => {
      if (options.omit) {
        if (omitlevel) {
          // omit the branch below as well...
          if (t.depth > omitlevel) {
            return false
          } else {
            omitlevel = undefined; // reset
          }
        }
        return !options.omit.some((tt) => {
          if (tt === t.raw) {
            omitlevel = t.depth;
            return true
          }
          return false
        })
      }
      return true
    })
    .map((t) => {
      if (options.numbered) {
        // render numbered list
        if (this.options.numberedHeadings) {
          return (
            (t.number ? t.number + ' ' : '') + renderLink(t.raw, t.autoid) + br
          )
        } else {
          return t.number + ' ' + renderLink(t.text, t.autoid) + br
        }
      } else {
        // render bullet list
        let space = '';
        for (let i = 1; i < (t.depth - minlevel + 1 || 1); i++) {
          space += '  ';
        }
        return space + '* ' + renderLink(t.text, t.autoid)
      }
    });

  if (this.options.tags) {
    return (
      '<!-- !toc ' + opts + '-->\n\n' + out.join('\n') + '\n\n<!-- toc! -->\n\n'
    )
  } else {
    return out.join('\n') + '\n\n'
  }
};

/**
 * Render numberedheadings command
 * @param {Number} maxLevel
 * @param {Number} minLevel
 * @return {String} rendered output
 */
Renderer.prototype.numberedHeadings = function (
  maxLevel,
  minLevel,
  skip,
  start,
  omit,
  skipEscaping
) {
  const opts = this.joinOpts({
    level: maxLevel,
    minlevel: minLevel,
    skip,
    start,
    omit,
    skipEscaping
  });
  if (this.options.tags) {
    return '<!-- !numberedheadings ' + opts + '-->\n\n'
  }
  return ''
};

Renderer.prototype.joinOpts = function (obj) {
  const tmp = [];
  for (const key in obj) {
    let val = obj[key];
    if (val === true) {
      tmp.push(key);
    } else if (val !== undefined) {
      if (Array.isArray(val)) {
        val = '"' + val.join(';') + '"';
      }
      tmp.push(key + '=' + val);
    }
  }
  if (tmp.length > 0) {
    return '(' + tmp.join(' ') + ') '
  } else {
    return ''
  }
};

Renderer.prototype.sanitizeHeadings = function (heading) {
  return heading.replace(/\[([^\]]*)\]\s*(?:\[[^\]]*\]|\([^)]*\))/g, '$1')
};

var emojiRegex = () => {
	// https://mths.be/emoji
	return /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE89\uDE8F-\uDEC2\uDEC6\uDECE-\uDEDC\uDEDF-\uDEE9]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g;
};

var __assign$1 = (undefined && undefined.__assign) || function () {
    __assign$1 = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign$1.apply(this, arguments);
};
// This file is autogenerated by tools/process-named-references.ts
var pairDivider = "~";
var blockDivider = "~~";
function generateNamedReferences(input, prev) {
    var entities = {};
    var characters = {};
    var blocks = input.split(blockDivider);
    var isOptionalBlock = false;
    for (var i = 0; blocks.length > i; i++) {
        var entries = blocks[i].split(pairDivider);
        for (var j = 0; j < entries.length; j += 2) {
            var entity = entries[j];
            var character = entries[j + 1];
            var fullEntity = '&' + entity + ';';
            entities[fullEntity] = character;
            if (isOptionalBlock) {
                entities['&' + entity] = character;
            }
            characters[character] = fullEntity;
        }
        isOptionalBlock = true;
    }
    return prev ?
        { entities: __assign$1(__assign$1({}, entities), prev.entities), characters: __assign$1(__assign$1({}, characters), prev.characters) } :
        { entities: entities, characters: characters };
}
var bodyRegExps = {
    xml: /&(?:#\d+|#[xX][\da-fA-F]+|[0-9a-zA-Z]+);?/g,
    html4: /&notin;|&(?:nbsp|iexcl|cent|pound|curren|yen|brvbar|sect|uml|copy|ordf|laquo|not|shy|reg|macr|deg|plusmn|sup2|sup3|acute|micro|para|middot|cedil|sup1|ordm|raquo|frac14|frac12|frac34|iquest|Agrave|Aacute|Acirc|Atilde|Auml|Aring|AElig|Ccedil|Egrave|Eacute|Ecirc|Euml|Igrave|Iacute|Icirc|Iuml|ETH|Ntilde|Ograve|Oacute|Ocirc|Otilde|Ouml|times|Oslash|Ugrave|Uacute|Ucirc|Uuml|Yacute|THORN|szlig|agrave|aacute|acirc|atilde|auml|aring|aelig|ccedil|egrave|eacute|ecirc|euml|igrave|iacute|icirc|iuml|eth|ntilde|ograve|oacute|ocirc|otilde|ouml|divide|oslash|ugrave|uacute|ucirc|uuml|yacute|thorn|yuml|quot|amp|lt|gt|#\d+|#[xX][\da-fA-F]+|[0-9a-zA-Z]+);?/g,
    html5: /&centerdot;|&copysr;|&divideontimes;|&gtcc;|&gtcir;|&gtdot;|&gtlPar;|&gtquest;|&gtrapprox;|&gtrarr;|&gtrdot;|&gtreqless;|&gtreqqless;|&gtrless;|&gtrsim;|&ltcc;|&ltcir;|&ltdot;|&lthree;|&ltimes;|&ltlarr;|&ltquest;|&ltrPar;|&ltri;|&ltrie;|&ltrif;|&notin;|&notinE;|&notindot;|&notinva;|&notinvb;|&notinvc;|&notni;|&notniva;|&notnivb;|&notnivc;|&parallel;|&timesb;|&timesbar;|&timesd;|&(?:AElig|AMP|Aacute|Acirc|Agrave|Aring|Atilde|Auml|COPY|Ccedil|ETH|Eacute|Ecirc|Egrave|Euml|GT|Iacute|Icirc|Igrave|Iuml|LT|Ntilde|Oacute|Ocirc|Ograve|Oslash|Otilde|Ouml|QUOT|REG|THORN|Uacute|Ucirc|Ugrave|Uuml|Yacute|aacute|acirc|acute|aelig|agrave|amp|aring|atilde|auml|brvbar|ccedil|cedil|cent|copy|curren|deg|divide|eacute|ecirc|egrave|eth|euml|frac12|frac14|frac34|gt|iacute|icirc|iexcl|igrave|iquest|iuml|laquo|lt|macr|micro|middot|nbsp|not|ntilde|oacute|ocirc|ograve|ordf|ordm|oslash|otilde|ouml|para|plusmn|pound|quot|raquo|reg|sect|shy|sup1|sup2|sup3|szlig|thorn|times|uacute|ucirc|ugrave|uml|uuml|yacute|yen|yuml|#\d+|#[xX][\da-fA-F]+|[0-9a-zA-Z]+);?/g
};
var namedReferences = {};
namedReferences['xml'] = generateNamedReferences("lt~<~gt~>~quot~\"~apos~'~amp~&");
namedReferences['html4'] = generateNamedReferences("apos~'~OElig~Œ~oelig~œ~Scaron~Š~scaron~š~Yuml~Ÿ~circ~ˆ~tilde~˜~ensp~ ~emsp~ ~thinsp~ ~zwnj~‌~zwj~‍~lrm~‎~rlm~‏~ndash~–~mdash~—~lsquo~‘~rsquo~’~sbquo~‚~ldquo~“~rdquo~”~bdquo~„~dagger~†~Dagger~‡~permil~‰~lsaquo~‹~rsaquo~›~euro~€~fnof~ƒ~Alpha~Α~Beta~Β~Gamma~Γ~Delta~Δ~Epsilon~Ε~Zeta~Ζ~Eta~Η~Theta~Θ~Iota~Ι~Kappa~Κ~Lambda~Λ~Mu~Μ~Nu~Ν~Xi~Ξ~Omicron~Ο~Pi~Π~Rho~Ρ~Sigma~Σ~Tau~Τ~Upsilon~Υ~Phi~Φ~Chi~Χ~Psi~Ψ~Omega~Ω~alpha~α~beta~β~gamma~γ~delta~δ~epsilon~ε~zeta~ζ~eta~η~theta~θ~iota~ι~kappa~κ~lambda~λ~mu~μ~nu~ν~xi~ξ~omicron~ο~pi~π~rho~ρ~sigmaf~ς~sigma~σ~tau~τ~upsilon~υ~phi~φ~chi~χ~psi~ψ~omega~ω~thetasym~ϑ~upsih~ϒ~piv~ϖ~bull~•~hellip~…~prime~′~Prime~″~oline~‾~frasl~⁄~weierp~℘~image~ℑ~real~ℜ~trade~™~alefsym~ℵ~larr~←~uarr~↑~rarr~→~darr~↓~harr~↔~crarr~↵~lArr~⇐~uArr~⇑~rArr~⇒~dArr~⇓~hArr~⇔~forall~∀~part~∂~exist~∃~empty~∅~nabla~∇~isin~∈~notin~∉~ni~∋~prod~∏~sum~∑~minus~−~lowast~∗~radic~√~prop~∝~infin~∞~ang~∠~and~∧~or~∨~cap~∩~cup~∪~int~∫~there4~∴~sim~∼~cong~≅~asymp~≈~ne~≠~equiv~≡~le~≤~ge~≥~sub~⊂~sup~⊃~nsub~⊄~sube~⊆~supe~⊇~oplus~⊕~otimes~⊗~perp~⊥~sdot~⋅~lceil~⌈~rceil~⌉~lfloor~⌊~rfloor~⌋~lang~〈~rang~〉~loz~◊~spades~♠~clubs~♣~hearts~♥~diams~♦~~nbsp~ ~iexcl~¡~cent~¢~pound~£~curren~¤~yen~¥~brvbar~¦~sect~§~uml~¨~copy~©~ordf~ª~laquo~«~not~¬~shy~­~reg~®~macr~¯~deg~°~plusmn~±~sup2~²~sup3~³~acute~´~micro~µ~para~¶~middot~·~cedil~¸~sup1~¹~ordm~º~raquo~»~frac14~¼~frac12~½~frac34~¾~iquest~¿~Agrave~À~Aacute~Á~Acirc~Â~Atilde~Ã~Auml~Ä~Aring~Å~AElig~Æ~Ccedil~Ç~Egrave~È~Eacute~É~Ecirc~Ê~Euml~Ë~Igrave~Ì~Iacute~Í~Icirc~Î~Iuml~Ï~ETH~Ð~Ntilde~Ñ~Ograve~Ò~Oacute~Ó~Ocirc~Ô~Otilde~Õ~Ouml~Ö~times~×~Oslash~Ø~Ugrave~Ù~Uacute~Ú~Ucirc~Û~Uuml~Ü~Yacute~Ý~THORN~Þ~szlig~ß~agrave~à~aacute~á~acirc~â~atilde~ã~auml~ä~aring~å~aelig~æ~ccedil~ç~egrave~è~eacute~é~ecirc~ê~euml~ë~igrave~ì~iacute~í~icirc~î~iuml~ï~eth~ð~ntilde~ñ~ograve~ò~oacute~ó~ocirc~ô~otilde~õ~ouml~ö~divide~÷~oslash~ø~ugrave~ù~uacute~ú~ucirc~û~uuml~ü~yacute~ý~thorn~þ~yuml~ÿ~quot~\"~amp~&~lt~<~gt~>");
namedReferences['html5'] = generateNamedReferences("Abreve~Ă~Acy~А~Afr~𝔄~Amacr~Ā~And~⩓~Aogon~Ą~Aopf~𝔸~ApplyFunction~⁡~Ascr~𝒜~Assign~≔~Backslash~∖~Barv~⫧~Barwed~⌆~Bcy~Б~Because~∵~Bernoullis~ℬ~Bfr~𝔅~Bopf~𝔹~Breve~˘~Bscr~ℬ~Bumpeq~≎~CHcy~Ч~Cacute~Ć~Cap~⋒~CapitalDifferentialD~ⅅ~Cayleys~ℭ~Ccaron~Č~Ccirc~Ĉ~Cconint~∰~Cdot~Ċ~Cedilla~¸~CenterDot~·~Cfr~ℭ~CircleDot~⊙~CircleMinus~⊖~CirclePlus~⊕~CircleTimes~⊗~ClockwiseContourIntegral~∲~CloseCurlyDoubleQuote~”~CloseCurlyQuote~’~Colon~∷~Colone~⩴~Congruent~≡~Conint~∯~ContourIntegral~∮~Copf~ℂ~Coproduct~∐~CounterClockwiseContourIntegral~∳~Cross~⨯~Cscr~𝒞~Cup~⋓~CupCap~≍~DD~ⅅ~DDotrahd~⤑~DJcy~Ђ~DScy~Ѕ~DZcy~Џ~Darr~↡~Dashv~⫤~Dcaron~Ď~Dcy~Д~Del~∇~Dfr~𝔇~DiacriticalAcute~´~DiacriticalDot~˙~DiacriticalDoubleAcute~˝~DiacriticalGrave~`~DiacriticalTilde~˜~Diamond~⋄~DifferentialD~ⅆ~Dopf~𝔻~Dot~¨~DotDot~⃜~DotEqual~≐~DoubleContourIntegral~∯~DoubleDot~¨~DoubleDownArrow~⇓~DoubleLeftArrow~⇐~DoubleLeftRightArrow~⇔~DoubleLeftTee~⫤~DoubleLongLeftArrow~⟸~DoubleLongLeftRightArrow~⟺~DoubleLongRightArrow~⟹~DoubleRightArrow~⇒~DoubleRightTee~⊨~DoubleUpArrow~⇑~DoubleUpDownArrow~⇕~DoubleVerticalBar~∥~DownArrow~↓~DownArrowBar~⤓~DownArrowUpArrow~⇵~DownBreve~̑~DownLeftRightVector~⥐~DownLeftTeeVector~⥞~DownLeftVector~↽~DownLeftVectorBar~⥖~DownRightTeeVector~⥟~DownRightVector~⇁~DownRightVectorBar~⥗~DownTee~⊤~DownTeeArrow~↧~Downarrow~⇓~Dscr~𝒟~Dstrok~Đ~ENG~Ŋ~Ecaron~Ě~Ecy~Э~Edot~Ė~Efr~𝔈~Element~∈~Emacr~Ē~EmptySmallSquare~◻~EmptyVerySmallSquare~▫~Eogon~Ę~Eopf~𝔼~Equal~⩵~EqualTilde~≂~Equilibrium~⇌~Escr~ℰ~Esim~⩳~Exists~∃~ExponentialE~ⅇ~Fcy~Ф~Ffr~𝔉~FilledSmallSquare~◼~FilledVerySmallSquare~▪~Fopf~𝔽~ForAll~∀~Fouriertrf~ℱ~Fscr~ℱ~GJcy~Ѓ~Gammad~Ϝ~Gbreve~Ğ~Gcedil~Ģ~Gcirc~Ĝ~Gcy~Г~Gdot~Ġ~Gfr~𝔊~Gg~⋙~Gopf~𝔾~GreaterEqual~≥~GreaterEqualLess~⋛~GreaterFullEqual~≧~GreaterGreater~⪢~GreaterLess~≷~GreaterSlantEqual~⩾~GreaterTilde~≳~Gscr~𝒢~Gt~≫~HARDcy~Ъ~Hacek~ˇ~Hat~^~Hcirc~Ĥ~Hfr~ℌ~HilbertSpace~ℋ~Hopf~ℍ~HorizontalLine~─~Hscr~ℋ~Hstrok~Ħ~HumpDownHump~≎~HumpEqual~≏~IEcy~Е~IJlig~Ĳ~IOcy~Ё~Icy~И~Idot~İ~Ifr~ℑ~Im~ℑ~Imacr~Ī~ImaginaryI~ⅈ~Implies~⇒~Int~∬~Integral~∫~Intersection~⋂~InvisibleComma~⁣~InvisibleTimes~⁢~Iogon~Į~Iopf~𝕀~Iscr~ℐ~Itilde~Ĩ~Iukcy~І~Jcirc~Ĵ~Jcy~Й~Jfr~𝔍~Jopf~𝕁~Jscr~𝒥~Jsercy~Ј~Jukcy~Є~KHcy~Х~KJcy~Ќ~Kcedil~Ķ~Kcy~К~Kfr~𝔎~Kopf~𝕂~Kscr~𝒦~LJcy~Љ~Lacute~Ĺ~Lang~⟪~Laplacetrf~ℒ~Larr~↞~Lcaron~Ľ~Lcedil~Ļ~Lcy~Л~LeftAngleBracket~⟨~LeftArrow~←~LeftArrowBar~⇤~LeftArrowRightArrow~⇆~LeftCeiling~⌈~LeftDoubleBracket~⟦~LeftDownTeeVector~⥡~LeftDownVector~⇃~LeftDownVectorBar~⥙~LeftFloor~⌊~LeftRightArrow~↔~LeftRightVector~⥎~LeftTee~⊣~LeftTeeArrow~↤~LeftTeeVector~⥚~LeftTriangle~⊲~LeftTriangleBar~⧏~LeftTriangleEqual~⊴~LeftUpDownVector~⥑~LeftUpTeeVector~⥠~LeftUpVector~↿~LeftUpVectorBar~⥘~LeftVector~↼~LeftVectorBar~⥒~Leftarrow~⇐~Leftrightarrow~⇔~LessEqualGreater~⋚~LessFullEqual~≦~LessGreater~≶~LessLess~⪡~LessSlantEqual~⩽~LessTilde~≲~Lfr~𝔏~Ll~⋘~Lleftarrow~⇚~Lmidot~Ŀ~LongLeftArrow~⟵~LongLeftRightArrow~⟷~LongRightArrow~⟶~Longleftarrow~⟸~Longleftrightarrow~⟺~Longrightarrow~⟹~Lopf~𝕃~LowerLeftArrow~↙~LowerRightArrow~↘~Lscr~ℒ~Lsh~↰~Lstrok~Ł~Lt~≪~Map~⤅~Mcy~М~MediumSpace~ ~Mellintrf~ℳ~Mfr~𝔐~MinusPlus~∓~Mopf~𝕄~Mscr~ℳ~NJcy~Њ~Nacute~Ń~Ncaron~Ň~Ncedil~Ņ~Ncy~Н~NegativeMediumSpace~​~NegativeThickSpace~​~NegativeThinSpace~​~NegativeVeryThinSpace~​~NestedGreaterGreater~≫~NestedLessLess~≪~NewLine~\n~Nfr~𝔑~NoBreak~⁠~NonBreakingSpace~ ~Nopf~ℕ~Not~⫬~NotCongruent~≢~NotCupCap~≭~NotDoubleVerticalBar~∦~NotElement~∉~NotEqual~≠~NotEqualTilde~≂̸~NotExists~∄~NotGreater~≯~NotGreaterEqual~≱~NotGreaterFullEqual~≧̸~NotGreaterGreater~≫̸~NotGreaterLess~≹~NotGreaterSlantEqual~⩾̸~NotGreaterTilde~≵~NotHumpDownHump~≎̸~NotHumpEqual~≏̸~NotLeftTriangle~⋪~NotLeftTriangleBar~⧏̸~NotLeftTriangleEqual~⋬~NotLess~≮~NotLessEqual~≰~NotLessGreater~≸~NotLessLess~≪̸~NotLessSlantEqual~⩽̸~NotLessTilde~≴~NotNestedGreaterGreater~⪢̸~NotNestedLessLess~⪡̸~NotPrecedes~⊀~NotPrecedesEqual~⪯̸~NotPrecedesSlantEqual~⋠~NotReverseElement~∌~NotRightTriangle~⋫~NotRightTriangleBar~⧐̸~NotRightTriangleEqual~⋭~NotSquareSubset~⊏̸~NotSquareSubsetEqual~⋢~NotSquareSuperset~⊐̸~NotSquareSupersetEqual~⋣~NotSubset~⊂⃒~NotSubsetEqual~⊈~NotSucceeds~⊁~NotSucceedsEqual~⪰̸~NotSucceedsSlantEqual~⋡~NotSucceedsTilde~≿̸~NotSuperset~⊃⃒~NotSupersetEqual~⊉~NotTilde~≁~NotTildeEqual~≄~NotTildeFullEqual~≇~NotTildeTilde~≉~NotVerticalBar~∤~Nscr~𝒩~Ocy~О~Odblac~Ő~Ofr~𝔒~Omacr~Ō~Oopf~𝕆~OpenCurlyDoubleQuote~“~OpenCurlyQuote~‘~Or~⩔~Oscr~𝒪~Otimes~⨷~OverBar~‾~OverBrace~⏞~OverBracket~⎴~OverParenthesis~⏜~PartialD~∂~Pcy~П~Pfr~𝔓~PlusMinus~±~Poincareplane~ℌ~Popf~ℙ~Pr~⪻~Precedes~≺~PrecedesEqual~⪯~PrecedesSlantEqual~≼~PrecedesTilde~≾~Product~∏~Proportion~∷~Proportional~∝~Pscr~𝒫~Qfr~𝔔~Qopf~ℚ~Qscr~𝒬~RBarr~⤐~Racute~Ŕ~Rang~⟫~Rarr~↠~Rarrtl~⤖~Rcaron~Ř~Rcedil~Ŗ~Rcy~Р~Re~ℜ~ReverseElement~∋~ReverseEquilibrium~⇋~ReverseUpEquilibrium~⥯~Rfr~ℜ~RightAngleBracket~⟩~RightArrow~→~RightArrowBar~⇥~RightArrowLeftArrow~⇄~RightCeiling~⌉~RightDoubleBracket~⟧~RightDownTeeVector~⥝~RightDownVector~⇂~RightDownVectorBar~⥕~RightFloor~⌋~RightTee~⊢~RightTeeArrow~↦~RightTeeVector~⥛~RightTriangle~⊳~RightTriangleBar~⧐~RightTriangleEqual~⊵~RightUpDownVector~⥏~RightUpTeeVector~⥜~RightUpVector~↾~RightUpVectorBar~⥔~RightVector~⇀~RightVectorBar~⥓~Rightarrow~⇒~Ropf~ℝ~RoundImplies~⥰~Rrightarrow~⇛~Rscr~ℛ~Rsh~↱~RuleDelayed~⧴~SHCHcy~Щ~SHcy~Ш~SOFTcy~Ь~Sacute~Ś~Sc~⪼~Scedil~Ş~Scirc~Ŝ~Scy~С~Sfr~𝔖~ShortDownArrow~↓~ShortLeftArrow~←~ShortRightArrow~→~ShortUpArrow~↑~SmallCircle~∘~Sopf~𝕊~Sqrt~√~Square~□~SquareIntersection~⊓~SquareSubset~⊏~SquareSubsetEqual~⊑~SquareSuperset~⊐~SquareSupersetEqual~⊒~SquareUnion~⊔~Sscr~𝒮~Star~⋆~Sub~⋐~Subset~⋐~SubsetEqual~⊆~Succeeds~≻~SucceedsEqual~⪰~SucceedsSlantEqual~≽~SucceedsTilde~≿~SuchThat~∋~Sum~∑~Sup~⋑~Superset~⊃~SupersetEqual~⊇~Supset~⋑~TRADE~™~TSHcy~Ћ~TScy~Ц~Tab~\t~Tcaron~Ť~Tcedil~Ţ~Tcy~Т~Tfr~𝔗~Therefore~∴~ThickSpace~  ~ThinSpace~ ~Tilde~∼~TildeEqual~≃~TildeFullEqual~≅~TildeTilde~≈~Topf~𝕋~TripleDot~⃛~Tscr~𝒯~Tstrok~Ŧ~Uarr~↟~Uarrocir~⥉~Ubrcy~Ў~Ubreve~Ŭ~Ucy~У~Udblac~Ű~Ufr~𝔘~Umacr~Ū~UnderBar~_~UnderBrace~⏟~UnderBracket~⎵~UnderParenthesis~⏝~Union~⋃~UnionPlus~⊎~Uogon~Ų~Uopf~𝕌~UpArrow~↑~UpArrowBar~⤒~UpArrowDownArrow~⇅~UpDownArrow~↕~UpEquilibrium~⥮~UpTee~⊥~UpTeeArrow~↥~Uparrow~⇑~Updownarrow~⇕~UpperLeftArrow~↖~UpperRightArrow~↗~Upsi~ϒ~Uring~Ů~Uscr~𝒰~Utilde~Ũ~VDash~⊫~Vbar~⫫~Vcy~В~Vdash~⊩~Vdashl~⫦~Vee~⋁~Verbar~‖~Vert~‖~VerticalBar~∣~VerticalLine~|~VerticalSeparator~❘~VerticalTilde~≀~VeryThinSpace~ ~Vfr~𝔙~Vopf~𝕍~Vscr~𝒱~Vvdash~⊪~Wcirc~Ŵ~Wedge~⋀~Wfr~𝔚~Wopf~𝕎~Wscr~𝒲~Xfr~𝔛~Xopf~𝕏~Xscr~𝒳~YAcy~Я~YIcy~Ї~YUcy~Ю~Ycirc~Ŷ~Ycy~Ы~Yfr~𝔜~Yopf~𝕐~Yscr~𝒴~ZHcy~Ж~Zacute~Ź~Zcaron~Ž~Zcy~З~Zdot~Ż~ZeroWidthSpace~​~Zfr~ℨ~Zopf~ℤ~Zscr~𝒵~abreve~ă~ac~∾~acE~∾̳~acd~∿~acy~а~af~⁡~afr~𝔞~aleph~ℵ~amacr~ā~amalg~⨿~andand~⩕~andd~⩜~andslope~⩘~andv~⩚~ange~⦤~angle~∠~angmsd~∡~angmsdaa~⦨~angmsdab~⦩~angmsdac~⦪~angmsdad~⦫~angmsdae~⦬~angmsdaf~⦭~angmsdag~⦮~angmsdah~⦯~angrt~∟~angrtvb~⊾~angrtvbd~⦝~angsph~∢~angst~Å~angzarr~⍼~aogon~ą~aopf~𝕒~ap~≈~apE~⩰~apacir~⩯~ape~≊~apid~≋~approx~≈~approxeq~≊~ascr~𝒶~ast~*~asympeq~≍~awconint~∳~awint~⨑~bNot~⫭~backcong~≌~backepsilon~϶~backprime~‵~backsim~∽~backsimeq~⋍~barvee~⊽~barwed~⌅~barwedge~⌅~bbrk~⎵~bbrktbrk~⎶~bcong~≌~bcy~б~becaus~∵~because~∵~bemptyv~⦰~bepsi~϶~bernou~ℬ~beth~ℶ~between~≬~bfr~𝔟~bigcap~⋂~bigcirc~◯~bigcup~⋃~bigodot~⨀~bigoplus~⨁~bigotimes~⨂~bigsqcup~⨆~bigstar~★~bigtriangledown~▽~bigtriangleup~△~biguplus~⨄~bigvee~⋁~bigwedge~⋀~bkarow~⤍~blacklozenge~⧫~blacksquare~▪~blacktriangle~▴~blacktriangledown~▾~blacktriangleleft~◂~blacktriangleright~▸~blank~␣~blk12~▒~blk14~░~blk34~▓~block~█~bne~=⃥~bnequiv~≡⃥~bnot~⌐~bopf~𝕓~bot~⊥~bottom~⊥~bowtie~⋈~boxDL~╗~boxDR~╔~boxDl~╖~boxDr~╓~boxH~═~boxHD~╦~boxHU~╩~boxHd~╤~boxHu~╧~boxUL~╝~boxUR~╚~boxUl~╜~boxUr~╙~boxV~║~boxVH~╬~boxVL~╣~boxVR~╠~boxVh~╫~boxVl~╢~boxVr~╟~boxbox~⧉~boxdL~╕~boxdR~╒~boxdl~┐~boxdr~┌~boxh~─~boxhD~╥~boxhU~╨~boxhd~┬~boxhu~┴~boxminus~⊟~boxplus~⊞~boxtimes~⊠~boxuL~╛~boxuR~╘~boxul~┘~boxur~└~boxv~│~boxvH~╪~boxvL~╡~boxvR~╞~boxvh~┼~boxvl~┤~boxvr~├~bprime~‵~breve~˘~bscr~𝒷~bsemi~⁏~bsim~∽~bsime~⋍~bsol~\\~bsolb~⧅~bsolhsub~⟈~bullet~•~bump~≎~bumpE~⪮~bumpe~≏~bumpeq~≏~cacute~ć~capand~⩄~capbrcup~⩉~capcap~⩋~capcup~⩇~capdot~⩀~caps~∩︀~caret~⁁~caron~ˇ~ccaps~⩍~ccaron~č~ccirc~ĉ~ccups~⩌~ccupssm~⩐~cdot~ċ~cemptyv~⦲~centerdot~·~cfr~𝔠~chcy~ч~check~✓~checkmark~✓~cir~○~cirE~⧃~circeq~≗~circlearrowleft~↺~circlearrowright~↻~circledR~®~circledS~Ⓢ~circledast~⊛~circledcirc~⊚~circleddash~⊝~cire~≗~cirfnint~⨐~cirmid~⫯~cirscir~⧂~clubsuit~♣~colon~:~colone~≔~coloneq~≔~comma~,~commat~@~comp~∁~compfn~∘~complement~∁~complexes~ℂ~congdot~⩭~conint~∮~copf~𝕔~coprod~∐~copysr~℗~cross~✗~cscr~𝒸~csub~⫏~csube~⫑~csup~⫐~csupe~⫒~ctdot~⋯~cudarrl~⤸~cudarrr~⤵~cuepr~⋞~cuesc~⋟~cularr~↶~cularrp~⤽~cupbrcap~⩈~cupcap~⩆~cupcup~⩊~cupdot~⊍~cupor~⩅~cups~∪︀~curarr~↷~curarrm~⤼~curlyeqprec~⋞~curlyeqsucc~⋟~curlyvee~⋎~curlywedge~⋏~curvearrowleft~↶~curvearrowright~↷~cuvee~⋎~cuwed~⋏~cwconint~∲~cwint~∱~cylcty~⌭~dHar~⥥~daleth~ℸ~dash~‐~dashv~⊣~dbkarow~⤏~dblac~˝~dcaron~ď~dcy~д~dd~ⅆ~ddagger~‡~ddarr~⇊~ddotseq~⩷~demptyv~⦱~dfisht~⥿~dfr~𝔡~dharl~⇃~dharr~⇂~diam~⋄~diamond~⋄~diamondsuit~♦~die~¨~digamma~ϝ~disin~⋲~div~÷~divideontimes~⋇~divonx~⋇~djcy~ђ~dlcorn~⌞~dlcrop~⌍~dollar~$~dopf~𝕕~dot~˙~doteq~≐~doteqdot~≑~dotminus~∸~dotplus~∔~dotsquare~⊡~doublebarwedge~⌆~downarrow~↓~downdownarrows~⇊~downharpoonleft~⇃~downharpoonright~⇂~drbkarow~⤐~drcorn~⌟~drcrop~⌌~dscr~𝒹~dscy~ѕ~dsol~⧶~dstrok~đ~dtdot~⋱~dtri~▿~dtrif~▾~duarr~⇵~duhar~⥯~dwangle~⦦~dzcy~џ~dzigrarr~⟿~eDDot~⩷~eDot~≑~easter~⩮~ecaron~ě~ecir~≖~ecolon~≕~ecy~э~edot~ė~ee~ⅇ~efDot~≒~efr~𝔢~eg~⪚~egs~⪖~egsdot~⪘~el~⪙~elinters~⏧~ell~ℓ~els~⪕~elsdot~⪗~emacr~ē~emptyset~∅~emptyv~∅~emsp13~ ~emsp14~ ~eng~ŋ~eogon~ę~eopf~𝕖~epar~⋕~eparsl~⧣~eplus~⩱~epsi~ε~epsiv~ϵ~eqcirc~≖~eqcolon~≕~eqsim~≂~eqslantgtr~⪖~eqslantless~⪕~equals~=~equest~≟~equivDD~⩸~eqvparsl~⧥~erDot~≓~erarr~⥱~escr~ℯ~esdot~≐~esim~≂~excl~!~expectation~ℰ~exponentiale~ⅇ~fallingdotseq~≒~fcy~ф~female~♀~ffilig~ﬃ~fflig~ﬀ~ffllig~ﬄ~ffr~𝔣~filig~ﬁ~fjlig~fj~flat~♭~fllig~ﬂ~fltns~▱~fopf~𝕗~fork~⋔~forkv~⫙~fpartint~⨍~frac13~⅓~frac15~⅕~frac16~⅙~frac18~⅛~frac23~⅔~frac25~⅖~frac35~⅗~frac38~⅜~frac45~⅘~frac56~⅚~frac58~⅝~frac78~⅞~frown~⌢~fscr~𝒻~gE~≧~gEl~⪌~gacute~ǵ~gammad~ϝ~gap~⪆~gbreve~ğ~gcirc~ĝ~gcy~г~gdot~ġ~gel~⋛~geq~≥~geqq~≧~geqslant~⩾~ges~⩾~gescc~⪩~gesdot~⪀~gesdoto~⪂~gesdotol~⪄~gesl~⋛︀~gesles~⪔~gfr~𝔤~gg~≫~ggg~⋙~gimel~ℷ~gjcy~ѓ~gl~≷~glE~⪒~gla~⪥~glj~⪤~gnE~≩~gnap~⪊~gnapprox~⪊~gne~⪈~gneq~⪈~gneqq~≩~gnsim~⋧~gopf~𝕘~grave~`~gscr~ℊ~gsim~≳~gsime~⪎~gsiml~⪐~gtcc~⪧~gtcir~⩺~gtdot~⋗~gtlPar~⦕~gtquest~⩼~gtrapprox~⪆~gtrarr~⥸~gtrdot~⋗~gtreqless~⋛~gtreqqless~⪌~gtrless~≷~gtrsim~≳~gvertneqq~≩︀~gvnE~≩︀~hairsp~ ~half~½~hamilt~ℋ~hardcy~ъ~harrcir~⥈~harrw~↭~hbar~ℏ~hcirc~ĥ~heartsuit~♥~hercon~⊹~hfr~𝔥~hksearow~⤥~hkswarow~⤦~hoarr~⇿~homtht~∻~hookleftarrow~↩~hookrightarrow~↪~hopf~𝕙~horbar~―~hscr~𝒽~hslash~ℏ~hstrok~ħ~hybull~⁃~hyphen~‐~ic~⁣~icy~и~iecy~е~iff~⇔~ifr~𝔦~ii~ⅈ~iiiint~⨌~iiint~∭~iinfin~⧜~iiota~℩~ijlig~ĳ~imacr~ī~imagline~ℐ~imagpart~ℑ~imath~ı~imof~⊷~imped~Ƶ~in~∈~incare~℅~infintie~⧝~inodot~ı~intcal~⊺~integers~ℤ~intercal~⊺~intlarhk~⨗~intprod~⨼~iocy~ё~iogon~į~iopf~𝕚~iprod~⨼~iscr~𝒾~isinE~⋹~isindot~⋵~isins~⋴~isinsv~⋳~isinv~∈~it~⁢~itilde~ĩ~iukcy~і~jcirc~ĵ~jcy~й~jfr~𝔧~jmath~ȷ~jopf~𝕛~jscr~𝒿~jsercy~ј~jukcy~є~kappav~ϰ~kcedil~ķ~kcy~к~kfr~𝔨~kgreen~ĸ~khcy~х~kjcy~ќ~kopf~𝕜~kscr~𝓀~lAarr~⇚~lAtail~⤛~lBarr~⤎~lE~≦~lEg~⪋~lHar~⥢~lacute~ĺ~laemptyv~⦴~lagran~ℒ~langd~⦑~langle~⟨~lap~⪅~larrb~⇤~larrbfs~⤟~larrfs~⤝~larrhk~↩~larrlp~↫~larrpl~⤹~larrsim~⥳~larrtl~↢~lat~⪫~latail~⤙~late~⪭~lates~⪭︀~lbarr~⤌~lbbrk~❲~lbrace~{~lbrack~[~lbrke~⦋~lbrksld~⦏~lbrkslu~⦍~lcaron~ľ~lcedil~ļ~lcub~{~lcy~л~ldca~⤶~ldquor~„~ldrdhar~⥧~ldrushar~⥋~ldsh~↲~leftarrow~←~leftarrowtail~↢~leftharpoondown~↽~leftharpoonup~↼~leftleftarrows~⇇~leftrightarrow~↔~leftrightarrows~⇆~leftrightharpoons~⇋~leftrightsquigarrow~↭~leftthreetimes~⋋~leg~⋚~leq~≤~leqq~≦~leqslant~⩽~les~⩽~lescc~⪨~lesdot~⩿~lesdoto~⪁~lesdotor~⪃~lesg~⋚︀~lesges~⪓~lessapprox~⪅~lessdot~⋖~lesseqgtr~⋚~lesseqqgtr~⪋~lessgtr~≶~lesssim~≲~lfisht~⥼~lfr~𝔩~lg~≶~lgE~⪑~lhard~↽~lharu~↼~lharul~⥪~lhblk~▄~ljcy~љ~ll~≪~llarr~⇇~llcorner~⌞~llhard~⥫~lltri~◺~lmidot~ŀ~lmoust~⎰~lmoustache~⎰~lnE~≨~lnap~⪉~lnapprox~⪉~lne~⪇~lneq~⪇~lneqq~≨~lnsim~⋦~loang~⟬~loarr~⇽~lobrk~⟦~longleftarrow~⟵~longleftrightarrow~⟷~longmapsto~⟼~longrightarrow~⟶~looparrowleft~↫~looparrowright~↬~lopar~⦅~lopf~𝕝~loplus~⨭~lotimes~⨴~lowbar~_~lozenge~◊~lozf~⧫~lpar~(~lparlt~⦓~lrarr~⇆~lrcorner~⌟~lrhar~⇋~lrhard~⥭~lrtri~⊿~lscr~𝓁~lsh~↰~lsim~≲~lsime~⪍~lsimg~⪏~lsqb~[~lsquor~‚~lstrok~ł~ltcc~⪦~ltcir~⩹~ltdot~⋖~lthree~⋋~ltimes~⋉~ltlarr~⥶~ltquest~⩻~ltrPar~⦖~ltri~◃~ltrie~⊴~ltrif~◂~lurdshar~⥊~luruhar~⥦~lvertneqq~≨︀~lvnE~≨︀~mDDot~∺~male~♂~malt~✠~maltese~✠~map~↦~mapsto~↦~mapstodown~↧~mapstoleft~↤~mapstoup~↥~marker~▮~mcomma~⨩~mcy~м~measuredangle~∡~mfr~𝔪~mho~℧~mid~∣~midast~*~midcir~⫰~minusb~⊟~minusd~∸~minusdu~⨪~mlcp~⫛~mldr~…~mnplus~∓~models~⊧~mopf~𝕞~mp~∓~mscr~𝓂~mstpos~∾~multimap~⊸~mumap~⊸~nGg~⋙̸~nGt~≫⃒~nGtv~≫̸~nLeftarrow~⇍~nLeftrightarrow~⇎~nLl~⋘̸~nLt~≪⃒~nLtv~≪̸~nRightarrow~⇏~nVDash~⊯~nVdash~⊮~nacute~ń~nang~∠⃒~nap~≉~napE~⩰̸~napid~≋̸~napos~ŉ~napprox~≉~natur~♮~natural~♮~naturals~ℕ~nbump~≎̸~nbumpe~≏̸~ncap~⩃~ncaron~ň~ncedil~ņ~ncong~≇~ncongdot~⩭̸~ncup~⩂~ncy~н~neArr~⇗~nearhk~⤤~nearr~↗~nearrow~↗~nedot~≐̸~nequiv~≢~nesear~⤨~nesim~≂̸~nexist~∄~nexists~∄~nfr~𝔫~ngE~≧̸~nge~≱~ngeq~≱~ngeqq~≧̸~ngeqslant~⩾̸~nges~⩾̸~ngsim~≵~ngt~≯~ngtr~≯~nhArr~⇎~nharr~↮~nhpar~⫲~nis~⋼~nisd~⋺~niv~∋~njcy~њ~nlArr~⇍~nlE~≦̸~nlarr~↚~nldr~‥~nle~≰~nleftarrow~↚~nleftrightarrow~↮~nleq~≰~nleqq~≦̸~nleqslant~⩽̸~nles~⩽̸~nless~≮~nlsim~≴~nlt~≮~nltri~⋪~nltrie~⋬~nmid~∤~nopf~𝕟~notinE~⋹̸~notindot~⋵̸~notinva~∉~notinvb~⋷~notinvc~⋶~notni~∌~notniva~∌~notnivb~⋾~notnivc~⋽~npar~∦~nparallel~∦~nparsl~⫽⃥~npart~∂̸~npolint~⨔~npr~⊀~nprcue~⋠~npre~⪯̸~nprec~⊀~npreceq~⪯̸~nrArr~⇏~nrarr~↛~nrarrc~⤳̸~nrarrw~↝̸~nrightarrow~↛~nrtri~⋫~nrtrie~⋭~nsc~⊁~nsccue~⋡~nsce~⪰̸~nscr~𝓃~nshortmid~∤~nshortparallel~∦~nsim~≁~nsime~≄~nsimeq~≄~nsmid~∤~nspar~∦~nsqsube~⋢~nsqsupe~⋣~nsubE~⫅̸~nsube~⊈~nsubset~⊂⃒~nsubseteq~⊈~nsubseteqq~⫅̸~nsucc~⊁~nsucceq~⪰̸~nsup~⊅~nsupE~⫆̸~nsupe~⊉~nsupset~⊃⃒~nsupseteq~⊉~nsupseteqq~⫆̸~ntgl~≹~ntlg~≸~ntriangleleft~⋪~ntrianglelefteq~⋬~ntriangleright~⋫~ntrianglerighteq~⋭~num~#~numero~№~numsp~ ~nvDash~⊭~nvHarr~⤄~nvap~≍⃒~nvdash~⊬~nvge~≥⃒~nvgt~>⃒~nvinfin~⧞~nvlArr~⤂~nvle~≤⃒~nvlt~<⃒~nvltrie~⊴⃒~nvrArr~⤃~nvrtrie~⊵⃒~nvsim~∼⃒~nwArr~⇖~nwarhk~⤣~nwarr~↖~nwarrow~↖~nwnear~⤧~oS~Ⓢ~oast~⊛~ocir~⊚~ocy~о~odash~⊝~odblac~ő~odiv~⨸~odot~⊙~odsold~⦼~ofcir~⦿~ofr~𝔬~ogon~˛~ogt~⧁~ohbar~⦵~ohm~Ω~oint~∮~olarr~↺~olcir~⦾~olcross~⦻~olt~⧀~omacr~ō~omid~⦶~ominus~⊖~oopf~𝕠~opar~⦷~operp~⦹~orarr~↻~ord~⩝~order~ℴ~orderof~ℴ~origof~⊶~oror~⩖~orslope~⩗~orv~⩛~oscr~ℴ~osol~⊘~otimesas~⨶~ovbar~⌽~par~∥~parallel~∥~parsim~⫳~parsl~⫽~pcy~п~percnt~%~period~.~pertenk~‱~pfr~𝔭~phiv~ϕ~phmmat~ℳ~phone~☎~pitchfork~⋔~planck~ℏ~planckh~ℎ~plankv~ℏ~plus~+~plusacir~⨣~plusb~⊞~pluscir~⨢~plusdo~∔~plusdu~⨥~pluse~⩲~plussim~⨦~plustwo~⨧~pm~±~pointint~⨕~popf~𝕡~pr~≺~prE~⪳~prap~⪷~prcue~≼~pre~⪯~prec~≺~precapprox~⪷~preccurlyeq~≼~preceq~⪯~precnapprox~⪹~precneqq~⪵~precnsim~⋨~precsim~≾~primes~ℙ~prnE~⪵~prnap~⪹~prnsim~⋨~profalar~⌮~profline~⌒~profsurf~⌓~propto~∝~prsim~≾~prurel~⊰~pscr~𝓅~puncsp~ ~qfr~𝔮~qint~⨌~qopf~𝕢~qprime~⁗~qscr~𝓆~quaternions~ℍ~quatint~⨖~quest~?~questeq~≟~rAarr~⇛~rAtail~⤜~rBarr~⤏~rHar~⥤~race~∽̱~racute~ŕ~raemptyv~⦳~rangd~⦒~range~⦥~rangle~⟩~rarrap~⥵~rarrb~⇥~rarrbfs~⤠~rarrc~⤳~rarrfs~⤞~rarrhk~↪~rarrlp~↬~rarrpl~⥅~rarrsim~⥴~rarrtl~↣~rarrw~↝~ratail~⤚~ratio~∶~rationals~ℚ~rbarr~⤍~rbbrk~❳~rbrace~}~rbrack~]~rbrke~⦌~rbrksld~⦎~rbrkslu~⦐~rcaron~ř~rcedil~ŗ~rcub~}~rcy~р~rdca~⤷~rdldhar~⥩~rdquor~”~rdsh~↳~realine~ℛ~realpart~ℜ~reals~ℝ~rect~▭~rfisht~⥽~rfr~𝔯~rhard~⇁~rharu~⇀~rharul~⥬~rhov~ϱ~rightarrow~→~rightarrowtail~↣~rightharpoondown~⇁~rightharpoonup~⇀~rightleftarrows~⇄~rightleftharpoons~⇌~rightrightarrows~⇉~rightsquigarrow~↝~rightthreetimes~⋌~ring~˚~risingdotseq~≓~rlarr~⇄~rlhar~⇌~rmoust~⎱~rmoustache~⎱~rnmid~⫮~roang~⟭~roarr~⇾~robrk~⟧~ropar~⦆~ropf~𝕣~roplus~⨮~rotimes~⨵~rpar~)~rpargt~⦔~rppolint~⨒~rrarr~⇉~rscr~𝓇~rsh~↱~rsqb~]~rsquor~’~rthree~⋌~rtimes~⋊~rtri~▹~rtrie~⊵~rtrif~▸~rtriltri~⧎~ruluhar~⥨~rx~℞~sacute~ś~sc~≻~scE~⪴~scap~⪸~sccue~≽~sce~⪰~scedil~ş~scirc~ŝ~scnE~⪶~scnap~⪺~scnsim~⋩~scpolint~⨓~scsim~≿~scy~с~sdotb~⊡~sdote~⩦~seArr~⇘~searhk~⤥~searr~↘~searrow~↘~semi~;~seswar~⤩~setminus~∖~setmn~∖~sext~✶~sfr~𝔰~sfrown~⌢~sharp~♯~shchcy~щ~shcy~ш~shortmid~∣~shortparallel~∥~sigmav~ς~simdot~⩪~sime~≃~simeq~≃~simg~⪞~simgE~⪠~siml~⪝~simlE~⪟~simne~≆~simplus~⨤~simrarr~⥲~slarr~←~smallsetminus~∖~smashp~⨳~smeparsl~⧤~smid~∣~smile~⌣~smt~⪪~smte~⪬~smtes~⪬︀~softcy~ь~sol~/~solb~⧄~solbar~⌿~sopf~𝕤~spadesuit~♠~spar~∥~sqcap~⊓~sqcaps~⊓︀~sqcup~⊔~sqcups~⊔︀~sqsub~⊏~sqsube~⊑~sqsubset~⊏~sqsubseteq~⊑~sqsup~⊐~sqsupe~⊒~sqsupset~⊐~sqsupseteq~⊒~squ~□~square~□~squarf~▪~squf~▪~srarr~→~sscr~𝓈~ssetmn~∖~ssmile~⌣~sstarf~⋆~star~☆~starf~★~straightepsilon~ϵ~straightphi~ϕ~strns~¯~subE~⫅~subdot~⪽~subedot~⫃~submult~⫁~subnE~⫋~subne~⊊~subplus~⪿~subrarr~⥹~subset~⊂~subseteq~⊆~subseteqq~⫅~subsetneq~⊊~subsetneqq~⫋~subsim~⫇~subsub~⫕~subsup~⫓~succ~≻~succapprox~⪸~succcurlyeq~≽~succeq~⪰~succnapprox~⪺~succneqq~⪶~succnsim~⋩~succsim~≿~sung~♪~supE~⫆~supdot~⪾~supdsub~⫘~supedot~⫄~suphsol~⟉~suphsub~⫗~suplarr~⥻~supmult~⫂~supnE~⫌~supne~⊋~supplus~⫀~supset~⊃~supseteq~⊇~supseteqq~⫆~supsetneq~⊋~supsetneqq~⫌~supsim~⫈~supsub~⫔~supsup~⫖~swArr~⇙~swarhk~⤦~swarr~↙~swarrow~↙~swnwar~⤪~target~⌖~tbrk~⎴~tcaron~ť~tcedil~ţ~tcy~т~tdot~⃛~telrec~⌕~tfr~𝔱~therefore~∴~thetav~ϑ~thickapprox~≈~thicksim~∼~thkap~≈~thksim~∼~timesb~⊠~timesbar~⨱~timesd~⨰~tint~∭~toea~⤨~top~⊤~topbot~⌶~topcir~⫱~topf~𝕥~topfork~⫚~tosa~⤩~tprime~‴~triangle~▵~triangledown~▿~triangleleft~◃~trianglelefteq~⊴~triangleq~≜~triangleright~▹~trianglerighteq~⊵~tridot~◬~trie~≜~triminus~⨺~triplus~⨹~trisb~⧍~tritime~⨻~trpezium~⏢~tscr~𝓉~tscy~ц~tshcy~ћ~tstrok~ŧ~twixt~≬~twoheadleftarrow~↞~twoheadrightarrow~↠~uHar~⥣~ubrcy~ў~ubreve~ŭ~ucy~у~udarr~⇅~udblac~ű~udhar~⥮~ufisht~⥾~ufr~𝔲~uharl~↿~uharr~↾~uhblk~▀~ulcorn~⌜~ulcorner~⌜~ulcrop~⌏~ultri~◸~umacr~ū~uogon~ų~uopf~𝕦~uparrow~↑~updownarrow~↕~upharpoonleft~↿~upharpoonright~↾~uplus~⊎~upsi~υ~upuparrows~⇈~urcorn~⌝~urcorner~⌝~urcrop~⌎~uring~ů~urtri~◹~uscr~𝓊~utdot~⋰~utilde~ũ~utri~▵~utrif~▴~uuarr~⇈~uwangle~⦧~vArr~⇕~vBar~⫨~vBarv~⫩~vDash~⊨~vangrt~⦜~varepsilon~ϵ~varkappa~ϰ~varnothing~∅~varphi~ϕ~varpi~ϖ~varpropto~∝~varr~↕~varrho~ϱ~varsigma~ς~varsubsetneq~⊊︀~varsubsetneqq~⫋︀~varsupsetneq~⊋︀~varsupsetneqq~⫌︀~vartheta~ϑ~vartriangleleft~⊲~vartriangleright~⊳~vcy~в~vdash~⊢~vee~∨~veebar~⊻~veeeq~≚~vellip~⋮~verbar~|~vert~|~vfr~𝔳~vltri~⊲~vnsub~⊂⃒~vnsup~⊃⃒~vopf~𝕧~vprop~∝~vrtri~⊳~vscr~𝓋~vsubnE~⫋︀~vsubne~⊊︀~vsupnE~⫌︀~vsupne~⊋︀~vzigzag~⦚~wcirc~ŵ~wedbar~⩟~wedge~∧~wedgeq~≙~wfr~𝔴~wopf~𝕨~wp~℘~wr~≀~wreath~≀~wscr~𝓌~xcap~⋂~xcirc~◯~xcup~⋃~xdtri~▽~xfr~𝔵~xhArr~⟺~xharr~⟷~xlArr~⟸~xlarr~⟵~xmap~⟼~xnis~⋻~xodot~⨀~xopf~𝕩~xoplus~⨁~xotime~⨂~xrArr~⟹~xrarr~⟶~xscr~𝓍~xsqcup~⨆~xuplus~⨄~xutri~△~xvee~⋁~xwedge~⋀~yacy~я~ycirc~ŷ~ycy~ы~yfr~𝔶~yicy~ї~yopf~𝕪~yscr~𝓎~yucy~ю~zacute~ź~zcaron~ž~zcy~з~zdot~ż~zeetrf~ℨ~zfr~𝔷~zhcy~ж~zigrarr~⇝~zopf~𝕫~zscr~𝓏~~AMP~&~COPY~©~GT~>~LT~<~QUOT~\"~REG~®", namedReferences['html4']);

var numericUnicodeMap = {
    0: 65533,
    128: 8364,
    130: 8218,
    131: 402,
    132: 8222,
    133: 8230,
    134: 8224,
    135: 8225,
    136: 710,
    137: 8240,
    138: 352,
    139: 8249,
    140: 338,
    142: 381,
    145: 8216,
    146: 8217,
    147: 8220,
    148: 8221,
    149: 8226,
    150: 8211,
    151: 8212,
    152: 732,
    153: 8482,
    154: 353,
    155: 8250,
    156: 339,
    158: 382,
    159: 376
};

var fromCodePoint = String.fromCodePoint ||
    function (astralCodePoint) {
        return String.fromCharCode(Math.floor((astralCodePoint - 0x10000) / 0x400) + 0xd800, ((astralCodePoint - 0x10000) % 0x400) + 0xdc00);
    };

var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var allNamedReferences = __assign(__assign({}, namedReferences), { all: namedReferences.html5 });
var defaultDecodeOptions = {
    scope: 'body',
    level: 'all'
};
var strict = /&(?:#\d+|#[xX][\da-fA-F]+|[0-9a-zA-Z]+);/g;
var attribute = /&(?:#\d+|#[xX][\da-fA-F]+|[0-9a-zA-Z]+)[;=]?/g;
var baseDecodeRegExps = {
    xml: {
        strict: strict,
        attribute: attribute,
        body: bodyRegExps.xml
    },
    html4: {
        strict: strict,
        attribute: attribute,
        body: bodyRegExps.html4
    },
    html5: {
        strict: strict,
        attribute: attribute,
        body: bodyRegExps.html5
    }
};
var decodeRegExps = __assign(__assign({}, baseDecodeRegExps), { all: baseDecodeRegExps.html5 });
var fromCharCode = String.fromCharCode;
var outOfBoundsChar = fromCharCode(65533);
function getDecodedEntity(entity, references, isAttribute, isStrict) {
    var decodeResult = entity;
    var decodeEntityLastChar = entity[entity.length - 1];
    if (isAttribute && decodeEntityLastChar === '=') {
        decodeResult = entity;
    }
    else if (isStrict && decodeEntityLastChar !== ';') {
        decodeResult = entity;
    }
    else {
        var decodeResultByReference = references[entity];
        if (decodeResultByReference) {
            decodeResult = decodeResultByReference;
        }
        else if (entity[0] === '&' && entity[1] === '#') {
            var decodeSecondChar = entity[2];
            var decodeCode = decodeSecondChar == 'x' || decodeSecondChar == 'X'
                ? parseInt(entity.substr(3), 16)
                : parseInt(entity.substr(2));
            decodeResult =
                decodeCode >= 0x10ffff
                    ? outOfBoundsChar
                    : decodeCode > 65535
                        ? fromCodePoint(decodeCode)
                        : fromCharCode(numericUnicodeMap[decodeCode] || decodeCode);
        }
    }
    return decodeResult;
}
/** Decodes all entities in the text */
function decode(text, _a) {
    var _b = defaultDecodeOptions , _c = _b.level, level = _c === void 0 ? 'all' : _c, _d = _b.scope, scope = _d === void 0 ? level === 'xml' ? 'strict' : 'body' : _d;
    if (!text) {
        return '';
    }
    var decodeRegExp = decodeRegExps[level][scope];
    var references = allNamedReferences[level].entities;
    var isAttribute = scope === 'attribute';
    var isStrict = scope === 'strict';
    return text.replace(decodeRegExp, function (entity) { return getDecodedEntity(entity, references, isAttribute, isStrict); });
}

/* eslint-disable no-multi-spaces */


const MODE = {
  BITBUCKET: 'bitbucket',
  GHOST: 'ghost',
  GITHUB: 'github',
  GITLAB: 'gitlab',
  MARKDOWNIT: 'markdownit',
  MARKED: 'marked',
  PANDOC: 'pandoc',
  UNIFIED: 'unified'
};

// CJK punctuations 。？！，、；：【】（）〔〕［］﹃﹄“”‘’﹁﹂—…－～《》〈〉「」
const RE_CJK =
  /[\u2014\u2018\u2019\u201c\u201d\u2026\u3001\u3002\u3008-\u300d\u3010\u3011\u3014\u3015\ufe41-\ufe44\uff01\uff08\uff09\uff0c\uff0d\uff1a\uff1b\uff1f\uff3b\uff3d\uff5e]/g;
const RE_ENTITIES = /&([a-z][a-z0-9]+|#[0-9]{2,4});/gi;
const RE_SPECIALS_DOT = /[./?!:[\]`,()*"';{}+=<>~\\$|#@&\u2013\u2014^]/g;
const RE_SPECIALS = /[/?!:[\]`,()*"';{}+=<>~\\$|#@&\u2013\u2014^]/g;

/**
 * basicGithubId
 * @private
 */
function basicGithubId (text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-') // whitespaces
    .replace(/%25|%/gi, '') // remove single % signs
    .replace(RE_ENTITIES, '') // remove xml/html entities
    .replace(RE_SPECIALS_DOT, '') // single chars that are removed
    .replace(RE_CJK, '') // CJK punctuations that are removed
}

/**
 * getGithubId - anchors used at github.com
 * @private
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '-' and the number.
 */
function getGithubId (text) {
  text = basicGithubId(text);
  text = text.replace(emojiRegex(), ''); // Strip emojis
  return text
}

/**
 * getBitbucketId - anchors used at bitbucket.org
 * @private
 * @see: https://github.com/Python-Markdown/markdown/blob/master/markdown/extensions/toc.py#L25
 * There seams to be some "magic" preprocessor which could not be handled here.
 * @see: https://github.com/Python-Markdown/markdown/issues/222
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '_' and the number.
 * https://groups.google.com/d/msg/bitbucket-users/XnEWbbzs5wU/Fat0UdIecZkJ
 */
function getBitbucketId (text) {
  text =
    'markdown-header-' +
    text
      .toLowerCase()
      .replace(/\\(.)/g, (_m, c) => c.charCodeAt(0)) // add escaped chars with their charcode
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-') // whitespace
      .replace(/-+/g, '-') // duplicated hyphen
      .replace(/^-+|-+$/g, ''); // heading/ tailing hyphen
  return text
}

/**
 * getGhostId - anchors used at ghost.org or in `npm i ghost`
 * @private
 * @see https://github.com/TryGhost/Koenig/blob/master/packages/kg-markdown-html-renderer/lib/markdown-html-renderer.js
 */
function getGhostId (text) {
  return decode(text).replace(/[^a-z0-9]/gi, '')
}

/**
 * getGitlabId - anchors used at gitlab.com
 * @private
 * @see: https://github.com/gitlabhq/gitlabhq/blob/master/doc/user/markdown.md#header-ids-and-links
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '-' and the number.
 */
function getGitlabId (text) {
  text = basicGithubId(text);
  text = text
    .replace(emojiRegex(), '') // Strip emojis
    .replace(/-+/g, '-'); // duplicated hyphen
  return text
}

/**
 * getPandocId - anchors used at pandoc
 * @private
 */
function getPandocId (text) {
  text = text
    .replace(emojiRegex(), '') // Strip emojis
    .toLowerCase()
    .trim()
    .replace(/%25|%/gi, '') // remove single % signs
    .replace(RE_ENTITIES, '') // remove xml/html entities
    .replace(RE_SPECIALS, '') // single chars that are removed but not [.-]
    .replace(/\s+/g, '-') // whitespaces
    .replace(/^-+|-+$/g, '') // heading/ tailing hyphen
    .replace(RE_CJK, ''); // CJK punctuations that are removed

  if (/^[0-9-]+$/.test(text)) {
    text = 'section';
  }
  return text
}

/**
 * @see https://github.com/markedjs/marked/blob/master/src/helpers.js#L30
 */
function unescapeMarked (html) {
  // explicitly match decimal, hex, and named HTML entities
  return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi, (_, n) => {
    n = n.toLowerCase();
    if (n === 'colon') return ':'
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1))
    }
    return ''
  })
}

/**
 * getMarkedId - anchors used in `npm i marked`
 * @private
 * @see https://github.com/markedjs/marked/blob/master/src/Slugger.js#L19 v0.8.2
 */
function getMarkedId (text) {
  const _text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1'); // normalize links
  return unescapeMarked(_text)
    .toLowerCase()
    .trim()
    .replace(/<[!/a-z].*?>/gi, '') // remove html tags
    .replace(
      /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g,
      ''
    ) // remove unwanted chars
    .replace(/\s/g, '-')
}

/**
 * getMarkDownItAnchorId - anchors used with `npm i markdown-it-anchor`
 * @private
 * @see: https://github.com/valeriangalliat/markdown-it-anchor/blob/master/index.js#L1
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '_' and the number.
 * numbering starts at 2!
 */
function getMarkDownItAnchorId (text) {
  text = text.replace(/^[<]|[>]$/g, ''); // correct markdown format bold/url
  text = decode(text).toLowerCase().trim().replace(/\s+/g, '-');
  return encodeURIComponent(text)
}

/**
 * @private
 */
function asciiOnlyToLowerCase (input) {
  let result = '';
  for (let i = 0; i < input.length; ++i) {
    if (input[i] >= 'A' && input[i] <= 'Z') {
      result += input[i].toLowerCase();
    } else {
      result += input[i];
    }
  }
  return result
}

/**
 * Generates an anchor for the given header and mode.
 *
 * @param header      {String} The header to be anchored.
 * @param mode        {String} The anchor mode (github.com|nodejs.org|bitbucket.org|ghost.org|gitlab.com).
 * @return            {String} The header anchor that is compatible with the given mode.
 */
function slugger (header, mode) {
  mode = mode || 'marked';
  let replace;

  switch (mode) {
    case MODE.MARKED:
      replace = getMarkedId;
      break
    case MODE.MARKDOWNIT:
      return getMarkDownItAnchorId(header)
    case MODE.GITHUB:
      replace = getGithubId;
      break
    case MODE.GITLAB:
      replace = getGitlabId;
      break
    case MODE.PANDOC:
      replace = getPandocId;
      break
    case MODE.BITBUCKET:
      replace = getBitbucketId;
      break
    case MODE.GHOST:
      replace = getGhostId;
      break
    default:
      throw new Error('Unknown mode: ' + mode)
  }

  const href = replace(asciiOnlyToLowerCase(header.trim()));

  return encodeURI(href)
}

class Anchor {
  constructor (mode = MODE.MARKED) {
    this._counters = {};
    this._mode = mode;
    this._startCnt = 0;

    switch (mode) {
      case MODE.BITBUCKET:
        this._fn = (...args) => this._inc('_', ...args);
        break
      case MODE.GITHUB:
      case MODE.GITLAB:
      case MODE.PANDOC:
      case MODE.MARKED:
        this._fn = (...args) => this._inc('-', ...args);
        break
      case MODE.MARKDOWNIT:
        this._startCnt = 0;
        this._fn = (...args) => this._inc('-', ...args);
        break
      case MODE.GHOST:
        // repetitions not supported
        this._fn = (id) => id;
        break
      default:
        throw new Error('Unknown mode: ' + mode)
    }
  }

  _inc (sep, id, isInc) {
    if (!this._counters[id]) this._counters[id] = 0;
    const cnt = this._counters[id];
    if (isInc) {
      if (!cnt) this._counters[id] = this._startCnt;
      this._counters[id] += 1;
    }
    return cnt ? id + sep + cnt : id
  }

  get (header, isInc) {
    const id = slugger(header, this._mode);
    return this._fn(id, isInc)
  }
}

MODE.UNIFIED = 'unified';

const REMOVENUMBER = /^([0-9]+\\?\.)+ +/;

/**
 * Parser
 * @constructor
 * @param {Object} options
 * @param {Object} options.renderer - Custom renderer
 */
function Parser (options) {
  this.tokens = [];
  this.token = null;
  this.count = -1;
  this.indent = [];
  this.options = options || defaults;
  this.options.renderer = this.options.renderer || new Renderer(); // jshint ignore:line
  this.renderer = this.options.renderer;
  this.renderer.options = this.options;

  this.anchorMode = [
    MODE.GHOST,
    MODE.BITBUCKET,
    MODE.GITLAB,
    MODE.GITHUB,
    MODE.PANDOC,
    MODE.UNIFIED,
    MODE.MARKDOWNIT,
    MODE.MARKED
  ]
    .map((k) => this.options[k] && k)
    .filter((k) => k)[0];
  if (this.anchorMode === MODE.UNIFIED) {
    this.anchorMode = MODE.GITHUB;
  }
  this._anchors = new Anchor(this.anchorMode);
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
  this.tokens = tokens;

  this.updateAutoIdentifier();

  let out = '';
  while (this.next()) {
    out += this.tok();
  }

  return out
};

/**
 * Next Token
 */
Parser.prototype.next = function () {
  this.token = this.tokens[(this.count += 1)];
  return this.token
};

/**
 * Preview Next Token
 */
Parser.prototype.peek = function () {
  return this.tokens[this.count + 1] || 0
};

/**
 * Parse references
 */
Parser.prototype.references = function () {
  const refs = [];
  const uniq = {
    title: {},
    ref: {}
  };

  this.tokens.forEach(function (token) {
    if (token.type === 'def' && !/^#/.test(token.href)) {
      if (token.title) {
        uniq.title[token.ref] = token.title;
      } else {
        uniq.ref[token.ref] = token.ref;
      }
    }
  });

  for (const i in uniq.title) {
    refs.push({
      ref: i,
      title: uniq.title[i]
    });
  }
  for (const i in uniq.ref) {
    if (!uniq.title[i]) {
      refs.push({
        ref: i,
        title: i
      });
    }
  }

  return refs
};

/**
 * Parse Table of Contents
 */
Parser.prototype.tableOfContents = function () {
  return this.tokens.filter((token) => {
    if (token.type === 'heading') {
      return true
    }
    return false
  })
};

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
  };

  const inlineText = getInlineAnchorText(token, this.anchorMode);
  const header = (opts.raw ? token.raw : inlineText || token.text).replace(
    /^#/,
    ''
  );
  // increment header regardless if previous anchor was applied
  const id = this._anchors.get(header, opts.inc);

  if (token.anchor) {
    return token.anchor
  }

  return id
};

/**
 * Update Auto Identifiers
 */
Parser.prototype.updateAutoIdentifier = function () {
  const self = this;
  const headings = {};
  this._anchors = new Anchor(this.anchorMode);

  // sanitize the id before lookup
  function prep (id) {
    id = id.replace(/(?:%20|\+)/g, ' ');
    id = self.headingAutoId({ text: id });
    return id
  }

  // obtain headings ids
  this.tokens = this.tokens.map((token) => {
    if (token.type === 'heading') {
      const raw = this.headingAutoId(token, { raw: true }); // needs to come first because of counter increment
      const id = this.headingAutoId(token, { inc: true });
      headings[raw] = '#' + id;
      headings[id] = '#' + id;
      token.autoid = id;
    }
    return token
  });

  this.tokens = this.tokens.map(function (token) {
    let id;
    if (token.inline) {
      token.inline = token.inline.map((token) => {
        switch (token.type) {
          case 'link':
          case 'image': {
            id = prep(token.href);
            if (headings[id]) {
              token.href = headings[id];
            }
            break
          }
        }
        return token
      });
    } else {
      switch (token.type) {
        case 'def': {
          if (token.href && token.href.indexOf('#') === 0) {
            id = prep(token.href);
            if (headings[id]) {
              token.href = headings[id];
            }
            break
          }
        }
      }
    }
    return token
  });
};

/**
 * Prepare headings text if numberedheadings option is set
 * updates all tokens containing headings
 * @param {Number} maxLevel
 * @param {Number} minLevel
 */
Parser.prototype.numberedHeadings = function (
  maxLevel,
  minLevel,
  skip,
  start,
  omit,
  skipEscaping
) {
  const omitMatch = {};
  let skipFlag = false;
  const numbering = new Numbering(start, skipEscaping);

  skip = skip || 0
  ;(omit || []).forEach(function (key) {
    omitMatch[key] = true;
  });

  maxLevel = maxLevel || defaults.level;
  minLevel = minLevel || defaults.minlevel;

  this.tokens = this.tokens.map((token) => {
    if (token.type === 'heading') {
      token.text = token.text.replace(REMOVENUMBER, '');
      const tmp = token.raw.replace(REMOVENUMBER, '');
      if (tmp !== token.raw && token.inline) {
        // need to re-lex the inline tokens
        token.inline = new InlineLexer(this.options).lex(tmp);
      }
      token.raw = tmp;

      if (token.depth === minLevel) {
        if (skip > 0) {
          skip -= 1;
          skipFlag = true;
        } else if (skip === 0) {
          skipFlag = false;
        }
      }

      if (
        !skipFlag &&
        !omitMatch[token.raw] &&
        token.depth <= maxLevel &&
        token.depth >= minLevel
      ) {
        token.number = numbering.count(token.depth - minLevel + 1);
        const text = token.number + ' ';
        token.text = text + token.text;
        if (token.inline) {
          token.inline.unshift({ type: 'text', text });
        }
      }
    }
    return token
  });
};

/**
 * Parse Current Token
 */
Parser.prototype.tok = function (options) {
  options = options || {};

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
      let body = ''
      ;(this.token.inline || []).forEach((token) => {
        body += this.inlinetok(token);
      });
      return this.renderer.paragraph(body)
    }
    case 'text': {
      let body = ''
      ;(this.token.inline || []).forEach((token) => {
        body += this.inlinetok(token);
      });
      return this.renderer.text(body)
    }
    case 'heading': {
      return this.renderer.heading(
        this.token.text,
        this.token.depth,
        this.token.raw,
        this.token.number,
        this.token.autoid,
        this.token.anchor
      )
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
      return this.renderer.reference(
        this.token.ref,
        this.token.href,
        this.token.title
      )
    }
    case 'blockquote_start': {
      let body = '';

      while (this.next().type !== 'blockquote_end') {
        body += this.tok();
      }

      return this.renderer.blockquote(body)
    }
    case 'list_start': {
      let obj;
      let body = '';
      const ordered = this.token.ordered;
      let start = this.token.start;

      while (this.next().type !== 'list_end') {
        if (this.options.autonumber && ordered) {
          obj = {
            start: start++
          };
        }
        body += this.tok(obj);
      }

      return this.renderer.list(body, ordered)
    }
    case 'list_item_start': {
      let body = '';
      let bullet = this.token.text;
      if (options.start) {
        bullet = options.start + '.';
      }
      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return this.renderer.listitem(bullet, body)
    }
    case 'loose_item_start': {
      let body = '';
      let bullet = this.token.text;
      if (options.start) {
        bullet = options.start + '.';
      }

      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return this.renderer.listitem(bullet, body)
    }
    case 'ppnumberedheadings': {
      this.options.numberedHeadings = true;
      this.numberedHeadings(
        this.token.level,
        this.token.minlevel,
        this.token.skip,
        this.token.start,
        this.token.omit,
        this.token.skipEscaping
      );
      this.updateAutoIdentifier();
      return this.renderer.numberedHeadings(
        this.token.level,
        this.token.minlevel,
        this.token.skip,
        this.token.start,
        this.token.omit,
        this.token.skipEscaping
      )
    }
    case 'ppref': {
      return this.renderer.references(this.references())
    }
    case 'ppinclude_start': {
      let body = '';
      if (this.token.tags) {
        const indent = this.token.indent.replace('\t', '    ').length;
        body +=
          '<!-- include (' +
          this.token.text.replace(/ /g, '\\ ') +
          (this.token.lang ? ' lang=' + this.token.lang : '') +
          (indent ? ' indent=' + indent.toString() : '') +
          (this.token.start ? ' start=' + this.token.start : '') +
          (this.token.end ? ' end=' + this.token.end : '') +
          ') -->\n';
      }
      if (typeof this.token.lang === 'string') {
        body += this.renderer.fence(this.token.lang);
      }
      return body
    }
    case 'ppinclude_end': {
      let body = '';
      if (typeof this.token.lang === 'string') {
        body += this.renderer.fence();
      }
      if (this.token.tags) {
        body += '<!-- /include -->\n';
      }
      if (this.token.link) {
        body +=
          this.renderer.link(this.token.raw, this.token.link, this.token.text) +
          '\n';
      }
      if (this.token.vscode && this.token.vscodefile) {
        /* vscode url format is an absolute path with a file:// scheme */
        const uri =
          'vscode://file/' +
          this.token.vscodefile +
          (this.token.start ? ':' + this.token.start + ':1' : '');
        body +=
          this.renderer.link(this.token.raw, this.token.vscode, uri) + '\n';
      }
      return body
    }
    case 'ppinclude': {
      return this.renderer.include(
        this.token.text,
        this.token.indent,
        this.token.lang
      )
    }
    case 'pptoc': {
      return this.renderer.tableOfContents(this.tableOfContents(), this.token)
    }
    default: {
      return '<!-- ' + JSON.stringify(this.token) + ' -->\n'
    }
  }
};

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
};

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
  const parser = new Parser(options);
  return parser.parse(tokens)
};

/**
 * @api private
 */
function getInlineAnchorText (token, mode) {
  if (token.inline) {
    let text = token.inline
      .map((token) => {
        let text = token.text;

        // sanitation for different anchor modes
        if (mode === MODE.MARKDOWNIT && token.type === 'code') {
          text = text.replace(/`/g, '');
        } else if (
          [MODE.GITHUB, MODE.GITLAB, MODE.PANDOC].includes(mode) &&
          token.type === 'tag'
        ) {
          text = '';
        } else if (mode === MODE.BITBUCKET && token.type === 'escape') {
          text = '\\' + text;
        }

        return text
      })
      .join('');

    if (mode === MODE.PANDOC) {
      // no numbering!
      text = text.replace(REMOVENUMBER, '');
    }
    return text
  }
}

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
    callback = options;
    options = null;
  }

  options = Object.assign({}, defaults, options || {});

  Lexer.lex(markedpp.ppInclude, src, options, function (err, tokens) {
    let out = tokens;
    if (!err && tokens) {
      out = Parser.parse(tokens, options);
    }
    callback(err, out);
  });
}

/**
 * exports
 */
markedpp.defaults = defaults;
markedpp.Lexer = Lexer;
markedpp.InlineLexer = InlineLexer;
markedpp.Renderer = Renderer;
markedpp.Parser = Parser;

markedpp.ppInclude = ppInclude;

const markedAsync = (md) =>
  new Promise((resolve, reject) => {
    markedpp(md, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

export { markedpp as default, markedAsync, markedpp };
