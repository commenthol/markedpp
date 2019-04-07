/*
* default values
*/
const defaults = {
  gfm: true, // consider gfm fences
  include: true, // enable !includes
  toc: true, // enable !toc
  numberedheadings: true, // enable !numberedheadings
  ref: true, // enable !ref

  breaks: true, // render <br> tags for Table of Contents with numbered style
  tags: true, // render pre-proc tags <!-- !command -->
  level: 3, // default level for !toc and !numberheadings
  minlevel: 1, // default minlevel for !toc and !numberheadings
  smartlists: false, // add newline on joined bullet lists using different bullet chars

  autonumber: true, // renumber lists
  autoid: false, // update identifiers on headings automatically (adds <a name=> anchors)
  // anchor mode for heading auto identifiers
  marked: true,
  markdownit: false,
  unified: false, // same as github
  pandoc: false,
  github: false,
  gitlab: false,
  bitbucket: false,
  ghost: false
}

module.exports = defaults
