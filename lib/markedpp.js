/*!
 * Markdown Preprocessor
 *
 * @copyright 2014 commenthol
 * @licence MIT
 *
 * @note Code inspired by `marked` project
 * @credits Christopher Jeffrey <https://github.com/chjj/marked>
 */

(function (ctx) {
'use strict';

/*
 * default values
 */
var defaults = {
	gfm: true,    // consider gfm fences
	breaks: true, // render <br> tags for Table of Contents with numbered style
	tags: true,   // render pre-proc tags <!-- !command -->
	level: 3,     // default level for !toc and !numberheadings
	minlevel: 1   // default minlevel for !toc and !numberheadings
};

/*
 * Helpers
 */

function isNodeJs() {
	return (typeof process !== 'undefined' && typeof module !== 'undefined' && module.exports);
}

function replace(regex, opt) {
	regex = regex.source;
	opt = opt || '';
	return function self(name, val) {
		if (!name) return new RegExp(regex, opt);
		val = val.source || val;
		val = val.replace(/(^|[^\[])\^/g, '$1');
		regex = regex.replace(name, val);
		return self;
	};
}

function noop() {}
noop.exec = noop;

function merge(obj) {
	var i = 1,
		target,
		key;

	for (; i < arguments.length; i++) {
		target = arguments[i];
		for (key in target) {
			if (Object.prototype.hasOwnProperty.call(target, key)) {
				obj[key] = target[key];
			}
		}
	}

	return obj;
}

/*
 * code from <https://github.com/joyent/node/blob/master/lib/path.js>
 * @credits Joyent
 */
var path = {
	normalizeArray: function (parts, allowAboveRoot) {
		// if the path tries to go above the root, `up` ends up > 0
		var up = 0;
		for (var i = parts.length - 1; i >= 0; i--) {
			var last = parts[i];
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

		return parts;
	},
	resolve: function () {
		var resolvedPath = '',
			resolvedAbsolute = false;

		for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
			var path = (i >= 0) ? arguments[i] : '/';

			// Skip empty and invalid entries
			if (!path) {
				continue;
			}

			resolvedPath = path + '/' + resolvedPath;
			resolvedAbsolute = path.charAt(0) === '/';
		}

		// At this point the path should be resolved to a full absolute path, but
		// handle relative paths to be safe (might happen when process.cwd() fails)

		// Normalize the path
		resolvedPath = this.normalizeArray(resolvedPath.split('/').filter(function(p) {
			return !!p;
		}), !resolvedAbsolute).join('/');

		return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
	},
	splitPathRe: /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/,
	splitPath: function(filename) {
		return this.splitPathRe.exec(filename).slice(1);
	},
	dirname: function(path) {
		var	result = this.splitPath(path),
			root = result[0],
			dir = result[1];

		if (!root && !dir) {
			// No dirname whatsoever
			return '.';
		}

		if (dir) {
			// It has a dirname, strip trailing slash
			dir = dir.substr(0, dir.length - 1);
		}

		return root + dir;
	},
	join: function() {
		return Array.prototype.slice.call(arguments).join('/');
	}
};

/*
 * code from <https://github.com/caolan/async.git>
 * @credits Caolan McMahon
 */
var async = {
	_eachLimit: function (limit) {
		return function (arr, iterator, callback) {
			callback = callback || function () {};
			if (!arr.length || limit <= 0) {
				return callback();
			}
			var completed = 0;
			var started = 0;
			var running = 0;

			(function replenish () {
				if (completed >= arr.length) {
					return callback();
				}

				while (running < limit && started < arr.length) {
					started += 1;
					running += 1;
					iterator(arr[started - 1], function (err) {
						if (err) {
							callback(err);
							callback = function () {};
						}
						else {
							completed += 1;
							running -= 1;
							if (completed >= arr.length) {
								callback();
							}
							else {
								replenish();
							}
						}
					}); // jshint ignore:line
				}
			})();
		};
	},
	eachLimit: function (arr, limit, iterator, callback) {
		var fn = this._eachLimit(limit);
		fn.apply(null, [arr, iterator, callback]);
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
	var o = options ? options : {};
	var	self = this,
		req    = new XMLHttpRequest(),
		method = o.method || 'get',
		async  = (typeof o.async !== 'undefined' ? o.async : true),
		params = o.data || null,
		key;

	req.queryString = params;
	req.open(method, url, async);
	// Set "X-Requested-With" header
	req.setRequestHeader('X-Requested-With','XMLHttpRequest');

	if (method.toLowerCase() == 'post') {
		req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
	}

	for (key in o.headers) {
		if (o.headers.hasOwnProperty(key)) {
		  req.setRequestHeader(key, o.headers[key]);
		}
	}

	function stateChange(){
		if(req.readyState === 4) {
			if((/^[20]/).test(req.status)) {
				callback(null, req.responseText);
			}
			else if((/^[45]/).test(req.status)) {
				callback(new Error(req.status));
			}
		}
	}

	if (async) {
		req.onreadystatechange = stateChange;
	}
	req.send(params);
	if (!async) stateChange();
}

var ppInclude;

if (isNodeJs()) {
	ppInclude = require('./ppinclude')(Lexer, merge);
}
else {
	/**
	 * Include and Lex files
	 * @param {Array} tokens - array of tokens
	 * @param {Object} options - options to overwrite
	 * @param {String} options.dirname - base directory from where to search files to include (If not specified then current working directory is used)
	 * @param {Function} callback - `function(err, tokens)`
	 */
	ppInclude = function (tokens, options, callback) {
		var	dirname = options.dirname || '/',
			lexed = {},
			_options = merge({}, options);

		// ppInclude is used to detect recursions
		if (! _options.ppInclude ) { _options.ppInclude = {}; }

		async.eachLimit(tokens, 5, function (token, done){
			if (token.type === 'ppinclude' &&
				typeof token.text === 'string' &&
				! _options.ppInclude[token.text] )
			{
				var path_ = path.resolve(path.join(path.dirname(location.pathname), dirname, token.text));
				var url = location.origin + path_;
				xhr(url, function (err, src) {
					_options.ppInclude[token.text] = 1;
					_options.dirname = path.dirname(path_);
					if (err) {
						console.error('Error: ' + err.message);
						return done();
					}
					var lexer = new Lexer(_options);
					ppInclude( lexer.lex(src), _options, function (err, ntokens){
						lexed[token.text] = ntokens;
						done();
					});
				});
			}
			else {
				done();
			}
		},
		function (err) {
			var	_tokens = [];

			// compose the new tokens array
			tokens.forEach(function(token, idx){
				if (token.type === 'ppinclude' &&
					typeof token.text === 'string' &&
					lexed[token.text] !== undefined)
				{
					_tokens.push({
						type: 'ppinclude.start',
						text: token.text,
						indent: token.indent,
						lang: token.lang
					});
					lexed[token.text].forEach(function(token){
						_tokens.push(merge({},token)); // clone tokens!
					});
					_tokens.push({
						type: 'ppinclude.end',
						lang: token.lang
					});
				}
				else {
					_tokens.push(token);
				}
			});
			callback(null, _tokens);
		});
	}
}

/*
 *  preprocessor regex rules
 */
var rules = {
	heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
	lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
	code: /^( {4}[^\n]+\n*)+/,
	// ----
	fences: noop,
	// ----
	_ppopts_: / ?(?:\(([^\)]+)\))?/,
	// ----
	ppinclude: /^( *)(?:\!(?:INCLUDE|include)_ppopts_|_ppinclude_|_ppincludeCompat_) *(?:\n|$)/,
	_ppinclude_: /<!-- *include_ppopts_ *-->(?:(?!<!-- *\/include * -->)[^])*<!-- *\/include * -->/,
	_ppincludeCompat_: /\!INCLUDE "([^"]+)"/,
	ppnumberedheadings: /^ *(?:\!(?:NUMBEREDHEADINGS|numberedheadings)_ppopts_|_ppnumberedheadings_) *(?:\n+|$)/,
	_ppnumberedheadings_: /<!-- \!*numberedheadings_ppopts_ *-->/,
	pptoc: /^(?:\!(?:TOC|toc)_ppopts_|_pptoc_|_pptocCompat1_|_pptocCompat2_) *(?:\n+|$)/,
	_pptoc_: /<!-- *\!toc_ppopts_ *-->(?:(?!<!-- *toc\! * -->)[^])*<!-- *toc\! * -->/,
	_pptocCompat1_: /<!-- *toc *-->(?:(?!<!-- *\/toc * -->)[^])*<!-- *\/toc * -->/,
	_pptocCompat2_: /<!-- *toc *-->/,
	ppref: /^(?:\!(?:REF|ref)|_ppref_|_pprefCompat_) *(?:\n|$)/,
	_ppref_: /<!-- *\!ref *-->(?:(?!<!-- *ref\! * -->)[^])*<!-- *ref\! * -->/,
	_pprefCompat_: /<!-- *ref *-->(?:(?!<!-- *\/ref * -->)[^])*<!-- \/ref * -->/,
	// ----
	def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n|$)/,
	text: /^[^\n]*\n/,
};

