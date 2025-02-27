import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tmpl = ({ input, expected }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>markedpp test</title>
  <style type="text/css">
#result {
  padding: 0.3em;
}
.passed {
  color: #000;
  background-color: #0f0;
}
.error {
  color: #fff;
  background-color: #f00;
}
.hide {
  display: none;
}
  </style>
</head>
<body>

<div id="result" class="error">Not passed</div>

<h2>Input</h2>
<pre id="markedpp">${input}</pre>

<h2>Output</h2>
<table>
<tr>
<td>is</td>
<td>should</td>
</tr>
<tr>
<td>
<pre id="is">
</pre>
</td>
<td>
<pre id="should">
</pre>
</td>
</tr>
</table>

<script id="template" type="text/plain">${expected}</script>

<script type="module">
import { markedpp } from "./browser.mjs"
const d = document;

function replace (text) {
  return text.replace(/[ ]/g, '·').replace(/[\\n]/g, '¶\\n')
}

const src = d.getElementById('markedpp').textContent;
const expected = d.getElementById('template').textContent

markedpp(src, {}, (err, data) => {
  d.getElementById('is').textContent = replace(data)
  d.getElementById('should').textContent = replace(expected)

  if (expected === data) {
  const ok = d.getElementById('result')
    ok.className = 'passed'
    ok.innerHTML = 'Passed'
  }
})
</script>
</body>
</html>
`

if (process.argv[1] === __filename) {
  const app = express()

  app.set('port', process.env.PORT || 3000)

  app.get('/', (req, res) => {
    const inp = `${__dirname}/assets/all.md`
    const exp = `${__dirname}/assets/all.exp.md`
    const input = fs.readFileSync(inp, 'utf8')
    const expected = fs.readFileSync(exp, 'utf8')
    const data = tmpl({ input, expected })
    res.type('html')
    res.end(data)
  })

  app.use(express.static(`${__dirname}/assets`))
  app.use(express.static(`${__dirname}/../dist`))

  const server = app.listen(app.get('port'), function () {
    console.log('Server listening on port ' + server.address().port) // eslint-disable-line no-console
  })
}
