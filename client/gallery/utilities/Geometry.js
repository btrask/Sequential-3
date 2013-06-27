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
var Geometry = {};
Geometry.clamp = function(a, val, b) {
	if(a < b) {
		if(val < a) return a;
		if(val > b) return b;
	} else {
		if(val < b) return b;
		if(val > a) return a;
	}
	return val;
};
Geometry.clampMax = function(min, val, max) {
	if(min > max) return max;
	if(val < min) return min;
	if(val > max) return max;
	return val;
};
Geometry.clampMin = function(min, val, max) {
	if(min > max) return min;
	if(val < min) return min;
	if(val > max) return max;
	return val;
};
// <https://en.wikipedia.org/wiki/Rounding#Rounding_to_integer>
// Because we use the >> operator, these functions are constrained to 32-bit integer results.
// Check if the value equals itself to detect and preserve NaNs.
Geometry.roundToZero = function(x) {
	if(x !== x) return x;
	return x >> 0;
};
Geometry.roundFromZero = function(x) {
	if(x !== x) return x;
	var y = x >> 0;
	if(x === y) return y;
	return x > 0 ? y+1 : y-1;
};
Geometry.TAU = Math.PI * 2;

function Point(x, y) {
	var point = this;
	point.x = x;
	point.y = y;
}
Point.prototype.toString = function() {
	return "{"+this.x+", "+this.y+"}";
};
Point.prototype.round = function() {
	return new Point(Math.round(this.x), Math.round(this.y));
};
Point.prototype.offset = function(size) {
	return new Point(this.x + size.w, this.y + size.h);
};
Point.prototype.clamp = function(rect) {
	var x = rect.o.x, y = rect.o.y;
	return new Point(Geometry.clamp(x, this.x, x + rect.s.w), Geometry.clamp(y, this.y, y + rect.s.h));
};
Point.prototype.distance = function(that) {
	return new Size(this.x - that.x, this.y - that.y);
};
Point.fromEvent = function(event) {
	return new this(event.clientX, event.clientY);
};

function Size(w, h) {
	var size = this;
	size.w = w;
	size.h = h;
}
Size.prototype.toString = function() {
	return "{"+this.w+", "+this.h+"}";
};
Size.prototype.sum = function(that) {
	return new Size(this.w + that.w, this.h + that.h);
};
Size.prototype.difference = function(that) {
	return new Size(this.w - that.w, this.h - that.h);
};
Size.prototype.quotient = function(that) {
	return new Size(this.w / that.w, this.h / that.h);
};
Size.prototype.product = function(that) {
	return new Size(this.w * that.w, this.h * that.h);
};
Size.prototype.scale = function(s) {
	return new Size(this.w * s, this.h * s);
};
Size.prototype.min = function() {
	var w = this.w, h = this.h;
	return Math.abs(w) < Math.abs(h) ? w : h;
};
Size.prototype.max = function() {
	var w = this.w, h = this.h;
	return Math.abs(w) > Math.abs(h) ? w : h;
};
Size.prototype.clamp = function(rect) {
	var x = rect.o.x, y = rect.o.y;
	return new Size(Geometry.clamp(x, this.w, x + rect.s.w), Geometry.clamp(y, this.h, y + rect.s.h)); // TODO: Repeated code from point.clamp()...
};
Size.prototype.round = function() {
	return new Size(Math.round(this.w), Math.round(this.h));
};
Size.prototype.roundToZero = function() {
	return new Size(Geometry.roundToZero(this.w), Geometry.roundToZero(this.h));
};
Size.prototype.roundFromZero = function() {
	return new Size(Geometry.roundFromZero(this.w), Geometry.roundFromZero(this.h));
};
Size.prototype.vector = function() {
	return new Vector(Math.atan2(this.h, this.w) / Geometry.TAU, Math.sqrt(this.w * this.w + this.h * this.h));
};
Size.prototype.pointFromOrigin = function() {
	return new Point(this.w, this.h);
};
Size.fromElement = function(element) {
	return new this(element.offsetWidth, element.offsetHeight);
};
Size.zero = new Size(0, 0);

function Rect(o, s) {
	var rect = this;
	if(!(o instanceof Point)) throw "Invalid origin";
	if(!(s instanceof Size)) throw "Invalid size";
	rect.o = o;
	rect.s = s;
}
Rect.prototype.toString = function() {
	return "{"+this.o+", "+this.s+"}";
};
Rect.prototype.inset = function(size) {
	return new Rect(this.o.offset(size), this.s.difference(size));
};
Rect.prototype.offset = function(size) {
	return new Rect(this.o.offset(size), this.s);
};
Rect.prototype.extent = function() {
	return this.o.offset(this.s);
};
Rect.prototype.intersect = function(rect) {
	var o = this.o.clamp(rect);
	var s = this.extent().clamp(rect).distance(o);
	return new Rect(o, s);
};
Rect.prototype.point = function(dir) {
	var r = this;
	var d = dir || Size.zero;
	return new Point(r.o.x + r.s.w*(d.w+1)/2, r.o.y + r.s.h*(d.h+1)/2);
};
Rect.make = function(x, y, w, h) {
	return new Rect(new Point(x, y), new Size(w, h));
};

function Vector(dir, mag) {
	var vect = this;
	vect.dir = dir;
	vect.mag = mag;
}
Vector.prototype.toString = function() {
	return "{"+this.dir+", "+this.mag+"}";
};
Vector.prototype.size = function() {
	return new Size(Math.cos(Geometry.TAU * this.dir) * this.mag, Math.sin(Geometry.TAU * this.dir) * this.mag);
};
