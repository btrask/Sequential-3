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
var bt;
try { bt = exports; } catch(e) { bt = {}; }

bt.hasOwnProperty = function(obj, prop) { // To prevent overriding.
	return Object.prototype.hasOwnProperty.call(obj, prop);
};
bt.map = function(obj, callback/* (value, key, obj) */) {
	var result, key, value, i;
	if(Array.isArray(obj)) {
		result = [];
		for(i = 0; i < obj.length; ++i) {
			value = callback(obj[i], i, obj);
			if(undefined !== value) result.push(value);
		}
	} else {
		result = {};
		for(key in obj) if(bt.hasOwnProperty(obj, key)) {
			value = callback(obj[key], key, obj);
			if(undefined !== value) result[key] = value;
		}
	}
	return result;
};
