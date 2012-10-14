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
function Index(indexURL) {
	var index = this;
	index.element = DOM.clone("index", index);
	index.root = new Node(index);
	index.root.indexURL = indexURL;
	index.node = undefined;
	index.thumbnailBrowser = null;
	index.menu = null;
	index.cache = {
		next: {
			node: null,
			show: null,
		},
	};
	index.scrollView = new ScrollView();
	index.scrollView.setScaler(Scaler.parse(localStorage.getItem("scaler"), index.scrollView));
	index.scrollView.setReadingDirection(ReadingDirection.parse(localStorage.getItem("readingDirection")));
	// TODO: Shouldn't we use the regular index.setXXX() system for loading these?
	index.scrollView.element._onclick = function(event) {
		var rightClick = 2 == event.button;
		var forward = event.shiftKey === rightClick;
		index.next(forward);
	};
	index.element.appendChild(index.scrollView.element);
	DOM.addListener(document, "keydown", function(event) {
		index.onkeydown(event);
	});
}
Index.prototype.load = function(path) {
	var index = this;
	index.async(function(done) {
		index.root.load(function() {
			index.root.descendant(config.components(), function(node) {
				if(node.viewable()) index.setCurrentNode(node, done);
				else node.pageNext(true, true, function(node) {
					index.setCurrentNode(node, done);
				});
			});
		});
	});
};
Index.prototype.setCurrentNode = function(node, callback) {
	var index = this;
	callback = callback || function() {};
	if(index.node === node) return callback();
	if(index.node) index.node.position = index.scrollView.position;
	index.node = node;
	if(node) {
		var cache = index.cache.next;
		function onShow(err, element, rescale) {
			if(err) return callback(); // TODO: Handle error.
			if(index.node !== node) return callback(); // We're obsolete.
			// TODO: Handle real cancelation.
			index.scrollView.setContent(element, node.position || index.scrollView.homePosition(true), rescale);
			callback();

			// Clever caching.
			var args = arguments;
			cache.node = null;
			cache.show = null;
			index._next(true, function(next) {
				if(index.node !== node) return;
				cache.node = next;
				if(next === node) {
					cache.show = Array.prototype.slice.call(args);
				} else next.show(function(err, element, rescale) {
					if(cache.node !== next) return;
					cache.show = Array.prototype.slice.call(arguments);
				});
			});
		}
		if(cache.node === node && cache.show) onShow.apply(index, cache.show);
		else node.show(onShow);
		document.title = node.displayablePath(" ▹ ");
		var path = config.path(node);
		if(path !== window.location.pathname && history.pushState) history.pushState("", "", path); // For IE we can just skip calling pushState(), the URL won't change but it'll still mostly work.
		if(index.thumbnailBrowser) index.thumbnailBrowser.show(node);
	} else {
		// TODO: setCurrentNode(null, ...) is different from "wow, we checked everywhere and didn't find any nodes", so this code should be elsewhere.
		document.title = "SequentialWeb (no images)";
		index.scrollView.setContent(DOM.clone("empty"));
		callback();
	}
};
Index.prototype.async = function(func/* (done) */) {
	var index = this, loading;
	var timeout = setTimeout(function() {
		loading = DOM.clone("loading");
		index.element.appendChild(loading);
	}, 1000 * 0.25);
	return func(function done() {
		if(loading) DOM.remove(loading);
		clearTimeout(timeout);
	});
}
Index.prototype._next = function(forward, callback/* (node) */) {
	var index = this;
	if(forward && index.cache.next.node) return callback(index.cache.next.node);
	function fromRoot() {
		index.root.pageLast(!forward, true, null, callback);
	}
	if(index.node) index.node.pageNext(forward, true, function(node) {
		if(node) callback(node);
		else fromRoot();
	});
	else fromRoot();
};
Index.prototype.next = function(forward) {
	var index = this;
	index.async(function(done) {
		index._next(forward, function(node) {
			index.setCurrentNode(node, done);
		});
	});
};
Index.prototype.last = function(forward) {
	var index = this;
	index.async(function(done) {
		index.root.pageLast(forward, true, null, function(node) {
			index.setCurrentNode(node, done);
		});
	});
};
Index.prototype.skipPastFolder = function(forward) {
	var index = this;
	index.async(function(done) {
		index.node.pagePastFolder(forward, function(node) {
			if(node) return index.setCurrentNode(node, done);
			done(); // TODO: Loop?
		});
	});
};
Index.prototype.folderLast = function(forward) {
	var index = this;
	index.async(function(done) {
		index.node.pageFolderLast(forward, function(node) {
			if(node) return index.setCurrentNode(node, done);
			done(); // TODO: Display some sort of "no more pages" alert.
		});
	});
};
Index.prototype.setScaler = function(scaler) {
	var index = this;
	index.scrollView.setScaler(scaler);
	localStorage.setItem("scaler", scaler.stringify());
	// FIXME: We need to change the selection when index.setScaler() is called. This can happen from the keyboard while the menu is open.
};
Index.prototype.setReadingDirection = function(readingDirection) {
	var index = this;
	index.scrollView.setReadingDirection(readingDirection);
	index.scrollView.scrollTo(index.scrollView.homePosition(true));
	localStorage.setItem("readingDirection", readingDirection.stringify());
	// FIXME: This needs to update the menu too.
};
Index.prototype.showThumbnailBrowser = function() {
	var index = this;
	if(index.thumbnailBrowser) return;
	index.thumbnailBrowser = new ThumbnailBrowser(index);
	index.async(function(done) {
		index.root.pageCount(1, function(count) {
			done();
			if(count <= 1) {
				index.thumbnailBrowser = null;
				return;
			}
			if(index.menu) {
				DOM.remove(index.menu.element); // TODO: How exactly should this work?
				index.menu = null;
			}
			index.scrollView.setActive(false);
			index.element.appendChild(index.thumbnailBrowser.element);
			index.thumbnailBrowser.show(index.node);
			index.thumbnailBrowser.onclose = function(event) {
				if(event && event.shiftKey) return;
				DOM.remove(index.thumbnailBrowser.element);
				index.scrollView.setActive(true);
				index.thumbnailBrowser = null;
			};
		});
	});
};
Index.prototype.showOptions = function() {
	var index = this;
	index.menu = new Menu(index);
	if(index.thumbnailBrowser) {
		DOM.remove(index.thumbnailBrowser.element); // FIXME: This is a mess.
		index.thumbnailBrowser = null;
	}
	index.scrollView.setActive(false);
	index.element.appendChild(index.menu.element);
	index.menu.scrollView.reflow(); // FIXME: Hack.
	index.menu.onclose = function(event) {
		if(event && event.shiftKey) return;
		DOM.remove(index.menu.element);
		index.scrollView.setActive(true);
		index.menu = null;
	};
};
Index.prototype.onkeydown = function(event) {
	var index = this;
	var key = event.keyCode || event.which;
	if(event.metaKey) return;
	if(event.shiftKey) switch(key) {
		case 65: // Shift-a
			return index.setScaler(new ProportionalScaler(index.scrollView, 1));
		case 83: // Shift-s
			return index.setScaler(new FitScaler(index.scrollView, "min"));
		case 68: // Shift-d
			return index.setScaler(new FitScaler(index.scrollView, "max"));
		case 70: // Shift-f
			return index.setScaler(new AlmostFitScaler(index.scrollView));

		case index.scrollView.readingDirection.backwardKeyCode: // Shift-[
			return index.last(false);
		case index.scrollView.readingDirection.forwardKeyCode: // Shift-]
			return index.last(true);

		case 79: // Shift-o
			return (config.open || function(){})();
		case 82: // Shift-r
			return (config.showOriginal || function(){})(index.node);
	}
	else switch(key) {
		case 192: // `
			return index.setScaler(new FitScaler(index.scrollView, "min"));
		case 49: // 1
			return index.setScaler(new ProportionalScaler(index.scrollView, 1));
		case 50: // 2
			return index.setScaler(new ProportionalScaler(index.scrollView, 2));
		case 48: // 0
			return index.setScaler(new ProportionalScaler(index.scrollView, 0.5));

		case index.scrollView.readingDirection.backwardKeyCode: // [
			return index.next(false);
		case index.scrollView.readingDirection.forwardKeyCode: // ]
			return index.next(true);

		case 84: // t
			return index.showThumbnailBrowser();
		case 77: // m
			return index.showOptions();
		case 73: // i
			return index.setReadingDirection(new ReadingDirection(true));
		case 79: // o
			return index.setReadingDirection(new ReadingDirection(false));
	}
	switch(key) {
		case 74: // j
			return; // TODO: Implement;
		case 75: // k
			return index.skipPastFolder(!event.shiftKey);
		case 76: // l
			return index.folderLast(!event.shiftKey);
	}
};









