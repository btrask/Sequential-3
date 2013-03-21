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

/*global setZeroTimeout*/
var KBD = {};
(function() {

function keyEvent(event) {
	var e = event || window.event;
	var keyCode = e.keyCode || e.which;
	return {
		char: null,
		key: keyCode,
		numberPad: 3 === e.keyLocation || (keyCode >= 96/* 0 */ && keyCode <= 106/* * */),
		shift: e.shiftKey,
		meta: e.metaKey,
		ctrl: e.ctrlKey,
		alt: e.altKey
	};
}
function has(a, b) {
	return Object.prototype.hasOwnProperty.call(a, b);
}
function listen(e, l) {
	if(document.addEventListener) document.addEventListener(e, l);
	else if(document.attachEvent) document.attachEvent(e, l);
}
function emit(obj, prop, event) {
	if(!has(obj, prop)) return false;
	var a = obj[prop], l = a.length;
	for(var i = 0; i < l; ++i) a[i](event);
	return !!l;
}

var pendingCount = 0;
var pendingKeyups = [];
var pendingKey = null;
var listeners = {};
listen("keydown", function(event) {
	var key = pendingKey = keyEvent(event);
	++pendingCount;
	setZeroTimeout(function() {
		pendingKey = null;
		console.log(key.char, key.key);
		emit(listeners, "keydown", key);
		if(--pendingCount) return;
		var a = pendingKeyups, l = a.length;
		for(var i = 0; i < l; ++i) emit(listeners, "keyup", a[i]);
		pendingKeyups = [];
	});
});
listen("keypress", function(event) {
	if(pendingKey) pendingKey.char = String.fromCharCode(event.charCode).toLowerCase();
	pendingKey = null;
});
listen("keyup", function(event) {
	var key = keyEvent(event);
	if(pendingCount) pendingKeyups.push(key);
	else emit(listeners, "keyup", key);
});
KBD.addEventListener = function(event, listener) {
	if(!has(listeners, event)) listeners[event] = [];
	listeners[event].push(listener);
};
KBD.removeEventListener = function(event, listener) {
	if(!has(listeners, event)) return;
	var a = listeners[event];
	var i = a.indexOf(listener);
	if(-1 !== i) a.splice(i, 1);
};

var bindings = [];
KBD.addEventListener("keydown", function(event) {
	function match(a, b) {
		switch(a) {
			case null: return true;
			case true: return b;
			default: return !b;
		}
	}
	function compare(a, b) {
		if(!match(a.numberPad, b.numberPad)) return false;
		if(!match(a.shift, b.shift)) return false;
		if(!match(a.ctrl, b.ctrl)) return false;
		if(!match(a.meta, b.meta)) return false;
		if(!match(a.alt, b.alt)) return false;
		return true;
	}
	function emit(filter) {
		var emitted = false, b;
		for(var i = 0; i < bindings.length; ++i) {
			b = bindings[i];
			if(!filter(b, event) || !compare(b, event)) continue;
			b.listener(event);
			emitted = true;
		}
		return emitted;
	}
	emit(function(a, b) { return a.char === b.char; }) ||
	emit(function(a, b) { return a.key === b.key; });
});
KBD.bind = function(event, listener) {
	var binding = {
		listener: listener,
		char: "string" === typeof event.char ? event.char.toLowerCase() : event.char,
		key: event.key,
		numberPad: event.numberPad,
		shift: event.shift,
		ctrl: event.ctrl,
		meta: event.meta,
		alt: event.alt
	};
	bindings.push(binding);
	return function unbind() {
		var i = bindings.indexOf(binding);
		if(-1 !== i) bindings.splice(i, 1);
	};
};

})();
