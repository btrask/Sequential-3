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

/*global Size*/
function ReadingDirection(ltr) {
	var dir = this;
	dir.ltr = Boolean(ltr);
	dir.rtl = !dir.ltr;
	dir.previousShortcut = dir.ltr ? "[" : "]";
	dir.nextShortcut = dir.rtl ? "[" : "]";
	dir.firstShortcut = dir.ltr ? "Shift-[" : "Shift-]";
	dir.lastShortcut = dir.rtl ? "Shift-[" : "Shift-]";
	dir.forwardKeyCode = dir.ltr ? 221 : 219;
	dir.backwardKeyCode = dir.rtl ? 221 : 219;
	dir.size = dir.ltr ? new Size(1, 1) : new Size(-1, 1);
}
ReadingDirection.prototype.classify = function(element) {
	DOM.classify(element, "ltr", this.ltr);
	DOM.classify(element, "rtl", this.rtl);
};
ReadingDirection.prototype.stringify = function() {
	return JSON.stringify({"ltr": this.ltr});
};
ReadingDirection.parse = function(json) {
	try {
		return new ReadingDirection(JSON.parse(json)["ltr"]);
	} catch(e) {
		return new ReadingDirection(true);
	}
};
