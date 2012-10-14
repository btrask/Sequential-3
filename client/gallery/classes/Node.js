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
function AJAXRequest() { // TODO: Put this somewhere.
	if(window.ActiveXObject) {
		try { return new ActiveXObject("Msxml2.XMLHTTP"); } catch(e) {}
		try { return new ActiveXObject("Microsoft.XMLHTTP"); } catch(e) {}
	}
	try { return new XMLHttpRequest(); } catch(e) {}
}
function asyncLoop(func/* (next) */) { // TODO: Put this somewhere too.
	var called, finished;
	for(;;) {
		called = false;
		finished = false;
		func(function next() {
			called = true;
			if(finished) asyncLoop(func);
		});
		finished = true;
		if(!called) break;
	}
}

function Node(index, parent, name) {
	var node = this;
	node.index = index;
	node.parent = parent;
	node.name = name;
	node.encrypted = false;
	node.imageURL = null;
	node.thumbURL = null;
	node.indexURL = null;
	node.items = [];
	node.itemByName = {};
	node.size = 0;
	node.created = 0;
	node.modified = 0;
}
Node.prototype.toString = function() {
	return this.displayablePath();
};
Node.prototype.displayablePath = function(separator) {
	return bt.map(this.ancestors(), function(node) {
		return node.name;
	}).join(separator || "/");
};
Node.prototype.viewable = function() {
	return this.imageURL || this.encrypted;
};
Node.prototype.load = function(callback) {
	var node = this;
	if(!node.indexURL) return callback();
	var req = AJAXRequest();
	req.open("GET", node.indexURL, true);
	req.onreadystatechange = function() {
		if(4 !== req.readyState) return;
		if(200 === req.status) {
			node.encrypted = false;
			node._update(JSON.parse(req.responseText));
			if(node.parent) {
				delete node.parent.itemByName[node.name];
				node.parent.itemByName[node.name] = node;
			}
			callback();
		} else if(401 === req.status) {
			node.encrypted = true;
			callback();
		} else {
			callback();
		}
	};
	req.send("");
};
Node.prototype._update = function(obj) {
	var node = this;
	node.name = obj["name"];
	node.imageURL = obj["imageURL"];
	node.thumbURL = obj["thumbURL"];
	node.indexURL = obj["indexURL"];
	if(obj["items"]) node._updateItems(obj["items"]);
};
Node.prototype._updateItems = function(items) {
	var node = this;
	var old = node.itemByName;
	var item;
	node.items = [];
	node.itemByName = {};
	for(var i = 0; i < items.length; ++i) {
		if(bt.hasOwnProperty(old, items[i]["name"])) {
			item = old[items[i]["name"]];
		} else {
			item = new Node(node.index, node);
		}
		item._update(items[i]);
		node.items.push(item);
		node.itemByName[item["name"]] = item;
	}
	node.items.sort(Node.compare);
};
Node.prototype.descendant = function(components, callback/* (descendant) */) {
	var node = this;
	if(!components.length) return callback(node);
	node.load(function() {
		if(!bt.hasOwnProperty(node.itemByName, components[0])) return callback(node); // TODO: Find the child with the closest name alphabetically?
		node.itemByName[components[0]].descendant(components.slice(1), callback);
	});
};
Node.prototype.show = function(callback/* (err, element, rescale(scaler)) */) {
	var node = this;
	if(!node.viewable()) return callback({});
	var elems = {};
	var element = DOM.clone("image", elems);
	elems["image"].onload = function() {
		var originalSize = new Size(elems["image"].width, elems["image"].height);
		if(callback) callback(null, element, function rescale(scaler) {
			var size = scaler.scaledSize(originalSize, Size.fromElement(element).difference(Size.fromElement(elems["area"])));
			elems["image"].width = size.w;
			elems["image"].height = size.h;
		});
	};
	elems["image"].onerror = function() {
		// TODO: Do something.
	};
	elems["image"].src = node.imageURL;
	elems["options"]._onclick = function(event) {
		node.index.showOptions();
	};
	elems["browse"]._onclick = function(event) {
		node.index.showThumbnailBrowser();
	};
	DOM.fill(elems["title"], node.name);
	DOM.fill(elems["options"], "Options");
	DOM.fill(elems["browse"], "Browse"); // TODO: Localize.
	node.index.root.pageCount(1, function(count) {
		DOM.classify(elems["browse"], "disabled", count <= 1);
	});
};
Node.compare = function(a, b) {
	return sort.numericStringCompare(a.name || "", b.name || ""); // TODO: Support sort options.
};

