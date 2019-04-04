const anchor = require('./anchor-markdown-header')

function getAnchor (id, mode) {
  if (!mode) {
    // marked mode
    return '#' + id
      .replace(/[^\w]+/g, '-')
      .toLowerCase()
  } else {
    return anchor(id, mode)
  }
}

module.exports = getAnchor
