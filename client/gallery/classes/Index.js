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
	index.page = undefined;
	index.cache = {
		node: null,
		page: null,
	};
	index.thumbnailBrowser = null;
	index.menu = null;
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
	index.registerShortcuts();
}
Index.prototype.load = function(path) {
	var index = this;
	index.navigate(false, function(node, callback) {
		index.root.load(function() {
			index.root.descendant(config.components(), function(result) {
				if(result.viewable()) callback(result);
				else result.pageNext(true, true, callback);
			});
		});
	});
};
Index.prototype.navigate = function(relative, func/* (node, callback(node)) */) {
	var index = this;
	if(!relative) index.queue = [];
	index.queue.push(func);
	if(1 !== index.queue.length) return;
	var node = index.node;
	index.async(function(done) {
		asyncLoop(function(next) {
			var func = index.queue[0];
			func(node, function(result) {
				var canceled = func !== index.queue[0];
				if(canceled) return done();
				node = result;
				index.queue.shift();
				if(index.queue.length) return next();
				index._setCurrentNode(node, done);
			});
		});
	});
};
Index.prototype._setCurrentNode = function(node, callback) {
	var index = this;
	callback = callback || function() {};
	if(index.node === node) return callback();
	if(index.node) index.node.position = index.scrollView.position;
	if(index.page) index.page.cancel();
	index.node = node;
	if(node) {
		if(index.cache.page && index.cache.page.node === node) {
			index.page = index.cache.page;
		} else {
			index.page = node.page();
		}
		index.cache.node = null;
		index.cache.page = null;

		index.page.load(function() {
			if(index.page.element) index.scrollView.setPage(index.page, node.position || index.scrollView.homePosition(true));
			callback();

			index._next(true, index.node, function(result) {
				if(index.node !== node) return;
				index.cache.node = result;
				index.cache.page = result.page();
				index.cache.page.load();
			});
		});
		document.title = node.displayablePath(" ▹ ");
		var path = config.path(node);
		if(path !== window.location.pathname && history.pushState) history.pushState("", "", path); // For IE we can just skip calling pushState(), the URL won't change but it'll still mostly work.
		if(index.thumbnailBrowser) index.thumbnailBrowser.show(node);
	} else {
		index.page = null;
		// TODO: setCurrentNode(null, ...) is different from "wow, we checked everywhere and didn't find any nodes", so this code should be elsewhere.
		document.title = "SequentialWeb (no images)";
		index.scrollView.setPage(new GenericPage(DOM.clone("empty")), new Point(0, 0));
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
Index.prototype._next = function(forward, node, callback) {
	var index = this;
	if(forward && node === index.node && index.cache.node) return callback(index.cache.node);
	function fromRoot() {
		index.root.pageLast(!forward, true, null, callback);
	}
	if(!node) fromRoot();
	else node.pageNext(forward, true, function(result) {
		if(result) callback(result);
		else fromRoot();
	});
};
Index.prototype.next = function(forward) {
	var index = this;
	index.navigate(true, function(node, callback) {
		index._next(forward, node, callback);
	});
};
Index.prototype.last = function(forward) {
	var index = this;
	index.navigate(false, function(node, callback) {
		index.root.pageLast(forward, true, null, callback);
	});
};
Index.prototype.skipForward = function(forward) {
	var index = this;
	index.navigate(true, function(node, callback) {
		node.pageSkipForward(forward, function(result) {
			callback(result || node); // TODO: Loop?
		});
	});
};
Index.prototype.folderLast = function(forward) {
	var index = this;
	index.navigate(true, function(node, callback) {
		node.pageFolderLast(forward, function(result) {
			callback(result || node); // TODO: Display some sort of "no more pages" alert.
		});
	});
};
Index.prototype.jumpToNode = function(node) {
	var index = this;
	index.navigate(false, function(ignored, callback) {
		callback(node);
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
	if(index.menu) return;
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
Index.prototype.registerShortcuts = function() {
	var index = this;
	KBD.bind("A", 65, function(e) {
		if(e.shiftKey) index.setScaler(new ProportionalScaler(index.scrollView, 1));
	});
	KBD.bind("S", 83, function(e) {
		if(e.shiftKey) index.setScaler(new FitScaler(index.scrollView, "min"));
	});
	KBD.bind("D", 68, function(e) {
		if(e.shiftKey) index.setScaler(new FitScaler(index.scrollView, "max"));
	});
	KBD.bind("F", 70, function(e) {
		if(e.shiftKey) index.setScaler(new AlmostFitScaler(index.scrollView));
	});

	KBD.bind("{", 219, function(e) {
		if(e.shiftKey) index.last(index.scrollView.readingDirection.rtl);
	});
	KBD.bind("}", 221, function(e) {
		if(e.shiftKey) index.last(index.scrollView.readingDirection.ltr);
	});

	KBD.bind("O", 79, function(e) {
		if(e.shiftKey && config.open) config.open();
	});
	KBD.bind("R", 82, function(e) {
		if(e.shiftKey && config.showOriginal) config.showOriginal(index.node);
	});

	KBD.bind("`", 192, function(e) {
		if(!e.shiftKey) index.setScaler(new FitScaler(index.scrollView, "min"));
	});
	KBD.bind("1", 49, function(e) {
		if(!e.shiftKey && !e.numberPad) index.setScaler(new ProportionalScaler(index.scrollView, 1));
	});
	KBD.bind("2", 50, function(e) {
		if(!e.shiftKey && !e.numberPad) index.setScaler(new ProportionalScaler(index.scrollView, 2));
	});
	KBD.bind("0", 48, function(e) {
		if(!e.shiftKey && !e.numberPad) index.setScaler(new ProportionalScaler(index.scrollView, 0.5));
	});

	KBD.bind("[", 219, function(e) {
		if(!e.shiftKey) index.next(index.scrollView.readingDirection.rtl);
	});
	KBD.bind("]", 221, function(e) {
		if(!e.shiftKey) index.next(index.scrollView.readingDirection.ltr);
	});

	KBD.bind("t", 84, function(e) {
		if(!e.shiftKey) index.showThumbnailBrowser();
	});
	KBD.bind("m", 77, function(e) {
		if(!e.shiftKey) index.showOptions();
	});
	KBD.bind("i", 73, function(e) {
		if(!e.shiftKey) index.setReadingDirection(new ReadingDirection(true));
	});
	KBD.bind("o", 79, function(e) {
		if(!e.shiftKey) index.setReadingDirection(new ReadingDirection(false));
	});

	KBD.bind("k", 75, function(e) {
		if(!e.shiftKey) index.skipForward(true);
	});
	KBD.bind("l", 76, function(e) {
		if(!e.shiftKey) index.folderLast(true);
	});
	KBD.bind("K", 75, function(e) {
		if(e.shiftKey) index.skipForward(false);
	});
	KBD.bind("L", 76, function(e) {
		if(e.shiftKey) index.folderLast(false);
	});
};
