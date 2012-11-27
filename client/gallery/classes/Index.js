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
	index.cancel = function(){};
	index.sortOrder = "name";
	index.reversed = false;
	index.repeat = true;
	index.clickAction = null;

	index.scrollView = new ScrollView();
	index.scrollView.setScaler(Scaler.parse(localStorage.getItem("scaler"), index.scrollView));
	index.scrollView.setReadingDirection(ReadingDirection.parse(localStorage.getItem("readingDirection")));
	// TODO: Shouldn't we use the regular index.setXXX() system for loading these?

	index.setSortOrder(localStorage.getItem("sortOrder"));
	index.setClickAction(localStorage.getItem("clickAction"));

	index.scrollView.element._onclick = function(event) {
		var primaryClick = 2 != event.button;
		var noShift = !event.shiftKey;
		var singleFinger = true; // TODO: Detect this.
		var forward = primaryClick === noShift === singleFinger;
		Index.clickAction[index.clickAction](index, forward);
	};
	index.scrollView.onPageChange = function(dir) { // `dir` is in logical coordinates.
		if(dir.w < 0) index.next(false); else
		if(dir.w > 0) index.next(true);
	};
	index.element.appendChild(index.scrollView.element);
	index.registerShortcuts();
	index.registerScalingShortcuts();
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
			if(index.page.element) index.scrollView.setPage(index.page, node.position || index.scrollView.endPosition(false));
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
Index.prototype.sort = function(items) {
	var index = this;
	var order = index.sortOrder;
	if("random" === order) {
		// TODO: Implement.
	} else {
		var sort = Node.compare[order];
		var factor = index.reversed ? -1 : 1;
		items.sort(function(a, b) {
			return sort(a, b) * factor;
		});
	}
};
Index.prototype.setSortOrder = function(order, reversed) {
	var index = this;
	var o = bt.hasOwnProperty(Node.compare, order) ? order : index.sortOrder;
	var r = Boolean(reversed) === reversed ? reversed : index.reversed;
	if(o === index.sortOrder && r === index.reversed) return;
	index.sortOrder = o;
	index.reversed = r;
	index.root.sort();
	// TODO: Update thumbnailBrowser if shown.
	// TODO: Update menu selection if shown.
};
Index.prototype.setClickAction = function(action) {
	var index = this;
	var defaultAction = env.touch ? "scroll" : "pageChange";
	index.clickAction = bt.hasOwnProperty(Index.clickAction, action) ? action : defaultAction;
	localStorage.setItem("clickAction", index.clickAction);
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
	index.scrollView.scrollTo(index.scrollView.endPosition(false));
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
			index.cancel();
			index.scrollView.setActive(false);
			index.element.appendChild(index.thumbnailBrowser.element);
			index.thumbnailBrowser.show(index.node);
			index.thumbnailBrowser.onclose = function(event) {
				if(event && event.shiftKey) return;
				index.cancel();
			};
			index.cancel = function() {
				DOM.remove(index.thumbnailBrowser.element);
				index.scrollView.setActive(true);
				index.thumbnailBrowser = null;
				index.cancel = function(){};
			};
		});
	});
};
Index.prototype.showOptions = function() {
	var index = this;
	if(index.menu) return;
	index.cancel();
	index.menu = new Menu(index);
	index.scrollView.setActive(false);
	index.element.appendChild(index.menu.element);
	index.menu.scrollView.reflow(); // FIXME: Hack.
	index.menu.onclose = function(event) {
		if(event && event.shiftKey) return;
		index.cancel();
	};
	index.cancel = function() {
		DOM.remove(index.menu.element);
		index.scrollView.setActive(true);
		index.menu = null;
		index.cancel = function(){};
	};
};
Index.prototype.showAbout = function() {
	var index = this;
	index.cancel();
	var about = new About();
	index.scrollView.setActive(false);
	index.element.appendChild(about.element);
	about.scrollView.reflow(); // FIXME: Hack.
	about.onclose = function(event) {
		if(event && event.shiftKey) return;
		index.cancel();
	};
	index.cancel = function() {
		DOM.remove(about.element);
		index.scrollView.setActive(true);
		index.cancel = function(){};
	};
};
Index.prototype.registerShortcuts = function() {
	var index = this;
	KBD.bind({char: "a", key: 65, shift: true}, function(e) {
		index.setScaler(new ProportionalScaler(index.scrollView, 1));
	});
	KBD.bind({char: "s", key: 83, shift: true}, function(e) {
		index.setScaler(new FitScaler(index.scrollView, "min"));
	});
	KBD.bind({char: "d", key: 68, shift: true}, function(e) {
		index.setScaler(new FitScaler(index.scrollView, "max"));
	});
	KBD.bind({char: "f", key: 70, shift: true}, function(e) {
		index.setScaler(new AlmostFitScaler(index.scrollView));
	});

	// FIXME: On a keyboard where shift-[] isn't {}, what should we do?
	// Adding a second binding on {char: "[", shift: true} doesn't help, because shift-[ will produce some other character.
	KBD.bind({char: "{", key: 219, shift: true}, function(e) {
		index.last(index.scrollView.readingDirection.rtl);
	});
	KBD.bind({char: "}", key: 221, shift: true}, function(e) {
		index.last(index.scrollView.readingDirection.ltr);
	});

	KBD.bind({char: "o", key: 79, shift: true}, function(e) {
		if(config.open) config.open();
	});
	KBD.bind({char: "r", key: 82, shift: true}, function(e) {
		if(config.showOriginal) config.showOriginal(index.node);
	});

	KBD.bind({char: "1", key: 49, shift: true}, function(e) {
		index.setSortOrder("name");
	});
	KBD.bind({char: "2", key: 50, shift: true}, function(e) {
		index.setSortOrder("size");
	});
	KBD.bind({char: "3", key: 51, shift: true}, function(e) {
		index.setSortOrder("mtime");
	});
	KBD.bind({char: "4", key: 52, shift: true}, function(e) {
		index.setSortOrder("ctime");
	});
	KBD.bind({char: "`", key: 192, shift: true}, function(e) {
		index.setSortOrder("random");
	});

	KBD.bind({char: "`", key: 192}, function(e) {
		index.setScaler(new FitScaler(index.scrollView, "min"));
	});
	KBD.bind({char: "1", key: 49}, function(e) {
		index.setScaler(new ProportionalScaler(index.scrollView, 1));
	});
	KBD.bind({char: "2", key: 50}, function(e) {
		index.setScaler(new ProportionalScaler(index.scrollView, 2));
	});
	KBD.bind({char: "0", key: 48}, function(e) {
		index.setScaler(new ProportionalScaler(index.scrollView, 0.5));
	});

	KBD.bind({char: "[", key: 219}, function(e) {
		index.next(index.scrollView.readingDirection.rtl);
	});
	KBD.bind({char: "]", key: 221}, function(e) {
		index.next(index.scrollView.readingDirection.ltr);
	});

	KBD.bind({char: "t", key: 84}, function(e) {
		index.showThumbnailBrowser();
	});
	KBD.bind({char: "m", key: 77}, function(e) {
		index.showOptions();
	});
	KBD.bind({char: "i", key: 73}, function(e) {
		index.setReadingDirection(new ReadingDirection(true));
	});
	KBD.bind({char: "o", key: 79}, function(e) {
		index.setReadingDirection(new ReadingDirection(false));
	});

	KBD.bind({char: "k", key: 75, shift: null}, function(e) {
		index.skipForward(!e.shift);
	});
	KBD.bind({char: "l", key: 76, shift: null}, function(e) {
		index.folderLast(!e.shift);
	});

	KBD.bind({key: 27}, function(e) { // Esc
		index.cancel();
	});
};
Index.prototype.registerScalingShortcuts = function() {
	var index = this;
	// TODO: Implement.
	KBD.bind({char: "-", key: 189}, function(e) {
		
	});
	KBD.bind({char: "=", key: 187}, function(e) {
		
	});
	KBD.bind({char: "_", key: 189, shift: true}, function(e) {
		
	});
	KBD.bind({char: "+", key: 187, shift: true}, function(e) {
		
	});
	KBD.addEventListener("keyup", function(e) {
		
	});
};

Index.clickAction = {};
Index.clickAction["pageChange"] = function(index, forward) {
	index.next(forward);
};
Index.clickAction["scroll"] = function(index, forward) {
	var mag = forward ? 1 : -1;
	index.scrollView.smartScroll(new Size(0, 1).scale(mag), new Size(1, 0).scale(mag));
};
