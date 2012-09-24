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

var fs = require("./fs+");

function ThumbnailCache(cachePath, thumbnailSize, extension) {
	this.cachePath = cachePath;
	this.thumbnailSize = {"width": Math.round(thumbnailSize.width), "height": Math.round(thumbnailSize.height)};
	this.extension = extension;
}
ThumbnailCache.prototype.cachePathForPath = function(path, callback/* (cachePath) */) {
	var tc = this;
	var hash = tc.hashForPath(path);
	var dirPath = tc.cachePath+"/"+hash.slice(0, 2);
	var cachePath = dirPath+"/"+hash+"."+tc.extension;
	tc.isValid(cachePath, path, function(valid) {
		if(valid) return callback(cachePath);
		fs.mkdirRecursive(dirPath, function(err) {
			if(err) console.log(err);
			tc.writeThumbnail(cachePath, path, function(success) {
				callback(success ? cachePath : null);
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
}
ThumbnailCache.prototype.writeThumbnail = function(cachePath, mainPath, callback/* (success) */) {
	var tc = this;
	var size = [tc.thumbnailSize.width, tc.thumbnailSize.height].join("x");
	var converter = proc.spawn("convert", [
		"-size", size,
		mainPath+"[0]",
		//"-auto-orient",
		"-coalesce",
		"-thumbnail", size+">",
		"-background", "white",
		"-flatten",
		"-quality", "70",
		cachePath
	]);
	converter.addListener("exit", function(code) {
		callback(0 === code);
	});
};

module.exports = ThumbnailCache;
