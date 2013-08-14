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
var proc = require("child_process");
var crypto = require("crypto");
var os = require("os");

var fs = require("../node-shared/fsx");

function Queue() { // TODO: Put this somewhere.
	var queue = this;
	queue.max = 1;
	queue._current = 0;
	queue._items = [];
}
Queue.prototype.push = function(func/* (done) */) {
	var queue = this;
	queue._items.push(func);
	queue._next();
};
Queue.prototype._next = function() {
	var queue = this;
	if(queue._current >= queue.max) return;
	++queue._current;
	queue._items.shift()(function done() {
		--queue._current;
		if(queue._items.length) queue._next();
	});
};

function ThumbnailCache(cachePath, thumbnailSize, extension) {
	var tc = this;
	tc.cachePath = cachePath;
	tc.thumbnailSize = {"width": Math.round(thumbnailSize.width), "height": Math.round(thumbnailSize.height)};
	tc.extension = extension;
	tc.queue = new Queue();
	tc.queue.max = os.cpus().length * 1;
}
ThumbnailCache.prototype.cachePathForPath = function(path, callback/* (err, cachePath) */) {
	var tc = this;
	var hash = tc.hashForPath(path);
	var dirPath = tc.cachePath+"/"+hash.slice(0, 2);
	var cachePath = dirPath+"/"+hash+"."+tc.extension;
	tc.isValid(cachePath, path, function(valid) {
		if(valid) return callback(null, cachePath);
		fs.mkdirRecursive(dirPath, function(err) {
			if(err) return callback(err, null);
			tc.writeThumbnail(cachePath, path, function(err) {
				if(err) return callback(err, null);
				callback(null, cachePath);
			});
		});
	});
};
ThumbnailCache.prototype.hashForPath = function(path) {
	var tc = this;
	var sha1 = crypto.createHash("sha1");
	sha1.update(path+"["+tc.thumbnailSize.width+","+tc.thumbnailSize.height+"]", "utf8");
	return sha1.digest("hex");
};
ThumbnailCache.prototype.isValid = function(cachePath, mainPath, callback/* (valid) */) {
	fs.stat(cachePath, function(err, cacheStats) {
		if(err) return callback(false);
		fs.stat(mainPath, function(err, mainStats) {
			if(err) return callback(false);
			var cacheTime = cacheStats.mtime || cacheStats.ctime;
			var mainTime = mainStats.mtime || mainStats.ctime;
			callback(cacheTime > mainTime);
		});
	});
};
ThumbnailCache.prototype.writeThumbnail = function(cachePath, mainPath, callback/* (err) */) {
	var tc = this;
	tc.queue.push(function(done) {
		fs.open(mainPath, "r", function(err, fd) {
			if(err) return callback(err);
			var size = [tc.thumbnailSize.width, tc.thumbnailSize.height].join("x");
			var converter = proc.spawn("convert", [
				"-size", size,
				"-[0]", // Use stdin so that ImageMagick doesn't try to parse our file names.
//				"-auto-orient",
				"-coalesce",
				"-filter", "point", // <http://www.imagemagick.org/Usage/filter/#filter>
				"-thumbnail", size+">", // <http://www.imagemagick.org/Usage/thumbnails/>
				"-background", "white",
				"-flatten",
				"-quality", "70",
				cachePath
			], {"stdio": [fd, null, process.stderr]});
			converter.on("exit", function(status) {
				fs.close(fd);
				done();
				if(status) return callback({
					httpStatusCode: 500,
					message: "Internal Server Error",
				});
				callback(null);
			});
		});
	});
};

module.exports = ThumbnailCache;
