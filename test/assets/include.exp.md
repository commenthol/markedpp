# Include

Include file from same directory

<!-- include (include1.md) -->
# Lorem

## Lorem ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

### Donec a diam

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor.

### Donec et mollis

Aenean ut gravida lorem.

## Gravida lorem

Nam tincidunt congue enim, ut porta lorem lacinia consectetur. Donec ut libero sed arcu vehicula ultricies a non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean ut gravida lorem.

#### Mauris vitae nisi at

In rutrum accumsan ultricies. Mauris vitae nisi at sem facilisis semper ac in est.
<!-- /include -->

# Include recursively

<!-- include (include2.md) -->
Try to recursively load "include2.md".

!include (include2.md)
<!-- /include -->

# Include a source file

Put the file in GFM Fences

<!-- include (test\ with\ spaces.js lang=javascript) -->
```javascript
"use strict";

(function(){
  var str = "this is a string";
  console.log(str);
})();
```
<!-- /include -->

## Include with indent

<!-- include (test.js indent=4) -->
    "use strict";
    
    (function(){
      var str = "this is a string";
      console.log(str);
    })();
<!-- /include -->

### Include with indents on indents

* Level 1 Indent
  <!-- include (indent.md) -->
  * Level 2 Indent
    * Level 3 Indent
      * Level 4 Indent
  <!-- /include -->

# Include a not existing file

!include (doesnotexist.md)

# Include from a differerent folder

<!-- include (second/include.md) -->
## Include in folder second

Located in folder "second"

## Include in folder third

Test third...

### second

... second ...

And again

## Include in folder third

Test third...

### second

... second ...
<!-- /include -->

## Ignore within GFM fences

```text
!include(ignore.md)

# heading
```

# Include a portion of a file

<!-- include (include1.md start=3 end=9) -->
## Lorem ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

### Donec a diam

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor.
<!-- /include -->

## Include a portion of a file with a link

<!-- include (include1.md start=3 end=9) -->
## Lorem ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

### Donec a diam

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor.
<!-- /include -->
[Click to Open](include1.md)
