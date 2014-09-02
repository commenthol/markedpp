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
	file: function (filename) {
		return this._load(path.join(this.dir, filename));
	},
	expected: function (filename) {
		return this._load(path.join(this.dir, 'expected', filename));
	},
};


describe ('references', function() {
	it ('read ref.md and compare', function(done){
		var file = 'ref.md',
			src = u.file(file),
			exp = u.expected(file);

		markedpp(src, { dirname: u.dir }, function (err, res) {
			assert.equal(res, exp);
			done();
		});
	});
});

describe ('toc', function() {
	it ('read toc.md and compare', function(done){
		var file = 'toc.md',
			src = u.file(file),
			exp = u.expected(file);

		markedpp(src, { dirname: u.dir }, function (err, res) {
			assert.equal(res, exp);
			done();
		});
	});

	it ('read toc.md with option breaks=false and compare', function(done){
		var	src = u.file('toc.md'),
			exp = u.expected('toc-nobreaks.md');

		markedpp(src, { dirname: u.dir, breaks: false }, function (err, res) {
			assert.equal(res, exp);
			done();
		});
	});
});

describe ('numberedheadings', function() {
	it ('read numberedheadings.md and compare', function(done){
		var	file = 'numberedheadings.md',
			src = u.file(file),
			exp = u.expected(file);

		markedpp(src, { dirname: u.dir }, function (err, res) {
			assert.equal(res, exp);
			done();
		});
	});
});

describe ('include', function() {
	it ('read include.md and compare', function(done){
		var	file = 'include.md',
			src = u.file(file),
			exp = u.expected(file);

		markedpp(src, { dirname: u.dir }, function (err, res) {
			assert.equal(res, exp);
			done();
		});
	});
});

describe ('markdown-pp syntax', function() {
	it ('read markdownpp.md and compare to check compatibility', function(done){
		var	file = 'compatibility.md',
			src = u.file(file),
			exp = u.expected(file);

		markedpp(src, { dirname: u.dir }, function (err, res) {
			assert.equal(res, exp);
			done();
		});
	});
});

