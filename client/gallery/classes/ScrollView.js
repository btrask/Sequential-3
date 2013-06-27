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

/*global KBD DOM bt*/
/*global Geometry Size Point Rect*/
/*global RelativeScroller ReadingDirection*/
/*global AlmostFitScaler*/
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
	};
	animation.clear = function(obj) {
		if(obj) obj.go = false;
	};
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
	scrollView.onPageChange = function(dir){}; // `dir` is in logical coordinates (normalized for reading direction).

	DOM.addListener(window, "resize", function() {
		var s = scrollView.offset();
		scrollView.reflow();
		scrollView.scrollToOffset(s);
	});
	DOM.addListener(scrollView.element, "contextmenu", function(event) {
//		var props = [];
//		for(var x in event) props.push(x+"="+event[x]);
//		console.log(props.join(", "));
		DOM.preventDefault(event);
		return false;
	});

	scrollView.registerShortcuts();
	scrollView.registerScrollShortcuts();
	scrollView.registerScrollWheel();
	scrollView.registerMouseAndTouches();
}

ScrollView.prototype.reflow = function() {
	var scrollView = this;
	if(!scrollView.page || !scrollView.page.element) return;
	scrollView.bounds.s = Size.fromElement(scrollView.element);
	scrollView.page.rescale(scrollView.scaler);
	var pageSize = Size.fromElement(scrollView.page.element);
	var center = scrollView.bounds.s.scale(1 / 2);
	scrollView.scrollableRect.o = center.difference(pageSize.scale(1 / 2)).pointFromOrigin().clamp(scrollView.bounds);
	scrollView.scrollableRect.s = pageSize.difference(scrollView.bounds.s).clamp(Rect.make(0, 0, 9e9, 9e9));
	scrollView.setPosition(scrollView.position.clamp(scrollView.scrollableRect), true); // Reclamp.
};
ScrollView.prototype.offset = function(dir) {
	var scrollView = this;
	if(!scrollView.page || !scrollView.page.borderSize) return Size.zero;
	var d = dir || scrollView.readingDirection.size.scale(-1);
	var document = new Rect(scrollView.scrollableRect.o, Size.fromElement(scrollView.page.element));
	var bounds = new Rect(scrollView.position, scrollView.bounds.s);
	return bounds.point(d).distance(document.point(d)).quotient(document.s);
};
ScrollView.prototype.scrollToOffset = function(offset, dir) {
	var scrollView = this;
	var current = scrollView.offset(dir);
	var docSize = Size.fromElement(scrollView.page.element);
	scrollView.scrollBy(offset.difference(current).product(docSize));
};

ScrollView.prototype.setPosition = function(position, reset) {
	var scrollView = this;
	if(position.x === scrollView.position.x && position.y === scrollView.position.y && !reset) return;
	scrollView.position = position;
	if(!scrollView.page || !scrollView.page.element) return;
	var pos = scrollView.position.distance(scrollView.scrollableRect.o);
	var flippedPosition = scrollView.scrollableRect.o.offset(pos.scale(-1));
	scrollView.page.element.style.left = String(Math.round(flippedPosition.x)) + "px";
	scrollView.page.element.style.top = String(Math.round(flippedPosition.y)) + "px";
};
ScrollView.prototype.scrollTo = function(position) { // Returns the distance scrolled.
	var scrollView = this;
	var oldPos = scrollView.position;
	scrollView.setPosition(position.clamp(scrollView.scrollableRect));
	return scrollView.position.distance(oldPos);
};
ScrollView.prototype.scrollBy = function(size) { // Returns the distance scrolled.
	var scrollView = this;
	return scrollView.scrollTo(scrollView.position.offset(size));
};
ScrollView.prototype.scrollByPage = function(dir) { // Returns the distance scrolled.
	var scrollView = this;
	return scrollView.scrollBy(scrollView.pageDistanceInDirection(dir));
};
ScrollView.prototype.smartScroll = function(d1, d2) {
	var scrollView = this;
	var dir = scrollView.readingDirection.size;
	var a = d1.product(dir);
	var x = scrollView.pageDistanceInDirection(a);
	if(x.w || x.h) return scrollView.scrollBy(x);
	var b = d2.product(dir);
	var y = scrollView.pageDistanceInDirection(b);
	if(y.w || y.h) return scrollView.scrollBy(y.sum(a.scale(-9e9)));
	scrollView.onPageChange(d1.sum(d2));
};
ScrollView.prototype.smarterScroll = function(forward) {
	var scrollView = this;
	var mag = forward ? 1 : -1;
	var v = new Size(0, mag), h = new Size(mag, 0);
	var s = scrollView.page.originalSize;
	if(s.w > s.h) scrollView.smartScroll(v, h);
	else scrollView.smartScroll(h, v);
};

