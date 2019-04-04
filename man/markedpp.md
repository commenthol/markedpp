# markedpp(1) -- a markdown pre-processor

## SYNOPSIS

    markedpp [options] <file.md> 

## OPTIONS

* `-h`, `--help`:
  Display this help and exit.

* `--version`:
  Output version information and exit.

* `-o`, `--output` <outfile.md>:
  Specify the filename for the processed output. Defaults to stdout.

* `-i`, `--input` <file.md>:
  Specify the filename for markdown input.

* `-t`, `--tokens`:
  Output lexed tokens as JSON array.

* `--no-gfm`:
  Disable GFM fences.

* `--no-include`:
  Disables `!includes`. No files will be included.

* `--no-toc`:
  Disables `!toc`. No generation of Table-of-Contents.

* `--no-numberedheadings`:
  Disables `!numberedheadings`.

* `--no-ref`:
  Disables `!ref`.

* `--no-breaks`:
  Do not render `<br>` tags for Table of Contents with numbered style.

* `--no-tags`:
  Do not render pre-proc tags `<!-- !command -->`.

* `--level` <number=3>:
  Change default level [1..6] for `!toc` and `!numberheadings`.
  Default is 3.

* `--minlevel` <number=1>:
  Change default minlevel [1..6] for `!toc` and `!numberheadings`.
  Default is 1.

* `--smartlists:`
    Adds a newline on joined bullet lists using different bullet chars.

* `--no-autonumber`:
  Disable renumbering of ordered lists.

* `--autoid`:
  Add named anchors on headings <a name="..."> anchors).

* `--github`:
  Uses "github.com" compatible anchors.
  Default uses marked compatible anchors.

* `--gitlab`:
  Uses "gitlab.com" compatible anchors.

* `--bitbucket`:
  Uses "bitbucket.org" compatible anchors.

* `--ghost`:
  Uses "ghost.org" compatible anchors.

## EXAMPLE

Process a README.md file using gitlab anchors:

    markedpp --gitlab -o README.md README.md

Pipe from stdin:

    cat file.md | markedpp

## INSTALLATION

    npm i -g markedpp

## COPYRIGHT

Copyright (c) 2014- commenthol - MIT License

## REPORTING BUGS

markedpp repository <https://github.com/commenthol/markedpp/issues>
