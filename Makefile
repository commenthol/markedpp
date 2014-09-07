all: jshint runtest minify gitadd

minify:
	@uglifyjs -m --comments '/\*[^\0]+?\@copyright[^\0]+?\*/' -o markedpp.min.js lib/markedpp.js

jshint:
	@jshint lib/*.js test/*.js

gitadd:
	@git ls -m | xargs git add

runtest:
	@npm test

clean:
	@rm markedpp.min.js

.PHONY: clean all
