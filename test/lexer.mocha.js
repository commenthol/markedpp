'use strict';

/* global describe, it */

var assert = require('assert'),
	Lexer = require('../lib/markedpp').Lexer;

describe ('#Lexer.splitOpts', function() {

	var splitOpts = Lexer.splitOpts;
	
	it ('empty', function(){		
		var str = '',
			res = splitOpts(str),
			exp = {};
		assert.deepEqual(res, exp);
	});
	
	it ('single key', function(){
		var str = 'key',
			res = splitOpts(str),
			exp = { key: true };
		assert.deepEqual(res, exp);
	});

	it ('single key false', function(){
		var str = '!key',
			res = splitOpts(str),
			exp = { key: false };
		assert.deepEqual(res, exp);
	});

	it ('multiple keys', function(){
		var str = '/path/another\\ key.js key1 !key2 true "spaced Title"',
			res = splitOpts(str),
			exp = {
				"/path/another key.js":true,
				"key1":true,
				"key2":false,
				"true":true,
				"spaced Title":true
			};
		assert.deepEqual(res, exp);
	});

	it ('single key-value pair', function(){
		var str = 'key=value',
			res = splitOpts(str),
			exp = { "key": "value" };
		assert.deepEqual(res, exp);
	});

	it ('multiple key-value pairs', function(){
		var str = 'key=value another=val number=42',
			res = splitOpts(str),
			exp = {
				"key": "value",
				"another": "val",
				"number": 42
			};
		assert.deepEqual(res, exp);
	});

	it ('multiple key-value pairs with spaces', function(){
		var str = 'is="with spaces within double quotes ?" or=\'within single quotes\'',
			res = splitOpts(str),
			exp = {
				"is": "with spaces within double quotes ?",
				"or": "within single quotes"
			};
		assert.deepEqual(res, exp);
	});

	it ('single array', function(){
		var str = 'this="is;an;array"',
			res = splitOpts(str),
			exp = {
				"this": [ "is", "an", "array" ]
			};
		assert.deepEqual(res, exp);
	});

	it ('single key-value pair length=1', function(){
		var str = 'key="4 value"',
			res = splitOpts(str),
			exp = { "key": "4 value" };
		assert.deepEqual(res, exp);
	});

	it ('single array with spaces', function(){
		var str = 'this="is;an;array with; some spaces "',
			res = splitOpts(str),
			exp = {
				"this": ["is","an","array with"," some spaces "]
			};
		assert.deepEqual(res, exp);
	});

	it ('multiple array with spaces', function(){
		var str = 'this="is;an;array with; some spaces " and=\'this; is;17;another one;64\'',
			res = splitOpts(str),
			exp = {
				"this":["is","an","array with"," some spaces "],
				"and":["this"," is",17,"another one",64]
			};
		assert.deepEqual(res, exp);
	});

});
