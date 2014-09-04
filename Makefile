all:
	@uglifyjs -m --comments '/\*[^\0]+?\@copyright[^\0]+?\*/' -o markedpp.min.js lib/markedpp.js

clean:
	@rm markedpp.min.js

.PHONY: clean all
