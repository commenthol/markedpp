import { ppInclude } from './ppInclude.js'
import { markedpp } from './markedpp.js'
markedpp.ppInclude = ppInclude

const markedppAsync = (md) =>
  new Promise((resolve, reject) => {
    markedpp(md, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })

export default markedpp
export { markedpp, markedppAsync, markedppAsync as markedAsync }
