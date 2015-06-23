"use script";

var childproc = require("child_process"),
	scantree = require("./"),

	DIR_CWD = process.cwd(),
	test_idx = 0,

	cli_tests,
	lib_tests
;

cli_tests = [
	{
		command: "bin/scantree --file=test/a.js --base-dir=test/",
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js"]'
	},
	{
		command: "bin/scantree --file=test/a.js --file=test/baz/bam/h.js --base-dir=test/",
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]'
	},
	{
		command: "bin/scantree --dir=test/ --base-dir=test/",
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js","i.js"]'
	},
	{
		command: "bin/scantree --dir=test/ --dir=test/foo --dir=test/foo/bar --dir=test/baz --dir=test/baz/bam --base-dir=test/",
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]'
	},
	{
		command: "bin/scantree --dir=test/ --base-dir=test/ --recursive",
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]'
	},
	{
		command: "bin/scantree --dir=test/ --base-dir=test/ --recursive --exclude='d\.js' --exclude='[abc]\.js'",
		assert: '[["baz/bam/g.js","i.js"],["baz/bam/h.js","baz/f.js","e.js"]]'
	},
	{
		command: "bin/scantree --dir=test/ --base-dir=test/ --recursive --no-groups",
		assert: '["baz/f.js","e.js","foo/c.js","foo/bar/d.js","foo/b.js","a.js","baz/bam/g.js","i.js","baz/bam/h.js"]'
	},
	{
		command: "bin/scantree --dir=test/ --base-dir=test/ --recursive --full-paths",
		assert: '[["/tmp/test/baz/f.js","/tmp/test/e.js"],"/tmp/test/foo/c.js",["/tmp/test/foo/bar/d.js","/tmp/test/foo/b.js"],"/tmp/test/a.js",["/tmp/test/baz/bam/g.js","/tmp/test/i.js"],"/tmp/test/baz/bam/h.js"]'
			.replace(/"\/tmp/g,function(){
				return '"' + DIR_CWD;
			})
	},
	{
		command: "bin/scantree --dir=test/ --base-dir=test/ --recursive --output=simple",
		assert: ['baz/f.js','e.js','foo/c.js','foo/bar/d.js','foo/b.js','a.js','baz/bam/g.js','i.js','baz/bam/h.js']
			.join("\0") + "\0"
	}
];

lib_tests = [
	{
		opts: { files: "test/a.js", base_dir: "test/" },
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js"]'
	},
	{
		opts: { files: ["test/a.js", "test/baz/bam/h.js"], base_dir: "test/" },
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]'
	},
	{
		opts: { dirs: "test/", base_dir: "test/" },
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js","i.js"]'
	},
	{
		opts: { dirs: ["test/", "test/foo", "test/foo/bar", "test/baz", "test/baz/bam"], base_dir: "test/" },
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]'
	},
	{
		opts: { dirs: "test/", base_dir: "test/", recursive: true },
		assert: '[["baz/f.js","e.js"],"foo/c.js",["foo/bar/d.js","foo/b.js"],"a.js",["baz/bam/g.js","i.js"],"baz/bam/h.js"]'
	},
	{
		opts: { dirs: "test/", base_dir: "test/", recursive: true, excludes: ["d\\.js", "[abc]\\.js"] },
		assert: '[["baz/bam/g.js","i.js"],["baz/bam/h.js","baz/f.js","e.js"]]'
	},
	{
		opts: { dirs: "test/", base_dir: "test/", recursive: true, groups: false },
		assert: '["baz/f.js","e.js","foo/c.js","foo/bar/d.js","foo/b.js","a.js","baz/bam/g.js","i.js","baz/bam/h.js"]'
	},
	{
		opts: { dirs: "test/", base_dir: "test/", recursive: true, full_paths: true },
		assert: '[["/tmp/test/baz/f.js","/tmp/test/e.js"],"/tmp/test/foo/c.js",["/tmp/test/foo/bar/d.js","/tmp/test/foo/b.js"],"/tmp/test/a.js",["/tmp/test/baz/bam/g.js","/tmp/test/i.js"],"/tmp/test/baz/bam/h.js"]'
			.replace(/"\/tmp/g,function(){
				return '"' + DIR_CWD;
			})
	},
	{
		opts: { dirs: "test/", base_dir: "test/", recursive: true, output: "simple" },
		assert: ['baz/f.js','e.js','foo/c.js','foo/bar/d.js','foo/b.js','a.js','baz/bam/g.js','i.js','baz/bam/h.js']
			.join("\0") + "\0"
	}
];

cli_tests.forEach(function eacher(test){
	test_idx++;

	var res = childproc.execSync(test.command).toString().trim();

	if (test.assert !== res) {
		throw ("Test (" + test_idx + ") failed:\n  " + res);
	}
	console.log("Test " + test_idx + " passed");
});

lib_tests.forEach(function eacher(test){
	test_idx++;

	var res = scantree.scan(test.opts).trim();

	if (test.assert !== res) {
		throw ("Test (" + test_idx + ") failed:\n  " + res);
	}
	console.log("Test " + test_idx + " passed");
});

console.log("Done.");
