"use strict";

// Minified from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
Object.assign||Object.defineProperty(Object,"assign",{enumerable:!1,configurable:!0,writable:!0,value:function(a){"use strict";if(void 0===a||null===a)throw new TypeError("Cannot convert first argument to object");for(var c=Object(a),d=1;d<arguments.length;d++){var e=arguments[d];if(void 0!==e&&null!==e){e=Object(e);for(var f=Object.keys(Object(e)),g=0,h=f.length;h>g;g++){var i=f[g],j=Object.getOwnPropertyDescriptor(e,i);void 0!==j&&j.enumerable&&(c[i]=e[i])}}}return c}});

var fs = require("fs"),
	os = require("os"),
	path = require("path"),
	acorn = require("acorn"),

	parse_options = {
		ecmaVersion: 6,
		onComment: handleComment
	},

	files = [],
	dependencies = [],
	current_dependency,

	OPTS,

	DIR_BASE,
	DIR_HOME = (
		os.homedir ?
			os.homedir() :
			process.env[(process.platform == "win32") ? "USERPROFILE" : "HOME"]
	)
;

// module exports
exports.scan = scan;

// ***********************************

function fileExists(filepath) {
	try {
		if (fs.existsSync(filepath)) {
			return true;
		}
	}
	catch (err) { }
	return false;
}

function isURL(filepath) {
	return /^(https?:)?\/\//.test(filepath);
}

// from: https://github.com/azer/expand-home-dir
function expandHomeDir(fpath) {
	if (!fpath) return fpath;
	if (fpath == '~') return DIR_HOME;
	if (fpath.slice(0, 2) != '~/') return fpath;
	return path.join(DIR_HOME,fpath.slice(2));
}

function fixPath(pathStr) {
	if (!(
		isURL(pathStr) ||
		path.isAbsolute(pathStr)
	)) {
		if (/^~/.test(pathStr)) {
			pathStr = pathStr.replace(/^~/,function replacer(){
				return expandHomeDir("~");
			});
		}
		else if (!(new RegExp("^[" + path.sep + "]")).test(pathStr)) {
			pathStr = path.join(DIR_BASE,pathStr);
		}
	}
	return pathStr;
}

function scanFile(filepath) {
	var contents, tokenizer, token;

	// skip non-existent or non-file path
	try {
		if (
			!isURL(filepath) &&
			fs.existsSync(filepath)
		) {
			var stat = fs.statSync(filepath);
			if (!stat.isFile()) return;
		}
		else return;
	}
	catch (err) { return; }

	// find or construct dependency entry
	if (!(current_dependency = findDependencyEntry(filepath))) {
		current_dependency = { src: filepath, children: [] };
		dependencies.push(current_dependency);
	}

	// skip already scanned file
	if (current_dependency.scanned) return;

	// only scan each dependency once
	current_dependency.scanned = true;

	// read file contents
	contents = fs.readFileSync(filepath,{ encoding: "utf8" });

	try {
		// prepare tokenizer for file
		tokenizer = acorn.tokenizer(contents,parse_options);
	}
	catch (err) {
		if (!OPTS.ignore.invalid) {
			throw new Error("Invalid: " + filepath);
		}
	}

	// consume all tokens so comments are extracted
	do {
		try {
			token = tokenizer.getToken();
		}
		catch (err) {
			if (!OPTS.ignore.invalid) {
				throw new Error("Invalid: " + filepath);
			}
		}
	} while (token && token.type != acorn.tokTypes.eof);

	// scan all discovered dependency files
	current_dependency.children
		.map(function mapper(dep){ return dep.src; })
		.forEach(scanFile);
}

function isFileExcluded(filepath) {
	if (OPTS.excludes.length > 0) {
		return OPTS.excludes.some(function somer(exclude){
				return (new RegExp(exclude)).test(filepath);
			});
	}
	return false;
}

function findDependencyEntry(filepath) {
	return dependencies.filter(function filterer(dep){
		return filepath == dep.src;
	})[0];
}

function handleComment(_,text) {
	var re = /^\s*require[ds]?(?:\s*:)?\s*(.*)(?:$|[\r\n])/igm,
		res, entry, filepath;

	// find all dependency annotation comments
	while (res = re.exec(text)) {
		filepath = fixPath(res[1]);

		if (!isFileExcluded(filepath)) {
			if (isURL(filepath) ||
				fileExists(filepath)
			) {
				// find or construct dependency entry
				if (!(entry = findDependencyEntry(filepath))) {
					entry = { src: filepath, children: [] };
					dependencies.push(entry);
				}

				// link dependency relationship
				current_dependency.children.push(entry);
			}
			else if (!OPTS.ignore.missing) {
				throw new Error("Not found: " + filepath);
			}
		}
	}
}

