'use strict'

/* global describe, it */

var assert = require('assert')
// var Lexer = require('../lib/markedpp').Lexer
var Lexer = require('../src/markedpp').Lexer

// ~ console.log(Lexer); return;

describe('#Lexer.splitOpts', function () {
  var splitOpts = Lexer.splitOpts

  it('empty', function () {
    var str = ''
    var res = splitOpts(str)
    var exp = {}
    assert.deepStrictEqual(res, exp)
  })

  it('single key', function () {
    var str = 'key'
    var res = splitOpts(str)
    var exp = { key: true }
    assert.deepStrictEqual(res, exp)
  })

  it('single key false', function () {
    var str = '!key'
    var res = splitOpts(str)
    var exp = { key: false }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple keys', function () {
    var str = '/path/another\\ key.js key1 !key2 true "spaced Title"'
    var res = splitOpts(str)
    var exp = {
      '/path/another key.js': true,
      'key1': true,
      'key2': false,
      'true': true,
      'spaced Title': true
    }
    assert.deepStrictEqual(res, exp)
  })

  it('single key-value pair', function () {
    var str = 'key=value'
    var res = splitOpts(str)
    var exp = { 'key': 'value' }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple key-value pairs', function () {
    var str = 'key=value another=val number=42'
    var res = splitOpts(str)
    var exp = {
      'key': 'value',
      'another': 'val',
      'number': 42
    }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple key-value pairs with spaces', function () {
    var str = 'is="with spaces within double quotes ?" or=\'within single quotes\''
    var res = splitOpts(str)
    var exp = {
      'is': 'with spaces within double quotes ?',
      'or': 'within single quotes'
    }
    assert.deepStrictEqual(res, exp)
  })

  it('single array', function () {
    var str = 'this="is;an;array"'
    var res = splitOpts(str)
    var exp = {
      'this': [ 'is', 'an', 'array' ]
    }
    assert.deepStrictEqual(res, exp)
  })

  it('single key-value pair length=1', function () {
    var str = 'key="4 value"'
    var res = splitOpts(str)
    var exp = { 'key': '4 value' }
    assert.deepStrictEqual(res, exp)
  })

  it('single array with spaces', function () {
    var str = 'this="is;an;array with; some spaces "'
    var res = splitOpts(str)
    var exp = {
      'this': ['is', 'an', 'array with', ' some spaces ']
    }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple array with spaces', function () {
    var str = 'this="is;an;array with; some spaces " and=\'this; is;17;another one;64\''
    var res = splitOpts(str)
    var exp = {
      'this': ['is', 'an', 'array with', ' some spaces '],
      'and': ['this', ' is', 17, 'another one', 64]
    }
    assert.deepStrictEqual(res, exp)
  })
})
