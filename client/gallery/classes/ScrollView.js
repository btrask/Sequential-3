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
function onclick(element) { // TODO: Put me somewhere.
	if(!element) return function() {};
	return element._onclick || onclick(element.parentNode);
}

var animation = {};
(function() {
	var frameRate = 1000 / 60;
	var req = window.requestAnimationFrame || 
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function(callback) {
			window.setTimeout(function() {
				callback(+new Date);
			}, frameRate);
		};
	animation.start = function(func) {
		var obj = { go: true }, last;
		function next(time) {
			if(!obj.go) return;
			func(undefined !== last ? (time - last) / frameRate : 1);
			last = time;
			req(next);
		}
		next(undefined);
		return obj;
	}
	animation.clear = function(obj) {
		if(obj) obj.go = false;
	}
})();


function ScrollView() {
	var scrollView = this;

	scrollView.element = DOM.clone("scrollView", scrollView);

	scrollView.bounds = Rect.make(0, 0, 0, 0);
	scrollView.scrollableRect = Rect.make(0, 0, 0, 0);
	scrollView.position = new Point(0, 0);
	scrollView.page = null;

	scrollView.scroller = RelativeScroller; // TODO: Configurable.
	scrollView.active = true;
	scrollView.scaler = new AlmostFitScaler(scrollView);
	scrollView.readingDirection = new ReadingDirection(true);
	scrollView.animationCount = 0;

	DOM.addListener(window, "resize", function() {
		scrollView.reflow();
	});
	DOM.addListener(scrollView.element, "contextmenu", function(event) {
//		var props = [];
//		for(var x in event) props.push(x+"="+event[x]);
//		console.log(props.join(", "));
		event.preventDefault();
		return false;
	});
	DOM.addListener(scrollView.element, "mousedown", function(firstEvent) {
		if(!scrollView.active) {
			event.preventDefault();
			return false;
		}
		var scroller = new scrollView.scroller(scrollView, firstEvent);
		var onmousemove, onmouseup;
		DOM.addListener(document, "mousemove", onmousemove = function(event) {
			scroller.update(Point.fromEvent(event));
			event.preventDefault();
			return false;
		});
		DOM.addListener(document, "mouseup", onmouseup = function(event) {
			DOM.removeListener(document, "mousemove", onmousemove);
			DOM.removeListener(document, "mouseup", onmouseup);
			scroller.end();
			event.preventDefault();
			return false;
		});
		firstEvent.preventDefault();
		return false;
	});

	// TODO: These probably belong in Index.
	KBD.bind("-", 189, function(e) {
		//if(!e.shiftKey); // TODO: Implement.
	});
	KBD.bind("=", 187, function(e) {
		//if(!e.shiftKey); // TODO: Implement.
	});

	scrollView.registerShortcuts();
	scrollView.registerScrollShortcuts();
	scrollView.registerScrollWheel();
}
ScrollView.pageSizeRatio = 0.85;

ScrollView.prototype.reflow = function() {
	var scrollView = this;
	if(!scrollView.page || !scrollView.page.element) return;
	scrollView.page.rescale(scrollView.scaler);
	var pageSize = Size.fromElement(scrollView.page.element);
	scrollView.bounds.s = Size.fromElement(scrollView.element);
	var center = scrollView.bounds.s.scale(1 / 2).difference(pageSize.scale(1 / 2)).pointFromOrigin().clamp(new Rect(new Point(0, 0), scrollView.bounds.s));
	scrollView.scrollableRect.s = pageSize.difference(scrollView.bounds.s);
	scrollView.scrollableRect.o = center.offset(scrollView.scrollableRect.s.scale(-1));
	scrollView.setPosition(scrollView.position.clamp(scrollView.scrollableRect)); // Reclamp.
};

ScrollView.prototype.setPosition = function(position, reset) {
	var scrollView = this;
	if(position.x === scrollView.position.x && position.y === scrollView.position.y && !reset) return;
	scrollView.position = position;
	if(!scrollView.page || !scrollView.page.element) return;
	scrollView.page.element.style.left = String(Math.round(scrollView.position.x)) + "px";
	scrollView.page.element.style.top = String(Math.round(scrollView.position.y)) + "px";
}
ScrollView.prototype.scrollTo = function(position) { // Returns the clamped position.
	var scrollView = this;
	scrollView.setPosition(position.clamp(scrollView.scrollableRect));
	return scrollView.position;
};
ScrollView.prototype.scrollBy = function(size) { // Returns the clamped size.
	var scrollView = this;
	var oldPos = scrollView.position;
	return scrollView.scrollTo(scrollView.position.offset(size)).distance(oldPos);
};
ScrollView.prototype.homePosition = function(home) {
	var scrollView = this;
	return scrollView.readingDirection.size.scale(home ? Infinity : -Infinity).pointFromOrigin();
};
ScrollView.prototype.pageSize = function(direction) {
	var scrollView = this;
	return scrollView.bounds.s.scale(ScrollView.pageSizeRatio).product(direction);
};
ScrollView.prototype.setPage = function(page, position) {
	var scrollView = this;
	var old = scrollView.page;
	scrollView.page = page || null;
	scrollView.setPosition(position, true); // We don't need to clamp because we clamp when we reflow().
	DOM.fill(scrollView.element, page.element);
	scrollView.reflow();
};

