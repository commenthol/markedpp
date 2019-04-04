const anchor = require('./anchor-markdown-header')

function getAnchor (id, mode) {
  let _id
  if (!mode) {
    // marked mode
    _id = id
      .replace(/[^\w]+/g, '-')
      .toLowerCase()
  } else {
    _id = anchor(id, mode)
  }
  return _id
}

module.exports = getAnchor
