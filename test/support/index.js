import fs from 'fs'
import request from 'superagent'
import * as cheerio from 'cheerio'

export function dlhtml (url, selector, file) {
  if (file) {
    return Promise.resolve(fs.readFileSync(file, 'utf8'))
  }
  return request
    .get(url)
    .accept('html')
    .then(({ status, text }) => {
      const $ = cheerio.load(text)
      const html = $(selector).html()
      return html
    })
}