ScrollView.prototype.setActive = function(flag) {
	var scrollView = this;
	scrollView.active = Boolean(flag);
	DOM.classify(scrollView.element, "inactive", !scrollView.active);
};
ScrollView.prototype.setScaler = function(scaler) {
	var scrollView = this;
	scrollView.scaler = scaler;
	scrollView.reflow();
};
ScrollView.prototype.setReadingDirection = function(readingDirection) {
	var scrollView = this;
	scrollView.readingDirection = readingDirection;
	readingDirection.classify(scrollView.element);
//	scrollView.element.setAttribute("dir", readingDirection.ltr ? "ltr" : "rtl");
};
ScrollView.prototype.animator = function() {
	var scrollView = this;
	var animating = false;
	return function(flag) {
		if(flag === animating) return;
		var old = !!scrollView.animationCount;
		animating = flag;
		scrollView.animationCount += flag ? 1 : -1;
		if(old === flag) return;
		DOM.classify(scrollView.page.element, "optimize-speed", flag);
	};
};

ScrollView.prototype.registerShortcuts = function() {
	var scrollView = this;

	KBD.bind(null, 36, function(e) { // Home
		scrollView.scrollTo(scrollView.homePosition(true));
	});
	KBD.bind(null, 33, function(e) { // Page Up
		scrollView.scrollBy(scrollView.pageSize(new Size(0, 1)));
	});
	KBD.bind(null, 34, function(e) { // Page Down
		scrollView.scrollBy(scrollView.pageSize(new Size(0, -1)));
	});
	KBD.bind(null, 35, function(e) { // End
		scrollView.scrollTo(scrollView.homePosition(false));
	});

	KBD.bind("1", 97, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(1, -1)));
	});
	KBD.bind("2", 98, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(0, -1)));
	});
	KBD.bind("3", 99, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(-1, -1)));
	});
	KBD.bind("4", 100, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(1, 0)));
	});
	KBD.bind("5", 101, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(0, -1)));
	});
	KBD.bind("6", 102, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(-1, 0)));
	});
	KBD.bind("7", 103, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(1, 1)));
	});
	KBD.bind("8", 104, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(0, 1)));
	});
	KBD.bind("9", 105, function(e) {
		if(e.numberPad) scrollView.scrollBy(scrollView.pageSize(new Size(-1, 1)));
	});
};
ScrollView.prototype.registerScrollShortcuts = function() {
	var scrollView = this;
	var scrollDirectionByKeyCode = {};
	var scrollDirection = new Size(0, 0);
	var scrollCount = 0;
	var scrollTimer = null;
	var setAnimating = scrollView.animator();

	function updateDirection() {
		scrollDirection = new Size(0, 0);
		bt.map(scrollDirectionByKeyCode, function(direction) {
			scrollDirection.w += direction.w;
			scrollDirection.h += direction.h;
		});
		scrollDirection.w = Geometry.clampMax(-1, scrollDirection.w, 1);
		scrollDirection.h = Geometry.clampMax(-1, scrollDirection.h, 1); // TODO: We might want to add size.clamp().
	}
	function scrollKeyDown(event, direction) {
		if(event.shiftKey) return;
		if(!scrollView.active) return;
		if(bt.hasOwnProperty(scrollDirectionByKeyCode, event.keyCode)) return;
		scrollDirectionByKeyCode[event.keyCode] = direction;
		updateDirection();
		if(!scrollCount++) scrollTimer = animation.start(function(scale) {
			var velocity = scrollView.scrollBy(scrollDirection.scale(scale * 10));
			setAnimating(velocity.w || velocity.h);
		});
	}
	function bind(char, keyCode, direction) {
		KBD.bind(char, keyCode, function(event) {
			scrollKeyDown(event, direction);
		});
	}
	(function() { var
	d = new Size( 0,  1); bind("w", 87, d); bind(null, 38, d);
	d = new Size( 1,  0); bind("a", 65, d); bind(null, 37, d);
	d = new Size( 0, -1); bind("s", 83, d); bind(null, 40, d);
	d = new Size(-1,  0); bind("d", 68, d); bind(null, 39, d);
	})();
	KBD.addEventListener("keyup", function(e) {
		if(!bt.hasOwnProperty(scrollDirectionByKeyCode, e.keyCode)) return;
		delete scrollDirectionByKeyCode[e.keyCode];
		updateDirection();
		if(--scrollCount) return;
		animation.clear(scrollTimer);
		scrollTimer = null;
		setAnimating(false);
	});
};
ScrollView.prototype.registerScrollWheel = function() {
	// TODO: We should try to use touch events instead, I think.
	var scrollView = this;
	var animationTimeout = null;
	var setAnimating = scrollView.animator();
	function animateTemporarily() {
		if(!scrollView.page || !scrollView.page.element) return;
		setAnimating(true);
		clearTimeout(animationTimeout);
		animationTimeout = setTimeout(function() {
			setAnimating(false);
		}, 1000 * 0.2);
	}
	DOM.addListener(document, "mousewheel", function(event) { // Sane browsers.
		if(!scrollView.active) return true;
		animateTemporarily();
		scrollView.scrollBy(new Size(event.wheelDeltaX, event.wheelDeltaY)); // TODO: Check the resulting magnitude before optimizing.
	});
	DOM.addListener(document, "DOMMouseScroll", function(event) { // Gecko.
		if(!scrollView.active) return true;
		var size = 1 === event.axis ? new Size(event.detail, 0) : new Size(0, event.detail);
		animateTemporarily();
		scrollView.scrollBy(size.scale(5)); // TODO: Check the resulting magnitude before optimizing.
	});
};
