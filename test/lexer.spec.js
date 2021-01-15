'use strict'

const assert = require('assert')
const Lexer = require('../src/markedpp').Lexer

describe('#Lexer.splitOpts', function () {
  const splitOpts = Lexer.splitOpts

  it('empty', function () {
    const str = ''
    const res = splitOpts(str)
    const exp = {}
    assert.deepStrictEqual(res, exp)
  })

  it('single key', function () {
    const str = 'key'
    const res = splitOpts(str)
    const exp = { key: true }
    assert.deepStrictEqual(res, exp)
  })

  it('single key false', function () {
    const str = '!key'
    const res = splitOpts(str)
    const exp = { key: false }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple keys', function () {
    const str = '/path/another\\ key.js key1 !key2 true "spaced Title"'
    const res = splitOpts(str)
    const exp = {
      '/path/another key.js': true,
      key1: true,
      key2: false,
      true: true,
      'spaced Title': true
    }
    assert.deepStrictEqual(res, exp)
  })

  it('single key-value pair', function () {
    const str = 'key=value'
    const res = splitOpts(str)
    const exp = { key: 'value' }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple key-value pairs', function () {
    const str = 'key=value another=val number=42'
    const res = splitOpts(str)
    const exp = {
      key: 'value',
      another: 'val',
      number: 42
    }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple key-value pairs with spaces', function () {
    const str = 'is="with spaces within double quotes ?" or=\'within single quotes\''
    const res = splitOpts(str)
    const exp = {
      is: 'with spaces within double quotes ?',
      or: 'within single quotes'
    }
    assert.deepStrictEqual(res, exp)
  })

  it('single array', function () {
    const str = 'this="is;an;array"'
    const res = splitOpts(str)
    const exp = {
      this: ['is', 'an', 'array']
    }
    assert.deepStrictEqual(res, exp)
  })

  it('single key-value pair length=1', function () {
    const str = 'key="4 value"'
    const res = splitOpts(str)
    const exp = { key: '4 value' }
    assert.deepStrictEqual(res, exp)
  })

  it('single array with spaces', function () {
    const str = 'this="is;an;array with; some spaces "'
    const res = splitOpts(str)
    const exp = {
      this: ['is', 'an', 'array with', ' some spaces ']
    }
    assert.deepStrictEqual(res, exp)
  })

  it('multiple array with spaces', function () {
    const str = 'this="is;an;array with; some spaces " and=\'this; is;17;another one;64\''
    const res = splitOpts(str)
    const exp = {
      this: ['is', 'an', 'array with', ' some spaces '],
      and: ['this', ' is', 17, 'another one', 64]
    }
    assert.deepStrictEqual(res, exp)
  })
})
