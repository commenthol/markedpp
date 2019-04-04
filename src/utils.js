function merge (obj) {
  var i = 1
  var target
  var key

  for (; i < arguments.length; i++) {
    target = arguments[i]
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key]
      }
    }
  }

  return obj
}

function int (str, undef) {
  var num = parseInt(str, 10)
  if (isNaN(num)) {
    if (undef === true) { return } else { return str }
  }
  return num
}

function repeat (str, times) {
  times = times || 1
  var ret = ''
  for (var i = 0; i < times; i++) {
    ret += str
  }
  return ret
}

module.exports = {
  merge,
  int,
  repeat
}
