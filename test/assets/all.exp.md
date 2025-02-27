<!-- !numberedheadings -->

# 1\. Test

## 1.1\. Table of Contents

<!-- !toc -->

* [1\. Test](#1-test)
  * [1.1\. Table of Contents](#11-table-of-contents)
  * [1.2\. Mod📦ules](#12-mod%F0%9F%93%A6ules)
  * [1.3\. Chapter 1](#13-chapter-1)
  * [1.4\. Chapter 2](#14-chapter-2)
  * [1.5\. Include in folder second](#15-include-in-folder-second)
  * [1.6\. Include in folder third](#16-include-in-folder-third)
    * [1.6.1\. second](#161-second)
  * [1.7\. Include in folder third](#17-include-in-folder-third)
    * [1.7.1\. second](#171-second)
* [2\. References](#2-references)

<!-- toc! -->

## 1.2\. Mod📦ules

Some 📦📦📦.

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

## 1.4\. Chapter 2

<!-- include (include2.md indent=4) -->
    Try to recursively load "include2.md".
    
    !include (include2.md)
<!-- /include -->

[amnesty]: http://www.amnesty.org/ "Amnesty International Homepage"

<!-- include (second/include.md) -->
## 1.5\. Include in folder second

Located in folder "second"

## 1.6\. Include in folder third

Test third...

### 1.6.1\. second

... second ...

And again

## 1.7\. Include in folder third

Test third...

### 1.7.1\. second

... second ...
<!-- /include -->

# 2\. References

<!-- !ref -->

* [Amnesty International Homepage][amnesty]
* [markedpp][markedpp]

<!-- ref! -->

