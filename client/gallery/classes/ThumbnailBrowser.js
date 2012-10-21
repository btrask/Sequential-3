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
function ThumbnailBrowser(index) {
	var browser = this;
	browser.content = DOM.clone("thumbnailBrowser", browser);
	browser.index = index;
	browser.scrollView = new ScrollView();
	browser.scrollView.element._onclick = function(event) {
		if(browser.onclose) browser.onclose(event);
	};
	browser.folder = new ThumbnailFolder(browser, index.root);
	browser.content.appendChild(browser.folder.element);
	browser.element = browser.scrollView.element;
	browser.scrollView.setPage(new GenericPage(browser.content), new Point(0, 0));
}
ThumbnailBrowser.prototype.show = function(node) {
	this.folder.show(node);
};

function ThumbnailItem(browser, node) {
	var item = this;
	item.element = DOM.clone("thumbnailItem", item);
	item.browser = browser;
	item.node = node;
	item.folder = null;
	item.onload = null;
	item["image"].onload = function() {
		if(item.onload) item.onload();
	};
	item["image"].onerror = function() {
		DOM.classify(item.element, "preview", false);
		item["image"].onload = null;
		item["image"].onerror = null; // TODO: Make sure this is okay.
		item["image"].src = config.thumbErrorURL;
		if(item.onload) item.onload();
	};
	item["image"].src = item.node.thumbURL;
	if(!item.node.imageURL) DOM.classify(item.element, "preview", false);
	DOM.fill(item["title"], item.node.name);
}
function ThumbnailFolder(browser, node) {
	var folder = this;
	folder.element = DOM.clone("thumbnailFolder", folder);
	folder.browser = browser;
	folder.node = node;
	folder.itemByName = {};
	folder.selectedItem = null;
	DOM.fill(folder["title"], folder.node.displayablePath(" ▸ "));
	// TODO: Show loading indicator.
	folder.node.load(function() {
		bt.map(folder.node.items, function(child) {
			var item = folder.itemForNode(child, true);
			item.element._onclick = function(event) {
				folder.show(item.node);
				if(item.node.viewable()) {
					folder.browser.index.jumpToNode(item.node);
					if(folder.browser.onclose) folder.browser.onclose(event);
				}
			};
			folder["thumbnails"].appendChild(item.element);
		});
		folder.browser.scrollView.reflow();
	});
}
ThumbnailFolder.prototype.deselect = function() {
	var folder = this;
	if(!folder.selectedItem) return;
	if(folder.selectedItem.folder) {
		DOM.remove(folder.selectedItem.folder.element);
		folder.selectedItem.folder.deselect();
	}
	DOM.classify(folder.selectedItem.element, "selected", false);
	folder.selectedItem = null;
};
ThumbnailFolder.prototype.show = function(node) {
	var folder = this;
	folder.deselect();
	if(null === node) throw new Error("Can't show null node");
	if(node === folder.node) return;
	if(node.parent !== folder.node) {
		folder.selectedItem = null;
		folder.show(node.ancestorChildOf(folder.node));
		folder.selectedItem.folder.show(node);
		return;
	}
	folder.selectedItem = folder.itemForNode(node, true);
	if(folder.selectedItem) {
		DOM.classify(folder.selectedItem.element, "selected", true);
		if(!folder.selectedItem.node.imageURL) { // TODO: Don't check for an image to decide if the node has items or not. We have to load it.
			if(!folder.selectedItem.folder) folder.selectedItem.folder = new ThumbnailFolder(folder.browser, node);
			folder.browser.content.insertBefore(folder.selectedItem.folder.element, folder.browser.content.firstChild);
		}
	}
	folder.browser.scrollView.reflow();
	folder.browser.scrollView.scrollTo(folder.browser.scrollView.homePosition(true));
};
ThumbnailFolder.prototype.itemForNode = function(node, create) {
	var folder = this;
	if(bt.hasOwnProperty(folder.itemByName, node.name)) return folder.itemByName[node.name];
	if(!create) return null;
	var item = new ThumbnailItem(folder.browser, node);
	folder.itemByName[node.name] = item;
	return item;
};
