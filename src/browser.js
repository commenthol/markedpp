import { ppInclude } from './ppInclude-browser.js'
import { markedpp } from './markedpp.js'
markedpp.ppInclude = ppInclude

const markedAsync = (md) =>
  new Promise((resolve, reject) => {
    markedpp(md, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })

export { markedpp, markedAsync }
export default markedpp
