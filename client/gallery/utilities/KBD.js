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
var KBD = {};
(function() {

var NUMBER_PAD_0 = 96;
var NUMBER_PAD_ASTERISK = 106;
function keyEvent(event) {
	var e = event || window.event;
	var keyCode = e.keyCode || e.which;
	return {
		"charCode": null,
		"keyCode": keyCode,
		"shiftKey": e.shiftKey,
		"metaKey": e.metaKey,
		"ctrlKey": e.ctrlKey,
		"altKey": e.altKey,
		"numberPad": 3 === e.keyLocation || (keyCode >= NUMBER_PAD_0 && keyCode <= NUMBER_PAD_ASTERISK)
	};
}
function has(a, b) {
	return Object.prototype.hasOwnProperty.call(a, b);
}
function listen(e, l) {
	if(document.addEventListener) document.addEventListener(e, l);
	else if(document.attachEvent) document.attachEvent(e, l);
}
function toCharCode(charCode) {
	return "string" === typeof charCode ? charCode.charCodeAt(0) : charCode;
}
function addListener(obj, prop, listener) {
	if(!prop) return;
	if(!has(obj, prop)) obj[prop] = [];
	obj[prop].push(listener);
}
function removeListener(obj, prop, listener) {
	if(!has(obj, prop)) return;
	var a = obj[prop];
	var i = a.indexOf(listener);
	if(-1 !== i) a.splice(i, 1);
}
function emit(obj, prop, event) {
	if(!has(obj, prop)) return false;
	var a = obj[prop], l = a.length;
	for(var i = 0; i < l; ++i) a[i](event);
	return !!l;
}

var pendingKey = null;
var listeners = {};
listen("keydown", function(event) {
	var key = pendingKey = keyEvent(event);
	setTimeout(function() {
		pendingKey = null;
		emit(listeners, "keydown", key);
	}, 0);
});
listen("keypress", function(event) {
	if(pendingKey) pendingKey.charCode = event.charCode;
	pendingKey = null;
});
listen("keyup", function(event) {
	emit(listeners, "keyup", keyEvent(event));
});
KBD.addEventListener = function(event, listener) {
	addListener(listeners, event, listener);
};
KBD.removeEventListener = function(event, listener) {
	removeListener(listeners, event, listener);
};

var charCodeBindings = {};
var keyCodeBindings = {};
KBD.addEventListener("keydown", function(event) {
	emit(charCodeBindings, event.charCode, event) ||
	emit(keyCodeBindings, event.keyCode, event);
});
KBD.bind = function(char, keyCode, listener) {
	var charCode = toCharCode(char);
	addListener(charCodeBindings, charCode, listener);
	addListener(keyCodeBindings, keyCode, listener);
};
KBD.unbind = function(char, keyCode, listener) {
	var charCode = toCharCode(char);
	removeListener(charCodeBindings, charCode, listener);
	removeListener(keyCodeBindings, keyCode, listener);
};

})();
