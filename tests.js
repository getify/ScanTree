"use script";

var childproc = require("child_process");

var DIR_CWD = process.cwd();

var tests = [
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
		assert: 'baz/f.js e.js foo/c.js foo/bar/d.js foo/b.js a.js baz/bam/g.js i.js baz/bam/h.js'
	}
];

tests.forEach(function eacher(test,idx){
	var res = childproc.execSync(test.command).toString().trim();

	if (test.assert !== res) {
		throw ("Test (" + (idx + 1) + ") failed:\n  " + res);
	}
	console.log("Test " + (idx + 1) + " passed");
});

console.log("Done.");
