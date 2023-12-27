# markedpp

> Preprocessor for documents written in markdown

[![NPM version](https://badge.fury.io/js/markedpp.svg)](https://www.npmjs.com/package/markedpp/)
[![Build Status](https://app.travis-ci.com/commenthol/markedpp.svg?branch=master)](https://app.travis-ci.com/commenthol/markedpp)

`markedpp` is a preprocessor for documents written in [markdown][markdown]. The output itself is again markdown.

It supports the following extensions:

* Generation of a "Table of Contents"
* Automatic numbering of Headings
* Include various files into a single output document
* Sorted collection of References
* Autonumbering of ordered lists
* Automatic update of heading identifiers
* Support for autoid for [marked][], [markdown-it][], [unified][], [pandoc][],
  [github.com][], [gitlab.com][], [bitbucket.org][], [ghost.org][].

This project is inspired by [markdown-pp][markdown-pp].
Albeight the markdown syntax of this project here is slightly different, [markdown-pp][markdown-pp] commands can be used as well.

## Table of Contents

<!-- !numberedheadings (level=4 minlevel=2 skip=1) -->

<!-- !toc (level=4 minlevel=2 omit="Table of Contents") -->

* [1\. Extended Markdown Syntax](#1-extended-markdown-syntax)
  * [1.1\. toc](#11-toc)
    * [1.1.1\. level](#111-level)
    * [1.1.2\. minlevel](#112-minlevel)
    * [1.1.3\. numbered](#113-numbered)
    * [1.1.4\. omit](#114-omit)
  * [1.2\. ref](#12-ref)
  * [1.3\. include](#13-include)
  * [1.4\. numberedheadings](#14-numberedheadings)
    * [1.4.1\. level](#numberedheadings-level)
    * [1.4.2\. minlevel](#142-minlevel)
    * [1.4.3\. skip](#143-skip)
    * [1.4.4\. start](#144-start)
    * [1.4.5\. omit](#145-omit)
* [2\. Specials](#2-specials)
  * [2.1\. Using custom anchors](#21-using-custom-anchors)
  * [2.2\. Changing type of autoId generation](#22-changing-type-of-autoid-generation)
* [3\. Installation](#3-installation)
* [4\. Usage](#4-usage)
* [5\. CLI](#5-cli)
* [6\. Running Tests & Contributing](#6-running-tests--contributing)
  * [6.1\. Contribution and License Agreement](#61-contribution-and-license-agreement)
* [7\. License](#7-license)
* [8\. References](#8-references)

<!-- toc! -->

## 1\. Extended Markdown Syntax

The extended markdown syntax for the pre-processor borrows from the already existing image tag.
All commands start using a `!` followed by the command. Options for the specific command are specified in normal brackets.

    !<command> (<options>)


### 1.1\. toc

    !toc [([level=1-6] [minlevel=1-6] [numbered] [omit="...;..."])]

Inserts a "Table of Contents" section:

* level: \[optional\] level of headings to show (default is 3)
* minlevel: \[optional\] min-level of headings to show (default is 1)
* numbered: \[optional\] show numbered
* omit: \[optional\] remove headings from ToC. Headings need to be given in `"` and separated by `;`

E.g.

* [One](#one)
  * [One One](#one-one)
    * [One One One](#one-one-one)
* [Two](#two)
  * [Two One](#two-one)

    This includes a "Table of Contents" section. All headings up to level=3 will be linked with their references as a unnumbered bullet list.

For compatibility reasons the following alternative syntax is supported:

```
!TOC
```
```
[[TOC]]
```
```
<!-- toc -->
<!-- /toc -->
```
```
<!-- toc -->
<!-- toc stop -->
```
```
<!-- toc -->
```

#### 1.1.1\. level

    !toc (level=5)

To change the default level of 3 to a different one specify the option `level` in brackets.

#### 1.1.2\. minlevel

    !toc (minlevel=2)

The option `minlevel` only displays the ToC from `minlevel` leaving out all headings with a lower level.

E.g. with the above example:

* [One One](#one-one)
  * [One One One](#one-one-one)
* [Two One](#two-one)

#### 1.1.3\. numbered

    !toc (numbered)

The option `numbered` displays the ToC without a bullet list but in a flat numbered fashion

E.g.

1\. [One](#one) <br>
1.1\. [One One](#one-one) <br>
1.1.1\. [One One One](#one-one-one) <br>
2\. [Two](#two) <br>
2.1\. [Two One](#two-one) <br>

The Preprocessor inserts a html comment tag which allows regenerating the TOC on an already preprocessed document.

E.g.

    <!-- !toc (level=1) -->

    * [One](#one)
    * [Two](#two)

    <!-- toc! -->

#### 1.1.4\. omit

To omit headings in the ToC define those with `omit`.

E.g. to remove "Table of Contents" and the branch of "Heading 1":

    # Table of Contents

    !toc (omit="Table of Contents;Heading 1")

    # Heading 1
    ## Heading 1.1
    # Heading 2

will result in:

    # Table of Contents

    <!-- !toc -->

    * [Heading 2](#heading-2)

    <!-- toc! -->

    # Heading 1

    ## Heading 1.1

    # Heading 2

### 1.2\. ref

    !ref

This command includes a references section displaying all references using the alternate link syntax <br>
`[<name>]: <url> "<title>"` given in the document being preprocessed.

Local references which start with a "#" are ignored.

E.g.

    !ref

    [markdown]: http://daringfireball.net/projects/markdown/syntax
    [GFM]: https://help.github.com/articles/github-flavored-markdown "Github-Flavored-Markdown"

renders as:

    <!-- !ref -->

    * [Github-Flavored-Markdown][GFM]
    * [markdown][markdown]

    <!-- ref! -->

    [markdown]: http://daringfireball.net/projects/markdown/syntax
    [GFM]: https://help.github.com/articles/github-flavored-markdown "Github-Flavored-Markdown"

### 1.3\. include

    !include (filename [lang=...])

This inserts the the file specified with `filename` at the given position in the document being preprocessed.
The preprocessor inserts any type of files.

* filename: \[mandatory\] Name of file to include
* lang: \[optional\] language of file - if set, then [GFM][GFM] fences are added around include.

To include a file with specifying the language use the option `lang`.

This then will render using [GFM][GFM] fences.

E.g.

    !include (test.js lang=javascript)

renders as

    ```javascript
    /* contents of test.js */
    ```

Files to insert which cannot be found or recursive inset of the same file leaves the `!include` command as is.

### 1.4\. numberedheadings

    !numberedheadings [([level=1-6] [minlevel=1-6] [skip=1..] [start=1..] [omit="...;..."] [skipEscaping])]

Add numbers on headings

* level: {Number} \[optional\] level of Headings to show (default is 3)
* minlevel: {Number} \[optional\] min-level of Headings to show (default is 1)
* skip: {Number} \[optional\] skip number of Headings on min-level
* start: {Number} \[optional\] start numbering of Headings with given number
* omit: {String} \[optional\] omit numbering of Headings. Headings need to be given in `"` and separated by `;`
* skipEscaping: \[optional\] if enabled `\` will not escape the last `.` in Headings

All Headings up to level 3 will get numbered. If used, this command shall be given at the very top of a document.

<a name="numberedheadings-level"></a>

#### 1.4.1\. level

With the option `level`, the Headings level where the numbering shall be applied, can be specified.

E.g.

    !numberedheadings (level=2)

will number all Headings of level 1 and 2.

Used together with `!toc` the numbered Headings with show up numberd in the bullet-list style.

E.g.

* [1\. One](#1-one)
  * [1.1\. One One](#1-1-one-one)

`!toc (numbered)` will display the flat style, still with the numbers.

1\. [One](#1-one) <br>
1.1\. [One One](#1-1-one-one)

#### 1.4.2\. minlevel

The option `minlevel` omits numbering all Headings below `minlevel`.

#### 1.4.3\. skip

The option `skip` skips numbering for the first Headings on `minlevel`.

#### 1.4.4\. start

The option `start` starts the numbering with the given number.

#### 1.4.5\. omit

The option `omit` omits numbering all Headings matching.

## 2\. Specials

### 2.1\. Using custom anchors

Custom anchors can be added to headings by putting a `<a name="..."></a>` in a separate line right in front of the heading.

```html
<a name="custom-heading"></a>
# Heading with custom id
```

Instead of using the auto generated id `#heading-with-custom-id`, `#custom-heading` will be used as anchor in the ToC.

### 2.2\. Changing type of autoId generation

Unfortunately there is no unique format which defines the composition of an auto identifier in markdown.
[marked][] uses a different format then github.

Available options:

* `--marked`
  for [marked][] - is default
* `--markdownit`
  for [markdown-it][] parser using [markdown-it-anchor][] plugin
* `--unified`
  for [unified][] parser using [remark-slug][] plugin
* `--pandoc`
  for [pandoc][]
* `--github`
  for https://github.com
* `--gitlab`
  for https://gitlab.com
* `--bitbucket`
  for https://bitbucket.org
* `--ghost`
  for https://ghost.org

For other markdown processors:

* `--autoid`:
  adds named anchors on headings using `<a name="..."></a>`.

On the CLI

```bash
markedpp --github file.md
```

Or use in your options

```javascript
var markedpp = require('markedpp'),
    md = '!toc\n# hello\n## hello & again',
    options = { github: true };

markedpp(md, options, function(err, result){
    console.log(result);
});
```

## 3\. Installation

For use from commandline consider global install

    npm install -g markedpp

For your project

    npm install markedpp

## 4\. Usage

```javascript
var markedpp = require('markedpp'),
    md = '!numberedheadings\n!toc(level=1)\n# hello\n## hello again';

markedpp(md, function(err, result){
    console.log(result);
    /* Outputs
    <!-- !numberedheadings -->

    <!-- !toc (level=1) -->

    * [1\. hello](#1-hello)

    <!-- toc! -->

    # 1\. hello

    ## 1.1\. hello again
    */
});
```

To include files the dirname need to be defined via `options`, otherwise it is assumed that the file to include is relative to the current working directory:

```javascript
var markedpp = require('markedpp'),
    md = '!include(hello.md)',
    options = { dirname: __dirname };

markedpp(md, options, function(err, result){
    console.log(result);
});
```

## 5\. CLI

Standalone

```bash
$ (cat<<EOF
!numberedheadings
!toc(level=1)
# hello
## hello again
EOF
) > hello.md
$ markedpp hello.md
<!-- !numberedheadings -->

<!-- !toc (level=1) -->

* [1\. hello](#1-hello)

<!-- toc! -->

# 1\. hello

## 1.1\. hello again
```

Together with [marked][marked]

```bash
$ markedpp --no-tags hello.md | marked
<ul>
<li><a href="#1-hello">1. hello</a></li>
</ul>
<h1 id="1-hello">1. hello</h1>
<h2 id="1-1-hello-again">1.1. hello again</h2>
```

## 6\. Running Tests & Contributing

If you want to submit a pull request, make sure your changes pass the tests. If you're adding a new feature, be sure to add your own test.

To run the tests:

```bash
npm test
```

### 6.1\. Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work.

## 7\. License

Copyright (c) 2014-, Commenthol. (MIT License)

See [LICENSE][] for more info.

## 8\. References

<!-- !ref -->

* [bitbucket.org][bitbucket.org]
* [ghost.org][ghost.org]
* [Github-Flavored-Markdown][GFM]
* [github.com][github.com]
* [gitlab.com][gitlab.com]
* [LICENSE][LICENSE]
* [markdown][markdown]
* [markdown-it][markdown-it]
* [markdown-it-anchor][markdown-it-anchor]
* [markdown-pp][markdown-pp]
* [marked][marked]
* [pandoc][pandoc]
* [remark-slug][remark-slug]
* [unified][unified]

<!-- ref! -->

[GFM]: https://help.github.com/articles/github-flavored-markdown "Github-Flavored-Markdown"
[LICENSE]: ./LICENSE
[markdown-it-anchor]: https://npmjs.com/package/markdown-it-anchor
[markdown-it]: https://npmjs.com/package/markdown-it
[markdown-pp]: https://github.com/jreese/markdown-pp
[markdown]: http://daringfireball.net/projects/markdown/syntax
[marked]: https://npmjs.com/package/marked
[pandoc]: https://pandoc.org
[remark-slug]: https://npmjs.com/package/remark-slug
[unified]: https://npmjs.com/package/unified
[github.com]: https://github.compare
[gitlab.com]: https://gitlab.com
[bitbucket.org]: https://bitbucket.org
[ghost.org]: https://ghost.org
