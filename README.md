# ScanTree

Scan JS files to build dependency tree.

## Why

Unless you genuinely need the complex capability, using cumbersome and intrusive file formats and sophisticated dependency management loaders like AMD/RequireJS is unnecessary and perhaps undesirable.

If you just have a tree of JS files (not necessarily modules) that depend on other files for execution-order, all you *should need* is a simple list of what order to load/run these files. However, manually tracking that list is frustrating and error-prone.

Furthermore, requiring specific file formats to disclose dependencies is unnecessary. All you should really need to annotate a dependency is to include a comment in a JS file like this:

```js
// requires: foo/bar/d.js
```

## What

*ScanTree* will parse your JS file(s) for these annotations and build a dependency list with the proper ordering to satisfy all execution-order dependencies.

Also, some dependencies may be "parallel", in that they don't need to run in any particular order within a "group". *ScanTree* identifies these parallel groups, which can yield more optimized loading/execution if you use a [smart loader like LABjs](http://github.com/getify/LABjs).

**Note:** *ScanTree* does not handle circular dependencies. If you really need circular dependencies, use a more complex module dependency mechanism like AMD/RequireJS. But really, try to get away from circular dependencies -- they are usually unnecessary and thus not a good idea.

## Documentation

```
usage: scantree [--file|--dir]=path [opt ...]

options:
--help                    show this help

--file=file               scan a single file
--dir=directory           scan all files in a directory
--exclude=pattern         exclude any included paths that match pattern (JS regex)

--base-dir=directory      search relative dependency paths starting from this location
--output=[simple|json]    output simple linear list of null-separated values, or JSON
                          (default: json)

-R, --recursive           directory scan is recursive
                          (default: off)
-F, --full-paths          include full paths in all dependencies; otherwise strip
                          BASE-DIR from paths
                          (default: off)
-G, --groups              group parallel dependencies -- those which don't depend on
                          each other and can thus run in arbitrary order
                          (JSON only, default: on)
-N, --no-groups           don't group parallel dependencies
                          (JSON only)
```

You specify file(s) to scan by using one or more `--file` and/or `--dir` flags. If you use `--dir`, that directory's contents will be examined (non-recursively), and all found JS files will be scanned. Use `--recursive (-R)` to recursively examine sub-directories. To exclude any files/paths from this processing, use one or more `--exclude` flags, specifying a JS-style regular expression to match for exclusion (note: to avoid shell escaping issues, surround your regex in ' ' quotes).

All dependency annotations with relative filepaths will default to resolving against the current directory where the tool is being invoked. If you want to set a different base directory, use `--base-dir`. By default, all paths that are relative to the base directory (default or specified) will be output as relative (base directory trimmed). To output full filepaths instead, use `--full-paths (-F)`.

By default, the [output will be valid JSON](#json-output): an array of the files in the order they need to be executed to satisfy the dependencies. To suppress JSON and [output a null-separated list](#simple-output) of file paths (like `find .. --print0` suitable for `xargs -0`-style processing), use `--output=simple`.

By default, the JSON representation will [group "parallel" dependencies](#json-output) into sub-arrays, which indicates those files can run in any order within the group (groups must still run overall in the order specified).

To disable this grouping, use `--no-groups (-N)`. Grouping is also disabled with `--output=simple`.

## Installation

It's recommended that you install this tool globally with `npm`:

```
npm install -g scantree
```

If you instead pull the files from github, make sure to run `npm install` from inside the directory to install its dependencies, and then link the `bin/scantree` script to a suitable executable path for your system.

## Tests

To run the tests:

```
npm test
```

Or:

```
node tests.js
```

The test suite uses the `test/` directory, which has the following structure:

```
a.js
e.js
i.js
foo/
    b.js
    c.js
    bar/
        d.js
baz/
    f.js
    bam/
        g.js
        h.js
```

And in those 9 files, the dependency relationships annotated are:

```
a.js ->
    b.js
    c.js
    d.js
    e.js
c.js ->
    e.js
    f.js
d.js ->
    e.js
    c.js
h.js ->
    a.js
    i.js
    g.js
i.js ->
    a.js
```

**Note:** Look closely: the relationships here *are not circular*, on purpose.

## Examples

From the [test suite](#tests), here's some example commands and their outputs:

### JSON Output

```
scantree --dir=test/ --base-dir=test/ --recursive
[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]
```

And that JSON prettified to illustrate:

```js
[
  [
    "baz/f.js",
    "e.js"
  ],
  "foo/c.js",
  [
    "foo/bar/d.js",
    "foo/b.js"
  ],
  "a.js",
  [
    "baz/bam/g.js",
    "i.js"
  ],
  "baz/bam/h.js"
]
```

This example shows several "parallel" groups, like the one containing `baz/f.js` and `e.js`. That means the annotated dependency relationships imply that either of those two can run first, but both need to run before the next file `foo/c.js` runs, and so on.

### Simple Output

And to illustrate simple (non-JSON) output:

```
scantree --dir=test/ --base-dir=test/ --recursive --output=simple
baz/f.jse.jsfoo/c.jsfoo/bar/d.jsfoo/b.jsa.jsbaz/bam/g.jsi.jsbaz/bam/h.js
```

This output format is useful for `xargs`. For example, to concat all the files in their proper order (to generate a concatenated file), run:

```
scantree --dir=test/ --base-dir=test/ --recursive --output=simple | xargs -0 -I % echo test/% | xargs -L 1 cat
console.log("f");
console.log("e");
// require: e.js
// require: baz/f.js

console.log("c");
// require: e.js
// require: foo/c.js

console.log("d");
console.log("b");
// require: foo/b.js
// require: foo/c.js
// require: foo/bar/d.js
// require: e.js

console.log("a");
console.log("g");
// require: a.js

console.log("i");
// require: a.js
// require: i.js
// require: baz/bam/g.js

console.log("h");
```

**Note:** The `xargs -0 -I % echo test/%` command takes all the null-terminated paths from *ScanTree* and prints them out one-per-line with `test/` in front of them (`test/foo/b.js` instead of `foo/b.js`). The `xargs -L 1 cat` takes each line and passes it to `cat` to print out that file's contents.

## License

The code and all the documentation are all (c) 2015 Kyle Simpson and released under the MIT license.

http://getify.mit-license.org/
