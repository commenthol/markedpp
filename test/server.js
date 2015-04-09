'use strict';

if (typeof describe === 'function') {
	return;
}

var express = require('express'),
	app = express();

app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/assets'));

var server = app.listen(app.get('port'), function() {
	console.log('Server listening on port ' + server.address().port);
});
