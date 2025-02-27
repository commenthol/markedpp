import { slugger, MODE } from './anchorSlugger.js'

export class Anchor {
  constructor (mode = MODE.MARKED) {
    this._counters = {}
    this._mode = mode
    this._startCnt = 0

    switch (mode) {
      case MODE.BITBUCKET:
        this._fn = (...args) => this._inc('_', ...args)
        break
      case MODE.GITHUB:
      case MODE.GITLAB:
      case MODE.PANDOC:
      case MODE.MARKED:
        this._fn = (...args) => this._inc('-', ...args)
        break
      case MODE.MARKDOWNIT:
        this._startCnt = 0
        this._fn = (...args) => this._inc('-', ...args)
        break
      case MODE.GHOST:
        // repetitions not supported
        this._fn = (id) => id
        break
      default:
        throw new Error('Unknown mode: ' + mode)
    }
  }

  _inc (sep, id, isInc) {
    if (!this._counters[id]) this._counters[id] = 0
    const cnt = this._counters[id]
    if (isInc) {
      if (!cnt) this._counters[id] = this._startCnt
      this._counters[id] += 1
    }
    return cnt ? id + sep + cnt : id
  }

  get (header, isInc) {
    const id = slugger(header, this._mode)
    return this._fn(id, isInc)
  }
}