ScrollView.prototype.endPosition = function(end) {
	var scrollView = this;
	return scrollView.readingDirection.size.scale(end ? 9e9 : -9e9).pointFromOrigin();
};
ScrollView.prototype.scrollDistanceInDirection = function(direction) {
	var scrollView = this;
	var potentialRect = new Rect(scrollView.position, direction.scale(9e9));
	var scrollDistance = scrollView.scrollableRect.intersect(potentialRect).s;
	return scrollDistance.clamp(Rect.make(0, 0, 9e9, 9e9));
};
ScrollView.prototype.pageDistanceInDirection = function(direction) {
	var scrollView = this;
	var scrollDistance = scrollView.scrollDistanceInDirection(direction);
	var maxPageDistance = scrollView.bounds.s.product(direction).scale(0.85);
	var steps = scrollDistance.quotient(maxPageDistance).roundFromZero();
	var evenDistance = scrollDistance.quotient(steps).roundFromZero(); // These also produce NaNs...
	if(isNaN(evenDistance.w)) evenDistance.w = 0;
	if(isNaN(evenDistance.h)) evenDistance.h = 0;
	return evenDistance;
};
ScrollView.prototype.setPage = function(page, position) {
	var scrollView = this;
	var old = scrollView.page;
	scrollView.page = page || null;
	scrollView.position = position || new Point(0, 0);
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
		flag = !!flag;
		if(flag === animating) return;
		var old = !!scrollView.animationCount;
		animating = flag;
		scrollView.animationCount += flag ? 1 : -1;
		if(old === flag) return;
		DOM.classify(document.body, "performance", flag);
	};
};

