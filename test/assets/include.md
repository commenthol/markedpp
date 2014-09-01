# Include

Include file from same directory

!INCLUDE (include1.md)

# Include recursively

!INCLUDE (include2.md)

# Include a source file

Put the file in GFM Fences

```javascript
!INCLUDE (test.js)
```

## Include with indent

    !INCLUDE (test.js)

### Include with indents on indents

* Level 1 Indent
  !INCLUDE (indent.md)

# Include a not existing file

!INCLUDE (doesnotexist.md)

# Include from a differerent folder

!INCLUDE (second/include.md)
