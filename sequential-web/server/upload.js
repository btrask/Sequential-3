/* Copyright (c) 2012, Ben Trask
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY BEN TRASK ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL BEN TRASK BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
var pathModule = require("path");
var proc = require("child_process");
var zlib = require("zlib");
var urlModule = require("url");
var crypto = require("crypto");
var http = require("http");

var formidable = require("formidable");
var AwsSign = require("aws-sign");

var has = require("../../node-shared/has");
var fs = require("../../node-shared/fsx");
var http = require("../../node-shared/httpx");
var mime = require("../../node-shared/mime.json");

var config = require("./config.json");
var secret = require("../secret.json");
var signer = new AwsSign(secret.aws);

var TMP = (
	process.env.TMP ||
	process.env.TMPDIR ||
	process.env.TEMP ||
	"/tmp" ||
	process.cwd()
).replace(/^(.*)\/$/, "$1");
console.log(TMP);

var IMAGE_EXTS = {
	".jpeg": true,
	".jpg": true,
	".png": true,
	".gif": true,
};
var ARCHIVE_EXTS = {
	".zip": true,
	".rar": true,
	".cbz": true,
	".cbr": true,
	".7z": true,
	".gz": true,
	".tar": true,
};
function isImageExt(ext) {
	return has(IMAGE_EXTS, ext);
}
function isArchiveExt(ext) {
	return has(ARCHIVE_EXTS, ext);
}

function randomString(length, charset) {
	var chars = [], i;
	charset = charset || "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
	for(i = 0; i < length; ++i) chars.push(charset[Math.floor(Math.random() * charset.length)]);
	return chars.join("");
}
function asyncLoop(func/* (next) */) { // TODO: Put this somewhere too.
	var called, finished;
	function next() {
		called = true;
		if(finished) asyncLoop(func);
	}
	for(;;) {
		called = false;
		finished = false;
		func(next);
		finished = true;
		if(!called) break;
	}
}
function cleanHash(hash) {
	return hash.slice(0, 14).replace(/\+/g, "-").replace(/\//g, "_");
}
function timestamp(date) {
	return Math.floor(+date / 1000);
}

function treeInfo(path, time, callback/* (info) */) {
	fs.stat(path, function(err, stats) {
		function done(info) {
			if(!info) return callback(null);
			info.name = pathModule.basename(path);
			var ctime = timestamp(stats.ctime);
			var mtime = timestamp(stats.mtime);
			if(ctime < time) info.ctime = ctime;
			if(mtime < time) info.mtime = mtime;
			callback(info);
		}
		if(stats.isDirectory()) return dirInfo(path, time, done);
		if(!stats.size) return callback(null);
		var ext = pathModule.extname(path).toLowerCase();
		if(isImageExt(ext)) return imageInfo(path, time, done);
		if(isArchiveExt(ext)) return archiveInfo(path, time, done);
		callback(null);
	});
}
function dirInfo(path, time, callback/* (info) */) {
	var info = {};
	info.thumbURL = "//"+config.staticDomain+"/gallery/folder.png";
	info.items = [];
	fs.readdir(path, function(err, files) {
		if(err) return callback(null);
		var remaining = files.length;
		for(var i = 0; i < files.length; ++i) {
			treeInfo(path+"/"+files[i], time, function(subinfo) {
				if(subinfo) info.items.push(subinfo);
				if(--remaining) return;
				callback(info);
			});
		}
	});
}
function imageInfo(path, time, callback/* (info) */) {
	var info = {};
	info.items = [];
	fileHash(path, function(err, hash) {
		if(err) return callback(null);
		var ext = pathModule.extname(path).toLowerCase();
		var key = encodeURI("/"+hash+ext);
		info.imageURL = "//"+config.imageDomain+"/"+hash+ext;
		info.thumbURL = "//"+config.thumbDomain+"/"+hash+".jpg";
		fs.stat(path, function(err, stats) {
			var opts = {
				"host": config.imageDomain+".s3.amazonaws.com",
				"path": key,
				"method": "PUT",
				"headers": {
					"Content-Type": mime[ext] || "application/octet-stream",
					"Content-Length": stats.size,
					"x-amz-acl": "public-read",
				},
			};
			signer.sign(opts);
			var req = http.request(opts, function(res) {
				if(200 !== res.statusCode) return callback(null);
				callback(info);
			});
			req.on("error", function(err) {
				console.error(opts, err);
			});
			fs.createReadStream(path).pipe(req);
		});
	});
}
function archiveInfo(path, time, callback/* (info) */) {
	var hash = randomString(14);
	var dir = TMP+"/"+hash.slice(0, 2)+"/"+hash+"/";
	fs.mkdirRecursive(dir, function(err) {
		if(err) return callback();
		var decompressor = proc.spawn("7z", [
			"x",
			"-o"+dir,
			path
		]);
		decompressor.addListener("exit", function(code) {
			if(0 !== code && 1 !== code) return callback(null);
			treeInfo(dir, time, function(info) {
				fs.rmRecursive(dir);
				info.name = pathModule.basename(path);
				if(1 === info.items.length) info.items = info.items[0].items;
				callback(info);
			});
		});
	});
}
function filesInfo(files, time, callback/* (info) */) {
	var info = {}, remaining = files.length;
	info.items = [];
	files.forEach(function(file) {
		treeInfo(file.path, time, function(subinfo) {
			fs.unlink(file.path);
			if(subinfo) {
				var name = file.name.
					replace(/\//g, "").
					replace(/\.\./g, "");
				subinfo.name = name;
				info.items.push(subinfo);
			}
			if(--remaining) return;
			if(1 === info.items.length) info = info.items[0];
			else info.name = info.items.length+" items";
			callback(info);
		});
	});
}
function fileHash(path, callback/* (err, hash) */) {
	var sha1 = crypto.createHash("sha1");
	var stream = fs.createReadStream(path);
	sha1.update(secret.salt, "utf8");
	stream.on("data", function(chunk) {
		sha1.update(chunk);
	});
	stream.on("end", function() {
		callback(null, cleanHash(sha1.digest("base64")));
	});
	stream.on("error", function(err) {
		callback(err, null);
	});
}
function uploadInfo(info, callback/* (err, hash) */) {
	var data = new Buffer(JSON.stringify(info), "utf8");
	var sha1 = crypto.createHash("sha1");
	sha1.update(secret.salt, "utf8");
	sha1.update(data);
	var hash = cleanHash(sha1.digest("base64"));
	zlib.gzip(data, function(err, body) {
		if(err) return callback(err, null);
		var opts = {
			"host": config.dataDomain+".s3.amazonaws.com",
			"path": "/"+hash+".json",
			"method": "PUT",
			"headers": {
				"Content-Type": "text/json; charset=utf-8",
				"Content-Length": body.length,
				"Content-Encoding": "gzip",
				"x-amz-acl": "public-read",
			},
		};
		signer.sign(opts);
		var req = http.request(opts, function(res) {
			console.log("uploaded index", body.length, hash, res.statusCode);
			if(200 === res.statusCode) return callback(null, hash);
			callback(new Error("Index upload failed: "+res.statusCode), null);
		});
		req.on("error", function(err) {
			console.error(opts, err);
		});
		req.end(body);
	});
}

function upload(req, res) {
	function fail(err) {
		console.log((new Error(err)).stack);
		res.sendMessage(500, "Internal Server Error");
	}
	var time = timestamp(new Date);
	var form = new formidable.IncomingForm({
		"keepExtensions": true,
	});
	if(form.bytesExpected > config.maxSize) return res.sendMessage(413, "Request Entity Too Large");
	form.addListener("error", function(err) {
		fail(err);
	});
	form.parse(req, function(err, fields, fileByField) {
		if(err) return fail(err);
		var interval = setInterval(function() {
			res.write(" ", "utf8"); // Keep the connection alive.
		}, 1000 * 10);
		var files = [];
		fileByField.forEach(function(file) { files.push(file); });
		res.writeHead(200, {
			"Content-Type": "text/json; charset=utf-8",
		});
		filesInfo(files, time, function(info) {
			if(!info) {
				clearInterval(interval);
				return res.end();
			}
			uploadInfo(info, function(err, hash) {
				clearInterval(interval);
				if(err) {
					console.log(err);
					return res.end();
				}
				res.end(JSON.stringify({hash: hash}), "utf8");
			});
		});
	});
}

module.exports = upload;