// join the rules
rules.ppinclude = replace(rules.ppinclude)
	('_ppinclude_', rules._ppinclude_)
	('_ppincludeCompat_', rules._ppincludeCompat_)
	('_ppopts_', rules._ppopts_)
	('_ppopts_', rules._ppopts_)
	();
rules.ppnumberedheadings = replace(rules.ppnumberedheadings)
	('_ppnumberedheadings_', rules._ppnumberedheadings_)
	('_ppopts_', rules._ppopts_)
	('_ppopts_', rules._ppopts_)
	();
rules.pptoc = replace(rules.pptoc)
	('_pptoc_', rules._pptoc_)
	('_ppopts_', rules._ppopts_)
	('_ppopts_', rules._ppopts_)
	('_pptocCompat1_', rules._pptocCompat1_)
	('_pptocCompat2_', rules._pptocCompat2_)
	();
rules.ppref = replace(rules.ppref)
	('_ppref_', rules._ppref_)
	('_pprefCompat_', rules._pprefCompat_)
	();

rules.gfm = merge({}, rules, {
  fences: /^( *)(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\2 *(?:\n|$)/
});

/**
 * Lexer
 * @constructor
 * @param {Object} options - overwrites default options
 */
function Lexer(options) {
	this.tokens = [];
	this.options = options || defaults;
	this.rules = rules;
	if (this.options.gfm) {
		this.rules = rules.gfm;
	}
}

/**
 * Preprocessing
 * @param {String} src - markdown source
 * @return {Object} token
 */
Lexer.prototype.lex = function(src) {
	src = src
		.replace(/\r\n|\r/g, '\n')
		.replace(/\t/g, '    ')
		.replace(/\u00a0/g, ' ')
		.replace(/\u2424/g, '\n');

	return this.token(src, true);
};

/**
 * Lexing
 * @param {String} src - markdown source
 * @return {Array} - array of tokens
 */
Lexer.prototype.token = function(src) {
	var	cap,
		tmp,
		opts,
		self = this;

	src = src.replace(/^ +$/gm, '');

	while (src) {

		// ppinclude
		if ((cap = this.rules.ppinclude.exec(src))) {
			src = src.substring(cap[0].length);
			tmp = cap[2] || cap[3] || cap[4];
			opts = Lexer.splitOpts(tmp);
			tmp = tmp.replace(/ *(?:[a-z]+=[a-z0-9\-]+)/, '').replace(/\\ /g, ' ');
			this.tokens.push({
				type: 'ppinclude',
				text: tmp,
				indent: cap[1],
				lang: opts.lang
			});
			continue;
		}

		// code
		if (cap = this.rules.code.exec(src)) {
			src = src.substring(cap[0].length);
			this.tokens.push({
				type: 'code',
				text: cap[0]
			});
			continue;
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
			continue;
		}

		// heading
		if ((cap = this.rules.heading.exec(src))) {
			src = src.substring(cap[0].length);
			this.tokens.push({
				type: 'heading',
				depth: cap[1].length,
				text: cap[2],
				raw: cap[2]
			});
			continue;
		}

		// lheading
		if ((cap = this.rules.lheading.exec(src))) {
			src = src.substring(cap[0].length);
			this.tokens.push({
				type: 'heading',
				depth: cap[2] === '=' ? 1 : 2,
				text: cap[1],
				raw: cap[1]
			});
			continue;
		}

		// ppnumberedheadings
		if ((cap = this.rules.ppnumberedheadings.exec(src))) {
			src = src.substring(cap[0].length);
			opts = Lexer.splitOpts(cap[1] || cap[2]);
			if (typeof opts.omit === 'string') {
				opts.omit = [ opts.omit ];
			}
			this.tokens.push({
				type: 'ppnumberedheadings',
				level: Lexer.range(opts.level, defaults.minlevel, 6, defaults.level),
				minlevel: Lexer.range(opts.minlevel, defaults.minlevel, 6),
				skip: opts.skip,
				start: opts.start,
				omit: opts.omit
			});
			continue;
		}

		// pptoc
		if ((cap = this.rules.pptoc.exec(src))) {
			src = src.substring(cap[0].length);
			opts = Lexer.splitOpts(cap[1] || cap[2]);
			if (typeof opts.omit === 'string') {
				opts.omit = [ opts.omit ];
			}
			this.tokens.push({
				type: 'pptoc',
				level: Lexer.range(opts.level, defaults.minlevel, 6, defaults.level),
				minlevel: Lexer.range(opts.minlevel, defaults.minlevel, 6),
				numbered: opts.numbered,
				omit: opts.omit
			});
			continue;
		}

		// ppref
		if ((cap = this.rules.ppref.exec(src))) {
			src = src.substring(cap[0].length);
			this.tokens.push({
				type: 'ppref'
			});
			continue;
		}

		// def
		if ((cap = this.rules.def.exec(src))) {
			src = src.substring(cap[0].length);
			this.tokens.push({
				type: 'def',
				ref: cap[1],
				href: cap[2],
				title: cap[3]
			});
			continue;
		}

		// text
		if ((cap = this.rules.text.exec(src))) {
			// Top-level should never reach here.
			src = src.substring(cap[0].length);
			this.tokens.push({
				type: 'text',
				text: cap[0]
			});
			continue;
		}

		if (src) {
			throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
		}
	}

	return this.tokens;
};

/**
 * Expose Block Rules
 */
Lexer.rules = rules;

/**
 * Static Lex Method
 * @param {String} src - markdown source
 * @param {Object} options - options to overwrite
 * @param {Function} callback - `function(err, tokens)`
 */
Lexer.lex = function(src, options, callback) {
	var lexer = new Lexer(options);
	var tokens = lexer.lex(src); // returns the lexed tokens
	ppInclude(tokens, options, function(err, tokens){
		callback(err, tokens);
	});
};

/**
 * Split preproc command options
 * @param {String} str - string to split into key-value pairs
 */
Lexer.splitOpts = function(str) {
	var opts = {},
		sep,
		tmp = '',
		KEY       = /^(.+)$/,
		KEYVALUE  = /^([a-z0-9]+)=(.*)$/,
		KEYVALUES = /^([a-z0-9]+)=(["'])(.*?)\2$/;

	(str||'').split(' ').forEach(function(s) {
		if (/\\$|^["'].*[^"']$/.test(s) || sep && !sep.test(s)) {
			tmp += s + ' ';
			return;
		}
		if (/\=(["']).*[^"']$/.test(s)) {
			sep = s.replace(/^.*\=(["']).*[^"']$/, '$1');
			sep = new RegExp (sep + '$');
			tmp += s + ' ';
			return;
		}
		if (tmp) {
			s = tmp + s;
			tmp = '';
			sep = undefined;
		}
		if (KEYVALUES.test(s)) {
			s.replace(KEYVALUES, function(m, key, x, value) {
				opts[key] = value.split(';');
				opts[key] = opts[key].map(function(value){
					var	tmp = parseInt(value, 10);
					if (!isNaN(tmp)) {
						value = tmp;
					}
					return value;
				});
				if (opts[key].length === 1) {
					opts[key] = opts[key][0];
				}
			});
		}
		else if (KEYVALUE.test(s)) {
			s.replace(KEYVALUE, function(m, key, value) {
				var	tmp = parseInt(value, 10);
				if (!isNaN(tmp)) {
					value = tmp;
				}
				opts[key] = value;
			});
		}
		else if (KEY.test(s)){
			s = s.replace(/\\ /g, ' ').replace(/^(["'])([^\1]+)\1$/, '$2');
			if (/^\!(.*)$/.test(s)) {
				s = s.replace(/^\!(.*)$/, '$1');
				opts[s] = false;
			}
			else {
				opts[s] = true;
			}
		}
	});

	return opts;
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
		return min;
	}
	else if (val > max) {
		return max;
	}
	else {
		if (def && val === def) {
			return undefined;
		}
		return val;
	}
}

/**
 * Number headings
 * @constructor
 * @private
 */
function Numbering (init) {
	this._ = [0,0,0,0,0,0,0];
	this.last = 1;
	this._[1] = (init ? init - 1 : 0);
}

/**
 * Reset number array per level
 * @param {Number} level
 */
Numbering.prototype.reset = function(level) {
	for (var i = level+1; i < this._.length; i++ ){
		this._[i] = 0;
	}
};

/**
 * Generate output value for number
 * @param {Number} level
 * @return {String} number
 */
Numbering.prototype.val = function(level) {
	var	i,
		out=this._[1];

	for (i=2; i<=level; i++) {
		out += '.' + this._[i];
	}
	return out + '\\.';
};

/**
 * Count up per level
 * @param {Number} level
 * @return {String} number
 */
Numbering.prototype.count = function(level) {
	if (level <= 6) {
		if (this.last > level) {
			this.reset(level);
		}
		this._[level] += 1;
		this.last = level;
		return this.val(level);
	}
	return;
};


/**
 * Renderer
 * @constructor
 * @param {Object} options
 */
function Renderer(options) {
	this.options = options || {};
	this._indent = '';
}

/**
 * Render heading as markdown
 * @param {String} text - Heading text
 * @param {Number} level - Heading level
 * @param {String} raw - Raw heading text (without numbers)
 * @return {String} rendered output
 */
Renderer.prototype.heading = function(text, level, raw, number) {
	var atx = '########'.substring(0, level);
	return this._indent + atx + ' ' + text + '\n\n';
};

/**
 * Render text
 * @param {String} text
 * @return {String} rendered output
 */
Renderer.prototype.paragraph = function(text) {
	return this._indent + text;
};

/**
 * Render fenced code blocks
 * @param {String} code - code block
 * @param {String} lang - language of code block
 * @return {String} rendered output
 */
Renderer.prototype.fences = function(code, lang, indent, fences) {
	return this.fence(lang, indent, fences) + code + '\n' + this.fence('', indent, fences);
};

/**
 * Render a single reference as markdown
 * @param {String} ref - reference name
 * @param {String} href - URL of reference
 * @param {String} title - Title of reference
 * @return {String} rendered output
 */
Renderer.prototype.reference = function(ref, href, title) {
	return this._indent + '[' + ref + ']: ' + href + (title ? ' "' + title + '"' : '' ) + '\n';
};

/**
 * Render a ppinclude which could not be resolved
 * @param {String} text
 * @return {String} rendered output
 */
Renderer.prototype.include = function(text, indent, lang) {
	return this._indent + indent + '!include (' + text + (lang ? ' lang=' + lang : '') + ')\n';
};

/**
 * Render GFM fences
 * @param {String} lang - language of fences block
 * @return rendered output
 */
Renderer.prototype.fence = function(lang, indent, fences) {
  fences = fences || '```';
  indent = indent || '';
	return this._indent + indent + fences + (lang ? lang : '') + '\n';
};

/**
 * Set correct indent
 * @param {String} indent
 */
Renderer.prototype.indent = function (indent) {
	this._indent = indent;
};

/**
 * Sorter to sort reference by title
 * @private
 */
Renderer.sortByTitle = function (a, b) {
	var	_a = a.title.toLowerCase(),
		_b = b.title.toLowerCase();

	if (_a > _b) {
		return 1;
	}
	else if (_a < _b) {
		return -1;
	}
	else {
		return 0;
	}
};

/**
 * Generate a internal reference id
 * @private
 * @param {String} raw
 * @return {String}
 */
Renderer.prototype.referenceId = 	function (raw) {
	return raw.toLowerCase().replace(/[^\w]+/g, '-');
};

/**
 * Render all references
 * @param {Array} refs : Array of Objects `{ ref: {String}, href: {String}, title: {String} }`
 * @return {String} rendered output
 */
Renderer.prototype.references = function (refs) {
	var	out = [];

	refs.map(function(ref){
		if (!ref.title) {
			ref.title = ref.ref;
		}
		return ref;
	}).sort(Renderer.sortByTitle)
	.forEach(function(ref){
		out.push('* ['+ ref.title + ']['+ ref.ref + ']');
	});
	if (this.options.tags) {
		return '<!-- !ref -->\n\n' + out.join('\n') + '\n\n<!-- ref! -->\n';
	}
	else {
		return out.join('\n') + '\n';
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
	var	self = this,
		i,
		omitlevel,
		out = [],
		opts = this.joinOpts({
			level: options.level,
			minlevel: options.minlevel,
			numbered: options.numbered,
			omit: options.omit
		}),
		numbering = new Numbering(),
		br = (this.options.breaks ? ' <br>' : ''),
		level = options.level || defaults.level, // standard depth of TOC
		minlevel = options.minlevel || defaults.minlevel;  //

	out = toc.filter(function(t){
		if (t.depth <= level && t.depth >= minlevel) {
			return true;
		}
		return false;
	}).map(function(t){
		if (!self.options.numberedHeadings && options.numbered) {
			t.number = numbering.count(t.depth - minlevel + 1);
		}
		return t;
	}).filter(function(t){
		if (options.omit) {
			if (omitlevel) { // omit the branch below as well...
				if (t.depth > omitlevel) {
					return false;
				}
				else {
					omitlevel = undefined; // reset
				}
			}
			return !options.omit.some(function(tt) {
				if (tt === t.raw) {
					omitlevel = t.depth;
					return true;
				}
				return false;
			});
		}
		return true;
	}).map(function(t){
		if (options.numbered) {
			// render numbered list
			if (self.options.numberedHeadings) {
				return (t.number ? t.number + ' ' : '') +
					'[' + self.removeLinkFromHeadings(t.raw) + '](#' +
					self.referenceId(t.text) + ')' + br;
			}
			else {
				return t.number +
					' [' + self.removeLinkFromHeadings(t.text) + '](#' +
					self.referenceId(t.text) + ')' + br;
			}
		}
		else {
			// render bullet list
			var space = '';
			for (var i = 1; i<(t.depth - minlevel + 1 || 1); i++) {
				space += '  ';
			}
			return space + '* [' +
				self.removeLinkFromHeadings(t.text) + '](#' +
				self.referenceId(t.text) + ')';
		}
	});

	if (this.options.tags) {
		return '<!-- !toc ' + opts + '-->\n\n' + out.join('\n') + '\n\n<!-- toc! -->\n\n';
	}
	else {
		return out.join('\n') + '\n\n';
	}
};

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
		});
	if (this.options.tags) {
		return '<!-- !numberedheadings '+opts+'-->\n\n';
	}
	return '';
};

Renderer.prototype.joinOpts = function(obj) {
	var key,
		val,
		tmp = [];
	for (key in obj) {
		val = obj[key];
		if (val === true) {
			tmp.push(key);
		}
		else if (val !== undefined) {
			if (Array.isArray(val)) {
				val = '"' + val.join(';') + '"';
			}
			tmp.push(key + '=' + val);
		}
	}
	if (tmp.length>0) {
		return '('+ tmp.join(' ') +') '
	}
	else {
		return '';
	}
}

Renderer.prototype.removeLinkFromHeadings = function(heading) {
	return heading.replace(/\[([^\]]*)\]\s*(?:\[[^\]]*\]|\([^\)]*\))/g, '$1');
}

/**
 * Parser
 * @constructor
 * @param {Object} options
 * @param {Object} options.renderer - Custom renderer
 */
function Parser(options) {
	this.tokens = [];
	this.token = null;
	this.count = -1;
	this.indent = [];
	this.options = options || defaults;
	this.options.renderer = this.options.renderer || new Renderer; //jshint ignore:line
	this.renderer = this.options.renderer;
	this.renderer.options = this.options;
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

	var out = '';
	while (this.next()) {
		out += this.tok();
	}

	return out;
};

/**
 * Next Token
 */
Parser.prototype.next = function () {
	this.token = this.tokens[this.count+=1];
	return this.token;
};

/**
 * Preview Next Token
 */
Parser.prototype.peek = function () {
	return this.tokens[this.count + 1] || 0;
};

/**
 * Parse references
 */
Parser.prototype.references = function () {
	var i,
		refs = [],
		uniq = { title: {}, ref: {} };

	this.tokens.forEach(function(token){
		if (token.type === 'def' && ! /^#/.test(token.href) ) {
			if (token.title) {
				uniq.title[token.ref] = token.title;
			}
			else {
				uniq.ref[token.ref] = token.ref;
			}
		}
	});

	for (i in uniq.title) {
		refs.push({
			ref:   i,
			title: uniq.title[i]
		});
	}
	for (i in uniq.ref) {
		if (! uniq.title[i] ) {
			refs.push({
				ref:   i,
				title: i
			});
		}
	}

	return refs;
};

/**
 * Parse Table of Contents
 */
Parser.prototype.tableOfContents = function () {
	return this.tokens.filter(function(token){
		if (token.type === 'heading') {
			return true;
		}
		return false;
	});
};

/**
 * Prepare headings text if numberedheadings option is set
 * updates all tokens containing headings
 * @param {Number} maxLevel
 * @param {Number} minLevel
 */
Parser.prototype.numberedHeadings = function (maxLevel, minLevel, skip, start, omit) {
	var REMOVENUMBER = /^([0-9]+\\?\.)+ +/,
		omitMatch = {},
		skipFlag = false,
		numbering = new Numbering(start);

	skip = skip || 0;

	(omit||[]).forEach(function(key){
		omitMatch[key] = true;
	});

	maxLevel = maxLevel || defaults.level;
	minLevel = minLevel || defaults.minlevel;

	this.tokens = this.tokens.map(function(token){
		if (token.type === 'heading') {
			token.text = token.text.replace(REMOVENUMBER, '');
			token.raw = token.raw.replace(REMOVENUMBER, '');

			if (token.depth === minLevel) {
				if (skip > 0) {
					skip -= 1;
					skipFlag = true;
				}
				else if (skip === 0) {
					skipFlag = false;
				}
			}

			if (!skipFlag && !omitMatch[token.raw] && token.depth <= maxLevel && token.depth >= minLevel) {
				token.number = numbering.count(token.depth - minLevel + 1);
				token.text = token.number + ' ' + token.text;
			}
		}
		return token;
	});
};

/**
 * Parse Current Token
 */
Parser.prototype.tok = function() {
	var tmp = '';

	switch (this.token.type) {
		case 'heading': {
			return this.renderer.heading(
				this.token.text,
				this.token.depth,
				this.token.raw,
				this.token.number);
		}
		case 'text': {
			return this.renderer.paragraph(this.token.text);
		}
		case 'code': {
			return this.renderer.paragraph(
				this.token.text
			);
		}
		case 'fences': {
			return this.renderer.fences(
				this.token.text,
				this.token.lang,
				this.token.indent,
				this.token.fences
			);
		}
		case 'def': {
			return this.renderer.reference(this.token.ref,
				this.token.href, this.token.title);
		}
		case 'ppnumberedheadings': {
			this.options.numberedHeadings = true;
			this.numberedHeadings(
				this.token.level,
				this.token.minlevel,
				this.token.skip,
				this.token.start,
				this.token.omit
			);
			return this.renderer.numberedHeadings(
				this.token.level,
				this.token.minlevel,
				this.token.skip,
				this.token.start,
				this.token.omit
			);
		}
		case 'ppref': {
			return this.renderer.references(this.references());
		}
		case 'ppinclude.start': {
			this.indent.push(this.token.indent);
			this.renderer.indent(this.indent.join(''));
			if (typeof this.token.lang === 'string') {
				tmp = this.renderer.fence(this.token.lang);
			}
			return tmp;
		}
		case 'ppinclude.end': {
			if (typeof this.token.lang === 'string') {
				tmp = this.renderer.fence();
			}
			this.indent.pop();
			this.renderer.indent(this.indent.join(''));
			return tmp;
		}
		case 'ppinclude': {
			return this.renderer.include(this.token.text, this.token.indent, this.token.lang);
		}
		case 'pptoc': {
			return this.renderer.tableOfContents(
				this.tableOfContents(),
				this.token);
		}
		default: {
			return '<!-- ' + JSON.stringify(this.token) + ' -->\n';
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
Parser.parse = function(tokens, options) {
	var parser = new Parser(options);
	return parser.parse(tokens);
};

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
function markedpp(src, options, callback) {

	if (typeof options === 'function') {
		callback = options;
		options = null;
	}

	options = merge({}, defaults, options || {});

	Lexer.lex(src, options, function(err, tokens){
		var out = Parser.parse(tokens, options);
		callback(null, out);
	});
}

/**
 * exports
 */
markedpp.defaults = defaults;
markedpp.Lexer = Lexer;
markedpp.merge = merge;

markedpp.setOptions = function(opt) {
  merge(defaults, opt);
  return markedpp;
};

// Node.js
if (isNodeJs()) {
	module.exports = markedpp;
}
// AMD / RequireJS
else if (typeof define !== 'undefined' && define.amd) {
	define([], function () {
		return markedpp;
	});
}
// included in browser via <script> tag
else if (typeof ctx.Window !== 'undefined' && !ctx[markedpp]) {
	ctx.markedpp = markedpp;
}

}(this));
