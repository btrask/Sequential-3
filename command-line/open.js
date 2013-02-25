#!/usr/bin/env node
/* Copyright Ben Trask and other contributors. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE. */
var cp = require("child_process");
var http = require("http");
var crypto = require("crypto");
var pathModule = require("path");
var fs = require("../node-shared/fsx");
var sl = require("./sequential");

if(process.argv.length < 3) {
	console.log("Usage: add.js path");
	process.exit();
}

var path = pathModule.resolve(process.cwd(), process.argv[2]);
var stats = fs.statSync(path); // Intentionally throw exception on failure.

function openURL(url) {
	// TODO: Make this work cross-platform and in a more robust way.
	cp.exec("xdg-open \""+url+"\"", {
		detatch: true,
		stdio: ["ignore", "ignore", process.stderr]
	});
}

sl.persistentHashForPath(path, function(err, hash) {
	if(err) throw err;
	var url = "http://localhost:"+sl.PORT+"/id/"+hash;
	var req = http.get(url);
	req.on("response", function(res) {
		if(200 !== res.statusCode) return console.log("Error: "+res.statusCode);
		openURL(url);
		process.exit();
	});
	req.on("error", function(err) {
		var server = cp.spawn(__dirname+"/index.js", ["--notify-parent"], {
			detatch: true,
			stdio: ["ignore", "pipe", process.stderr],
		});
		server.stdout.setEncoding("utf8");
		server.stdout.on("data", function(chunk) {
			openURL(url);
			process.exit();
		});
	});
});
