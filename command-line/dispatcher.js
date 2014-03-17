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
var urlModule = require("url");
var crypto = require("crypto");

var has = require("../node-shared/has");
var fs = require("../node-shared/fsx");
var http = require("../node-shared/httpx");

var sl = require("./sequential");
var ThumbnailCache = require("./ThumbnailCache");

var dispatcher = exports;

var CLIENT = __dirname+"/build";
var GALLERY = CLIENT+"/gallery/index.html";

var thumbnailCache = new ThumbnailCache(sl.THUMBNAILS, {width: 128, height: 128}, "jpg");

var IMAGE_EXTS = {
	".jpeg": true,
	".jpg": true,
	".png": true,
	".gif": true,
};
function isImagePath(path) {
	return has(IMAGE_EXTS, pathModule.extname(path));
}
function componentsFromPath(path) {
	var l = path.length;
	var a = "/" === path[0] ? 1 : 0;
	var b = "/" === path[l - 1] ? 1 : 0;
	if(a + b >= l) return [];
	return path.slice(a, -b || undefined).split("/");
}
function pathFromComponents(components) {
	if(!components.length) return "";
	return "/"+components.join("/");
}
function lookup(obj, prop) {
	if(!obj || !prop) return null; // TODO: Be more robust.
	if(has(obj, prop)) return obj[prop];
	return null;
}
function first(array) {
	return array.length ? array[0] : null;
}
function rest(array) {
	return array.slice(1);
}

function fileInfo(hash, root, subpath, depth, callback/* (info) */) {
	var fullpath = root+subpath;
	if(fullpath.match(/\/\./)) return callback(null); // Skip .hidden files.
	fs.stat(fullpath, function(err, stats) {
		if(err) return callback(null);
		var escaped = pathFromComponents(componentsFromPath(subpath).map(encodeURIComponent));
		var info = {
			"name": pathModule.basename(fullpath),
			"ctime": +stats.ctime,
			"mtime": +stats.mtime,
		};
		if(stats.isDirectory()) {
			info.thumbURL = "/gallery/folder.png";
			if(!depth) {
				info.indexURL = "/id/"+hash+escaped+"?type=index";
				return callback(info);
			}
			fs.readdir(fullpath, function(err, files) {
				if(err) return callback(null);
				var remaining = files.length;
				info.items = [];
				if(!remaining) callback(info);
				else for(var i = 0; i < files.length; ++i) {
					fileInfo(hash, root, subpath+"/"+files[i], depth-1, function(subinfo) {
						if(subinfo) info.items.push(subinfo);
						if(!--remaining) callback(info);
					});
				}
			});
		} else if(stats.isFile()) {
			if(!stats.size) return callback(null);
			if(!isImagePath(fullpath)) return callback(null);
			info.size = stats.size;
			info.imageURL = "/id/"+hash+escaped+"?type=image";
			info.thumbURL = "/id/"+hash+escaped+"?type=thumb";
			info.items = [];
			callback(info);
		} else {
			callback(null);
		}
	});
}

var serve = function(req, res) {
	var path = urlModule.parse(req.url).pathname;
	var components = componentsFromPath(path).map(decodeURIComponent);
	if(-1 !== components.indexOf("..")) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	serve.root(req, res, {
		"path": path,
		"components": components,
	});
};
serve.root = function(req, res, root) {
	var components = root.components;
	var imp = lookup(serve.root, first(components));
	if(!imp) {
		var path = CLIENT+root.path;
		fs.stat(path, function(err, stats) {
			if(err) return res.sendError(err);
			res.sendFile(stats.isDirectory() ? path+"/index.html" : path);
		});
		return;
	}
	imp(req, res, root, {
		"components": rest(components),
	});
};
serve.root.id = function(req, res, root, id) {
	var components = id.components;
	var hash = first(components);
	sl.pathForHash(hash, function(err, rootPath) {
		if(err) return res.sendError(err);
		var subPath = pathFromComponents(rest(components));
		serve.root.id.hash(req, res, root, id, {
			"hash": hash,
			"rootPath": rootPath,
			"subPath": subPath,
			"path": rootPath+subPath,
		});
	});
};
serve.root.id.hash = function(req, res, root, id, hash) {
	var query = urlModule.parse(req.url, true).query;
	var type = query.type;
	if(!type) return res.sendFile(GALLERY);
	var imp = lookup(serve.root.id.hash, type);
	if(!imp) return res.sendMessage(400, "Bad Request");
	imp(req, res, root, id, hash, {
		"query": query,
	});
};
serve.root.id.hash.index = function(req, res, root, id, hash, index) {
	var hashString = hash.hash;
	var rootPath = hash.rootPath;
	var subPath = hash.subPath;
	fileInfo(hashString, rootPath, subPath, 1, function(info) {
		if(!info) return res.sendMessage(404, "Not Found");
		res.sendJSON(200, "OK", info);
	});
};
serve.root.id.hash.image = function(req, res, root, id, hash, image) {
	var path = hash.path;
	if(!isImagePath(path)) return res.sendMessage(400, "Bad Request");
	res.sendFile(path, false);
};
serve.root.id.hash.thumb = function(req, res, root, id, hash, index) {
	var path = hash.path;
	if(!isImagePath(path)) return res.sendMessage(400, "Bad Request");
	thumbnailCache.cachePathForPath(path, function(err, cachePath) {
		if(err) return res.sendError(err);
		res.sendFile(cachePath);
	});
};

dispatcher.serve = serve;
