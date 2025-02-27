.PHONY: all
all: npmall readme v20 v23 v22

node_modules:
	@npm i

.PHONY: npmall
npmall: node_modules
	@npm run all

dist: dist/browser.mjs
	@npm run build

.PHONY: lint
lint:
	@npm run lint

.PHONY: test
test:
	@npm test

.PHONY: cover
cover:
	@npm run coverage

.PHONY: clean
clean:
	@npm run clean

.PHONY: man
man:
	@ronn -r ./man/markedpp.md
	@man ./man/markedpp.1 > ./man/markedpp.txt

.PHONY: readme
readme: README.md
	@./bin/markedpp.js --github -i $< -o $<

.PHONY: browser
browser: dist
	firefox "http://localhost:3000" ;\
	node test/server.js

v%:
	n $@
	npm test
