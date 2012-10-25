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
function Menu(index) {
	var menu = this;
	menu.onclose = null;
	menu.scrollView = new ScrollView();
	menu.scrollView.element._onclick = function() {
		if(menu.onclose) menu.onclose();
	};
	menu.element = menu.scrollView.element;
	menu.content = DOM.clone("menu", menu);

	menu.commands = new Submenu(menu, "Commands");
	menu.navigation = new NavigationSubmenu(menu);
	menu.readingDirection = new Submenu(menu, "Reading Direction");
	menu.scalingMode = new Submenu(menu, "Scaling Mode");
	menu.sortOrder = new Submenu(menu, "Sort Order");
	menu.sortDirection = new Submenu(menu, "Sort Direction");
	menu.repeat = new Submenu(menu, "Repeat");

	menu.commands.addItem("Browse", "T", function(event) {
		index.showThumbnailBrowser();
	});
	if(config.showOriginal) menu.commands.addItem("Show Original", "Shift-R", function(event) {
		config.showOriginal(index.node);
	});
	if(config.open) menu.commands.addItem("Open", "Shift-O", function(event) {
		config.open();
	});
	menu.commands.addItem("About", "", function() {});

	menu.navigation["previous"]._onclick = function(event) {
		if(menu.onclose) menu.onclose(event);
		index.next(false);
	};
	menu.navigation["next"]._onclick = function(event) {
		if(menu.onclose) menu.onclose(event);
		index.next(true);
	};
	menu.navigation["first"]._onclick = function(event) {
		if(menu.onclose) menu.onclose(event);
		index.last(false);
	};
	menu.navigation["last"]._onclick = function(event) {
		if(menu.onclose) menu.onclose(event);
		index.last(true);
	};
	menu.navigation["skipPrevious"]._onclick = function() {
		if(menu.onclose) menu.onclose(event);
		index.skipForward(false);
	};
	menu.navigation["skipNext"]._onclick = function() {
		if(menu.onclose) menu.onclose(event);
		index.skipForward(true);
	};
	menu.navigation["folderFirst"]._onclick = function() {
		if(menu.onclose) menu.onclose(event);
		index.folderLast(false);
	};
	menu.navigation["folderLast"]._onclick = function() {
		if(menu.onclose) menu.onclose(event);
		index.folderLast(true);
	};

	function addReadingDirection(title, shortcut, readingDirection) {
		var item = menu.readingDirection.addItem(title, shortcut, function(event, item) {
			menu.readingDirection.selectItem(item); // FIXME: We won't need the `item` argument because calling index.setReadingDirection() should select the item for us (so that keyboard shortcuts update us too).
			index.setReadingDirection(readingDirection);
		});
		if(index.scrollView.readingDirection.stringify() === readingDirection.stringify()) menu.readingDirection.selectItem(item);
	}
	addReadingDirection("Left to Right", "I", new ReadingDirection(true));
	addReadingDirection("Right to Left", "O", new ReadingDirection(false));

	function addScalingMode(title, shortcut, scaler) {
		var item = menu.scalingMode.addItem(title, shortcut, function(event, item) {
			menu.scalingMode.selectItem(item);
			index.setScaler(scaler);
		});
		if(index.scrollView.scaler.stringify() === scaler.stringify()) menu.scalingMode.selectItem(item);
	}
	addScalingMode("Actual Size", "Shift-A or 1", new ProportionalScaler(index.scrollView, 1));
	addScalingMode("Scale to Fit", "Shift-S or `", new FitScaler(index.scrollView, "min"));
	addScalingMode("Fit Width/Height", "Shift-D", new FitScaler(index.scrollView, "max"));
	addScalingMode("Automatic Fit", "Shift-F", new AlmostFitScaler(index.scrollView));
	addScalingMode("½× Size", "0", new ProportionalScaler(index.scrollView, 0.5));
	addScalingMode("2× Size", "2", new ProportionalScaler(index.scrollView, 2));

	function changeSortOrder(obj) {
		return function(event, item) {
			menu.sortOrder.selectItem(item);
		};
	}
	menu.sortOrder.addItem("By Name", "Shift-1", changeSortOrder(null));
	menu.sortOrder.addItem("By Size", "Shift-2", changeSortOrder(null));
	menu.sortOrder.addItem("By Date Modified", "Shift-3", changeSortOrder(null));
	menu.sortOrder.addItem("By Date Created", "Shift-4", changeSortOrder(null));
	menu.sortOrder.addItem("Shuffle", "Shift-`", changeSortOrder(null));

	function changeSortDirection(obj) {
		return function(event, item) {
			menu.sortDirection.selectItem(item);
		};
	}
	menu.sortDirection.addItem("Ascending", "", changeSortDirection(null));
	menu.sortDirection.addItem("Descending", "", changeSortDirection(null));

	function changeRepeat(obj) {
		return function(event, item) {
			menu.repeat.selectItem(item);
		};
	}
	menu.repeat.addItem("Repeat All", "", changeRepeat(null));
	menu.repeat.addItem("Repeat None", "", changeRepeat(null));

	menu.scrollView.setPage(new GenericPage(menu.content), new Point(0, 0));
}

function Submenu(menu, title) {
	var submenu = this;
	submenu.menu = menu;
	submenu.selection = null;
	submenu.element = DOM.clone("submenu", submenu);
	DOM.fill(submenu["title"], title);
	menu.content.appendChild(submenu.element);
}
Submenu.prototype.addItem = function(title, shortcut, func/* (event, item) */) {
	var submenu = this;
	var elems = {};
	var item = DOM.clone("menuItem", elems);
	DOM.fill(elems["title"], title);
	DOM.fill(elems["shortcut"], shortcut);
	item._onclick = function(event) {
		if(submenu.menu.onclose) submenu.menu.onclose(event);
		func(event, item);
	};
	submenu["items"].appendChild(item);
	return item;
};
Submenu.prototype.selectItem = function(item) {
	var submenu = this;
	if(submenu.selection) DOM.classify(submenu.selection, "selected", false);
	submenu.selection = item;
	if(submenu.selection) DOM.classify(submenu.selection, "selected", true);
};

function NavigationSubmenu(menu) {
	var submenu = this;
	submenu.menu = menu;
	submenu.element = DOM.clone("navigationSubmenu", submenu);
	menu.content.appendChild(submenu.element);
}
