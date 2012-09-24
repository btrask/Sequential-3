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
		next(+new Date);
		return obj;
	}
	animation.clear = function(obj) {
		if(obj) obj.go = false;
	}
})();


function ScrollView() {
	var scrollView = this;
	var bounds = Rect.make(0, 0, 0, 0);
	var busy = false;

	scrollView.scaler = new AlmostFitScaler(scrollView);
	scrollView.setScaler = function(scaler) {
		scrollView.scaler = scaler;
		scrollView.reflow();
	};
	scrollView.readingDirection = new ReadingDirection(true);
	scrollView.setReadingDirection = function(readingDirection) {
		scrollView.readingDirection = readingDirection;
		readingDirection.classify(scrollView.element);
//		scrollView.element.setAttribute("dir", readingDirection.ltr ? "ltr" : "rtl");
	};
	scrollView.homePosition = function(home) {
		return scrollView.readingDirection.size.scale(home ? Infinity : -Infinity).pointFromOrigin();
	};

	scrollView.scroller = RelativeScroller; // TODO: Configurable.

	scrollView.scrollableRect = Rect.make(0, 0, 0, 0);
	scrollView.position = new Point(0, 0);
	scrollView.setPosition = function(position, reset) {
		if(position.x === scrollView.position.x && position.y === scrollView.position.y && !reset) return;
		scrollView.position = position;
		if(!scrollView.content) return;
		scrollView.content.style.left = String(Math.round(scrollView.position.x)) + "px";
		scrollView.content.style.top = String(Math.round(scrollView.position.y)) + "px";
	}
	scrollView.scrollTo = function(position) { // Returns the clamped position.
		scrollView.setPosition(position.clamp(scrollView.scrollableRect));
		return scrollView.position;
	};
	scrollView.scrollBy = function(size) { // Returns the clamped size.
		var oldPos = scrollView.position;
		return scrollView.scrollTo(scrollView.position.offset(size)).distance(oldPos);
	};

	scrollView.rescale = function(){};
	scrollView.reflow = function() {
		if(!scrollView.content) return;
		scrollView.rescale(scrollView.scaler);
		var contentSize = Size.fromElement(scrollView.content);
		bounds.s = Size.fromElement(scrollView.element);
		var center = bounds.s.scale(1 / 2).difference(contentSize.scale(1 / 2)).pointFromOrigin().clamp(new Rect(new Point(0, 0), bounds.s));
		scrollView.scrollableRect.s = contentSize.difference(bounds.s);
		scrollView.scrollableRect.o = center.offset(scrollView.scrollableRect.s.scale(-1));
		scrollView.setPosition(scrollView.position.clamp(scrollView.scrollableRect)); // Reclamp.
	};
	scrollView.setContent = function(content, position, rescale/* (scaler) */) {
		var old = scrollView.content;
		scrollView.content = content || null;
		scrollView.rescale = rescale || function(){};
		scrollView.setPosition(position || new Point(0, 0), true); // We don't need to clamp because we clamp when we reflow().
		// TODO: Instead of accepting falsy values and converting them to {0, 0}, just reject them, I think.
		DOM.fill(scrollView.element, content);
		scrollView.reflow();
	};

	scrollView.active = true;
	scrollView.setActive = function(flag) {
		scrollView.active = Boolean(flag);
		DOM.classify(scrollView.element, "inactive", !scrollView.active);
	};

	DOM.addListener(window, "resize", scrollView.reflow);
	scrollView.element = DOM.clone("scrollView", scrollView);
	DOM.addListener(scrollView.element, "contextmenu", function(event) {
//		var props = [];
//		for(var x in event) props.push(x+"="+event[x]);
//		console.log(props.join(", "));
		event.preventDefault();
		return false;
	});
	DOM.addListener(scrollView.element, "mousedown", function(firstEvent) {
		if(!busy && scrollView.active) {
			var scroller = new scrollView.scroller(scrollView, firstEvent);
			busy = true;
			var onmousemove, onmouseup;
			DOM.addListener(document, "mousemove", onmousemove = function(event) {
				scroller.update(Point.fromEvent(event));
				event.preventDefault();
				return false;
			});
			DOM.addListener(document, "mouseup", onmouseup = function(event) {
				busy = false;
				DOM.removeListener(document, "mousemove", onmousemove);
				DOM.removeListener(document, "mouseup", onmouseup);
				scroller.end();
				event.preventDefault();
				return false;
			});
		}
		firstEvent.preventDefault();
		return false;
	});

	// TODO: We should try to use touch events instead, I think.
	(function() {
		var optimizeTimeout = null;
		function optimizeTemporarily() {
			if(!scrollView.content) return;
			DOM.classify(scrollView.content, "optimize-speed", true);
			clearTimeout(optimizeTimeout)
			optimizeTimeout = setTimeout(function() {
				DOM.classify(scrollView.content, "optimize-speed", false);
			}, 1000 * 0.2);
		}
		DOM.addListener(document, "mousewheel", function(event) { // Sane browsers.
			if(!scrollView.active) return true;
			optimizeTemporarily();
			scrollView.scrollBy(new Size(event.wheelDeltaX, event.wheelDeltaY)); // TODO: Check the resulting magnitude before optimizing.
		});
		DOM.addListener(document, "DOMMouseScroll", function(event) { // Gecko.
			if(!scrollView.active) return true;
			var size = 1 === event.axis ? new Size(event.detail, 0) : new Size(0, event.detail);
			optimizeTemporarily();
			scrollView.scrollBy(size.scale(5)); // TODO: Check the resulting magnitude before optimizing.
		});
	})();

	(function() {
		var keys = {};
		var scrolling = null;
		var velocity = new Size(0, 0);
		var optimized = false;
		function updateArrowScrolling() {
			busy = false;
			velocity = new Size(0, 0);
			if(bt.hasOwnProperty(keys, 38) || bt.hasOwnProperty(keys, 87)) velocity.h += 1, busy = true;
			if(bt.hasOwnProperty(keys, 40) || bt.hasOwnProperty(keys, 83)) velocity.h -= 1, busy = true;
			if(bt.hasOwnProperty(keys, 37) || bt.hasOwnProperty(keys, 65)) velocity.w += 1, busy = true;
			if(bt.hasOwnProperty(keys, 39) || bt.hasOwnProperty(keys, 68)) velocity.w -= 1, busy = true;
			velocity = velocity.scale(20);
			if(busy && !scrolling) {
				scrolling = animation.start(function(scale) {
					var dist = scrollView.scrollBy(velocity.scale(scale));
					if(dist.w || dist.h) {
						if(!optimized) {
							DOM.classify(scrollView.content, "optimize-speed", true);
							optimized = true;
						}
					} else {
						if(optimized) {
							DOM.classify(scrollView.content, "optimize-speed", false);
							optimized = false;
						}
					}
				});
			} else if(!busy && scrolling) {
				DOM.classify(scrollView.content, "optimize-speed", false);
				optimized = false;
				animation.clear(scrolling);
				scrolling = null;
			}
		}
		function updateZooming() {
			switch(0) { // TODO: Implement zooming shortcuts.
				case 187: // +
				case 189: // -
					return false;
			}
		}
		DOM.addListener(document, "keydown", function(event) {
			if(!scrollView.active) return true; // TODO: When we become inactive, we should automatically release all keys.
			if(event.metaKey) return true; // Simply ignore all Command modifiers.
			var key = event.keyCode || event.which;
console.log(key);
/*			if(!busy && !scrolling) {
				if(handleShortcut(event, key)) {
					event.preventDefault();
					return false;
				}
			}*/
			if(!busy || scrolling) {
				if(!event.shiftKey && !bt.hasOwnProperty(keys, key)) {
					keys[key] = true;
					updateArrowScrolling();
				}
			}
			if(busy || scrolling) {
				event.preventDefault();
				return false;
			}
		});
		DOM.addListener(document, "keyup", function(event) {
			var key = event.keyCode || event.which;
			if(!busy || scrolling) {
				if(bt.hasOwnProperty(keys, key)) {
					delete keys[key];
					updateArrowScrolling();
				}
			} else {
				event.preventDefault();
				return false;
			}
		});
	})();
}
