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
function RelativeScroller(scrollView, event) {
	var scroller = this;
	var setAnimating = scrollView.animator();
	var clicked = true;
	var velocity = new Size(0, 0);
	var element = event.target || event.srcElement;
	var firstPoint = Point.fromEvent(event);
	var latestPoint;
	function recalculateVelocity() {
		var vector = firstPoint.distance(latestPoint).vector();
		vector.mag = Math.max(0, vector.mag - 48);
		vector.mag /= 5; // Linear adjustment seems pretty good TBH.
		velocity = vector.size();
		if(vector.mag) clicked = false;
		setAnimating(vector.mag);
	}
	var scrolling = animation.start(function(scale) {
		var desired = velocity.scale(scale);
		var clamped = scrollView.scrollBy(desired);
		var recalc = false;
		if(clamped.w !== desired.w) {
//				firstPoint.x = latestPoint.x + (latestPoint.x < firstPoint.x ? 24 : -24);
			recalc = true;
		}
		if(clamped.h !== desired.h) {
//				firstPoint.y = latestPoint.y + (latestPoint.y < firstPoint.y ? 24 : -24);
			recalc = true;
		}
		if(recalc) recalculateVelocity();
		// TODO: We need to rework this anyway.
	});
	var clickTimeout = setTimeout(function() {
		clicked = false;
	}, 1000 / 4);

	DOM.classify(scrollView.element, "cursor-hidden"); // This doesn't take effect until the next mouse move, at least in Chrome and Safari, so do it immediately.
	scroller.update = function(point) {
		latestPoint = point;
		recalculateVelocity();
	};
	scroller.end = function() {
		DOM.classify(scrollView.element, "cursor-hidden", false);
		if(clicked) onclick(element)(event);
		animation.clear(scrolling);
		clearTimeout(clickTimeout);
		setAnimating(false);
	};
}