function walkTree(tree) {
	var nodes = [];

	// depth-first graph nodes traversal
	tree.forEach(function visit(node) {
		// adapted from: http://en.wikipedia.org/wiki/Topological_sorting#Algorithms
		if (node.marked) {
			throw new Error("Circular dependency not supported: " + node.src);
		}
		if (!node.visited) {
			node.marked = true;
			if (node.children) {
				node.children.forEach(function eacher(n){
					n.parents = n.parents || [];
					n.parents.push(node);
					visit(n);
				});
			}
			node.visited = true;
			delete node.marked;
			delete node.children;
			nodes.unshift(node);
		}
	});

	// calculate depths
	nodes.forEach(function eacher(node){
		node.depth = 0;
		delete node.visited;
		if (node.parents) {
			node.parents.forEach(function eacher(n){
				node.depth = Math.max(n.depth + 1,node.depth);
			});
			delete node.parents;
		}

		// no full paths, so resolve against base-dir
		if (!OPTS.full_paths &&
			node.src.indexOf(DIR_BASE) === 0
		) {
			node.src = node.src.substr(DIR_BASE.length);
		}
	});

	// sort by depth
	nodes.sort(function sorter(a,b){
		return b.depth - a.depth;
	});

	// group parallel dependencies (by depth)?
	if (OPTS.groups && OPTS.output !== "simple") {
		if (nodes.length > 1) {
			nodes = nodes.slice(1).reduce(function reducer(nodes,node){
				var prev = nodes[nodes.length-1];
				if (Array.isArray(prev) && prev[0].depth === node.depth) {
					prev.push(node);
				}
				else if (prev.depth === node.depth) {
					nodes[nodes.length-1] = [prev,node];
				}
				else {
					nodes.push(node);
				}

				return nodes;
			},[nodes[0]]);
		}
	}

	return nodes;
}

function validateOptions() {
	if (!(
			OPTS.files != null ||
			OPTS.dirs != null
	)) {
		throw new Error("Missing required option: 'files' or 'dirs'");
	}
	else if (
		OPTS.files != null &&
		(
			OPTS.files === "" ||
			(
				typeof OPTS.files != "string" &&
				!Array.isArray(OPTS.files)
			) ||
			(
				Array.isArray(OPTS.files) &&
				~OPTS.files.indexOf("")
			)
		)
	) {
		throw new Error("'files' option must specify a single non-empty value, or an array of non-empty values");
	}
	else if (
		OPTS.dirs != null &&
		(
			OPTS.dirs === "" ||
			(
				typeof OPTS.dirs != "string" &&
				!Array.isArray(OPTS.dirs)
			) ||
			(
				Array.isArray(OPTS.dirs) &&
				~OPTS.dirs.indexOf("")
			)
		)
	) {
		throw new Error("'dirs' option must specify a single non-empty value, or an array of non-empty values");
	}
	else if (
		OPTS.excludes != null &&
		(
			OPTS.excludes === "" ||
			(
				typeof OPTS.excludes != "string" &&
				!Array.isArray(OPTS.excludes)
			) ||
			(
				Array.isArray(OPTS.excludes) &&
				~OPTS.excludes.indexOf("")
			)
		)
	) {
		throw new Error("'excludes' option must specify a single non-empty value, or an array of non-empty values");
	}
	else if (
		OPTS.base_dir != null &&
		(
			OPTS.base_dir === "" ||
			typeof OPTS.base_dir != "string"
		)
	) {
		throw new Error("'base_dir' option must specify a non-empty value");
	}
	else if (
		OPTS.recursive != null &&
		typeof OPTS.recursive != "boolean"
	) {
		throw new Error("'recursive' option must be true/false");
	}
	else if (
		OPTS.full_paths != null &&
		typeof OPTS.full_paths != "boolean"
	) {
		throw new Error("'full_paths' option must be true/false");
	}
	else if (
		OPTS.output != null &&
		!(
			OPTS.output === "simple" ||
			OPTS.output === "json"
		)
	) {
		throw new Error("'output' option must be either 'simple' or 'json'");
	}
	else if (
		OPTS.groups != null &&
		typeof OPTS.groups != "boolean"
	) {
		throw new Error("'groups' option must be true/false");
	}
	else if (
		OPTS.ignore != null &&
		(
			typeof OPTS.ignore != "object" ||
			!(
				"missing" in OPTS.ignore ||
				"invalid" in OPTS.ignore
			)
		)
	) {
		throw new Error("'ignore' option must be be an object with 'missing' or 'invalid' specified");
	}
	else if (
		OPTS.ignore.missing != null &&
		typeof OPTS.ignore.missing != "boolean"
	) {
		throw new Error("'ignore.missing' option must be true/false");
	}
	else if (
		OPTS.ignore.missing != null &&
		typeof OPTS.ignore.missing != "boolean"
	) {
		throw new Error("'ignore.missing' option must be true/false");
	}
}

