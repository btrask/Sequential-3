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
var sort;
try { sort = exports; } catch(e) { sort = {}; }

sort.numericStringCompare = function(a, b) {
	a = a.toLocaleLowerCase();
	b = b.toLocaleLowerCase();
	var ca, cb, diff;
	function numeric(c) {
		return c >= "0" && c <= "9";
	}
	for(var i = 0, j = 0; i < a.length && j < b.length; ++i, ++j) {
		ca = a[i];
		cb = b[j]; // TODO: Even better, just keep track of the positions and use .slice()
		if(numeric(ca) && numeric(cb)) {
			for(ca = [ca]; numeric(a[i + 1]); ++i) ca.push(a[i + 1]);
			for(cb = [cb]; numeric(b[j + 1]); ++j) cb.push(b[j + 1]);
			diff = parseInt(ca.join(""), 10) - parseInt(cb.join(""), 10);
		} else {
			diff = ca.localeCompare(cb);
		}
		if(diff) return diff;
	}
	return (a.length - i) - (b.length - j); // TODO: Should we be smarter about file extensions somehow?
};
