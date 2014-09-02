'use strict';

var	express = require('express');

var app = express();

app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/assets'));

var server = app.listen(app.get('port'), function() {
  console.log('Server listening on port ' + server.address().port);
});