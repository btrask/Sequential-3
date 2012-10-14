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
var http = require("http");
var mime = require("./mime");
var pathModule = require("path");
var fs = require("fs");

http.ServerResponse.prototype.sendMessage = function(status, message) {
	var res = this;
	var body = new Buffer(message, "utf8");
	res.writeHead(status, message, {
		"content-type": "text/plain; charset=utf-8",
		"content-length": body.length,
	});
	res.end(body);
};
http.ServerResponse.prototype.sendError = function(err) {
	var res = this;
	if(Object.prototype.hasOwnProperty.call(err, "httpStatusCode")) {
		return res.sendMessage(err.httpStatusCode, err.message);
	}
	switch(err.code) {
		case "ENOENT": return res.sendMessage(404, "Not Found");
		default:
			throw new Error(err);
//			console.log(err, (new Error()).stack);
			return res.sendMessage(500, "Internal Server Error");
	}
};
http.ServerResponse.prototype.sendJSON = function(status, message, obj) {
	var res = this;
	var body = new Buffer(JSON.stringify(obj) || "", "utf8");
	res.writeHead(status, message, {
		"content-type": "text/json; charset=utf-8",
		"content-length": body.length,
	});
	res.end(body);
};
http.ServerResponse.prototype.sendFile = function(path, compressed) {
	var res = this;
	var ext = pathModule.extname(path);
	var type = Object.prototype.hasOwnProperty.call(mime, ext) ? mime[ext] : "application/octet-stream";
	if("text/" === type.slice(0, 5)) type += "; charset=utf-8";
	function send(path, enc, failure/* (err) */) {
		fs.stat(path, function(err, stats) {
			if(err) return failure(err);
			res.writeHead(200, "OK", {
				"content-type": type,
				"content-length": stats.size,
				"content-encoding": enc,
			});
			fs.createReadStream(path).pipe(res);
		});
	}
	function sendCompressed() {
		send(path+".gz", "gzip", sendPlain);
	}
	function sendPlain() {
		send(path, "none", sendError);
	}
	function sendError(err) {
		res.sendError(err);
	}
	(false !== compressed ? sendCompressed : sendPlain)();
};

module.exports = http;
