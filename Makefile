all: npmall readme v6. v8. v11. v10.

node_modules:
	@npm i

npmall: node_modules
	@npm run all

dist: dist/markedpp.min.js
	@npm run webpack

lint:
	@npm run lint

test:
	@npm test

cover:
	@npm run coverage

clean:
	@npm run clean

man:
	@ronn -r ./man/markedpp.md
	@man ./man/markedpp.1 > ./man/markedpp.txt

readme: README.md
	@./bin/markedpp.js --github -i $< -o $<

browser:
	firefox "http://localhost:3000" ;\
	node test/server.js

v%:
	n $@
	npm test

.PHONY: man readme npmall lint test clean browser all
