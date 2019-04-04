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

  autonumber: true, // renumber lists
  autoid: true, // update identifiers on headings automatically
  githubid: false // use github convention for heading auto identifiers
}

module.exports = defaults