ScrollView.prototype.registerShortcuts = function() {
	var scrollView = this;
	function bind(event, listener) {
		KBD.bind(event, function(e) {
			if(scrollView.active) listener(e);
		});
	}
	function smartScroll(forward, d1, d2) {
		var mag = forward ? 1 : -1;
		scrollView.smartScroll(d1.scale(mag), d2.scale(mag));
	}
	function scrollToEnd(forward) {
		var d = scrollView.scrollTo(scrollView.endPosition(forward));
		if(!d.max()) scrollView.onPageChange(forward ? new Size(1, 1) : new Size(-1, -1));
	}
	function scrollByPage(dir) {
		var d = scrollView.scrollByPage(dir);
		if(!d.max()) scrollView.onPageChange(scrollView.readingDirection.size.product(dir));
	}

	bind({char: " ", key: 32, shift: null}, function(e) {
		scrollView.smarterScroll(!e.shift);
	});
	bind({char: "c", key: 67, shift: null}, function(e) {
		smartScroll(e.shift, new Size(0, 1), new Size(1, 0));
	});
	bind({char: "v", key: 86, shift: null}, function(e) {
		smartScroll(!e.shift, new Size(0, 1), new Size(1, 0));
	});
	bind({char: "b", key: 66, shift: null}, function(e) {
		smartScroll(e.shift, new Size(1, 0), new Size(0, 1));
	});
	bind({char: "n", key: 78, shift: null}, function(e) {
		smartScroll(!e.shift, new Size(1, 0), new Size(0, 1));
	});

	bind({key: 36}, function(e) { // Home
		scrollToEnd(false);
	});
	bind({key: 33}, function(e) { // Page Up
		smartScroll(false, new Size(0, 1), new Size(1, 0));
	});
	bind({key: 34}, function(e) { // Page Down
		smartScroll(true, new Size(0, 1), new Size(1, 0));
	});
	bind({key: 35}, function(e) { // End
		scrollToEnd(true);
	});

	bind({char: "1", key: 97, numberPad: true}, function(e) {
		scrollByPage(new Size(-1, 1));
	});
	bind({char: "2", key: 98, numberPad: true}, function(e) {
		scrollByPage(new Size(0, 1));
	});
	bind({char: "3", key: 99, numberPad: true}, function(e) {
		scrollByPage(new Size(1, 1));
	});
	bind({char: "4", key: 100, numberPad: true}, function(e) {
		scrollByPage(new Size(-1, 0));
	});
	bind({char: "5", key: 101, numberPad: true}, function(e) {
		scrollByPage(new Size(0, 1));
	});
	bind({char: "6", key: 102, numberPad: true}, function(e) {
		scrollByPage(new Size(1, 0));
	});
	bind({char: "7", key: 103, numberPad: true}, function(e) {
		scrollByPage(new Size(-1, -1));
	});
	bind({char: "8", key: 104, numberPad: true}, function(e) {
		scrollByPage(new Size(0, -1));
	});
	bind({char: "9", key: 105, numberPad: true}, function(e) {
		scrollByPage(new Size(1, -1));
	});
};
ScrollView.prototype.registerScrollShortcuts = function() {
	var scrollView = this;
	var scrollDirectionByKey = {};
	var scrollDirection = new Size(0, 0);
	var scrollCount = 0;
	var scrollTimer = null;
	var setAnimating = scrollView.animator();

	function updateDirection() {
		var total = new Size(0, 0);
		bt.map(scrollDirectionByKey, function(dir) {
			total = total.sum(dir);
		});
		scrollDirection = total.clamp(Rect.make(-1, -1, 2, 2));
	}
	function scrollKeyDown(event, direction) {
		if(event.shiftKey) return;
		if(!scrollView.active) return;
		if(bt.hasOwnProperty(scrollDirectionByKey, event.key)) return;
		scrollDirectionByKey[event.key] = direction;
		updateDirection();
		// TODO: How do I make JSHint accept this without parens? It's perfectly clear.
		if(!scrollCount++) scrollTimer = animation.start(function(scale) {
			var velocity = scrollView.scrollBy(scrollDirection.scale(scale * 10));
			setAnimating(velocity.w || velocity.h);
		});
	}
	function bind(key, direction) {
		KBD.bind({key: key}, function(event) {
			scrollKeyDown(event, direction);
		});
	}
	(function() { var
	d = new Size( 0, -1); bind(87, d); bind(38, d); // w, up
	d = new Size(-1,  0); bind(65, d); bind(37, d); // a, left
	d = new Size( 0,  1); bind(83, d); bind(40, d); // s, down
	d = new Size( 1,  0); bind(68, d); bind(39, d); // d, right
	})();
	KBD.addEventListener("keyup", function(e) {
		if(!bt.hasOwnProperty(scrollDirectionByKey, e.key)) return;
		delete scrollDirectionByKey[e.key];
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
		var x = event.wheelDeltaX || 0;
		var y = event.wheelDeltaY || event.wheelDelta || 0;
		scrollView.scrollBy(new Size(-x, -y)); // TODO: Check the resulting magnitude before optimizing.
	});
	DOM.addListener(document, "DOMMouseScroll", function(event) { // Gecko.
		if(!scrollView.active) return true;
		var size = 1 === event.axis ? new Size(event.detail, 0) : new Size(0, event.detail);
		animateTemporarily();
		scrollView.scrollBy(size.scale(5)); // TODO: Check the resulting magnitude before optimizing.
	});
};
ScrollView.prototype.registerMouseAndTouches = function() {
	var scrollView = this;
	function addListener(startEvent, moveEvent, endEvent, useTouch) {
		DOM.addListener(scrollView.element, startEvent, function(firstEvent) {
			if(!scrollView.active) {
				DOM.preventDefault(firstEvent);
				return false;
			}
			var scroller = new scrollView.scroller(scrollView, firstEvent);
			var move, end;
			DOM.addListener(document, moveEvent, move = function(event) {
				scroller.update(event);
				DOM.preventDefault(event);
				return false;
			});
			DOM.addListener(document, endEvent, end = function(event) {
				DOM.removeListener(document, moveEvent, move);
				DOM.removeListener(document, endEvent, end);
				scroller.end();
				DOM.preventDefault(event);
				return false;
			});
			DOM.preventDefault(firstEvent);
			return false;
		});
	}
	addListener("mousedown", "mousemove", "mouseup");
	addListener("touchstart", "touchmove", "touchend");
};
