"use strict";

/**
 * Markdown Preprocessor
 *
 * @copyright 2014 commenthol
 * @licence MIT
 */

/**
 * Module dependencies
 */
var fs = require('fs'),
	path = require('path'),
	async = require('async');

/**
 * Wrapper to hand over Lexer and other required functions
 * @param {Lexer} Lexer
 * @param {Function} merge
 * @return {Function} ppInclude
 */
function ppIncludeWrap (Lexer, merge) {

	/**
	 * Include and Lex files
	 * @param {Array} tokens - array of tokens
	 * @param {Object} options - options to overwrite
	 * @param {String} options.dirname - base directory from where to search files to include (If not specified then current working directory is used)
	 * @param {Function} callback - `function(err, tokens)`
	 */
	function ppInclude (tokens, options, callback) {
		var	dirname = options.dirname || process.cwd(),
			lexed = {},
			_options = merge({}, options);

		// ppInclude is used to detect recursions
		if (! _options.ppInclude ) { _options.ppInclude = {}; }

		async.eachLimit(tokens, 5, function (token, done){
			if (token.type === 'ppinclude' &&
				typeof token.text === 'string' &&
				! _options.ppInclude[token.text] )
			{
				var file = path.resolve(path.join(dirname, token.text));
				fs.readFile(file, { encoding: 'utf8' }, function (err, src) {
					_options.ppInclude[token.text] = 1;
					_options.dirname = path.dirname(file);
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
	
	return ppInclude;
}

module.exports = ppIncludeWrap;
