# Include

Include file from same directory

!include (include1.md)

# Include recursively

!include (include2.md)

# Include a source file

Put the file in GFM Fences

!include (test\ with\ spaces.js lang=javascript)

## Include with indent

    !include (test.js)

### Include with indents on indents

* Level 1 Indent
  !include (indent.md)

# Include a not existing file

!include (doesnotexist.md)

# Include from a differerent folder

!include (second/include.md)

## Ignore within GFM fences

```text
!include(ignore.md)

# heading
```

# Include a portion of a file

!include (include1.md start=3 end=9) 

## Include a portion of a file with a link

!include (include1.md start=3 end=9 link="Click to Open") 