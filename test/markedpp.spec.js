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

describe('toc', function () {
  it('toc', function (done) {
    u.run('toc_default.md', done)
  })

  it('toc - remove links in headings', function (done) {
    u.run('toc_removelinks.md', done)
  })

  it('toc - alternative syntax', function (done) {
    u.run('toc_default_alt.md', done)
  })

  it('toc - markdown-pp syntax', function (done) {
    u.run('toc_markdownpp.md', done)
  })

  it('toc with level=2', function (done) {
    u.run('toc_level2.md', done)
  })

  it('toc with level=6', function (done) {
    u.run('toc_level6.md', done)
  })

  it('toc with level=0', function (done) {
    u.run('toc_level0.md', done)
  })

  it('toc with level=8', function (done) {
    u.run('toc_level8.md', done)
  })

  it('toc with level=6 - alternative syntax', function (done) {
    u.run('toc_level6_alt.md', done)
  })

  it('numbered toc with level=3', function (done) {
    u.run('toc_numbered.md', done)
  })

  it('numbered toc with level=6', function (done) {
    u.run('toc_level6_numbered.md', done)
  })

  it('numbered toc with level=3 with option breaks=false', function (done) {
    u.run('toc_numbered_nobreaks.md', done, { breaks: false })
  })

  it('toc with minlevel=2', function (done) {
    u.run('toc_minlevel2.md', done)
  })

  it('toc with minlevel=3 and level=5', function (done) {
    u.run('toc_level5_minlevel3.md', done)
  })

  it('numbered toc with minlevel=2 and level=4', function (done) {
    u.run('toc_level4_minlevel2_numbered.md', done)
  })

  it('toc omits "Table of Content"', function (done) {
    u.run('toc_omit.md', done)
  })

  it('toc omits "Table of Content" and branchs "Two One", "Two Four One"', function (done) {
    u.run('toc_omit_multiple.md', done)
  })

  it('numbered toc omits "Table of Content" and branchs "Two One", "Two Four One"', function (done) {
    u.run('toc_omit_multiple_numbered.md', done)
  })

  it('update autoid on references using numberedheadings', function (done) {
    u.run('toc_autoid.md', done)
  })

  it('toc change id', function (done) {
    u.run('toc_id.md', done)
  })
})

describe('references', function () {
  it('ref', function (done) {
    u.run('ref.md', done)
  })

  it('ref - alternative syntax', function (done) {
    u.run('ref_alt.md', done)
  })

  it('ref - markdown-pp syntax', function (done) {
    u.run('ref_markdownpp.md', done)
  })

  it('uniq doubled references', function (done) {
    u.run('ref_doubled.md', done)
  })
})

describe('numberedheadings', function () {
  it('numberedheadings', function (done) {
    u.run('numberedheadings.md', done)
  })

  it('numberedheadings level=2', function (done) {
    u.run('numberedheadings_level2.md', done)
  })

  it('numberedheadings minlevel=2', function (done) {
    u.run('numberedheadings_minlevel2.md', done)
  })

  it('numberedheadings minlevel=3 level=4', function (done) {
    u.run('numberedheadings_level4_minlevel3.md', done)
  })

  it('numberedheadings omit', function (done) {
    u.run('numberedheadings_omit.md', done)
  })

  it('numberedheadings start numbering with 2', function (done) {
    u.run('numberedheadings_start2.md', done)
  })

  it('numberedheadings start numbering with 10 omit "Table of Contents', function (done) {
    u.run('numberedheadings_start10_omit.md', done)
  })

  it('numberedheadings skip first heading', function (done) {
    u.run('numberedheadings_skip1.md', done)
  })

  it('numberedheadings skip first two headings', function (done) {
    u.run('numberedheadings_skip2.md', done)
  })

  it('numberedheadings skip first heading and omit "Table of Contents', function (done) {
    u.run('numberedheadings_skip1_omit.md', done)
  })

  it('numberedheadings minlevel=2 level=4 start numbering with 5 skip first heading and omit "Table of Contents', function (done) {
    u.run('numberedheadings_minlevel2_level4_start5_skip1_omit.md', done)
  })
})

describe('include', function () {
  it('read include.md and compare', function (done) {
    u.run('include.md', {}, done)
  })
})

describe('plant uml', function () {
  it('read _puml.md and compare', function (done) {
    u.run('_puml.md', done, {})
  })
})

describe('all together', function () {
  it('read all.md and compare', function (done) {
    u.run('all.md', {}, done)
  })

  it('read all.md not outputting tags using github ids', function (done) {
    u.run('all.md', done, { tags: false, github: true }, 'all_notags.md')
  })

  it('read all.md adding autoid', function (done) {
    u.run('all.md', done, { autoid: true }, 'all_autoid.md')
  })
})

describe('markdown-pp syntax', function () {
  it('read markdownpp.md and compare to check compatibility', function (done) {
    u.run('compatibility.md', { include: true }, done)
  })
})

describe('parser', function () {
  it('file needs to be identical', function (done) {
    u.run('parser.md', done)
  })

  it('parse inline text', function (done) {
    u.run('parser_inlinetext.md', done)
  })

  it('parse paragraphs', function (done) {
    u.run('parser_paragraph.md', done)
  })

  it('autonumber lists', function (done) {
    u.run('parser_lists.md', done)
  })

  it('no autonumber lists', function (done) {
    u.run('parser_lists_noautonumber.md', done, { autonumber: false })
  })
})

describe('headingAutoId', function () {
  it('marked', function () {
    var token = {
      text: 'mergeExt(opts, opts.ignoreNull, opts.ignoreCircular, target, source)'
    }
    var parser = new markedpp.Parser()
    var exp = 'mergeextopts-optsignorenull-optsignorecircular-target-source'
    var res = parser.headingAutoId(token)
    assert.strictEqual(res, exp)
  })

  it('github', function () {
    var token = {
      text: 'mergeExt(opts, opts.ignoreNull, opts.ignoreCircular, target, source)'
    }
    var parser = new markedpp.Parser({ github: true })
    var exp = 'mergeextopts-optsignorenull-optsignorecircular-target-source'
    var res = parser.headingAutoId(token)
    assert.strictEqual(res, exp)
  })

  it('github &ampersand', function () {
    var token = {
      text: 'Running Tests & Contributing'
    }
    var parser = new markedpp.Parser({ github: true })
    var exp = 'running-tests--contributing'
    var res = parser.headingAutoId(token)
    assert.strictEqual(res, exp)
  })
})

describe('lexer', function () {
  it('correctly lex code indents', function (done) {
    u.run('lexer_code.md', done)
  })
  it('correctly lex blockquotes', function (done) {
    u.run('lexer_blockquotes.md', done)
  })
})

describe('markedpp', function () {
  it('shall run without options', function () {
    const data = '# h1\n'
    markedpp(data, (err, res) => {
      assert.ok(!err, err && err.message)
      assert.strictEqual(res, data)
    })
  })
})
