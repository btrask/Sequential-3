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
}
GenericPage.prototype.rescale = function(scaler) {};

function ImagePage(node) {
	var page = this;
	page.node = node;
	page.element = null;
	page.cancel = null;
	page.originalSize = null;
}
ImagePage.prototype.load = function(callback) {
	var page = this;
	var element = DOM.clone("image", page);
	var image = page["image"];
	var title = page["title"];
	var options = page["options"];
	var browse = page["browse"];
	function finished() {
		page.cancel = null;
		image.onload = null;
		image.onerror = null;
		if(callback) callback();
	};

	page.cancel = function() {
		image.src = null;
		finished();
	};
	image.onload = function() {
		page.element = element;
		page.originalSize = new Size(image.width, image.height);
		finished();
	};
	image.onerror = function() {
		// TODO: Set page.element to some sort of error message element.
		finished();
	};

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
	var imageSize = Size.fromElement(page.element);
	var areaSize = Size.fromElement(page["area"]);
	var border = imageSize.difference(areaSize);
	var size = scaler.scaledSize(page.originalSize, border);
	page["image"].width = size.w;
	page["image"].height = size.h;
};
