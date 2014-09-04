"use strict";

/* global describe, it */

var	fs = require('fs'),
	path = require('path'),
	assert = require('assert'),
	markedpp = require('../lib/markedpp');


/* a utility for loading the test files */
var	u = {
	dir: path.resolve(__dirname, './assets'),
	_load: function(filename) {
		return fs.readFileSync(filename, 'utf8');
	},
	file: function(filename) {
		return this._load(path.join(this.dir, filename));
	},
	expected: function(filename) {
		return this._load(path.join(this.dir, 'expected', filename));
	},
	run: function(file, done, options, fileExp) {
		var src = u.file(file),
			exp = u.expected(fileExp||file),
			opt = options || {};

		opt.dirname = u.dir;
		markedpp(src, opt, function (err, res) {
			assert.equal(res, exp);
			done();
		});
	}
};

describe ('toc', function() {
	it ('toc', function(done){
		u.run('toc_default.md', done);
	});

	it ('toc - remove links in headings', function(done){
		u.run('toc_removelinks.md', done);
	});

	it ('toc - alternative syntax', function(done){
		u.run('toc_default_alt.md', done);
	});

	it ('toc - markdown-pp syntax', function(done){
		u.run('toc_markdownpp.md', done);
	});

	it ('toc with level=2', function(done){
		u.run('toc_level2.md', done);
	});

	it ('toc with level=6', function(done){
		u.run('toc_level6.md', done);
	});

	it ('toc with level=0', function(done){
		u.run('toc_level0.md', done);
	});

	it ('toc with level=8', function(done){
		u.run('toc_level8.md', done);
	});

	it ('toc with level=6 - alternative syntax', function(done){
		u.run('toc_level6_alt.md', done);
	});

	it ('numbered toc with level=3', function(done){
		u.run('toc_numbered.md', done);
	});

	it ('numbered toc with level=6', function(done){
		u.run('toc_level6_numbered.md', done);
	});

	it ('numbered toc with level=3 with option breaks=false', function(done){
		u.run('toc_numbered_nobreaks.md', done, { breaks: false });
	});

	it ('toc with minlevel=2', function(done){
		u.run('toc_minlevel2.md', done);
	});

	it ('toc with minlevel=3 and level=5', function(done){
		u.run('toc_level5_minlevel3.md', done);
	});

	it ('numbered toc with minlevel=2 and level=4', function(done){
		u.run('toc_level4_minlevel2_numbered.md', done);
	});

	it ('toc omits "Table of Content"', function(done){
		u.run('toc_omit.md', done);
	});

	it ('toc omits "Table of Content" and branchs "Two One", "Two Four One"', function(done){
		u.run('toc_omit_multiple.md', done);
	});

	it ('numbered toc omits "Table of Content" and branchs "Two One", "Two Four One"', function(done){
		u.run('toc_omit_multiple_numbered.md', done);
	});
});

describe ('references', function() {
	it ('ref', function(done){
		u.run('ref.md', done);
	});
	
	it ('ref - alternative syntax', function(done){
		u.run('ref_alt.md', done);
	});

	it ('ref - markdown-pp syntax', function(done){
		u.run('ref_markdownpp.md', done);
	});
});

describe ('numberedheadings', function() {
	it ('numberedheadings', function(done){
		u.run('numberedheadings.md', done);
	});

	it ('numberedheadings level=2', function(done){
		u.run('numberedheadings_level2.md', done);
	});
});

describe ('include', function() {
	it ('read include.md and compare', function(done){
		u.run('include.md', done);
	});
});

describe ('all together', function() {
	it ('read all.md and compare', function(done){
		u.run('all.md', done);
	});
});

describe ('markdown-pp syntax', function() {
	it ('read markdownpp.md and compare to check compatibility', function(done){
		u.run('compatibility.md', done);
	});
});
