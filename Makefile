all: readme jshint v0.10 v0.12 v4.4 v5.11 markedpp.min.js

markedpp.min.js: lib/markedpp.js
	@uglifyjs -m --comments '/\*[^\0]+?\@copyright[^\0]+?\*/' -o $@ $<

jshint:
	@npm run lint

test:
	@npm test

cover:
	@npm run cover

clean:
	@rm test/assets/*.md.*
	@rm markedpp.min.js
	@rm -rf doc coverage

readme: README.md
	./bin/markedpp.js --githubid -i $< -o $<

browser:
	x-www-browser "http://localhost:3000" ;\
	node test/server.js

v%:
	n $@
	#rm -rf node_modules
	#npm i
	npm test

.PHONY: readme jshint test clean browser all
