/**
 * @param {string} str
 * @param {boolean} [undef]
 * @returns
 */
export function int (str, undef) {
  const num = parseInt(str, 10)
  if (isNaN(num)) {
    if (undef === true) {
      return
    } else {
      return str
    }
  }
  return num
}

/**
 * @param {string} str
 * @param {number} [times=1]
 * @returns
 */
export function repeat (str, times) {
  times = times || 1
  let ret = ''
  for (let i = 0; i < times; i++) {
    ret += str
  }
  return ret
}
