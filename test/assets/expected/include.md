# Include

Include file from same directory

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

# Include recursively

Try to recursively load "include1.md".

!include (include1.md)

# Include a source file

Put the file in GFM Fences

```javascript
"use strict";

(function(){
  var str = "this is a string";
  console.log(str);
})();
```

## Include with indent

    "use strict";
    
    (function(){
      var str = "this is a string";
      console.log(str);
    })();

### Include with indents on indents

* Level 1 Indent
  * Level 2 Indent
    * Level 3 Indent
      * Level 4 Indent

# Include a not existing file

!include (doesnotexist.md)

# Include from a differerent folder

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

## Ignore within GFM fences

```text
!include(ignore.md)

# heading
```
