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
var pathModule = require("path");
var https = require("https");

var AwsSign = require("aws-sign");

var bt = require("../node/bt");
var mime = require("../node/mime");

var config = require("./config");
var signer = new AwsSign(require("./secret"));

var DIR = __dirname+"/build";

fs.readdir(DIR, function(err, items) {
	bt.map(items, function(item, i) {
		if(/^\./.test(item)) return;

		var ext = pathModule.extname(items[i]);
		var encoding = "none";
		if(".gz" === ext) {
			ext = pathModule.extname(items[i].slice(0, -ext.length));
			encoding = "gzip";
		}
		var type = mime[ext.toLowerCase()] || "application/octet-stream";
		if("text/" === type.slice(0, 5)) type += "; charset=utf-8";

		fs.stat(DIR+"/"+items[i], function(err, stats) {
			var opts = {
				"port": 443,
				"host": config.staticDomain+".s3.amazonaws.com",
				"path": "/"+items[i],
				"method": "PUT",
				"headers": {
					"Content-Type": type,
					"Content-Length": stats.size,
					"Content-Encoding": encoding,
					"x-amz-acl": "public-read",
				},
			};
			signer.sign(opts);

			var req = https.request(opts, function(res) {
				console.log(item, res.statusCode);
			});
			fs.createReadStream(DIR+"/"+items[i]).pipe(req);
		});
	});
});
