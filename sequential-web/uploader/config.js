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
var config = {};
config.rootIndexURLFromHash = function(hash) {
	return "//data.sequentialweb.com/"+hash+".json";
};
config.exts = [
	".jpg", ".jpeg",
	".png",
	".gif",
	".zip", ".cbz",
	".rar", ".cbr",
	".7z",
	".gz",
	".bz2", ".bzip2", ".bz",
	".tar",
	".gtar"
];
config.mimes = [
	"image/jpeg", "image/jpg", "image/pjpeg",
	"image/png", "application/png", "application/x-png",
	"image/gif",
	"application/zip", "application/x-zip", "application/x-zip-compressed", "multipart/x-zip",
	"application/rar", "application/x-rar", "application/x-rar-compressed", "compressed/rar",
	"application/x-7z-compressed",
	"application/gzip", "application/x-gzip",
	"application/bzip2", "application/bzip", "application/x-bzip2", "application/x-bzip",
	"application/x-tar", "application/tar",
	"application/x-gtar", "application/gnutar"
];
config.thumbErrorURL = "//static.sequentialweb.com/error.png";
