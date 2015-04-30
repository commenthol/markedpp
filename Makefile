all: readme jshint 0.8 0.12 markedpp.min.js

markedpp.min.js: lib/markedpp.js
	@uglifyjs -m --comments '/\*[^\0]+?\@copyright[^\0]+?\*/' -o $@ $<

jshint:
	@npm run lint

test:
	@npm test

cover:
	@npm run cover

clean:
	@rm markedpp.min.js
	@rm -rf doc coverage

readme: README.md
	./bin/markedpp.js --githubid -i $< -o $<

browser:
	x-www-browser "http://localhost:3000" ;\
	node test/server.js

%:
	n $@ && npm test

.PHONY: readme jshint test clean browser all
