# markedppninja(1) -- a markdown pre-processor

## SYNOPSIS

    markedppninja [options] <file.md>

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
  Add named anchors on headings using `<a name="..."></a>`.

* `--marked`:
  Uses "[marked][]" markdown processor compatible anchors. This is the default.

* `--markdownit`:
  For [markdown-it][] processor using [markdown-it-anchor][] plugin.

* `--unified`:
  For [unified][] processor using [remark-slug][] plugin.
  Is currently the same as `--github`.

* `--pandoc`:
  For [pandoc][].

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

    markedppninja --gitlab -o README.md README.md

Pipe from stdin to [pandoc][]:

    cat file.md | markedppninja --pandoc | pandoc

## INSTALLATION

    npm i -g markedpp-ninja

## COPYRIGHT

Copyright (c) 2014- commenthol - MIT License

## REPORTING BUGS

markedpp repository <https://github.com/gatewayprogrammingschool/markedpp/issues>

[marked]: https://npmjs.com/package/marked
[markdown-it]: https://npmjs.com/package/markdown-it
[markdown-it-anchor]: https://npmjs.com/package/markdown-it-anchor
[pandoc]: https://pandoc.org
[unified]: https://npmjs.com/package/unified
[remark-slug]: https://npmjs.com/package/remark-slug
