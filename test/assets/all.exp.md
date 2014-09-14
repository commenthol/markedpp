<!-- !numberedheadings -->

# 1\. Test

## 1.1\. Table of Contents

<!-- !toc -->

* [1\. Test](#1-test)
  * [1.1\. Table of Contents](#1-1-table-of-contents)
  * [1.2\. Chapter 1](#1-2-chapter-1)
  * [1.3\. Chapter 2](#1-3-chapter-2)
  * [1.4\. Include in folder second](#1-4-include-in-folder-second)
  * [1.5\. Include in folder third](#1-5-include-in-folder-third)
    * [1.5.1\. second](#1-5-1-second)
  * [1.6\. Include in folder third](#1-6-include-in-folder-third)
    * [1.6.1\. second](#1-6-1-second)
* [2\. References](#2-references)

<!-- toc! -->

## 1.2\. Chapter 1

```javascript
"use strict";

(function(){
  var str = "this is a string";
  console.log(str);
})();
```

[markedpp]: https://github.com/commenthol/markedpp

## 1.3\. Chapter 2

    Try to recursively load "include2.md".
    
    !include (include2.md)
    
[amnesty]: http://www.amnesty.org/ "Amnesty International Homepage"

## 1.4\. Include in folder second

Located in folder "second"

## 1.5\. Include in folder third

Test third...

### 1.5.1\. second

... second ...

And again

## 1.6\. Include in folder third

Test third...

### 1.6.1\. second

... second ...

# 2\. References

<!-- !ref -->

* [Amnesty International Homepage][amnesty]
* [markedpp][markedpp]

<!-- ref! -->
