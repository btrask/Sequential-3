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
function GenericPage(element) {
	var page = this;
	page.element = element;
	page.borderSize = Size.zero;
}
GenericPage.prototype.rescale = function(scaler) {};

function ImagePage(node) {
	var page = this;
	page.node = node;
	page.element = null;
	page.cancel = function(){};
	page.originalSize = null;
	page.borderSize = Size.zero;
}
ImagePage.prototype.load = function(callback) {
	var page = this;
	if(page.element) return (callback || function(){})();
	var element = DOM.clone("image", page);
	var area = page["area"];
	var title = page["title"];
	var options = page["options"];
	var browse = page["browse"];
	var image = new Image();
	function finished() {
		page.cancel = function(){};
		image.onload = null;
		image.onerror = null;
		if(callback) callback();
	};

	page.cancel = function() {
		image.src = null;
		finished();
	};
	image.onload = function() {
		page.image = image;
		page.element = element;
		page.originalSize = new Size(image.width, image.height);
		finished();
	};
	image.onerror = function() {
		// TODO: Set page.element to some sort of error message element.
		finished();
	};

	DOM.fill(area, image);
	image.src = page.node.imageURL;
	options._onclick = function(event) {
		page.node.index.showOptions();
	};
	browse._onclick = function(event) {
		page.node.index.showThumbnailBrowser();
	};
	DOM.fill(title, page.node.name);
	DOM.fill(options, "Options");
	DOM.fill(browse, "Browse"); // TODO: Localize.
	page.node.index.root.pageCount(1, function(count) {
		DOM.classify(browse, "disabled", count <= 1);
	});
};
ImagePage.prototype.rescale = function(scaler) {
	var page = this;
	if(!page.originalSize) return;
	var elementSize = Size.fromElement(page.element);
	var areaSize = Size.fromElement(page["area"]);
	page.borderSize = elementSize.difference(areaSize);
	var size = scaler.scaledSize(page).roundToZero(); // It would be nice to use round(), but making the image a pixel larger might mess up scrolling...
	page.image.width = size.w;
	page.image.height = size.h;
};

/*
FIXME: Serious problems with rendering to canvas:
- Only one frame of animated GIFs gets drawn, and we probably have no way to read the other frames/durations. Worse yet, the frame changes in the background so everytime we rescale() we get a different frame.
- Scaling looks bad; {moz,webkit}imageSmoothingEnabled defaults to `true` but does not seem to use high quality scaling on any browser (Chromium, Firefox, or Safari 5).
- I can't even get imageSmoothingEnabled=false to work (again, in any browser).
*/
function CanvasPage(node) {
	var page = this;
	page.node = node;
	page.element = null;
	page.cancel = function(){};
	page.originalSize = null;
	page.borderSize = Size.zero;
}
CanvasPage.prototype.load = function(callback) {
	var page = this;
	var element = DOM.clone("image", page);
	var area = page["area"];
	var title = page["title"];
	var options = page["options"];
	var browse = page["browse"];
	var image = new Image();
	var canvas = document.createElement("canvas");
	function finished() {
		page.cancel = function(){};
		image.onload = null;
		image.onerror = null;
		if(callback) callback();
	};

	page.cancel = function() {
		image.src = null;
		finished();
	};
	image.onload = function() {
		page.image = image;
		page.element = element;
		page.originalSize = new Size(image.width, image.height);
		page.canvas = canvas;
		page.context = canvas.getContext("2d");
		page.context.globalCompositeOperation = "copy";
/*		page.context.webkitImageSmoothingEnabled = true;
		page.context.mozImageSmoothingEnabled = true;
		page.context.imageSmoothingEnabled = true;*/
		finished();
	};
	image.onerror = function() {
		// TODO: Some kind of error.
		finished();
	};

	DOM.fill(area, canvas);
	image.src = page.node.imageURL;
	options._onclick = function(event) {
		page.node.index.showOptions();
	};
	browse._onclick = function(event) {
		page.node.index.showThumbnailBrowser();
	};
	DOM.fill(title, page.node.name);
	DOM.fill(options, "Options");
	DOM.fill(browse, "Browse"); // TODO: Localize.
	page.node.index.root.pageCount(1, function(count) {
		DOM.classify(browse, "disabled", count <= 1);
	});
};
CanvasPage.prototype.rescale = function(scaler) {
	var page = this;
	var orig = page.originalSize;
	if(!orig) return;
	var elementSize = Size.fromElement(page.element);
	var areaSize = Size.fromElement(page["area"]);
	page.borderSize = elementSize.difference(areaSize);
	var size = scaler.scaledSize(page).roundToZero(); // It would be nice to use round(), but making the image a pixel larger might mess up scrolling...
	page.canvas.width = size.w;
	page.canvas.height = size.h;
	page.context.drawImage(page.image, 0, 0, size.w, size.h);
};
