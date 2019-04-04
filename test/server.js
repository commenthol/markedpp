'use strict'

const express = require('express')

if (module === require.main) {
  const app = express()

  app.set('port', process.env.PORT || 3000)
  app.use(express.static(`${__dirname}/assets`))

  const server = app.listen(app.get('port'), function () {
    console.log('Server listening on port ' + server.address().port)
  })
}
