#!/usr/bin/env node
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
var fs = require("fs");
var http = require("http");
var urlModule = require("url");

var upload = require("./upload");
var config = require("./config");

var CLIENT = __dirname+"/build";
var INDEX = CLIENT+"/index.html";

http.createServer(function(req, res) {
	var path = urlModule.parse(req.url).pathname || "/";
	if("/upload" === path) return upload(req, res);
	if("/robots.txt" === path) return res.sendFile(CLIENT+path); // TODO: Enforce caching.
	if("/favicon.ico" === path) return res.sendFile(CLIENT+path);
	if("/" === path || "/id/" === path.slice(0, 4)) return res.sendFile(INDEX);
	res.writeHead(301, "Moved Permanently", {
		"Location": "//"+config.staticDomain+path+".gz",
		// TODO: Enforce caching.
		// TODO: Detect gzip support.
	});
	res.end();
}).listen(9003);
