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
function Scaler(scrollView) {
	this.scrollView = scrollView;
	this.lastScale = null;
}
Scaler.prototype.scaledSize = function(size, border) {
	var scale = this.computedScale(size, border);
	var minimum = Math.min(1, new Size(32, 32).quotient(size).min());
	var limitedScale = this.lastScale = Math.max(scale, minimum);
	return size.scale(limitedScale);
};
Scaler.prototype.relativeScaler = function(scale) {
	return new ProportionalScaler(this.scrollView, this.lastScale * scale);
};
Scaler.parse = function(json, scrollView) {
	try {
		var obj = JSON.parse(json);
		switch(obj.name) {
		case "Proportional": return new ProportionalScaler(scrollView, obj.scale);
		case "Fit": return new FitScaler(scrollView, obj.type);
		case "AlmostFit":
		}
	} catch(e) {}
	return new AlmostFitScaler(scrollView);
};

function ProportionalScaler(scrollView, scale) {
	Scaler.call(this, scrollView);
	this.lastScale = this.scale = scale;
}
ProportionalScaler.prototype = new Scaler();
ProportionalScaler.prototype.computedScale = function(size, border) {
	return this.scale;
};
ProportionalScaler.prototype.stringify = function() {
	return JSON.stringify({name: "Proportional", scale: this.scale});
};
function FitScaler(scrollView, type) {
	Scaler.call(this, scrollView);
	switch(type) {
		case "min":
		case "max":
			this.type = type; break;
		default: throw new Error("Bad FitScaler type");
	}
}
FitScaler.prototype = new Scaler();
FitScaler.prototype.computedScale = function(size, border) {
	var bounds = Size.fromElement(this.scrollView.element).difference(border || Size.zero);
	return bounds.quotient(size)[this.type]();
};
FitScaler.prototype.stringify = function() {
	return JSON.stringify({name: "Fit", type: this.type});
};
function AlmostFitScaler(scrollView) {
	Scaler.call(this, scrollView);
}
AlmostFitScaler.prototype = new Scaler();
AlmostFitScaler.prototype.computedScale = function(size, border) {
	var chunks = 2;
	var overlap = 0.5;
	var skip = 0.15;

	var bounds = Size.fromElement(this.scrollView.element).difference(border || Size.zero);
	var skipScale = bounds.scale(1 + skip).quotient(size).min();
	var almostFitScale = bounds.scale(1 + (1 - overlap) * (chunks - 1)).quotient(size).min();
	var maxOneWayScrollScale = bounds.quotient(size).max();
	return Geometry.clampMin(skipScale, almostFitScale, maxOneWayScrollScale);
};
AlmostFitScaler.prototype.stringify = function() {
	return JSON.stringify({name: "AlmostFit"});
};
