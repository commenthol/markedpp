const ppIncludeBrowser = require('./ppInclude-browser')
const markedppninja = require('./markedppninja')
markedppninja.ppInclude = ppIncludeBrowser

module.exports = markedppninja
