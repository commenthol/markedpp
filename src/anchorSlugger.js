/* eslint-disable no-multi-spaces */

/**
 * initially from https://raw.githubusercontent.com/thlorenz/anchor-markdown-header/master/anchor-markdown-header.js
 * @author thlorenz
 * @license MIT
 */

import emojiRegex from 'emoji-regex'
import * as entities from 'html-entities'

const MODE = {
  BITBUCKET: 'bitbucket',
  GHOST: 'ghost',
  GITHUB: 'github',
  GITLAB: 'gitlab',
  MARKDOWNIT: 'markdownit',
  MARKED: 'marked',
  PANDOC: 'pandoc',
  UNIFIED: 'unified'
}

// CJK punctuations 。？！，、；：【】（）〔〕［］﹃﹄“”‘’﹁﹂—…－～《》〈〉「」
const RE_CJK =
  /[\u2014\u2018\u2019\u201c\u201d\u2026\u3001\u3002\u3008-\u300d\u3010\u3011\u3014\u3015\ufe41-\ufe44\uff01\uff08\uff09\uff0c\uff0d\uff1a\uff1b\uff1f\uff3b\uff3d\uff5e]/g
const RE_ENTITIES = /&([a-z][a-z0-9]+|#[0-9]{2,4});/gi
const RE_SPECIALS_DOT = /[./?!:[\]`,()*"';{}+=<>~\\$|#@&\u2013\u2014^]/g
const RE_SPECIALS = /[/?!:[\]`,()*"';{}+=<>~\\$|#@&\u2013\u2014^]/g

/**
 * basicGithubId
 * @private
 */
function basicGithubId (text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-') // whitespaces
    .replace(/%25|%/gi, '') // remove single % signs
    .replace(RE_ENTITIES, '') // remove xml/html entities
    .replace(RE_SPECIALS_DOT, '') // single chars that are removed
    .replace(RE_CJK, '') // CJK punctuations that are removed
}

/**
 * getGithubId - anchors used at github.com
 * @private
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '-' and the number.
 */
function getGithubId (text) {
  text = basicGithubId(text)
  text = text.replace(emojiRegex(), '') // Strip emojis
  return text
}

/**
 * getBitbucketId - anchors used at bitbucket.org
 * @private
 * @see: https://github.com/Python-Markdown/markdown/blob/master/markdown/extensions/toc.py#L25
 * There seams to be some "magic" preprocessor which could not be handled here.
 * @see: https://github.com/Python-Markdown/markdown/issues/222
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '_' and the number.
 * https://groups.google.com/d/msg/bitbucket-users/XnEWbbzs5wU/Fat0UdIecZkJ
 */
function getBitbucketId (text) {
  text =
    'markdown-header-' +
    text
      .toLowerCase()
      .replace(/\\(.)/g, (_m, c) => c.charCodeAt(0)) // add escaped chars with their charcode
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-') // whitespace
      .replace(/-+/g, '-') // duplicated hyphen
      .replace(/^-+|-+$/g, '') // heading/ tailing hyphen
  return text
}

/**
 * getGhostId - anchors used at ghost.org or in `npm i ghost`
 * @private
 * @see https://github.com/TryGhost/Koenig/blob/master/packages/kg-markdown-html-renderer/lib/markdown-html-renderer.js
 */
function getGhostId (text) {
  return entities.decode(text).replace(/[^a-z0-9]/gi, '')
}

/**
 * getGitlabId - anchors used at gitlab.com
 * @private
 * @see: https://github.com/gitlabhq/gitlabhq/blob/master/doc/user/markdown.md#header-ids-and-links
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '-' and the number.
 */
function getGitlabId (text) {
  text = basicGithubId(text)
  text = text
    .replace(emojiRegex(), '') // Strip emojis
    .replace(/-+/g, '-') // duplicated hyphen
  return text
}

/**
 * getPandocId - anchors used at pandoc
 * @private
 */
function getPandocId (text) {
  text = text
    .replace(emojiRegex(), '') // Strip emojis
    .toLowerCase()
    .trim()
    .replace(/%25|%/gi, '') // remove single % signs
    .replace(RE_ENTITIES, '') // remove xml/html entities
    .replace(RE_SPECIALS, '') // single chars that are removed but not [.-]
    .replace(/\s+/g, '-') // whitespaces
    .replace(/^-+|-+$/g, '') // heading/ tailing hyphen
    .replace(RE_CJK, '') // CJK punctuations that are removed

  if (/^[0-9-]+$/.test(text)) {
    text = 'section'
  }
  return text
}

/**
 * @see https://github.com/markedjs/marked/blob/master/src/helpers.js#L30
 */
function unescapeMarked (html) {
  // explicitly match decimal, hex, and named HTML entities
  return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi, (_, n) => {
    n = n.toLowerCase()
    if (n === 'colon') return ':'
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1))
    }
    return ''
  })
}

/**
 * getMarkedId - anchors used in `npm i marked`
 * @private
 * @see https://github.com/markedjs/marked/blob/master/src/Slugger.js#L19 v0.8.2
 */
function getMarkedId (text) {
  const _text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1') // normalize links
  return unescapeMarked(_text)
    .toLowerCase()
    .trim()
    .replace(/<[!/a-z].*?>/gi, '') // remove html tags
    .replace(
      /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g,
      ''
    ) // remove unwanted chars
    .replace(/\s/g, '-')
}

/**
 * getMarkDownItAnchorId - anchors used with `npm i markdown-it-anchor`
 * @private
 * @see: https://github.com/valeriangalliat/markdown-it-anchor/blob/master/index.js#L1
 * If no repetition, or if the repetition is 0 then ignore. Otherwise append '_' and the number.
 * numbering starts at 2!
 */
function getMarkDownItAnchorId (text) {
  text = text.replace(/^[<]|[>]$/g, '') // correct markdown format bold/url
  text = entities.decode(text).toLowerCase().trim().replace(/\s+/g, '-')
  return encodeURIComponent(text)
}

/**
 * @private
 */
function asciiOnlyToLowerCase (input) {
  let result = ''
  for (let i = 0; i < input.length; ++i) {
    if (input[i] >= 'A' && input[i] <= 'Z') {
      result += input[i].toLowerCase()
    } else {
      result += input[i]
    }
  }
  return result
}

/**
 * Generates an anchor for the given header and mode.
 *
 * @param header      {String} The header to be anchored.
 * @param mode        {String} The anchor mode (github.com|nodejs.org|bitbucket.org|ghost.org|gitlab.com).
 * @return            {String} The header anchor that is compatible with the given mode.
 */
function slugger (header, mode) {
  mode = mode || 'marked'
  let replace

  switch (mode) {
    case MODE.MARKED:
      replace = getMarkedId
      break
    case MODE.MARKDOWNIT:
      return getMarkDownItAnchorId(header)
    case MODE.GITHUB:
      replace = getGithubId
      break
    case MODE.GITLAB:
      replace = getGitlabId
      break
    case MODE.PANDOC:
      replace = getPandocId
      break
    case MODE.BITBUCKET:
      replace = getBitbucketId
      break
    case MODE.GHOST:
      replace = getGhostId
      break
    default:
      throw new Error('Unknown mode: ' + mode)
  }

  const href = replace(asciiOnlyToLowerCase(header.trim()))

  return encodeURI(href)
}

export { MODE, slugger }
