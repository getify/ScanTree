# ScanTree

Scan JS files to build dependency tree.

## Why

Using cumbersome and intrusive file formats like AMD are undesirable if not necessary. If you simply have a tree of JS files that depend on each other for execution order, all you need is a list of what order to make sure these files load/run in. **ScanTree** does that.

Furthermore, all you should need to do to annotate a dependency is to include a comment in a JS file like this:

```js
// requires: foo/bar/d.js
```

**ScanTree** will parse your JS file(s) for these annotations and build a dependency list with the proper ordering to satisfy all dependencies.

Also, some dependencies may be "parallel", in that they don't need to run in any particular order within their "group". **ScanTree** can identify these groups, to give more optimized loading/execution.

## Documentation

// TODO

## License

The code and all the documentation are all (c) 2015 Kyle Simpson and released under the MIT license.

http://getify.mit-license.org/
