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
var https = require("https");

var formidable = require("formidable");
var AwsSign = require("aws-sign");

var bt = require("../../node-shared/bt");
var fs = require("../../node-shared/fs+");
var http = require("../../node-shared/http+");
var mime = require("../../node-shared/mime");

var config = require("./config");
var signer = new AwsSign(require("./secret"));

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
	return bt.hasOwnProperty(IMAGE_EXTS, ext);
}
function isArchiveExt(ext) {
	return bt.hasOwnProperty(ARCHIVE_EXTS, ext);
}

function randomString(length, charset) {
	var chars = [], i;
	charset = charset || "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
	for(i = 0; i < length; ++i) chars.push(charset[Math.floor(Math.random() * charset.length)]);
	return chars.join("");
};
function asyncLoop(func/* (next) */) { // TODO: Put this somewhere too.
	var called, finished;
	for(;;) {
		called = false;
		finished = false;
		func(function next() {
			called = true;
			if(finished) asyncLoop(func);
		});
		finished = true;
		if(!called) break;
	}
}
function cleanHash(hash) {
	return hash.slice(0, 14).replace(/\+/g, "-").replace(/\//g, "_");
}

function treeInfo(path, callback/* (info) */) {
	fs.stat(path, function(err, stats) {
		function done(info) {
			if(!info) return callback(null);
			info.name = pathModule.basename(path);
			info.ctime = stats.ctime;
			info.mtime = stats.mtime;
			callback(info);
		}
		if(stats.isDirectory()) return dirInfo(path, done);
		if(!stats.size) return callback(null);
		var ext = pathModule.extname(path).toLowerCase();
		if(isImageExt(ext)) return imageInfo(path, done);
		if(isArchiveExt(ext)) return archiveInfo(path, done);
		callback(null);
	});
}
function dirInfo(path, callback/* (info) */) {
	var info = {};
	info.thumbURL = "//"+config.staticDomain+"/folder.png";
	info.items = [];
	fs.readdir(path, function(err, files) {
		if(err) return callback(null);
		var remaining = files.length;
		for(var i = 0; i < files.length; ++i) {
			treeInfo(path+"/"+files[i], function(subinfo) {
				if(subinfo) info.items.push(subinfo);
				if(--remaining) return;
				callback(info);
			});
		}
	});
}
function imageInfo(path, callback/* (info) */) {
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
				"port": 443,
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
			var req = https.request(opts, function(res) {
				if(200 !== res.statusCode) return callback(null);
				callback(info);
			});
			fs.createReadStream(path).pipe(req);
		});
	});
}
function archiveInfo(path, callback/* (info) */) {
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
			treeInfo(dir, function(info) {
				fs.rmRecursive(dir);
				info.name = pathModule.basename(path);
				if(1 === info.items.length) info.items = info.items[0].items;
				callback(info);
			});
		});
	});
}
function filesInfo(files, callback/* (info) */) {
	var info = {}, remaining = files.length;
	info.items = [];
	bt.map(files, function(file) {
		treeInfo(file.path, function(subinfo) {
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
	var hash = randomString(14);
	zlib.gzip(data, function(err, body) {
		if(err) return callback(err, null);
		var opts = {
			"port": 443,
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
		var req = https.request(opts, function(res) {
			console.log("uploaded index", body.length, hash, res.statusCode);
			if(200 === res.statusCode) return callback(null, hash);
			callback(new Error("Index upload failed: "+res.statusCode), null);
		});
		req.end(body);
	});
}

function upload(req, res) {
	function fail(err) {
		console.log((new Error(err)).stack);
		res.sendMessage(500, "Internal Server Error");
	}
	var form = new formidable.IncomingForm({
		"keepExtensions": true,
	});
	if(form.bytesExpected > config.maxSize) return res.sendMessage(413, "Request Entity Too Large");
	form.addListener("error", function(err) {
		fail(err);
	});
	form.parse(req, function(err, fields, fileByField) {
		if(err) return fail(err)
		var interval = setInterval(function() {
			res.write(" ", "utf8"); // Keep the connection alive.
		}, 1000 * 10);
		var files = [];
		bt.map(fileByField, function(file) { files.push(file); });
		res.writeHead(200, {
			"Content-Type": "text/json; charset=utf-8",
		});
		filesInfo(files, function(info) {
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