Node.prototype.pageCount = function(goal, callback/* (count) */) {
	var node = this, count = 0;
	if(goal < 0) return callback(count);
	if(node.viewable()) ++count;
	if(goal - count < 0) return callback(count);
	node.load(function() {
		if(!node.items.length) return callback(count);
		var i = 0;
		asyncLoop(function(next) {
			if(i >= node.items.length) return callback(count);
			node.items[i].pageCount(goal - count, function(subcount) {
				count += subcount;
				if(goal - count < 0) return callback(count);
				++i;
				next();
			});
		});
	});
};
Node.prototype.outwardSearch = function(forward, child, includeChild, search/* (node, callback (result)) */, callback/* (node) */) {
	var node = this;
	function continueOutward() {
		node.parentOutwardSearch(forward, node, false, search, callback);
	}
	node.load(function() {
		var items = node.items.slice(); // Protect from mutations.
		var increment = forward ? 1 : -1;
		var i = items.indexOf(child); // Array.prototype.indexOf dangerous on IE?
		console.assert(-1 !== i);
		if(!includeChild) i += increment;
		asyncLoop(function(next) {
			if(i < 0 || i >= items.length) return continueOutward();
			search(items[i], function(result) {
				if(result) return callback(result);
				i += increment;
				next();
			});
		});
	});
};
Node.prototype.parentOutwardSearch = function(forward, child, includeChild, search/* (node, callback (result)) */, callback/* (node) */) {
	var node = this;
	if(node.parent) node.parent.outwardSearch(forward, child, includeChild, search, callback);
	else callback(null);
};
Node.prototype.pageNext = function(next, children, callback/* (node) */) {
	var node = this;
	function pageInnerOrOuter() {
		node.pageLast(!next, false, null, function(node) {
			if(node) callback(node);
			else pageOuter(callback);
		});
	}
	function pageOuter() {
		node.parentOutwardSearch(next, node, false, function(node, callback) {
			node.pageLast(!next, true, null, callback);
		}, callback);
	}
	if(next && children) pageInnerOrOuter();
	else pageOuter();
};
Node.prototype.pageLast = function(last, includeSelf, descendentToStopAt, callback/* (node) */) {
	var node = this;
	var i, step, result;
	if(descendentToStopAt === node) return callback(null);
	node.load(function() {
		var items = node.items.slice(); // Protect from mutations.
		var useSelf = includeSelf && node.viewable();
		if(!last) {
			if(useSelf) return callback(node);
			i = 0;
			step = 1;
		} else {
			i = items.length - 1;
			step = -1;
		}
		asyncLoop(function(next) {
			if(i < 0 || i >= items.length) return stop();
			items[i].pageLast(last, true, descendentToStopAt, function(result) {
				if(result) callback(result);
				else if(descendentToStopAt && descendentToStopAt.ancestorChildOf(node) === items[i]) callback(null);
				else {
					i += step;
					next();
				}
			});
		});
		function stop() {
			if(last && useSelf) callback(node);
			else callback(null);
		}
	});
};
Node.prototype.pagePastFolder = function(past, callback) {
	var node = this;
	var current = node;
	asyncLoop(function(next) {
		current.pageNext(past, true, function(result) {
			if(!result) return callback(null);
			if(result.parent !== node.parent) return callback(result);
			current = result;
			next();
		});
	});
};
Node.prototype.pageFolderLast = function(last, callback) {
	var node = this;
	var ancestor = this.parent;
	asyncLoop(function(next) {
		if(!ancestor) return callback(null);
		ancestor.pageLast(last, true, null, function(result) {
			if(result !== node) return callback(result);
			ancestor = ancestor.parent;
			next();
		});
	});
};
Node.prototype.ancestors = function() {
	var node = this;
	var a = node.parent ? node.parent.ancestors() : [];
	a.push(node);
	return a;
};
Node.prototype.ancestorChildOf = function(other) {
	var node = this;
	if(!node.parent) return null;
	if(node.parent === other) return node;
	return node.parent.ancestorChildOf(other);
};
