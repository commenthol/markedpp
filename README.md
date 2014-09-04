# markedpp - Markdown Preprocessor

`markedpp` is a preprocessor for documents written in [markdown][markdown]. The output itself is again markdown.

It supports the following extensions:

* Generation of a "Table of Contents"
* Automatic numbering of Headings
* Include various files into a single output document
* Sorted collection of References 

This project is inspired by [markdown-pp][markdown-pp].
Albeight the markdown syntax of this project here is slightly different, [markdown-pp][markdown-pp] commands can be used as well.

## Table of Contents

<!-- !toc (level=4 minlevel=2 omit="Table of Contents") -->

* [Extended Markdown Syntax](#extended-markdown-syntax)
  * [toc](#toc)
    * [level](#level)
    * [minlevel](#minlevel)
    * [numbered](#numbered)
    * [omit](#omit)
  * [ref](#ref)
  * [include](#include)
  * [numberedheadings](#numberedheadings)
    * [level](#level-nh)
    * [minlevel](#minlevel-nh)
* [Installation](#installation)
* [Usage](#usage)
* [CLI](#cli)
* [Running Tests & Contributing](#running-tests-contributing)
  * [Contribution and License Agreement](#contribution-and-license-agreement)
* [License](#license)
* [References](#references)

<!-- toc! -->


## Extended Markdown Syntax

The extended markdown syntax for the preprocessor borrows from the already existing image tag.
All commands start using a `!` followed by the command. Options for the specific command are specified in normal brackets.

    !<command> (<options>)
    

### toc

	!toc [([level=...] [minlevel=...] [numbered] [omit="...;..."])]

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

#### level

    !toc (level=5)

To change the default level of 3 to a different one specify the option `level` in brackets.

#### minlevel

    !toc (minlevel=2)

The option `minlevel` only displays the ToC from `minlevel` leaving out all headings with a lower level.

E.g. with the above example:

* [One One](#one-one)
  * [One One One](#one-one-one)
* [Two One](#two-one)

#### numbered

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

#### omit

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

### ref

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

### include

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

### numberedheadings

	!numberedheadings [([level=...] [minlevel=...])]

Add numbers on headings

* level: \[optional\] level of Headings to show (default is 3) 
* minlevel: \[optional\] min-level of Headings to show (default is 1) 

All Headings up to level 3 will get numbered. If used, this command shall be given at the very top of a document.

<a name="level-nh">
#### level

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

<a name="minlevel-nh">
#### minlevel

The option `minlevel` omits numbering all Headings below `minlevel`.


## Installation

    npm install -g markedpp

## Usage

```javascript
var markedpp = require('markedpp');
markedpp('!numberedheadings\n!toc(level=1)\n# hello\n## hello again', function(err, data){
    console.log(data);
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
var markedpp = require('markedpp');
markedpp('!include(hello.md)', { dirname: __dirname }, function(err, data){
    console.log(data);
});
```

## CLI

Standalone

``` bash
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

``` bash
$ markedpp --no-tags hello.md | marked
<ul>
<li><a href="#1-hello">1. hello</a></li>
</ul>
<h1 id="1-hello">1. hello</h1>
<h2 id="1-1-hello-again">1.1. hello again</h2>
```

## Running Tests & Contributing

If you want to submit a pull request, make sure your changes pass the tests. If you're adding a new feature, be sure to add your own test.

To run the tests:

``` bash
npm test
```

### Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work.

## License

Copyright (c) 2014, Commenthol. (MIT License)

See [LICENSE][license] for more info.

## References

<!-- !ref -->

* [Github-Flavored-Markdown][GFM]
* [license][license]
* [markdown][markdown]
* [markdown-pp][markdown-pp]
* [marked][marked]

<!-- ref! -->

[marked]: https://github.com/chjj/marked
[markdown]: http://daringfireball.net/projects/markdown/syntax
[markdown-pp]: https://github.com/jreese/markdown-pp
[GFM]: https://help.github.com/articles/github-flavored-markdown "Github-Flavored-Markdown"
[license]: ./LICENSE
