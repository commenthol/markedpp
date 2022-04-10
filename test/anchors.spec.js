const fs = require('fs')
const assert = require('assert')

const cheerio = require('cheerio')
const { marked } = require('marked')
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')

const ghost = require('@tryghost/kg-markdown-html-renderer')

const markedpp = require('../src')
const { dlhtml } = require('./support')

let reProcessor

const writeHtml = !!process.env.WRITE_HTML
const SNIP_SNIP = '>snip-snip-snip<'

const extractAnchors = (html, h2selector = 'h2', h2attr = 'id') => {
  const $ = cheerio.load(html)
  const href = []
  const h2 = []
  $('li > a[href]').each((i, el) => {
    const id = $(el).attr('href')
    if (id[0] === '#') href.push(id.substr(1))
  })
  $(h2selector).each((i, el) => {
    let id = $(el).attr(h2attr)
    if (h2attr === 'href' && id[0] === '#') {
      id = id.substr(1)
    }
    h2.push(id)
  })
  return { href, h2 }
}

const filterFailingTests = (arr, failing) =>
  arr.filter(h => !failing.some(f => f.test(h)))

describe('anchors', function () {
  this.timeout(3000)

  let rawmd
  before(() => {
    rawmd = fs.readFileSync(`${__dirname}/assets/heading_anchors.md`, 'utf8')
  })

  before(async () => {
    const { unified } = await import('unified')
    const { default: reMarkdown } = await import('remark-parse')
    const { default: reSlug } = await import('remark-slug')
    const { default: reRemark } = await import('remark-rehype')
    const { default: reFormat } = await import('rehype-format')
    const { default: reHtml } = await import('rehype-stringify')

    reProcessor = unified()
      .use(reMarkdown)
      .use(reSlug)
      .use(reRemark)
      .use(reFormat)
      .use(reHtml)
  })

  it('marked', function (done) {
    markedpp(rawmd, { include: false }, (_err, premd) => {
      marked(premd, {}, (_err, html) => {
        const { href, h2 } = extractAnchors(html)
        if (writeHtml) {
          fs.writeFileSync(`${__dirname}/tmp/marked.html`, html, 'utf8')
        }
        assert.deepStrictEqual(href.map(decodeURI), h2)
        done()
      })
    })
  })

  it('markdown-it-anchor', function (done) {
    markedpp(rawmd, { include: false, markdownit: true }, (_err, premd) => {
      const html = markdownIt().use(markdownItAnchor).render(premd)
      let { href, h2 } = extractAnchors(html)
      if (writeHtml) {
        fs.writeFileSync(`${__dirname}/tmp/markdownit.html`, html, 'utf8')
      }
      // BUG in markdown-it as reflinks in headers are not rendered
      const failing = [
        /a-reference-to/,
        /%5Ba-reference-to%5D%5B%5D/
      ]
      href = filterFailingTests(href, failing)
      h2 = filterFailingTests(h2, failing)
      assert.deepStrictEqual(href/* .map(decodeURI) */, h2/* .map(decodeURI) */)
      done()
    })
  })

  it('unified', function (done) {
    markedpp(rawmd, { include: false, unified: true }, (_err, premd) => {
      reProcessor.process(premd).then((html) => {
        const { href, h2 } = extractAnchors(html)
        if (writeHtml) {
          fs.writeFileSync(`${__dirname}/tmp/unified.html`, html, 'utf8')
        }
        assert.deepStrictEqual(href, h2)
        done()
      })
    })
  })

  it('ghost', function () {
    markedpp(rawmd, { include: false, ghost: true }, (_err, premd) => {
      const html = ghost.render(premd)
      const { href, h2 } = extractAnchors(html)
      if (writeHtml) {
        fs.writeFileSync(`${__dirname}/tmp/ghost.html`, html, 'utf8')
      }
      assert.deepStrictEqual(href, h2)
    })
  })

  it('github', function (done) {
    const url = 'https://github.com/commenthol/test-md-anchors/blob/master/README.md'
    const sel = 'article.markdown-body'
    const file = `${__dirname}/html/github.html`
    Promise.resolve()
      .then(() => dlhtml(url, sel, file))
      // .then(html => { fs.writeFileSync(file, html, 'utf8'); return html })
      .then(html => {
        markedpp(rawmd, { include: false, github: true }, (_err, premd) => {
          const htmlToc = markdownIt().render(premd)
          const { href } = extractAnchors(htmlToc)
          const { h2 } = extractAnchors(html, 'h2 a:first-child')
          if (writeHtml) {
            const p1 = htmlToc.split(SNIP_SNIP)[0]
            const p2 = html.replace(/user-content-/g, '').split(SNIP_SNIP)[1]
            fs.writeFileSync(`${__dirname}/tmp/github.html`, p1 + p2, 'utf8')
          }

          // user-content- is appended by javascript
          assert.deepStrictEqual(href.map(decodeURI), h2.map(h => h.substr('user-content-'.length)))
          done()
        })
      })
      .catch(done)
  })

  it('gitlab', function (done) {
    // need to manually copy html to file from
    // https://gitlab.com/commenthol/test-md-anchors/blob/master/README.md
    const file = `${__dirname}/html/gitlab.html`
    const html = fs.readFileSync(file, 'utf8')
    markedpp(rawmd, { include: false, gitlab: true }, (_err, premd) => {
      const htmlToc = markdownIt().render(premd)
      const { href } = extractAnchors(htmlToc)
      const { h2 } = extractAnchors(html, 'h2 a:first-child')
      if (writeHtml) {
        const p1 = htmlToc.split(SNIP_SNIP)[0]
        const p2 = html.replace(/user-content-/g, '').split(SNIP_SNIP)[1]
        fs.writeFileSync(`${__dirname}/tmp/gitlab.html`, p1 + p2, 'utf8')
      }
      // user-content- is appended by javascript
      assert.deepStrictEqual(href.map(decodeURI), h2.map(h => h.substr('user-content-'.length)))
      done()
    })
  })

  it('bitbucket', function () {
    // need to manually copy html to file from
    // https://bitbucket.org/commenthol/test-md-anchors/src/master/
    const file = `${__dirname}/html/bitbucket.html`
    const html = fs.readFileSync(file, 'utf8')
    markedpp(rawmd, { include: false, bitbucket: true }, (_err, premd) => {
      const htmlToc = markdownIt().render(premd)
      let { href } = extractAnchors(htmlToc)
      let { h2 } = extractAnchors(html)
      if (writeHtml) fs.writeFileSync(`${__dirname}/tmp/bitbucket.html`, htmlToc + html, 'utf8')

      // Python markdown seams to make some preprocessing ...
      const failing = [
        /markdown-header-remove-special-chars/,
        /markdown-header-windowfindinventoryitemitemtype-metadata-/,
        /markdown-header-.*html-amp-entities/,
        /markdown-header-wzxhzdk0html-wzxhzdk1-entitieswzxhzdk2/,
        /markdown-header-.*xml-amp-entities/,
        /markdown-header-wzxhzdk3xml-wzxhzdk4-entities-wzxhzdk5wzxhzdk6/
      ]
      href = filterFailingTests(href, failing)
      h2 = filterFailingTests(h2, failing)
      assert.deepStrictEqual(href, h2)
    })
  })

  it('pandoc', function () {
    // need to manually generate file
    // pandoc -v // v2.5
    // bin/markedpp.js --pandoc test/assets/heading_anchors.md | pandoc > test/html/pandoc.html
    const file = `${__dirname}/html/pandoc.html`
    const html = fs.readFileSync(file, 'utf8')
    markedpp(rawmd, { include: false, pandoc: true }, (_err, premd) => {
      const htmlToc = markdownIt().render(premd)
      let { href } = extractAnchors(htmlToc)
      let { h2 } = extractAnchors(html)
      if (writeHtml) fs.writeFileSync(`${__dirname}/tmp/pandoc.html`, htmlToc + html, 'utf8')

      const failing = [
      ]
      href = filterFailingTests(href, failing)
      h2 = filterFailingTests(h2, failing)
      assert.deepStrictEqual(href.map(decodeURI), h2)
    })
  })
})
