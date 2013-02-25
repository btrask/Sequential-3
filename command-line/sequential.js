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
var fs = require("fs");
var crypto = require("crypto");
var pathModule = require("path");

var config = require("./config.json");
var APP_SUPPORT_MAC = expandPath("~/Library/Application Support");

function expandPath(p) { return p.replace(/^~/, process.env.HOME || "/home"); }

var sl = exports;
sl.DATA =
	(config.data && expandPath(config.data)) ||
	(fs.existsSync(APP_SUPPORT_MAC) && APP_SUPPORT_MAC+"/Sequential 3") ||
	__dirname+"/data";
sl.FILES = sl.DATA+"/Files";
sl.THUMBNAILS = sl.DATA+"/Thumbnails";
sl.ICONS = sl.DATA+"/Icons";

var SALT = config.salt || "";

function fileDataPath(hash) {
	return sl.FILES+"/"+hash.slice(0, 2).toLowerCase()+"/"+hash+".seq-path";
}

sl.pathForHash = function(hash, callback/* (err, path) */) {
	if(!hash) return callback(new Error("Invalid hash"), null);
	fs.readFile(fileDataPath(hash), "utf8", function(err, path) {
		if(err) return callback(err, null);
		callback(null, path);
	});
};
sl.hashForPath = function(path) {
	var sha1 = crypto.createHash("sha1");
	sha1.update(SALT, "utf8");
	sha1.update(path, "utf8");
	return sha1.digest("base64").slice(0, 14).replace(/\+/g, "-").replace(/\//g, "_");
};
sl.persistentHashForPath = function(path, callback/* (err, hash) */) {
	var hash = sl.hashForPath(path);
	var dataPath = fileDataPath(hash);
	fs.mkdirRecursive(pathModule.dirname(dataPath), function(err) {
		if(err) return callback(err, null);
		fs.writeFile(dataPath, path, "utf8", function(err) {
			if(err) return callback(err, null);
			callback(null, hash);
		});
	});
};