function processOptions() {
	// normalize `OPTS.ignore`
	if (OPTS.ignore == null || OPTS.ignore === false) {
		OPTS.ignore = { missing: false, invalid: false };
	}
	else if (OPTS.ignore === true) {
		OPTS.ignore = { missing: true, invalid: true };
	}

	// verify CLI usage
	validateOptions();

	// normalize options
	if (!OPTS.excludes) {
		OPTS.excludes = [];
	}
	else if (!Array.isArray(OPTS.excludes)) {
		OPTS.excludes = [OPTS.excludes];
	}
	if (OPTS.files && !Array.isArray(OPTS.files)) {
		OPTS.files = [OPTS.files];
	}
	if (OPTS.dirs && !Array.isArray(OPTS.dirs)) {
		OPTS.dirs = [OPTS.dirs];
	}

	// default 'groups' to `true`
	if (!("groups" in OPTS)) {
		OPTS.groups = true;
	}

	// include manually specified files
	if (OPTS.files) {
		files = files.concat(
			OPTS.files
				.map(fixPath)
				.filter(function filterer(filepath){
					try {
						if (!isFileExcluded(filepath)) {
							if (isURL(filepath)) {
								// ensure manually specified URLs get a dependency entry
								if (!findDependencyEntry(filepath)) {
									dependencies.push({ src: filepath, children: [] });
								}
								return true;
							}
							else if (fileExists(filepath)) {
								var stat = fs.statSync(filepath);
								if (stat.isDirectory()) {
									OPTS.dirs = OPTS.dirs || [];
									OPTS.dirs.push(filepath);
									return false;
								}
								return true;
							}
						}
						else return false;
					}
					catch (err) { }

					if (!OPTS.ignore.missing) {
						throw new Error("Not found: " + filepath);
					}

					return false;
				})
		);
	}

	// include files from any specified directories
	if (OPTS.dirs) {
		OPTS.dirs
			.map(fixPath)
			.forEach(function processDirectory(dir){
				var dirs = [];
				try {
					files = files.concat(
						fs.readdirSync(dir)
							.map(function mapper(file){
								return path.join(dir,file);
							})
							.filter(function filterer(filepath){
								try {
									if (!isFileExcluded(filepath)) {
										if (isURL(filepath)) {
											return true;
										}
										else if (fileExists(filepath)) {
											var stat = fs.statSync(filepath);
											if (stat.isDirectory()) {
												dirs.push(filepath);
												return false;
											}
											return true;
										}
									}
									else return false;
								}
								catch (err) { }

								if (!OPTS.ignore.missing) {
									throw new Error("Not found: " + filepath);
								}

								return false;
							})
					);

					// recurse into any sub-directories found
					if (OPTS.recursive) {
						dirs.forEach(processDirectory);
					}
				}
				catch (err) {
					if (!OPTS.ignore.missing) {
						if (/^Not found:/.test(err.message)) {
							throw err;
						}
						else {
							throw new Error("Not found: " + dir);
						}
					}
				}
			});
	}

	// set dir for resolving relative paths
	if (OPTS.base_dir) {
		DIR_BASE = fixPath(OPTS.base_dir);
	}

	// normalize DIR_BASE
	if (!/\/$/.test(DIR_BASE)) DIR_BASE += "/";
}

function scan(opts) {
	var dep_list, output = "";

	// (re)initialize all global state
	files.length = 0;
	dependencies.length = 0;
	current_dependency = undefined;
	DIR_BASE = process.cwd();

	// make a copy of specified options
	OPTS = Object.assign({},opts);

	processOptions();

	// scan all files to populate dependencies
	files.forEach(scanFile);

	// walk dependency tree for ordering
	dep_list = walkTree(dependencies);

	// handle output options
	if (OPTS.output === "simple") {
		dep_list.forEach(function eacher(item){
			if (Array.isArray(item)) item.forEach(eacher);
			else output += item.src.replace(/(\s)/g,"\\$1") + "\0";
		});
	}
	else {
		output = JSON.stringify(dep_list,function replacer(key,value){
			if (typeof value == "object") {
				if (Array.isArray(value)) return value;
				return value.src;
			}
			else if (key === "src") return value;
		});
		output += "\n";
	}

	return output;
}
