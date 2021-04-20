'use strict'

/* global describe, it */

var fs = require('fs')
var path = require('path')
var assert = require('assert')
var markedpp = require('../src')

/* a utility for loading the test files */
var u = {
  dir: path.resolve(__dirname, './assets'),
  _load: function (filename) {
    return fs.readFileSync(filename, 'utf8')
  },
  _write: function (file, data, ext) {
    fs.writeFileSync(path.resolve(this.dir, file + '.' + ext), data, 'utf8')
  },
  file: function (filename) {
    return this._load(path.resolve(this.dir, filename))
  },
  expected: function (filename) {
    var extname = path.extname(filename)
    filename = filename.substr(0, filename.indexOf(extname)) +
      '.exp' + extname
    return path.join(this.dir, filename)
  },
  run: function (file, done, options, fileExp) {
    var src = u.file(file)
    var expName = u.expected(fileExp || file)
    var exp = u._load(expName)
    var opt = options || { include: false }

    opt.dirname = u.dir
    markedpp(src, opt, function (err, res) {
      assert.ok(!err, err && err.message)
      // if (res !== exp) u._write(expName, res, 0)
      assert.strictEqual(res, exp, 'initial process fails')

      // reprocess the output - the result needs to be the same
      markedpp(exp, opt, function (err, res) {
        assert.ok(!err, err && err.message)
        // if (res !== exp) u._write(expName, res, 1)
        assert.strictEqual(res, exp, 'reprocess fails')
        done()
      })
    })
  }
}


describe('plant uml', function () {
    it('read _puml.md and compare', function (done) {
      u.run('_puml.md', done, {})
    })
  })
