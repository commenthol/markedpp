<!-- !numberedheadings -->

<a name="test"></a>
# 1\. Test

<a name="table-of-contents"></a>
## 1.1\. Table of Contents

<!-- !toc -->

* [1\. Test](#test)
  * [1.1\. Table of Contents](#table-of-contents)
  * [1.2\. Mod📦ules](#mod-ules)
  * [1.3\. Chapter 1](#chapter-1)
  * [1.4\. Chapter 2](#chapter-2)
  * [1.5\. Include in folder second](#include-in-folder-second)
  * [1.6\. Include in folder third](#include-in-folder-third)
    * [1.6.1\. second](#second)
  * [1.7\. Include in folder third](#include-in-folder-third)
    * [1.7.1\. second](#second)
* [2\. References](#references)

<!-- toc! -->

<a name="mod-ules"></a>
## 1.2\. Mod📦ules

Some 📦📦📦.

<a name="chapter-1"></a>
## 1.3\. Chapter 1

<!-- include (test\ with\ spaces.js lang=javascript) -->
```javascript
"use strict";

(function(){
  var str = "this is a string";
  console.log(str);
})();
```
<!-- /include -->

[markedpp]: https://github.com/commenthol/markedpp

<a name="chapter-2"></a>
## 1.4\. Chapter 2

<!-- include (include2.md indent=4) -->
    Try to recursively load "include2.md".
    
    !include (include2.md)
<!-- /include -->

[amnesty]: http://www.amnesty.org/ "Amnesty International Homepage"

<!-- include (second/include.md) -->
<a name="include-in-folder-second"></a>
## 1.5\. Include in folder second

Located in folder "second"

<a name="include-in-folder-third"></a>
## 1.6\. Include in folder third

Test third...

<a name="second"></a>
### 1.6.1\. second

... second ...

And again

<a name="include-in-folder-third"></a>
## 1.7\. Include in folder third

Test third...

<a name="second"></a>
### 1.7.1\. second

... second ...
<!-- /include -->

<a name="references"></a>
# 2\. References

<!-- !ref -->

* [Amnesty International Homepage][amnesty]
* [markedpp][markedpp]

<!-- ref! -->

