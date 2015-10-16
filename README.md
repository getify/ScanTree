# ScanTree

Scan a JS file tree to build an ordered and grouped dependency listing.

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

*ScanTree* can either be used as a [CLI tool](#cli) or as a [node module](#node-module).

### Dependency Annotations

Dependency annotations should be a regular JS-style comment, and should appear alone on their own line. The signifier must be `require`, `required`, or `requires`, and can optionally have a `:` before listing the path (everything else to the end of the line, not including the terminating character).

All of these are valid examples of dependency annotations the scanner will identify:

```js
// require foo/bar/d.js
// require: foo/bar/d.js
// requires: foo/bar/d.js
// required: foo/bar/d.js

/*
  some comment text

  requires: foo/bar/d.js
  requires: a.js

  more comment text

  requires: i.js
*/
```

Dependency annotations can appear anywhere in valid JS syntax, but it's recommended for clarity that they appear at or near the top of the JS file.

**Note:** HTTP/S URLs (or `//domain.tld` protocol-relative URLs) *can* be annotated as dependencies, but they are not fetched/scanned for their own dependencies; they're just added to the dependency tree.

#### TypeScript Annotations

*ScanTree* also supports TypeScript-style reference annotations:

```js
/// <reference path="baz/f.js"/>
```

**Warning:** As explained in the next section, *ScanTree* has certain expectations about relative paths that may or may not fit with how TypeScript reference annotations' relative paths are interpreted.

#### Relative Paths

If you use a relative path in a dependency annotation, it is *not* considered relative to that file's location, but rather relative to the *base directory* of the scan.

By default the *base directory* is the current working directory you invoke the [CLI tool](#cli) or the [scantree lib](#node-module). You can override this default *base directory* with the `--base-dir` CLI flag or the `base_dir` lib option.

For example, consider this directory structure :

```
/tmp/hello/
  a.js
  foo/
    b.js
    c.js
    bar/
      d.js
```

If the *base directory* is set to `/tmp/hello/` and `d.js` needs to depend on `c.js`, the annotation in `d.js` should be:

```js
// BEST:
// requires: foo/c.js

// OR:
// requires: /tmp/hello/foo/c.js

// NOT:
// requires: ../c.js
```

It's strongly recommended you use *base directory*-relative paths instead of absolute file paths. If you plan to use the individual file paths in URLs for client-side loading, absolute file paths won't be appropriate. If you want to use full file paths server-side, you can simply turn on the *full_paths* option (aka `--full-paths`).

Keeping your annotations relative instead of absolute generally makes for cleaner dependency management as your project grows and changes.

The reason all relative dependency paths are relative to the *base directory* instead of each other is to prevent having to update all your relative paths in a file if you need to move that file to a different location in the tree (of course, any annotations referencing *that* file will need to be updated!).

### CLI

```
usage: scantree [--file|--dir]=path [opt ...]

Options:
--help                      show this help

--file=file                 scan a single file
--dir=directory             scan all files in a directory
--exclude=pattern           exclude any included paths that match pattern (JS regex)

--base-dir=directory        search relative dependency paths starting from this location
--output=[simple|json]      output simple linear list of null-separated values, or JSON
                            (default: json)

-R, --recursive             directory scan is recursive
                            (default: off)
-F, --full-paths            include full paths in all dependencies; otherwise strip
                            BASE-DIR from paths
                            (default: off)
-S, --force-slash-separator force output to use slash as file path separator; otherwise \n",
                            it will keep the default platform separator\n",
                            (default: off)\n",
-G, --groups                group parallel dependencies -- those which don't depend on
                            each other and can thus run in arbitrary order
                            (JSON only, default: on)
-N, --no-groups             don't group parallel dependencies
                            (JSON only)
-M, --ignore-missing        ignore missing dependency files
-I, --ignore-invalid        ignore JS parsing issues
```

You specify file(s) to scan by using one or more `--file` and/or `--dir` flags.

**Note:** HTTP/S URLs (or `//domain.tld` protocol-relative URLs) *can* be added to the dependency tree via `--file`, but are not fetched/scanned for their own dependencies.

If you use `--dir`, that directory's contents will be examined (non-recursively), and all found JS files will be scanned. Use `--recursive (-R)` to recursively examine sub-directories. To exclude any files/paths from this processing, use one or more `--exclude` flags, specifying a JS-style regular expression to match for exclusion (note: to avoid shell escaping issues, surround your regex in ' ' quotes).

All dependency annotations with relative filepaths will default to resolving against the current directory where the tool is being invoked. If you want to set a different base directory, use `--base-dir`. By default, all paths that are relative to the base directory (default or specified) will be output as relative (base directory trimmed). To output full filepaths instead, use `--full-paths (-F)`.

The separator used by scantree in the paths is based on the platform separator. Typically on windows the separator will be backslash (\\). If you want to force the output to use an slash instead (/), you can use `--force-slash-separator (-S)`. That option is a noop if the slash is already the separator (i.e. on linux).

By default, the [output will be valid JSON](#json-output): an array of the files in the order they need to be executed to satisfy the dependencies. To suppress JSON and [output a null-separated list](#simple-output) of file paths (like `find .. --print0` suitable for `xargs -0`-style processing), use `--output=simple`.

By default, the JSON representation will [group "parallel" dependencies](#json-output) into sub-arrays, which indicates those files can run in any order within the group (groups must still run overall in the order specified).

To disable this grouping, use `--no-groups (-N)`. Grouping is also disabled with `--output=simple`.

Suppress errors for missing dependency files with `--ignore-missing` and for invalid files (failure to parse the JS) with `--ignore-invalid`.

**Tip:** You can turn on `--ignore-invalid` to let *ScanTree* try to find dependency annotation(s) at the top of a file that's not otherwise valid JS, like a CSS file.

### Node Module

To use this tool from JS:

```js
var scantree = require("scantree"),
    output = scantree.scan({ ..options.. });
```

The `options` correspond similarly to the [CLI parameters](#cli) described above:

* `files` (`string`, `array`): specifies file(s) to scan
* `dirs` (`string`, `array`): specifies director(ies) of file(s) to scan
* `excludes` (`string`, `array`): specifies exclusion pattern(s)
* `base_dir` (`string`): specifies the base directory for relative dependency paths
* `output` (`string`: `"simple"`, `"json"`): specifies the output format
* `recursive` (`boolean`, default: `false`): make directory scans recursive
* `full_paths` (`boolean`, default: `false`): include full paths for dependencies
* `force_slash_separator` (`boolean`, default: `false`): force output to use slash separator
* `groups` (`boolean`, default: `true`): group "parallel" dependencies in JSON output
* `ignore` (`object`, `boolean`): if `true`/`false`, will set all sub-properties accordingly; otherwise, should be an object with one or more of these:
  - `ignore.missing` (`boolean`): ignore files or directories not found
  - `ignore.invalid` (`boolean`): ignore files where the scan fails

**Note:** `files`, `dirs`, and `excludes` are all plurally named as options, but singularly named as [CLI parameters](#cli).

## Installation

To use the CLI, it's recommended that you install this tool globally with `npm`:

```
npm install -g scantree
```

To use the library from JS, install as a normal package via `npm`:

```
npm install scantree
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

The test suite uses the `test/` directory, which has the following contents and structure:

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
    http://some.url/j.js
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

From the CLI:

```
scantree --dir=test/ --base-dir=test/ --recursive
[["http://some.url/j.js","baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]
```

And prettifying that JSON to illustrate the structure:

```js
[
  [
    "http://some.url/j.js",
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

The lib usage equivalent of the above CLI command is:

```js
var scantree = require("scantree"),
    output = scantree.scan({
        dirs: "test/",
        base_dir: "test/",
        recursive: true
    });

console.log(output);
// [["http://some.url/j.js","baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]
```

**Note:** This default `"json"` output format is a string of JSON content. If you want the actual `array` structure, you'll need to pass `output` to `JSON.parse(..)` -- see below.

### Simple Output

And to illustrate simple (non-JSON) output:

```
scantree --dir=test/ --base-dir=test/ --recursive --output=simple
http://some.url/j.jsbaz/f.jse.jsfoo/c.jsfoo/bar/d.jsfoo/b.jsa.jsbaz/bam/g.jsi.jsbaz/bam/h.js
```

This output format is specifically useful for piping to `xargs` on the command line. For example, to concat all the files in their proper order (to generate a single concatenated file), run:

```
scantree --dir=test/ --base-dir=test/ --recursive --output=simple | xargs -0 -I % echo test/% | xargs -L 1 cat 2>/dev/null

console.log("f");
console.log("e");
// require: e.js

// TypeScript-style annotation:
/// <reference path="baz/f.js"/>

// require: http://some.url/j.js

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

**Note:** The `xargs -0 -I % echo test/%` command takes all the null-terminated paths from *ScanTree* and prints them out one-per-line with `test/` in front of them (`test/foo/b.js` instead of `foo/b.js`). The `xargs -L 1 cat 2>/dev/null` takes each line and passes it to `cat` to print out that file's contents (ignoring files that can't be read, like remote URLs).

The lib usage equivalent of the above CLI command is:

```js
var scantree = require("scantree"),
    output = scantree.scan({
        dirs: "test/",
        base_dir: "test/",
        recursive: true,
        output: "simple"
    });

console.log( output.split("\0").slice(0,-1) );
// [ 'http://some.url/j.js'
//   'baz/f.js',
//   'e.js',
//   'foo/c.js',
//   'foo/bar/d.js',
//   'foo/b.js',
//   'a.js',
//   'baz/bam/g.js',
//   'i.js',
//   'baz/bam/h.js' ]
```

**Note:** If you just print out the `output` value from the `"simple"` formatting, most JS engines will stop printing at the first `"\0"` value, which may likely cause confusion in your debugging. That's why the above snippet splits on the `"\0"` character and slices off the final resulting `''` element.

But an easier way to get that same result is:

```js
var scantree = require("scantree"),
    output = scantree.scan({
        dirs: "test/",
        base_dir: "test/",
        recursive: true,
        groups: false
    });

console.log( JSON.parse(output) );
// [ 'baz/f.js',
//   'e.js',
//   'foo/c.js',
//   'foo/bar/d.js',
//   'foo/b.js',
//   'a.js',
//   'baz/bam/g.js',
//   'i.js',
//   'baz/bam/h.js' ]
```

## License

The code and all the documentation are all (c) 2015 Kyle Simpson and released under the MIT license.

http://getify.mit-license.org/
