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
function Uploader() {
	var uploader = this;
	var uploading = false;
	uploader.element = DOM.clone("uploader", uploader);

	DOM.addListener(uploader["target"], "dragenter", function(event) {
		if(!uploading) DOM.classify(uploader["droppable"], "dragging", true);
	});
	DOM.addListener(uploader["target"], "dragleave", function(event) {
		DOM.classify(uploader["droppable"], "dragging", false);
	});
	DOM.addListener(uploader["target"], "dragover", function(event) {
		event.dataTransfer.dropEffect = uploading ? "none" : "copy";
		DOM.preventDefault(event);
		return false;
	});
	DOM.addListener(uploader["target"], "drop", function(event) {
		function bail(message) {
			if(message) alert(message); // TODO: Don't use alert().
			DOM.classify(uploader["droppable"], "dragging", false);
			DOM.preventDefault(event);
			return false;
		}
		function stringFromTimeRemaining(t) {
			t /= 1000;
			var s = Math.ceil(t % 60);
			t /= 60;
			var m = Math.floor(t % 60);
			t /= 60;
			var h = Math.floor(t % 24);
			t /= 24;
			var d = Math.floor(t);
			return ""+(d ? d+"d " : "")+(h ? h+"h " : "")+(m ? m+"m " : "")+(s ? s+"s" : "");
		}
		function stringFromSizeRemaining(s) {
			var m = s / 1024 / 1024;
			if(m >= 1) return Math.round(m)+"MB";
			var k = s / 1024;
			if(k >= 1) return Math.round(k)+"KB";
			return Math.round(s)+"B";
		}
		function hasValidExtension(name) {
			var exts = [
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
			for(var i = 0; i < exts.length; ++i) {
				if(exts[i] === name.slice(-exts[i].length)) return true;
			}
			return false;
		}
		if(uploading) return bail();

		var files = event.dataTransfer.files;
		var size = 0;
		for(var i = 0; i < files.length; ++i) {
			if("" === files[i].type || !files[i].size) return bail("Bare folder uploads are not currently supported. Please create an archive instead.");
			if(!hasValidExtension(files[i].name)) return bail("The file “"+files[i].name+"” is not a supported type.");
			size += files[i].size;
		}
		if(size > 200 * 1024 * 1024) return bail("Total filesize is too large ("+stringFromSizeRemaining(size)+").");

		var form = new FormData();
		var req = new XMLHttpRequest();
		for(var i = 0; i < files.length; ++i) form.append("file-"+i, files[i]);
		uploader["progress"].style.width = "0px";
		uploading = true;

		var start = +new Date;
		var total = 0;
		var time = start;
		var loaded = 0;
		var lastTime = 0;
		var lastLoaded = 0;
		var interval = setInterval(function() {
			if(!total) return;
			var remaining = total - loaded;
			if(remaining <= 50) {
				DOM.fill(uploader["speed"]);
				DOM.fill(uploader["time"], "Processing…");
				DOM.fill(uploader["total"]);
				clearInterval(interval);
				return;
			}
			var now = +new Date;
			var speed = (loaded - lastLoaded) / (time - lastTime);
			//var instantaneous = (now - lastTime) / (loaded - lastLoaded);
			var average = (now - start) / loaded;
			var complete = loaded / total;
			//var estimate = instantaneous * remaining * complete + average * remaining/* * (1 - complete);
			var estimate = average * remaining;
			DOM.fill(uploader["speed"], stringFromSizeRemaining(speed * 1000)+"/s");
			DOM.fill(uploader["time"], stringFromTimeRemaining(estimate)+" left");
			DOM.fill(uploader["total"], stringFromSizeRemaining(total));
		}, 1000 / 2);
		if(req.upload) req.upload.onprogress = function(event) {
			var complete = event.loaded / event.total;
			uploader["progress"].style.width = Math.round(complete * uploader["progressBar"].offsetWidth)+"px";
			lastTime = time;
			lastLoaded = loaded;
			total = event.total;
			loaded = event.loaded;
			time = +new Date;
		};

		req.onreadystatechange = function() {
			if(4 !== req.readyState) return;
			clearInterval(interval);
			try {
				var obj = JSON.parse(req.responseText);
				if(obj["hash"]) window.location = "/id/"+obj["hash"];
			} catch(e) {
				// TODO: Upload failed.
				console.log("failed", e);
				DOM.classify(uploader.element, "uploading", false);
				uploading = false;
			}
		};
		req.open("POST", "/upload");
		req.send(form);
		DOM.classify(uploader["droppable"], "dragging", false);
		DOM.classify(uploader.element, "uploading", true);
		DOM.preventDefault(event);
		return false;
	});
}
